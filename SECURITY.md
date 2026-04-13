# Security Policy

## Dukungan Versi (Supported Versions)

Kami berkomitmen untuk menjaga keamanan data transaksi dan operasional Anda. Berikut adalah daftar versi aplikasi yang saat ini menerima pembaruan keamanan:

| Versi   | Status Dukungan     |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

*Sangat disarankan untuk selalu menggunakan versi terbaru guna mendapatkan patch keamanan dan performa optimal.*

## Pelaporan Celah Keamanan (Reporting a Vulnerability)

Keamanan aplikasi kami adalah prioritas utama. Jika Anda menemukan celah keamanan (vulnerability) pada komponen Desktop, API, maupun Frontend, mohon untuk **tidak** melaporkannya melalui GitHub Issue publik.

Silakan ikuti langkah-langkah berikut:

1. **Email:** Kirimkan temuan Anda secara detail ke [security@diengcyber.com](mailto:security@diengcyber.com).
2. **Detail Laporan:** Sertakan deskripsi celah, langkah-langkah untuk mereproduksi (Proof of Concept), dan potensi dampaknya.
3. **Konfirmasi:** Tim kami akan memberikan konfirmasi penerimaan laporan dalam waktu maksimal 48 jam kerja.
4. **Pembaruan:** Anda akan menerima update berkala mengenai status perbaikan celah tersebut.
5. **Penanganan:** Kami meminta Anda untuk menjaga kerahasiaan informasi celah tersebut hingga kami merilis perbaikan resmi (*Responsible Disclosure*).

## Kebijakan Keamanan Lingkungan (Environment Safety)

Karena aplikasi ini membawa engine database lokal (MariaDB), pastikan:
- Perangkat Anda memiliki izin akses folder yang benar pada direktori `userData`.
- Jangan membagikan file database (`.sql` atau folder `data`) kepada pihak yang tidak berwenang.
- Gunakan password `root` yang kuat jika Anda melakukan konfigurasi ulang pada database.

---
*Terima kasih telah membantu kami menjaga keamanan aplikasi Transaksi.*
