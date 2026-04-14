import { useState, useMemo } from "react";
import yaml from "js-yaml";

// ── Tool definitions ──────────────────────────────────────────────────
const TOOLS = [
  { id: "sort",      label: "Sort Keys",       icon: "⇅", desc: "Sort JSON keys alphabetically" },
  { id: "escape",    label: "Escape JSON",      icon: "↗", desc: "Escape a JSON string for embedding" },
  { id: "unescape",  label: "Unescape JSON",    icon: "↙", desc: "Unescape a JSON string" },
  { id: "timestamp", label: "Timestamps",       icon: "⏱", desc: "Convert Unix timestamps ↔ dates" },
  { id: "base64",    label: "Base64",           icon: "⌗", desc: "Encode / decode Base64" },
  { id: "flatten",   label: "Flatten JSON",     icon: "▤", desc: "Flatten nested JSON to dot notation" },
  { id: "unflatten", label: "Unflatten JSON",   icon: "▣", desc: "Restore flat dot-notation to nested" },
  { id: "minify",    label: "Minify JSON",      icon: "⊟", desc: "Remove all whitespace from JSON" },
  { id: "schema",    label: "Schema Gen",       icon: "◈", desc: "Generate JSON Schema from sample data" },
  { id: "hash",      label: "String Hash",      icon: "#", desc: "Compute hash of any string" },
  { id: "url",       label: "URL Encode",       icon: "⌁", desc: "Encode/decode URL components" },
  { id: "count",     label: "Count Stats",      icon: "≣", desc: "Count keys, depth, values in JSON" },
];

// ── Sort keys recursively ─────────────────────────────────────────────
function sortKeys(obj) {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj && typeof obj === "object") {
    return Object.fromEntries(Object.entries(obj).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k, sortKeys(v)]));
  }
  return obj;
}

// ── Flatten/unflatten ────────────────────────────────────────────────
function flatten(obj, prefix = "", out = {}) {
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  } else {
    out[prefix] = obj;
  }
  return out;
}

function unflatten(obj) {
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    const parts = key.split(".");
    let cur = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = val;
  }
  return result;
}

// ── JSON Schema generator ────────────────────────────────────────────
function genSchema(data, defs = {}, ref = "Root") {
  if (data === null)             return { type: "null" };
  if (typeof data === "boolean") return { type: "boolean" };
  if (typeof data === "number")  return { type: Number.isInteger(data) ? "integer" : "number" };
  if (typeof data === "string")  return { type: "string" };
  if (Array.isArray(data)) {
    return { type: "array", items: data.length > 0 ? genSchema(data[0], defs) : {} };
  }
  if (typeof data === "object") {
    const props = {};
    const required = [];
    for (const [k, v] of Object.entries(data)) {
      props[k] = genSchema(v, defs, k);
      required.push(k);
    }
    return { type: "object", properties: props, required, additionalProperties: false };
  }
  return {};
}

// ── Count stats ───────────────────────────────────────────────────────
function countStats(obj, depth = 0) {
  if (obj === null || typeof obj !== "object") return { keys: 0, values: 1, depth, nulls: obj === null ? 1 : 0, strings: typeof obj === "string" ? 1 : 0, numbers: typeof obj === "number" ? 1 : 0 };
  let keys = 0, values = 0, maxDepth = depth, nulls = 0, strings = 0, numbers = 0;
  const arr = Array.isArray(obj) ? obj : Object.values(obj);
  if (!Array.isArray(obj)) keys = Object.keys(obj).length;
  for (const v of arr) {
    const sub = countStats(v, depth + 1);
    keys += sub.keys;
    values += sub.values;
    maxDepth = Math.max(maxDepth, sub.depth);
    nulls += sub.nulls;
    strings += sub.strings;
    numbers += sub.numbers;
  }
  return { keys, values, depth: maxDepth, nulls, strings, numbers };
}

// ── Simple hash ───────────────────────────────────────────────────────
async function computeHash(str, algo = "SHA-256") {
  const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Shared styled components ──────────────────────────────────────────
function ToolTextarea({ value, onChange, placeholder, dark, rows = 10, readOnly = false }) {
  const bg  = dark ? "#0d1117" : "#ffffff";
  const txt = dark ? "#e6edf3" : "#24292f";
  const bdr = dark ? "#30363d" : "#d0d7de";
  return (
    <textarea
      value={value} onChange={onChange ? e => onChange(e.target.value) : undefined}
      placeholder={placeholder} readOnly={readOnly} spellCheck={false}
      rows={rows}
      style={{
        width: "100%", resize: "vertical", border: `1px solid ${bdr}`,
        borderRadius: 8, padding: "12px 14px", background: bg, color: txt,
        fontSize: 12, lineHeight: 1.7, fontFamily: "'JetBrains Mono',monospace",
        outline: "none", boxSizing: "border-box",
      }}
    />
  );
}

function CopyBtn({ text, dark }) {
  const [copied, setCopied] = useState(false);
  const bdr = dark ? "#30363d" : "#d0d7de";
  const mut = dark ? "#8b949e" : "#656d76";
  return (
    <button onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }} style={{
      fontSize: 11, padding: "5px 12px", borderRadius: 6, cursor: "pointer",
      border: `1px solid ${copied ? "#3fb950" : bdr}`, background: "transparent",
      color: copied ? "#3fb950" : mut, fontFamily: "inherit", transition: "all 0.15s",
    }}>{copied ? "✓ Copied" : "Copy"}</button>
  );
}

function SectionLabel({ children, dark }) {
  return <div style={{ fontSize: 10, color: dark?"#8b949e":"#656d76", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontWeight: 700 }}>{children}</div>;
}

// ── Individual tool panels ────────────────────────────────────────────
function SortTool({ dark }) {
  const [input, setInput] = useState("");
  const result = useMemo(() => {
    if (!input.trim()) return "";
    try { return JSON.stringify(sortKeys(JSON.parse(input)), null, 2); }
    catch(e) { return `Error: ${e.message}`; }
  }, [input]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div><SectionLabel dark={dark}>Input JSON</SectionLabel><ToolTextarea value={input} onChange={setInput} placeholder="Paste JSON to sort keys alphabetically..." dark={dark} rows={12} /></div>
      {result && <div><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}><SectionLabel dark={dark}>Sorted Output</SectionLabel><CopyBtn text={result} dark={dark} /></div><ToolTextarea value={result} dark={dark} readOnly rows={12} /></div>}
    </div>
  );
}

function EscapeTool({ dark, mode }) {
  const [input, setInput] = useState("");
  const result = useMemo(() => {
    if (!input) return "";
    try {
      if (mode === "escape")   return JSON.stringify(input);
      if (mode === "unescape") return JSON.parse(input.trim());
    } catch(e) { return `Error: ${e.message}`; }
    return "";
  }, [input, mode]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div><SectionLabel dark={dark}>{mode === "escape" ? "String to escape" : "Escaped string to unescape"}</SectionLabel><ToolTextarea value={input} onChange={setInput} placeholder={mode === "escape" ? 'Hello "world"\nLine 2' : '"Hello \\"world\\"\\nLine 2"'} dark={dark} rows={8} /></div>
      {result && <div><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}><SectionLabel dark={dark}>Result</SectionLabel><CopyBtn text={String(result)} dark={dark} /></div><ToolTextarea value={String(result)} dark={dark} readOnly rows={8} /></div>}
    </div>
  );
}

function TimestampTool({ dark }) {
  const [unix, setUnix] = useState("");
  const [dateStr, setDateStr] = useState("");
  const bdr = dark?"#30363d":"#d0d7de";
  const txt = dark?"#e6edf3":"#24292f";
  const bg  = dark?"#0d1117":"#f6f8fa";
  const mut = dark?"#8b949e":"#656d76";

  const fromUnix = useMemo(() => {
    const n = Number(unix);
    if (!unix || isNaN(n)) return null;
    const ms = n > 1e10 ? n : n * 1000;
    const d = new Date(ms);
    return { iso: d.toISOString(), local: d.toLocaleString(), utc: d.toUTCString(), ms };
  }, [unix]);

  const fromDate = useMemo(() => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d)) return null;
      return { unix: Math.floor(d.getTime() / 1000), unixMs: d.getTime() };
    } catch { return null; }
  }, [dateStr]);

  const now = () => {
    const n = Math.floor(Date.now() / 1000);
    setUnix(String(n));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: bg, border:`1px solid ${bdr}`, borderRadius:10, padding:20 }}>
        <SectionLabel dark={dark}>Unix Timestamp → Date</SectionLabel>
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          <input value={unix} onChange={e => setUnix(e.target.value)} placeholder="1516239022"
            style={{ flex:1, padding:"9px 12px", borderRadius:7, border:`1px solid ${bdr}`,
              background:dark?"#161b22":"#fff", color:txt, fontSize:13, fontFamily:"inherit", outline:"none" }} />
          <button onClick={now} style={{ padding:"9px 14px", borderRadius:7, cursor:"pointer",
            border:`1px solid ${bdr}`, background:"transparent", color:"#38bdf8", fontFamily:"inherit", fontSize:12 }}>
            Now
          </button>
        </div>
        {fromUnix && (
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {[["ISO 8601", fromUnix.iso], ["Local", fromUnix.local], ["UTC", fromUnix.utc], ["Milliseconds", fromUnix.ms]].map(([l, v]) => (
              <div key={l} style={{ display:"flex", gap:0, border:`1px solid ${bdr}`, borderRadius:6, overflow:"hidden" }}>
                <div style={{ width:120, flexShrink:0, padding:"7px 12px", background:dark?"#21262d":"#f0f6fc", fontSize:10, fontWeight:700, color:mut, textTransform:"uppercase", letterSpacing:"0.06em", display:"flex", alignItems:"center" }}>{l}</div>
                <div style={{ flex:1, padding:"7px 12px", fontSize:12, fontFamily:"monospace", color:txt, wordBreak:"break-all", display:"flex", alignItems:"center" }}>{String(v)}</div>
                <CopyBtn text={String(v)} dark={dark} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background:bg, border:`1px solid ${bdr}`, borderRadius:10, padding:20 }}>
        <SectionLabel dark={dark}>Date → Unix Timestamp</SectionLabel>
        <input value={dateStr} onChange={e => setDateStr(e.target.value)} placeholder="2024-01-18T12:00:00Z or Jan 18 2024"
          style={{ width:"100%", padding:"9px 12px", borderRadius:7, border:`1px solid ${bdr}`,
            background:dark?"#161b22":"#fff", color:txt, fontSize:13, fontFamily:"inherit",
            outline:"none", boxSizing:"border-box", marginBottom:12 }} />
        {fromDate && (
          <div style={{ display:"flex", gap:10 }}>
            {[["Unix (seconds)", fromDate.unix], ["Unix (ms)", fromDate.unixMs]].map(([l,v]) => (
              <div key={l} style={{ flex:1, border:`1px solid ${bdr}`, borderRadius:7, padding:"12px 14px", background:dark?"#0d1117":"#fff" }}>
                <div style={{ fontSize:10, color:mut, marginBottom:4, textTransform:"uppercase" }}>{l}</div>
                <div style={{ fontSize:20, fontWeight:700, color:"#38bdf8", marginBottom:6 }}>{v}</div>
                <CopyBtn text={String(v)} dark={dark} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Base64Tool({ dark }) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("encode");
  const bdr = dark?"#30363d":"#d0d7de";
  const mut = dark?"#8b949e":"#656d76";

  const result = useMemo(() => {
    if (!input) return "";
    try {
      if (mode === "encode") return btoa(unescape(encodeURIComponent(input)));
      return decodeURIComponent(escape(atob(input.trim())));
    } catch(e) { return `Error: ${e.message}`; }
  }, [input, mode]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", gap:4 }}>
        {["encode","decode"].map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding:"6px 16px", borderRadius:7, cursor:"pointer", border:`1px solid ${mode===m?"#38bdf8":bdr}`,
            background: mode===m ? (dark?"#0c2a3d":"#e0f2fe") : "transparent",
            color: mode===m ? "#38bdf8" : mut, fontFamily:"inherit", fontSize:12, fontWeight: mode===m ? 700 : 400,
          }}>{m === "encode" ? "↗ Encode" : "↙ Decode"}</button>
        ))}
      </div>
      <div><SectionLabel dark={dark}>{mode === "encode" ? "Plain text" : "Base64 string"}</SectionLabel><ToolTextarea value={input} onChange={setInput} placeholder={mode==="encode" ? "Hello, World!" : "SGVsbG8sIFdvcmxkIQ=="} dark={dark} rows={8} /></div>
      {result && <div><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}><SectionLabel dark={dark}>Result</SectionLabel><CopyBtn text={result} dark={dark} /></div><ToolTextarea value={result} dark={dark} readOnly rows={8} /></div>}
    </div>
  );
}

function FlattenTool({ dark, mode }) {
  const [input, setInput] = useState("");
  const result = useMemo(() => {
    if (!input.trim()) return "";
    try {
      const parsed = JSON.parse(input);
      const out = mode === "flatten" ? flatten(parsed) : unflatten(parsed);
      return JSON.stringify(out, null, 2);
    } catch(e) { return `Error: ${e.message}`; }
  }, [input, mode]);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div><SectionLabel dark={dark}>Input JSON</SectionLabel><ToolTextarea value={input} onChange={setInput} placeholder={mode==="flatten" ? '{\n  "user": {\n    "name": "Alice",\n    "age": 30\n  }\n}' : '{\n  "user.name": "Alice",\n  "user.age": 30\n}'} dark={dark} rows={12} /></div>
      {result && <div><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}><SectionLabel dark={dark}>Result</SectionLabel><CopyBtn text={result} dark={dark} /></div><ToolTextarea value={result} dark={dark} readOnly rows={12} /></div>}
    </div>
  );
}

function MinifyTool({ dark }) {
  const [input, setInput] = useState("");
  const result = useMemo(() => {
    if (!input.trim()) return "";
    try { return JSON.stringify(JSON.parse(input)); }
    catch(e) { return `Error: ${e.message}`; }
  }, [input]);
  const savings = useMemo(() => {
    if (!result || result.startsWith("Error")) return null;
    const orig = new Blob([input]).size, min = new Blob([result]).size;
    return { orig, min, saved: orig - min, pct: (((orig-min)/orig)*100).toFixed(1) };
  }, [input, result]);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div><SectionLabel dark={dark}>JSON to minify</SectionLabel><ToolTextarea value={input} onChange={setInput} placeholder="Paste formatted JSON..." dark={dark} rows={12} /></div>
      {savings && (
        <div style={{ display:"flex", gap:10 }}>
          {[["Original", `${savings.orig} B`], ["Minified", `${savings.min} B`], ["Saved", `${savings.saved} B (${savings.pct}%)`]].map(([l,v]) => (
            <div key={l} style={{ flex:1, padding:"10px 14px", borderRadius:8,
              background:dark?"#161b22":"#f6f8fa", border:`1px solid ${dark?"#30363d":"#d0d7de"}` }}>
              <div style={{ fontSize:10, color:dark?"#8b949e":"#656d76", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.06em" }}>{l}</div>
              <div style={{ fontSize:16, fontWeight:700, color: l==="Saved"?"#3fb950":dark?"#e6edf3":"#24292f" }}>{v}</div>
            </div>
          ))}
        </div>
      )}
      {result && !result.startsWith("Error") && <div><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}><SectionLabel dark={dark}>Minified</SectionLabel><CopyBtn text={result} dark={dark} /></div><ToolTextarea value={result} dark={dark} readOnly rows={4} /></div>}
      {result && result.startsWith("Error") && <div style={{ color:"#f85149", fontSize:12, padding:10 }}>{result}</div>}
    </div>
  );
}

function SchemaTool({ dark }) {
  const [input, setInput] = useState("");
  const result = useMemo(() => {
    if (!input.trim()) return "";
    try { return JSON.stringify(genSchema(JSON.parse(input)), null, 2); }
    catch(e) { return `Error: ${e.message}`; }
  }, [input]);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div><SectionLabel dark={dark}>Sample JSON data</SectionLabel><ToolTextarea value={input} onChange={setInput} placeholder='{\n  "name": "Alice",\n  "age": 30,\n  "active": true\n}' dark={dark} rows={12} /></div>
      {result && <div><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}><SectionLabel dark={dark}>Generated JSON Schema</SectionLabel><CopyBtn text={result} dark={dark} /></div><ToolTextarea value={result} dark={dark} readOnly rows={12} /></div>}
    </div>
  );
}

function HashTool({ dark }) {
  const [input, setInput] = useState("");
  const [hashes, setHashes] = useState({});
  const bdr = dark?"#30363d":"#d0d7de";
  const txt = dark?"#e6edf3":"#24292f";
  const mut = dark?"#8b949e":"#656d76";
  const bg  = dark?"#0d1117":"#f6f8fa";

  const compute = async () => {
    if (!input) return;
    const results = {};
    for (const algo of ["SHA-1","SHA-256","SHA-384","SHA-512"]) {
      results[algo] = await computeHash(input, algo);
    }
    setHashes(results);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div><SectionLabel dark={dark}>Input string</SectionLabel>
        <div style={{ display:"flex", gap:8 }}>
          <textarea value={input} onChange={e => setInput(e.target.value)} rows={4} spellCheck={false}
            placeholder="Enter any text to hash..."
            style={{ flex:1, resize:"vertical", border:`1px solid ${bdr}`, borderRadius:8,
              padding:"10px 12px", background:dark?"#0d1117":"#fff", color:txt,
              fontSize:12, lineHeight:1.6, fontFamily:"monospace", outline:"none" }} />
        </div>
        <button onClick={compute} style={{ marginTop:8, padding:"8px 20px", borderRadius:8, cursor:"pointer",
          border:"none", background:"#38bdf8", color:"#0d1117", fontFamily:"inherit", fontWeight:700, fontSize:12 }}>
          Compute Hashes
        </button>
      </div>
      {Object.entries(hashes).map(([algo, hash]) => (
        <div key={algo} style={{ border:`1px solid ${bdr}`, borderRadius:8, overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", padding:"7px 12px",
            background:dark?"#21262d":"#f0f6fc", borderBottom:`1px solid ${bdr}` }}>
            <span style={{ fontSize:11, fontWeight:700, color:mut, textTransform:"uppercase", flex:1 }}>{algo}</span>
            <CopyBtn text={hash} dark={dark} />
          </div>
          <div style={{ padding:"10px 14px", fontSize:11, fontFamily:"monospace", color:"#38bdf8", wordBreak:"break-all" }}>{hash}</div>
        </div>
      ))}
    </div>
  );
}

function UrlTool({ dark }) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("encode");
  const bdr = dark?"#30363d":"#d0d7de";
  const mut = dark?"#8b949e":"#656d76";
  const result = useMemo(() => {
    if (!input) return "";
    try {
      return mode === "encode" ? encodeURIComponent(input) : decodeURIComponent(input);
    } catch(e) { return `Error: ${e.message}`; }
  }, [input, mode]);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", gap:4 }}>
        {["encode","decode"].map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding:"6px 16px", borderRadius:7, cursor:"pointer", border:`1px solid ${mode===m?"#a78bfa":bdr}`,
            background: mode===m ? (dark?"#1e1433":"#f5f3ff") : "transparent",
            color: mode===m ? "#a78bfa" : mut, fontFamily:"inherit", fontSize:12, fontWeight: mode===m ? 700 : 400,
          }}>{m === "encode" ? "↗ Encode" : "↙ Decode"}</button>
        ))}
      </div>
      <div><SectionLabel dark={dark}>Input</SectionLabel><ToolTextarea value={input} onChange={setInput} placeholder={mode==="encode"?"hello world & more?query=1":"hello%20world%20%26%20more%3Fquery%3D1"} dark={dark} rows={6} /></div>
      {result && <div><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}><SectionLabel dark={dark}>Result</SectionLabel><CopyBtn text={result} dark={dark} /></div><ToolTextarea value={result} dark={dark} readOnly rows={6} /></div>}
    </div>
  );
}

function CountTool({ dark }) {
  const [input, setInput] = useState("");
  const stats = useMemo(() => {
    if (!input.trim()) return null;
    try { return countStats(JSON.parse(input)); } catch { return null; }
  }, [input]);
  const bdr = dark?"#30363d":"#d0d7de";
  const mut = dark?"#8b949e":"#656d76";
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div><SectionLabel dark={dark}>JSON to analyze</SectionLabel><ToolTextarea value={input} onChange={setInput} placeholder="Paste any JSON..." dark={dark} rows={12} /></div>
      {stats && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
          {[
            ["Total Keys", stats.keys, "#79c0ff"],
            ["Total Values", stats.values, "#56d364"],
            ["Max Depth", stats.depth, "#ffa657"],
            ["Null Values", stats.nulls, "#f85149"],
            ["Strings", stats.strings, "#d2a8ff"],
            ["Numbers", stats.numbers, "#38bdf8"],
          ].map(([label, value, color]) => (
            <div key={label} style={{ padding:"14px 16px", borderRadius:10, border:`1px solid ${bdr}`,
              background:dark?"#161b22":"#f6f8fa" }}>
              <div style={{ fontSize:10, color:mut, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div>
              <div style={{ fontSize:28, fontWeight:800, color }}>{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ToolsPage ────────────────────────────────────────────────────
export default function ToolsPage({ dark, onClose, onDarkToggle }) {
  const [activeTool, setActiveTool] = useState("sort");

  const bg  = dark ? "#0d1117" : "#ffffff";
  const bg2 = dark ? "#161b22" : "#f6f8fa";
  const bdr = dark ? "#30363d" : "#d0d7de";
  const txt = dark ? "#e6edf3" : "#24292f";
  const mut = dark ? "#8b949e" : "#656d76";

  const renderTool = () => {
    switch (activeTool) {
      case "sort":      return <SortTool dark={dark} />;
      case "escape":    return <EscapeTool dark={dark} mode="escape" />;
      case "unescape":  return <EscapeTool dark={dark} mode="unescape" />;
      case "timestamp": return <TimestampTool dark={dark} />;
      case "base64":    return <Base64Tool dark={dark} />;
      case "flatten":   return <FlattenTool dark={dark} mode="flatten" />;
      case "unflatten": return <FlattenTool dark={dark} mode="unflatten" />;
      case "minify":    return <MinifyTool dark={dark} />;
      case "schema":    return <SchemaTool dark={dark} />;
      case "hash":      return <HashTool dark={dark} />;
      case "url":       return <UrlTool dark={dark} />;
      case "count":     return <CountTool dark={dark} />;
      default:          return null;
    }
  };

  const curTool = TOOLS.find(t => t.id === activeTool);

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column",
      background: bg, color: txt, fontFamily:"'JetBrains Mono','Fira Code',monospace" }}>

      {/* Top bar */}
      <div style={{ flexShrink:0, height:52, display:"flex", alignItems:"center", gap:10,
        padding:"0 20px", borderBottom:`1px solid ${bdr}`, background:bg2 }}>
        <button onClick={onClose} style={{ fontSize:13, padding:"6px 12px", borderRadius:7, cursor:"pointer",
          border:`1px solid ${bdr}`, background:"transparent", color:mut, fontFamily:"inherit", fontWeight:600,
          display:"flex", alignItems:"center", gap:6 }}>← Parsly</button>
        <div style={{ width:1, height:24, background:bdr }} />
        <span style={{ fontSize:15, fontWeight:700 }}>⚙ Tools</span>
        <span style={{ fontSize:11, color:mut }}>Developer utilities & converters</span>
        <div style={{ flex:1 }} />
        <button onClick={onDarkToggle} style={{ fontSize:14, padding:"5px 9px", borderRadius:6, cursor:"pointer",
          border:`1px solid ${bdr}`, background:"transparent", color:mut, fontFamily:"inherit" }}>
          {dark ? "☀" : "☾"}
        </button>
      </div>

      {/* Body */}
      <div style={{ flex:1, display:"flex", minHeight:0, overflow:"hidden" }}>

        {/* Sidebar */}
        <div style={{ width:220, flexShrink:0, borderRight:`1px solid ${bdr}`, overflowY:"auto",
          background:bg2, padding:"8px 0" }}>
          {TOOLS.map(tool => (
            <button key={tool.id} onClick={() => setActiveTool(tool.id)} style={{
              width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 16px",
              border:"none", background: activeTool===tool.id ? (dark?"#21262d":"#e8f4fd") : "transparent",
              cursor:"pointer", fontFamily:"inherit", textAlign:"left", transition:"all 0.12s",
              borderLeft: activeTool===tool.id ? "3px solid #fb923c" : "3px solid transparent",
            }}>
              <span style={{ fontSize:16, flexShrink:0 }}>{tool.icon}</span>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color: activeTool===tool.id ? txt : mut }}>{tool.label}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Tool panel */}
        <div style={{ flex:1, overflowY:"auto", padding:28 }}>
          {curTool && (
            <div style={{ marginBottom:20 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                <span style={{ fontSize:22 }}>{curTool.icon}</span>
                <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:txt }}>{curTool.label}</h2>
              </div>
              <p style={{ margin:0, fontSize:12, color:mut }}>{curTool.desc}</p>
              <div style={{ height:1, background:bdr, marginTop:16 }} />
            </div>
          )}
          {renderTool()}
        </div>
      </div>
    </div>
  );
}