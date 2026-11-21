# Laporan Cleaning Data Historis

- File sumber: `dataset_umkm.xlsx`
- Baris awal per sheet: {'Mei': {'initial': 17}, 'Juni': {'initial': 153}, 'Juli': {'initial': 130}, 'Agustus': {'initial': 100}, 'September': {'initial': 167}, 'Oktober': {'initial': 59}, 'November': {'initial': 80}}
- Baris valid akhir: 699

## Perbandingan baris dan total harga per sheet

| Sheet | Baris Excel | Baris CSV | Total Excel | Total CSV |
|---|---:|---:|---:|---:|
| Mei | 16 | 16 | Rp1,104,000 | Rp1,104,000 |
| Juni | 152 | 152 | Rp16,372,000 | Rp16,372,000 |
| Juli | 129 | 129 | Rp13,333,000 | Rp13,333,000 |
| Agustus | 99 | 99 | Rp11,733,000 | Rp11,733,000 |
| September | 166 | 166 | Rp14,882,000 | Rp14,882,000 |
| Oktober | 58 | 58 | Rp9,812,000 | Rp9,812,000 |
| November | 79 | 79 | Rp4,905,000 | Rp4,905,000 |
| **Total** | **699** | **699** | **Rp72,141,000** | **Rp72,141,000** |

## Pemeriksaan nomor urut No.

| Sheet | Baris bernomor | Kosong | Nomor unik | Berurutan 1..n |
|---|---:|---:|---:|---|
| Mei | 16 | 0 | 16 | Ya |
| Juni | 152 | 0 | 152 | Ya |
| Juli | 129 | 0 | 129 | Ya |
| Agustus | 99 | 0 | 99 | Ya |
| September | 166 | 0 | 166 | Ya |
| Oktober | 58 | 0 | 58 | Ya |
| November | 79 | 0 | 79 | Ya |

- Baris dibuang - tanggal tidak valid: 0
- Baris dibuang - quantity/total tidak valid: 0
- Baris dibuang - teks/kosong: 0
- Baris dibuang - salinan sumber yang benar-benar identik (termasuk No.): 0
- Baris yang aturan deduplikasi lama keliru buang (disimpan di `ml-service\reports\dropped_duplicates.csv`): 150; seluruhnya dipertahankan pada CSV baru.
- Tanggal diisi dari baris sebelumnya: 0
- Perbaikan spasi: 0
- Varian digabung karena beda kapital/spasi: 0
- Nama varian Mix yang urutan rasanya dinormalisasi: 7
- Rentang tanggal akhir: 2026-05-29 sampai 2026-11-09

## Daftar varian akhir
- Bolen Tape Keju
- Mix Keju
- Pisbol Beef
- Pisbol Beef Ubi Ungu (Mix)
- Pisbol Coklat
- Pisbol Coklat Beef (Mix)
- Pisbol Coklat Keju (Mix)
- Pisbol Coklat Tape (Mix)
- Pisbol Keju
- Pisbol Keju Tape (Mix)
- Pisbol Keju Ubi Ungu (Mix)
- Pisbol Pisang Coklat (Mix)
- Pisbol Smoked Beef
- Pisbol Tape
- Pisbol Tape Beef (Mix)
- Pisbol Tape Ubi Ungu (Mix)
- Pisbol Ubi Ungu
- Pisbol Ubi Ungu Keju
- Pisbol Ubi Ungu Pisang Keju (Mix)
- Premium
- Premium Coklat
- Premium Coklat Keju (Mix)
- Premium Keju
- Premium Keju Tape (Mix)
- Premium Mix
- Premium Mix Tape Keju

## Saran varian mirip (belum digabung otomatis)

- `Pisbol Beef Ubi Ungu (Mix)` mirip dengan: `Pisbol Tape Ubi Ungu (Mix)`, `Pisbol Keju Ubi Ungu (Mix)`
- `Pisbol Coklat Beef (Mix)` mirip dengan: `Pisbol Coklat Tape (Mix)`, `Pisbol Coklat Keju (Mix)`, `Pisbol Tape Beef (Mix)`
- `Pisbol Coklat Keju (Mix)` mirip dengan: `Pisbol Coklat Tape (Mix)`, `Pisbol Coklat Beef (Mix)`
- `Pisbol Coklat Tape (Mix)` mirip dengan: `Pisbol Coklat Keju (Mix)`, `Pisbol Coklat Beef (Mix)`
- `Pisbol Keju Ubi Ungu (Mix)` mirip dengan: `Pisbol Tape Ubi Ungu (Mix)`, `Pisbol Beef Ubi Ungu (Mix)`
- `Pisbol Tape Beef (Mix)` mirip dengan: `Pisbol Coklat Beef (Mix)`
- `Pisbol Tape Ubi Ungu (Mix)` mirip dengan: `Pisbol Keju Ubi Ungu (Mix)`, `Pisbol Beef Ubi Ungu (Mix)`
- `Pisbol Ubi Ungu` mirip dengan: `Pisbol Ubi Ungu Keju`
- `Pisbol Ubi Ungu Keju` mirip dengan: `Pisbol Ubi Ungu`

## Baris menyimpang harga per pack

- Tidak ada penyimpangan terdeteksi.

## Bukti tahapan

- Gathering: inspeksi seluruh sheet dan header.
- Assessing: tipe, nilai kosong, duplikasi, dan anomali harga.
- Cleaning: parsing tanggal/uang/angka, normalisasi teks, dan penyimpanan CSV bersih.