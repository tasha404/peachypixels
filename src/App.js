import React, { useRef, useEffect, useState, useCallback } from "react";
import { HexColorPicker } from "react-colorful";
import "./App.css";

// Organic sticker placement.
//
// Positions (x, y) are fractions of photo width/height, anchored to the sticker's
// top-left corner. Values outside 0–1 intentionally bleed off the edge — that's
// the look we want. size is a fraction of photo width.
//
// Each entry has a small seeded jitter applied at draw time (see seededRand) so
// nothing looks grid-snapped, but the arrangement stays stable across re-renders.

const stickerLayouts = {
  heart: [
    // bleeds off top-left, tilted
    { src: "/stickers/heart.png", x: -0.06, y: -0.05, size: 0.22, rotation: -18, seed: 11 },
    // top edge, slightly right of center, small
    { src: "/stickers/heart.png", x:  0.42, y: -0.04, size: 0.13, rotation:   8, seed: 12 },
    // top-right, half off
    { src: "/stickers/heart.png", x:  0.84, y: -0.07, size: 0.20, rotation:  20, seed: 13 },
    // right edge mid, half off
    { src: "/stickers/heart.png", x:  0.88, y:  0.38, size: 0.15, rotation: -12, seed: 14 },
    // bottom-right, bleeds off corner
    { src: "/stickers/heart.png", x:  0.82, y:  0.80, size: 0.21, rotation:  25, seed: 15 },
    // bottom-left, bleeds off corner
    { src: "/stickers/heart.png", x: -0.05, y:  0.82, size: 0.18, rotation: -22, seed: 16 },
    // left edge mid, slightly off
    { src: "/stickers/heart.png", x: -0.04, y:  0.40, size: 0.13, rotation:  14, seed: 17 },
    // inner accent — bottom center, fully visible, small
    { src: "/stickers/heart.png", x:  0.44, y:  0.84, size: 0.11, rotation:  -5, seed: 18 },
  ],

  star: [
    // top-left bleed, big
    { src: "/stickers/star.png", x: -0.08, y: -0.08, size: 0.24, rotation: -15, seed: 21 },
    // top-right bleed
    { src: "/stickers/star.png", x:  0.85, y: -0.06, size: 0.20, rotation:  20, seed: 22 },
    // left edge, upper third
    { src: "/stickers/star.png", x: -0.05, y:  0.22, size: 0.14, rotation: -30, seed: 23 },
    // right edge, lower third
    { src: "/stickers/star.png", x:  0.90, y:  0.55, size: 0.14, rotation:  35, seed: 24 },
    // bottom-left bleed
    { src: "/stickers/star.png", x: -0.06, y:  0.78, size: 0.21, rotation:  18, seed: 25 },
    // bottom-right bleed
    { src: "/stickers/star.png", x:  0.84, y:  0.82, size: 0.18, rotation: -22, seed: 26 },
    // inner accent top-center, small
    { src: "/stickers/star.png", x:  0.40, y:  0.02, size: 0.10, rotation:  10, seed: 27 },
  ],

  nailong: [
    // all four corners bleeding off, slightly different sizes for life
    { src: "/stickers/nailong.png", x: -0.10, y: -0.10, size: 0.28, rotation: -12, seed: 31 },
    { src: "/stickers/nailong.png", x:  0.82, y: -0.08, size: 0.25, rotation:  15, seed: 32 },
    { src: "/stickers/nailong.png", x: -0.08, y:  0.76, size: 0.26, rotation:  10, seed: 33 },
    { src: "/stickers/nailong.png", x:  0.84, y:  0.78, size: 0.24, rotation: -18, seed: 34 },
    // one small one near top-center for asymmetry
    { src: "/stickers/nailong.png", x:  0.38, y: -0.06, size: 0.15, rotation:   6, seed: 35 },
  ],
};

// Stable pseudo-random: same seed+salt always returns the same float in [-1, 1].
// Used to add a small natural jitter to position and rotation without re-scrambling
// on every re-render.
function seededRand(seed, salt = 0) {
  const x = Math.sin(seed * 9301 + salt * 49297 + 233) * 93458;
  return (x - Math.floor(x)) * 2 - 1; // remap to [-1, 1]
}

// Applies a filter directly to pixel data in a canvas region.
// Works identically on iOS/Android/desktop, unlike ctx.filter (which is
// unreliable/silently ignored on iOS Safari, especially with drawImage).
function applyPixelFilter(ctx, x, y, w, h, filterType) {
  if (!filterType || filterType === "none" || w <= 0 || h <= 0) return;

  const imageData = ctx.getImageData(x, y, w, h);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    switch (filterType) {
      case "bw": {
        const avg = 0.299 * r + 0.587 * g + 0.114 * b;
        r = g = b = avg;
        break;
      }
      case "vintage": {
        // approximates sepia(60%) contrast(110%)
        const sr = r * 0.393 + g * 0.769 + b * 0.189;
        const sg = r * 0.349 + g * 0.686 + b * 0.168;
        const sb = r * 0.272 + g * 0.534 + b * 0.131;
        r = r * 0.4 + sr * 0.6;
        g = g * 0.4 + sg * 0.6;
        b = b * 0.4 + sb * 0.6;
        r = (r - 128) * 1.1 + 128;
        g = (g - 128) * 1.1 + 128;
        b = (b - 128) * 1.1 + 128;
        break;
      }
      case "bright": {
        r *= 1.3;
        g *= 1.3;
        b *= 1.3;
        break;
      }
      default:
        break;
    }

    data[i]     = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }

  ctx.putImageData(imageData, x, y);
}

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const pickerRef = useRef(null);
  const borderPickerRef = useRef(null);
  const textPickerRef = useRef(null);

  const [screen, setScreen] = useState("home");
  const [layout, setLayout] = useState(null);
  const [filter, setFilter] = useState("none");

  const [photos, setPhotos] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const [flash, setFlash] = useState(false);

  const [borderColor, setBorderColor] = useState("#ffe4ef");
  const [caption, setCaption] = useState("");
  const [borderType, setBorderType] = useState("solid");
  const [captionColor, setCaptionColor] = useState("#000000");
  const [captionSize, setCaptionSize] = useState(30);
  const [captionFont, setCaptionFont] = useState("Quicksand");

  const [showBorderPicker, setShowBorderPicker] = useState(false);
  const [showTextPicker, setShowTextPicker] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [selectedSticker, setSelectedSticker] = useState(null);

  useEffect(() => {
    if (screen === "home") {
      document.body.classList.add("home-mode");
      document.body.classList.remove("result-mode");
    } else {
      document.body.classList.remove("home-mode");
      document.body.classList.add("result-mode");
    }
  }, [screen]);

  /* CLOSE PICKERS ON OUTSIDE CLICK */
  useEffect(() => {
    function handleClickOutside(event) {
      if (borderPickerRef.current && !borderPickerRef.current.contains(event.target)) {
        setShowBorderPicker(false);
      }
      if (textPickerRef.current && !textPickerRef.current.contains(event.target)) {
        setShowTextPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* CAMERA */
  useEffect(() => {
    if (screen === "camera") startCamera();
  }, [screen]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
      });
      videoRef.current.srcObject = stream;
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject;
    if (stream) stream.getTracks().forEach((track) => track.stop());
  };

  const goHome = () => {
    stopCamera();
    setPhotos([]);
    setLayout(null);
    setScreen("home");
  };

  const retake = () => {
    setPhotos([]);
    setScreen("camera");
  };

  const getPhotoCount = () => {
    if (layout === "strip3") return 3;
    if (layout === "grid3x2") return 6;
    return 4;
  };

  const startCapture = async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    let newPhotos = [];
    const total = getPhotoCount();
    for (let i = 0; i < total; i++) {
      await startCountdown();
      newPhotos.push(takePhoto());
    }
    stopCamera();
    setPhotos(newPhotos);
    setScreen("result");
    setIsCapturing(false);
  };

  const startCountdown = () => {
    return new Promise((resolve) => {
      let timeLeft = 3;
      setCountdown(timeLeft);
      const timer = setInterval(() => {
        timeLeft--;
        if (timeLeft === 0) {
          clearInterval(timer);
          setCountdown(null);
          resolve();
        } else {
          setCountdown(timeLeft);
        }
      }, 1000);
    });
  };

  // Used for the LIVE PREVIEW only (CSS filter on camera-wrapper).
  // CSS filter works fine on iOS Safari — it's ctx.filter (canvas) that's unreliable.
  const getCanvasFilter = useCallback(() => {
    switch (filter) {
      case "bw":      return "grayscale(100%)";
      case "vintage": return "sepia(60%) contrast(110%)";
      case "bright":  return "brightness(130%)";
      default:        return "none";
    }
  }, [filter]);

  const takePhoto = () => {
    const video = videoRef.current;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const targetRatio = 4 / 3;
    let cropWidth = videoWidth;
    let cropHeight = videoWidth / targetRatio;
    if (cropHeight > videoHeight) {
      cropHeight = videoHeight;
      cropWidth = videoHeight * targetRatio;
    }
    const sx = (videoWidth - cropWidth) / 2;
    const sy = (videoHeight - cropHeight) / 2;
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    setFlash(true);
    setTimeout(() => setFlash(false), 200);

    ctx.save();
    ctx.translate(cropWidth, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    ctx.restore();

    // Bake the filter into pixel data instead of ctx.filter (iOS-safe)
    applyPixelFilter(ctx, 0, 0, cropWidth, cropHeight, filter);

    return canvas.toDataURL("image/png");
  };

  const download = () => {
    const link = document.createElement("a");
    link.download = "photobooth.png";
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  // Preload all sticker images once so drawSticker doesn't reload them every render
  const stickerImgCache = useRef({});

  const loadStickerImg = useCallback((src) => {
    if (stickerImgCache.current[src]) return Promise.resolve(stickerImgCache.current[src]);
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { stickerImgCache.current[src] = img; resolve(img); };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }, []);

  // photoSlots: array of { x, y, w, h } in canvas pixels.
  // Sticker x/y are fractions of the slot — values outside 0–1 bleed off the edge
  // intentionally. A tiny seeded jitter (~3% of slot width) is added so nothing
  // looks grid-snapped, but the composition stays stable across re-renders.
  const drawSticker = useCallback(async (ctx, photoSlots) => {
    if (!selectedSticker || !photoSlots?.length) return;
    const stickerDefs = stickerLayouts[selectedSticker];
    if (!stickerDefs) return;

    for (const slot of photoSlots) {
      for (let i = 0; i < stickerDefs.length; i++) {
        const sticker = stickerDefs[i];
        const img = await loadStickerImg(sticker.src);
        if (!img) continue;

        const stickerSize = slot.w * sticker.size;

        // Base position from layout definition (fractions of slot size)
        const baseX = slot.x + sticker.x * slot.w;
        const baseY = slot.y + sticker.y * slot.h;

        // Tiny seeded jitter — ±3% of slot width/height so it feels hand-placed
        const jitterX = seededRand(sticker.seed, i)     * slot.w * 0.03;
        const jitterY = seededRand(sticker.seed, i + 1) * slot.h * 0.03;

        const x = baseX + jitterX;
        const y = baseY + jitterY;

        // Rotation: base angle + tiny seeded wobble (±5°)
        const rotWobble = seededRand(sticker.seed, i + 2) * 5;
        const rotation = ((sticker.rotation || 0) + rotWobble) * Math.PI / 180;

        ctx.save();
        ctx.translate(x + stickerSize / 2, y + stickerSize / 2);
        ctx.rotate(rotation);
        ctx.drawImage(img, -stickerSize / 2, -stickerSize / 2, stickerSize, stickerSize);
        ctx.restore();
      }
    }
  }, [selectedSticker, loadStickerImg]);

  /* DRAW RESULT CANVAS */
  useEffect(() => {
    if (screen !== "result" || photos.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const maxMobileWidth = 380;
    const width = window.innerWidth < 768
      ? Math.min(window.innerWidth * 0.85, maxMobileWidth)
      : 200;
    const padding = 20;
    const textSpace = 100;

    const drawAll = async () => {
      const columns = layout === "grid2x2" || layout === "grid3x2" ? 2 : 1;
      const rows =
        layout === "grid2x2" ? 2 :
        layout === "grid3x2" ? 3 :
        photos.length;

      canvas.width = columns === 1
        ? width + padding * 2
        : width * columns + padding * (columns + 1);

      const firstImg = new Image();
      firstImg.src = photos[0];
      firstImg.crossOrigin = "anonymous";
      await new Promise(resolve => { firstImg.onload = resolve; firstImg.onerror = resolve; });

      const ratio = firstImg.width / firstImg.height;
      const drawHeight = width / ratio;
      canvas.height = rows * drawHeight + padding * (rows + 1) + textSpace;

      await drawAllContent();
    };

    const drawAllContent = async () => {
      // 1. Draw background/border
      if (borderType === "solid") {
        ctx.fillStyle = borderColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (borderType === "redPlaid" || borderType === "bluePlaid") {
        const bg = new Image();
        bg.src = borderType === "redPlaid" ? "/redplaid.png" : "/blueplaid.png";
        bg.crossOrigin = "anonymous";
        await new Promise(resolve => { bg.onload = resolve; bg.onerror = resolve; });
        const pattern = ctx.createPattern(bg, "repeat");
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // 2. Draw photos — collect slot positions as we go
      // NOTE: photos already have the filter baked in from takePhoto(), so we
      // do NOT re-apply a filter here. Re-applying would double up the effect
      // and was also the ctx.filter call that broke on iOS.
      const photoSlots = [];

      for (let i = 0; i < photos.length; i++) {
        const img = new Image();
        img.src = photos[i];
        img.crossOrigin = "anonymous";
        await new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });

        const drawWidth = width;
        const drawH = width * 0.75;
        let x = padding;
        let y = padding;

        if (layout === "strip4" || layout === "strip3") {
          x = padding;
          y = padding + i * (drawH + padding);
        } else if (layout === "grid2x2" || layout === "grid3x2") {
          const row = Math.floor(i / 2);
          const col = i % 2;
          x = padding + col * (drawWidth + padding);
          y = padding + row * (drawH + padding);
        }

        ctx.drawImage(img, x, y, drawWidth, drawH);

        // Record this slot so drawSticker can place stickers relative to it
        photoSlots.push({ x, y, w: drawWidth, h: drawH });
      }

      // 3. Draw caption
      ctx.fillStyle = captionColor;
      ctx.font = `${captionSize}px ${captionFont}`;
      ctx.textAlign = "center";
      ctx.fillText(caption, canvas.width / 2, canvas.height - 50);

      // 4. Draw stickers — positioned relative to each photo slot
      await drawSticker(ctx, photoSlots);
    };

    drawAll();
  }, [
    screen, photos, layout, borderColor, borderType,
    caption, captionColor, captionSize, captionFont,
    selectedSticker, drawSticker, loadStickerImg
  ]);

  // ─── helper: swatch style for border & sticker selectors ───────────────────
  const swatchStyle = (isActive, extraStyle = {}) => ({
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    cursor: "pointer",
    flexShrink: 0,
    border: isActive ? "3px solid #ff4d7e" : "3px solid white",
    boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    ...extraStyle
  });

  return (
    <div className="container">
      <h1>Peachy Pixels</h1>

      {screen !== "home" && (
        <div className="home-icon" onClick={goHome}>🏠</div>
      )}

      {/* ── HOME SCREEN ────────────────────────────────────────────── */}
      {screen === "home" && (
        <div className="layout-group">
          <button onClick={() => { setLayout("strip4"); setScreen("camera"); }}>4 Strip</button>
          <button onClick={() => { setLayout("strip3"); setScreen("camera"); }}>3 Strip</button>
          <button onClick={() => { setLayout("grid2x2"); setScreen("camera"); }}>2×2 Grid</button>
          <button onClick={() => { setLayout("grid3x2"); setScreen("camera"); }}>3×2 Grid</button>
        </div>
      )}

      {/* ── CAMERA SCREEN ──────────────────────────────────────────── */}
      {screen === "camera" && (
        <>
          <div
            className="camera-wrapper"
            style={{ filter: getCanvasFilter(), WebkitFilter: getCanvasFilter() }}
          >
            <video ref={videoRef} autoPlay playsInline muted className="video mirror" />
            {countdown && <div className="countdown-overlay">{countdown}</div>}
            {flash && <div className="flash" />}
          </div>

          <div className="filter-group">
            {[
              { id: "none",    label: "Normal"  },
              { id: "bw",      label: "B&W"     },
              { id: "vintage", label: "Vintage" },
              { id: "bright",  label: "Bright"  },
            ].map(({ id, label }) => (
              <button
                key={id}
                disabled={isCapturing}
                onClick={() => setFilter(id)}
                className={filter === id ? "active" : ""}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="start-wrapper">
            <button disabled={isCapturing} onClick={startCapture}>
              {isCapturing ? "Capturing…" : "Start"}
            </button>
          </div>
        </>
      )}

      {/* ── RESULT SCREEN ──────────────────────────────────────────── */}
      {screen === "result" && (
        <div className="result-layout">

          {/* PREVIEW + ACTION BUTTONS */}
          <div className="preview-side">
            <canvas ref={canvasRef} className="canvas" />
            <div className="result-buttons">
              <button onClick={download}>Download</button>
              <button onClick={retake}>Retake</button>
            </div>
          </div>

          {/* EDITOR PANEL */}
          <div className="editor-side" ref={pickerRef}>

            {/* BORDER */}
            <div className="editor-card">
              <p>Border</p>
              <div className="sticker-row">

                {/* Solid colour swatch */}
                <div
                  className="color-circle-btn"
                  style={{
                    background: borderColor,
                    border: borderType === "solid" ? "3px solid #ff4d7e" : "3px solid white"
                  }}
                  onClick={() => {
                    setBorderType("solid");
                    setShowBorderPicker(!showBorderPicker);
                    setShowTextPicker(false);
                  }}
                />

                {/* Red Plaid */}
                <div
                  onClick={() => { setBorderType("redPlaid"); setShowBorderPicker(false); }}
                  style={swatchStyle(borderType === "redPlaid", {
                    backgroundImage: "url('/redplaid.png')",
                    backgroundSize: "cover",
                    backgroundPosition: "center"
                  })}
                />

                {/* Blue Plaid */}
                <div
                  onClick={() => { setBorderType("bluePlaid"); setShowBorderPicker(false); }}
                  style={swatchStyle(borderType === "bluePlaid", {
                    backgroundImage: "url('/blueplaid.png')",
                    backgroundSize: "cover",
                    backgroundPosition: "center"
                  })}
                />
              </div>

              {showBorderPicker && (
                <div className="picker-popup" ref={borderPickerRef}>
                  <HexColorPicker color={borderColor} onChange={setBorderColor} />
                </div>
              )}
            </div>

            {/* STICKERS */}
            <div className="editor-card">
              <p>Stickers</p>
              <div className="sticker-row">

                {/* None */}
                <div
                  onClick={() => setSelectedSticker(null)}
                  style={swatchStyle(selectedSticker === null, { background: "#fff0f5" })}
                />

                {/* Heart */}
                <div
                  onClick={() => setSelectedSticker("heart")}
                  style={swatchStyle(selectedSticker === "heart", {
                    backgroundImage: "url('/stickers/heart.png')",
                    backgroundSize: "cover",
                    backgroundPosition: "center"
                  })}
                />

                {/* Star */}
                <div
                  onClick={() => setSelectedSticker("star")}
                  style={swatchStyle(selectedSticker === "star", {
                    backgroundImage: "url('/stickers/star.png')",
                    backgroundSize: "cover",
                    backgroundPosition: "center"
                  })}
                />

                {/* Nailong */}
                <div
                  onClick={() => setSelectedSticker("nailong")}
                  style={swatchStyle(selectedSticker === "nailong", {
                    backgroundImage: "url('/stickers/nailong.png')",
                    backgroundSize: "cover",
                    backgroundPosition: "center"
                  })}
                />
              </div>
            </div>

            {/* TEXT */}
            <div className="editor-card">
              <p>Text</p>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Type here…"
              />
            </div>

            {/* TEXT SETTINGS */}
            <div className="editor-card">
              <p>Text Settings</p>
              <div className="text-settings-row">

                {/* Colour picker trigger */}
                <div className="text-setting-item">
                  <div
                    className="color-circle-btn"
                    style={{ background: captionColor }}
                    onClick={() => {
                      setShowTextPicker(!showTextPicker);
                      setShowBorderPicker(false);
                    }}
                  />
                  {showTextPicker && (
                    <div className="picker-popup" ref={textPickerRef}>
                      <HexColorPicker color={captionColor} onChange={setCaptionColor} />
                    </div>
                  )}
                </div>

                {/* Font */}
                <div className="text-setting-item" style={{ flex: 1 }}>
                  <select
                    value={captionFont}
                    onChange={(e) => setCaptionFont(e.target.value)}
                    className="font-dropdown"
                    style={{ width: "100%" }}
                  >
                    <option value="Quicksand">Quicksand</option>
                    <option value="Pacifico">Pacifico</option>
                    <option value="Playfair Display">Playfair</option>
                    <option value="Montserrat">Montserrat</option>
                    <option value="Anton">Anton</option>
                    <option value="Indie Flower">Indie Flower</option>
                    <option value="Dancing Script">Dancing Script</option>
                    <option value="Poppins">Poppins</option>
                  </select>
                </div>

                {/* Size */}
                <div className="text-setting-item">
                  <input
                    type="number"
                    min="10"
                    max="120"
                    value={captionSize}
                    onChange={(e) => setCaptionSize(parseInt(e.target.value) || 30)}
                    className="size-input"
                  />
                </div>

              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default App;