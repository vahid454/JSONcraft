import { useState, useEffect, useCallback } from "react";

const MAX_HISTORY = 30;
const STORAGE_KEY = "parsly_history_v1";

export function useHistory() {
  const [entries, setEntries] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch { return []; }
  });

  const push = useCallback((text, type) => {
    if (!text || !text.trim() || text.length < 10) return;
    setEntries(prev => {
      // Don't push duplicate of last entry
      if (prev[0]?.text === text) return prev;
      const next = [
        {
          id: Date.now(),
          text,
          type,
          size: new Blob([text]).size,
          label: text.trim().slice(0, 60).replace(/\s+/g, " "),
          time: new Date().toLocaleTimeString(),
          date: new Date().toLocaleDateString(),
        },
        ...prev,
      ].slice(0, MAX_HISTORY);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const remove = useCallback((id) => {
    setEntries(prev => {
      const next = prev.filter(e => e.id !== id);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return { entries, push, remove, clear };
}

const TYPE_COLORS = {
  json: "#10b981", xml: "#f59e0b", yaml: "#38bdf8", csv: "#a78bfa",
};

function fmtSize(bytes) {
  return bytes < 1024 ? `${bytes}B` : `${(bytes/1024).toFixed(1)}KB`;
}

function timeAgo(id) {
  const diff = Date.now() - id;
  if (diff < 60000)    return "just now";
  if (diff < 3600000)  return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return `${Math.floor(diff/86400000)}d ago`;
}

export default function HistoryPanel({ entries, onLoad, onRemove, onClear, dark }) {
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(null);

  const bg   = dark ? "#080f1e" : "#ffffff";
  const bg2  = dark ? "#0d1929" : "#f8fafc";
  const bdr  = dark ? "#1a2540" : "#e2e8f0";
  const txt  = dark ? "#e2e8f0" : "#1a2535";
  const mute = dark ? "#64748b" : "#64748b";
  const hover= dark ? "#0d1929" : "#f1f5f9";

  const filtered = entries.filter(e =>
    !search || e.label.toLowerCase().includes(search.toLowerCase()) || e.type.includes(search)
  );

  const copy = (e) => {
    navigator.clipboard.writeText(e.text).then(() => {
      setCopied(e.id);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  if (entries.length === 0) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        height:"100%", gap:12, opacity:0.4, userSelect:"none" }}>
        <div style={{ fontSize:36, color:mute }}>⏱</div>
        <div style={{ fontSize:13, color:mute, fontWeight:600 }}>No history yet</div>
        <div style={{ fontSize:11, color:mute }}>Parsed inputs appear here</div>
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0 }}>
      {/* Search + clear */}
      <div style={{ flexShrink:0, display:"flex", gap:8, marginBottom:10 }}>
        <div style={{ position:"relative", flex:1 }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search history..."
            style={{ width:"100%", padding:"7px 12px 7px 32px", borderRadius:8, border:`1px solid ${bdr}`,
              background:bg, color:txt, fontSize:12, fontFamily:"inherit", outline:"none",
              boxSizing:"border-box" }}
          />
          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)",
            fontSize:13, color:mute, pointerEvents:"none" }}>⌕</span>
        </div>
        <button onClick={onClear} style={{ padding:"7px 12px", borderRadius:8, cursor:"pointer",
          border:`1px solid ${bdr}`, background:"transparent", color:mute, fontSize:11, fontFamily:"inherit" }}>
          Clear all
        </button>
      </div>

      <div style={{ fontSize:10, color:mute, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.08em" }}>
        {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
      </div>

      {/* List */}
      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:4, minHeight:0 }}>
        {filtered.map(entry => {
          const tc = TYPE_COLORS[entry.type] || "#10b981";
          return (
            <div key={entry.id}
              style={{ border:`1px solid ${bdr}`, borderRadius:8, overflow:"hidden",
                background:bg, transition:"all 0.12s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = tc + "66"}
              onMouseLeave={e => e.currentTarget.style.borderColor = bdr}>

              {/* Header row */}
              <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px",
                background:bg2, borderBottom:`1px solid ${bdr}` }}>
                <span style={{ fontSize:9, fontWeight:700, color:tc,
                  padding:"2px 7px", borderRadius:10, background:`${tc}18`,
                  border:`1px solid ${tc}33`, textTransform:"uppercase", letterSpacing:"0.06em" }}>
                  {entry.type}
                </span>
                <span style={{ fontSize:10, color:mute }}>{fmtSize(entry.size)}</span>
                <span style={{ fontSize:10, color:mute, marginLeft:"auto" }}>{timeAgo(entry.id)}</span>
              </div>

              {/* Preview */}
              <div style={{ padding:"8px 12px" }}>
                <div style={{ fontSize:11, color:txt, fontFamily:"monospace", lineHeight:1.4,
                  overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis", marginBottom:8 }}>
                  {entry.label}…
                </div>

                {/* Actions */}
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={() => onLoad(entry.text)} style={{
                    flex:1, padding:"5px 0", borderRadius:6, cursor:"pointer",
                    border:`1px solid ${tc}55`, background:`${tc}11`,
                    color:tc, fontSize:10, fontFamily:"inherit", fontWeight:700,
                  }}>↩ Load</button>
                  <button onClick={() => copy(entry)} style={{
                    padding:"5px 10px", borderRadius:6, cursor:"pointer",
                    border:`1px solid ${bdr}`, background:"transparent",
                    color: copied===entry.id ? "#10b981" : mute, fontSize:10, fontFamily:"inherit",
                  }}>{copied===entry.id ? "✓" : "⎘"}</button>
                  <button onClick={() => onRemove(entry.id)} style={{
                    padding:"5px 10px", borderRadius:6, cursor:"pointer",
                    border:`1px solid ${bdr}`, background:"transparent",
                    color:"#f87171", fontSize:10, fontFamily:"inherit",
                  }}>✕</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}