# Attendance Service

Service lokal ini membaca data pegawai dan log scan mesin X606-S melalui SOAP SDK. Data disimpan sebagai file mentah berpartisi per bulan dan disediakan melalui HTTP API untuk HR Deck.

Service hanya memakai perintah baca:

- `GetAllUserInfo` untuk PIN dan nama pengguna mesin.
- `GetAttLog` dengan PIN `All` untuk seluruh scan dalam satu permintaan.

Service tidak menghitung kehadiran, shift, keterlambatan, durasi, lembur, atau ketidakhadiran. Perhitungan tersebut dilakukan oleh backend HR Deck.

## Menjalankan

Persyaratan: Node.js 20 atau lebih baru.

1. Salin `.env.example` menjadi `.env`.
2. Isi alamat mesin, port, communication key, dan `SERVICE_API_KEY` acak minimal 32 karakter.
3. Jalankan `npm start`.
4. Buka `https://mesin.rsby.cloud` untuk halaman pencarian.

Service cocok dijalankan melalui Windows Service Manager, Task Scheduler, PM2, atau service manager lain yang dapat menghidupkan ulang proses ketika server restart.

## Penyimpanan

Folder `data` dibuat otomatis dan tidak masuk Git:

- `employees.json`: snapshot PIN dan nama terbaru.
- `attendance-YYYY-MM.ndjson`: scan mentah per bulan.
- `state.json`: waktu sinkronisasi dan slot jadwal terakhir.

Kombinasi PIN dan waktu scan menjadi kunci duplikasi. Scan identik disimpan sekali, sedangkan scan berbeda pada hari yang sama tetap dipertahankan. File bulan hanya ditulis ulang ketika isinya berubah. Data yang lebih lama dari `ATTENDANCE_RETENTION_DAYS` dibuang.

## API

Semua endpoint `/api/v1/*` memerlukan salah satu header berikut:

```http
Authorization: Bearer <SERVICE_API_KEY>
```

atau:

```http
x-service-key: <SERVICE_API_KEY>
```

### Status service

```http
GET /health
```

### Pegawai mesin

```http
GET /api/v1/employees?nama=andi&pin=25
```

Filter `nama` menggunakan pencarian sebagian dan tidak membedakan huruf besar-kecil. Filter `pin` harus cocok penuh.

### Log absensi

```http
GET /api/v1/attendance?nama=andi&pin=25&tanggal_awal=2026-09-01&tanggal_akhir=2026-09-30&limit=1000&offset=0
```

Contoh respons:

```json
{
  "berhasil": true,
  "data": [
    {
      "pin": "25",
      "nama": "Nama Karyawan",
      "waktu": "2026-09-24 08:12:00",
      "verified": "1",
      "status": "0"
    }
  ],
  "meta": {
    "total": 1,
    "limit": 1000,
    "offset": 0,
    "tanggal_awal": "2026-09-01",
    "tanggal_akhir": "2026-09-30",
    "last_sync": "2026-09-24T01:15:00.000Z"
  }
}
```

Rentang dibatasi oleh masa retensi. Satu respons maksimal 5.000 baris; gunakan `offset` untuk mengambil halaman berikutnya.

### Sinkronisasi manual

```http
POST /api/v1/sync
```

Gunakan `?pegawai=true` bila snapshot pengguna mesin juga perlu dipaksa diperbarui.

## Kondisi data yang dipertahankan

- PIN dinormalisasi sebagai teks numerik agar PIN panjang tidak kehilangan presisi.
- Log dengan PIN yang belum ada pada snapshot pegawai tetap disimpan dan dikirim dengan `nama: null`.
- Scan sesudah tengah malam tetap memakai waktu asli dari mesin.
- Satu scan tidak dipaksa menjadi pasangan masuk dan keluar.
- Banyak scan berbeda dalam satu hari tetap dikirim seluruhnya.
- Penarikan data tidak mengubah atau menghapus data pada mesin.

## Integrasi TugasGo

TugasGo memakai log absensi untuk menentukan ketersediaan driver secara otomatis. Integrasi berjalan di backend TugasGo dan hanya membaca Attendance Service.

### Konfigurasi

```env
APP_TIMEZONE=Asia/Jakarta
ATTENDANCE_API_URL=https://absensi.rsby.cloud
ATTENDANCE_API_KEY=<nilai LISTENER_API_KEY milik Attendance Service>
```

`ATTENDANCE_API_KEY` pada TugasGo harus memiliki nilai yang sama persis dengan `SERVICE_API_KEY` pada Attendance Service. Secret hanya boleh tersedia saat runtime dan tidak boleh memakai awalan `VITE_`.

### Aturan sinkronisasi

- Scheduler TugasGo memeriksa sinkronisasi setiap lima menit.
- Sinkronisasi status hanya dijalankan setelah pukul 10.00 pada zona waktu `APP_TIMEZONE`.
- Semua halaman log absensi untuk tanggal berjalan dibaca hingga selesai.
- TugasGo memproses ulang status ketika `last_sync` dari Attendance Service berubah. Tanggal proses terakhir dicatat sebagai `attendance_last_sync_date`, sedangkan versi sumber terakhir dicatat sebagai `attendance_last_source_sync` di `app_settings`.
- Nama driver dicocokkan dengan `nama` pada log absensi tanpa membedakan huruf besar-kecil dan dengan spasi yang dinormalisasi.
- Driver aktif yang namanya ditemukan dan belum memiliki scan pukul 16.30 atau sesudahnya mendapat status `AVAILABLE`.
- Driver aktif yang memiliki scan pukul 16.30 atau sesudahnya mendapat status `OFF_DUTY` dan ditampilkan sebagai **Driver sudah pulang**.
- Driver aktif yang namanya tidak ditemukan pada log hari itu mendapat status `ON_LEAVE` dan ditampilkan sebagai **Tidak masuk**.
- Driver nonaktif tidak diubah.
- Bila Attendance Service gagal, timeout, mengembalikan respons tidak valid, atau menolak API key, seluruh status dibiarkan tetap.
- Lock database mencegah dua instance TugasGo menjalankan sinkronisasi bersamaan.

### Perubahan manual dan driver baru

Admin tetap dapat mengubah status driver secara manual. Perubahan manual bertahan sampai Attendance Service menghasilkan `last_sync` baru dan TugasGo memproses ulang status.

Driver baru ikut diperiksa pada pembaruan Attendance Service berikutnya setelah pukul 10.00. Nama driver di TugasGo harus sama dengan nama pada mesin absensi agar dapat dicocokkan.

### Verifikasi operasional

Sinkronisasi hari ini dapat diperiksa melalui:

```sql
SELECT val, updated_at
FROM app_settings
WHERE setting_key = 'attendance_last_sync_date';
```

Status driver dapat diperiksa melalui:

```sql
SELECT name, availability_status
FROM users
WHERE role = 'DRIVER' AND active = TRUE
ORDER BY name;
```
