import React, { useEffect, useState, useMemo, useCallback } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import "./App.css"; // reuse fonts, CSS variables, and the pink page background

// ─────────────────────────────────────────────────────────────────────────
// KEEP IN SYNC WITH App.js. These two constants are copied verbatim so the
// viewer can reconstruct the exact strip the user decorated. If you ever
// change sticker placements or add a border in App.js, mirror it here.
// (Longer term you'd move these into a shared module imported by both.)
// ─────────────────────────────────────────────────────────────────────────
const stickerLayouts = {
  heart: [
    { src: "/stickers/heart.png", x: -0.08, y: -0.06, size: 0.22, rotation: -18, seed: 11 },
    { src: "/stickers/heart.png", x:  0.82, y:  0.78, size: 0.19, rotation:  16, seed: 15 },
    { src: "/stickers/heart.png", x:  0.88, y:  0.38, size: 0.14, rotation:   8, seed: 12 },
    { src: "/stickers/heart.png", x: -0.04, y:  0.58, size: 0.13, rotation: -12, seed: 17 },
    { src: "/stickers/heart.png", x:  0.72, y: -0.04, size: 0.10, rotation:  22, seed: 13 },
    { src: "/stickers/heart.png", x:  0.10, y:  0.86, size: 0.11, rotation: -14, seed: 16 },
    { src: "/stickers/heart.png", x:  0.36, y:  0.06, size: 0.07, rotation:   4, seed: 18 },
  ],
  star: [
    { src: "/stickers/star.png", x: -0.06, y: -0.06, size: 0.22, rotation: -12, seed: 21 },
    { src: "/stickers/star.png", x:  0.84, y:  0.80, size: 0.20, rotation:  18, seed: 22 },
    { src: "/stickers/star.png", x:  0.82, y:  0.06, size: 0.15, rotation:  25, seed: 23 },
    { src: "/stickers/star.png", x:  0.06, y:  0.82, size: 0.14, rotation: -22, seed: 24 },
    { src: "/stickers/star.png", x:  0.22, y:  0.34, size: 0.09, rotation:  15, seed: 25 },
    { src: "/stickers/star.png", x:  0.72, y:  0.46, size: 0.10, rotation:  -8, seed: 26 },
    { src: "/stickers/star.png", x:  0.48, y: -0.04, size: 0.08, rotation:   5, seed: 27 },
    { src: "/stickers/star.png", x:  0.44, y:  0.90, size: 0.07, rotation: -18, seed: 28 },
  ],
  nailong: [
    { src: "/stickers/nailong.png", x:  0.84, y:  0.18, size: 0.17, rotation:  14, seed: 32 },
    { src: "/stickers/nailong.png", x:  0.86, y:  0.62, size: 0.15, rotation:  -6, seed: 33 },
    { src: "/stickers/nailong.png", x: -0.06, y:  0.72, size: 0.16, rotation: -14, seed: 35 },
    { src: "/stickers/nailong.png", x: -0.08, y:  0.32, size: 0.17, rotation:   8, seed: 36 },
    { src: "/stickers/nailong.png", x: -0.05, y: -0.04, size: 0.14, rotation:  18, seed: 37 },
  ],
};

const borderPatterns = {
  redPlaid:      { src: "/redplaid.png",      mode: "repeat", tileWidth: 200 },
  bluePlaid:     { src: "/blueplaid.png",     mode: "repeat", tileWidth: 200 },
  pinkDots:      { src: "/pinkdots.jpg",      mode: "repeat", tileWidth: 140 },
  pinkPiano:     { src: "/pinkpiano.jpg",     mode: "cover" },
  pinkStar:      { src: "/pinkstar.jpg",      mode: "repeat", tileWidth: 180 },
  plaidMix:      { src: "/plaidmix.jpg",      mode: "repeat", tileWidth: 240 },
  plaidPinkSide: { src: "/plaidpinkside.jpg", mode: "cover" },
  sky:           { src: "/sky.jpg",           mode: "cover" },
  spiralGreen:   { src: "/spiralgreen.jpg",   mode: "cover" },
  starWhimsy:    { src: "/starwhimsy.jpg",    mode: "repeat", tileWidth: 200 },
  tilePink:      { src: "/tilepink.jpg",      mode: "repeat", tileWidth: 160 },
  windows:       { src: "/windows.jpg",       mode: "cover" },
  newspaper:     { src: "/newspaper.jpg",     mode: "cover" },
};

// Same stable jitter as App.js, so sticker positions match the download.
function seededRand(seed, salt = 0) {
  const x = Math.sin(seed * 9301 + salt * 49297 + 233) * 93458;
  return (x - Math.floor(x)) * 2 - 1;
}

// How many rows/cols/shots each layout has - mirrors getPhotoCount + the
// result-canvas grid logic in App.js.
function gridFor(layout, clipCount) {
  if (layout === "grid2x2") return { cols: 2, rows: 2 };
  if (layout === "grid3x2") return { cols: 2, rows: 3 };
  if (layout === "single")  return { cols: 1, rows: 1 };
  // strip3 / strip4 (and any fallback): 1 column, one row per shot
  return { cols: 1, rows: clipCount || (layout === "strip3" ? 3 : 4) };
}

// The App.js canvas uses these ratios (padding 20, caption band 100, photo
// 4:3) against a 450px photo width. We reproduce them at whatever width the
// screen gives us so the viewer strip matches the downloaded PNG.
const REF_W = 450;
const PAD_RATIO = 20 / REF_W;
const CAPTION_RATIO = 100 / REF_W;

function computeLayout(data, viewportW) {
  const clipCount = data.clipUrls ? data.clipUrls.length : 0;
  const { cols, rows } = gridFor(data.layout, clipCount);

  // Available width for the whole strip (leave a little breathing room).
  const avail = Math.min(viewportW * 0.92, cols === 1 ? 380 : 560);

  // Solve for photo width W from: avail = cols*W + (cols+1)*padding,
  // where padding = W * PAD_RATIO.
  const W = avail / (cols + (cols + 1) * PAD_RATIO);
  const padding = W * PAD_RATIO;
  const photoH = W * 0.75;         // 4:3
  const captionH = W * CAPTION_RATIO;

  const stripW = cols * W + (cols + 1) * padding;
  const stripH = rows * photoH + (rows + 1) * padding + captionH;

  // Slot positions, in the same order clips were recorded.
  const slots = [];
  const total = cols * rows;
  for (let i = 0; i < total; i++) {
    let x, y;
    if (cols === 1) {
      x = padding;
      y = padding + i * (photoH + padding);
    } else {
      const row = Math.floor(i / 2);
      const col = i % 2;
      x = padding + col * (W + padding);
      y = padding + row * (photoH + padding);
    }
    slots.push({ x, y, w: W, h: photoH });
  }

  return { W, padding, photoH, captionH, stripW, stripH, slots, cols, rows };
}

function Centered({ children }) {
  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      padding: 24,
      textAlign: "center",
      fontFamily: "'Quicksand', sans-serif",
      color: "var(--text-mid)",
    }}>
      {children}
    </div>
  );
}

export default function Viewer({ id }) {
  const [status, setStatus] = useState("loading"); // loading | ready | notfound | error
  const [data, setData] = useState(null);
  const [viewportW, setViewportW] = useState(
    typeof window !== "undefined" ? window.innerWidth : 400
  );

  // Fetch the strip record.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "strips", id));
        if (cancelled) return;
        if (!snap.exists()) { setStatus("notfound"); return; }
        setData(snap.data());
        setStatus("ready");
      } catch (e) {
        console.error("Failed to load strip:", e);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Keep the strip sized to the screen.
  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const L = useMemo(
    () => (data ? computeLayout(data, viewportW) : null),
    [data, viewportW]
  );

  // Background style for the strip paper - solid colour or one of the patterns.
  const stripBackground = useCallback(() => {
    if (!data) return {};
    if (data.borderType === "solid" || !borderPatterns[data.borderType]) {
      return { background: data.borderColor || "#ffe4ef" };
    }
    const cfg = borderPatterns[data.borderType];
    if (cfg.mode === "cover") {
      return {
        backgroundImage: `url('${cfg.src}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }
    // repeat - scale the tile the same way App.js does (relative to photo width)
    const tile = (cfg.tileWidth || 180) * (L.W / REF_W);
    return {
      backgroundImage: `url('${cfg.src}')`,
      backgroundSize: `${tile}px auto`,
      backgroundRepeat: "repeat",
    };
  }, [data, L]);

  if (status === "loading") return <Centered><p>Loading your strip…</p></Centered>;
  if (status === "notfound") return (
    <Centered>
      <p>This strip couldn’t be found — the link may have expired.</p>
      <a href="/" style={{ color: "var(--rose-500)", fontWeight: 700 }}>Make your own →</a>
    </Centered>
  );
  if (status === "error") return (
    <Centered>
      <p>Something went wrong loading this strip.</p>
      <a href="/" style={{ color: "var(--rose-500)", fontWeight: 700 }}>Make your own →</a>
    </Centered>
  );

  const clipUrls = data.clipUrls || [];
  // Result-screen stickers only (heart/star/nailong). Bubbles + Guinzly were
  // camera-baked into the stills and aren't in the raw clips, so they don't
  // reappear here.
  const overlaySticker =
    data.sticker && data.sticker !== "bubbles" && stickerLayouts[data.sticker]
      ? stickerLayouts[data.sticker]
      : null;

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 18,
      padding: "28px 16px 40px",
    }}>
      <h1 style={{ marginBottom: 4 }}>Peachy Pixels</h1>
      <p style={{
        fontFamily: "'Quicksand', sans-serif",
        fontSize: 12,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: "var(--rose-500)",
        fontWeight: 700,
        margin: 0,
      }}>
        Behind the scenes
      </p>

      {/* THE STRIP - absolutely-positioned slots reproduce the canvas layout */}
      <div
        style={{
          position: "relative",
          width: L.stripW,
          height: L.stripH,
          borderRadius: 20,
          boxShadow: "0 20px 60px rgba(200,60,100,0.18)",
          overflow: "hidden",
          ...stripBackground(),
        }}
      >
        {/* Video slots */}
        {L.slots.map((slot, i) => {
          const url = clipUrls[i];
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: slot.x,
                top: slot.y,
                width: slot.w,
                height: slot.h,
                borderRadius: 4,
                overflow: "hidden",
                background: "#00000010",
              }}
            >
              {url ? (
                <video
                  src={url}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    // Mirror to match the selfie preview (clips record un-mirrored)
                    transform: "scaleX(-1)",
                    display: "block",
                  }}
                />
              ) : null}
            </div>
          );
        })}

        {/* Sticker overlays (heart / star / nailong), matching App.js placement */}
        {overlaySticker &&
          L.slots.map((slot, si) =>
            overlaySticker.map((s, i) => {
              const jitterX = seededRand(s.seed, i)     * slot.w * 0.03;
              const jitterY = seededRand(s.seed, i + 1) * slot.h * 0.03;
              const wobble  = seededRand(s.seed, i + 2) * 5;
              const w = slot.w * s.size;
              return (
                <img
                  key={`${si}-${i}`}
                  src={s.src}
                  alt=""
                  style={{
                    position: "absolute",
                    left: slot.x + s.x * slot.w + jitterX,
                    top: slot.y + s.y * slot.h + jitterY,
                    width: w,
                    height: "auto",
                    transform: `rotate(${(s.rotation || 0) + wobble}deg)`,
                    transformOrigin: "center",
                    pointerEvents: "none",
                    filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.15))",
                  }}
                />
              );
            })
          )}

        {/* Caption */}
        {data.caption ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: L.captionH * 0.5,
              transform: "translateY(50%)",
              textAlign: "center",
              color: data.captionColor || "#000",
              fontFamily: `"${data.captionFont || "Quicksand"}", sans-serif`,
              fontSize: (data.captionSize || 30) * (L.W / REF_W),
              lineHeight: 1,
              padding: "0 8px",
            }}
          >
            {data.caption}
          </div>
        ) : null}
      </div>

      <a
        href="/"
        style={{
          fontFamily: "'Quicksand', sans-serif",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--rose-500)",
          textDecoration: "none",
          marginTop: 6,
        }}
      >
        Make your own →
      </a>
    </div>
  );
}