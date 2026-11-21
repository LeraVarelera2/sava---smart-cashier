# Asumsi Tahap 2

- Dataset utama dipilih sebagai satu-satunya file `.xlsx` di folder `data/`.
- Data simulasi dibuat untuk 30 hari kalender sampai tanggal hari ini, masing-masing 15 transaksi per hari, dengan pola jam 07.00-20.59.
- Jam 15.00-17.00 diberi puncak tertinggi, 07.00-08.00 diberi puncak sedang, dan seluruh simulasi menggunakan `mt_srand(42)` agar deterministik.
- Keranjang historis menggunakan satu transaksi per baris CSV dengan `basket_key=D-YYYY-MM-DD`, karena dataset lama tidak memiliki identitas transaksi individual.
- Harga katalog varian historis menggunakan modus `harga_per_pack`; pada transaksi historis, `unit_price` memakai harga per pack pada baris CSV dan `subtotal` memakai `total_harga` asli agar omzet tetap sama dengan sumber.
