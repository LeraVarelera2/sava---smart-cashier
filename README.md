# Sava — Smart Cashier

Sava adalah aplikasi POS untuk UMKM dengan dashboard analitik, prediksi omzet, klasifikasi produk, dan rekomendasi bundling. Backend memakai Laravel 12 + PostgreSQL, frontend React/Vite, dan layanan analitik FastAPI/scikit-learn.

## Kebutuhan

- Windows 10/11, PowerShell, Git
- PHP 8.2+ dengan Composer 2
- PostgreSQL (server dan `psql`/pgAdmin)
- Node.js yang didukung Vite 7 (Node 20.19+ atau 22.12+) dan npm
- Python 3.10+

## Setup dari nol (Windows)

Semua perintah di bawah dijalankan dari PowerShell. Gunakan file `.env` untuk kredensial lokal; jangan menyimpan password database di dokumentasi atau Git.

### 1. Buat database PostgreSQL

Pastikan layanan PostgreSQL berjalan. Buat database kosong `sava` untuk instalasi lokal baru, misalnya dari SQL Shell/pgAdmin:

```sql
CREATE DATABASE sava;
```

Jika akan menjalankan tes backend, buat database terpisah:

```sql
CREATE DATABASE sava_test;
```

Aktifkan ekstensi PDO PostgreSQL pada PHP:

```powershell
php --ini
```

Buka `php.ini` yang ditunjukkan sebagai *Loaded Configuration File*, aktifkan `extension=pdo_pgsql` (hapus tanda `;` di depannya), lalu buka ulang terminal. Verifikasi dengan:

```powershell
php -m | Select-String pdo_pgsql
```

### 2. Konfigurasikan backend

```powershell
Set-Location backend
Copy-Item .env.example .env
composer install
php artisan key:generate
```

Edit `backend\.env` lokal:

```dotenv
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=sava
DB_USERNAME=postgres
DB_PASSWORD=<PASSWORD_ANDA>
ADMIN_EMAIL=admin@sava.test
ADMIN_PASSWORD=Admin12345
ML_SERVICE_URL=http://127.0.0.1:8001
```

Ganti placeholder dengan kredensial PostgreSQL lokal Anda hanya di `.env`. Password admin di atas adalah kredensial pengembangan lokal; ganti sebelum aplikasi digunakan bersama/publik.

### 3. Siapkan data Excel dan layanan ML

Letakkan file dataset Excel `.xlsx` (berisi sheet penjualan seperti dataset proyek) di `data\`. File Excel bersifat lokal dan tidak masuk Git. File `data\variant_aliases.csv` berisi keputusan normalisasi varian yang telah disetujui dan harus tetap tersedia.

```powershell
Set-Location ..\ml-service
Copy-Item .env.example .env
py -3.10 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Isi `ml-service\.env` dengan koneksi ke database yang berisi data historis. Untuk instalasi lokal baru, konfigurasi ini sama dengan koneksi backend:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=sava
DB_USERNAME=postgres
DB_PASSWORD=<PASSWORD_ANDA>
```

Buat CSV bersih dari workbook, lalu kembali ke root:

```powershell
.\.venv\Scripts\python.exe .\scripts\clean_data.py
Set-Location ..
```

### 4. Migrasikan dan isi database

Pastikan `backend\.env` menunjuk ke database kosong yang memang disiapkan untuk instalasi baru sebelum menjalankan:

```powershell
Set-Location backend
php artisan migrate:fresh --seed --no-interaction
Set-Location ..
```

**Peringatan:** `migrate:fresh` menghapus semua tabel pada database yang dikonfigurasi. Seeder mengimpor histori dari CSV dan membuat data simulasi; jangan jalankan pada database yang berisi data usaha yang ingin dipertahankan. Untuk tes, selalu gunakan `sava_test`, bukan `sava`.

### 5. Latih model

Dengan `.env` ML mengarah ke database yang baru di-seed:

```powershell
Set-Location ml-service
.\.venv\Scripts\python.exe .\scripts\train.py
Set-Location ..
```

Model, metrik, dan laporan disimpan di `ml-service\models\` dan `ml-service\reports\`.

### 6. Konfigurasikan frontend dan jalankan

```powershell
Copy-Item frontend\.env.example frontend\.env
```

Isi `frontend\.env` dengan URL API lokal:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

Pasang dependency frontend satu kali:

```powershell
Set-Location frontend
npm install
Set-Location ..
```

Jalankan ketiga layanan dari root:

```powershell
.\start-dev.ps1
```

Skrip membuka jendela PowerShell terpisah:

- Frontend: <http://127.0.0.1:5173>
- Laravel API: <http://127.0.0.1:8000/api>
- FastAPI: <http://127.0.0.1:8001> (health: `/health`)

Alternatifnya, jalankan tiap layanan dari direktori masing-masing: `php artisan serve --host=127.0.0.1 --port=8000`, `.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001`, dan `npm run dev -- --host 127.0.0.1`.

### Login pengembangan

- Email: `admin@sava.test`
- Password awal lokal: `Admin12345` (atau nilai `ADMIN_PASSWORD` yang Anda set sebelum seeding)

## Tes dan smoke test

Tes Laravel dipaksa menggunakan PostgreSQL `sava_test` oleh PHPUnit dan guard tes. Siapkan database itu dan kredensialnya di `backend\.env.testing`, kemudian jalankan:

```powershell
Set-Location backend
php artisan test
Set-Location ..\frontend
npm run build
Set-Location ..
```

Smoke test memerlukan Laravel dan FastAPI aktif. Ia login, membuat **tepat satu transaksi kasir**, memanggil lima endpoint dashboard dan empat endpoint ML melalui proxy Laravel, lalu mencetak `[LULUS]`/`[GAGAL]` per langkah. **Transaksi smoke test bersifat permanen pada database yang dipakai Laravel.** Untuk gate/tes, arahkan Laravel dan layanan ML ke `sava_test` sebelum menyalakan server:

```powershell
Set-Location backend
$env:DB_DATABASE = 'sava_test'
php artisan serve --host=127.0.0.1 --port=8000
```

Pada jendela PowerShell lain:

```powershell
Set-Location ml-service
$env:DB_DATABASE = 'sava_test'
& '.\.venv\Scripts\python.exe' -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Lalu jalankan smoke test dari root. Password diminta secara tersembunyi bila `ADMIN_PASSWORD` tidak disetel:

```powershell
.\scripts\smoke_test.ps1
```

Jangan arahkan smoke test ke `sava` kecuali Anda memang menghendaki transaksi tambahan tercatat di database itu.

## Struktur utama

```text
backend/                 Laravel API, migrations, seeders, dan feature tests
frontend/                React/Vite, komponen, halaman, dan styles.css
ml-service/app/          FastAPI, konfigurasi dan proxy analitik
ml-service/scripts/      Cleaning, EDA, dan training model
ml-service/models/       Artefak model dan metrics.json
ml-service/reports/      Laporan cleaning, evaluasi, dan grafik
data/                    Excel lokal, alias varian, dan CSV hasil cleaning
docs/                    Progress, asumsi, audit, dan kontrak API
scripts/                 Smoke test integrasi PowerShell
start-dev.ps1            Peluncur tiga layanan lokal
DESIGN_SYSTEM.md         Dokumentasi token dan UI frontend
```

Workbook Excel, kredensial `.env`, virtualenv, dan dependency terpasang tidak dilacak Git.

## Endpoint

Daftar lengkap, autentikasi, parameter, serta contoh payload/response ada di [docs/api.md](docs/api.md). Ringkasnya, backend menyediakan autentikasi, katalog, transaksi, dashboard, profil usaha, dan proxy ML pada `/api/*`; FastAPI menyediakan health serta endpoint analitik pada `/health`, `/forecast`, `/classification`, `/bundling`, dan `/evaluation`.

Koleksi ringkas untuk Postman tersedia di `postman/Sava.postman_collection.json`. Variabel password diisi lokal pada Postman; jangan simpan rahasia ke file collection. Koleksi membuat transaksi permanen, jadi arahkan ke `sava_test` untuk tes.

## Catatan data dan model

Dataset historis berisi 699 baris valid dari tujuh sheet Mei-November. Baris yang tidak valid/duplikat identik yang dibuang: 0; aturan lama yang keliru menghapus 150 baris berulang berbeda nomor telah diperbaiki dan seluruhnya dipertahankan. Model saat ini memiliki MAE Rp368.294,06, RMSE Rp482.530,86, R² 0,0125 dan akurasi klasifikasi 0,7173 latih / 0,5000 uji. Nilai ini indikatif, bukan jaminan prediksi. Lihat [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md) dan `ml-service/reports/evaluation.md`.
