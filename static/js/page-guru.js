/* ============================================
   Absensi GO - Halaman Guru
   QR Generator, Hari Ini, Cari Siswa, Semua Riwayat
   (data dari API backend, bukan localStorage)
   ============================================ */
(function () {
  "use strict";

  var SESSION_KEY = "userSession";
  var ROLE_KEY = "userRole";

  var qrTimer = null;
  var clockTimer = null;
  var countdownLeft = 30;

  function $(id) { return document.getElementById(id); }

  // ---------- Auth guard ----------
  function guard() {
    var s = sessionStorage.getItem(SESSION_KEY);
    var r = sessionStorage.getItem(ROLE_KEY);
    if (!s || r !== "guru") {
      window.location.href = "/";
      return false;
    }
    return true;
  }

  // ---------- Tabs ----------
  function showTab(name) {
    var tabs = ["qr", "today", "cari", "semua"];
    tabs.forEach(function (t) {
      $("tab-" + t).setAttribute("aria-selected", String(t === name));
      $("panel-" + t).classList.toggle("hidden", t !== name);
    });
    if (name === "qr") startQRTimers();
    if (name === "today") loadToday();
    if (name === "semua") loadSemua();
  }

  // ---------- QR ----------
  function generateQR() {
    var canvas = $("qr-canvas");
    if (!canvas || typeof QRious === "undefined") return;

    var data = "ABSENSI-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
    new QRious({
      element: canvas,
      value: data,
      size: 256,
      foreground: "#0f172a",
      background: "#ffffff"
    });
  }

  function startQRTimers() {
    if (qrTimer || clockTimer) return;
    generateQR();

    qrTimer = setInterval(function () {
      generateQR();
      countdownLeft = 30;
    }, 30000);

    countdownLeft = 30;
    clockTimer = setInterval(function () {
      countdownLeft--;
      if (countdownLeft <= 0) countdownLeft = 30;
      $("qr-timer").textContent = countdownLeft + " detik";
      var now = new Date();
      $("qr-clock").textContent = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }, 1000);
  }

  function refreshQR() {
    generateQR();
    countdownLeft = 30;
    UI.toast("success", "QR Code diperbarui");
  }

  // ---------- Hari Ini ----------
  function loadToday() {
    var tbody = $("tbody-today");
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Memuat data...</td></tr>';

    fetch("/api/history-guru-today")
      .then(function (res) { return res.json(); })
      .then(function (result) {
        if (!result.success) throw new Error(result.message || "Gagal");
        var list = result.data || [];
        $("stat-today").textContent = result.count != null ? result.count : list.length;

        if (list.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="empty">Belum ada yang absen hari ini</td></tr>';
          return;
        }
        tbody.innerHTML = "";
        list.forEach(function (item, i) {
          var tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" + (i + 1) + "</td>" +
            "<td>" + (item.nis || "-") + "</td>" +
            "<td>" + (item.nama || "-") + "</td>" +
            "<td>" + (item.kelas || "-") + "</td>" +
            "<td>" + (item.waktu_hadir || item.waktu || "-") + "</td>";
          tbody.appendChild(tr);
        });
      })
      .catch(function () {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">Gagal memuat data</td></tr>';
      });
  }

  // ---------- Cari Siswa ----------
  function cari(event) {
    event.preventDefault();
    var nis = $("input-nis").value.trim();
    if (!nis) return;

    var tbody = $("tbody-cari");
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Mencari...</td></tr>';

    fetch("/api/history/" + nis)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var list = Array.isArray(data) ? data : (data.data || []);
        if (list.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="empty">Tidak ada riwayat untuk NIS tersebut</td></tr>';
          return;
        }
        tbody.innerHTML = "";
        list.forEach(function (item, i) {
          var tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" + (i + 1) + "</td>" +
            "<td>" + (item.nis || "-") + "</td>" +
            "<td>" + (item.nama || "-") + "</td>" +
            "<td>" + (item.kelas || "-") + "</td>" +
            "<td>" + (item.tanggal_hadir || item.tanggal || "-") + "</td>" +
            "<td>" + (item.waktu_hadir || item.waktu || "-") + "</td>";
          tbody.appendChild(tr);
        });
      })
      .catch(function () {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Gagal mengambil data</td></tr>';
      });
  }

  // ---------- Semua Riwayat ----------
  function loadSemua() {
    var tbody = $("tbody-semua");
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Memuat data...</td></tr>';

    fetch("/api/history")
      .then(function (res) { return res.json(); })
      .then(function (result) {
        var list = (result && result.data) || [];
        $("stat-semua").textContent = list.length + " data";

        if (list.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="empty">Belum ada data absensi</td></tr>';
          return;
        }
        tbody.innerHTML = "";
        list.forEach(function (item, i) {
          var tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" + (i + 1) + "</td>" +
            "<td>" + (item.nis || "-") + "</td>" +
            "<td>" + (item.nama || "-") + "</td>" +
            "<td>" + (item.kelas || "-") + "</td>" +
            "<td>" + (item.tanggal_hadir || item.tanggal || "-") + "</td>" +
            "<td>" + (item.waktu_hadir || item.waktu || "-") + "</td>";
          tbody.appendChild(tr);
        });
      })
      .catch(function () {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Gagal memuat data</td></tr>';
      });
  }

  // ---------- Logout ----------
  function logout() {
    if (qrTimer) clearInterval(qrTimer);
    if (clockTimer) clearInterval(clockTimer);
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(ROLE_KEY);
    window.location.href = "/";
  }

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", function () {
    if (!guard()) return;
    startQRTimers();
    loadToday();
  });

  window.PageGuru = { showTab: showTab, refreshQR: refreshQR, loadToday: loadToday, cari: cari, logout: logout };
})();
