# Laporan Cleaning Data Historis

- File sumber: `dataset_umkm.xlsx`
- Baris awal per sheet: {'Mei': {'initial': 17}, 'Juni': {'initial': 153}, 'Juli': {'initial': 130}, 'Agustus': {'initial': 100}, 'September': {'initial': 167}, 'Oktober': {'initial': 59}, 'November': {'initial': 80}}
- Baris valid akhir: 549
- Baris dibuang - tanggal tidak valid: 0
- Baris dibuang - quantity/total tidak valid: 0
- Baris dibuang - teks/kosong: 0
- Baris dibuang - duplikat persis dengan nomor urut sama: 150
- Tanggal diisi dari baris sebelumnya: 0
- Perbaikan spasi: 0
- Varian digabung karena beda kapital/spasi: 0
- Rentang tanggal akhir: 2026-05-29 sampai 2026-11-09

## Daftar varian akhir
- Bolen Tape Keju
- Mix Keju
- Pisbol Beef
- Pisbol Beef Tape (Mix)
- Pisbol Coklat
- Pisbol Coklat Beef (Mix)
- Pisbol Coklat Keju (Mix)
- Pisbol Coklat Tape (Mix)
- Pisbol Keju
- Pisbol Keju Coklat (Mix)
- Pisbol Keju Tape (Mix)
- Pisbol Pisang Coklat (Mix)
- Pisbol Smoked Beef
- Pisbol Tape
- Pisbol Tape Coklat (Mix)
- Pisbol Ubi Ungu
- Pisbol Ubi Ungu Beef (Mix)
- Pisbol Ubi Ungu Keju
- Pisbol Ubi Ungu Keju (Mix)
- Pisbol Ubi Ungu Pisang Keju (Mix)
- Pisbol Ubi Ungu Tape (Mix)
- Premium
- Premium Coklat
- Premium Keju
- Premium Keju Coklat (Mix)
- Premium Keju Tape (Mix)
- Premium Mix
- Premium Mix Tape Keju

## Saran varian mirip (belum digabung otomatis)

- `Pisbol Beef Tape (Mix)` mirip dengan: `Pisbol Keju Tape (Mix)`
- `Pisbol Coklat Beef (Mix)` mirip dengan: `Pisbol Coklat Tape (Mix)`, `Pisbol Coklat Keju (Mix)`
- `Pisbol Coklat Keju (Mix)` mirip dengan: `Pisbol Coklat Tape (Mix)`, `Pisbol Coklat Beef (Mix)`
- `Pisbol Coklat Tape (Mix)` mirip dengan: `Pisbol Coklat Keju (Mix)`, `Pisbol Coklat Beef (Mix)`
- `Pisbol Keju Coklat (Mix)` mirip dengan: `Pisbol Tape Coklat (Mix)`, `Pisbol Keju Tape (Mix)`
- `Pisbol Keju Tape (Mix)` mirip dengan: `Pisbol Beef Tape (Mix)`, `Pisbol Keju Coklat (Mix)`
- `Pisbol Pisang Coklat (Mix)` mirip dengan: `Pisbol Tape Coklat (Mix)`
- `Pisbol Tape Coklat (Mix)` mirip dengan: `Pisbol Keju Coklat (Mix)`, `Pisbol Pisang Coklat (Mix)`
- `Pisbol Ubi Ungu` mirip dengan: `Pisbol Ubi Ungu Keju`
- `Pisbol Ubi Ungu Beef (Mix)` mirip dengan: `Pisbol Ubi Ungu Tape (Mix)`, `Pisbol Ubi Ungu Keju (Mix)`
- `Pisbol Ubi Ungu Keju` mirip dengan: `Pisbol Ubi Ungu Keju (Mix)`, `Pisbol Ubi Ungu`
- `Pisbol Ubi Ungu Keju (Mix)` mirip dengan: `Pisbol Ubi Ungu Tape (Mix)`, `Pisbol Ubi Ungu Beef (Mix)`, `Pisbol Ubi Ungu Pisang Keju (Mix)`
- `Pisbol Ubi Ungu Pisang Keju (Mix)` mirip dengan: `Pisbol Ubi Ungu Keju (Mix)`
- `Pisbol Ubi Ungu Tape (Mix)` mirip dengan: `Pisbol Ubi Ungu Keju (Mix)`, `Pisbol Ubi Ungu Beef (Mix)`
- `Premium Keju Coklat (Mix)` mirip dengan: `Premium Keju Tape (Mix)`
- `Premium Keju Tape (Mix)` mirip dengan: `Premium Keju Coklat (Mix)`

## Baris menyimpang harga per pack

- Tidak ada penyimpangan terdeteksi.

## Bukti tahapan

- Gathering: inspeksi seluruh sheet dan header.
- Assessing: tipe, nilai kosong, duplikasi, dan anomali harga.
- Cleaning: parsing tanggal/uang/angka, normalisasi teks, dan penyimpanan CSV bersih.