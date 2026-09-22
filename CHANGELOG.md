# Changelog

## 2026-09-22

### Ditambahkan
- Akses Aktivitas Driver lintas divisi untuk Staff.
- Assignment otomatis task prototype ke Risen Driver.
- Field nama lokasi, alamat lengkap, dan foto referensi pada pembuatan task.
- Timestamp `startedAt`, `completedAt`, `cancelledAt`; timer berbasis waktu mulai per task.
- Upload beberapa nama foto bukti lokal dan validasi minimal satu foto.
- Pembatalan task `WAITING` dengan alasan wajib.
- Detail status, waktu dibuat/dimulai/diselesaikan/dibatalkan, durasi, alamat, driver, foto referensi, dan bukti.
- Riwayat berbasis role; Driver melihat miliknya, Staff melihat task buatannya.
- Status `CANCELLED` pada daftar, timeline, detail, dan riwayat.

### Diperbaiki
- Aksi mulai, selesai, dan pembatalan dibatasi hanya untuk role Driver.
- Detail kembali ke halaman asal, termasuk Riwayat.
- Detail task aktif untuk Staff/Admin tidak lagi salah ditampilkan sebagai task dibatalkan.
- Timer tidak lagi kembali ke nilai hard-coded saat detail dibuka ulang.
- Form penyelesaian kembali ke daftar setelah konfirmasi sehingga tidak dapat dikonfirmasi berulang dari form lama.
- Task selesai menyimpan catatan, foto, timestamp selesai, dan durasi yang dapat ditampilkan.

### Verifikasi
- `npm run lint`
- `npm test`
- `npm run build`

### Batasan
- Semua data tetap berada di React state dan hilang setelah refresh.
- Peta, GPS, backend, database, R2, WebSocket, authentication nyata, dan deployment belum diimplementasikan sesuai batas prototype.
