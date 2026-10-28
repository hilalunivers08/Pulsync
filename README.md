# Pulsync

Pulsync adalah web app transfer file yang ditujukan untuk penggunaan lokal: website boleh dibuka publik, tetapi isi file dikirim langsung antar-browser melalui WebRTC DataChannel. Akun, kode sesi, dan QR tidak dibutuhkan pada alur utama.

## Stack saat ini

- Frontend: React + TypeScript + Vite
- Backend: Go (`backend/`), termasuk REST API lama dan endpoint discovery/signaling P2P
- Transfer: WebRTC DataChannel dengan kandidat host lokal/private; server hanya menukar metadata signaling, bukan isi file
- UI: desain yang sudah ada, dengan font asli dan palet kuning/ungu/cyan dipertahankan

## Jalankan untuk pengujian LAN

Persyaratan: Node.js dan Go 1.22 atau lebih baru.

Terminal 1 — backend Go:

```sh
cd backend
go run .
```

Terminal 2 — frontend:

```sh
npm install
npm run dev -- --host 0.0.0.0
```

Di kedua perangkat, buka **alamat frontend yang sama** menggunakan IP LAN komputer server, misalnya `http://192.168.1.4:5173`. API akan diarahkan otomatis ke `http://192.168.1.4:8080` jika `VITE_API_BASE_URL` tidak diatur. Jangan memakai `localhost` di satu perangkat dan IP LAN di perangkat lainnya.

Jika Windows Firewall meminta izin, izinkan backend dan Vite hanya pada jaringan privat yang kamu percaya. Backend P2P kini berjalan pada port 8080 bersama API Pulsync lainnya; server PoC terpisah di `poc/discovery` tidak dibutuhkan untuk dashboard terintegrasi.

## Konfigurasi API

Secara default, `src/config.ts` membentuk URL backend dari hostname browser (`http://<hostname>:8080`). Untuk deployment yang menggunakan domain API terpisah, atur environment variable Vite:

```text
VITE_API_BASE_URL=https://api.domain-kamu.example
```

Backend signaling harus dapat dijangkau oleh browser, memakai HTTPS saat frontend dipublikasikan lewat HTTPS, dan dikonfigurasi di belakang reverse proxy tepercaya dengan benar. Jika proxy mengirim header `X-Forwarded-For`, set `PULSYNC_TRUST_PROXY=1` hanya bila proxy tersebut tepercaya dan menimpa header itu sendiri.

## Perilaku file sementara

- Maksimal 25 MiB per file dan 50 MiB total file yang diterbitkan pada PoC ini.
- File disediakan dari tab pengirim dan dapat diminta berulang kali selama masa aktif.
- Masa berlaku maksimal 10 menit.
- Jika setidaknya satu penerima sudah menerima katalog file lalu semua penerima tersebut tidak aktif selama 10 detik, file dihapus lebih awal.
- Pengirim harus membiarkan tab tetap terbuka; backend tidak menyimpan isi file. File hasil unduhan disimpan di memori browser penerima sampai diunduh/disimpan atau tab ditutup.

## Batasan dan keamanan

Discovery memakai pengelompokan alamat IP sebagai heuristik dan kandidat WebRTC host lokal/private. Ini **bukan bukti mutlak** bahwa dua perangkat ada pada SSID atau segmen LAN yang sama. VPN, NAT, browser, firewall, dan client isolation dapat mengubah perilakunya. Jika koneksi lokal tidak terbentuk, transfer harus gagal; isi file tidak boleh dialihkan ke server publik.

Integrasi ini masih tahap awal/eksperimental dan belum siap dipublikasikan sebagai layanan umum tanpa hardening lebih lanjut (validasi topologi LAN yang lebih kuat, rate limits, perlindungan signaling, HTTPS, pengujian cross-browser, serta uji jaringan nyata). Endpoint API lama `/api/upload` dan `/api/files` masih ada di backend untuk kompatibilitas, tetapi dashboard sekarang menggunakan transfer peer-to-peer lokal.

## Berkas penting

- `src/App.tsx`: dashboard, username, tema, dan navigasi
- `src/components/LocalTransferWorkspace.tsx`: bridge tersembunyi antara dashboard dan mesin transfer lokal
- `public/poc/discovery/index.html`: UI dan client WebRTC/DataChannel yang digunakan pada dashboard
- `backend/p2p_signaling.go`: endpoint discovery/signaling pada backend Go utama
- `poc/discovery/`: PoC mandiri asli untuk pengujian dan perbandingan
