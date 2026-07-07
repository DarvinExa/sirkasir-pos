import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { TrendingUp, DollarSign, Percent, Boxes, Receipt } from 'lucide-react';
import { api, apiError } from '../api/client';
import { rupiah } from '../lib/format';
import StatCard from '../components/StatCard';

function todayKey() {
  const now = new Date();
  const off = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - off).toISOString().slice(0, 10);
}
function daysAgoKey(n) {
  const dt = new Date();
  dt.setDate(dt.getDate() - n);
  const off = dt.getTimezoneOffset() * 60000;
  return new Date(dt.getTime() - off).toISOString().slice(0, 10);
}

export default function Reports() {
  const [tab, setTab] = useState('profit');
  const [from, setFrom] = useState(daysAgoKey(30));
  const [to, setTo] = useState(todayKey());
  const [profit, setProfit] = useState(null);
  const [bom, setBom] = useState([]);
  const [inventory, setInventory] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfit = useCallback(async () => {
    try {
      const { data } = await api.get('/reports/profit', { params: { from, to } });
      setProfit(data);
    } catch (err) {
      toast.error(apiError(err, 'Gagal memuat laporan profit'));
    }
  }, [from, to]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [b, inv] = await Promise.all([api.get('/reports/bom'), api.get('/reports/inventory')]);
        setBom(b.data);
        setInventory(inv.data);
      } catch (err) {
        toast.error(apiError(err, 'Gagal memuat laporan'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    loadProfit();
  }, [loadProfit]);

  const tabs = [
    { key: 'profit', label: 'Laba per Produk', icon: TrendingUp },
    { key: 'bom', label: 'HPP / BOM', icon: Receipt },
    { key: 'inventory', label: 'Nilai Stok', icon: Boxes },
  ];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Laporan</h1>
        <p className="text-sm text-slate-400">Analisa laba, HPP resep, dan nilai persediaan</p>
      </div>

      <div className="mb-5 flex rounded-xl bg-white p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
              tab === t.key ? 'bg-brand text-white' : 'text-slate-500'
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'profit' && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-500">Dari</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand" />
            <label className="text-sm text-slate-500">sampai</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand" />
          </div>

          {profit && (
            <>
              <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard icon={DollarSign} label="Omzet" value={rupiah(profit.revenue)} sub={`${profit.tx_count} transaksi`} />
                <StatCard icon={Boxes} label="HPP (COGS)" value={rupiah(profit.cogs)} accent="amber" />
                <StatCard icon={TrendingUp} label="Laba kotor" value={rupiah(profit.profit)} accent="green" />
                <StatCard icon={Percent} label="Margin" value={profit.margin + '%'} accent="blue" />
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Produk</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Omzet</th>
                      <th className="px-4 py-3 text-right">HPP</th>
                      <th className="px-4 py-3 text-right">Laba</th>
                      <th className="px-4 py-3 text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profit.products.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                          Belum ada penjualan pada rentang ini.
                        </td>
                      </tr>
                    ) : (
                      profit.products.map((p, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-medium">{p.name}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{p.qty}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{rupiah(p.revenue)}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-500">{rupiah(p.cogs)}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium text-emerald-600">{rupiah(p.profit)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{p.margin}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'bom' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3">Menu</th>
                <th className="px-4 py-3">Resep (bahan)</th>
                <th className="px-4 py-3 text-right">Harga</th>
                <th className="px-4 py-3 text-right">HPP</th>
                <th className="px-4 py-3 text-right">Margin</th>
                <th className="px-4 py-3 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {bom.map((m) => (
                <tr key={m.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {m.recipes.length === 0
                      ? '-'
                      : m.recipes.map((r) => `${r.name} ${r.qty}${r.unit}`).join(', ')}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{rupiah(m.price)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">{rupiah(m.cost)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-emerald-600">{rupiah(m.margin)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{m.margin_percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'inventory' && inventory && (
        <div>
          <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard icon={Boxes} label="Total nilai stok" value={rupiah(inventory.total_value)} accent="green" />
            <StatCard icon={Boxes} label="Jumlah bahan" value={inventory.items.length} />
            <StatCard icon={Boxes} label="Stok menipis" value={inventory.low_count} accent="amber" />
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3">Bahan</th>
                  <th className="px-4 py-3 text-right">Stok</th>
                  <th className="px-4 py-3 text-right">Min</th>
                  <th className="px-4 py-3 text-right">HPP rata2</th>
                  <th className="px-4 py-3 text-right">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {inventory.items.map((i) => (
                  <tr key={i.id} className={`border-t border-slate-100 ${i.low ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3 font-medium">
                      {i.name} <span className="text-xs text-slate-400">({i.unit})</span>
                      {i.low && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-600">menipis</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{i.stock}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-400">{i.min_stock}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">{rupiah(i.cost_avg)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{rupiah(i.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && <p className="mt-4 text-slate-400">Memuat...</p>}
    </div>
  );
}
