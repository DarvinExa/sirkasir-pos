// Mode restoran: meja, order bertahap, KDS, modifier, split bill.
const repo = require('../repo');
const { HttpError, uid } = require('../utils');
const loyalty = require('../loyalty');
const promo = require('../promo');
const { applyStock } = require('../stock');

function stationFor(menu, categories) {
  if (menu.station) return menu.station;
  const cat = categories.find((c) => c.id === menu.category_id);
  if (cat && cat.name && cat.name.toLowerCase().includes('minuman')) return 'bar';
  return 'kitchen';
}

function buildOrderItem(ri, menus, categories) {
  const menu = menus.find((m) => m.id === ri.menu_item_id);
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
    station: stationFor(menu, categories),
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

function tableWithOrder(t, openOrders) {
  const order = openOrders.find(
    (o) => o.table_id === t.id && o.status === 'open' && o.items.some((i) => i.status === 'active')
  );
  return { ...t, order: order ? orderSummary(order) : null };
}

async function findOrder(id, client) {
  const o = await repo.orders.find(id, client);
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
      const tbls = await repo.tables.all();
      const openOrders = await repo.orders.where("status = 'open'", []);
      return tbls.map((t) => tableWithOrder(t, openOrders));
    },
  },
  {
    method: 'POST',
    path: '/api/tables',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ body }) => {
      const count = (await repo.tables.all()).length;
      const t = {
        id: uid('tbl'),
        name: body.name || 'Meja ' + (count + 1),
        area: body.area || 'Indoor',
        seats: Number(body.seats) || 4,
        status: 'available',
      };
      await repo.tables.insert(t);
      return t;
    },
  },
  {
    method: 'PUT',
    path: '/api/tables/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params, body }) => {
      const t = await repo.tables.find(params.id);
      if (!t) throw new HttpError(404, 'Meja tidak ditemukan.');
      if (body.name != null) t.name = body.name;
      if (body.area != null) t.area = body.area;
      if (body.seats != null) t.seats = Number(body.seats);
      await repo.tables.update(t);
      return t;
    },
  },
  {
    method: 'DELETE',
    path: '/api/tables/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params }) => {
      const t = await repo.tables.find(params.id);
      if (!t) throw new HttpError(404, 'Meja tidak ditemukan.');
      const open = await repo.orders.where('table_id = $1 AND status = $2', [params.id, 'open']);
      if (open.length) throw new HttpError(400, 'Meja masih punya order aktif.');
      await repo.tables.remove(params.id);
      return { ok: true };
    },
  },

  // Orders
  {
    method: 'GET',
    path: '/api/orders',
    auth: true,
    handler: async ({ query }) => {
      const status = query.status || 'open';
      let list = status !== 'all' ? await repo.orders.where('status = $1', [status]) : await repo.orders.all();
      list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return list;
    },
  },
  {
    method: 'GET',
    path: '/api/orders/:id',
    auth: true,
    handler: async ({ params }) => findOrder(params.id),
  },
  {
    method: 'POST',
    path: '/api/orders',
    auth: true,
    handler: async ({ body, user }) => {
      return repo.tx(async (client) => {
        const type = body.type || 'dine-in';
        let table = null;
        if (type === 'dine-in') {
          if (!body.table_id) throw new HttpError(400, 'Pilih meja terlebih dahulu.');
          table = await repo.tables.find(body.table_id, client);
          if (!table) throw new HttpError(404, 'Meja tidak ditemukan.');
          const existing = await repo.orders.where('table_id = $1 AND status = $2', [table.id, 'open'], client);
          if (existing.length) return existing[0];
        }
        const menus = await repo.menuItems.all(client);
        const categories = await repo.categories.all(client);
        const order = {
          id: uid('ord'),
          order_no: await repo.counterNo('ORD', 4, client),
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
          closed_at: null,
        };
        for (const ri of body.items || []) order.items.push(buildOrderItem(ri, menus, categories));
        await repo.orders.insert(order, client);
        if (table) {
          table.status = 'occupied';
          await repo.tables.update(table, client);
        }
        return order;
      });
    },
  },
  {
    method: 'POST',
    path: '/api/orders/:id/items',
    auth: true,
    handler: async ({ params, body }) => {
      return repo.tx(async (client) => {
        const o = await findOrder(params.id, client);
        if (o.status !== 'open') throw new HttpError(400, 'Order sudah ditutup.');
        const items = Array.isArray(body.items) ? body.items : [];
        if (items.length === 0) throw new HttpError(400, 'Tidak ada item untuk ditambahkan.');
        const menus = await repo.menuItems.all(client);
        const categories = await repo.categories.all(client);
        for (const ri of items) o.items.push(buildOrderItem(ri, menus, categories));
        o.updated_at = new Date().toISOString();
        await repo.orders.update(o, client);
        return o;
      });
    },
  },
  {
    method: 'PATCH',
    path: '/api/orders/:id/items/:itemId',
    auth: true,
    handler: async ({ params, body }) => {
      const o = await findOrder(params.id);
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
      await repo.orders.update(o);
      return o;
    },
  },
  {
    method: 'DELETE',
    path: '/api/orders/:id/items/:itemId',
    auth: true,
    handler: async ({ params }) => {
      const o = await findOrder(params.id);
      const it = o.items.find((i) => i.id === params.itemId);
      if (!it) throw new HttpError(404, 'Item tidak ditemukan.');
      if (it.paid) throw new HttpError(400, 'Item sudah dibayar, tidak bisa dihapus.');
      it.status = 'void';
      o.updated_at = new Date().toISOString();
      await repo.orders.update(o);
      return o;
    },
  },
  {
    method: 'POST',
    path: '/api/orders/:id/void',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params }) => {
      return repo.tx(async (client) => {
        const o = await findOrder(params.id, client);
        if (o.items.some((i) => i.paid)) {
          throw new HttpError(400, 'Order sudah ada pembayaran, tidak bisa dibatalkan.');
        }
        o.status = 'void';
        o.closed_at = new Date().toISOString();
        await repo.orders.update(o, client);
        if (o.table_id) {
          const table = await repo.tables.find(o.table_id, client);
          if (table) {
            table.status = 'available';
            await repo.tables.update(table, client);
          }
        }
        return o;
      });
    },
  },
  {
    method: 'POST',
    path: '/api/orders/:id/move',
    auth: true,
    handler: async ({ params, body }) => {
      return repo.tx(async (client) => {
        const o = await findOrder(params.id, client);
        if (o.status !== 'open') throw new HttpError(400, 'Order sudah ditutup.');
        const target = await repo.tables.find(body.table_id, client);
        if (!target) throw new HttpError(404, 'Meja tujuan tidak ditemukan.');
        if (target.id === o.table_id) return o;
        const others = await repo.orders.where('table_id = $1 AND status = $2 AND id <> $3', [target.id, 'open', o.id], client);
        const occupied = others.find((x) => x.items.some((i) => i.status === 'active'));
        if (occupied) throw new HttpError(400, 'Meja tujuan sedang terisi.');
        if (o.table_id) {
          const oldTable = await repo.tables.find(o.table_id, client);
          if (oldTable) {
            oldTable.status = 'available';
            await repo.tables.update(oldTable, client);
          }
        }
        o.table_id = target.id;
        o.table_name = target.name;
        o.type = 'dine-in';
        target.status = 'occupied';
        await repo.tables.update(target, client);
        o.updated_at = new Date().toISOString();
        await repo.orders.update(o, client);
        return o;
      });
    },
  },

  // KDS (Kitchen Display)
  {
    method: 'GET',
    path: '/api/kitchen',
    auth: true,
    handler: async ({ query }) => {
      const station = query.station;
      const openOrders = await repo.orders.where("status = 'open'", []);
      const tickets = [];
      for (const o of openOrders) {
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
      const o = await findOrder(params.orderId);
      const it = o.items.find((i) => i.id === params.itemId);
      if (!it) throw new HttpError(404, 'Item tidak ditemukan.');
      const flow = { pending: 'preparing', preparing: 'ready', ready: 'served' };
      it.kitchen_status = body.kitchen_status || flow[it.kitchen_status] || it.kitchen_status;
      o.updated_at = new Date().toISOString();
      await repo.orders.update(o);
      return it;
    },
  },

  // Bayar / split bill
  {
    method: 'POST',
    path: '/api/orders/:id/pay',
    auth: true,
    handler: async ({ params, body, user }) => {
      return repo.tx(async (client) => {
        const o = await findOrder(params.id, client);
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
        let customer = null;
        if (body.customer_id) customer = await repo.customers.find(body.customer_id, client);
        if (!customer && o.customer_id) customer = await repo.customers.find(o.customer_id, client);
        const settings = await repo.getSettings(client);
        const promosList = await repo.promos.all(client);
        const promoEval = promo.evaluate(promosList, {
          items: txItems.map((it) => ({ menu_item_id: it.menu_item_id, price: it.price, qty: it.qty })),
          subtotal,
          customer,
          now: new Date(),
          code: body.promo_code,
        });
        const promoDiscount = promoEval.totalDiscount;
        const { redeemedPoints, redeemValue } = loyalty.redeemInfo(settings, customer, body.redeem_points);
        const afterDiscount = Math.max(0, subtotal - discount - promoDiscount - redeemValue);
        const taxPercent = Number(settings.tax_percent) || 0;
        const servicePercent = Number(settings.service_percent) || 0;
        const tax = Math.round((afterDiscount * taxPercent) / 100);
        const serviceCharge = Math.round((afterDiscount * servicePercent) / 100);
        const total = afterDiscount + tax + serviceCharge;

        const payments = Array.isArray(body.payments) ? body.payments : [];
        const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        if (paid < total) throw new HttpError(400, 'Nominal pembayaran kurang dari total.');

        const invoice_no = await repo.counterNo('INV', 4, client);
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
          voided_at: null,
          voided_by: null,
          loyalty: null,
        };

        tx.loyalty = loyalty.apply(settings, customer, { total, redeemedPoints, redeemValue, tx });
        if (customer) await repo.customers.update(customer, client);

        const allRecipes = await repo.recipes.all(client);
        const ingredients = await repo.ingredients.all(client);
        const ingById = Object.fromEntries(ingredients.map((i) => [i.id, i]));
        const movements = [];
        const touched = new Set();
        for (const it of payItems) {
          applyStock(it.menu_item_id, it.qty, -1, invoice_no, user.id, { allRecipes, ingById, movements, touched });
        }
        for (const id of touched) await repo.ingredients.update(ingById[id], client);
        for (const mv of movements) await repo.stockMovements.insert(mv, client);

        for (const it of payItems) {
          it.paid = true;
          it.paid_tx = tx.id;
          it.kitchen_status = 'served';
        }
        await repo.transactions.insert(tx, client);

        const remaining = o.items.filter((i) => i.status === 'active' && !i.paid);
        if (remaining.length === 0) {
          o.status = 'paid';
          o.closed_at = new Date().toISOString();
          if (o.table_id) {
            const table = await repo.tables.find(o.table_id, client);
            if (table) {
              table.status = 'available';
              await repo.tables.update(table, client);
            }
          }
        }
        o.updated_at = new Date().toISOString();
        await repo.orders.update(o, client);
        return { transaction: tx, order: o, fully_paid: remaining.length === 0 };
      });
    },
  },
];
