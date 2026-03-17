import { useState, useMemo } from "react";

function flattenJSON(obj, prefix = "") {
  const results = [];
  for (const [key, val] of Object.entries(obj || {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      results.push(...flattenJSON(val, path));
    } else if (Array.isArray(val)) {
      val.forEach((item, i) => {
        const arrPath = `${path}[${i}]`;
        if (item !== null && typeof item === "object") {
          results.push(...flattenJSON(item, arrPath));
        } else {
          results.push({ path: arrPath, value: item });
        }
      });
    } else {
      results.push({ path, value: val });
    }
  }
  return results;
}

function ValueChip({ val, dark }) {
  const colors = {
    null:    dark ? "#f87171" : "#dc2626",
    boolean: dark ? "#f59e0b" : "#d97706",
    number:  dark ? "#60a5fa" : "#2563eb",
    string:  dark ? "#10b981" : "#059669",
  };
  if (val === null)          return <span style={{ color: colors.null,    fontSize: 11 }}>null</span>;
  if (typeof val === "boolean") return <span style={{ color: colors.boolean, fontSize: 11 }}>{String(val)}</span>;
  if (typeof val === "number")  return <span style={{ color: colors.number,  fontSize: 11 }}>{val}</span>;
  return <span style={{ color: colors.string, fontSize: 11 }}>"{String(val)}"</span>;
}

export default function SearchPanel({ data, dark }) {
  const [query, setQuery]       = useState("");
  const [copied, setCopied]     = useState(null);

  const bg2   = dark ? "#111827" : "#ffffff";
  const bdr   = dark ? "#1f2937" : "#e2e8f0";
  const txt   = dark ? "#e2e8f0" : "#1e293b";
  const mute  = dark ? "#6b7280" : "#94a3b8";
  const hover = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";

  const flat    = useMemo(() => flattenJSON(data), [data]);
  const results = useMemo(() => {
    if (!query.trim()) return flat;
    const q = query.toLowerCase();
    return flat.filter(({ path, value }) =>
      path.toLowerCase().includes(q) || String(value).toLowerCase().includes(q)
    );
  }, [flat, query]);

  const copyVal = (val, i) => {
    navigator.clipboard.writeText(String(val)).then(() => {
      setCopied(i);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10, height:"100%", minHeight:0 }}>
      {/* Search input */}
      <div style={{ position:"relative", flexShrink:0 }}>
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search keys or values..."
          style={{
            width:"100%", padding:"9px 36px 9px 12px", borderRadius:8,
            background: bg2, border:`1px solid ${bdr}`, color: txt,
            fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box",
            transition:"border-color 0.15s",
          }}
          onFocus={e => e.target.style.borderColor = "#10b981"}
          onBlur={e => e.target.style.borderColor = bdr}
        />
        {query && (
          <button onClick={() => setQuery("")} style={{
            position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
            background:"transparent", border:"none", cursor:"pointer",
            color: mute, fontSize:13, fontFamily:"inherit", padding:0,
          }}>✕</button>
        )}
      </div>

      {/* Count */}
      <div style={{ fontSize:11, color: mute, flexShrink:0 }}>
        {results.length} {results.length === 1 ? "result" : "results"}
        {query && <span> for "<span style={{ color: dark ? "#e2e8f0" : "#334155" }}>{query}</span>"</span>}
      </div>

      {/* Results */}
      <div style={{ flex:1, overflowY:"auto", minHeight:0, display:"flex", flexDirection:"column", gap:1 }}>
        {results.map(({ path, value }, i) => (
          <div key={i}
            style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 10px",
              borderRadius:6, transition:"background 0.1s", cursor:"default" }}
            onMouseEnter={e => e.currentTarget.style.background = hover}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ fontSize:11, color: dark ? "#94a3b8" : "#475569",
              fontFamily:"inherit", flex:1, overflow:"hidden", textOverflow:"ellipsis",
              whiteSpace:"nowrap", minWidth:0 }}>{path}</span>
            <ValueChip val={value} dark={dark} />
            <button onClick={() => copyVal(value, i)} style={{
              fontSize:11, color: copied === i ? "#10b981" : mute,
              background:"transparent", border:"none", cursor:"pointer",
              fontFamily:"inherit", flexShrink:0, padding:0,
              transition:"color 0.15s",
            }}>
              {copied === i ? "✓" : "copy"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}