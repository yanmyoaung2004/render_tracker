import React, { useEffect, useState, useMemo, useRef } from "react";

const App = () => {
  const [components, setComponents] = useState({});
  const [sortBy, setSortBy] = useState("score");
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [recentUpdates, setRecentUpdates] = useState([]);
  const [globalStats, setGlobalStats] = useState([]);
  const [componentTree, setComponentTree] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [viewMode, setViewMode] = useState("table");
  const [timelineIndex, setTimelineIndex] = useState(0);
  const [autoInsights, setAutoInsights] = useState([]);
  const canvasRef = useRef(null);

  // Sidebar resize
  const [sidebarWidth, setSidebarWidth] = useState(450);
  const [isResizing, setIsResizing] = useState(false);

  // Connection status
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    window.portPromise.then((port) => {
      if (!port?.onMessage) {
        console.error("[App] Invalid devtools port");
        return;
      }
      setIsConnected(true);

      port.onMessage.addListener((message) => {
        try {
          if (message?.type !== "FOR_DEVTOOLS" || !message.payload) return;

          const payload = message.payload;
          const updates = payload.currentCommitUpdates;
          if (!Array.isArray(updates)) return;

          const tree = payload.componentTree;
          const timelineData = payload.timeline || [];
          const stats = payload.globalStats || [];

          setComponents((prev) => {
            const next = { ...prev };

            updates.forEach((u) => {
            if (!next[u.name]) {
              next[u.name] = {
                renders: 0,
                total: 0,
                exclusive: 0,
                lastChanges: [],
                history: [],
                maxExclusive: 0,
                patterns: [],
                propDiff: [],
                causeChain: [],
                rootIndex: -1,
                rootCause: null,
                predictions: [],
                confidence: null,
                score: 0,
                scoreLabel: { emoji: "⚪", label: "Low" },
              };
            }

            next[u.name].renders += 1;
            next[u.name].total += u.total;
            next[u.name].exclusive += u.exclusive;
            next[u.name].lastChanges = u.changes;
            next[u.name].propDiff = u.propDiff || [];
            next[u.name].patterns = u.patterns || [];
            next[u.name].causeChain = u.causeChain || [];
            next[u.name].rootIndex = u.rootIndex ?? -1;
            next[u.name].rootCause = u.rootCause || null;
            next[u.name].predictions = u.predictions || [];
            next[u.name].confidence = u.confidence || null;
            next[u.name].score = u.score || 0;
            next[u.name].scoreLabel = u.scoreLabel || {
              emoji: "⚪",
              label: "Low",
            };
            next[u.name].maxExclusive = Math.max(
              next[u.name].maxExclusive,
              u.exclusive,
            );

            next[u.name].history.push({
              timestamp: u.timestamp,
              exclusive: u.exclusive,
              total: u.total,
              changes: u.changes,
              propDiff: u.propDiff,
              commitId: u.commitId,
            });

              if (next[u.name].history.length > 10) {
                next[u.name].history.shift();
              }
            });

            return next;
          });

          setRecentUpdates((prev) => {
            const newUpdates = updates.map((u) => ({
              ...u,
              id: `${u.name}-${Date.now()}-${Math.random()}`,
            }));
            return [...newUpdates, ...prev].slice(0, 20);
          });

          if (tree) setComponentTree(tree);
          if (timelineData.length > 0) {
            setTimeline(timelineData);
            setTimelineIndex(timelineData.length - 1);
          }
          if (stats.length > 0) setGlobalStats(stats);

          generateAutoInsights(updates);
        } catch (e) {
          console.error("[App] Message handler error:", e);
        }
      });
    });
  }, []);

  // Auto Insights (Enhanced with new patterns)
  const generateAutoInsights = (updates) => {
    const insights = [];

    updates.forEach((u) => {
      // Wasted Chain (CRITICAL)
      const wastedChain = u.patterns?.find((p) => p.type === "wasted-chain");
      if (wastedChain) {
        insights.push({
          type: "wasted-chain",
          severity: "critical",
          component: u.name,
          message: `🔥 ENTIRE ${wastedChain.chainLength}-level chain is wasted re-renders`,
          suggestion: wastedChain.suggestion,
          confidence: wastedChain.confidence,
          impact: wastedChain.impact,
          timestamp: Date.now(),
        });
      }

      // Context Explosion
      const contextExplosion = u.patterns?.find(
        (p) => p.type === "context-explosion",
      );
      if (contextExplosion) {
        insights.push({
          type: "context-explosion",
          severity: "critical",
          component: u.name,
          message: `🌐 Context in ${contextExplosion.rootComponent} caused ${contextExplosion.affectedComponents} downstream re-renders`,
          suggestion: contextExplosion.suggestion,
          confidence: contextExplosion.confidence,
          impact: contextExplosion.impact,
          timestamp: Date.now(),
        });
      }

      // Prop Cascade
      const propCascade = u.patterns?.find((p) => p.type === "prop-cascade");
      if (propCascade) {
        insights.push({
          type: "prop-cascade",
          severity: "high",
          component: u.name,
          message: `🔁 Prop drilling: ${propCascade.props.join(", ")} through ${propCascade.depth} levels`,
          suggestion: propCascade.suggestion,
          confidence: propCascade.confidence,
          impact: propCascade.impact,
          timestamp: Date.now(),
        });
      }

      // Unstable functions
      const funcPattern = u.patterns?.find(
        (p) => p.type === "unstable-function-prop",
      );
      if (funcPattern) {
        insights.push({
          type: "unstable-function",
          severity: "high",
          component: u.name,
          message: `Function props ${funcPattern.props.join(", ")} change every render`,
          suggestion: funcPattern.suggestion,
          confidence: funcPattern.confidence,
          impact: funcPattern.impact,
          timestamp: Date.now(),
        });
      }

      // Deep propagation
      const deepPattern = u.patterns?.find(
        (p) => p.type === "deep-propagation",
      );
      if (deepPattern) {
        insights.push({
          type: "deep-propagation",
          severity: "high",
          component: u.name,
          message: `${deepPattern.chainLength}-level propagation chain`,
          suggestion: deepPattern.suggestion,
          confidence: deepPattern.confidence,
          impact: deepPattern.impact,
          timestamp: Date.now(),
        });
      }
    });

    setAutoInsights((prev) => {
      const combined = [...insights, ...prev];
      const seen = new Set();
      const unique = combined.filter((insight) => {
        const key = `${insight.component}-${insight.type}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return unique.slice(0, 10);
    });
  };

  // Reset functionality
  const handleReset = () => {
    if (
      window.confirm(
        "Reset all tracking data? This will clear all stats and history.",
      )
    ) {
      setComponents({});
      setRecentUpdates([]);
      setAutoInsights([]);
      setTimeline([]);
      setComponentTree(null);
      setSelectedComponent(null);
      console.log("[App.jsx] Data reset");
    }
  };

  const sortedComponents = useMemo(() => {
    const entries = Object.entries(components);

    switch (sortBy) {
      case "score":
        return entries.sort((a, b) => b[1].score - a[1].score);
      case "exclusive":
        return entries.sort((a, b) => b[1].exclusive - a[1].exclusive);
      case "renders":
        return entries.sort((a, b) => b[1].renders - a[1].renders);
      case "total":
        return entries.sort((a, b) => b[1].total - a[1].total);
      case "name":
        return entries.sort((a, b) => a[0].localeCompare(b[0]));
      default:
        return entries;
    }
  }, [components, sortBy]);

  const maxExclusive = useMemo(() => {
    return Math.max(...Object.values(components).map((c) => c.exclusive), 1);
  }, [components]);

  const maxRenders = useMemo(() => {
    return Math.max(...Object.values(components).map((c) => c.renders), 1);
  }, [components]);

  const maxScore = useMemo(() => {
    return Math.max(...Object.values(components).map((c) => c.score), 1);
  }, [components]);

  const getHeatmapColor = (value, max) => {
    const intensity = Math.min(value / max, 1);
    if (intensity < 0.2) return "#ecfdf5";
    if (intensity < 0.4) return "#d1fae5";
    if (intensity < 0.6) return "#fef3c7";
    if (intensity < 0.8) return "#fed7aa";
    return "#fecaca";
  };

  const getTextColor = (value, max) => {
    const intensity = Math.min(value / max, 1);
    if (intensity < 0.6) return "#065f46";
    if (intensity < 0.8) return "#92400e";
    return "#991b1b";
  };

  const getCauseIcon = (causeType) => {
    switch (causeType) {
      case "state":
        return "🧠";
      case "props":
        return "🔁";
      case "context":
        return "🌐";
      case "parent":
        return "⬆️";
      default:
        return "❓";
    }
  };

  const formatRenderCauses = (changes) => {
    if (!changes || changes.length === 0) return "Parent re-render";

    return changes
      .map((c) => {
        if (c.type === "props" && c.keys) {
          return `Props: ${c.keys.join(", ")}`;
        }
        if (c.type === "state") return "State changed";
        if (c.type === "context") return "Context changed";
        if (c.type === "parent") return "Parent re-render";
        return c.type;
      })
      .join(" • ");
  };

  // Flamegraph
  useEffect(() => {
    if (
      viewMode === "flamegraph" &&
      canvasRef.current &&
      sortedComponents.length > 0
    ) {
      drawFlamegraph();
    }
  }, [viewMode, sortedComponents]);

  const drawFlamegraph = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const barHeight = 25;
    const totalScore = sortedComponents.reduce(
      (sum, [, stats]) => sum + stats.score,
      1,
    );

    let yOffset = 10;

    sortedComponents.forEach(([name, stats]) => {
      const barWidth = Math.max((stats.score / totalScore) * (width - 40), 20);
      const x = 20;
      const y = yOffset;

      const intensity = stats.score / maxScore;
      let color = "#10b981";
      if (intensity > 0.7) color = "#ef4444";
      else if (intensity > 0.4) color = "#f59e0b";

      ctx.fillStyle = color;
      ctx.fillRect(x, y, barWidth, barHeight);

      ctx.fillStyle = "#000";
      ctx.font = "12px monospace";
      const text = `${name} (${stats.score})`;
      ctx.fillText(text, x + 5, y + 17);

      yOffset += barHeight + 5;
    });
  };

  // Component Tree Renderer
  const renderComponentTree = (node, depth = 0) => {
    if (!node) return null;
    if (Array.isArray(node)) {
      return node.map((n, i) => renderComponentTree(n, depth));
    }

    const indent = depth * 20;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={`${node.name}-${node.key}-${depth}`}>
        <div
          style={{
            marginLeft: `${indent}px`,
            padding: "6px 10px",
            background: node.didRender ? "#fef3c7" : "#f9fafb",
            borderLeft: node.didRender
              ? "3px solid #f59e0b"
              : "3px solid #d1d5db",
            marginBottom: "4px",
            borderRadius: "4px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "background 0.15s",
          }}
          onClick={() => setSelectedComponent(node.name)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = node.didRender
              ? "#fde68a"
              : "#f3f4f6";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = node.didRender
              ? "#fef3c7"
              : "#f9fafb";
          }}
        >
          <span style={{ width: "16px" }}>{hasChildren ? "▼" : "▪️"}</span>
          <span style={{ width: "20px", fontSize: "14px" }}>
            {getCauseIcon(node.causeType)}
          </span>
          <span style={{ fontFamily: "monospace", fontWeight: 500, flex: 1 }}>
            {node.name}
          </span>
          <span style={{ fontSize: "16px" }}>{node.scoreLabel.emoji}</span>
          <span style={{ fontSize: "11px", color: "#6b7280" }}>
            {node.renderCount}
          </span>
        </div>
        {hasChildren && (
          <div>
            {node.children.map((child) =>
              renderComponentTree(child, depth + 1),
            )}
          </div>
        )}
      </div>
    );
  };

  // Timeline
  const currentTimelineEntry = useMemo(() => {
    if (
      timeline.length === 0 ||
      timelineIndex < 0 ||
      timelineIndex >= timeline.length
    ) {
      return null;
    }
    return timeline[timelineIndex];
  }, [timeline, timelineIndex]);

  const renderTimeline = () => {
    if (timeline.length === 0) {
      return (
        <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>⏳</div>
          <p>No timeline data yet</p>
        </div>
      );
    }

    return (
      <div
        style={{
          padding: "16px",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ marginBottom: "16px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <label
              style={{ fontSize: "12px", color: "#6b7280", fontWeight: 600 }}
            >
              Commit {currentTimelineEntry?.commitId || timelineIndex + 1} of{" "}
              {timeline.length}
            </label>
            <span style={{ fontSize: "11px", color: "#9ca3af" }}>
              {currentTimelineEntry
                ? new Date(currentTimelineEntry.timestamp).toLocaleTimeString()
                : ""}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max={timeline.length - 1}
            value={timelineIndex}
            onChange={(e) => setTimelineIndex(parseInt(e.target.value))}
            style={{ width: "100%", cursor: "pointer" }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "10px",
              color: "#9ca3af",
              marginTop: "4px",
            }}
          >
            <span>Oldest</span>
            <span>Latest</span>
          </div>
        </div>

        {currentTimelineEntry && (
          <div style={{ flex: 1, overflow: "auto" }}>
            <div
              style={{
                padding: "12px",
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                marginBottom: "16px",
              }}
            >
              <h4
                style={{
                  margin: "0 0 12px 0",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                Components Rendered ({currentTimelineEntry.updates.length})
              </h4>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {currentTimelineEntry.updates.map((u, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedComponent(u.name)}
                    style={{
                      padding: "6px 10px",
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontFamily: "monospace",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f3f4f6";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#f9fafb";
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                      {u.scoreLabel.emoji} {u.name}
                    </div>
                    <div style={{ color: "#6b7280", fontSize: "10px" }}>
                      Exclusive: {u.exclusive} • {formatRenderCauses(u.changes)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {currentTimelineEntry.componentTree && (
              <div>
                <h4
                  style={{
                    margin: "0 0 12px 0",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  Component Tree (This Commit)
                </h4>
                <div
                  style={{
                    background: "white",
                    padding: "12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                  }}
                >
                  {renderComponentTree(currentTimelineEntry.componentTree)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Resize handler
  const handleMouseDown = () => setIsResizing(true);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      setSidebarWidth(Math.max(350, Math.min(800, newWidth)));
    };

    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: "13px",
        background: "#f9fafb",
        overflow: "hidden",
      }}
    >
      {/* Main Panel */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #e5e7eb",
            background: "white",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
              🔥 Render Tracker Elite
            </h2>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: isConnected ? "#10b981" : "#ef4444",
                }}
              />
              <span style={{ fontSize: "11px", color: "#6b7280" }}>
                {isConnected ? "Connected" : "Disconnected"}
              </span>
              <button
                onClick={handleReset}
                style={{
                  padding: "4px 12px",
                  background: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#dc2626";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#ef4444";
                }}
              >
                Reset Data
              </button>
            </div>
          </div>
          <div
            style={{
              marginTop: "8px",
              display: "flex",
              gap: "12px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: "#6b7280" }}>View:</span>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                style={{
                  padding: "4px 8px",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                <option value="table">📊 Table</option>
                <option value="tree">🌲 Component Tree</option>
                <option value="flamegraph">🔥 Flamegraph</option>
                <option value="timeline">⏱️ Timeline</option>
              </select>
            </div>

            {viewMode === "table" && (
              <div
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                <span style={{ fontSize: "12px", color: "#6b7280" }}>
                  Sort:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    padding: "4px 8px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  <option value="score">🎯 Render Score</option>
                  <option value="exclusive">Exclusive</option>
                  <option value="renders">Renders</option>
                  <option value="total">Total Subtree</option>
                  <option value="name">Name</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflow: "auto", background: "white" }}>
          {!isConnected && (
            <div
              style={{
                padding: "40px",
                textAlign: "center",
                color: "#9ca3af",
              }}
            >
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
              <p>Waiting for connection...</p>
              <p style={{ fontSize: "11px", marginTop: "8px" }}>
                If data doesn't appear, refresh the page with DevTools open
              </p>
            </div>
          )}

          {isConnected && viewMode === "table" && (
            <>
              {sortedComponents.length === 0 ? (
                <div
                  style={{
                    padding: "40px",
                    textAlign: "center",
                    color: "#9ca3af",
                  }}
                >
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                    ⏳
                  </div>
                  <p>Waiting for render data...</p>
                  <p style={{ fontSize: "11px", marginTop: "8px" }}>
                    Interact with your React app
                  </p>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr
                      style={{
                        borderBottom: "2px solid #e5e7eb",
                        background: "#f9fafb",
                        position: "sticky",
                        top: 0,
                        zIndex: 1,
                      }}
                    >
                      <th
                        style={{
                          padding: "10px 16px",
                          textAlign: "left",
                          fontWeight: 600,
                          fontSize: "12px",
                          color: "#374151",
                        }}
                      >
                        Component
                      </th>
                      <th
                        style={{
                          padding: "10px 16px",
                          textAlign: "center",
                          fontWeight: 600,
                          fontSize: "12px",
                          color: "#374151",
                          width: "100px",
                        }}
                      >
                        Score
                      </th>
                      <th
                        style={{
                          padding: "10px 16px",
                          textAlign: "right",
                          fontWeight: 600,
                          fontSize: "12px",
                          color: "#374151",
                          width: "100px",
                        }}
                      >
                        Renders
                      </th>
                      <th
                        style={{
                          padding: "10px 16px",
                          textAlign: "right",
                          fontWeight: 600,
                          fontSize: "12px",
                          color: "#374151",
                          width: "100px",
                        }}
                      >
                        Exclusive
                      </th>
                      <th
                        style={{
                          padding: "10px 16px",
                          textAlign: "center",
                          fontWeight: 600,
                          fontSize: "12px",
                          color: "#374151",
                          width: "80px",
                        }}
                      >
                        Root
                      </th>
                      <th
                        style={{
                          padding: "10px 16px",
                          textAlign: "left",
                          fontWeight: 600,
                          fontSize: "12px",
                          color: "#374151",
                          width: "150px",
                        }}
                      >
                        Patterns
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedComponents.map(([name, stats]) => {
                      const isSelected = selectedComponent === name;

                      return (
                        <tr
                          key={name}
                          onClick={() => setSelectedComponent(name)}
                          style={{
                            borderBottom: "1px solid #f3f4f6",
                            cursor: "pointer",
                            background: isSelected ? "#eff6ff" : "white",
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected)
                              e.currentTarget.style.background = "#f9fafb";
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected)
                              e.currentTarget.style.background = "white";
                          }}
                        >
                          <td
                            style={{
                              padding: "10px 16px",
                              fontFamily: "monospace",
                              fontSize: "13px",
                              fontWeight: 500,
                              color: isSelected ? "#1e40af" : "#111827",
                            }}
                          >
                            {name}
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              textAlign: "center",
                              fontSize: "18px",
                            }}
                          >
                            {stats.scoreLabel.emoji}
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              textAlign: "right",
                              background: getHeatmapColor(
                                stats.renders,
                                maxRenders,
                              ),
                              color: getTextColor(stats.renders, maxRenders),
                              fontWeight: 500,
                            }}
                          >
                            {stats.renders}
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              textAlign: "right",
                              background: getHeatmapColor(
                                stats.exclusive,
                                maxExclusive,
                              ),
                              color: getTextColor(
                                stats.exclusive,
                                maxExclusive,
                              ),
                              fontWeight: 600,
                            }}
                          >
                            {stats.exclusive}
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              textAlign: "center",
                              fontSize: "16px",
                            }}
                          >
                            {stats.rootCause
                              ? getCauseIcon(stats.rootCause.causeType)
                              : "—"}
                          </td>
                          <td
                            style={{ padding: "10px 16px", fontSize: "11px" }}
                          >
                            {stats.patterns.length > 0 ? (
                              <div
                                style={{
                                  display: "flex",
                                  gap: "4px",
                                  flexWrap: "wrap",
                                }}
                              >
                                {stats.patterns.slice(0, 2).map((p, i) => (
                                  <span
                                    key={i}
                                    style={{
                                      padding: "2px 6px",
                                      background:
                                        p.severity === "critical"
                                          ? "#fee2e2"
                                          : p.severity === "high"
                                            ? "#fed7aa"
                                            : "#fef3c7",
                                      borderRadius: "3px",
                                      fontSize: "10px",
                                    }}
                                  >
                                    {p.type}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: "#9ca3af" }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </>
          )}

          {viewMode === "tree" && (
            <div style={{ padding: "16px" }}>
              {componentTree ? (
                <>
                  <h3
                    style={{
                      margin: "0 0 16px 0",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    🌲 Component Tree
                  </h3>
                  {renderComponentTree(componentTree)}
                </>
              ) : (
                <div
                  style={{
                    padding: "40px",
                    textAlign: "center",
                    color: "#9ca3af",
                  }}
                >
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>
                    🌲
                  </div>
                  <p>No component tree data yet</p>
                </div>
              )}
            </div>
          )}

          {viewMode === "flamegraph" && (
            <div style={{ padding: "16px" }}>
              <h3
                style={{
                  margin: "0 0 16px 0",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                🔥 Flamegraph (by Render Score)
              </h3>
              {sortedComponents.length > 0 ? (
                <canvas
                  ref={canvasRef}
                  width={900}
                  height={Math.max(400, sortedComponents.length * 30)}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    maxWidth: "100%",
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: "40px",
                    textAlign: "center",
                    color: "#9ca3af",
                  }}
                >
                  <p>No data to visualize</p>
                </div>
              )}
            </div>
          )}

          {viewMode === "timeline" && renderTimeline()}
        </div>
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          width: "4px",
          cursor: "col-resize",
          background: isResizing ? "#3b82f6" : "#e5e7eb",
          transition: "background 0.15s",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          if (!isResizing) e.currentTarget.style.background = "#d1d5db";
        }}
        onMouseLeave={(e) => {
          if (!isResizing) e.currentTarget.style.background = "#e5e7eb";
        }}
      />

      {/* Right Sidebar */}
      <div
        style={{
          width: `${sidebarWidth}px`,
          borderLeft: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          background: "white",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {/* Auto Insights */}
        <div
          style={{
            maxHeight: "250px",
            minHeight: "120px",
            overflow: "auto",
            borderBottom: "1px solid #e5e7eb",
            background: "#fffbeb",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #fde68a",
              background: "#fef3c7",
              position: "sticky",
              top: 0,
              zIndex: 1,
            }}
          >
            <h4 style={{ margin: 0, fontSize: "12px", fontWeight: 600 }}>
              💡 Auto Insights
            </h4>
          </div>
          <div style={{ padding: "12px" }}>
            {autoInsights.length === 0 ? (
              <p style={{ fontSize: "11px", color: "#92400e", margin: 0 }}>
                No performance issues detected
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {autoInsights.map((insight, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "10px",
                      background:
                        insight.severity === "critical" ? "#fee2e2" : "#fed7aa",
                      borderLeft: `3px solid ${
                        insight.severity === "critical" ? "#dc2626" : "#f59e0b"
                      }`,
                      borderRadius: "4px",
                      fontSize: "11px",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        marginBottom: "4px",
                        fontFamily: "monospace",
                      }}
                    >
                      {insight.component}
                    </div>
                    <div style={{ marginBottom: "6px" }}>{insight.message}</div>
                    {insight.confidence && (
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#374151",
                          marginBottom: "6px",
                        }}
                      >
                        Confidence: {insight.confidence}%
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#065f46",
                        background: "#d1fae5",
                        padding: "4px 8px",
                        borderRadius: "3px",
                      }}
                    >
                      💡 {insight.suggestion}
                    </div>
                    {insight.impact && (
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#6b7280",
                          marginTop: "4px",
                        }}
                      >
                        Impact: {insight.impact}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Component Details */}
        <div
          style={{
            flex: 1,
            borderBottom: "1px solid #e5e7eb",
            overflow: "auto",
          }}
        >
          {selectedComponent && components[selectedComponent] ? (
            <div style={{ padding: "16px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    fontWeight: 600,
                    fontFamily: "monospace",
                  }}
                >
                  {selectedComponent}
                </h3>
                <button
                  onClick={() => setSelectedComponent(null)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "18px",
                    color: "#9ca3af",
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Render Score */}
              <div
                style={{
                  background: "#f9fafb",
                  padding: "12px",
                  borderRadius: "6px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    color: "#6b7280",
                    marginBottom: "4px",
                  }}
                >
                  Render Score
                </div>
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  {components[selectedComponent].scoreLabel.emoji}
                  <span>{components[selectedComponent].score}</span>
                  <span style={{ fontSize: "13px", color: "#6b7280" }}>
                    ({components[selectedComponent].scoreLabel.label})
                  </span>
                </div>
              </div>

              {/* TRUE CAUSAL CHAIN (ELITE) */}
              {components[selectedComponent].causeChain &&
                components[selectedComponent].causeChain.length > 0 && (
                  <div style={{ marginBottom: "20px" }}>
                    <h4
                      style={{
                        margin: "0 0 8px 0",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      🔥 True Root Cause Chain
                    </h4>
                    <div
                      style={{
                        padding: "12px",
                        background: "#eff6ff",
                        borderLeft: "3px solid #3b82f6",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontFamily: "monospace",
                      }}
                    >
                      {components[selectedComponent].causeChain.map(
                        (chain, idx) => {
                          const isRoot =
                            idx === components[selectedComponent].rootIndex;
                          return (
                            <div
                              key={idx}
                              style={{
                                marginBottom:
                                  idx <
                                  components[selectedComponent].causeChain
                                    .length -
                                    1
                                    ? "8px"
                                    : "0",
                                background: isRoot ? "#dbeafe" : "transparent",
                                padding: isRoot ? "6px" : "0",
                                borderRadius: isRoot ? "4px" : "0",
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 600,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                }}
                              >
                                {isRoot && (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      background: "#ef4444",
                                      color: "white",
                                      padding: "2px 6px",
                                      borderRadius: "3px",
                                    }}
                                  >
                                    ROOT
                                  </span>
                                )}
                                {getCauseIcon(chain.causeType)} {chain.name}
                              </div>
                              {idx <
                                components[selectedComponent].causeChain
                                  .length -
                                  1 && (
                                <div
                                  style={{
                                    color: "#6b7280",
                                    marginLeft: "8px",
                                    fontSize: "11px",
                                    marginTop: "2px",
                                  }}
                                >
                                  ↑ propagates via {chain.causeType}
                                </div>
                              )}
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                )}

              {/* PREDICTIVE OPTIMIZATION (BREAKTHROUGH) */}
              {components[selectedComponent].predictions &&
                components[selectedComponent].predictions.length > 0 && (
                  <div style={{ marginBottom: "20px" }}>
                    <h4
                      style={{
                        margin: "0 0 8px 0",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      🔮 Predictive Optimization
                    </h4>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      {components[selectedComponent].predictions.map(
                        (pred, i) => (
                          <div
                            key={i}
                            style={{
                              padding: "10px",
                              background: "#f0fdf4",
                              border: "1px solid #10b981",
                              borderRadius: "4px",
                              fontSize: "11px",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 600,
                                marginBottom: "4px",
                                color: "#065f46",
                              }}
                            >
                              {pred.optimization}
                            </div>
                            <div
                              style={{
                                fontSize: "18px",
                                fontWeight: 700,
                                color: "#10b981",
                                marginBottom: "4px",
                              }}
                            >
                              ~{pred.expectedReduction}% reduction
                            </div>
                            <div
                              style={{
                                fontSize: "10px",
                                color: "#4b5563",
                                marginBottom: "4px",
                              }}
                            >
                              Confidence: {pred.confidence}%
                            </div>
                            <div style={{ fontSize: "10px", color: "#6b7280" }}>
                              {pred.reasoning}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

              {/* Prop Diff */}
              {components[selectedComponent].propDiff.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <h4
                    style={{
                      margin: "0 0 8px 0",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#374151",
                    }}
                  >
                    🧬 Prop Diff Viewer
                  </h4>
                  <div
                    style={{
                      background: "#f9fafb",
                      padding: "10px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontFamily: "monospace",
                      maxHeight: "200px",
                      overflow: "auto",
                    }}
                  >
                    {components[selectedComponent].propDiff.map((diff, i) => (
                      <div
                        key={i}
                        style={{
                          marginBottom: "6px",
                          paddingBottom: "6px",
                          borderBottom:
                            i <
                            components[selectedComponent].propDiff.length - 1
                              ? "1px solid #e5e7eb"
                              : "none",
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: "2px" }}>
                          {diff.key}:
                        </div>
                        <div style={{ color: "#dc2626" }}>
                          - {diff.prevValue}
                        </div>
                        <div style={{ color: "#059669" }}>
                          + {diff.nextValue}
                        </div>
                        {diff.isFunctionRefChange && (
                          <div
                            style={{
                              marginTop: "4px",
                              padding: "4px 6px",
                              background: "#fef3c7",
                              borderRadius: "3px",
                              fontSize: "10px",
                            }}
                          >
                            ⚠️ Function reference changed
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Render History */}
              <div>
                <h4
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#374151",
                  }}
                >
                  📊 Render History
                </h4>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    maxHeight: "300px",
                    overflow: "auto",
                  }}
                >
                  {components[selectedComponent].history
                    ?.slice()
                    .reverse()
                    .map((event, idx) => {
                      const intensity =
                        event.exclusive /
                        Math.max(components[selectedComponent].maxExclusive, 1);
                      const bgColor =
                        intensity > 0.7
                          ? "#fee2e2"
                          : intensity > 0.4
                            ? "#fed7aa"
                            : "#dbeafe";

                      return (
                        <div
                          key={idx}
                          style={{
                            padding: "8px",
                            background: bgColor,
                            borderRadius: "4px",
                            fontSize: "11px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: "4px",
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>
                              Exclusive: {event.exclusive}
                            </span>
                            <span style={{ color: "#6b7280" }}>
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div style={{ color: "#4b5563" }}>
                            {formatRenderCauses(event.changes)}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: "40px 20px",
                textAlign: "center",
                color: "#9ca3af",
              }}
            >
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>👆</div>
              <p>Select a component to see details</p>
            </div>
          )}
        </div>

        {/* Live Updates Feed */}
        <div
          style={{
            height: "200px",
            borderTop: "1px solid #e5e7eb",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #e5e7eb",
              background: "#f9fafb",
            }}
          >
            <h4 style={{ margin: 0, fontSize: "12px", fontWeight: 600 }}>
              ⚡ Live Updates
            </h4>
          </div>
          <div style={{ height: "calc(100% - 45px)", overflow: "auto" }}>
            {recentUpdates.length === 0 ? (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "#9ca3af",
                  fontSize: "11px",
                }}
              >
                No recent activity
              </div>
            ) : (
              <div style={{ padding: "8px" }}>
                {recentUpdates.map((update) => (
                  <div
                    key={update.id}
                    onClick={() => setSelectedComponent(update.name)}
                    style={{
                      padding: "8px",
                      marginBottom: "6px",
                      background: "#f9fafb",
                      borderRadius: "4px",
                      fontSize: "11px",
                      borderLeft: `3px solid ${
                        update.exclusive > 10
                          ? "#ef4444"
                          : update.exclusive > 5
                            ? "#f59e0b"
                            : "#10b981"
                      }`,
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f3f4f6";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#f9fafb";
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "4px",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          fontFamily: "monospace",
                          fontSize: "12px",
                        }}
                      >
                        {update.scoreLabel?.emoji} {update.name}
                      </span>
                      <span style={{ color: "#6b7280", fontSize: "10px" }}>
                        {new Date(update.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div
                      style={{ display: "flex", gap: "12px", color: "#6b7280" }}
                    >
                      <span>Score: {update.score}</span>
                      <span>Exclusive: {update.exclusive}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
