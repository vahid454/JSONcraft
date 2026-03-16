import { useState, useCallback } from "react";
import Editor from "./components/Editor";
import TreeView from "./components/TreeView";
import Toolbar from "./components/Toolbar";
import StatusBar from "./components/StatusBar";
import ConvertPanel from "./components/ConvertPanel";
import TypesPanel from "./components/TypesPanel";
import SearchPanel from "./components/SearchPanel";
import PayPalButton from "./components/PayPalButton";

const TABS = ["tree", "search", "convert", "types", "raw"];

export default function App() {
  const [input, setInput]             = useState("");
  const [parsed, setParsed]           = useState(null);
  const [error, setError]             = useState(null);
  const [dark, setDark]               = useState(true);
  const [activeTab, setActiveTab]     = useState("tree");
  const [copyLabel, setCopyLabel]     = useState("Copy");
  const [showPricing, setShowPricing] = useState(false);
  const [subscribed, setSubscribed]   = useState(false);

  const tryParse = useCallback((val) => {
    setInput(val);
    if (!val.trim()) { setParsed(null); setError(null); return; }
    try   { setParsed(JSON.parse(val)); setError(null); }
    catch (e) { setParsed(null); setError(e.message); }
  }, []);

  const format = () => { if (parsed) setInput(JSON.stringify(parsed, null, 2)); };
  const minify = () => { if (parsed) setInput(JSON.stringify(parsed)); };
  const clear  = () => { setInput(""); setParsed(null); setError(null); };
  const copy   = () => {
    navigator.clipboard.writeText(input).then(() => {
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy"), 2000);
    });
  };

  const loadSample = () => {
    tryParse(JSON.stringify({
      app: "JSONcraft", version: "2.0.0",
      features: ["format", "minify", "tree view", "convert", "TypeScript types", "search"],
      author: { name: "Vahid", role: "developer", pro: true },
      stats: { users: 1200, uptime: 99.97, paid: true }
    }, null, 2));
  };

  const handlePayPalSuccess = (subscriptionID) => {
    setSubscribed(true);
    setShowPricing(false);
    // Store in localStorage so it persists on refresh
    localStorage.setItem("jsoncraft_pro", subscriptionID);
  };

  const col = {
    display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, overflow: "hidden",
  };

  const btn = (border, color, bg = "#111827") => ({
    fontSize: 12, color, padding: "6px 12px", borderRadius: 6,
    border: `1px solid ${border}`, background: bg,
    cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
  });

  const features = [
    "JSON → YAML / CSV / XML",
    "TypeScript types generator",
    "Search & filter any key",
    "Unlimited history",
    "Shareable JSON links",
    "Priority support",
  ];

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden",
      fontFamily: "'JetBrains Mono','Fira Code',monospace",
      background: "#030712", color: "#f3f4f6",
    }}>

      {/* ── Header ── */}
      <header style={{
        flexShrink: 0, height: 44, borderBottom: "1px solid #1f2937",
        padding: "0 20px", display: "flex", alignItems: "center",
        justifyContent: "space-between", background: "#030712",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, background: "#10b981",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#030712", fontWeight: 700, fontSize: 14, userSelect: "none",
          }}>J</div>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 15, letterSpacing: "-0.02em" }}>JSONcraft</span>
          <span style={{
            fontSize: 11, color: "#4b5563", background: "#111827",
            padding: "2px 8px", borderRadius: 20, border: "1px solid #1f2937",
          }}>v2.0</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={loadSample} style={btn("#1f2937", "#6b7280")}>Load sample</button>
          <button onClick={() => setDark(!dark)} style={btn("#1f2937", "#6b7280")}>{dark ? "☀" : "☾"}</button>
          {subscribed ? (
            <span style={{
              fontSize: 12, color: "#10b981", background: "#022c22",
              padding: "5px 12px", borderRadius: 6, border: "1px solid #10b981",
            }}>✓ Pro</span>
          ) : (
            <button
              onClick={() => setShowPricing(true)}
              style={{ ...btn("#10b981", "#030712", "#10b981"), fontWeight: 700 }}>
              Upgrade Pro
            </button>
          )}
        </div>
      </header>

      {/* ── Toolbar ── */}
      <Toolbar onFormat={format} onMinify={minify} onCopy={copy} onClear={clear}
               copyLabel={copyLabel} hasParsed={!!parsed} />

      {/* ── Main panels ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* Left — editor */}
        <div style={{ ...col, width: "50%", borderRight: "1px solid #1f2937" }}>
          <div style={{
            flexShrink: 0, padding: "6px 16px", borderBottom: "1px solid #1f2937",
            background: "#030712", display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
            <span style={{ fontSize: 11, color: "#4b5563", letterSpacing: "0.1em" }}>INPUT</span>
            {input && <span style={{ marginLeft: "auto", fontSize: 11, color: "#374151" }}>{new Blob([input]).size} B</span>}
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            <Editor value={input} onChange={tryParse} dark={dark} error={!!error} />
          </div>
        </div>

        {/* Right — output */}
        <div style={{ ...col, flex: 1 }}>
          <div style={{
            flexShrink: 0, borderBottom: "1px solid #1f2937", background: "#030712",
            display: "flex", padding: "0 16px",
          }}>
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: "10px 12px", fontSize: 11, letterSpacing: "0.1em",
                textTransform: "uppercase", border: "none",
                borderBottom: activeTab === tab ? "2px solid #10b981" : "2px solid transparent",
                background: "transparent", cursor: "pointer", transition: "all 0.15s",
                color: activeTab === tab ? "#10b981" : "#4b5563",
                fontFamily: "inherit",
              }}>{tab}</button>
            ))}
          </div>

          <div style={{
            flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden",
            padding: 16, background: "#030712",
          }}>
            {error && (
              <div style={{
                display: "flex", gap: 12, background: "rgba(127,29,29,0.3)",
                border: "1px solid #7f1d1d", borderRadius: 8, padding: 16, marginBottom: 16,
              }}>
                <span style={{ color: "#f87171", flexShrink: 0 }}>✗</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fecaca", marginBottom: 4 }}>Invalid JSON</div>
                  <div style={{ fontSize: 11, opacity: 0.8, color: "#fca5a5" }}>{error}</div>
                </div>
              </div>
            )}

            {!input && !error && (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", height: "80%", gap: 12, opacity: 0.15, userSelect: "none",
              }}>
                <div style={{ fontSize: 56, fontWeight: 700, color: "#4b5563" }}>{"{}"}</div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>Paste JSON on the left</div>
              </div>
            )}

            {parsed && activeTab === "tree"    && <TreeView data={parsed} />}
            {parsed && activeTab === "search"  && <SearchPanel data={parsed} />}
            {parsed && activeTab === "convert" && <ConvertPanel data={parsed} input={input} />}
            {parsed && activeTab === "types"   && <TypesPanel data={parsed} />}
            {parsed && activeTab === "raw"     && (
              <pre style={{
                fontSize: 12, color: "#d1d5db", lineHeight: 1.6,
                whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0,
              }}>
                {JSON.stringify(parsed, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>

      <StatusBar input={input} parsed={parsed} error={error} />

      {/* ── Pricing modal ── */}
      {showPricing && (
        <div onClick={() => setShowPricing(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#0f172a", border: "1px solid #1e293b",
            borderRadius: 20, padding: 32, maxWidth: 440, width: "100%",
          }}>
            {/* Title */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 4 }}>JSONcraft Pro</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>$3 / month · Cancel anytime</div>
            </div>

            {/* Features grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
              {features.map(f => (
                <div key={f} style={{ display: "flex", gap: 8, fontSize: 12, color: "#cbd5e1", alignItems: "flex-start" }}>
                  <span style={{ color: "#10b981", flexShrink: 0 }}>✓</span>{f}
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid #1e293b", marginBottom: 20 }} />

            {/* PayPal button renders here */}
            <PayPalButton onSuccess={handlePayPalSuccess} />

            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button onClick={() => setShowPricing(false)} style={{
                color: "#475569", border: "none", background: "transparent",
                cursor: "pointer", fontSize: 12, fontFamily: "inherit",
              }}>Maybe later</button>
            </div>

            <div style={{ textAlign: "center", fontSize: 11, color: "#1e293b", marginTop: 12 }}>
              Secured by PayPal · Worldwide accepted
            </div>
          </div>
        </div>
      )}
    </div>
  );
}