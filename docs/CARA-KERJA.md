# Cara Kerja & Alur Penggunaan Sirkasir

Dokumen ini menjelaskan cara kerja aplikasi Sirkasir dari sisi pengguna — **mulai dari membuat pesanan sampai stok bahan terpotong otomatis** — plus alur back office (kas, pembelian, opname) dan bagaimana data mengalir di balik layar.

> Ringkas: Frontend (React) berbicara ke Backend (REST API Node.js) lewat HTTP/JSON, dan Backend menyimpan semua data di PostgreSQL. Frontend tidak pernah menyentuh database langsung.

---

## 1. Peran pengguna

| Peran | Bisa apa |
| ----- | -------- |
| **Owner** | Semua akses: master data, laporan, pengaturan, kelola pengguna, void, hapus. |
| **Manager** | Hampir semua operasional + sebagian setelan; mirip owner untuk kegiatan harian. |
| **Kasir** | Operasional kasir: buka meja, buat & tambah pesanan, kirim ke dapur, terima pembayaran. |

Login bisa lewat **email + password** atau **PIN** (untuk pergantian kasir cepat).

---

## 2. Persiapan awal (master data)

Sebelum berjualan, siapkan data dasar (menu **Master Data** / **Pengaturan**):

1. **Kategori** — mis. Makanan, Minuman, Snack.
2. **Bahan (ingredients)** — nama, satuan, harga rata-rata (`cost_avg`), stok awal, stok minimum.
3. **Menu** — nama, harga, kategori, dan **resep (BOM)**: bahan apa saja + jumlah pemakaian per porsi. Resep inilah yang nanti dipakai untuk memotong stok otomatis.
4. **Meja** — daftar meja untuk mode dine-in.
5. **Pengaturan toko** — nama toko, pajak (%), service charge (%), loyalti, catatan struk.

> HPP (modal) tiap menu dihitung otomatis dari resep × harga bahan, dan dipakai untuk menghitung laba di laporan.

---

## 3. Alur inti: dari pesanan sampai stok 🔁

```
  Buka meja / order        Tambah item + modifier         Kirim ke dapur (KDS)
  (dine-in / takeaway)  →  (pesanan bertahap)         →   status: pending
         │                                                     │
         │                                                     ▼
         │                                      Dapur masak: pending → preparing
         │                                                → ready → served
         ▼                                                     │
  Pembayaran (kasir)  ◄─────────────────────────────────────┘
  - hitung subtotal, diskon, promo, poin loyalti
  - hitung pajak & service charge → TOTAL
  - terima bayar (tunai/QRIS), split bill (opsional)
         │
         ▼
  Saat PEMBAYARAN sukses, backend otomatis:
  1) Potong STOK bahan sesuai resep tiap item  ✅
  2) Catat pergerakan stok (type: sale)
  3) Simpan transaksi + hitung laba
  4) Tambah/kurangi poin loyalti pelanggan
  5) Tutup order & bebaskan meja (jika semua item lunas)
```

### 3.1 Membuat pesanan
- **Dine-in**: pilih meja → sistem membuat *order* berstatus `open` dan meja jadi `occupied`. Kalau meja sudah punya order terbuka, order itu yang dipakai (tidak dobel).
- **Takeaway**: order dibuat tanpa meja.
- Setiap item bisa punya **modifier** (mis. level pedas, topping, ukuran) yang menambah harga, dan **catatan** (mis. "tanpa bawang").

### 3.2 Pesanan bertahap & pindah meja
- Item bisa ditambah kapan saja selama order masih `open` (pelanggan nambah pesanan).
- Order bisa **dipindah** ke meja lain; meja lama otomatis dibebaskan, meja tujuan jadi terisi (ditolak kalau meja tujuan sudah ada order aktif).

### 3.3 Dapur (Kitchen Display System / KDS)
- Item yang aktif dan belum `served` muncul di layar dapur, bisa difilter per **station** (kitchen / bar — ditentukan dari menu atau kategori).
- Alur status masak: **pending → preparing → ready → served**.

### 3.4 Pembayaran
- Kasir menghitung: subtotal item aktif − diskon − promo − nilai tukar poin, lalu + pajak + service charge = **total**.
- **Split bill**: bisa bayar sebagian item (pilih `item_ids`) atau semua item yang belum lunas.
- **Promo** dievaluasi otomatis (persen, nominal, voucher berkode, happy hour, khusus member) sesuai syarat & jadwal.
- **Loyalti**: pelanggan member bisa menukar poin jadi potongan, dan mendapat poin baru dari transaksi.
- Pembayaran bisa lebih dari satu metode (tunai, QRIS); kembalian dihitung otomatis.

### 3.5 Yang terjadi otomatis saat bayar (di backend, dalam 1 transaksi DB)
1. **Stok bahan berkurang** sesuai resep setiap item yang dibayar (BOM). Contoh: 1 Nasi Goreng memakai 150g nasi, 1 telur, dst → stok bahan itu dipotong.
2. **Pergerakan stok** dicatat (`stock_movements`, type `sale`) untuk audit.
3. **Transaksi** disimpan lengkap dengan rincian item, pajak, laba (`total − pajak − service − modal`).
4. **Poin loyalti** pelanggan diperbarui.
5. Kalau semua item order sudah lunas, **order ditutup** (`paid`) dan **meja dibebaskan** (`available`).

> Semua langkah di atas dibungkus **satu transaksi database** (BEGIN/COMMIT). Kalau ada satu langkah gagal, semua dibatalkan (ROLLBACK) — stok & transaksi tidak akan setengah jadi.

### 3.6 Void (pembatalan)
- **Void item** sebelum dibayar: item ditandai batal, tidak ikut ditagih.
- **Void order** (owner/manager): hanya jika belum ada pembayaran; meja dibebaskan.
- **Void transaksi** (owner/manager): status jadi `void` dan **stok dikembalikan** (pergerakan stok type `void`).

---

## 4. Alur back office

### 4.1 Shift & kas
- **Buka shift**: catat kas awal (modal laci). Hanya boleh satu shift terbuka.
- **Kas masuk/keluar**: catat pengeluaran/pemasukan tunai di luar penjualan.
- **Tutup shift**: sistem menghitung ringkasan (penjualan tunai, non-tunai, kas masuk/keluar, kas seharusnya) dan selisih dengan kas yang dihitung manual.

### 4.2 Pembelian (Purchase Order) — stok bertambah
- Buat **PO** ke supplier berisi bahan + qty + harga beli.
- Saat **PO diterima (receive)**: stok bahan **bertambah**, dan **harga rata-rata (`cost_avg`) dihitung ulang** secara weighted-average (rata-rata tertimbang). Pergerakan stok dicatat (type `purchase`).

### 4.3 Stok opname — koreksi stok
- Hitung fisik stok, masukkan jumlah nyata.
- Sistem menghitung **selisih** (fisik − sistem), memperbarui stok ke angka fisik, dan mencatat pergerakan (type `opname`) bila ada selisih.

### 4.4 Laporan
- **Ringkasan harian**: omzet, laba, jumlah transaksi, rata-rata, produk terlaris, metode bayar, per jam, stok menipis.
- **Analitik rentang tanggal**: tren, per kategori, per hari, perbandingan periode sebelumnya.
- **Laba per menu**, **BOM/HPP**, dan **nilai persediaan** (stok × harga rata-rata) + peringatan stok minimum.

---

## 5. Ringkasan siklus stok bahan

| Kejadian | Efek ke stok | Type pergerakan |
| -------- | ------------ | --------------- |
| Penjualan (bayar) | berkurang sesuai resep | `sale` |
| Void transaksi | kembali bertambah | `void` |
| Terima PO | bertambah + update harga rata-rata | `purchase` |
| Stok opname | disamakan dengan hitungan fisik | `opname` |
| Penyesuaian manual bahan | naik/turun sesuai input | `adjust` |

Dengan begitu, angka stok di aplikasi selalu mencerminkan aktivitas nyata, dan setiap perubahan punya jejak audit di `stock_movements`.

---

## 6. Peta teknis singkat (untuk developer)

- **Frontend**: React + Vite + Tailwind. Memanggil REST API via `axios` (proxy `/api` → `http://localhost:4000`).
- **Backend**: Node.js `http` murni (tanpa framework), router sederhana `{method, path, auth, roles, handler}`.
- **Database**: PostgreSQL via driver `pg` (tanpa ORM). Data bersarang (item order, modifier, pembayaran, riwayat poin) disimpan sebagai kolom `jsonb`.
- **Auth**: JWT sederhana (HMAC), password & PIN di-hash (scrypt).
- **Konsistensi**: operasi tulis penting (bayar, void, PO receive, opname) dibungkus transaksi DB. Nomor dokumen (INV/ORD/PO/OPN) dibuat atomik lewat tabel `counters`.
