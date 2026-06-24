import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./ErrorBoundary";

var portResolve;
var portResolved = false;
var portPromise = new Promise(function (resolve) {
  portResolve = resolve;
});

window.initPort = function (port) {
  if (portResolved) return;
  portResolved = true;
  portResolve(port);
};

window.portPromise = portPromise;

createRoot(document.getElementById("root")).render(
  React.createElement(ErrorBoundary, null, React.createElement(App))
);
