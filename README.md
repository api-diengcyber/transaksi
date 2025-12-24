# Aplikasi Transaksi Desktop (Electron + NestJS + Nuxt)

Aplikasi desktop *all-in-one* yang menggabungkan kekuatan **NestJS** (Backend), **Nuxt 3** (Frontend), dan **MariaDB/MySQL Portable** (Database), dibungkus menjadi file executable (`.exe`) menggunakan **Electron**.

## 🏗️ Arsitektur

Aplikasi ini menggunakan arsitektur *Monolithic Desktop Bundle*:

1.  **Frontend**: Nuxt 3 (Mode SPA + Hash Router).
2.  **Backend**: NestJS (API berjalan di `127.0.0.1:3000` di background).
3.  **Database**: MariaDB Portable (Berjalan di `localhost:8889` tanpa perlu instalasi XAMPP/MySQL di komputer user).
4.  **Wrapper**: Electron (Menjalankan `mysqld.exe`, `node.exe` untuk API, dan merender UI).

## 📂 Struktur Folder

```text
/ (Root Project)
├── build.sh                # Script untuk build source code (API & Web) saja
├── deploy.sh               # Script OTOMATIS (Build -> Copy -> Package .exe)
├── README.md               # Dokumentasi ini
│
├── transaksi/              # Source Code Frontend (Nuxt)
│   ├── nuxt.config.ts      # Configured with ssr:false & hashMode
│   └── ...
│
├── transaksi-api/          # Source Code Backend (NestJS)
│   ├── src/
│   └── ...
│
└── transaksi-electron/     # Wrapper Electron
    ├── src/
    │   └── main.js         # Entry point (Manage process MySQL & API)
    ├── bin/
    │   └── mysql/          # Folder Database Portable (Harus diisi manual)
    ├── resources/          # Tempat hasil build API & Web diletakkan (Otomatis)
    └── package.json        # Konfigurasi Electron Builder