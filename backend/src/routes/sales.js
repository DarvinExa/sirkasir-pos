const db = require('../db');
const { HttpError, uid } = require('../utils');
const loyalty = require('../loyalty');
const promo = require('../promo');

function pad(n) {
  return String(n).padStart(2, '0');
}

function invoiceNumber(d) {
  const now = new Date();
  const key = 'INV-' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate());
  d.counters = d.counters || {};
  d.counters[key] = (d.counters[key] || 0) + 1;
  return key + '-' + String(d.counters[key]).padStart(4, '0');
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Kurangi stok bahan berdasarkan resep (BOM) dari sebuah menu.
function applyStockForItem(d, menuItemId, qty, sign, ref, userId) {
  const recipes = d.recipes.filter((r) => r.menu_item_id === menuItemId);
  for (const r of recipes) {
    const ing = d.ingredients.find((i) => i.id === r.ingredient_id);
    if (!ing) continue;
    const delta = sign * r.qty * qty;
    ing.stock = round2((ing.stock || 0) + delta);
    d.stock_movements.push({
      id: uid('mov'),
      ingredient_id: ing.id,
      type: sign < 0 ? 'sale' : 'void',
      qty: round2(delta),
      ref,
      user_id: userId || null,
      created_at: new Date().toISOString(),
    });
  }
}

module.exports = [
  {
    method: 'POST',
    path: '/api/transactions',
    auth: true,
    handler: async ({ body, user }) => {
      const d = db.get();
      const rawItems = Array.isArray(body.items) ? body.items : [];
      if (rawItems.length === 0) throw new HttpError(400, 'Keranjang masih kosong.');

      const items = [];
      let subtotal = 0;
      let costTotal = 0;
      for (const ri of rawItems) {
        const menu = d.menu_items.find((m) => m.id === ri.menu_item_id);
        if (!menu) throw new HttpError(400, `Menu tidak ditemukan: ${ri.menu_item_id}`);
        const qty = Math.max(1, parseInt(ri.qty, 10) || 1);
        const lineDiscount = Math.max(0, Number(ri.discount) || 0);
        const lineSubtotal = menu.price * qty - lineDiscount;
        subtotal += lineSubtotal;
        costTotal += menu.cost * qty;
        items.push({
          menu_item_id: menu.id,
          name: menu.name,
          qty,
          price: menu.price,
          cost: menu.cost,
          notes: ri.notes || '',
          discount: lineDiscount,
          subtotal: lineSubtotal,
        });
      }

      const cartDiscount = Math.max(0, Number(body.discount) || 0);
      const customer = body.customer_id
        ? (d.customers || []).find((c) => c.id === body.customer_id)
        : null;
      const promoEval = promo.evaluate(d, {
        items: items.map((it) => ({ menu_item_id: it.menu_item_id, price: it.price, qty: it.qty })),
        subtotal,
        customer,
        now: new Date(),
        code: body.promo_code,
      });
      const promoDiscount = promoEval.totalDiscount;
      const { redeemedPoints, redeemValue } = loyalty.redeemInfo(d, customer, body.redeem_points);
      const afterDiscount = Math.max(0, subtotal - cartDiscount - promoDiscount - redeemValue);
      const taxPercent = Number(d.settings.tax_percent) || 0;
      const servicePercent = Number(d.settings.service_percent) || 0;
      const tax = Math.round((afterDiscount * taxPercent) / 100);
      const serviceCharge = Math.round((afterDiscount * servicePercent) / 100);
      const total = afterDiscount + tax + serviceCharge;

      const payments = Array.isArray(body.payments) ? body.payments : [];
      const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      if (paid < total) {
        throw new HttpError(400, 'Nominal pembayaran kurang dari total.');
      }
      const change = paid - total;

      const invoice_no = invoiceNumber(d);
      const tx = {
        id: uid('trx'),
        invoice_no,
        cashier_id: user.id,
        cashier_name: user.name,
        customer_id: customer ? customer.id : null,
        customer_name: customer ? customer.name : body.customer_name || '',
        order_type: body.order_type || 'dine-in',
        items,
        subtotal,
        discount: cartDiscount,
        promo_discount: promoDiscount,
        promos: promoEval.applied,
        tax,
        service_charge: serviceCharge,
        total,
        cost_total: costTotal,
        profit: total - tax - serviceCharge - costTotal,
        payments: payments.map((p) => ({
          method: p.method || 'cash',
          amount: Number(p.amount) || 0,
          reference: p.reference || '',
        })),
        paid,
        change,
        status: 'paid',
        created_at: new Date().toISOString(),
      };

      for (const it of items) {
        applyStockForItem(d, it.menu_item_id, it.qty, -1, invoice_no, user.id);
      }

      tx.loyalty = loyalty.apply(d, customer, { total, redeemedPoints, redeemValue, tx });
      d.transactions.push(tx);
      db.save();
      return tx;
    },
  },
  {
    method: 'GET',
    path: '/api/transactions',
    auth: true,
    handler: async ({ query }) => {
      let list = db.get().transactions.slice();
      if (query.from) list = list.filter((t) => t.created_at >= query.from);
      if (query.to) list = list.filter((t) => t.created_at <= query.to + 'T23:59:59.999Z');
      list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      const limit = parseInt(query.limit, 10);
      if (limit) list = list.slice(0, limit);
      return list;
    },
  },
  {
    method: 'GET',
    path: '/api/transactions/:id',
    auth: true,
    handler: async ({ params }) => {
      const tx = db.get().transactions.find((t) => t.id === params.id || t.invoice_no === params.id);
      if (!tx) throw new HttpError(404, 'Transaksi tidak ditemukan.');
      return tx;
    },
  },
  {
    method: 'POST',
    path: '/api/transactions/:id/void',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params, user }) => {
      const d = db.get();
      const tx = d.transactions.find((t) => t.id === params.id);
      if (!tx) throw new HttpError(404, 'Transaksi tidak ditemukan.');
      if (tx.status === 'void') throw new HttpError(400, 'Transaksi sudah dibatalkan.');
      tx.status = 'void';
      tx.voided_at = new Date().toISOString();
      tx.voided_by = user.name;
      for (const it of tx.items) {
        applyStockForItem(d, it.menu_item_id, it.qty, 1, tx.invoice_no + '-VOID', user.id);
      }
      db.save();
      return tx;
    },
  },
];
