import { useState, useMemo, useRef, useEffect, useCallback } from "react";

// ── Deep diff ────────────────────────────────────────────────────────────────
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

// ── Build line-by-line diff from two JSON strings ───────────────────────────
function buildLineDiff(leftStr, rightStr) {
  const leftLines  = leftStr.split("\n");
  const rightLines = rightStr.split("\n");
  const maxLen = Math.max(leftLines.length, rightLines.length);
  const rows = [];

  // Simple LCS-based line diff
  const lcs = computeLCS(leftLines, rightLines);
  let li = 0, ri = 0, lcsIdx = 0;
  while (li < leftLines.length || ri < rightLines.length) {
    if (
      lcsIdx < lcs.length &&
      li < leftLines.length &&
      ri < rightLines.length &&
      leftLines[li] === lcs[lcsIdx] &&
      rightLines[ri] === lcs[lcsIdx]
    ) {
      rows.push({ type: "same", left: leftLines[li], right: rightLines[ri], ln: li + 1, rn: ri + 1 });
      li++; ri++; lcsIdx++;
    } else if (
      lcsIdx < lcs.length &&
      ri < rightLines.length &&
      rightLines[ri] !== lcs[lcsIdx] &&
      (li >= leftLines.length || leftLines[li] === lcs[lcsIdx])
    ) {
      rows.push({ type: "added", left: null, right: rightLines[ri], ln: null, rn: ri + 1 });
      ri++;
    } else if (
      lcsIdx < lcs.length &&
      li < leftLines.length &&
      leftLines[li] !== lcs[lcsIdx]
    ) {
      rows.push({ type: "removed", left: leftLines[li], right: null, ln: li + 1, rn: null });
      li++;
    } else if (ri < rightLines.length && li >= leftLines.length) {
      rows.push({ type: "added", left: null, right: rightLines[ri], ln: null, rn: ri + 1 });
      ri++;
    } else if (li < leftLines.length) {
      rows.push({ type: "removed", left: leftLines[li], right: null, ln: li + 1, rn: null });
      li++;
    } else break;
  }
  return rows;
}

function computeLCS(a, b) {
  // Fast LCS for moderate files — fall back to simple for large
  if (a.length > 500 || b.length > 500) {
    // For large files, just return common prefix/suffix
    return [];
  }
  const dp = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);

  const seq = [];
  let i = a.length, j = b.length;
  while (i > 0 && j > 0) {
    if (a[i-1] === b[j-1]) { seq.unshift(a[i-1]); i--; j--; }
    else if (dp[i-1][j] > dp[i][j-1]) i--;
    else j--;
  }
  return seq;
}

function valStr(v) {
  if (v === null) return "null";
  if (typeof v === "object") return Array.isArray(v) ? `[${v.length} items]` : `{${Object.keys(v).length} keys}`;
  return JSON.stringify(v);
}

// ── Main DiffModal ───────────────────────────────────────────────────────────
export default function DiffModal({ originalData, originalInput, onClose, dark }) {
  const [compareText, setCompareText]   = useState("");
  const [compareData, setCompareData]   = useState(null);
  const [parseError, setParseError]     = useState(null);
  const [activeView, setActiveView]     = useState("split"); // split | unified | semantic
  const [filter, setFilter]             = useState({ added: true, removed: true, changed: true });
  const [currentIdx, setCurrentIdx]     = useState(-1);
  const [onlyDiffs, setOnlyDiffs]       = useState(false);
  const diffRefs = useRef([]);

  const bg   = dark ? "#050a14" : "#ffffff";
  const bg2  = dark ? "#0d1524" : "#f8fafc";
  const bg3  = dark ? "#131d2e" : "#f1f5f9";
  const bdr  = dark ? "#1e2d42" : "#e2e8f0";
  const txt  = dark ? "#e2e8f0" : "#1e293b";
  const mute = dark ? "#5a7a9a" : "#94a3b8";

  // Semantic diffs (key-value level)
  const semanticDiffs = useMemo(() => {
    if (!originalData || !compareData) return [];
    return deepDiff(originalData, compareData);
  }, [originalData, compareData]);

  const filteredSemantic = useMemo(() =>
    semanticDiffs.filter(d => filter[d.type]),
  [semanticDiffs, filter]);

  // Line diffs
  const lineDiffs = useMemo(() => {
    if (!compareData) return [];
    const leftStr  = originalInput
      ? originalInput
      : JSON.stringify(originalData, null, 2);
    const rightStr = compareText.trim()
      ? (() => { try { return JSON.stringify(JSON.parse(compareText), null, 2); } catch { return compareText; } })()
      : "";
    return buildLineDiff(leftStr, rightStr);
  }, [compareData, originalInput, originalData, compareText]);

  const visibleLines = useMemo(() => {
    if (!onlyDiffs) return lineDiffs;
    return lineDiffs.filter(r => r.type !== "same");
  }, [lineDiffs, onlyDiffs]);

  const diffLineIndices = useMemo(() =>
    lineDiffs.reduce((acc, r, i) => { if (r.type !== "same") acc.push(i); return acc; }, []),
  [lineDiffs]);

  const parse = useCallback(() => {
    try {
      setCompareData(JSON.parse(compareText));
      setParseError(null);
      setCurrentIdx(-1);
      diffRefs.current = [];
    } catch (e) {
      setParseError(e.message);
      setCompareData(null);
    }
  }, [compareText]);

  const navigate = (dir) => {
    const pool = activeView === "semantic" ? filteredSemantic : diffLineIndices;
    if (!pool.length) return;
    let next = currentIdx + dir;
    if (next < 0) next = pool.length - 1;
    if (next >= pool.length) next = 0;
    setCurrentIdx(next);
    setTimeout(() => {
      const el = diffRefs.current[next];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 30);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown" && e.altKey) { e.preventDefault(); navigate(1); }
      if (e.key === "ArrowUp"   && e.altKey) { e.preventDefault(); navigate(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentIdx, filteredSemantic.length, diffLineIndices.length, activeView]);

  const added   = semanticDiffs.filter(d => d.type === "added").length;
  const removed = semanticDiffs.filter(d => d.type === "removed").length;
  const changed = semanticDiffs.filter(d => d.type === "changed").length;

  const copyReport = () => {
    navigator.clipboard.writeText(JSON.stringify({ summary: { added, removed, changed }, diffs: semanticDiffs }, null, 2));
  };

  // ── Line row renderer ──────────────────────────────────────────────────────
  const lineColor = (type) => {
    if (type === "added")   return { bg: dark ? "rgba(16,185,129,0.12)" : "#dcfce7", txt: dark ? "#86efac" : "#166534" };
    if (type === "removed") return { bg: dark ? "rgba(248,113,113,0.12)" : "#fee2e2", txt: dark ? "#fca5a5" : "#991b1b" };
    return { bg: "transparent", txt: txt };
  };

  const numStyle = {
    width: 44, flexShrink: 0, textAlign: "right", paddingRight: 12,
    fontSize: 11, color: mute, userSelect: "none", fontVariantNumeric: "tabular-nums",
  };

  const codeStyle = (type) => ({
    flex: 1, fontSize: 12.5, lineHeight: 1.65, padding: "1px 10px",
    fontFamily: "'JetBrains Mono','Fira Code',monospace",
    whiteSpace: "pre-wrap", wordBreak: "break-all",
    color: lineColor(type).txt,
  });

  const prefix = (type) => type === "added" ? "+" : type === "removed" ? "-" : " ";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.82)",
        display: "flex", alignItems: "stretch", justifyContent: "stretch",
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          display: "flex", flexDirection: "column",
          width: "100%", height: "100%",
          background: bg, overflow: "hidden",
        }}
      >
        {/* ── Top bar ── */}
        <div style={{
          flexShrink: 0, height: 52, borderBottom: `1px solid ${bdr}`,
          display: "flex", alignItems: "center", gap: 12, padding: "0 20px",
          background: bg2,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: txt }}>± Diff Compare</span>
            {compareData && (
              <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
                {[["added", added, "#10b981"], ["removed", removed, "#f87171"], ["changed", changed, "#f59e0b"]].map(([label, count, color]) => (
                  <span key={label} style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 12,
                    background: `${color}18`, border: `1px solid ${color}44`,
                    color, fontWeight: 600,
                  }}>
                    {count} {label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ flex: 1 }} />

          {compareData && (
            <>
              {/* View mode */}
              <div style={{ display: "flex", gap: 2, background: bg3, borderRadius: 8, padding: 3 }}>
                {[
                  { id: "split", label: "⧉ Split" },
                  { id: "unified", label: "≡ Unified" },
                  { id: "semantic", label: "◈ Semantic" },
                ].map(v => (
                  <button key={v.id} onClick={() => setActiveView(v.id)} style={{
                    padding: "4px 12px", fontSize: 12, borderRadius: 6,
                    background: activeView === v.id ? "#10b981" : "transparent",
                    border: "none", cursor: "pointer", fontFamily: "inherit",
                    color: activeView === v.id ? "#030712" : mute,
                    fontWeight: activeView === v.id ? 700 : 400,
                    transition: "all 0.15s",
                  }}>{v.label}</button>
                ))}
              </div>

              {/* Filter chips */}
              <div style={{ display: "flex", gap: 4 }}>
                {["added", "removed", "changed"].map(type => {
                  const color = type === "added" ? "#10b981" : type === "removed" ? "#f87171" : "#f59e0b";
                  const on = filter[type];
                  return (
                    <button key={type} onClick={() => setFilter(p => ({ ...p, [type]: !p[type] }))} style={{
                      padding: "3px 9px", fontSize: 11, borderRadius: 16,
                      background: on ? `${color}18` : "transparent",
                      border: `1px solid ${on ? color : bdr}`,
                      color: on ? color : mute,
                      cursor: "pointer", fontFamily: "inherit", fontWeight: on ? 600 : 400,
                      transition: "all 0.15s",
                    }}>{type}</button>
                  );
                })}
              </div>

              {/* Only diffs toggle */}
              {activeView !== "semantic" && (
                <button onClick={() => setOnlyDiffs(p => !p)} style={{
                  padding: "3px 10px", fontSize: 11, borderRadius: 6,
                  background: onlyDiffs ? "rgba(99,102,241,0.15)" : "transparent",
                  border: `1px solid ${onlyDiffs ? "#6366f1" : bdr}`,
                  color: onlyDiffs ? "#818cf8" : mute,
                  cursor: "pointer", fontFamily: "inherit",
                }}>Only diffs</button>
              )}

              {/* Navigation */}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 11, color: mute }}>{currentIdx + 1}/{activeView === "semantic" ? filteredSemantic.length : diffLineIndices.length}</span>
                <button onClick={() => navigate(-1)} style={{ padding: "3px 8px", fontSize: 13, background: "transparent", border: `1px solid ${bdr}`, borderRadius: 5, color: mute, cursor: "pointer" }}>↑</button>
                <button onClick={() => navigate(1)}  style={{ padding: "3px 8px", fontSize: 13, background: "transparent", border: `1px solid ${bdr}`, borderRadius: 5, color: mute, cursor: "pointer" }}>↓</button>
              </div>

              <button onClick={copyReport} style={{ padding: "4px 10px", fontSize: 11, borderRadius: 6, background: "transparent", border: `1px solid ${bdr}`, color: mute, cursor: "pointer", fontFamily: "inherit" }}>📋 Report</button>
            </>
          )}

          <div style={{ width: 1, height: 20, background: bdr }} />
          <span style={{ fontSize: 11, color: mute }}>ESC or click outside to close · Alt+↑↓ navigate</span>
          <button onClick={onClose} style={{ padding: "5px 10px", fontSize: 14, background: "transparent", border: "none", cursor: "pointer", color: mute, fontFamily: "inherit" }}>✕</button>
        </div>

        {/* ── Input row ── */}
        {!compareData && (
          <div style={{
            flexShrink: 0, padding: "16px 20px", borderBottom: `1px solid ${bdr}`,
            background: bg2,
          }}>
            <div style={{ fontSize: 12, color: mute, marginBottom: 8 }}>
              Paste the second JSON to compare against the left panel
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <textarea
                autoFocus
                value={compareText}
                onChange={e => setCompareText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && e.ctrlKey && parse()}
                placeholder='{ "paste": "your second JSON here..." }'
                style={{
                  flex: 1, height: 120, background: bg3,
                  border: `1px solid ${parseError ? "#f87171" : bdr}`,
                  borderRadius: 8, padding: 12, fontSize: 12.5,
                  color: txt, fontFamily: "'JetBrains Mono','Fira Code',monospace",
                  resize: "none", outline: "none", lineHeight: 1.6,
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
                <button onClick={parse} style={{
                  padding: "10px 20px", borderRadius: 8, background: "#10b981",
                  color: "#030712", border: "none", cursor: "pointer",
                  fontFamily: "inherit", fontWeight: 700, fontSize: 13,
                }}>Compare →</button>
                <div style={{ fontSize: 10, color: mute, textAlign: "center" }}>Ctrl+Enter</div>
              </div>
            </div>
            {parseError && <div style={{ fontSize: 12, color: "#f87171", marginTop: 6 }}>✗ {parseError}</div>}
          </div>
        )}

        {/* ── Re-compare strip ── */}
        {compareData && (
          <div style={{
            flexShrink: 0, padding: "8px 20px",
            borderBottom: `1px solid ${bdr}`, background: bg2,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <textarea
              value={compareText}
              onChange={e => setCompareText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && e.ctrlKey && parse()}
              placeholder="Paste updated JSON to re-compare..."
              style={{
                flex: 1, height: 42, background: bg3,
                border: `1px solid ${bdr}`, borderRadius: 6,
                padding: "8px 12px", fontSize: 12, color: txt,
                fontFamily: "'JetBrains Mono','Fira Code',monospace",
                resize: "none", outline: "none", lineHeight: 1.4,
              }}
            />
            <button onClick={parse} style={{
              padding: "8px 16px", borderRadius: 6, background: "#10b981",
              color: "#030712", border: "none", cursor: "pointer",
              fontFamily: "inherit", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap",
            }}>Re-compare</button>
          </div>
        )}

        {/* ── Diff content ── */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

          {!compareData && !parseError && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, opacity: 0.3 }}>
              <div style={{ fontSize: 48 }}>±</div>
              <div style={{ fontSize: 14, color: mute }}>Paste JSON above and click Compare</div>
            </div>
          )}

          {compareData && filteredSemantic.length === 0 && activeView === "semantic" && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981", fontSize: 14 }}>
              ✓ Structures are identical — no differences found
            </div>
          )}

          {compareData && activeView === "semantic" && filteredSemantic.length > 0 && (
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
              {filteredSemantic.map((d, i) => {
                const color = d.type === "added" ? "#10b981" : d.type === "removed" ? "#f87171" : "#f59e0b";
                const bgc   = d.type === "added" ? (dark ? "rgba(16,185,129,0.08)" : "#f0fdf4")
                            : d.type === "removed" ? (dark ? "rgba(248,113,113,0.08)" : "#fff1f2")
                            : (dark ? "rgba(251,191,36,0.08)" : "#fffbeb");
                const bdc   = d.type === "added" ? (dark ? "#064e3b" : "#bbf7d0")
                            : d.type === "removed" ? (dark ? "#7f1d1d" : "#fecdd3")
                            : (dark ? "#78350f" : "#fde68a");
                return (
                  <div
                    key={i}
                    ref={el => diffRefs.current[i] = el}
                    style={{
                      background: bgc, border: `1px solid ${bdc}`, borderRadius: 8,
                      padding: "10px 14px", display: "flex", gap: 12, alignItems: "flex-start",
                      outline: currentIdx === i ? `2px solid ${color}` : "none",
                      outlineOffset: 2,
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 6 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: "0.06em", textTransform: "uppercase" }}>{d.type}</span>
                        <code style={{ fontSize: 12, color: txt, background: bg3, padding: "1px 6px", borderRadius: 4, fontFamily: "'JetBrains Mono',monospace" }}>{d.path}</code>
                      </div>
                      {d.type === "changed" && (
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <code style={{ fontSize: 12, color: "#f87171", fontFamily: "'JetBrains Mono',monospace" }}>{valStr(d.from)}</code>
                          <span style={{ color: mute }}>→</span>
                          <code style={{ fontSize: 12, color: "#10b981", fontFamily: "'JetBrains Mono',monospace" }}>{valStr(d.to)}</code>
                        </div>
                      )}
                      {d.type !== "changed" && (
                        <code style={{ fontSize: 12, color: d.type === "added" ? "#10b981" : "#f87171", fontFamily: "'JetBrains Mono',monospace" }}>{valStr(d.value)}</code>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {compareData && (activeView === "split" || activeView === "unified") && (
            <div style={{ flex: 1, overflowY: "auto", fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>
              {/* Headers */}
              {activeView === "split" && (
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr",
                  borderBottom: `1px solid ${bdr}`,
                  position: "sticky", top: 0, zIndex: 10, background: bg2,
                }}>
                  <div style={{ padding: "8px 54px", fontSize: 12, fontWeight: 600, color: mute, borderRight: `1px solid ${bdr}` }}>
                    Original (left panel)
                  </div>
                  <div style={{ padding: "8px 54px", fontSize: 12, fontWeight: 600, color: mute }}>
                    Comparison (pasted)
                  </div>
                </div>
              )}

              {/* Lines */}
              {(onlyDiffs ? visibleLines : lineDiffs).map((row, i) => {
                const lc = lineColor(row.type);
                const isDiffRow = row.type !== "same";
                const refIdx = diffLineIndices.indexOf(i);
                const isHighlighted = !onlyDiffs && refIdx !== -1 && currentIdx === refIdx;

                if (activeView === "split") {
                  return (
                    <div
                      key={i}
                      ref={isDiffRow ? (el => { if (refIdx !== -1) diffRefs.current[refIdx] = el; }) : null}
                      style={{
                        display: "grid", gridTemplateColumns: "1fr 1fr",
                        background: isHighlighted ? (dark ? "rgba(99,102,241,0.15)" : "#e0e7ff") : lc.bg,
                        borderBottom: `1px solid ${dark ? "#0d1a2a" : "#f0f4f8"}`,
                        minHeight: 22,
                      }}
                    >
                      {/* Left */}
                      <div style={{
                        display: "flex", borderRight: `1px solid ${bdr}`,
                        background: row.type === "added" ? (dark ? "rgba(16,185,129,0.04)" : "#f7fff7") : "transparent",
                      }}>
                        <span style={numStyle}>{row.ln ?? ""}</span>
                        <span style={{
                          width: 16, flexShrink: 0, textAlign: "center",
                          fontSize: 12, color: row.type === "removed" ? "#f87171" : "transparent",
                          lineHeight: "22px",
                        }}>−</span>
                        <span style={codeStyle(row.type === "added" ? "same" : row.type)}>
                          {row.left ?? ""}
                        </span>
                      </div>
                      {/* Right */}
                      <div style={{
                        display: "flex",
                        background: row.type === "removed" ? (dark ? "rgba(248,113,113,0.04)" : "#fff7f7") : "transparent",
                      }}>
                        <span style={numStyle}>{row.rn ?? ""}</span>
                        <span style={{
                          width: 16, flexShrink: 0, textAlign: "center",
                          fontSize: 12, color: row.type === "added" ? "#10b981" : "transparent",
                          lineHeight: "22px",
                        }}>+</span>
                        <span style={codeStyle(row.type === "removed" ? "same" : row.type)}>
                          {row.right ?? ""}
                        </span>
                      </div>
                    </div>
                  );
                }

                // Unified view
                if (row.type === "same") {
                  return (
                    <div key={i} style={{ display: "flex", background: "transparent", minHeight: 22, borderBottom: `1px solid ${dark ? "#0a1220" : "#f5f7fa"}` }}>
                      <span style={numStyle}>{row.ln}</span>
                      <span style={numStyle}>{row.rn}</span>
                      <span style={{ width: 20, flexShrink: 0, color: mute, textAlign: "center", fontSize: 11, lineHeight: "22px" }}> </span>
                      <span style={codeStyle("same")}>{row.left}</span>
                    </div>
                  );
                }
                return (
                  <div
                    key={i}
                    ref={isDiffRow ? (el => { if (refIdx !== -1) diffRefs.current[refIdx] = el; }) : null}
                    style={{
                      display: "flex", minHeight: 22,
                      background: lc.bg,
                      borderBottom: `1px solid ${dark ? "#0a1220" : "#f0f4f8"}`,
                      outline: isHighlighted ? "2px solid #6366f1" : "none",
                    }}
                  >
                    <span style={numStyle}>{row.ln ?? ""}</span>
                    <span style={numStyle}>{row.rn ?? ""}</span>
                    <span style={{ width: 20, flexShrink: 0, textAlign: "center", fontSize: 12, color: lc.txt, lineHeight: "22px" }}>
                      {prefix(row.type)}
                    </span>
                    <span style={codeStyle(row.type)}>
                      {row.left ?? row.right ?? ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}