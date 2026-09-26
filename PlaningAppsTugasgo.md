# Planing & Arsitektur Native App TugasGo

Dokumen ini adalah blueprint dan panduan integrasi lengkap untuk pengembangan **Aplikasi Mobile Native (Driver & Staff)** pada ekosistem TugasGo.

---

## 1. Arsitektur Sistem

```
 ┌────────────────────────────────────────────────────────┐
 │            Mobile App (Android / iOS)                  │
 │      (Flutter / React Native / Jetpack Compose)        │
 └──────┬──────────────┬───────────────┬───────────────┬──┘
        │ REST (Bearer)│ WebSocket     │ Direct Upload │ FCM Push
        ▼              ▼               ▼               ▼
 ┌──────────────┬──────────────┐ ┌───────────┐ ┌───────────────┐
 │ TugasGo API  │  WS Server   │ │   Google  │ │   Firebase    │
 │ (Node.js)    │  (Port 3001) │ │   Cloud   │ │ Cloud Message │
 └──────┬───────┴──────┬───────┘ │  Storage  │ │     (FCM)     │
        │              │         └─────▲─────┘ └───────▲───────┘
        ▼              ▼               │               │
 ┌─────────────────────────────┐       │               │
 │     MySQL Database          │       │               │
 │ (Users, Tasks, Locations,   ├───────┴───────────────┘
 │  Devices, App Settings)     │
 └──────────────▲──────────────┘
                │ Cron (5s)
 ┌──────────────┴──────────────┐
 │ Mesin Absensi Cloud RSBY    │
 └─────────────────────────────┘
```

---

## 2. Fitur Backend Khusus Native App

### A. Push Notifications (FCM Device Token)
Notifikasi masuk ke status bar driver meskipun layar HP mati / aplikasi sedang di latar belakang.
* **Tabel Database**: `user_devices` (user_id, token, platform, app_version, last_active_at).
* **Endpoint Register Token**:
  - `POST /api/device/push-token`
  - Headers: `Authorization: Bearer <token>`
  - Body:
    ```json
    {
      "token": "fcm_device_token_dari_firebase",
      "platform": "ANDROID",
      "appVersion": "1.0.0"
    }
    ```
* **Endpoint Unregister Token (Saat Logout)**:
  - `DELETE /api/device/push-token`
  - Body: `{ "token": "fcm_device_token_dari_firebase" }`

### B. Batch Offline GPS Tracking (Hemat Baterai & Anti Putus Sinyal)
Driver di jalan sering mengalami *blank spot* sinyal. Mobile app menyimpan antrean koordinat di memori lokal HP (SQLite / Hive), lalu mengirimkan sekaligus saat sinyal kembali online.
* **Endpoint Batch GPS**:
  - `POST /api/locations/batch`
  - Headers: `Authorization: Bearer <driver_token>`
  - Body:
    ```json
    {
      "locations": [
        { "latitude": -7.250445, "longitude": 112.768845, "accuracy": 12.5, "recordedAt": "2026-09-26T08:15:00.000Z" },
        { "latitude": -7.251200, "longitude": 112.769100, "accuracy": 10.0, "recordedAt": "2026-09-26T08:15:15.000Z" }
      ]
    }
### C. Direct Presigned URL Upload (Foto Bukti Cepat & Ringan)
Foto kamera HP langsung di-upload dari HP ke Google Cloud Storage tanpa melewati bandwidth server Node.js.
* **Endpoint Minta URL Upload**:
  - `POST /api/uploads/request-url`
  - Headers: `Authorization: Bearer <token>`
  - Body:
    ```json
    {
      "photoType": "COMPLETION",
      "contentType": "image/jpeg",
      "ext": "jpg"
    }
    ```
  - Response:
    ```json
    {
      "uploadUrl": "https://storage.googleapis.com/hr-deck/completion/...",
      "readUrl": "https://storage.googleapis.com/hr-deck/completion/...",
      "key": "completion/7/1727339182-x89f.jpg",
      "method": "PUT",
      "headers": { "Content-Type": "image/jpeg" }
    }
    ```
* **Cara Eksekusi dari App**:
  1. Mobile app panggil `POST /api/uploads/request-url`.
  2. Mobile app lakukan HTTP `PUT` biner file foto langsung ke `uploadUrl`.
  3. Kirim `key` foto tersebut saat update status task di `PATCH /api/tasks/:id/status`.

### D. App Version Check & Force Update
Memberi instruksi ke aplikasi jika ada pembaruan wajib di Play Store.
* **Endpoint Cek Versi**:
  - `GET /api/app/version` (Public)
  - Response:
    ```json
    {
      "minVersion": "1.0.0",
      "latestVersion": "1.0.2",
      "downloadUrl": "https://tugasgo.rsby.cloud/download",
      "updateNotes": "Peningkatan performa tracking GPS dan notifikasi tugas"
    }
    ```

---

## 3. Daftar Endpoint Lengkap untuk Native App

| Kategori | Method | Endpoint | Keterangan |
|---|---|---|---|
| **Auth** | `POST` | `/api/auth/login` | Login user (Staff / Driver / Admin) |
| **Auth** | `POST` | `/api/auth/logout` | Logout & cabut sesi |
| **Auth** | `GET` | `/api/auth/me` | Ambil profil user & role saat ini |
| **Tasks** | `GET` | `/api/tasks` | Ambil daftar tugas aktif & selesai |
| **Tasks** | `POST` | `/api/tasks` | Buat tugas baru (Staff / Admin) |
| **Tasks** | `PATCH`| `/api/tasks/:id/status` | Update status (`IN_PROGRESS`, `COMPLETED`, `CANCELLED`) |
| **Tasks** | `GET` | `/api/tasks/:id/timeline` | Riwayat timeline aksi tugas |
| **GPS** | `POST` | `/api/location` | Kirim koordinat real-time tunggal (Driver) |
| **GPS** | `POST` | `/api/locations/batch` | Kirim antrean koordinat offline (Driver) |
| **Device** | `POST` | `/api/device/push-token`| Daftarkan token FCM HP |
| **Device** | `DELETE`| `/api/device/push-token`| Hapus token FCM HP |
| **Upload** | `POST` | `/api/uploads/request-url`| Minta URL upload foto langsung ke GCS |
| **App** | `GET` | `/api/app/version` | Cek versi & force update |
| **Socket**| `WS` | `/ws` | Realtime push events |

---

## 4. Struktur Flow Driver Mobile App

### 1. Saat Aplikasi Dibuka:
1. `GET /api/app/version` -> jika `app_version < minVersion`, tampilkan modal wajib update.
2. Jika ada token lokal: `GET /api/auth/me`.
3. Ambil FCM Token perangkat -> panggil `POST /api/device/push-token`.
4. Konek ke WebSocket `wss://tugasgo.rsby.cloud/ws` dengan header bearer / auth handshake.

### 2. Saat Menerima Tugas Baru:
1. Notifikasi FCM muncul di HP ("Tugas Baru: Antar Berkas ke RSUD...").
2. Driver tap notifikasi -> Buka detail tugas.
3. Driver klik **"Mulai Kerjakan"** -> `PATCH /api/tasks/:id/status` `{ status: "IN_PROGRESS" }`.

### 3. Background GPS Tracker Berjalan:
1. Mobile app menyalakan Background Location Service.
2. Setiap 10-15 detik, ambil koordinat GPS.
3. Jika internet aktif -> kirim via `POST /api/location`.
4. Jika tidak ada sinyal -> tampung di antrean lokal SQLite.
5. Begitu sinyal kembali -> kirim semua via `POST /api/locations/batch`.

### 4. Menyelesaikan Tugas:
1. Driver ambil foto bukti via kamera HP.
2. App request upload URL -> `POST /api/uploads/request-url`.
3. App upload foto via HTTP `PUT` ke `uploadUrl`.
4. App kirim request selesai:
   ```json
   PATCH /api/tasks/123/status
   {
     "status": "COMPLETED",
     "note": "Sudah diserahkan ke bagian penerimaan",
     "photos": ["completion/7/1727339182-x89f.jpg"],
     "completionLatitude": -7.250445,
     "completionLongitude": 112.768845
   }
   ```
5. Matikan Background GPS Service.

---

## 5. Rekomendasi Tech Stack Mobile App

1. **Framework**: **Flutter** (Pilihan terbaik: single codebase untuk Android & iOS, performa tinggi, support background service & FCM sangat matang).
2. **State Management**: **Riverpod** / **Bloc**.
3. **Local Storage (Offline Buffer)**: **Hive** / **Isar** / **Drift (SQLite)**.
4. **Background Location**: `flutter_background_service` + `geolocator`.
5. **Push Notification**: `firebase_messaging` + `flutter_local_notifications`.

---

## 6. Environment Tambahan untuk Push Notification (FCM)

Tambahkan di backend jika ingin mengaktifkan push notifikasi Firebase:
```env
FCM_SERVER_KEY=AAAA... (Server key dari Firebase Console)
```
*(Jika belum diisi, backend otomatis fallback aman dan notifikasi tetap berjalan lancar via WebSocket)*.

    ```
  - Response: `{ "ok": true, "saved": 2 }`
