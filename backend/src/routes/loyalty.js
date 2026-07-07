// Rute pelanggan / member & poin loyalty.
const db = require('../db');
const { HttpError, uid } = require('../utils');
const loyalty = require('../loyalty');

module.exports = [
  {
    method: 'GET',
    path: '/api/loyalty/config',
    auth: true,
    handler: async () => loyalty.config(db.get()),
  },
  {
    method: 'GET',
    path: '/api/customers',
    auth: true,
    handler: async ({ query }) => {
      let list = (db.get().customers || []).slice();
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
      const d = db.get();
      const c = (d.customers || []).find((x) => x.id === params.id);
      if (!c) throw new HttpError(404, 'Pelanggan tidak ditemukan.');
      const transactions = d.transactions
        .filter((t) => t.customer_id === c.id && t.status !== 'void')
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
      const d = db.get();
      d.customers = d.customers || [];
      if (!body.name || !String(body.name).trim()) throw new HttpError(400, 'Nama pelanggan wajib diisi.');
      const phone = (body.phone || '').trim();
      if (phone && d.customers.some((c) => c.phone === phone))
        throw new HttpError(400, 'Nomor HP sudah terdaftar.');
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
      d.customers.push(c);
      db.save();
      return c;
    },
  },
  {
    method: 'PUT',
    path: '/api/customers/:id',
    auth: true,
    handler: async ({ params, body }) => {
      const d = db.get();
      const c = (d.customers || []).find((x) => x.id === params.id);
      if (!c) throw new HttpError(404, 'Pelanggan tidak ditemukan.');
      if (body.name != null) c.name = String(body.name).trim();
      if (body.phone != null) {
        const phone = String(body.phone).trim();
        if (phone && d.customers.some((x) => x.id !== c.id && x.phone === phone))
          throw new HttpError(400, 'Nomor HP sudah terdaftar.');
        c.phone = phone;
      }
      if (body.email != null) c.email = String(body.email).trim();
      if (body.note != null) c.note = body.note;
      db.save();
      return c;
    },
  },
  {
    method: 'POST',
    path: '/api/customers/:id/points',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params, body }) => {
      const d = db.get();
      const c = (d.customers || []).find((x) => x.id === params.id);
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
      db.save();
      return c;
    },
  },
  {
    method: 'DELETE',
    path: '/api/customers/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params }) => {
      const d = db.get();
      const idx = (d.customers || []).findIndex((x) => x.id === params.id);
      if (idx === -1) throw new HttpError(404, 'Pelanggan tidak ditemukan.');
      d.customers.splice(idx, 1);
      db.save();
      return { ok: true };
    },
  },
];
