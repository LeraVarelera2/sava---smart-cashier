# Audit Tahap 1

## Sudah sesuai
- Migration membentuk tabel `business_profiles`, `products`, `product_variants`, `transactions`, dan `transaction_items` sesuai spesifikasi.
- Kolom uang memakai `unsignedBigInteger`; `transaction_date` memiliki indeks, `source` dan `basket_key` memiliki indeks.
- Relasi transaction item ke variant tersedia dan penghapusan transaction item mengikuti cascade transaction.
- Model mencakup relasi dan cast untuk nilai integer serta boolean.
- Seeder membuat satu admin (`admin@sava.test`) dan profil usaha default `Usaha Saya`.
- Sanctum terpasang, route `/api/login`, `/api/logout`, `/api/me`, dan route katalog/transaksi/dashboard/profil/ML sudah terdaftar.
- CORS mengizinkan `http://localhost:5173` dan `http://127.0.0.1:5173`.
- Migrasi dan seed tahap 1 berhasil pada database `sava`.
- Database `sava_test` tersedia.

## Diperbaiki pada audit
- Penanganan autentikasi API diperbarui agar seluruh request `/api/*` tanpa token mengembalikan JSON `401 {"message":"Unauthenticated."}`, termasuk request tanpa header `Accept: application/json`.

## Bukti verifikasi
- `php artisan migrate:fresh --seed --no-interaction`: LULUS.
- Database aktif: `sava`; database testing tersedia: `sava_test`.
- `POST /api/login` dengan kredensial admin: 200 dan mengembalikan token.
- `GET /api/me` dengan bearer token: 200 dan mengembalikan `admin@sava.test`.
- `GET /api/me` tanpa token dan dengan `Accept: application/json`: 401 JSON.
- `GET /api/me` tanpa token dan tanpa header Accept: 401 JSON.

## Temuan untuk Tahap 3
- Produk dan varian saat ini sudah mendukung penonaktifan varian yang memiliki riwayat transaksi, tetapi perlu pengujian end-to-end.
- Belum ada Form Request khusus; validasi controller perlu tetap dipertahankan atau diekstrak pada Tahap 3 sesuai kebutuhan tes.
- Controller dashboard perlu diuji dengan data kecil untuk memastikan range mundur dari tanggal transaksi terakhir dan agregasi harian/bulanan.
- `GET /transactions` perlu diuji paginasi serta filter `date` dan `source`.
- Endpoint create transaction perlu diuji supaya harga dan subtotal selalu berasal dari database, bukan payload klien.
- Endpoint ML adalah proxy dan hasil akhirnya diuji setelah layanan FastAPI tersedia di Tahap 4.
