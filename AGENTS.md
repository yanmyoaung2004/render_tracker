# React Render Tracker — AGENTS.md

## What this is

Chrome DevTools extension (MV3) that instruments React's Fiber tree to explain why components re-render. Uses `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` interception at runtime — no code changes needed in target apps.

## Architecture

```
React Fiber → injected.js (patches onCommitFiberRoot)
  → window.postMessage → content.js (bridge)
  → chrome.runtime.sendMessage → background.js (tab-port relay)
  → port.postMessage → devtools.js (creates panel, forwards port)
  → panel.html → main.jsx → App.jsx
```

Key files:
- `public/injected.js` — core tracking; patches React hook, builds causal chains, prop diffs, timeline
- `public/content.js` — relays `postMessage` events from `injected.js` to background via `chrome.runtime.sendMessage`
- `public/background.js` — injects scripts (`content.js` as persistent content script, `injected.js` into MAIN world), maps tabId ↔ devtools port, relays `RENDER_DATA` messages
- `public/devtools.js` — creates "Render Tracker" panel, passes `chrome.runtime.Port` to panel via `window.initPort(port)`
- `src/panel/main.jsx` — panel entry; exposes `window.portPromise` for port delivery
- `src/panel/App.jsx` — main panel UI (the active one); `AppG.jsx` / `AppS.jsx` are gitignored alternatives
- `panel.html` — panel HTML; entrypoint for Vite build
- `vite.config.js` — `base: './'` required for `chrome-extension://` asset resolution

## Commands

| Command | Action |
|---|---|
| `npm run build` | Production build to `dist/` |
| `npm run dev` | `vite build --watch` |
| *(no test/lint/typecheck scripts)* | — |

## Loading in Chrome

1. `npm run build`
2. Chrome → `chrome://extensions/` → Developer mode → **Load unpacked** → select `dist/`
3. Open DevTools on any React app → **Render Tracker** panel tab
4. May need to **refresh the page** with DevTools already open for data to appear

## Key internals

- Injected script polls for `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` (200 attempts × 50ms) then wraps `onCommitFiberRoot` to capture render data per commit
- Manifest V3, service worker (`background.js`, type: module), content script runs at `document_start`
- Payload size cap: 1.5M chars; timeline capped at 80 entries
- Canvas flamegraph only renders when view is active
- Sidebar is resizable (drag divider, 350–800px range)
- State resets via "Reset Data" button (confirms first)
- `.gitignore` keeps `dist/`, `VISUAL*.md`, `App[GS].jsx`, `injectedG.js` out of repo
- The devtools-to-panel port bridge uses `window.initPort` + `window.portPromise` pattern (see `devtools.js:32-36`, `main.jsx:6-16`)

## Important gotchas

- `base: './'` in vite config is **required** — without it asset paths break in `chrome-extension://` context
- React internals dependency: `fiber.flags` check against value `4` (`REACT_FLAG_UPDATE`) — may need adjustment per React major
- Component tree removes host components (`div`, `span`) and filters library components (`Styled*`, `Mui*`, `ForwardRef`, `Memo`)
- Payload trimming (when >1.5MB) slices timeline to last 25 entries and updates to 120 — large apps may lose data silently
- `structuredClone` fallback to `JSON.parse(JSON.stringify(...))` — non-serializable data is dropped
- The panel only receives `FOR_DEVTOOLS` messages; content script sees `RENDER_DATA` type
