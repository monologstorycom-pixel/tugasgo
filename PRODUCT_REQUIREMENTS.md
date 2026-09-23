# TugasGo — Product Requirements

## 1. Maksud dan Tujuan

TugasGo adalah sistem internal perusahaan untuk mengelola pekerjaan driver:

> Staff membuat tugas → driver menerima dan melihat tugas → driver mulai bekerja → lokasi dapat dipantau → driver mengunggah bukti → driver menyelesaikan tugas → seluruh riwayat tersimpan.

Target akhir adalah aplikasi operasional yang sederhana, cepat, mudah dipakai, dan dapat dikembangkan menuju production tanpa mengubah alur inti.

## 2. Scope Saat Ini: Prototype UI/UX

Scope aktif saat ini hanya prototype frontend interaktif:

- UI responsif dan mobile-first untuk Driver.
- Alur dapat diklik menggunakan local/mock state.
- Tidak ada backend, REST API, MySQL, R2, WebSocket, atau Google Maps asli.
- Placeholder eksternal harus diberi label jelas.
- Prototype menjadi acuan visual dan alur sebelum implementasi backend.

Prototype bukan production system dan data tidak persisten setelah halaman dimuat ulang.

## 3. Nama dan Prinsip Produk

Nama produk wajib **TugasGo** pada project, login, header, dashboard, dokumentasi, dan data demo.

Prinsip:

- Functionality lebih penting daripada dekorasi.
- Clean, sederhana, profesional, cepat.
- Jangan terlihat seperti template AI generik.
- Jangan menambah requirement tanpa persetujuan.
- Jangan membuat deadline, overdue, atau due-date warning.
- Gunakan **task age** untuk tugas yang belum dikerjakan.
- Jangan hard delete driver atau task/history pada implementasi final.

## 4. Role

### ADMIN

- Mengelola user, driver, dan division.
- Melihat semua task, driver, lokasi, aktivitas, history, dan report.
- Mengaktifkan/menonaktifkan driver.

### STAFF

- Membuat task.
- Melihat dan mengelola task yang menjadi kewenangannya.
- Melihat aktivitas dan lokasi semua driver lintas division.
- Tidak boleh mengedit atau menghapus task milik staff/division lain.

### DRIVER

- Melihat task miliknya.
- Membuka detail dan lokasi tujuan.
- Memulai task.
- Melihat timer.
- Mengirim lokasi saat task aktif.
- Mengunggah bukti dan catatan.
- Menyelesaikan atau membatalkan task sesuai izin.
- Melihat history miliknya.

## 5. Master Data

### Division

Dynamic, bukan hard-coded pada implementasi final. Admin dapat create, edit, activate, dan deactivate.

Contoh: IT, GA, Purchasing, Accounting, Marketing, Operasional, HRD.

### Driver

Field minimum: nama, nomor HP, username, authentication, status ACTIVE/INACTIVE.

Driver yang tidak bekerja lagi menjadi INACTIVE, bukan dihapus, agar history tetap utuh.

## 6. Create Task

Field:

- Creator otomatis dari user login.
- Division dari master data.
- Driver hanya ACTIVE.
- Jika satu driver ACTIVE, pilih otomatis; jika lebih dari satu, tampilkan dropdown.
- Priority: NORMAL atau URGENT; default NORMAL.
- Title.
- Description/instruction.
- Reference photo.
- Location: location_name, address, latitude, longitude.

URGENT adalah prioritas pengerjaan. Untuk tugas URGENT, staff dapat menentukan estimasi batas waktu penyelesaian. Jika tugas URGENT belum selesai melewati estimasi tersebut, sistem menampilkan warning visual. Driver tetap dapat mengerjakan kapanpun, namun sistem memberi tanda visual bahwa waktu estimasi sudah terlewat.

## 7. Status dan Urutan Task

Status resmi:

- `WAITING`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`

Transisi:

- `WAITING → IN_PROGRESS → COMPLETED`
- `WAITING → CANCELLED`

Urutan dashboard Driver:

1. `IN_PROGRESS`
2. `URGENT`, paling lama dibuat lebih dahulu
3. `NORMAL`, paling lama dibuat lebih dahulu

Task WAITING menampilkan:

> Sudah X hari X jam belum dikerjakan

## 8. Driver Flow

### Detail

Tampilkan judul, description, creator, division, priority, created time, task age, reference photo, lokasi, alamat, peta, dan status.

### Mulai Tugas

Tombol **MULAI TUGAS** mengubah `WAITING` menjadi `IN_PROGRESS`.

Implementasi backend nanti wajib:

- Menggunakan waktu server untuk `started_at`.
- Memulai timer berdasarkan timestamp server.
- Memulai GPS tracking task.
- Memperbarui aktivitas driver.

### Timer

Saat aktif: `current server time - started_at`.

Saat selesai: `completed_at - started_at`.

### Selesaikan Tugas

Driver dapat mengunggah beberapa foto dan menambah catatan. Saat selesai, simpan `completed_at`, completion latitude/longitude, durasi, dan ubah status ke `COMPLETED`.

### Cancel Task

Cancellation wajib memiliki reason dan menyimpan `cancelled_at`, `cancelled_by`, serta `cancel_reason`.

## 9. Location dan Driver Activity

Tracking tidak perlu 24 jam. Tracking terutama aktif saat task `IN_PROGRESS`.

Staff/Admin dapat melihat:

- Driver.
- Last known location dan last update.
- Current task dan division task.
- Start time dan duration.
- Status aktivitas.

Staff boleh melihat aktivitas lintas division untuk memahami antrean driver, tetapi tidak mendapat hak edit task division lain.

## 10. Foto dan Storage Final

Gunakan Cloudflare R2. Jangan menyimpan binary foto di MySQL.

Flow final:

1. Frontend meminta presigned URL ke backend.
2. Frontend mengunggah langsung ke R2.
3. Backend menyimpan metadata/object key.

Jenis foto: `REFERENCE` dan `COMPLETION`.

## 11. Timeline dan History

Timeline harus menyimpan event penting: task dibuat, diberikan, dimulai, tracking dimulai, bukti diunggah, diselesaikan, dibatalkan, dan completion GPS tersimpan.

History tidak boleh dihapus.

Akses:

- Driver: history miliknya.
- Staff: history task buatannya.
- Admin: seluruh history.

## 12. Dashboard dan Report

### Staff Dashboard

- Tugas Saya.
- Filter status, priority, driver, date.
- Driver Activity lintas division.
- Map posisi driver.

### Admin Dashboard

- Total/Active Driver.
- Waiting, Urgent, In Progress, Completed, Cancelled task.
- Semua task, driver, activity, map, history, division, user, report.

### Report

Per Driver: total, completed, cancelled, waiting, in progress, total duration, average duration.

Per Division: total, completed, waiting, in progress, cancelled.

## 13. Notification Event Final

Struktur minimum:

- `TASK_CREATED`
- `TASK_STARTED`
- `TASK_COMPLETED`
- `TASK_CANCELLED`

Prototype tidak membutuhkan notification system kompleks.

## 14. Target Arsitektur Final

Stack final yang disepakati:

- Frontend: React/Next.js + TypeScript dalam bentuk PWA.
- Backend: Node.js + TypeScript + REST API.
- Database: MySQL.
- Realtime: WebSocket/Socket.IO.
- Maps: Google Maps melalui environment variable.
- GPS: Geolocation API dari HP Driver.
- Storage foto: Cloudflare R2.

```text
TugasGo
│
├── Frontend
│   └── React / Next.js PWA
│
├── Backend
│   └── Node.js + TypeScript
│
├── Database
│   └── MySQL
│
├── Realtime
│   └── WebSocket / Socket.IO
│
├── Maps
│   └── Google Maps
│
├── GPS
│   └── GPS HP Driver
│
└── Foto
    └── Cloudflare R2
```

Alur aplikasi final wajib nyata:

`Frontend → API → Backend → MySQL → API → Frontend`

### Alur GPS Aktif

Tracking aktif terutama ketika task berstatus `IN_PROGRESS`. HP Driver mengirim koordinat setiap 5–10 detik selama tracking aktif.

```text
HP Risen
   │
   │ GPS setiap 5–10 detik
   ▼
Node.js API
   │
   ├── MySQL
   │   └── simpan lokasi terakhir dan history
   │
   └── WebSocket / Socket.IO
          │
          ▼
     Dashboard Staff/Admin
          │
          ▼
     Google Maps
```

Ketentuan:

- Pengiriman GPS berhenti setelah task selesai/dibatalkan atau tracking dinonaktifkan.
- Backend memvalidasi driver, task aktif, latitude, longitude, accuracy, dan timestamp penerimaan server.
- MySQL menyimpan last known location serta location history yang diperlukan.
- WebSocket mengirim pembaruan near realtime ke Dashboard Staff/Admin.
- Interval 5–10 detik dapat disesuaikan nanti berdasarkan baterai, jaringan, dan beban server tanpa mengubah alur inti.

## 15. Security Final

- Authentication dan password hashing.
- JWT/session aman.
- Role-based authorization pada API.
- Driver hanya mengakses task miliknya.
- Staff tidak mengubah task milik staff/division lain.
- Admin memiliki akses penuh.
- Validasi request dan upload.
- Secret R2, Maps, dan database tidak boleh berada di source code.
- Timestamp penting menggunakan waktu server.

## 16. Entity Minimum Final

- users
- roles
- divisions
- drivers
- tasks
- task_photos
- task_locations/location data
- driver_locations
- task_timeline
- notifications

Gunakan foreign key dan index yang sesuai. Schema dapat disesuaikan jika memberi struktur lebih baik tanpa mengubah requirement inti.

## 17. Tahapan Pengembangan

### Phase 1 — Core

Project setup, database, authentication, roles, division, driver, create/list/detail task, driver dashboard, start/complete task, timestamp, duration, history.

### Phase 2 — Location

Google Maps, task location, last location, GPS tracking, driver activity, live map, WebSocket.

### Phase 3 — Evidence

Cloudflare R2, reference photo, completion photos, notes, timeline.

### Phase 4 — Management

Notification, search, filter, reports, cross-division visibility, admin management.

Setiap phase wajib diuji terintegrasi sebelum lanjut.

## 18. Data Demo Prototype

Users:

- Admin
- Andi — Staff Purchasing
- Budi — Staff Accounting
- Risen — Driver

Divisions:

- IT
- Purchasing
- Accounting
- GA

Tasks:

- Beli Kabel LAN — NORMAL — Purchasing — Risen
- Antar Dokumen Kontrak — URGENT — Accounting — Risen

## 19. Acceptance Flow Utama

1. Login berdasarkan role.
2. Staff membuat task.
3. Task masuk antrean Driver.
4. URGENT tampil di atas NORMAL setelah task aktif.
5. Task lama menampilkan task age.
6. Driver membuka detail dan memulai task.
7. Status menjadi `IN_PROGRESS`; timer berjalan.
8. Staff melihat aktivitas Driver lintas division.
9. Implementasi location mengirim dan menampilkan GPS.
10. Driver mengunggah evidence.
11. Driver menyelesaikan task menjadi `COMPLETED`.
12. History menampilkan created, started, completed, duration, location, dan photos.

## 20. Batasan Eksekusi Saat Ini

Dokumen ini menyimpan visi produk final. Implementasi repository saat ini tetap dibatasi pada **prototype UI interaktif** sampai Bos Bagyo memberi instruksi eksplisit untuk memulai backend, database, integrasi eksternal, deployment, atau production rollout.
