---
name: React Render Tracker
description: Chrome DevTools panel that explains why React components re-render
colors:
  accent: "#818cf8"
  accent-light: "#6366f1"
  ink: "#e8e8f0"
  ink-light: "#1a1a2e"
  body: "#9494ad"
  body-light: "#52526b"
  muted: "#6b6b7d"
  muted-light: "#6b6b80"
  canvas: "#0d0d12"
  canvas-light: "#f0f0f7"
  surface: "#16161e"
  surface-light: "#ffffff"
  border: "#282833"
  border-light: "#d8d8e6"
  hover: "#1e1e28"
  hover-light: "#eaeaef"
  selected: "#1e1e3a"
  selected-light: "#eef2ff"
  danger: "#fb7185"
  danger-light: "#e11d48"
  warning: "#f59e0b"
  warning-light: "#d97706"
  success: "#14b8a6"
  success-light: "#0d9488"
  success-bg-dark: "#134e4a"
  success-bg-light: "#ccfbf1"
  insight-bg: "#1e1e28"
  insight-critical-bg: "#2d0a18"
typography:
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.5px"
    textTransform: "uppercase"
  mono:
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  heading:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  sm: "3px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "3px 8px"
  tab-button:
    backgroundColor: "transparent"
    textColor: "{colors.body}"
    rounded: "{rounded.sm}"
    padding: "4px 10px"
  tab-button-active:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.accent}"
    rounded: "{rounded.sm}"
    padding: "4px 10px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "3px 6px"
  select:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "3px 6px"
  table-header:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.body}"
    padding: "4px 8px"
  chip-critical:
    backgroundColor: "{colors.insight-critical-bg}"
    textColor: "{colors.danger}"
    rounded: "{rounded.sm}"
    padding: "1px 5px"
  chip-high:
    backgroundColor: "#fed7aa"
    textColor: "#92400e"
    rounded: "{rounded.sm}"
    padding: "1px 5px"
  chip-low:
    backgroundColor: "#fef3c7"
    textColor: "#065f46"
    rounded: "{rounded.sm}"
    padding: "1px 5px"
---

# Design System: React Render Tracker

## 1. Overview

**Creative North Star: "The Debug Console"**

The Debug Console is a developer's instrument panel — compact, precise, and ruthlessly functional. Every pixel earns its place by delivering signal, not decoration. This is a tool for engineers who already know what they're looking at; they need answers, not explanations of what the UI means.

The system sits inside Chrome DevTools, so it borrows DevTools' visual grammar: dense information density, flat surfaces with tonal layering for hierarchy, minimal chrome, and a default dark theme that matches the DevTools environment. The panel should feel like it was built by the Chrome DevTools team — not like a web app embedded in an iframe.

What this system explicitly rejects: gradient text, glassmorphism, decorative stats with big numbers, card grids with icons, numbered section markers, side-stripe borders, and any animation that delays access to data. The developer's attention is the resource we're protecting.

### Key Characteristics:
- Compact and dense: 10–12px body text, 4–8px padding, tight row spacing
- Precision instruments over marketing cards: every interactive element is clickable, selectable, and keyboard-navigable
- Flat by default: depth through tonal layering (background → surface → hover → selected), not shadows
- Dark-first: the panel is dark by default to match Chrome DevTools; light mode is a companion
- Monospace where it matters: component names, render counts, and scores use JetBrains Mono for scannability

## 2. Colors

The palette is a restrained, premium developer-tool palette: deep charcoal/cool neutrals anchored by an indigo accent. Light mode inverts to cool off-white neutrals with a deeper indigo accent.

### Primary (Dark / Light)
- **Indigo Accent** (#818cf8 / #6366f1): The single accent color. Used sparingly for active tab indicators, selected component names, and focus rings. Its rarity is the point.

### Neutral
- **Canvas** (#0d0d12 / #f0f0f7): The app background. Dark mode is a deep charcoal; light mode is a cool off-white. This is the base layer.
- **Surface** (#16161e / #ffffff): The primary surface for cards, the sidebar, and dropdowns. Sits one step above canvas.
- **Border** (#282833 / #d8d8e6): All structural dividers — table rows, sidebar edges, header bottom. Thin (1px), never colored.
- **Hover** (#1e1e28 / #eaeaef): A subtle hover tint on clickable rows.

### Text
- **Ink** (#e8e8f0 / #1a1a2e): Primary body text. A soft off-white with a cool tint that reads comfortably on dark charcoal.
- **Body** (#9494ad / #52526b): Secondary text for labels, timestamps, and muted information. Full 4.5:1 contrast against surface.
- **Muted** (#6b6b7d / #6b6b80): Tertiary text for placeholders and non-essential metadata. Also meets 4.5:1.

### Semantic
- **Danger** (#fb7185 / #e11d48): A restrained rose-crimson. Reset/destructive actions, error states, high render scores (>500). Stays within the cool palette family — not a warning red, but a deliberate danger signal.
- **Warning** (#f59e0b / #d97706): A warm amber — the one intentional warm hue in the palette. Used for medium-to-high scores (200–500) and pattern severity indicators. The warmth creates purposeful contrast against the cool charcoal-indigo backdrop.
- **Success** (#14b8a6 / #0d9488): A cool teal that bridges indigo to green naturally. Connection status, low render scores (<50). Teal feels premium and avoids the "traffic light" green problem.

### Named Rules

**The One Accent Rule.** The indigo accent is used on ≤5% of any given screen. It appears on the active tab, the selected component name, and the resize handle on hover. If the accent appears more than three places at once, it's too much.

**The Tonal Depth Rule.** Depth is conveyed by stepping up one surface level, not by adding shadows. Canvas → Surface → Hover → Selected is the full depth scale. No `box-shadow` on any surface.

## 3. Typography

**Body Font:** Inter (with -apple-system, BlinkMacSystemFont, Segoe UI fallback)
**Mono Font:** JetBrains Mono (with Fira Code, Consolas fallback)

**Character:** A single-family sans approach. Inter provides the compact, legible body text that DevTools users expect. JetBrains Mono is used for component names, render counts, and code-adjacent data — it gives the panel its developer-tool character.

### Hierarchy
- **Heading** (Inter 600, 16px, 1.4): Section titles in the toolbar and sidebar. Used sparingly — typically only the panel title itself.
- **Body** (Inter 400, 12px, 1.5): All primary content — table cells, sidebar detail text, insight messages.
- **Body Small** (Inter 400, 11px, 1.4): Secondary content — pattern descriptions, cause chain items, history timestamps.
- **Label** (Inter 600, 10px, 1.4, 0.5px letter-spacing, uppercase): Column headers, stat labels, section titles in the sidebar.
- **Mono** (JetBrains Mono 400, 12px, 1.5): Component names in tables, render counts, scores, prop values.
- **Mono Small** (JetBrains Mono 400, 10px, 1.5): Compressed data display — score values in flamegraph bars, chip labels.

### Named Rules

**The Mono Rule.** JetBrains Mono is reserved for data that changes: component names, render counts, scores, timestamps, prop values. Static labels (column headers, section titles) use Inter. If it's a number or a component name, it's Mono.

## 4. Elevation

The system is entirely flat. Depth is conveyed through tonal layering: the light-to-dark progression from Canvas → Surface → Hover → Selected creates a clear stack without shadows.

There is no `box-shadow` on any surface. Not on cards, not on dropdowns, not on the sidebar. The border alone (1px solid, `#334155` / `#e2e8f0`) defines surface boundaries.

Dropdowns escape the stacking context via `position: absolute` with no shadow. Their elevation is signaled by their border and their topological position (appearing on click, covering content below).

**The Flat-By-Default Rule.** Surfaces are flat at rest and flat in interaction. The only visual depth cue is the hover background shift (Canvas → Hover for table rows, Surface → Hover for sidebar items). No shadows, no lifted states.

## 5. Components

### Buttons
- **Shape:** Compact with slight rounding (3px radius).
- **Danger (Reset):** Red-filled (`#f87171`), white text, 12px font, 3px 8px padding. Has a dropdown variant for partial resets.
- **Ghost (Export, Close):** No background or border. Icon-only (13–14px). Uses muted text color. Hover adds a subtle surface background change only if needed; typically the icon sits on an already-matching surface.
- **Tab Button (View selector):** Transparent bg, 12px label + icon, 4px 10px padding. Active state gets `selected` bg + accent text. Inactive gets body text.

### Chips (Severity Tags)
- **Shape:** Inline pill with 2px radius.
- **Critical:** Dark red bg (#450a0a) with danger-red text — used for wasted-chain patterns, function-ref changes.
- **High:** Orange-tinted bg (#fed7aa) with dark amber text — used for context explosions, prop cascades.
- **Low/Medium:** Yellow-tinted bg (#fef3c7) with dark green text — used for parent causes, minor patterns.

### Table
- **Structure:** Full-width, collapsed borders, sticky header.
- **Header:** Uppercase 10px labels with 0.5px tracking, 6px 10px padding, sticky at top. Uses body color, not ink.
- **Rows:** 5px 10px padding, 1px border-bottom separator. Clickable. Selected row gets blue-tinted bg (#1e3a5f / #eff6ff). Hover gets the hover tint.
- **Cells:** Mono font for component names and numeric data. Heatmap bg (green → amber → red gradient) for render count and exclusive columns.
- **Root Cause column:** Icon-based — shows brain circuit (state), arrows (props), globe (context), corner-up (parent).

### Input (Search)
- **Shape:** 3px radius, 1px border, 3px 6px padding.
- **Styling:** Matches the surface color. Focus shows accent border (sky blue). Placeholder text at muted color. Compact width (140px default).

### Select (Filter Dropdown)
- **Shape:** 3px radius, 1px border, 3px 6px padding.
- **Styling:** Matches input styling. Used for pattern type filtering in table view.

### Detail Panel (Sidebar)
- **Structure:** Scrollable sections separated by 1px borders.
- **Sections:** Stats grid (2×2 layout with 8px gap), insights (carousel of pattern cards), cause chain (stacked steps with arrow separator), prop diffs (key-value list), history (timeline of events).
- **Stats Cells:** Compact cards (8px padding, 4px radius) with uppercase label + large (15px) mono value.
- **Insight Cards:** Left-bordered cards (3px) with warning-tinted bg. Show pattern type, suggestion, and expected impact.
- **Cause Chain Steps:** Indented steps with `›` separators. Root cause gets an amber left border and amber-tinted bg.

### Live Feed
- **Structure:** Collapsible panel at the bottom of the sidebar. Click header to expand/collapse.
- **Header:** Compact row (6px 12px) with icon, label, count badge, and expand arrow.
- **Items:** Left-bordered (3px) with color by exclusive count (green <5, amber <10, red ≥10). Show component name, timestamp, score, exclusive count.

### Tree View
- **Structure:** Indented by depth (20px per level), each node is a clickable row.
- **Nodes:** Selected nodes get blue-tinted bg. Rendered nodes get amber-tinted bg. Unrendered nodes are transparent.
- **Expand/Collapse:** ChevronDown / ChevronRight icons on parent nodes. Square icon on leaf nodes (no children).
- **Indicators:** Severity dot (colored circle) + render count next to component name.

### Flamegraph
- **Structure:** Horizontal bars sorted by score descending (top 30).
- **Bars:** Full-height (20px), colored by score intensity (green → amber → red). Label shows component name + score. Clickable to select.

### Timeline
- **Structure:** Vertical list of commit entries, each with a left accent border (3px).
- **Entries:** Show commit ID, timestamp, component count, peak exclusive count. Up to 10 component pills per entry.

## 6. Do's and Don'ts

### Do:
- **Do** use the accent color (`#818cf8` / `#6366f1`) on exactly one element per view — the active tab.
- **Do** use JetBrains Mono for all component names, render counts, scores, and prop values.
- **Do** keep table rows at 5px vertical padding — anything more wastes vertical space in a DevTools panel.
- **Do** make every row clickable. Clicking a component in any view selects it and shows details in the sidebar.
- **Do** respect `prefers-reduced-motion`: instant transitions, no auto-play, no entrance animations.
- **Do** use tonal layering (Canvas → Surface → Hover → Selected) instead of shadows for depth.

### Don't:
- **Don't** use gradient text, glassmorphism, or decorative `backdrop-filter` blur.
- **Don't** add shadows to any surface — no `box-shadow` on cards, dropdowns, or the sidebar.
- **Don't** use side-stripe borders (colored `border-left` greater than 1px as an accent). Use full background tints or left-bordered cards (3px max, only on insight cards and live feed items).
- **Don't** show big decorative numbers or hero metrics. Render count, score, and exclusive count are functional data shown inline.
- **Don't** use numbered section markers (01 / 02 / 03) or tiny uppercase eyebrows above every section.
- **Don't** add card grids with icon + heading + text patterns. Tables and lists carry more information per pixel.
- **Don't** animate layout properties. State transitions (hover, selected) should be instant or use a 100–150ms opacity/color transition only.
- **Don't** clip absolute-positioned dropdowns — use `position: fixed` or the native popover API to escape the stacking context.
