import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, X, Boxes, AlertTriangle } from 'lucide-react';
import { api, apiError } from '../api/client';
import { rupiah } from '../lib/format';

const empty = { name: '', unit: 'pcs', cost_avg: 0, stock: 0, min_stock: 0 };

export default function Ingredients() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const { data } = await api.get('/ingredients');
      setList(data);
    } catch (err) {
      toast.error(apiError(err, 'Gagal memuat bahan'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!editing.name) return toast.error('Nama bahan wajib diisi');
    setBusy(true);
    try {
      if (editing.id) {
        await api.put('/ingredients/' + editing.id, editing);
        toast.success('Bahan diperbarui');
      } else {
        await api.post('/ingredients', editing);
        toast.success('Bahan ditambahkan');
      }
      setEditing(null);
      load();
    } catch (err) {
      toast.error(apiError(err, 'Gagal menyimpan'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(i) {
    if (!confirm(`Hapus bahan "${i.name}"?`)) return;
    try {
      await api.delete('/ingredients/' + i.id);
      toast.success('Bahan dihapus');
      load();
    } catch (err) {
      toast.error(apiError(err, 'Gagal menghapus'));
    }
  }

  const fields = [
    { k: 'unit', label: 'Satuan (gr, ml, pcs, ...)', type: 'text' },
    { k: 'cost_avg', label: 'Harga rata-rata / satuan', type: 'number' },
    { k: 'stock', label: 'Stok saat ini', type: 'number' },
    { k: 'min_stock', label: 'Stok minimum', type: 'number' },
  ];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bahan & Stok</h1>
          <p className="text-sm text-slate-400">Kelola bahan baku, satuan, dan stok gudang</p>
        </div>
        <button
          onClick={() => setEditing({ ...empty })}
          className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-600"
        >
          <Plus size={18} /> Bahan Baru
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">Memuat...</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Bahan</th>
                <th className="px-4 py-3">Satuan</th>
                <th className="px-4 py-3 text-right">Harga</th>
                <th className="px-4 py-3 text-right">Stok</th>
                <th className="px-4 py-3 text-right">Min</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((i) => {
                const low = Number(i.stock) <= Number(i.min_stock);
                return (
                  <tr key={i.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-medium">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                          <Boxes size={15} />
                        </span>
                        {i.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{i.unit}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{rupiah(i.cost_avg || 0)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={low ? 'inline-flex items-center gap-1 font-semibold text-red-500' : ''}>
                        {low && <AlertTriangle size={13} />}
                        {i.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-400">{i.min_stock}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditing(i)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => remove(i)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Belum ada bahan.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing.id ? 'Edit Bahan' : 'Bahan Baru'}</h2>
              <button onClick={() => setEditing(null)} className="rounded-lg p-1 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Nama bahan</label>
                <input
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand"
                />
              </div>
              {fields.map((f) => (
                <div key={f.k}>
                  <label className="mb-1 block text-sm font-medium text-slate-600">{f.label}</label>
                  <input
                    type={f.type}
                    value={editing[f.k]}
                    onChange={(e) => setEditing({ ...editing, [f.k]: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand"
                  />
                </div>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-xl bg-slate-100 py-3 font-medium text-slate-600 hover:bg-slate-200">
                Batal
              </button>
              <button onClick={save} disabled={busy} className="flex-1 rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
