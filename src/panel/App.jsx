import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Table as TableIcon,
  GitBranch,
  Trash2,
  Play,
  Pause,
  Layers,
  Search,
  Zap,
  Target,
  History,
  Info,
  Activity,
  Box,
  ChevronDown,
  Monitor,
  Database,
  AlertCircle,
  Clock,
  ArrowRight,
} from "lucide-react";

const THEME = {
  bg: {
    app: "#0f172a",
    side: "#1e293b",
    header: "#0f172a",
    rowOdd: "rgba(255, 255, 255, 0.02)",
    selected: "rgba(56, 189, 248, 0.15)",
    toolbar: "#1e293b",
    card: "#0f172a",
  },
  border: "#334155",
  text: {
    primary: "#f1f5f9",
    secondary: "#94a3b8",
    accent: "#38bdf8",
    warning: "#fbbf24",
    danger: "#f87171",
    success: "#4ade80",
  },
  font: {
    mono: "'JetBrains Mono', 'Fira Code', monospace",
    sans: "Inter, system-ui, sans-serif",
  },
};

const App = () => {
  const [components, setComponents] = useState({});
  const [componentTree, setComponentTree] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [viewMode, setViewMode] = useState("table");
  const [selectedId, setSelectedId] = useState(null);
  const [isRecording, setIsRecording] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("insights");
  const [recentUpdates, setRecentUpdates] = useState([]);

  const selectedComp = useMemo(
    () => components[selectedId] || null,
    [components, selectedId],
  );

  const loadMockData = () => {
    const mockTree = {
      name: "AppRoot",
      children: [
        {
          name: "Navigation",
          children: [
            { name: "UserMenu", children: [] },
            { name: "SearchBar", children: [] },
          ],
        },
        {
          name: "Dashboard",
          children: [
            {
              name: "StatsGrid",
              children: [
                { name: "RevenueCard", children: [] },
                { name: "TrafficCard", children: [] },
              ],
            },
            { name: "ChartContainer", children: [] },
          ],
        },
      ],
    };

    const mockComponents = {
      Dashboard: {
        name: "Dashboard",
        id: "Dashboard",
        score: 8,
        exclusive: 4.2,
        total: 8.5,
        causeChain: [
          { name: "AppRoot", causeType: "state_change" },
          { name: "Dashboard", causeType: "parent_re-render" },
        ],
        propDiff: [
          { key: "data", prevValue: [10, 20], nextValue: [10, 20, 30] },
          { key: "isLoading", prevValue: true, nextValue: false },
        ],
        predictions: ["Use React.memo to skip re-renders from AppRoot"],
        history: [{ timestamp: Date.now(), exclusive: 4.2, total: 8.5 }],
      },
      AppRoot: {
        name: "AppRoot",
        id: "AppRoot",
        score: 2,
        exclusive: 0.5,
        total: 12.4,
        history: [],
      },
    };

    setComponentTree(mockTree);
    setComponents(mockComponents);
    setRecentUpdates([
      { name: "Dashboard", timestamp: Date.now(), score: 8, total: 8.5 },
      {
        name: "RevenueCard",
        timestamp: Date.now() - 500,
        score: 1,
        total: 0.2,
      },
    ]);
  };

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      body, html { margin: 0; padding: 0; overflow: hidden; background: ${THEME.bg.app}; color: ${THEME.text.primary}; }
      * { box-sizing: border-box; }
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-thumb { background: ${THEME.border}; border-radius: 3px; }
    `;
    document.head.appendChild(style);

    if (window.portPromise) {
      window.portPromise.then((port) => {
        port.onMessage.addListener((message) => {
          if (!isRecording || message.type !== "FOR_DEVTOOLS") return;

          const updates = message.payload;
          const tree =
            message.componentTree ||
            (updates && updates.find((u) => u.isRoot)?.tree);

          if (tree) setComponentTree(tree);

          if (updates && Array.isArray(updates)) {
            setRecentUpdates((prev) => [...updates, ...prev].slice(0, 50));
            const maxDuration = Math.max(...updates.map((u) => u.total || 0));
            setTimeline((prev) =>
              [...prev, { duration: maxDuration, timestamp: Date.now() }].slice(
                -50,
              ),
            );

            setComponents((prev) => {
              const next = { ...prev };
              updates.forEach((u) => {
                const id = u.name;
                const existing = next[id] || { history: [] };
                next[id] = {
                  ...u,
                  id,
                  history: [
                    {
                      timestamp: Date.now(),
                      ...u,
                    },
                    ...existing.history,
                  ].slice(0, 30),
                };
              });
              return next;
            });
          }
        });
      });
    }
  }, [isRecording]);

  const renderTree = (node, level = 0) => {
    if (!node) return null;
    const isSelected = selectedId === node.name;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.name} style={{ marginLeft: level * 16 }}>
        <div
          onClick={() => setSelectedId(node.name)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "4px 8px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            backgroundColor: isSelected ? THEME.bg.selected : "transparent",
            color: isSelected ? THEME.text.accent : THEME.text.primary,
            marginBottom: "2px",
          }}
        >
          {hasChildren ? (
            <ChevronDown size={12} />
          ) : (
            <div style={{ width: 12 }} />
          )}
          <Box size={14} opacity={0.6} />
          <span>{node.name}</span>
        </div>
        {node.children &&
          node.children.map((child) => renderTree(child, level + 1))}
      </div>
    );
  };

  const sortedComponents = useMemo(() => {
    return Object.values(components)
      .filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => b.score - a.score);
  }, [components, searchQuery]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        backgroundColor: THEME.bg.app,
        fontFamily: THEME.font.sans,
        overflow: "hidden",
      }}
    >
      {/* Activity Bar */}
      <div
        style={{
          width: "48px",
          borderRight: `1px solid ${THEME.border}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "12px 0",
          gap: "20px",
          backgroundColor: THEME.bg.side,
          zIndex: 10,
        }}
      >
        <Monitor size={20} color={THEME.text.accent} />
        <div style={{ flex: 1 }} />
        <button
          title="Load Sample Data"
          onClick={loadMockData}
          style={styles.iconBtn}
        >
          <Database size={20} color={THEME.text.warning} />
        </button>
        <button
          onClick={() => setIsRecording(!isRecording)}
          style={styles.iconBtn}
        >
          {isRecording ? (
            <Pause size={20} color={THEME.text.danger} />
          ) : (
            <Play size={20} color={THEME.text.accent} />
          )}
        </button>
        <button
          onClick={() => {
            setComponents({});
            setTimeline([]);
            setRecentUpdates([]);
          }}
          style={styles.iconBtn}
        >
          <Trash2 size={20} color={THEME.text.secondary} />
        </button>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            height: "40px",
            borderBottom: `1px solid ${THEME.border}`,
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            gap: "8px",
            backgroundColor: THEME.bg.toolbar,
          }}
        >
          <div
            style={{
              display: "flex",
              background: "rgba(0,0,0,0.3)",
              borderRadius: "4px",
              padding: "2px",
            }}
          >
            <button
              onClick={() => setViewMode("table")}
              style={{
                ...styles.tabBtn,
                color:
                  viewMode === "table"
                    ? THEME.text.accent
                    : THEME.text.secondary,
              }}
            >
              <TableIcon size={14} />
            </button>
            <button
              onClick={() => setViewMode("tree")}
              style={{
                ...styles.tabBtn,
                color:
                  viewMode === "tree"
                    ? THEME.text.accent
                    : THEME.text.secondary,
              }}
            >
              <GitBranch size={14} />
            </button>
            <button
              onClick={() => setViewMode("flamegraph")}
              style={{
                ...styles.tabBtn,
                color:
                  viewMode === "flamegraph"
                    ? THEME.text.accent
                    : THEME.text.secondary,
              }}
            >
              <Activity size={14} />
            </button>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(0,0,0,0.2)",
              padding: "4px 10px",
              borderRadius: "4px",
            }}
          >
            <Search size={14} color={THEME.text.secondary} />
            <input
              placeholder="Filter components..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#fff",
                fontSize: "12px",
                width: "100%",
              }}
            />
          </div>
        </div>

        {/* Content View */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {viewMode === "table" && (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "12px",
              }}
            >
              <thead
                style={{
                  position: "sticky",
                  top: 0,
                  backgroundColor: THEME.bg.header,
                  zIndex: 5,
                }}
              >
                <tr
                  style={{
                    color: THEME.text.secondary,
                    textAlign: "left",
                    borderBottom: `1px solid ${THEME.border}`,
                  }}
                >
                  <th style={styles.th}>Component</th>
                  <th style={styles.th}>Score</th>
                  <th style={styles.th}>Exclusive</th>
                  <th style={styles.th}>Total</th>
                </tr>
              </thead>
              <tbody>
                {sortedComponents.map((c, i) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    style={{
                      backgroundColor:
                        selectedId === c.id
                          ? THEME.bg.selected
                          : i % 2 === 0
                            ? "transparent"
                            : THEME.bg.rowOdd,
                      cursor: "pointer",
                      borderBottom: `1px solid rgba(255,255,255,0.03)`,
                    }}
                  >
                    <td style={styles.td}>{c.name}</td>
                    <td style={styles.td}>{c.score}</td>
                    <td style={styles.td}>{c.exclusive}ms</td>
                    <td style={styles.td}>{c.total}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {viewMode === "tree" && (
            <div style={{ padding: "20px" }}>
              {componentTree ? (
                renderTree(componentTree)
              ) : (
                <div style={styles.empty}>No tree data.</div>
              )}
            </div>
          )}

          {viewMode === "flamegraph" && (
            <div style={{ padding: "20px" }}>
              <div style={styles.sectionTitle}>Render Timeline</div>
              {timeline.map((t, i) => (
                <div
                  key={i}
                  style={{
                    height: "20px",
                    background: THEME.bg.side,
                    marginBottom: "4px",
                    borderRadius: "2px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, (t.duration / 16) * 100)}%`,
                      height: "100%",
                      background: THEME.text.accent,
                      fontSize: "10px",
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: "4px",
                    }}
                  >
                    {t.duration.toFixed(2)}ms
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <div
        style={{
          width: "400px",
          borderLeft: `1px solid ${THEME.border}`,
          backgroundColor: THEME.bg.side,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Sidebar Header Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: `1px solid ${THEME.border}`,
            backgroundColor: THEME.bg.toolbar,
          }}
        >
          {["insights", "props", "updates"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: "12px",
                border: "none",
                background: "none",
                cursor: "pointer",
                color:
                  activeTab === tab ? THEME.text.accent : THEME.text.secondary,
                borderBottom:
                  activeTab === tab ? `2px solid ${THEME.text.accent}` : "none",
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {!selectedId && activeTab !== "updates" ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0.5,
              }}
            >
              <Info size={32} style={{ marginBottom: "12px" }} />
              <div style={{ fontSize: "13px" }}>
                Select a component to view details
              </div>
            </div>
          ) : activeTab === "insights" ? (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "20px" }}
            >
              <div>
                <div style={styles.sectionTitle}>Performance Impact</div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 700,
                    color:
                      selectedComp?.score > 5
                        ? THEME.text.danger
                        : THEME.text.success,
                  }}
                >
                  {selectedComp?.score || 0}{" "}
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 400,
                      color: THEME.text.secondary,
                    }}
                  >
                    / 10
                  </span>
                </div>
              </div>

              {selectedComp?.causeChain && (
                <div>
                  <div style={styles.sectionTitle}>Cause Chain</div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {selectedComp.causeChain.map((step, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <div
                          style={{
                            width: "12px",
                            height: "12px",
                            borderRadius: "50%",
                            background: THEME.text.accent,
                            flexShrink: 0,
                          }}
                        />
                        <div
                          style={{
                            flex: 1,
                            background: "rgba(255,255,255,0.05)",
                            padding: "6px 10px",
                            borderRadius: "4px",
                            fontSize: "12px",
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{step.name}</span>
                          <div
                            style={{
                              color: THEME.text.secondary,
                              fontSize: "10px",
                            }}
                          >
                            {step.causeType}
                          </div>
                        </div>
                        {idx < selectedComp.causeChain.length - 1 && (
                          <ArrowRight size={12} color={THEME.text.secondary} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedComp?.predictions && (
                <div>
                  <div style={styles.sectionTitle}>Optimization Insights</div>
                  {selectedComp.predictions.map((p, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: "8px",
                        padding: "10px",
                        background: "rgba(56, 189, 248, 0.1)",
                        border: `1px solid ${THEME.text.accent}`,
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                    >
                      <Zap
                        size={14}
                        color={THEME.text.accent}
                        style={{ flexShrink: 0 }}
                      />
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === "props" ? (
            <div>
              <div style={styles.sectionTitle}>Current Props Diff</div>
              {selectedComp?.propDiff?.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  {selectedComp.propDiff.map((d, i) => (
                    <div
                      key={i}
                      style={{
                        background: "#000",
                        padding: "12px",
                        borderRadius: "6px",
                      }}
                    >
                      <div
                        style={{
                          color: THEME.text.accent,
                          fontWeight: 700,
                          fontSize: "12px",
                          marginBottom: "8px",
                        }}
                      >
                        {d.key}
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 20px 1fr",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            color: THEME.text.danger,
                            opacity: 0.8,
                            wordBreak: "break-all",
                          }}
                        >
                          {JSON.stringify(d.prevValue)}
                        </div>
                        <ArrowRight size={12} />
                        <div
                          style={{
                            fontSize: "11px",
                            color: THEME.text.success,
                            wordBreak: "break-all",
                          }}
                        >
                          {JSON.stringify(d.nextValue)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.empty}>No props changed in this render.</div>
              )}
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <div style={styles.sectionTitle}>Recent Updates</div>
              {recentUpdates.map((u, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedId(u.name)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "4px",
                    background: "rgba(255,255,255,0.03)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    border:
                      selectedId === u.name
                        ? `1px solid ${THEME.text.accent}`
                        : "1px solid transparent",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600 }}>
                      {u.name}
                    </span>
                    <span
                      style={{ fontSize: "10px", color: THEME.text.secondary }}
                    >
                      {new Date(u.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "12px",
                        color:
                          u.score > 5 ? THEME.text.danger : THEME.text.success,
                      }}
                    >
                      {u.total}ms
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  iconBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "4px",
    display: "flex",
    alignItems: "center",
  },
  tabBtn: {
    background: "transparent",
    border: "none",
    padding: "6px 10px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    borderRadius: "4px",
  },
  th: {
    padding: "10px 12px",
    fontWeight: 600,
    borderBottom: `1px solid ${THEME.border}`,
  },
  td: { padding: "8px 12px" },
  sectionTitle: {
    fontSize: "10px",
    color: THEME.text.secondary,
    textTransform: "uppercase",
    marginBottom: "12px",
    fontWeight: 800,
    letterSpacing: "0.05em",
  },
  empty: {
    color: THEME.text.secondary,
    padding: "10px",
    fontSize: "12px",
    textAlign: "center",
  },
};

export default App;
