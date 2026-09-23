# Changelog

## 2026-09-23 — Sesi besar (Phase 2–4 + fitur tambahan)

### Arsitektur & Refactor
- Pecah `App.tsx` (1500+ baris) menjadi struktur modular:
  - `src/types.ts` — semua TypeScript types
  - `src/lib/api.ts` — request helper, formatter, helpers
  - `src/lib/hooks.ts` — `useWebSocket`, `useGpsTracking`
  - `src/components/ui.tsx` — Badge, Logo, MapEmbed, PlacesAutocomplete
  - `src/components/Shell.tsx` — layout shell + nav sidebar + bottom nav
  - `src/components/Login.tsx` — halaman login
  - `src/components/TaskRow.tsx` — baris task list
  - `src/pages/Detail.tsx` — detail task + aksi driver
  - `src/pages/Dashboard.tsx` — StaffDashboard, DriverDashboard, AdminOverview, CreateTask
  - `src/pages/Activity.tsx` — live map + timeline
  - `src/pages/History.tsx` — riwayat + filter
  - `src/pages/Report.tsx` — laporan staff/admin
  - `src/pages/DriverReport.tsx` — laporan driver + export Excel
  - `src/pages/Admin.tsx` — manajemen user, driver, divisi
  - `App.tsx` tersisa ~105 baris (routing saja)

### Backend (server/)
- Node.js pure HTTP server tanpa framework
- MySQL via `mysql2/promise` — semua query parameterized
- Auth: session cookie HttpOnly + scrypt password hashing
- WebSocket native (`ws`) untuk realtime update
- Google Cloud Storage (`@google-cloud/storage`) — upload foto ke bucket `hr-deck`
- ExcelJS (`exceljs`) — generate laporan `.xlsx` driver dengan format rapi
- Endpoint baru:
  - `POST /api/location` — GPS tracking driver saat IN_PROGRESS
  - `GET /api/activity` — tasks + last known location semua driver
  - `POST /api/upload` — upload foto ke GCS (multipart)
  - `GET /api/export/driver` — generate & kirim `.xlsx` laporan driver
  - `GET /api/reports/drivers` — statistik per driver
  - `GET /api/reports/divisions` — statistik per divisi
  - `GET/POST /api/admin/users` — CRUD user
  - `PATCH /api/admin/users/:id` — edit/toggle user
  - `GET/POST /api/admin/divisions` — CRUD divisi
  - `PATCH /api/admin/divisions/:id` — edit/toggle divisi
  - `GET/POST /api/notifications` — notifikasi in-app
  - `POST /api/notifications/read` — mark all read

### Database (schema baru)
- Tabel baru: `driver_locations`, `driver_last_location`, `notifications`
- Kolom baru di `tasks`: `latitude`, `longitude`, `completion_latitude`, `completion_longitude`, `cancelled_by`, `urgent_deadline`, `scheduled_at`
- Kolom baru di `users`: `phone`
- Kolom baru di `tasks`: `urgent_deadline` (TIMESTAMP), `scheduled_at` (TIMESTAMP)

### Fitur Baru

#### Maps & GPS
- Google Maps embed di detail task dan form buat task
- Places Autocomplete — ketik nama lokasi, pilih dari suggestion, koordinat otomatis terisi + preview peta
- GPS tracking driver otomatis tiap 7 detik saat task IN_PROGRESS (Geolocation API)
- Live map di halaman Aktivitas — marker driver realtime via WebSocket
- Completion GPS tersimpan saat driver selesaikan task

#### Realtime WebSocket
- Task update otomatis ke semua user yang relevan
- Notifikasi in-app realtime — bell icon di header dengan badge counter
- Driver location broadcast ke Staff/Admin
- Auto-reconnect setelah koneksi terputus

#### Driver Flow
- Hash routing URL (`#/dashboard`, `#/activity`, dll) — URL berubah sesuai halaman, refresh tetap di halaman sama, browser back/forward jalan
- GPS tracking aktif otomatis saat task IN_PROGRESS
- Upload foto bukti ke GCS saat selesaikan task
- Completion GPS tersimpan

#### Fitur URGENT
- Field "Estimasi batas waktu" muncul saat buat task URGENT
- Warning visual: row merah muda + badge "LEWAT BATAS" + countdown timer di task list
- Detail task menampilkan sisa waktu atau sudah berapa lama lewat

#### Scheduling
- Field "Jadwalkan tugas" di form buat task (opsional, datetime picker)
- Task terjadwal tampil di antrean driver dengan badge oranye "DIJADWALKAN" + tanggal/jam
- Tombol "Mulai tugas" disabled dengan teks "Belum bisa dimulai" sampai waktu tiba
- Kotak info kuning di detail task kalau belum waktunya

#### Status Driver
- Admin panel tab "Driver" — daftar driver dengan status Aktif/Libur
- Toggle "Set Libur" / "Set Aktif" per driver
- Driver libur tidak muncul di dropdown buat task

#### Laporan Driver (Excel)
- Menu "Laporan saya" untuk driver (menggantikan Aktivitas + Riwayat)
- Tabel riwayat dengan filter status + tanggal
- Stats: total, selesai, batal, total durasi, rata-rata durasi
- Export `.xlsx` — format rapi: header hijau, row warna selang-seling, freeze header, auto-filter
- Kolom: No, Judul, Tujuan, Divisi, Prioritas, **Batas Waktu**, Status, Dibuat, Dimulai, Selesai, Durasi, Catatan, Foto Referensi (hyperlink), Foto Bukti (hyperlink)
- Durasi format human-readable: "2 jam 15 menit", "1 hari 3 jam 20 menit"
- Batas waktu URGENT: warna oranye, merah kalau sudah lewat

#### Admin Panel
- Tab: Driver, Pengguna, Divisi
- CRUD user (tambah, edit nama/HP/divisi/password, nonaktif/aktifkan)
- CRUD divisi (tambah, nonaktif/aktifkan)
- Edit user dengan form inline per baris

#### Dashboard
- Staff: filter status, prioritas, tanggal + panel driver aktif dengan durasi berjalan
- Admin: 8 stats (Total Driver, Driver Aktif, Total Tugas, Waiting, In Progress, Urgent, Selesai, Batal) + panel driver aktif + per divisi dinamis
- History: filter status + prioritas + tanggal + search + reset + counter hasil

#### PWA
- `manifest.json` + service worker — bisa diinstall di HP driver
- Offline fallback
- Push notification handler (untuk future)

#### UI/UX
- Responsive mobile-first — bottom nav, semua halaman sudah mobile
- Hash routing — URL ikut halaman
- Dev quick login (Admin/Staff/Driver) di halaman login — hilang di production
- TaskRow layout baru: info bertingkat, badge, deadline, jadwal semua terlihat jelas
- `cancelled_by` tersimpan saat driver batalkan task

### Seed Data
- Budi Accounting ditambahkan sebagai Staff Accounting
- Password seed: `Admin123!@#$%`, `Staff123!@#$%`, `Driver123!@#$%`

### Infrastruktur
- `start-server.bat` — jalankan backend + frontend sekaligus
- Vite `--host 0.0.0.0` — bisa diakses dari HP di jaringan lokal
- CORS menerima localhost dan semua IP 192.168.x.x:5173
- GCS key disimpan di luar folder project (`C:\Users\...\gcs-keys\`)
- `.gitignore` diupdate: `.env`, `*.json` (kecuali config), GCS keys

---

## 2026-09-22 — Phase 1 (Prototype UI/UX → Backend nyata)

### Ditambahkan
- Akses Aktivitas Driver lintas divisi untuk Staff.
- Assignment otomatis task ke Risen Driver.
- Field nama lokasi, alamat lengkap, dan foto referensi pada pembuatan task.
- Timestamp `startedAt`, `completedAt`, `cancelledAt`; timer berbasis waktu mulai per task.
- Upload beberapa nama foto bukti lokal dan validasi minimal satu foto.
- Pembatalan task WAITING dengan alasan wajib.
- Detail status, waktu dibuat/dimulai/diselesaikan/dibatalkan, durasi, alamat, driver, foto referensi, dan bukti.
- Riwayat berbasis role.

### Diperbaiki
- Aksi mulai, selesai, dan pembatalan dibatasi hanya untuk role Driver.
- Timer tidak lagi kembali ke nilai hard-coded saat detail dibuka ulang.

### Batasan
- Data hilang setelah refresh — prototype state lokal.
