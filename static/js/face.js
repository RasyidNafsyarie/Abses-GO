/* ============================================
   Absensi GO - Face verification (face-api.js)
   Berjalan di browser; foto tidak dikirim ke server.
   ============================================ */
(function () {
  "use strict";

  var MODEL_URL = "/static/models";

  var loaded = false;
  var loadingPromise = null;

  // ---------- Load model (library dimuat di <head> template) ----------
  function load() {
    if (loaded) return Promise.resolve();
    if (loadingPromise) return loadingPromise;

    loadingPromise = Promise.resolve()
      .then(function () {
        if (typeof window.faceapi === "undefined") {
          throw new Error("face-api.js tidak termuat");
        }
        // Muat model wajah yang dibutuhkan
        return Promise.all([
          window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
      })
      .then(function () {
        loaded = true;
      });

    return loadingPromise;
  }

  // ---------- Capture descriptor dari <video> ----------
  function detectDescriptor(video, withBoxes) {
    if (!loaded) return Promise.reject(new Error("Model belum dimuat"));

    var opts = {
      inputSize: 416,
      scoreThreshold: 0.3
    };

    // Path A: chaining API (works di mayoritas build)
    function viaChaining() {
      var tasks = withBoxes
        ? window.faceapi
            .detectAllFaces(video, new window.faceapi.TinyFaceDetectorOptions(opts))
            .withFaceLandmarks()
            .withFaceDescriptors()
        : window.faceapi
            .detectSingleFace(video, new window.faceapi.TinyFaceDetectorOptions(opts))
            .withFaceLandmarks()
            .withFaceDescriptors();
      return tasks;
    }

    // Path B: fallback dengan computeFaceDescriptor (jika chaining tidak tersedia)
    function viaCompute() {
      return window.faceapi
        .detectSingleFace(video, new window.faceapi.TinyFaceDetectorOptions(opts))
        .withFaceLandmarks()
        .then(function (res) {
          if (!res) return null;
          return window.faceapi.computeFaceDescriptor(video, res);
        })
        .then(function (descriptor) {
          if (!descriptor) return null;
          return {
            descriptor: Array.from(descriptor),
            box: null,
            score: null
          };
        });
    }

    // Cek dulu apakah chaining withFaceDescriptors tersedia
    var canChain = false;
    try {
      // Probe: buat chain tanpa input (hanya cek keberadaan method di prototype)
      var probe = window.faceapi.detectSingleFace;
      canChain = typeof probe === "function";
    } catch (e) {
      canChain = false;
    }

    var task;
    if (canChain) {
      try {
        task = viaChaining();
      } catch (e) {
        task = viaCompute();
      }
    } else {
      task = viaCompute();
    }

    return task.then(function (result) {
      if (withBoxes) {
        if (!result || result.length === 0) return null;
        // Ambil wajah dengan skor tertinggi
        var best = result.reduce(function (a, b) {
          return (a.detection.score >= b.detection.score) ? a : b;
        });
        return {
          descriptor: Array.from(best.descriptor),
          box: best.detection.box,
          score: best.detection.score
        };
      }
      if (!result) return null;
      // Jika viaCompute, result sudah {descriptor,...}; jika viaChaining, result punya .descriptor
      if (result.descriptor) {
        return {
          descriptor: Array.from(result.descriptor),
          box: result.box || null,
          score: result.score || null
        };
      }
      return {
        descriptor: Array.from(result.descriptor),
        box: result.detection ? result.detection.box : null,
        score: result.detection ? result.detection.score : null
      };
    });
  }

  // ---------- Euclidean distance ----------
  function distance(a, b) {
    if (!a || !b || a.length !== b.length) return Infinity;
    var sum = 0;
    for (var i = 0; i < a.length; i++) {
      var d = a[i] - b[i];
      sum += d * d;
    }
    return Math.sqrt(sum);
  }

  // ---------- Utils media ----------
  function getStream(constraints) {
    return navigator.mediaDevices.getUserMedia(constraints || {
      video: { facingMode: "environment" },
      audio: false
    });
  }

  // Buka kamera dengan facing tertentu: "environment" (belakang) / "user" (depan)
  function getStreamFacing(facing) {
    var constraints = { video: { facingMode: facing }, audio: false };
    return navigator.mediaDevices
      .getUserMedia(constraints)
      .catch(function () {
        // Fallback: tanpa facingMode kalau facing tidak didukung
        return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      });
  }

  function startVideo(videoEl, stream) {
    videoEl.srcObject = stream;
    return new Promise(function (resolve) {
      videoEl.onloadedmetadata = function () {
        videoEl.play().then(resolve).catch(resolve);
      };
    });
  }

  function stopStream(stream) {
    if (!stream) return;
    stream.getTracks().forEach(function (t) { t.stop(); });
  }

  function captureFrame(videoEl) {
    var canvas = document.createElement("canvas");
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    canvas.getContext("2d").drawImage(videoEl, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  window.FaceApp = {
    load: load,
    detectDescriptor: detectDescriptor,
    distance: distance,
    getStream: getStream,
    getStreamFacing: getStreamFacing,
    startVideo: startVideo,
    stopStream: stopStream,
    captureFrame: captureFrame,
    THRESHOLD: 0.5
  };
})();
