export default function StatusBar({ input, parsed, error, dark, inputType }) {
  const size = new Blob([input || ""]).size;
  const fmt  = size < 1024 ? `${size} B` : `${(size/1024).toFixed(1)} KB`;

  const countKeys = (obj) => {
    if (!obj || typeof obj !== "object") return 0;
    let count = Object.keys(obj).length;
    Object.values(obj).forEach(v => { count += countKeys(v); });
    return count;
  };

  const bg     = dark ? "#030712" : "#f1f5f9";
  const border = dark ? "#1f2937" : "#e2e8f0";
  const mute   = dark ? "#4b5563" : "#94a3b8";

  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"4px 16px",
      borderTop:`1px solid ${border}`, background: bg,
      fontSize:11, color: mute, fontFamily:"inherit", flexShrink:0 }}>
      {error ? (
        <span style={{ color:"#f87171" }}>✗ {`Invalid ${(inputType||"json").toUpperCase()}`}</span>
      ) : parsed ? (
        <span style={{ color:"#10b981" }}>✓ Valid {(inputType||"json").toUpperCase()}</span>
      ) : (
        <span>Ready</span>
      )}
      <div style={{ width:1, height:12, background: border }} />
      <span>{fmt}</span>
      {parsed && (
        <>
          <div style={{ width:1, height:12, background: border }} />
          <span>{countKeys(parsed)} keys</span>
          {Array.isArray(parsed) && <><div style={{ width:1, height:12, background: border }} /><span>{parsed.length} items</span></>}
        </>
      )}
      <div style={{ flex:1 }} />
      <span style={{ color: dark ? "#1f2937" : "#cbd5e1" }}>parsly · free forever · ⭐ share it</span>
    </div>
  );
}