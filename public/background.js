var connections = {};
var latestData = null;
var hasSessionStorage = !!(chrome.storage && chrome.storage.session);
var CONTENT_SCRIPT_ID = "react-render-tracker-bridge";

// ── Script injection ─────────────────────────────────────────────
async function setupContentScript() {
  try {
    var existing = await chrome.scripting.getRegisteredContentScripts();
    var hasBridge = existing.some(function (s) { return s.id === CONTENT_SCRIPT_ID; });
    if (hasBridge) return;
    await chrome.scripting.registerContentScripts([{
      id: CONTENT_SCRIPT_ID,
      js: ["content.js"],
      matches: ["<all_urls>"],
      runAt: "document_start",
      world: "ISOLATED",
    }]);
  } catch (e) { /* registration may already exist */ }
}

async function injectIntoMainWorld(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["injected.js"],
      world: "MAIN",
    });
  } catch (e) { /* tab may not be ready */ }
}

function injectAllTabs() {
  chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }).then(function (tabs) {
    for (var i = 0; i < tabs.length; i++) {
      injectIntoMainWorld(tabs[i].id);
    }
  }).catch(function () {});
}

chrome.runtime.onInstalled.addListener(function () {
  setupContentScript();
  injectAllTabs();
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.status === "loading" && tab.url && tab.url.indexOf("http") === 0) {
    injectIntoMainWorld(tabId);
  }
});

injectAllTabs();

function updateLatestData(data) {
  latestData = data;
  if (!hasSessionStorage) return;
  try {
    chrome.storage.session.set({ latestRenderData: data }).catch(function () {});
  } catch (e) {}
}

function isValidPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (!Array.isArray(value.currentCommitUpdates)) return false;
  return true;
}

function forwardToPort(tabId, payload, commitId) {
  var port = connections[tabId];
  if (!port) return;
  try {
    port.postMessage({ type: "FOR_DEVTOOLS", payload: payload, commitId: commitId });
  } catch (e) {}
}

chrome.runtime.onConnect.addListener(function (port) {
  if (port.name !== "devtools-panel") return;
  var tabId = null;
  port.onMessage.addListener(function (message) {
    if (!message || typeof message !== "object") return;
    if (message.type === "INIT") {
      if (typeof message.tabId !== "number") return;
      tabId = message.tabId;
      connections[tabId] = port;
      if (latestData) {
        try {
          port.postMessage({ type: "FOR_DEVTOOLS", payload: latestData.payload, commitId: latestData.commitId });
        } catch (e) {}
      }
      return;
    }
    if (message.type === "HIGHLIGHT" && tabId && message.componentName) {
      try {
        chrome.tabs.sendMessage(tabId, { type: "HIGHLIGHT", componentName: message.componentName, severity: message.severity || "high" }).catch(function () {});
      } catch (e) {}
      return;
    }
    if (message.type === "PING") {
      // Heartbeat — keeps service worker alive
      return;
    }
  });
  port.onDisconnect.addListener(function () {
    var tabIds = Object.keys(connections);
    for (var i = 0; i < tabIds.length; i++) {
      if (connections[tabIds[i]] === port) {
        delete connections[tabIds[i]];
        break;
      }
    }
  });
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  try {
    if (!message || message.type !== "RENDER_DATA") { sendResponse({}); return true; }
    if (!sender.tab || typeof sender.tab.id !== "number") { sendResponse({}); return true; }
    if (!isValidPayload(message.payload)) { sendResponse({}); return true; }
    updateLatestData({ payload: message.payload, commitId: message.commitId, timestamp: Date.now() });
    forwardToPort(sender.tab.id, message.payload, message.commitId);
    sendResponse({});
  } catch (e) {
    sendResponse({});
  }
  return true;
});

if (hasSessionStorage) {
  chrome.storage.session.get("latestRenderData").then(function (result) {
    if (result.latestRenderData) latestData = result.latestRenderData;
  }).catch(function () {});
}


