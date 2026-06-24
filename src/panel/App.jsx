import React, { useEffect, useState, useMemo, useRef, useReducer, useCallback } from "react";
import {
  Flame, AlertTriangle, AlertCircle, Info, Minus,
  BrainCircuit, ArrowLeftRight, Globe, CornerUpRight,
  HelpCircle, Square, ChevronDown, ChevronRight, WifiOff,
  MousePointer2, Table2, GitBranch, BarChart3, Clock,
  Lightbulb, History,
  Activity, X, Search, Download, Trash2,
} from "lucide-react";
import { createStyles } from "./styles";
import { themes as themeMap, typography } from "./theme";
import { componentsReducer } from "./componentData";
import { evaluateRules, evaluateAllComponents, CATEGORIES } from "./rulesEngine";

var ICON_SIZE = 16;
var sidebarDefault = 450;
var insightsDebounceMs = 200;
var recentUpdatesMax = 50;

function getCauseIcon(causeType) {
  var props = { size: ICON_SIZE };
  switch (causeType) {
    case "state": return React.createElement(BrainCircuit, props);
    case "props": return React.createElement(ArrowLeftRight, props);
    case "context": return React.createElement(Globe, props);
    case "parent": return React.createElement(CornerUpRight, props);
    default: return React.createElement(HelpCircle, props);
  }
}

function getScoreIcon(score) {
  var props = { size: ICON_SIZE };
  if (score > 500) return React.createElement(AlertTriangle, props);
  if (score > 200) return React.createElement(AlertCircle, props);
  if (score > 50) return React.createElement(Info, props);
  return React.createElement(Minus, props);
}

function getScoreLabel(score) {
  if (score > 500) return { icon: AlertTriangle, label: "Critical" };
  if (score > 200) return { icon: AlertCircle, label: "High" };
  if (score > 50) return { icon: Info, label: "Medium" };
  return { icon: Minus, label: "Low" };
}

function formatRenderCauses(changes) {
  if (!changes || changes.length === 0) return "Parent re-render";
  return changes.map(function (c) {
    if (c.type === "props" && c.keys) return "Props: " + c.keys.join(", ");
    if (c.type === "state") return "State changed";
    if (c.type === "context") return "Context changed";
    if (c.type === "parent") return "Parent re-render";
    return c.type;
  }).join(" \u2022 ");
}

function getHeatmapColor(value, max, heatmap) {
  var intensity = Math.min(value / Math.max(max, 1), 1);
  if (intensity < 0.2) return heatmap[0];
  if (intensity < 0.4) return heatmap[1];
  if (intensity < 0.6) return heatmap[2];
  if (intensity < 0.8) return heatmap[3];
  return heatmap[4];
}

function getTextColor(value, max, isDark) {
  if (isDark) return "#f1f5f9";
  var intensity = Math.min(value / Math.max(max, 1), 1);
  if (intensity < 0.6) return "#065f46";
  if (intensity < 0.8) return "#92400e";
  return "#991b1b";
}

function TreeNode(props) {
  var node = props.node;
  var depth = props.depth;
  var selectedName = props.selectedName;
  var onSelect = props.onSelect;
  var expanded = props.expanded;
  var setExpanded = props.setExpanded;
  var expandedMap = props.expandedMap;
  var s = props.styles;
  var mode = props.colorMode;

  var hasChildren = node.children && node.children.length > 0;
  var isSelected = selectedName === node.name;
  var indent = depth * 20;

  var bg, color;
  if (isSelected) {
    bg = "var(--bg-selected, #1e3a5f)";
    color = "var(--text-accent, #38bdf8)";
  } else if (node.didRender) {
    bg = "var(--bg-tree-render, #422006)";
    color = "var(--text-warning, #fbbf24)";
  } else {
    bg = "transparent";
    color = "var(--text-primary, #0f172a)";
  }

  return React.createElement("div", null,
    React.createElement("div", {
      tabIndex: 0,
      role: "button",
      style: {
        marginLeft: indent + "px",
        padding: "6px 10px",
        background: bg,
        color: color,
        marginBottom: "4px",
        borderRadius: "6px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        transition: "background 0.15s",
      },
      onClick: function () { onSelect(node.name); },
      onKeyDown: function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(node.name); } },
    },
      hasChildren
        ? React.createElement("button", {
            style: { background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: color },
            onClick: function (e) { e.stopPropagation(); setExpanded(!expanded); },
          },
          expanded ? React.createElement(ChevronDown, { size: 14 }) : React.createElement(ChevronRight, { size: 14 }))
        : React.createElement(Square, { size: 14 }),
      getCauseIcon(node.causeType),
      React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, flex: 1, fontSize: "12px" } }, node.name),
      getScoreIcon(node.score),
      React.createElement("span", { style: { fontSize: "11px", color: color, opacity: 0.7 } }, String(node.renderCount)),
    ),
    hasChildren && expanded
      ? React.createElement("div", null,
          (node.children || []).map(function (child) {
            return React.createElement(TreeNode, {
              key: child.key || child.name,
              node: child,
              depth: depth + 1,
              selectedName: selectedName,
              onSelect: onSelect,
              expanded: expandedMap && expandedMap[child.key || child.name],
              setExpanded: setExpanded,
              expandedMap: expandedMap,
              styles: s,
              colorMode: mode,
            });
          })
        )
      : null
  );
}

export default function App() {
  var _useState = useState("light");
  var colorMode = _useState[0];
  var setColorMode = _useState[1];
  var _useState2 = useState(null);
  var selectedComponent = _useState2[0];
  var setSelectedComponent = _useState2[1];
  var _useState3 = useState([]);
  var recentUpdates = _useState3[0];
  var setRecentUpdates = _useState3[1];
  var _useState4 = useState([]);
  var globalStats = _useState4[0];
  var setGlobalStats = _useState4[1];
  var _useState5 = useState(null);
  var componentTree = _useState5[0];
  var setComponentTree = _useState5[1];
  var _useState6 = useState([]);
  var timeline = _useState6[0];
  var setTimeline = _useState6[1];
  var _useState7 = useState("table");
  var viewMode = _useState7[0];
  var setViewMode = _useState7[1];
  var _useState8 = useState(0);
  var timelineIndex = _useState8[0];
  var setTimelineIndex = _useState8[1];
  var _useState9 = useState([]);
  var autoInsights = _useState9[0];
  var setAutoInsights = _useState9[1];
  var _useState10 = useState(sidebarDefault);
  var sidebarWidth = _useState10[0];
  var setSidebarWidth = _useState10[1];
  var _useState11 = useState(false);
  var isResizing = _useState11[0];
  var setIsResizing = _useState11[1];
  var _useState12 = useState(false);
  var isConnected = _useState12[0];
  var setIsConnected = _useState12[1];
  var _useState13 = useState("");
  var searchQuery = _useState13[0];
  var setSearchQuery = _useState13[1];
  var _useState14 = useState("all");
  var patternFilter = _useState14[0];
  var setPatternFilter = _useState14[1];
  var _useState15 = useState(false);
  var showResetMenu = _useState15[0];
  var setShowResetMenu = _useState15[1];
  var _useState16 = useState({});
  var treeExpanded = _useState16[0];
  var setTreeExpanded = _useState16[1];
  var _useState17 = useState(false);
  var liveFeedExpanded = _useState17[0];
  var setLiveFeedExpanded = _useState17[1];
  var _useState18 = useState(null);
  var expandedRule = _useState18[0];
  var setExpandedRule = _useState18[1];
  var _useState19 = useState(0);
  var renderCount = _useState19[0];
  var setRenderCount = _useState19[1];

  var _useReducer = useReducer(componentsReducer, {});
  var components = _useReducer[0];
  var dispatch = _useReducer[1];

  var insightsTimerRef = useRef(null);
  var updatesRef = useRef([]);
  var searchRef = useRef(null);
  var themeStyleRef = useRef(null);

  var s = useMemo(function () {
    return createStyles(colorMode);
  }, [colorMode]);

  var heatmap = useMemo(function () {
    return colorMode === "dark"
      ? ["#064e3b", "#065f46", "#78350f", "#7c2d12", "#7f1d1d"]
      : ["#ecfdf5", "#d1fae5", "#fef3c7", "#fed7aa", "#fecaca"];
  }, [colorMode]);

  function applyThemeVars(mode) {
    var t = themeMap[mode] || themeMap.light;
    if (!themeStyleRef.current) {
      var style = document.createElement("style");
      style.id = "rt-theme";
      document.head.appendChild(style);
      themeStyleRef.current = style;
    }
    themeStyleRef.current.textContent = ":root { --bg-app: " + t.bg.app + "; --bg-surface: " + t.bg.surface + "; --bg-header: " + t.bg.header + "; --bg-sidebar: " + t.bg.sidebar + "; --bg-hover: " + t.bg.hover + "; --bg-selected: " + t.bg.selected + "; --bg-insight: " + t.bg.insight + "; --bg-insight-critical: " + t.bg.insightCritical + "; --bg-tree-render: " + t.bg.treeRender + "; --bg-card: " + t.bg.card + "; --text-primary: " + t.text.primary + "; --text-secondary: " + t.text.secondary + "; --text-muted: " + t.text.muted + "; --text-accent: " + t.text.accent + "; --text-danger: " + t.text.danger + "; --text-warning: " + t.text.warning + "; --text-success: " + t.text.success + "; --border: " + t.border + "; --accent: " + t.accent + "; }";
  }

  useEffect(function () {
    applyThemeVars(colorMode);
  }, [colorMode]);

  useEffect(function () {
    var mq;
    function onThemeChange(isDark) {
      setColorMode(isDark ? "dark" : "light");
    }

    try {
      if (chrome.devtools && chrome.devtools.panels && chrome.devtools.panels.themeName) {
        setColorMode(chrome.devtools.panels.themeName === "dark" ? "dark" : "light");
      } else {
        mq = window.matchMedia("(prefers-color-scheme: dark)");
        onThemeChange(mq.matches);
        mq.addEventListener("change", function (e) { onThemeChange(e.matches); });
      }
    } catch (e) {
      mq = window.matchMedia("(prefers-color-scheme: dark)");
      onThemeChange(mq.matches);
    }

    var port;

    function initFromWindow() {
      if (window.portPromise) {
        window.portPromise.then(function (p) {
          port = p;
          setIsConnected(true);

          port.onMessage.addListener(function (message) {
            try {
              if (!message || message.type !== "FOR_DEVTOOLS" || !message.payload) return;

              var payload = message.payload;
              var updates = payload.currentCommitUpdates;
              if (!Array.isArray(updates)) return;

              var tree = payload.componentTree;
              var timelineData = payload.timeline || [];
              var stats = payload.globalStats || [];

              dispatch({ type: "UPDATE", updates: updates });
              setRenderCount(function (c) { return c + 1; });

              updatesRef.current = updates;

              setRecentUpdates(function (prev) {
                var newUpdates = [];
                for (var i = 0; i < updates.length; i++) {
                  newUpdates.push({
                    ...updates[i],
                    id: updates[i].name + "-" + Date.now() + "-" + Math.random(),
                  });
                }
                return newUpdates.concat(prev).slice(0, recentUpdatesMax);
              });

              if (tree) setComponentTree(tree);
              if (timelineData.length > 0) {
                setTimeline(timelineData);
                setTimelineIndex(timelineData.length - 1);
              }
              if (stats.length > 0) setGlobalStats(stats);

              if (insightsTimerRef.current) clearTimeout(insightsTimerRef.current);
              insightsTimerRef.current = setTimeout(function () {
                generateInsights(updates);
              }, insightsDebounceMs);
            } catch (e) {
              console.error("[App] Message handler error:", e);
            }
          });
        });
      }
    }

    initFromWindow();

    return function () {
      if (insightsTimerRef.current) clearTimeout(insightsTimerRef.current);
      if (mq && typeof mq.removeEventListener === "function") {
        mq.removeEventListener("change", onThemeChange);
      }
    };
  }, []);

  useEffect(function () {
    function onKeyDown(e) {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        var tag = document.activeElement && document.activeElement.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
          e.preventDefault();
          if (searchRef.current) searchRef.current.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return function () { document.removeEventListener("keydown", onKeyDown); };
  }, []);

  function generateInsights(updates) {
    var insights = [];
    for (var i = 0; i < updates.length; i++) {
      var u = updates[i];
      var rules = evaluateRules(u, null);
      for (var j = 0; j < rules.length; j++) {
        var r = rules[j];
        insights.push({
          key: u.name + "-" + r.id,
          type: r.id,
          severity: r.severity,
          component: u.name,
          category: r.categoryName,
          message: r.message,
          suggestion: r.suggestion,
          impact: r.impact,
          confidence: r.confidence,
          timestamp: Date.now(),
        });
      }
    }

    setAutoInsights(function (prev) {
      var combined = insights.concat(prev);
      var seen = {};
      var unique = [];
      for (var i = 0; i < combined.length; i++) {
        if (seen[combined[i].key]) continue;
        seen[combined[i].key] = true;
        unique.push(combined[i]);
      }
      return unique.slice(0, 20);
    });
  }

  var allPatternTypes = useMemo(function () {
    var types = { all: true };
    var entries = Object.entries(components);
    for (var i = 0; i < entries.length; i++) {
      var stats = entries[i][1];
      if (stats.patterns) {
        for (var j = 0; j < stats.patterns.length; j++) {
          types[stats.patterns[j].type] = true;
        }
      }
    }
    return Object.keys(types);
  }, [components]);

  var sortedComponents = useMemo(function () {
    var entries = Object.entries(components);
    var result = [];
    for (var i = 0; i < entries.length; i++) {
      var name = entries[i][0];
      var stats = entries[i][1];
      if (searchQuery && name.toLowerCase().indexOf(searchQuery.toLowerCase()) === -1) continue;
      if (patternFilter !== "all" && (!stats.patterns || !stats.patterns.some(function (p) { return p.type === patternFilter; }))) continue;
      result.push([name, stats]);
    }
    result.sort(function (a, b) { return b[1].score - a[1].score; });
    for (var i = 0; i < result.length; i++) {
      result[i][1]._rules = evaluateRules(result[i][1], result[i][1]);
    }
    return result;
  }, [components, searchQuery, patternFilter]);

  var maxScore = useMemo(function () {
    var m = 0;
    for (var i = 0; i < sortedComponents.length; i++) {
      if (sortedComponents[i][1].score > m) m = sortedComponents[i][1].score;
    }
    return m;
  }, [sortedComponents]);

  var maxRenders = useMemo(function () {
    var m = 0;
    for (var i = 0; i < sortedComponents.length; i++) {
      if (sortedComponents[i][1].renders > m) m = sortedComponents[i][1].renders;
    }
    return m;
  }, [sortedComponents]);

  var maxExclusive = useMemo(function () {
    var m = 0;
    for (var i = 0; i < sortedComponents.length; i++) {
      if (sortedComponents[i][1].exclusive > m) m = sortedComponents[i][1].exclusive;
    }
    return m;
  }, [sortedComponents]);

  var selectedData = useMemo(function () {
    if (!selectedComponent) return null;
    return components[selectedComponent] || null;
  }, [components, selectedComponent]);

  var matchedRules = useMemo(function () {
    if (!selectedData) return [];
    return evaluateRules(selectedData, selectedData);
  }, [selectedData]);

  var handleExport = useCallback(function () {
    var comps = components;
    var totalRenders = 0;
    var entries = Object.entries(comps);
    var topByScore = [].concat(entries).sort(function (a, b) { return b[1].score - a[1].score; }).slice(0, 10);
    var topByRenders = [].concat(entries).sort(function (a, b) { return b[1].renders - a[1].renders; }).slice(0, 10);
    for (var i = 0; i < entries.length; i++) { totalRenders += entries[i][1].renders || 0; }

    // Aggregate rules across all components
    var ruleAgg = {};
    for (var i = 0; i < entries.length; i++) {
      var stats = entries[i][1];
      var rules = evaluateRules(stats, stats);
      for (var j = 0; j < rules.length; j++) {
        var key = rules[j].id + "-" + entries[i][0];
        ruleAgg[key] = { rule: rules[j].id, name: rules[j].name, severity: rules[j].severity, component: entries[i][0], suggestion: rules[j].suggestion, confidence: rules[j].confidence };
      }
    }

    var data = {
      exportedAt: new Date().toISOString(),
      tool: "React Render Tracker",
      sessionSummary: {
        totalComponents: Object.keys(comps).length,
        totalRenders: totalRenders,
        totalCommits: renderCount,
        topByScore: topByScore.map(function (e) { return { name: e[0], score: e[1].score, renders: e[1].renders, exclusive: e[1].exclusive }; }),
        topByRenders: topByRenders.map(function (e) { return { name: e[0], renders: e[1].renders, score: e[1].score }; }),
        totalMatchedRules: Object.keys(ruleAgg).length,
      },
      components: comps,
      matchedRules: ruleAgg,
      timeline: timeline,
      globalStats: globalStats,
      autoInsights: autoInsights,
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "render-tracker-report-" + Date.now() + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }, [components, timeline, globalStats, autoInsights, renderCount]);

  var handleResetPartial = useCallback(function (type) {
    setShowResetMenu(false);
    switch (type) {
      case "all":
        dispatch({ type: "RESET" });
        setRecentUpdates([]);
        setAutoInsights([]);
        setTimeline([]);
        setComponentTree(null);
        setSelectedComponent(null);
        break;
      case "timeline":
        setTimeline([]);
        setTimelineIndex(0);
        break;
      case "insights":
        setAutoInsights([]);
        break;
    }
  }, []);

  var handleMouseDown = useCallback(function (e) {
    e.preventDefault();
    setIsResizing(true);
    var startX = e.clientX;
    var startWidth = sidebarWidth;

    function onMouseMove(e2) {
      var newWidth = startWidth - (e2.clientX - startX);
      if (newWidth < 350) newWidth = 350;
      if (newWidth > 800) newWidth = 800;
      setSidebarWidth(newWidth);
    }

    function onMouseUp() {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [sidebarWidth]);

  function renderEmptyState(icon, title, subtitle) {
    return React.createElement("div", { style: s.emptyState },
      icon,
      React.createElement("p", null, title),
      subtitle ? React.createElement("p", { style: { fontSize: "11px", marginTop: "8px" } }, subtitle) : null
    );
  }

  function renderTableView() {
    if (sortedComponents.length === 0) {
      return renderEmptyState(
        React.createElement(Clock, { size: 48 }),
        "No render data yet",
        "Interact with your React app — click buttons, navigate, update state"
      );
    }

    return React.createElement("table", { style: s.table },
      React.createElement("thead", null,
        React.createElement("tr", null,
          React.createElement("th", { style: s.th }, "Component"),
          React.createElement("th", { style: s.thCenter }, "Score"),
          React.createElement("th", { style: s.thRight }, "Renders"),
          React.createElement("th", { style: s.thRight, title: "Renders unique to this component, excluding children" }, "Exclusive"),
          React.createElement("th", { style: s.thCenter }, "Root"),
          React.createElement("th", { style: s.th }, "Patterns"),
        )
      ),
      React.createElement("tbody", null,
        sortedComponents.map(function (entry) {
          var name = entry[0];
          var stats = entry[1];
          var isSelected = selectedComponent === name;
          return React.createElement("tr", {
            key: name,
            tabIndex: 0,
            role: "button",
            onClick: function () { setSelectedComponent(name); },
            onKeyDown: function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedComponent(name); } },
            style: s.tableRow(isSelected),
          },
            React.createElement("td", { style: { ...s.tdMono, fontWeight: 500, color: isSelected ? "var(--text-accent, #38bdf8)" : undefined } }, name),
            React.createElement("td", { style: { ...s.td, textAlign: "center", fontSize: "16px" } },
              React.createElement(getScoreLabel(stats.score).icon, { size: ICON_SIZE })
            ),
            React.createElement("td", { style: { ...s.td, textAlign: "right", background: getHeatmapColor(stats.renders, maxRenders, heatmap), color: getTextColor(stats.renders, maxRenders, colorMode === "dark"), fontWeight: 500 } }, String(stats.renders)),
            React.createElement("td", { style: { ...s.td, textAlign: "right", background: getHeatmapColor(stats.exclusive, maxExclusive, heatmap), color: getTextColor(stats.exclusive, maxExclusive, colorMode === "dark"), fontWeight: 600 } }, String(stats.exclusive)),
            React.createElement("td", { style: { ...s.td, textAlign: "center", fontSize: "16px" } },
              stats.rootCause ? getCauseIcon(stats.rootCause.causeType) : React.createElement("span", null, "\u2014")
            ),
            React.createElement("td", { style: { ...s.td, fontSize: "11px" } },
              stats._rules && stats._rules.length > 0
                ? React.createElement("div", { style: { display: "flex", gap: "4px", flexWrap: "wrap" } },
                    stats._rules.slice(0, 2).map(function (r, i) {
                      return React.createElement("span", { key: i, style: s.chip(r.severity) }, r.id);
                    })
                  )
                : React.createElement("span", { style: { color: "var(--text-muted, #94a3b8)" } }, "\u2014")
            )
          );
        })
      )
    );
  }

  function renderTreeView() {
    if (!componentTree) {
      return renderEmptyState(
        React.createElement(GitBranch, { size: 48 }),
        "No component tree data yet"
      );
    }
    return React.createElement("div", { style: { padding: "16px" } },
      React.createElement("h3", { style: s.sectionTitle },
        React.createElement(GitBranch, { size: ICON_SIZE }),
        " Component Tree"
      ),
      React.createElement(TreeNode, {
        node: componentTree,
        depth: 0,
        selectedName: selectedComponent,
        onSelect: setSelectedComponent,
        expanded: treeExpanded[componentTree.key || componentTree.name],
        setExpanded: function (val) {
          var key = componentTree.key || componentTree.name;
          setTreeExpanded(function (prev) { return { ...prev, [key]: val }; });
        },
        expandedMap: treeExpanded,
        styles: s,
        colorMode: colorMode,
      })
    );
  }

  function renderFlamegraphView() {
    if (sortedComponents.length === 0) {
      return renderEmptyState(
        React.createElement("p", null, "No data to visualize")
      );
    }
    return React.createElement("div", { style: { padding: "16px" } },
      React.createElement("h3", { style: s.sectionTitle },
        React.createElement(BarChart3, { size: ICON_SIZE }),
        " Flamegraph (by Render Score)"
      ),
      React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "4px" } },
        sortedComponents.map(function (entry) {
          var name = entry[0];
          var stats = entry[1];
          var pct = (stats.score / Math.max(maxScore, 1)) * 100;
          var intensity = stats.score / Math.max(maxScore, 1);
          var color = intensity > 0.7 ? "var(--text-danger, #ef4444)" : intensity > 0.4 ? "var(--text-warning, #f59e0b)" : "var(--text-success, #22c55e)";
          return React.createElement("div", {
            key: name,
            onClick: function () { setSelectedComponent(name); },
            role: "button",
            tabIndex: 0,
            title: name + ": score " + stats.score,
            style: { cursor: "pointer" },
            onKeyDown: function (e) { if (e.key === "Enter") setSelectedComponent(name); },
          },
            React.createElement("div", {
              style: s.flamegraphBar(pct, color),
              onMouseEnter: function (e) { e.currentTarget.style.opacity = "0.8"; },
              onMouseLeave: function (e) { e.currentTarget.style.opacity = "1"; },
            },
              React.createElement("span", { style: { color: "#fff", fontSize: "11px", fontWeight: 600, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                name + " (" + stats.score + ")"
              )
            )
          );
        })
      )
    );
  }

  function renderTimelineView() {
    if (timeline.length === 0) {
      return renderEmptyState(
        React.createElement(Clock, { size: 48 }),
        "No timeline data yet"
      );
    }
    return React.createElement("div", { style: { padding: "16px" } },
      React.createElement("h3", { style: s.sectionTitle },
        React.createElement(Clock, { size: ICON_SIZE }),
        " Render Timeline"
      ),
      React.createElement("div", { style: s.spaceY(6) },
        timeline.map(function (entry, idx) {
          return React.createElement("div", { key: idx, style: s.timelineEntry },
            React.createElement("div", { style: s.flexRow },
              React.createElement("span", { style: { fontWeight: 600 } }, "Commit #" + entry.commitId),
              React.createElement("span", { style: { color: "var(--text-secondary, #64748b)" } }, new Date(entry.timestamp).toLocaleTimeString())
            ),
            React.createElement("div", { style: { color: "var(--text-secondary, #64748b)", marginTop: "4px" } },
              entry.updates.length + " component" + (entry.updates.length !== 1 ? "s" : "") + " updated"
            ),
            entry.updates.length > 0
              ? React.createElement("div", { style: { display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" } },
                  entry.updates.slice(0, 10).map(function (u, i) {
                    var pillBg = u.exclusive > 10 ? "var(--bg-insight-critical, #450a0a)" : u.exclusive > 5 ? "var(--bg-insight, #422006)" : "var(--bg-surface, #1e293b)";
                    var pillColor = u.exclusive > 10 ? "var(--text-danger, #f87171)" : u.exclusive > 5 ? "var(--text-warning, #fbbf24)" : "var(--text-secondary, #94a3b8)";
                    return React.createElement("span", {
                      key: i,
                      onClick: function () { setSelectedComponent(u.name); },
                      style: s.pill(pillBg, pillColor),
                    }, u.name + " (" + u.exclusive + ")");
                  }),
                  entry.updates.length > 10
                    ? React.createElement("span", { style: { fontSize: "10px", color: "var(--text-muted, #94a3b8)", alignSelf: "center" } }, "+" + (entry.updates.length - 10) + " more")
                    : null
                )
              : null
          );
        })
      )
    );
  }

  function renderSessionView() {
    var sortedByRenders = Object.entries(components).sort(function (a, b) { return b[1].renders - a[1].renders; });
    var sortedByExclusive = Object.entries(components).sort(function (a, b) { return b[1].exclusive - a[1].exclusive; });
    var sortedByScore = Object.entries(components).sort(function (a, b) { return b[1].score - a[1].score; });
    var totalRenders = 0;
    for (var i = 0; i < sortedByRenders.length; i++) { totalRenders += sortedByRenders[i][1].renders || 0; }

    // Aggregate top rules across all components
    var allRules = {};
    var entries = Object.entries(components);
    for (var i = 0; i < entries.length; i++) {
      var stats = entries[i][1];
      var rules = evaluateRules(stats, stats);
      for (var j = 0; j < rules.length; j++) {
        var key = rules[j].id;
        if (!allRules[key]) allRules[key] = { id: key, name: rules[j].name, severity: rules[j].severity, count: 0, components: [] };
        allRules[key].count++;
        if (allRules[key].components.length < 5) allRules[key].components.push(entries[i][0]);
      }
    }
    var topRules = Object.values(allRules).sort(function (a, b) { return b.count - a.count; }).slice(0, 8);

    return React.createElement("div", { style: { overflow: "auto", height: "100%" } },
      React.createElement("div", { style: { padding: "16px", display: "flex", flexDirection: "column", gap: "16px" } },
        // Overview stats
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" } },
          React.createElement("div", { style: s.statCell },
            React.createElement("div", { style: s.statLabel }, "Components"),
            React.createElement("div", { style: s.statValue }, String(Object.keys(components).length))
          ),
          React.createElement("div", { style: s.statCell },
            React.createElement("div", { style: s.statLabel }, "Commits"),
            React.createElement("div", { style: s.statValue }, String(renderCount))
          ),
          React.createElement("div", { style: s.statCell },
            React.createElement("div", { style: s.statLabel }, "Total Renders"),
            React.createElement("div", { style: s.statValue }, String(totalRenders))
          )
        ),
        // Top rules this session
        topRules.length > 0
          ? React.createElement("div", null,
              React.createElement("h4", { style: s.sectionTitle },
                React.createElement(Lightbulb, { size: 12 }),
                " Top Rules This Session"
              ),
              React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "4px", marginTop: "8px" } },
                topRules.map(function (r, i) {
                  return React.createElement("div", { key: r.id, style: { display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", background: "var(--bg-surface)", borderRadius: "6px", fontSize: "12px" } },
                    React.createElement("span", { style: { color: "var(--text-muted)", width: "20px", textAlign: "right", fontSize: "11px" } }, String(i + 1)),
                    React.createElement("span", { style: s.chip(r.severity) }, r.id),
                    React.createElement("span", { style: { flex: 1 } }, r.name),
                    React.createElement("span", { style: { color: "var(--text-muted)", fontSize: "11px" } }, String(r.count) + " component" + (r.count !== 1 ? "s" : ""))
                  );
                })
              )
            )
          : null,
        // Top components by score
        React.createElement("div", null,
          React.createElement("h4", { style: s.sectionTitle },
            React.createElement(Flame, { size: 12 }),
            " Top by Render Score"
          ),
          React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "2px", marginTop: "8px" } },
            sortedByScore.slice(0, 10).map(function (entry, i) {
              var name = entry[0];
              var s2 = entry[1];
              var pct = maxScore > 0 ? (s2.score / maxScore) * 100 : 0;
              return React.createElement("div", {
                key: name, onClick: function () { setSelectedComponent(name); },
                style: { display: "flex", alignItems: "center", gap: "8px", padding: "4px 10px", cursor: "pointer", borderRadius: "4px", fontSize: "12px" }
              },
                React.createElement("span", { style: { color: "var(--text-muted)", width: "20px", textAlign: "right", fontSize: "11px" } }, String(i + 1)),
                React.createElement("div", { style: { flex: 1, height: "18px", background: "var(--bg-surface)", borderRadius: "3px", overflow: "hidden", display: "flex", alignItems: "center" } },
                  React.createElement("div", { style: { width: Math.max(pct, 2) + "%", height: "100%", background: s2.score > 500 ? "var(--text-danger)" : s2.score > 200 ? "var(--text-warning)" : "var(--text-success)", borderRadius: "3px", display: "flex", alignItems: "center", paddingLeft: "4px" } },
                    React.createElement("span", { style: { color: "#fff", fontSize: "10px", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, name)
                  )
                ),
                React.createElement("span", { style: { fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "var(--text-muted)", width: "40px", textAlign: "right" } }, String(s2.score))
              );
            })
          )
        )
      )
    );
  }

  function renderDetailPanel() {
    if (!selectedData) {
      return React.createElement("div", { style: { padding: "24px", textAlign: "center", color: "var(--text-muted, #94a3b8)" } },
        React.createElement(MousePointer2, { size: 28, style: { margin: "0 auto 8px", display: "block", opacity: 0.5 } }),
        React.createElement("div", { style: { fontSize: "11px" } }, "Select a component"),
        React.createElement("div", { style: { fontSize: "10px", marginTop: "4px" } }, "Click a row in the table or tree")
      );
    }

    var label = getScoreLabel(selectedData.score);

    return React.createElement("div", null,
      React.createElement("div", { style: s.detailSection },
        React.createElement("div", { style: s.flexRow },
          React.createElement("span", { style: { fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" } },
            React.createElement(label.icon, { size: 13 }),
            " " + selectedComponent
          ),
          React.createElement("button", { onClick: function () { setSelectedComponent(null); }, style: s.btnGhost },
            React.createElement(X, { size: 14 })
          )
        )
      ),
      React.createElement("div", { style: s.detailSection },
        React.createElement("div", { style: s.statGrid },
          React.createElement("div", { style: s.statCell },
            React.createElement("div", { style: s.statLabel }, "Renders"),
            React.createElement("div", { style: s.statValue }, String(selectedData.renders))
          ),
          React.createElement("div", { style: s.statCell },
            React.createElement("div", { style: s.statLabel, title: "Renders unique to this component, excluding children" }, "Exclusive"),
            React.createElement("div", { style: s.statValue }, String(selectedData.exclusive))
          ),
          React.createElement("div", { style: s.statCell },
            React.createElement("div", { style: s.statLabel }, "Score"),
            React.createElement("div", { style: { ...s.statValue, color: getTextColor(selectedData.score, 500, colorMode === "dark") } }, String(selectedData.score))
          ),
          React.createElement("div", { style: s.statCell },
            React.createElement("div", { style: s.statLabel }, "Total"),
            React.createElement("div", { style: s.statValue }, String(selectedData.total))
          )
        )
      ),
      matchedRules.length > 0
        ? React.createElement("div", { style: s.detailSection },
            React.createElement("h4", { style: s.sectionTitle },
              React.createElement(Lightbulb, { size: 12 }),
              " Matched Rules (" + matchedRules.length + ")"
            ),
            matchedRules.map(function (r, i) {
              var isExpanded = expandedRule === i;
              var isPropRule = r.id === "unstable-function-prop" || r.id === "object-prop-instability" || r.id === "all-props-changing";
              var isChainRule = r.id === "wasted-chain" || r.id === "partial-wasted-chain" || r.id === "deep-propagation" || r.id === "context-explosion" || r.id === "prop-cascade";
              return React.createElement("div", { key: i, style: { cursor: "pointer", ...s.insightCard(r.severity) }, onClick: function () { setExpandedRule(isExpanded ? null : i); } },
                React.createElement("div", { style: { fontWeight: 600, fontSize: "11px", marginBottom: "2px", display: "flex", alignItems: "center", gap: "4px", justifyContent: "space-between" } },
                  React.createElement("span", null, r.name),
                  React.createElement("span", { style: { fontSize: "9px", color: "var(--text-muted)", fontWeight: 400 } }, r.categoryName)
                ),
                React.createElement("div", { style: { fontSize: "11px", marginBottom: "4px" } }, r.message),
                React.createElement("div", { style: s.insightSuggestion }, r.suggestion),
                React.createElement("div", { style: { display: "flex", gap: "8px", fontSize: "10px", marginTop: "4px", color: "var(--text-muted)", alignItems: "center" } },
                  React.createElement("span", null, "Confidence: " + r.confidence + "%"),
                  r.impact ? React.createElement("span", null, r.impact) : null,
                  r.docsRef ? React.createElement("a", { href: r.docsRef, target: "_blank", style: { marginLeft: "auto", color: "var(--text-accent)", textDecoration: "none", fontSize: "10px" }, onClick: function (e) { e.stopPropagation(); } }, "Docs \u2197") : null
                ),
                isExpanded && isPropRule && selectedData.propDiff && selectedData.propDiff.length > 0
                  ? React.createElement("div", { style: { marginTop: "8px", padding: "6px", background: "var(--bg-app)", borderRadius: "4px", fontSize: "10px" } },
                      React.createElement("div", { style: { fontWeight: 600, marginBottom: "4px", color: "var(--text-secondary)" } }, "Trigger Data"),
                      selectedData.propDiff.slice(0, 5).map(function (d, j) {
                        return React.createElement("div", { key: j, style: { display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px solid var(--border)" } },
                          React.createElement("span", { style: { color: "var(--text-accent)", fontFamily: "'JetBrains Mono', monospace" } }, d.key),
                          React.createElement("span", { style: { color: "var(--text-muted)" } }, d.type + (d.isFunctionRefChange ? " (fn ref)" : ""))
                        );
                      })
                    )
                  : null,
                isExpanded && isChainRule && selectedData.causeChain && selectedData.causeChain.length > 0
                  ? React.createElement("div", { style: { marginTop: "8px", padding: "6px", background: "var(--bg-app)", borderRadius: "4px", fontSize: "10px" } },
                      React.createElement("div", { style: { fontWeight: 600, marginBottom: "4px", color: "var(--text-secondary)" } }, "Cause Chain"),
                      selectedData.causeChain.map(function (link, j) {
                        return React.createElement("div", { key: j, style: { display: "flex", justifyContent: "space-between", padding: "2px 0" } },
                          React.createElement("span", null, link.name),
                          React.createElement("span", { style: link.causeType !== "parent" ? { color: "var(--text-warning)" } : { color: "var(--text-muted)" } }, link.causeType)
                        );
                      })
                    )
                  : null
              );
            })
          )
        : null,
      selectedData.causeChain && selectedData.causeChain.length > 0
        ? React.createElement("div", { style: s.detailSection },
            React.createElement("h4", { style: s.sectionTitle },
              React.createElement(GitBranch, { size: 12 }),
              " Cause Chain (" + selectedData.causeChain.length + ")"
            ),
            selectedData.causeChain.map(function (link, i) {
              var isRoot = link.causeType !== "parent";
              return React.createElement("div", { key: i, style: s.causeStep(isRoot) },
                i > 0 ? React.createElement("span", { style: s.causeArrow }, "\u203A") : null,
                React.createElement("span", { style: { fontWeight: isRoot ? 600 : 400, fontSize: "11px" } }, link.name),
                React.createElement("span", { style: { marginLeft: "auto", ...s.chip(isRoot ? "high" : "low") } }, link.causeType)
              );
            })
          )
        : null,
      selectedData.propDiff && selectedData.propDiff.length > 0
        ? React.createElement("div", { style: s.detailSection },
            React.createElement("h4", { style: s.sectionTitle },
              React.createElement(ArrowLeftRight, { size: 12 }),
              " Props (" + selectedData.propDiff.length + ")"
            ),
            selectedData.propDiff.slice(0, 8).map(function (diff, i) {
              return React.createElement("div", { key: i, style: s.propDiffItem },
                React.createElement("div", { style: s.flexRow },
                  React.createElement("span", { style: s.propKey }, diff.key),
                  React.createElement("span", { style: s.chip(diff.isFunctionRefChange ? "critical" : "low") },
                    diff.isFunctionRefChange ? "fn ref" : diff.type
                  )
                ),
                diff.prevValue !== undefined
                  ? React.createElement("div", { style: { fontSize: "10px", marginTop: "1px" } },
                      React.createElement("span", { style: { color: "var(--text-muted)" } }, "was "),
                      React.createElement("span", { style: s.propValue }, String(diff.prevValue).slice(0, 40))
                    )
                  : null,
                diff.nextValue !== undefined
                  ? React.createElement("div", { style: { fontSize: "10px" } },
                      React.createElement("span", { style: { color: "var(--text-muted)" } }, "now "),
                      React.createElement("span", { style: s.propChange }, String(diff.nextValue).slice(0, 40))
                    )
                  : null
              );
            })
          )
        : null,
      selectedData.history && selectedData.history.length > 0
        ? React.createElement("div", { style: { ...s.detailSection, borderBottom: "none" } },
            React.createElement("h4", { style: s.sectionTitle },
              React.createElement(History, { size: 12 }),
              " History (" + selectedData.history.length + ")"
            ),
            [].concat(selectedData.history).reverse().map(function (h, i) {
              return React.createElement("div", { key: i, style: s.historyEvent() },
                React.createElement("div", { style: s.flexRow },
                  React.createElement("span", { style: { fontWeight: 600, fontSize: "11px" } }, "Ex: " + h.exclusive + "  T: " + h.total),
                  React.createElement("span", { style: { fontSize: "10px", color: "var(--text-muted)" } }, new Date(h.timestamp).toLocaleTimeString())
                )
              );
            })
          )
        : null
    );
  }

  return React.createElement("div", { style: s.app },
    React.createElement("div", { style: s.topBar },
      React.createElement("div", { style: s.topBarLeft },
        React.createElement(Flame, { size: 14 }),
        React.createElement("span", { style: s.topBarTitle }, "Render Tracker"),
        React.createElement("span", { style: { width: "6px", height: "6px", borderRadius: "50%", background: isConnected ? "#4ade80" : "#f87171", flexShrink: 0 } })
      ),
      React.createElement("div", { style: s.topBarCenter },
        [
          { id: "table", icon: Table2, label: "Table" },
          { id: "tree", icon: GitBranch, label: "Tree" },
          { id: "session", icon: Activity, label: "Session" },
          { id: "flamegraph", icon: BarChart3, label: "Flame" },
          { id: "timeline", icon: Clock, label: "Timeline" },
        ].map(function (v) {
          var Icon = v.icon;
          return React.createElement("button", {
            key: v.id,
            style: s.tabBtn(viewMode === v.id),
            onClick: function () { setViewMode(v.id); },
            title: v.label,
          },
            React.createElement(Icon, { size: 12 }),
            " " + v.label
          );
        })
      ),
      React.createElement("div", { style: s.topBarRight },
        React.createElement("div", { style: s.flexCenter },
          React.createElement(Search, { size: 12, style: { color: "var(--text-muted)" } }),
          React.createElement("input", {
            ref: searchRef,
            placeholder: "Search...",
            value: searchQuery,
            onChange: function (e) { setSearchQuery(e.target.value); },
            style: s.searchInput,
          })
        ),
        viewMode === "table" ? React.createElement("select", {
          value: patternFilter,
          onChange: function (e) { setPatternFilter(e.target.value); },
          style: s.select,
        },
          allPatternTypes.map(function (type) {
            return React.createElement("option", { key: type, value: type },
              type === "all" ? "All" : type
            );
          })
        ) : null,
        React.createElement("button", { onClick: handleExport, style: s.btnGhost, title: "Export" },
          React.createElement(Download, { size: 13 })
        ),
        React.createElement("div", { style: { position: "relative" } },
          React.createElement("button", {
            onClick: function () { setShowResetMenu(!showResetMenu); },
            style: s.btnDanger,
          },
            React.createElement(Trash2, { size: 12 })
          ),
          showResetMenu ? React.createElement("div", { style: s.dropdownMenu },
            React.createElement("button", { style: s.dropdownItem(true), onClick: function () { handleResetPartial("all"); } },
              React.createElement(Trash2, { size: 12 }),
              " Clear all"
            ),
            React.createElement("button", { style: s.dropdownItem(false), onClick: function () { handleResetPartial("timeline"); } },
              React.createElement(Clock, { size: 12 }),
              " Clear timeline"
            ),
            React.createElement("button", { style: s.dropdownItem(false), onClick: function () { handleResetPartial("insights"); } },
              React.createElement(Lightbulb, { size: 12 }),
              " Clear insights"
            )
          ) : null
        )
      )
    ),
    React.createElement("div", { style: s.mainArea },
      React.createElement("div", { style: s.contentArea },
        !isConnected
          ? renderEmptyState(
              React.createElement(WifiOff, { size: 36 }),
              "Waiting for connection...",
              "Open DevTools on any React app (F12). If no data appears, refresh the page with DevTools open."
            )
          : viewMode === "table" ? renderTableView()
          : viewMode === "tree" ? renderTreeView()
          : viewMode === "session" ? renderSessionView()
          : viewMode === "flamegraph" ? renderFlamegraphView()
          : viewMode === "timeline" ? renderTimelineView()
          : null
      ),
      React.createElement("div", {
        style: s.resizeHandle,
        onMouseDown: handleMouseDown,
      }),
      React.createElement("div", { style: s.sidebarOuter(sidebarWidth) },
        React.createElement("div", { style: s.sidebarMain }, renderDetailPanel()),
        React.createElement("div", { style: s.liveFeedOuter },
          React.createElement("div", {
            style: s.liveFeedHeader,
            onClick: function () { setLiveFeedExpanded(!liveFeedExpanded); },
          },
            React.createElement(Activity, { size: 12 }),
            " Live Updates",
            recentUpdates.length > 0 ? React.createElement("span", { style: { fontSize: "10px", color: "var(--text-muted)", marginLeft: "4px" } }, "(" + recentUpdates.length + ")") : null,
            React.createElement("span", { style: { marginLeft: "auto", fontSize: "10px" } }, liveFeedExpanded ? "\u25BC" : "\u25B6")
          ),
          liveFeedExpanded ? React.createElement("div", { style: s.liveFeedContent },
            recentUpdates.length === 0
              ? React.createElement("div", { style: { padding: "12px", textAlign: "center", fontSize: "11px", color: "var(--text-muted)" } }, "No recent activity")
              : React.createElement("div", { style: { padding: "4px" } },
                  recentUpdates.map(function (update) {
                    var rules = evaluateRules(update, null);
                    var topRule = rules.length > 0 ? rules[0] : null;
                    return React.createElement("div", {
                      key: update.id,
                      onClick: function () { setSelectedComponent(update.name); },
                      style: s.liveFeedItem(update.exclusive),
                    },
                      React.createElement("div", { style: s.flexRow },
                        React.createElement("span", { style: { fontWeight: 600, fontSize: "11px", fontFamily: "'JetBrains Mono', monospace" } }, update.name),
                        React.createElement("span", { style: { fontSize: "10px", color: "var(--text-muted)" } }, new Date(update.timestamp).toLocaleTimeString())
                      ),
                      React.createElement("div", { style: { display: "flex", gap: "8px", fontSize: "10px", marginTop: "2px" } },
                        React.createElement("span", null, "Score: " + update.score),
                        React.createElement("span", null, "Ex: " + update.exclusive)
                      ),
                      topRule ? React.createElement("div", { style: { fontSize: "9px", color: "var(--text-muted)", marginTop: "2px" } },
                        React.createElement("span", { style: s.chip(topRule.severity) }, topRule.id)
                      ) : null
                    );
                  })
                )
          ) : null
        )
      )
    )
  );
}
