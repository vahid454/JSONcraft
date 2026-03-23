import { useState, useCallback, useRef } from "react";
import { xmlToJSON, yamlToJSON, csvToJSON } from "./utils/converters";
import Editor from "./components/Editor";
import TreeView from "./components/TreeView";
import Toolbar from "./components/Toolbar";
import StatusBar from "./components/StatusBar";
import ConvertPanel from "./components/ConvertPanel";
import TypesPanel from "./components/TypesPanel";
import SearchPanel from "./components/SearchPanel";
import ContactModal from "./components/ContactModal";
import ContributeModal from "./components/ContributeModal";

const TABS = ["tree", "search", "convert", "types", "json"];

// ── XML parser — uses shared converters.js ────────────────
function parseXML(str) {
  const result = xmlToJSON(str);
  if (result.startsWith("Error:")) throw new Error(result.replace("Error: ", ""));
  return JSON.parse(result);
}

// ── Smart type detection ───────────────────────────────────
function detectType(val) {
  const t = val.trim();
  if (!t) return "json";

  // 1. XML — check if ANY line contains an XML tag
  //    This handles cases where there's text before the XML
  const hasXMLTag = t.split("\n").some(l => l.trim().startsWith("<") && /^<[a-zA-Z!?\/]/.test(l.trim()));
  if (hasXMLTag) return "xml";

  // 2. JSON — starts with { or [
  if (t.startsWith("{") || t.startsWith("[")) return "json";

  // 3. Try actual JSON.parse — handles numbers, booleans, null, quoted strings
  try { JSON.parse(t); return "json"; } catch {}

  const lines = t.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return "json";

  const first  = lines[0];
  const second = lines[1] || "";

  // 4. YAML — check BEFORE CSV because YAML "key: value" could have commas
  //    Strong YAML signals:
  //    - "key: value" or "key:" pattern on first line
  //    - "  - item" list syntax anywhere
  //    - Multiple "key:" lines
  const isYAMLKey    = /^[a-zA-Z_][\w\-\.]*\s*:/.test(first);
  const hasYAMLList  = lines.some(l => /^\s*-\s+/.test(l));
  const yamlKeyCount = lines.filter(l => /^[a-zA-Z_][\w\-\.]*\s*:/.test(l)).length;
  if (isYAMLKey || hasYAMLList || yamlKeyCount >= 2) return "yaml";

  // 5. CSV — strict detection:
  //    - At least 2 lines
  //    - First line looks like a header (letters/quotes separated by commas)
  //    - Second line has same number of comma-separated values
  //    - No XML or YAML patterns
  if (lines.length >= 2) {
    const firstCommas  = (first.match(/,/g) || []).length;
    const secondCommas = (second.match(/,/g) || []).length;
    const headerLooksRight = /^["a-zA-Z_]/.test(first) && firstCommas >= 1;
    const columnsConsistent = Math.abs(firstCommas - secondCommas) <= 1;
    const noXMLorYAML = !first.includes("<") && !first.includes(":");
    if (headerLooksRight && columnsConsistent && noXMLorYAML) return "csv";
  }

  return "json";
}

// ── Safe universal parser with proper fallback chain ───────
function safeParse(val) {
  if (!val || typeof val !== "string" || !val.trim()) {
    return { parsed: null, error: "Empty input", type: "json" };
  }

  const t = val.trimStart();
  let type = "json";
  try { type = detectType(val); } catch { type = "json"; }

  // ── Try each type in order, with fallback chain ──────────

  // JSON first if detected or starts with { [
  if (type === "json" || t.startsWith("{") || t.startsWith("[")) {
    try {
      const parsed = JSON.parse(val);
      return { parsed, error: null, type: "json" };
    } catch(e) {
      // Only fail as JSON if it really looks like JSON
      if (t.startsWith("{") || t.startsWith("[")) {
        return { parsed: null, error: e.message, type: "json" };
      }
    }
  }

  // XML
  if (type === "xml" || t.startsWith("<")) {
    try {
      const parsed = parseXML(val);
      return { parsed, error: null, type: "xml" };
    } catch(e) {
      return { parsed: null, error: e.message, type: "xml" };
    }
  }

  // CSV
  if (type === "csv") {
    try {
      const r = csvToJSON(val);
      if (r.startsWith("Error:")) {
        // CSV failed — try YAML as fallback
        try {
          const yr = yamlToJSON(val);
          if (!yr.startsWith("Error:")) return { parsed: JSON.parse(yr), error: null, type: "yaml" };
        } catch {}
        return { parsed: null, error: r.replace("Error: ",""), type: "csv" };
      }
      return { parsed: JSON.parse(r), error: null, type: "csv" };
    } catch(e) { return { parsed: null, error: e.message, type: "csv" }; }
  }

  // YAML
  if (type === "yaml") {
    try {
      const r = yamlToJSON(val);
      if (r.startsWith("Error:")) {
        // YAML failed — try CSV as fallback
        try {
          const cr = csvToJSON(val);
          if (!cr.startsWith("Error:")) return { parsed: JSON.parse(cr), error: null, type: "csv" };
        } catch {}
        return { parsed: null, error: r.replace("Error: ",""), type: "yaml" };
      }
      return { parsed: JSON.parse(r), error: null, type: "yaml" };
    } catch(e) { return { parsed: null, error: e.message, type: "yaml" }; }
  }

  // Final fallback — try everything
  const attempts = [
    () => { const p = JSON.parse(val); return { parsed: p, error: null, type: "json" }; },
    () => { const r = yamlToJSON(val); if (r.startsWith("Error:")) throw new Error(r); return { parsed: JSON.parse(r), error: null, type: "yaml" }; },
    () => { const r = csvToJSON(val);  if (r.startsWith("Error:")) throw new Error(r); return { parsed: JSON.parse(r), error: null, type: "csv" }; },
    () => { const p = parseXML(val); return { parsed: p, error: null, type: "xml" }; },
  ];
  for (const attempt of attempts) {
    try { return attempt(); } catch {}
  }

  return { parsed: null, error: "Could not parse as JSON, XML, CSV or YAML", type: "json" };
}

// ── Type colors ────────────────────────────────────────────
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
  const [showContact, setShowContact]   = useState(false);
  const [showContribute, setShowContribute] = useState(false);
  const [clearKey, setClearKey]         = useState(0);
  const debounceRef = useRef(null);

  const tryParse = useCallback((val) => {
    try {
      setInput(val);
      if (!val || !val.trim()) {
        setParsed(null); setError(null); setInputType("json"); return;
      }
      const run = () => {
        try {
          const result = safeParse(val);
          setParsed(result.parsed || null);
          setError(result.error || null);
          setInputType(result.type || "json");
        } catch (e) {
          setParsed(null);
          setError(String(e.message || e));
          setInputType("json");
        }
      };
      clearTimeout(debounceRef.current);
      if (val.length < 50000) { run(); }
      else { debounceRef.current = setTimeout(run, 300); }
    } catch (e) {
      setParsed(null);
      setError(String(e.message || e));
      setInputType("json");
    }
  }, []);

  const format = () => { if (parsed && (inputType || 'json') === "json") setInput(JSON.stringify(parsed, null, 2)); };
  const minify = () => { if (parsed && (inputType || 'json') === "json") setInput(JSON.stringify(parsed)); };
  const clear  = () => { setInput(""); setParsed(null); setError(null); setInputType("json"); setClearKey(k => k + 1); };
  const copy   = () => {
    navigator.clipboard.writeText(input).then(() => {
      setCopyLabel("Copied!"); setTimeout(() => setCopyLabel("Copy"), 2000);
    });
  };

  const loadSample = () => tryParse(JSON.stringify({
    app: "Parsly", version: "2.0.0",
    features: ["format", "tree view", "convert", "search"],
    author: { name: "Vahid", role: "developer" },
    stats: { users: 1200, uptime: 99.97 }
  }, null, 2));

  const loadXMLSample = () => tryParse(`<?xml version="1.0"?>
<company>
  <name>Parsly</name>
  <version>2.0.0</version>
  <author><name>Vahid</name><role>developer</role></author>
  <features>
    <feature>format</feature>
    <feature>tree view</feature>
    <feature>convert</feature>
  </features>
</company>`);

  const loadCSVSample = () => tryParse(`name,age,city,role
Vahid,31,Bhopal,developer
Rahul,28,Mumbai,designer
Anjali,26,Delhi,engineer`);

  const loadYAMLSample = () => tryParse(`app: Parsly
version: 2.0.0
active: true
author:
  name: Vahid
  role: developer
features:
  - format
  - tree view
  - convert`);

  const T = {
    bg:     dark ? "#030712" : "#ffffff",
    bg2:    dark ? "#0f172a" : "#f8fafc",
    border: dark ? "#1f2937" : "#e2e8f0",
    text:   dark ? "#f3f4f6" : "#111827",
    mute:   dark ? "#4b5563" : "#6b7280",
    mute2:  dark ? "#374151" : "#9ca3af",
  };

  const col = { display:"flex", flexDirection:"column", minHeight:0, minWidth:0, overflow:"hidden" };

  const hdrBtn = (highlight, amber) => ({
    fontSize: 12, padding: "5px 11px", borderRadius: 6, cursor: "pointer",
    fontFamily: "inherit", transition: "all 0.15s",
    border: `1px solid ${amber ? "#78350f" : T.border}`,
    background: amber ? "#1c1007" : "transparent",
    color: amber ? "#f59e0b" : T.mute,
    fontWeight: amber ? 700 : 400,
  });

  const dotColor = typeColor(inputType || 'json');

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", overflow:"hidden",
      fontFamily:"'JetBrains Mono','Fira Code',monospace", background: T.bg, color: T.text }}>

      {/* Header */}
      <header style={{ flexShrink:0, height:46, borderBottom:`1px solid ${T.border}`,
        padding:"0 16px", display:"flex", alignItems:"center",
        justifyContent:"space-between", background: T.bg }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:28, height:28, borderRadius:6, background:"#10b981",
            display:"flex", alignItems:"center", justifyContent:"center",
            color:"#030712", fontWeight:700, fontSize:14, userSelect:"none" }}>P</div>
          <span style={{ color: T.text, fontWeight:600, fontSize:15, letterSpacing:"-0.02em" }}>Parsly</span>
          <span style={{ fontSize:11, color: T.mute, background: T.bg2,
            padding:"2px 8px", borderRadius:20, border:`1px solid ${T.border}` }}>v2.0</span>
          {parsed && (
            <span style={{ fontSize:11, color: dotColor, background: "transparent",
              padding:"2px 8px", borderRadius:20, border:`1px solid ${dotColor}` }}>
              {(inputType || 'json').toUpperCase()}
            </span>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" }}>
          <button onClick={loadSample}     style={hdrBtn(false)}>JSON</button>
          <button onClick={loadXMLSample}  style={hdrBtn(false)}>XML</button>
          <button onClick={loadCSVSample}  style={hdrBtn(false)}>CSV</button>
          <button onClick={loadYAMLSample} style={hdrBtn(false)}>YAML</button>
          <div style={{ width:1, height:18, background: T.border, margin:"0 2px" }} />
          <button onClick={() => setShowContact(true)} title="Contact"
            style={{ ...hdrBtn(false), padding:"5px 9px", fontSize:15 }}>✉</button>
          <button onClick={() => setDark(!dark)}
            style={{ ...hdrBtn(false), padding:"5px 9px" }}>{dark ? "☀" : "☾"}</button>
          <button onClick={() => setShowContribute(true)} style={hdrBtn(false, true)}>$ Contribute</button>
        </div>
      </header>

      {/* Toolbar */}
      <Toolbar onFormat={format} onMinify={minify} onCopy={copy} onClear={clear}
               copyLabel={copyLabel} hasParsed={!!parsed} dark={dark} inputType={inputType} />

      {/* Main */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>

        {/* Left panel */}
        <div style={{ ...col, width:"50%", borderRight:`1px solid ${T.border}` }}>
          <div style={{ flexShrink:0, padding:"5px 16px", borderBottom:`1px solid ${T.border}`,
            background: T.bg, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ width:7, height:7, borderRadius:"50%", flexShrink:0,
              display:"inline-block", background: dotColor }} />
            <span style={{ fontSize:11, color: T.mute, letterSpacing:"0.1em" }}>INPUT</span>
            {input && (
              <span style={{ marginLeft:"auto", fontSize:11, color: T.mute2 }}>
                {new Blob([input]).size < 1024
                  ? `${new Blob([input]).size} B`
                  : `${(new Blob([input]).size / 1024).toFixed(1)} KB`}
              </span>
            )}
          </div>
          <div style={{ flex:1, minHeight:0, overflow:"hidden" }}>
            <Editor value={input} onChange={tryParse} dark={dark} error={!!error}
              language={(inputType || 'json') === "xml" ? "xml" : "json"} />
          </div>
        </div>

        {/* Right panel */}
        <div style={{ ...col, flex:1 }}>
          {/* Tabs — pinned, never moves */}
          <div style={{ flexShrink:0, borderBottom:`1px solid ${T.border}`,
            background: T.bg, display:"flex", padding:"0 16px" }}>
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding:"9px 12px", fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase",
                border:"none", borderBottom: activeTab === tab ? "2px solid #10b981" : "2px solid transparent",
                background:"transparent", cursor:"pointer", transition:"all 0.15s",
                color: activeTab === tab ? "#10b981" : T.mute, fontFamily:"inherit",
              }}>{tab}</button>
            ))}
          </div>

          {/* Scrollable content */}
          <div style={{ flex:1, minHeight:0, overflowY:"auto", overflowX:"hidden",
            padding:16, background: T.bg }}>

            {/* Error */}
            {error && (
              <div style={{ display:"flex", gap:12, background:"rgba(127,29,29,0.25)",
                border:"1px solid #7f1d1d", borderRadius:8, padding:14, marginBottom:16 }}>
                <span style={{ color:"#f87171", flexShrink:0 }}>✗</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#fecaca", marginBottom:3 }}>
                    Invalid {(inputType || 'json').toUpperCase()}
                  </div>
                  <div style={{ fontSize:11, opacity:0.8, color:"#fca5a5" }}>{error}</div>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!input && !error && activeTab !== "convert" && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                justifyContent:"center", height:"80%", gap:10, opacity:0.12, userSelect:"none" }}>
                <div style={{ fontSize:52, fontWeight:700, color: T.mute }}>{"{}"}</div>
                <div style={{ fontSize:13, color: T.mute }}>Paste JSON · XML · CSV · YAML</div>
              </div>
            )}

            {/* Tab content */}
            {parsed && activeTab === "tree"   && <TreeView data={parsed} dark={dark} />}
            {parsed && activeTab === "search" && <SearchPanel data={parsed} dark={dark} />}
            {activeTab === "convert"          && <ConvertPanel key={`${clearKey}-${inputType}`} data={parsed} input={input} inputType={inputType} dark={dark} />}
            {parsed && activeTab === "types"  && <TypesPanel data={parsed} dark={dark} />}
            {parsed && activeTab === "json"   && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ display:"flex", justifyContent:"flex-end" }}>
                  <button id="json-copy-btn"
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(parsed, null, 2)).then(() => {
                      const b = document.getElementById("json-copy-btn");
                      if (b) { b.textContent = "✓ Copied"; setTimeout(() => b.textContent = "Copy JSON", 1500); }
                    })}
                    style={{ fontSize:11, padding:"4px 12px", borderRadius:6, cursor:"pointer",
                      border:`1px solid ${dark ? "#374151" : "#e2e8f0"}`, background:"transparent",
                      color: dark ? "#6b7280" : "#94a3b8", fontFamily:"inherit" }}>
                    Copy JSON
                  </button>
                </div>
                <pre style={{ fontSize:12, color: dark ? "#d1d5db" : "#374151",
                  lineHeight:1.6, whiteSpace:"pre-wrap", wordBreak:"break-word", margin:0,
                  background: dark ? "#111827" : "#ffffff", borderRadius:8, padding:14,
                  border:`1px solid ${dark ? "#1f2937" : "#e2e8f0"}` }}>
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
    </div>
  );
}