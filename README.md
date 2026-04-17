# 🛒 Aplikasi Kasir Transaksi (Electron + NestJS + Nuxt)

Aplikasi Point of Sale (POS) berbasis desktop yang menggabungkan kekuatan **NestJS** sebagai Backend API, **Nuxt 3** sebagai Frontend, dan **Electron** sebagai wrapper desktop. Aplikasi ini menggunakan **MariaDB/MySQL** sebagai engine database lokal yang dibundel langsung di dalam aplikasi.

## 🚀 Rilis Terbaru (Latest Release)
> **Catatan:** Anda dapat mengunduh aset instalasi (`.zip`, `.exe`, `.dmg`, `.AppImage`) melalui halaman [GitHub Releases](https://github.com/api-diengcyber/transaksi/releases).

## 🛠️ Fitur Utama
- **Manajemen Inventaris:** Stok barang, mutasi, dan opname otomatis.
- **Akuntansi Jurnal Umum:** Pencatatan otomatis dari transaksi penjualan/pembelian.
- **Multi-Platform:** Mendukung ekosistem Windows, macOS, dan Linux.
- **Database Lokal Terintegrasi:** Tidak memerlukan instalasi database terpisah (Standalone).

## 📂 Struktur Proyek
- `transaksi/`: Frontend Nuxt 3 (Vue.js).
- `transaksi-api/`: Backend API NestJS.
- `transaksi-electron/`: Wrapper Desktop & MySQL Manager.

## ⚙️ Persyaratan Pengembangan
- **Node.js:** v20.x atau lebih baru.
- **pnpm / npm:** Direkomendasikan menggunakan `pnpm`.

## 🛠️ Cara Menjalankan (Development)

### 1. Persiapan Database
Pastikan binary MariaDB sudah ada di folder `bin/mysql/[platform]` di dalam `transaksi-electron`.

### 2. Install Dependensi
Jalankan perintah berikut di root folder atau masing-masing sub-folder:
```bash
# Di folder transaksi-api
pnpm install

# Di folder transaksi
pnpm install

# Di folder transaksi-electron
npm install
