# Sava Design System

Dokumentasi ini merangkum nilai yang sudah dipakai di `frontend/src/styles.css` dan implementasi React. Tidak ada token visual baru yang ditambahkan.

## Token warna

| Token | Hex | Pemakaian |
|---|---|---|
| `--forest` | `#18382d` | Sidebar, tombol utama, teks/aksen gelap |
| `--forest-2` | `#245643` | Aksen, tautan, navigasi aktif, grafik omzet |
| `--lime` | `#c9ed63` | Aksen merek, tombol/ikon aktif |
| `--lime-soft` | `#eff8cf` | Latar sukses dan hijau lembut |
| `--warm` | `#f7f5ed` | Latar aplikasi |
| `--surface` | `#fffefa` | Kartu dan permukaan |
| `--ink` | `#1b2a24` | Teks utama |
| `--muted` | `#4f5d57` | Teks sekunder dengan kontras lebih kuat |
| `--border` | `#dde3dc` | Border dan pemisah |
| `--apricot` | `#f3b884` | Garis prediksi |
| `--danger` | `#a63d40` | Aksi/error berbahaya |
| `--danger-soft` | `#fff0ec` | Latar error |
| `--success` | `#355139` | Status sukses |
| `--success-soft` | `#eff8cf` | Latar sukses |
| `--warning` | `#815d17` | Status peringatan |
| `--warning-soft` | `#fff2d6` | Latar peringatan |
| `--info` | `#50718d` | Status informasi |
| `--info-soft` | `#eef4ed` | Latar informasi |

Warna pendukung yang dipakai langsung pada CSS meliputi putih, `#edf3e8`, `#edf0eb`, `#e8ede7`, dan abu-abu netral. Grafik menggunakan `var(--forest-2)` untuk omzet/aktual dan `var(--apricot)` untuk prediksi putus-putus; grid grafik `#e8ede7`.

## Tipografi

- Keluarga: Poppins, diimpor lokal dari `@fontsource/poppins`.
- Bobot yang dimuat: 400, 500, 600, 700. Bobot 800 dipakai untuk marka logo.
- Skala tipografi: judul halaman 22–24 px dengan bobot 600; judul kartu/panel 16–18 px dengan bobot 600; deskripsi 13–14 px dengan bobot normal dan warna sekunder; angka KPI Dashboard 22–24 px (20 px pada layar kecil), line-height 1.2, dan angka tabular; teks tabel 14 px; label kecil/chip 12–13 px. Metadata dan label kontrol dapat memakai 9–12 px.
- Skala diterapkan lintas halaman: judul halaman/login 22–24 px; judul keranjang, bagian profil, katalog, modal, dan panel 16–18 px; teks penjelas memakai warna sekunder. Line-height umumnya rapat untuk angka dan sekitar 1.6 untuk teks deskriptif.

## Jarak, radius, bayangan

- Jarak dibuat per komponen (belum ada skala spacing token tersendiri); nilai yang sering muncul: 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, dan 38 px.
- Token radius utama: `--radius: 14px`. Variasi komponen yang telah ada: 7–12 px; kartu login 16 px; kontrol pill 999 px; avatar 50%.
- Bayangan kartu: `--shadow: 0 12px 34px rgba(37, 70, 55, .08)`.
- Variasi yang sudah dipakai: tombol `0 7px 18px rgba(24,56,45,.12)`, kartu login/modal `0 24px 70px ...`, toast `0 14px 36px rgba(24,56,45,.18)`, serta bayangan navigasi bawah.

## Komponen dan varian

- Navigasi: sidebar desktop, item biasa/aktif, navigasi bawah mobile, item aktif dengan latar lime.
- Tombol: primary (forest), secondary, icon, text, danger, refresh, serta state hover/disabled.
- Form: label, input, textarea, select dengan panah kustom yang konsisten, fokus dengan ring, pencarian katalog.
- Kartu: panel produk/katalog, keranjang, ringkasan profil, metrik, panel dashboard, rekomendasi bundling.
- Kasir: baris produk, ikon produk, kontrol jumlah, hapus item, total nota, keadaan keranjang kosong.
- Katalog: kartu produk, baris varian aktif/nonaktif, dialog edit/tambah, status dot.
- Dialog/toast: modal konfirmasi, toast sukses/error/info dengan tombol tutup.
- Dashboard: tab Ringkasan/Prediksi/Produk/Bundling, baris penjelas diikuti kotak "Cara membaca" terpisah yang selalu terlihat dengan ikon buku, poin ceklis hijau, dan subjudul kelompok pada Bundling; filter, kartu sorotan dan metrik, panel grafik/tabel, tooltip grafik yang mengikuti titik/batang aktif dan terjangkar relatif ke chart, confusion matrix, segmented control, serta rekomendasi paket dengan label bahasa sehari-hari. Setiap tab mengakhiri konten dengan kotak Kesimpulan berlatar `--lime-soft`, aksen tepi hijau, ikon, judul 16–18 px, dan teks 14 px dengan line-height 1.6.
- Login: catatan bawah satu baris, rata tengah, dan tidak membungkus pada layar kecil.
- Feedback: loading spinner dengan pesan dan skeleton pendukung, empty state, dashboard error, badge klasifikasi `laris`/`kurang laris`/`tidak laris`.

## Breakpoint responsif

- `max-width: 900px`: sidebar disembunyikan, navigasi bawah tampil, tata letak satu kolom untuk kasir/profil/dashboard/bundling.
- `max-width: 520px`: padding dan ukuran heading lebih rapat; filter dan metrik dua kolom; form varian menjadi satu kolom; modal menjadi lembar bawah; baris kasir menyesuaikan lebar.
- Lebar minimum halaman: 320 px.

## Halaman dan alur pengguna

- **Login** (`/login`): masuk dengan email/password.
- **Dashboard** (`/dashboard`): ringkasan dan filter; tab prediksi, analisis produk, serta bundling.
- **Kasir** (`/kasir`): pilih varian, ubah jumlah, tinjau total, simpan transaksi.
- **Katalog** (`/katalog`): tambah/ubah produk dan varian; produk ber-riwayat dinonaktifkan, bukan dihapus dari histori.
- **Profil** (`/profil`): lihat dan ubah informasi usaha.

Alur singkat: login → dashboard untuk memeriksa kinerja → kasir untuk mencatat penjualan → katalog/profil untuk mengelola data → kembali ke dashboard untuk melihat analisis terbaru. Logout mengakhiri sesi dan kembali ke login.
