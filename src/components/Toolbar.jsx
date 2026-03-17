export default function Toolbar({ onFormat, onMinify, onCopy, onClear, copyLabel, hasParsed, dark, inputType }) {
  const bg     = dark ? "#030712" : "#f8fafc";
  const border = dark ? "#1f2937" : "#e2e8f0";

  const base = {
    padding: "5px 12px", fontSize: 11, borderRadius: 6, cursor: "pointer",
    fontFamily: "inherit", transition: "all 0.15s", border: `1px solid ${border}`,
    background: "transparent",
  };
  const on  = { ...base, borderColor:"#10b981", color:"#10b981" };
  const off = { ...base, color: dark ? "#374151" : "#cbd5e1", borderColor: dark ? "#1f2937" : "#f1f5f9", cursor:"not-allowed" };
  const nor = { ...base, color: dark ? "#6b7280" : "#94a3b8" };
  const del = { ...base, color: dark ? "#6b7280" : "#94a3b8" };

  const isXML = inputType === "xml";

  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 16px",
      borderBottom:`1px solid ${border}`, background: bg, flexWrap:"wrap", flexShrink:0 }}>
      <button onClick={onFormat} disabled={!hasParsed || isXML} style={hasParsed && !isXML ? on : off}>
        ⌥ Format
      </button>
      <button onClick={onMinify} disabled={!hasParsed || isXML} style={hasParsed && !isXML ? nor : off}>
        ⊟ Minify
      </button>
      <div style={{ width:1, height:16, background: border }} />
      <button onClick={onCopy} disabled={!hasParsed} style={hasParsed ? nor : off}>
        {copyLabel === "Copied!" ? "✓ Copied!" : "⎘ Copy"}
      </button>
      <div style={{ width:1, height:16, background: border }} />
      <button onClick={onClear} style={del}>✕ Clear</button>
      {isXML && hasParsed && (
        <span style={{ fontSize:11, color:"#f59e0b", marginLeft:4 }}>
          XML detected — use Convert tab to transform
        </span>
      )}
      <div style={{ flex:1 }} />
      <span style={{ fontSize:11, color: dark ? "#1f2937" : "#e2e8f0" }}>
        JSON · XML · YAML · CSV · TypeScript
      </span>
    </div>
  );
}