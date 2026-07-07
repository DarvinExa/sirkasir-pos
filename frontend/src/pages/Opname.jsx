import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ClipboardCheck, Save, History } from 'lucide-react';
import { api, apiError } from '../api/client';
import { rupiah, formatDateTime } from '../lib/format';

export default function Opname() {
  const [ingredients, setIngredients] = useState([]);
  const [history, setHistory] = useState([]);
  const [counts, setCounts] = useState({}); // id -> counted string
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [ing, opn] = await Promise.all([api.get('/ingredients'), api.get('/opnames')]);
      setIngredients(ing.data);
      setHistory(opn.data);
    } catch (err) {
      toast.error(apiError(err, 'Gagal memuat data'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function varianceOf(ing) {
    const raw = counts[ing.id];
    if (raw === undefined || raw === '') return null;
    return Number(raw) - ing.stock;
  }

  const filled = ingredients.filter((i) => counts[i.id] !== undefined && counts[i.id] !== '');
  const totalVarValue = filled.reduce((s, i) => s + (Number(counts[i.id]) - i.stock) * i.cost_avg, 0);

  async function submit() {
    if (filled.length === 0) return toast.error('Isi minimal 1 hitungan');
    if (!confirm(`Simpan opname untuk ${filled.length} bahan? Stok akan disesuaikan.`)) return;
    setBusy(true);
    try {
      await api.post('/opnames', {
        note,
        items: filled.map((i) => ({ ingredient_id: i.id, counted: Number(counts[i.id]) })),
      });
      toast.success('Opname tersimpan & stok disesuaikan');
      setCounts({});
      setNote('');
      load();
    } catch (err) {
      toast.error(apiError(err, 'Gagal menyimpan opname'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-slate-400">Memuat...</div>;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ClipboardCheck size={24} /> Stok Opname
        </h1>
        <p className="text-sm text-slate-400">Hitung stok fisik dan sesuaikan dengan sistem</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Bahan</th>
              <th className="px-4 py-3 text-right">Stok Sistem</th>
              <th className="px-4 py-3 text-right">Hitungan Fisik</th>
              <th className="px-4 py-3 text-right">Selisih</th>
              <th className="px-4 py-3 text-right">Nilai Selisih</th>
            </tr>
          </thead>
          <tbody>
            {ingredients.map((i) => {
              const v = varianceOf(i);
              return (
                <tr key={i.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">
                    {i.name} <span className="text-xs text-slate-400">({i.unit})</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">{i.stock}</td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      value={counts[i.id] ?? ''}
                      onChange={(e) => setCounts({ ...counts, [i.id]: e.target.value })}
                      placeholder="-"
                      className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-right tabular-nums outline-none focus:border-brand"
                    />
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${v == null ? 'text-slate-300' : v === 0 ? 'text-slate-400' : v > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {v == null ? '-' : (v > 0 ? '+' : '') + v}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${v == null || v === 0 ? 'text-slate-300' : v > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {v == null ? '-' : rupiah(Math.round(v * i.cost_avg))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan opname (opsional)"
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand"
        />
        <div className="flex items-center gap-4">
          <div className="text-sm">
            Total nilai selisih:{' '}
            <span className={`font-bold tabular-nums ${totalVarValue < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
              {rupiah(Math.round(totalVarValue))}
            </span>
          </div>
          <button
            onClick={submit}
            disabled={busy || filled.length === 0}
            className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            <Save size={17} /> Simpan Opname
          </button>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <History size={18} /> Riwayat Opname
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">Belum ada opname.</p>
        ) : (
          <div className="space-y-2">
            {history.map((op) => (
              <div key={op.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold">{op.opname_no}</span>
                    <span className="ml-2 text-xs text-slate-400">
                      {formatDateTime(op.created_at)} · {op.created_by}
                    </span>
                  </div>
                  <span className={`font-bold tabular-nums ${op.total_variance_value < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {rupiah(op.total_variance_value)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {op.items.length} bahan · {op.items.filter((x) => x.variance !== 0).length} ada selisih
                  {op.note ? ` · ${op.note}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
