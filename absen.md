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