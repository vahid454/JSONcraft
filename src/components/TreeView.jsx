import { useState } from "react";

function getType(val) {
  if (val === null) return "null";
  if (Array.isArray(val)) return "array";
  return typeof val;
}

function ValueDisplay({ val, dark }) {
  const type = getType(val);
  const colors = {
    string:  dark ? "#10b981" : "#059669",
    number:  dark ? "#60a5fa" : "#2563eb",
    boolean: dark ? "#f59e0b" : "#d97706",
    null:    dark ? "#f87171" : "#dc2626",
  };
  if (type === "string")  return <span style={{ color: colors.string }}>"{String(val)}"</span>;
  if (type === "number")  return <span style={{ color: colors.number }}>{val}</span>;
  if (type === "boolean") return <span style={{ color: colors.boolean }}>{String(val)}</span>;
  if (type === "null")    return <span style={{ color: colors.null }}>null</span>;
  return null;
}

function TreeNode({ keyName, value, depth = 0, dark }) {
  const [open, setOpen] = useState(depth < 2);
  const type        = getType(value);
  const isExpandable = type === "object" || type === "array";
  const entries     = isExpandable
    ? (type === "array" ? value.map((v, i) => [i, v]) : Object.entries(value))
    : [];
  const count = entries.length;

  const keyColor    = dark ? "#7dd3fc" : "#0369a1";
  const idxColor    = dark ? "#6b7280" : "#9ca3af";
  const colonColor  = dark ? "#4b5563" : "#d1d5db";
  const braceColor  = dark ? "#9ca3af" : "#6b7280";
  const arrowColor  = dark ? "#4b5563" : "#cbd5e1";
  const hoverBg     = dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)";
  const countColor  = dark ? "#4b5563" : "#d1d5db";

  return (
    <div>
      <div
        onClick={() => isExpandable && setOpen(!open)}
        style={{
          display: "flex", alignItems: "baseline", gap: 4,
          paddingLeft: `${depth * 16 + 6}px`, paddingRight: 8,
          paddingTop: 2, paddingBottom: 2,
          borderRadius: 4, cursor: isExpandable ? "pointer" : "default",
          transition: "background 0.1s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = hoverBg}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <span style={{ width: 12, flexShrink: 0, color: arrowColor, fontSize: 10, textAlign: "center" }}>
          {isExpandable ? (open ? "▾" : "▸") : ""}
        </span>

        {keyName !== undefined && (
          <span style={{ flexShrink: 0 }}>
            {typeof keyName === "number"
              ? <span style={{ color: idxColor, fontSize: 11 }}>{keyName}</span>
              : <span style={{ color: keyColor, fontSize: 11 }}>"{keyName}"</span>}
            <span style={{ color: colonColor, margin: "0 4px", fontSize: 11 }}>:</span>
          </span>
        )}

        {isExpandable ? (
          <span style={{ color: braceColor, fontSize: 11 }}>
            {type === "array" ? "[" : "{"}
            {!open && (
              <span style={{ color: countColor, fontSize: 11, marginLeft: 4 }}>
                {count} {count === 1 ? "item" : "items"}
                <span style={{ marginLeft: 4 }}>{type === "array" ? "]" : "}"}</span>
              </span>
            )}
          </span>
        ) : (
          <span style={{ fontSize: 11 }}><ValueDisplay val={value} dark={dark} /></span>
        )}
      </div>

      {isExpandable && open && (
        <div>
          {entries.map(([k, v], i) => (
            <TreeNode key={`${k}-${i}`} keyName={k} value={v} depth={depth + 1} dark={dark} />
          ))}
          <div style={{
            paddingLeft: `${depth * 16 + 18}px`, paddingTop: 2, paddingBottom: 2,
            fontSize: 11, color: braceColor,
          }}>
            {type === "array" ? "]" : "}"}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TreeView({ data, dark }) {
  return (
    <div style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", lineHeight: 1.7 }}>
      <TreeNode value={data} depth={0} dark={dark} />
    </div>
  );
}