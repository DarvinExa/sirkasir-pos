import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Receipt as ReceiptIcon, Activity, DollarSign } from 'lucide-react';
import { api, apiError } from '../api/client';
import { rupiah } from '../lib/format';

function toKey(d) {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

const PIE_COLORS = ['#F97316', '#3B82F6', '#10B981', '#EAB308', '#8B5CF6', '#EC4899', '#14B8A6'];

function pct(cur, prev) {
  if (!prev) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

function Delta({ cur, prev }) {
  const p = pct(cur, prev);
  const up = p >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      <Icon size={13} /> {Math.abs(p).toFixed(1)}%
    </span>
  );
}

function Card({ icon: Icon, label, value, cur, prev, accent }) {
  const colors = {
    brand: 'bg-brand-50 text-brand-600',
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className={`rounded-xl p-2 ${colors[accent] || colors.brand}`}>
          <Icon size={18} />
        </div>
        {cur != null && prev != null && <Delta cur={cur} prev={prev} />}
      </div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {children}
    </div>
  );
}

export default function Analytics() {
  const today = toKey(new Date());
  const [range, setRange] = useState({ from: today, to: today });
  const [preset, setPreset] = useState('today');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  function applyPreset(key) {
    setPreset(key);
    const now = new Date();
    if (key === 'today') setRange({ from: toKey(now), to: toKey(now) });
    else if (key === '7d') {
      const f = new Date(now.getTime() - 6 * 86400000);
      setRange({ from: toKey(f), to: toKey(now) });
    } else if (key === '30d') {
      const f = new Date(now.getTime() - 29 * 86400000);
      setRange({ from: toKey(f), to: toKey(now) });
    } else if (key === 'month') {
      const f = new Date(now.getFullYear(), now.getMonth(), 1);
      setRange({ from: toKey(f), to: toKey(now) });
    }
  }

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/reports/analytics', { params: { from: range.from, to: range.to } });
      setData(res.data);
    } catch (err) {
      toast.error(apiError(err, 'Gagal memuat analitik'));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  const s = data?.summary;
  const multiDay = (data?.range?.days || 1) > 1;

  const catData = useMemo(
    () => (data?.byCategory || []).map((c) => ({ name: c.category, value: c.revenue })),
    [data]
  );
  const payLabel = { cash: 'Tunai', qris: 'QRIS', card: 'Kartu', debit: 'Debit' };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analitik &amp; Dashboard</h1>
          <p className="text-sm text-slate-400">Analisis penjualan mendalam dengan perbandingan periode.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            ['today', 'Hari ini'],
            ['7d', '7 hari'],
            ['30d', '30 hari'],
            ['month', 'Bulan ini'],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => applyPreset(k)}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${
                preset === k ? 'bg-brand text-white' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
          <input
            type="date"
            value={range.from}
            onChange={(e) => {
              setPreset('custom');
              setRange((r) => ({ ...r, from: e.target.value }));
            }}
            className="rounded-xl border border-slate-200 px-2 py-2 text-sm"
          />
          <span className="text-slate-400">-</span>
          <input
            type="date"
            value={range.to}
            onChange={(e) => {
              setPreset('custom');
              setRange((r) => ({ ...r, to: e.target.value }));
            }}
            className="rounded-xl border border-slate-200 px-2 py-2 text-sm"
          />
        </div>
      </div>

      {loading || !data ? (
        <div className="text-slate-400">Memuat analitik...</div>
      ) : (
        <div className="space-y-5">
          <p className="text-xs text-slate-400">
            Periode {data.range.from} s/d {data.range.to} · dibandingkan dengan {data.previous.from} s/d {data.previous.to}
          </p>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card icon={Wallet} label="Pendapatan" value={rupiah(s.revenue)} cur={s.revenue} prev={s.prev.revenue} accent="brand" />
            <Card icon={DollarSign} label="Profit" value={rupiah(s.profit)} cur={s.profit} prev={s.prev.profit} accent="green" />
            <Card icon={ReceiptIcon} label="Transaksi" value={s.count} cur={s.count} prev={s.prev.count} accent="blue" />
            <Card icon={Activity} label="Rata-rata/transaksi" value={rupiah(s.avg)} cur={s.avg} prev={s.prev.avg} accent="amber" />
          </div>

          <Panel title={multiDay ? 'Tren Pendapatan & Profit' : 'Pendapatan per Jam'}>
            <ResponsiveContainer width="100%" height={280}>
              {multiDay ? (
                <LineChart data={data.trend} margin={ { left: 10, right: 10 } }>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={ { fontSize: 12 } } />
                  <YAxis tick={ { fontSize: 12 } } tickFormatter={(v) => (v >= 1000 ? v / 1000 + 'k' : v)} />
                  <Tooltip formatter={(v) => rupiah(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" name="Pendapatan" stroke="#F97316" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="profit" name="Profit" stroke="#10B981" strokeWidth={2} dot={false} />
                </LineChart>
              ) : (
                <BarChart data={data.hourly.filter((h) => h.count > 0)} margin={ { left: 10, right: 10 } }>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="hour" tick={ { fontSize: 12 } } tickFormatter={(h) => h + ':00'} />
                  <YAxis tick={ { fontSize: 12 } } tickFormatter={(v) => (v >= 1000 ? v / 1000 + 'k' : v)} />
                  <Tooltip formatter={(v) => rupiah(v)} labelFormatter={(h) => 'Jam ' + h + ':00'} />
                  <Bar dataKey="revenue" name="Pendapatan" fill="#F97316" radius={[6, 6, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Produk Terlaris">
              {data.topProducts.length === 0 ? (
                <p className="text-sm text-slate-400">Belum ada penjualan pada periode ini.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.topProducts} layout="vertical" margin={ { left: 20, right: 20 } }>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={ { fontSize: 12 } } />
                    <YAxis type="category" dataKey="name" width={110} tick={ { fontSize: 11 } } />
                    <Tooltip formatter={(v) => v + ' terjual'} />
                    <Bar dataKey="qty" name="Terjual" fill="#3B82F6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Panel>

            <Panel title="Pendapatan per Kategori">
              {catData.length === 0 ? (
                <p className="text-sm text-slate-400">Belum ada data kategori.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(e) => e.name}>
                      {catData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => rupiah(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Penjualan per Hari (Senin-Minggu)">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.dow} margin={ { left: 10, right: 10 } }>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={ { fontSize: 12 } } />
                  <YAxis tick={ { fontSize: 12 } } tickFormatter={(v) => (v >= 1000 ? v / 1000 + 'k' : v)} />
                  <Tooltip formatter={(v) => rupiah(v)} />
                  <Bar dataKey="revenue" name="Pendapatan" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Metode Pembayaran">
              {data.byPayment.length === 0 ? (
                <p className="text-sm text-slate-400">Belum ada pembayaran.</p>
              ) : (
                <div className="space-y-3 pt-2">
                  {data.byPayment.map((p, i) => {
                    const totalPay = data.byPayment.reduce((a, b) => a + b.amount, 0) || 1;
                    const share = (p.amount / totalPay) * 100;
                    return (
                      <div key={p.method}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="font-medium">{payLabel[p.method] || p.method}</span>
                          <span className="tabular-nums text-slate-500">{rupiah(p.amount)} · {share.toFixed(0)}%</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full" style={ { width: share + '%', background: PIE_COLORS[i % PIE_COLORS.length] } } />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
