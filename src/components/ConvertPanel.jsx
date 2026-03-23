import { useState, useEffect } from "react";
import { jsonToYAML, yamlToJSON, jsonToXML, xmlToJSON, jsonToCSV, csvToJSON } from "../utils/converters";

// Pretty-print an XML DOM node back to string
function prettyXML(node, depth) {
  const pad = "  ".repeat(depth);
  if (node.nodeType === 3) {
    const text = node.nodeValue.trim();
    return text ? `${pad}${text}` : "";
  }
  if (node.nodeType !== 1) return "";

  // Build opening tag with attributes
  let tag = node.nodeName;
  const attrs = Array.from(node.attributes || [])
    .map(a => `${a.name}="${a.value}"`)
    .join(" ");
  const openTag = attrs ? `<${tag} ${attrs}>` : `<${tag}>`;

  const children = Array.from(node.childNodes).filter(n => {
    if (n.nodeType === 3) return n.nodeValue.trim() !== "";
    return n.nodeType === 1;
  });

  if (children.length === 0) {
    const text = node.textContent.trim();
    if (!text) return `${pad}<${tag}${attrs ? " " + attrs : ""}/>`;
    return `${pad}${openTag}${text}</${tag}>`;
  }

  if (children.length === 1 && children[0].nodeType === 3) {
    return `${pad}${openTag}${children[0].nodeValue.trim()}</${tag}>`;
  }

  const inner = children.map(c => prettyXML(c, depth + 1)).filter(Boolean).join("\n");
  return `${pad}${openTag}\n${inner}\n${pad}</${tag}>`;
}

const SUB_TABS = [
  { id:"yaml",     label:"YAML",         dir:"from", desc:"JSON → YAML — preserves all types" },
  { id:"csv",      label:"CSV",          dir:"from", desc:"JSON → CSV — nested objects flattened with dot notation" },
  { id:"xml-out",  label:"XML",          dir:"from", desc:"JSON → XML — arrays wrapped with <item> children" },
  { id:"yaml-in",  label:"YAML → JSON",  dir:"to",   from:"YAML", desc:"Paste any YAML — converts to clean JSON" },
  { id:"csv-in",   label:"CSV → JSON",   dir:"to",   from:"CSV",  desc:"Paste any CSV — auto-detects types" },
  { id:"xml-in",   label:"XML → JSON",   dir:"to",   from:"XML",  desc:"Paste any XML — preserves attributes and arrays" },
];

export default function ConvertPanel({ data, input, inputType, dark }) {
  const bg2  = dark ? "#111827" : "#ffffff";
  const bdr  = dark ? "#1f2937" : "#e2e8f0";
  const txt  = dark ? "#d1d5db" : "#374151";
  const mute = dark ? "#6b7280" : "#94a3b8";
  const grp  = dark ? "#374151" : "#d1d5db";

  const defaultSub = () => {
    if (inputType === "xml")  return "xml-in";
    if (inputType === "csv")  return "csv-in";
    if (inputType === "yaml") return "yaml-in";
    return "yaml";
  };

  const [sub, setSub]             = useState(defaultSub());
  const [pasteYAML, setPasteYAML] = useState(inputType === "yaml" ? input : "");
  const [pasteCSV,  setPasteCSV]  = useState(inputType === "csv"  ? input : "");
  const [pasteXML,  setPasteXML]  = useState(inputType === "xml"  ? input : "");
  const [copied, setCopied]       = useState(false);

  useEffect(() => {
    if (!input) {
      setPasteXML(""); setPasteCSV(""); setPasteYAML("");
      setSub("yaml");
      return;
    }
    if (inputType === "xml")  { setPasteXML(input);  setSub("xml-in");  }
    if (inputType === "csv")  { setPasteCSV(input);  setSub("csv-in");  }
    if (inputType === "yaml") { setPasteYAML(input); setSub("yaml-in"); }
    if (inputType === "json") { setSub("yaml"); }
  }, [input, inputType]);

  const currentTab = SUB_TABS.find(t => t.id === sub);
  const isTo       = currentTab?.dir === "to";

  const getResult = () => {
    try {
      if (!isTo) {
        if (!data) return "← Paste data on the left panel first";
        if (sub === "yaml")    return jsonToYAML(data);
        if (sub === "csv")     return jsonToCSV(data);
        if (sub === "xml-out") {
          // If original input was already XML — reformat it directly
          // to preserve attributes, namespaces, and all original structure
          if (inputType === "xml" && input) {
            try {
              const doc = new DOMParser().parseFromString(input, "text/xml");
              if (!doc.querySelector("parsererror")) {
                return prettyXML(doc.documentElement, 0);
              }
            } catch {}
          }
          return jsonToXML(data);
        }
      } else {
        const paste = sub === "yaml-in" ? pasteYAML : sub === "csv-in" ? pasteCSV : pasteXML;
        if (!paste?.trim()) return `Paste your ${currentTab?.from || ""} in the box above`;
        if (sub === "yaml-in") return yamlToJSON(paste);
        if (sub === "csv-in")  return csvToJSON(paste);
        if (sub === "xml-in")  return xmlToJSON(paste);
      }
    } catch(e) { return `Error: ${e.message}`; }
    return "";
  };

  const result = getResult();

  const copy = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const getPaste = () => sub === "yaml-in" ? pasteYAML : sub === "csv-in" ? pasteCSV : pasteXML;
  const setPaste = v => {
    if (sub === "yaml-in") setPasteYAML(v);
    else if (sub === "csv-in") setPasteCSV(v);
    else setPasteXML(v);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0, height:"100%" }}>

      {/* Sub-tab bar */}
      <div style={{ borderBottom:`1px solid ${bdr}`, marginBottom:12, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap" }}>
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
          <button onClick={copy} style={{
            marginLeft:"auto", padding:"4px 12px", fontSize:11, borderRadius:6,
            border:`1px solid ${copied ? "#10b981" : bdr}`,
            background:"transparent", cursor:"pointer", fontFamily:"inherit",
            color: copied ? "#10b981" : mute, transition:"all 0.12s",
          }}>{copied ? "✓ Copied" : "Copy"}</button>
        </div>
      </div>

      {/* Hint */}
      <div style={{ fontSize:11, color: mute, background: bg2, border:`1px solid ${bdr}`,
        borderRadius:6, padding:"6px 12px", marginBottom:10, flexShrink:0 }}>
        {currentTab?.desc}
      </div>

      {/* Paste box for → JSON tabs */}
      {isTo && (
        <div style={{ flexShrink:0, marginBottom:10 }}>
          <div style={{ fontSize:11, color: mute, marginBottom:5,
            letterSpacing:"0.08em", textTransform:"uppercase" }}>
            Paste {currentTab?.from} here — works without data on the left
          </div>
          <textarea
            value={getPaste()}
            onChange={e => setPaste(e.target.value)}
            placeholder={`Paste any ${currentTab?.from} here...`}
            style={{ width:"100%", height:120, background: bg2, border:`1px solid ${bdr}`,
              borderRadius:8, padding:12, fontSize:11, color: txt, fontFamily:"inherit",
              resize:"vertical", outline:"none", boxSizing:"border-box", lineHeight:1.6 }}
          />
        </div>
      )}

      {/* Output label */}
      <div style={{ fontSize:11, color: mute, letterSpacing:"0.08em",
        textTransform:"uppercase", marginBottom:6, flexShrink:0 }}>
        {isTo ? "JSON output" : `${sub === "xml-out" ? "XML" : sub.toUpperCase()} output`}
      </div>

      {/* Output */}
      <pre style={{ flex:1, minHeight:0, fontSize:11, color: txt, lineHeight:1.6,
        whiteSpace:"pre-wrap", wordBreak:"break-word", margin:0,
        background: bg2, borderRadius:8, padding:14,
        border:`1px solid ${bdr}`, overflowY:"auto" }}>
        {result}
      </pre>
    </div>
  );
}