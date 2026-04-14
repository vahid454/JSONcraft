import { useState, useCallback, useRef } from "react";
import { xmlToJSON, yamlToJSON, csvToJSON } from "./utils/converters";
import Editor from "./components/Editor";
import TreeView from "./components/TreeView";
import Toolbar from "./components/Toolbar";
import StatusBar from "./components/StatusBar";
import ConvertPanel from "./components/ConvertPanel";
import TypesPanel from "./components/TypesPanel";
import SearchPanel from "./components/SearchPanel";
import DiffPage from "./components/DiffPage";
import JWTPage from "./components/JWTPage";
import ToolsPage from "./components/ToolsPage";
import ContactModal from "./components/ContactModal";
import ContributeModal from "./components/ContributeModal";
import UrlFetchModal from "./components/UrlFetchModal";

const TABS = [
  { id:"tree",    label:"Tree",    icon:"⌥" },
  { id:"search",  label:"Search",  icon:"⌕" },
  { id:"convert", label:"Convert", icon:"⇄" },
  { id:"types",   label:"Types",   icon:"{}" },
  { id:"json",    label:"JSON",    icon:"{ }" },
];

function parseXML(str) {
  const result = xmlToJSON(str);
  if (result.startsWith("Error:")) throw new Error(result.replace("Error: ", ""));
  return JSON.parse(result);
}

function detectType(val) {
  const t = val.trim();
  if (!t) return "json";
  const hasXMLTag = t.split("\n").some(l => l.trim().startsWith("<") && /^<[a-zA-Z!?\/]/.test(l.trim()));
  if (hasXMLTag) return "xml";
  if (t.startsWith("{") || t.startsWith("[")) return "json";
  try { JSON.parse(t); return "json"; } catch {}
  const lines = t.split("\n").map(l => l.trim()).filter(Boolean);
  if (!lines.length) return "json";
  const first = lines[0], second = lines[1] || "";
  const isYAMLKey    = /^[a-zA-Z_][\w\-\. ]*\s*:(\s|$)/.test(first);
  const hasYAMLList  = lines.some(l => /^\s*-\s+\S/.test(l));
  const yamlKeyCount = lines.filter(l => /^[a-zA-Z_][\w\-\. ]*\s*:/.test(l)).length;
  if (isYAMLKey || hasYAMLList || yamlKeyCount >= 2) return "yaml";
  if (lines.length >= 2) {
    const fc = (first.match(/,/g)||[]).length, sc = (second.match(/,/g)||[]).length;
    if (fc >= 1 && fc === sc && /^["a-zA-Z0-9_]/.test(first) && !first.includes(":") && !first.includes("<")) return "csv";
  }
  return "json";
}

function safeParse(val) {
  if (!val || typeof val !== "string" || !val.trim()) return { parsed: null, error: "Empty input", type: "json" };
  const t = val.trimStart();
  let type = "json";
  try { type = detectType(val); } catch { type = "json"; }
  if (type === "json" || t.startsWith("{") || t.startsWith("[")) {
    try { return { parsed: JSON.parse(val), error: null, type: "json" }; }
    catch(e) { if (t.startsWith("{") || t.startsWith("[")) return { parsed: null, error: e.message, type: "json" }; }
  }
  if (type === "xml" || t.startsWith("<")) {
    try { return { parsed: parseXML(val), error: null, type: "xml" }; }
    catch(e) { return { parsed: null, error: e.message, type: "xml" }; }
  }
  if (type === "csv") {
    try {
      const r = csvToJSON(val);
      if (r.startsWith("Error:")) {
        try { const yr = yamlToJSON(val); if (!yr.startsWith("Error:")) return { parsed: JSON.parse(yr), error: null, type: "yaml" }; } catch {}
        return { parsed: null, error: r.replace("Error: ",""), type: "csv" };
      }
      return { parsed: JSON.parse(r), error: null, type: "csv" };
    } catch(e) { return { parsed: null, error: e.message, type: "csv" }; }
  }
  if (type === "yaml") {
    try {
      const r = yamlToJSON(val);
      if (r.startsWith("Error:")) {
        try { const cr = csvToJSON(val); if (!cr.startsWith("Error:")) return { parsed: JSON.parse(cr), error: null, type: "csv" }; } catch {}
        return { parsed: null, error: r.replace("Error: ",""), type: "yaml" };
      }
      return { parsed: JSON.parse(r), error: null, type: "yaml" };
    } catch(e) { return { parsed: null, error: e.message, type: "yaml" }; }
  }
  const attempts = [
    () => ({ parsed: JSON.parse(val), error: null, type: "json" }),
    () => { const r = yamlToJSON(val); if (r.startsWith("Error:")) throw 0; return { parsed: JSON.parse(r), error: null, type: "yaml" }; },
    () => { const r = csvToJSON(val);  if (r.startsWith("Error:")) throw 0; return { parsed: JSON.parse(r), error: null, type: "csv"  }; },
    () => ({ parsed: parseXML(val), error: null, type: "xml" }),
  ];
  for (const a of attempts) { try { return a(); } catch {} }
  return { parsed: null, error: "Could not parse as JSON, XML, CSV or YAML", type: "json" };
}

function typeColor(type) {
  if (type === "xml")  return "#f59e0b";
  if (type === "csv")  return "#a78bfa";
  if (type === "yaml") return "#38bdf8";
  return "#10b981";
}

// ── Full-window page modes
const PAGE_MODES = ["diff", "jwt", "tools"];

export default function App() {
  const [input, setInput]               = useState("");
  const [parsed, setParsed]             = useState(null);
  const [error, setError]               = useState(null);
  const [inputType, setInputType]       = useState("json");
  const [dark, setDark]                 = useState(true);
  const [activeTab, setActiveTab]       = useState("tree");
  const [pageMode, setPageMode]         = useState(null); // null | "diff" | "jwt" | "tools"
  const [copyLabel, setCopyLabel]       = useState("Copy");
  const [showContact, setShowContact]   = useState(false);
  const [showContribute, setShowContribute] = useState(false);
  const [showUrlFetch, setShowUrlFetch] = useState(false);
  const [clearKey, setClearKey]         = useState(0);
  const debounceRef = useRef(null);

  const goHome = useCallback(() => setPageMode(null), []);

  const tryParse = useCallback((val) => {
    try {
      setInput(val);
      if (!val || !val.trim()) { setParsed(null); setError(null); setInputType("json"); return; }
      const run = () => {
        try {
          const result = safeParse(val);
          setParsed(result.parsed || null);
          setError(result.error || null);
          setInputType(result.type || "json");
        } catch(e) { setParsed(null); setError(String(e.message || e)); setInputType("json"); }
      };
      clearTimeout(debounceRef.current);
      if (val.length < 50000) run();
      else debounceRef.current = setTimeout(run, 300);
    } catch(e) { setParsed(null); setError(String(e.message || e)); setInputType("json"); }
  }, []);

  const format = () => { if (parsed && (inputType||"json") === "json") setInput(JSON.stringify(parsed, null, 2)); };
  const minify = () => { if (parsed && (inputType||"json") === "json") setInput(JSON.stringify(parsed)); };
  const clear  = () => {
    if (pageMode) { setPageMode(null); return; }
    setInput(""); setParsed(null); setError(null); setInputType("json"); setClearKey(k => k+1);
  };
  const copy   = () => { navigator.clipboard.writeText(input).then(() => { setCopyLabel("Copied!"); setTimeout(() => setCopyLabel("Copy"), 2000); }); };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => tryParse(ev.target.result);
    reader.readAsText(file);
  }, [tryParse]);

  const T = {
    bg:     dark ? "#030712" : "#ffffff",
    bg2:    dark ? "#0c1220" : "#f8fafc",
    border: dark ? "#1a2540" : "#e2e8f0",
    text:   dark ? "#f1f5f9" : "#0f172a",
    mute:   dark ? "#4b5563" : "#6b7280",
    mute2:  dark ? "#374151" : "#9ca3af",
  };

  const col = { display:"flex", flexDirection:"column", minHeight:0, minWidth:0, overflow:"hidden" };
  const dotColor = typeColor(inputType || "json");

  const navBtn = (id, label, icon, active) => ({
    btn: {
      display: "flex", alignItems: "center", gap: 6,
      fontSize: 12, padding: "5px 11px", borderRadius: 7, cursor: "pointer",
      fontFamily: "inherit", transition: "all 0.15s", border: "none",
      background: active ? (dark ? "#10b98122" : "#ecfdf5") : "transparent",
      color: active ? "#10b981" : T.mute,
      fontWeight: active ? 700 : 400,
      outline: active ? "1.5px solid #10b98144" : "none",
    }
  });

  const hdrBtn = (amber, active) => ({
    fontSize: 12, padding: "5px 11px", borderRadius: 7, cursor: "pointer",
    fontFamily: "inherit", transition: "all 0.15s",
    border: `1px solid ${amber ? "#78350f" : T.border}`,
    background: amber ? "#1c1007" : (active ? T.bg2 : "transparent"),
    color: amber ? "#f59e0b" : T.mute,
    fontWeight: amber ? 700 : 400,
  });

  // ── Full-window pages ──────────────────────────────────────────────
  if (pageMode === "diff") {
    return (
      <div style={{ height:"100vh", display:"flex", flexDirection:"column", overflow:"hidden",
        fontFamily:"'JetBrains Mono','Fira Code',monospace", background: T.bg, color: T.text }}>
        <DiffPage dark={dark} onClose={goHome}
          initialLeft={input ? (parsed ? JSON.stringify(parsed, null, 2) : input) : ""}
          onDarkToggle={() => setDark(!dark)} />
      </div>
    );
  }

  if (pageMode === "jwt") {
    return (
      <div style={{ height:"100vh", display:"flex", flexDirection:"column", overflow:"hidden",
        fontFamily:"'JetBrains Mono','Fira Code',monospace", background: T.bg, color: T.text }}>
        <JWTPage dark={dark} onClose={goHome} onDarkToggle={() => setDark(!dark)} />
      </div>
    );
  }

  if (pageMode === "tools") {
    return (
      <div style={{ height:"100vh", display:"flex", flexDirection:"column", overflow:"hidden",
        fontFamily:"'JetBrains Mono','Fira Code',monospace", background: T.bg, color: T.text }}>
        <ToolsPage dark={dark} onClose={goHome} onDarkToggle={() => setDark(!dark)} />
      </div>
    );
  }

  // ── Main Parsly UI ─────────────────────────────────────────────────
  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", overflow:"hidden",
      fontFamily:"'JetBrains Mono','Fira Code',monospace", background: T.bg, color: T.text }}>

      {/* ── Header ── */}
      <header style={{ flexShrink:0, height:48, borderBottom:`1px solid ${T.border}`,
        padding:"0 16px", display:"flex", alignItems:"center",
        justifyContent:"space-between", background: T.bg }}>

        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:8, background:"linear-gradient(135deg,#10b981,#059669)",
            display:"flex", alignItems:"center", justifyContent:"center",
            color:"#fff", fontWeight:800, fontSize:15, userSelect:"none",
            boxShadow:"0 2px 8px rgba(16,185,129,0.4)" }}>P</div>
          <span style={{ color: T.text, fontWeight:700, fontSize:16, letterSpacing:"-0.03em" }}>Parsly</span>
          <span style={{ fontSize:10, color: T.mute, background: T.bg2,
            padding:"2px 8px", borderRadius:20, border:`1px solid ${T.border}` }}>v2.1</span>
          {parsed && (
            <span style={{ fontSize:10, color: dotColor, padding:"2px 8px",
              borderRadius:20, border:`1px solid ${dotColor}44`, background:`${dotColor}11` }}>
              {(inputType||"json").toUpperCase()}
            </span>
          )}
        </div>

        {/* Nav tools */}
        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          <button onClick={() => setShowUrlFetch(true)} style={hdrBtn(false, false)}>🌐 URL</button>
          <div style={{ width:1, height:20, background: T.border, margin:"0 4px" }} />

          {/* Diff */}
          <button onClick={() => setPageMode("diff")} style={{
            ...hdrBtn(false, false),
            color: "#a78bfa", border: "1px solid #a78bfa44",
            background: dark ? "#a78bfa11" : "#f5f3ff",
            display:"flex", alignItems:"center", gap:5,
          }}>⟺ Diff</button>

          {/* JWT */}
          <button onClick={() => setPageMode("jwt")} style={{
            ...hdrBtn(false, false),
            color: "#38bdf8", border: "1px solid #38bdf844",
            background: dark ? "#38bdf811" : "#f0f9ff",
            display:"flex", alignItems:"center", gap:5,
          }}>🔑 JWT</button>

          {/* Tools */}
          <button onClick={() => setPageMode("tools")} style={{
            ...hdrBtn(false, false),
            color: "#fb923c", border: "1px solid #fb923c44",
            background: dark ? "#fb923c11" : "#fff7ed",
            display:"flex", alignItems:"center", gap:5,
          }}>⚙ Tools</button>

          <div style={{ width:1, height:20, background: T.border, margin:"0 4px" }} />
          <button onClick={() => setShowContact(true)} style={{ ...hdrBtn(false), padding:"5px 9px", fontSize:14 }}>✉</button>
          <button onClick={() => setDark(!dark)} style={{ ...hdrBtn(false), padding:"5px 9px" }}>{dark ? "☀" : "☾"}</button>
          <button onClick={() => setShowContribute(true)} style={hdrBtn(true)}>$ Contribute</button>
        </div>
      </header>

      {/* ── Toolbar ── */}
      <Toolbar onFormat={format} onMinify={minify} onCopy={copy} onClear={clear}
               copyLabel={copyLabel} hasParsed={!!parsed} dark={dark} inputType={inputType} />

      {/* ── Main ── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>

        {/* Left: Editor */}
        <div style={{ ...col, width:"50%", borderRight:`1px solid ${T.border}` }}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}>
          <div style={{ flexShrink:0, padding:"5px 14px", borderBottom:`1px solid ${T.border}`,
            background: T.bg2, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ width:7, height:7, borderRadius:"50%", flexShrink:0,
              display:"inline-block", background: dotColor }} />
            <span style={{ fontSize:10, color: T.mute, letterSpacing:"0.1em", textTransform:"uppercase" }}>Input</span>
            <span style={{ fontSize:10, color: T.mute2, opacity:0.5 }}>— drag & drop a file</span>
            {input && (
              <span style={{ marginLeft:"auto", fontSize:10, color: T.mute2 }}>
                {new Blob([input]).size < 1024 ? `${new Blob([input]).size} B` : `${(new Blob([input]).size/1024).toFixed(1)} KB`}
              </span>
            )}
          </div>
          <div style={{ flex:1, minHeight:0, overflow:"hidden" }}>
            <Editor value={input} onChange={tryParse} dark={dark} error={!!error}
              language={(inputType||"json") === "xml" ? "xml" : "json"} />
          </div>
        </div>

        {/* Right: Tabs */}
        <div style={{ ...col, flex:1 }}>
          <div style={{ flexShrink:0, borderBottom:`1px solid ${T.border}`,
            background: T.bg2, display:"flex", padding:"0 10px", gap:2 }}>
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                padding:"9px 12px", fontSize:11, letterSpacing:"0.05em", textTransform:"uppercase",
                border:"none", borderBottom: activeTab===tab.id ? "2px solid #10b981":"2px solid transparent",
                background:"transparent", cursor:"pointer", transition:"all 0.15s",
                color: activeTab===tab.id ? "#10b981" : T.mute, fontFamily:"inherit",
                display:"flex", alignItems:"center", gap:4,
              }}>
                <span style={{ fontSize:9, opacity:0.6 }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ flex:1, minHeight:0, overflowY:"auto", overflowX:"hidden",
            padding: activeTab === "tree" || activeTab === "search" ? "12px 14px" : 16,
            background: T.bg }}>

            {error && (
              <div style={{ display:"flex", gap:10, background:"rgba(127,29,29,0.2)",
                border:"1px solid #7f1d1d55", borderRadius:8, padding:12, marginBottom:14 }}>
                <span style={{ color:"#f87171", flexShrink:0, fontSize:14 }}>✗</span>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:"#fecaca", marginBottom:2 }}>
                    Invalid {(inputType||"json").toUpperCase()}
                  </div>
                  <div style={{ fontSize:11, opacity:0.8, color:"#fca5a5" }}>{error}</div>
                </div>
              </div>
            )}

            {!input && !error && activeTab !== "convert" && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                justifyContent:"center", height:"80%", gap:10, opacity:0.08, userSelect:"none" }}>
                <div style={{ fontSize:56, fontWeight:700, color: T.mute }}>{"{}"}</div>
                <div style={{ fontSize:13, color: T.mute }}>Paste JSON · XML · CSV · YAML</div>
                <div style={{ fontSize:11, color: T.mute }}>or drag & drop · load from URL</div>
              </div>
            )}

            {parsed && activeTab === "tree"    && <TreeView data={parsed} dark={dark} />}
            {parsed && activeTab === "search"  && <SearchPanel data={parsed} dark={dark} />}
            {activeTab === "convert"           && <ConvertPanel key={`${clearKey}-${inputType}`} data={parsed} input={input} inputType={inputType} dark={dark} />}
            {parsed && activeTab === "types"   && <TypesPanel data={parsed} dark={dark} />}
            {parsed && activeTab === "json"    && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ display:"flex", justifyContent:"flex-end" }}>
                  <button id="json-copy-btn"
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(parsed,null,2)).then(() => {
                      const b = document.getElementById("json-copy-btn");
                      if (b) { b.textContent="✓ Copied"; setTimeout(()=>b.textContent="Copy JSON",1500); }
                    })}
                    style={{ fontSize:11, padding:"4px 12px", borderRadius:6, cursor:"pointer",
                      border:`1px solid ${dark?"#374151":"#e2e8f0"}`, background:"transparent",
                      color: dark?"#6b7280":"#94a3b8", fontFamily:"inherit" }}>
                    Copy JSON
                  </button>
                </div>
                <pre style={{ fontSize:12, color: dark?"#d1d5db":"#374151", lineHeight:1.6,
                  whiteSpace:"pre-wrap", wordBreak:"break-word", margin:0,
                  background: dark?"#0c1220":"#ffffff", borderRadius:8, padding:14,
                  border:`1px solid ${dark?"#1a2540":"#e2e8f0"}` }}>
                  {JSON.stringify(parsed, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      <StatusBar input={input} parsed={parsed} error={error} dark={dark} inputType={inputType} />

      {showContact    && <ContactModal    onClose={() => setShowContact(false)}    dark={dark} />}
      {showContribute && <ContributeModal onClose={() => setShowContribute(false)} dark={dark} />}
      {showUrlFetch   && <UrlFetchModal   onLoad={tryParse} onClose={() => setShowUrlFetch(false)} dark={dark} />}
    </div>
  );
}