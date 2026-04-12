const url = chrome.runtime.getURL("injected.js");

console.log("[Tracker] Injecting:", url);

const script = document.createElement("script");
script.src = url;

script.onload = () => {
  console.log("[Tracker] Injected successfully");
  script.remove();
};

script.onerror = () => {
  console.error("[Tracker] Injection FAILED");
};

(document.head || document.documentElement).appendChild(script);

// bridge
// content.js
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.source === "react-render-tracker") {
    console.log("[Content Script] Received data, forwarding to background..."); // ADD THIS
    chrome.runtime.sendMessage({
      type: "RENDER_DATA",
      payload: event.data.payload,
    });
  }
});
