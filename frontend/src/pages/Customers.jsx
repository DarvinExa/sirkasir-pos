import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, X, Search, Star, Trash2, Pencil, Users, TrendingUp, Wallet } from 'lucide-react';
import { api, apiError } from '../api/client';
import { rupiah, formatDateTime } from '../lib/format';
import { useAuth } from '../store/auth';
import StatCard from '../components/StatCard';

const emptyForm = { name: '', phone: '', email: '', note: '', points: 0 };

export default function Customers() {
  const user = useAuth((s) => s.user);
  const isManager = user?.role === 'owner' || user?.role === 'manager';
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // {id?, ...form}
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null); // customer detail w/ transactions
  const [adjust, setAdjust] = useState({ delta: '', note: '' });

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/customers', { params: { q } });
      setList(data);
    } catch (err) {
      toast.error(apiError(err, 'Gagal memuat pelanggan'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const totalMembers = list.length;
  const totalPoints = list.reduce((s, c) => s + (c.points || 0), 0);
  const totalSpent = list.reduce((s, c) => s + (c.total_spent || 0), 0);

  async function save() {
    if (!editing.name.trim()) return toast.error('Nama wajib diisi');
    setSaving(true);
    try {
      if (editing.id) {
        await api.put('/customers/' + editing.id, editing);
        toast.success('Data member diperbarui');
      } else {
        await api.post('/customers', editing);
        toast.success('Member ditambahkan');
      }
      setEditing(null);
      load();
    } catch (err) {
      toast.error(apiError(err, 'Gagal menyimpan'));
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(c) {
    try {
      const { data } = await api.get('/customers/' + c.id);
      setDetail(data);
      setAdjust({ delta: '', note: '' });
    } catch (err) {
      toast.error(apiError(err, 'Gagal memuat detail'));
    }
  }

  async function submitAdjust() {
    const delta = parseInt(adjust.delta, 10);
    if (!delta) return toast.error('Isi jumlah poin (boleh minus)');
    try {
      const { data } = await api.post('/customers/' + detail.id + '/points', {
        delta,
        note: adjust.note,
      });
      toast.success('Poin disesuaikan');
      setDetail({ ...detail, points: data.points, point_history: data.point_history });
      setAdjust({ delta: '', note: '' });
      load();
    } catch (err) {
      toast.error(apiError(err, 'Gagal menyesuaikan poin'));
    }
  }

  async function remove(c) {
    if (!confirm(`Hapus member "${c.name}"?`)) return;
    try {
      await api.delete('/customers/' + c.id);
      toast.success('Member dihapus');
      load();
    } catch (err) {
      toast.error(apiError(err, 'Gagal menghapus'));
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Users size={24} /> Pelanggan
          </h1>
          <p className="text-sm text-slate-400">Member loyalty & poin</p>
        </div>
        <button
          onClick={() => setEditing({ ...emptyForm })}
          className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-600"
        >
          <Plus size={18} /> Member Baru
        </button>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-4">
        <StatCard icon={Users} label="Total member" value={totalMembers} />
        <StatCard icon={Star} label="Total poin beredar" value={totalPoints} accent="amber" />
        <StatCard icon={Wallet} label="Total belanja member" value={rupiah(totalSpent)} accent="green" />
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2">
        <Search size={18} className="text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama / no HP..."
          className="w-full bg-transparent outline-none"
        />
      </div>

      {loading ? (
        <p className="text-slate-400">Memuat...</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada member.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">No HP</th>
                <th className="px-4 py-3 text-right">Poin</th>
                <th className="px-4 py-3 text-right">Kunjungan</th>
                <th className="px-4 py-3 text-right">Total belanja</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                  onClick={() => openDetail(c)}
                >
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-slate-500">{c.phone || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1 font-semibold text-brand-600">
                      <Star size={13} /> {c.points}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">{c.visits || 0}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{rupiah(c.total_spent || 0)}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditing({ ...emptyForm, ...c })}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand"
                      >
                        <Pencil size={16} />
                      </button>
                      {isManager && (
                        <button
                          onClick={() => remove(c)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal tambah/edit */}
      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editing.id ? 'Edit Member' : 'Member Baru'}</h2>
              <button onClick={() => setEditing(null)} className="rounded-lg p-1 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Nama member"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand"
              />
              <input
                value={editing.phone}
                onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                placeholder="No HP"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand"
              />
              <input
                value={editing.email}
                onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                placeholder="Email (opsional)"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand"
              />
              <input
                value={editing.note}
                onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                placeholder="Catatan (opsional)"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand"
              />
              {!editing.id && (
                <div>
                  <label className="mb-1 block text-sm text-slate-500">Poin awal</label>
                  <input
                    type="number"
                    value={editing.points}
                    onChange={(e) => setEditing({ ...editing, points: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 tabular-nums outline-none focus:border-brand"
                  />
                </div>
              )}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 rounded-xl bg-slate-100 py-3 font-medium text-slate-600 hover:bg-slate-200"
              >
                Batal
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detail */}
      {detail && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-3xl bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h2 className="text-lg font-bold">{detail.name}</h2>
                <div className="text-xs text-slate-400">{detail.phone || 'Tanpa no HP'}</div>
              </div>
              <button onClick={() => setDetail(null)} className="rounded-lg p-1 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-brand-50 p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-2xl font-bold text-brand-600">
                    <Star size={20} className="fill-brand-500 text-brand-500" /> {detail.points}
                  </div>
                  <div className="text-xs text-slate-500">poin</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 text-center">
                  <div className="text-2xl font-bold">{detail.visits || 0}</div>
                  <div className="text-xs text-slate-500">kunjungan</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 text-center">
                  <div className="text-lg font-bold tabular-nums">{rupiah(detail.total_spent || 0)}</div>
                  <div className="text-xs text-slate-500">total belanja</div>
                </div>
              </div>

              {isManager && (
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-2 text-sm font-semibold">Sesuaikan poin manual</div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={adjust.delta}
                      onChange={(e) => setAdjust({ ...adjust, delta: e.target.value })}
                      placeholder="+/- poin"
                      className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-right text-sm tabular-nums outline-none focus:border-brand"
                    />
                    <input
                      value={adjust.note}
                      onChange={(e) => setAdjust({ ...adjust, note: e.target.value })}
                      placeholder="Catatan"
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
                    />
                    <button
                      onClick={submitAdjust}
                      className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                    >
                      Simpan
                    </button>
                  </div>
                </div>
              )}

              <div>
                <div className="mb-2 text-sm font-semibold">Riwayat poin</div>
                {(!detail.point_history || detail.point_history.length === 0) ? (
                  <p className="text-xs text-slate-400">Belum ada aktivitas poin.</p>
                ) : (
                  <div className="space-y-1">
                    {detail.point_history.map((h) => (
                      <div key={h.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <div>
                          <span className="text-slate-500">{formatDateTime(h.created_at)}</span>
                          {h.note ? <span className="ml-1 text-xs italic text-slate-400">{h.note}</span> : ''}
                          {h.invoice_no ? <span className="ml-1 text-xs text-slate-400">{h.invoice_no}</span> : ''}
                        </div>
                        <div className="flex items-center gap-2 tabular-nums">
                          {h.earned > 0 && <span className="text-emerald-600">+{h.earned}</span>}
                          {h.redeemed > 0 && <span className="text-red-500">-{h.redeemed}</span>}
                          <span className="text-xs text-slate-400">saldo {h.balance}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold">Transaksi terakhir</div>
                {(!detail.transactions || detail.transactions.length === 0) ? (
                  <p className="text-xs text-slate-400">Belum ada transaksi.</p>
                ) : (
                  <div className="space-y-1">
                    {detail.transactions.map((t) => (
                      <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                        <span className="text-slate-500">
                          {t.invoice_no} · {formatDateTime(t.created_at)}
                        </span>
                        <span className="font-medium tabular-nums">{rupiah(t.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
