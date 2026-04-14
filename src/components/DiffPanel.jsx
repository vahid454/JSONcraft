import { useState, useMemo, useCallback, useRef, useEffect } from "react";

// ─── Deep diff ───────────────────────────────────────────────────────────────
function deepDiff(a, b, path = "") {
  const changes = [];
  if (a === b) return changes;
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) {
    changes.push({ type: "changed", path: path || "root", from: a, to: b });
    return changes;
  }
  if (typeof a !== "object" || a === null || b === null) {
    if (a !== b) changes.push({ type: "changed", path: path || "root", from: a, to: b });
    return changes;
  }
  const allKeys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const key of allKeys) {
    const p = path ? `${path}.${key}` : key;
    if (!(key in a))      changes.push({ type: "added",   path: p, value: b[key] });
    else if (!(key in b)) changes.push({ type: "removed", path: p, value: a[key] });
    else                  changes.push(...deepDiff(a[key], b[key], p));
  }
  return changes;
}

function buildDiffMap(diffs) {
  const map = new Map();
  for (const diff of diffs) map.set(diff.path, diff);
  return map;
}

function buildDiffTree(diffs) {
  const root = { children: {}, changes: [] };
  for (const diff of diffs) {
    const parts = diff.path === "root" ? [] : diff.path.split(".");
    let node = root;
    for (const part of parts) {
      if (!node.children[part]) node.children[part] = { children: {}, changes: [] };
      node = node.children[part];
    }
    node.changes.push(diff);
  }
  return root;
}

function valStr(v) {
  if (v === null) return "null";
  if (typeof v === "object") return Array.isArray(v) ? `[${v.length} items]` : `{${Object.keys(v).length} keys}`;
  return JSON.stringify(v);
}

// ─── Parse helper ────────────────────────────────────────────────────────────
function tryParseJSON(str) {
  try {
    const parsed = JSON.parse(str.trim());
    return { data: parsed, error: null };
  } catch (e) {
    return { data: null, error: e.message };
  }
}

// ─── Drop Zone ───────────────────────────────────────────────────────────────
function DropZone({ onFile, dark, children, style }) {
  const [dragging, setDragging] = useState(false);
  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onFile(ev.target.result);
    reader.readAsText(file);
  };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        ...style,
        outline: dragging ? `2px dashed #10b981` : "none",
        outlineOffset: 2,
        borderRadius: 8,
        transition: "outline 0.15s",
      }}
    >
      {children}
    </div>
  );
}

// ─── Side-by-side row ────────────────────────────────────────────────────────
function SideBySideRow({ left, right, path, depth = 0, dark, diffMap, expandedPaths, togglePath }) {
  const pathKey = path || "root";
  const isExpanded = expandedPaths.has(pathKey);
  const diff = diffMap.get(pathKey);

  let leftBg = "transparent", rightBg = "transparent";
  if (diff) {
    if (diff.type === "added")   rightBg = dark ? "rgba(16,185,129,0.12)" : "#dcfce7";
    if (diff.type === "removed") leftBg  = dark ? "rgba(248,113,113,0.12)" : "#fee2e2";
    if (diff.type === "changed") { leftBg = rightBg = dark ? "rgba(251,191,36,0.08)" : "#fef3c7"; }
  }

  const expandable = (left && typeof left === "object") || (right && typeof right === "object");
  const leftKeys = (left && typeof left === "object") ? Object.keys(left) : [];
  const rightKeys = (right && typeof right === "object") ? Object.keys(right) : [];
  const allKeys = [...new Set([...leftKeys, ...rightKeys])].sort((a, b) => {
    const an = /^\d+$/.test(a) ? parseInt(a) : null;
    const bn = /^\d+$/.test(b) ? parseInt(b) : null;
    if (an !== null && bn !== null) return an - bn;
    return a.localeCompare(b);
  });

  const renderValue = (val) => {
    if (val === undefined) return <span style={{ color: dark ? "#374151" : "#e5e7eb" }}>—</span>;
    if (val === null) return <span style={{ color: dark ? "#f87171" : "#dc2626" }}>null</span>;
    if (typeof val === "boolean") return <span style={{ color: dark ? "#f59e0b" : "#d97706" }}>{String(val)}</span>;
    if (typeof val === "number") return <span style={{ color: dark ? "#60a5fa" : "#2563eb" }}>{val}</span>;
    if (typeof val === "string") return <span style={{ color: dark ? "#10b981" : "#059669" }}>"{val}"</span>;
    if (Array.isArray(val)) return <span style={{ color: dark ? "#c084fc" : "#7c3aed" }}>Array({val.length})</span>;
    return <span style={{ color: dark ? "#c084fc" : "#7c3aed" }}>{"{…}"}</span>;
  };

  const mute = dark ? "#6b7280" : "#94a3b8";
  const keyColor = dark ? "#7dd3fc" : "#0369a1";
  const bdr = dark ? "#1f2937" : "#e2e8f0";

  const cellStyle = (bg) => ({
    flex: 1, padding: `4px 8px 4px ${depth * 14 + 8}px`,
    borderRight: `1px solid ${bdr}`, background: bg,
    display: "flex", alignItems: "center", gap: 5,
    cursor: expandable ? "pointer" : "default", minWidth: 0,
  });

  return (
    <>
      <div style={{ display: "flex", borderBottom: `1px solid ${bdr}`, minHeight: 26 }}>
        <div style={cellStyle(leftBg)} onClick={() => expandable && togglePath(pathKey, !isExpanded)}>
          {expandable && <span style={{ width: 12, flexShrink: 0, color: mute, fontSize: 11 }}>{isExpanded ? "▾" : "▸"}</span>}
          {!expandable && <span style={{ width: 12, flexShrink: 0 }} />}
          {path !== "root" && <><span style={{ color: keyColor, fontSize: 11 }}>{path.split(".").pop()}</span><span style={{ color: mute, fontSize: 11, margin: "0 3px" }}>:</span></>}
          <span style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{renderValue(left)}</span>
        </div>
        <div style={{ ...cellStyle(rightBg), borderRight: "none" }} onClick={() => expandable && togglePath(pathKey, !isExpanded)}>
          {expandable && <span style={{ width: 12, flexShrink: 0, color: mute, fontSize: 11 }}>{isExpanded ? "▾" : "▸"}</span>}
          {!expandable && <span style={{ width: 12, flexShrink: 0 }} />}
          {path !== "root" && <><span style={{ color: keyColor, fontSize: 11 }}>{path.split(".").pop()}</span><span style={{ color: mute, fontSize: 11, margin: "0 3px" }}>:</span></>}
          <span style={{ fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{renderValue(right)}</span>
        </div>
      </div>
      {isExpanded && expandable && allKeys.map(key => {
        const childPath = pathKey === "root" ? key : `${pathKey}.${key}`;
        return (
          <SideBySideRow key={childPath} left={left?.[key]} right={right?.[key]}
            path={childPath} depth={depth + 1} dark={dark}
            diffMap={diffMap} expandedPaths={expandedPaths} togglePath={togglePath} />
        );
      })}
    </>
  );
}

// ─── Tree diff node ──────────────────────────────────────────────────────────
function DiffTreeNode({ node, name, depth = 0, dark, filterTypes, expandedPaths, togglePath }) {
  const pathKey = name || "root";
  const isExpanded = expandedPaths.has(pathKey);
  const hasChildren = Object.keys(node.children).length > 0;
  const mute = dark ? "#6b7280" : "#94a3b8";
  const bdr = dark ? "#1f2937" : "#e2e8f0";

  const changesHere = node.changes.filter(d => filterTypes[d.type]);
  const countAll = (n) => {
    let c = n.changes.filter(d => filterTypes[d.type]).length;
    for (const ch of Object.values(n.children)) c += countAll(ch);
    return c;
  };
  if (countAll(node) === 0) return null;

  return (
    <div style={{ marginLeft: depth * 14 }}>
      <div onClick={() => hasChildren && togglePath(pathKey, !isExpanded)}
        style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 0", cursor: hasChildren ? "pointer" : "default" }}>
        <span style={{ width: 14, color: mute, fontSize: 11 }}>{hasChildren ? (isExpanded ? "▾" : "▸") : ""}</span>
        <span style={{ fontSize: 11, color: dark ? "#7dd3fc" : "#0369a1", fontWeight: 500 }}>{name || "root"}</span>
        {node.changes.length > 0 && <span style={{ fontSize: 10, color: mute }}>({node.changes.length})</span>}
      </div>
      {isExpanded && (
        <div style={{ borderLeft: `1px solid ${bdr}`, marginLeft: 6, paddingLeft: 10 }}>
          {changesHere.map((diff, idx) => (
            <div key={idx} style={{ margin: "5px 0", display: "flex", gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, marginTop: 3,
                background: diff.type === "added" ? "#10b981" : diff.type === "removed" ? "#f87171" : "#f59e0b" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: mute, marginBottom: 1 }}>{diff.type.toUpperCase()}</div>
                <div style={{ fontSize: 11 }}>
                  {diff.type === "changed" ? (
                    <><span style={{ color: "#f87171" }}>{valStr(diff.from)}</span>
                    <span style={{ color: mute, margin: "0 5px" }}>→</span>
                    <span style={{ color: "#10b981" }}>{valStr(diff.to)}</span></>
                  ) : <span style={{ color: diff.type === "added" ? "#10b981" : "#f87171" }}>{valStr(diff.value)}</span>}
                </div>
              </div>
            </div>
          ))}
          {Object.entries(node.children).sort(([a], [b]) => a.localeCompare(b)).map(([childName, childNode]) => (
            <DiffTreeNode key={childName} node={childNode} name={childName}
              depth={depth + 1} dark={dark} filterTypes={filterTypes}
              expandedPaths={expandedPaths} togglePath={togglePath} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main DiffPanel ──────────────────────────────────────────────────────────
export default function DiffPanel({ data: externalData, dark, onClose }) {
  const [leftText, setLeftText] = useState("");
  const [rightText, setRightText] = useState("");
  const [leftData, setLeftData] = useState(null);
  const [rightData, setRightData] = useState(null);
  const [leftErr, setLeftErr] = useState(null);
  const [rightErr, setRightErr] = useState(null);
  const [viewMode, setViewMode] = useState("side");
  const [filterTypes, setFilterTypes] = useState({ added: true, removed: true, changed: true });
  const [expandedPaths, setExpandedPaths] = useState(new Set(["root"]));
  const [currentDiffIdx, setCurrentDiffIdx] = useState(-1);
  const diffRefs = useRef([]);

  // Pre-fill left panel from external data
  useEffect(() => {
    if (externalData) {
      const str = JSON.stringify(externalData, null, 2);
      setLeftText(str);
      setLeftData(externalData);
      setLeftErr(null);
    }
  }, [externalData]);

  // ESC to close
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const parseLeft = useCallback((val) => {
    setLeftText(val);
    if (!val.trim()) { setLeftData(null); setLeftErr(null); return; }
    const { data, error } = tryParseJSON(val);
    setLeftData(data); setLeftErr(error);
  }, []);

  const parseRight = useCallback((val) => {
    setRightText(val);
    if (!val.trim()) { setRightData(null); setRightErr(null); return; }
    const { data, error } = tryParseJSON(val);
    setRightData(data); setRightErr(error);
  }, []);

  const allDiffs = useMemo(() => {
    if (!leftData || !rightData) return [];
    return deepDiff(leftData, rightData);
  }, [leftData, rightData]);

  const filteredDiffs = useMemo(() => allDiffs.filter(d => filterTypes[d.type]), [allDiffs, filterTypes]);
  const diffMap = useMemo(() => buildDiffMap(allDiffs), [allDiffs]);
  const diffTree = useMemo(() => buildDiffTree(filteredDiffs), [filteredDiffs]);

  const added   = allDiffs.filter(d => d.type === "added").length;
  const removed = allDiffs.filter(d => d.type === "removed").length;
  const changed = allDiffs.filter(d => d.type === "changed").length;

  const togglePath = useCallback((path, expand) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (expand) next.add(path); else next.delete(path);
      return next;
    });
  }, []);

  const toggleFilter = (type) => setFilterTypes(prev => ({ ...prev, [type]: !prev[type] }));

  const navigateDiff = (dir) => {
    if (!filteredDiffs.length) return;
    let idx = currentDiffIdx + dir;
    if (idx < 0) idx = filteredDiffs.length - 1;
    if (idx >= filteredDiffs.length) idx = 0;
    setCurrentDiffIdx(idx);
    setTimeout(() => diffRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  const copyReport = () => {
    const report = { summary: { added, removed, changed, total: allDiffs.length }, diffs: allDiffs };
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
  };

  const bg  = dark ? "#030712" : "#ffffff";
  const bg2 = dark ? "#0f172a" : "#f8fafc";
  const bg3 = dark ? "#111827" : "#ffffff";
  const bdr = dark ? "#1f2937" : "#e2e8f0";
  const txt = dark ? "#d1d5db" : "#374151";
  const mute = dark ? "#6b7280" : "#94a3b8";

  const textAreaStyle = (hasErr) => ({
    width: "100%", height: "100%", background: bg3, border: `1px solid ${hasErr ? "#7f1d1d" : bdr}`,
    borderRadius: 8, padding: 10, fontSize: 11, color: txt, fontFamily: "inherit",
    resize: "none", outline: "none", boxSizing: "border-box", lineHeight: 1.6,
  });

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16,
    }}>
      <div style={{
        background: bg, border: `1px solid ${bdr}`, borderRadius: 16,
        width: "min(1100px, 96vw)", height: "min(750px, 92vh)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
          borderBottom: `1px solid ${bdr}`, flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: txt }}>± Diff</span>
          <span style={{ fontSize: 11, color: mute }}>Compare two JSON structures</span>
          <div style={{ flex: 1 }} />
          {/* View modes */}
          {[{ id: "side", label: "Side-by-Side" }, { id: "tree", label: "Tree" }, { id: "list", label: "List" }].map(m => (
            <button key={m.id} onClick={() => setViewMode(m.id)} style={{
              padding: "4px 10px", fontSize: 10, borderRadius: 6,
              background: viewMode === m.id ? "#10b981" : "transparent",
              border: `1px solid ${viewMode === m.id ? "#10b981" : bdr}`,
              color: viewMode === m.id ? "#030712" : mute,
              cursor: "pointer", fontFamily: "inherit",
            }}>{m.label}</button>
          ))}
          <div style={{ width: 1, height: 16, background: bdr }} />
          {/* Filters */}
          {[["added", "#10b981"], ["removed", "#f87171"], ["changed", "#f59e0b"]].map(([type, color]) => (
            <button key={type} onClick={() => toggleFilter(type)} style={{
              padding: "4px 9px", fontSize: 10, borderRadius: 20,
              background: filterTypes[type] ? color : "transparent",
              border: `1px solid ${filterTypes[type] ? color : bdr}`,
              color: filterTypes[type] ? "#030712" : mute,
              cursor: "pointer", fontFamily: "inherit", fontWeight: filterTypes[type] ? 700 : 400,
              textTransform: "uppercase", letterSpacing: "0.05em",
            }}>{type}</button>
          ))}
          <div style={{ width: 1, height: 16, background: bdr }} />
          {/* Navigate */}
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: 10, color: mute }}>{filteredDiffs.length > 0 ? `${Math.max(0, currentDiffIdx + 1)}/${filteredDiffs.length}` : "0/0"}</span>
            <button onClick={() => navigateDiff(-1)} disabled={!filteredDiffs.length} style={{ padding: "3px 7px", fontSize: 12, borderRadius: 4, background: "transparent", border: `1px solid ${bdr}`, color: mute, cursor: "pointer", fontFamily: "inherit" }}>↑</button>
            <button onClick={() => navigateDiff(1)} disabled={!filteredDiffs.length} style={{ padding: "3px 7px", fontSize: 12, borderRadius: 4, background: "transparent", border: `1px solid ${bdr}`, color: mute, cursor: "pointer", fontFamily: "inherit" }}>↓</button>
          </div>
          <button onClick={copyReport} style={{ padding: "4px 9px", fontSize: 10, borderRadius: 6, background: "transparent", border: `1px solid ${bdr}`, color: mute, cursor: "pointer", fontFamily: "inherit" }}>📋 Report</button>
          <button onClick={onClose} title="Close (ESC)" style={{ padding: "4px 9px", fontSize: 14, borderRadius: 6, background: "transparent", border: `1px solid ${bdr}`, color: mute, cursor: "pointer", fontFamily: "inherit", lineHeight: 1 }}>✕</button>
        </div>

        {/* Input panels */}
        <div style={{ display: "flex", gap: 0, flexShrink: 0, height: 180, borderBottom: `1px solid ${bdr}` }}>
          {[
            { label: "LEFT (Original)", text: leftText, err: leftErr, onChange: parseLeft, color: "#10b981" },
            { label: "RIGHT (Compare)", text: rightText, err: rightErr, onChange: parseRight, color: "#f59e0b" },
          ].map(({ label, text, err, onChange, color }, i) => (
            <DropZone key={i} onFile={onChange} dark={dark}
              style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: i === 0 ? `1px solid ${bdr}` : "none", padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, flexShrink: 0 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
                <span style={{ fontSize: 10, color: mute, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
                {err && <span style={{ fontSize: 10, color: "#f87171", marginLeft: "auto" }}>⚠ {err.slice(0, 40)}</span>}
                {text && !err && <span style={{ fontSize: 10, color: "#10b981", marginLeft: "auto" }}>✓</span>}
                {text && <button onClick={() => onChange("")} style={{ fontSize: 10, color: mute, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", marginLeft: err ? 0 : "auto" }}>clear</button>}
              </div>
              <textarea
                value={text}
                onChange={e => onChange(e.target.value)}
                placeholder={`Paste JSON or drag & drop a file…`}
                style={{ ...textAreaStyle(!!err), flex: 1 }}
              />
            </DropZone>
          ))}
        </div>

        {/* Stats bar */}
        {leftData && rightData && (
          <div style={{ display: "flex", gap: 0, flexShrink: 0, borderBottom: `1px solid ${bdr}` }}>
            {[["added", added, "#10b981"], ["removed", removed, "#f87171"], ["changed", changed, "#f59e0b"]].map(([label, count, color]) => (
              <div key={label} style={{ flex: 1, padding: "8px 12px", textAlign: "center",
                borderRight: label !== "changed" ? `1px solid ${bdr}` : "none",
                background: count > 0 ? `${color}08` : "transparent" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: count > 0 ? color : mute }}>{count}</div>
                <div style={{ fontSize: 9, color: mute, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
              </div>
            ))}
            <div style={{ flex: 2, padding: "8px 12px", textAlign: "center", borderLeft: `1px solid ${bdr}` }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: allDiffs.length === 0 ? "#10b981" : txt }}>{allDiffs.length}</div>
              <div style={{ fontSize: 9, color: mute, textTransform: "uppercase", letterSpacing: "0.08em" }}>total changes</div>
            </div>
          </div>
        )}

        {/* Diff output */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {!leftData && !rightData && (
            <div style={{ textAlign: "center", padding: 40, color: mute, fontSize: 12 }}>
              Paste JSON in both panels above to compare
            </div>
          )}
          {leftData && !rightData && (
            <div style={{ textAlign: "center", padding: 40, color: mute, fontSize: 12 }}>
              Paste JSON in the RIGHT panel to start comparing
            </div>
          )}
          {!leftData && rightData && (
            <div style={{ textAlign: "center", padding: 40, color: mute, fontSize: 12 }}>
              Paste JSON in the LEFT panel to start comparing
            </div>
          )}
          {leftData && rightData && filteredDiffs.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "#10b981", fontSize: 13 }}>
              ✓ No differences — structures are identical {!filterTypes.added || !filterTypes.removed || !filterTypes.changed ? "(some filters active)" : ""}
            </div>
          )}
          {leftData && rightData && filteredDiffs.length > 0 && viewMode === "list" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: 12 }}>
              {filteredDiffs.map((d, i) => {
                const color = d.type === "added" ? "#10b981" : d.type === "removed" ? "#f87171" : "#f59e0b";
                return (
                  <div key={i} ref={el => diffRefs.current[i] = el}
                    style={{ background: `${color}08`, border: `1px solid ${color}30`, borderRadius: 6,
                      padding: "7px 12px", display: "flex", gap: 9, alignItems: "flex-start",
                      outline: currentDiffIdx === i ? `2px solid ${color}` : "none" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 4 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 2 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: "0.08em", textTransform: "uppercase" }}>{d.type}</span>
                        <span style={{ fontSize: 11, color: txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.path}</span>
                      </div>
                      {d.type === "changed" && (
                        <div style={{ fontSize: 11, color: mute }}>
                          <span style={{ color: "#f87171" }}>{valStr(d.from)}</span>
                          <span style={{ margin: "0 5px" }}>→</span>
                          <span style={{ color: "#10b981" }}>{valStr(d.to)}</span>
                        </div>
                      )}
                      {(d.type === "added" || d.type === "removed") && (
                        <div style={{ fontSize: 11, color }}>{valStr(d.value)}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {leftData && rightData && filteredDiffs.length > 0 && viewMode === "tree" && (
            <div style={{ padding: 12 }}>
              <DiffTreeNode node={diffTree} name="root" depth={0} dark={dark}
                filterTypes={filterTypes} expandedPaths={expandedPaths} togglePath={togglePath} />
            </div>
          )}
          {leftData && rightData && viewMode === "side" && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", borderBottom: `1px solid ${bdr}`, background: bg2, position: "sticky", top: 0, zIndex: 1 }}>
                <div style={{ flex: 1, padding: "6px 12px", borderRight: `1px solid ${bdr}`, fontSize: 10, fontWeight: 600, color: "#10b981", letterSpacing: "0.06em", textTransform: "uppercase" }}>LEFT</div>
                <div style={{ flex: 1, padding: "6px 12px", fontSize: 10, fontWeight: 600, color: "#f59e0b", letterSpacing: "0.06em", textTransform: "uppercase" }}>RIGHT</div>
              </div>
              <SideBySideRow left={leftData} right={rightData} path="root" depth={0} dark={dark}
                diffMap={diffMap} expandedPaths={expandedPaths} togglePath={togglePath} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}