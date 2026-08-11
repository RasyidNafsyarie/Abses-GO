/* ============================================
   Absensi GO - Halaman Siswa
   Scan QR / Manual / Riwayat (data dari API backend)
   ============================================ */
(function () {
  "use strict";

  var SESSION_KEY = "userSession";
  var ROLE_KEY = "userRole";
  var NAME_KEY = "namaSiswa";

  var scanner = null;
  var currentNis = null;
  var currentNama = null;

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
      startScanner();
    } else {
      stopScanner();
    }
    if (name === "riwayat") loadRiwayat();
  }

  // ---------- Scanner QR ----------
  function startScanner() {
    if (scanner) return;
    if (typeof Html5QrcodeScanner === "undefined") {
      $("scan-status").innerHTML = '<span class="badge badge-danger">Library kamera gagal dimuat</span>';
      return;
    }

    var el = $("reader");
    el.innerHTML = "";

    scanner = new Html5QrcodeScanner(
      "reader",
      {
        fps: 10,
        qrbox: { width: 220, height: 220 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
      },
      false
    );
    scanner.render(onScanSuccess, function () { /* scan failure - abaikan */ });
  }

  function stopScanner() {
    if (scanner) {
      try { scanner.clear(); } catch (e) { /* noop */ }
      scanner = null;
    }
  }

  function onScanSuccess(decodedText) {
    // Scanner lama mengecek prefiks ABSENSI-. Di sini kami hanya menerima NIS (digit).
    var nis = String(decodedText || "").trim();
    if (nis.indexOf("ABSENSI-") === 0) {
      nis = nis.replace("ABSENSI-", "").split("-")[0];
    }
    if (!nis || !/^\d+$/.test(nis)) {
      $("scan-status").innerHTML = '<span class="badge badge-danger">QR tidak valid</span>';
      return;
    }
    kirimAbsen(nis);
  }

  // ---------- Absen ----------
  function kirimAbsen(nis) {
    var status = $("scan-status");
    status.innerHTML = '<span class="badge badge-info">Memproses absen...</span>';

    fetch("/scan-absen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nis: nis })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.status === "success") {
          status.innerHTML = '<span class="badge badge-success">' + (data.message || "Absen berhasil") + "</span>";
          setTimeout(function () { status.innerHTML = ""; }, 4000);
          if (currentTabIs("riwayat")) loadRiwayat();
        } else if (data.status === "conflict") {
          status.innerHTML = '<span class="badge badge-warning">' + (data.message || "Sudah absen hari ini") + "</span>";
          setTimeout(function () { status.innerHTML = ""; }, 4000);
        } else {
          status.innerHTML = '<span class="badge badge-danger">' + (data.message || "Gagal absen") + "</span>";
          setTimeout(function () { status.innerHTML = ""; }, 4000);
        }
      })
      .catch(function () {
        status.innerHTML = '<span class="badge badge-danger">Gagal menghubungi server</span>';
        setTimeout(function () { status.innerHTML = ""; }, 4000);
      });
  }

  function absenManual() {
    if (!currentNis) return;
    // Manual = absen untuk akun yang login
    fetch("/scan-absen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nis: currentNis })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.status === "success") {
          UI.toast("success", data.message || "Absen berhasil");
        } else if (data.status === "conflict") {
          UI.toast("warning", data.message || "Sudah absen hari ini");
        } else {
          UI.toast("error", data.message || "Gagal absen");
        }
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
            "<td>" + (item.tanggal_hadir || item.tanggal || "-") + "</td>" +
            "<td>" + (item.waktu_hadir || item.waktu || "-") + "</td>" +
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
    stopScanner();
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
    startScanner();
  });

  window.PageSiswa = { showTab: showTab, absenManual: absenManual, logout: logout };
})();
