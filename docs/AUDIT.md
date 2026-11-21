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

## Tindak lanjut Tahap 3
- Validasi login, katalog, transaksi, filter dashboard, dan profil menggunakan Form Request dengan pesan Bahasa Indonesia.
- Create transaksi menghitung harga/subtotal dari varian database di dalam transaksi DB; varian dikunci saat digunakan dan kode transaksi harian diserialisasi untuk mencegah benturan.
- Produk/varian dengan riwayat tidak dihapus permanen; operasi penghapusan dilakukan aman terhadap transaksi yang sedang tersimpan.
- Filter dashboard memakai sumber/rentang yang tervalidasi. Range mundur dihitung dari tanggal transaksi terakhir untuk sumber terpilih.
- `GET /transactions` memvalidasi filter tanggal/sumber serta paginasi.
- Tes PHPUnit diarahkan dan dibatasi ke PostgreSQL `sava_test`; konfigurasi tes menolak database lain agar tidak menyentuh `sava`.
- Gate Tahap 3: `php artisan test` lulus (8 tes, 64 assertion). Dashboard summary, trend, top products, busy days, dan busy hours diuji lagi melalui HTTP pada data seed; jam historis kosong sesuai pesan kontrak, sementara simulasi menyediakan data jam.
- Endpoint ML tetap diteruskan ke layanan FastAPI dan menunggu pengujian integrasi Tahap 4.
