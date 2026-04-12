const connections = {};

chrome.runtime.onConnect.addListener((port) => {
  const devToolsListener = (message) => {
    if (message.type === "INIT") {
      // Store the connection using the tabId as the key
      connections[message.tabId] = port;
      console.log(`[Background] SUCCESS: Linked to Tab ID ${message.tabId}`);
      return;
    }
  };

  port.onMessage.addListener(devToolsListener);

  port.onDisconnect.addListener(() => {
    const tabs = Object.keys(connections);
    for (const tabId of tabs) {
      if (connections[tabId] === port) {
        delete connections[tabId];
        console.log(`[Background] Removed connection for Tab ${tabId}`);
        break;
      }
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "RENDER_DATA" && sender.tab) {
    const tabId = sender.tab.id;
    if (connections[tabId]) {
      console.log(`[Background] Relaying data to DevTools for Tab ${tabId}`);
      connections[tabId].postMessage({
        type: "FOR_DEVTOOLS",
        payload: message.payload,
      });
    } else {
      console.warn(
        `[Background] DROP: No DevTools connection found for Tab ${tabId}`,
      );
    }
  }
  return true;
});
