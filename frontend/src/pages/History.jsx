import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Printer, X, Ban } from 'lucide-react';
import { api, apiError } from '../api/client';
import { rupiah, formatDateTime } from '../lib/format';
import { useAuth } from '../store/auth';
import Receipt from '../components/Receipt';

export default function History() {
  const [list, setList] = useState([]);
  const [settings, setSettings] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const user = useAuth((s) => s.user);
  const canVoid = user?.role === 'owner' || user?.role === 'manager';

  async function load() {
    try {
      const [tx, st] = await Promise.all([
        api.get('/transactions', { params: { limit: 100 } }),
        api.get('/settings'),
      ]);
      setList(tx.data);
      setSettings(st.data);
    } catch (err) {
      toast.error(apiError(err, 'Gagal memuat riwayat'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function voidTx(tx) {
    if (!confirm(`Batalkan transaksi ${tx.invoice_no}? Stok bahan akan dikembalikan.`)) return;
    try {
      await api.post(`/transactions/${tx.id}/void`);
      toast.success('Transaksi dibatalkan');
      setSelected(null);
      load();
    } catch (err) {
      toast.error(apiError(err, 'Gagal membatalkan'));
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="text-2xl font-bold">Riwayat Transaksi</h1>
      <p className="mb-6 text-sm text-slate-400">Daftar transaksi terbaru</p>

      {loading ? (
        <p className="text-slate-400">Memuat...</p>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
          Belum ada transaksi.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Kasir</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((tx) => (
                <tr
                  key={tx.id}
                  onClick={() => setSelected(tx)}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium">{tx.invoice_no}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(tx.created_at)}</td>
                  <td className="px-4 py-3 text-slate-500">{tx.cashier_name}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{rupiah(tx.total)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        tx.status === 'void'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-emerald-50 text-emerald-600'
                      }`}
                    >
                      {tx.status === 'void' ? 'Dibatalkan' : 'Lunas'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-4">
            <div className="mb-2 flex items-center justify-between no-print">
              <h2 className="text-lg font-bold">Detail Struk</h2>
              <button onClick={() => setSelected(null)} className="rounded-lg p-1 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="rounded-xl border border-slate-200">
              <Receipt tx={selected} settings={settings} />
            </div>
            <div className="mt-4 flex gap-2 no-print">
              {canVoid && selected.status !== 'void' && (
                <button
                  onClick={() => voidTx(selected)}
                  className="flex items-center justify-center gap-1 rounded-xl bg-red-50 px-3 py-3 font-medium text-red-600 hover:bg-red-100"
                >
                  <Ban size={16} /> Batalkan
                </button>
              )}
              <button
                onClick={() => window.print()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-600"
              >
                <Printer size={18} /> Cetak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
