(function () {
  var port;
  try {
    port = chrome.runtime.connect({ name: "devtools-panel" });
  } catch (e) {
    console.error("[DevTools] Failed to connect extension port:", e);
    return;
  }

  port.postMessage({
    type: "INIT",
    tabId: chrome.devtools.inspectedWindow.tabId,
  });

  chrome.devtools.panels.create(
    "Render Tracker",
    "",
    "panel.html",
    function (panel) {
      if (chrome.runtime.lastError) {
        console.error("[DevTools] panels.create failed:", chrome.runtime.lastError.message);
        return;
      }
      panel.onShown.addListener(function (panelWindow) {
        if (panelWindow && typeof panelWindow.initPort === "function") {
          try {
            panelWindow.initPort(port);
          } catch (e) {
            console.error("[DevTools] initPort failed:", e);
          }
        }
      });
    }
  );
})();
