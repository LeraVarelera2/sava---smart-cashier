# Evaluasi Model Sava

## Prediksi omzet harian

- Status: trained
- Rentang historis: 2026-05-29 sampai 2026-11-09
- Jumlah hari dalam seri (hari tanpa transaksi diisi 0): 165
- MAE: Rp368,294.06
- RMSE: Rp482,530.86
- R²: 0.0125
- Split kronologis: 132 hari latih, 33 hari uji.
- Interpretasi: galat rata-rata sekitar Rp368,294 per hari; R² 0.0125 menunjukkan model belum kuat menjelaskan perubahan omzet.

Prediksi dimulai sehari setelah tanggal historis terakhir; tanggal historis terakhir tetap menjadi titik aktual terakhir pada grafik.

## Klasifikasi kinerja produk

- Status: trained
- Baris varian-minggu yang digunakan: 239
- Jumlah varian dikecualikan karena memiliki kurang dari 4 minggu data: 8
- Nama varian dikecualikan: Mix Keju, Pisbol Beef Ubi Ungu (Mix), Pisbol Keju Ubi Ungu (Mix), Pisbol Pisang Coklat (Mix), Pisbol Tape Beef (Mix), Pisbol Tape Ubi Ungu (Mix), Pisbol Ubi Ungu, Pisbol Ubi Ungu Pisang Keju (Mix)
- Akurasi latih: 0.7173
- Akurasi uji: 0.5000
- Batas kelas (dihitung dari baris latih): P33=0.00 pcs, P66=10.80 pcs.
- Interpretasi: akurasi uji masih sedang dan lebih rendah daripada akurasi latih; hasil belum cukup kuat untuk dianggap kepastian.
- Confusion matrix dan pohon tersimpan di `reports/confusion_matrix.png` dan `reports/decision_tree.png`.

## Keterbatasan

- Dataset historis terbatas dan ditulis manual; metrik evaluasi perlu dibaca sebagai indikasi, bukan jaminan hasil masa depan.
- Jumlah data yang kecil membuat akurasi cenderung sedang; tambah data historis sebelum mengandalkan prediksi atau klasifikasi untuk keputusan usaha.
- Varian dengan kurang dari 4 minggu data tidak dilatih dan ditandai `Data belum cukup` pada keluaran klasifikasi.