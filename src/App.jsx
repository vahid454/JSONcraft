import { useState, useCallback, useRef } from "react";
import { xmlToJSON, yamlToJSON, csvToJSON } from "./utils/converters";
import Editor from "./components/Editor";
import TreeView from "./components/TreeView";
import Toolbar from "./components/Toolbar";
import StatusBar from "./components/StatusBar";
import ConvertPanel from "./components/ConvertPanel";
import TypesPanel from "./components/TypesPanel";
import SearchPanel from "./components/SearchPanel";
import DiffModal from "./components/DiffModal";
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

export default function App() {
  const [input, setInput]               = useState("");
  const [parsed, setParsed]             = useState(null);
  const [error, setError]               = useState(null);
  const [inputType, setInputType]       = useState("json");
  const [dark, setDark]                 = useState(true);
  const [activeTab, setActiveTab]       = useState("tree");
  const [copyLabel, setCopyLabel]       = useState("Copy");
  const [showDiff, setShowDiff]         = useState(false);
  const [showContact, setShowContact]   = useState(false);
  const [showContribute, setShowContribute] = useState(false);
  const [showUrlFetch, setShowUrlFetch] = useState(false);
  const [clearKey, setClearKey]         = useState(0);
  const debounceRef = useRef(null);

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
  const clear  = () => { setInput(""); setParsed(null); setError(null); setInputType("json"); setClearKey(k => k+1); };
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
    bg2:    dark ? "#0f172a" : "#f8fafc",
    border: dark ? "#1f2937" : "#e2e8f0",
    text:   dark ? "#f3f4f6" : "#111827",
    mute:   dark ? "#4b5563" : "#6b7280",
    mute2:  dark ? "#374151" : "#9ca3af",
  };

  const col = { display:"flex", flexDirection:"column", minHeight:0, minWidth:0, overflow:"hidden" };
  const dotColor = typeColor(inputType || "json");

  const hdrBtn = (amber, green) => ({
    fontSize: 13, padding: "5px 11px", borderRadius: 6, cursor: "pointer",
    fontFamily: "inherit", transition: "all 0.15s",
    border: `1px solid ${amber ? "#78350f" : green ? "#064e3b" : T.border}`,
    background: amber ? "#1c1007" : green ? "#022c22" : "transparent",
    color: amber ? "#f59e0b" : green ? "#10b981" : T.mute,
    fontWeight: amber || green ? 700 : 400,
  });

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", overflow:"hidden",
      fontFamily:"'JetBrains Mono','Fira Code',monospace", background: T.bg, color: T.text,
      fontSize: 14 }}>

      {/* ── Header ── */}
      <header style={{ flexShrink:0, height:50, borderBottom:`1px solid ${T.border}`,
        padding:"0 18px", display:"flex", alignItems:"center",
        justifyContent:"space-between", background: T.bg }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:7, background:"#10b981",
            display:"flex", alignItems:"center", justifyContent:"center",
            color:"#030712", fontWeight:700, fontSize:15, userSelect:"none" }}>P</div>
          <span style={{ color: T.text, fontWeight:600, fontSize:16, letterSpacing:"-0.02em" }}>Parsly</span>
          <span style={{ fontSize:11, color: T.mute, background: T.bg2,
            padding:"2px 8px", borderRadius:20, border:`1px solid ${T.border}` }}>v2.0</span>
          {parsed && (
            <span style={{ fontSize:12, color: dotColor, padding:"2px 9px",
              borderRadius:20, border:`1px solid ${dotColor}` }}>
              {(inputType||"json").toUpperCase()}
            </span>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          {/* Diff button — prominent in header */}
          <button
            onClick={() => setShowDiff(true)}
            title="Compare / Diff two JSON files"
            style={{
              ...hdrBtn(false, false),
              border: `1px solid ${dark ? "#2a3a4a" : "#cbd5e1"}`,
              color: dark ? "#7dd3fc" : "#0369a1",
              background: dark ? "rgba(125,211,252,0.06)" : "rgba(3,105,161,0.06)",
              fontWeight: 600,
            }}>
            ± Diff
          </button>
          {/* URL fetch */}
          <button onClick={() => setShowUrlFetch(true)} title="Load from URL" style={hdrBtn(false)}>
            🌐 URL
          </button>
          <div style={{ width:1, height:18, background: T.border }} />
          <button onClick={() => setShowContact(true)}    title="Contact"    style={{ ...hdrBtn(false), padding:"5px 10px", fontSize:16 }}>✉</button>
          <button onClick={() => setDark(!dark)}          title="Toggle theme" style={{ ...hdrBtn(false), padding:"5px 10px" }}>{dark ? "☀" : "☾"}</button>
          <button onClick={() => setShowContribute(true)} style={hdrBtn(true)}>$ Contribute</button>
        </div>
      </header>

      {/* ── Toolbar ── */}
      <Toolbar onFormat={format} onMinify={minify} onCopy={copy} onClear={clear}
               copyLabel={copyLabel} hasParsed={!!parsed} dark={dark} inputType={inputType} />

      {/* ── Main ── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>

        {/* Left panel */}
        <div style={{ ...col, width:"50%", borderRight:`1px solid ${T.border}` }}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}>
          <div style={{ flexShrink:0, padding:"6px 18px", borderBottom:`1px solid ${T.border}`,
            background: T.bg, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ width:8, height:8, borderRadius:"50%", flexShrink:0,
              display:"inline-block", background: dotColor }} />
            <span style={{ fontSize:12, color: T.mute, letterSpacing:"0.1em" }}>INPUT</span>
            <span style={{ fontSize:11, color: T.mute2, opacity:0.6 }}>— or drag & drop a file</span>
            {input && (
              <span style={{ marginLeft:"auto", fontSize:12, color: T.mute2 }}>
                {new Blob([input]).size < 1024 ? `${new Blob([input]).size} B` : `${(new Blob([input]).size/1024).toFixed(1)} KB`}
              </span>
            )}
          </div>
          <div style={{ flex:1, minHeight:0, overflow:"hidden" }}>
            <Editor value={input} onChange={tryParse} dark={dark} error={!!error}
              language={(inputType||"json") === "xml" ? "xml" : "json"} />
          </div>
        </div>

        {/* Right panel */}
        <div style={{ ...col, flex:1 }}>
          {/* Tabs */}
          <div style={{ flexShrink:0, borderBottom:`1px solid ${T.border}`,
            background: T.bg, display:"flex", padding:"0 14px" }}>
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                padding:"10px 14px", fontSize:12, letterSpacing:"0.05em", textTransform:"uppercase",
                border:"none", borderBottom: activeTab===tab.id ? "2px solid #10b981":"2px solid transparent",
                background:"transparent", cursor:"pointer", transition:"all 0.15s",
                color: activeTab===tab.id ? "#10b981" : T.mute, fontFamily:"inherit",
                display:"flex", alignItems:"center", gap:5,
              }}>
                <span style={{ fontSize:11, opacity:0.6 }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex:1, minHeight:0, overflowY:"auto", overflowX:"hidden",
            padding:18, background: T.bg }}>

            {error && (
              <div style={{ display:"flex", gap:12, background:"rgba(127,29,29,0.25)",
                border:"1px solid #7f1d1d", borderRadius:8, padding:14, marginBottom:16 }}>
                <span style={{ color:"#f87171", flexShrink:0 }}>✗</span>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:"#fecaca", marginBottom:3 }}>
                    Invalid {(inputType||"json").toUpperCase()}
                  </div>
                  <div style={{ fontSize:12, opacity:0.8, color:"#fca5a5" }}>{error}</div>
                </div>
              </div>
            )}

            {!input && !error && activeTab !== "convert" && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                justifyContent:"center", height:"80%", gap:12, opacity:0.1, userSelect:"none" }}>
                <div style={{ fontSize:52, fontWeight:700, color: T.mute }}>{"{}"}</div>
                <div style={{ fontSize:14, color: T.mute }}>Paste JSON · XML · CSV · YAML</div>
                <div style={{ fontSize:12, color: T.mute }}>or drag & drop a file · or load from URL</div>
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
                    style={{ fontSize:12, padding:"5px 14px", borderRadius:6, cursor:"pointer",
                      border:`1px solid ${dark?"#374151":"#e2e8f0"}`, background:"transparent",
                      color: dark?"#6b7280":"#94a3b8", fontFamily:"inherit" }}>
                    Copy JSON
                  </button>
                </div>
                <pre style={{ fontSize:13, color: dark?"#d1d5db":"#374151", lineHeight:1.65,
                  whiteSpace:"pre-wrap", wordBreak:"break-word", margin:0,
                  background: dark?"#111827":"#ffffff", borderRadius:8, padding:16,
                  border:`1px solid ${dark?"#1f2937":"#e2e8f0"}` }}>
                  {JSON.stringify(parsed, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      <StatusBar input={input} parsed={parsed} error={error} dark={dark} inputType={inputType} />

      {/* ── Modals ── */}
      {showDiff       && <DiffModal originalData={parsed} originalInput={input} onClose={() => setShowDiff(false)} dark={dark} />}
      {showContact    && <ContactModal    onClose={() => setShowContact(false)}    dark={dark} />}
      {showContribute && <ContributeModal onClose={() => setShowContribute(false)} dark={dark} />}
      {showUrlFetch   && <UrlFetchModal   onLoad={tryParse} onClose={() => setShowUrlFetch(false)} dark={dark} />}
    </div>
  );
}