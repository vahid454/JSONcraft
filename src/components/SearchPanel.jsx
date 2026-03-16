import { useState, useMemo } from "react";

function flattenJSON(obj, prefix = "") {
  const results = [];
  for (const [key, val] of Object.entries(obj || {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      results.push(...flattenJSON(val, path));
    } else if (Array.isArray(val)) {
      val.forEach((item, i) => {
        const arrPath = `${path}[${i}]`;
        if (item !== null && typeof item === "object") {
          results.push(...flattenJSON(item, arrPath));
        } else {
          results.push({ path: arrPath, value: item });
        }
      });
    } else {
      results.push({ path, value: val });
    }
  }
  return results;
}

function ValueChip({ val }) {
  if (val === null) return <span className="text-red-400 text-xs">null</span>;
  if (typeof val === "boolean") return <span className="text-amber-400 text-xs">{String(val)}</span>;
  if (typeof val === "number") return <span className="text-blue-400 text-xs">{val}</span>;
  return <span className="text-emerald-400 text-xs">"{String(val)}"</span>;
}

export default function SearchPanel({ data }) {
  const [query, setQuery] = useState("");

  const flat = useMemo(() => flattenJSON(data), [data]);

  const results = useMemo(() => {
    if (!query.trim()) return flat;
    const q = query.toLowerCase();
    return flat.filter(({ path, value }) =>
      path.toLowerCase().includes(q) ||
      String(value).toLowerCase().includes(q)
    );
  }, [flat, query]);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="relative">
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search keys or values..."
          className="w-full bg-gray-900 border border-gray-700 focus:border-emerald-600 rounded-lg px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 outline-none transition-colors"
          style={{fontFamily:"inherit"}}
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 text-xs">✕</button>
        )}
      </div>
      <div className="text-xs text-gray-600">{results.length} result{results.length !== 1 ? "s" : ""} {query ? `for "${query}"` : "total"}</div>
      <div className="flex-1 overflow-auto flex flex-col gap-1">
        {results.map(({ path, value }, i) => (
          <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-gray-900 group transition-colors">
            <span className="text-xs text-gray-400 font-mono truncate flex-1">{path}</span>
            <ValueChip val={value} />
            <button
              onClick={() => navigator.clipboard.writeText(String(value))}
              className="text-xs text-gray-700 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-all shrink-0">
              copy
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}