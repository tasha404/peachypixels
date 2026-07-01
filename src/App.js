import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
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

// Each layout follows a hero → anchor → accent hierarchy rather than
// uniform corner repetition — one large "lead" sticker, one mid-size
// sticker on the opposite diagonal, and 2–3 small trailing accents.
// This size variation is what reads as hand-placed instead of
// copy-pasted into all four corners at once. All values are fractions
// of the photo slot, so composition scales identically on any screen.
const stickerLayouts = {
  heart: [
    // HERO — top-left, largest, sets the anchor point for the eye
    { src: "/stickers/heart.png", x: -0.09, y: -0.08, size: 0.27, rotation: -16, seed: 11 },
    // ANCHOR — bottom-right, opposite diagonal, medium size
    { src: "/stickers/heart.png", x:  0.80, y:  0.76, size: 0.20, rotation:  22, seed: 15 },
    // small accent, top-right, trailing off the hero's energy
    { src: "/stickers/heart.png", x:  0.86, y: -0.05, size: 0.13, rotation:  16, seed: 13 },
    // small accent, left edge, upper third — breaks up empty left side
    { src: "/stickers/heart.png", x: -0.05, y:  0.30, size: 0.11, rotation: -20, seed: 17 },
    // tiny accent, bottom-left — balances the bottom-right anchor
    { src: "/stickers/heart.png", x: -0.04, y:  0.80, size: 0.10, rotation: -10, seed: 16 },
    // tiny accent, fully inside near top-center — keeps composition from feeling edge-only
    { src: "/stickers/heart.png", x:  0.52, y:  0.04, size: 0.08, rotation:   6, seed: 18 },
  ],

  star: [
    // HERO — top-right, largest, diagonal sweep down to bottom-left
    { src: "/stickers/star.png", x:  0.84, y: -0.10, size: 0.27, rotation:  18, seed: 21 },
    // ANCHOR — bottom-left, opposite diagonal, medium size
    { src: "/stickers/star.png", x: -0.10, y:  0.75, size: 0.21, rotation: -20, seed: 25 },
    // small accent, top-left, balances the hero
    { src: "/stickers/star.png", x: -0.06, y: -0.05, size: 0.12, rotation: -15, seed: 22 },
    // small accent, right edge, upper third
    { src: "/stickers/star.png", x:  0.89, y:  0.22, size: 0.11, rotation:  30, seed: 24 },
    // tiny accent, bottom-right — closes the loop without matching the anchor's size
    { src: "/stickers/star.png", x:  0.84, y:  0.82, size: 0.10, rotation: -14, seed: 26 },
    // tiny accent, fully visible top-center
    { src: "/stickers/star.png", x:  0.44, y:  0.02, size: 0.08, rotation:  10, seed: 27 },
  ],

  nailong: [
    // HERO — top-left, largest
    { src: "/stickers/nailong.png", x: -0.11, y: -0.10, size: 0.29, rotation: -12, seed: 31 },
    // ANCHOR — bottom-right, opposite diagonal, clearly secondary in size
    { src: "/stickers/nailong.png", x:  0.80, y:  0.74, size: 0.22, rotation: -16, seed: 34 },
    // small accent, top-right
    { src: "/stickers/nailong.png", x:  0.84, y: -0.07, size: 0.16, rotation:  14, seed: 32 },
    // small accent, bottom-left — deliberately smaller than the anchor to avoid a 4-corner grid feel
    { src: "/stickers/nailong.png", x: -0.08, y:  0.78, size: 0.15, rotation:  10, seed: 33 },
    // tiny accent near top-center for asymmetry
    { src: "/stickers/nailong.png", x:  0.40, y: -0.05, size: 0.12, rotation:   6, seed: 35 },
  ],

  bubbles: [
    // HERO — bubbletrio (already a clustered group), bottom-left, bleeding off the edge
    { src: "/stickers/bubbletrio.png", x: -0.08, y:  0.58, size: 0.27, rotation:  -4, seed: 51 },
    // ANCHOR — bubblehollow, top-right, opposite diagonal
    { src: "/stickers/bubblehollow.png", x:  0.76, y: -0.08, size: 0.17, rotation:   6, seed: 52 },
    // small accent drifting near center-right
    { src: "/stickers/bubbleaespa.png", x:  0.58, y:  0.34, size: 0.10, rotation:  -8, seed: 53 },
    // small accent, top-left
    { src: "/stickers/bubblehollow.png", x: -0.05, y:  0.03, size: 0.09, rotation:   5, seed: 54 },
    // tiny accent, bottom-right
    { src: "/stickers/bubbletrio.png", x:  0.84, y:  0.80, size: 0.11, rotation:  10, seed: 55 },
    // tiny accent, top-center
    { src: "/stickers/bubbleaespa.png", x:  0.40, y:  0.01, size: 0.07, rotation:   0, seed: 56 },
  ],
};

// Single source of truth for every selectable sticker set — both the
// camera-screen side menu and the result-screen sticker row read from
// this, so they can't drift out of sync. Thumbnail is just the first
// (hero) image from that sticker's layout.
const stickerOptions = [
  { key: null,       label: "None" },
  { key: "heart",    label: "Heart",    thumb: stickerLayouts.heart[0].src },
  { key: "star",     label: "Star",     thumb: stickerLayouts.star[0].src },
  { key: "nailong",  label: "Nailong",  thumb: stickerLayouts.nailong[0].src },
  { key: "bubbles",  label: "Bubbles",  thumb: stickerLayouts.bubbles[0].src },
];

// Live-only "float from bottom to top" animation shown on the result
// screen when Bubbles is selected. left/size are percentages of the
// Bubble source images and the pool of possible visual variety. Actual
// positions/timing/drift are generated fresh each time Bubbles is
// selected — see the useMemo below in App() — so the pattern never
// looks identical twice.
const bubbleSrcs = [
  "/stickers/bubbletrio.png",
  "/stickers/bubblehollow.png",
  "/stickers/bubbleaespa.png",
];

function generateBubbleParticles(count = 12) {
  // Stratified sampling: split the full width into `count` equal slices
  // and place one bubble randomly within each slice. Guarantees coverage
  // across the entire frame every time, instead of plain random positions
  // that can (by chance) cluster and leave a whole side empty.
  const sliceWidth = 100 / count;
  return Array.from({ length: count }).map((_, i) => {
    const sliceStart = i * sliceWidth;
    const left = sliceStart + Math.random() * sliceWidth * 0.9 + sliceWidth * 0.05;
    return {
      src: bubbleSrcs[Math.floor(Math.random() * bubbleSrcs.length)],
      left,                                  // spread across the full 0%–100%
      size: Math.random() * 10 + 6,          // 6%–16% of frame width
      duration: Math.random() * 4 + 3,       // 3s–7s per rise — wide variance so they don't move in lock-step
      delay: Math.random() * 3.5,            // 0s–3.5s stagger
    };
  });
}

// ─── BORDER PATTERNS ─────────────────────────────────────────────────────
// Every non-solid border option lives here as a single source of truth:
// key -> { src, label }. Add a new border by adding one line here — the
// swatch row and the canvas draw logic both read from this automatically.
const borderPatterns = {
  redPlaid:      { src: "/redplaid.png",      label: "Red Plaid" },
  bluePlaid:     { src: "/blueplaid.png",     label: "Blue Plaid" },
  pinkDots:      { src: "/pinkdots.jpg",      label: "Pink Dots" },
  pinkPiano:     { src: "/pinkpiano.jpg",     label: "Pink Piano" },
  pinkStar:      { src: "/pinkstar.jpg",      label: "Pink Star" },
  plaidMix:      { src: "/plaidmix.jpg",      label: "Plaid Mix" },
  plaidPinkSide: { src: "/plaidpinkside.jpg", label: "Plaid Pink Side" },
  sky:           { src: "/sky.jpg",           label: "Sky" },
  spiralGreen:   { src: "/spiralgreen.jpg",   label: "Spiral Green" },
  starWhimsy:    { src: "/starwhimsy.jpg",    label: "Star Whimsy" },
  tilePink:      { src: "/tilepink.jpg",      label: "Tile Pink" },
};

// Stable pseudo-random: same seed+salt always returns the same float in [-1, 1].
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
  // borderType is either "solid" or one of the keys in borderPatterns
  const [borderType, setBorderType] = useState("solid");
  const [captionColor, setCaptionColor] = useState("#000000");
  const [captionSize, setCaptionSize] = useState(30);
  const [captionFont, setCaptionFont] = useState("Quicksand");

  const [showBorderPicker, setShowBorderPicker] = useState(false);
  const [showTextPicker, setShowTextPicker] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [selectedSticker, setSelectedSticker] = useState(null);

  // Fresh random float pattern (position/speed/drift) every time bubbles
  // is turned on — recomputes whenever selectedSticker flips to "bubbles",
  // not on every render, so it stays stable while you're framing the shot.
  const bubbleParticles = useMemo(() => {
    if (selectedSticker !== "bubbles") return [];
    return generateBubbleParticles();
  }, [selectedSticker]);

  // Timestamp the float animation actually started (matches when
  // bubbleParticles was generated) — takePhoto() uses this to work out
  // exactly where each bubble is at the moment a shot is taken.
  const bubbleStartRef = useRef(Date.now());
  useEffect(() => {
    bubbleStartRef.current = Date.now();
  }, [bubbleParticles]);

  // Computes each bubble's live position/opacity right now, using the same
  // math as the CSS @keyframes floatUp (linear bottom -15%→115%, with the
  // matching opacity fade-in/out envelope). Used to bake a frozen snapshot
  // of "whatever was on screen" into the photo at capture time.
  const getBubbleSnapshotNow = useCallback(() => {
    if (selectedSticker !== "bubbles" || bubbleParticles.length === 0) return [];
    const elapsedSinceStart = (Date.now() - bubbleStartRef.current) / 1000;

    return bubbleParticles
      .map((b) => {
        if (elapsedSinceStart < b.delay) return null; // hasn't risen yet

        const cycleTime = (elapsedSinceStart - b.delay) % b.duration;
        const progress = cycleTime / b.duration; // 0 → 1 over one rise

        const bottomPercent = -15 + progress * 130; // matches keyframe 0%→100%

        let opacity;
        if (progress < 0.10) opacity = (progress / 0.10) * 0.9;
        else if (progress < 0.85) opacity = 0.9 - ((progress - 0.10) / 0.75) * 0.05;
        else opacity = 0.85 * (1 - (progress - 0.85) / 0.15);

        return { src: b.src, left: b.left, size: b.size, bottomPercent, opacity };
      })
      .filter((b) => b && b.opacity > 0.05);
  }, [selectedSticker, bubbleParticles]);

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
      newPhotos.push(await takePhoto());
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

  const takePhoto = async () => {
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

    // Bake whichever bubbles were on screen at this exact instant —
    // each photo in a strip/grid gets its own frozen moment.
    if (selectedSticker === "bubbles") {
      const snapshot = getBubbleSnapshotNow();
      for (const b of snapshot) {
        const img = await loadImg(b.src);
        if (!img) continue;

        const size = cropWidth * (b.size / 100);
        const x = cropWidth * (b.left / 100);
        const bottomOffset = cropHeight * (b.bottomPercent / 100);
        const y = cropHeight - bottomOffset - size;

        ctx.save();
        ctx.globalAlpha = b.opacity;
        ctx.drawImage(img, x, y, size, size);
        ctx.restore();
      }
    }

    return canvas.toDataURL("image/png");
  };

  const download = () => {
    const link = document.createElement("a");
    link.download = "photobooth.png";
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  // Preload all sticker/pattern images once so we don't reload them every render
  const imgCache = useRef({});

  const loadImg = useCallback((src) => {
    if (imgCache.current[src]) return Promise.resolve(imgCache.current[src]);
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { imgCache.current[src] = img; resolve(img); };
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

    // Bubbles are already baked into each individual photo at capture
    // time (see takePhoto/getBubbleSnapshotNow) — drawing the generic
    // stickerLayouts.bubbles composition here on top would double them up.
    if (selectedSticker === "bubbles") return;

    const stickerDefs = stickerLayouts[selectedSticker];
    if (!stickerDefs) return;

    for (const slot of photoSlots) {
      for (let i = 0; i < stickerDefs.length; i++) {
        const sticker = stickerDefs[i];
        const img = await loadImg(sticker.src);
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
  }, [selectedSticker, loadImg]);

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
      } else if (borderPatterns[borderType]) {
        const bg = await loadImg(borderPatterns[borderType].src);
        if (bg) {
          const pattern = ctx.createPattern(bg, "repeat");
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }

      // 2. Draw photos — collect slot positions as we go
      // NOTE: photos already have the filter baked in from takePhoto(), so we
      // do NOT re-apply a filter here.
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
    selectedSticker, drawSticker, loadImg
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
          <div className="camera-stage">
            <div className="camera-wrapper">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="video mirror"
                style={{ filter: getCanvasFilter(), WebkitFilter: getCanvasFilter() }}
              />

              {/* Live sticker preview. Deliberately NOT inside the filtered
                  element — stickers should keep their own colors regardless
                  of B&W/Vintage/Bright, so the filter is applied to the
                  video only, above. Bubbles get the actual floating
                  animation here (same as the result screen); other
                  stickers just show a static placement preview. */}
              {selectedSticker === "bubbles" && (
                <div className="floating-bubbles-overlay">
                  {bubbleParticles.map((b, i) => (
                    <img
                      key={i}
                      src={b.src}
                      alt=""
                      className="floating-bubble-particle"
                      style={{
                        left: `${b.left}%`,
                        width: `${b.size}%`,
                        animationDuration: `${b.duration}s`,
                        animationDelay: `${b.delay}s`,
                      }}
                    />
                  ))}
                </div>
              )}

              {selectedSticker && selectedSticker !== "bubbles" && stickerLayouts[selectedSticker] && (
                <div className="sticker-live-overlay">
                  {stickerLayouts[selectedSticker].map((s, i) => (
                    <img
                      key={i}
                      src={s.src}
                      alt=""
                      className="sticker-live-overlay-img"
                      style={{
                        left: `${s.x * 100}%`,
                        top: `${s.y * 100}%`,
                        width: `${s.size * 100}%`,
                        transform: `rotate(${s.rotation || 0}deg)`,
                      }}
                    />
                  ))}
                </div>
              )}

              {countdown && <div className="countdown-overlay">{countdown}</div>}
              {flash && <div className="flash" />}
            </div>

            {/* Sticker picker — only Bubbles (plus None) is offered here.
                The full set (Heart/Star/Nailong/Bubbles) is still available
                afterward on the result screen. */}
            <div className="camera-sticker-menu">
              {stickerOptions
                .filter(({ key }) => key === "bubbles")
                .map(({ key, label, thumb }) => (
                  <div
                    key={label}
                    title={label}
                    onClick={() => setSelectedSticker(selectedSticker === key ? null : key)}
                    className={selectedSticker === key ? "camera-sticker-btn active" : "camera-sticker-btn"}
                    style={
                      thumb
                        ? { backgroundImage: `url('${thumb}')`, backgroundSize: "cover", backgroundPosition: "center" }
                        : { background: "#fff0f5" }
                    }
                  />
                ))}
            </div>
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
            <div className="canvas-frame">
              <canvas ref={canvasRef} className="canvas" />
            </div>
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
              <div className="border-row">

                {/* Solid colour swatch */}
                <div
                  className="color-circle-btn"
                  title="Solid Color"
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

                {/* All pattern borders, generated from borderPatterns */}
                {Object.entries(borderPatterns).map(([key, { src, label }]) => (
                  <div
                    key={key}
                    title={label}
                    onClick={() => { setBorderType(key); setShowBorderPicker(false); }}
                    style={swatchStyle(borderType === key, {
                      backgroundImage: `url('${src}')`,
                      backgroundSize: "cover",
                      backgroundPosition: "center"
                    })}
                  />
                ))}
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
                {stickerOptions
                  .filter(({ key }) => key !== "bubbles")
                  .map(({ key, label, thumb }) => (
                  <div
                    key={label}
                    title={label}
                    onClick={() => setSelectedSticker(key)}
                    style={swatchStyle(
                      selectedSticker === key,
                      thumb
                        ? { backgroundImage: `url('${thumb}')`, backgroundSize: "cover", backgroundPosition: "center" }
                        : { background: "#fff0f5" }
                    )}
                  />
                ))}
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