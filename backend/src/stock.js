// Pengurangan/penambahan stok bahan berdasarkan resep (BOM) sebuah menu.
// Bekerja pada map yang sudah dimuat lebih dulu supaya bisa dijalankan
// dalam satu transaksi DB tanpa query berulang.
const { uid } = require('./utils');

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ctx = { allRecipes, ingById, movements, touched }
function applyStock(menuItemId, qty, sign, ref, userId, ctx) {
  const rs = ctx.allRecipes.filter((r) => r.menu_item_id === menuItemId);
  for (const r of rs) {
    const ing = ctx.ingById[r.ingredient_id];
    if (!ing) continue;
    const delta = sign * r.qty * qty;
    ing.stock = round2((ing.stock || 0) + delta);
    ctx.touched.add(ing.id);
    ctx.movements.push({
      id: uid('mov'),
      ingredient_id: ing.id,
      type: sign < 0 ? 'sale' : 'void',
      qty: round2(delta),
      ref,
      user_id: userId || null,
      created_at: new Date().toISOString(),
    });
  }
}

module.exports = { applyStock, round2 };
