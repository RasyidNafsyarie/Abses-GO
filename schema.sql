-- ============================================
-- Absensi GO - Database Schema & Seed Data
-- Database : dbsekolah
-- Cara pakai:
--   Terminal : mysql -u root -p < schema.sql
--   phpMyAdmin : tab Import -> pilih file ini -> Go
-- ============================================

CREATE DATABASE IF NOT EXISTS dbsekolah
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_general_ci;

USE dbsekolah;

-- ---------- Tabel Siswa ----------
CREATE TABLE IF NOT EXISTS siswa (
    id INT AUTO_INCREMENT PRIMARY KEY,
    NIS VARCHAR(20) NOT NULL UNIQUE,
    Nama VARCHAR(100) NOT NULL,
    Jurusan VARCHAR(100) NOT NULL,
    Kelas VARCHAR(20) NOT NULL,
    Username VARCHAR(50) NOT NULL UNIQUE,
    Password VARCHAR(255) NOT NULL
);

-- ---------- Tabel Guru ----------
CREATE TABLE IF NOT EXISTS guru (
    id INT AUTO_INCREMENT PRIMARY KEY,
    Username VARCHAR(50) NOT NULL UNIQUE,
    Password VARCHAR(255) NOT NULL
);

-- ---------- Tabel Absensi ----------
CREATE TABLE IF NOT EXISTS absensi (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nis VARCHAR(20) NOT NULL,
    nama VARCHAR(100) NOT NULL,
    jurusan VARCHAR(100),
    kelas VARCHAR(20),
    tanggal_hadir DATE NOT NULL,
    waktu_hadir DATETIME NOT NULL,
    INDEX idx_absensi_nis_tanggal (nis, tanggal_hadir)
);

-- ---------- Data Contoh (seed) ----------
-- Password ini disimpan plaintext sesuai logika login di app saat ini.
-- Hapus/ubah sesuai kebutuhan sebelum dipakai produksi.
INSERT INTO siswa (NIS, Nama, Jurusan, Kelas, Username, Password) VALUES
('123456', 'Budi Santoso', 'RPL', 'XII RPL 1', 'budi', '1234'),
('123457', 'Siti Aminah', 'TKJ', 'XI TKJ 2', 'siti', '1234');

INSERT INTO guru (Username, Password) VALUES
('pakdoni', '1234'),
('buindah', '1234');
