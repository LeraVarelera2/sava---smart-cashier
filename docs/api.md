# API Sava

Base URL Laravel lokal: `http://127.0.0.1:8000/api`. Kecuali login, seluruh endpoint Laravel di bawah memerlukan header `Authorization: Bearer <TOKEN>` dan menerima JSON. Endpoint FastAPI langsung berjalan di `http://127.0.0.1:8001`; aplikasi frontend memakai proxy Laravel `/api/ml/*`.

## Autentikasi

### `POST /login` (publik)

Request:

```json
{"email":"admin@sava.test","password":"<PASSWORD_ANDA>"}
```

Respons `200`:

```json
{"token":"<TOKEN>","user":{"id":1,"name":"Admin Sava","email":"admin@sava.test"}}
```

### `GET /me` (auth) dan `POST /logout` (auth)

`GET /me` mengembalikan `{ "id": 1, "name": "Admin Sava", "email": "admin@sava.test" }`. Logout mengembalikan `{"message":"Berhasil logout."}`.

## Produk dan varian

| Method | Path | Keterangan |
|---|---|---|
| GET | `/products` | Produk dan varian aktif |
| POST | `/products` | Buat produk beserta minimal satu varian |
| PUT | `/products/{id}` | Ubah nama produk |
| DELETE | `/products/{id}` | Hapus bila belum dipakai; selain itu nonaktifkan varian |
| POST | `/products/{id}/variants` | Tambah varian |
| PUT | `/variants/{id}` | Ubah varian |
| DELETE | `/variants/{id}` | Hapus bila belum dipakai; selain itu nonaktifkan |

Request pembuatan produk:

```json
{
  "name":"Pisang Bolen",
  "variants":[
    {"variant_name":"Cokelat","pack_size":5,"size_label":"5 pcs","price":15000}
  ]
}
```

Harga dan jumlah adalah integer rupiah/pcs. `pack_size` dan `size_label` dapat `null`. Respons sukses umumnya membungkus objek/list di properti `data`; pembuatan menghasilkan `201`.

## Transaksi

### `POST /transactions`

Request hanya memuat ID varian dan jumlah. Harga diambil dari katalog server:

```json
{"items":[{"variant_id":1,"qty":2}]}
```

Respons `201` berisi `message` dan `data` transaksi, termasuk `code`, `transaction_date`, `total_amount`, `source: "kasir"` dan item dengan `unit_price`/`subtotal`.

### `GET /transactions`

Query opsional: `date=YYYY-MM-DD`, `source=semua|historis|simulasi|kasir`, `per_page=1..100`, `page=1..`. Respons mengikuti bentuk paginator Laravel (`data`, `current_page`, `last_page`, dan metadata tautan).

## Dashboard

Kelima endpoint menerima query opsional `source=semua|historis|simulasi|kasir` dan `range=7|30|90|semua`. `semua` adalah default.

| Method | Path | Bentuk respons |
|---|---|---|
| GET | `/dashboard/summary` | `data: {total_omzet, jumlah_transaksi, total_pcs, rata_rata_omzet}` |
| GET | `/dashboard/trend` | `data: [{period, omzet, jumlah}]` |
| GET | `/dashboard/top-products` | `data: [{variant_name, total_pcs, total_omzet}]` |
| GET | `/dashboard/busy-days` | `data: [{day_number, hari, rata_rata_omzet, rata_rata_transaksi}]` |
| GET | `/dashboard/busy-hours` | `data: [{jam, jumlah_transaksi}]`; array kosong dan `message` bila tidak ada timestamp |

Contoh `GET /dashboard/summary?source=kasir&range=30`:

```json
{"data":{"total_omzet":30000,"jumlah_transaksi":2,"total_pcs":10,"rata_rata_omzet":15000}}
```

## Profil usaha

| Method | Path | Keterangan |
|---|---|---|
| GET | `/business-profile` | Profil dan ringkasan kesibukan |
| PUT | `/business-profile` | Simpan profil |

Body PUT memerlukan `business_name`; `business_type`, `address`, `rt`, `rw`, `kelurahan`, dan `phone` opsional. Respons dibungkus `data`.

## Analitik ML melalui Laravel (auth)

| Method | Path | Parameter |
|---|---|---|
| GET | `/ml/forecast` | `days` 1–90, default 7 |
| GET | `/ml/classification` | — |
| GET | `/ml/bundling` | `basis=day|transaction`, default `day` |
| GET | `/ml/evaluation` | — |

Contoh forecast mengembalikan `history`, `forecast: [{tanggal, omzet}]`, dan `metrics`. Klasifikasi mengembalikan `products`, `thresholds`, `metrics`, `tree_rules`, dan `feature_importance`. Bundling mengembalikan `basis`, `rule_count`, `data` (pasangan item dengan support/confidence/lift), serta `message`.

## Endpoint FastAPI langsung (pengembangan)

| Method | Path | Keterangan |
|---|---|---|
| GET | `/health` | Status layanan/model |
| GET | `/forecast?days=7` | Prediksi dan metrik |
| GET | `/classification` | Klasifikasi dan metrik |
| GET | `/bundling?basis=day` | Aturan asosiasi |
| GET | `/evaluation` | Evaluasi model |

## Error umum

- `401`: token tidak ada/tidak valid (`{"message":"Unauthenticated."}`).
- `422`: validasi request; respons berisi `message` dan `errors`.
- `503`: layanan ML/model belum tersedia.
- `502`: respons upstream ML tidak valid.
