# ============================================
# Migrasi password plaintext -> bcrypt
# Jalankan SEKALI setelah update ke Fase 4:
#   venv\Scripts\python migrations\hash_passwords.py
# ============================================
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bcrypt
import mysql.connector
from dotenv import load_dotenv

load_dotenv()


def hash_if_plain(cur, table, id_col, pw_col):
    cur.execute(f"SELECT {id_col}, {pw_col} FROM {table}")
    rows = cur.fetchall()
    updated = 0
    for row in rows:
        stored = row[pw_col]
        if stored and not stored.startswith("$2"):
            hashed = bcrypt.hashpw(stored.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            cur.execute(f"UPDATE {table} SET {pw_col} = %s WHERE {id_col} = %s", (hashed, row[id_col]))
            updated += 1
    return updated


def main():
    conn = mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "dbsekolah"),
    )
    cur = conn.cursor(dictionary=True)

    n_siswa = hash_if_plain(cur, "siswa", "id", "Password")
    n_guru = hash_if_plain(cur, "guru", "id", "Password")

    conn.commit()
    print(f"OK: {n_siswa} siswa, {n_guru} guru password di-hash ke bcrypt.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
