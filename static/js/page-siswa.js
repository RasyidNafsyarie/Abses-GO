/* ============================================
   Absensi GO - Halaman Siswa
   Scan QR (custom UI via Html5Qrcode), Manual, Riwayat
   ============================================ */
(function () {
  "use strict";

  var SESSION_KEY = "userSession";
  var ROLE_KEY = "userRole";
  var NAME_KEY = "namaSiswa";

  var scanner = null;
  var scanning = false;
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

  // ---------- Scanner QR (custom UI) ----------
  function startScanner() {
    var el = $("reader");
    if (!el || scanning) return;

    if (typeof Html5Qrcode === "undefined") {
      setScanStatus("error", "Library kamera gagal dimuat");
      return;
    }

    try {
      el.innerHTML = "";
      scanner = new Html5Qrcode("reader");
      setScanStatus("", "");
      setScannerUi(false);
    } catch (e) {
      setScanStatus("error", "Gagal menginisialisasi kamera");
    }
  }

  function toggleScanner() {
    if (!scanner) startScanner();
    if (!scanner) return;

    if (scanning) {
      stopScanner();
    } else {
      setScanStatus("", "");
      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          onScanSuccess,
          function () {}
        )
        .then(function () {
          scanning = true;
          setScannerUi(true);
        })
        .catch(function (err) {
          setScanStatus("error", "Kamera tidak bisa diakses: " + (err && err.message ? err.message : err));
          setScannerUi(false);
        });
    }
  }

  function stopScanner() {
    if (scanner && scanning) {
      try { scanner.stop(); } catch (e) { /* noop */ }
      scanning = false;
    }
    setScannerUi(false);
  }

  function setScannerUi(active) {
    var label = $("btn-scan-label");
    var placeholder = $("scanner-placeholder");
    if (label) label.textContent = active ? "Matikan Kamera" : "Nyalakan Kamera";
    if (placeholder) placeholder.classList.toggle("hidden", active);
  }

  function onScanSuccess(decodedText) {
    var nis = String(decodedText || "").trim();
    if (nis.indexOf("ABSENSI-") === 0) {
      nis = nis.replace("ABSENSI-", "").split("-")[0];
    }
    if (!nis || !/^\d+$/.test(nis)) {
      setScanStatus("danger", "QR tidak valid");
      return;
    }
    kirimAbsen(nis);
  }

  // ---------- Absen ----------
  function kirimAbsen(nis) {
    setScanStatus("info", "Memproses absen...");

    fetch("/scan-absen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nis: nis })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.status === "success") {
          setScanStatus("success", data.message || "Absen berhasil");
        } else if (data.status === "conflict") {
          setScanStatus("warning", data.message || "Sudah absen hari ini");
        } else {
          setScanStatus("danger", data.message || "Gagal absen");
        }
        if (currentTabIs("riwayat")) loadRiwayat();
      })
      .catch(function () {
        setScanStatus("danger", "Gagal menghubungi server");
      });
  }

  function setScanStatus(type, message) {
    var el = $("scan-status");
    if (!el) return;
    if (!type) {
      el.innerHTML = "";
      return;
    }
    var badges = { info: "info", success: "success", warning: "warning", danger: "danger" };
    el.innerHTML = '<span class="badge badge-' + (badges[type] || "neutral") + '">' + message + "</span>";
    if (type !== "info") {
      setTimeout(function () { el.innerHTML = ""; }, 4000);
    }
  }

  function absenManual() {
    if (!currentNis) return;
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

  window.PageSiswa = {
    showTab: showTab,
    toggleScanner: toggleScanner,
    absenManual: absenManual,
    logout: logout
  };
})();
