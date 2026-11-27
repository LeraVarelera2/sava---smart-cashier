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
- **Alias varian:** 3 keputusan alias diterapkan dari `data/variant_aliases.csv`; jumlah varian 26 menjadi 23 tanpa mengubah 699 baris atau total Rp72.141.000. Empat varian belum diputuskan tetap dipertahankan apa adanya.
- **Perbandingan per sheet:** jumlah baris dan total harga Excel cocok dengan CSV dan database untuk Mei-November.

## TAHAP 3: API backend ✅
- **Tanggal:** 2026-11-21
- **Pengerjaan:** menambahkan Form Request dengan pesan Bahasa Indonesia; memperkuat katalog, transaksi berbasis harga server, filter/paginasi transaksi, agregasi/range dashboard, dan profil usaha. Penghapusan produk/varian ber-riwayat mempertahankan data dengan menonaktifkannya.
- **Keamanan tes data:** PHPUnit dipaksa menggunakan PostgreSQL `sava_test`; `Tests\TestCase` menghentikan tes jika database bukan `sava_test`.
- **GATE:** LULUS
  - `php artisan test`: 8 tes, 64 assertion lulus.
  - `vendor/bin/pint --test` pada file PHP terkait: lulus.
  - HTTP pada database seed `sava`: dashboard summary, trend (16 periode), top products (10), busy days (7), busy hours, katalog, transaksi (paginasi), dan profil merespons sukses.
  - Riwayat tidak memiliki jam sehingga `busy-hours` mengembalikan daftar kosong dan pesan yang ditentukan; data simulasi mengembalikan 14 kelompok jam.
  - Penghapusan varian ber-riwayat diuji pada `sava_test`: varian dipertahankan dan dinonaktifkan.
- **Batas tahap:** layanan `/ml/*` diselesaikan dan diintegrasikan pada Tahap 4.

## TAHAP 4: Model dan layanan ML ✅
- **Tanggal:** 2026-11-21
- **Forecast omzet:** model Linear Regression memakai 165 hari data historis (29 Mei-9 November 2026); data setelah 9 November tidak ikut melatih atau menggeser forecast. Titik aktual terakhir 9 November dan prediksi pertama 10 November.
- **Klasifikasi:** Decision Tree menggunakan 239 baris varian-minggu. Dari 23 varian, 8 yang memiliki kurang dari 4 minggu data dikecualikan; respons klasifikasi menandainya `Data belum cukup`. Akurasi uji 0,5000.
- **Bundling:** aturan Apriori dibuat terpisah untuk basis keranjang harian dan transaksi.
- **Evaluasi:** forecast MAE Rp368.294,06, RMSE Rp482.530,86, R² 0,0125. Laporan mencatat bahwa daya jelas forecast masih rendah dan akurasi klasifikasi belum kuat.
- **Artefak:** model dan `metrics.json` ada di `ml-service/models/`; laporan, confusion matrix, dan pohon keputusan ada di `ml-service/reports/`.
- **GATE:** LULUS
  - `train.py` berjalan; `pip check` dan `py_compile` bersih.
  - `/health`, `/forecast`, `/classification`, `/bundling` (basis `day` dan `transaction`), dan `/evaluation` FastAPI diverifikasi.
  - Proxy Laravel `/api/ml/*` diverifikasi dengan bearer token.
  - `php artisan test`: 9 tes, 68 assertion lulus; Pint lulus setelah pemformatan akhir.

## TAHAP 5 BAGIAN A: frontend dasar ✅
- **Tanggal:** 2026-11-21
- **Scaffold:** aplikasi React + Vite + Tailwind CSS 4 dengan font Poppins lokal, design tokens, modul API Axios, dan rute terlindungi.
- **Halaman:** Login, Kasir, Katalog, Profil, dan kerangka Dashboard. Navigasi memakai sidebar desktop dan bar bawah pada layar kecil.
- **Alur:** login/logout dan penanganan sesi 401; kasir memilih varian serta menyimpan transaksi; katalog mendukung produk dan varian; profil memuat serta menyimpan data usaha. Ringkasan kesibukan ditampilkan sebagai data turunan hanya-baca dari API.
- **Pengembangan lokal:** `start-dev.ps1` membuka jendela PowerShell terpisah untuk Laravel `8000`, FastAPI `8001`, dan Vite `5173`.
- **GATE:** LULUS
  - `npm run build` dari `frontend/`: sukses.
  - Browser: login dan rute terlindungi; transaksi kasir tersimpan; produk dibuat, diperbarui, lalu dihapus; varian diperbarui; profil berhasil disimpan.
  - Alur integrasi diuji pada database khusus `sava_test`; database pengembangan `sava` tidak dipakai untuk transaksi uji.
  - Navigasi dan kasir diverifikasi pada viewport desktop dan ponsel; evaluasi visual independen desktop/mobile: PASS.

## TAHAP 5 BAGIAN B: notifikasi dan dashboard ✅
- **Tanggal:** 2026-11-21
- **Langkah 0:** notifikasi aksi dan error API memakai Toast bersama dengan tipe sukses/error/info, batas tiga item, durasi otomatis, tombol tutup aksesibel, dan posisi responsif. Konfirmasi hapus/nonaktifkan katalog memakai modal aplikasi, bukan dialog browser.
- **Dashboard:** tab Ringkasan, Prediksi, Produk, dan Bundling memuat endpoint API; dilengkapi filter sumber/rentang, grafik aktual/prediksi, metrik klasifikasi dan confusion matrix, aturan pohon, serta jumlah aturan bundling per basis.
- **Bundling API:** respons menyertakan jumlah pasangan aturan yang ditemukan, selain daftar rekomendasi yang ditampilkan.
- **GATE:** LULUS
  - `npm run build`: sukses.
  - Endpoint ML: health sukses; forecast 30 hari aktual + 7 hari prediksi; klasifikasi 23 varian termasuk 8 yang datanya belum cukup; aturan bundling berjumlah 5 per hari dan 1 per transaksi.
  - Browser: seluruh tab Dashboard memuat data melalui API; konfirmasi katalog tampil. Pemeriksaan dilakukan dengan Laravel terarah ke `sava_test`; tidak ada data uji ditulis ke `sava`.
  - Server uji dihentikan setelah pemeriksaan.

## TAHAP 6: integrasi dan dokumentasi ✅
- **Tanggal:** 2026-11-22
- **Dokumentasi:** root `README.md` menjelaskan setup Windows dari nol, konfigurasi `.env` per aplikasi, PostgreSQL/PDO pgsql, dataset Excel lokal, urutan clean/migrate/seed/train/run, kredensial pengembangan, struktur folder, endpoint, dan peringatan atas migrasi destruktif serta smoke test yang menambah transaksi. `docs/api.md` mendokumentasikan endpoint dan contoh request/respons; `DESIGN_SYSTEM.md` mendata token CSS, tipografi, komponen, breakpoint, grafik, halaman, dan alur.
- **Integrasi:** `scripts/smoke_test.ps1` login, menyimpan satu transaksi, memeriksa lima endpoint dashboard dan empat endpoint ML, serta mencetak status per langkah. Koleksi Postman ringkas ditambahkan hanya setelah seluruh gate lulus.
- **Validasi start-dev:** lokasi root dan path backend/FastAPI/frontend sesuai struktur proyek; perintah menunjuk ke Laravel, venv Python lokal, dan Vite.
- **GATE — Laravel:** `php artisan test`: 9 tes, 68 assertion lulus.
- **GATE — frontend:** `npm run build`: lulus.
- **GATE — smoke:** database `sava_test` di-reset/di-seed secara eksplisit; Laravel dan FastAPI diarahkan ke `sava_test`. Login, transaksi `TRX-20261122-0001`, lima endpoint dashboard, dan empat endpoint `/api/ml/*` semuanya `[LULUS]`. Database `sava` tidak menjadi target tes ini.
- **Pembersihan:** proses Laravel/FastAPI untuk gate dihentikan dan port 8000/8001 dipastikan tidak lagi listening.
- **Data/model yang dicatat untuk pelaporan:** 699 baris valid dari 699 baris sumber; 0 baris invalid/identik dibuang. Aturan deduplikasi lama yang keliru pernah membuang 150 baris berbeda nomor, kini seluruhnya dipertahankan. Forecast MAE Rp368.294,06, RMSE Rp482.530,86, R² 0,0125; akurasi klasifikasi 0,7173 latih dan 0,5000 uji dari 239 baris varian-minggu. Keterbatasan dijelaskan di `docs/ASSUMPTIONS.md` dan laporan evaluasi.

## REVISI TAMPILAN DASHBOARD ✅
- **Tanggal:** 2026-11-22
- **Tampilan:** panah select kustom dengan ruang kanan seragam; loading dashboard menampilkan spinner dan pesan; deskripsi dinaikkan ke 14 px (13 px pada HP) dan warna sekunder `#4f5d57`; kartu MAE/RMSE/R² diberi penjelasan dinamis, termasuk peringatan untuk R² di bawah 0,3.
- **Interaksi:** tooltip dan titik aktif ditambahkan pada grafik garis dan batang; baris produk teratas menampilkan rincian pada hover/tap; setiap tab memiliki panel "Apa ini?" yang terbuka secara bawaan dan dapat diciutkan; Support/Confidence/Lift memiliki tooltip definisi.
- **Kontras:** `#4f5d57` memiliki rasio 6,34:1 terhadap `#f7f5ed` dan 6,85:1 terhadap `#fffefa`.
- **Batas perubahan:** hanya `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles.css`, `DESIGN_SYSTEM.md`, dan log ini. Tidak ada perubahan backend/ML, endpoint, perhitungan, atau data. Default filter sumber tetap seperti implementasi semula (`Semua sumber`); tidak ada penulisan ke database.
- **GATE:** `npm run build`: lulus. Tidak dilakukan pemeriksaan browser; port 8000, 8001, dan 5173 kosong.

## REVISI TAMPILAN DASHBOARD PUTARAN 2 ✅
- **Tanggal:** 2026-11-23
- **Keterbacaan:** skala judul, panel, KPI, tabel, dan label diseragamkan; deskripsi panel dipangkas. Ringkasan bantuan tiap tab kini satu baris, dengan "Cara membaca" tertutup secara bawaan.
- **Dashboard:** kartu sorotan menampilkan jumlah perkiraan omzet tujuh hari, ringkasan klasifikasi produk, dan paket terkuat dari data API yang telah diterima. Nilai MAE/RMSE/R² diberi judul serta penjelasan yang lebih ringkas; predikat R² hanya presentasi.
- **Grafik dan bundling:** tooltip mengikuti posisi titik/batang aktif; rekomendasi paket memakai label bahasa sehari-hari tanpa ikon definisi teknis.
- **Tombol:** label muat ulang memakai ikon refresh dan spinner saat memuat; "Coba lagi" tetap tersedia pada keadaan error. Filter sumber dimulai dari historis.
- **Batas perubahan:** hanya `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles.css`, `DESIGN_SYSTEM.md`, dan log ini. Tidak ada perubahan backend/ML, endpoint, logika analisis, atau data; tidak dijalankan server dan tidak ditulis database.
- **GATE:** `npm run build`: lulus. `git diff --name-only` hanya memuat empat file yang diizinkan. Tidak dilakukan pemeriksaan browser sesuai permintaan.

## REVISI TAMPILAN DASHBOARD PUTARAN 3 ✅

- **Tanggal:** 2026-11-26
- **Kesimpulan:** tiap tab Dashboard menampilkan ringkasan kalimat dari data API; Prediksi memakai ringkasan historis seluruh rentang untuk estimasi pcs harian bila dapat dihitung. Kondisi tanpa data dan tanpa aturan bundling memiliki teks khusus.
- **Bantuan dan KPI:** "Cara membaca" kini tampil langsung dalam satu paragraf; penjelasan Bundling menerangkan basis hari/transaksi dan arti aturan. KPI diperkecil dan dirapatkan. Tombol "Muat ulang" serta tampilan mentah aturan pohon dihapus; "Coba lagi" tetap tersedia.
- **Tooltip:** satu pemeriksaan browser memakai respons API dummy lokal tanpa database. Tooltip garis terjangkar ke titik, berada dalam batas chart, dan bergeser sekitar 9 px ke bawah saat titik berada dekat tepi atas.
- **Batas perubahan:** hanya `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles.css`, `DESIGN_SYSTEM.md`, dan log ini. Tidak ada perubahan backend/ML, endpoint, atau data; tidak ada transaksi maupun penulisan database.
- **GATE:** `npm run build`: lulus. Perubahan hanya memuat file yang diizinkan; server sementara dihentikan setelah pemeriksaan.

## REVISI TAMPILAN DASHBOARD PUTARAN 4

- **Tampilan:** panduan "Cara membaca" pada empat tab menjadi kotak terpisah berisi poin ceklis; kalimat mengikuti isi yang ditentukan. Panduan Bundling dikelompokkan menjadi "Angka di kartu" dan "Pilihan pengelompokan".
- **Istilah:** label jumlah pasangan dan pilihan pengelompokan Bundling memakai bahasa awam; teks login diringkas dan diratakan tengah agar muat satu baris di ponsel.
- **Batas perubahan:** hanya frontend, `DESIGN_SYSTEM.md`, dan log ini. Tidak ada perubahan logika, perhitungan, parameter/endpoint API, data, backend/ML, atau database.
- **GATE:** `npm run build`: lulus. Tidak dilakukan pemeriksaan browser dan tidak dijalankan server.

## REVISI TAMPILAN DASHBOARD PUTARAN 5

- **Tata letak:** kelompok isi "Cara membaca" pada Bundling tersusun dua kolom sama lebar di desktop, dengan jarak 32 px dan rata kiri; tiga tab lain tetap satu kolom. Sampai lebar 900 px tata letak satu kolom tetap dipertahankan.
- **Pemeriksaan:** pada 1440 px, tepi kiri ikon panduan terhadap ikon poin/subjudul berbeda 0 px di keempat tab; Bundling memakai dua kolom dan selisih tinggi subjudul 0 px. Pada 390 px, semua tab satu kolom dengan selisih tepi kiri 0 px; dua kelompok Bundling tersusun vertikal.
- **Batas perubahan:** hanya `frontend/src/pages/Dashboard.jsx`, `frontend/src/styles.css`, `DESIGN_SYSTEM.md`, dan log ini. Isi panduan, logika, API, dan data tidak diubah; tidak ada transaksi atau penulisan database.
- **GATE:** `npm run build`: lulus. Server sementara dihentikan setelah pemeriksaan.

## LAPORAN PENJUALAN BAGIAN A ✅

- **Tanggal:** 2026-11-27
- **API:** ditambahkan endpoint hanya-baca `/api/reports/sales` dan `/api/reports/transactions` di dalam `auth:sanctum`, termasuk validasi sumber/tanggal/rentang, ringkasan agregat harian dan produk, pencarian transaksi, paginasi hingga 1000, serta format jam lokal.
- **Dokumentasi:** kontrak dan contoh di `docs/api.md`, dua entri endpoint di README, dua request di koleksi Postman, dan catatan ini. Tidak ada perubahan pada endpoint/perhitungan lama, skema, frontend, atau layanan ML.
- **GATE:** `php artisan test`: 14 tes, 164 assertion lulus pada `sava_test`; Pint untuk seluruh file PHP baru lulus; JSON koleksi Postman valid. `migrate:fresh --seed` dan verifikasi HTTP dijalankan hanya pada `sava_test`; server sementara dihentikan.
- **Verifikasi angka historis (2026-05-29–2026-11-09):** 699 transaksi, omzet Rp72.141.000, 23.915 pcs. Jumlah omzet harian Rp72.141.000. Ringkasan sama dengan `/api/dashboard/summary?source=historis&range=semua` untuk omzet, jumlah transaksi, dan pcs. Paginator berisi 699 baris; jumlah `total_amount` seluruh baris Rp72.141.000.
