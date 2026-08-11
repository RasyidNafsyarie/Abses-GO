/* ============================================
   Absensi GO - Login page
   ============================================ */
(function () {
  "use strict";

  var SESSION_KEY = "userSession";
  var ROLE_KEY = "userRole";
  var NAME_KEY = "namaSiswa";

  var els = {};

  function $(id) { return document.getElementById(id); }

  function cacheEls() {
    els = {
      tabSiswa: $("tab-siswa"),
      tabGuru: $("tab-guru"),
      formSiswa: $("form-siswa"),
      formGuru: $("form-guru"),
      noteSiswa: $("note-siswa"),
      noteGuru: $("note-guru"),
      btnSiswa: $("btn-login-siswa"),
      btnGuru: $("btn-login-guru")
    };
  }

  function selectRole(role) {
    var isSiswa = role === "siswa";
    els.tabSiswa.setAttribute("aria-selected", String(isSiswa));
    els.tabGuru.setAttribute("aria-selected", String(!isSiswa));
    els.formSiswa.classList.toggle("hidden", !isSiswa);
    els.formGuru.classList.toggle("hidden", isSiswa);
    setNote("siswa", "", "");
    setNote("guru", "", "");
  }

  function setNote(role, type, message) {
    var el = role === "siswa" ? els.noteSiswa : els.noteGuru;
    el.className = "form-note" + (type ? " " + type : "");
    el.textContent = message;
  }

  function setLoading(role, loading) {
    var btn = role === "siswa" ? els.btnSiswa : els.btnGuru;
    var original = btn.dataset.original || btn.textContent;
    if (loading) {
      btn.dataset.original = original;
      btn.textContent = "Memproses...";
      btn.disabled = true;
    } else {
      btn.textContent = original;
      btn.disabled = false;
    }
  }

  function submit(event, role) {
    event.preventDefault();

    var isSiswa = role === "siswa";
    var form = isSiswa ? els.formSiswa : els.formGuru;
    var username = $("username-" + role).value.trim();
    var password = $("password-" + role).value.trim();

    if (!username || !password) {
      setNote(role, "error", "Username dan password wajib diisi");
      return;
    }

    setLoading(role, true);
    setNote(role, "", "");

    fetch("/api/login-" + role, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username, password: password })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.success) {
          sessionStorage.setItem(SESSION_KEY, isSiswa ? data.user : username);
          sessionStorage.setItem(ROLE_KEY, role);
          if (isSiswa && data.nama) sessionStorage.setItem(NAME_KEY, data.nama);
          window.location.href = isSiswa ? "/siswa" : "/guru";
        } else {
          setNote(role, "error", data.error || "Login gagal");
          setLoading(role, false);
        }
      })
      .catch(function () {
        setNote(role, "error", "Terjadi kesalahan koneksi");
        setLoading(role, false);
      });
  }

  // Bersihkan session lama saat membuka halaman login
  document.addEventListener("DOMContentLoaded", function () {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(ROLE_KEY);
    sessionStorage.removeItem(NAME_KEY);
    cacheEls();
    selectRole("siswa");
  });

  window.LoginApp = { selectRole: selectRole, submit: submit };
})();
