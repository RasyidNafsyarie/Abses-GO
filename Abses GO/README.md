# Absensi GO - Sistem Absensi Siswa

Aplikasi **Sistem Absensi Siswa** berbasis web menggunakan **Flask (Python)** dan **MySQL**, dengan dukungan **HTTPS** otomatis untuk mengakses kamera (scan absen) dari perangkat lain di jaringan lokal.

## ✨ Fitur

- 👨‍🎓 Login siswa & guru
- 📷 Scan absensi (dengan kamera / NIS)
- 📅 Riwayat absensi hari ini & semua riwayat
- 🔒 HTTPS otomatis (SSL certificate dibuat sendiri saat pertama kali dijalankan)

## 🛠️ Teknologi

- **Backend:** Python, Flask
- **Database:** MySQL (`dbsekolah`)
- **Frontend:** HTML, CSS, JavaScript

## 📋 Prasyarat

- Python 3.8+
- MySQL Server (XAMPP / Laragon / standalone) yang berjalan di `localhost`
- OpenSSL (opsional, untuk pembuatan sertifikat; ada fallback otomatis)

## 🚀 Cara Menjalankan (setelah clone dari GitHub)

### 1. Clone repository

```bash
git clone https://github.com/username/absensi-go.git
cd absensi-go
```

### 2. Buat & aktifkan virtual environment (disarankan)

```bash
python -m venv venv
```

**Windows:**
```bash
venv\Scripts\activate
```

**Linux / macOS:**
```bash
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

> Isi `requirements.txt`: `flask`, `mysql-connector-python`, `python-dotenv`, `cryptography`.

### 4. Konfigurasi `.env`

Salin `.env.example` menjadi `.env`, lalu sesuaikan kredensial MySQL:

**Windows:**
```bash
copy .env.example .env
```

**Linux / macOS:**
```bash
cp .env.example .env
```

> Isi `.env` mencakup `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `SECRET_KEY`, `FLASK_PORT`, dan `FLASK_DEBUG`. File `.env` sudah di-ignore git, sehingga aman menyimpan password di dalamnya.

### 5. Siapkan database MySQL

File `schema.sql` sudah disediakan berisi pembuatan database, tabel, dan data contoh. Import dengan salah satu cara:

**phpMyAdmin:** buka `http://localhost/phpmyadmin` → tab *Import* → pilih file `schema.sql` → *Go*.

**Atau via terminal:**
```bash
mysql -u root -p < schema.sql
```

> Isi `schema.sql`: database `dbsekolah` + tabel `siswa`, `guru`, `absensi`, serta akun contoh (siswa: `budi`/`1234`, guru: `pakdoni`/`1234`) agar langsung bisa login dan mencoba fitur.

### 6. Jalankan aplikasi

```bash
python app.py
```

Saat pertama kali dijalankan, aplikasi akan otomatis membuat SSL certificate (`cert.pem` & `key.pem`), lalu server HTTPS berjalan di:

- **Localhost:** `https://127.0.0.1:5000`
- **Jaringan:** `https://<IP-lokal>:5000` (contoh: `https://192.168.1.10:5000`)

### 7. Akses aplikasi

Buka browser, lalu:

1. Masuk ke `https://<IP-lokal>:5000`
2. **Terima peringatan sertifikat** (karena self-signed): klik *Advanced* → *Proceed to [IP] (unsafe)*
3. Setelah itu kamera & fitur absensi akan berfungsi

## ⚠️ Catatan

- Sertifikat SSL bersifat self-signed dan dibuat otomatis — jangan dibagikan ke publik.
- File `cert.pem`, `key.pem`, dan `data/absensi.json` dibuat saat runtime dan sudah di-*ignore* oleh git, jadi aman jika di-commit ke GitHub.
- Kredensial MySQL diatur lewat `.env` (bukan hardcode). Jika port atau password root berbeda, ubah di `.env`.
