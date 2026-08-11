/* ============================================
   Absensi GO - Halaman Siswa
   Onboarding wajah → verifikasi wajah → scan QR → absen
   ============================================ */
(function () {
  "use strict";

  var SESSION_KEY = "userSession";
  var ROLE_KEY = "userRole";
  var NAME_KEY = "namaSiswa";

  var scanner = null;        // Html5Qrcode untuk scan QR
  var qrScanning = false;
  var currentNis = null;
  var currentNama = null;

  // State verifikasi
  var verified = false;
  var enrollStream = null;
  var enrollFrames = [];
  var enrollFacing = "user";   // default depan untuk selfie wajah
  var verifyFacing = "user";

  function $(id) { return document.getElementById(id); }

  function getSession() {
    return {
      nis: sessionStorage.getItem(SESSION_KEY),
      nama: sessionStorage.getItem(NAME_KEY),
      role: sessionStorage.getItem(ROLE_KEY)
    };
  }

  // ---------- Auth guard ----------
  function guard() {
    var s = getSession();
    if (!s.nis || s.role !== "siswa") {
      window.location.href = "/";
      return null;
    }
    return s;
  }

  // ---------- Tabs ----------
  function showTab(name) {
    var tabs = ["scan", "manual", "riwayat"];
    tabs.forEach(function (t) {
      $("tab-" + t).setAttribute("aria-selected", String(t === name));
      $("panel-" + t).classList.toggle("hidden", t !== name);
    });

    if (name === "scan") {
      initScanPanel();
    } else {
      stopQrScanner();
    }
    if (name === "riwayat") loadRiwayat();
  }

  // ---------- Onboarding / status wajah ----------
  function checkFaceStatus() {
    return fetch("/api/face/status")
      .then(function (r) { return r.json(); })
      .catch(function () { return { success: false, has_face: true }; });
  }

  function initScanPanel() {
    checkFaceStatus().then(function (res) {
      if (res && res.success === true && res.has_face === false) {
        showEnroll(true);
      } else {
        showEnroll(false);
        resetVerifyFlow();
      }
    });
  }

  function showEnroll(show) {
    var enroll = $("panel-enroll");
    var tabs = $("main-tabs");
    if (enroll) enroll.classList.toggle("hidden", !show);
    if (tabs) tabs.classList.toggle("hidden", show);
  }

  // ============ ENROLLMENT (onboarding) ============
  function startEnroll() {
    // Hentikan stream lama dulu jika ada (restart)
    stopEnrollStream();

    FaceApp.load()
      .then(function () {
        return openCamera();
      })
      .then(function (stream) {
        enrollStream = stream;
        var v = $("enroll-video");
        return FaceApp.startVideo(v, stream).then(function () { return v; });
      })
      .then(function (video) {
        $("enroll-placeholder").classList.add("hidden");
        $("btn-enroll-start").classList.add("hidden");
        $("btn-enroll-save").classList.remove("hidden");
        $("btn-enroll-flip").classList.remove("hidden");
        setEnrollStatus("info", "Hadapkan wajah ke kamera. Tunggu beberapa detik...");
        // Capture otomatis beberapa frame
        enrollFrames = [];
        captureFrames(video, 4);
      })
      .catch(function (err) {
        setEnrollStatus("danger", "Kamera gagal: " + (err && err.message ? err.message : err));
      });
  }

  function captureFrames(video, count) {
    var attempts = 0;
    var maxAttempts = count * 6; // ~18 detik
    var timer = setInterval(function () {
      attempts++;

      // Pastikan video benar-benar punya frame sebelum deteksi
      if (!video.videoWidth || !video.videoHeight) {
        if (attempts <= 3) setEnrollStatus("info", "Menyiapkan video...");
        return;
      }

      FaceApp.detectDescriptor(video, false)
        .then(function (res) {
          if (res) {
            enrollFrames.push(res.descriptor);
            setEnrollStatus("info", "Frame " + enrollFrames.length + "/" + count + " tertangkap");
            if (enrollFrames.length >= count) {
              clearInterval(timer);
              setEnrollStatus("success", "Wajah terdeteksi. Klik Simpan Wajah.");
            }
          } else {
            setEnrollStatus("warning", "Wajah belum terdeteksi — hadapkan wajah lurus ke kamera, periksa pencahayaan...");
          }
        })
        .catch(function (e) {
          console.error("[enroll] deteksi gagal:", e);
          setEnrollStatus("danger", "Deteksi gagal: " + (e && e.message ? e.message : e));
        });

      // Timeout: wajah tidak terdeteksi sama sekali
      if (attempts >= maxAttempts && enrollFrames.length === 0) {
        clearInterval(timer);
        setEnrollStatus("danger", "Wajah tidak terdeteksi. Periksa kamera & pencahayaan, lalu klik Mulai Ulang.");
        showEnrollRestart();
      }
    }, 600);
  }

  function showEnrollRestart() {
    var btn = $("btn-enroll-start");
    if (btn) {
      btn.classList.remove("hidden");
      btn.innerHTML = '<i data-lucide="refresh-cw"></i> Mulai Ulang';
    }
  }

  function saveEnroll() {
    if (enrollFrames.length === 0) {
      setEnrollStatus("warning", "Belum ada frame wajah. Mulai ulang pengambilan.");
      return;
    }
    // Kirim rata-rata descriptor dari frame (lebih stabil)
    var n = enrollFrames.length;
    var dim = enrollFrames[0].length;
    var avg = new Array(dim).fill(0);
    enrollFrames.forEach(function (f) {
      for (var i = 0; i < dim; i++) avg[i] += f[i] / n;
    });

    setEnrollStatus("info", "Menyimpan...");
    var video = $("enroll-video");
    var foto = video ? FaceApp.captureFrame(video) : null;

    fetch("/api/face/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descriptor: avg, foto: foto })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          stopEnrollStream();
          setEnrollStatus("success", "Wajah tersimpan. Mulai absen sekarang.");
          UI.toast("success", data.message || "Verifikasi wajah aktif");
          showEnroll(false);
          resetVerifyFlow();
        } else {
          setEnrollStatus("danger", data.message || "Gagal menyimpan wajah");
        }
      })
      .catch(function () {
        setEnrollStatus("danger", "Gagal menghubungi server");
      });
  }

  function stopEnrollStream() {
    FaceApp.stopStream(enrollStream);
    enrollStream = null;
    enrollFrames = [];
  }

  // Buka kamera; pakai facing tertentu, fallback ke kamera default jika tidak didukung
  function openCamera(facing) {
    var mode = facing || "user";
    return FaceApp.getStreamFacing(mode).catch(function () {
      return FaceApp.getStream({ video: true, audio: false });
    });
  }

  function flipEnroll() {
    enrollFacing = enrollFacing === "user" ? "environment" : "user";
    // restart kamera enrollment
    stopEnrollStream();
    FaceApp.load()
      .then(function () {
        return openCamera(enrollFacing);
      })
      .then(function (stream) {
        enrollStream = stream;
        var v = $("enroll-video");
        return FaceApp.startVideo(v, stream).then(function () { return v; });
      })
      .then(function (video) {
        $("enroll-placeholder").classList.add("hidden");
        setEnrollStatus("info", "Hadapkan wajah ke kamera. Tunggu beberapa detik...");
        enrollFrames = [];
        captureFrames(video, 4);
      })
      .catch(function (err) {
        setEnrollStatus("danger", "Kamera gagal: " + (err && err.message ? err.message : err));
      });
  }

  function flipVerify() {
    verifyFacing = verifyFacing === "user" ? "environment" : "user";
    // restart kamera verifikasi
    stopVerify();
    setVerifyStatus("", "");
    startVerify();
  }

  function setEnrollStatus(type, message) {
    var el = $("enroll-status");
    if (!el) return;
    el.innerHTML = '<span class="badge badge-' + type + '">' + message + "</span>";
  }

  // ============ VERIFIKASI WAJAH (gate sebelum QR) ============
  var verifyStream = null;
  var verifyTimer = null;
  var storedDescriptor = null;
  var verifying = false;

  function resetVerifyFlow() {
    verified = false;
    stopVerify();
    $("step-verify").classList.remove("hidden");
    $("step-qr").classList.add("hidden");
    $("scan-step-badge").textContent = "Langkah 1 dari 2";
    setVerifyStatus("", "");
    var lbl = $("btn-verify-label");
    if (lbl) lbl.textContent = "Nyalakan Kamera";
    stopQrScanner();
  }

  // Toggle: nyalakan / matikan kamera verifikasi
  function startVerify() {
    if (verifying) {
      stopVerify();
      setVerifyStatus("", "");
      return;
    }

    console.log("[verify] buka kamera dulu...");
    setVerifyStatus("info", "Mengakses kamera...");

    // 1) Buka kamera duluan (agar kamera langsung nyala)
    openCamera()
      .then(function (stream) {
        console.log("[verify] kamera OK");
        verifyStream = stream;
        var v = $("verify-video");
        return FaceApp.startVideo(v, stream).then(function () { return v; });
      })
      .then(function (video) {
        // Kamera sudah nyala: tampilkan, label jadi Matikan
        verifying = true;
        $("verify-placeholder").classList.add("hidden");
        $("btn-verify-label").textContent = "Matikan Kamera";
        $("btn-verify-flip").classList.remove("hidden");

        // 2) Load model di belakang, lalu mulai deteksi
        console.log("[verify] load model...");
        setVerifyStatus("info", "Memuat model wajah...");
        FaceApp.load()
          .then(function () {
            console.log("[verify] model OK");
            return fetch("/api/face/descriptors").then(function (r) { return r.json(); });
          })
          .then(function (data) {
            console.log("[verify] descriptors:", data.success);
            if (!data.success) throw new Error(data.message || "Belum ada data wajah");
            storedDescriptor = data.descriptor;
            doVerifyLoop(video);
          })
          .catch(function (err) {
            console.error("[verify] ERROR model/descriptor:", err);
            setVerifyStatus("danger", "Gagal memuat verifikasi: " + (err && err.message ? err.message : err));
          });
      })
      .catch(function (err) {
        console.error("[verify] ERROR kamera:", err);
        setVerifyStatus("danger", "Kamera gagal: " + (err && err.message ? err.message : err));
      });
  }

  function proceedToQrStep() {
    $("step-verify").classList.add("hidden");
    $("step-qr").classList.remove("hidden");
    $("scan-step-badge").textContent = "Langkah 2 dari 2";
    setVerifyStatus("", "");
  }

  function doVerifyLoop(video) {
    setVerifyStatus("info", "Hadapkan wajah ke kamera...");

    verifyTimer = setInterval(function () {
      if (!verifying) return;
      FaceApp.detectDescriptor(video, false)
        .then(function (res) {
          if (!res) {
            setVerifyStatus("info", "Wajah belum terdeteksi...");
            return;
          }
          var d = FaceApp.distance(res.descriptor, storedDescriptor);
          if (d <= FaceApp.THRESHOLD) {
            // Cocok → selesai verifikasi, lanjut ke scan QR
            clearInterval(verifyTimer);
            FaceApp.stopStream(verifyStream);
            verifyStream = null;
            verifying = false;
            verified = true;
            setVerifyStatus("success", "Wajah cocok (jarak " + d.toFixed(3) + "). Membuka scan QR...");
            setTimeout(proceedToQrStep, 800);
          } else {
            setVerifyStatus("info", "Wajah tidak cocok dengan akun Anda (jarak " + d.toFixed(3) + ")");
          }
        })
        .catch(function () { /* ignore frame */ });
    }, 400);
  }

  function stopVerify() {
    verifying = false;
    if (verifyTimer) clearInterval(verifyTimer);
    verifyTimer = null;
    FaceApp.stopStream(verifyStream);
    verifyStream = null;
  }

  function setVerifyStatus(type, message) {
    var el = $("verify-status");
    if (!el) return;
    if (!type) { el.innerHTML = ""; return; }
    el.innerHTML = '<span class="badge badge-' + type + '">' + message + "</span>";
  }

  // ============ SCAN QR (langkah 2) ============
  var qrProcessing = false; // lock agar scan tidak berulang

  function toggleScanner() {
    if (!scanner) initQrScanner();
    if (scanner && qrScanning) {
      stopQrScanner();
    } else if (scanner) {
      setScanStatus("", "");
      scanner
        .start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 220, height: 220 } }, onScanSuccess, function () {})
        .then(function () {
          qrScanning = true;
          $("qr-placeholder").classList.add("hidden");
          $("btn-scan-label").textContent = "Matikan Kamera";
        })
        .catch(function (err) {
          setScanStatus("danger", "Kamera tidak bisa diakses");
          $("qr-placeholder").classList.remove("hidden");
        });
    }
  }

  function initQrScanner() {
    if (typeof Html5Qrcode === "undefined") {
      setScanStatus("danger", "Library kamera gagal dimuat");
      return;
    }
    scanner = new Html5Qrcode("reader");
  }

  function stopQrScanner() {
    if (scanner && qrScanning) {
      try { scanner.stop(); } catch (e) { /* noop */ }
      qrScanning = false;
    }
    var label = $("btn-scan-label");
    if (label) label.textContent = "Nyalakan Kamera";
    $("qr-placeholder").classList.remove("hidden");
  }

  function onScanSuccess(decodedText) {
    // Lock: abaikan scan saat sedang memproses absen
    if (qrProcessing) return;

    var text = String(decodedText || "").trim();
    if (text.indexOf("ABSENSI-") !== 0) {
      setScanStatus("danger", "QR bukan QR absen guru");
      return;
    }
    qrProcessing = true;
    kirimAbsen(currentNis);
  }

  function kirimAbsen(nis) {
    setScanStatus("info", "Memproses absen...");
    fetch("/scan-absen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nis: nis })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        qrProcessing = false;

        // Hentikan kamera: QR sudah terproses, jangan scan ulang terus-menerus
        stopQrScanner();

        if (data.status === "success") {
          setScanStatus("success", data.message || "Absen berhasil");
          UI.toast("success", "Absensi berhasil dicatat");
        } else if (data.status === "conflict") {
          setScanStatus("warning", data.message || "Sudah absen hari ini");
          UI.toast("warning", "Anda sudah absen hari ini");
        } else {
          setScanStatus("danger", data.message || "Gagal absen");
          UI.toast("error", data.message || "Gagal absen");
        }
        if (currentTabIs("riwayat")) loadRiwayat();
      })
      .catch(function () {
        qrProcessing = false;
        setScanStatus("danger", "Gagal menghubungi server");
      });
  }

  function setScanStatus(type, message) {
    var el = $("scan-status");
    if (!el) return;
    // Batalkan timer lama agar tidak bertumpuk (penyebab kedip)
    if (el._clearTimer) { clearTimeout(el._clearTimer); el._clearTimer = null; }

    if (!type) { el.innerHTML = ""; return; }
    var badges = { info: "info", success: "success", warning: "warning", danger: "danger" };
    el.innerHTML = '<span class="badge badge-' + (badges[type] || "neutral") + '">' + message + "</span>";
    // Info & success dibiarkan tampil (tidak auto-hapus cepat); yang lain dihapus setelah 4s
    if (type !== "info" && type !== "success") {
      el._clearTimer = setTimeout(function () { el.innerHTML = ""; }, 4000);
    }
  }

  // ---------- Manual ----------
  function absenManual() {
    if (!currentNis) return;
    fetch("/scan-absen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nis: currentNis })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.status === "success") UI.toast("success", data.message || "Absen berhasil");
        else if (data.status === "conflict") UI.toast("warning", data.message || "Sudah absen hari ini");
        else UI.toast("error", data.message || "Gagal absen");
        loadRiwayat();
      })
      .catch(function () { UI.toast("error", "Gagal menghubungi server"); });
  }

  function currentTabIs(name) {
    var tab = $("tab-" + name);
    return tab && tab.getAttribute("aria-selected") === "true";
  }

  // ---------- Riwayat ----------
  function loadRiwayat() {
    var tbody = $("tbody-riwayat");
    tbody.innerHTML = '<tr><td colspan="4" class="empty">Memuat data...</td></tr>';

    fetch("/api/history/" + currentNis)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var list = Array.isArray(data) ? data : (data.data || []);
        if (list.length === 0) {
          tbody.innerHTML = '<tr><td colspan="4" class="empty">Belum ada riwayat absensi</td></tr>';
          return;
        }
        tbody.innerHTML = "";
        list.forEach(function (item, i) {
          var tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" + (i + 1) + "</td>" +
            "<td>" + UI.formatTanggalId(item.tanggal_hadir || item.tanggal) + "</td>" +
            "<td>" + UI.formatWIB(item.waktu_hadir || item.waktu) + "</td>" +
            '<td><span class="badge badge-success">Hadir</span></td>';
          tbody.appendChild(tr);
        });
      })
      .catch(function () {
        tbody.innerHTML = '<tr><td colspan="4" class="empty">Gagal memuat riwayat</td></tr>';
      });
  }

  // ---------- Logout ----------
  function logout() {
    stopQrScanner();
    stopEnrollStream();
    stopVerify();
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(ROLE_KEY);
    sessionStorage.removeItem(NAME_KEY);
    window.location.href = "/";
  }

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", function () {
    var s = guard();
    if (!s) return;

    currentNis = s.nis;
    currentNama = s.nama || "Siswa";
    $("nama-siswa").textContent = currentNama + " (" + currentNis + ")";
    $("info-siswa").textContent = "Selamat datang, " + currentNama;

    loadRiwayat();
    initScanPanel();
  });

  window.PageSiswa = {
    showTab: showTab,
    startEnroll: startEnroll,
    saveEnroll: saveEnroll,
    flipEnroll: flipEnroll,
    startVerify: startVerify,
    flipVerify: flipVerify,
    toggleScanner: toggleScanner,
    absenManual: absenManual,
    logout: logout
  };
})();
