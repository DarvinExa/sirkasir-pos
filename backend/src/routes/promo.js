// CRUD promo + endpoint evaluasi untuk preview di kasir.
const db = require('../db');
const { HttpError, uid } = require('../utils');
const promo = require('../promo');

const TYPES = ['percent', 'fixed', 'bogo'];

function sanitize(body, base) {
  const p = { ...(base || {}) };
  if (body.name != null) p.name = String(body.name).trim();
  if (body.type != null) {
    if (!TYPES.includes(body.type)) throw new HttpError(400, 'Tipe promo tidak valid.');
    p.type = body.type;
  }
  if (body.value != null) p.value = Number(body.value) || 0;
  if (body.active != null) p.active = !!body.active;
  if (body.code !== undefined) p.code = String(body.code || '').trim();
  if (body.min_subtotal != null) p.min_subtotal = Math.max(0, Number(body.min_subtotal) || 0);
  if (body.max_discount != null) p.max_discount = Math.max(0, Number(body.max_discount) || 0);
  if (body.member_only != null) p.member_only = !!body.member_only;
  if (body.days != null) p.days = Array.isArray(body.days) ? body.days.map((x) => Number(x)).filter((x) => x >= 0 && x <= 6) : [];
  if (body.start_hour !== undefined) p.start_hour = body.start_hour === null || body.start_hour === '' ? null : Number(body.start_hour);
  if (body.end_hour !== undefined) p.end_hour = body.end_hour === null || body.end_hour === '' ? null : Number(body.end_hour);
  if (body.applies_to != null) p.applies_to = String(body.applies_to) || 'all';
  if (body.buy_qty != null) p.buy_qty = Math.max(1, Number(body.buy_qty) || 1);
  if (body.get_qty != null) p.get_qty = Math.max(1, Number(body.get_qty) || 1);
  if (body.stackable != null) p.stackable = !!body.stackable;
  if (body.priority != null) p.priority = Number(body.priority) || 0;
  return p;
}

function withDefaults(p) {
  return {
    type: 'percent',
    value: 0,
    active: true,
    code: '',
    min_subtotal: 0,
    max_discount: 0,
    member_only: false,
    days: [],
    start_hour: null,
    end_hour: null,
    applies_to: 'all',
    buy_qty: 1,
    get_qty: 1,
    stackable: false,
    priority: 0,
    ...p,
  };
}

module.exports = [
  {
    method: 'GET',
    path: '/api/promos',
    auth: true,
    handler: async () => {
      const list = (db.get().promos || []).slice();
      list.sort((a, b) => (Number(a.priority) || 0) - (Number(b.priority) || 0));
      return list;
    },
  },
  {
    method: 'POST',
    path: '/api/promos',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ body }) => {
      const d = db.get();
      d.promos = d.promos || [];
      if (!body.name || !String(body.name).trim()) throw new HttpError(400, 'Nama promo wajib diisi.');
      const p = withDefaults(sanitize(body, {}));
      p.id = uid('promo');
      p.created_at = new Date().toISOString();
      d.promos.push(p);
      db.save();
      return p;
    },
  },
  {
    method: 'PUT',
    path: '/api/promos/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params, body }) => {
      const d = db.get();
      const p = (d.promos || []).find((x) => x.id === params.id);
      if (!p) throw new HttpError(404, 'Promo tidak ditemukan.');
      Object.assign(p, sanitize(body, p));
      db.save();
      return p;
    },
  },
  {
    method: 'DELETE',
    path: '/api/promos/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params }) => {
      const d = db.get();
      const idx = (d.promos || []).findIndex((x) => x.id === params.id);
      if (idx === -1) throw new HttpError(404, 'Promo tidak ditemukan.');
      d.promos.splice(idx, 1);
      db.save();
      return { ok: true };
    },
  },
  {
    method: 'POST',
    path: '/api/promos/evaluate',
    auth: true,
    handler: async ({ body }) => {
      const d = db.get();
      const items = Array.isArray(body.items) ? body.items : [];
      const subtotal = Number(body.subtotal) || items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
      const customer = body.customer_id ? (d.customers || []).find((c) => c.id === body.customer_id) : null;
      return promo.evaluate(d, { items, subtotal, customer, now: new Date(), code: body.code });
    },
  },
];
