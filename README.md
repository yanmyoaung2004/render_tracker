# 🧠 React Render Insight DevTools

> Stop guessing why your React components re-render. See it instantly.

---

## 🚨 The Problem

Debugging unnecessary re-renders in React is painful.

Existing tools like React DevTools show component trees — but they **don’t explain why a component re-rendered**.

Developers are left:

- guessing which prop changed
- digging through logs
- wasting time optimizing blindly

---

## 💡 The Solution

**React Render Insight DevTools** is a Chrome DevTools extension that:

- Tracks component render cycles in real-time
- Detects **exact prop changes causing re-renders**
- Shows clear, actionable explanations

No configuration. No setup. Just open DevTools and see the truth.

---

## ⚡ Core Feature (MVP)

### 🔍 “Why did this component re-render?”

For every render:

```
<UserCard />

Re-rendered because:
- prop "user.name" changed
- prop "onClick" reference changed
```

That’s it.

Not noise. Not theory. **Direct cause.**

---

## 🏗️ Architecture

This is not just a Chrome extension.

It is a **React runtime instrumentation system**.

### 1. Injection Layer

- Injects script via Chrome extension content script
- Hooks into React internals through:

```js
window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
```

- Listens to Fiber commit lifecycle

---

### 2. Tracking Engine

Tracks render data per component:

```ts
type RenderRecord = {
  componentName: string;
  renderCount: number;
  prevProps: any;
  nextProps: any;
  changedProps: string[];
  timestamp: number;
};
```

---

### 3. Diff Engine (MVP)

Shallow prop comparison:

```ts
Object.keys(nextProps).filter((key) => prevProps[key] !== nextProps[key]);
```

Fast. Practical. Enough signal.

---

### 4. DevTools Panel UI

Custom Chrome DevTools panel:

- Component list
- Render counts
- Changed props
- Real-time updates

---

## 🚀 Features

### ✅ Current (MVP)

- Render tracking
- Component identification
- Shallow prop diffing
- Real-time DevTools panel

---

### 🔜 Planned

- 🔴 Render heatmap (hot components)
- 📊 Sorting & filtering
- 🧠 “Why did this render?” deep insights
- ⚡ Render timeline visualization
- 📁 Export performance reports

---

## ⚔️ Comparison

| Feature                 | React DevTools | why-did-you-render | This Tool |
| ----------------------- | -------------- | ------------------ | --------- |
| Render count            | ❌             | ✅                 | ✅        |
| Prop diff               | ❌             | ✅                 | ✅        |
| Real-time UI            | ⚠️ Limited     | ❌ Console-based   | ✅        |
| Zero config             | ✅             | ❌                 | ✅        |
| Clear cause explanation | ❌             | ⚠️ Noisy           | ✅        |

---

## 🧪 How It Works (Deep Dive)

1. Access React Fiber tree via global hook
2. Intercept commit phase
3. Extract component + props
4. Compare previous vs next props
5. Store and stream results to DevTools panel

---

## 🛠️ Installation

```bash
git clone https://github.com/your-username/react-render-insight-devtools
cd react-render-insight-devtools
```

### Load Extension

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable **Developer Mode**
4. Click **Load unpacked**
5. Select the project folder

---

## 🧑‍💻 Usage

1. Open any React application
2. Open Chrome DevTools
3. Navigate to **Render Insight** panel
4. Interact with your app
5. Watch render causes in real-time

---

## ⚠️ Limitations (Be Honest)

- Uses shallow comparison (deep changes not detected yet)
- Depends on React internal APIs (may break across versions)
- Slight overhead in large apps (optimized later)

---

## 🎯 Vision

Move beyond debugging tools that show _what happened_.

Build a system that explains:

> **“Why did it happen?”**

---

## 🧠 Future Direction

- AI-powered render analysis
- Automatic optimization suggestions
- Integration with performance profiling pipelines
- CI-based render regression detection

---

## 🤝 Contributing

This is a low-level system touching React internals.

If you contribute:

- Understand Fiber basics
- Avoid breaking runtime behavior
- Prioritize accuracy over features

---

## 📜 License

MIT
