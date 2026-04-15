export default function StatusBar({ input, parsed, error, dark, inputType }) {
  const size  = new Blob([input || ""]).size;
  const fmt   = size < 1024 ? `${size} B` : size < 1048576 ? `${(size/1024).toFixed(1)} KB` : `${(size/1048576).toFixed(2)} MB`;
  const lines = (input || "").split("\n").length;

  const countKeys = (obj, depth = 0) => {
    if (!obj || typeof obj !== "object" || depth > 50) return 0;
    return Object.keys(obj).length + Object.values(obj).reduce((a, v) => a + countKeys(v, depth + 1), 0);
  };
  const maxDepth = (obj, d = 0) => {
    if (!obj || typeof obj !== "object") return d;
    return Math.max(d, ...Object.values(obj).map(v => maxDepth(v, d + 1)));
  };

  const bg     = dark ? "#080f1e" : "#f1f5f9";
  const border = dark ? "#1a2540" : "#e2e8f0";
  // FIXED: proper visible muted color in both themes
  const mute   = dark ? "#64748b" : "#64748b";
  const sep    = dark ? "#1e2d45" : "#e2e8f0";

  const Divider = () => <div style={{ width: 1, height: 13, background: sep }} />;

  const typeColors = { json:"#10b981", xml:"#f59e0b", yaml:"#38bdf8", csv:"#a78bfa" };
  const tc = typeColors[inputType] || "#10b981";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "5px 16px",
      borderTop: `1px solid ${border}`, background: bg,
      fontSize: 11, color: mute, fontFamily: "inherit", flexShrink: 0,
      userSelect: "none",
    }}>
      {/* Status indicator */}
      {error ? (
        <span style={{ display:"flex", alignItems:"center", gap:5, color:"#f87171", fontWeight:600 }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background:"#f87171", flexShrink:0 }} />
          Invalid {(inputType||"json").toUpperCase()}
        </span>
      ) : parsed ? (
        <span style={{ display:"flex", alignItems:"center", gap:5, color:"#10b981", fontWeight:600 }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background:"#10b981", flexShrink:0 }} />
          Valid <span style={{ color: tc }}>{(inputType||"json").toUpperCase()}</span>
        </span>
      ) : (
        <span style={{ display:"flex", alignItems:"center", gap:5, color: mute }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background: mute, flexShrink:0 }} />
          Ready
        </span>
      )}

      <Divider />
      <span style={{ color: mute }}>{fmt}</span>

      <Divider />
      <span style={{ color: mute }}>{lines.toLocaleString()} lines</span>

      {parsed && (
        <>
          <Divider />
          <span style={{ color: mute }}>{countKeys(parsed).toLocaleString()} keys</span>
          <Divider />
          <span style={{ color: mute }}>depth {maxDepth(parsed)}</span>
          {Array.isArray(parsed) && (
            <>
              <Divider />
              <span style={{ color: mute }}>{parsed.length.toLocaleString()} items</span>
            </>
          )}
        </>
      )}

      <div style={{ flex: 1 }} />

      <span style={{ fontSize: 10, color: dark ? "#1e3050" : "#d1dae6" }}>
        Parsly · free forever
      </span>
    </div>
  );
}