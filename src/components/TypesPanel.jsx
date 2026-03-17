import { useState } from "react";

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function generateInterface(data, name = "Root", interfaces = []) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return "";
  const lines = [`interface ${name} {`];
  for (const [key, val] of Object.entries(data)) {
    const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `"${key}"`;
    if (val === null) {
      lines.push(`  ${safeKey}: null;`);
    } else if (Array.isArray(val)) {
      if (val.length > 0 && typeof val[0] === "object" && val[0] !== null) {
        const childName = name + capitalize(key) + "Item";
        generateInterface(val[0], childName, interfaces);
        lines.push(`  ${safeKey}: ${childName}[];`);
      } else {
        lines.push(`  ${safeKey}: ${val.length > 0 ? typeof val[0] : "unknown"}[];`);
      }
    } else if (typeof val === "object") {
      const childName = name + capitalize(key);
      generateInterface(val, childName, interfaces);
      lines.push(`  ${safeKey}: ${childName};`);
    } else {
      lines.push(`  ${safeKey}: ${typeof val};`);
    }
  }
  lines.push("}");
  interfaces.unshift(lines.join("\n"));
  return interfaces.join("\n\n");
}

export default function TypesPanel({ data, dark }) {
  const [copied, setCopied] = useState(false);

  const bg2  = dark ? "#111827" : "#ffffff";
  const bdr  = dark ? "#1f2937" : "#e2e8f0";
  const mute = dark ? "#6b7280" : "#94a3b8";

  const interfaces = [];
  const result = generateInterface(
    Array.isArray(data) ? (data[0] || {}) : data,
    "Root", interfaces
  );

  const copy = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const tokenColor = (line) => {
    if (line.startsWith("interface"))             return dark ? "#7dd3fc" : "#0369a1";
    if (line.includes(": string"))                return dark ? "#10b981" : "#059669";
    if (line.includes(": number"))                return dark ? "#60a5fa" : "#2563eb";
    if (line.includes(": boolean"))               return dark ? "#f59e0b" : "#d97706";
    if (line.includes(": null"))                  return dark ? "#f87171" : "#dc2626";
    if (line.includes("[]"))                      return dark ? "#c084fc" : "#7c3aed";
    if (line.trim() === "{" || line.trim() === "}") return dark ? "#9ca3af" : "#6b7280";
    return dark ? "#e2e8f0" : "#1e293b";
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10, height:"100%", minHeight:0 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ fontSize:11, color: mute, textTransform:"uppercase", letterSpacing:"0.08em" }}>
          TypeScript interfaces
        </div>
        <button onClick={copy} style={{
          fontSize:11, padding:"5px 12px", borderRadius:6, cursor:"pointer",
          border:`1px solid ${copied ? "#10b981" : bdr}`,
          color: copied ? "#10b981" : mute,
          background:"transparent", fontFamily:"inherit", transition:"all 0.15s",
        }}>
          {copied ? "✓ Copied" : "Copy types"}
        </button>
      </div>

      <pre style={{ flex:1, minHeight:0, margin:0, padding:16, borderRadius:8, overflowY:"auto",
        background: bg2, border:`1px solid ${bdr}`, fontSize:12, lineHeight:1.8,
        whiteSpace:"pre-wrap", wordBreak:"break-word", fontFamily:"inherit" }}>
        {result.split("\n").map((line, i) => (
          <span key={i} style={{ color: tokenColor(line), display:"block" }}>{line}</span>
        ))}
      </pre>
    </div>
  );
}