const repo = require('../repo');
const { HttpError, uid } = require('../utils');
const loyalty = require('../loyalty');
const promo = require('../promo');
const { applyStock } = require('../stock');

module.exports = [
  {
    method: 'POST',
    path: '/api/transactions',
    auth: true,
    handler: async ({ body, user }) => {
      const rawItems = Array.isArray(body.items) ? body.items : [];
      if (rawItems.length === 0) throw new HttpError(400, 'Keranjang masih kosong.');

      return repo.tx(async (client) => {
        const menus = await repo.menuItems.all(client);
        const items = [];
        let subtotal = 0;
        let costTotal = 0;
        for (const ri of rawItems) {
          const menu = menus.find((m) => m.id === ri.menu_item_id);
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
        const customer = body.customer_id ? await repo.customers.find(body.customer_id, client) : null;
        const settings = await repo.getSettings(client);
        const promosList = await repo.promos.all(client);
        const promoEval = promo.evaluate(promosList, {
          items: items.map((it) => ({ menu_item_id: it.menu_item_id, price: it.price, qty: it.qty })),
          subtotal,
          customer,
          now: new Date(),
          code: body.promo_code,
        });
        const promoDiscount = promoEval.totalDiscount;
        const { redeemedPoints, redeemValue } = loyalty.redeemInfo(settings, customer, body.redeem_points);
        const afterDiscount = Math.max(0, subtotal - cartDiscount - promoDiscount - redeemValue);
        const taxPercent = Number(settings.tax_percent) || 0;
        const servicePercent = Number(settings.service_percent) || 0;
        const tax = Math.round((afterDiscount * taxPercent) / 100);
        const serviceCharge = Math.round((afterDiscount * servicePercent) / 100);
        const total = afterDiscount + tax + serviceCharge;

        const payments = Array.isArray(body.payments) ? body.payments : [];
        const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        if (paid < total) throw new HttpError(400, 'Nominal pembayaran kurang dari total.');
        const change = paid - total;

        const invoice_no = await repo.counterNo('INV', 4, client);
        const tx = {
          id: uid('trx'),
          invoice_no,
          cashier_id: user.id,
          cashier_name: user.name,
          customer_id: customer ? customer.id : null,
          customer_name: customer ? customer.name : body.customer_name || '',
          order_type: body.order_type || 'dine-in',
          order_id: null,
          table_name: null,
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
          voided_at: null,
          voided_by: null,
          loyalty: null,
        };

        const allRecipes = await repo.recipes.all(client);
        const ingredients = await repo.ingredients.all(client);
        const ingById = Object.fromEntries(ingredients.map((i) => [i.id, i]));
        const movements = [];
        const touched = new Set();
        for (const it of items) {
          applyStock(it.menu_item_id, it.qty, -1, invoice_no, user.id, { allRecipes, ingById, movements, touched });
        }
        for (const id of touched) await repo.ingredients.update(ingById[id], client);
        for (const mv of movements) await repo.stockMovements.insert(mv, client);

        tx.loyalty = loyalty.apply(settings, customer, { total, redeemedPoints, redeemValue, tx });
        if (customer) await repo.customers.update(customer, client);
        await repo.transactions.insert(tx, client);
        return tx;
      });
    },
  },
  {
    method: 'GET',
    path: '/api/transactions',
    auth: true,
    handler: async ({ query }) => {
      let list = await repo.transactions.all();
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
      const found = await repo.transactions.where('id = $1 OR invoice_no = $1', [params.id]);
      const tx = found[0];
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
      return repo.tx(async (client) => {
        const tx = await repo.transactions.find(params.id, client);
        if (!tx) throw new HttpError(404, 'Transaksi tidak ditemukan.');
        if (tx.status === 'void') throw new HttpError(400, 'Transaksi sudah dibatalkan.');
        tx.status = 'void';
        tx.voided_at = new Date().toISOString();
        tx.voided_by = user.name;

        const allRecipes = await repo.recipes.all(client);
        const ingredients = await repo.ingredients.all(client);
        const ingById = Object.fromEntries(ingredients.map((i) => [i.id, i]));
        const movements = [];
        const touched = new Set();
        for (const it of tx.items) {
          applyStock(it.menu_item_id, it.qty, 1, tx.invoice_no + '-VOID', user.id, { allRecipes, ingById, movements, touched });
        }
        for (const id of touched) await repo.ingredients.update(ingById[id], client);
        for (const mv of movements) await repo.stockMovements.insert(mv, client);

        await repo.transactions.update(tx, client);
        return tx;
      });
    },
  },
];
