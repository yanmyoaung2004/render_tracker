import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// Create a promise that resolves when the port arrives
let portResolve;
const portPromise = new Promise((resolve) => {
  portResolve = resolve;
});

// This gets called by devtools.js
window.initPort = (port) => {
  portResolve(port);
};

window.portPromise = portPromise;

createRoot(document.getElementById("root")).render(<App />);
