import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  Trash2,
  Send,
  CreditCard,
  Printer,
  X,
  Ban,
  ArrowRightLeft,
} from 'lucide-react';
import { api, apiError } from '../api/client';
import { rupiah } from '../lib/format';
import { useAuth } from '../store/auth';
import ModifierModal from '../components/ModifierModal';
import PayOrderModal from '../components/PayOrderModal';
import Receipt from '../components/Receipt';

const STATUS_BADGE = {
  pending: { label: 'Antri', cls: 'bg-slate-100 text-slate-500' },
  preparing: { label: 'Dimasak', cls: 'bg-amber-100 text-amber-700' },
  ready: { label: 'Siap', cls: 'bg-emerald-100 text-emerald-700' },
  served: { label: 'Diantar', cls: 'bg-blue-100 text-blue-700' },
};

export default function OrderScreen() {
  const { id } = useParams();
  const nav = useNavigate();
  const user = useAuth((s) => s.user);
  const canVoid = user?.role === 'owner' || user?.role === 'manager';
  const [searchParams] = useSearchParams();
  const isNew = id === 'new';
  const newType = searchParams.get('type') === 'takeaway' ? 'takeaway' : 'dine-in';
  const newTableId = searchParams.get('table') || null;

  const [order, setOrder] = useState(null);
  const [tables, setTables] = useState([]);
  const [moveOpen, setMoveOpen] = useState(false);
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeCat, setActiveCat] = useState('all');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState([]); // item baru belum dikirim
  const [modifierFor, setModifierFor] = useState(null);
  const [paying, setPaying] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState(null);

  async function loadOrder() {
    if (id === 'new') return;
    try {
      const { data } = await api.get('/orders/' + id);
      setOrder(data);
    } catch (err) {
      toast.error(apiError(err, 'Gagal memuat order'));
      nav('/tables');
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const [cats, items, st, tbls] = await Promise.all([
          api.get('/categories'),
          api.get('/menu'),
          api.get('/settings'),
          api.get('/tables'),
        ]);
        setCategories(cats.data);
        setMenu(items.data);
        setSettings(st.data);
        setTables(tbls.data);
        if (id === 'new') {
          const tbl = (tbls.data || []).find((t) => t.id === newTableId);
          setOrder({
            id: 'new',
            status: 'open',
            type: newType,
            table_id: newTableId,
            table_name: tbl ? tbl.name : newType === 'takeaway' ? 'Takeaway' : 'Meja',
            order_no: 'Order baru',
            guests: tbl ? tbl.seats : 1,
            items: [],
          });
        }
      } catch (err) {
        toast.error(apiError(err, 'Gagal memuat data'));
      }
    })();
    loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const filtered = useMemo(
    () =>
      menu.filter((m) => {
        const okCat = activeCat === 'all' || m.category_id === activeCat;
        const okSearch = !search || m.name.toLowerCase().includes(search.toLowerCase());
        return okCat && okSearch;
      }),
    [menu, activeCat, search]
  );

  function pickMenu(m) {
    if (!m.is_available) return toast.error(`${m.name} sedang habis`);
    if (m.modifier_groups && m.modifier_groups.length) {
      setModifierFor(m);
    } else {
      addDraft({ menu_item_id: m.id, qty: 1, notes: '', modifiers: [] }, m);
    }
  }

  function addDraft(entry, menuObj) {
    const price = (menuObj.price || 0) + (entry.modifiers || []).reduce((s, x) => s + x.price, 0);
    setDraft((d) => [...d, { ...entry, name: menuObj.name, price, key: Math.random().toString(36).slice(2) }]);
  }

  function draftInc(k, delta) {
    setDraft((d) =>
      d.flatMap((i) =>
        i.key === k ? (i.qty + delta <= 0 ? [] : [{ ...i, qty: i.qty + delta }]) : [i]
      )
    );
  }

  const draftTotal = draft.reduce((s, i) => s + i.price * i.qty, 0);

  async function sendToKitchen() {
    if (draft.length === 0) return;
    setSending(true);
    const payloadItems = draft.map((i) => ({
      menu_item_id: i.menu_item_id,
      qty: i.qty,
      notes: i.notes,
      modifiers: i.modifiers,
    }));
    try {
      if (isNew) {
        // Order + nomor ORD baru dibuat SEKARANG, tepat saat item pertama dikirim.
        const { data } = await api.post('/orders', {
          type: newType,
          table_id: newType === 'dine-in' ? newTableId : null,
          items: payloadItems,
        });
        setDraft([]);
        toast.success('Pesanan dikirim ke dapur');
        nav('/order/' + data.id, { replace: true });
        return;
      }
      const { data } = await api.post('/orders/' + id + '/items', { items: payloadItems });
      setOrder(data);
      setDraft([]);
      toast.success('Pesanan dikirim ke dapur');
    } catch (err) {
      toast.error(apiError(err, 'Gagal mengirim pesanan'));
    } finally {
      setSending(false);
    }
  }

  async function moveTable(targetId) {
    try {
      const { data } = await api.post('/orders/' + id + '/move', { table_id: targetId });
      setOrder(data);
      setMoveOpen(false);
      toast.success('Pindah ke ' + data.table_name);
    } catch (err) {
      toast.error(apiError(err, 'Gagal pindah meja'));
    }
  }

  async function removeSent(itemId) {
    if (!confirm('Batalkan item ini?')) return;
    try {
      const { data } = await api.delete('/orders/' + id + '/items/' + itemId);
      setOrder(data);
    } catch (err) {
      toast.error(apiError(err, 'Gagal membatalkan item'));
    }
  }

  async function handlePay(payload) {
    setPaying(true);
    try {
      const { data } = await api.post('/orders/' + id + '/pay', payload);
      setPayOpen(false);
      setReceipt(data.transaction);
      if (data.fully_paid) {
        toast.success('Pembayaran lunas! Meja dikosongkan.');
      } else {
        toast.success('Pembayaran sebagian tersimpan.');
        loadOrder();
      }
    } catch (err) {
      toast.error(apiError(err, 'Gagal memproses pembayaran'));
    } finally {
      setPaying(false);
    }
  }

  async function voidOrder() {
    if (!confirm('Batalkan seluruh order ini?')) return;
    try {
      await api.post('/orders/' + id + '/void');
      toast.success('Order dibatalkan');
      nav('/tables');
    } catch (err) {
      toast.error(apiError(err, 'Gagal membatalkan order'));
    }
  }

  function closeReceipt() {
    setReceipt(null);
    loadOrder().then(() => {
      // kalau sudah lunas penuh, balik ke daftar meja
    });
  }

  if (!order) return <div className="p-6 text-slate-400">Memuat order...</div>;

  const sentItems = order.items.filter((i) => i.status === 'active');
  const unpaid = sentItems.filter((i) => !i.paid);
  const sentTotal = unpaid.reduce((s, i) => s + i.price * i.qty, 0);
  const isClosed = order.status !== 'open';

  return (
    <div className="flex h-full">
      {/* Menu */}
      <div className="flex flex-1 flex-col overflow-hidden p-6">
        <button
          onClick={() => nav('/tables')}
          className="mb-2 flex items-center gap-1 text-sm text-slate-500 hover:text-brand"
        >
          <ArrowLeft size={16} /> Kembali ke meja
        </button>
        <h1 className="text-2xl font-bold">
          {order.table_name || 'Takeaway'}{' '}
          <span className="text-base font-normal text-slate-400">· {order.order_no}</span>
        </h1>
        <p className="mb-4 text-sm text-slate-400">
          {order.type === 'dine-in' ? `${order.guests} tamu` : 'Bawa pulang'}
        </p>

        {!isNew && !isClosed && order.type === 'dine-in' && (
          <button
            onClick={() => setMoveOpen(true)}
            className="mb-4 flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-brand hover:text-brand"
          >
            <ArrowRightLeft size={15} /> Pindah meja
          </button>
        )}

        <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2">
          <Search size={18} className="text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari menu..."
            className="w-full bg-transparent outline-none"
          />
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCat('all')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              activeCat === 'all' ? 'bg-brand text-white' : 'bg-white text-slate-600'
            }`}
          >
            Semua
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                activeCat === c.id ? 'bg-brand text-white' : 'bg-white text-slate-600'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => pickMenu(m)}
                disabled={isClosed}
                className={`rounded-2xl border bg-white p-4 text-left transition hover:border-brand disabled:opacity-50 ${
                  m.is_available ? 'border-slate-200' : 'border-slate-200 opacity-50'
                }`}
              >
                <div className="mb-3 flex h-14 items-center justify-center rounded-xl bg-brand-50 text-xl font-bold text-brand-600">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold">{m.name}</div>
                <div className="mt-1 font-bold text-brand-600 tabular-nums">{rupiah(m.price)}</div>
                {m.modifier_groups?.length > 0 && (
                  <div className="text-xs text-slate-400">bisa kustom</div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Order panel */}
      <div className="flex w-80 flex-col border-l border-slate-200 bg-white xl:w-96">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <h2 className="font-bold">Pesanan</h2>
          {canVoid && !isClosed && unpaid.every((i) => !i.paid) && sentItems.every((i) => !i.paid) && (
            <button
              onClick={voidOrder}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
            >
              <Ban size={13} /> Batalkan
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {/* Sudah dikirim */}
          {sentItems.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Sudah dikirim
              </div>
              {sentItems.map((it) => {
                const badge = STATUS_BADGE[it.kitchen_status] || STATUS_BADGE.pending;
                return (
                  <div key={it.id} className="mb-2 rounded-xl border border-slate-100 p-2.5">
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-medium">
                        {it.qty}x {it.name}
                      </span>
                      <span className="tabular-nums text-sm font-semibold">
                        {rupiah(it.price * it.qty)}
                      </span>
                    </div>
                    {it.modifiers?.length > 0 && (
                      <div className="text-xs text-slate-400">
                        {it.modifiers.map((m) => m.name).join(', ')}
                      </div>
                    )}
                    {it.notes && <div className="text-xs italic text-slate-400">Catatan: {it.notes}</div>}
                    <div className="mt-1 flex items-center justify-between">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${badge.cls}`}>
                        {badge.label}
                      </span>
                      {it.paid ? (
                        <span className="text-xs font-medium text-emerald-600">Lunas</span>
                      ) : (
                        !isClosed && (
                          <button
                            onClick={() => removeSent(it.id)}
                            className="text-slate-300 hover:text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Draft baru */}
          {draft.length > 0 && (
            <div>
              <div className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-brand-600">
                Baru (belum dikirim)
              </div>
              {draft.map((it) => (
                <div key={it.key} className="mb-2 rounded-xl border border-brand-200 bg-brand-50 p-2.5">
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-medium">{it.name}</span>
                    <span className="tabular-nums text-sm font-semibold">
                      {rupiah(it.price * it.qty)}
                    </span>
                  </div>
                  {it.modifiers?.length > 0 && (
                    <div className="text-xs text-slate-500">
                      {it.modifiers.map((m) => m.name).join(', ')}
                    </div>
                  )}
                  {it.notes && <div className="text-xs italic text-slate-500">Catatan: {it.notes}</div>}
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      onClick={() => draftInc(it.key, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-white"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums">{it.qty}</span>
                    <button
                      onClick={() => draftInc(it.key, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-white"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {sentItems.length === 0 && draft.length === 0 && (
            <div className="mt-12 text-center text-sm text-slate-400">
              Belum ada pesanan.
              <br />
              Tap menu untuk menambahkan.
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-slate-200 p-4">
          {draft.length > 0 && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Item baru</span>
                <span className="tabular-nums">{rupiah(draftTotal)}</span>
              </div>
              <button
                onClick={sendToKitchen}
                disabled={sending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 py-3 font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
              >
                <Send size={17} /> {sending ? 'Mengirim...' : 'Kirim ke Dapur'}
              </button>
            </>
          )}
          <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-2">
            <span className="font-bold">Belum dibayar</span>
            <span className="text-xl font-bold text-brand-600 tabular-nums">{rupiah(sentTotal)}</span>
          </div>
          <button
            onClick={() => setPayOpen(true)}
            disabled={unpaid.length === 0 || isClosed}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
          >
            <CreditCard size={18} /> Bayar
          </button>
        </div>
      </div>

      {modifierFor && (
        <ModifierModal
          menu={modifierFor}
          onClose={() => setModifierFor(null)}
          onConfirm={(entry) => {
            addDraft(entry, modifierFor);
            setModifierFor(null);
          }}
        />
      )}

      {moveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Pindah meja</h2>
              <button onClick={() => setMoveOpen(false)} className="rounded-lg p-1 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <p className="mb-3 text-sm text-slate-500">Pilih meja kosong tujuan.</p>
            <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto">
              {tables
                .filter((t) => !t.order && t.id !== order.table_id)
                .map((t) => (
                  <button
                    key={t.id}
                    onClick={() => moveTable(t.id)}
                    className="rounded-xl border border-slate-200 p-3 text-center hover:border-brand hover:bg-brand-50"
                  >
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-slate-400">{t.area}</div>
                  </button>
                ))}
            </div>
            {tables.filter((t) => !t.order && t.id !== order.table_id).length === 0 && (
              <div className="py-6 text-center text-sm text-slate-400">Tidak ada meja kosong.</div>
            )}
          </div>
        </div>
      )}

      {payOpen && (
        <PayOrderModal
          order={order}
          loading={paying}
          loyalty={settings?.loyalty}
          onClose={() => setPayOpen(false)}
          onConfirm={handlePay}
        />
      )}

      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-4">
            <div className="mb-2 flex items-center justify-between no-print">
              <h2 className="text-lg font-bold">Struk</h2>
              <button onClick={closeReceipt} className="rounded-lg p-1 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="rounded-xl border border-slate-200">
              <Receipt tx={receipt} settings={settings} />
            </div>
            <div className="mt-4 flex gap-2 no-print">
              <button
                onClick={closeReceipt}
                className="flex-1 rounded-xl bg-slate-100 py-3 font-medium text-slate-600 hover:bg-slate-200"
              >
                Selesai
              </button>
              <button
                onClick={() => window.print()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-600"
              >
                <Printer size={18} /> Cetak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
