import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error: error.message || String(error) };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          height: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "#030712", color: "#f3f4f6",
          fontFamily: "'JetBrains Mono', monospace", padding: 32, textAlign: "center"
        }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>⚠</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#fecaca", marginBottom: 8 }}>
            Something crashed
          </div>
          <div style={{ fontSize: 12, color: "#f87171", marginBottom: 24, maxWidth: 500,
            background: "#1c0a0a", padding: 12, borderRadius: 8, border: "1px solid #7f1d1d" }}>
            {this.state.error}
          </div>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{ fontSize: 13, padding: "8px 20px", borderRadius: 8, cursor: "pointer",
              background: "#10b981", color: "#030712", border: "none", fontFamily: "inherit", fontWeight: 700 }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}