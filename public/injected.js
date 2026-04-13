(function () {
  const globalStats = new Map();
  let currentCommitUpdates = [];
  let commitCounter = 0;

  function getComponentName(fiber) {
    if (!fiber) return null;
    const { type, elementType } = fiber;
    if (typeof type === "string") return null;

    let name =
      type?.displayName ||
      type?.name ||
      elementType?.displayName ||
      elementType?.name;
    if (!name && type?.render)
      name = type.render.displayName || type.render.name;

    return name || null;
  }

  function getScoreLabel(score) {
    if (score > 8) return { label: "CRITICAL", color: "#f87171" };
    if (score > 5) return { label: "WARNING", color: "#fbbf24" };
    return { label: "OPTIMAL", color: "#4ade80" };
  }

  function getScore(exclusive, total, renderCount) {
    const base = exclusive * 2 + total * 0.5;
    const frequencyMultiplier = Math.log10(renderCount + 1) + 1;
    return parseFloat(Math.min(10, base * frequencyMultiplier).toFixed(1));
  }

  function getPropDiff(prevProps, nextProps) {
    const diff = [];
    if (!prevProps || !nextProps) return diff;

    const allKeys = new Set([
      ...Object.keys(prevProps),
      ...Object.keys(nextProps),
    ]);
    for (const key of allKeys) {
      if (prevProps[key] !== nextProps[key]) {
        diff.push({
          key,
          prevValue:
            typeof prevProps[key] === "function"
              ? "[Function]"
              : prevProps[key],
          nextValue:
            typeof nextProps[key] === "function"
              ? "[Function]"
              : nextProps[key],
        });
      }
    }
    return diff;
  }

  function getCauseChain(fiber) {
    const chain = [];
    let curr = fiber;
    while (curr) {
      const name = getComponentName(curr);
      if (name) {
        let type = "re-render";
        if (curr.alternate === null) type = "mount";
        else if (curr.memoizedState !== curr.alternate.memoizedState)
          type = "state_change";
        else if (curr.memoizedProps !== curr.alternate.memoizedProps)
          type = "props_change";

        chain.unshift({ name, causeType: type });
      }
      curr = curr.return;
    }
    return chain.slice(-3);
  }

  /**
   * REVISED: Robust tree builder that skips host components
   * but continues traversing all children and siblings.
   */
  function buildComponentTree(fiber) {
    if (!fiber) return null;

    const name = getComponentName(fiber);

    if (name) {
      const node = { name, children: [] };
      let child = fiber.child;
      while (child) {
        const childNode = buildComponentTree(child);
        if (childNode) {
          // Flattening: if the child was a skipped host component, it returns an array or null
          if (Array.isArray(childNode)) {
            node.children.push(...childNode);
          } else {
            node.children.push(childNode);
          }
        }
        child = child.sibling;
      }
      return node;
    } else {
      // It's a host component (div, span) or Fragment.
      // We skip it but return all of its valid component children.
      let results = [];
      let child = fiber.child;
      while (child) {
        const childNode = buildComponentTree(child);
        if (childNode) {
          if (Array.isArray(childNode)) results.push(...childNode);
          else results.push(childNode);
        }
        child = child.sibling;
      }
      return results.length > 0 ? results : null;
    }
  }

  function traverseFiberTree(fiber) {
    if (!fiber) return;

    const name = getComponentName(fiber);
    if (name && fiber.alternate) {
      const { actualDuration, selfBaseDuration } = fiber;
      const exclusive = parseFloat((actualDuration || 0).toFixed(2));
      const total = parseFloat((selfBaseDuration || 0).toFixed(2));

      if (actualDuration > 0) {
        const stats = globalStats.get(name) || { count: 0, score: 0 };
        stats.count++;
        stats.score = getScore(exclusive, total, stats.count);
        globalStats.set(name, stats);

        currentCommitUpdates.push({
          name,
          exclusive,
          total,
          score: stats.score,
          scoreInfo: getScoreLabel(stats.score),
          propDiff: getPropDiff(
            fiber.alternate.memoizedProps,
            fiber.memoizedProps,
          ),
          causeChain: getCauseChain(fiber),
          predictions:
            stats.score > 7
              ? ["Consider React.memo", "Check for prop stability"]
              : [],
          timestamp: Date.now(),
        });
      }
    }

    let child = fiber.child;
    while (child) {
      traverseFiberTree(child);
      child = child.sibling;
    }
  }

  function patch() {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook || typeof hook.onCommitFiberRoot !== "function") return;

    const original = hook.onCommitFiberRoot;
    hook.onCommitFiberRoot = function (id, root, ...args) {
      commitCounter++;
      currentCommitUpdates = [];

      try {
        traverseFiberTree(root.current);

        // Find the root node. In many cases buildComponentTree might return an array
        // if the very first node is a Fragment/Provider.
        const rawTree = buildComponentTree(root.current);
        const tree = Array.isArray(rawTree) ? rawTree[0] : rawTree;

        if (currentCommitUpdates.length > 0) {
          const payload = {
            update: currentCommitUpdates,
            componentTree: tree,
          };
          window.postMessage(
            {
              source: "react-render-tracker",
              type: "FOR_DEVTOOLS",
              payload: JSON.parse(JSON.stringify(payload)),
              componentTree: tree,
              globalStats: Array.from(globalStats.entries()).map(
                ([name, s]) => ({ name, ...s }),
              ),
              commitId: commitCounter,
            },
            "*",
          );
        }
      } catch (e) {
        console.error("[Tracker] Audit Error:", e);
      }

      return original.apply(this, [id, root, ...args]);
    };

    console.log(
      "%c[Tracker] 🔥 ELITE Tracker Active",
      "color:#4ade80;font-weight:bold;font-size:12px;",
    );
  }

  const interval = setInterval(() => {
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      patch();
      clearInterval(interval);
    }
  }, 100);
})();
