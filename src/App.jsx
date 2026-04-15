import { useState, useCallback, useRef, useEffect } from "react";
import { xmlToJSON, yamlToJSON, csvToJSON } from "./utils/converters";
import Editor from "./components/Editor";
import TreeView from "./components/TreeView";
import Toolbar from "./components/Toolbar";
import StatusBar from "./components/StatusBar";
import ConvertPanel from "./components/ConvertPanel";
import TypesPanel from "./components/TypesPanel";
import SearchPanel from "./components/SearchPanel";
import HistoryPanel, { useHistory } from "./components/HistoryPanel";
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
  { id:"history", label:"History", icon:"⏱" },
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

function typeColor(t) {
  if (t === "xml")  return "#f59e0b";
  if (t === "csv")  return "#a78bfa";
  if (t === "yaml") return "#38bdf8";
  return "#10b981";
}

function mkTheme(dark) {
  return dark ? {
    bg:"#080f1e", bg2:"#0d1929", bg3:"#111f35",
    border:"#1a2540", text:"#e2e8f0", textSub:"#94a3b8", mute:"#64748b", dimBg:"#1a2540",
  } : {
    bg:"#ffffff", bg2:"#f8fafc", bg3:"#f1f5f9",
    border:"#e2e8f0", text:"#0f172a", textSub:"#475569", mute:"#64748b", dimBg:"#e2e8f0",
  };
}

function NavBtn({ children, onClick, accent, T, extraStyle }) {
  const [hov, setHov] = useState(false);
  const s = {
    fontSize:12, padding:"5px 11px", borderRadius:7, cursor:"pointer",
    fontFamily:"inherit", transition:"all 0.14s",
    border: accent ? `1px solid ${accent}44` : `1px solid ${T.border}`,
    background: accent ? (hov ? `${accent}22` : `${accent}0e`) : (hov ? T.bg3 : "transparent"),
    color: accent || T.textSub, fontWeight:500,
    ...extraStyle,
  };
  return (
    <button onClick={onClick} style={s}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
      {children}
    </button>
  );
}

export default function App() {
  const [input, setInput]         = useState("");
  const [parsed, setParsed]       = useState(null);
  const [error, setError]         = useState(null);
  const [inputType, setInputType] = useState("json");
  const [dark, setDark]           = useState(true);
  const [activeTab, setActiveTab] = useState("tree");
  const [pageMode, setPageMode]   = useState(null);
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [showContact, setShowContact]     = useState(false);
  const [showContribute, setShowContribute] = useState(false);
  const [showUrlFetch, setShowUrlFetch]   = useState(false);
  const [clearKey, setClearKey]   = useState(0);
  const debounceRef  = useRef(null);
  const histPushRef  = useRef(null);

  const { entries: histEntries, push: histPush, remove: histRemove, clear: histClear } = useHistory();
  useEffect(() => { histPushRef.current = histPush; }, [histPush]);

  const goHome = useCallback(() => setPageMode(null), []);
  const T = mkTheme(dark);

  const tryParse = useCallback((val) => {
    try {
      setInput(val);
      if (!val || !val.trim()) { setParsed(null); setError(null); setInputType("json"); return; }
      const run = () => {
        try {
          const r = safeParse(val);
          setParsed(r.parsed || null);
          setError(r.error || null);
          setInputType(r.type || "json");
          if (r.parsed && !r.error) histPushRef.current?.(val, r.type || "json");
        } catch(e) { setParsed(null); setError(String(e.message||e)); setInputType("json"); }
      };
      clearTimeout(debounceRef.current);
      if (val.length < 50000) run();
      else debounceRef.current = setTimeout(run, 400);
    } catch(e) { setParsed(null); setError(String(e.message||e)); setInputType("json"); }
  }, []);

  const format = () => { if (parsed && inputType==="json") setInput(JSON.stringify(parsed,null,2)); };
  const minify = () => { if (parsed && inputType==="json") setInput(JSON.stringify(parsed)); };
  const clear  = () => {
    if (pageMode) { setPageMode(null); return; }
    setInput(""); setParsed(null); setError(null); setInputType("json"); setClearKey(k=>k+1);
  };
  const copy = () => {
    navigator.clipboard.writeText(input).then(() => { setCopyLabel("Copied!"); setTimeout(()=>setCopyLabel("Copy"),2000); });
  };

  const handleAppDrop = useCallback(async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const text = await new Promise(res => {
      const r = new FileReader();
      r.onload = ev => res(ev.target.result);
      r.readAsText(file, "UTF-8"); // FIX: explicit UTF-8
    });
    tryParse(text);
  }, [tryParse]);

  const col = { display:"flex", flexDirection:"column", minHeight:0, minWidth:0, overflow:"hidden" };
  const dotColor = typeColor(inputType || "json");
  const pageProps = { dark, onClose:goHome, onDarkToggle:()=>setDark(d=>!d) };

  // Full-window page modes
  if (pageMode === "diff")  return <div style={{height:"100vh",overflow:"hidden",fontFamily:"'JetBrains Mono','Fira Code',monospace"}}><DiffPage {...pageProps} initialLeft={input?(parsed?JSON.stringify(parsed,null,2):input):""} /></div>;
  if (pageMode === "jwt")   return <div style={{height:"100vh",overflow:"hidden",fontFamily:"'JetBrains Mono','Fira Code',monospace"}}><JWTPage  {...pageProps} initialToken={input?.trim().startsWith("ey")?input.trim():""} /></div>;
  if (pageMode === "tools") return <div style={{height:"100vh",overflow:"hidden",fontFamily:"'JetBrains Mono','Fira Code',monospace"}}><ToolsPage {...pageProps} /></div>;

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", overflow:"hidden",
      fontFamily:"'JetBrains Mono','Fira Code',monospace", background:T.bg, color:T.text }}>

      {/* Header */}
      <header style={{ flexShrink:0, height:50, borderBottom:`1px solid ${T.border}`,
        padding:"0 18px", display:"flex", alignItems:"center", justifyContent:"space-between",
        background:T.bg2 }}>

        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:9,
            background:"linear-gradient(135deg,#10b981 0%,#059669 100%)",
            display:"flex", alignItems:"center", justifyContent:"center",
            color:"#fff", fontWeight:800, fontSize:16, userSelect:"none",
            boxShadow:"0 2px 10px rgba(16,185,129,0.35)" }}>P</div>
          <span style={{ color:T.text, fontWeight:800, fontSize:17, letterSpacing:"-0.04em" }}>Parsly</span>
          <span style={{ fontSize:10, color:T.mute, background:T.bg3,
            padding:"2px 8px", borderRadius:20, border:`1px solid ${T.border}`, fontWeight:600 }}>v2.1</span>
          {parsed && (
            <span style={{ fontSize:10, color:dotColor, padding:"2px 9px", borderRadius:20,
              border:`1px solid ${dotColor}44`, background:`${dotColor}12`, fontWeight:700, letterSpacing:"0.04em" }}>
              {(inputType||"json").toUpperCase()}
            </span>
          )}
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <NavBtn onClick={()=>setShowUrlFetch(true)} T={T}>🌐 URL</NavBtn>
          <div style={{ width:1, height:20, background:T.border, margin:"0 3px" }} />
          <NavBtn onClick={()=>setPageMode("diff")}  T={T} accent="#a78bfa">⟺ Diff</NavBtn>
          <NavBtn onClick={()=>setPageMode("jwt")}   T={T} accent="#38bdf8">🔑 JWT</NavBtn>
          <NavBtn onClick={()=>setPageMode("tools")} T={T} accent="#fb923c">⚙ Tools</NavBtn>
          <div style={{ width:1, height:20, background:T.border, margin:"0 3px" }} />
          <NavBtn onClick={()=>setShowContact(true)} T={T} extraStyle={{ padding:"5px 9px", fontSize:15 }}>✉</NavBtn>
          <NavBtn onClick={()=>setDark(!dark)} T={T} extraStyle={{ padding:"5px 10px" }}>{dark?"☀":"☾"}</NavBtn>
          <NavBtn onClick={()=>setShowContribute(true)} T={T}
            extraStyle={{ color:"#f59e0b", border:"1px solid #78350f", background:"#1c1007", fontWeight:700 }}>
            $ Support
          </NavBtn>
        </div>
      </header>

      {/* Toolbar */}
      <Toolbar onFormat={format} onMinify={minify} onCopy={copy} onClear={clear}
               copyLabel={copyLabel} hasParsed={!!parsed} dark={dark} inputType={inputType}
               onFileUpload={tryParse} />

      {/* Main */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>

        {/* Left: Editor */}
        <div style={{ ...col, width:"50%", borderRight:`1px solid ${T.border}` }}
          onDragOver={e=>e.preventDefault()} onDrop={handleAppDrop}>

          <div style={{ flexShrink:0, padding:"6px 16px", borderBottom:`1px solid ${T.border}`,
            background:T.bg2, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:dotColor,
              boxShadow:`0 0 6px ${dotColor}66`, flexShrink:0 }} />
            <span style={{ fontSize:10, color:T.textSub, letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:600 }}>Input</span>
            <span style={{ fontSize:10, color:T.mute, opacity:0.7 }}>— paste · drag file · open</span>
            {input && (
              <span style={{ marginLeft:"auto", fontSize:10, color:T.mute }}>
                {new Blob([input]).size<1024 ? `${new Blob([input]).size} B` : `${(new Blob([input]).size/1024).toFixed(1)} KB`}
              </span>
            )}
          </div>

          <div style={{ flex:1, minHeight:0, overflow:"hidden" }}>
            <Editor value={input} onChange={tryParse} dark={dark} error={!!error}
              language={(inputType||"json")==="xml"?"xml":"json"} />
          </div>
        </div>

        {/* Right: Tabs */}
        <div style={{ ...col, flex:1 }}>
          <div style={{ flexShrink:0, borderBottom:`1px solid ${T.border}`,
            background:T.bg2, display:"flex", padding:"0 12px", gap:1 }}>
            {TABS.map(tab => {
              const isActive = activeTab===tab.id;
              return (
                <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{
                  padding:"10px 13px", fontSize:11, letterSpacing:"0.05em", textTransform:"uppercase",
                  border:"none", borderBottom: isActive?"2px solid #10b981":"2px solid transparent",
                  background:"transparent", cursor:"pointer", transition:"all 0.15s",
                  color: isActive?"#10b981":T.textSub,
                  fontFamily:"inherit", fontWeight: isActive?700:500,
                  display:"flex", alignItems:"center", gap:5,
                }}>
                  <span style={{ fontSize:10, opacity:isActive?0.8:0.5 }}>{tab.icon}</span>
                  {tab.label}
                  {tab.id==="history" && histEntries.length>0 && (
                    <span style={{ fontSize:9, padding:"1px 5px", borderRadius:10,
                      background:isActive?"#10b981":T.dimBg, color:isActive?"#fff":T.mute, fontWeight:700 }}>
                      {histEntries.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ flex:1, minHeight:0, overflowY:"auto", overflowX:"hidden",
            padding:16, background:T.bg }}>

            {error && (
              <div style={{ display:"flex", gap:10, background:"rgba(248,113,113,0.08)",
                border:"1px solid rgba(248,113,113,0.3)", borderRadius:8, padding:"12px 14px", marginBottom:14 }}>
                <span style={{ color:"#f87171", flexShrink:0, fontSize:15 }}>⚠</span>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:"#fca5a5", marginBottom:3 }}>
                    Invalid {(inputType||"json").toUpperCase()}
                  </div>
                  <div style={{ fontSize:11, color:"#f87171", opacity:0.85 }}>{error}</div>
                </div>
              </div>
            )}

            {!input && !error && activeTab!=="convert" && activeTab!=="history" && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                justifyContent:"center", height:"75%", gap:14, userSelect:"none" }}>
                <div style={{ fontSize:52, color:T.border }}>{"{}"}</div>
                <div style={{ fontSize:14, color:T.mute, fontWeight:600 }}>Paste any data to get started</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center" }}>
                  {["JSON","XML","YAML","CSV"].map(t=>(
                    <span key={t} style={{ fontSize:11, padding:"4px 12px", borderRadius:20,
                      border:`1px solid ${T.border}`, color:T.mute }}>{t}</span>
                  ))}
                </div>
                <div style={{ fontSize:11, color:T.mute, opacity:0.6 }}>
                  drag & drop · paste · load from URL · open file
                </div>
              </div>
            )}

            {parsed && activeTab==="tree"   && <TreeView data={parsed} dark={dark} />}
            {parsed && activeTab==="search" && <SearchPanel data={parsed} dark={dark} />}
            {activeTab==="convert"          && <ConvertPanel key={`${clearKey}-${inputType}`} data={parsed} input={input} inputType={inputType} dark={dark} />}
            {parsed && activeTab==="types"  && <TypesPanel data={parsed} dark={dark} />}
            {activeTab==="history"          && (
              <HistoryPanel entries={histEntries}
                onLoad={text=>{tryParse(text);setActiveTab("tree");}}
                onRemove={histRemove} onClear={histClear} dark={dark} />
            )}
            {parsed && activeTab==="json"   && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
                  <button onClick={format} style={{ fontSize:11, padding:"4px 12px", borderRadius:6,
                    cursor:"pointer", border:`1px solid ${T.border}`, background:"transparent",
                    color:T.textSub, fontFamily:"inherit" }}>Format</button>
                  <button id="json-copy-btn"
                    onClick={()=>navigator.clipboard.writeText(JSON.stringify(parsed,null,2)).then(()=>{
                      const b=document.getElementById("json-copy-btn");
                      if(b){b.textContent="✓ Copied";setTimeout(()=>b.textContent="Copy JSON",1500);}
                    })}
                    style={{ fontSize:11, padding:"4px 12px", borderRadius:6, cursor:"pointer",
                      border:`1px solid ${T.border}`, background:"transparent", color:T.textSub, fontFamily:"inherit" }}>
                    Copy JSON
                  </button>
                </div>
                <pre style={{ fontSize:12, color:T.text, lineHeight:1.7, whiteSpace:"pre-wrap",
                  wordBreak:"break-word", margin:0, background:T.bg2, borderRadius:8, padding:16,
                  border:`1px solid ${T.border}`, overflowY:"auto" }}>
                  {JSON.stringify(parsed,null,2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      <StatusBar input={input} parsed={parsed} error={error} dark={dark} inputType={inputType} />

      {showContact    && <ContactModal    onClose={()=>setShowContact(false)}    dark={dark} />}
      {showContribute && <ContributeModal onClose={()=>setShowContribute(false)} dark={dark} />}
      {showUrlFetch   && <UrlFetchModal   onLoad={tryParse} onClose={()=>setShowUrlFetch(false)} dark={dark} />}
    </div>
  );
}