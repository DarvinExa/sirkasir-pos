import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { api, apiError } from '../api/client';
import { rupiah } from '../lib/format';

const empty = { name: '', category_id: '', price: 0, is_available: true, recipes: [] };

export default function MenuManager() {
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [items, cats, ing] = await Promise.all([
        api.get('/menu'),
        api.get('/categories'),
        api.get('/ingredients'),
      ]);
      setMenu(items.data);
      setCategories(cats.data);
      setIngredients(ing.data);
    } catch (err) {
      toast.error(apiError(err, 'Gagal memuat menu'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function catName(id) {
    return categories.find((c) => c.id === id)?.name || '-';
  }

  function ingById(id) {
    return ingredients.find((i) => i.id === id);
  }

  // HPP terhitung dari resep yang sedang diedit
  function computedCost(recipes) {
    return Math.round(
      (recipes || []).reduce((s, r) => {
        const ing = ingById(r.ingredient_id);
        return s + (ing ? ing.cost_avg * (Number(r.qty) || 0) : 0);
      }, 0)
    );
  }

  async function toggle(item) {
    try {
      await api.patch(`/menu/${item.id}/availability`, { is_available: !item.is_available });
      setMenu((m) => m.map((x) => (x.id === item.id ? { ...x, is_available: !x.is_available } : x)));
    } catch (err) {
      toast.error(apiError(err, 'Gagal mengubah status'));
    }
  }

  async function openNew() {
    setEditing({ ...empty, category_id: categories[0]?.id || '', recipes: [] });
  }

  async function openEdit(item) {
    try {
      const { data } = await api.get(`/menu/${item.id}`);
      setEditing({
        ...data,
        recipes: (data.recipes || []).map((r) => ({ ingredient_id: r.ingredient_id, qty: r.qty })),
      });
    } catch (err) {
      toast.error(apiError(err, 'Gagal memuat detail menu'));
    }
  }

  function addRecipeRow() {
    setEditing((e) => ({
      ...e,
      recipes: [...(e.recipes || []), { ingredient_id: ingredients[0]?.id || '', qty: '' }],
    }));
  }
  function setRecipeRow(idx, patch) {
    setEditing((e) => ({
      ...e,
      recipes: e.recipes.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));
  }
  function removeRecipeRow(idx) {
    setEditing((e) => ({ ...e, recipes: e.recipes.filter((_, i) => i !== idx) }));
  }

  async function save() {
    if (!editing.name) return toast.error('Nama menu wajib diisi');
    setSaving(true);
    try {
      const recipes = (editing.recipes || [])
        .filter((r) => r.ingredient_id && Number(r.qty) > 0)
        .map((r) => ({ ingredient_id: r.ingredient_id, qty: Number(r.qty) }));
      const payload = {
        name: editing.name,
        category_id: editing.category_id,
        price: Number(editing.price),
        is_available: editing.is_available,
        recipes,
      };
      if (editing.id) {
        await api.put(`/menu/${editing.id}`, payload);
        toast.success('Menu diperbarui');
      } else {
        await api.post('/menu', payload);
        toast.success('Menu ditambahkan');
      }
      setEditing(null);
      load();
    } catch (err) {
      toast.error(apiError(err, 'Gagal menyimpan'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(item) {
    if (!confirm(`Hapus menu "${item.name}"?`)) return;
    try {
      await api.delete(`/menu/${item.id}`);
      toast.success('Menu dihapus');
      load();
    } catch (err) {
      toast.error(apiError(err, 'Gagal menghapus'));
    }
  }

  const editCost = editing ? computedCost(editing.recipes) : 0;
  const editMargin = editing ? Number(editing.price || 0) - editCost : 0;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kelola Menu</h1>
          <p className="text-sm text-slate-400">Tambah menu, atur resep/HPP, harga, & ketersediaan</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-600"
        >
          <Plus size={18} /> Menu Baru
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">Memuat...</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3 text-right">Harga</th>
                <th className="px-4 py-3 text-right">HPP</th>
                <th className="px-4 py-3 text-right">Margin</th>
                <th className="px-4 py-3 text-center">Tersedia</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {menu.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3 text-slate-500">{catName(m.category_id)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{rupiah(m.price)}</td>
                  <td className="px-4 py-3 text-right text-slate-500 tabular-nums">{rupiah(m.cost)}</td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-600 tabular-nums">
                    {rupiah(m.price - m.cost)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggle(m)}
                      className={`relative h-6 w-11 rounded-full transition ${
                        m.is_available ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                          m.is_available ? 'left-[22px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(m)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => remove(m)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-3xl bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h2 className="text-lg font-bold">{editing.id ? 'Edit Menu' : 'Menu Baru'}</h2>
              <button onClick={() => setEditing(null)} className="rounded-lg p-1 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Nama menu</label>
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">Kategori</label>
                  <select
                    value={editing.category_id}
                    onChange={(e) => setEditing({ ...editing, category_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-brand"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600">Harga jual</label>
                  <input
                    type="number"
                    value={editing.price}
                    onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 tabular-nums outline-none focus:border-brand"
                  />
                </div>
              </div>

              {/* Resep / BOM */}
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">Resep (BOM)</span>
                  <button onClick={addRecipeRow} className="flex items-center gap-1 text-sm font-medium text-brand-600">
                    <Plus size={14} /> Tambah bahan
                  </button>
                </div>
                {(!editing.recipes || editing.recipes.length === 0) && (
                  <p className="py-2 text-xs text-slate-400">Belum ada bahan. HPP akan 0.</p>
                )}
                <div className="space-y-2">
                  {(editing.recipes || []).map((r, idx) => {
                    const ing = ingById(r.ingredient_id);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          value={r.ingredient_id}
                          onChange={(e) => setRecipeRow(idx, { ingredient_id: e.target.value })}
                          className="flex-1 rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-brand"
                        >
                          {ingredients.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} ({i.unit})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={r.qty}
                          onChange={(e) => setRecipeRow(idx, { qty: e.target.value })}
                          placeholder="Qty"
                          className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-right text-sm tabular-nums outline-none focus:border-brand"
                        />
                        <span className="w-20 text-right text-xs text-slate-400 tabular-nums">
                          {ing ? rupiah(Math.round(ing.cost_avg * (Number(r.qty) || 0))) : '-'}
                        </span>
                        <button onClick={() => removeRecipeRow(idx)} className="rounded-lg p-1.5 text-slate-300 hover:text-red-500">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex justify-between border-t border-slate-200 pt-2 text-sm">
                  <span className="text-slate-500">HPP terhitung</span>
                  <span className="font-semibold tabular-nums">{rupiah(editCost)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Margin</span>
                  <span className={`font-semibold tabular-nums ${editMargin < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {rupiah(editMargin)}
                  </span>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={editing.is_available}
                  onChange={(e) => setEditing({ ...editing, is_available: e.target.checked })}
                  className="accent-brand"
                />
                Tersedia untuk dijual
              </label>
            </div>

            <div className="flex gap-2 border-t border-slate-100 p-5">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-xl bg-slate-100 py-3 font-medium text-slate-600 hover:bg-slate-200">
                Batal
              </button>
              <button onClick={save} disabled={saving} className="flex-1 rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
