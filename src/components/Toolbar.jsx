export default function Toolbar({ onFormat, onMinify, onCopy, onClear, copyLabel, hasParsed, dark, inputType, onFileUpload }) {
  const type   = inputType || "json";
  const isJSON = type === "json";

  const bg      = dark ? "#080f1e" : "#f8fafc";
  const border  = dark ? "#1a2540" : "#e2e8f0";
  const txtMute = dark ? "#94a3b8" : "#64748b";   // was too dim before
  const txtDim  = dark ? "#475569" : "#cbd5e1";

  const base = {
    padding: "5px 13px", fontSize: 12, borderRadius: 7, cursor: "pointer",
    fontFamily: "inherit", transition: "all 0.15s", border: `1px solid ${border}`,
    background: "transparent", fontWeight: 500,
  };
  const active  = { ...base, borderColor: "#10b981", color: "#10b981", background: dark ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.06)" };
  const normal  = { ...base, color: txtMute, borderColor: border };
  const off     = { ...base, color: txtDim,  borderColor: dark ? "#1a2540" : "#f0f4f8", cursor: "not-allowed" };
  const danger  = { ...base, color: dark ? "#f87171" : "#dc2626", borderColor: dark ? "#3d1010" : "#fecaca", background: dark ? "rgba(248,113,113,0.06)" : "rgba(220,38,38,0.04)" };

  // File upload handler
  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (!file || !onFileUpload) return;
    const reader = new FileReader();
    reader.onload = ev => onFileUpload(ev.target.result);
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, padding: "7px 16px",
      borderBottom: `1px solid ${border}`, background: bg,
      flexWrap: "wrap", flexShrink: 0,
    }}>
      {/* Format / Minify — JSON only */}
      <button onClick={onFormat} disabled={!hasParsed || !isJSON} style={hasParsed && isJSON ? active : off}
        title="Format JSON (Ctrl+Shift+F)">
        ⌥ Format
      </button>
      <button onClick={onMinify} disabled={!hasParsed || !isJSON} style={hasParsed && isJSON ? normal : off}
        title="Minify JSON">
        ⊟ Minify
      </button>

      <div style={{ width: 1, height: 18, background: border }} />

      {/* Copy */}
      <button onClick={onCopy} disabled={!hasParsed} style={hasParsed ? { ...normal, color: copyLabel === "Copied!" ? "#10b981" : txtMute } : off}
        title="Copy to clipboard">
        {copyLabel === "Copied!" ? "✓ Copied!" : "⎘ Copy"}
      </button>

      {/* Upload file */}
      <label title="Upload a file" style={{ ...normal, cursor: "pointer", display: "flex", alignItems: "center" }}>
        <input type="file" style={{ display: "none" }}
          accept=".json,.xml,.yaml,.yml,.csv,.txt,.js,.ts,.md,.toml,.log"
          onChange={handleFileInput} />
        📁 Open
      </label>

      <div style={{ width: 1, height: 18, background: border }} />

      {/* Clear */}
      <button onClick={onClear} style={danger} title="Clear editor">
        ✕ Clear
      </button>

      {/* Type badge */}
      {!isJSON && hasParsed && (
        <span style={{
          fontSize: 11, color: "#f59e0b", marginLeft: 6,
          padding: "2px 8px", borderRadius: 10,
          background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)",
        }}>
          {type.toUpperCase()} — use Convert tab to transform
        </span>
      )}

      <div style={{ flex: 1 }} />

      {/* Subtle support text */}
      <span style={{ fontSize: 10, color: dark ? "#334155" : "#cbd5e1", letterSpacing: "0.05em" }}>
        JSON · XML · YAML · CSV
      </span>
    </div>
  );
}