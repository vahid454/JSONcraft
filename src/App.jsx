import { useState, useCallback } from "react";
import Editor from "./components/Editor";
import TreeView from "./components/TreeView";
import Toolbar from "./components/Toolbar";
import StatusBar from "./components/StatusBar";
import ConvertPanel from "./components/ConvertPanel";
import TypesPanel from "./components/TypesPanel";
import SearchPanel from "./components/SearchPanel";
import ContactModal from "./components/ContactModal";
import ContributeModal from "./components/ContributeModal";

const TABS = ["tree", "search", "convert", "types", "raw"];

function parseXML(str) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(str, "text/xml");
  const err    = doc.querySelector("parsererror");
  if (err) throw new Error("Invalid XML: " + err.textContent.slice(0, 80));
  function nodeToObj(node) {
    if (node.nodeType === 3) return node.nodeValue.trim();
    const obj = {};
    for (const attr of node.attributes || []) obj[`@${attr.name}`] = attr.value;
    for (const child of node.childNodes) {
      if (child.nodeType === 3 && !child.nodeValue.trim()) continue;
      const val = nodeToObj(child);
      if (obj[child.nodeName] !== undefined) {
        if (!Array.isArray(obj[child.nodeName])) obj[child.nodeName] = [obj[child.nodeName]];
        obj[child.nodeName].push(val);
      } else obj[child.nodeName] = val;
    }
    const keys = Object.keys(obj);
    if (keys.length === 1 && keys[0] === "#text") return obj["#text"];
    return obj;
  }
  return nodeToObj(doc.documentElement);
}

function detectType(val) {
  const t = val.trimStart();
  if (t.startsWith("<")) return "xml";
  return "json";
}

export default function App() {
  const [input, setInput]       = useState("");
  const [parsed, setParsed]     = useState(null);
  const [error, setError]       = useState(null);
  const [inputType, setInputType] = useState("json");
  const [dark, setDark]         = useState(true);
  const [activeTab, setActiveTab] = useState("tree");
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [showContact, setShowContact]       = useState(false);
  const [showContribute, setShowContribute] = useState(false);

  const tryParse = useCallback((val) => {
    setInput(val);
    if (!val.trim()) { setParsed(null); setError(null); return; }
    const type = detectType(val);
    setInputType(type);
    try {
      setParsed(type === "xml" ? parseXML(val) : JSON.parse(val));
      setError(null);
    } catch (e) {
      setParsed(null);
      setError(e.message);
    }
  }, []);

  const format = () => { if (parsed && inputType === "json") setInput(JSON.stringify(parsed, null, 2)); };
  const minify = () => { if (parsed && inputType === "json") setInput(JSON.stringify(parsed)); };
  const clear  = () => { setInput(""); setParsed(null); setError(null); setInputType("json"); };
  const copy   = () => {
    navigator.clipboard.writeText(input).then(() => {
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy"), 2000);
    });
  };

  const loadSample = () => tryParse(JSON.stringify({
    app: "JSONcraft", version: "2.0.0",
    features: ["format", "tree view", "convert", "search"],
    author: { name: "Vahid", role: "developer" },
    stats: { users: 1200, uptime: 99.97 }
  }, null, 2));

  const loadXMLSample = () => tryParse(`<?xml version="1.0" encoding="UTF-8"?>
<company>
  <name>JSONcraft</name>
  <version>2.0.0</version>
  <author>
    <name>Vahid</name>
    <role>developer</role>
  </author>
  <features>
    <feature>format</feature>
    <feature>tree view</feature>
    <feature>convert</feature>
  </features>
</company>`);

  const T = {
    bg:     dark ? "#030712" : "#f8fafc",
    bg2:    dark ? "#0f172a" : "#ffffff",
    border: dark ? "#1f2937" : "#e2e8f0",
    text:   dark ? "#f3f4f6" : "#0f172a",
    mute:   dark ? "#4b5563" : "#94a3b8",
    mute2:  dark ? "#374151" : "#cbd5e1",
  };

  const col = { display:"flex", flexDirection:"column", minHeight:0, minWidth:0, overflow:"hidden" };

  const hdrBtn = (highlight) => ({
    fontSize: 12, padding: "5px 11px", borderRadius: 6, cursor: "pointer",
    fontFamily: "inherit", transition: "all 0.15s",
    border: `1px solid ${highlight ? "#10b981" : T.border}`,
    background: highlight ? "#10b981" : "transparent",
    color: highlight ? "#030712" : T.mute,
    fontWeight: highlight ? 700 : 400,
  });

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", overflow:"hidden",
      fontFamily:"'JetBrains Mono','Fira Code',monospace", background: T.bg, color: T.text }}>

      {/* ── Header ── */}
      <header style={{ flexShrink:0, height:46, borderBottom:`1px solid ${T.border}`,
        padding:"0 16px", display:"flex", alignItems:"center",
        justifyContent:"space-between", background: T.bg }}>

        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:28, height:28, borderRadius:6, background:"#10b981",
            display:"flex", alignItems:"center", justifyContent:"center",
            color:"#030712", fontWeight:700, fontSize:14, userSelect:"none" }}>J</div>
          <span style={{ color: T.text, fontWeight:600, fontSize:15, letterSpacing:"-0.02em" }}>JSONcraft</span>
          <span style={{ fontSize:11, color: T.mute, background: T.bg2,
            padding:"2px 8px", borderRadius:20, border:`1px solid ${T.border}` }}>v2.0</span>
          {inputType === "xml" && parsed && (
            <span style={{ fontSize:11, color:"#f59e0b", background: dark ? "#451a03" : "#fffbeb",
              padding:"2px 8px", borderRadius:20, border:"1px solid #92400e" }}>XML</span>
          )}
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <button onClick={loadSample}    style={hdrBtn(false)}>JSON sample</button>
          <button onClick={loadXMLSample} style={hdrBtn(false)}>XML sample</button>
          <div style={{ width:1, height:18, background: T.border, margin:"0 2px" }} />
          <button onClick={() => setShowContact(true)} title="Contact us"
            style={{ ...hdrBtn(false), fontSize:15, padding:"5px 9px" }}>✉</button>
          <button onClick={() => setDark(!dark)} style={{ ...hdrBtn(false), padding:"5px 9px" }}>
            {dark ? "☀" : "☾"}
          </button>
          <button onClick={() => setShowContribute(true)} style={{
            ...hdrBtn(false),
            color:"#f59e0b", borderColor: dark ? "#78350f" : "#fcd34d",
            background: dark ? "#1c1007" : "#fffbeb",
            fontWeight:700, display:"flex", alignItems:"center", gap:5,
          }}>
            <span>$</span> Contribute
          </button>
        </div>
      </header>

      {/* ── Toolbar ── */}
      <Toolbar onFormat={format} onMinify={minify} onCopy={copy} onClear={clear}
               copyLabel={copyLabel} hasParsed={!!parsed} dark={dark} inputType={inputType} />

      {/* ── Main ── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>

        {/* Left */}
        <div style={{ ...col, width:"50%", borderRight:`1px solid ${T.border}` }}>
          <div style={{ flexShrink:0, padding:"5px 16px", borderBottom:`1px solid ${T.border}`,
            background: T.bg, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ width:7, height:7, borderRadius:"50%",
              background: inputType === "xml" ? "#f59e0b" : "#10b981", display:"inline-block" }} />
            <span style={{ fontSize:11, color: T.mute, letterSpacing:"0.1em" }}>INPUT</span>
            {input && <span style={{ marginLeft:"auto", fontSize:11, color: T.mute2 }}>{new Blob([input]).size} B</span>}
          </div>
          <div style={{ flex:1, minHeight:0, overflow:"hidden" }}>
            <Editor value={input} onChange={tryParse} dark={dark} error={!!error}
                    language={inputType === "xml" ? "xml" : "json"} />
          </div>
        </div>

        {/* Right */}
        <div style={{ ...col, flex:1 }}>
          <div style={{ flexShrink:0, borderBottom:`1px solid ${T.border}`,
            background: T.bg, display:"flex", padding:"0 16px" }}>
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding:"9px 12px", fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase",
                border:"none", borderBottom: activeTab === tab ? "2px solid #10b981" : "2px solid transparent",
                background:"transparent", cursor:"pointer", transition:"all 0.15s",
                color: activeTab === tab ? "#10b981" : T.mute,
                fontFamily:"inherit",
              }}>{tab}</button>
            ))}
          </div>

          <div style={{ flex:1, minHeight:0, overflowY:"auto", overflowX:"hidden",
            padding:16, background: T.bg }}>

            {error && (
              <div style={{ display:"flex", gap:12, background:"rgba(127,29,29,0.25)",
                border:"1px solid #7f1d1d", borderRadius:8, padding:14, marginBottom:16 }}>
                <span style={{ color:"#f87171", flexShrink:0 }}>✗</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#fecaca", marginBottom:3 }}>
                    {inputType === "xml" ? "Invalid XML" : "Invalid JSON"}
                  </div>
                  <div style={{ fontSize:11, opacity:0.8, color:"#fca5a5" }}>{error}</div>
                </div>
              </div>
            )}

            {!input && !error && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                justifyContent:"center", height:"80%", gap:10, opacity:0.12, userSelect:"none" }}>
                <div style={{ fontSize:52, fontWeight:700, color: T.mute }}>{"{}"}</div>
                <div style={{ fontSize:13, color: T.mute }}>Paste JSON or XML on the left</div>
              </div>
            )}

            {parsed && activeTab === "tree"    && <TreeView data={parsed} dark={dark} />}
            {parsed && activeTab === "search"  && <SearchPanel data={parsed} dark={dark} />}
            {parsed && activeTab === "convert" && <ConvertPanel data={parsed} input={input} inputType={inputType} dark={dark} />}
            {parsed && activeTab === "types"   && <TypesPanel data={parsed} dark={dark} />}
            {parsed && activeTab === "raw"     && (
              <pre style={{ fontSize:12, color: dark ? "#d1d5db" : "#374151",
                lineHeight:1.6, whiteSpace:"pre-wrap", wordBreak:"break-word", margin:0 }}>
                {JSON.stringify(parsed, null, 2)}
              </pre>
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