import React, { useRef, useEffect, useState, useCallback } from "react";
import { HexColorPicker } from "react-colorful";
import "./App.css";

const stickerLayouts = {
  heart: [
    { src: "/stickers/heart.png", x: 0.05, y: 0.05, size: 0.15 },
    { src: "/stickers/heart.png", x: 0.15, y: 0.18, size: 0.12 },
    { src: "/stickers/heart.png", x: 0.02, y: 0.25, size: 0.10 },
    { src: "/stickers/heart.png", x: 0.82, y: 0.08, size: 0.14 },
    { src: "/stickers/heart.png", x: 0.72, y: 0.20, size: 0.11 },
    { src: "/stickers/heart.png", x: 0.35, y: 0.35, size: 0.13 },
    { src: "/stickers/heart.png", x: 0.55, y: 0.45, size: 0.16 },
    { src: "/stickers/heart.png", x: 0.25, y: 0.60, size: 0.12 },
    { src: "/stickers/heart.png", x: 0.68, y: 0.65, size: 0.13 },
    { src: "/stickers/heart.png", x: 0.08, y: 0.82, size: 0.14 },
    { src: "/stickers/heart.png", x: 0.45, y: 0.78, size: 0.11 },
    { src: "/stickers/heart.png", x: 0.80, y: 0.85, size: 0.12 },
    { src: "/stickers/heart.png", x: 0.20, y: 0.92, size: 0.09 },
    { src: "/stickers/heart.png", x: 0.92, y: 0.92, size: 0.10 },
    { src: "/stickers/heart.png", x: 0.88, y: 0.02, size: 0.08 },
    { src: "/stickers/heart.png", x: 0.01, y: 0.95, size: 0.09 }
  ],
  
  star: [
    { src: "/stickers/star.png", x: 0.10, y: 0.12, size: 0.15 },
    { src: "/stickers/star.png", x: 0.80, y: 0.15, size: 0.16 },
    { src: "/stickers/star.png", x: 0.20, y: 0.40, size: 0.14 },
    { src: "/stickers/star.png", x: 0.70, y: 0.45, size: 0.15 },
    { src: "/stickers/star.png", x: 0.35, y: 0.70, size: 0.17 },
    { src: "/stickers/star.png", x: 0.60, y: 0.80, size: 0.14 },
    { src: "/stickers/star.png", x: 0.05, y: 0.88, size: 0.13 },
    { src: "/stickers/star.png", x: 0.90, y: 0.92, size: 0.12 },
    { src: "/stickers/star.png", x: 0.45, y: 0.25, size: 0.11 },
    { src: "/stickers/star.png", x: 0.50, y: 0.55, size: 0.13 }
  ],
  
  nailong: [
    { src: "/stickers/nailong.png", x: 0.08, y: 0.08, size: 0.22 },
    { src: "/stickers/nailong.png", x: 0.75, y: 0.12, size: 0.18 },
    { src: "/stickers/nailong.png", x: 0.15, y: 0.45, size: 0.20 },
    { src: "/stickers/nailong.png", x: 0.70, y: 0.50, size: 0.19 },
    { src: "/stickers/nailong.png", x: 0.25, y: 0.78, size: 0.21 },
    { src: "/stickers/nailong.png", x: 0.80, y: 0.82, size: 0.17 },
    { src: "/stickers/nailong.png", x: 0.45, y: 0.30, size: 0.15 },
    { src: "/stickers/nailong.png", x: 0.50, y: 0.65, size: 0.16 },
    { src: "/stickers/nailong.png", x: 0.92, y: 0.92, size: 0.14 }
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

  // Preload stickers for better performance
  useEffect(() => {
    const preloadStickers = async () => {
      const allStickers = [
        ...stickerLayouts.heart,
        ...stickerLayouts.star,
        ...stickerLayouts.nailong
      ];
      
      for (let sticker of allStickers) {
        const img = new Image();
        img.src = sticker.src;
        await new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }
    };
    
    preloadStickers();
  }, []);

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
    try {
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
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

  const getCanvasFilter = useCallback(() => {
    switch (filter) {
      case "bw": return "grayscale(100%)";
      case "vintage": return "sepia(60%) contrast(110%)";
      case "bright": return "brightness(130%)";
      default: return "none";
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

    // First, draw the mirrored image without filter
    ctx.save();
    ctx.translate(cropWidth, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      video,
      sx, sy, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight
    );
    ctx.restore();

    // Then apply filter by creating a temporary canvas and compositing
    if (filter !== "none") {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext("2d");
      
      // Copy the original image to temp canvas
      tempCtx.drawImage(canvas, 0, 0);
      
      // Clear original canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Apply filter and draw back
      ctx.filter = getCanvasFilter();
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.filter = "none"; // Reset filter
    }

    return canvas.toDataURL("image/png");
  };

  const download = () => {
    const link = document.createElement("a");
    link.download = "photobooth.png";
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  // HD sticker drawing function
  const drawSticker = useCallback(async (ctx, canvas) => {
    if (!selectedSticker) return;

    const layout = stickerLayouts[selectedSticker];
    if (!layout) return;

    // Enable high-quality image rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Get device pixel ratio for retina displays
    const dpr = window.devicePixelRatio || 1;
    
    for (let sticker of layout) {
      const img = new Image();
      img.src = sticker.src;
      img.crossOrigin = "anonymous";

      await new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });

      // Calculate size based on canvas dimensions
      const baseSize = Math.min(canvas.width, canvas.height) * sticker.size;
      
      // Use the full resolution of the sticker image
      // Maintain aspect ratio
      const aspectRatio = img.width / img.height;
      
      let drawWidth = baseSize;
      let drawHeight = baseSize / aspectRatio;
      
      // Adjust if too tall
      if (drawHeight > baseSize) {
        drawHeight = baseSize;
        drawWidth = baseSize * aspectRatio;
      }

      // Position the sticker
      const x = canvas.width * sticker.x;
      const y = canvas.height * sticker.y;

      const rotation = (sticker.rotation || 0) * Math.PI / 180;

      // For extremely high DPI screens, we might want to draw larger
      if (dpr >= 3) {
        drawWidth *= 1.2;
        drawHeight *= 1.2;
      } else if (dpr >= 2) {
        drawWidth *= 1.1;
        drawHeight *= 1.1;
      }

      ctx.save();
      ctx.translate(x + drawWidth / 2, y + drawHeight / 2);
      ctx.rotate(rotation);
      ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();
    }
  }, [selectedSticker]);

  /* DRAW RESULT */
  useEffect(() => {
    if (screen !== "result" || photos.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Get device pixel ratio for retina displays
    const dpr = window.devicePixelRatio || 1;
    
    const maxMobileWidth = 380;
    // Even smaller width for desktop - 200px
    const width =
      window.innerWidth < 768
        ? Math.min(window.innerWidth * 0.85, maxMobileWidth)
        : 200;
    
    const padding = 20;
    const textSpace = 100;

    const drawAll = async () => {
      const columns =
        layout === "grid2x2" ? 2 :
        layout === "grid3x2" ? 2 :
        1;

      const rows =
        layout === "grid2x2" ? 2 :
        layout === "grid3x2" ? 3 :
        photos.length;

      // Set canvas dimensions accounting for device pixel ratio
      const displayWidth = columns === 1
        ? width + padding * 2
        : width * columns + padding * (columns + 1);
      
      const displayHeight = await new Promise(async (resolve) => {
        const firstImg = new Image();
        firstImg.src = photos[0];
        firstImg.crossOrigin = "anonymous";

        await new Promise(resolveImg => {
          firstImg.onload = resolveImg;
          firstImg.onerror = resolveImg;
        });

        const ratio = firstImg.width / firstImg.height;
        const drawHeight = width / ratio;
        
        resolve(rows * drawHeight + padding * (rows + 1) + textSpace);
      });

      // Set canvas size for high DPI
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      canvas.style.width = displayWidth + 'px';
      canvas.style.height = displayHeight + 'px';
      
      // Scale context for high DPI
      ctx.scale(dpr, dpr);

      await drawAllContent();
    };

    const drawAllContent = async () => {
      // 1️⃣ Draw border first
      if (borderType === "solid") {
        ctx.fillStyle = borderColor;
        ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      }

      if (borderType === "redPlaid") {
        const bg = new Image();
        bg.src = "/redplaid.png";
        bg.crossOrigin = "anonymous";

        await new Promise(resolve => {
          bg.onload = resolve;
          bg.onerror = resolve;
        });

        const pattern = ctx.createPattern(bg, "repeat");
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      }

      if (borderType === "bluePlaid") {
        const bg = new Image();
        bg.src = "/blueplaid.png";
        bg.crossOrigin = "anonymous";

        await new Promise(resolve => {
          bg.onload = resolve;
          bg.onerror = resolve;
        });

        const pattern = ctx.createPattern(bg, "repeat");
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      }

      // 2️⃣ Draw photos
      for (let i = 0; i < photos.length; i++) {
        const img = new Image();
        img.src = photos[i];
        img.crossOrigin = "anonymous";

        await new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });

        const drawWidth = width;
        const drawHeight = width * 0.75;

        let x = padding;
        let y = padding;

        if (layout === "strip4" || layout === "strip3") {
          x = padding;
          y = padding + i * (drawHeight + padding);
        }

        if (layout === "grid2x2") {
          const row = Math.floor(i / 2);
          const col = i % 2;
          x = padding + col * (drawWidth + padding);
          y = padding + row * (drawHeight + padding);
        }

        if (layout === "grid3x2") {
          const row = Math.floor(i / 2);
          const col = i % 2;
          x = padding + col * (drawWidth + padding);
          y = padding + row * (drawHeight + padding);
        }

        ctx.save();
        
        // Enable image smoothing for photos too
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        
        // Apply filter
        ctx.filter = getCanvasFilter();
        ctx.drawImage(img, x, y, drawWidth, drawHeight);
        ctx.filter = "none"; // Reset filter for next operations
        ctx.restore();
      }

      // 3️⃣ Draw caption
      ctx.fillStyle = captionColor;
      ctx.font = `${captionSize}px ${captionFont}`;
      ctx.textAlign = "center";
      ctx.fillText(caption, (canvas.width / dpr) / 2, (canvas.height / dpr) - 50);

      // 4️⃣ Draw stickers
      await drawSticker(ctx, { width: canvas.width / dpr, height: canvas.height / dpr });
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
    selectedSticker,
    drawSticker,
    filter,
    getCanvasFilter
  ]);

  return (
    <div className="container">
      <h1>Peachy Pixels</h1>

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
          <div
            className="camera-wrapper"
            style={{
              filter: getCanvasFilter(),
              WebkitFilter: getCanvasFilter()
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="video mirror"
            />
            {countdown && <div className="countdown-overlay">{countdown}</div>}
            {flash && <div className="flash"></div>}
          </div>

          <div className="filter-group">
            <button 
              disabled={isCapturing} 
              onClick={() => setFilter("none")}
              className={filter === "none" ? "active" : ""}
            >
              Normal
            </button>
            <button 
              disabled={isCapturing} 
              onClick={() => setFilter("bw")}
              className={filter === "bw" ? "active" : ""}
            >
              B&W
            </button>
            <button 
              disabled={isCapturing} 
              onClick={() => setFilter("vintage")}
              className={filter === "vintage" ? "active" : ""}
            >
              Vintage
            </button>
            <button 
              disabled={isCapturing} 
              onClick={() => setFilter("bright")}
              className={filter === "bright" ? "active" : ""}
            >
              Bright
            </button>
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
            <h3 className="editor-title"> </h3>

            {/* BORDER */}
            <div className="editor-card">
              <p>Border</p>

              <div
                style={{
                  marginTop: "10px",
                  display: "flex",
                  gap: "10px",
                  alignItems: "center",
                  overflowX: "auto",
                  whiteSpace: "nowrap",
                  paddingBottom: "5px"
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
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    backgroundImage: "url('/redplaid.png')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    cursor: "pointer",
                    border:
                      borderType === "redPlaid"
                        ? "3px solid #ff4da6"
                        : "3px solid white",
                    boxShadow: "0 5px 15px rgba(0,0,0,0.15)",
                    flexShrink: 0
                  }}
                />

                {/* Blue Plaid */}
                <div
                  onClick={() => {
                    setBorderType("bluePlaid");
                    setShowBorderPicker(false);
                  }}
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    backgroundImage: "url('/blueplaid.png')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    cursor: "pointer",
                    border:
                      borderType === "bluePlaid"
                        ? "3px solid #ff4da6"
                        : "3px solid white",
                    boxShadow: "0 5px 15px rgba(0,0,0,0.15)",
                    flexShrink: 0
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
                  marginTop: "10px",
                  display: "flex",
                  gap: "10px",
                  overflowX: "auto",
                  paddingBottom: "5px"
                }}
              >
                <div
                  onClick={() => setSelectedSticker(null)}
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "#fff",
                    border: selectedSticker === null
                      ? "3px solid #ff4da6"
                      : "3px solid white",
                    cursor: "pointer",
                    flexShrink: 0
                  }}
                />

                <div
                  onClick={() => setSelectedSticker("heart")}
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    backgroundImage: "url('/stickers/heart.png')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    border: selectedSticker === "heart"
                      ? "3px solid #ff4da6"
                      : "3px solid white",
                    cursor: "pointer",
                    flexShrink: 0
                  }}
                />

                <div
                  onClick={() => setSelectedSticker("star")}
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    backgroundImage: "url('/stickers/star.png')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    border: selectedSticker === "star"
                      ? "3px solid #ff4da6"
                      : "3px solid white",
                    cursor: "pointer",
                    flexShrink: 0
                  }}
                />

                <div
                  onClick={() => setSelectedSticker("nailong")}
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    backgroundImage: "url('/stickers/nailong.png')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    border: selectedSticker === "nailong"
                      ? "3px solid #ff4da6"
                      : "3px solid white",
                    cursor: "pointer",
                    flexShrink: 0
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
                  {showTextPicker && (
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
