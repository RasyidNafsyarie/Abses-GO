from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from dotenv import load_dotenv
import json
import os
import uuid
import time
from datetime import date, datetime, timedelta
import socket
import ssl
from werkzeug.serving import make_ssl_devcert
from database import connect_db, insert_absen, get_siswa, get_guru, get_today_absen, get_siswa_by_nis, get_absen_by_nis, get_all_absen, save_face_data, get_face_data, has_face_data, delete_face_data, get_all_face_status

# Load variabel dari file .env (jika ada)
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'supersecretkey123!@#')
DATA_FILE = os.getenv('DATA_FILE', 'data/absensi.json')
CERT_FILE = os.getenv('CERT_FILE', 'cert.pem')
KEY_FILE = os.getenv('KEY_FILE', 'key.pem')
valid_tokens = {}

# Pastikan folder data ada
os.makedirs('data', exist_ok=True)
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, 'w') as f:
        json.dump([], f)

# Helper functions
def load_data():
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return []

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def get_local_ip():
    """Mendapatkan IP address lokal"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def create_ssl_cert():
    """Membuat SSL certificate untuk HTTPS"""
    local_ip = get_local_ip()
    try:
        # Gunakan werkzeug untuk membuat dev certificate
        make_ssl_devcert('ssl_cert', host=local_ip)
        
        # Rename files
        if os.path.exists('ssl_cert.crt') and os.path.exists('ssl_cert.key'):
            os.rename('ssl_cert.crt', CERT_FILE)
            os.rename('ssl_cert.key', KEY_FILE)
            print("✅ SSL Certificate berhasil dibuat!")
            return True
            
    except Exception as e:
        print(f"❌ Error creating SSL cert dengan werkzeug: {e}")
        
    # Fallback: Buat manual dengan OpenSSL jika ada
    try:
        import subprocess
        
        # Buat config file untuk certificate
        config_content = f"""[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no
[req_distinguished_name]
C = ID
ST = Java
L = Jakarta
O = Absensi App
CN = {local_ip}
[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names
[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = {local_ip}
"""
        with open('ssl.conf', 'w') as f:
            f.write(config_content)
        
        # Generate key dan certificate
        subprocess.run([
            'openssl', 'req', '-x509', '-newkey', 'rsa:4096', 
            '-keyout', KEY_FILE, '-out', CERT_FILE,
            '-days', '365', '-nodes', '-config', 'ssl.conf'
        ], check=True, capture_output=True)
        
        # Cleanup
        if os.path.exists('ssl.conf'):
            os.remove('ssl.conf')
            
        print("✅ SSL Certificate berhasil dibuat dengan OpenSSL!")
        return True
        
    except subprocess.CalledProcessError:
        print("❌ OpenSSL tidak ditemukan")
    except Exception as e:
        print(f"❌ Error creating SSL cert dengan OpenSSL: {e}")
    
    # Fallback terakhir: Manual creation
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        import ipaddress
        
        # Generate private key
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )
        
        # Create certificate
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, "ID"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Java"),
            x509.NameAttribute(NameOID.LOCALITY_NAME, "Jakarta"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Absensi App"),
            x509.NameAttribute(NameOID.COMMON_NAME, local_ip),
        ])
        
        cert = x509.CertificateBuilder().subject_name(
            subject
        ).issuer_name(
            issuer
        ).public_key(
            private_key.public_key()
        ).serial_number(
            x509.random_serial_number()
        ).not_valid_before(
            datetime.utcnow()
        ).not_valid_after(
            datetime.utcnow() + timedelta(days=365)
        ).add_extension(
            x509.SubjectAlternativeName([
                x509.DNSName("localhost"),
                x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
                x509.IPAddress(ipaddress.IPv4Address(local_ip)),
            ]),
            critical=False,
        ).sign(private_key, hashes.SHA256())
        
        # Write certificate
        with open(CERT_FILE, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
        
        # Write private key
        with open(KEY_FILE, "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ))
        
        print("✅ SSL Certificate berhasil dibuat dengan cryptography!")
        return True
        
    except ImportError:
        print("❌ Install dependencies: pip install cryptography")
    except Exception as e:
        print(f"❌ Error creating SSL cert dengan cryptography: {e}")
    
    return False

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/siswa')
def siswa():
    nis = session.get('nis')
    nama = session.get('nama')
    jurusan = session.get('jurusan')
    kelas = session.get('kelas')

    if not nis:
        return redirect(url_for('index'))

    return render_template(
        'siswa.html',
        nis=nis,
        nama=nama,
        jurusan=jurusan,
        kelas=kelas
    )

@app.route('/guru')
def halaman_guru():
    if not session.get('guru'):
        return redirect(url_for('index'))
    return render_template('guru.html')

@app.route('/api/history', methods=['GET'])
def get_history():
    if not session.get('guru'):
        return jsonify({'status': 'error', 'message': 'Akses khusus guru'}), 403
    try:
        data = get_all_absen()  # mengambil dari database
        return jsonify({'status': 'success', 'data': data}), 200
    except Exception as e:
        print(f"[ERROR get_history] {str(e)}")
        return jsonify({'status': 'error', 'message': 'Gagal mengambil data absensi'}), 500

@app.route('/api/history/<nis>', methods=['GET'])
def get_history_by_nis(nis):
    # Siswa hanya boleh lihat riwayatnya sendiri; guru boleh lihat semua
    if session.get('nis') != nis and not session.get('guru'):
        return jsonify({'status': 'error', 'message': 'Tidak diizinkan'}), 403
    try:
        history_data = get_absen_by_nis(nis)
        for row in history_data:
            for key, value in row.items():
                if isinstance(value, (datetime, date)):
                    row[key] = value.isoformat()
        return jsonify(history_data)  # ← langsung kirim array
    except Exception as e:
        print(f"[ERROR] Gagal ambil history untuk NIS {nis}: {e}")
        return jsonify([]), 500  # atau kirim error message sesuai kebutuhan

@app.route('/scan-absen', methods=['POST'])
def scan_absen():
    try:
        data = request.get_json(silent=True) or {}
        nis = data.get('nis')  # menerima NIS dari frontend/session

        if not nis:
            return jsonify({'success': False, 'message': 'NIS tidak ditemukan.'}), 400

        siswa = get_siswa_by_nis(nis)
        if not siswa:
            return jsonify({'success': False, 'message': f'Siswa dengan NIS {nis} tidak terdaftar.'}), 404

        # ✅ Gunakan .get() agar fleksibel terhadap nama kolom (NIS/nis)
        nis_siswa = siswa.get('nis') or siswa.get('NIS')
        nama_siswa = siswa.get('nama') or siswa.get('Nama')
        jurusan_siswa = siswa.get('jurusan') or siswa.get('Jurusan')
        kelas_siswa = siswa.get('kelas') or siswa.get('Kelas')

        # ⚠ Validasi jika ada data kosong
        if not all([nis_siswa, nama_siswa, jurusan_siswa, kelas_siswa]):
            return jsonify({'success': False, 'message': 'Data siswa tidak lengkap di database.'}), 500

        # ✅ Proses insert absen
        berhasil = insert_absen(
            nis=nis_siswa,
            nama=nama_siswa,
            jurusan=jurusan_siswa,
            kelas=kelas_siswa
        )

        if berhasil:
            return jsonify({'success': True, 'message': f"Absensi untuk {nama_siswa} berhasil."}), 200
        else:
            return jsonify({'success': False, 'message': f"{nama_siswa} sudah tercatat absen hari ini.", 'conflict': True}), 409

    except Exception as e:
        print(f"[ERROR] {str(e)}")
        return jsonify({'success': False, 'message': 'Terjadi kesalahan pada server.'}), 500

@app.route('/api/login-siswa', methods=['POST'])
def login_siswa():
    try:
        data = request.get_json(silent=True) or {}
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({"success": False, "message": "Username dan password wajib diisi"}), 400

        siswa = get_siswa(username, password)
        if siswa:
            nis_siswa = siswa.get('NIS') or siswa.get('nis')
            nama_siswa = siswa.get('Nama') or siswa.get('nama')

            if not nis_siswa:
                return jsonify({"success": False, "message": "Struktur data salah: kolom NIS tidak ada."}), 500

            # ✅ Simpan ke session agar halaman /siswa tahu siapa yang login
            session['nis'] = nis_siswa
            session['nama'] = nama_siswa
            session['jurusan'] = siswa.get('Jurusan') or siswa.get('jurusan')
            session['kelas'] = siswa.get('Kelas') or siswa.get('kelas')

            return jsonify({
                "success": True,
                "message": "Login siswa berhasil",
                "user": nis_siswa,
                "nama": nama_siswa
            }), 200
        else:
            return jsonify({"success": False, "message": "Username atau password salah"}), 401
            
    except Exception as e:
        return jsonify({"success": False, "message": f"Terjadi kesalahan saat login: {str(e)}"}), 500

@app.route('/api/login-guru', methods=['POST'])
def login_guru():
    try:
        data = request.get_json(silent=True) or {}
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({"success": False, "message": "Username dan password wajib diisi"}), 400

        guru = get_guru(username, password)
        if guru:
            guru_user = guru.get('Username') or guru.get('username')
            # Simpan sesi guru agar halaman/API guru terproteksi
            session['guru'] = guru_user
            return jsonify({
                "success": True,
                "message": "Login guru berhasil",
                "user": guru_user
            })
        else:
            return jsonify({"success": False, "message": "Username atau password salah"}), 401
    except Exception as e:
        return jsonify({"success": False, "message": f"Terjadi kesalahan saat login: {str(e)}"}), 500
    
@app.route('/api/history-guru-today', methods=['GET'])
def get_history_guru_today():
    if not session.get('guru'):
        return jsonify({"success": False, "message": "Akses khusus guru"}), 403
    try:
        data = get_today_absen()
        # Selalu konversi datetime ke string untuk JSON
        for row in data:
            for key, value in row.items():
                if isinstance(value, (datetime, date)):
                    row[key] = value.isoformat()
        return jsonify({
            "success": True,
            "count": len(data),
            "data": data
        }), 200
    except Exception as e:
        print(f"[ERROR] {e}")
        return jsonify({"success": False, "message": "Gagal ambil data"}), 500

# ============================================
# FACE RECOGNITION - Verifikasi Wajah
# ============================================

def _face_json(descriptor):
    """Normalisasi descriptor dari JSON string atau list."""
    if isinstance(descriptor, (list, dict)):
        return descriptor
    if isinstance(descriptor, str):
        try:
            return json.loads(descriptor)
        except Exception:
            return None
    return None

def _face_distance(a, b):
    """Euclidean distance antara dua descriptor 128-d."""
    try:
        a = list(a)
        b = list(b)
        if len(a) != len(b) or len(a) == 0:
            return None
        return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5
    except Exception:
        return None

FACE_THRESHOLD = float(os.getenv('FACE_THRESHOLD', '0.5'))

@app.route('/api/face/status', methods=['GET'])
def face_status():
    """Cek apakah akun siswa yang login sudah punya data wajah."""
    nis = session.get('nis')
    if not nis:
        return jsonify({"success": False, "message": "Tidak dalam sesi siswa"}), 401
    return jsonify({
        "success": True,
        "nis": nis,
        "has_face": has_face_data(nis)
    }), 200

@app.route('/api/face/register', methods=['POST'])
def face_register():
    """Simpan data wajah milik siswa yang login (enrollment mandiri)."""
    nis = session.get('nis')
    if not nis:
        return jsonify({"success": False, "message": "Tidak dalam sesi siswa"}), 401

    try:
        data = request.get_json(silent=True) or {}
        descriptor = _face_json(data.get('descriptor'))
        if not descriptor or not isinstance(descriptor, list) or len(descriptor) < 100:
            return jsonify({"success": False, "message": "Descriptor wajah tidak valid"}), 400

        foto_path = None
        if data.get('foto'):
            # Simpan foto sebagai file (base64) untuk audit
            try:
                import base64
                raw = data['foto'].split(',')[-1]
                img_bytes = base64.b64decode(raw)
                os.makedirs('data/faces', exist_ok=True)
                fname = f"{nis}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
                fpath = os.path.join('data', 'faces', fname)
                with open(fpath, 'wb') as f:
                    f.write(img_bytes)
                foto_path = fpath
            except Exception as e:
                print(f"[FACE] Gagal simpan foto: {e}")

        if save_face_data(nis, descriptor, foto_path):
            return jsonify({"success": True, "message": "Verifikasi wajah tersimpan"}), 200
        return jsonify({"success": False, "message": "Gagal menyimpan data wajah"}), 500
    except Exception as e:
        print(f"[FACE] Error register: {e}")
        return jsonify({"success": False, "message": "Terjadi kesalahan server"}), 500

@app.route('/api/face/descriptors', methods=['GET'])
def face_descriptors():
    """Ambil descriptor wajah untuk NIS yang login (untuk matching di browser)."""
    nis = session.get('nis')
    if not nis:
        return jsonify({"success": False, "message": "Tidak dalam sesi siswa"}), 401

    row = get_face_data(nis)
    if not row or not row.get('descriptor'):
        return jsonify({"success": False, "message": "Belum ada data wajah"}), 404

    return jsonify({
        "success": True,
        "nis": nis,
        "descriptor": row['descriptor']
    }), 200

@app.route('/api/face/verify', methods=['POST'])
def face_verify():
    """Validasi ekstra: cocokkan descriptor hasil capture dengan data tersimpan."""
    nis = session.get('nis')
    if not nis:
        return jsonify({"success": False, "message": "Tidak dalam sesi siswa"}), 401

    try:
        data = request.get_json(silent=True) or {}
        descriptor = _face_json(data.get('descriptor'))
        if not descriptor:
            return jsonify({"success": False, "message": "Descriptor wajah tidak valid"}), 400

        row = get_face_data(nis)
        if not row or not row.get('descriptor'):
            return jsonify({"success": False, "message": "Belum ada data wajah"}), 404

        stored = row['descriptor']
        # Data tersimpan bisa berupa list of frames (ambil rata-rata/best) atau satu list
        candidates = stored if isinstance(stored, list) and stored and isinstance(stored[0], list) else [stored]

        best = None
        for cand in candidates:
            d = _face_distance(descriptor, cand)
            if d is not None and (best is None or d < best):
                best = d

        verified = best is not None and best <= FACE_THRESHOLD
        return jsonify({
            "success": True,
            "verified": verified,
            "distance": best,
            "threshold": FACE_THRESHOLD
        }), 200
    except Exception as e:
        print(f"[FACE] Error verify: {e}")
        return jsonify({"success": False, "message": "Terjadi kesalahan server"}), 500

@app.route('/api/face/reset', methods=['POST'])
def face_reset():
    """Hapus data wajah siswa (auth guru) agar siswa re-enroll."""
    if not session.get('guru'):
        return jsonify({"success": False, "message": "Akses khusus guru"}), 403

    try:
        data = request.get_json(silent=True) or {}
        nis = data.get('nis')
        if not nis:
            return jsonify({"success": False, "message": "NIS wajib diisi"}), 400

        if delete_face_data(nis):
            return jsonify({"success": True, "message": f"Data wajah NIS {nis} direset"}), 200
        return jsonify({"success": False, "message": "Gagal reset data wajah"}), 500
    except Exception as e:
        print(f"[FACE] Error reset: {e}")
        return jsonify({"success": False, "message": "Terjadi kesalahan server"}), 500

@app.route('/api/face/list', methods=['GET'])
def face_list():
    """Status wajah semua siswa (auth guru)."""
    if not session.get('guru'):
        return jsonify({"success": False, "message": "Akses khusus guru"}), 403

    data = get_all_face_status()
    return jsonify({"success": True, "data": data}), 200

if __name__ == '__main__' :
    local_ip = get_local_ip()
    
    if not (os.path.exists(CERT_FILE) and os.path.exists(KEY_FILE)):
        print("🔐 Membuat SSL Certificate...")
        if not create_ssl_cert():
            print("❌ Gagal membuat SSL certificate!")
            print("💡 Install dependencies: pip install cryptography werkzeug")
            exit(1)
    
    print("\n" + "="*50)
    print("🚀 FLASK APP - FULL HTTPS MODE")
    print("="*50)
    print(f"📍 Server HTTPS URLs:")
    print(f"   • Localhost: https://127.0.0.1:5000")
    print(f"   • Network:   https://{local_ip}:5000")
    print("\n⚠️  PENTING:")
    print("   1. Accept certificate warning di browser!")
    print("   2. Klik 'Advanced' → 'Proceed to [IP] (unsafe)'")
    print("   3. Setelah itu akses kamera akan berfungsi!")
    print("="*50)
    
    try:
        context = (CERT_FILE, KEY_FILE)
        app.run(
            debug=os.getenv('FLASK_DEBUG', 'True').lower() == 'true',
            host='0.0.0.0',
            port=int(os.getenv('FLASK_PORT', 5000)),
            ssl_context=context
        )
        
    except Exception as e:
        print(f"❌ Error starting HTTPS server: {e}")
        print("💡 Coba jalankan sebagai administrator/sudo")
