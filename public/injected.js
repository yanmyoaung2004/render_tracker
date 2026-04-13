(function () {
  const fiberRenderStore = new WeakMap();
  const globalStats = new Map();
  let currentCommitUpdates = [];
  let lastPrintTime = 0;
  const renderTimeline = [];
  const commitMap = new WeakMap();
  let commitCounter = 0;

  // =============================
  // COMPONENT NAME
  // =============================
  function getComponentName(fiber) {
    const { type, elementType } = fiber;
    if (typeof type === "string") return null;

    let name =
      type?.displayName ||
      type?.name ||
      elementType?.displayName ||
      elementType?.name;

    if (!name && type?.render) {
      name = type.render.displayName || type.render.name;
    }

    return name || null;
  }

  // =============================
  // USER COMPONENT FILTER
  // =============================
  // function isUserComponent(fiber) {
  //   console.log(fiber);
  //   if (!fiber || !fiber.type) return false;
  //   if (typeof fiber.type === "string") return false;
  //   return true;
  //   //   const source = fiber._debugSource;
  //   //   const fileName = source?.fileName || "";
  //   //   return fileName.includes("src/") || fileName.includes("src\\");
  // }
  function isUserComponent(fiber) {
    if (!fiber || !fiber.type) return false;

    const { type, tag } = fiber;

    // 1. Exclude DOM/native elements (<div>, <span>, etc.)
    if (typeof type === "string") return false;

    // 2. Exclude React internal types (fragments, suspense, etc.)
    const REACT_INTERNAL_TAGS = new Set([
      3, // HostRoot
      7, // Fragment
      9, // ContextConsumer
      10, // ContextProvider
      11, // ForwardRef (optional: include if you want)
      13, // Suspense
      19, // SuspenseList
      22, // Offscreen
    ]);

    if (REACT_INTERNAL_TAGS.has(tag)) return false;

    // 3. Try to get component name
    const name =
      type?.displayName ||
      type?.name ||
      fiber.elementType?.displayName ||
      fiber.elementType?.name;

    if (!name) return false;

    // 4. Filter obvious library / internal noise
    const isLikelyLibrary =
      name.startsWith("Styled") || // styled-components
      name.startsWith("Mui") || // MUI
      name.startsWith("ForwardRef") ||
      name.startsWith("Memo") ||
      name.includes("Provider") ||
      name.includes("Consumer");

    if (isLikelyLibrary) return false;

    // 5. Heuristic: user components are capitalized

    const isCapitalized = name[0] === name[0].toUpperCase();

    return isCapitalized;
  }

  function isTopLevelUserComponent(fiber) {
    if (fiber.type && typeof fiber.type !== "string") {
      if (!isUserComponent(fiber)) return false;
      const owner = fiber._debugOwner;
      return isUserComponent(owner);
    }
    return false;
  }

  // =============================
  // PROP DIFF
  // =============================
  function getDetailedPropDiff(prev = {}, next = {}) {
    const changes = [];
    const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);

    keys.forEach((key) => {
      const prevVal = prev[key];
      const nextVal = next[key];

      if (prevVal !== nextVal) {
        let changeType = "value";
        if (typeof nextVal === "function") changeType = "function";
        if (typeof nextVal === "object" && nextVal !== null)
          changeType = "object";

        const isFunctionRefChange =
          typeof prevVal === "function" &&
          typeof nextVal === "function" &&
          prevVal !== nextVal;

        changes.push({
          key,
          type: changeType,
          isNew: !(key in prev),
          isRemoved: !(key in next),
          isFunctionRefChange,
          prevValue: serializeForDiff(prevVal),
          nextValue: serializeForDiff(nextVal),
        });
      }
    });

    return changes;
  }

  function serializeForDiff(val) {
    if (val === undefined) return "undefined";
    if (val === null) return "null";
    if (typeof val === "function") return `fn:${val.name || "anonymous"}`;
    if (typeof val === "object") {
      if (Array.isArray(val)) return `Array(${val.length})`;
      return `Object{${Object.keys(val).length}}`;
    }
    if (typeof val === "string")
      return val.length > 50 ? val.slice(0, 50) + "..." : val;
    return String(val);
  }

  // =============================
  // CAUSE CLASSIFICATION (ELITE)
  // =============================
  function classifyCause(changes) {
    if (!changes || changes.length === 0) return "parent";

    // Priority: state > context > props > parent
    if (changes.some((c) => c.type === "state")) return "state";
    if (changes.some((c) => c.type === "context")) return "context";
    if (changes.some((c) => c.type === "props")) return "props";
    return "parent";
  }

  // =============================
  // RENDER CAUSE DETECTION
  // =============================
  function detectRenderCause(prevFiber, fiber) {
    const prevProps = prevFiber.memoizedProps;
    const nextProps = fiber.memoizedProps;
    const prevState = prevFiber.memoizedState;
    const nextState = fiber.memoizedState;

    const changes = [];
    const propDiff = getDetailedPropDiff(prevProps, nextProps);

    if (propDiff.length > 0) {
      changes.push({
        type: "props",
        keys: propDiff.map((d) => d.key),
        details: propDiff,
      });
    }

    if (prevState !== nextState) {
      changes.push({ type: "state" });
    }

    if (fiber.dependencies) {
      changes.push({ type: "context" });
    }

    if (changes.length === 0) {
      changes.push({ type: "parent" });
    }

    return { changes, propDiff, causeType: classifyCause(changes) };
  }

  // =============================
  // TRUE ROOT CAUSE CHAIN (ELITE)
  // =============================
  function buildCauseChain(fiber) {
    const chain = [];
    let current = fiber;

    while (current) {
      const name = getComponentName(current);
      if (!name || !isUserComponent(current)) {
        current = current.return;
        continue;
      }

      const data = commitMap.get(current);
      if (data?.rendered) {
        chain.push({
          name,
          causeType: data.causeType || "parent",
          cause: data.cause || { changes: [{ type: "unknown" }] },
          fiberKey: current.key,
        });
      }

      current = current.return;
    }

    chain.reverse(); // Root first

    // 🔥 FIND TRUE ROOT CAUSE
    let rootIndex = chain.findIndex((node) => node.causeType !== "parent");
    if (rootIndex === -1) rootIndex = chain.length - 1;

    return {
      chain,
      rootIndex,
      rootCause: chain[rootIndex],
    };
  }

  // =============================
  // ADVANCED PATTERN DETECTION
  // =============================
  function detectAdvancedPatterns(fiber, propDiff, causeChainData) {
    const patterns = [];
    const { chain, rootIndex, rootCause } = causeChainData;

    // 1. Wasted Chain Detection
    const allParent = chain.every((node) => node.causeType === "parent");
    if (allParent && chain.length > 1) {
      patterns.push({
        type: "wasted-chain",
        severity: "critical",
        chainLength: chain.length,
        suggestion: `Entire ${chain.length}-level chain is wasted re-renders. Memoize ${chain[0]?.name}`,
        confidence: 95,
        impact: "Would eliminate 100% of this cascade",
      });
    }

    // 2. Context Explosion Detection
    if (rootCause?.causeType === "context") {
      const affectedCount = chain.length - 1; // Excluding root
      if (affectedCount > 3) {
        patterns.push({
          type: "context-explosion",
          severity: "high",
          affectedComponents: affectedCount,
          rootComponent: rootCause.name,
          suggestion: `Context in ${rootCause.name} caused ${affectedCount} downstream re-renders. Consider splitting context or using selectors`,
          confidence: 85,
          impact: `Could reduce ${affectedCount} unnecessary re-renders`,
        });
      }
    }

    // 3. Prop Cascade Detection (prop drilling)
    if (rootCause?.causeType === "props") {
      const propKeys =
        rootCause.cause?.changes?.find((c) => c.type === "props")?.keys || [];
      const drillingDepth = chain.length - rootIndex;

      if (drillingDepth > 3 && propKeys.length > 0) {
        patterns.push({
          type: "prop-cascade",
          severity: "high",
          depth: drillingDepth,
          props: propKeys,
          suggestion: `Prop drilling detected: ${propKeys.join(", ")} through ${drillingDepth} levels. Consider context or composition`,
          confidence: 80,
          impact: "Reduces coupling and render cascades",
        });
      }
    }

    // 4. Unstable function props
    const unstableFunctions = propDiff.filter((d) => d.isFunctionRefChange);
    if (unstableFunctions.length > 0) {
      patterns.push({
        type: "unstable-function-prop",
        severity: "high",
        props: unstableFunctions.map((f) => f.key),
        suggestion: `Wrap ${unstableFunctions.map((f) => f.key).join(", ")} in useCallback()`,
        confidence: 90,
        impact: "Likely reduces 60-80% of re-renders",
      });
    }

    // 5. Object prop instability
    const objectChanges = propDiff.filter(
      (d) => d.type === "object" && !d.isNew && !d.isRemoved,
    );
    if (objectChanges.length > 0) {
      patterns.push({
        type: "object-prop-instability",
        severity: "medium",
        props: objectChanges.map((o) => o.key),
        suggestion: `Stabilize objects with useMemo()`,
        confidence: 70,
        impact: "May reduce 40-60% of re-renders",
      });
    }

    // 6. Deep propagation
    if (chain.length > 4) {
      patterns.push({
        type: "deep-propagation",
        severity: "high",
        chainLength: chain.length,
        suggestion: `Consider memoizing intermediate components in ${chain.length}-level chain`,
        confidence: 75,
        impact: "Could break cascade at multiple points",
      });
    }

    return patterns;
  }

  // =============================
  // PREDICTIVE OPTIMIZATION (BREAKTHROUGH)
  // =============================
  function predictOptimizationImpact(fiber, causeChainData, patterns) {
    const { chain, rootIndex } = causeChainData;
    const predictions = [];

    // Predict React.memo impact
    const wastedPattern = patterns.find((p) => p.type === "wasted-chain");
    if (wastedPattern) {
      predictions.push({
        optimization: `React.memo(${getComponentName(fiber)})`,
        expectedReduction: 95,
        reasoning:
          "Component has no prop/state changes, pure parent propagation",
        confidence: 95,
      });
    }

    // Predict useCallback impact
    const unstableFunc = patterns.find(
      (p) => p.type === "unstable-function-prop",
    );
    if (unstableFunc) {
      const chainImpact = chain.length - rootIndex;
      const reduction = Math.min(70 + chainImpact * 5, 95);
      predictions.push({
        optimization: `useCallback() for ${unstableFunc.props.join(", ")}`,
        expectedReduction: reduction,
        reasoning: `Stabilizing function props would prevent ${chainImpact}-level cascade`,
        confidence: 85,
      });
    }

    // Predict context splitting impact
    const contextExplosion = patterns.find(
      (p) => p.type === "context-explosion",
    );
    if (contextExplosion) {
      const reduction = Math.min(
        60 + contextExplosion.affectedComponents * 3,
        90,
      );
      predictions.push({
        optimization: "Split context or use selectors",
        expectedReduction: reduction,
        reasoning: `${contextExplosion.affectedComponents} components re-render from single context`,
        confidence: 75,
      });
    }

    return predictions;
  }

  // =============================
  // CONFIDENCE SCORING
  // =============================
  function calculateConfidence(patterns, causeChainData) {
    let confidence = 0;
    const reasons = [];

    const { chain, rootCause } = causeChainData;

    // Wasted chain = highest confidence
    if (patterns.some((p) => p.type === "wasted-chain")) {
      confidence += 95;
      reasons.push("Entire chain is wasted renders");
    }

    // Unstable functions = high confidence
    if (patterns.some((p) => p.type === "unstable-function-prop")) {
      confidence += 85;
      reasons.push("Function reference changes detected");
    }

    // Context explosion = high confidence
    if (patterns.some((p) => p.type === "context-explosion")) {
      confidence += 80;
      reasons.push("Context causing cascade re-renders");
    }

    // Root cause type matters
    if (rootCause?.causeType === "parent") {
      confidence += 20;
      reasons.push("Parent-only propagation");
    }

    // Deep chain amplifies confidence
    if (chain.length > 4) {
      confidence += 15;
      reasons.push(`Deep ${chain.length}-level propagation`);
    }

    return {
      score: Math.min(confidence, 100),
      reasons,
    };
  }

  // =============================
  // RENDER SCORE
  // =============================
  function calculateRenderScore(renders, exclusive, patterns) {
    let score = renders * exclusive;

    const criticalPatterns = patterns.filter((p) => p.severity === "critical");
    score += criticalPatterns.length * 50;

    const highPatterns = patterns.filter((p) => p.severity === "high");
    score += highPatterns.length * 20;

    return score;
  }

  function getScoreLabel(score) {
    if (score > 500) return { emoji: "🔥🔥🔥", label: "Critical" };
    if (score > 200) return { emoji: "🔥🔥", label: "High" };
    if (score > 50) return { emoji: "🔥", label: "Medium" };
    return { emoji: "⚪", label: "Low" };
  }

  // =============================
  // COMPONENT TREE
  // =============================
  function buildComponentTree(fiber, depth = 0, maxDepth = 15) {
    if (!fiber || depth > maxDepth) return null;

    const name = getComponentName(fiber);

    if (!name || !isUserComponent(fiber)) {
      const children = [];
      let child = fiber.child;
      while (child) {
        const result = buildComponentTree(child, depth, maxDepth);
        if (result) {
          if (Array.isArray(result)) {
            children.push(...result);
          } else {
            children.push(result);
          }
        }
        child = child.sibling;
      }
      return children.length > 0 ? children : null;
    }

    const data = commitMap.get(fiber);
    const node = {
      name,
      depth,
      children: [],
      key: fiber.key || `${name}-${depth}`,
      didRender: data?.rendered || false,
      causeType: data?.causeType || "unknown",
      renderCount: globalStats.get(name)?.renders || 0,
      score: globalStats.get(name)?.score || 0,
      scoreLabel: globalStats.get(name)
        ? getScoreLabel(globalStats.get(name).score)
        : { emoji: "⚪", label: "Low" },
    };

    let child = fiber.child;
    while (child) {
      const childNode = buildComponentTree(child, depth + 1, maxDepth);
      if (childNode) {
        if (Array.isArray(childNode)) {
          node.children.push(...childNode);
        } else {
          node.children.push(childNode);
        }
      }
      child = child.sibling;
    }

    return node;
  }

  // =============================
  // COUNTING
  // =============================
  function isUserComponentRender(node) {
    if (!node.alternate) return false;
    if (![0, 1, 11, 14, 15].includes(node.tag)) return false;
    return isUserComponent(node);
  }

  function countSubtreeRenders(rootFiber) {
    let count = 0;

    function walk(node) {
      if (!node) return;
      if (isUserComponentRender(node)) count++;
      walk(node.child);
      walk(node.sibling);
    }

    walk(rootFiber);
    return count;
  }

  function findChildRoots(rootFiber) {
    const roots = [];

    function walk(node) {
      if (!node) return;
      if (node !== rootFiber && isTopLevelUserComponent(node)) {
        roots.push(node);
        return;
      }
      walk(node.child);
      walk(node.sibling);
    }

    walk(rootFiber);
    return roots;
  }

  function countExclusiveRenders(rootFiber) {
    const total = countSubtreeRenders(rootFiber);
    const childRoots = findChildRoots(rootFiber);

    let childTotal = 0;
    childRoots.forEach((child) => {
      childTotal += countSubtreeRenders(child);
    });

    return total - childTotal;
  }

  // =============================
  // TRACK ROOT FIBER (ELITE)
  // =============================
  function trackRootFiber(fiber) {
    const name = getComponentName(fiber);

    if (!name || !fiber.alternate) return;

    const prevFiber = fiber.alternate;
    const { changes, propDiff, causeType } = detectRenderCause(
      prevFiber,
      fiber,
    );

    // Mark in commit map
    const causeChainData = buildCauseChain(fiber);
    commitMap.set(fiber, {
      rendered: true,
      cause: { changes, propDiff },
      causeType,
    });

    let record = fiberRenderStore.get(fiber);
    if (!record) {
      record = { count: 0 };
      fiberRenderStore.set(fiber, record);
    }
    record.count++;

    const total = countSubtreeRenders(fiber);
    const exclusive = countExclusiveRenders(fiber);

    // Advanced pattern detection
    const patterns = detectAdvancedPatterns(fiber, propDiff, causeChainData);

    // Predictive optimization
    const predictions = predictOptimizationImpact(
      fiber,
      causeChainData,
      patterns,
    );

    // Confidence scoring
    const confidenceData = calculateConfidence(patterns, causeChainData);

    // Global stats
    let stat = globalStats.get(name);
    if (!stat) {
      stat = {
        renders: 0,
        total: 0,
        exclusive: 0,
        score: 0,
        patterns: [],
      };
      globalStats.set(name, stat);
    }

    stat.renders++;
    stat.total += total;
    stat.exclusive += exclusive;
    stat.score = calculateRenderScore(stat.renders, stat.exclusive, patterns);

    patterns.forEach((p) => {
      const exists = stat.patterns.find((existing) => existing.type === p.type);
      if (!exists) stat.patterns.push(p);
    });

    currentCommitUpdates.push({
      name,
      count: record.count,
      total,
      exclusive,
      changes,
      propDiff,
      patterns,
      causeChain: causeChainData.chain,
      rootIndex: causeChainData.rootIndex,
      rootCause: causeChainData.rootCause,
      predictions,
      confidence: confidenceData,
      timestamp: Date.now(),
      score: calculateRenderScore(record.count, exclusive, patterns),
      scoreLabel: getScoreLabel(
        calculateRenderScore(record.count, exclusive, patterns),
      ),
      commitId: commitCounter,
    });
  }

  // =============================
  // TRAVERSAL
  // =============================
  function traverseFiberTree(rootFiber) {
    let node = rootFiber;

    while (node) {
      if (isTopLevelUserComponent(node)) {
        trackRootFiber(node);
      }

      if (node.child) {
        node = node.child;
        continue;
      }

      while (node) {
        if (node.sibling) {
          node = node.sibling;
          break;
        }
        node = node.return;
      }
    }
  }

  // =============================
  // TIMELINE
  // =============================
  function addToTimeline(updates, tree) {
    const timelineEntry = {
      timestamp: Date.now(),
      commitId: commitCounter,
      updates: JSON.parse(JSON.stringify(updates)),
      componentTree: tree,
    };

    renderTimeline.push(timelineEntry);

    if (renderTimeline.length > 100) {
      renderTimeline.shift();
    }
  }

  // =============================
  // HOOK PATCH
  // =============================
  function patchReactHook(hook) {
    if (hook.__RENDER_TRACKER_PATCHED__) return;

    const original = hook.onCommitFiberRoot;

    hook.onCommitFiberRoot = function (id, root, ...args) {
      commitCounter++;
      currentCommitUpdates = [];

      try {
        traverseFiberTree(root.current);

        const tree = buildComponentTree(root.current);

        if (currentCommitUpdates.length > 0) {
          addToTimeline(currentCommitUpdates, tree);

          window.postMessage(
            {
              source: "react-render-tracker",
              payload: JSON.parse(JSON.stringify(currentCommitUpdates)),
              componentTree: tree,
              timeline: renderTimeline.slice(-50),
              globalStats: Array.from(globalStats.entries()).map(
                ([name, stat]) => ({
                  name,
                  ...stat,
                  scoreLabel: getScoreLabel(stat.score),
                }),
              ),
              commitId: commitCounter,
            },
            "*",
          );
        }
      } catch (e) {
        console.error("[Tracker] Error:", e);
      }

      return original.apply(this, [id, root, ...args]);
    };

    hook.__RENDER_TRACKER_PATCHED__ = true;
    console.log(
      "%c[Tracker] 🔥 ELITE Tracker Active",
      "color:green;font-weight:bold;font-size:14px;",
    );
  }

  function waitForHook() {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;

    if (hook && hook.onCommitFiberRoot) {
      patchReactHook(hook);
    } else {
      setTimeout(waitForHook, 50);
    }
  }

  waitForHook();
})();
