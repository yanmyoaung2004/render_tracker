---
target: src/panel/App.jsx
total_score: 22
p0_count: 0
p1_count: 2
p2_count: 3
timestamp: 2026-06-24T08-15-19Z
slug: src-panel-app-jsx
---
#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Connection indicator present, but no loading states during data pipeline init |
| 2 | Match System / Real World | 3 | Developer language is correct; "Exclusive" needs a tooltip for clarity |
| 3 | User Control and Freedom | 3 | Reset with dropdown is good; no undo after clearing data |
| 4 | Consistency and Standards | 2 | Mix of design tokens and hard-coded colors; side-tab borders violate DESIGN.md rules |
| 5 | Error Prevention | 3 | Two-click reset is good; no confirmation dialog for destructive clear-all |
| 6 | Recognition Rather Than Recall | 2 | Selected component persists across views; no keyboard shortcuts, no search history |
| 7 | Flexibility and Efficiency | 1 | Zero keyboard shortcuts; no bulk operations; no component pinning |
| 8 | Aesthetic and Minimalist Design | 3 | Compact layout works; side-tab borders add noise; toolbar gets cluttered with filter visible |
| 9 | Error Recovery | 2 | ErrorBoundary catches crashes; no inline error states or guidance when data pipeline fails |
| 10 | Help and Documentation | 0 | No help text, no tooltips on domain terms (exclusive, commit), no diagnostic info |
| **Total** | | **22/40** | **Acceptable** |

#### Anti-Patterns Verdict

**LLM Assessment**: The panel has a functional, compact layout that generally avoids the worst AI tells. The main issues are side-tab borders (3px colored left borders on tree nodes, insight cards, live feed items, and cause steps) which are the #1 AI tell flagged by the detector. Hard-coded colors like #93c5fd, #1e40af, #fed7aa, #fef3c7, #6ee7b7, #d1fae5 exist outside the design system defined in DESIGN.md. The tree view component uses inline event handlers (onMouseEnter/onMouseLeave with hard-coded colors) rather than CSS :hover or the style system, creating unnecessary repetition.

**Deterministic Scan**: 17 findings total:
- 4 side-tab border warnings (App.jsx:110, styles.js:267/306/323)
- 8 color-outside-DESIGN.md advisories (App.jsx:546, styles.js:214/272/273/406)
- 5 radius-outside-DESIGN.md advisories (styles.js:58/215/227/264/303/313/335 — all 4px and 2px values)

**Browser Visualization**: Unavailable — this is a Chrome extension panel loaded via chrome-extension:// protocol, not a web page served by a dev server.

#### Overall Impression

The panel is functionally solid and the compact layout is appropriate for DevTools. The biggest opportunity is aligning the implementation with the DESIGN.md you just created — the side-tab borders, hard-coded colors, and undocumented radii represent drift that makes the panel look less intentional than it should. The cosmetic drift is fixable; the missing keyboard nav and help/docs are the deeper gaps.

#### What's Working

1. **Compact top bar** — The combined header+toolbar with tab buttons saves vertical space and feels native to DevTools. The tab-button design (inactive = muted, active = accent + selected bg) is the right pattern.
2. **Progressive disclosure in sidebar** — Stats, insights, cause chain, props, history are stacked sections with clear section titles. The user sees the summary first and can scroll down for details.
3. **Live feed collapsible** — Defaulting to collapsed respects the user's attention; they can expand it when they want to see real-time activity.

#### Priority Issues

- **[P1] Side-tab borders violate the design system.** 3px colored `border-left` appears on tree nodes (App.jsx:110), insight cards (styles.js:267), cause steps (styles.js:306), and live feed items (styles.js:323). DESIGN.md explicitly names this as a don't. Replace with full-background-tint cards or the left-bordered-card pattern (3px max, allowed for insight cards and live feed items per DESIGN.md). Suggested: `$impeccable polish`

- **[P1] Hard-coded colors outside DESIGN.md.** Tree node selected state uses `#93c5fd`/`#1e40af` (App.jsx:546), chip backgrounds use `#fed7aa`/`#fef3c7` (styles.js:214), insight suggestions use `#6ee7b7`/`#d1fae5` (styles.js:272-273), plus 4px and 2px radius values not in the DESIGN.md scale (sm=3px, md=6px, lg=8px). These should be either DESIGN.md tokens or added as intentional additions. Suggested: `$impeccable polish`

- **[P2] No keyboard shortcuts.** Power users (Alex) can't navigate the panel without a mouse. No keyboard shortcuts for view switching, search focus, component selection, or reset. At minimum, `/` for search focus, arrow keys for table navigation, and Esc to close detail panel would dramatically improve efficiency. Suggested: `$impeccable audit` then `$impeccable polish`

- **[P2] No focus indicators on interactive elements.** Buttons, table rows, and tree nodes aren't keyboard-focusable with visible indicators. This is a WCAG AA violation (2.4.7 Focus Visible). Tree nodes don't have `tabIndex` or `role` attributes. Suggested: `$impeccable audit`

- **[P2] Tree view uses hard-coded inline styles.** The TreeNode component (App.jsx:73-158) computes background, color, and borderColor inline with hard-coded hex values and uses onMouseEnter/onMouseLeave event handlers for hover states. These should use the style system (styles.js) and CSS :hover pseudo-class. Suggested: `$impeccable polish`

- **[P3] Missing tooltip on "Exclusive" label.** The stats grid shows "Exclusive" as a label but doesn't explain what it means (renders unique to this component, excluding child components). A tooltip would help less-experienced React developers. Suggested: `$impeccable clarify`

- **[P3] Toolbar gets cluttered when filter is visible.** When in table view, the toolbar shows: tab buttons + search + pattern filter + export + reset. That's 5 control groups in a 36px bar. The pattern filter could be a dropdown in the table header instead. Suggested: `$impeccable layout`

#### Persona Red Flags

**Alex (Power User)**: No keyboard shortcuts. Must click tab buttons to switch views. Can't navigate the table with arrow keys. Can't bulk-select or compare components. Must scroll and click each component individually. Will abandon after the third mouse-only interaction.

**Jordan (First-Timer)**: Sees "Exclusive" label with no explanation. Pattern filter shows raw type names like "unstable-function-prop" with no human-readable description. Empty states say "Waiting for connection..." but don't explain that the extension needs to be loaded in Chrome DevTools and a React app must be open. Will stare at an empty panel wondering if it's broken.

**Sam (Accessibility)**: No focus indicators. Tree nodes are not keyboard-accessible (`div` elements without `tabIndex`, `role`, or `onKeyDown`). Color alone conveys severity (red numbers = bad, green = good). "Exclusive" column heatmap uses color + background together, but text contrast on amber/red backgrounds may be below 4.5:1.

#### Minor Observations

- The `applyThemeVars` function sets CSS custom properties on `document.documentElement` but they're rarely used in the render code — most styles go through the `s` object from `createStyles()`. The CSS vars seem vestigial.
- Live feed items show `update.name` but the timestamp shows `toLocaleTimeString()` which doesn't include milliseconds — for a tool tracking render performance, ms precision matters.
- Remove unused `Filter` import (already done) and `ICON_SIZE_LG` variable (still defined at line 15).
- The flamegraph uses `#ef4444`, `#f59e0b`, `#22c55e` hard-coded instead of semantic color tokens.

#### Run Notes

- Target slug: `src-panel-app-jsx`
- Ignore list: none
- Assessment independence: sequential (sub-agent unavailable for Chrome-extension target)
- CLI detector: 17 findings (4 warnings, 13 advisories)
- Browser visibility: skipped (chrome-extension:// protocol, no dev server)
- Overlay injection: skipped
- Live server: n/a
- Temp-file cleanup: pending
