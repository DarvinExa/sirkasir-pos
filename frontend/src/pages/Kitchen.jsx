import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { RefreshCw, ChefHat, CupSoda, Clock, Check } from 'lucide-react';
import { api, apiError } from '../api/client';

const COLUMNS = [
  { key: 'pending', label: 'Antrian', color: 'bg-slate-100', dot: 'bg-slate-400' },
  { key: 'preparing', label: 'Dimasak', color: 'bg-amber-50', dot: 'bg-amber-400' },
  { key: 'ready', label: 'Siap Antar', color: 'bg-emerald-50', dot: 'bg-emerald-500' },
];

const NEXT_LABEL = { pending: 'Masak', preparing: 'Siap', ready: 'Antar' };

function minsAgo(iso) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return m <= 0 ? 'baru' : m + ' mnt';
}

export default function Kitchen() {
  const [tickets, setTickets] = useState([]);
  const [station, setStation] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/kitchen', {
        params: station === 'all' ? {} : { station },
      });
      setTickets(data);
    } catch (err) {
      toast.error(apiError(err, 'Gagal memuat pesanan dapur'));
    } finally {
      setLoading(false);
    }
  }, [station]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function bump(t) {
    try {
      await api.patch('/kitchen/' + t.order_id + '/' + t.item.id, {});
      load();
    } catch (err) {
      toast.error(apiError(err, 'Gagal update status'));
    }
  }

  const stations = [
    { key: 'all', label: 'Semua', icon: Clock },
    { key: 'kitchen', label: 'Dapur', icon: ChefHat },
    { key: 'bar', label: 'Bar', icon: CupSoda },
  ];

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dapur / KDS</h1>
          <p className="text-sm text-slate-400">Kitchen Display - update otomatis tiap 5 detik</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-white p-1">
            {stations.map((s) => (
              <button
                key={s.key}
                onClick={() => setStation(s.key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                  station === s.key ? 'bg-brand text-white' : 'text-slate-500'
                }`}
              >
                <s.icon size={15} /> {s.label}
              </button>
            ))}
          </div>
          <button onClick={load} className="rounded-xl bg-white p-2.5 text-slate-500 hover:bg-slate-50">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-400">Memuat...</p>
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-3">
          {COLUMNS.map((col) => {
            const items = tickets.filter((t) => t.item.kitchen_status === col.key);
            return (
              <div key={col.key} className={`flex flex-col rounded-2xl ${col.color} p-3`}>
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                  <h2 className="font-semibold">{col.label}</h2>
                  <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">
                    {items.length}
                  </span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {items.length === 0 && (
                    <p className="px-1 py-6 text-center text-sm text-slate-400">Kosong</p>
                  )}
                  {items.map((t) => (
                    <div key={t.item.id} className="rounded-xl bg-white p-3 shadow-sm">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{t.table_name || (t.type === 'takeaway' ? 'Takeaway' : t.order_no)}</span>
                        <span>{minsAgo(t.item.created_at)}</span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-lg font-bold text-brand-600">{t.item.qty}x</span>
                        <span className="font-semibold">{t.item.name}</span>
                      </div>
                      {t.item.modifiers?.length > 0 && (
                        <div className="mt-1 text-xs text-slate-500">
                          {t.item.modifiers.map((m) => m.name).join(', ')}
                        </div>
                      )}
                      {t.item.notes && (
                        <div className="mt-1 text-xs italic text-amber-600">Catatan: {t.item.notes}</div>
                      )}
                      <button
                        onClick={() => bump(t)}
                        className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-slate-800 py-2 text-sm font-semibold text-white hover:bg-slate-900"
                      >
                        <Check size={15} /> {NEXT_LABEL[t.item.kitchen_status]}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
