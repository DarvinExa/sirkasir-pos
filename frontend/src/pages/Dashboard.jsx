import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Wallet, TrendingUp, ReceiptText, Calculator, AlertTriangle } from 'lucide-react';
import { api, apiError } from '../api/client';
import { rupiah } from '../lib/format';
import StatCard from '../components/StatCard';

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, sales] = await Promise.all([
          api.get('/reports/summary'),
          api.get('/reports/sales', { params: { days: 7 } }),
        ]);
        setSummary(s.data);
        setSeries(sales.data);
      } catch (err) {
        toast.error(apiError(err, 'Gagal memuat dashboard'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-6 text-slate-400">Memuat dashboard...</div>;

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mb-6 text-sm text-slate-400">Ringkasan hari ini · {summary?.date}</p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Pendapatan" value={rupiah(summary?.revenue)} accent="brand" />
        <StatCard icon={TrendingUp} label="Profit" value={rupiah(summary?.profit)} accent="green" />
        <StatCard icon={ReceiptText} label="Transaksi" value={summary?.count || 0} accent="blue" />
        <StatCard icon={Calculator} label="Rata-rata" value={rupiah(summary?.avg)} accent="amber" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold">Penjualan 7 Hari Terakhir</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v) => (v >= 1000 ? v / 1000 + 'k' : v)} />
              <Tooltip formatter={(v) => rupiah(v)} />
              <Bar dataKey="revenue" name="Pendapatan" fill="#F97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-semibold">Menu Terlaris Hari Ini</h2>
          {summary?.topProducts?.length ? (
            <div className="space-y-3">
              {summary.topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
                      {i + 1}
                    </span>
                    <span className="text-sm">{p.name}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{p.qty}x</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Belum ada penjualan hari ini.</p>
          )}
        </div>
      </div>

      {summary?.lowStock?.length > 0 && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-amber-700">
            <AlertTriangle size={18} /> Stok Bahan Menipis
          </h2>
          <div className="flex flex-wrap gap-2">
            {summary.lowStock.map((i) => (
              <span key={i.id} className="rounded-full bg-white px-3 py-1 text-sm text-amber-700">
                {i.name}: {i.stock} {i.unit}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
