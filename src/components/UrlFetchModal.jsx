import { useState } from "react";

export default function UrlFetchModal({ onLoad, onClose, dark }) {
  const [url, setUrl]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  const bg   = dark ? "#0f172a" : "#ffffff";
  const bdr  = dark ? "#1e293b" : "#e2e8f0";
  const txt  = dark ? "#e2e8f0" : "#0f172a";
  const mute = dark ? "#64748b" : "#94a3b8";

  const EXAMPLES = [
    { label: "JSONPlaceholder users",  url: "https://jsonplaceholder.typicode.com/users" },
    { label: "JSONPlaceholder posts",  url: "https://jsonplaceholder.typicode.com/posts" },
    { label: "GitHub Octocat",         url: "https://api.github.com/users/octocat" },
  ];

  const fetchData = async (fetchUrl) => {
    const target = fetchUrl || url.trim();
    if (!target) { setError("Please enter a URL"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(target);
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);
      const text = await res.text();
      onLoad(text);
      onClose();
    } catch(e) {
      setError(e.message.includes("Failed to fetch")
        ? "Could not fetch URL — check CORS policy or try a public API"
        : e.message);
    } finally { setLoading(false); }
  };

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:50, padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: bg, border:`1px solid ${bdr}`,
        borderRadius:16, padding:28, maxWidth:480, width:"100%" }}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color: txt }}>Load from URL</div>
            <div style={{ fontSize:12, color: mute, marginTop:2 }}>Fetch JSON, XML, CSV or YAML from any public URL</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", cursor:"pointer",
            color: mute, fontSize:18, fontFamily:"inherit" }}>✕</button>
        </div>

        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          <input value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && fetchData()}
            placeholder="https://api.example.com/data.json"
            style={{ flex:1, padding:"9px 12px", borderRadius:8, background: dark?"#1e293b":"#f8fafc",
              border:`1px solid ${bdr}`, color: txt, fontSize:12, fontFamily:"inherit",
              outline:"none", boxSizing:"border-box" }} />
          <button onClick={() => fetchData()} disabled={loading} style={{
            padding:"9px 16px", borderRadius:8, background:"#10b981", color:"#030712",
            border:"none", cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:12,
            opacity: loading ? 0.7 : 1 }}>
            {loading ? "..." : "Fetch"}
          </button>
        </div>

        {error && <div style={{ fontSize:12, color:"#f87171", marginBottom:12 }}>✗ {error}</div>}

        <div style={{ fontSize:11, color: mute, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em" }}>
          Quick examples
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {EXAMPLES.map(ex => (
            <button key={ex.url} onClick={() => { setUrl(ex.url); fetchData(ex.url); }}
              style={{ padding:"7px 12px", borderRadius:7, background:"transparent",
                border:`1px solid ${bdr}`, cursor:"pointer", fontFamily:"inherit",
                fontSize:11, color: txt, textAlign:"left", transition:"all 0.12s" }}>
              {ex.label}
              <span style={{ color: mute, marginLeft:8, fontSize:10 }}>{ex.url}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}