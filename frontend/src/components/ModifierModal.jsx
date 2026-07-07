import { useState, useMemo } from 'react';
import { X, Minus, Plus } from 'lucide-react';
import { rupiah } from '../lib/format';

export default function ModifierModal({ menu, onClose, onConfirm }) {
  const groups = menu.modifier_groups || [];
  const [selected, setSelected] = useState({}); // groupId -> optionId | optionId[]
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');

  function pickSingle(g, opt) {
    setSelected((s) => ({ ...s, [g.id]: opt.id }));
  }
  function toggleMulti(g, opt) {
    setSelected((s) => {
      const cur = Array.isArray(s[g.id]) ? s[g.id] : [];
      const next = cur.includes(opt.id) ? cur.filter((x) => x !== opt.id) : [...cur, opt.id];
      return { ...s, [g.id]: next };
    });
  }
  function isPicked(g, opt) {
    const v = selected[g.id];
    return Array.isArray(v) ? v.includes(opt.id) : v === opt.id;
  }

  const chosen = useMemo(() => {
    const list = [];
    for (const g of groups) {
      const v = selected[g.id];
      const ids = Array.isArray(v) ? v : v ? [v] : [];
      for (const id of ids) {
        const opt = g.options.find((o) => o.id === id);
        if (opt) list.push({ group_name: g.name, name: opt.name, price: opt.price });
      }
    }
    return list;
  }, [selected, groups]);

  const unitPrice = menu.price + chosen.reduce((s, m) => s + m.price, 0);
  const missingRequired = groups.filter((g) => g.required && !selected[g.id]);

  function confirm() {
    if (missingRequired.length) return;
    onConfirm({ menu_item_id: menu.id, qty, notes, modifiers: chosen });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-3xl bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h2 className="text-lg font-bold">{menu.name}</h2>
            <p className="text-sm text-brand-600">{rupiah(menu.price)}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {groups.map((g) => (
            <div key={g.id}>
              <div className="mb-2 flex items-center gap-2">
                <span className="font-semibold">{g.name}</span>
                {g.required ? (
                  <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-500">wajib</span>
                ) : (
                  <span className="text-xs text-slate-400">opsional</span>
                )}
              </div>
              <div className="space-y-2">
                {g.options.map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5 ${
                      isPicked(g, opt) ? 'border-brand bg-brand-50' : 'border-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type={g.multiple ? 'checkbox' : 'radio'}
                        checked={isPicked(g, opt)}
                        onChange={() => (g.multiple ? toggleMulti(g, opt) : pickSingle(g, opt))}
                        className="accent-brand"
                      />
                      {opt.name}
                    </span>
                    {opt.price > 0 && (
                      <span className="text-sm text-slate-500 tabular-nums">+{rupiah(opt.price)}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Catatan</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="mis. tanpa bawang"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
        </div>

        <div className="border-t border-slate-100 p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-slate-500">Jumlah</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200"
              >
                <Minus size={16} />
              </button>
              <span className="w-6 text-center font-semibold tabular-nums">{qty}</span>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <button
            onClick={confirm}
            disabled={missingRequired.length > 0}
            className="w-full rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {missingRequired.length
              ? `Pilih dulu: ${missingRequired.map((g) => g.name).join(', ')}`
              : `Tambah • ${rupiah(unitPrice * qty)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
