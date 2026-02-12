import React, { useRef, useEffect, useState } from "react";
import { HexColorPicker } from "react-colorful";
import "./App.css";

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const pickerRef = useRef(null);

  const [screen, setScreen] = useState("home");
  const [layout, setLayout] = useState(null);
  const [filter, setFilter] = useState("none");

  const [photos, setPhotos] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const [flash, setFlash] = useState(false);

  const [borderColor, setBorderColor] = useState("#ffe4ef");
  const [caption, setCaption] = useState("");
  const [captionColor, setCaptionColor] = useState("#000000");
  const [captionSize, setCaptionSize] = useState(30);
  const [captionFont, setCaptionFont] = useState("Quicksand");

  const [showBorderPicker, setShowBorderPicker] = useState(false);
  const [showTextPicker, setShowTextPicker] = useState(false);

  /* CLOSE PICKERS */
  useEffect(() => {
    function handleClickOutside(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowBorderPicker(false);
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
    return 4;
  };

  const startCapture = async () => {
    let newPhotos = [];
    const total = getPhotoCount();

    for (let i = 0; i < total; i++) {
      await startCountdown();
      newPhotos.push(takePhoto());
    }

    stopCamera();
    setPhotos(newPhotos);
    setScreen("result");
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
    if (screen === "result" && photos.length > 0) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      const width = 500;
      const height = 350;
      const padding = 20;
      const textSpace = 100;

      if (layout === "strip4" || layout === "strip3") {
        const total = photos.length;

        canvas.width = width + padding * 2;
        canvas.height =
          total * height + padding * (total + 1) + textSpace;

        ctx.fillStyle = borderColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        photos.forEach((photo, index) => {
          const img = new Image();
          img.src = photo;
          img.onload = () => {
            ctx.drawImage(
              img,
              padding,
              padding + index * (height + padding),
              width,
              height
            );
          };
        });
      }

      if (layout === "grid2x2") {
        canvas.width = width * 2 + padding * 3;
        canvas.height = height * 2 + padding * 3 + textSpace;

        ctx.fillStyle = borderColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        photos.forEach((photo, index) => {
          const img = new Image();
          img.src = photo;
          img.onload = () => {
            const row = Math.floor(index / 2);
            const col = index % 2;
            ctx.drawImage(
              img,
              padding + col * (width + padding),
              padding + row * (height + padding),
              width,
              height
            );
          };
        });
      }

      ctx.fillStyle = captionColor;
      ctx.font = `${captionSize}px ${captionFont}`;
      ctx.textAlign = "center";
      ctx.fillText(caption, canvas.width / 2, canvas.height - 50);
    }
  }, [screen, photos, layout, borderColor, caption, captionColor, captionSize, captionFont]);

  /* UI */
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
            <button onClick={() => setFilter("none")}>Normal</button>
            <button onClick={() => setFilter("bw")}>B&W</button>
            <button onClick={() => setFilter("vintage")}>Vintage</button>
            <button onClick={() => setFilter("bright")}>Bright</button>
          </div>

          <button onClick={startCapture}>📸</button>
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
                className="color-circle-btn"
                style={{ background: borderColor }}
                onClick={() => {
                  setShowBorderPicker(!showBorderPicker);
                  setShowTextPicker(false);
                }}
              />
              {showBorderPicker && (
                <div className="picker-popup">
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
                placeholder="enter text !!"
              />
            </div>

            {/* TEXT SETTINGS */}
            <div className="editor-card">
              <p>Text Settings</p>

              <label>Font</label>
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

              <div className="text-settings-row">
                <div className="text-setting-item">
                  <span>Colour</span>
                  <div
                    className="color-circle-btn"
                    style={{ background: captionColor }}
                    onClick={() => {
                      setShowTextPicker(!showTextPicker);
                      setShowBorderPicker(false);
                    }}
                  />
                  {showTextPicker && (
                    <div className="picker-popup">
                      <HexColorPicker
                        color={captionColor}
                        onChange={setCaptionColor}
                      />
                    </div>
                  )}
                </div>

                <div className="text-setting-item">
                  <span>Size</span>
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
