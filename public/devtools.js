let port;
try {
  port = chrome.runtime.connect({ name: "devtools-panel" });
} catch (e) {
  console.error("[DevTools] Failed to connect extension port:", e);
  throw e;
}

port.postMessage({
  type: "INIT",
  tabId: chrome.devtools.inspectedWindow.tabId,
});

port.onMessage.addListener((msg) => {
  if (msg?.type === "FOR_DEVTOOLS") return;
  console.log("[DevTools] Message from background:", msg);
});

// Built panel: run `npm run build` and load the `dist/` folder as the unpacked extension.
chrome.devtools.panels.create(
  "Render Tracker",
  "",
  "panel.html",
  (panel) => {
    if (chrome.runtime.lastError) {
      console.error(
        "[DevTools] panels.create failed:",
        chrome.runtime.lastError.message,
      );
      return;
    }
    panel.onShown.addListener((panelWindow) => {
      if (panelWindow && typeof panelWindow.initPort === "function") {
        try {
          panelWindow.initPort(port);
        } catch (e) {
          console.error("[DevTools] initPort failed:", e);
        }
      }
    });
  },
);
