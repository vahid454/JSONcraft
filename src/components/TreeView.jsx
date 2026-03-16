import { useState } from "react";

function getType(val) {
  if (val === null) return "null";
  if (Array.isArray(val)) return "array";
  return typeof val;
}

function TypeBadge({ type }) {
  const colors = {
    string: "text-emerald-400",
    number: "text-blue-400",
    boolean: "text-amber-400",
    null: "text-red-400",
    object: "text-purple-400",
    array: "text-orange-400",
  };
  return <span className={`${colors[type] || "text-gray-400"}`} />;
}

function ValueDisplay({ val }) {
  const type = getType(val);
  if (type === "string") return <span className="text-emerald-400">"{val}"</span>;
  if (type === "number") return <span className="text-blue-400">{val}</span>;
  if (type === "boolean") return <span className="text-amber-400">{String(val)}</span>;
  if (type === "null") return <span className="text-red-400">null</span>;
  return null;
}

function TreeNode({ keyName, value, depth = 0, isLast = true }) {
  const [open, setOpen] = useState(depth < 2);
  const type = getType(value);
  const isExpandable = type === "object" || type === "array";
  const entries = isExpandable ? (type === "array" ? value.map((v, i) => [i, v]) : Object.entries(value)) : [];
  const count = entries.length;

  return (
    <div className="select-text">
      <div
        className={`flex items-baseline gap-1 group py-0.5 pr-2 rounded hover:bg-gray-900 cursor-default text-xs leading-relaxed`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => isExpandable && setOpen(!open)}
      >
        {isExpandable ? (
          <span className={`text-gray-500 group-hover:text-gray-300 transition-colors w-3 text-center flex-shrink-0 cursor-pointer`}>
            {open ? "▾" : "▸"}
          </span>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}

        {keyName !== undefined && (
          <span className="text-gray-300 flex-shrink-0">
            {typeof keyName === "number"
              ? <span className="text-gray-500">{keyName}</span>
              : <span className="text-sky-300">"{keyName}"</span>}
            <span className="text-gray-600 mx-1">:</span>
          </span>
        )}

        {isExpandable ? (
          <span className="text-gray-400">
            {type === "array" ? "[" : "{"}
            {!open && (
              <span className="text-gray-600 text-xs ml-1">
                {count} {count === 1 ? "item" : "items"}
                <span className="ml-1">{type === "array" ? "]" : "}"}</span>
              </span>
            )}
          </span>
        ) : (
          <ValueDisplay val={value} />
        )}
      </div>

      {isExpandable && open && (
        <div>
          {entries.map(([k, v], i) => (
            <TreeNode key={k} keyName={k} value={v} depth={depth + 1} isLast={i === entries.length - 1} />
          ))}
          <div style={{ paddingLeft: `${depth * 16 + 8}px` }} className="py-0.5 text-xs text-gray-400">
            <span className="w-3 inline-block" />
            {type === "array" ? "]" : "}"}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TreeView({ data }) {
  return (
    <div className="font-mono text-xs leading-relaxed">
      <TreeNode value={data} depth={0} />
    </div>
  );
}