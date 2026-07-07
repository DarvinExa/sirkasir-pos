// Mode restoran: meja, order bertahap, KDS, modifier, split bill.
const db = require('../db');
const { HttpError, uid } = require('../utils');
const loyalty = require('../loyalty');
const promo = require('../promo');

function round2(n) {
  return Math.round(n * 100) / 100;
}
function pad(n) {
  return String(n).padStart(2, '0');
}
function counterNo(d, prefix, width) {
  const now = new Date();
  const key = prefix + '-' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate());
  d.counters = d.counters || {};
  d.counters[key] = (d.counters[key] || 0) + 1;
  return key + '-' + String(d.counters[key]).padStart(width, '0');
}

function applyStock(d, menuItemId, qty, sign, ref, userId) {
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

function stationFor(d, menu) {
  if (menu.station) return menu.station;
  const cat = d.categories.find((c) => c.id === menu.category_id);
  if (cat && cat.name && cat.name.toLowerCase().includes('minuman')) return 'bar';
  return 'kitchen';
}

function buildOrderItem(d, ri) {
  const menu = d.menu_items.find((m) => m.id === ri.menu_item_id);
  if (!menu) throw new HttpError(400, `Menu tidak ditemukan: ${ri.menu_item_id}`);
  if (menu.is_available === false) throw new HttpError(400, `${menu.name} sedang habis.`);
  const qty = Math.max(1, parseInt(ri.qty, 10) || 1);
  const mods = Array.isArray(ri.modifiers)
    ? ri.modifiers.map((m) => ({
        group_name: m.group_name || m.group || '',
        name: m.name,
        price: Number(m.price) || 0,
      }))
    : [];
  const modPrice = mods.reduce((s, m) => s + m.price, 0);
  return {
    id: uid('oit'),
    menu_item_id: menu.id,
    name: menu.name,
    base_price: menu.price,
    price: menu.price + modPrice,
    cost: menu.cost,
    qty,
    notes: ri.notes || '',
    modifiers: mods,
    station: stationFor(d, menu),
    kitchen_status: 'pending',
    status: 'active',
    paid: false,
    paid_tx: null,
    created_at: new Date().toISOString(),
  };
}

function orderSummary(o) {
  const active = o.items.filter((i) => i.status === 'active');
  return {
    id: o.id,
    order_no: o.order_no,
    guests: o.guests,
    customer_name: o.customer_name,
    item_count: active.reduce((s, i) => s + i.qty, 0),
    total: active.reduce((s, i) => s + i.price * i.qty, 0),
    unpaid_count: active.filter((i) => !i.paid).length,
    created_at: o.created_at,
  };
}

function tableWithOrder(d, t) {
  // Meja dianggap terisi hanya bila ada order terbuka yang SUDAH punya item aktif.
  // Order kosong (belum pesan apa-apa) tidak lagi menandai meja jadi terisi.
  const order = (d.orders || []).find(
    (o) => o.table_id === t.id && o.status === 'open' && o.items.some((i) => i.status === 'active')
  );
  return { ...t, order: order ? orderSummary(order) : null };
}

function findOrder(d, id) {
  const o = (d.orders || []).find((x) => x.id === id);
  if (!o) throw new HttpError(404, 'Order tidak ditemukan.');
  return o;
}

module.exports = [
  // Meja / tables
  {
    method: 'GET',
    path: '/api/tables',
    auth: true,
    handler: async () => {
      const d = db.get();
      return (d.tables || []).map((t) => tableWithOrder(d, t));
    },
  },
  {
    method: 'POST',
    path: '/api/tables',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ body }) => {
      const d = db.get();
      d.tables = d.tables || [];
      const t = {
        id: uid('tbl'),
        name: body.name || 'Meja ' + (d.tables.length + 1),
        area: body.area || 'Indoor',
        seats: Number(body.seats) || 4,
        status: 'available',
      };
      d.tables.push(t);
      db.save();
      return t;
    },
  },
  {
    method: 'PUT',
    path: '/api/tables/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params, body }) => {
      const d = db.get();
      const t = (d.tables || []).find((x) => x.id === params.id);
      if (!t) throw new HttpError(404, 'Meja tidak ditemukan.');
      if (body.name != null) t.name = body.name;
      if (body.area != null) t.area = body.area;
      if (body.seats != null) t.seats = Number(body.seats);
      db.save();
      return t;
    },
  },
  {
    method: 'DELETE',
    path: '/api/tables/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params }) => {
      const d = db.get();
      const idx = (d.tables || []).findIndex((x) => x.id === params.id);
      if (idx === -1) throw new HttpError(404, 'Meja tidak ditemukan.');
      const open = (d.orders || []).find((o) => o.table_id === params.id && o.status === 'open');
      if (open) throw new HttpError(400, 'Meja masih punya order aktif.');
      d.tables.splice(idx, 1);
      db.save();
      return { ok: true };
    },
  },

  // Orders
  {
    method: 'GET',
    path: '/api/orders',
    auth: true,
    handler: async ({ query }) => {
      const d = db.get();
      let list = (d.orders || []).slice();
      const status = query.status || 'open';
      if (status !== 'all') list = list.filter((o) => o.status === status);
      list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return list;
    },
  },
  {
    method: 'GET',
    path: '/api/orders/:id',
    auth: true,
    handler: async ({ params }) => findOrder(db.get(), params.id),
  },
  {
    method: 'POST',
    path: '/api/orders',
    auth: true,
    handler: async ({ body, user }) => {
      const d = db.get();
      d.orders = d.orders || [];
      const type = body.type || 'dine-in';
      let table = null;
      if (type === 'dine-in') {
        if (!body.table_id) throw new HttpError(400, 'Pilih meja terlebih dahulu.');
        table = (d.tables || []).find((t) => t.id === body.table_id);
        if (!table) throw new HttpError(404, 'Meja tidak ditemukan.');
        const existing = d.orders.find((o) => o.table_id === table.id && o.status === 'open');
        if (existing) return existing; // lanjutkan order yang sudah ada
      }
      const order = {
        id: uid('ord'),
        order_no: counterNo(d, 'ORD', 4),
        type,
        table_id: table ? table.id : null,
        table_name: table ? table.name : null,
        guests: Number(body.guests) || 1,
        customer_id: body.customer_id || null,
        customer_name: body.customer_name || '',
        cashier_id: user.id,
        cashier_name: user.name,
        items: [],
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      for (const ri of body.items || []) order.items.push(buildOrderItem(d, ri));
      d.orders.push(order);
      if (table) table.status = 'occupied';
      db.save();
      return order;
    },
  },
  {
    method: 'POST',
    path: '/api/orders/:id/items',
    auth: true,
    handler: async ({ params, body }) => {
      const d = db.get();
      const o = findOrder(d, params.id);
      if (o.status !== 'open') throw new HttpError(400, 'Order sudah ditutup.');
      const items = Array.isArray(body.items) ? body.items : [];
      if (items.length === 0) throw new HttpError(400, 'Tidak ada item untuk ditambahkan.');
      for (const ri of items) o.items.push(buildOrderItem(d, ri));
      o.updated_at = new Date().toISOString();
      db.save();
      return o;
    },
  },
  {
    method: 'PATCH',
    path: '/api/orders/:id/items/:itemId',
    auth: true,
    handler: async ({ params, body }) => {
      const d = db.get();
      const o = findOrder(d, params.id);
      const it = o.items.find((i) => i.id === params.itemId);
      if (!it) throw new HttpError(404, 'Item tidak ditemukan.');
      if (body.kitchen_status) {
        const allowed = ['pending', 'preparing', 'ready', 'served'];
        if (!allowed.includes(body.kitchen_status)) throw new HttpError(400, 'Status tidak valid.');
        it.kitchen_status = body.kitchen_status;
      }
      if (body.qty != null && !it.paid) it.qty = Math.max(1, parseInt(body.qty, 10) || 1);
      if (body.notes != null) it.notes = body.notes;
      o.updated_at = new Date().toISOString();
      db.save();
      return o;
    },
  },
  {
    method: 'DELETE',
    path: '/api/orders/:id/items/:itemId',
    auth: true,
    handler: async ({ params }) => {
      const d = db.get();
      const o = findOrder(d, params.id);
      const it = o.items.find((i) => i.id === params.itemId);
      if (!it) throw new HttpError(404, 'Item tidak ditemukan.');
      if (it.paid) throw new HttpError(400, 'Item sudah dibayar, tidak bisa dihapus.');
      it.status = 'void';
      o.updated_at = new Date().toISOString();
      db.save();
      return o;
    },
  },
  {
    method: 'POST',
    path: '/api/orders/:id/void',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params }) => {
      const d = db.get();
      const o = findOrder(d, params.id);
      if (o.items.some((i) => i.paid)) {
        throw new HttpError(400, 'Order sudah ada pembayaran, tidak bisa dibatalkan.');
      }
      o.status = 'void';
      o.closed_at = new Date().toISOString();
      const table = (d.tables || []).find((t) => t.id === o.table_id);
      if (table) table.status = 'available';
      db.save();
      return o;
    },
  },

  {
    method: 'POST',
    path: '/api/orders/:id/move',
    auth: true,
    handler: async ({ params, body }) => {
      const d = db.get();
      const o = findOrder(d, params.id);
      if (o.status !== 'open') throw new HttpError(400, 'Order sudah ditutup.');
      const target = (d.tables || []).find((t) => t.id === body.table_id);
      if (!target) throw new HttpError(404, 'Meja tujuan tidak ditemukan.');
      if (target.id === o.table_id) return o;
      const occupied = (d.orders || []).find(
        (x) =>
          x.table_id === target.id &&
          x.status === 'open' &&
          x.id !== o.id &&
          x.items.some((i) => i.status === 'active')
      );
      if (occupied) throw new HttpError(400, 'Meja tujuan sedang terisi.');
      const oldTable = (d.tables || []).find((t) => t.id === o.table_id);
      if (oldTable) oldTable.status = 'available';
      o.table_id = target.id;
      o.table_name = target.name;
      o.type = 'dine-in';
      target.status = 'occupied';
      o.updated_at = new Date().toISOString();
      db.save();
      return o;
    },
  },

  // KDS (Kitchen Display)
  {
    method: 'GET',
    path: '/api/kitchen',
    auth: true,
    handler: async ({ query }) => {
      const d = db.get();
      const station = query.station;
      const tickets = [];
      for (const o of (d.orders || []).filter((x) => x.status === 'open')) {
        for (const it of o.items) {
          if (it.status !== 'active') continue;
          if (it.kitchen_status === 'served') continue;
          if (station && it.station !== station) continue;
          tickets.push({
            order_id: o.id,
            order_no: o.order_no,
            table_name: o.table_name,
            type: o.type,
            item: it,
          });
        }
      }
      tickets.sort((a, b) => (a.item.created_at > b.item.created_at ? 1 : -1));
      return tickets;
    },
  },
  {
    method: 'PATCH',
    path: '/api/kitchen/:orderId/:itemId',
    auth: true,
    handler: async ({ params, body }) => {
      const d = db.get();
      const o = findOrder(d, params.orderId);
      const it = o.items.find((i) => i.id === params.itemId);
      if (!it) throw new HttpError(404, 'Item tidak ditemukan.');
      const flow = { pending: 'preparing', preparing: 'ready', ready: 'served' };
      it.kitchen_status = body.kitchen_status || flow[it.kitchen_status] || it.kitchen_status;
      o.updated_at = new Date().toISOString();
      db.save();
      return it;
    },
  },

  // Bayar / split bill
  {
    method: 'POST',
    path: '/api/orders/:id/pay',
    auth: true,
    handler: async ({ params, body, user }) => {
      const d = db.get();
      const o = findOrder(d, params.id);
      if (o.status !== 'open') throw new HttpError(400, 'Order sudah ditutup.');
      const active = o.items.filter((i) => i.status === 'active' && !i.paid);
      if (active.length === 0) throw new HttpError(400, 'Tidak ada item untuk dibayar.');

      let payItems;
      if (Array.isArray(body.item_ids) && body.item_ids.length) {
        payItems = active.filter((i) => body.item_ids.includes(i.id));
        if (payItems.length === 0) throw new HttpError(400, 'Item pilihan tidak ditemukan.');
      } else {
        payItems = active;
      }

      let subtotal = 0;
      let costTotal = 0;
      const txItems = payItems.map((it) => {
        const line = it.price * it.qty;
        subtotal += line;
        costTotal += it.cost * it.qty;
        return {
          menu_item_id: it.menu_item_id,
          name: it.name,
          qty: it.qty,
          price: it.price,
          cost: it.cost,
          notes: it.notes,
          modifiers: it.modifiers,
          discount: 0,
          subtotal: line,
        };
      });

      const discount = Math.max(0, Number(body.discount) || 0);
      const customer =
        (body.customer_id && (d.customers || []).find((c) => c.id === body.customer_id)) ||
        (o.customer_id && (d.customers || []).find((c) => c.id === o.customer_id)) ||
        null;
      const promoEval = promo.evaluate(d, {
        items: txItems.map((it) => ({ menu_item_id: it.menu_item_id, price: it.price, qty: it.qty })),
        subtotal,
        customer,
        now: new Date(),
        code: body.promo_code,
      });
      const promoDiscount = promoEval.totalDiscount;
      const { redeemedPoints, redeemValue } = loyalty.redeemInfo(d, customer, body.redeem_points);
      const afterDiscount = Math.max(0, subtotal - discount - promoDiscount - redeemValue);
      const taxPercent = Number(d.settings.tax_percent) || 0;
      const servicePercent = Number(d.settings.service_percent) || 0;
      const tax = Math.round((afterDiscount * taxPercent) / 100);
      const serviceCharge = Math.round((afterDiscount * servicePercent) / 100);
      const total = afterDiscount + tax + serviceCharge;

      const payments = Array.isArray(body.payments) ? body.payments : [];
      const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      if (paid < total) throw new HttpError(400, 'Nominal pembayaran kurang dari total.');

      const invoice_no = counterNo(d, 'INV', 4);
      const tx = {
        id: uid('trx'),
        invoice_no,
        cashier_id: user.id,
        cashier_name: user.name,
        customer_id: customer ? customer.id : null,
        customer_name: customer ? customer.name : o.customer_name || '',
        order_type: o.type,
        order_id: o.id,
        table_name: o.table_name || '',
        items: txItems,
        subtotal,
        discount,
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
        change: paid - total,
        status: 'paid',
        created_at: new Date().toISOString(),
      };

      tx.loyalty = loyalty.apply(d, customer, { total, redeemedPoints, redeemValue, tx });
      for (const it of payItems) applyStock(d, it.menu_item_id, it.qty, -1, invoice_no, user.id);
      for (const it of payItems) {
        it.paid = true;
        it.paid_tx = tx.id;
        it.kitchen_status = 'served';
      }
      d.transactions.push(tx);

      const remaining = o.items.filter((i) => i.status === 'active' && !i.paid);
      if (remaining.length === 0) {
        o.status = 'paid';
        o.closed_at = new Date().toISOString();
        const table = (d.tables || []).find((t) => t.id === o.table_id);
        if (table) table.status = 'available';
      }
      o.updated_at = new Date().toISOString();
      db.save();
      return { transaction: tx, order: o, fully_paid: remaining.length === 0 };
    },
  },
];
