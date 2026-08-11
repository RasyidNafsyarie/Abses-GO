import os
import sys
import mysql.connector
from datetime import date, datetime 

# Pastikan stdout mendukung karakter unicode (emoji) di semua platform
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

def connect_db(dbsekolah):
    try:
        conn = mysql.connector.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', ''),
            database=dbsekolah
        )
        print(f"✅ Koneksi ke {dbsekolah} berhasil!")
        return conn
    except Exception as e:
        print(f"❌ Gagal koneksi ke {dbsekolah}: {e}")
        return None

# --- FUNGSI ABSENSI ---

def insert_absen(nis, nama, jurusan, kelas):
    """Memasukkan data absensi siswa, dengan pengecekan duplikat dan pencatatan waktu."""
    conn = connect_db("dbsekolah")
    if not conn:
        return False

    cursor = conn.cursor()
    
    # ✅ Dapatkan waktu penuh sebagai DATETIME
    now = datetime.now()
    today_date = now.strftime("%Y-%m-%d")          # untuk tanggal_hadir
    full_datetime = now.strftime("%Y-%m-%d %H:%M:%S")  # untuk waktu_hadir (DATETIME)

    try:
        # Pengecekan duplikat: tetap pakai today_date
        cursor.execute("SELECT id FROM absensi WHERE nis=%s AND tanggal_hadir=%s", (nis, today_date))
        if cursor.fetchone():
            print(f"[DATABASE] ⚠️ Siswa dengan NIS {nis} sudah absen hari ini.")
            conn.close()
            return False

        # ✅ Kirim full_datetime ke kolom waktu_hadir
        sql = "INSERT INTO absensi (nis, nama, jurusan, kelas, tanggal_hadir, waktu_hadir) VALUES (%s, %s, %s, %s, %s, %s)"
        values = (nis, nama, jurusan, kelas, today_date, full_datetime)
        
        cursor.execute(sql, values)
        conn.commit()
        
        print(f"[DATABASE] ✅ Absen untuk siswa NIS {nis} berhasil disimpan.")
        return True

    except mysql.connector.Error as err:
        print(f"[DATABASE] ❌ Gagal INSERT absen: {err}")
        conn.rollback()
        return False

    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()

def get_today_absen():
    """Mengambil semua data absensi untuk hari ini."""
    conn = connect_db("dbsekolah")
    if not conn: return []

    cursor = conn.cursor(dictionary=True)
    today = date.today().strftime("%Y-%m-%d")
    query = "SELECT * FROM absensi WHERE tanggal_hadir=%s ORDER BY waktu_hadir DESC"
    cursor.execute(query, (today,))
    result = cursor.fetchall()
    conn.close()
    return result

def get_all_absen():
    """Mengambil SEMUA riwayat absensi dari database untuk ditampilkan ke guru."""
    conn = connect_db("dbsekolah")
    if not conn: return []
    
    cursor = conn.cursor(dictionary=True)
    query = "SELECT * FROM absensi ORDER BY tanggal_hadir DESC, id DESC"
    cursor.execute(query)
    result = cursor.fetchall()
    conn.close()
    return result

def get_absen_by_nis(nis):
    """Mengambil semua riwayat absensi untuk SATU siswa berdasarkan NIS."""
    conn = connect_db("dbsekolah")
    if not conn: return []

    cursor = conn.cursor(dictionary=True)
    query = "SELECT * FROM absensi WHERE nis=%s ORDER BY tanggal_hadir DESC, id DESC"
    cursor.execute(query, (nis,))
    result = cursor.fetchall()
    conn.close()
    return result

# --- FUNGSI SISWA ---

def get_siswa(username, password):
    """Mencari data siswa berdasarkan username dan password untuk login."""
    conn = connect_db("dbsekolah")
    if not conn: return None

    cursor = conn.cursor(dictionary=True)
    query = "SELECT * FROM siswa WHERE Username = %s AND Password = %s"
    cursor.execute(query, (username, password))
    result = cursor.fetchone()
    conn.close()
    return result
    
def get_siswa_by_nis(nis):
    """Ambil data siswa berdasarkan NIS."""
    conn = connect_db("dbsekolah")
    if not conn:
        return None

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM siswa WHERE NIS = %s", (nis,))
        result = cursor.fetchone()
        return result
    except Exception as e:
        print(f"Error ambil siswa: {e}")
        return None
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()
            return result

# --- FUNGSI GURU ---

def get_guru(username, password):
    """Mencari data guru berdasarkan username dan password untuk login."""
    conn = connect_db("dbsekolah")
    if not conn: return None
    
    cursor = conn.cursor(dictionary=True)
    query = "SELECT * FROM guru WHERE Username = %s AND Password = %s"
    cursor.execute(query, (username, password))
    result = cursor.fetchone()
    conn.close()
    return result

# --- FUNGSI FACE DATA (verifikasi wajah) ---

def save_face_data(nis, descriptor, foto_path=None):
    """Simpan (atau timpa) data wajah untuk satu NIS."""
    conn = connect_db("dbsekolah")
    if not conn:
        return False

    cursor = conn.cursor()
    try:
        import json as _json
        sql = """
            INSERT INTO face_data (nis, descriptor, foto_path)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE
                descriptor = VALUES(descriptor),
                foto_path = VALUES(foto_path),
                updated_at = CURRENT_TIMESTAMP
        """
        cursor.execute(sql, (nis, _json.dumps(descriptor), foto_path))
        conn.commit()
        return True
    except Exception as e:
        print(f"[DATABASE] ❌ Gagal simpan face_data: {e}")
        conn.rollback()
        return False
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()

def get_face_data(nis):
    """Ambil data wajah untuk satu NIS (descriptor di-parse dari JSON)."""
    conn = connect_db("dbsekolah")
    if not conn:
        return None

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM face_data WHERE nis = %s", (nis,))
        row = cursor.fetchone()
        if row and row.get("descriptor"):
            import json as _json
            try:
                row["descriptor"] = _json.loads(row["descriptor"])
            except Exception:
                row["descriptor"] = None
        return row
    except Exception as e:
        print(f"[DATABASE] ❌ Gagal ambil face_data: {e}")
        return None
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()

def has_face_data(nis):
    """Cek apakah sebuah NIS sudah punya data wajah."""
    row = get_face_data(nis)
    return bool(row and row.get("descriptor"))

def delete_face_data(nis):
    """Hapus data wajah untuk satu NIS (re-enroll)."""
    conn = connect_db("dbsekolah")
    if not conn:
        return False

    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM face_data WHERE nis = %s", (nis,))
        conn.commit()
        return True
    except Exception as e:
        print(f"[DATABASE] ❌ Gagal hapus face_data: {e}")
        conn.rollback()
        return False
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()

def get_all_face_status():
    """Ambil status wajah semua siswa (untuk halaman kelola guru)."""
    conn = connect_db("dbsekolah")
    if not conn:
        return []

    cursor = conn.cursor(dictionary=True)
    try:
        query = """
            SELECT s.NIS, s.Nama, s.Kelas, s.Jurusan,
                   (fd.id IS NOT NULL) AS has_face,
                   fd.updated_at AS face_updated_at
            FROM siswa s
            LEFT JOIN face_data fd ON fd.nis = s.NIS
            ORDER BY s.Nama ASC
        """
        cursor.execute(query)
        return cursor.fetchall()
    except Exception as e:
        print(f"[DATABASE] ❌ Gagal ambil status wajah: {e}")
        return []
    finally:
        if conn.is_connected():
            cursor.close()
            conn.close()
