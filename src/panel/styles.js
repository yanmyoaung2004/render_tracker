import { themes, spacing, typography } from "./theme";

export function createStyles(mode) {
  var t = themes[mode] || themes.light;

  return {
    app: {
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      fontFamily: typography.sans,
      fontSize: typography.size.base,
      background: t.bg.app,
      color: t.text.primary,
      overflow: "hidden",
    },
    topBar: {
      display: "flex",
      alignItems: "center",
      gap: spacing.sm,
      padding: "6px 12px",
      borderBottom: "1px solid " + t.border,
      background: t.bg.surface,
      flexShrink: 0,
      minHeight: "36px",
    },
    topBarLeft: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      flexShrink: 0,
    },
    topBarTitle: {
      fontSize: typography.size.lg,
      fontWeight: 600,
      whiteSpace: "nowrap",
      marginRight: "8px",
    },
    topBarCenter: {
      display: "flex",
      alignItems: "center",
      gap: "2px",
    },
    topBarRight: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      marginLeft: "auto",
    },
    tabBtn: function (active) {
      return {
        padding: "4px 10px",
        border: "none",
        background: active ? t.bg.selected : "transparent",
        color: active ? t.text.accent : t.text.secondary,
        fontSize: typography.size.sm,
        cursor: "pointer",
        borderRadius: "3px",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        fontWeight: active ? 600 : 400,
        transition: "all 0.1s",
      };
    },
    select: {
      padding: "3px 6px",
      border: "1px solid " + t.border,
      borderRadius: "3px",
      fontSize: typography.size.sm,
      cursor: "pointer",
      background: t.bg.surface,
      color: t.text.primary,
    },
    searchInput: {
      padding: "3px 6px",
      border: "1px solid " + t.border,
      borderRadius: "3px",
      fontSize: typography.size.sm,
      background: t.bg.surface,
      color: t.text.primary,
      outline: "none",
      width: "140px",
    },
    btnDanger: {
      padding: "3px 8px",
      background: t.text.danger,
      color: t.text.onDanger,
      border: "none",
      borderRadius: "3px",
      fontSize: typography.size.sm,
      cursor: "pointer",
      fontWeight: 500,
      display: "flex",
      alignItems: "center",
      gap: "3px",
    },
    btnGhost: {
      background: "none",
      border: "none",
      cursor: "pointer",
      color: t.text.muted,
      padding: "3px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "3px",
    },
    emptyState: {
      padding: "48px 24px",
      textAlign: "center",
      color: t.text.muted,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "8px",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
    },
    th: {
      padding: "6px 10px",
      textAlign: "left",
      fontWeight: 600,
      fontSize: typography.size.xs,
      color: t.text.secondary,
      borderBottom: "1px solid " + t.border,
      background: t.bg.header,
      position: "sticky",
      top: 0,
      zIndex: 1,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    thRight: {
      padding: "6px 10px",
      textAlign: "right",
      fontWeight: 600,
      fontSize: typography.size.xs,
      color: t.text.secondary,
      borderBottom: "1px solid " + t.border,
      background: t.bg.header,
      position: "sticky",
      top: 0,
      zIndex: 1,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    thCenter: {
      padding: "6px 10px",
      textAlign: "center",
      fontWeight: 600,
      fontSize: typography.size.xs,
      color: t.text.secondary,
      borderBottom: "1px solid " + t.border,
      background: t.bg.header,
      position: "sticky",
      top: 0,
      zIndex: 1,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    td: {
      padding: "5px 10px",
    },
    tdMono: {
      padding: "5px 10px",
      fontFamily: typography.mono,
    },
    tableRow: function (isSelected) {
      return {
        borderBottom: "1px solid " + t.border,
        cursor: "pointer",
        background: isSelected ? t.bg.selected : "transparent",
        transition: "background 0.08s",
      };
    },
    resizeHandle: {
      width: "4px",
      cursor: "col-resize",
      background: t.border,
      flexShrink: 0,
      transition: "background 0.15s",
    },
    sectionTitle: {
      margin: "0 0 6px 0",
      fontSize: typography.size.sm,
      fontWeight: 600,
      color: t.text.secondary,
      display: "flex",
      alignItems: "center",
      gap: spacing.xs,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    flamegraphBar: function (pct, color) {
      return {
        width: pct + "%",
        minWidth: "24px",
        height: "20px",
        background: color,
        borderRadius: "3px",
        display: "flex",
        alignItems: "center",
        paddingLeft: "6px",
        cursor: "pointer",
        transition: "opacity 0.15s",
      };
    },
    chip: function (severity) {
      return {
        padding: "1px 5px",
        background: severity === "critical" ? t.bg.insightCritical : severity === "high" ? t.bg.insight : t.bg.treeSkip,
        borderRadius: "3px",
        fontSize: typography.size.xs,
        color: severity === "critical" ? t.text.danger : severity === "high" ? t.text.warning : t.text.success,
        fontWeight: 500,
      };
    },
    dropdownMenu: {
      position: "absolute",
      top: "100%",
      right: 0,
      background: t.bg.surface,
      border: "1px solid " + t.border,
      borderRadius: "6px",
      zIndex: 100,
      minWidth: "150px",
      overflow: "hidden",
    },
    dropdownItem: function (danger) {
      return {
        padding: "6px 12px",
        cursor: "pointer",
        fontSize: typography.size.sm,
        color: danger ? t.text.danger : t.text.primary,
        display: "flex",
        alignItems: "center",
        gap: "6px",
        border: "none",
        background: "none",
        width: "100%",
        textAlign: "left",
      };
    },
    pill: function (bg, color) {
      return {
        padding: "2px 5px",
        background: bg,
        color: color || t.text.primary,
        borderRadius: "3px",
        fontSize: typography.size.xs,
        fontFamily: typography.mono,
        cursor: "pointer",
      };
    },
    insightCard: function (severity) {
      var isCritical = severity === "critical";
      return {
        padding: "8px 10px",
        background: isCritical ? t.bg.insightCritical : t.bg.insight,
        borderRadius: "6px",
        fontSize: typography.size.sm,
        marginBottom: "6px",
        borderLeft: "3px solid " + (isCritical ? t.text.danger : t.text.warning),
      };
    },
    insightSuggestion: {
      fontSize: typography.size.sm,
      color: t.text.success,
      background: mode === "dark" ? "#1a3a2a" : "#d8f0e0",
      padding: "3px 6px",
      borderRadius: "3px",
      marginTop: "4px",
    },
    liveFeedOuter: {
      borderTop: "1px solid " + t.border,
      flexShrink: 0,
    },
    liveFeedHeader: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 12px",
      background: t.bg.header,
      cursor: "pointer",
      fontSize: typography.size.sm,
      fontWeight: 600,
      color: t.text.secondary,
    },
    liveFeedContent: {
      maxHeight: "150px",
      overflow: "auto",
      padding: "6px",
    },
    liveFeedItem: function (exclusive) {
      var color = exclusive > 10 ? t.text.danger : (exclusive > 5 ? t.text.warning : t.text.success);
      return {
        padding: "5px 8px",
        marginBottom: "3px",
        borderRadius: "6px",
        fontSize: typography.size.sm,
        cursor: "pointer",
        borderLeft: "3px solid " + color,
      };
    },
    historyEvent: function () {
      return {
        padding: "6px 8px",
        background: t.bg.app,
        borderRadius: "6px",
        fontSize: typography.size.sm,
        marginBottom: "4px",
      };
    },
    timelineEntry: {
      padding: "8px 10px",
      background: t.bg.card,
      borderRadius: "6px",
      fontSize: typography.size.sm,
      marginBottom: "6px",
    },
    statGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "8px",
      marginBottom: "12px",
    },
    statCell: {
      padding: "8px",
      background: t.bg.app,
      borderRadius: "6px",
    },
    statValue: {
      fontSize: "15px",
      fontWeight: 700,
    },
    statLabel: {
      fontSize: typography.size.xs,
      color: t.text.secondary,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    sidebarMain: {
      flex: 1,
      overflow: "auto",
    },
    sidebarSection: {
      padding: "10px 12px",
      borderBottom: "1px solid " + t.border,
    },
    sidebarSectionCompact: {
      padding: "8px 12px",
    },
    mainArea: {
      flex: 1,
      display: "flex",
      overflow: "hidden",
    },
    contentArea: {
      flex: 1,
      overflow: "auto",
      background: t.bg.surface,
    },
    sidebarOuter: function (width) {
      return {
        width: width + "px",
        borderLeft: "1px solid " + t.border,
        display: "flex",
        flexDirection: "column",
        background: t.bg.sidebar,
        flexShrink: 0,
        overflow: "hidden",
      };
    },
    detailSection: {
      padding: "8px 12px",
      borderBottom: "1px solid " + t.border,
    },
    emptyText: {
      fontSize: typography.size.sm,
      margin: 0,
    },
    spaceY: function (px) {
      return { display: "flex", flexDirection: "column", gap: px + "px" };
    },
    flexRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    focusVisible: {
      outline: "2px solid " + t.text.accent,
      outlineOffset: "1px",
    },
    interactive: {
      cursor: "pointer",
      borderRadius: "3px",
    },
    interactiveRow: {
      cursor: "pointer",
      borderRadius: "3px",
      borderBottom: "1px solid " + t.border,
      transition: "background 0.08s",
    },
    flexCenter: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
    },
    causeStep: function (isRoot) {
      return {
        padding: "4px 8px",
        marginBottom: "3px",
        borderRadius: "3px",
        fontSize: typography.size.sm,
        background: isRoot ? t.bg.insight : "transparent",
        fontWeight: isRoot ? 600 : 400,
        color: isRoot ? t.text.warning : t.text.primary,
        display: "flex",
        alignItems: "center",
        gap: "4px",
      };
    },
    causeArrow: {
      color: t.text.muted,
      fontSize: "10px",
      marginRight: "2px",
    },
    propDiffItem: {
      padding: "4px 0",
      borderBottom: "1px solid " + t.border,
      fontSize: typography.size.sm,
    },
    propKey: {
      fontWeight: 600,
      color: t.text.accent,
    },
    propValue: {
      color: t.text.muted,
    },
    propChange: {
      color: t.text.warning,
    },
  };
}
