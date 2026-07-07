import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, X, Truck, Phone, User } from 'lucide-react';
import { api, apiError } from '../api/client';

const empty = { name: '', phone: '', contact: '', note: '' };

export default function Suppliers() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const { data } = await api.get('/suppliers');
      setList(data);
    } catch (err) {
      toast.error(apiError(err, 'Gagal memuat supplier'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!editing.name) return toast.error('Nama supplier wajib diisi');
    setBusy(true);
    try {
      if (editing.id) {
        await api.put('/suppliers/' + editing.id, editing);
        toast.success('Supplier diperbarui');
      } else {
        await api.post('/suppliers', editing);
        toast.success('Supplier ditambahkan');
      }
      setEditing(null);
      load();
    } catch (err) {
      toast.error(apiError(err, 'Gagal menyimpan'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(s) {
    if (!confirm(`Hapus supplier "${s.name}"?`)) return;
    try {
      await api.delete('/suppliers/' + s.id);
      toast.success('Supplier dihapus');
      load();
    } catch (err) {
      toast.error(apiError(err, 'Gagal menghapus'));
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Supplier</h1>
          <p className="text-sm text-slate-400">Daftar pemasok bahan baku</p>
        </div>
        <button
          onClick={() => setEditing({ ...empty })}
          className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-600"
        >
          <Plus size={18} /> Supplier Baru
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">Memuat...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => (
            <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Truck size={18} />
                  </span>
                  <div className="font-semibold">{s.name}</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => remove(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-500">
                {s.contact && (
                  <div className="flex items-center gap-2">
                    <User size={14} /> {s.contact}
                  </div>
                )}
                {s.phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={14} /> {s.phone}
                  </div>
                )}
                {s.note && <div className="text-xs text-slate-400">{s.note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing.id ? 'Edit Supplier' : 'Supplier Baru'}</h2>
              <button onClick={() => setEditing(null)} className="rounded-lg p-1 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { k: 'name', label: 'Nama supplier' },
                { k: 'contact', label: 'Nama kontak (PIC)' },
                { k: 'phone', label: 'Telepon' },
                { k: 'note', label: 'Catatan' },
              ].map((f) => (
                <div key={f.k}>
                  <label className="mb-1 block text-sm font-medium text-slate-600">{f.label}</label>
                  <input
                    value={editing[f.k] || ''}
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
