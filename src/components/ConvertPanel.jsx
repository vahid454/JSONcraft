import { useState } from "react";
import yaml from "js-yaml";
import Papa from "papaparse";

function toYAML(data) {
  try { return yaml.dump(data, { indent: 2 }); }
  catch { return "Cannot convert to YAML"; }
}

// Flatten nested object into dot-notation keys
// e.g. { user: { name: "Vahid" } } → { "user.name": "Vahid" }
function flattenObject(obj, prefix = "") {
  const result = {};
  for (const [key, val] of Object.entries(obj || {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (val === null || val === undefined) {
      result[path] = "";
    } else if (Array.isArray(val)) {
      // For simple arrays (strings/numbers), join with |
      // For object arrays, flatten each item with index
      if (val.length === 0) {
        result[path] = "";
      } else if (typeof val[0] === "object" && val[0] !== null) {
        val.forEach((item, i) => {
          const nested = flattenObject(item, `${path}[${i}]`);
          Object.assign(result, nested);
        });
      } else {
        result[path] = val.join(" | ");
      }
    } else if (typeof val === "object") {
      const nested = flattenObject(val, path);
      Object.assign(result, nested);
    } else {
      result[path] = val;
    }
  }
  return result;
}

function toCSV(data) {
  try {
    const arr = Array.isArray(data) ? data : [data];
    const flattened = arr.map(item =>
      typeof item === "object" && item !== null ? flattenObject(item) : { value: item }
    );
    return Papa.unparse(flattened);
  } catch (e) {
    return `CSV conversion error: ${e.message}`;
  }
}

function toXML(data, root = "root") {
  const sanitizeTag = tag => String(tag).replace(/[^a-zA-Z0-9_\-\.]/g, "_").replace(/^[^a-zA-Z_]/, "_$&");
  const convert = (val, tag) => {
    const t = sanitizeTag(tag);
    if (val === null || val === undefined) return `<${t}/>`;
    if (typeof val !== "object") return `<${t}>${String(val).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</${t}>`;
    if (Array.isArray(val)) return val.map((v, i) => convert(v, `item_${i}`)).join("\n");
    const inner = Object.entries(val).map(([k, v]) => "  " + convert(v, k)).join("\n");
    return `<${t}>\n${inner}\n</${t}>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n${convert(data, root)}`;
}

export default function ConvertPanel({ data, input }) {
  const [format, setFormat] = useState("yaml");
  const [copied, setCopied] = useState(false);

  const outputs = {
    yaml: toYAML(data),
    csv:  toCSV(data),
    xml:  toXML(data),
  };
  const result = outputs[format];

  const copy = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {["yaml", "csv", "xml"].map(f => (
          <button key={f} onClick={() => setFormat(f)} style={{
            padding: "6px 14px", fontSize: 11, borderRadius: 6, border: "1px solid",
            textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer",
            fontFamily: "inherit", transition: "all 0.15s",
            borderColor: format === f ? "#10b981" : "#374151",
            background: format === f ? "#10b981" : "transparent",
            color: format === f ? "#030712" : "#9ca3af",
            fontWeight: format === f ? 700 : 400,
          }}>{f}</button>
        ))}
        <button onClick={copy} style={{
          marginLeft: "auto", padding: "6px 14px", fontSize: 11, borderRadius: 6,
          border: "1px solid #374151", background: "transparent", cursor: "pointer",
          color: copied ? "#10b981" : "#9ca3af", fontFamily: "inherit",
          borderColor: copied ? "#10b981" : "#374151", transition: "all 0.15s",
        }}>
          {copied ? "✓ Copied" : "Copy output"}
        </button>
      </div>

      {format === "csv" && (
        <div style={{
          fontSize: 11, color: "#6b7280", background: "#111827",
          border: "1px solid #1f2937", borderRadius: 6, padding: "8px 12px", flexShrink: 0,
        }}>
          Nested objects are flattened using dot notation (e.g. <span style={{color:"#10b981"}}>user.name</span>).
          Arrays of objects are expanded with indexes (e.g. <span style={{color:"#10b981"}}>projects[0].name</span>).
          Simple arrays are joined with <span style={{color:"#10b981"}}> | </span>.
        </div>
      )}

      <pre style={{
        flex: 1, fontSize: 11, color: "#d1d5db", lineHeight: 1.6,
        whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0,
        background: "#111827", borderRadius: 8, padding: 16,
        border: "1px solid #1f2937", overflowY: "auto", minHeight: 0,
      }}>
        {result}
      </pre>
    </div>
  );
}