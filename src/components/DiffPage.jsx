import { useState, useMemo, useRef, useCallback } from "react";

// ── LCS-based line diff ──────────────────────────────────────────────
function computeLineDiff(textA, textB) {
  const linesA = (textA || "").split("\n");
  const linesB = (textB || "").split("\n");
  const m = linesA.length, n = linesB.length;

  // Myers diff for large files — fall back to simple LCS for small
  if (m * n > 500000) {
    // Simple two-pointer for very large files
    const result = [];
    let i = 0, j = 0;
    while (i < m || j < n) {
      if (i < m && j < n && linesA[i] === linesB[j]) {
        result.push({ type: "same", left: linesA[i], right: linesB[j] });
        i++; j++;
      } else if (j < n) {
        result.push({ type: "added", right: linesB[j] });
        j++;
      } else {
        result.push({ type: "removed", left: linesA[i] });
        i++;
      }
    }
    return result;
  }

  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = linesA[i-1] === linesB[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);

  const result = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i-1] === linesB[j-1]) {
      result.unshift({ type: "same", left: linesA[i-1], right: linesB[j-1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      result.unshift({ type: "added", right: linesB[j-1] });
      j--;
    } else {
      result.unshift({ type: "removed", left: linesA[i-1] });
      i--;
    }
  }
  return result;
}

// Count stats from diff
function getDiffStats(lines) {
  let added = 0, removed = 0;
  for (const l of lines) {
    if (l.type === "added")   added++;
    if (l.type === "removed") removed++;
  }
  return { added, removed, changed: Math.min(added, removed) };
}

// ── File upload helper ────────────────────────────────────────────────
function readFile(file) {
  return new Promise((res) => {
    const reader = new FileReader();
    reader.onload = e => res(e.target.result);
    reader.readAsText(file);
  });
}

// ── Inline char diff for changed lines ───────────────────────────────
function charDiff(a, b) {
  // Find common prefix/suffix, highlight the middle
  let s = 0, ea = a.length, eb = b.length;
  while (s < ea && s < eb && a[s] === b[s]) s++;
  while (ea > s && eb > s && a[ea-1] === b[eb-1]) { ea--; eb--; }
  return {
    left:  { pre: a.slice(0, s), mid: a.slice(s, ea), suf: a.slice(ea) },
    right: { pre: b.slice(0, s), mid: b.slice(s, eb), suf: b.slice(eb) },
  };
}

// ── Side-by-side row component ────────────────────────────────────────
function DiffRow({ row, leftNum, rightNum, dark, inlineHighlight }) {
  const isAdded   = row.type === "added";
  const isRemoved = row.type === "removed";
  const isSame    = row.type === "same";

  const leftBg  = isRemoved ? (dark ? "#3d1010" : "#ffeef0") : (isSame ? "transparent" : (dark ? "#0d1117" : "#f6f8fa"));
  const rightBg = isAdded   ? (dark ? "#0d2d1a" : "#e6ffed") : (isSame ? "transparent" : (dark ? "#0d1117" : "#f6f8fa"));

  const leftTxt  = isRemoved ? (dark ? "#ffa0a0" : "#b31d28") : (dark ? "#e6edf3" : "#24292f");
  const rightTxt = isAdded   ? (dark ? "#7ee787" : "#116329") : (dark ? "#e6edf3" : "#24292f");

  const numStyle = {
    width: 48, flexShrink: 0, textAlign: "right", paddingRight: 14,
    fontSize: 11, userSelect: "none", lineHeight: "22px", fontVariantNumeric: "tabular-nums",
    color: dark ? "#484f58" : "#8b949e",
  };
  const signStyle = (type) => ({
    width: 18, flexShrink: 0, textAlign: "center", fontSize: 12, fontWeight: 700,
    lineHeight: "22px", userSelect: "none",
    color: type === "added" ? "#3fb950" : type === "removed" ? "#f85149" : "transparent",
  });

  // Inline char highlighting for paired changed lines
  let leftContent  = row.left  ?? "";
  let rightContent = row.right ?? "";

  const bdr = dark ? "#21262d" : "#d0d7de";

  const cellBase = {
    flex: 1, minWidth: 0, display: "flex", alignItems: "flex-start",
    fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: 13, lineHeight: "22px",
    minHeight: 22, whiteSpace: "pre-wrap", wordBreak: "break-all",
  };

  return (
    <div style={{ display: "flex", borderBottom: `1px solid ${dark ? "#21262d" : "#eaecef"}` }}>
      {/* Left side */}
      <div style={{ flex: 1, display: "flex", background: leftBg, borderRight: `1px solid ${bdr}` }}>
        <span style={numStyle}>{leftNum || ""}</span>
        <span style={signStyle(isRemoved ? "removed" : "same")}>
          {isRemoved ? "−" : " "}
        </span>
        <span style={{ ...cellBase, color: leftTxt, paddingRight: 12 }}>
          {row.inlineLeft ? (
            <>
              <span>{row.inlineLeft.pre}</span>
              {row.inlineLeft.mid && (
                <span style={{ background: dark ? "#6e211e" : "#fdb8c0", borderRadius: 2 }}>
                  {row.inlineLeft.mid}
                </span>
              )}
              <span>{row.inlineLeft.suf}</span>
            </>
          ) : leftContent}
        </span>
      </div>

      {/* Right side */}
      <div style={{ flex: 1, display: "flex", background: rightBg }}>
        <span style={numStyle}>{rightNum || ""}</span>
        <span style={signStyle(isAdded ? "added" : "same")}>
          {isAdded ? "+" : " "}
        </span>
        <span style={{ ...cellBase, color: rightTxt, paddingRight: 12 }}>
          {row.inlineRight ? (
            <>
              <span>{row.inlineRight.pre}</span>
              {row.inlineRight.mid && (
                <span style={{ background: dark ? "#1a4a2e" : "#acf2bd", borderRadius: 2 }}>
                  {row.inlineRight.mid}
                </span>
              )}
              <span>{row.inlineRight.suf}</span>
            </>
          ) : rightContent}
        </span>
      </div>
    </div>
  );
}

// ── Upload drop zone ─────────────────────────────────────────────────
function DropZone({ side, value, onChange, dark, fileName, onFileName }) {
  const [drag, setDrag] = useState(false);
  const fileRef = useRef();

  const handleDrop = async (e) => {
    e.preventDefault(); setDrag(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    onFileName(file.name);
    onChange(await readFile(file));
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    onFileName(file.name);
    onChange(await readFile(file));
    e.target.value = "";
  };

  const bg  = dark ? "#0d1117" : "#ffffff";
  const bg2 = dark ? "#161b22" : "#f6f8fa";
  const bdr = dark ? "#30363d" : "#d0d7de";
  const txt = dark ? "#e6edf3" : "#24292f";
  const mut = dark ? "#8b949e" : "#8b949e";

  const accent = side === "left" ? "#f85149" : "#3fb950";
  const accentDim = side === "left"
    ? (dark ? "#3d1010" : "#ffebe9")
    : (dark ? "#0d2d1a" : "#dafbe1");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}>

      {/* Panel header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
        background: bg2, borderBottom: `1px solid ${bdr}`, flexShrink: 0,
      }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: accent, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: mut, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {side === "left" ? "← Original" : "Modified →"}
        </span>
        {fileName && (
          <span style={{ fontSize: 11, color: txt, background: bg, border: `1px solid ${bdr}`,
            borderRadius: 4, padding: "1px 8px", maxWidth: 200, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {fileName}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleFile}
          accept=".json,.xml,.yaml,.yml,.csv,.txt,.js,.ts,.jsx,.tsx,.md,.toml,.ini,.conf,.log,.html,.css,.sql,.py,.java,.go,.rs,.c,.cpp,.sh" />
        <button onClick={() => fileRef.current?.click()} style={{
          fontSize: 10, padding: "4px 10px", borderRadius: 5, cursor: "pointer",
          border: `1px solid ${bdr}`, background: "transparent", color: mut, fontFamily: "inherit",
        }}>📁 Upload</button>
        {value && (
          <button onClick={() => { onChange(""); onFileName(""); }} style={{
            fontSize: 11, padding: "3px 8px", borderRadius: 5, cursor: "pointer",
            border: `1px solid ${bdr}`, background: "transparent", color: mut, fontFamily: "inherit",
          }}>✕</button>
        )}
      </div>

      {/* Textarea */}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={drag
          ? "Drop file here..."
          : `Paste ${side === "left" ? "original" : "modified"} text here...\n\nSupports: JSON, XML, YAML, CSV, code, plain text\nor drag & drop any file`}
        spellCheck={false}
        style={{
          flex: 1, resize: "none", border: "none", outline: "none",
          padding: "14px 16px",
          background: drag ? accentDim : bg,
          color: txt, fontSize: 13, lineHeight: 1.6,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          boxSizing: "border-box", width: "100%",
          transition: "background 0.15s",
        }}
      />
    </div>
  );
}

// ── Main DiffPage ─────────────────────────────────────────────────────
export default function DiffPage({ dark, onClose, initialLeft = "", onDarkToggle }) {
  const [leftText,   setLeftText]   = useState(initialLeft);
  const [rightText,  setRightText]  = useState("");
  const [leftFile,   setLeftFile]   = useState(initialLeft ? "left" : "");
  const [rightFile,  setRightFile]  = useState("");
  const [showInputs, setShowInputs] = useState(true);
  const [inlineHL,   setInlineHL]   = useState(true);
  const [wrapLines,  setWrapLines]  = useState(false);
  const [hideSame,   setHideSame]   = useState(false);
  const [jumpIdx,    setJumpIdx]    = useState(0);
  const scrollRef = useRef();

  const bg    = dark ? "#0d1117" : "#ffffff";
  const bg2   = dark ? "#161b22" : "#f6f8fa";
  const bdr   = dark ? "#30363d" : "#d0d7de";
  const txt   = dark ? "#e6edf3" : "#24292f";
  const mut   = dark ? "#8b949e" : "#656d76";

  // Compute diff
  const rawLines = useMemo(() => {
    if (!leftText && !rightText) return [];
    return computeLineDiff(leftText, rightText);
  }, [leftText, rightText]);

  // Pair removed+added for inline char highlighting
  const diffLines = useMemo(() => {
    if (!inlineHL) return rawLines;
    const out = [];
    let i = 0;
    while (i < rawLines.length) {
      const cur = rawLines[i];
      const nxt = rawLines[i + 1];
      if (cur.type === "removed" && nxt?.type === "added") {
        const { left: il, right: ir } = charDiff(cur.left, nxt.right);
        out.push({ type: "removed", left: cur.left, inlineLeft: il });
        out.push({ type: "added",   right: nxt.right, inlineRight: ir });
        i += 2;
      } else {
        out.push(cur);
        i++;
      }
    }
    return out;
  }, [rawLines, inlineHL]);

  const visibleLines = useMemo(() => {
    if (!hideSame) return diffLines;
    // Show context: 3 lines around each change
    const changeMask = diffLines.map(l => l.type !== "same");
    return diffLines.filter((_, idx) => {
      for (let d = -3; d <= 3; d++) {
        if (changeMask[idx + d]) return true;
      }
      return false;
    });
  }, [diffLines, hideSame]);

  const stats = useMemo(() => getDiffStats(rawLines), [rawLines]);

  // Line number tracking
  const lineNumbers = useMemo(() => {
    let ln = 0, rn = 0;
    return diffLines.map(l => {
      const left  = l.type !== "added"   ? ++ln : null;
      const right = l.type !== "removed" ? ++rn : null;
      return { left, right };
    });
  }, [diffLines]);

  // Change positions for jump navigation
  const changePositions = useMemo(() =>
    visibleLines.map((l, i) => l.type !== "same" ? i : -1).filter(i => i >= 0),
  [visibleLines]);

  const jumpToChange = (dir) => {
    if (!changePositions.length) return;
    const newIdx = (jumpIdx + dir + changePositions.length) % changePositions.length;
    setJumpIdx(newIdx);
    const pos = changePositions[newIdx];
    const rows = scrollRef.current?.querySelectorAll("[data-row]");
    if (rows?.[pos]) rows[pos].scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const hasResult = leftText.trim() && rightText.trim();

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: bg, color: txt,
      fontFamily: "'JetBrains Mono','Fira Code',monospace",
    }}>

      {/* ── Top bar ── */}
      <div style={{
        flexShrink: 0, height: 52, display: "flex", alignItems: "center", gap: 10,
        padding: "0 16px", borderBottom: `1px solid ${bdr}`, background: bg2,
      }}>
        {/* Back */}
        <button onClick={onClose} style={{
          display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "6px 12px",
          borderRadius: 7, cursor: "pointer", border: `1px solid ${bdr}`,
          background: "transparent", color: mut, fontFamily: "inherit", fontWeight: 600,
        }}>← Parsly</button>

        <div style={{ width: 1, height: 24, background: bdr }} />

        {/* Title */}
        <span style={{ fontSize: 15, fontWeight: 700, color: txt }}>File Diff</span>
        <span style={{ fontSize: 11, color: mut }}>Compare any two files or text</span>

        {/* Stats */}
        {hasResult && (
          <>
            <div style={{ width: 1, height: 24, background: bdr }} />
            <span style={{
              fontSize: 11, padding: "3px 10px", borderRadius: 20,
              background: dark ? "#0d2d1a" : "#dafbe1",
              color: "#3fb950", fontWeight: 700, border: "1px solid #3fb95044"
            }}>+{stats.added} added</span>
            <span style={{
              fontSize: 11, padding: "3px 10px", borderRadius: 20,
              background: dark ? "#3d1010" : "#ffebe9",
              color: "#f85149", fontWeight: 700, border: "1px solid #f8514944"
            }}>−{stats.removed} removed</span>
            {stats.changed > 0 && (
              <span style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 20,
                background: dark ? "#271d0a" : "#fff8e6",
                color: "#d29922", fontWeight: 700, border: "1px solid #d2992244"
              }}>~{stats.changed} changed</span>
            )}
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* Options */}
        {hasResult && (
          <div style={{ display: "flex", gap: 4 }}>
            {/* Toggle inputs */}
            <button onClick={() => setShowInputs(s => !s)} style={{
              fontSize: 10, padding: "5px 10px", borderRadius: 6, cursor: "pointer",
              border: `1px solid ${bdr}`, background: showInputs ? (dark?"#21262d":"#f0f0f0") : "transparent",
              color: mut, fontFamily: "inherit",
            }}>{showInputs ? "▲ Hide Inputs" : "▼ Show Inputs"}</button>

            <button onClick={() => setInlineHL(v => !v)} style={{
              fontSize: 10, padding: "5px 10px", borderRadius: 6, cursor: "pointer",
              border: `1px solid ${inlineHL ? "#3fb950" : bdr}`,
              background: inlineHL ? (dark?"#0d2d1a":"#dafbe1") : "transparent",
              color: inlineHL ? "#3fb950" : mut, fontFamily: "inherit",
            }}>◈ Inline</button>

            <button onClick={() => setHideSame(v => !v)} style={{
              fontSize: 10, padding: "5px 10px", borderRadius: 6, cursor: "pointer",
              border: `1px solid ${hideSame ? "#a78bfa" : bdr}`,
              background: hideSame ? (dark?"#1e1433":"#f5f3ff") : "transparent",
              color: hideSame ? "#a78bfa" : mut, fontFamily: "inherit",
            }}>≡ Context only</button>

            {changePositions.length > 0 && (
              <>
                <button onClick={() => jumpToChange(-1)} style={{
                  fontSize: 11, padding: "5px 9px", borderRadius: 6, cursor: "pointer",
                  border: `1px solid ${bdr}`, background: "transparent", color: mut, fontFamily: "inherit",
                }}>↑</button>
                <button onClick={() => jumpToChange(1)} style={{
                  fontSize: 11, padding: "5px 9px", borderRadius: 6, cursor: "pointer",
                  border: `1px solid ${bdr}`, background: "transparent", color: mut, fontFamily: "inherit",
                }}>↓</button>
                <span style={{ fontSize: 10, color: mut, alignSelf: "center", minWidth: 60 }}>
                  {changePositions.length} hunks
                </span>
              </>
            )}

            <button onClick={() => {
              const report = rawLines.map(l =>
                l.type === "same" ? `  ${l.left}` :
                l.type === "removed" ? `- ${l.left}` : `+ ${l.right}`
              ).join("\n");
              navigator.clipboard.writeText(report);
            }} style={{
              fontSize: 10, padding: "5px 10px", borderRadius: 6, cursor: "pointer",
              border: `1px solid ${bdr}`, background: "transparent", color: mut, fontFamily: "inherit",
            }}>📋 Copy Diff</button>
          </div>
        )}

        <button onClick={onDarkToggle} style={{
          fontSize: 14, padding: "5px 9px", borderRadius: 6, cursor: "pointer",
          border: `1px solid ${bdr}`, background: "transparent", color: mut, fontFamily: "inherit",
        }}>{dark ? "☀" : "☾"}</button>
      </div>

      {/* ── Input panels (collapsible) ── */}
      {(!hasResult || showInputs) && (
        <div style={{
          display: "flex", flexShrink: 0,
          height: hasResult ? 220 : "45%",
          borderBottom: `1px solid ${bdr}`,
          transition: "height 0.2s",
        }}>
          <DropZone side="left"  value={leftText}  onChange={setLeftText}  dark={dark}
            fileName={leftFile}  onFileName={setLeftFile} />
          <div style={{ width: 3, background: bdr, flexShrink: 0 }} />
          <DropZone side="right" value={rightText} onChange={setRightText} dark={dark}
            fileName={rightFile} onFileName={setRightFile} />
        </div>
      )}

      {/* ── Diff view ── */}
      {hasResult ? (
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: bg }} ref={scrollRef}>

          {/* Column headers */}
          <div style={{
            display: "flex", position: "sticky", top: 0, zIndex: 10,
            background: bg2, borderBottom: `1px solid ${bdr}`,
            fontFamily: "inherit",
          }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8,
              padding: "7px 14px 7px 62px", borderRight: `1px solid ${bdr}` }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f85149" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#f85149", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {leftFile || "Original"}
              </span>
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8,
              padding: "7px 14px 7px 62px" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#3fb950" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#3fb950", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {rightFile || "Modified"}
              </span>
            </div>
          </div>

          {/* Empty diff message */}
          {visibleLines.length === 0 && (
            <div style={{ textAlign: "center", padding: 60, color: "#3fb950", fontSize: 14, fontFamily: "inherit" }}>
              ✓ Files are identical — no differences found
            </div>
          )}

          {/* Diff rows */}
          {visibleLines.map((row, idx) => {
            // Find line numbers from original diffLines
            const origIdx = diffLines.indexOf(row);
            const nums = origIdx >= 0 ? lineNumbers[origIdx] : { left: null, right: null };
            return (
              <div key={idx} data-row={idx}>
                <DiffRow
                  row={row}
                  leftNum={nums.left}
                  rightNum={nums.right}
                  dark={dark}
                  inlineHighlight={inlineHL}
                />
              </div>
            );
          })}

          {/* Bottom padding */}
          <div style={{ height: 60 }} />
        </div>
      ) : (
        /* Empty state */
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, opacity: 0.4 }}>
          <div style={{ fontSize: 64, color: mut }}>⟺</div>
          <div style={{ fontSize: 14, color: mut, fontWeight: 600 }}>Paste text into both panels to compare</div>
          <div style={{ fontSize: 12, color: mut }}>
            Supports JSON, XML, YAML, CSV, code, logs — any text file
          </div>
          <div style={{ fontSize: 11, color: mut, marginTop: 4 }}>
            Drag & drop files · Paste text · Upload via button
          </div>
        </div>
      )}
    </div>
  );
}