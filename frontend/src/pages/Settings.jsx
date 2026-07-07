import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Save, Store } from 'lucide-react';
import { api, apiError } from '../api/client';

export default function Settings() {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const { data } = await api.get('/settings');
      setForm({ loyalty: {}, ...data });
    } catch (err) {
      toast.error(apiError(err, 'Gagal memuat pengaturan'));
    }
  }

  useEffect(() => {
    load();
  }, []);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setLoyalty(k, v) {
    setForm((f) => ({ ...f, loyalty: { ...f.loyalty, [k]: v } }));
  }

  async function save() {
    setBusy(true);
    try {
      await api.put('/settings', form);
      toast.success('Pengaturan disimpan');
    } catch (err) {
      toast.error(apiError(err, 'Gagal menyimpan'));
    } finally {
      setBusy(false);
    }
  }

  if (!form) return <div className="p-6 text-slate-400">Memuat...</div>;

  const loyalty = form.loyalty || {};

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pengaturan</h1>
          <p className="text-sm text-slate-400">Profil toko, pajak, dan program loyalti</p>
        </div>
        <button
          onClick={save}
          disabled={busy}
          className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          <Save size={18} /> Simpan
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2 font-semibold">
            <Store size={18} className="text-brand-600" /> Profil Toko
          </div>
          <div className="space-y-3">
            {[
              { k: 'store_name', label: 'Nama toko' },
              { k: 'address', label: 'Alamat' },
              { k: 'phone', label: 'Telepon' },
              { k: 'footer_note', label: 'Catatan struk (footer)' },
            ].map((f) => (
              <div key={f.k}>
                <label className="mb-1 block text-sm font-medium text-slate-600">{f.label}</label>
                <input
                  value={form[f.k] || ''}
                  onChange={(e) => set(f.k, e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-4 font-semibold">Pajak & Layanan</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Pajak (%)</label>
                <input
                  type="number"
                  value={form.tax_percent ?? 0}
                  onChange={(e) => set('tax_percent', Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Service (%)</label>
                <input
                  type="number"
                  value={form.service_percent ?? 0}
                  onChange={(e) => set('service_percent', Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-semibold">Program Loyalti</span>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!loyalty.enabled}
                  onChange={(e) => setLoyalty('enabled', e.target.checked)}
                  className="h-4 w-4 accent-brand"
                />
                Aktif
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Poin / Rp 1.000</label>
                <input
                  type="number"
                  value={loyalty.earn_per1000 ?? 0}
                  onChange={(e) => setLoyalty('earn_per1000', Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Nilai 1 poin (Rp)</label>
                <input
                  type="number"
                  value={loyalty.point_value ?? 0}
                  onChange={(e) => setLoyalty('point_value', Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
