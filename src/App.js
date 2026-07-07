import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { HexColorPicker } from "react-colorful";
import QRCode from "qrcode";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { storage, db } from "./firebase";
import "./App.css";
// Organic sticker placement.
//
// Positions (x, y) are fractions of photo width/height, anchored to the sticker's
// top-left corner. Values outside 0-1 intentionally bleed off the edge - that's
// the look we want. size is a fraction of photo width.
//
// Each entry has a small seeded jitter applied at draw time (see seededRand) so
// nothing looks grid-snapped, but the arrangement stays stable across re-renders.

// Each layout follows a hero -> anchor -> accent hierarchy rather than
// uniform corner repetition - one large "lead" sticker, one mid-size
// sticker on the opposite diagonal, and 2-3 small trailing accents.
// This size variation is what reads as hand-placed instead of
// copy-pasted into all four corners at once. All values are fractions
// of the photo slot, so composition scales identically on any screen.
const stickerLayouts = {
  // HEART - romantic edge scatter. Hearts hug the borders like
  // they're drifting inward from all sides, none dead-center. Softer
  // rotations, generally smaller so the arrangement feels lacy.
  heart: [
    // hero, top-left corner bleed
    { src: "/stickers/heart.png", x: -0.08, y: -0.06, size: 0.22, rotation: -18, seed: 11 },
    // anchor, bottom-right corner bleed
    { src: "/stickers/heart.png", x:  0.82, y:  0.78, size: 0.19, rotation:  16, seed: 15 },
    // right edge midway - off frame
    { src: "/stickers/heart.png", x:  0.88, y:  0.38, size: 0.14, rotation:   8, seed: 12 },
    // left edge lower - off frame
    { src: "/stickers/heart.png", x: -0.04, y:  0.58, size: 0.13, rotation: -12, seed: 17 },
    // top-right small
    { src: "/stickers/heart.png", x:  0.72, y: -0.04, size: 0.10, rotation:  22, seed: 13 },
    // bottom-left small
    { src: "/stickers/heart.png", x:  0.10, y:  0.86, size: 0.11, rotation: -14, seed: 16 },
    // tiny accent floating near the middle-top
    { src: "/stickers/heart.png", x:  0.36, y:  0.06, size: 0.07, rotation:   4, seed: 18 },
  ],

  // STAR - sparkle scatter. Twinkles scattered mostly around edges
  // with a couple sitting inside, various sizes and rotations,
  // deliberately uneven counts on each side so it feels random rather
  // than symmetrical. Like glitter caught mid-air.
  star: [
    // big anchor sparkles at opposite corners
    { src: "/stickers/star.png", x: -0.06, y: -0.06, size: 0.22, rotation: -12, seed: 21 },
    { src: "/stickers/star.png", x:  0.84, y:  0.80, size: 0.20, rotation:  18, seed: 22 },
    // medium sparkles, non-symmetrical placement
    { src: "/stickers/star.png", x:  0.82, y:  0.06, size: 0.15, rotation:  25, seed: 23 },
    { src: "/stickers/star.png", x:  0.06, y:  0.82, size: 0.14, rotation: -22, seed: 24 },
    // inside twinkles - near face level but off to the sides
    { src: "/stickers/star.png", x:  0.22, y:  0.34, size: 0.09, rotation:  15, seed: 25 },
    { src: "/stickers/star.png", x:  0.72, y:  0.46, size: 0.10, rotation:  -8, seed: 26 },
    // tiny top-mid twinkle
    { src: "/stickers/star.png", x:  0.48, y: -0.04, size: 0.08, rotation:   5, seed: 27 },
    // tiny bottom-mid twinkle
    { src: "/stickers/star.png", x:  0.44, y:  0.90, size: 0.07, rotation: -18, seed: 28 },
  ],

  // NAILONG - friends around the frame. Spread evenly around the
  // perimeter (top, right, bottom, left, corners) like a group of
  // friends peeking into the shot from all sides. Center stays clear
  // for your face. Sizes stay moderate - no giant hero.
  nailong: [
    // top-center
  // top-center  { src: "/stickers/nailong.png", x:  0.38, y: -0.08, size: 0.18, rotation:  -8, seed: 31 },
    // right side, upper
    { src: "/stickers/nailong.png", x:  0.84, y:  0.18, size: 0.17, rotation:  14, seed: 32 },
    // right side, lower
    { src: "/stickers/nailong.png", x:  0.86, y:  0.62, size: 0.15, rotation:  -6, seed: 33 },
    // bottom-center
  // bottom-center  { src: "/stickers/nailong.png", x:  0.40, y:  0.84, size: 0.18, rotation:  10, seed: 34 },
    // bottom-left, bleeding off
    { src: "/stickers/nailong.png", x: -0.06, y:  0.72, size: 0.16, rotation:  -14, seed: 35 },
    // left side, mid
    { src: "/stickers/nailong.png", x: -0.08, y:  0.32, size: 0.17, rotation:   8, seed: 36 },
    // top-left corner
    { src: "/stickers/nailong.png", x: -0.05, y: -0.04, size: 0.14, rotation:  18, seed: 37 },
  ],

  bubbles: [
    // HERO - bubbletrio (already a clustered group), bottom-left, bleeding off the edge
    { src: "/stickers/bubbletrio.png", x: -0.08, y:  0.58, size: 0.27, rotation:  -4, seed: 51 },
    // ANCHOR - bubblehollow, top-right, opposite diagonal
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

// FIXED-POSITION CAMERA STICKER SETS - each key maps to a list of parts
// that all render together simultaneously. Currently just Guinzly: one
// animated cycling sprite plus static poses, each at its own anchor
// point so they don't overlap. Selecting "guinzly" draws every part
// listed here at once (both live preview AND baked into the photo).
//
// Each part has:
//   frames[]   - cycled if length > 1 (animation), single static if 1
//   widthFrac  - width as a fraction of the frame width
//   left/right - horizontal anchor (use ONE, not both)
//   VERTICAL ANCHOR - use ONE of:
//     centerY  - sticker's center at this fraction of frame height
//     bottom   - sticker's BOTTOM edge inset from the frame bottom
//                (0 = feet touch floor, negative = bleeds off bottom).
//                Use this for tall stickers so they can grow upward
//                without ever clipping the feet.
const GUINZLY_FRAME_MS = 450; // how long each animation frame is shown

const fixedStickerSets = {
  guinzly: {
    label: "Guinzly",
    thumb: "/stickers/guinzly.png",
    parts: [
      // STAR - anchored by his FEET (bottom: 0) so we can grow him as
      // big as we want without ever losing his feet off the bottom.
      {
        frames: [
          "/stickers/guinzly.png",
          "/stickers/guinzlyhandsside.png",
          "/stickers/guinzlyhandsup.png",
        ],
        widthFrac: 0.48,
        right: 0.02,
        centerY: 0.55,
      },
      // Sitting in the bottom-left corner - the one supporting character
      // that fits without competing with the star for space.
      {
        frames: ["/stickers/guinzlysit.png"],
        widthFrac: 0.22,
        left: 0.04,
        bottom: 0.02,
      },
    ],
  },
};

// Single source of truth for every selectable sticker set - both the
// camera-screen side menu and the result-screen sticker row read from
// this, so they can't drift out of sync. Thumbnail is just the first
// (hero) image from that sticker's layout.
const stickerOptions = [
  { key: null,      label: "None" },
  { key: "heart",   label: "Heart",   thumb: stickerLayouts.heart[0].src },
  { key: "star",    label: "Star",    thumb: stickerLayouts.star[0].src },
  { key: "nailong", label: "Nailong", thumb: stickerLayouts.nailong[0].src },
  { key: "bubbles", label: "Bubbles", thumb: stickerLayouts.bubbles[0].src },
  // Fixed-position camera-only sticker sets. Each option here renders
  // multiple parts at once (see fixedStickerSets), not a single sticker.
  ...Object.entries(fixedStickerSets).map(([key, cfg]) => ({
    key,
    label: cfg.label,
    thumb: cfg.thumb,
  })),
];

// Camera-screen-exclusive keys - bubbles (floats) plus every fixed
// sticker set. Everything else (Heart/Star/Nailong) is result-screen only.
const cameraOnlyStickerKeys = new Set(["bubbles", ...Object.keys(fixedStickerSets)]);

// Live-only "float from bottom to top" animation shown on the result
// screen when Bubbles is selected. left/size are percentages of the
// Bubble source images and the pool of possible visual variety. Actual
// positions/timing/drift are generated fresh each time Bubbles is
// selected - see the useMemo below in App() - so the pattern never
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
      left,                                  // spread across the full 0%-100%
      size: Math.random() * 10 + 6,          // 6%-16% of frame width
      duration: Math.random() * 4 + 3,       // 3s-7s per rise - wide variance so they don't move in lock-step
      delay: Math.random() * 3.5,            // 0s-3.5s stagger
    };
  });
}

// --- BORDER PATTERNS -----------------------------------------------------
// Every non-solid border option lives here as a single source of truth:
// key -> { src, label }. Add a new border by adding one line here - the
// swatch row and the canvas draw logic both read from this automatically.
// Each pattern picks its render style:
//   mode "repeat" - pattern tiles as a small repeating motif (dots,
//                   plaids, tiles). tileWidth is the target width for
//                   each tile in pixels (before EXPORT_SCALE); the
//                   image is pre-scaled to that width so tiles aren't
//                   awkwardly huge or tiny regardless of source size.
//   mode "cover"  - pattern fills the entire frame like a background
//                   photo (single instance, cover-fit). Use for
//                   wallpaper-style images that shouldn't tile.
const borderPatterns = {
  redPlaid:      { src: "/redplaid.png",      label: "Red Plaid",       mode: "repeat", tileWidth: 200 },
  bluePlaid:     { src: "/blueplaid.png",     label: "Blue Plaid",      mode: "repeat", tileWidth: 200 },
  pinkDots:      { src: "/pinkdots.jpg",      label: "Pink Dots",       mode: "repeat", tileWidth: 140 },
  pinkPiano:     { src: "/pinkpiano.jpg",      label: "Pink Piano",      mode: "cover" },
  pinkStar:      { src: "/pinkstar.jpg",      label: "Pink Star",       mode: "repeat", tileWidth: 180 },
  plaidMix:      { src: "/plaidmix.jpg",      label: "Plaid Mix",       mode: "repeat", tileWidth: 240 },
  plaidPinkSide: { src: "/plaidpinkside.jpg", label: "Plaid Pink Side", mode: "cover" },
  sky:           { src: "/sky.jpg",           label: "Sky",             mode: "cover" },
  spiralGreen:   { src: "/spiralgreen.jpg",   label: "Spiral Green",    mode: "cover" },
  starWhimsy:    { src: "/starwhimsy.jpg",    label: "Star Whimsy",     mode: "repeat", tileWidth: 200 },
  tilePink:      { src: "/tilepink.jpg",      label: "Tile Pink",       mode: "repeat", tileWidth: 160 },
  windows:       { src: "/windows.jpg",       label: "Windows",         mode: "cover" },
  newspaper:     { src: "/newspaper.jpg",     label: "Newspaper",       mode: "cover" },
};

// Stable pseudo-random: same seed+salt always returns the same float in [-1, 1].
function seededRand(seed, salt = 0) {
  const x = Math.sin(seed * 9301 + salt * 49297 + 233) * 93458;
  return (x - Math.floor(x)) * 2 - 1; // remap to [-1, 1]
}

// Pick a MediaRecorder mime type this browser actually supports.
// Chrome/Firefox -> webm (vp9/vp8); Safari/iOS -> mp4. Returns "" if none,
// letting MediaRecorder use its own default.
function pickClipMimeType() {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4;codecs=h264",
    "video/mp4",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
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
      case "retro": {
        // Lower saturation
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = r * 0.85 + gray * 0.15;
        g = g * 0.85 + gray * 0.15;
        b = b * 0.85 + gray * 0.15;
        // Tiny sepia
        const sr = r * 0.393 + g * 0.769 + b * 0.189;
        const sg = r * 0.349 + g * 0.686 + b * 0.168;
        const sb = r * 0.272 + g * 0.534 + b * 0.131;
        r = r * 0.92 + sr * 0.08;
        g = g * 0.92 + sg * 0.08;
        b = b * 0.92 + sb * 0.08;
        // Contrast
        r = (r - 128) * 0.88 + 128;
        g = (g - 128) * 0.88 + 128;
        b = (b - 128) * 0.88 + 128;
        // Brightness
        r *= 0.96;
        g *= 0.96;
        b *= 0.96;
        // Tiny warm tint
        r *= 1.02;
        b *= 0.96;
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

  // --- BEHIND-THE-SCENES (video clips + shareable strip record) ------------
  // During each countdown we record a short muted clip of the camera (one per
  // shot). When the user taps "Get behind-the-scenes QR" on the result
  // screen, those clips upload to Storage, a Firestore "strip" record saves
  // the full decorated layout (border/caption/sticker + clip URLs), and the
  // QR encodes a short /s/{docId} link to the (stage-3) viewer page.
  const shotClipsRef = useRef([]);        // [{ blob, mimeType }], one per photo
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  // Caches uploaded clip URLs + the created doc id so re-tapping the button
  // (after tweaking decoration) reuses the same clips + updates the same
  // record instead of re-uploading and creating duplicates.
  const shareRef = useRef({ clipUrls: null, docId: null });

  const [btsUrl, setBtsUrl] = useState(null);         // viewer url -> goes into the QR
  const [btsStatus, setBtsStatus] = useState("idle"); // idle | working | ready | error

  // Fresh random float pattern (position/speed/drift) every time bubbles
  // is turned on - recomputes whenever selectedSticker flips to "bubbles",
  // not on every render, so it stays stable while you're framing the shot.
  const bubbleParticles = useMemo(() => {
    if (selectedSticker !== "bubbles") return [];
    return generateBubbleParticles();
  }, [selectedSticker]);

  // Timestamp the float animation actually started (matches when
  // bubbleParticles was generated) - takePhoto() uses this to work out
  // exactly where each bubble is at the moment a shot is taken.
  const bubbleStartRef = useRef(Date.now());
  useEffect(() => {
    bubbleStartRef.current = Date.now();
  }, [bubbleParticles]);

  // Computes each bubble's live position/opacity right now, using the same
  // math as the CSS @keyframes floatUp (linear bottom -15%->115%, with the
  // matching opacity fade-in/out envelope). Used to bake a frozen snapshot
  // of "whatever was on screen" into the photo at capture time.
  const getBubbleSnapshotNow = useCallback(() => {
    if (selectedSticker !== "bubbles" || bubbleParticles.length === 0) return [];
    const elapsedSinceStart = (Date.now() - bubbleStartRef.current) / 1000;

    return bubbleParticles
      .map((b) => {
        if (elapsedSinceStart < b.delay) return null; // hasn't risen yet

        const cycleTime = (elapsedSinceStart - b.delay) % b.duration;
        const progress = cycleTime / b.duration; // 0 -> 1 over one rise

        const bottomPercent = -15 + progress * 130; // matches keyframe 0%->100%

        let opacity;
        if (progress < 0.10) opacity = (progress / 0.10) * 0.9;
        else if (progress < 0.85) opacity = 0.9 - ((progress - 0.10) / 0.75) * 0.05;
        else opacity = 0.85 * (1 - (progress - 0.85) / 0.15);

        return { src: b.src, left: b.left, size: b.size, bottomPercent, opacity };
      })
      .filter((b) => b && b.opacity > 0.05);
  }, [selectedSticker, bubbleParticles]);

  // GUINZLY - fixed-position 3-frame sprite cycle. Same start-time-based
  // approach as bubbles: a ref timestamps when it was selected, and both
  // the live display and the capture-time bake compute "which frame right
  // now" from elapsed time, so they always agree.
  const guinzlyStartRef = useRef(Date.now());
  useEffect(() => {
    if (selectedSticker === "guinzly") guinzlyStartRef.current = Date.now();
  }, [selectedSticker]);

  const getGuinzlyFrameIndexNow = useCallback(() => {
    const elapsed = Date.now() - guinzlyStartRef.current;
    // Animation frame count comes from the animated part (which is
    // the one part in the set that has multiple frames).
    const animated = fixedStickerSets.guinzly.parts.find(p => p.frames.length > 1);
    if (!animated) return 0;
    return Math.floor(elapsed / GUINZLY_FRAME_MS) % animated.frames.length;
  }, []);

  // Drives the visible <img> on the camera screen - ticks every
  // GUINZLY_FRAME_MS while guinzly is selected, otherwise sits idle.
  const [guinzlyFrameIndex, setGuinzlyFrameIndex] = useState(0);
  useEffect(() => {
    if (selectedSticker !== "guinzly" || screen !== "camera") return;
    const id = setInterval(() => {
      setGuinzlyFrameIndex(getGuinzlyFrameIndexNow());
    }, GUINZLY_FRAME_MS);
    return () => clearInterval(id);
  }, [selectedSticker, screen, getGuinzlyFrameIndexNow]);

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
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: "user" }
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

  // --- CLIP RECORDING (raw camera stream) ----------------------------------
  // Record the raw camera stream per shot - far more reliable than recording
  // from a canvas. The saved clip is unfiltered + un-mirrored; the viewer
  // applies the chosen filter + selfie mirror with CSS on the <video>, which
  // is reliable across browsers (unlike canvas pixel filtering).
  const startShotRecording = useCallback(() => {
    const stream = videoRef.current?.srcObject;
    if (!stream) return;
    try {
      const mimeType = pickClipMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.error("Could not start shot recording:", err);
      mediaRecorderRef.current = null;
    }
  }, []);

  const stopShotRecording = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") { resolve(null); return; }
      recorder.onstop = () => {
        const type = recorder.mimeType || "video/webm";
        const blob = new Blob(recordedChunksRef.current, { type });
        recordedChunksRef.current = [];
        mediaRecorderRef.current = null;
        resolve({ blob, mimeType: type });
      };
      recorder.stop();
    });
  }, []);

  const goHome = () => {
    stopCamera();
    setPhotos([]);
    setLayout(null);
    setBtsUrl(null);
    setBtsStatus("idle");
    shotClipsRef.current = [];
    shareRef.current = { clipUrls: null, docId: null };
    setScreen("home");
  };

  const retake = () => {
    setPhotos([]);
    setBtsUrl(null);
    setBtsStatus("idle");
    shotClipsRef.current = [];
    shareRef.current = { clipUrls: null, docId: null };
    setScreen("camera");
  };

  const getPhotoCount = () => {
    if (layout === "single") return 1;
    if (layout === "strip3") return 3;
    if (layout === "grid3x2") return 6;
    return 4;
  };

  // Upload the per-shot clips (once) + save/update the strip record in
  // Firestore, then point the QR at the viewer url. Called from a button on
  // the result screen so it captures whatever decoration is currently applied.
  const generateShareLink = useCallback(async () => {
    const clips = shotClipsRef.current;
    if (!clips.length) { setBtsStatus("error"); return; }
    setBtsStatus("working");

    try {
      // 1. Upload clips ONCE; reuse the URLs on later taps.
      if (!shareRef.current.clipUrls) {
        const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const urls = [];
        for (let i = 0; i < clips.length; i++) {
          const { blob, mimeType } = clips[i];
          const ext = mimeType.includes("mp4") ? "mp4" : "webm";
          const fileRef = storageRef(storage, `clips/${sessionId}/${i}.${ext}`);
          await uploadBytes(fileRef, blob, { contentType: mimeType });
          urls.push(await getDownloadURL(fileRef));
        }
        shareRef.current.clipUrls = urls;
      }

      // 2. The full decorated-strip payload the viewer page will rebuild from.
      const data = {
        layout,
        borderType,
        borderColor,
        caption,
        captionColor,
        captionSize,
        captionFont,
        sticker: selectedSticker,     // key only; viewer has the same layouts
        filter,                       // applied as CSS on the viewer video
        clipUrls: shareRef.current.clipUrls,
        updatedAt: serverTimestamp(),
      };

      // 3. First tap creates the record; later taps update the same one, so
      //    the QR (and its /s/{id} link) stays stable across edits.
      if (!shareRef.current.docId) {
        const docRef = await addDoc(collection(db, "strips"), {
          ...data,
          createdAt: serverTimestamp(),
        });
        shareRef.current.docId = docRef.id;
        setBtsUrl(`${window.location.origin}/s/${docRef.id}`);
      } else {
        await updateDoc(doc(db, "strips", shareRef.current.docId), data);
      }

      setBtsStatus("ready");
    } catch (e) {
      console.error("Share link failed:", e);
      setBtsStatus("error");
    }
  }, [layout, borderType, borderColor, caption, captionColor, captionSize, captionFont, selectedSticker]);

  const startCapture = async () => {
    if (isCapturing) return;
    setIsCapturing(true);

    // reset behind-the-scenes state for this fresh session
    shotClipsRef.current = [];
    shareRef.current = { clipUrls: null, docId: null };
    setBtsUrl(null);
    setBtsStatus("idle");

    let newPhotos = [];
    const total = getPhotoCount();
    for (let i = 0; i < total; i++) {
      startShotRecording();                     // begin this shot's clip
      await startCountdown();
      newPhotos.push(await takePhoto());
      const clip = await stopShotRecording();   // finish this shot's clip
      if (clip) shotClipsRef.current.push(clip);
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
  // CSS filter works fine on iOS Safari - it's ctx.filter (canvas) that's unreliable.
  const getCanvasFilter = useCallback(() => {
    switch (filter) {
      case "bw":      return "grayscale(100%)";
      case "vintage": return "sepia(60%) contrast(110%)";
      case "bright":  return "brightness(130%)";
      case "retro":   return "saturate(85%) sepia(8%) contrast(88%) brightness(96%)";
      default:        return "none";
    }
  }, [filter]);

  const takePhoto = async () => {
    const video = videoRef.current;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
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

    // Bake whichever bubbles were on screen at this exact instant -
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

    // Fixed-position sticker set (Guinzly) - bake every part at its
    // configured anchor, using whichever frame is currently showing for
    // the animated ones. Aspect ratio is preserved on every part.
    if (fixedStickerSets[selectedSticker]) {
      const { parts } = fixedStickerSets[selectedSticker];
      for (const part of parts) {
        const frameSrc = part.frames.length > 1
          ? part.frames[getGuinzlyFrameIndexNow()]
          : part.frames[0];
        const img = await loadImg(frameSrc);
        if (!img) continue;

        const w = cropWidth * part.widthFrac;
        const h = w * (img.naturalHeight / img.naturalWidth); // preserve aspect ratio
        const x = part.right !== undefined
          ? cropWidth * (1 - part.right) - w
          : cropWidth * part.left;
        // bottom anchor: sticker's bottom edge sits `bottom` fraction up
        // from the frame bottom. centerY anchor: sticker's middle at that
        // fraction. Use whichever the part specifies.
        const y = part.bottom !== undefined
          ? cropHeight * (1 - part.bottom) - h
          : cropHeight * part.centerY - h / 2;
        ctx.drawImage(img, x, y, w, h);
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
  // Sticker x/y are fractions of the slot - values outside 0-1 bleed off the edge
  // intentionally. A tiny seeded jitter (~3% of slot width) is added so nothing
  // looks grid-snapped, but the composition stays stable across re-renders.
  const drawSticker = useCallback(async (ctx, photoSlots) => {
    if (!selectedSticker || !photoSlots?.length) return;

    // Bubbles are already baked into each individual photo at capture
    // time (see takePhoto/getBubbleSnapshotNow) - drawing the generic
    // stickerLayouts.bubbles composition here on top would double them up.
    if (selectedSticker === "bubbles") return;

    const stickerDefs = stickerLayouts[selectedSticker];
    if (!stickerDefs) return;

    for (const slot of photoSlots) {
      for (let i = 0; i < stickerDefs.length; i++) {
        const sticker = stickerDefs[i];
        const img = await loadImg(sticker.src);
        if (!img) continue;

        // `size` sets the sticker's WIDTH as a fraction of the slot;
        // height follows the image's own natural aspect ratio so
        // non-square stickers never get stretched/squished.
        const stickerWidth = slot.w * sticker.size;
        const stickerHeight = stickerWidth * (img.naturalHeight / img.naturalWidth);

        // Base position from layout definition (fractions of slot size)
        const baseX = slot.x + sticker.x * slot.w;
        const baseY = slot.y + sticker.y * slot.h;

        // Tiny seeded jitter - +/-3% of slot width/height so it feels hand-placed
        const jitterX = seededRand(sticker.seed, i)     * slot.w * 0.03;
        const jitterY = seededRand(sticker.seed, i + 1) * slot.h * 0.03;

        const x = baseX + jitterX;
        const y = baseY + jitterY;

        // Rotation: base angle + tiny seeded wobble (+/-5deg)
        const rotWobble = seededRand(sticker.seed, i + 2) * 5;
        const rotation = ((sticker.rotation || 0) + rotWobble) * Math.PI / 180;

        ctx.save();
        ctx.translate(x + stickerWidth / 2, y + stickerHeight / 2);
        ctx.rotate(rotation);
        ctx.drawImage(img, -stickerWidth / 2, -stickerHeight / 2, stickerWidth, stickerHeight);
        ctx.restore();
      }
    }
  }, [selectedSticker, loadImg]);

  /* DRAW RESULT CANVAS */
  useEffect(() => {
    if (screen !== "result" || photos.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    // High-quality image smoothing for the sharpest possible scaled output
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const maxMobileWidth = 500;

const displayWidth = window.innerWidth < 768
  ? Math.min(window.innerWidth * 0.9, maxMobileWidth)
  : 450
    // Export scale - the canvas is drawn this many times larger internally,
    // then displayed at displayWidth via CSS. Result: sharp downloaded PNG
    // (roughly displayWidth * EXPORT_SCALE pixels wide) without the preview
    // looking different visually. 4 gives crisp exports without absurd file
    // sizes; bump higher (5, 6) if you want even more detail at the cost of
    // slower render + bigger file.
    const EXPORT_SCALE = 4;
    const width = displayWidth * EXPORT_SCALE;
    const padding = 20 * EXPORT_SCALE;
    const textSpace = 100 * EXPORT_SCALE;

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
        const cfg = borderPatterns[borderType];
        const bg = await loadImg(cfg.src);
        if (bg) {
          if (cfg.mode === "cover") {
            // Fill the entire strip with the image, no tiling - scaled
            // to cover both dimensions, cropped to fit. Same visual
            // behavior as CSS `background-size: cover`.
            const scale = Math.max(
              canvas.width / bg.naturalWidth,
              canvas.height / bg.naturalHeight
            );
            const drawW = bg.naturalWidth * scale;
            const drawH = bg.naturalHeight * scale;
            const dx = (canvas.width - drawW) / 2;
            const dy = (canvas.height - drawH) / 2;
            ctx.drawImage(bg, dx, dy, drawW, drawH);
          } else {
            // "repeat" - pre-scale the source image to a consistent tile
            // width first (accounting for EXPORT_SCALE so tiles look the
            // same size regardless of export resolution), then tile it.
            // Without this, small source images tile as tiny dots and big
            // ones tile as awkward giant crops.
            const targetTileWidth = (cfg.tileWidth || 180) * EXPORT_SCALE;
            const tileScale = targetTileWidth / bg.naturalWidth;
            const tileW = Math.round(bg.naturalWidth * tileScale);
            const tileH = Math.round(bg.naturalHeight * tileScale);

            const tileCanvas = document.createElement("canvas");
            tileCanvas.width = tileW;
            tileCanvas.height = tileH;
            const tileCtx = tileCanvas.getContext("2d");
            tileCtx.imageSmoothingEnabled = true;
            tileCtx.imageSmoothingQuality = "high";
            tileCtx.drawImage(bg, 0, 0, tileW, tileH);

            const pattern = ctx.createPattern(tileCanvas, "repeat");
            ctx.fillStyle = pattern;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        }
      }

      // 2. Draw photos - collect slot positions as we go
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

        if (layout === "strip4" || layout === "strip3" || layout === "single") {
          // Single = one photo; strips = a vertical stack. Same math,
          // single just has a single row (i is always 0).
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

      // 3. Draw caption - scaled by EXPORT_SCALE so it renders at the
      // right visual size on the high-resolution export canvas.
      // Force-load the font first: canvas silently falls back to the
      // default sans-serif if the @font-face font isn't loaded yet, so
      // we explicitly wait for it before setting ctx.font.
      const canvasFontSize = captionSize * EXPORT_SCALE;
      try {
        if (document.fonts && document.fonts.load) {
          await document.fonts.load(`${canvasFontSize}px "${captionFont}"`);
        }
      } catch (e) { /* if it fails, fall back gracefully */ }
      ctx.fillStyle = captionColor;
      ctx.font = `${canvasFontSize}px "${captionFont}"`;
      ctx.textAlign = "center";
      ctx.fillText(caption, canvas.width / 2, canvas.height - 50 * EXPORT_SCALE);

      // 4. Draw stickers - positioned relative to each photo slot
      await drawSticker(ctx, photoSlots);

      // 5. Behind-the-scenes QR - bottom-right corner. Only drawn once the
      // strip record is saved and we have a viewer url to encode.
      if (btsUrl) {
        try {
          const qrDataUrl = await QRCode.toDataURL(btsUrl, {
            margin: 1,
            width: 512,
            color: { dark: "#3a1a2a", light: "#ffffff" }, // plum on white, on-brand
          });
          const qrImg = await loadImg(qrDataUrl);
          if (qrImg) {
            const qrSize = Math.round(canvas.width * 0.16);
            const inset = padding;
            const qx = canvas.width - qrSize - inset;
            const qy = canvas.height - qrSize - inset;

            // white rounded backing so it scans on any border/pattern
            const pad = qrSize * 0.08;
            const bx = qx - pad, by = qy - pad, bw = qrSize + pad * 2, bh = qrSize + pad * 2;
            const r = pad;
            ctx.save();
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.moveTo(bx + r, by);
            ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
            ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
            ctx.arcTo(bx, by + bh, bx, by, r);
            ctx.arcTo(bx, by, bx + bw, by, r);
            ctx.closePath();
            ctx.fill();
            ctx.drawImage(qrImg, qx, qy, qrSize, qrSize);
            ctx.restore();
          }
        } catch (e) {
          console.error("QR draw failed:", e);
        }
      }
    };

    drawAll();
  }, [
    screen, photos, layout, borderColor, borderType,
    caption, captionColor, captionSize, captionFont,
    selectedSticker, drawSticker, loadImg, btsUrl
  ]);

  // --- helper: swatch style for border & sticker selectors -------------------
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
    <div className={`container${screen === "result" ? " result-view" : ""}`}>
      <h1>Peachy Pixels</h1>

      {screen !== "home" && (
        <div className="home-icon" onClick={goHome}>合</div>
      )}

      {/* -- HOME SCREEN --------------------------------------------- */}
      {screen === "home" && (
        <div className="layout-picker">
          <p className="layout-picker-title">Pick your format</p>
          <div className="layout-picker-grid">
            {[
              { key: "single",  label: "Single",    rows: 1, cols: 1 },
              { key: "strip4",  label: "4 Strip",   rows: 4, cols: 1 },
              { key: "strip3",  label: "3 Strip",   rows: 3, cols: 1 },
              { key: "grid2x2", label: "2x2 Grid",  rows: 2, cols: 2 },
              { key: "grid3x2", label: "3x2 Grid",  rows: 3, cols: 2 },
            ].map(({ key, label, rows, cols }) => (
              <button
                key={key}
                className="layout-card"
                onClick={() => { setLayout(key); setScreen("camera"); }}
                aria-label={label}
              >
                <div className="layout-card-preview" data-cols={cols} data-rows={rows}>
                  <div
                    className="layout-card-preview-inner"
                    style={{
                      gridTemplateColumns: `repeat(${cols}, 1fr)`,
                      gridTemplateRows: `repeat(${rows}, 1fr)`,
                    }}
                  >
                    {Array.from({ length: rows * cols }).map((_, i) => (
                      <div key={i} className="layout-card-slot" />
                    ))}
                  </div>
                  </div>
                <span className="layout-card-label">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* -- CAMERA SCREEN ------------------------------------------- */}
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
                  element - stickers should keep their own colors regardless
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

              {/* Fixed-position sticker set - renders every part in the
                  set at its own anchor point. Animated parts (multiple
                  frames) get their current frame; static parts show a
                  single fixed image. */}
              {fixedStickerSets[selectedSticker] &&
                fixedStickerSets[selectedSticker].parts.map((part, i) => {
                  const src = part.frames.length > 1
                    ? part.frames[guinzlyFrameIndex]
                    : part.frames[0];
                  // Vertical anchor: bottom pins the bottom edge (no
                  // translateY centering); centerY pins the middle
                  // (needs the -50% translate to actually center).
                  const verticalStyle = part.bottom !== undefined
                    ? { bottom: `${part.bottom * 100}%` }
                    : { top: `${part.centerY * 100}%` };
                  return (
                    <img
                      key={i}
                      src={src}
                      alt=""
                      className="fixed-sticker-preview"
                      data-anchor={part.bottom !== undefined ? "bottom" : "center"}
                      style={{
                        ...(part.right !== undefined
                          ? { right: `${part.right * 100}%` }
                          : { left: `${part.left * 100}%` }),
                        ...verticalStyle,
                        width: `${part.widthFrac * 100}%`,
                      }}
                    />
                  );
                })}

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

            {/* Sticker picker - only Bubbles and Guinzly are offered here.
                The full set (Heart/Star/Nailong) is still available
                afterward on the result screen. Locked once a capture
                session is running so the per-frame bake can't be
                switched out mid-shoot. */}
            <div className="camera-sticker-menu">
              {stickerOptions
                .filter(({ key }) => cameraOnlyStickerKeys.has(key))
                .map(({ key, label, thumb }) => (
                  <div
                    key={label}
                    title={label}
                    onClick={() => {
                      if (isCapturing) return; // locked once Start is pressed
                      setSelectedSticker(selectedSticker === key ? null : key);
                    }}
                    className={
                      (selectedSticker === key ? "camera-sticker-btn active" : "camera-sticker-btn") +
                      (isCapturing ? " disabled" : "")
                    }
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
              { id: "retro",   label: "Retro"   },
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
              {isCapturing ? "Capturing..." : "Start"}
            </button>
          </div>
        </>
      )}

      {/* -- RESULT SCREEN ------------------------------------------- */}
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

            {/* Behind-the-scenes: upload clips + save strip record + QR */}
            <button
              onClick={generateShareLink}
              disabled={btsStatus === "working"}
              style={{ marginTop: 10 }}
            >
              {btsStatus === "working"
                ? "Saving..."
                : btsStatus === "ready"
                ? "Update behind-the-scenes"
                : "Get behind-the-scenes QR"}
            </button>

            {btsStatus === "ready" && btsUrl && (
              <p className="bts-status bts-status--ready">
                QR added to your strip &middot;{" "}
                <a href={btsUrl} target="_blank" rel="noreferrer">open link</a>
              </p>
            )}
            {btsStatus === "error" && (
              <p className="bts-status bts-status--error">
                Couldn't save the behind-the-scenes. Check the console.
              </p>
            )}
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
                  .filter(({ key }) => !cameraOnlyStickerKeys.has(key))
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
                placeholder="Type here..."
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
                    <option value="ButterflyDaffodil">Butterfly Daffodil</option>
                    <option value="Bigdey Demo">Bigdey</option>
                    <option value="Bubble Street Fill">Bubble Fill</option>
                    <option value="Bubble Street Outline">Bubble Outline</option>
                    <option value="Hooey DEMO">Hooey</option>
                    <option value="KiwiSoda">Kiwi Soda</option>
                    <option value="Magic Sound">Magic Sound</option>
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