import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import Viewer from "./Viewer";           
const root = ReactDOM.createRoot(document.getElementById("root"));

// <-- add: if the URL is /s/{id}, show the viewer instead of the app
const stripMatch = window.location.pathname.match(/^\/s\/([A-Za-z0-9_-]+)\/?$/);

root.render(
  <React.StrictMode>
    {stripMatch ? <Viewer id={stripMatch[1]} /> : <App />}
  </React.StrictMode>
);