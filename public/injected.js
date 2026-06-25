(function () {
  // ── Configuration ────────────────────────────────────────────────
  var REACT_FLAG_UPDATE = 4;
  var MAX_TIMELINE_ENTRIES = 80;
  var MAX_PAYLOAD_CHARS = 4000000;
  var HOOK_MAX_ATTEMPTS = 200;
  var HOOK_POLL_MS = 50;
  var TIMELINE_SEND_COUNT = 50;
  var OVERFLOW_TRIM_TIMELINE = 25;
  var OVERFLOW_TRIM_UPDATES = 120;
  var STATS_MAX_ENTRIES = 200;
  var PROP_DIFF_DEPTH = 2;
  var PROP_DIFF_ARRAY_LIMIT = 3;
  var PROP_DIFF_OBJ_LIMIT = 3;
  var PROP_STRING_LIMIT = 50;

  // ── State ────────────────────────────────────────────────────────
  var fiberRenderStore = new WeakMap();
  var globalStats = new Map();
  var currentCommitUpdates = [];
  var renderTimeline = [];
  var commitMap = new WeakMap();
  var commitCounter = 0;

  // ── Fiber introspection ──────────────────────────────────────────
  function getComponentName(fiber) {
    var type = fiber.type;
    if (typeof type === "string") return null;
    var name = type && (type.name || type.displayName);
    if (!name && fiber.elementType) {
      name = fiber.elementType.displayName || fiber.elementType.name;
    }
    if (!name && type && type.render) {
      name = type.render.displayName || type.render.name;
    }
    return name || null;
  }

  var INTERNAL_TAGS = [3, 7, 9, 10, 11, 13, 19, 22];
  var LIBRARY_PATTERNS = ["node_modules", "webpack", "vite", ".next", ".vercel"];

  function isLibraryFile(fileName) {
    if (!fileName) return false;
    for (var i = 0; i < LIBRARY_PATTERNS.length; i++) {
      if (fileName.indexOf(LIBRARY_PATTERNS[i]) !== -1) return true;
    }
    return false;
  }

  function isUserComponent(fiber) {
    if (!fiber || !fiber.type) return false;
    if (typeof fiber.type === "string") return false;
    if (INTERNAL_TAGS.indexOf(fiber.tag) !== -1) return false;

    var source = fiber._debugSource;
    if (source && source.fileName) {
      return !isLibraryFile(source.fileName);
    }

    var name = getComponentName(fiber);
    if (!name) return false;
    var c = name.charCodeAt(0);
    return c >= 65 && c <= 90;
  }

  var TRACKABLE_TAGS = [0, 1, 11, 14, 15];

  function isTrackableRenderFiber(fiber) {
    if (!fiber || !fiber.alternate) return false;
    if (TRACKABLE_TAGS.indexOf(fiber.tag) === -1) return false;
    return isUserComponent(fiber);
  }

  function isSubtreeBoundary(fiber) {
    if (!fiber || !fiber.type || typeof fiber.type === "string" || !fiber.alternate) return false;
    if (!isUserComponent(fiber)) return false;
    var owner = fiber._debugOwner;
    return !!(owner && isUserComponent(owner));
  }

  // ── Prop diff ────────────────────────────────────────────────────
  function serializeValue(val, depth) {
    if (depth === undefined) depth = 0;
    if (depth > PROP_DIFF_DEPTH) return typeof val;
    if (val === undefined) return "undefined";
    if (val === null) return "null";
    if (typeof val === "function") return "fn:" + (val.name || "anonymous");
    if (typeof val === "string") {
      return val.length > PROP_STRING_LIMIT ? val.slice(0, PROP_STRING_LIMIT) + "..." : val;
    }
    if (Array.isArray(val)) {
      if (depth < PROP_DIFF_DEPTH) {
        var items = [];
        for (var i = 0; i < Math.min(val.length, PROP_DIFF_ARRAY_LIMIT); i++) {
          items.push(serializeValue(val[i], depth + 1));
        }
        return "Array(" + val.length + ") [" + items.join(", ") + (val.length > PROP_DIFF_ARRAY_LIMIT ? ", ..." : "") + "]";
      }
      return "Array(" + val.length + ")";
    }
    if (typeof val === "object") {
      var keys = Object.keys(val);
      if (depth < PROP_DIFF_DEPTH) {
        var parts = [];
        for (var i = 0; i < Math.min(keys.length, PROP_DIFF_OBJ_LIMIT); i++) {
          parts.push(keys[i] + ": " + serializeValue(val[keys[i]], depth + 1));
        }
        return "{" + parts.join(", ") + (keys.length > PROP_DIFF_OBJ_LIMIT ? " (+" + (keys.length - PROP_DIFF_OBJ_LIMIT) + ")" : "") + "}";
      }
      return "{" + keys.length + " keys}";
    }
    return String(val);
  }

  function getDetailedPropDiff(prevProps, nextProps) {
    if (!prevProps) prevProps = {};
    if (!nextProps) nextProps = {};
    var changes = [];
    var allKeys = {};
    for (var key in prevProps) allKeys[key] = true;
    for (var key in nextProps) allKeys[key] = true;

    for (var key in allKeys) {
      var prevVal = prevProps[key];
      var nextVal = nextProps[key];
      if (prevVal !== nextVal) {
        var changeType = "value";
        if (typeof nextVal === "function") changeType = "function";
        if (typeof nextVal === "object" && nextVal !== null && !Array.isArray(nextVal)) changeType = "object";

        changes.push({
          key: key,
          type: changeType,
          isNew: !(key in prevProps),
          isRemoved: !(key in nextProps),
          isFunctionRefChange: typeof prevVal === "function" && typeof nextVal === "function" && prevVal !== nextVal,
          isArrayChange: Array.isArray(prevVal) || Array.isArray(nextVal),
          isPrimitive: prevVal === null || nextVal === null || typeof prevVal !== "object" || typeof nextVal !== "object",
          prevValue: serializeValue(prevVal),
          nextValue: serializeValue(nextVal),
        });
      }
    }
    return changes;
  }

  // ── Cause detection ──────────────────────────────────────────────
  function detectContextChange(prevFiber, fiber) {
    try {
      var prevDeps = prevFiber.dependencies;
      var nextDeps = fiber.dependencies;
      if (!prevDeps && !nextDeps) return false;
      if (!prevDeps || !nextDeps) return true;
      if (prevDeps === nextDeps) return false;
      if (prevDeps.items && nextDeps.items && prevDeps.items !== nextDeps.items) return true;
      return prevDeps !== nextDeps;
    } catch (e) {
      return false;
    }
  }

  function classifyCause(changes) {
    if (!changes || changes.length === 0) return "parent";
    for (var i = 0; i < changes.length; i++) {
      if (changes[i].type === "props") return "props";
    }
    for (var i = 0; i < changes.length; i++) {
      if (changes[i].type === "context") return "context";
    }
    for (var i = 0; i < changes.length; i++) {
      if (changes[i].type === "state") return "state";
    }
    return "parent";
  }

  function detectRenderCause(prevFiber, fiber) {
    var prevProps = prevFiber.memoizedProps || {};
    var nextProps = fiber.memoizedProps || {};
    var propDiff = getDetailedPropDiff(prevProps, nextProps);
    var changes = [];

    if (propDiff.length > 0) {
      changes.push({
        type: "props",
        keys: propDiff.map(function (d) { return d.key; }),
        details: propDiff,
      });
    }

    var contextChanged = detectContextChange(prevFiber, fiber);
    if (contextChanged) {
      changes.push({ type: "context" });
    }

    if (propDiff.length === 0 && !contextChanged && typeof fiber.flags === "number" && (fiber.flags & REACT_FLAG_UPDATE) !== 0) {
      changes.push({ type: "state" });
    }

    if (changes.length === 0) {
      changes.push({ type: "parent" });
    }

    return { changes: changes, propDiff: propDiff, causeType: classifyCause(changes) };
  }

  // ── Causal chain ─────────────────────────────────────────────────
  function buildCauseChain(fiber) {
    var chain = [];
    var current = fiber;

    while (current) {
      var name = getComponentName(current);
      if (!name || !isUserComponent(current)) {
        current = current.return;
        continue;
      }
      var data = commitMap.get(current);
      if (data && data.rendered) {
        chain.push({
          name: name,
          causeType: data.causeType || "parent",
          cause: data.cause || { changes: [{ type: "unknown" }] },
          fiberKey: current.key,
        });
      }
      current = current.return;
    }

    chain.reverse();

    var rootIndex = -1;
    for (var i = 0; i < chain.length; i++) {
      if (chain[i].causeType !== "parent") {
        rootIndex = i;
        break;
      }
    }
    if (rootIndex === -1) rootIndex = chain.length - 1;

    return { chain: chain, rootIndex: rootIndex, rootCause: chain[rootIndex] || null };
  }

  // ── Pattern detection ────────────────────────────────────────────
  function detectAdvancedPatterns(fiber, propDiff, causeChainData) {
    var patterns = [];
    var chain = causeChainData.chain;
    var rootIndex = causeChainData.rootIndex;
    var rootCause = causeChainData.rootCause;

    var allParent = true;
    for (var i = 0; i < chain.length; i++) {
      if (chain[i].causeType !== "parent") { allParent = false; break; }
    }
    if (allParent && chain.length > 1) {
      patterns.push({
        type: "wasted-chain", severity: "critical", chainLength: chain.length,
        suggestion: "Memoize " + (chain[0] ? chain[0].name : "root") + " with React.memo()",
        confidence: 95, impact: "Would eliminate 100% of this cascade",
      });
    }

    if (rootCause && rootCause.causeType === "context") {
      var affected = chain.length - 1;
      if (affected > 3) {
        patterns.push({
          type: "context-explosion", severity: "high", affectedComponents: affected, rootComponent: rootCause.name,
          suggestion: "Context in " + rootCause.name + " caused " + affected + " downstream re-renders. Consider splitting context or using selectors",
          confidence: 85, impact: "Could reduce " + affected + " unnecessary re-renders",
        });
      }
    }

    if (rootCause && rootCause.causeType === "props") {
      var propKeys = [];
      var causeChanges = rootCause.cause && rootCause.cause.changes;
      if (causeChanges) {
        for (var i = 0; i < causeChanges.length; i++) {
          if (causeChanges[i].type === "props" && causeChanges[i].keys) {
            propKeys = causeChanges[i].keys;
            break;
          }
        }
      }
      if (chain.length - rootIndex > 3 && propKeys.length > 0) {
        patterns.push({
          type: "prop-cascade", severity: "high", depth: chain.length - rootIndex, props: propKeys,
          suggestion: "Prop drilling: " + propKeys.join(", ") + " through " + (chain.length - rootIndex) + " levels. Consider context or composition",
          confidence: 80, impact: "Reduces coupling and render cascades",
        });
      }
    }

    var unstableFunctions = [];
    for (var i = 0; i < propDiff.length; i++) {
      if (propDiff[i].isFunctionRefChange) unstableFunctions.push(propDiff[i].key);
    }
    if (unstableFunctions.length > 0) {
      patterns.push({
        type: "unstable-function-prop", severity: "high", props: unstableFunctions,
        suggestion: "Wrap " + unstableFunctions.join(", ") + " in useCallback()",
        confidence: 90, impact: "Likely reduces 60-80% of re-renders",
      });
    }

    var objectChanges = [];
    for (var i = 0; i < propDiff.length; i++) {
      if (propDiff[i].type === "object" && !propDiff[i].isNew && !propDiff[i].isRemoved) {
        objectChanges.push(propDiff[i].key);
      }
    }
    if (objectChanges.length > 0) {
      patterns.push({
        type: "object-prop-instability", severity: "medium", props: objectChanges,
        suggestion: "Stabilize objects with useMemo()",
        confidence: 70, impact: "May reduce 40-60% of re-renders",
      });
    }

    if (chain.length > 4) {
      patterns.push({
        type: "deep-propagation", severity: "high", chainLength: chain.length,
        suggestion: "Consider memoizing intermediate components in " + chain.length + "-level chain",
        confidence: 75, impact: "Could break cascade at multiple points",
      });
    }

    return patterns;
  }

  // ── Predictions & scoring ────────────────────────────────────────
  function predictOptimization(fiber, causeChainData, patterns) {
    var predictions = [];
    var chain = causeChainData.chain;
    var rootIndex = causeChainData.rootIndex;

    for (var i = 0; i < patterns.length; i++) {
      if (patterns[i].type === "wasted-chain") {
        predictions.push({
          optimization: "React.memo(" + (getComponentName(fiber) || "Component") + ")",
          expectedReduction: 95, reasoning: "Component has no prop/state changes, pure parent propagation",
          confidence: 95,
        });
        break;
      }
    }
    for (var i = 0; i < patterns.length; i++) {
      if (patterns[i].type === "unstable-function-prop") {
        var impact = chain.length - rootIndex;
        predictions.push({
          optimization: "useCallback() for " + patterns[i].props.join(", "),
          expectedReduction: Math.min(70 + impact * 5, 95),
          reasoning: "Stabilizing function props would prevent " + impact + "-level cascade",
          confidence: 85,
        });
        break;
      }
    }
    for (var i = 0; i < patterns.length; i++) {
      if (patterns[i].type === "context-explosion") {
        predictions.push({
          optimization: "Split context or use selectors",
          expectedReduction: Math.min(60 + patterns[i].affectedComponents * 3, 90),
          reasoning: patterns[i].affectedComponents + " components re-render from single context",
          confidence: 75,
        });
        break;
      }
    }
    return predictions;
  }

  function calculateRenderScore(renders, exclusive, patterns) {
    var score = renders * exclusive;
    for (var i = 0; i < patterns.length; i++) {
      if (patterns[i].severity === "critical") score += 50;
      if (patterns[i].severity === "high") score += 20;
    }
    return score;
  }

  function getScoreLabel(score) {
    if (score > 500) return { emoji: "\uD83D\uDD25\uD83D\uDD25\uD83D\uDD25", label: "Critical" };
    if (score > 200) return { emoji: "\uD83D\uDD25\uD83D\uDD25", label: "High" };
    if (score > 50) return { emoji: "\uD83D\uDD25", label: "Medium" };
    return { emoji: "\u26AA", label: "Low" };
  }

  // ── Render counting ──────────────────────────────────────────────
  function countSubtreeRenders(rootFiber) {
    var count = 0;
    var stack = [rootFiber];
    while (stack.length > 0) {
      var fiber = stack.pop();
      if (!fiber) continue;
      if (isTrackableRenderFiber(fiber)) count++;
      var child = fiber.child;
      while (child) { stack.push(child); child = child.sibling; }
    }
    return count;
  }

  function findChildRoots(rootFiber) {
    var roots = [];
    var stack = [rootFiber];
    while (stack.length > 0) {
      var fiber = stack.pop();
      if (!fiber) continue;
      if (fiber !== rootFiber && isSubtreeBoundary(fiber)) {
        roots.push(fiber);
        continue;
      }
      var child = fiber.child;
      while (child) { stack.push(child); child = child.sibling; }
    }
    return roots;
  }

  function countExclusiveRenders(rootFiber) {
    var total = countSubtreeRenders(rootFiber);
    var childRoots = findChildRoots(rootFiber);
    var childTotal = 0;
    for (var i = 0; i < childRoots.length; i++) {
      childTotal += countSubtreeRenders(childRoots[i]);
    }
    return total - childTotal;
  }

  // ── Track single fiber ───────────────────────────────────────────
  function trackRootFiber(fiber) {
    var name = getComponentName(fiber);
    if (!name || !fiber.alternate) return null;

    var prevFiber = fiber.alternate;
    var causeResult = detectRenderCause(prevFiber, fiber);
    var causeChainData = buildCauseChain(fiber);

    commitMap.set(fiber, {
      rendered: true,
      cause: { changes: causeResult.changes, propDiff: causeResult.propDiff },
      causeType: causeResult.causeType,
    });

    var record = fiberRenderStore.get(fiber);
    if (!record) { record = { count: 0 }; fiberRenderStore.set(fiber, record); }
    record.count++;

    var total = countSubtreeRenders(fiber);
    var exclusive = countExclusiveRenders(fiber);
    var patterns = detectAdvancedPatterns(fiber, causeResult.propDiff, causeChainData);

    var stat = globalStats.get(name);
    if (!stat) {
      stat = { renders: 0, total: 0, exclusive: 0, score: 0, patterns: [] };
      globalStats.set(name, stat);
    }
    stat.renders++;
    stat.total += total;
    stat.exclusive += exclusive;
    stat.score = calculateRenderScore(stat.renders, stat.exclusive, patterns);

    for (var i = 0; i < patterns.length; i++) {
      var exists = false;
      for (var j = 0; j < stat.patterns.length; j++) {
        if (stat.patterns[j].type === patterns[i].type) { exists = true; break; }
      }
      if (!exists) stat.patterns.push(patterns[i]);
    }

    var score = calculateRenderScore(record.count, exclusive, patterns);

    var prevKey = fiber.alternate ? fiber.alternate.key : null;
    var currentKey = fiber.key;
    var startTime = performance.now();
    var changedPropCount = causeResult.propDiff ? causeResult.propDiff.length : 0;
    var totalPropCount = 0;
    if (fiber.memoizedProps) { var k = 0; for (var _ in fiber.memoizedProps) { k++; } totalPropCount = k; }
    var renderDuration = performance.now() - startTime;

    return {
      name: name,
      count: record.count,
      total: total,
      exclusive: exclusive,
      changes: causeResult.changes,
      propDiff: causeResult.propDiff,
      patterns: patterns,
      causeChain: causeChainData.chain,
      rootIndex: causeChainData.rootIndex,
      rootCause: causeChainData.rootCause,
      predictions: predictOptimization(fiber, causeChainData, patterns),
      timestamp: Date.now(),
      score: score,
      scoreLabel: getScoreLabel(score),
      commitId: commitCounter,
      keyChanged: prevKey !== currentKey,
      changedPropCount: changedPropCount,
      totalPropCount: totalPropCount,
      changeRatio: totalPropCount > 0 ? changedPropCount / totalPropCount : 0,
      allPropsChanged: totalPropCount > 0 && changedPropCount === totalPropCount,
      renderDurationMs: Math.round(renderDuration * 100) / 100,
    };
  }

  // ── Fiber walks ──────────────────────────────────────────────────
  function collectUpdates(rootFiber) {
    var updates = [];
    var stack = [rootFiber];
    while (stack.length > 0) {
      var fiber = stack.pop();
      if (!fiber) continue;
      if (isTrackableRenderFiber(fiber)) {
        var update = trackRootFiber(fiber);
        if (update) updates.push(update);
      }
      var child = fiber.child;
      while (child) { stack.push(child); child = child.sibling; }
    }
    return updates;
  }

  function buildComponentTree(rootFiber) {
    var tree = null;
    var stack = [{ fiber: rootFiber, parentNode: null }];
    while (stack.length > 0) {
      var item = stack.pop();
      if (!item || !item.fiber) continue;

      var name = getComponentName(item.fiber);
      var isUser = isUserComponent(item.fiber);

      if (name && isUser) {
        var data = commitMap.get(item.fiber);
        var node = {
          name: name,
          depth: 0,
          children: [],
          key: item.fiber.key || name,
          didRender: !!(data && data.rendered),
          causeType: data ? data.causeType : "unknown",
          renderCount: 0,
          score: 0,
          scoreLabel: { emoji: "\u26AA", label: "Low" },
        };
        var stat = globalStats.get(name);
        if (stat) {
          node.renderCount = stat.renders;
          node.score = stat.score;
          node.scoreLabel = getScoreLabel(stat.score);
        }
        if (item.parentNode) {
          item.parentNode.children.push(node);
        } else {
          tree = node;
        }
        var children = [];
        var child = item.fiber.child;
        while (child) { children.push(child); child = child.sibling; }
        for (var i = children.length - 1; i >= 0; i--) {
          stack.push({ fiber: children[i], parentNode: node });
        }
      } else {
        var child = item.fiber.child;
        var batch = [];
        while (child) { batch.push(child); child = child.sibling; }
        for (var i = batch.length - 1; i >= 0; i--) {
          stack.push({ fiber: batch[i], parentNode: item.parentNode });
        }
      }
    }
    return tree;
  }

  // ── Timeline ─────────────────────────────────────────────────────
  function compactUpdate(update) {
    return {
      name: update.name,
      total: update.total,
      exclusive: update.exclusive,
      changes: update.changes,
      causeType: update.causeType,
      score: update.score,
      timestamp: update.timestamp,
      commitId: update.commitId,
    };
  }

  function addToTimeline(updates, tree) {
    var compacted = [];
    for (var i = 0; i < updates.length; i++) {
      compacted.push(compactUpdate(updates[i]));
    }
    renderTimeline.push({
      timestamp: Date.now(),
      commitId: commitCounter,
      updates: compacted,
      componentTree: tree,
    });
    while (renderTimeline.length > MAX_TIMELINE_ENTRIES) {
      renderTimeline.shift();
    }
  }

  // ── Payload ──────────────────────────────────────────────────────
  function buildGlobalStatsArray() {
    var arr = [];
    var entries = globalStats.entries();
    var next;
    while ((next = entries.next()) && !next.done) {
      var name = next.value[0];
      var stat = next.value[1];
      arr.push({
        name: name,
        renders: stat.renders,
        total: stat.total,
        exclusive: stat.exclusive,
        score: stat.score,
        patterns: stat.patterns,
        scoreLabel: getScoreLabel(stat.score),
      });
    }
    return arr;
  }

  var detectedVersion = null;

  function detectReactVersion() {
    if (detectedVersion) return detectedVersion;
    try {
      var hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (hook && hook.renderers && hook.renderers.size > 0) {
        var first = hook.renderers.values().next().value;
        detectedVersion = first && first.version ? first.version : "unknown";
        return detectedVersion;
      }
      if (typeof React !== "undefined" && React.version) {
        detectedVersion = React.version;
        return detectedVersion;
      }
    } catch (e) {}
    detectedVersion = "unknown";
    return detectedVersion;
  }

  function buildPayload(tree) {
    return {
      currentCommitUpdates: currentCommitUpdates,
      timeline: renderTimeline.slice(-TIMELINE_SEND_COUNT),
      componentTree: tree,
      globalStats: buildGlobalStatsArray(),
      reactVersion: detectReactVersion(),
    };
  }

  function trimPayload(payload) {
    var size = JSON.stringify(payload).length;
    if (size <= MAX_PAYLOAD_CHARS) return payload;

    console.warn(
      "[Tracker] Payload too large (" + (size / 1024 / 1024).toFixed(1) + "MB). " +
      "Truncating timeline to " + OVERFLOW_TRIM_TIMELINE + " entries and updates to " + OVERFLOW_TRIM_UPDATES + "."
    );

    return {
      currentCommitUpdates: (payload.currentCommitUpdates || []).slice(-OVERFLOW_TRIM_UPDATES),
      timeline: (payload.timeline || []).slice(-OVERFLOW_TRIM_TIMELINE),
      componentTree: payload.componentTree,
      globalStats: (payload.globalStats || []).slice(0, STATS_MAX_ENTRIES),
    };
  }

  function serializePayload(payload) {
    try {
      var json = JSON.stringify(payload);
      if (json.length > MAX_PAYLOAD_CHARS) {
        console.warn("[Tracker] Payload " + json.length + " chars exceeds limit, trimming");
        var trimmed = trimPayload(payload);
        json = JSON.stringify(trimmed);
      }
      return JSON.parse(json);
    } catch (e) {
      console.error("[Tracker] Serialization failed:", e);
      return null;
    }
  }

  // ── Commit processing ────────────────────────────────────────────
  function processCommit(rootFiber) {
    var updates = collectUpdates(rootFiber);
    if (updates.length === 0) return null;

    var tree = buildComponentTree(rootFiber);
    currentCommitUpdates = updates;
    addToTimeline(updates, tree);

    var payload = buildPayload(tree);
    return serializePayload(payload);
  }

  // ── Visual highlights ──────────────────────────────────────────
  var HIGHLIGHT_DURATION = 2000;
  var highlightStyleInjected = false;

  function injectHighlightStyles() {
    if (highlightStyleInjected) return;
    highlightStyleInjected = true;
    var style = document.createElement("style");
    style.textContent = "@keyframes rt-flash { 0% { outline-width: 3px; opacity: 1; } 70% { outline-width: 3px; opacity: 1; } 100% { outline-width: 0; opacity: 0; } }";
    style.id = "rt-highlight";
    document.head.appendChild(style);
  }

  function findFiberDOMNode(fiber) {
    var current = fiber;
    while (current) {
      if (current.stateNode && current.stateNode instanceof HTMLElement) {
        return current.stateNode;
      }
      current = current.child;
    }
    return null;
  }

  function findFibersByName(name, root) {
    var results = [];
    var stack = [root];
    while (stack.length > 0) {
      var fiber = stack.pop();
      if (!fiber) continue;
      var fiberName = getComponentName(fiber);
      if (fiberName === name) results.push(fiber);
      var child = fiber.child;
      while (child) { stack.push(child); child = child.sibling; }
    }
    return results;
  }

  var lastRootFiber = null;

  function handleHighlightMessage(name, severity) {
    if (!lastRootFiber) return;
    var fibers = findFibersByName(name, lastRootFiber);
    if (fibers.length === 0) return;
    injectHighlightStyles();
    var color = severity === "critical" ? "#f87171" : severity === "high" ? "#fbbf24" : "#4ade80";
    for (var i = 0; i < fibers.length; i++) {
      var el = findFiberDOMNode(fibers[i]);
      if (!el) continue;
      el.style.outline = "3px solid " + color;
      el.style.outlineOffset = "-3px";
      el.style.transition = "outline 0.3s, opacity 0.5s";
      setTimeout(function (elem) {
        elem.style.outline = "";
        elem.style.outlineOffset = "";
      }, HIGHLIGHT_DURATION, el);
    }
  }

  // ── Listen for highlight commands ──────────────────────────────
  window.addEventListener("message", function (event) {
    if (event.source !== window) return;
    var data = event.data;
    if (!data || data.source !== "react-render-tracker-bg") return;
    if (data.type === "HIGHLIGHT") {
      handleHighlightMessage(data.componentName, data.severity || "high");
    }
  });

  // ── Hook patching ────────────────────────────────────────────────
  function patchReactHook(hook) {
    if (hook.__RENDER_TRACKER_PATCHED__) return;

    var original = hook.onCommitFiberRoot;
    if (typeof original !== "function") {
      console.warn("[Tracker] onCommitFiberRoot is not a function");
      return;
    }

    hook.onCommitFiberRoot = function (id, root) {
      var result;
      try {
        result = original.apply(this, arguments);
      } catch (e) {
        console.error("[Tracker] React commit hook error:", e);
        throw e;
      }

      commitCounter++;
      currentCommitUpdates = [];
      commitMap = new WeakMap();

      try {
        if (!root || !root.current) return result;
        lastRootFiber = root.current;

        var cloned = processCommit(root.current);
        if (!cloned) return result;

        var origin = window.location.origin;
        window.postMessage(
          { source: "react-render-tracker", payload: cloned, commitId: commitCounter },
          (origin && origin !== "null") ? origin : "*"
        );
      } catch (e) {
        console.error("[Tracker] Collection error:", e);
      }

      return result;
    };

    hook.__RENDER_TRACKER_PATCHED__ = true;
    console.log("%c[Tracker] Render tracker active", "color:#059669;font-weight:bold;");
  }

  // ── Create hook if missing ──────────────────────────────────────
  function ensureHook() {
    var existing = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (existing) return existing;

    var hook = {
      renderers: new Map(),
      supportsFiber: true,
      supportsMutation: true,
      inject: function () {},
      onCommitFiberRoot: function () {},
      onCommitFiberUnmount: function () {},
      getFiberRoots: function () { return new Set(); },
    };
    try {
      Object.defineProperty(window, "__REACT_DEVTOOLS_GLOBAL_HOOK__", { value: hook, configurable: false });
    } catch (e) {
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
    }
    return hook;
  }

  // ── Poll for React hook ──────────────────────────────────────────
  var attempts = 0;
  function waitForHook() {
    var hook = ensureHook();
    if (hook && typeof hook.onCommitFiberRoot === "function") {
      patchReactHook(hook);
    } else if (attempts++ < HOOK_MAX_ATTEMPTS) {
      setTimeout(waitForHook, HOOK_POLL_MS);
    } else {
      console.warn("[Tracker] Failed to setup hook.");
    }
  }

  waitForHook();
})();
