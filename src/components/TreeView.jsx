import { useState, memo, useCallback } from "react";

const MAX_VISIBLE = 100;

function getType(val) {
  if (val === null) return "null";
  if (Array.isArray(val)) return "array";
  return typeof val;
}

const ValueDisplay = memo(function ValueDisplay({ val, dark }) {
  const type = getType(val);
  const colors = {
    string:  dark ? "#10b981" : "#059669",
    number:  dark ? "#60a5fa" : "#2563eb",
    boolean: dark ? "#f59e0b" : "#d97706",
    null:    dark ? "#f87171" : "#dc2626",
  };
  const display = type === "string" && String(val).length > 200
    ? `"${String(val).slice(0, 200)}…"`
    : type === "string" ? `"${String(val)}"` : null;

  if (type === "string")  return <span style={{ color: colors.string }}>{display}</span>;
  if (type === "number")  return <span style={{ color: colors.number }}>{val}</span>;
  if (type === "boolean") return <span style={{ color: colors.boolean }}>{String(val)}</span>;
  if (type === "null")    return <span style={{ color: colors.null }}>null</span>;
  return null;
});

const TreeNode = memo(function TreeNode({ keyName, value, depth = 0, dark }) {
  const [open, setOpen]       = useState(depth < 2);
  const [showAll, setShowAll] = useState(false);

  const type         = getType(value);
  const isExpandable = type === "object" || type === "array";
  const allEntries   = isExpandable
    ? (type === "array" ? value.map((v, i) => [i, v]) : Object.entries(value))
    : [];
  const count   = allEntries.length;
  const entries = showAll ? allEntries : allEntries.slice(0, MAX_VISIBLE);
  const hidden  = count - entries.length;

  const keyColor   = dark ? "#7dd3fc" : "#0369a1";
  const idxColor   = dark ? "#6b7280" : "#9ca3af";
  const colonColor = dark ? "#4b5563" : "#d1d5db";
  const braceColor = dark ? "#9ca3af" : "#6b7280";
  const arrowColor = dark ? "#4b5563" : "#cbd5e1";
  const countColor = dark ? "#4b5563" : "#d1d5db";
  const hoverBg    = dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)";
  const moreColor  = dark ? "#374151" : "#e2e8f0";

  const handleToggle = useCallback(() => {
    if (isExpandable) setOpen(o => !o);
  }, [isExpandable]);

  return (
    <div>
      <div
        onClick={handleToggle}
        style={{
          display: "flex", alignItems: "baseline", gap: 5,
          paddingLeft: `${depth * 18 + 6}px`, paddingRight: 8,
          paddingTop: 3, paddingBottom: 3, borderRadius: 4,
          cursor: isExpandable ? "pointer" : "default",
        }}
        onMouseEnter={e => e.currentTarget.style.background = hoverBg}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <span style={{ width: 14, flexShrink: 0, color: arrowColor, fontSize: 11, textAlign: "center" }}>
          {isExpandable ? (open ? "▾" : "▸") : ""}
        </span>

        {keyName !== undefined && (
          <span style={{ flexShrink: 0 }}>
            {typeof keyName === "number"
              ? <span style={{ color: idxColor, fontSize: 12 }}>{keyName}</span>
              : <span style={{ color: keyColor, fontSize: 12 }}>"{keyName}"</span>}
            <span style={{ color: colonColor, margin: "0 4px", fontSize: 12 }}>:</span>
          </span>
        )}

        {isExpandable ? (
          <span style={{ color: braceColor, fontSize: 12 }}>
            {type === "array" ? "[" : "{"}
            {!open && (
              <span style={{ color: countColor, fontSize: 12, marginLeft: 5 }}>
                {count} {count === 1 ? "item" : "items"}
                <span style={{ marginLeft: 5 }}>{type === "array" ? "]" : "}"}</span>
              </span>
            )}
          </span>
        ) : (
          <span style={{ fontSize: 12 }}><ValueDisplay val={value} dark={dark} /></span>
        )}
      </div>

      {isExpandable && open && (
        <div>
          {entries.map(([k, v], i) => (
            <TreeNode key={`${depth}-${k}-${i}`} keyName={k} value={v} depth={depth + 1} dark={dark} />
          ))}
          {hidden > 0 && (
            <div
              onClick={() => setShowAll(true)}
              style={{
                paddingLeft: `${(depth + 1) * 18 + 6}px`, paddingTop: 4, paddingBottom: 4,
                fontSize: 12, color: dark ? "#10b981" : "#059669", cursor: "pointer",
                background: moreColor, borderRadius: 4, margin: "2px 0",
                display: "inline-block",
              }}>
              + {hidden} more items — click to show all
            </div>
          )}
          <div style={{
            paddingLeft: `${depth * 18 + 20}px`, paddingTop: 2, paddingBottom: 2,
            fontSize: 12, color: braceColor,
          }}>
            {type === "array" ? "]" : "}"}
          </div>
        </div>
      )}
    </div>
  );
});

export default memo(function TreeView({ data, dark }) {
  return (
    <div style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", lineHeight: 1.8 }}>
      <TreeNode value={data} depth={0} dark={dark} />
    </div>
  );
});