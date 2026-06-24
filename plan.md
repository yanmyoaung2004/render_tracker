# Rebuild Plan: React Render Tracker

## Overview
Chrome MV3 extension that instruments React's Fiber tree at runtime via `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` to explain *why* components re-render. Rebuild from scratch with clean architecture, proper separation of concerns, and no dead code.

## Architecture

```
React Fiber → injected.js (single-pass walk, cause detection, pattern analysis)
  → window.postMessage → content.js (inject + validate + relay)
  → chrome.runtime.sendMessage → background.js (port relay + session storage)
  → port.postMessage → devtools.js → panel.html → main.jsx → App.jsx
```

## Key Design Decisions
- **`injected.js`**: Pure IIFE with no dead code. Single-pass iterative fiber traversal. Incremental serialization (no full-payload deep clones). React version detection via runtime flag probing.
- **Message relay**: Minimal — content.js only injects and forwards, no buffering (background handles that). Background uses `chrome.storage.session` for SW restart survival.
- **Panel UI**: Split App.jsx (1054 lines → separate components per view). `useReducer` for component state, theme-agnostic via design tokens. Each view is a pure render function receiving props.
- **No tests yet** (deferred to phase 2, but code is structured for it).

## File Structure

```
public/
  injected.js       — Core: fiber walk, cause detection, patterns, serialization
  content.js        — Inject injected.js, relay postMessage → sendMessage
  background.js     — MV3 SW: port mapping, session storage, message relay
  devtools.js       — Create panel, forward port
  devtools.html     — Entry for devtools_page
  manifest.json     — MV3 manifest with permissions
src/
  panel/
    main.jsx        — Panel entry, port promise
    App.jsx         — Layout + view routing + sidebar
    TableView.jsx   — Sortable/filterable table
    TreeView.jsx    — Expandable component tree
    FlamegraphView.jsx — Bar chart by render score
    TimelineView.jsx    — Commit history list
    DetailPanel.jsx     — Component detail sidebar
    InsightsPanel.jsx   — Auto insights feed
    LiveFeed.jsx        — Recent updates stream
    componentData.js    — createComponentData, mergeComponentData, reducer
    theme.js            — Design tokens (light/dark)
    styles.js           — Style factory
panel.html              — Vite entry HTML
vite.config.js          — base: './', single input
```

## Task List

### Task 1: Tracking Engine (`injected.js`)
**Description:** The core — fiber walker, cause detection, pattern analysis, serialization. Everything else depends on this.

**Acceptance criteria:**
- [ ] Patches `window.__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot` after polling (200×50ms)
- [ ] Single-pass iterative fiber walk collects per-component update data
- [ ] Cause detection: props diff, state changes, context changes, parent propagation
- [ ] Causal chain: walks `fiber.return` to build root-cause chain
- [ ] Pattern detection: wasted-chain, context-explosion, unstable-function-prop, prop-cascade, deep-propagation, object-prop-instability
- [ ] Timeline: compact entries (no propDiff/patterns/predictions in history), capped at 80 entries
- [ ] Payload: max 4MB, trims oldest timeline entries + overflows oldest stats
- [ ] User component filter: `_debugSource.fileName` for node_modules detection, fallback to name heuristic
- [ ] `window.postMessage` with `source: "react-render-tracker"`

**Verification:** Build succeeds, extension loads without errors

**Dependencies:** None

**Files:** `public/injected.js`

---

### Task 2: Extension Shell (`manifest.json`, `content.js`, `background.js`, `devtools.js`, `devtools.html`)
**Description:** The MV3 extension infrastructure — injects injected.js, relays messages, manages DevTools panel port.

**Acceptance criteria:**
- [ ] Manifest V3 with correct permissions (scripting, activeTab, tabs, storage)
- [ ] Content script injects `injected.js` at `document_start` via `<script>` tag
- [ ] Content script validates `postMessage` payload, forwards via `chrome.runtime.sendMessage`
- [ ] Background service worker maps tabId ↔ devtools port
- [ ] Background persists latest data to `chrome.storage.session` for SW restart survival
- [ ] DevTools page creates "Render Tracker" panel, forwards port via `window.initPort(port)`
- [ ] All messages are validated before forwarding

**Verification:** Build succeeds, extension loads in Chrome, panel shows in DevTools

**Dependencies:** None (shell, no tracking logic)

**Files:** `public/manifest.json`, `public/content.js`, `public/background.js`, `public/devtools.js`, `public/devtools.html`

---

### Task 3: Panel Foundation (`panel.html`, `main.jsx`, `theme.js`, `styles.js`, `componentData.js`, `App.jsx`)
**Description:** React app entry, port connection, design system, component data reducer, and main layout with view routing.

**Acceptance criteria:**
- [ ] `panel.html` loads Vite-bundled `main.jsx`
- [ ] `main.jsx` creates React root, exposes `window.initPort` + `window.portPromise`
- [ ] `App.jsx` connects to port, receives `FOR_DEVTOOLS` messages, dispatches to reducer
- [ ] Theme detection via `chrome.devtools.panels.themeName` + CSS class toggle
- [ ] Design tokens: light + dark themes with bg/text/border/accent/heatmap tokens
- [ ] Style factory: all styles computed from active theme
- [ ] Component data reducer: `UPDATE` (upsert), `RESET` actions with history tracking
- [ ] Layout: header (title, status dot, export, reset), toolbar (view selector, search, sort, filter), main content area, resizable sidebar, live feed footer

**Verification:** Panel loads, connects to extension, receives messages (no data yet to render)

**Dependencies:** Task 1, Task 2 (for message flow to work end-to-end)

**Files:** `panel.html`, `src/panel/main.jsx`, `src/panel/App.jsx`, `src/panel/theme.js`, `src/panel/styles.js`, `src/panel/componentData.js`

---

### Task 4: Table View + Component Detail (`TableView.jsx`, `DetailPanel.jsx`)
**Description:** Primary view — sortable, searchable, filterable table of components with click-to-inspect sidebar.

**Acceptance criteria:**
- [ ] Table columns: Component (monospace), Score (icon), Renders (heatmap), Exclusive (heatmap), Root Cause (icon), Patterns (chips)
- [ ] Sort by score, exclusive, renders, total, name (click header)
- [ ] Search by component name (input filters rows)
- [ ] Pattern filter dropdown (all, wasted-chain, context-explosion, etc.)
- [ ] Click row → sidebar shows component detail: score, renders history, prop diff table, patterns, predictions, cause chain
- [ ] Component detail has "Render History" sub-view with per-commit breakdown
- [ ] Sidebar header with component name and close button
- [ ] Empty states: "Waiting for connection", "Waiting for render data", "Select a component"
- [ ] Heatmap colors for numeric columns

**Verification:** Data displays in table, clicking shows details, sort/search/filter work

**Dependencies:** Task 3 (panel framework)

**Files:** `src/panel/TableView.jsx`, `src/panel/DetailPanel.jsx`

---

### Task 5: Tree View + Flamegraph View (`TreeView.jsx`, `FlamegraphView.jsx`)
**Description:** Component tree with expand/collapse and flamegraph barchart.

**Acceptance criteria:**
- [ ] TreeView renders hierarchical component tree from `componentTree` payload
- [ ] Expand/collapse with ChevronDown/ChevronRight icons
- [ ] Rendered nodes highlighted with amber background, non-rendered transparent
- [ ] Click node → selects component, shows in sidebar
- [ ] FlamegraphView renders horizontal bars proportional to render score
- [ ] Color-coded bars (green/yellow/red by intensity)
- [ ] Hover with opacity effect, click to select
- [ ] Empty state: "No data to visualize"

**Verification:** Switch between views, tree expands/collapses, flamegraph shows bars

**Dependencies:** Task 3

**Files:** `src/panel/TreeView.jsx`, `src/panel/FlamegraphView.jsx`

---

### Task 6: Timeline View + Live Feed + Insights + Export (`TimelineView.jsx`, `InsightsPanel.jsx`, `LiveFeed.jsx`)
**Description:** Commit history timeline, auto-generated insights stream, live updates feed, JSON export + reset.

**Acceptance criteria:**
- [ ] TimelineView: list of timeline entries showing commit ID, timestamp, count of updated components
- [ ] Click timeline entry → restores that commit's data (stretch goal)
- [ ] InsightsPanel: auto-generated performance insights from current commit patterns
- [ ] Insights deduplicated, severity-labeled (critical/high/medium), with suggestion text
- [ ] LiveFeed: scrollable list of most recent updates with time, score, exclusive value
- [ ] LiveFeed click → selects component
- [ ] JSON Export: button downloads all data as `.json` file
- [ ] Reset button with dropdown menu (Clear all, Clear timeline, Clear insights)
- [ ] Reset confirms before clearing

**Verification:** Timeline shows commits, insights appear, export downloads valid JSON, reset clears selected data

**Dependencies:** Task 3

**Files:** `src/panel/TimelineView.jsx`, `src/panel/InsightsPanel.jsx`, `src/panel/LiveFeed.jsx`

---

### Task 7: Polish & Integration
**Description:** Dark mode detection, edge cases, error boundaries, performance.

**Acceptance criteria:**
- [ ] Dark mode detected from `chrome.devtools.panels.themeName` (fallback: `window.matchMedia`)
- [ ] Theme class toggles on `<body>` for CSS variable consumption
- [ ] Error boundary catches render errors in panel
- [ ] No console errors from extension code (React DevTools warnings from target page are expected)
- [ ] `injected.js` handles missing `_debugSource` gracefully
- [ ] `injected.js` handles `structuredClone` absence (falls back to JSON round-trip)
- [ ] Background SW handles port disconnect gracefully
- [ ] Build output < 300KB gzip

**Verification:** Toggle Chrome DevTools dark/light mode, panel follows. Load on various React apps (CRA, Vite, Next.js) without crashes

**Dependencies:** All previous tasks

**Files:** All

## Checkpoints

### Checkpoint A: After Tasks 1-2 (Foundation)
- [ ] Build succeeds (`npm run build`)
- [ ] Extension loads in Chrome without errors
- [ ] `injected.js` patches React hook on target page (verify via console log)
- [ ] Messages flow from injected → content → background (verify via background console)

### Checkpoint B: After Tasks 3-4 (Panel with Data)
- [ ] Panel shows data table with component renders
- [ ] Clicking components shows details in sidebar
- [ ] Search, sort, filter work
- [ ] Dark/light theme toggle works

### Checkpoint C: After Tasks 5-6 (All Views)
- [ ] All 4 view modes work without crashes
- [ ] Export produces valid JSON
- [ ] Reset clears data
- [ ] Insights appear

### Checkpoint D: After Task 7 (Ship)
- [ ] Full end-to-end test on a real React app
- [ ] No extension crashes or console errors
- [ ] `npm run build` produces clean output
