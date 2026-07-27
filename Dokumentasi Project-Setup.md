# 📖 Dokumentasi Setup, Pengoperasian & Deployment MyStream Studio

Dokumen ini berisi panduan lengkap cara menjalankan proyek, membuka database SQLite, serta langkah-langkah mendepoloy aplikasi MyStream Studio ke publik.

---

## 🚀 1. Cara Menjalankan Proyek (Running Project)

Terdapat 2 metode untuk menjalankan proyek ini di laptop/komputer Anda:

### Metode A: 1-Click Launcher (Paling Praktis) ⭐
1. Buka folder proyek: `c:\laragon\www\my-youtube-clone`.
2. **Klik 2x (Double Click)** pada file **`start.bat`** atau **`start-mystream.bat`**.
3. Otomatis MediaMTX server, Database SQLite, dan Web Next.js akan berjalan bersamaan, serta membuka browser ke `http://localhost:3000`.

### Metode B: Manual Terminal Step-by-Step
Jika ingin menjalankan lewat terminal CMD / PowerShell secara terpisah:

1. **Terminal 1 (Menjalankan Streaming Server MediaMTX)**:
   ```cmd
   C:\mediamtx\mediamtx.exe
   ```
   *(Biarkan jendela terminal ini tetap terbuka di background)*.

2. **Terminal 2 (Menjalankan Web Server Next.js)**:
   ```cmd
   cd c:\laragon\www\my-youtube-clone
   npm run dev
   ```

3. **Buka Browser**:
   Akses `http://localhost:3000`.

---

## 🎥 Konfigurasi di OBS Studio (Bagi Pengguna/Streamer)

1. Buka OBS Studio > **Settings** > **Stream**.
2. **Service**: Pilih `Custom...`
3. **Server URL**: `rtmp://restream.awgverse.site/live` *(atau `rtmp://127.0.0.1:1935/live` untuk lokal)*.
4. **Stream Key**: Masukkan Stream Key Permanen Unik akun Anda (`awg_live_xxxxxx`).
5. **Output (Pengaturan Video Low Latency)**:
   * **Output Mode**: Advanced > tab **Streaming**.
   * **Keyframe Interval**: `2s`
   * **Max B-frames**: `0` *(Wajib diisi 0 agar WebRTC low latency preview bekerja lancar < 0.5s)*.

---

## 🗄️ 2. Cara Membuka & Mengelola Database SQLite (`prisma/dev.db`)

Semua data Akun User, Password (ter-hash bcrypt), RTMP Destinations, dan Stream Key tersimpan di file SQLite: `prisma/dev.db`.

### Opsi 1: Menggunakan Prisma Studio (Browser Bawaan - Paling Mudah) ⭐
1. Buka terminal di folder proyek (`c:\laragon\www\my-youtube-clone`).
2. Jalankan perintah:
   ```bash
   npx prisma studio
   ```
3. Browser akan otomatis membuka alamat **`http://localhost:5555`**.
4. Anda dapat melihat, mengedit, dan menghapus data tabel **User** dan **Destination** secara visual.

### Opsi 2: Menggunakan Aplikasi Desktop "DB Browser for SQLite"
1. Download gratis di: [https://sqlitebrowser.org/](https://sqlitebrowser.org/)
2. Buka aplikasi > Klik **Open Database**.
3. Pilih file `c:\laragon\www\my-youtube-clone\prisma\dev.db`.
4. Klik tab **Browse Data** untuk melihat daftar user & stream key.

### Opsi 3: Menggunakan Extension VS Code
1. Install extension **`SQLite Viewer`** di VS Code.
2. Klik kanan file `prisma/dev.db` di VS Code > pilih **Open With SQLite Viewer**.

---

## 🌐 3. Cara Deploy Proyek Ke Publik (Public Deployment)

### Opsi A: Cloudflare Tunnel (Gratis, Auto-SSL HTTPS, Tanpa Port Forwarding) ⭐
Cocok untuk menjalankan proyek dari laptop rumah dengan domain gratis:

1. **Jalankan Mode Production**:
   ```bash
   npm run build
   npm run start
   ```
2. **Download `cloudflared.exe`** dari Cloudflare.
3. **Jalankan Perintah Tunnel**:
   ```cmd
   cloudflared.exe tunnel --url http://localhost:3000
   ```
4. Hubungkan CNAME domain Anda (misal `restream.awgverse.site`) di DNS Cloudflare ke tunnel ini.

### Opsi B: Custom Domain Ingest RTMP (`rtmp://restream.awgverse.site/live`)
1. Di DNS Management domain Anda (`awgverse.site`), buat **A-Record**:
   * **Name**: `restream`
   * **IPv4**: *(IP Publik Internet Rumah Anda)*
2. Di Modem/Router Rumah:
   * Forward Port **`1935`** (RTMP) dan Port **`8889`** (WebRTC) ke IP Lokal Laptop Anda.

### Opsi C: Deploy di VPS Cloud (Rekomendasi Skala Bisnis SaaS - Rp 95rb/bulan)
Untuk penggunaan komersial di mana laptop tidak perlu menyala 24 jam:

* **Spesifikasi VPS Rekomendasi**:
  * 2 vCPU / 2 GB RAM / 40 GB NVMe SSD / 3 TB Traffic Bandwidth.
  * Harga: ± $6/bulan (sekitar **Rp 95.000 / bulan**).
* **Kelebihan Deploy VPS**:
  * Mendapatkan 1 **Dedicated Public IPv4**.
  * Server aktif 24/7 dengan Uptime 99.99%.
  * Laptop Anda bebas dimatikan kapan saja.
  * Sanggup menampung hingga **277 Sesi Live Streaming 2-Jam** setiap bulan.

---

## 📁 Struktur Repositori & GitHub

* **URL Repositori GitHub**: [https://github.com/studentawangihti/mystream.git](https://github.com/studentawangihti/mystream.git)
* **File Peluncur 1-Click**: `start.bat` / `start-mystream.bat`
* **File Database SQLite**: `prisma/dev.db`
* **File Dokumen Workflow**: `WORKFLOW_FREE_VS_PRO.txt`

---
*Copyright by **awgxidn** © 2026. All Rights Reserved.*
