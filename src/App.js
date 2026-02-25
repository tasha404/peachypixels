import React, { useRef, useEffect, useState } from "react";
import { HexColorPicker } from "react-colorful";
import "./App.css";

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
    const width = 500;
    const height = 350;

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

  /* DRAW RESULT */
  useEffect(() => {
  if (screen !== "result" || photos.length === 0) return;

  const canvas = canvasRef.current;
  const ctx = canvas.getContext("2d");

  const width = 260;
  const height = 220;
  const padding = 20;
  const textSpace = 100;

  const total =
    layout === "strip3" ? 3 :
    layout === "strip4" ? 4 :
    4;

  // ===== SET CANVAS SIZE =====
  if (layout === "strip4" || layout === "strip3") {
    canvas.width = width + padding * 2;
    canvas.height = total * height + padding * (total + 1) + textSpace;
  }

  if (layout === "grid2x2") {
    canvas.width = width * 2 + padding * 3;
    canvas.height = height * 2 + padding * 3 + textSpace;
  }
if (layout === "grid3x2") {
  canvas.width = width * 2 + padding * 3;
  canvas.height = height * 3 + padding * 4 + textSpace;
}
  const drawAll = async () => {

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

      if (layout === "strip4" || layout === "strip3") {
        ctx.drawImage(
          img,
          padding,
          padding + i * (height + padding),
          width,
          height
        );
      }

      if (layout === "grid2x2") {
        const row = Math.floor(i / 2);
        const col = i % 2;
        ctx.drawImage(
          img,
          padding + col * (width + padding),
          padding + row * (height + padding),
          width,
          height
        );
      }

if (layout === "grid3x2") {
  const row = Math.floor(i / 2);
  const col = i % 2;

  ctx.drawImage(
    img,
    padding + col * (width + padding),
    padding + row * (height + padding),
    width,
    height
  );
}

    }

    // 3️⃣ Draw caption last
    ctx.fillStyle = captionColor;
    ctx.font = `${captionSize}px ${captionFont}`;
    ctx.textAlign = "center";
    ctx.fillText(caption, canvas.width / 2, canvas.height - 50);
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
  captionFont
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
