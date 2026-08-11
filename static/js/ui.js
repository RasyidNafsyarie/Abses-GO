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

  // Expose API global
  window.UI = {
    toast: showToast,
    showToast: showToast,
    openModal: openModal,
    closeModal: closeModal,
    initIcons: initIcons
  };

  document.addEventListener("DOMContentLoaded", initIcons);
})();
