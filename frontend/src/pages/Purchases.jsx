import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, X, PackageCheck, Trash2, ShoppingBasket, Check } from 'lucide-react';
import { api, apiError } from '../api/client';
import { rupiah, formatDateTime } from '../lib/format';

export default function Purchases() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [note, setNote] = useState('');
  const [rows, setRows] = useState([]); // {ingredient_id, qty, unit_cost}

  async function load() {
    try {
      const [po, sup, ing] = await Promise.all([
        api.get('/purchase-orders'),
        api.get('/suppliers'),
        api.get('/ingredients'),
      ]);
      setOrders(po.data);
      setSuppliers(sup.data);
      setIngredients(ing.data);
    } catch (err) {
      toast.error(apiError(err, 'Gagal memuat data'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startCreate() {
    setSupplierId(suppliers[0]?.id || '');
    setNote('');
    setRows([{ ingredient_id: ingredients[0]?.id || '', qty: '', unit_cost: '' }]);
    setCreating(true);
  }

  function setRow(idx, patch) {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }
  function addRow() {
    setRows((r) => [...r, { ingredient_id: ingredients[0]?.id || '', qty: '', unit_cost: '' }]);
  }
  function removeRow(idx) {
    setRows((r) => r.filter((_, i) => i !== idx));
  }

  const total = rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.unit_cost) || 0), 0);

  async function save() {
    const items = rows
      .filter((r) => r.ingredient_id && Number(r.qty) > 0)
      .map((r) => ({ ingredient_id: r.ingredient_id, qty: Number(r.qty), unit_cost: Number(r.unit_cost) || 0 }));
    if (!supplierId) return toast.error('Pilih supplier');
    if (items.length === 0) return toast.error('Isi minimal 1 item dengan qty');
    setBusy(true);
    try {
      await api.post('/purchase-orders', { supplier_id: supplierId, note, items });
      toast.success('PO dibuat (draft)');
      setCreating(false);
      load();
    } catch (err) {
      toast.error(apiError(err, 'Gagal membuat PO'));
    } finally {
      setBusy(false);
    }
  }

  async function receive(po) {
    if (!confirm(`Terima barang PO ${po.po_no}? Stok bahan akan bertambah.`)) return;
    try {
      await api.post('/purchase-orders/' + po.id + '/receive');
      toast.success('Barang diterima, stok diperbarui');
      load();
    } catch (err) {
      toast.error(apiError(err, 'Gagal menerima PO'));
    }
  }

  async function remove(po) {
    if (!confirm(`Hapus PO ${po.po_no}?`)) return;
    try {
      await api.delete('/purchase-orders/' + po.id);
      toast.success('PO dihapus');
      load();
    } catch (err) {
      toast.error(apiError(err, 'Gagal menghapus PO'));
    }
  }

  function ingName(id) {
    return ingredients.find((i) => i.id === id)?.name || '?';
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ShoppingBasket size={24} /> Pembelian / PO
          </h1>
          <p className="text-sm text-slate-400">Buat purchase order & terima stok dari supplier</p>
        </div>
        <button
          onClick={startCreate}
          className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-600"
        >
          <Plus size={18} /> PO Baru
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">Memuat...</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada purchase order.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((po) => (
            <div key={po.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{po.po_no}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        po.status === 'received'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {po.status === 'received' ? 'Diterima' : 'Draft'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {po.supplier_name} · {formatDateTime(po.created_at)}
                    {po.received_at ? ` · diterima ${formatDateTime(po.received_at)}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-brand-600 tabular-nums">{rupiah(po.total)}</span>
                  {po.status === 'draft' && (
                    <>
                      <button
                        onClick={() => receive(po)}
                        className="flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
                      >
                        <PackageCheck size={16} /> Terima
                      </button>
                      <button
                        onClick={() => remove(po)}
                        className="rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-3 border-t border-slate-100 pt-2">
                {po.items.map((it, i) => (
                  <div key={i} className="flex justify-between py-0.5 text-sm">
                    <span className="text-slate-600">
                      {ingName(it.ingredient_id)} - {it.qty} {it.unit} × {rupiah(it.unit_cost)}
                    </span>
                    <span className="tabular-nums">{rupiah(it.subtotal)}</span>
                  </div>
                ))}
                {po.note && <div className="mt-1 text-xs italic text-slate-400">{po.note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h2 className="text-lg font-bold">Purchase Order Baru</h2>
              <button onClick={() => setCreating(false)} className="rounded-lg p-1 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Supplier</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-600">Item</label>
                  <button onClick={addRow} className="flex items-center gap-1 text-sm font-medium text-brand-600">
                    <Plus size={14} /> Tambah baris
                  </button>
                </div>
                <div className="space-y-2">
                  {rows.map((row, idx) => {
                    const ing = ingredients.find((i) => i.id === row.ingredient_id);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          value={row.ingredient_id}
                          onChange={(e) => setRow(idx, { ingredient_id: e.target.value })}
                          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
                        >
                          {ingredients.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} ({i.unit})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={row.qty}
                          onChange={(e) => setRow(idx, { qty: e.target.value })}
                          placeholder="Qty"
                          className="w-20 rounded-xl border border-slate-200 px-2 py-2 text-right text-sm tabular-nums outline-none focus:border-brand"
                        />
                        <input
                          type="number"
                          value={row.unit_cost}
                          onChange={(e) => setRow(idx, { unit_cost: e.target.value })}
                          placeholder="Harga/unit"
                          className="w-28 rounded-xl border border-slate-200 px-2 py-2 text-right text-sm tabular-nums outline-none focus:border-brand"
                        />
                        <button onClick={() => removeRow(idx)} className="rounded-lg p-2 text-slate-300 hover:text-red-500">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Catatan (opsional)"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand"
              />
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 p-5">
              <div className="text-sm text-slate-500">
                Total: <span className="text-lg font-bold text-brand-600 tabular-nums">{rupiah(total)}</span>
              </div>
              <button
                onClick={save}
                disabled={busy}
                className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
              >
                <Check size={17} /> Buat PO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
