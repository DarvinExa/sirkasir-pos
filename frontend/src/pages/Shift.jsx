import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Wallet, ArrowDownCircle, ArrowUpCircle, Lock, Unlock, History } from 'lucide-react';
import { api, apiError } from '../api/client';
import { rupiah, formatDateTime } from '../lib/format';
import StatCard from '../components/StatCard';

function Line({ label, value, strong }) {
  return (
    <div className={`flex justify-between py-1 ${strong ? 'font-bold' : ''}`}>
      <span className={strong ? '' : 'text-slate-500'}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export default function Shift() {
  const [current, setCurrent] = useState(null);
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openingCash, setOpeningCash] = useState(0);
  const [cashType, setCashType] = useState('in');
  const [cashAmount, setCashAmount] = useState(0);
  const [cashNote, setCashNote] = useState('');
  const [countedCash, setCountedCash] = useState(0);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [cur, list] = await Promise.all([api.get('/shifts/current'), api.get('/shifts')]);
      setCurrent(cur.data.shift);
      setSummary(cur.data.summary || null);
      setHistory(list.data);
    } catch (err) {
      toast.error(apiError(err, 'Gagal memuat shift'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  async function openShift() {
    setBusy(true);
    try {
      await api.post('/shifts/open', { opening_cash: Number(openingCash) });
      toast.success('Shift dibuka');
      setOpeningCash(0);
      load();
    } catch (err) {
      toast.error(apiError(err, 'Gagal membuka shift'));
    } finally {
      setBusy(false);
    }
  }

  async function addCash() {
    if (!cashAmount) return;
    setBusy(true);
    try {
      await api.post('/shifts/' + current.id + '/cash', {
        type: cashType,
        amount: Number(cashAmount),
        note: cashNote,
      });
      toast.success('Kas dicatat');
      setCashAmount(0);
      setCashNote('');
      load();
    } catch (err) {
      toast.error(apiError(err, 'Gagal mencatat kas'));
    } finally {
      setBusy(false);
    }
  }

  async function closeShift() {
    if (!confirm('Tutup shift sekarang?')) return;
    setBusy(true);
    try {
      await api.post('/shifts/' + current.id + '/close', { counted_cash: Number(countedCash) });
      toast.success('Shift ditutup');
      setCountedCash(0);
      load();
    } catch (err) {
      toast.error(apiError(err, 'Gagal menutup shift'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-slate-400">Memuat...</div>;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Shift & Kas</h1>
        <p className="text-sm text-slate-400">Buka/tutup kas, catat uang masuk & keluar</p>
      </div>

      {!current ? (
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-3 flex items-center gap-2 text-slate-700">
            <Unlock size={20} /> <span className="font-semibold">Buka Shift Baru</span>
          </div>
          <label className="mb-1 block text-sm font-medium text-slate-600">Modal awal (kas laci)</label>
          <input
            type="number"
            value={openingCash || ''}
            onChange={(e) => setOpeningCash(e.target.value)}
            placeholder="cth: 200000"
            className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-lg tabular-nums outline-none focus:border-brand"
          />
          <button
            onClick={openShift}
            disabled={busy}
            className="w-full rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            Buka Shift
          </button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Ringkasan */}
          <div className="lg:col-span-2">
            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard icon={Wallet} label="Modal awal" value={rupiah(current.opening_cash)} />
              <StatCard icon={ArrowDownCircle} label="Penjualan tunai" value={rupiah(summary?.cash_sales || 0)} accent="green" />
              <StatCard icon={History} label="Non-tunai" value={rupiah(summary?.non_cash_sales || 0)} accent="blue" />
              <StatCard icon={Wallet} label="Kas seharusnya" value={rupiah(summary?.expected_cash || 0)} accent="amber" />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-1 text-xs text-slate-400">
                Dibuka {formatDateTime(current.opened_at)} · oleh {current.cashier_name}
              </div>
              <Line label="Modal awal" value={rupiah(current.opening_cash)} />
              <Line label="+ Penjualan tunai (net)" value={rupiah(summary?.cash_sales || 0)} />
              <Line label="+ Kas masuk" value={rupiah(summary?.cash_in || 0)} />
              <Line label="- Kas keluar" value={rupiah(summary?.cash_out || 0)} />
              <div className="my-2 border-t border-dashed border-slate-200" />
              <Line label="Kas seharusnya di laci" value={rupiah(summary?.expected_cash || 0)} strong />
            </div>

            {current.cash_movements?.length > 0 && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="mb-2 font-semibold">Mutasi kas</h3>
                {current.cash_movements.map((m) => (
                  <div key={m.id} className="flex items-center justify-between border-t border-slate-100 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      {m.type === 'in' ? (
                        <ArrowDownCircle size={16} className="text-emerald-500" />
                      ) : (
                        <ArrowUpCircle size={16} className="text-red-500" />
                      )}
                      {m.note || (m.type === 'in' ? 'Kas masuk' : 'Kas keluar')}
                    </span>
                    <span className={`tabular-nums ${m.type === 'in' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {m.type === 'in' ? '+' : '-'}
                      {rupiah(m.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Aksi */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 font-semibold">Catat Kas</h3>
              <div className="mb-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCashType('in')}
                  className={`rounded-xl py-2 text-sm font-medium ${
                    cashType === 'in' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Masuk
                </button>
                <button
                  onClick={() => setCashType('out')}
                  className={`rounded-xl py-2 text-sm font-medium ${
                    cashType === 'out' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Keluar
                </button>
              </div>
              <input
                type="number"
                value={cashAmount || ''}
                onChange={(e) => setCashAmount(e.target.value)}
                placeholder="Nominal"
                className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 tabular-nums outline-none focus:border-brand"
              />
              <input
                value={cashNote}
                onChange={(e) => setCashNote(e.target.value)}
                placeholder="Catatan (cth: beli galon)"
                className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
              />
              <button
                onClick={addCash}
                disabled={busy || !cashAmount}
                className="w-full rounded-xl bg-slate-800 py-2.5 font-medium text-white hover:bg-slate-900 disabled:opacity-50"
              >
                Catat
              </button>
            </div>

            <div className="rounded-2xl border border-red-200 bg-white p-5">
              <div className="mb-3 flex items-center gap-2 font-semibold text-red-600">
                <Lock size={18} /> Tutup Shift
              </div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Uang dihitung (fisik)</label>
              <input
                type="number"
                value={countedCash || ''}
                onChange={(e) => setCountedCash(e.target.value)}
                placeholder="Jumlah uang di laci"
                className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 tabular-nums outline-none focus:border-brand"
              />
              {countedCash > 0 && summary && (
                <div className="mb-3 flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-500">Selisih</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      Number(countedCash) - summary.expected_cash === 0
                        ? 'text-emerald-600'
                        : 'text-red-500'
                    }`}
                  >
                    {rupiah(Number(countedCash) - summary.expected_cash)}
                  </span>
                </div>
              )}
              <button
                onClick={closeShift}
                disabled={busy}
                className="w-full rounded-xl bg-red-500 py-2.5 font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                Tutup Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Riwayat shift */}
      <div className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <History size={18} /> Riwayat Shift
        </h2>
        {history.filter((s) => s.status === 'closed').length === 0 ? (
          <p className="text-sm text-slate-400">Belum ada shift yang ditutup.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3">Kasir</th>
                  <th className="px-4 py-3">Buka</th>
                  <th className="px-4 py-3">Tutup</th>
                  <th className="px-4 py-3 text-right">Penjualan</th>
                  <th className="px-4 py-3 text-right">Seharusnya</th>
                  <th className="px-4 py-3 text-right">Dihitung</th>
                  <th className="px-4 py-3 text-right">Selisih</th>
                </tr>
              </thead>
              <tbody>
                {history
                  .filter((s) => s.status === 'closed')
                  .map((s) => (
                    <tr key={s.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium">{s.cashier_name}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDateTime(s.opened_at)}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDateTime(s.closed_at)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{rupiah(s.closing?.total_sales || 0)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{rupiah(s.closing?.expected_cash || 0)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{rupiah(s.closing?.counted_cash || 0)}</td>
                      <td
                        className={`px-4 py-3 text-right font-medium tabular-nums ${
                          (s.closing?.variance || 0) === 0 ? 'text-emerald-600' : 'text-red-500'
                        }`}
                      >
                        {rupiah(s.closing?.variance || 0)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
