const repo = require('../repo');
const { HttpError, uid } = require('../utils');

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Hitung HPP (cost) sebuah menu dari resep + harga bahan.
function computeCost(recipesInput, ingredients) {
  return Math.round(
    (recipesInput || []).reduce((s, r) => {
      const ing = ingredients.find((i) => i.id === r.ingredient_id);
      return s + (ing ? ing.cost_avg * (Number(r.qty) || 0) : 0);
    }, 0)
  );
}

async function setRecipes(menuItemId, recipesInput, client) {
  await repo.recipes.deleteWhere('menu_item_id = $1', [menuItemId], client);
  for (const r of recipesInput || []) {
    if (!r.ingredient_id || !r.qty) continue;
    await repo.recipes.insert(
      { id: uid('rcp'), menu_item_id: menuItemId, ingredient_id: r.ingredient_id, qty: Number(r.qty) },
      client
    );
  }
}

module.exports = [
  {
    method: 'GET',
    path: '/api/categories',
    auth: true,
    handler: async () =>
      (await repo.categories.all()).sort((a, b) => (a.sort || 0) - (b.sort || 0)),
  },
  {
    method: 'POST',
    path: '/api/categories',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ body }) => {
      if (!body.name) throw new HttpError(400, 'Nama kategori wajib diisi.');
      const all = await repo.categories.all();
      const cat = {
        id: uid('cat'),
        name: String(body.name).trim(),
        outlet_id: null,
        sort: Number(body.sort) || all.length + 1,
      };
      await repo.categories.insert(cat);
      return cat;
    },
  },
  {
    method: 'PUT',
    path: '/api/categories/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params, body }) => {
      const cat = await repo.categories.find(params.id);
      if (!cat) throw new HttpError(404, 'Kategori tidak ditemukan.');
      if (body.name != null) cat.name = String(body.name).trim();
      if (body.sort != null) cat.sort = Number(body.sort) || 0;
      await repo.categories.update(cat);
      return cat;
    },
  },
  {
    method: 'DELETE',
    path: '/api/categories/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params }) => {
      const cat = await repo.categories.find(params.id);
      if (!cat) throw new HttpError(404, 'Kategori tidak ditemukan.');
      const used = await repo.menuItems.where('category_id = $1', [params.id]);
      if (used.length) throw new HttpError(400, 'Kategori masih dipakai menu.');
      await repo.categories.remove(params.id);
      return { ok: true };
    },
  },
  {
    method: 'GET',
    path: '/api/menu',
    auth: true,
    handler: async ({ query }) => {
      let items = await repo.menuItems.all();
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
      const item = await repo.menuItems.find(params.id);
      if (!item) throw new HttpError(404, 'Menu tidak ditemukan.');
      const recipes = await repo.recipes.where('menu_item_id = $1', [item.id]);
      return { ...item, recipes };
    },
  },
  {
    method: 'POST',
    path: '/api/menu',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ body }) => {
      if (!body.name) throw new HttpError(400, 'Nama menu wajib diisi.');
      return repo.tx(async (client) => {
        const ingredients = await repo.ingredients.all(client);
        const recipesInput = body.recipes || [];
        const cost = body.cost != null ? Number(body.cost) : computeCost(recipesInput, ingredients);
        const count = (await repo.menuItems.all(client)).length;
        const n = count + 1;
        const id = uid('menu');
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
          station: body.station || null,
          modifier_groups: Array.isArray(body.modifier_groups) ? body.modifier_groups : [],
        };
        await repo.menuItems.insert(item, client);
        await setRecipes(id, recipesInput, client);
        const recipes = await repo.recipes.where('menu_item_id = $1', [id], client);
        return { ...item, recipes };
      });
    },
  },
  {
    method: 'PUT',
    path: '/api/menu/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params, body }) => {
      return repo.tx(async (client) => {
        const item = await repo.menuItems.find(params.id, client);
        if (!item) throw new HttpError(404, 'Menu tidak ditemukan.');
        if (body.name != null) item.name = body.name;
        if (body.category_id !== undefined) item.category_id = body.category_id;
        if (body.price != null) item.price = Number(body.price);
        if (body.is_available != null) item.is_available = !!body.is_available;
        if (body.sku != null) item.sku = body.sku;
        if (body.station !== undefined) item.station = body.station;
        if (Array.isArray(body.modifier_groups)) item.modifier_groups = body.modifier_groups;
        if (body.recipes) {
          await setRecipes(item.id, body.recipes, client);
          const ingredients = await repo.ingredients.all(client);
          item.cost = body.cost != null ? Number(body.cost) : computeCost(body.recipes, ingredients);
        } else if (body.cost != null) {
          item.cost = Number(body.cost);
        }
        await repo.menuItems.update(item, client);
        const recipes = await repo.recipes.where('menu_item_id = $1', [item.id], client);
        return { ...item, recipes };
      });
    },
  },
  {
    method: 'PATCH',
    path: '/api/menu/:id/availability',
    auth: true,
    handler: async ({ params, body }) => {
      const item = await repo.menuItems.find(params.id);
      if (!item) throw new HttpError(404, 'Menu tidak ditemukan.');
      item.is_available = !!body.is_available;
      await repo.menuItems.update(item);
      return item;
    },
  },
  {
    method: 'DELETE',
    path: '/api/menu/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params }) => {
      return repo.tx(async (client) => {
        const item = await repo.menuItems.find(params.id, client);
        if (!item) throw new HttpError(404, 'Menu tidak ditemukan.');
        await repo.menuItems.remove(params.id, client);
        await repo.recipes.deleteWhere('menu_item_id = $1', [params.id], client);
        return { ok: true };
      });
    },
  },
  {
    method: 'GET',
    path: '/api/ingredients',
    auth: true,
    handler: async () => repo.ingredients.all(),
  },
  {
    method: 'POST',
    path: '/api/ingredients/:id/adjust',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params, body, user }) => {
      return repo.tx(async (client) => {
        const ing = await repo.ingredients.find(params.id, client);
        if (!ing) throw new HttpError(404, 'Bahan tidak ditemukan.');
        const delta = Number(body.delta) || 0;
        ing.stock = round2((ing.stock || 0) + delta);
        await repo.ingredients.update(ing, client);
        await repo.stockMovements.insert(
          {
            id: uid('mov'),
            ingredient_id: ing.id,
            type: body.type || 'adjust',
            qty: round2(delta),
            ref: body.note || 'manual',
            user_id: user.id,
            created_at: new Date().toISOString(),
          },
          client
        );
        return ing;
      });
    },
  },
  {
    method: 'POST',
    path: '/api/ingredients',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ body }) => {
      if (!body.name) throw new HttpError(400, 'Nama bahan wajib diisi.');
      const ing = {
        id: uid('ing'),
        name: String(body.name).trim(),
        unit: body.unit || 'pcs',
        cost_avg: Math.max(0, Number(body.cost_avg) || 0),
        stock: Math.max(0, Number(body.stock) || 0),
        min_stock: Math.max(0, Number(body.min_stock) || 0),
      };
      await repo.ingredients.insert(ing);
      return ing;
    },
  },
  {
    method: 'PUT',
    path: '/api/ingredients/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params, body }) => {
      const ing = await repo.ingredients.find(params.id);
      if (!ing) throw new HttpError(404, 'Bahan tidak ditemukan.');
      if (body.name != null) ing.name = String(body.name).trim();
      if (body.unit != null) ing.unit = body.unit;
      if (body.cost_avg != null) ing.cost_avg = Math.max(0, Number(body.cost_avg) || 0);
      if (body.stock != null) ing.stock = Math.max(0, Number(body.stock) || 0);
      if (body.min_stock != null) ing.min_stock = Math.max(0, Number(body.min_stock) || 0);
      await repo.ingredients.update(ing);
      return ing;
    },
  },
  {
    method: 'DELETE',
    path: '/api/ingredients/:id',
    auth: true,
    roles: ['owner', 'manager'],
    handler: async ({ params }) => {
      const ing = await repo.ingredients.find(params.id);
      if (!ing) throw new HttpError(404, 'Bahan tidak ditemukan.');
      const used = await repo.recipes.where('ingredient_id = $1', [params.id]);
      if (used.length) throw new HttpError(400, 'Bahan masih dipakai di resep menu.');
      await repo.ingredients.remove(params.id);
      return { ok: true };
    },
  },
];
