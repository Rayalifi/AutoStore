# AutoStore V5 — Discord Auto-Store Bot

Bot Discord untuk toko produk digital otomatis dengan sistem saldo berbasis mata uang game **Growtopia** (**WL** / World Lock, **DL** / Diamond Lock, **BGL** / Blue Gem Lock) serta pembayaran **Rupiah via QRIS (Pakasir)**.

---

## ✨ Fitur Utama

- **Etalase Toko Otomatis (`/store`)**: Mendukung tampilan mode **Dropdown** maupun **Button**, dan otomatis me-refresh daftar produk, stok, jumlah terjual, serta rate DL setiap **10 detik**.
- **Pembelian & Pengiriman Otomatis**: Saldo user otomatis dipotong (dalam satuan WL), stok produk berkurang otomatis, dan item dikirim langsung ke DM pembeli dalam bentuk file `.txt` (atau balasan *ephemeral* jika DM tertutup).
- **Auto-Role Hadiah**: Produk dapat dihubungkan ke Discord Role (`roleId`) yang otomatis diberikan kepada pembeli setelah transaksi berhasil.
- **Topup Saldo QRIS Otomatis**: Terintegrasi dengan API **Pakasir** serta server webhook Express di port `3000` (`POST /callback`) untuk memproses pembayaran masuk dan mengonversinya ke saldo WL.
- **Auto-Deposit Growtopia**: Mendengarkan pesan webhook embed bertajuk `"Donation Log"` (dari script Lua Growtopia) untuk membaca `GrowID` dan item (`World Lock`, `Diamond Lock`, `Blue Gem Lock` / `BGL`), lalu menambahkan saldo user yang telah menautkan GrowID-nya.
- **Leaderboard Top Spender (`/leaderboard`)**: Papan peringkat pembeli terbanyak yang otomatis diperbarui setiap **30 detik**.
- **Auto-Deploy Slash Commands**: Seluruh slash command di folder `commands/` otomatis didaftarkan ke server Discord saat bot dinyalakan.

---

## 📋 Prasyarat

Pastikan Anda sudah menyiapkan:

1. **Node.js** (disarankan v18 atau lebih baru)
2. **MongoDB** (bisa menggunakan MongoDB lokal atau [MongoDB Atlas](https://www.mongodb.com/atlas))
3. **Aplikasi & Token Bot Discord** dari [Discord Developer Portal](https://discord.com/developers/applications)
   - Aktifkan **Privileged Gateway Intents** berikut di tab **Bot**:
     - **Server Members Intent**
     - **Message Content Intent**
4. **Akun Pakasir** (untuk fitur Topup QRIS otomatis)
5. **Ngrok / Reverse Proxy / Domain Publik** (jika menjalankan bot di PC lokal agar endpoint webhook `/callback` bisa diakses oleh Pakasir)

---

## 🚀 Cara Instalasi & Menjalankan

### 1. Clone Repository
```bash
git clone https://github.com/Rayalifi/AutoStore.git
cd AutoStore
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Konfigurasi Environment (`.env`)
Salin file `.env.example` menjadi `.env`:

- **Windows (PowerShell / CMD):**
  ```powershell
  copy .env.example .env
  ```
- **Linux / macOS:**
  ```bash
  cp .env.example .env
  ```

Lalu buka file `.env` dan isi variabel wajib berikut:

| Variabel | Keterangan |
| --- | --- |
| `DISCORD_TOKEN` | Token bot Discord Anda |
| `CLIENT_ID` | Application / Client ID bot Discord |
| `GUILD_ID` | ID server Discord tempat slash command didaftarkan |
| `ADMIN_IDS` | ID Discord admin/owner (pisahkan dengan koma jika lebih dari satu, misal `111,222`) |
| `MONGO_URI` | Connection string MongoDB Anda |
| `RATE_DL` | Harga 1 Diamond Lock dalam Rupiah (default: `15000`) |
| `CHANNEL_TOPUP_ID` | ID channel Discord untuk log topup & auto-deposit |
| `CHANNEL_BUY_ID` | ID channel Discord untuk log pembelian produk |
| `BANNER_URL` | URL gambar banner untuk embed toko & leaderboard |
| `PAKASIR_SLUG` | Slug project Pakasir Anda |
| `PAKASIR_API_KEY` | API Key Pakasir Anda |

> **Catatan:** Variabel `EMOJI_*` dan `BTN_*` bersifat opsional. Jika dikosongkan atau tidak diubah, bot akan memakai emoji standar bawaan.

### 4. Jalankan Bot
```bash
node index.js
```

Jika berhasil, di terminal akan muncul informasi bahwa database MongoDB terhubung, slash command berhasil didaftarkan, bot sudah online, dan server webhook berjalan di port `3000`.

### 5. Hubungkan Webhook QRIS (Opsional jika pakai Pakasir)
Agar saldo masuk otomatis setelah user membayar QRIS:
1. Ekspos port `3000` ke internet (contoh dengan ngrok: `ngrok http 3000`).
2. Pastikan URL `https://<domain-atau-ngrok-anda>/callback` dapat diakses (membuka endpoint `GET /callback` akan menampilkan `Webhook Server Aktif!`).
3. Masukkan URL `https://<domain-atau-ngrok-anda>/callback` ke pengaturan webhook di dashboard Pakasir.

---

## 🤖 Daftar Slash Commands

### Member / Umum
| Command | Deskripsi |
| --- | --- |
| `/store` | Menampilkan menu toko interaktif (pilih mode Dropdown / Button) |
| `/cekstock` | Melihat daftar produk, kode, harga, dan stok |
| `/cekbalance` | Melihat saldo WL/DL sendiri atau user lain |
| `/leaderboard` | Menampilkan papan peringkat Top Spender (auto-refresh 30 detik) |
| `/help` | Menampilkan daftar bantuan perintah |

### Khusus Admin
| Command | Deskripsi |
| --- | --- |
| `/addproduk` | Menambahkan produk baru ke toko |
| `/editproduk` | Mengubah nama, harga (Rp / WL), atau status aktif produk |
| `/deleteproduk` | Menghapus produk secara permanen |
| `/addstok` | Menambah stok produk via teks (pisah koma) atau upload file `.txt` |
| `/giveproduk` | Mengirim produk gratis ke DM user |
| `/addbalance` | Menambah saldo user |
| `/givebalance` | Menambah saldo user dengan pilihan mata uang (`Rp`, `DL`, `WL`) & kirim notifikasi DM |
| `/setbalance` | Mengatur ulang jumlah saldo user ke nominal tertentu |
| `/removebalance` | Mengurangi saldo user (`DL`, `WL`, `Rp`) |
| `/setworld` | Mengatur informasi World, Owner, dan Nama Bot untuk deposit DL |
| `/ratedl` | Mengubah rate harga 1 DL (disimpan ke database) |
| `/removefromleaderboard` | Menghapus user dari leaderboard (reset `totalSpent` ke `0`) |

---

## 📁 Struktur Proyek

```text
├── commands/           # Kumpulan file slash command Discord
├── models/             # Skema Mongoose (User, Product, Config)
├── index.js            # Entry point bot Discord, interaksi, webhook QRIS & auto-deposit
├── package.json        # Daftar dependencies Node.js
├── .env.example        # Contoh konfigurasi environment
└── .gitignore          # Daftar file sensitif/lokal yang dikecualikan dari Git
```

---

## ⚠️ Keamanan

- **Jangan pernah** membagikan atau meng-commit file `.env` yang berisi `DISCORD_TOKEN`, `MONGO_URI`, dan `PAKASIR_API_KEY` ke repository publik.
- Pastikan file `.gitignore` tetap aktif agar `.env`, `node_modules/`, dan file biner (`.exe`) tidak ikut ter-push ke GitHub.

