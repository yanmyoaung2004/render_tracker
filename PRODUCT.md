# Product

## Register

product

## Users

React developers debugging component re-renders in production-like environments. They are experienced engineers who need fast, accurate answers — not noise. They open DevTools with a specific question ("why did this update?") and need an answer in seconds, not a dashboard to interpret.

## Product Purpose

Eliminate guesswork from React render debugging. The extension hooks into React's Fiber tree at runtime — zero config, no code changes — and surfaces the exact cause of every re-render: which prop changed, which context updated, which state trigger fired, and the full cause chain from root to leaf. It answers "why did this component re-render?" in real-time, inside DevTools, with actionable optimization suggestions.

## Brand Personality

Direct, honest, expert-confidence. Not friendly, not playful — precise. The tone is "here's what happened, here's why, here's what to do about it." No filler, no noise. Trust the data.

## Anti-references

- React DevTools' built-in profiler: shows *that* something renders, not *why*. Too much information, not enough signal.
- `why-did-you-render`: noisy console spew, requires code changes, no visual panel.
- Over-designed SaaS dashboards with gradient text, glassmorphism, and decorative stats. This is a DevTools panel — it should feel native to Chrome DevTools, not like a marketing site.

## Design Principles

- **Answers first, data second.** Every screen should immediately answer the question "why did this re-render?" Raw data (counts, timelines) supports the answer, but the answer is primary.
- **Native feel, not web app.** The panel sits inside Chrome DevTools. It should look and behave like a DevTools native panel — compact, dense, keyboard-navigable, no wasteful chrome.
- **Respect the developer's attention.** No animations that delay information. No decorative elements. Every pixel should carry signal.
- **Progressive disclosure.** Show the summary always; reveal cause chains, prop diffs, and history on demand. Don't overwhelm.

## Accessibility & Inclusion

- WCAG AA minimum (4.5:1 body text contrast, 3:1 large text).
- Full keyboard navigation — tab stops, focus indicators, no mouse-only interactions.
- `prefers-reduced-motion` respected: no auto-play animations, instant transitions.
- Dark-first theme (Chrome DevTools is dark by default), light theme as companion.
