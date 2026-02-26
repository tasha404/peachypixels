import React, { useRef, useEffect, useState } from "react";
import { HexColorPicker } from "react-colorful";
import "./App.css";

const stickerLayouts = {
  heart: [
    { src: "/stickers/heart.png", x: 0.1, y: 0.3, size: 0.25 }
  ],
  star: [
    { src: "/stickers/star.png", x: 0.05, y: 0.1, size: 0.18 },
    { src: "/stickers/star.png", x: 0.75, y: 0.4, size: 0.18 },
    { src: "/stickers/star.png", x: 0.08, y: 0.75, size: 0.18 }
  ],
  nailong: [
    { src: "/stickers/nailong.png", x: 0.05, y: 0.1, size: 0.18 },
    { src: "/stickers/nailong.png", x: 0.75, y: 0.55, size: 0.20 },
    { src: "/stickers/nailong.png", x: 0.05, y: 0.65, size: 0.18 }
  ]
};


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

  /* CLOSE PICKERS */
  useEffect(() => {
  function handleClickOutside(event) {

    if (
      borderPickerRef.current &&
      !borderPickerRef.current.contains(event.target)
    ) {
      setShowBorderPicker(false);
    }

    if (
      textPickerRef.current &&
      !textPickerRef.current.contains(event.target)
    ) {
      setShowTextPicker(false);
    }

  }

  document.addEventListener("mousedown", handleClickOutside);
  return () =>
    document.removeEventListener("mousedown", handleClickOutside);

}, []);

  /* CAMERA */
  useEffect(() => {
    if (screen === "camera") startCamera();
  }, [screen]);

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoRef.current.srcObject = stream;
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
  if (isCapturing) return;   // prevent double click
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

  const getCanvasFilter = () => {
    switch (filter) {
      case "bw": return "grayscale(100%)";
      case "vintage": return "sepia(60%) contrast(110%)";
      case "bright": return "brightness(130%)";
      default: return "none";
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
const width = video.videoWidth;
const height = video.videoHeight;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;

    setFlash(true);
    setTimeout(() => setFlash(false), 200);

    ctx.filter = getCanvasFilter();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0, width, height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = "none";

    return canvas.toDataURL("image/png");
  };

  const download = () => {
    const link = document.createElement("a");
    link.download = "photobooth.png";
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

//sticker
const drawSticker = async (ctx, canvas) => {

  if (!selectedSticker) return;

  const layout = stickerLayouts[selectedSticker];
  if (!layout) return;

  for (let sticker of layout) {

    const img = new Image();
    img.src = sticker.src;

    await new Promise(resolve => {
      img.onload = resolve;
    });

    const size = canvas.width * sticker.size;
    const x = canvas.width * sticker.x;
    const y = canvas.height * sticker.y;

    ctx.drawImage(img, x, y, size, size);
  }
};

 /* DRAW RESULT */
useEffect(() => {
  if (screen !== "result" || photos.length === 0) return;

  const canvas = canvasRef.current;
  const ctx = canvas.getContext("2d");

  const width = 260;
  const padding = 20;
  const textSpace = 100;

  const drawAll = async () => {

    // ===== DETERMINE GRID STRUCTURE =====
    const columns =
      layout === "grid2x2" ? 2 :
      layout === "grid3x2" ? 2 :
      1;

    const rows =
      layout === "grid2x2" ? 2 :
      layout === "grid3x2" ? 3 :
      photos.length;

    // ===== SET CANVAS WIDTH =====
    canvas.width =
      columns === 1
        ? width + padding * 2
        : width * columns + padding * (columns + 1);

    // ===== GET REAL IMAGE RATIO =====
    const firstImg = new Image();
    firstImg.src = photos[0];

    await new Promise(resolve => {
      firstImg.onload = resolve;
    });

    const ratio = firstImg.width / firstImg.height;
    const drawHeight = width / ratio;

    // ===== SET CANVAS HEIGHT =====
    canvas.height =
      rows * drawHeight +
      padding * (rows + 1) +
      textSpace;

    // ===== NOW YOU CAN CALL YOUR EXISTING DRAW CODE =====
    await drawAllContent(drawHeight);
  };

  const drawAllContent = async (drawHeight) => {

    // 1️⃣ Draw border first
    if (borderType === "solid") {
      ctx.fillStyle = borderColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (borderType === "redPlaid") {
  const bg = new Image();
  bg.src = "/redplaid.png";

  await new Promise(resolve => {
    bg.onload = resolve;
  });

  const pattern = ctx.createPattern(bg, "repeat");
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

if (borderType === "bluePlaid") {
  const bg = new Image();
  bg.src = "/blueplaid.png";

  await new Promise(resolve => {
    bg.onload = resolve;
  });

  const pattern = ctx.createPattern(bg, "repeat");
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// 2️⃣ Draw photos

for (let i = 0; i < photos.length; i++) {
  const img = new Image();
  img.src = photos[i];

  await new Promise(resolve => {
    img.onload = resolve;
  });

  const ratio = img.width / img.height;
  const drawWidth = width;
  const drawHeight = drawWidth / ratio;

  // ===== STRIP LAYOUTS =====
  if (layout === "strip4" || layout === "strip3") {
    ctx.drawImage(
      img,
      padding,
      padding + i * (drawHeight + padding),
      drawWidth,
      drawHeight
    );
  }

  // ===== 2x2 GRID =====
  if (layout === "grid2x2") {
    const row = Math.floor(i / 2);
    const col = i % 2;

    ctx.drawImage(
      img,
      padding + col * (drawWidth + padding),
      padding + row * (drawHeight + padding),
      drawWidth,
      drawHeight
    );
  }

  // ===== 3x2 GRID =====
  if (layout === "grid3x2") {
    const row = Math.floor(i / 2);
    const col = i % 2;

    ctx.drawImage(
      img,
      padding + col * (drawWidth + padding),
      padding + row * (drawHeight + padding),
      drawWidth,
      drawHeight
    );
  }
}

    // 3️⃣ Draw caption
ctx.fillStyle = captionColor;
ctx.font = `${captionSize}px ${captionFont}`;
ctx.textAlign = "center";
ctx.fillText(caption, canvas.width / 2, canvas.height - 50);

await drawSticker(ctx, canvas);

  };

  drawAll();

}, [
  screen,
  photos,
  layout,
  borderColor,
  borderType,
  caption,
  captionColor,
  captionSize,
  captionFont,
  selectedSticker   // ADD THIS
]);
  return (
    <div className="container">
      <h1> Peachy Pixels</h1>

      {screen !== "home" && (
        <div className="home-icon" onClick={goHome}>🏠</div>
      )}

      {screen === "home" && (
        <div className="layout-group">
          <button onClick={() => { setLayout("strip4"); setScreen("camera"); }}>4 Strip</button>
          <button onClick={() => { setLayout("strip3"); setScreen("camera"); }}>3 Strip</button>
          <button onClick={() => { setLayout("grid2x2"); setScreen("camera"); }}>2x2 Grid</button>
          <button onClick={() => { setLayout("grid3x2"); setScreen("camera"); }}>3x2 Grid</button>
        </div>
      )}

      {screen === "camera" && (
        <>
          <div className="camera-wrapper">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="video mirror"
              style={{ filter: getCanvasFilter() }}
            />
            {countdown && <div className="countdown-overlay">{countdown}</div>}
            {flash && <div className="flash"></div>}
          </div>

          <div className="filter-group">
  <button disabled={isCapturing} onClick={() => setFilter("none")}>Normal</button>
  <button disabled={isCapturing} onClick={() => setFilter("bw")}>B&W</button>
  <button disabled={isCapturing} onClick={() => setFilter("vintage")}>Vintage</button>
  <button disabled={isCapturing} onClick={() => setFilter("bright")}>Bright</button>
</div>

          <div className="start-wrapper">
  <button disabled={isCapturing} onClick={startCapture}>
    {isCapturing ? "Capturing..." : "Start"}
  </button>
</div>
        </>
      )}

      {screen === "result" && (
        <div className="result-layout">

          {/* LEFT */}
          <div className="preview-side">
            <canvas ref={canvasRef} className="canvas" />
            <div className="result-buttons">
              <button onClick={download}>Download</button>
              <button onClick={retake}>Retake</button>
            </div>
          </div>

          {/* RIGHT */}
          <div className="editor-side" ref={pickerRef}>
            <h3 className="editor-title">Edit</h3>

            {/* BORDER */}
            <div className="editor-card">
  <p>Border</p>

  <div
    style={{
      marginTop: "15px",
      display: "flex",
      gap: "12px",
      alignItems: "center",
      overflowX: "auto",
      whiteSpace: "nowrap"
    }}
  >
    {/* Solid */}
    <div
      className="color-circle-btn"
      style={{
        background: borderColor,
        border:
          borderType === "solid"
            ? "3px solid #ff4da6"
            : "3px solid white"
      }}
      onClick={() => {
        setBorderType("solid");
        setShowBorderPicker(!showBorderPicker);
        setShowTextPicker(false);
      }}
    />

    {/* Red Plaid */}
    <div
      onClick={() => {
        setBorderType("redPlaid");
        setShowBorderPicker(false);
      }}
      style={{
        width: "48px",
        height: "48px",
        borderRadius: "50%",
        backgroundImage: "url('/redplaid.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        cursor: "pointer",
        border:
          borderType === "redPlaid"
            ? "3px solid #ff4da6"
            : "3px solid white",
        boxShadow: "0 5px 15px rgba(0,0,0,0.15)"
      }}
    />

    {/* Blue Plaid */}
    <div
      onClick={() => {
        setBorderType("bluePlaid");
        setShowBorderPicker(false);
      }}
      style={{
        width: "48px",
        height: "48px",
        borderRadius: "50%",
        backgroundImage: "url('/blueplaid.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        cursor: "pointer",
        border:
          borderType === "bluePlaid"
            ? "3px solid #ff4da6"
            : "3px solid white",
        boxShadow: "0 5px 15px rgba(0,0,0,0.15)"
      }}
    />
  </div>

  {showBorderPicker && (
    <div className="picker-popup" ref={borderPickerRef}>
      <HexColorPicker
        color={borderColor}
        onChange={setBorderColor}
      />
    </div>
  )}
</div>
{/* STICKERS */}
<div className="editor-card">
  <p>Stickers</p>

  <div
    style={{
      marginTop: "15px",
      display: "flex",
      gap: "12px",
      overflowX: "auto"
    }}
  >
    <div
      onClick={() => setSelectedSticker(null)}
      style={{
        width: "48px",
        height: "48px",
        borderRadius: "50%",
        background: "#fff",
        border: selectedSticker === null
          ? "3px solid #ff4da6"
          : "3px solid white",
        cursor: "pointer"
      }}
    />

    <div
      onClick={() => setSelectedSticker("heart")}
      style={{
        width: "48px",
        height: "48px",
        borderRadius: "50%",
        backgroundImage: "url('/stickers/heart.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        border: selectedSticker === "/stickers/heart.png"
          ? "3px solid #ff4da6"
          : "3px solid white",
        cursor: "pointer"
      }}
    />

    <div
      onClick={() => setSelectedSticker("star")}
      style={{
        width: "48px",
        height: "48px",
        borderRadius: "50%",
        backgroundImage: "url('/stickers/star.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        border: selectedSticker === "/stickers/star.png"
          ? "3px solid #ff4da6"
          : "3px solid white",
        cursor: "pointer"
      }}
    />
    <div
      onClick={() => setSelectedSticker("nailong")}
      style={{
        width: "48px",
        height: "48px",
        borderRadius: "50%",
        backgroundImage: "url('/stickers/nailong.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        border: selectedSticker === "/stickers/nailong.png"
          ? "3px solid #ff4da6"
          : "3px solid white",
        cursor: "pointer"
      }}
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
                placeholder="Type here"
              />
            </div>

            {/* TEXT SETTINGS */}
            <div className="editor-card">
              <p>Text Settings</p>



              <div className="text-settings-row">

  {/* Colour */}
  <div className="text-setting-item">
    <div
      className="color-circle-btn"
      style={{ background: captionColor }}
      onClick={() => {
        setShowTextPicker(!showTextPicker);
        setShowBorderPicker(false);
      }}
    />
    {  showTextPicker && (
      <div className="picker-popup" ref={textPickerRef}>

        <HexColorPicker
          color={captionColor}
          onChange={setCaptionColor}
        />
      </div>
    )}
  </div>

  {/* Font Dropdown */}
  <div className="text-setting-item">
    <select
      value={captionFont}
      onChange={(e) => setCaptionFont(e.target.value)}
      className="font-dropdown"
    >
      <option value="Quicksand">Quicksand</option>
      <option value="Pacifico">Pacifico</option>
      <option value="Playfair Display">Playfair Display</option>
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
      onChange={(e) => setCaptionSize(e.target.value)}
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
