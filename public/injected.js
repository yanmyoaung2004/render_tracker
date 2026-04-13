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

  function getFiberName1(fiber) {
    // Handles functional/class components, intrinsic elements (div, span), and Fragments
    if (!fiber) return "Unknown";
    if (typeof fiber.type === "string") return fiber.type;
    if (typeof fiber.type === "function")
      return fiber.type.displayName || fiber.type.name || "Anonymous";
    if (fiber.tag === 7) return "Fragment"; // FiberTag 7 is usually Fragment
    return "InternalNode";
  }

  // function buildTree(fiber) {
  //   if (!fiber) return null;

  //   const node = {
  //     name: getFiberName1(fiber),
  //     children: [],
  //   };

  //   // 1. Move to the first child
  //   let currentChild = fiber.child;

  //   // 2. Traverse all siblings of that child
  //   while (currentChild) {
  //     const childTree = buildTree(currentChild);
  //     if (childTree) {
  //       node.children.push(childTree);
  //     }
  //     currentChild = currentChild.sibling;
  //   }

  //   return node;
  // }

  // function isFunctionalComponent(fiber) {
  //   const type = fiber.type;
  //   const tag = fiber.tag;

  //   // Tag 0: FunctionComponent, Tag 2: IndeterminateComponent (before first render)
  //   const isFunctionTag = tag === 0 || tag === 2;

  //   return (
  //     isFunctionTag &&
  //     typeof type === "function" &&
  //     !(type.prototype && type.prototype.isReactComponent)
  //   );
  // }

  // function buildFilteredTree(fiber) {
  //   if (!fiber) return null;

  //   let node = null;

  //   if (isFunctionalComponent(fiber)) {
  //     node = {
  //       name: getComponentName(fiber),
  //       children: [],
  //     };
  //   }

  //   // Traverse children
  //   let currentChild = fiber.child;
  //   while (currentChild) {
  //     const childTree = buildFilteredTree(currentChild);

  //     if (childTree) {
  //       if (node) {
  //         // If current fiber is a functional component, add the result to its children
  //         node.children.push(childTree);
  //       } else {
  //         // If current fiber is NOT a functional component (e.g. a div or provider),
  //         // we "hoist" its functional children up to the parent level.
  //         return childTree;
  //       }
  //     }
  //     currentChild = currentChild.sibling;
  //   }

  //   return node;
  // }

  function patch() {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook || typeof hook.onCommitFiberRoot !== "function") return;

    const original = hook.onCommitFiberRoot;

    hook.onCommitFiberRoot = function (id, root, ...args) {
      commitCounter++;
      currentCommitUpdates = [];

      try {
        traverseFiberTree(root.current);
        // const test = buildFilteredTree(root.current);
        // console.log(test);

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
