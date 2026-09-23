# TugasGo — Planning & Roadmap

> Dokumen ini mencatat semua yang sudah selesai, sedang dikerjakan, dan rencana ke depan.
> Update setiap kali ada progress signifikan.

---

## Status Saat Ini

**Versi:** 0.1.0-dev  
**Stack:** React 19 + TypeScript + Vite | Node.js HTTP | MySQL | GCS | Google Maps | WebSocket  
**DB:** MySQL di 192.168.1.202:9754 (Docker)  
**Akses:** localhost:5173 (dev) | 192.168.1.116:5173 (LAN)

---

## ✅ Sudah Selesai

### Core (Phase 1)
- [x] Project setup — React + TypeScript + Vite + Node.js + MySQL
- [x] Auth — session cookie + scrypt password hashing
- [x] Role-based access — ADMIN / STAFF / DRIVER
- [x] Divisi — dynamic dari DB, CRUD oleh Admin
- [x] Driver — ACTIVE/INACTIVE, tidak bisa dihapus
- [x] Buat task — title, description, priority, driver, divisi, lokasi
- [x] Driver dashboard — antrean task dengan urutan benar
- [x] Start / Complete / Cancel task dengan validasi
- [x] Timer berbasis server timestamp
- [x] History & timeline task event
- [x] Seed data — Admin, Andi, Budi, Risen

### Location (Phase 2)
- [x] Google Maps embed di detail task
- [x] Places Autocomplete di form buat task
- [x] GPS tracking driver tiap 7 detik saat IN_PROGRESS
- [x] Live map di halaman Aktivitas (marker realtime)
- [x] Last known location tersimpan di DB
- [x] Completion GPS tersimpan saat task selesai

### Realtime
- [x] WebSocket — task update broadcast
- [x] WebSocket — notifikasi in-app
- [x] WebSocket — driver location broadcast
- [x] Auto-reconnect WebSocket

### Evidence (Phase 3)
- [x] Upload foto ke Google Cloud Storage (multipart)
- [x] Foto referensi di form buat task
- [x] Foto bukti saat selesaikan task
- [x] Signed URL untuk akses foto

### Management (Phase 4)
- [x] Notifikasi in-app dengan badge counter
- [x] Search + filter di History
- [x] Filter status, prioritas, tanggal
- [x] Report per driver (total, selesai, batal, durasi)
- [x] Report per divisi
- [x] Admin panel — CRUD user (driver, staff, admin), hapus permanen beserta data terkait
- [x] Admin panel — CRUD divisi, hapus permanen beserta tugas terkait
- [x] Edit user (nama, HP, divisi, password)
- [x] Toggle driver aktif/libur

### Fitur Tambahan
- [x] URGENT deadline — estimasi batas waktu + warning visual
- [x] Scheduling — jadwalkan task untuk waktu mendatang
- [x] Driver laporan Excel — export `.xlsx` dengan hyperlink foto
- [x] Hash routing — URL berubah sesuai halaman
- [x] PWA — manifest + service worker
- [x] Mobile responsive — bottom nav, semua halaman

---

## 🔄 Sedang / Akan Dikerjakan Berikutnya

### Guest Mode (Prioritas Tinggi)
- [x] Tabel `app_settings` di DB — simpan konfigurasi sistem
- [x] Endpoint `GET /api/settings` — public, hanya expose `guest_mode`
- [x] Endpoint `PATCH /api/admin/settings` — hanya Admin, key tervalidasi
- [x] Toggle "Guest Mode" di Admin panel
- [x] Halaman `/tugasgo` — form tanpa login saat Guest Mode ON
  - [x] Input nama pembuat (text, wajib)
  - [x] Dropdown divisi aktif dari DB
  - [x] Dropdown driver aktif dari DB
  - [x] Form task: title, lokasi, instruksi, prioritas, deadline, jadwal
  - [x] Upload foto referensi guest ke GCS
  - [x] Submit → task tersimpan dengan nama pembuat terstruktur dan divisi
- [x] Halaman utama `/` untuk login; login Staff dinonaktifkan saat Guest Mode ON
- [x] Guest memiliki 2 menu dengan UI sama seperti mode Staff: Buat Tugas dan Aktivitas
- [x] Aktivitas publik menampilkan timeline driver dan status tugas hari berjalan
- [x] Kalau Guest Mode OFF → link guest kembali ke halaman login
- [x] Validasi server untuk driver, divisi, koordinat, tanggal, file, dan transaksi notifikasi
- [x] Rate limiting untuk login, upload, dan pembuatan task guest

### Perbaikan UI
- [x] Audit responsif semua halaman pada viewport 320px, 375px, dan 768px
- [x] Perbaiki notif bell — panel dan touch target aman di mobile
- [x] Detail task di mobile — foto, teks panjang, dan meta block responsif
- [x] Form buat task di mobile — input, file, tanggal, dan Places Autocomplete minimal 44px
- [x] Admin panel responsif — tab scroll, form satu kolom, action button rapi
- [x] Laporan responsif — statistik 2 kolom dan tabel scroll terkontrol
- [x] Bottom navigation mendukung safe area perangkat

### Keamanan & Stabilitas
- [x] Rate limiting di API (login, upload, guest task)
- [x] Validasi file upload (magic bytes + type + size)
- [ ] Session expiry diperpanjang (saat ini 12 jam → 7 hari untuk "ingat saya")
- [ ] Error boundary di React — kalau komponen crash tidak crash seluruh app

---

## 📋 Backlog (Belum Diprioritaskan)

### Fitur
- [ ] Push notification ke HP driver (Web Push API)
- [ ] Filter driver di Staff dashboard
- [ ] Export laporan per divisi (Excel)
- [ ] Export laporan admin (semua driver, semua divisi)
- [ ] Notifikasi lewat WhatsApp/Telegram (opsional)
- [ ] Bulk assign task ke beberapa driver
- [ ] Task template — simpan task yang sering dibuat
- [ ] Komentar/chat per task

### Teknis
- [ ] Code splitting — lazy load halaman besar
- [ ] Image optimization sebelum upload ke GCS
- [ ] Cleanup old sessions dari DB (cron)
- [ ] Cleanup driver_locations lama dari DB (cron)
- [ ] Unit test untuk domain.mjs sudah ada — tambah integration test

---

## 🚀 Production Checklist

Sebelum deploy ke production (server 192.168.1.202):

- [ ] Nginx reverse proxy — semua lewat port 80/443
- [ ] SSL certificate (Let's Encrypt atau internal CA)
- [ ] PM2 untuk manage Node.js process
- [ ] Environment variables di server (bukan .env file)
- [ ] GCS CORS diupdate dengan domain production
- [ ] Google Maps API key restricted ke domain production
- [ ] Backup strategy untuk MySQL
- [ ] Log rotation
- [ ] Health check endpoint monitoring

---

## Credentials Dev

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `Admin123!@#$%` |
| Staff | `andi` | `Staff123!@#$%` |
| Staff | `budi` | `Staff123!@#$%` |
| Driver | `risen` | `Driver123!@#$%` |

---

## Cara Jalankan Dev

```cmd
start-server.bat
```

Buka: `http://localhost:5173` atau `http://192.168.1.116:5173`
