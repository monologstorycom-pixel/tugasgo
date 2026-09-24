# API Integrasi  — TugasGo

## Akses

```text
Base URL: http://192.168.1.202:3001/api
Username Admin: <ISI_USERNAME_ADMIN>
Password Admin: <KIRIM TERPISAH>
```

Akses hanya berfungsi  server TugasGo aktif.

## Autentikasi

### Login

```http
POST /auth/login
Content-Type: application/json
```

```json
{
  "username": "<USERNAME_ADMIN>",
  "password": "<PASSWORD_ADMIN>"
}
```

Server mengirim cookie `tugasgo_session`. Nilai cookie tidak perlu dimasukkan manual. Browser harus memakai `credentials: "include"` pada login dan semua request berikutnya.

```js
const API = 'http://192.168.1.202:3001/api'

await fetch(`${API}/auth/login`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: '<USERNAME_ADMIN>',
    password: '<PASSWORD_ADMIN>',
  }),
})
```

Postman menyimpan cookie login secara otomatis.

## Driver

### Ambil semua driver dan status

```http
GET /drivers
```

Contoh:

```js
const response = await fetch(`${API}/drivers`, {
  credentials: 'include',
})
const data = await response.json()
```

Contoh response:

```json
{
  "drivers": [
    {
      "id": 12,
      "name": "Budi",
      "username": "budi",
      "phone": "08123456789",
      "active": true,
      "division": "Operasional",
      "status": "AVAILABLE"
    }
  ]
}
```

Nilai `status`:

| Status | Arti |
|---|---|
| `AVAILABLE` | Aktif dan tersedia |
| `ON_TASK` | Sedang mengerjakan tugas |
| `ON_LEAVE` | Tidak masuk |
| `OFF_DUTY` | Driver sudah pulang |
| `DISABLED` | Akun dinonaktifkan |

### Tambah driver

```http
POST /drivers
Content-Type: application/json
```

```json
{
  "name": "Budi",
  "username": "budi",
  "password": "123456",
  "phone": "08123456789",
  "divisionId": 1
}
```

Ketentuan:

- `name`, `username`, dan `password` wajib.
- Password minimal 6 karakter.
- `username` harus unik.
- `phone` dan `divisionId` boleh dikosongkan.

### Ubah status menjadi libur

```http
PATCH /drivers/12/status
Content-Type: application/json
```

```json
{
  "status": "ON_LEAVE"
}
```

### Aktifkan kembali driver

```http
PATCH /drivers/12/status
Content-Type: application/json
```

```json
{
  "status": "AVAILABLE"
}
```

Contoh fungsi:

```js
async function updateDriverStatus(driverId, status) {
  const response = await fetch(`${API}/drivers/${driverId}/status`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })

  if (!response.ok) throw new Error((await response.json()).error)
  return response.json()
}
```

## Riwayat Tugas

### Ambil semua tugas

```http
GET /tasks
```

### Ambil tugas milik driver tertentu

```http
GET /tasks?driverId=12
```

### Filter berdasarkan status

```http
GET /tasks?driverId=12&status=COMPLETED
```

Status tugas yang tersedia:

- `WAITING`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`

### Pencarian tugas

```http
GET /tasks?driverId=12&q=antar
```

Filter dapat digabungkan:

```http
GET /tasks?driverId=12&status=COMPLETED&q=antar
```

### Detail dan timeline tugas

```http
GET /tasks/123
```

Response berisi data `task` dan daftar `events` seperti tugas dibuat, dimulai, diselesaikan, atau dibatalkan.

## Penanganan Error

Semua response error berbentuk:

```json
{
  "error": "Pesan error"
}
```

Status HTTP umum:

| HTTP | Arti |
|---|---|
| `400` | Data request tidak valid |
| `401` | Belum login atau sesi habis |
| `403` | Akun bukan Admin |
| `404` | Data atau endpoint tidak ditemukan |
| `500` | Kesalahan server |

Jika mendapat `401`, lakukan login ulang lalu ulangi request.

## Catatan

- Jangan menyimpan atau mengirim nilai cookie `tugasgo_session` secara manual.
- Jangan menaruh password Admin di source code.
- Kirim password Admin kepada penerima melalui pesan terpisah.
- IP `192.168.1.202` dapat berubah jika komputer server mendapat IP baru.
