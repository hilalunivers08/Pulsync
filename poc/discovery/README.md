# Pulsync Browser-only Discovery + Temporary File Transfer PoC

Eksperimen terpisah untuk menguji discovery otomatis, koneksi WebRTC kandidat lokal, dan daftar file sementara yang diunduh melalui DataChannel. Dashboard utama Pulsync tidak diubah.

## Menjalankan

Persyaratan: Go 1.22+.

```sh
cd poc/discovery
go run .
```

Buka URL yang sama pada dua perangkat di LAN. Contoh bila IP LAN komputer yang menjalankan server adalah `192.168.1.4`:

```text
http://192.168.1.4:8081
```

Gunakan alamat yang sama di komputer server dan penerima, bukan `localhost` pada salah satu perangkat. Jalankan hanya satu server Go. Jika Windows Firewall meminta izin, izinkan akses pada jaringan privat yang dipercaya.

## Uji file sementara

1. Tunggu kedua perangkat muncul dalam daftar dan status koneksi langsung terbuka.
2. Pada pengirim, pilih file berukuran maksimal 25 MiB lalu tekan **Sediakan 10 menit**.
3. Pada penerima, file muncul pada daftar **File dari perangkat lain**. Tekan **Ambil file** untuk meminta transfer.
4. Setelah transfer selesai, klik **Simpan ke perangkat** pada bagian Transfer diterima.
5. Uji meminta file yang sama lagi, lalu uji TTL 10 menit dan penghapusan setelah semua penerima yang sudah melihat katalog tidak aktif selama 10 detik.

Mode **Uji kirim langsung** tetap tersedia di bagian detail untuk regresi protokol transfer lama.

Transfer menggunakan pesan kontrol JSON dan potongan biner 16 KiB melalui WebRTC DataChannel reliable/ordered. Pengirim menunggu ACK setelah browser penerima menyusun file dan memverifikasi ukuran yang diterima.

## Yang diuji

- Peer mendaftar ke signaling server menggunakan ID tab acak.
- Signaling server hanya mempertemukan peer pada bucket IP yang sama.
- Browser membuat koneksi WebRTC tanpa STUN/TURN.
- SDP hanya mempertahankan kandidat host yang tampak lokal/private; kandidat server-reflexive, relay, dan alamat IP global dibuang.
- Isi file dikirim langsung melalui DataChannel; backend tidak menerima isi file.
- Ukuran transfer dibatasi 25 MiB per file pada PoC ini.

## Batasan penting

1. Ini PoC, bukan implementasi produksi. Jangan dipublikasikan ke internet tanpa hardening, HTTPS, pembatasan trafik, logging yang tepat, dan peninjauan keamanan.
2. Penyamaan bucket IP hanyalah heuristik, bukan bukti bahwa perangkat berada di SSID atau segmen LAN yang sama. Pembatasan kandidat ICE juga bukan bukti matematis; uji pada topologi jaringan nyata tetap diperlukan.
3. Kandidat host berbeda berdasarkan browser, OS, VPN, firewall, dan konfigurasi router. Client isolation dapat menghalangi koneksi di Wi-Fi yang sama.
4. Tidak ada STUN/TURN yang dikonfigurasi. Jika koneksi langsung gagal, PoC seharusnya gagal, bukan mengalihkan isi file ke relay.
5. File yang disediakan tidak disimpan di server: objek File tetap berada di tab pengirim hingga TTL habis, tidak ada penerima aktif selama 10 detik setelah file telah diumumkan ke penerima, pengirim menghapusnya, atau tab sumber ditutup. Pengirim wajib membiarkan halaman tetap terbuka agar file dapat diunduh.
6. Penerima melihat metadata katalog dan meminta file melalui DataChannel. Setelah transfer lengkap, Blob hasil transfer berada di memori tab penerima sampai disimpan ke perangkat atau halaman ditutup.
7. Batas 25 MiB per file dan 50 MiB total file terbitan adalah batas PoC. Perilaku timer, putus sambungan, beberapa perangkat, serta kebijakan LAN-only harus diuji pada jaringan nyata sebelum penggunaan publik.
8. `PULSYNC_TRUST_PROXY=1` hanya boleh diaktifkan ketika server berada di belakang reverse proxy tepercaya yang menimpa `X-Forwarded-For`.

## Diagnosis discovery

Terminal Go mencetak `REGISTER` untuk setiap browser yang mendaftar dan `DISCOVERY` yang menunjukkan bucket IP serta jumlah peer yang cocok. Pastikan dua perangkat memakai URL server LAN yang sama dan nilai `bucket=` cocok.
