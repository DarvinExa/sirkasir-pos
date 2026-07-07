# Sirkasir | POS Resto

Aplikasi Point of Sale (POS) untuk restoran dan warung makan. Mengelola pesanan dine-in per meja maupun takeaway, alur ke dapur (Kitchen Display), pembayaran (tunai/QRIS, split bill), stok bahan, laporan, program loyalti, promo, serta master data yang bisa dikustomisasi tiap restoran.

Dibangun dengan Node.js (REST API tanpa framework berat, penyimpanan berbasis file JSON) di sisi backend dan React + Vite + Tailwind CSS di sisi frontend.

## Fitur utama

- Meja & kasir: pesanan per meja dan takeaway, order bertahap, pindah meja.
- Dapur (KDS): antrian pesanan real-time dengan status masak.
- Pembayaran: tunai, QRIS, dan split bill; cetak struk.
- Loyalti: member, kumpul dan tukar poin saat bayar.
- Promo & diskon otomatis: persen, nominal, voucher, happy hour, khusus member.
- Back office: shift & kas, supplier, purchase order, stok opname, laporan laba dan persediaan.
- Master data: menu, kategori, meja, bahan/stok, pengguna, dan pengaturan toko.
- Peran pengguna: owner, manager, dan kasir dengan hak akses berbeda.

## Menjalankan secara lokal

Butuh Node.js versi 18 atau lebih baru.

### 1. Backend

```bash
cd backend
npm install
npm run seed   # membuat data awal (menu, meja, akun demo, dll)
npm start      # API berjalan di http://localhost:4000
```

### 2. Frontend

Jalankan di terminal terpisah:

```bash
cd frontend
npm install
npm run dev    # buka http://localhost:5173
```

### Akun demo

| Peran | Email | Password | PIN |
| ----- | ----- | -------- | --- |
| Owner | owner@sirkasir.test | owner123 | 1111 |
| Kasir | kasir@sirkasir.test | kasir123 | 2222 |

## Struktur proyek

```
backend/    # REST API (Node.js), data JSON, seed
frontend/   # Aplikasi React (Vite + Tailwind)
```

## Rencana selanjutnya (opsional)

- Migrasi penyimpanan dari file JSON ke PostgreSQL.
- Integrasi gateway pembayaran QRIS sungguhan.
- Ekspor laporan ke PDF/Excel.
- Deploy ke server produksi.
