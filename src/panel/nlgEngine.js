// ── NLG Engine: generates human-readable explanations from rule data ─
// No API calls. Template-based natural language generation.

function fmt(name) { return name || "this component"; }

function chainParents(chain) {
  if (!chain) return [];
  return chain.filter(function (l) { return l.causeType === "parent"; });
}

// ── Template builders per rule ──────────────────────────────────
var generators = {
  // R1: Full wasted chain
  "wasted-chain": function (data) {
    var name = fmt(data.name);
    var chainLen = data.causeChain ? data.causeChain.length : 0;
    var rootName = data.causeChain && data.causeChain[0] ? data.causeChain[0].name : name;
    return name + " re-rendered, but none of its props or state changed. The render was caused by " + rootName + " re-rendering higher up the tree. This " + chainLen + "-component chain did zero visible work. Fix: Wrap " + rootName + " in React.memo() — this stops the cascade at the source.";
  },

  // R2: Partial wasted chain
  "partial-wasted-chain": function (data) {
    var name = fmt(data.name);
    var rootIdx = data.rootIndex || 0;
    var rootName = data.causeChain && data.causeChain[rootIdx] ? data.causeChain[rootIdx].name : "a parent";
    var wasteCount = data.causeChain ? data.causeChain.length - rootIdx - 1 : 0;
    return name + " re-rendered because " + rootName + " had a real change (props/state/context). But that change propagated through " + wasteCount + " intermediate components that didn't need to re-render. Fix: Add React.memo() at " + fmt(data.causeChain && data.causeChain[rootIdx + 1] ? data.causeChain[rootIdx + 1].name : null) + " to isolate the real change from the cascade.";
  },

  // R3: Unstable function props
  "unstable-function-prop": function (data) {
    var name = fmt(data.name);
    var fns = [];
    if (data.propDiff) {
      for (var i = 0; i < data.propDiff.length; i++) {
        if (data.propDiff[i].isFunctionRefChange) fns.push(data.propDiff[i].key);
      }
    }
    var fnList = fns.join(", ");
    if (fnList.length === 0) return name + " has unstable function props. Wrap each in useCallback().";
    return name + " re-rendered because " + fnList + " changed. These props are functions created inline during the parent's render. Every render produces a new function reference, so any child wrapped in React.memo() sees a 'different' prop and re-renders. Fix: Wrap " + fnList + " in useCallback() inside the parent component.";
  },

  // R4: Unstable object props
  "object-prop-instability": function (data) {
    var name = fmt(data.name);
    var objs = [];
    if (data.propDiff) {
      for (var i = 0; i < data.propDiff.length; i++) {
        var d = data.propDiff[i];
        if ((d.type === "object" || d.isArrayChange) && !d.isNew && !d.isRemoved) objs.push(d.key);
      }
    }
    var objList = objs.join(", ");
    if (objList.length === 0) return name + " receives new object/array props every render. Wrap in useMemo().";
    return name + " re-renders because " + objList + " are recreated on every parent render. Even if the values haven't changed, the object reference is new, so React.memo() can't prevent the re-render. Fix: Wrap " + objList + " in useMemo() where they're defined.";
  },

  // R5: All props changing
  "all-props-changing": function (data) {
    var name = fmt(data.name);
    var total = data.totalPropCount || 0;
    var changed = data.changedPropCount || 0;
    if (total === 0) return name + " has all " + changed + " props changing every render.";
    return name + " has " + changed + "/" + total + " props changing — every single prop gets a new value. This usually means the parent uses the spread pattern: <" + name + " {...props} />. Spreading means every render creates entirely new props, so memoization can't work. Fix: Pass individual props explicitly, especially stable ones like className and style.";
  },

  // R6: Key changed
  "key-changed-remount": function (data) {
    var name = fmt(data.name);
    return name + "'s key changed since the last render. When a key changes, React unmounts the old component instance and mounts a brand new one, losing all internal state. This is expected behavior for reordered list items, but if the key changes on every render, your component is being destroyed and recreated each time. Fix: Use a stable, unique identifier as the key — never use Math.random() or the array index for dynamic lists.";
  },

  // R7: Context explosion
  "context-explosion": function (data) {
    var name = fmt(data.name);
    var chain = data.causeChain || [];
    var ctxName = "";
    for (var i = 0; i < chain.length; i++) {
      if (chain[i].causeType === "context") { ctxName = chain[i].name; break; }
    }
    var affected = chain.length - 1;
    if (!ctxName) return name + " re-rendered due to a context update that affected " + affected + " components.";
    return "A context update in " + ctxName + " triggered re-renders in " + affected + " components downstream. React Context doesn't have a built-in selector — every consumer re-renders when the context value changes, even if they only use part of it. Fix: Split " + ctxName + " into multiple smaller contexts, or use useMemo() to limit which values trigger re-renders.";
  },

  // R8: Wide blast radius
  "wide-blast-radius": function (data) {
    var name = fmt(data.name);
    var total = data.total || 0;
    var exclusive = data.exclusive || 0;
    var children = total - exclusive;
    return "A state change in " + name + " re-rendered " + total + " total components — but only " + exclusive + " of them are " + name + "'s own work. The other " + children + " are descendants that likely didn't need to re-render. Fix: Push this state down to the smallest component that actually needs it. If " + name + " doesn't use the state directly, move the state variable into a child component.";
  },

  // R10: Prop drilling
  "prop-cascade": function (data) {
    var name = fmt(data.name);
    var chain = data.causeChain || [];
    var rootIdx = data.rootIndex || 0;
    var rootName = chain[rootIdx] ? chain[rootIdx].name : "a parent";
    var depth = chain.length - rootIdx;
    return "Props changed in " + rootName + " and drilled through " + depth + " component levels to reach " + name + ". Intermediate components re-render even though they don't use these props directly. Each level adds coupling — a prop rename requires changes in every intermediate component. Fix: Use React Context or component composition (render props / children) to skip intermediate levels.";
  },

  // R11: Deep propagation
  "deep-propagation": function (data) {
    var name = fmt(data.name);
    var chainLen = data.causeChain ? data.causeChain.length : 0;
    return name + " sits at the end of a " + chainLen + "-component deep render chain. If any component near the top re-renders, " + name + " and everything in between re-renders too. Fix: Add React.memo() at 2-3 intermediate levels (choose the components that change least often). Each memo boundary acts as a circuit breaker.";
  },

  // R12: High render count
  "high-render-count": function (data, stats) {
    var name = fmt(stats && stats.name ? stats.name : (data && data.name));
    var count = stats && stats.renders ? stats.renders : 0;
    return name + " has rendered " + count + " times this session — unusually high compared to other components. If this component is a stable part of the UI (like a sidebar or header), it should render far fewer times. Fix: Check what's driving the renders. Is it a parent state change? Internal state updates? If the parent is the cause, add React.memo(). If internal state, consolidate updates with useReducer.";
  },

  // R14: Large subtree
  "large-subtree": function (data) {
    var name = fmt(data.name);
    var total = data.total || 0;
    return "A render in " + name + " re-rendered " + total + " components including descendants. This is a large subtree — if it happens frequently, your app will feel slow. Fix: Apply React.memo() at the boundaries of this subtree. The goal is to reduce " + total + " to only the components that actually changed.";
  },

  // R16: Render without work
  "render-without-work": function (data, stats) {
    var name = fmt(stats && stats.name ? stats.name : (data && data.name));
    var renders = stats && stats.renders ? stats.renders : 0;
    var exclusive = stats && stats.exclusive ? stats.exclusive : 0;
    return name + " rendered " + renders + " times but did only " + exclusive + " units of exclusive work — almost everything was just passing through. This is a sign of a 'pass-through' component that re-renders because its parent does, without doing anything visible itself. Fix: React.memo() is ideal here. If the component is just a wrapper, consider inlining it or converting to a layout component.";
  },
};

// ── Generate explanation for a rule match ──────────────────────────
export function generateExplanation(rule, componentData, statsData) {
  var fn = generators[rule.id];
  if (!fn) return null;
  try {
    return fn(componentData || {}, statsData || componentData || {});
  } catch (e) {
    return null;
  }
}

// ── Get quick tip (one-line version for compact display) ──────────
var oneLiners = {
  "wasted-chain": "Whole chain re-rendered with zero prop changes — add React.memo at root",
  "partial-wasted-chain": "Real change at root but intermediate components wasted — break with memo",
  "unstable-function-prop": "Inline functions breaking memoization — use useCallback",
  "object-prop-instability": "New object/array references every render — use useMemo",
  "all-props-changing": "Spread pattern { ...props } disabling memoization — be explicit",
  "key-changed-remount": "Key change causes remount — use stable keys",
  "context-explosion": "Context update propagating too far — split context",
  "wide-blast-radius": "State too high, too many children affected — push state down",
  "prop-cascade": "Props drilling through too many levels — use context or composition",
  "deep-propagation": "Long render chain — add memo boundaries mid-chain",
  "high-render-count": "Rendering unusually often — investigate cause",
  "large-subtree": "Large tree re-rendering — add memo at boundaries",
  "render-without-work": "Pass-through component doing no visible work — memo or inline",
};

export function getQuickTip(ruleId) {
  return oneLiners[ruleId] || null;
}
