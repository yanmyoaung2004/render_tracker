(function () {
  var MSG_SOURCE = "react-render-tracker";

  function isValidPayload(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    if (!Array.isArray(value.currentCommitUpdates)) return false;
    return true;
  }

  window.addEventListener("message", function (event) {
    if (event.source !== window) return;
    var pageOrigin = window.location.origin;
    if (typeof event.origin === "string" && event.origin !== "null" && event.origin !== pageOrigin) return;
    var data = event.data;
    if (!data || data.source !== MSG_SOURCE) return;
    if (!isValidPayload(data.payload)) return;

    try {
      chrome.runtime.sendMessage({
        type: "RENDER_DATA",
        payload: data.payload,
        commitId: data.commitId,
      }).catch(function (err) {
        if (String(err && err.message).indexOf("Receiving end") !== -1) return;
      });
    } catch (e) {}
  });

  // Forward highlight commands from background to page
  try {
    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
      if (!message || message.type !== "HIGHLIGHT") return false;
      try {
        window.postMessage({
          source: "react-render-tracker-bg",
          type: "HIGHLIGHT",
          componentName: message.componentName,
          severity: message.severity || "high",
        }, window.location.origin || "*");
      } catch (e) {}
      sendResponse({});
      return true;
    });
  } catch (e) {}
})();
