import { useState, useEffect } from "react";
import yaml from "js-yaml";
import Papa from "papaparse";

function flattenObject(obj, prefix = "") {
  const result = {};
  for (const [key, val] of Object.entries(obj || {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (val === null || val === undefined) { result[path] = ""; }
    else if (Array.isArray(val)) {
      if (val.length === 0) { result[path] = ""; }
      else if (typeof val[0] === "object" && val[0] !== null) {
        val.forEach((item, i) => Object.assign(result, flattenObject(item, `${path}[${i}]`)));
      } else { result[path] = val.join(" | "); }
    } else if (typeof val === "object") {
      Object.assign(result, flattenObject(val, path));
    } else { result[path] = val; }
  }
  return result;
}

function toYAML(data)  { try { return yaml.dump(data, { indent: 2 }); } catch(e) { return `Error: ${e.message}`; } }
function toCSV(data)   {
  try {
    const arr = Array.isArray(data) ? data : [data];
    return Papa.unparse(arr.map(i => typeof i === "object" && i ? flattenObject(i) : { value: i }));
  } catch(e) { return `Error: ${e.message}`; }
}
function toXML(data, root = "root") {
  const san = t => String(t).replace(/[^a-zA-Z0-9_\-.]/g,"_").replace(/^[^a-zA-Z_]/,"_$&");
  const esc = v => String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const conv = (val, tag) => {
    const t = san(tag);
    if (val === null || val === undefined) return `<${t}/>`;
    if (typeof val !== "object") return `<${t}>${esc(val)}</${t}>`;
    if (Array.isArray(val)) return val.map((v,i) => "  " + conv(v,`item_${i}`)).join("\n");
    return `<${t}>\n${Object.entries(val).map(([k,v]) => "  " + conv(v,k)).join("\n")}\n</${t}>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n${conv(data, root)}`;
}
function yamlToJSON(str) { try { return JSON.stringify(yaml.load(str), null, 2); } catch(e) { return `Error: ${e.message}`; } }
function csvToJSON(str)  {
  try {
    const r = Papa.parse(str.trim(), { header: true, skipEmptyLines: true });
    return JSON.stringify(r.data, null, 2);
  } catch(e) { return `Error: ${e.message}`; }
}
function xmlToJSON(str)  {
  try {
    const doc = new DOMParser().parseFromString(str, "text/xml");
    if (doc.querySelector("parsererror")) return "Error: Invalid XML";
    function n2o(node) {
      if (node.nodeType === 3) return node.nodeValue.trim();
      const obj = {};
      for (const a of node.attributes || []) obj[`@${a.name}`] = a.value;
      for (const c of node.childNodes) {
        if (c.nodeType === 3 && !c.nodeValue.trim()) continue;
        const v = n2o(c);
        if (obj[c.nodeName] !== undefined) {
          if (!Array.isArray(obj[c.nodeName])) obj[c.nodeName] = [obj[c.nodeName]];
          obj[c.nodeName].push(v);
        } else obj[c.nodeName] = v;
      }
      const k = Object.keys(obj);
      if (k.length === 1 && k[0] === "#text") return obj["#text"];
      return obj;
    }
    return JSON.stringify(n2o(doc.documentElement), null, 2);
  } catch(e) { return `Error: ${e.message}`; }
}

// sub-tabs inside Convert panel
const SUB_TABS = [
  { id:"yaml",     label:"YAML",         dir:"from", desc:"JSON → YAML"         },
  { id:"csv",      label:"CSV",          dir:"from", desc:"JSON → CSV"           },
  { id:"xml-out",  label:"XML",          dir:"from", desc:"JSON → XML"           },
  { id:"yaml-in",  label:"YAML → JSON",  dir:"to",   from:"YAML"                },
  { id:"csv-in",   label:"CSV → JSON",   dir:"to",   from:"CSV"                 },
  { id:"xml-in",   label:"XML → JSON",   dir:"to",   from:"XML"                 },
];

export default function ConvertPanel({ data, input, inputType, dark }) {
  const bg2  = dark ? "#111827" : "#ffffff";
  const bdr  = dark ? "#1f2937" : "#e2e8f0";
  const txt  = dark ? "#d1d5db" : "#374151";
  const mute = dark ? "#6b7280" : "#94a3b8";
  const grp  = dark ? "#374151" : "#d1d5db";

  // default sub-tab based on what was pasted on left
  const defaultSub = () => {
    if (inputType === "xml")  return "xml-in";
    if (inputType === "csv")  return "csv-in";
    if (inputType === "yaml") return "yaml-in";
    return "yaml"; // JSON input — default to JSON→YAML
  };
  const [sub, setSub] = useState(defaultSub());
  // each "to" tab has its own persistent paste box — survives tab switches
  const [pasteYAML, setPasteYAML] = useState(inputType === "yaml" ? input : "");
  const [pasteCSV,  setPasteCSV]  = useState(inputType === "csv"  ? input : "");
  const [pasteXML,  setPasteXML]  = useState(inputType === "xml"  ? input : "");
  const [copied, setCopied]       = useState(false);

  // when inputType or input changes, auto-fill the matching "to JSON" tab
  useEffect(() => {
    // Always update the matching paste box with latest input
    if (!input) {
      // Input cleared — reset all paste boxes and go to default
      setPasteXML(""); setPasteCSV(""); setPasteYAML("");
      setSub("yaml");
      return;
    }
    if (inputType === "xml")  { setPasteXML(input);  setSub("xml-in");  }
    if (inputType === "csv")  { setPasteCSV(input);  setSub("csv-in");  }
    if (inputType === "yaml") { setPasteYAML(input); setSub("yaml-in"); }
    if (inputType === "json") { setSub("yaml"); } // JSON input → show JSON→YAML by default
  }, [input, inputType]);

  const currentTab = SUB_TABS.find(t => t.id === sub);
  const isTo = currentTab?.dir === "to";

  const getResult = () => {
    if (!isTo) {
      // "From JSON" modes — use left panel data
      if (!data) return "← Paste JSON on the left panel first";
      if (sub === "yaml")    return toYAML(data);
      if (sub === "csv")     return toCSV(data);
      if (sub === "xml-out") return toXML(data);
    } else {
      // "To JSON" modes — use their own paste box
      const paste = sub === "yaml-in" ? pasteYAML : sub === "csv-in" ? pasteCSV : pasteXML;
      if (!paste.trim()) return `Paste your ${currentTab.from} in the box above`;
      if (sub === "yaml-in") return yamlToJSON(paste);
      if (sub === "csv-in")  return csvToJSON(paste);
      if (sub === "xml-in")  return xmlToJSON(paste);
    }
    return "";
  };

  const result = getResult();

  const copy = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const getPaste = () => sub === "yaml-in" ? pasteYAML : sub === "csv-in" ? pasteCSV : pasteXML;
  const setPaste = (v) => {
    if (sub === "yaml-in") setPasteYAML(v);
    else if (sub === "csv-in") setPasteCSV(v);
    else setPasteXML(v);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0, height:"100%" }}>

      {/* ── Sub-tab bar ── */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:0, borderBottom:`1px solid ${bdr}`,
        marginBottom:12, flexShrink:0 }}>

        {/* Group label: From JSON */}
        <div style={{ width:"100%", display:"flex", alignItems:"center", gap:0 }}>
          <span style={{ fontSize:10, color: grp, letterSpacing:"0.08em",
            textTransform:"uppercase", padding:"4px 0 2px", marginRight:6 }}>From JSON →</span>
          {SUB_TABS.filter(t => t.dir === "from").map(t => (
            <button key={t.id} onClick={() => setSub(t.id)} style={{
              padding:"6px 14px", fontSize:11, border:"none",
              borderBottom: sub === t.id ? "2px solid #10b981" : "2px solid transparent",
              background:"transparent", cursor:"pointer", fontFamily:"inherit",
              color: sub === t.id ? "#10b981" : mute, transition:"all 0.12s",
              fontWeight: sub === t.id ? 600 : 400,
            }}>{t.label}</button>
          ))}

          <span style={{ fontSize:10, color: grp, letterSpacing:"0.08em",
            textTransform:"uppercase", padding:"4px 0 2px", margin:"0 6px 0 16px" }}>→ To JSON</span>
          {SUB_TABS.filter(t => t.dir === "to").map(t => (
            <button key={t.id} onClick={() => setSub(t.id)} style={{
              padding:"6px 14px", fontSize:11, border:"none",
              borderBottom: sub === t.id ? "2px solid #f59e0b" : "2px solid transparent",
              background:"transparent", cursor:"pointer", fontFamily:"inherit",
              color: sub === t.id ? "#f59e0b" : mute, transition:"all 0.12s",
              fontWeight: sub === t.id ? 600 : 400,
            }}>{t.label}</button>
          ))}

          {/* Copy button right aligned */}
          <button onClick={copy} style={{
            marginLeft:"auto", padding:"4px 12px", fontSize:11, borderRadius:6,
            border:`1px solid ${copied ? "#10b981" : bdr}`,
            background:"transparent", cursor:"pointer", fontFamily:"inherit",
            color: copied ? "#10b981" : mute, transition:"all 0.12s",
          }}>{copied ? "✓ Copied" : "Copy"}</button>
        </div>
      </div>

      {/* ── Paste box for "To JSON" tabs — persists across tab switches ── */}
      {isTo && (
        <div style={{ flexShrink:0, marginBottom:10 }}>
          <div style={{ fontSize:11, color: mute, marginBottom:5,
            letterSpacing:"0.08em", textTransform:"uppercase" }}>
            Paste {currentTab.from} here — works without JSON on the left
          </div>
          <textarea
            value={getPaste()}
            onChange={e => setPaste(e.target.value)}
            placeholder={`Paste any ${currentTab.from} here...`}
            style={{ width:"100%", height:120, background: bg2,
              border:`1px solid ${bdr}`, borderRadius:8, padding:12,
              fontSize:11, color: txt, fontFamily:"inherit",
              resize:"vertical", outline:"none", boxSizing:"border-box", lineHeight:1.6 }}
          />
        </div>
      )}

      {/* CSV hint */}
      {sub === "csv" && (
        <div style={{ fontSize:11, color: mute, background: bg2, border:`1px solid ${bdr}`,
          borderRadius:6, padding:"7px 12px", marginBottom:10, flexShrink:0 }}>
          Nested → dot notation &nbsp;·&nbsp; Object arrays → indexed &nbsp;·&nbsp; Simple arrays → joined with |
        </div>
      )}

      {/* ── Output label ── */}
      <div style={{ fontSize:11, color: mute, letterSpacing:"0.08em",
        textTransform:"uppercase", marginBottom:6, flexShrink:0 }}>
        {isTo ? "JSON output" : `${sub === "xml-out" ? "XML" : sub.toUpperCase()} output`}
      </div>

      {/* ── Output ── */}
      <pre style={{
        flex:1, minHeight:0, fontSize:11, color: txt, lineHeight:1.6,
        whiteSpace:"pre-wrap", wordBreak:"break-word", margin:0,
        background: bg2, borderRadius:8, padding:14,
        border:`1px solid ${bdr}`, overflowY:"auto",
      }}>
        {result}
      </pre>
    </div>
  );
}