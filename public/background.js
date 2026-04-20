const connections = {};

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isValidRenderPayload(payload) {
  if (!isPlainObject(payload)) return false;
  if (!Array.isArray(payload.currentCommitUpdates)) return false;
  return true;
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "devtools-panel") return;

  const devToolsListener = (message) => {
    if (!message || typeof message !== "object") return;
    if (message.type === "INIT") {
      const tabId = message.tabId;
      if (typeof tabId !== "number") return;
      connections[tabId] = port;
      return;
    }
  };

  port.onMessage.addListener(devToolsListener);

  port.onDisconnect.addListener(() => {
    const tabs = Object.keys(connections);
    for (const tabId of tabs) {
      if (connections[tabId] === port) {
        delete connections[tabId];
        break;
      }
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (!message || message.type !== "RENDER_DATA") {
      return false;
    }
    if (!sender.tab?.id) {
      return false;
    }
    if (!isValidRenderPayload(message.payload)) {
      console.warn("[Background] Dropped RENDER_DATA: invalid payload");
      return false;
    }

    const tabId = sender.tab.id;
    const port = connections[tabId];
    if (port) {
      try {
        port.postMessage({
          type: "FOR_DEVTOOLS",
          payload: message.payload,
          commitId: message.commitId,
        });
      } catch (e) {
        console.warn("[Background] postMessage to devtools failed:", e);
      }
    }
  } catch (e) {
    console.error("[Background] onMessage error:", e);
  }
  return false;
});
