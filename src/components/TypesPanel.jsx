import { useState } from "react";

function getType(val) {
  if (val === null) return "null";
  if (Array.isArray(val)) {
    if (val.length === 0) return "unknown[]";
    const inner = getType(val[0]);
    return `${inner}[]`;
  }
  if (typeof val === "object") return null; // signals nested interface
  return typeof val;
}

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
        const t = val.length > 0 ? typeof val[0] : "unknown";
        lines.push(`  ${safeKey}: ${t}[];`);
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

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

export default function TypesPanel({ data }) {
  const [copied, setCopied] = useState(false);
  const interfaces = [];
  const result = generateInterface(Array.isArray(data) ? (data[0] || {}) : data, "Root", interfaces);

  const copy = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500 uppercase tracking-widest">TypeScript interfaces</div>
        <button onClick={copy} className="text-xs text-gray-400 hover:text-emerald-400 border border-gray-700 hover:border-emerald-700 px-3 py-1.5 rounded-md transition-all">
          {copied ? "✓ Copied" : "Copy types"}
        </button>
      </div>
      <pre className="flex-1 text-xs leading-relaxed whitespace-pre-wrap break-words bg-gray-900 rounded-lg p-4 border border-gray-800 overflow-auto">
        {result.split("\n").map((line, i) => {
          let color = "text-gray-300";
          if (line.startsWith("interface")) color = "text-blue-400";
          else if (line.trim().startsWith("//")) color = "text-gray-600";
          else if (line.includes(": string")) color = "text-emerald-400";
          else if (line.includes(": number")) color = "text-blue-300";
          else if (line.includes(": boolean")) color = "text-amber-400";
          else if (line.includes(": null")) color = "text-red-400";
          else if (line.includes("[]")) color = "text-purple-400";
          return <span key={i} className={color}>{line}{"\n"}</span>;
        })}
      </pre>
    </div>
  );
}