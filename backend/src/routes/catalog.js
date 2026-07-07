const db = require('../db');
const { HttpError, uid } = require('../utils');

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Hitung HPP (cost) sebuah menu dari resep + harga bahan.
function computeCost(d, recipes) {
  return Math.round(
    (recipes || []).reduce((s, r) => {
      const ing = d.ingredients.find((i) => i.id === r.ingredient_id);
      return s + (ing ? ing.cost_avg * (Number(r.qty) || 0) : 0);
    }, 0)
  );
}

function setRecipes(d, menuItemId, recipes) {
  d.recipes = d.recipes.filter((r) => r.menu_item_id !== menuItemId);
  for (const r of recipes || []) {
    if (!r.ingredient_id || !r.qty) continue;
    d.recipes.push({
      id: uid('rcp'),
      menu_item_id: menuItemId,
      ingredient_id: r.ingredient_id,
      qty: Number(r.qty),
    });
  }
}

module.exports = [
  {
    method: 'GET',
    path: '/api/categories',
    auth: true,
    handler: async () => db.get().categories.slice().sort((a, b) => (a.sort || 0) - (b.sort || 0)),
  },
  {
    method: 'POST',
    path: '/api/categories',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ body }) => {
      const d = db.get();
      if (!body.name) throw new HttpError(400, 'Nama kategori wajib diisi.');
      const cat = {
        id: uid('cat'),
        name: String(body.name).trim(),
        outlet_id: null,
        sort: Number(body.sort) || d.categories.length + 1,
      };
      d.categories.push(cat);
      db.save();
      return cat;
    },
  },
  {
    method: 'PUT',
    path: '/api/categories/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params, body }) => {
      const d = db.get();
      const cat = d.categories.find((c) => c.id === params.id);
      if (!cat) throw new HttpError(404, 'Kategori tidak ditemukan.');
      if (body.name != null) cat.name = String(body.name).trim();
      if (body.sort != null) cat.sort = Number(body.sort) || 0;
      db.save();
      return cat;
    },
  },
  {
    method: 'DELETE',
    path: '/api/categories/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params }) => {
      const d = db.get();
      const idx = d.categories.findIndex((c) => c.id === params.id);
      if (idx === -1) throw new HttpError(404, 'Kategori tidak ditemukan.');
      if ((d.menu_items || []).some((m) => m.category_id === params.id))
        throw new HttpError(400, 'Kategori masih dipakai menu.');
      d.categories.splice(idx, 1);
      db.save();
      return { ok: true };
    },
  },
  {
    method: 'GET',
    path: '/api/menu',
    auth: true,
    handler: async ({ query }) => {
      let items = db.get().menu_items.slice();
      if (query.category) items = items.filter((m) => m.category_id === query.category);
      if (query.search) {
        const s = query.search.toLowerCase();
        items = items.filter(
          (m) => m.name.toLowerCase().includes(s) || (m.sku || '').toLowerCase().includes(s)
        );
      }
      return items;
    },
  },
  {
    method: 'GET',
    path: '/api/menu/:id',
    auth: true,
    handler: async ({ params }) => {
      const item = db.get().menu_items.find((m) => m.id === params.id);
      if (!item) throw new HttpError(404, 'Menu tidak ditemukan.');
      const recipes = db.get().recipes.filter((r) => r.menu_item_id === item.id);
      return { ...item, recipes };
    },
  },
  {
    method: 'POST',
    path: '/api/menu',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ body }) => {
      const d = db.get();
      if (!body.name) throw new HttpError(400, 'Nama menu wajib diisi.');
      const id = uid('menu');
      const recipes = body.recipes || [];
      const cost = body.cost != null ? Number(body.cost) : computeCost(d, recipes);
      const n = d.menu_items.length + 1;
      const item = {
        id,
        sku: body.sku || 'MNU-' + String(n).padStart(3, '0'),
        barcode: body.barcode || null,
        name: body.name,
        category_id: body.category_id || null,
        price: Number(body.price) || 0,
        cost,
        image: body.image || null,
        is_available: body.is_available !== false,
        type: 'single',
      };
      d.menu_items.push(item);
      setRecipes(d, id, recipes);
      db.save();
      return { ...item, recipes: d.recipes.filter((r) => r.menu_item_id === id) };
    },
  },
  {
    method: 'PUT',
    path: '/api/menu/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params, body }) => {
      const d = db.get();
      const item = d.menu_items.find((m) => m.id === params.id);
      if (!item) throw new HttpError(404, 'Menu tidak ditemukan.');
      if (body.name != null) item.name = body.name;
      if (body.category_id !== undefined) item.category_id = body.category_id;
      if (body.price != null) item.price = Number(body.price);
      if (body.is_available != null) item.is_available = !!body.is_available;
      if (body.sku != null) item.sku = body.sku;
      if (body.recipes) {
        setRecipes(d, item.id, body.recipes);
        item.cost = body.cost != null ? Number(body.cost) : computeCost(d, body.recipes);
      } else if (body.cost != null) {
        item.cost = Number(body.cost);
      }
      db.save();
      return { ...item, recipes: d.recipes.filter((r) => r.menu_item_id === item.id) };
    },
  },
  {
    method: 'PATCH',
    path: '/api/menu/:id/availability',
    auth: true,
    handler: async ({ params, body }) => {
      const d = db.get();
      const item = d.menu_items.find((m) => m.id === params.id);
      if (!item) throw new HttpError(404, 'Menu tidak ditemukan.');
      item.is_available = !!body.is_available;
      db.save();
      return item;
    },
  },
  {
    method: 'DELETE',
    path: '/api/menu/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params }) => {
      const d = db.get();
      const idx = d.menu_items.findIndex((m) => m.id === params.id);
      if (idx === -1) throw new HttpError(404, 'Menu tidak ditemukan.');
      d.menu_items.splice(idx, 1);
      d.recipes = d.recipes.filter((r) => r.menu_item_id !== params.id);
      db.save();
      return { ok: true };
    },
  },
  {
    method: 'GET',
    path: '/api/ingredients',
    auth: true,
    handler: async () => db.get().ingredients.slice(),
  },
  {
    method: 'POST',
    path: '/api/ingredients/:id/adjust',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params, body, user }) => {
      const d = db.get();
      const ing = d.ingredients.find((i) => i.id === params.id);
      if (!ing) throw new HttpError(404, 'Bahan tidak ditemukan.');
      const delta = Number(body.delta) || 0;
      ing.stock = round2((ing.stock || 0) + delta);
      d.stock_movements.push({
        id: uid('mov'),
        ingredient_id: ing.id,
        type: body.type || 'adjust',
        qty: round2(delta),
        ref: body.note || 'manual',
        user_id: user.id,
        created_at: new Date().toISOString(),
      });
      db.save();
      return ing;
    },
  },
  {
    method: 'POST',
    path: '/api/ingredients',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ body }) => {
      const d = db.get();
      if (!body.name) throw new HttpError(400, 'Nama bahan wajib diisi.');
      const ing = {
        id: uid('ing'),
        name: String(body.name).trim(),
        unit: body.unit || 'pcs',
        cost_avg: Math.max(0, Number(body.cost_avg) || 0),
        stock: Math.max(0, Number(body.stock) || 0),
        min_stock: Math.max(0, Number(body.min_stock) || 0),
      };
      d.ingredients.push(ing);
      db.save();
      return ing;
    },
  },
  {
    method: 'PUT',
    path: '/api/ingredients/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params, body }) => {
      const d = db.get();
      const ing = d.ingredients.find((i) => i.id === params.id);
      if (!ing) throw new HttpError(404, 'Bahan tidak ditemukan.');
      if (body.name != null) ing.name = String(body.name).trim();
      if (body.unit != null) ing.unit = body.unit;
      if (body.cost_avg != null) ing.cost_avg = Math.max(0, Number(body.cost_avg) || 0);
      if (body.stock != null) ing.stock = Math.max(0, Number(body.stock) || 0);
      if (body.min_stock != null) ing.min_stock = Math.max(0, Number(body.min_stock) || 0);
      db.save();
      return ing;
    },
  },
  {
    method: 'DELETE',
    path: '/api/ingredients/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params }) => {
      const d = db.get();
      const idx = d.ingredients.findIndex((i) => i.id === params.id);
      if (idx === -1) throw new HttpError(404, 'Bahan tidak ditemukan.');
      if ((d.recipes || []).some((r) => r.ingredient_id === params.id))
        throw new HttpError(400, 'Bahan masih dipakai di resep menu.');
      d.ingredients.splice(idx, 1);
      db.save();
      return { ok: true };
    },
  },
];
