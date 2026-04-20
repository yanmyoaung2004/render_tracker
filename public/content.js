const INJECTED = "injected.js";
const MSG_SOURCE = "react-render-tracker";

function getInjectedUrl() {
  try {
    return chrome.runtime.getURL(INJECTED);
  } catch (e) {
    console.error("[Tracker] getURL failed:", e);
    return null;
  }
}

const url = getInjectedUrl();
if (url) {
  const script = document.createElement("script");
  script.src = url;
  script.onload = () => script.remove();
  script.onerror = () => {
    console.error("[Tracker] Failed to load injected script");
  };
  (document.head || document.documentElement).appendChild(script);
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isValidTrackerPayload(payload) {
  if (!isPlainObject(payload)) return false;
  if (!Array.isArray(payload.currentCommitUpdates)) return false;
  return true;
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  const pageOrigin = window.location.origin || "null";
  if (typeof event.origin === "string" && event.origin !== pageOrigin) return;

  const data = event.data;
  if (!data || data.source !== MSG_SOURCE) return;

  if (!isValidTrackerPayload(data.payload)) {
    console.warn("[Tracker] Ignored message: invalid payload shape");
    return;
  }

  try {
    chrome.runtime.sendMessage(
      {
        type: "RENDER_DATA",
        payload: data.payload,
        commitId: data.commitId,
      },
      () => {
        const err = chrome.runtime.lastError;
        if (err && !String(err.message || "").includes("Receiving end")) {
          console.warn("[Tracker] sendMessage:", err.message);
        }
      },
    );
  } catch (e) {
    console.error("[Tracker] sendMessage failed:", e);
  }
});
