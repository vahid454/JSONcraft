import { useState } from "react";
import yaml from "js-yaml";
import Papa from "papaparse";

// ── FROM JSON converters ────────────────────────────────────
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

function toYAML(data) {
  try { return yaml.dump(data, { indent: 2 }); }
  catch (e) { return `Error: ${e.message}`; }
}

function toCSV(data) {
  try {
    const arr = Array.isArray(data) ? data : [data];
    return Papa.unparse(arr.map(item =>
      typeof item === "object" && item !== null ? flattenObject(item) : { value: item }
    ));
  } catch (e) { return `Error: ${e.message}`; }
}

function toXML(data, root = "root") {
  const san = t => String(t).replace(/[^a-zA-Z0-9_\-.]/g, "_").replace(/^[^a-zA-Z_]/, "_$&");
  const esc = v => String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const conv = (val, tag) => {
    const t = san(tag);
    if (val === null || val === undefined) return `<${t}/>`;
    if (typeof val !== "object") return `<${t}>${esc(val)}</${t}>`;
    if (Array.isArray(val)) return val.map((v, i) => "  " + conv(v, `item_${i}`)).join("\n");
    const inner = Object.entries(val).map(([k, v]) => "  " + conv(v, k)).join("\n");
    return `<${t}>\n${inner}\n</${t}>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n${conv(data, root)}`;
}

// ── TO JSON converters ──────────────────────────────────────
function yamlToJSON(str) {
  try { return JSON.stringify(yaml.load(str), null, 2); }
  catch (e) { return `Error: ${e.message}`; }
}

function csvToJSON(str) {
  try {
    const result = Papa.parse(str.trim(), { header: true, skipEmptyLines: true });
    return JSON.stringify(result.data, null, 2);
  } catch (e) { return `Error: ${e.message}`; }
}

function xmlToJSON(str) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(str, "text/xml");
    const err = doc.querySelector("parsererror");
    if (err) return `Error: Invalid XML`;
    function nodeToObj(node) {
      if (node.nodeType === 3) return node.nodeValue.trim();
      const obj = {};
      for (const attr of node.attributes || []) obj[`@${attr.name}`] = attr.value;
      for (const child of node.childNodes) {
        if (child.nodeType === 3 && child.nodeValue.trim() === "") continue;
        const val = nodeToObj(child);
        if (obj[child.nodeName] !== undefined) {
          if (!Array.isArray(obj[child.nodeName])) obj[child.nodeName] = [obj[child.nodeName]];
          obj[child.nodeName].push(val);
        } else { obj[child.nodeName] = val; }
      }
      const keys = Object.keys(obj);
      if (keys.length === 1 && keys[0] === "#text") return obj["#text"];
      return obj;
    }
    return JSON.stringify(nodeToObj(doc.documentElement), null, 2);
  } catch (e) { return `Error: ${e.message}`; }
}

// ── Mode config ─────────────────────────────────────────────
const MODES = [
  { id: "json-yaml", label: "JSON → YAML", dir: "from" },
  { id: "json-csv",  label: "JSON → CSV",  dir: "from" },
  { id: "json-xml",  label: "JSON → XML",  dir: "from" },
  { id: "yaml-json", label: "YAML → JSON", dir: "to"   },
  { id: "csv-json",  label: "CSV → JSON",  dir: "to"   },
  { id: "xml-json",  label: "XML → JSON",  dir: "to"   },
];

export default function ConvertPanel({ data, input, inputType, dark }) {
  const bg    = dark ? "#030712" : "#f8fafc";
  const bg2   = dark ? "#111827" : "#ffffff";
  const bdr   = dark ? "#1f2937" : "#e2e8f0";
  const txt   = dark ? "#d1d5db" : "#374151";
  const mute  = dark ? "#6b7280" : "#94a3b8";

  // Auto-select xml-json if user pasted XML on left
  const [mode, setMode]       = useState(inputType === "xml" ? "xml-json" : "json-yaml");
  const [toInput, setToInput] = useState(inputType === "xml" ? input : "");
  const [copied, setCopied]   = useState(false);

  const isTo = MODES.find(m => m.id === mode)?.dir === "to";

  const getResult = () => {
    if (mode === "json-yaml") return toYAML(data);
    if (mode === "json-csv")  return toCSV(data);
    if (mode === "json-xml")  return toXML(data);
    if (mode === "yaml-json") return yamlToJSON(toInput);
    if (mode === "csv-json")  return csvToJSON(toInput);
    if (mode === "xml-json")  return xmlToJSON(toInput || input);
    return "";
  };

  const result = getResult();

  const copy = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const fromLabel = mode.split("-")[0].toUpperCase();
  const toLabel   = mode.split("-")[1].toUpperCase();

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, height:"100%", minHeight:0 }}>

      {/* Mode buttons */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, flexShrink:0 }}>
        {MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} style={{
            padding:"5px 12px", fontSize:11, borderRadius:6, cursor:"pointer",
            fontFamily:"inherit", transition:"all 0.15s", border:"1px solid",
            borderColor: mode === m.id ? "#10b981" : (dark ? "#374151" : "#e2e8f0"),
            background: mode === m.id ? "#10b981" : "transparent",
            color: mode === m.id ? "#030712" : mute,
            fontWeight: mode === m.id ? 700 : 400,
          }}>{m.label}</button>
        ))}
        <button onClick={copy} style={{
          marginLeft:"auto", padding:"5px 12px", fontSize:11, borderRadius:6,
          border:`1px solid ${copied ? "#10b981" : (dark ? "#374151" : "#e2e8f0")}`,
          background:"transparent", cursor:"pointer", fontFamily:"inherit",
          color: copied ? "#10b981" : mute, transition:"all 0.15s",
        }}>{copied ? "✓ Copied" : "Copy"}</button>
      </div>

      {/* Input area for → JSON modes */}
      {isTo && (
        <div style={{ flexShrink:0 }}>
          <div style={{ fontSize:11, color: mute, marginBottom:6,
            letterSpacing:"0.08em", textTransform:"uppercase" }}>
            Paste {fromLabel} here
          </div>
          <textarea
            value={toInput}
            onChange={e => setToInput(e.target.value)}
            placeholder={`Paste your ${fromLabel} here to convert to JSON...`}
            style={{ width:"100%", height:130, background: bg2,
              border:`1px solid ${bdr}`, borderRadius:8, padding:12,
              fontSize:12, color: txt, fontFamily:"inherit",
              resize:"vertical", outline:"none", boxSizing:"border-box", lineHeight:1.6 }}
          />
        </div>
      )}

      {/* CSV hint */}
      {mode === "json-csv" && (
        <div style={{ fontSize:11, color: mute, background: bg2, border:`1px solid ${bdr}`,
          borderRadius:6, padding:"8px 12px", flexShrink:0 }}>
          Nested objects → dot notation &nbsp;·&nbsp; Arrays → indexed &nbsp;·&nbsp; Simple arrays → joined with |
        </div>
      )}

      {/* Output label */}
      <div style={{ fontSize:11, color: mute, letterSpacing:"0.08em",
        textTransform:"uppercase", flexShrink:0 }}>
        {isTo ? "JSON output" : `${toLabel} output`}
      </div>

      {/* Output */}
      <pre style={{ flex:1, minHeight:0, fontSize:11, color: txt, lineHeight:1.6,
        whiteSpace:"pre-wrap", wordBreak:"break-word", margin:0,
        background: bg2, borderRadius:8, padding:16,
        border:`1px solid ${bdr}`, overflowY:"auto" }}>
        {result || (isTo && !toInput ? `Paste ${fromLabel} above to convert to JSON` : "")}
      </pre>
    </div>
  );
}