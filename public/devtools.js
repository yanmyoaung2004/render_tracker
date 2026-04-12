// devtools.js
const port = chrome.runtime.connect({ name: "devtools-panel" });

// 1. Send the INIT signal immediately
port.postMessage({
  type: "INIT",
  tabId: chrome.devtools.inspectedWindow.tabId,
});

// 2. Listen for messages from background (for debugging)
port.onMessage.addListener((msg) => {
  console.log("[DevTools] Message from background:", msg);
});

chrome.devtools.panels.create(
  "Render Tracker",
  "",
  "src/panel/index.html", // Verify this path matches your 'dist' folder structure
  (panel) => {
    panel.onShown.addListener((panelWindow) => {
      // 3. Pass the port to the React UI
      if (panelWindow && typeof panelWindow.initPort === "function") {
        panelWindow.initPort(port);
      }
    });
  },
);
