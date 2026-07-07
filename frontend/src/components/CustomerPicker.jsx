import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Star, X, Search, UserPlus, Check } from 'lucide-react';
import { api, apiError } from '../api/client';

// Komponen pilih / daftar member loyalty. Dipakai di modal pembayaran.
export default function CustomerPicker({ selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const timer = useRef();

  useEffect(() => {
    if (!open) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/customers', { params: { q, limit: 8 } });
        setResults(data);
      } catch (e) {
        /* diamkan */
      }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [q, open]);

  async function quickAdd() {
    if (!form.name.trim()) return toast.error('Nama member wajib diisi');
    setBusy(true);
    try {
      const { data } = await api.post('/customers', form);
      onSelect(data);
      setAdding(false);
      setOpen(false);
      setForm({ name: '', phone: '' });
      toast.success('Member baru terdaftar');
    } catch (err) {
      toast.error(apiError(err, 'Gagal menambah member'));
    } finally {
      setBusy(false);
    }
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5">
        <div>
          <div className="text-sm font-semibold">{selected.name}</div>
          <div className="flex items-center gap-1 text-xs text-brand-700">
            <Star size={12} className="fill-brand-500 text-brand-500" /> {selected.points} poin
            {selected.phone ? ` · ${selected.phone}` : ''}
          </div>
        </div>
        <button onClick={() => onSelect(null)} className="rounded-lg p-1 text-slate-400 hover:bg-white">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-500 hover:border-brand hover:text-brand"
        >
          <UserPlus size={16} /> Tautkan member (opsional)
        </button>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-2">
          {!adding ? (
            <>
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <Search size={16} className="text-slate-400" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Cari nama / no HP..."
                  className="w-full bg-transparent text-sm outline-none"
                />
                <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={15} />
                </button>
              </div>
              <div className="max-h-44 overflow-y-auto">
                {results.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-slate-400">Tidak ada member.</p>
                ) : (
                  results.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        onSelect(c);
                        setOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-slate-50"
                    >
                      <span className="text-sm">
                        <span className="font-medium">{c.name}</span>
                        {c.phone ? <span className="text-slate-400"> · {c.phone}</span> : ''}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-brand-600">
                        <Star size={11} /> {c.points}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <button
                onClick={() => {
                  setForm({ name: q, phone: '' });
                  setAdding(true);
                }}
                className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
              >
                <UserPlus size={15} /> Daftar member baru
              </button>
            </>
          ) : (
            <div className="space-y-2 p-1">
              <input
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nama member"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="No HP (opsional)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setAdding(false)}
                  className="flex-1 rounded-lg bg-slate-100 py-2 text-sm font-medium text-slate-600"
                >
                  Batal
                </button>
                <button
                  onClick={quickAdd}
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Check size={15} /> Simpan
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
