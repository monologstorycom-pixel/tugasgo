Kontrak integrasi

API integrasi memerlukan Authorization: Bearer <LISTENER_API_KEY>. Halaman preview pada / tidak meminta kunci di browser, tetapi hanya dapat diakses langsung dari jaringan yang diizinkan oleh UI_ALLOWED_CIDRS; jangan publikasikan port preview melalui reverse proxy internet. API integrasi tetap harus dibatasi di firewall untuk backend HR Deck.

GET /api/v1/devices
POST /api/v1/devices
PATCH /api/v1/devices/:id
GET /api/v1/attendance?tanggal_awal=YYYY-MM-DD&tanggal_akhir=YYYY-MM-DD&device_id=...
GET /api/v1/version?tanggal_awal=YYYY-MM-DD&tanggal_akhir=YYYY-MM-DD&device_id=... untuk pemeriksaan ringan sebelum memuat ulang data.

Listener tidak menyediakan operasi hapus log, hapus pengguna, ubah waktu, membuka pintu, ataupun perubahan lain ke mesin.

Pada backend HR Deck, arahkan ATTENDANCE_LISTENER_BASE_URL ke alamat listener dan samakan ATTENDANCE_SERVICE_API_KEY dengan LISTENER_API_KEY. Listener menjadi satu-satunya sumber log dan master mesin. Mesin dapat ditambahkan dari tab Mesin absensi; nama, alamat, status, dan communication key tersimpan di direktori data listener. Communication key tidak dikirim kembali ke browser atau disimpan di database HR Deck.

Mesin awal 192.168.1.96:4370 didaftarkan satu kali sebagai Absensi Office saat direktori data masih baru. Setelah itu perubahan alamat, nama, dan status mesin dikelola dari HR Deck dan langsung disimpan oleh listener. Preview listener dan HR Deck membaca nama yang sama dari master listener.

Status koneksi diperbarui langsung probe ke mesin. Kanal event didaftarkan ulang secara ringan melalui EVENT_REGISTRATION_REFRESH_SECONDS (bawaan 30 detik) agar sesi realtime pulih bila ada koneksi lain yang mengambil alih registrasi. Seluruh validasi waktu memakai TIMEZONE, sehingga container UTC tetap menerima timestamp lokal mesin tanpa penundaan. Master PIN dan nama mesin diperiksa berkala melalui EMPLOYEE_SYNC_INTERVAL_SECONDS (bawaan 15 menit), sedangkan penarikan arsip log yang lebih besar berjalan di latar dan tetap dibatasi oleh HISTORY_SYNC_INTERVAL_SECONDS (bawaan 6 jam).Kontrak integrasi

API integrasi memerlukan Authorization: Bearer <LISTENER_API_KEY>. Halaman preview pada / tidak meminta kunci di browser, tetapi hanya dapat diakses langsung dari jaringan yang diizinkan oleh UI_ALLOWED_CIDRS; jangan publikasikan port preview melalui reverse proxy internet. API integrasi tetap harus dibatasi di firewall untuk backend HR Deck.

GET /api/v1/devices
POST /api/v1/devices
PATCH /api/v1/devices/:id
GET /api/v1/attendance?tanggal_awal=YYYY-MM-DD&tanggal_akhir=YYYY-MM-DD&device_id=...
GET /api/v1/version?tanggal_awal=YYYY-MM-DD&tanggal_akhir=YYYY-MM-DD&device_id=... untuk pemeriksaan ringan sebelum memuat ulang data.

Listener tidak menyediakan operasi hapus log, hapus pengguna, ubah waktu, membuka pintu, ataupun perubahan lain ke mesin.

Pada backend HR Deck, arahkan ATTENDANCE_LISTENER_BASE_URL ke alamat listener dan samakan ATTENDANCE_SERVICE_API_KEY dengan LISTENER_API_KEY. Listener menjadi satu-satunya sumber log dan master mesin. Mesin dapat ditambahkan dari tab Mesin absensi; nama, alamat, status, dan communication key tersimpan di direktori data listener. Communication key tidak dikirim kembali ke browser atau disimpan di database HR Deck.

Mesin awal 192.168.1.96:4370 didaftarkan satu kali sebagai Absensi Office saat direktori data masih baru. Setelah itu perubahan alamat, nama, dan status mesin dikelola dari HR Deck dan langsung disimpan oleh listener. Preview listener dan HR Deck membaca nama yang sama dari master listener.

Status koneksi diperbarui langsung probe ke mesin. Kanal event didaftarkan ulang secara ringan melalui EVENT_REGISTRATION_REFRESH_SECONDS (bawaan 30 detik) agar sesi realtime pulih bila ada koneksi lain yang mengambil alih registrasi. Seluruh validasi waktu memakai TIMEZONE, sehingga container UTC tetap menerima timestamp lokal mesin tanpa penundaan. Master PIN dan nama mesin diperiksa berkala melalui EMPLOYEE_SYNC_INTERVAL_SECONDS (bawaan 15 menit), sedangkan penarikan arsip log yang lebih besar berjalan di latar dan tetap dibatasi oleh HISTORY_SYNC_INTERVAL_SECONDS (bawaan 6 jam).

API Key: 9mZz0T9roUKIufSVWCl-lGFrnJo2uNuQj-_tZhlRT14

Device ID: f16df3576aa94baf

domain: https://absensi.rsby.cloud