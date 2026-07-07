import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Tag, Plus, Pencil, Trash2, X, Ticket, Percent, Zap } from 'lucide-react';
import { api, apiError } from '../api/client';
import { rupiah } from '../lib/format';
import StatCard from '../components/StatCard';

const TYPE_LABEL = { percent: 'Persen', fixed: 'Nominal', bogo: 'Beli-Gratis' };
const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const EMPTY = {
  name: '',
  type: 'percent',
  value: 10,
  active: true,
  code: '',
  min_subtotal: 0,
  max_discount: 0,
  member_only: false,
  stackable: false,
  days: [],
  start_hour: '',
  end_hour: '',
  applies_to: 'all',
  buy_qty: 2,
  get_qty: 1,
};

function describe(p) {
  const parts = [];
  if (p.type === 'percent') parts.push(`${p.value}%` + (p.max_discount ? ` (maks ${rupiah(p.max_discount)})` : ''));
  else if (p.type === 'fixed') parts.push(rupiah(p.value));
  else parts.push(`Beli ${p.buy_qty} gratis ${p.get_qty}`);
  if (p.min_subtotal) parts.push(`min ${rupiah(p.min_subtotal)}`);
  if (p.member_only) parts.push('member');
  if (p.days && p.days.length) parts.push(p.days.map((d) => DAYS[d]).join(','));
  if (p.start_hour != null && p.end_hour != null && p.start_hour !== '' && p.end_hour !== '')
    parts.push(`jam ${p.start_hour}-${p.end_hour}`);
  return parts.join(' · ');
}

export default function Promo() {
  const [promos, setPromos] = useState([]);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | promo object | 'new'
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [p, m] = await Promise.all([api.get('/promos'), api.get('/menu')]);
      setPromos(p.data);
      setMenu(m.data);
    } catch (err) {
      toast.error(apiError(err, 'Gagal memuat promo'));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const active = promos.filter((p) => p.active).length;
    const voucher = promos.filter((p) => p.code).length;
    return { total: promos.length, active, voucher };
  }, [promos]);

  function openNew() {
    setForm(EMPTY);
    setEditing('new');
  }
  function openEdit(p) {
    setForm({
      ...EMPTY,
      ...p,
      start_hour: p.start_hour == null ? '' : p.start_hour,
      end_hour: p.end_hour == null ? '' : p.end_hour,
      days: p.days || [],
    });
    setEditing(p);
  }

  function toggleDay(d) {
    setForm((f) => {
      const has = f.days.includes(d);
      return { ...f, days: has ? f.days.filter((x) => x !== d) : [...f.days, d].sort() };
    });
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error('Nama promo wajib diisi.');
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      value: Number(form.value) || 0,
      min_subtotal: Number(form.min_subtotal) || 0,
      max_discount: Number(form.max_discount) || 0,
      buy_qty: Number(form.buy_qty) || 1,
      get_qty: Number(form.get_qty) || 1,
      start_hour: form.start_hour === '' ? null : Number(form.start_hour),
      end_hour: form.end_hour === '' ? null : Number(form.end_hour),
    };
    try {
      if (editing === 'new') await api.post('/promos', payload);
      else await api.put('/promos/' + editing.id, payload);
      toast.success('Promo tersimpan.');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(apiError(err, 'Gagal menyimpan promo'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p) {
    try {
      await api.put('/promos/' + p.id, { active: !p.active });
      setPromos((list) => list.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)));
    } catch (err) {
      toast.error(apiError(err, 'Gagal mengubah status'));
    }
  }

  async function remove(p) {
    if (!confirm(`Hapus promo "${p.name}"?`)) return;
    try {
      await api.delete('/promos/' + p.id);
      toast.success('Promo dihapus.');
      setPromos((list) => list.filter((x) => x.id !== p.id));
    } catch (err) {
      toast.error(apiError(err, 'Gagal menghapus promo'));
    }
  }

  if (loading) return <div className="p-6 text-slate-400">Memuat promo...</div>;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Promo &amp; Diskon</h1>
          <p className="text-sm text-slate-400">Promo otomatis diterapkan saat checkout sesuai syaratnya.</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-600"
        >
          <Plus size={18} /> Promo Baru
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard icon={Tag} label="Total Promo" value={stats.total} accent="brand" />
        <StatCard icon={Zap} label="Aktif" value={stats.active} accent="green" />
        <StatCard icon={Ticket} label="Voucher (pakai kode)" value={stats.voucher} accent="blue" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Tipe</th>
              <th className="px-4 py-3">Syarat &amp; nilai</th>
              <th className="px-4 py-3">Kode</th>
              <th className="px-4 py-3 text-center">Aktif</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {promos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Belum ada promo. Klik "Promo Baru".
                </td>
              </tr>
            )}
            {promos.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-semibold">{p.name}</div>
                  {p.stackable && <span className="text-xs text-emerald-600">bisa digabung</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600">
                    {TYPE_LABEL[p.type] || p.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{describe(p)}</td>
                <td className="px-4 py-3">
                  {p.code ? (
                    <code className="rounded bg-slate-100 px-2 py-0.5 text-xs">{p.code}</code>
                  ) : (
                    <span className="text-xs text-slate-400">otomatis</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleActive(p)}
                    className={`relative h-6 w-11 rounded-full transition ${
                      p.active ? 'bg-brand' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                        p.active ? 'left-[22px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => openEdit(p)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => remove(p)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-3xl bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h2 className="text-lg font-bold">{editing === 'new' ? 'Promo Baru' : 'Edit Promo'}</h2>
              <button onClick={() => setEditing(null)} className="rounded-lg p-1 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div>
                <label className="mb-1 block text-sm font-medium">Nama promo</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-brand"
                  placeholder="mis. Diskon Akhir Pekan"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Tipe</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-brand"
                  >
                    <option value="percent">Diskon persen (%)</option>
                    <option value="fixed">Potongan nominal (Rp)</option>
                    <option value="bogo">Beli X gratis Y</option>
                  </select>
                </div>
                {form.type !== 'bogo' && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      {form.type === 'percent' ? 'Persen (%)' : 'Nominal (Rp)'}
                    </label>
                    <input
                      type="number"
                      value={form.value}
                      onChange={(e) => setForm({ ...form, value: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-right tabular-nums outline-none focus:border-brand"
                    />
                  </div>
                )}
              </div>

              {form.type === 'percent' && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Maks. potongan (Rp, 0 = tanpa batas)</label>
                  <input
                    type="number"
                    value={form.max_discount}
                    onChange={(e) => setForm({ ...form, max_discount: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-right tabular-nums outline-none focus:border-brand"
                  />
                </div>
              )}

              {form.type === 'bogo' && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Beli</label>
                    <input type="number" value={form.buy_qty} onChange={(e) => setForm({ ...form, buy_qty: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-right outline-none focus:border-brand" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Gratis</label>
                    <input type="number" value={form.get_qty} onChange={(e) => setForm({ ...form, get_qty: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-right outline-none focus:border-brand" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Menu</label>
                    <select value={form.applies_to} onChange={(e) => setForm({ ...form, applies_to: e.target.value })} className="w-full rounded-xl border border-slate-200 px-2 py-2 outline-none focus:border-brand">
                      <option value="all">Semua menu</option>
                      {menu.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Min. belanja (Rp)</label>
                  <input type="number" value={form.min_subtotal} onChange={(e) => setForm({ ...form, min_subtotal: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-right tabular-nums outline-none focus:border-brand" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Kode voucher</label>
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="kosong = otomatis" className="w-full rounded-xl border border-slate-200 px-3 py-2 uppercase outline-none focus:border-brand" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Jam mulai (0-24)</label>
                  <input type="number" value={form.start_hour} onChange={(e) => setForm({ ...form, start_hour: e.target.value })} placeholder="kosong" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-right outline-none focus:border-brand" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Jam selesai (0-24)</label>
                  <input type="number" value={form.end_hour} onChange={(e) => setForm({ ...form, end_hour: e.target.value })} placeholder="kosong" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-right outline-none focus:border-brand" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Hari berlaku (kosong = semua hari)</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d, i) => (
                    <button
                      key={i}
                      onClick={() => toggleDay(i)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                        form.days.includes(i) ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.member_only} onChange={(e) => setForm({ ...form, member_only: e.target.checked })} className="accent-brand" />
                  Khusus member
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.stackable} onChange={(e) => setForm({ ...form, stackable: e.target.checked })} className="accent-brand" />
                  Bisa digabung (stackable)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-brand" />
                  Aktif
                </label>
              </div>
            </div>
            <div className="border-t border-slate-100 p-5">
              <button
                onClick={save}
                disabled={saving}
                className="w-full rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {saving ? 'Menyimpan...' : 'Simpan Promo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
