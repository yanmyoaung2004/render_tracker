// ── Rule categories ──────────────────────────────────────────────
var CATEGORIES = {
  memoization: { name: "Memoization", icon: "Shield", order: 0 },
  state: { name: "State & Context", icon: "BrainCircuit", order: 1 },
  lists: { name: "List Rendering", icon: "ListTree", order: 2 },
  architecture: { name: "Component Architecture", icon: "GitBranch", order: 3 },
  performance: { name: "Render Performance", icon: "BarChart3", order: 4 },
  diag: { name: "Profiler Diagnostics", icon: "Activity", order: 5 },
};

// ── Rule definitions ─────────────────────────────────────────────
// Each rule has:
//   id, category, name, severity, condition(data, stats), message(data), suggestion(data), impact(data), confidence, docsRef

var RULES = [
  // ═══════════════════════════════════════════════════════════════
  // CATEGORY: MEMOIZATION
  // ═══════════════════════════════════════════════════════════════

  // R1: Wasted render chain — all parent causes
  {
    id: "wasted-chain",
    category: "memoization",
    name: "Wasted Render Chain",
    severity: "critical",
    condition: function (data) {
      if (!data.causeChain || data.causeChain.length < 2) return false;
      for (var i = 0; i < data.causeChain.length; i++) {
        if (data.causeChain[i].causeType !== "parent") return false;
      }
      return true;
    },
    message: function (data) {
      return data.causeChain.length + "-level chain with zero prop/state changes";
    },
    suggestion: function (data) {
      return "Wrap " + (data.causeChain[0] ? data.causeChain[0].name : data.name) + " in React.memo()";
    },
    impact: function (data) {
      return "Eliminates all " + data.causeChain.length + " wasted renders instantly";
    },
    confidence: 95,
    docsRef: "https://react.dev/reference/react/memo",
  },

  // R2: Partial wasted chain — root cause at bottom, parent propagation upward
  {
    id: "partial-wasted-chain",
    category: "memoization",
    name: "Downstream Wasted Chain",
    severity: "high",
    condition: function (data) {
      if (!data.causeChain || data.causeChain.length < 2) return false;
      var rootIdx = -1;
      for (var i = 0; i < data.causeChain.length; i++) {
        if (data.causeChain[i].causeType !== "parent") { rootIdx = i; break; }
      }
      if (rootIdx === -1 || rootIdx >= data.causeChain.length - 1) return false;
      for (var j = rootIdx + 1; j < data.causeChain.length; j++) {
        if (data.causeChain[j].causeType !== "parent") return false;
      }
      return true;
    },
    message: function (data) {
      var rootIdx = data.rootIndex || 0;
      return (data.causeChain.length - rootIdx - 1) + " components re-rendered from parent propagation below " + (data.causeChain[rootIdx] ? data.causeChain[rootIdx].name : "root");
    },
    suggestion: function (data) {
      var rootIdx = data.rootIndex || 0;
      var target = data.causeChain[rootIdx + 1];
      return target ? "Wrap " + target.name + " in React.memo() to break the cascade" : "Add memo boundaries at intermediate components";
    },
    impact: function (data) {
      var count = data.causeChain.length - (data.rootIndex || 0) - 1;
      return "Would prevent " + count + " unnecessary renders downstream";
    },
    confidence: 85,
    docsRef: "https://react.dev/reference/react/memo",
  },

  // R3: Unstable function props
  {
    id: "unstable-function-prop",
    category: "memoization",
    name: "Unstable Function Props",
    severity: "high",
    condition: function (data) {
      if (!data.propDiff || data.propDiff.length === 0) return false;
      for (var i = 0; i < data.propDiff.length; i++) {
        if (data.propDiff[i].isFunctionRefChange) return true;
      }
      return false;
    },
    message: function (data) {
      var fns = [];
      for (var i = 0; i < data.propDiff.length; i++) {
        if (data.propDiff[i].isFunctionRefChange) fns.push(data.propDiff[i].key);
      }
      return fns.join(", ") + " created inline every render";
    },
    suggestion: function (data) {
      var fns = [];
      for (var i = 0; i < data.propDiff.length; i++) {
        if (data.propDiff[i].isFunctionRefChange) fns.push(data.propDiff[i].key);
      }
      return "Wrap " + fns.join(", ") + " in useCallback()";
    },
    impact: function (data) {
      return "Stable function references enable memoized children to skip renders";
    },
    confidence: 90,
    docsRef: "https://react.dev/reference/react/useCallback",
  },

  // R4: Unstable object/array props
  {
    id: "object-prop-instability",
    category: "memoization",
    name: "Unstable Object Props",
    severity: "medium",
    condition: function (data) {
      if (!data.propDiff || data.propDiff.length === 0) return false;
      for (var i = 0; i < data.propDiff.length; i++) {
        var d = data.propDiff[i];
        if (d.type === "object" && !d.isNew && !d.isRemoved) return true;
      }
      return false;
    },
    message: function (data) {
      var objs = [];
      for (var i = 0; i < data.propDiff.length; i++) {
        var d = data.propDiff[i];
        if (d.type === "object" && !d.isNew && !d.isRemoved) objs.push(d.key);
      }
      return objs.join(", ") + " recreated every render";
    },
    suggestion: function (data) {
      var objs = [];
      for (var i = 0; i < data.propDiff.length; i++) {
        var d = data.propDiff[i];
        if (d.type === "object" && !d.isNew && !d.isRemoved) objs.push(d.key);
      }
      return "Wrap " + objs.join(", ") + " in useMemo()";
    },
    impact: function (data) {
      return "Stable references allow memoized children to compare by reference";
    },
    confidence: 70,
    docsRef: "https://react.dev/reference/react/useMemo",
  },

  // R5: All props changing — spread pattern
  {
    id: "all-props-changing",
    category: "memoization",
    name: "All Props Changing Every Render",
    severity: "high",
    condition: function (data) {
      return data.allPropsChanged === true && (data.totalPropCount || 0) >= 3;
    },
    message: function (data) {
      return (data.changedPropCount || 0) + "/" + (data.totalPropCount || 0) + " props changed — suspect spread { ...props }";
    },
    suggestion: function () {
      return "Avoid spreading props. Pass each prop explicitly to enable memoization";
    },
    impact: function () {
      return "Explicit props prevent unnecessary re-renders and make data flow traceable";
    },
    confidence: 70,
    docsRef: "https://react.dev/learn/passing-props-to-a-component",
  },

  // R5b: Component key changed between renders (remount)
  {
    id: "key-changed-remount",
    category: "memoization",
    name: "Component Key Changed (Remount)",
    severity: "high",
    condition: function (data) {
      return data.keyChanged === true;
    },
    message: function () {
      return "Component key changed since last render — React will unmount and remount";
    },
    suggestion: function () {
      return "Ensure stable keys for list items. Changing keys forces full DOM remount and state loss";
    },
    impact: function () {
      return "Stable keys preserve component state and avoid unnecessary mount cycles";
    },
    confidence: 95,
    docsRef: "https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key",
  },

  // R6: State change detected (flags) with no prop/context change
  {
    id: "state-triggered-render",
    category: "memoization",
    name: "State-Triggered Re-Render",
    severity: "low",
    condition: function (data) {
      if (!data.lastChanges || data.lastChanges.length === 0) return false;
      for (var i = 0; i < data.lastChanges.length; i++) {
        if (data.lastChanges[i].type === "state") return true;
      }
      return false;
    },
    message: function () {
      return "Component re-rendered due to internal state update";
    },
    suggestion: function () {
      return "If this render is unnecessary, batch state updates with useReducer or move state down";
    },
    impact: function () {
      return "Consolidating state changes reduces intermediate renders";
    },
    confidence: 60,
    docsRef: "https://react.dev/learn/state-a-component-memory",
  },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY: STATE & CONTEXT
  // ═══════════════════════════════════════════════════════════════

  // R7: Context explosion — one context update causes many re-renders
  {
    id: "context-explosion",
    category: "state",
    name: "Context Explosion",
    severity: "high",
    condition: function (data) {
      if (!data.causeChain || data.causeChain.length < 4) return false;
      for (var i = 0; i < data.causeChain.length; i++) {
        if (data.causeChain[i].causeType === "context") return true;
      }
      return false;
    },
    message: function (data) {
      var rootName = "";
      for (var i = 0; i < data.causeChain.length; i++) {
        if (data.causeChain[i].causeType === "context") { rootName = data.causeChain[i].name; break; }
      }
      var affected = data.causeChain.length - 1;
      return "Context in " + rootName + " caused " + affected + " downstream re-renders";
    },
    suggestion: function () {
      return "Split context into smaller providers or use useMemo/selector pattern";
    },
    impact: function (data) {
      return "Would prevent " + (data.causeChain.length - 1) + " components from re-rendering";
    },
    confidence: 85,
    docsRef: "https://react.dev/reference/react/useContext",
  },

  // R8: Wide blast radius — state high up affecting many children
  {
    id: "wide-blast-radius",
    category: "state",
    name: "Wide Blast Radius",
    severity: "high",
    condition: function (data) {
      if (!data.total) return false;
      return data.total > 10 && data.exclusive > 0 && data.exclusive < data.total * 0.3;
    },
    message: function (data) {
      var childCount = data.total - data.exclusive;
      return "State change in " + data.name + " re-rendered " + childCount + " descendant components";
    },
    suggestion: function () {
      return "Push state down to the smallest subtree that needs it";
    },
    impact: function (data) {
      return "Would contain re-renders to " + data.exclusive + " instead of " + data.total;
    },
    confidence: 75,
    docsRef: "https://react.dev/learn/sharing-state-between-components",
  },

  // R9: Component re-renders but exclusive count is 0 (state change with no visible effect)
  {
    id: "zero-exclusive-impact",
    category: "state",
    name: "Re-Render With No Exclusive Work",
    severity: "low",
    condition: function (data) {
      return data.exclusive === 0 && data.total > 0;
    },
    message: function () {
      return "Component re-rendered but no exclusive work was done";
    },
    suggestion: function () {
      return "If this component wraps children, consider if it needs to re-render at all. Could use React.memo()";
    },
    impact: function () {
      return "Removing unnecessary wrappers reduces the render tree";
    },
    confidence: 50,
    docsRef: "https://react.dev/reference/react/memo",
  },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY: COMPONENT ARCHITECTURE
  // ═══════════════════════════════════════════════════════════════

  // R10: Prop drilling — props pass through many levels
  {
    id: "prop-cascade",
    category: "architecture",
    name: "Deep Prop Drilling",
    severity: "high",
    condition: function (data) {
      if (!data.causeChain || data.causeChain.length < 3) return false;
      if (!data.rootCause || data.rootCause.causeType !== "props") return false;
      return data.causeChain.length - (data.rootIndex || 0) > 2;
    },
    message: function (data) {
      var depth = data.causeChain.length - (data.rootIndex || 0);
      return "Props drill through " + depth + " component levels from " + (data.rootCause ? data.rootCause.name : "root");
    },
    suggestion: function () {
      return "Use Context or component composition to avoid passing props through intermediate components";
    },
    impact: function () {
      return "Reduces coupling and limits re-render blast radius";
    },
    confidence: 80,
    docsRef: "https://react.dev/learn/passing-props-to-a-component",
  },

  // R11: Deep propagation chain
  {
    id: "deep-propagation",
    category: "architecture",
    name: "Deep Render Propagation",
    severity: "medium",
    condition: function (data) {
      if (!data.causeChain || data.causeChain.length < 5) return false;
      return true;
    },
    message: function (data) {
      return data.causeChain.length + "-level deep render propagation chain";
    },
    suggestion: function () {
      return "Add memo boundaries (React.memo) at 2-3 levels deep to break the cascade";
    },
    impact: function (data) {
      return "Could reduce " + (data.causeChain.length - 2) + " levels from the propagation";
    },
    confidence: 75,
    docsRef: "https://react.dev/reference/react/memo",
  },

  // R12: High render count component
  {
    id: "high-render-count",
    category: "performance",
    name: "High Frequency Re-Render",
    severity: "medium",
    condition: function (data, stats) {
      if (!stats) return false;
      return stats.renders > 20;
    },
    message: function (data, stats) {
      return "Rendered " + stats.renders + " times";
    },
    suggestion: function () {
      return "Investigate why this component renders so frequently. Consider shouldComponentUpdate or React.memo";
    },
    impact: function () {
      return "Reducing render frequency improves jank and frame drops";
    },
    confidence: 60,
    docsRef: "https://react.dev/reference/react/memo",
  },

  // R13: High exclusive count component
  {
    id: "high-exclusive-count",
    category: "performance",
    name: "High Exclusive Render Cost",
    severity: "medium",
    condition: function (data, stats) {
      if (!stats) return false;
      return stats.exclusive > 50;
    },
    message: function (data, stats) {
      return "Exclusive renders: " + stats.exclusive + " (excludes children)";
    },
    suggestion: function () {
      return "This component is re-rendering on its own. Check internal state updates that may be unnecessary";
    },
    impact: function () {
      return "Reducing internal re-renders improves parent component stability";
    },
    confidence: 55,
    docsRef: "",
  },

  // R14: Large subtree render
  {
    id: "large-subtree",
    category: "performance",
    name: "Large Subtree Re-Rendered",
    severity: "medium",
    condition: function (data) {
      return data.total > 20;
    },
    message: function (data) {
      return "Commit re-rendered " + data.total + " components (including descendants)";
    },
    suggestion: function () {
      return "Apply React.memo at subtree boundaries to isolate render regions";
    },
    impact: function (data) {
      return "Could reduce render count from " + data.total + " to only the components that actually changed";
    },
    confidence: 70,
    docsRef: "https://react.dev/reference/react/memo",
  },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY: LIST RENDERING
  // ═══════════════════════════════════════════════════════════════

  // R15: Same props every render but still rendering (suspected missing key issue)
  {
    id: "suspected-missing-key",
    category: "lists",
    name: "Suspected Missing Key",
    severity: "high",
    condition: function (data) {
      if (!data.propDiff || data.propDiff.length === 0) return false;
      if (!data.causeChain || data.causeChain.length === 0) return false;
      var hasIdentityChange = false;
      for (var i = 0; i < data.propDiff.length; i++) {
        if (data.propDiff[i].isNew || data.propDiff[i].key === "key" || data.propDiff[i].key === "children") {
          hasIdentityChange = true;
          break;
        }
      }
      return hasIdentityChange && data.causeChain[0].causeType === "parent";
    },
    message: function () {
      return "Component identity appears to change — children may be remounting";
    },
    suggestion: function () {
      return "Ensure list items have a stable, unique key prop. Never use array index as key for dynamic lists";
    },
    impact: function () {
      return "Stable keys prevent unnecessary DOM remounting and state loss";
    },
    confidence: 40,
    docsRef: "https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key",
  },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY: PROFILER DIAGNOSTICS
  // ═══════════════════════════════════════════════════════════════

  // R16: High render to exclusive ratio (re-renders but doesn't do much)
  {
    id: "render-without-work",
    category: "diag",
    name: "Re-Renders Without Visible Work",
    severity: "medium",
    condition: function (data, stats) {
      if (!stats || stats.renders < 5) return false;
      var ratio = stats.exclusive / Math.max(stats.renders, 1);
      return ratio < 1 && data.causeChain && data.causeChain.length > 0;
    },
    message: function (data, stats) {
      return String(stats.renders) + " renders but only " + stats.exclusive + " exclusive work done";
    },
    suggestion: function () {
      return "Component re-renders without significant work — likely a pass-through. Consider React.memo()";
    },
    impact: function () {
      return "Eliminating pass-through renders reduces total React work per commit";
    },
    confidence: 65,
    docsRef: "",
  },
];

// ── Evaluate rules against component data ────────────────────────
// Returns array of matched rules with computed display fields
export function evaluateRules(updateData, statsData) {
  var matched = [];
  for (var r = 0; r < RULES.length; r++) {
    var rule = RULES[r];
    try {
      if (rule.condition(updateData, statsData)) {
        matched.push({
          id: rule.id,
          category: rule.category,
          categoryName: CATEGORIES[rule.category] ? CATEGORIES[rule.category].name : rule.category,
          name: rule.name,
          severity: rule.severity,
          message: rule.message(updateData, statsData),
          suggestion: rule.suggestion(updateData, statsData),
          impact: rule.impact(updateData, statsData),
          confidence: rule.confidence,
          docsRef: rule.docsRef,
        });
      }
    } catch (e) {
      // Rule evaluation should never crash the app
    }
  }
  return matched;
}

// ── Get all patterns from in-app data (replaces generateInsights) ─
export function evaluateAllComponents(components, globalStats) {
  var allRules = [];
  var entries = Object.entries(components);
  for (var i = 0; i < entries.length; i++) {
    var name = entries[i][0];
    var stats = entries[i][1];
    var rules = evaluateRules(stats, stats);
    for (var j = 0; j < rules.length; j++) {
      rules[j].component = name;
    }
    allRules = allRules.concat(rules);
  }

  // Deduplicate by rule id + component
  var seen = {};
  var unique = [];
  for (var k = 0; k < allRules.length; k++) {
    var key = allRules[k].id + "-" + allRules[k].component;
    if (seen[key]) continue;
    seen[key] = true;
    unique.push(allRules[k]);
  }

  // Sort by severity
  var severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  unique.sort(function (a, b) {
    return (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
  });

  return unique.slice(0, 20);
}

// ── Update live feed to include rule info ────────────────────────
export function convertUpdatesToLiveFeed(updates) {
  return (updates || []).map(function (u) {
    var rules = evaluateRules(u, null);
    return {
      name: u.name,
      exclusive: u.exclusive,
      total: u.total,
      score: u.score,
      timestamp: u.timestamp,
      commitId: u.commitId,
      rules: rules,
      topRule: rules.length > 0 ? rules[0] : null,
    };
  });
}

export { CATEGORIES, RULES };
