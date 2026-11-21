# Progress Log

## TAHAP 0: Preflight ✅
- **Tanggal:** 2026-11-20
- **Cek tool:**
  - PHP 8.2.12 ✅
  - Composer 2.9.2 ✅
  - Node v24.11.1 ✅
  - npm 11.6.2 ✅
  - Python 3.10.0 ✅
  - Git 2.50.1 ✅
- **Dataset:** `data/dataset_umkm.xlsx` (38617 bytes) ditemukan
- **Backend:** folder kosong, siap untuk Laravel
- **PostgreSQL:** koneksi ke `sava` berhasil
- **Database `sava_test`:** dibuat untuk testing
- **Git:** repository diinisialisasi
- **`.gitignore`:** dibuat
- **GATE:** LULUS — semua cek preflight berhasil

## TAHAP A: Audit Tahap 1 ✅
- **Tanggal:** 2026-11-21
- **Pemeriksaan:** branch `copilot`, log/status Git, migration, model, route, controller, seeder, CORS, database, dan HTTP auth.
- **Audit:** skema tabel sesuai spesifikasi. Migration, produk, varian, transaksi, dan profil sesuai; database `sava_test` tersedia.
- **Perbaikan:** respons autentikasi API dijadikan JSON 401 konsisten untuk request dengan atau tanpa header `Accept`.
- **GATE:** LULUS
  - `migrate:fresh --seed --no-interaction`: sukses
  - login admin mengembalikan token
  - `/api/me` dengan token: 200
  - `/api/me` tanpa token dengan dan tanpa header Accept: 401 JSON
  - [docs/AUDIT.md](AUDIT.md) tersedia

## TAHAP 2: Data science cleaning, EDA, dan import ✅
- **Tanggal:** 2026-11-21
- **Lingkungan:** virtual environment Python dibuat di `ml-service/.venv`; dependensi dipasang dari `ml-service/requirements.txt`; `pip check` bersih.
- **Data:** membaca 7 sheet Mei-November, menghasilkan `data/cleaned_historis.csv` berisi 699 baris dan `ml-service/reports/cleaning_report.md`.
- **EDA:** menghasilkan ringkasan dan 5 grafik PNG di `ml-service/reports/eda/`.
- **Import:** `HistoricalDataSeeder` membuat varian dan 699 transaksi historis; `SimulationSeeder` membuat 450 transaksi simulasi deterministik untuk 30 hari.
- **GATE:** LULUS
  - `php artisan migrate:fresh --seed --no-interaction`: sukses
  - jumlah transaksi historis: 699, sama dengan baris CSV
  - total historis database: Rp72.141.000, sama dengan jumlah `total_harga` CSV
  - laporan cleaning dan folder EDA tersedia
- **Koreksi audit data sebelum Tahap 3:** nomor `No.` pada semua sheet unik dan berurutan; aturan deduplikasi lama sebelumnya membuang 150 baris penjualan yang berbeda nomor. Aturan sudah diperbaiki, 150 baris lama disimpan di `ml-service/reports/dropped_duplicates.csv`, dan semua 699 baris kini dipertahankan. Nama varian turun dari 28 menjadi 26 setelah normalisasi urutan rasa pada Mix; nama lain yang meragukan tetap terpisah di `ml-service/reports/variant_review.md`.
- **Perbandingan per sheet:** jumlah baris dan total harga Excel cocok dengan CSV dan database untuk Mei-November.
