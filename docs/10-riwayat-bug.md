# Riwayat Bug

## 2026-09-22 — Gap alur prototype terhadap PRD

### 1. Staff tidak dapat membuka Aktivitas Driver
- Gejala: menu Staff tidak memiliki halaman Aktivitas.
- Dampak: acceptance flow langkah 8 terblokir.
- Perbaikan: tambah menu Aktivitas untuk Staff; halaman tetap menampilkan tugas lintas divisi.

### 2. Timer task tidak persisten selama sesi
- Gejala: detail task `IN_PROGRESS` selalu dimulai dari `00:12:22`.
- Penyebab: durasi hard-coded di state komponen.
- Perbaikan: simpan `startedAt` pada task; hitung durasi dari timestamp tersebut. Task selesai memakai selisih `completedAt - startedAt`.

### 3. Bukti penyelesaian hilang
- Gejala: hanya satu nama file dapat dipilih; bukti tidak disimpan di task; form dapat tetap terbuka setelah selesai.
- Perbaikan: dukung pemilihan beberapa file, wajibkan minimal satu foto, simpan nama file ke `photos`, simpan `completedAt`, lalu kembali ke daftar.
- Batas prototype: file tidak diunggah; hanya metadata nama file berada di state lokal.

### 4. Pembatalan task belum tersedia
- Gejala: task `WAITING` tidak memiliki aksi pembatalan.
- Perbaikan: tambah form pembatalan dengan alasan wajib serta penyimpanan `cancelledAt` dan `cancelReason`.

### 5. Data pembuatan dan detail task belum lengkap
- Gejala: tidak ada assignee, alamat terpisah, foto referensi, status eksplisit, atau timestamp proses.
- Perbaikan: assignment otomatis ke satu driver demo aktif; tambah nama lokasi, alamat, foto referensi; tampilkan status, waktu proses, durasi, driver, dan bukti pada detail.

### 6. Riwayat tidak dibatasi berdasarkan role
- Gejala: Staff melihat semua task selesai; task batal tidak masuk riwayat.
- Perbaikan: Staff hanya melihat task buatannya; Driver hanya melihat task miliknya; riwayat mencakup `COMPLETED` dan `CANCELLED`.

### 7. Aksi task dapat dijalankan oleh role non-Driver
- Gejala: Staff yang membuka detail dapat melihat tombol mulai, selesai, atau batalkan.
- Perbaikan: aksi transisi hanya dirender ketika role aktif adalah Driver.

### 8. Tombol kembali detail kehilangan halaman asal
- Gejala: detail yang dibuka dari Riwayat kembali ke Dashboard.
- Perbaikan: simpan halaman asal saat detail dibuka dan gunakan kembali saat keluar.

### 9. Detail task aktif salah tampil sebagai dibatalkan
- Gejala: Staff/Admin yang membuka task `WAITING` atau `IN_PROGRESS` melihat panel pembatalan dengan alasan kosong.
- Penyebab: fallback ternary menganggap semua status non-completed sebagai cancelled setelah tombol Driver disembunyikan.
- Perbaikan: render panel selesai dan dibatalkan dengan cabang status eksplisit; task aktif non-Driver tidak menampilkan panel aksi/status terminal.

## Regression guard
`check-sort.mjs` memeriksa field, otorisasi aksi, navigasi kembali, dan marker alur utama selain status, sorting, branding, dan timeline yang sudah ada.

## Verifikasi
- `npm run lint`: lulus tanpa warning.
- `npm test`: lulus.
- `npm run build`: lulus.
