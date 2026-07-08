const repo = require('../repo');

function dayKey(iso) {
  return iso.slice(0, 10);
}

function todayKey() {
  const now = new Date();
  const off = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - off).toISOString().slice(0, 10);
}

function isoKey(dt) {
  const off = dt.getTimezoneOffset() * 60000;
  return new Date(dt.getTime() - off).toISOString().slice(0, 10);
}

module.exports = [
  {
    method: 'GET',
    path: '/api/reports/summary',
    auth: true,
    handler: async ({ query }) => {
      const date = query.date || todayKey();
      const transactions = await repo.transactions.all();
      const ingredients = await repo.ingredients.all();
      const paid = transactions.filter((t) => t.status === 'paid');
      const today = paid.filter((t) => dayKey(t.created_at) === date);

      const revenue = today.reduce((s, t) => s + t.total, 0);
      const profit = today.reduce((s, t) => s + (t.profit || 0), 0);
      const count = today.length;
      const avg = count ? Math.round(revenue / count) : 0;

      const productMap = {};
      for (const t of today) {
        for (const it of t.items) {
          if (!productMap[it.menu_item_id]) {
            productMap[it.menu_item_id] = { name: it.name, qty: 0, revenue: 0 };
          }
          productMap[it.menu_item_id].qty += it.qty;
          productMap[it.menu_item_id].revenue += it.subtotal;
        }
      }
      const topProducts = Object.values(productMap).sort((a, b) => b.qty - a.qty).slice(0, 5);

      const payMap = {};
      for (const t of today) {
        for (const p of t.payments) {
          payMap[p.method] = (payMap[p.method] || 0) + p.amount;
        }
      }
      const payments = Object.entries(payMap).map(([method, amount]) => ({ method, amount }));

      const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0, count: 0 }));
      for (const t of today) {
        const h = new Date(t.created_at).getHours();
        hourly[h].revenue += t.total;
        hourly[h].count += 1;
      }

      const lowStock = ingredients
        .filter((i) => (i.stock || 0) <= (i.min_stock || 0))
        .map((i) => ({ id: i.id, name: i.name, stock: i.stock, min_stock: i.min_stock, unit: i.unit }));

      return { date, revenue, profit, count, avg, topProducts, payments, hourly, lowStock };
    },
  },
  {
    method: 'GET',
    path: '/api/reports/sales',
    auth: true,
    handler: async ({ query }) => {
      const days = Math.min(90, Math.max(1, parseInt(query.days, 10) || 7));
      const transactions = await repo.transactions.all();
      const paid = transactions.filter((t) => t.status === 'paid');
      const series = [];
      for (let i = days - 1; i >= 0; i--) {
        const dt = new Date();
        dt.setDate(dt.getDate() - i);
        const off = dt.getTimezoneOffset() * 60000;
        const key = new Date(dt.getTime() - off).toISOString().slice(0, 10);
        const rows = paid.filter((t) => dayKey(t.created_at) === key);
        series.push({
          date: key,
          label: key.slice(5),
          revenue: rows.reduce((s, t) => s + t.total, 0),
          profit: rows.reduce((s, t) => s + (t.profit || 0), 0),
          count: rows.length,
        });
      }
      return series;
    },
  },
  {
    method: 'GET',
    path: '/api/reports/analytics',
    auth: true,
    handler: async ({ query }) => {
      const transactions = await repo.transactions.all();
      const menu_items = await repo.menuItems.all();
      const categories = await repo.categories.all();
      const paid = transactions.filter((t) => t.status === 'paid');
      const to = query.to || todayKey();
      const from = query.from || to;
      const dayMs = 86400000;
      const fromD = new Date(from + 'T00:00:00');
      const toD = new Date(to + 'T00:00:00');
      const spanDays = Math.max(1, Math.round((toD - fromD) / dayMs) + 1);
      const inRange = (t, a, b) => {
        const k = dayKey(t.created_at);
        return k >= a && k <= b;
      };
      const cur = paid.filter((t) => inRange(t, from, to));
      const prevToD = new Date(fromD.getTime() - dayMs);
      const prevFromD = new Date(prevToD.getTime() - (spanDays - 1) * dayMs);
      const prevFrom = isoKey(prevFromD);
      const prevTo = isoKey(prevToD);
      const prev = paid.filter((t) => inRange(t, prevFrom, prevTo));
      const sum = (arr, f) => arr.reduce((s, t) => s + f(t), 0);

      const revenue = sum(cur, (t) => t.total);
      const profit = sum(cur, (t) => t.profit || 0);
      const count = cur.length;
      const avg = count ? Math.round(revenue / count) : 0;

      const trend = [];
      for (let i = 0; i < spanDays; i++) {
        const key = isoKey(new Date(fromD.getTime() + i * dayMs));
        const rows = cur.filter((t) => dayKey(t.created_at) === key);
        trend.push({
          date: key,
          label: key.slice(5),
          revenue: sum(rows, (t) => t.total),
          profit: sum(rows, (t) => t.profit || 0),
          count: rows.length,
        });
      }

      const pm = {};
      for (const t of cur) {
        for (const it of t.items) {
          if (!pm[it.menu_item_id]) pm[it.menu_item_id] = { name: it.name, qty: 0, revenue: 0 };
          pm[it.menu_item_id].qty += it.qty;
          pm[it.menu_item_id].revenue += it.subtotal;
        }
      }
      const topProducts = Object.values(pm).sort((a, b) => b.qty - a.qty).slice(0, 8);

      const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0, count: 0 }));
      for (const t of cur) {
        const h = new Date(t.created_at).getHours();
        hourly[h].revenue += t.total;
        hourly[h].count += 1;
      }

      const cm = {};
      for (const t of cur) {
        for (const it of t.items) {
          const mi = menu_items.find((m) => m.id === it.menu_item_id);
          const cat = mi ? (categories.find((c) => c.id === mi.category_id) || {}).name : null;
          const name = cat || 'Lainnya';
          if (!cm[name]) cm[name] = { category: name, revenue: 0, qty: 0 };
          cm[name].revenue += it.subtotal;
          cm[name].qty += it.qty;
        }
      }
      const byCategory = Object.values(cm).sort((a, b) => b.revenue - a.revenue);

      const paym = {};
      for (const t of cur) for (const p of t.payments) paym[p.method] = (paym[p.method] || 0) + p.amount;
      const byPayment = Object.entries(paym).map(([method, amount]) => ({ method, amount }));

      const dowNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      const dow = Array.from({ length: 7 }, (_, i) => ({ dow: i, label: dowNames[i], revenue: 0, count: 0 }));
      for (const t of cur) {
        const w = new Date(t.created_at).getDay();
        dow[w].revenue += t.total;
        dow[w].count += 1;
      }

      return {
        range: { from, to, days: spanDays },
        previous: { from: prevFrom, to: prevTo },
        summary: {
          revenue,
          profit,
          count,
          avg,
          prev: {
            revenue: sum(prev, (t) => t.total),
            profit: sum(prev, (t) => t.profit || 0),
            count: prev.length,
            avg: prev.length ? Math.round(sum(prev, (t) => t.total) / prev.length) : 0,
          },
        },
        trend,
        topProducts,
        hourly,
        byCategory,
        byPayment,
        dow,
      };
    },
  },
];
