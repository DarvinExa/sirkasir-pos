# Sirkasir | POS Resto

Aplikasi Point of Sale (POS) untuk restoran dan warung makan. Mengelola pesanan dine-in per meja maupun takeaway, alur ke dapur (Kitchen Display), pembayaran (tunai/QRIS, split bill), stok bahan, laporan, program loyalti, promo, serta master data yang bisa dikustomisasi tiap restoran.

Dibangun dengan Node.js (REST API tanpa framework berat) dengan penyimpanan **PostgreSQL** di sisi backend, dan React + Vite + Tailwind CSS di sisi frontend.

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

Butuh Node.js versi 20 atau lebih baru dan PostgreSQL 13+ yang sudah berjalan.

### 1. Siapkan database

Buat database kosong bernama `sirkasir` (nama bisa diganti, sesuaikan di `.env`):

```bash
createdb sirkasir
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env    # lalu WAJIB sesuaikan isinya (lihat di bawah)
npm run setup
npm start               # API berjalan di http://localhost:4000
```

> ⚠️ **Wajib ganti kredensial di `.env`.** File `.env.example` hanya contoh.
> Setelah `cp .env.example .env`, buka `.env` lalu ganti **password PostgreSQL**
> pada `DATABASE_URL` sesuai password user `postgres` di komputer/DB kamu:
>
> ```
> DATABASE_URL=postgresql://postgres:PASSWORD_KAMU@localhost:5432/sirkasir
> ```
>
> Kalau password masih `postgres:postgres` (bawaan contoh) dan tidak cocok,
> koneksi akan gagal dengan `password authentication failed`.
> Untuk produksi, ganti juga `JWT_SECRET` dengan string acak yang panjang.

Catatan:

- `npm run migrate` hanya membuat/menyegarkan struktur tabel (aman diulang).
- `npm run seed` mengisi **data demo** dan menimpa data lama.
- `npm run setup` menjalankan migrate + seed demo sekaligus.

### Dua mode data awal

- **Mode demo** (untuk coba-coba / live demo online):
  ```bash
  npm run setup        # migrate + isi data contoh (menu, meja, pelanggan, promo, 2 akun demo)
  ```
- **Mode kosong** (untuk dipakai sendiri — mulai dari nol):
  ```bash
  npm run setup:blank  # migrate + hanya 1 akun admin + pengaturan default
  ```
  Cocok kalau kamu mengunduh proyek ini untuk toko sendiri: tidak ada data contoh,
  tinggal isi menu, bahan, dan meja sesuai kebutuhanmu.
  - Akun admin default: `admin@sirkasir.test` / `admin123` (PIN `1111`). **Segera ganti** setelah login.
  - Bisa dikustom lewat environment variable (.env) sebelum menjalankan, mis:
    ```bash
    ADMIN_EMAIL=aku@tokoku.com ADMIN_PASSWORD=rahasia123 STORE_NAME="Warung Makan Ku" npm run setup:blank
    ```
    Variabel yang didukung: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PIN`, `ADMIN_NAME`, `STORE_NAME`.
- Buat database-nya dulu sebelum `npm run setup`, mis. `createdb -U postgres sirkasir`
  (atau lewat pgAdmin). Jalankan dari terminal mana saja — tidak perlu di folder tertentu.

### 3. Frontend

Jalankan di terminal terpisah:

```bash
cd frontend
npm install
npm run dev    # buka http://localhost:5173
```

### Akun demo

| Peran | Email               | Password | PIN  |
| ----- | ------------------- | -------- | ---- |
| Owner | owner@sirkasir.test | owner123 | 1111 |
| Kasir | kasir@sirkasir.test | kasir123 | 2222 |

## Dokumentasi

- [docs/CARA-KERJA.md](docs/CARA-KERJA.md) — alur kerja & cara penggunaan aplikasi, dari membuat pesanan sampai stok bahan terpotong otomatis.

## Struktur proyek

```
backend/    # REST API (Node.js), PostgreSQL, skema + seed
frontend/   # Aplikasi React (Vite + Tailwind)
```

## Rencana selanjutnya (opsional)

- Integrasi gateway pembayaran QRIS sungguhan.
- Ekspor laporan ke PDF/Excel.
- Deploy ke server produksi.
