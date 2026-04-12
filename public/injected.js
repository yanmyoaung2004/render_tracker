(function () {
  const fiberRenderStore = new WeakMap();
  const globalStats = new Map();
  let currentCommitUpdates = [];
  let lastPrintTime = 0;
  const renderTimeline = [];
  const commitMap = new WeakMap(); // Track which fibers participated in this commit
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
  function isUserComponent(fiber) {
    if (!fiber) return false;
    const source = fiber._debugSource;
    return source?.fileName?.includes("/src/");
  }

  function isTopLevelUserComponent(fiber) {
    if (!isUserComponent(fiber)) return false;

    const owner = fiber._debugOwner;
    return !isUserComponent(owner);
  }

  // =============================
  // DETAILED PROP DIFF
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

    return { changes, propDiff };
  }

  // =============================
  // TRUE CAUSAL CHAIN (BREAKTHROUGH)
  // =============================
  function buildCauseChain(fiber) {
    const chain = [];
    let current = fiber;

    while (current) {
      const name = getComponentName(current);
      if (!name) {
        current = current.return;
        continue;
      }

      // Only include user components
      if (!isUserComponent(current)) {
        current = current.return;
        continue;
      }

      const data = commitMap.get(current);
      if (data?.rendered) {
        chain.push({
          name,
          cause: data.cause || { changes: [{ type: "unknown" }] },
          fiberKey: current.key,
        });
      }

      current = current.return;
    }

    return chain.reverse(); // Root first, leaf last
  }

  // =============================
  // CONFIDENCE SCORING
  // =============================
  function calculateConfidence(fiber, patterns, causeChain) {
    let confidence = 0;
    const reasons = [];

    // High confidence for wasted renders
    const hasWastedRender = patterns.some((p) => p.type === "wasted-render");
    if (hasWastedRender) {
      confidence += 85;
      reasons.push("Props unchanged, parent re-render only");
    }

    // High confidence for unstable functions
    const hasUnstableFunc = patterns.some(
      (p) => p.type === "unstable-function-prop",
    );
    if (hasUnstableFunc) {
      confidence += 75;
      reasons.push("Function reference changes detected");
    }

    // Medium confidence for object instability
    const hasObjectInstability = patterns.some(
      (p) => p.type === "object-prop-instability",
    );
    if (hasObjectInstability) {
      confidence += 60;
      reasons.push("Object props recreated each render");
    }

    // Check render frequency
    const stats = globalStats.get(getComponentName(fiber));
    if (stats && stats.renders > 10) {
      confidence += 20;
      reasons.push("High render frequency detected");
    }

    // Check chain depth (deep propagation = higher confidence for memo)
    if (causeChain.length > 3) {
      confidence += 15;
      reasons.push("Deep propagation chain");
    }

    return {
      score: Math.min(confidence, 100),
      reasons,
    };
  }

  // =============================
  // PATTERN DETECTION (ENHANCED)
  // =============================
  function detectPatterns(fiber, propDiff, causeChain) {
    const patterns = [];

    // 1. Unstable function props
    const unstableFunctions = propDiff.filter((d) => d.isFunctionRefChange);
    if (unstableFunctions.length > 0) {
      const confidence = calculateConfidence(fiber, [], causeChain);
      patterns.push({
        type: "unstable-function-prop",
        severity: "high",
        props: unstableFunctions.map((f) => f.key),
        suggestion: `Wrap ${unstableFunctions.map((f) => f.key).join(", ")} in useCallback()`,
        confidence: Math.min(confidence.score + 10, 95),
        impact: `Likely reduces 60-80% of re-renders`,
      });
    }

    // 2. Object prop instability
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
        impact: `May reduce 40-60% of re-renders`,
      });
    }

    // 3. Wasted render with high confidence
    const name = getComponentName(fiber);
    if (name && fiber.alternate) {
      const { changes } = detectRenderCause(fiber.alternate, fiber);
      if (changes.length === 1 && changes[0].type === "parent") {
        const confidence = calculateConfidence(
          fiber,
          [{ type: "wasted-render" }],
          causeChain,
        );
        patterns.push({
          type: "wasted-render",
          severity: "critical",
          suggestion: `Wrap ${name} with React.memo()`,
          confidence: confidence.score,
          reasons: confidence.reasons,
          impact: `Likely reduces 70-90% of renders`,
        });
      }
    }

    // 4. Deep propagation chain (new pattern)
    if (causeChain.length > 4) {
      patterns.push({
        type: "deep-propagation",
        severity: "high",
        suggestion: `Consider memoizing intermediate components in the chain`,
        confidence: 75,
        impact: `Could prevent cascade re-renders`,
        chainLength: causeChain.length,
      });
    }

    return patterns;
  }

  // =============================
  // RENDER COST SCORE
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
  // COMPONENT TREE BUILDING
  // =============================
  function buildComponentTree(fiber, depth = 0, maxDepth = 15) {
    if (!fiber || depth > maxDepth) return null;

    const name = getComponentName(fiber);

    // Skip non-user components but traverse children
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
      renderCount: globalStats.get(name)?.renders || 0,
      score: globalStats.get(name)?.score || 0,
      scoreLabel: globalStats.get(name)
        ? getScoreLabel(globalStats.get(name).score)
        : { emoji: "⚪", label: "Low" },
    };

    // Traverse children
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
  // TRACK ROOT FIBER (ENHANCED)
  // =============================
  function trackRootFiber(fiber) {
    const name = getComponentName(fiber);
    if (!name) return;
    if (!fiber.alternate) return;

    const prevFiber = fiber.alternate;
    const { changes, propDiff } = detectRenderCause(prevFiber, fiber);

    // Mark this fiber as rendered in current commit
    const causeChain = buildCauseChain(fiber);
    commitMap.set(fiber, {
      rendered: true,
      cause: { changes, propDiff },
    });

    let record = fiberRenderStore.get(fiber);
    if (!record) {
      record = { count: 0 };
      fiberRenderStore.set(fiber, record);
    }
    record.count++;

    const total = countSubtreeRenders(fiber);
    const exclusive = countExclusiveRenders(fiber);

    // Pattern detection with causal chain
    const patterns = detectPatterns(fiber, propDiff, causeChain);

    // Calculate score
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

    // Merge unique patterns
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
      causeChain, // TRUE CAUSAL CHAIN
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

    // Keep last 100 commits
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
              timeline: renderTimeline.slice(-50), // Last 50 commits
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
      "%c[Tracker] 🔥 Production-Level Tracker Active",
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
