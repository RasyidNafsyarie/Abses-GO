/* ============================================
   Absensi GO - UI utilities (toast, modal, icons)
   ============================================ */

(function () {
  "use strict";

  // ---------- Icons (Lucide) ----------
  function initIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  // ---------- Toast ----------
  function showToast(type, message) {
    var el = document.getElementById("toast");
    if (!el) return;

    el.className = "toast toast-" + type;
    el.textContent = message;

    // force reflow agar animasi jalan ulang
    void el.offsetWidth;
    el.classList.add("show");

    clearTimeout(el._timer);
    el._timer = setTimeout(function () {
      el.classList.remove("show");
    }, 3200);
  }

  // ---------- Modal ----------
  function openModal(id) {
    var modal = document.getElementById(id);
    if (modal) modal.classList.add("open");
  }

  function closeModal(id) {
    var modal = document.getElementById(id);
    if (modal) modal.classList.remove("open");
  }

  // Tutup modal via backdrop / tombol [data-close-modal]
  document.addEventListener("click", function (e) {
    if (e.target.classList && e.target.classList.contains("modal-backdrop")) {
      e.target.classList.remove("open");
    }
    var closer = e.target.closest("[data-close-modal]");
    if (closer) {
      var modal = closer.closest(".modal-backdrop");
      if (modal) modal.classList.remove("open");
    }
  });

  // Esc menutup modal
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      var open = document.querySelector(".modal-backdrop.open");
      if (open) open.classList.remove("open");
    }
  });

  // ---------- Format waktu WIB ----------
  // String datetime dari server (mis. "2026-08-11 17:59:24") adalah waktu lokal WIB.
  // Ditampilkan sebagai "HH:MM WIB".
  function formatWIB(datetimeStr) {
    if (!datetimeStr) return "-";
    var s = String(datetimeStr);
    // Ambil bagian jam:menit dari "YYYY-MM-DD HH:MM:SS" atau "YYYY-MM-DDTHH:MM:SS"
    var m = s.match(/(\d{2}):(\d{2})/);
    if (m) return m[1] + ":" + m[2] + " WIB";
    return s;
  }

  // Format tanggal Indonesia: "Senin, 11 Agustus 2026"
  function formatTanggalId(dateStr) {
    if (!dateStr) return "-";
    var s = String(dateStr).slice(0, 10); // YYYY-MM-DD
    var parts = s.split("-");
    if (parts.length !== 3) return s;
    var bulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    var b = parseInt(parts[1], 10) - 1;
    var nama = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    try {
      var d = new Date(parts[0], b, parts[2]);
      return nama[d.getDay()] + ", " + parseInt(parts[2], 10) + " " + (bulan[b] || "") + " " + parts[0];
    } catch (e) {
      return s;
    }
  }

  // Expose API global
  window.UI = {
    toast: showToast,
    showToast: showToast,
    openModal: openModal,
    closeModal: closeModal,
    initIcons: initIcons,
    formatWIB: formatWIB,
    formatTanggalId: formatTanggalId
  };

  document.addEventListener("DOMContentLoaded", initIcons);
})();
