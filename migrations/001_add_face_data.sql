-- ============================================
-- Absensi GO - Migration 001
-- Tabel data wajah (face recognition)
-- Jalankan setelah schema.sql:
--   Terminal  : mysql -u root -p < migrations/001_add_face_data.sql
--   phpMyAdmin: tab Import -> pilih file ini -> Go
-- ============================================

USE dbsekolah;

CREATE TABLE IF NOT EXISTS face_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nis VARCHAR(20) NOT NULL,
    descriptor JSON NOT NULL COMMENT 'Face descriptor (128-d) dari face-api.js',
    foto_path VARCHAR(255) NULL COMMENT 'Path foto wajah tersimpan (jika ada)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_face_data_nis (nis),
    CONSTRAINT fk_face_data_siswa
        FOREIGN KEY (nis) REFERENCES siswa(NIS)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
