// Loyalty pelanggan (member & poin).
// Konfigurasi & perhitungan poin dipakai bersama oleh sales.js dan dining.js.
const { uid } = require('./utils');

// Ambil konfigurasi loyalty dari settings, dengan default aman.
function config(settings) {
  const l = (settings && settings.loyalty) || {};
  return {
    enabled: l.enabled !== false, // default aktif
    earn_per: Number(l.earn_per) > 0 ? Number(l.earn_per) : 1000, // 1 poin per Rp1.000 belanja
    point_value: Number(l.point_value) > 0 ? Number(l.point_value) : 100, // 1 poin = Rp100 saat ditukar
  };
}

// Hitung berapa poin yang bisa ditukar & nilai rupiahnya (dipanggil sebelum total final).
function redeemInfo(settings, customer, redeemPoints) {
  const cfg = config(settings);
  let pts = Math.max(0, parseInt(redeemPoints, 10) || 0);
  if (!customer || !cfg.enabled) pts = 0;
  pts = Math.min(pts, customer ? customer.points || 0 : 0);
  return { redeemedPoints: pts, redeemValue: pts * cfg.point_value };
}

// Setelah total transaksi final diketahui: catat perolehan & pemakaian poin ke customer.
// Mengembalikan ringkasan loyalty untuk disimpan di transaksi.
// Catatan: fungsi ini memutasi objek customer; pemanggil wajib menyimpannya ke DB.
function apply(settings, customer, { total, redeemedPoints, redeemValue, tx }) {
  const cfg = config(settings);
  const earned = cfg.enabled && customer ? Math.floor(Math.max(0, total) / cfg.earn_per) : 0;
  if (customer) {
    customer.points = Math.max(0, (customer.points || 0) - (redeemedPoints || 0) + earned);
    customer.visits = (customer.visits || 0) + 1;
    customer.total_spent = (customer.total_spent || 0) + Math.max(0, total);
    customer.last_visit = new Date().toISOString();
    customer.point_history = customer.point_history || [];
    customer.point_history.unshift({
      id: uid('pth'),
      tx_id: tx ? tx.id : null,
      invoice_no: tx ? tx.invoice_no : null,
      earned,
      redeemed: redeemedPoints || 0,
      balance: customer.points,
      note: '',
      created_at: new Date().toISOString(),
    });
    if (customer.point_history.length > 50) customer.point_history.length = 50;
  }
  return {
    customer_id: customer ? customer.id : null,
    customer_name: customer ? customer.name : null,
    earn_per: cfg.earn_per,
    point_value: cfg.point_value,
    earned_points: earned,
    redeemed_points: redeemedPoints || 0,
    redeem_value: redeemValue || 0,
    points_after: customer ? customer.points : null,
  };
}

module.exports = { config, redeemInfo, apply };
