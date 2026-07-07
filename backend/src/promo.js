// Mesin promo & diskon otomatis.
//
// Bentuk sebuah promo (disimpan di db.promos):
//   id, name, active
//   type: 'percent' | 'fixed' | 'bogo'
//   value            : persen (utk percent) atau nominal (utk fixed)
//   code             : '' => otomatis; terisi => voucher (harus dimasukkan kasir)
//   min_subtotal     : minimal belanja agar promo berlaku (0 = tanpa syarat)
//   max_discount     : batas maksimal potongan utk tipe percent (0 = tanpa batas)
//   member_only      : hanya berlaku bila transaksi tertaut member
//   days             : array hari [0..6] (0=Minggu). [] = semua hari
//   start_hour,end_hour : jam berlaku (0..24). null/keduanya sama = sepanjang hari
//   applies_to       : 'all' atau menu_item_id tertentu (dipakai tipe bogo)
//   buy_qty,get_qty  : utk bogo (beli buy_qty gratis get_qty)
//   stackable        : boleh digabung dgn promo stackable lain
//   priority         : urutan tampil (informasional)

function inWindow(promo, now) {
  const days = Array.isArray(promo.days) ? promo.days : [];
  if (days.length && !days.includes(now.getDay())) return false;
  const sh = promo.start_hour;
  const eh = promo.end_hour;
  if (sh == null || eh == null || Number(sh) === Number(eh)) return true; // sepanjang hari
  const h = now.getHours() + now.getMinutes() / 60;
  if (Number(sh) < Number(eh)) return h >= sh && h < eh;
  return h >= sh || h < eh; // window melewati tengah malam
}

function computeDiscount(promo, { items, subtotal }) {
  if (promo.type === 'percent') {
    let disc = Math.round((subtotal * (Number(promo.value) || 0)) / 100);
    const cap = Number(promo.max_discount) || 0;
    if (cap > 0) disc = Math.min(disc, cap);
    return disc;
  }
  if (promo.type === 'fixed') {
    return Math.min(Math.max(0, Number(promo.value) || 0), subtotal);
  }
  if (promo.type === 'bogo') {
    const buy = Math.max(1, Number(promo.buy_qty) || 1);
    const get = Math.max(1, Number(promo.get_qty) || 1);
    const pool = [];
    for (const it of items || []) {
      if (promo.applies_to && promo.applies_to !== 'all' && it.menu_item_id !== promo.applies_to) continue;
      const qty = Math.max(0, Number(it.qty) || 0);
      for (let k = 0; k < qty; k++) pool.push(Number(it.price) || 0);
    }
    pool.sort((a, b) => a - b); // yang termurah digratiskan
    const groupSize = buy + get;
    const groups = Math.floor(pool.length / groupSize);
    let disc = 0;
    for (let g = 0; g < groups; g++) {
      const start = g * groupSize;
      for (let f = 0; f < get; f++) disc += pool[start + f] || 0;
    }
    return disc;
  }
  return 0;
}

// Cek satu promo terhadap konteks transaksi (tanpa hitung stacking).
function match(promo, { items, subtotal, customer, now, code }) {
  if (promo.active === false) return null;
  if (promo.code && String(promo.code).trim()) {
    const given = String(code || '').trim().toLowerCase();
    if (!given || given !== String(promo.code).trim().toLowerCase()) return null;
  }
  if (promo.member_only && !customer) return null;
  if ((Number(promo.min_subtotal) || 0) > subtotal) return null;
  if (!inWindow(promo, now)) return null;
  const discount = computeDiscount(promo, { items, subtotal });
  if (discount <= 0) return null;
  return {
    id: promo.id,
    name: promo.name,
    type: promo.type,
    code: promo.code || '',
    stackable: !!promo.stackable,
    discount,
  };
}

// Evaluasi seluruh promo aktif, pilih kombinasi paling menguntungkan pelanggan.
// Aturan: jumlahkan semua promo stackable, ATAU pakai satu promo eksklusif
// dgn potongan terbesar - mana yang totalnya lebih besar untuk pelanggan.
function evaluate(d, { items, subtotal, customer, now, code }) {
  now = now || new Date();
  subtotal = Math.max(0, Number(subtotal) || 0);
  const list = Array.isArray(d.promos) ? d.promos : [];
  const matched = [];
  for (const p of list) {
    const m = match(p, { items: items || [], subtotal, customer, now, code });
    if (m) matched.push(m);
  }
  const stackables = matched.filter((m) => m.stackable);
  const exclusives = matched.filter((m) => !m.stackable);
  const stackSum = stackables.reduce((s, m) => s + m.discount, 0);
  const bestExclusive = exclusives.sort((a, b) => b.discount - a.discount)[0] || null;

  let applied;
  if (bestExclusive && bestExclusive.discount >= stackSum) {
    applied = [bestExclusive];
  } else {
    applied = stackables;
  }
  let totalDiscount = applied.reduce((s, m) => s + m.discount, 0);
  totalDiscount = Math.min(totalDiscount, subtotal);
  return {
    applied: applied.map((m) => ({ id: m.id, name: m.name, type: m.type, code: m.code, discount: m.discount })),
    totalDiscount,
    candidates: matched.length,
  };
}

module.exports = { evaluate, match, computeDiscount, inWindow };
