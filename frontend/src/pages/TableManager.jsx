import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, X, LayoutGrid } from 'lucide-react';
import { api, apiError } from '../api/client';

const empty = { name: '', area: 'Indoor', seats: 4 };

export default function TableManager() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const { data } = await api.get('/tables');
      setList(data);
    } catch (err) {
      toast.error(apiError(err, 'Gagal memuat meja'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!editing.name) return toast.error('Nama meja wajib diisi');
    setBusy(true);
    try {
      if (editing.id) {
        await api.put('/tables/' + editing.id, editing);
        toast.success('Meja diperbarui');
      } else {
        await api.post('/tables', editing);
        toast.success('Meja ditambahkan');
      }
      setEditing(null);
      load();
    } catch (err) {
      toast.error(apiError(err, 'Gagal menyimpan'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(t) {
    if (!confirm(`Hapus meja "${t.name}"?`)) return;
    try {
      await api.delete('/tables/' + t.id);
      toast.success('Meja dihapus');
      load();
    } catch (err) {
      toast.error(apiError(err, 'Gagal menghapus'));
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kelola Meja</h1>
          <p className="text-sm text-slate-400">Atur meja, area, dan kapasitas kursi</p>
        </div>
        <button
          onClick={() => setEditing({ ...empty })}
          className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-600"
        >
          <Plus size={18} /> Meja Baru
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">Memuat...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((t) => (
            <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <LayoutGrid size={18} />
                  </span>
                  <div>
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs text-slate-400">{t.area}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => remove(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
                <span>{t.seats} kursi</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    t.status === 'occupied' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {t.status === 'occupied' ? 'Terisi' : 'Kosong'}
                </span>
              </div>
            </div>
          ))}
          {list.length === 0 && <p className="text-slate-400">Belum ada meja.</p>}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing.id ? 'Edit Meja' : 'Meja Baru'}</h2>
              <button onClick={() => setEditing(null)} className="rounded-lg p-1 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Nama meja</label>
                <input
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Area</label>
                <input
                  value={editing.area || ''}
                  onChange={(e) => setEditing({ ...editing, area: e.target.value })}
                  placeholder="Indoor, Outdoor, VIP, ..."
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Jumlah kursi</label>
                <input
                  type="number"
                  min="1"
                  value={editing.seats}
                  onChange={(e) => setEditing({ ...editing, seats: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand"
                />
              </div>
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
