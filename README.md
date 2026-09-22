# TugasGo

Prototype UI/UX operasional tugas lapangan. Seluruh data dan interaksi memakai state lokal; tanpa backend, database, peta, atau penyimpanan eksternal.

## Jalankan

```bash
npm install
npm run dev
```

Buka URL lokal dari Vite. Pilih mode demo Admin, Staff, atau Driver.

## Alur prototype

- Staff membuat task, memantau aktivitas lintas divisi, dan melihat riwayat task buatannya.
- Driver melihat antrean miliknya, memulai timer, mengunggah beberapa bukti lokal, menyelesaikan, atau membatalkan task.
- Admin melihat ringkasan dan aktivitas seluruh divisi.
- Detail menyimpan timestamp, durasi, lokasi teks, foto referensi, bukti, catatan, dan alasan pembatalan selama sesi.

Data hilang setelah refresh. Peta/GPS, backend, database, R2, WebSocket, dan autentikasi nyata belum termasuk scope prototype.

Riwayat perubahan: [`CHANGELOG.md`](CHANGELOG.md). Catatan bug: [`docs/10-riwayat-bug.md`](docs/10-riwayat-bug.md).

## Validasi

```bash
npm run lint
npm run test
npm run build
```
