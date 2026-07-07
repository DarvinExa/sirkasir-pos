import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, X, UserCog } from 'lucide-react';
import { api, apiError } from '../api/client';

const empty = { name: '', email: '', role: 'kasir', status: 'active', password: '', pin: '' };

const ROLE_LABEL = { owner: 'Owner', manager: 'Manager', kasir: 'Kasir' };

export default function UsersManager() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const { data } = await api.get('/users');
      setList(data);
    } catch (err) {
      toast.error(apiError(err, 'Gagal memuat pengguna'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!editing.name) return toast.error('Nama wajib diisi');
    if (!editing.email) return toast.error('Email wajib diisi');
    if (!editing.id && !editing.password) return toast.error('Password wajib diisi');
    setBusy(true);
    try {
      if (editing.id) {
        await api.put('/users/' + editing.id, editing);
        toast.success('Pengguna diperbarui');
      } else {
        await api.post('/users', editing);
        toast.success('Pengguna ditambahkan');
      }
      setEditing(null);
      load();
    } catch (err) {
      toast.error(apiError(err, 'Gagal menyimpan'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(u) {
    if (!confirm(`Hapus pengguna "${u.name}"?`)) return;
    try {
      await api.delete('/users/' + u.id);
      toast.success('Pengguna dihapus');
      load();
    } catch (err) {
      toast.error(apiError(err, 'Gagal menghapus'));
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pengguna</h1>
          <p className="text-sm text-slate-400">Kelola akun staf, peran, dan akses</p>
        </div>
        <button
          onClick={() => setEditing({ ...empty })}
          className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-600"
        >
          <Plus size={18} /> Pengguna Baru
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">Memuat...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((u) => (
            <div key={u.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <UserCog size={18} />
                  </span>
                  <div>
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditing({ ...u, password: '', pin: '' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => remove(u)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {ROLE_LABEL[u.role] || u.role}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    u.status === 'inactive' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {u.status === 'inactive' ? 'Nonaktif' : 'Aktif'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing.id ? 'Edit Pengguna' : 'Pengguna Baru'}</h2>
              <button onClick={() => setEditing(null)} className="rounded-lg p-1 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Nama</label>
                <input
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Email</label>
                <input
                  type="email"
                  value={editing.email || ''}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">Peran</label>
                  <select
                    value={editing.role}
                    onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-brand"
                  >
                    <option value="owner">Owner</option>
                    <option value="manager">Manager</option>
                    <option value="kasir">Kasir</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">Status</label>
                  <select
                    value={editing.status}
                    onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-brand"
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">
                  Password {editing.id && <span className="text-slate-400">(kosongkan jika tidak diubah)</span>}
                </label>
                <input
                  type="password"
                  value={editing.password || ''}
                  onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">
                  PIN {editing.id && <span className="text-slate-400">(kosongkan jika tidak diubah)</span>}
                </label>
                <input
                  value={editing.pin || ''}
                  onChange={(e) => setEditing({ ...editing, pin: e.target.value })}
                  placeholder="contoh: 1234"
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
