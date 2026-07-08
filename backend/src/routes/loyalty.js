// Rute pelanggan / member & poin loyalty.
const repo = require('../repo');
const { HttpError, uid } = require('../utils');
const loyalty = require('../loyalty');

module.exports = [
  {
    method: 'GET',
    path: '/api/loyalty/config',
    auth: true,
    handler: async () => loyalty.config(await repo.getSettings()),
  },
  {
    method: 'GET',
    path: '/api/customers',
    auth: true,
    handler: async ({ query }) => {
      let list = await repo.customers.all();
      if (query.q) {
        const q = String(query.q).toLowerCase();
        list = list.filter(
          (c) =>
            (c.name || '').toLowerCase().includes(q) ||
            (c.phone || '').toLowerCase().includes(q)
        );
      }
      list.sort((a, b) => (a.name > b.name ? 1 : -1));
      const limit = parseInt(query.limit, 10);
      if (limit) list = list.slice(0, limit);
      return list;
    },
  },
  {
    method: 'GET',
    path: '/api/customers/:id',
    auth: true,
    handler: async ({ params }) => {
      const c = await repo.customers.find(params.id);
      if (!c) throw new HttpError(404, 'Pelanggan tidak ditemukan.');
      const transactions = (await repo.transactions.where('customer_id = $1', [c.id]))
        .filter((t) => t.status !== 'void')
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, 20);
      return { ...c, transactions };
    },
  },
  {
    method: 'POST',
    path: '/api/customers',
    auth: true,
    handler: async ({ body }) => {
      if (!body.name || !String(body.name).trim()) throw new HttpError(400, 'Nama pelanggan wajib diisi.');
      const phone = (body.phone || '').trim();
      if (phone) {
        const dup = await repo.customers.where('phone = $1', [phone]);
        if (dup.length) throw new HttpError(400, 'Nomor HP sudah terdaftar.');
      }
      const c = {
        id: uid('cst'),
        name: String(body.name).trim(),
        phone,
        email: (body.email || '').trim(),
        note: body.note || '',
        points: Math.max(0, parseInt(body.points, 10) || 0),
        visits: 0,
        total_spent: 0,
        last_visit: null,
        point_history: [],
        created_at: new Date().toISOString(),
      };
      await repo.customers.insert(c);
      return c;
    },
  },
  {
    method: 'PUT',
    path: '/api/customers/:id',
    auth: true,
    handler: async ({ params, body }) => {
      const c = await repo.customers.find(params.id);
      if (!c) throw new HttpError(404, 'Pelanggan tidak ditemukan.');
      if (body.name != null) c.name = String(body.name).trim();
      if (body.phone != null) {
        const phone = String(body.phone).trim();
        if (phone) {
          const dup = await repo.customers.where('phone = $1 AND id <> $2', [phone, c.id]);
          if (dup.length) throw new HttpError(400, 'Nomor HP sudah terdaftar.');
        }
        c.phone = phone;
      }
      if (body.email != null) c.email = String(body.email).trim();
      if (body.note != null) c.note = body.note;
      await repo.customers.update(c);
      return c;
    },
  },
  {
    method: 'POST',
    path: '/api/customers/:id/points',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params, body }) => {
      const c = await repo.customers.find(params.id);
      if (!c) throw new HttpError(404, 'Pelanggan tidak ditemukan.');
      const delta = parseInt(body.delta, 10) || 0;
      if (!delta) throw new HttpError(400, 'Jumlah penyesuaian poin tidak boleh 0.');
      c.points = Math.max(0, (c.points || 0) + delta);
      c.point_history = c.point_history || [];
      c.point_history.unshift({
        id: uid('pth'),
        tx_id: null,
        invoice_no: null,
        earned: delta > 0 ? delta : 0,
        redeemed: delta < 0 ? -delta : 0,
        balance: c.points,
        note: body.note || 'Penyesuaian manual',
        created_at: new Date().toISOString(),
      });
      await repo.customers.update(c);
      return c;
    },
  },
  {
    method: 'DELETE',
    path: '/api/customers/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params }) => {
      const c = await repo.customers.find(params.id);
      if (!c) throw new HttpError(404, 'Pelanggan tidak ditemukan.');
      await repo.customers.remove(params.id);
      return { ok: true };
    },
  },
];
