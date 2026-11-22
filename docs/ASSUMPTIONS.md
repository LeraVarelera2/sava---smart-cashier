# Asumsi Tahap 2

- Dataset utama dipilih sebagai satu-satunya file `.xlsx` di folder `data/`.
- Data simulasi dibuat untuk 30 hari kalender sampai tanggal hari ini, masing-masing 15 transaksi per hari, dengan pola jam 07.00-20.59.
- Jam 15.00-17.00 diberi puncak tertinggi, 07.00-08.00 diberi puncak sedang, dan seluruh simulasi menggunakan `mt_srand(42)` agar deterministik.
- Keranjang historis menggunakan satu transaksi per baris CSV dengan `basket_key=D-YYYY-MM-DD`, karena dataset lama tidak memiliki identitas transaksi individual.
- Harga katalog varian historis menggunakan modus `harga_per_pack`; pada transaksi historis, `unit_price` memakai harga per pack pada baris CSV dan `subtotal` memakai `total_harga` asli agar omzet tetap sama dengan sumber.
- Data historis berakhir pada 9 November 2026; data transaksi setelah tanggal itu adalah simulasi atau transaksi kasir, bukan bagian dari data latih historis.
- Forecast memakai seri historis sampai 9 November sebagai titik aktual terakhir dan memprediksi hari berikutnya; transaksi simulasi/kasir tidak menggeser tanggal awal forecast.
- Keranjang historis hanya dapat direkonstruksi sebagai satu keranjang per hari (`D-YYYY-MM-DD`); workbook tidak menyimpan ID transaksi untuk memisahkan pembelian pada hari yang sama. Basis bundling historis karena itu dapat menghasilkan asosiasi yang terlalu luas.
- Timestamp/jam tidak tersedia pada data historis. Analisis jam hanya merepresentasikan data simulasi atau transaksi kasir yang memang memiliki `transacted_at`; bukan pola jam aktual historis.
- Data latih dan jumlah contoh tiap kelas masih kecil. Delapan dari 23 varian memiliki kurang dari empat minggu data dan tidak dilatih oleh klasifikasi; prediksi dan akurasi perlu dianggap indikatif.
- Smoke test melakukan login lalu menyimpan tepat satu transaksi kasir dan tidak menghapusnya. Pastikan Laravel diarahkan ke `sava_test` untuk tes; jalankan terhadap `sava` hanya bila transaksi tambahan memang dikehendaki.
- `migrate:fresh --seed` bersifat destruktif untuk database yang dikonfigurasi. Seeder mengisi data historis dari CSV dan data simulasi deterministik; hanya jalankan pada database baru/kosong yang memang disiapkan untuk inisialisasi.
