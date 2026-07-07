import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Users, Plus, ShoppingBag, RefreshCw } from 'lucide-react';
import { api, apiError } from '../api/client';
import { rupiah } from '../lib/format';

export default function Tables() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  async function load() {
    try {
      const { data } = await api.get('/tables');
      setTables(data);
    } catch (err) {
      toast.error(apiError(err, 'Gagal memuat meja'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  // Buka meja TANPA langsung membuat order. Order (dan nomor ORD) baru dibuat
  // saat item pertama dikirim ke dapur, jadi menekan meja lalu keluar tidak
  // menyisakan order kosong.
  function openTable(tbl) {
    if (tbl.order) {
      nav('/order/' + tbl.order.id);
    } else {
      nav('/order/new?table=' + tbl.id);
    }
  }

  function takeaway() {
    nav('/order/new?type=takeaway');
  }

  const areas = [...new Set(tables.map((t) => t.area))];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meja / Dine-in</h1>
          <p className="text-sm text-slate-400">Pilih meja untuk mulai atau lanjutkan pesanan</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={16} /> <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={takeaway}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
          >
            <ShoppingBag size={18} /> Takeaway
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-emerald-400" /> Kosong
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-brand" /> Terisi
        </span>
      </div>

      {loading ? (
        <p className="text-slate-400">Memuat...</p>
      ) : (
        areas.map((area) => (
          <div key={area} className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">{area}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {tables
                .filter((t) => t.area === area)
                .map((t) => {
                  const occupied = !!t.order;
                  return (
                    <button
                      key={t.id}
                      onClick={() => openTable(t)}
                      disabled={busy}
                      className={`rounded-2xl border-2 p-4 text-left transition disabled:opacity-60 ${
                        occupied
                          ? 'border-brand bg-brand-50 hover:bg-brand-100'
                          : 'border-emerald-200 bg-white hover:border-emerald-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold">{t.name}</span>
                        <span
                          className={`h-3 w-3 rounded-full ${occupied ? 'bg-brand' : 'bg-emerald-400'}`}
                        />
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                        <Users size={13} /> {t.seats} kursi
                      </div>
                      {occupied ? (
                        <div className="mt-3 border-t border-brand-200 pt-2">
                          <div className="text-xs text-slate-500">{t.order.order_no}</div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500">{t.order.item_count} item</span>
                            <span className="font-bold text-brand-600 tabular-nums">
                              {rupiah(t.order.total)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center gap-1 border-t border-slate-100 pt-2 text-xs font-medium text-emerald-600">
                          <Plus size={14} /> Buka pesanan
                        </div>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
