// Back office: shift & kas, supplier, purchase order (PO), stok opname, laporan profit/BOM.
const db = require('../db');
const { HttpError, uid } = require('../utils');

function round2(n) {
  return Math.round(n * 100) / 100;
}
function pad(n) {
  return String(n).padStart(2, '0');
}
function seqNo(d, prefix) {
  const now = new Date();
  const key = prefix + '-' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate());
  d.counters = d.counters || {};
  d.counters[key] = (d.counters[key] || 0) + 1;
  return key + '-' + String(d.counters[key]).padStart(4, '0');
}
function dayKey(iso) {
  return iso.slice(0, 10);
}

// Shift helpers
// Ringkasan kas sebuah shift dalam rentang waktu bukanya.
function shiftSummary(d, shift, endTime) {
  const start = shift.opened_at;
  const end = endTime || new Date().toISOString();
  const txns = d.transactions.filter(
    (t) => t.status === 'paid' && t.created_at >= start && t.created_at <= end
  );
  let cashSales = 0;
  let nonCashSales = 0;
  for (const t of txns) {
    const cashPaid = t.payments.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0);
    const nonCash = t.payments.filter((p) => p.method !== 'cash').reduce((s, p) => s + p.amount, 0);
    // Kas yang benar-benar masuk laci = tunai diterima dikurangi kembalian.
    cashSales += Math.max(0, cashPaid - (t.change || 0));
    nonCashSales += nonCash;
  }
  const cashIn = (shift.cash_movements || [])
    .filter((m) => m.type === 'in')
    .reduce((s, m) => s + m.amount, 0);
  const cashOut = (shift.cash_movements || [])
    .filter((m) => m.type === 'out')
    .reduce((s, m) => s + m.amount, 0);
  const expectedCash = round2(shift.opening_cash + cashSales + cashIn - cashOut);
  return {
    tx_count: txns.length,
    total_sales: round2(cashSales + nonCashSales),
    cash_sales: round2(cashSales),
    non_cash_sales: round2(nonCashSales),
    cash_in: round2(cashIn),
    cash_out: round2(cashOut),
    expected_cash: expectedCash,
  };
}

module.exports = [
  // Shift & kas
  {
    method: 'GET',
    path: '/api/shifts/current',
    auth: true,
    handler: async () => {
      const d = db.get();
      const open = d.shifts.find((s) => s.status === 'open');
      if (!open) return { shift: null };
      return { shift: open, summary: shiftSummary(d, open) };
    },
  },
  {
    method: 'GET',
    path: '/api/shifts',
    auth: true,
    handler: async () => {
      const d = db.get();
      return d.shifts
        .slice()
        .sort((a, b) => (a.opened_at < b.opened_at ? 1 : -1))
        .map((s) => ({
          ...s,
          summary: s.status === 'open' ? shiftSummary(d, s) : s.closing,
        }));
    },
  },
  {
    method: 'GET',
    path: '/api/shifts/:id',
    auth: true,
    handler: async ({ params }) => {
      const d = db.get();
      const s = d.shifts.find((x) => x.id === params.id);
      if (!s) throw new HttpError(404, 'Shift tidak ditemukan.');
      return { ...s, summary: s.status === 'open' ? shiftSummary(d, s) : s.closing };
    },
  },
  {
    method: 'POST',
    path: '/api/shifts/open',
    auth: true,
    handler: async ({ body, user }) => {
      const d = db.get();
      if (d.shifts.some((s) => s.status === 'open')) {
        throw new HttpError(400, 'Masih ada shift yang terbuka. Tutup dulu sebelum buka baru.');
      }
      const shift = {
        id: uid('shf'),
        cashier_id: user.id,
        cashier_name: user.name,
        opening_cash: Math.max(0, Number(body.opening_cash) || 0),
        note: body.note || '',
        cash_movements: [],
        status: 'open',
        opened_at: new Date().toISOString(),
        closed_at: null,
        closing: null,
      };
      d.shifts.push(shift);
      db.save();
      return shift;
    },
  },
  {
    method: 'POST',
    path: '/api/shifts/:id/cash',
    auth: true,
    handler: async ({ params, body, user }) => {
      const d = db.get();
      const s = d.shifts.find((x) => x.id === params.id);
      if (!s) throw new HttpError(404, 'Shift tidak ditemukan.');
      if (s.status !== 'open') throw new HttpError(400, 'Shift sudah ditutup.');
      const type = body.type === 'out' ? 'out' : 'in';
      const amount = Math.max(0, Number(body.amount) || 0);
      if (amount <= 0) throw new HttpError(400, 'Nominal harus lebih dari 0.');
      s.cash_movements.push({
        id: uid('csh'),
        type,
        amount: round2(amount),
        note: body.note || '',
        user_id: user.id,
        user_name: user.name,
        created_at: new Date().toISOString(),
      });
      db.save();
      return { ...s, summary: shiftSummary(d, s) };
    },
  },
  {
    method: 'POST',
    path: '/api/shifts/:id/close',
    auth: true,
    handler: async ({ params, body, user }) => {
      const d = db.get();
      const s = d.shifts.find((x) => x.id === params.id);
      if (!s) throw new HttpError(404, 'Shift tidak ditemukan.');
      if (s.status !== 'open') throw new HttpError(400, 'Shift sudah ditutup.');
      const closedAt = new Date().toISOString();
      const summary = shiftSummary(d, s, closedAt);
      const countedCash = Math.max(0, Number(body.counted_cash) || 0);
      s.status = 'closed';
      s.closed_at = closedAt;
      s.closed_by = user.name;
      s.closing = {
        ...summary,
        opening_cash: s.opening_cash,
        counted_cash: round2(countedCash),
        variance: round2(countedCash - summary.expected_cash),
        note: body.note || '',
      };
      db.save();
      return s;
    },
  },

  // Supplier
  {
    method: 'GET',
    path: '/api/suppliers',
    auth: true,
    handler: async () => db.get().suppliers.slice(),
  },
  {
    method: 'POST',
    path: '/api/suppliers',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ body }) => {
      const d = db.get();
      if (!body.name) throw new HttpError(400, 'Nama supplier wajib diisi.');
      const sup = {
        id: uid('sup'),
        name: body.name,
        phone: body.phone || '',
        contact: body.contact || '',
        note: body.note || '',
      };
      d.suppliers.push(sup);
      db.save();
      return sup;
    },
  },
  {
    method: 'PUT',
    path: '/api/suppliers/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params, body }) => {
      const d = db.get();
      const sup = d.suppliers.find((x) => x.id === params.id);
      if (!sup) throw new HttpError(404, 'Supplier tidak ditemukan.');
      for (const k of ['name', 'phone', 'contact', 'note']) {
        if (body[k] != null) sup[k] = body[k];
      }
      db.save();
      return sup;
    },
  },
  {
    method: 'DELETE',
    path: '/api/suppliers/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params }) => {
      const d = db.get();
      const idx = d.suppliers.findIndex((x) => x.id === params.id);
      if (idx === -1) throw new HttpError(404, 'Supplier tidak ditemukan.');
      d.suppliers.splice(idx, 1);
      db.save();
      return { ok: true };
    },
  },

  // Purchase order (PO)
  {
    method: 'GET',
    path: '/api/purchase-orders',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async () =>
      db.get().purchase_orders.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
  },
  {
    method: 'GET',
    path: '/api/purchase-orders/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params }) => {
      const po = db.get().purchase_orders.find((x) => x.id === params.id);
      if (!po) throw new HttpError(404, 'PO tidak ditemukan.');
      return po;
    },
  },
  {
    method: 'POST',
    path: '/api/purchase-orders',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ body, user }) => {
      const d = db.get();
      const supplier = d.suppliers.find((s) => s.id === body.supplier_id);
      if (!supplier) throw new HttpError(400, 'Supplier tidak valid.');
      const rawItems = Array.isArray(body.items) ? body.items : [];
      if (rawItems.length === 0) throw new HttpError(400, 'Item PO tidak boleh kosong.');
      const items = [];
      let total = 0;
      for (const ri of rawItems) {
        const ing = d.ingredients.find((i) => i.id === ri.ingredient_id);
        if (!ing) throw new HttpError(400, `Bahan tidak ditemukan: ${ri.ingredient_id}`);
        const qty = Number(ri.qty) || 0;
        const unitCost = Number(ri.unit_cost) || 0;
        if (qty <= 0) throw new HttpError(400, `Qty tidak valid untuk ${ing.name}.`);
        const sub = round2(qty * unitCost);
        total += sub;
        items.push({ ingredient_id: ing.id, name: ing.name, unit: ing.unit, qty, unit_cost: unitCost, subtotal: sub });
      }
      const po = {
        id: uid('po'),
        po_no: seqNo(d, 'PO'),
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        items,
        total: round2(total),
        note: body.note || '',
        status: 'draft',
        created_by: user.name,
        created_at: new Date().toISOString(),
        received_at: null,
      };
      d.purchase_orders.push(po);
      db.save();
      return po;
    },
  },
  {
    method: 'POST',
    path: '/api/purchase-orders/:id/receive',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params, user }) => {
      const d = db.get();
      const po = d.purchase_orders.find((x) => x.id === params.id);
      if (!po) throw new HttpError(404, 'PO tidak ditemukan.');
      if (po.status === 'received') throw new HttpError(400, 'PO sudah diterima.');
      for (const it of po.items) {
        const ing = d.ingredients.find((i) => i.id === it.ingredient_id);
        if (!ing) continue;
        const oldStock = ing.stock || 0;
        const newStock = round2(oldStock + it.qty);
        // Harga pokok rata-rata tertimbang (weighted average).
        if (newStock > 0) {
          ing.cost_avg = round2((oldStock * ing.cost_avg + it.qty * it.unit_cost) / newStock);
        }
        ing.stock = newStock;
        d.stock_movements.push({
          id: uid('mov'),
          ingredient_id: ing.id,
          type: 'purchase',
          qty: round2(it.qty),
          ref: po.po_no,
          user_id: user.id,
          created_at: new Date().toISOString(),
        });
      }
      po.status = 'received';
      po.received_at = new Date().toISOString();
      po.received_by = user.name;
      db.save();
      return po;
    },
  },
  {
    method: 'DELETE',
    path: '/api/purchase-orders/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params }) => {
      const d = db.get();
      const po = d.purchase_orders.find((x) => x.id === params.id);
      if (!po) throw new HttpError(404, 'PO tidak ditemukan.');
      if (po.status === 'received') throw new HttpError(400, 'PO yang sudah diterima tidak bisa dihapus.');
      d.purchase_orders = d.purchase_orders.filter((x) => x.id !== params.id);
      db.save();
      return { ok: true };
    },
  },

  // Stok opname
  {
    method: 'GET',
    path: '/api/opnames',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async () =>
      db.get().opnames.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
  },
  {
    method: 'GET',
    path: '/api/opnames/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params }) => {
      const op = db.get().opnames.find((x) => x.id === params.id);
      if (!op) throw new HttpError(404, 'Opname tidak ditemukan.');
      return op;
    },
  },
  {
    method: 'POST',
    path: '/api/opnames',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ body, user }) => {
      const d = db.get();
      const rawItems = Array.isArray(body.items) ? body.items : [];
      if (rawItems.length === 0) throw new HttpError(400, 'Tidak ada bahan yang dihitung.');
      const items = [];
      let totalVarValue = 0;
      for (const ri of rawItems) {
        const ing = d.ingredients.find((i) => i.id === ri.ingredient_id);
        if (!ing) continue;
        const systemQty = ing.stock || 0;
        const counted = Number(ri.counted);
        if (Number.isNaN(counted)) continue;
        const variance = round2(counted - systemQty);
        const varValue = round2(variance * ing.cost_avg);
        totalVarValue += varValue;
        items.push({
          ingredient_id: ing.id,
          name: ing.name,
          unit: ing.unit,
          system_qty: round2(systemQty),
          counted: round2(counted),
          variance,
          cost_avg: ing.cost_avg,
          variance_value: varValue,
        });
        // Sesuaikan stok ke hasil hitung fisik.
        ing.stock = round2(counted);
        if (variance !== 0) {
          d.stock_movements.push({
            id: uid('mov'),
            ingredient_id: ing.id,
            type: 'opname',
            qty: variance,
            ref: 'opname',
            user_id: user.id,
            created_at: new Date().toISOString(),
          });
        }
      }
      const op = {
        id: uid('opn'),
        opname_no: seqNo(d, 'OPN'),
        items,
        total_variance_value: round2(totalVarValue),
        note: body.note || '',
        created_by: user.name,
        created_at: new Date().toISOString(),
      };
      d.opnames.push(op);
      db.save();
      return op;
    },
  },

  // Laporan
  {
    method: 'GET',
    path: '/api/reports/profit',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ query }) => {
      const d = db.get();
      let txns = d.transactions.filter((t) => t.status === 'paid');
      if (query.from) txns = txns.filter((t) => dayKey(t.created_at) >= query.from);
      if (query.to) txns = txns.filter((t) => dayKey(t.created_at) <= query.to);
      const map = {};
      let revenue = 0;
      let cogs = 0;
      for (const t of txns) {
        for (const it of t.items) {
          const key = it.menu_item_id;
          if (!map[key]) map[key] = { name: it.name, qty: 0, revenue: 0, cogs: 0, profit: 0 };
          const lineCogs = (it.cost || 0) * it.qty;
          map[key].qty += it.qty;
          map[key].revenue += it.subtotal;
          map[key].cogs += lineCogs;
          map[key].profit += it.subtotal - lineCogs;
          revenue += it.subtotal;
          cogs += lineCogs;
        }
      }
      const products = Object.values(map)
        .map((p) => ({ ...p, margin: p.revenue ? Math.round((p.profit / p.revenue) * 100) : 0 }))
        .sort((a, b) => b.profit - a.profit);
      return {
        from: query.from || null,
        to: query.to || null,
        tx_count: txns.length,
        revenue,
        cogs,
        profit: revenue - cogs,
        margin: revenue ? Math.round(((revenue - cogs) / revenue) * 100) : 0,
        products,
      };
    },
  },
  {
    method: 'GET',
    path: '/api/reports/bom',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async () => {
      const d = db.get();
      return d.menu_items.map((m) => {
        const recipes = d.recipes
          .filter((r) => r.menu_item_id === m.id)
          .map((r) => {
            const ing = d.ingredients.find((i) => i.id === r.ingredient_id);
            return {
              ingredient_id: r.ingredient_id,
              name: ing ? ing.name : '?',
              unit: ing ? ing.unit : '',
              qty: r.qty,
              cost_avg: ing ? ing.cost_avg : 0,
              cost: ing ? round2(ing.cost_avg * r.qty) : 0,
            };
          });
        const cost = m.cost || 0;
        const margin = m.price - cost;
        return {
          id: m.id,
          name: m.name,
          price: m.price,
          cost,
          margin,
          margin_percent: m.price ? Math.round((margin / m.price) * 100) : 0,
          recipes,
        };
      });
    },
  },
  {
    method: 'GET',
    path: '/api/reports/inventory',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async () => {
      const d = db.get();
      const items = d.ingredients.map((i) => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        stock: i.stock,
        min_stock: i.min_stock,
        cost_avg: i.cost_avg,
        value: round2((i.stock || 0) * i.cost_avg),
        low: (i.stock || 0) <= (i.min_stock || 0),
      }));
      return {
        total_value: round2(items.reduce((s, x) => s + x.value, 0)),
        low_count: items.filter((x) => x.low).length,
        items,
      };
    },
  },
];
