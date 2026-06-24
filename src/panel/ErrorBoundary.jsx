import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error: error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return React.createElement("div", {
        role: "alert",
        style: { padding: "40px", textAlign: "center", fontFamily: "sans-serif" }
      },
        React.createElement("h2", { style: { margin: "0 0 12px 0", color: "#f87171", fontSize: "16px" } }, "Panel crashed"),
        React.createElement("p", { style: { fontSize: "12px", color: "#94a3b8", margin: "0 0 4px 0" } },
          "An unexpected error occurred in the Render Tracker panel."
        ),
        React.createElement("p", { style: { fontSize: "11px", color: "#64748b", margin: "0 0 12px 0" } },
          "Try refreshing the page with DevTools open. If the issue persists, reload the extension at chrome://extensions."
        ),
        this.state.error ? React.createElement("pre", { style: { fontSize: "10px", color: "#94a3b8", maxWidth: "400px", margin: "0 auto 12px", whiteSpace: "pre-wrap", padding: "8px", background: "#1e293b", borderRadius: "4px", textAlign: "left" } },
          String(this.state.error.message)
        ) : null,
        React.createElement("button", {
          onClick: function () { this.setState({ hasError: false, error: null }); }.bind(this),
          style: { padding: "6px 16px", background: "#f87171", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px", fontWeight: 500 }
        }, "Retry")
      );
    }
    return this.props.children;
  }
}
