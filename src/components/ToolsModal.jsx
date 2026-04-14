import { useState, useEffect, useMemo, useCallback } from "react";

// ─── Hash functions using Web Crypto ─────────────────────────────────────────
async function hashText(text, algo) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest(algo, enc.encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─── Base64 encode/decode ─────────────────────────────────────────────────────
function b64Encode(str) {
  try { return btoa(unescape(encodeURIComponent(str))); }
  catch (e) { return `Error: ${e.message}`; }
}

function b64Decode(str) {
  try { return decodeURIComponent(escape(atob(str.trim()))); }
  catch (e) { return `Error: ${e.message}`; }
}

// ─── URL encode/decode ────────────────────────────────────────────────────────
function urlEncode(str) {
  try { return encodeURIComponent(str); }
  catch (e) { return `Error: ${e.message}`; }
}

function urlDecode(str) {
  try { return decodeURIComponent(str); }
  catch (e) { return `Error: ${e.message}`; }
}

// ─── Regex helpers ────────────────────────────────────────────────────────────
function applyRegex(pattern, flags, text) {
  if (!pattern) return { matches: [], error: null, groups: [] };
  try {
    const regex = new RegExp(pattern, flags);
    const matches = [];
    let m;
    if (flags.includes("g")) {
      while ((m = regex.exec(text)) !== null) {
        matches.push({ index: m.index, match: m[0], groups: m.slice(1), namedGroups: m.groups || {} });
        if (m.index === regex.lastIndex) { regex.lastIndex++; }
      }
    } else {
      m = regex.exec(text);
      if (m) matches.push({ index: m.index, match: m[0], groups: m.slice(1), namedGroups: m.groups || {} });
    }
    return { matches, error: null };
  } catch (e) {
    return { matches: [], error: e.message };
  }
}

// ─── Highlight matches in text ────────────────────────────────────────────────
function HighlightedText({ text, matches, dark }) {
  if (!matches.length) return <span style={{ whiteSpace: "pre-wrap" }}>{text}</span>;

  const parts = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.index > cursor) parts.push({ text: text.slice(cursor, m.index), highlight: false });
    parts.push({ text: m.match, highlight: true });
    cursor = m.index + m.match.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), highlight: false });

  return (
    <span style={{ whiteSpace: "pre-wrap" }}>
      {parts.map((p, i) => p.highlight
        ? <mark key={i} style={{ background: "#10b98140", color: "#10b981", borderRadius: 2, padding: "0 1px" }}>{p.text}</mark>
        : <span key={i}>{p.text}</span>
      )}
    </span>
  );
}

// ─── Sub-tools ────────────────────────────────────────────────────────────────
const TOOLS = [
  { id: "regex",  label: "RegEx",    icon: ".*" },
  { id: "encode", label: "Encode",   icon: "⇄" },
  { id: "hash",   label: "Hash",     icon: "#" },
  { id: "diff-strings", label: "Diff Text", icon: "±" },
];

// ─── Main ToolsModal ──────────────────────────────────────────────────────────
export default function ToolsModal({ onClose, dark, initialData }) {
  const [activeTool, setActiveTool] = useState("regex");

  // RegEx state
  const [pattern, setPattern] = useState("");
  const [flags, setFlags]     = useState("g");
  const [testText, setTestText] = useState("Hello World! foo bar baz\nSecond line here");

  // Encode state
  const [encodeInput, setEncodeInput] = useState(initialData ? JSON.stringify(initialData) : "");
  const [encodeMode, setEncodeMode] = useState("b64encode");

  // Hash state
  const [hashInput, setHashInput] = useState(initialData ? JSON.stringify(initialData) : "");
  const [hashes, setHashes] = useState({});
  const [hashLoading, setHashLoading] = useState(false);

  // Text diff state
  const [diffA, setDiffA] = useState("");
  const [diffB, setDiffB] = useState("");

  const bg   = dark ? "#030712" : "#ffffff";
  const bg2  = dark ? "#0f172a" : "#f8fafc";
  const bg3  = dark ? "#111827" : "#ffffff";
  const bdr  = dark ? "#1f2937" : "#e2e8f0";
  const txt  = dark ? "#d1d5db" : "#374151";
  const mute = dark ? "#6b7280" : "#94a3b8";

  // ESC to close
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // Regex computation
  const regexResult = useMemo(() => {
    if (!pattern) return { matches: [], error: null };
    return applyRegex(pattern, flags, testText);
  }, [pattern, flags, testText]);

  // Encode computation
  const encodeOutput = useMemo(() => {
    if (!encodeInput) return "";
    switch (encodeMode) {
      case "b64encode": return b64Encode(encodeInput);
      case "b64decode": return b64Decode(encodeInput);
      case "urlencode": return urlEncode(encodeInput);
      case "urldecode": return urlDecode(encodeInput);
      case "htmlescape": return encodeInput.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
      case "htmlunescape": return encodeInput.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"');
      default: return encodeInput;
    }
  }, [encodeInput, encodeMode]);

  // Hash computation
  const computeHashes = useCallback(async () => {
    if (!hashInput) { setHashes({}); return; }
    setHashLoading(true);
    try {
      const [sha1, sha256, sha384, sha512] = await Promise.all([
        hashText(hashInput, "SHA-1"),
        hashText(hashInput, "SHA-256"),
        hashText(hashInput, "SHA-384"),
        hashText(hashInput, "SHA-512"),
      ]);
      setHashes({ sha1, sha256, sha384, sha512 });
    } catch (e) {
      setHashes({ error: e.message });
    } finally {
      setHashLoading(false);
    }
  }, [hashInput]);

  useEffect(() => {
    const timer = setTimeout(computeHashes, 400);
    return () => clearTimeout(timer);
  }, [computeHashes]);

  // Text diff computation
  const textDiff = useMemo(() => {
    if (!diffA || !diffB) return null;
    const aLines = diffA.split("\n");
    const bLines = diffB.split("\n");
    const result = [];
    const maxLen = Math.max(aLines.length, bLines.length);
    for (let i = 0; i < maxLen; i++) {
      const a = aLines[i] ?? null;
      const b = bLines[i] ?? null;
      if (a === b)      result.push({ type: "same",    lineA: a, lineB: b, i });
      else if (a === null) result.push({ type: "added",   lineA: null, lineB: b, i });
      else if (b === null) result.push({ type: "removed", lineA: a, lineB: null, i });
      else               result.push({ type: "changed", lineA: a, lineB: b, i });
    }
    return result;
  }, [diffA, diffB]);

  const [copiedHash, setCopiedHash] = useState(null);
  const copyHash = (key, val) => {
    navigator.clipboard.writeText(val);
    setCopiedHash(key);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const taStyle = {
    width: "100%", background: bg3, border: `1px solid ${bdr}`, borderRadius: 8,
    padding: 10, fontSize: 11, color: txt, fontFamily: "inherit",
    resize: "none", outline: "none", boxSizing: "border-box", lineHeight: 1.6,
  };

  const flagBtn = (f) => ({
    padding: "3px 8px", fontSize: 11, borderRadius: 4,
    background: flags.includes(f) ? "#10b981" : "transparent",
    border: `1px solid ${flags.includes(f) ? "#10b981" : bdr}`,
    color: flags.includes(f) ? "#030712" : mute,
    cursor: "pointer", fontFamily: "inherit", fontWeight: flags.includes(f) ? 700 : 400,
  });

  const toggleFlag = (f) => setFlags(prev => prev.includes(f) ? prev.replace(f, "") : prev + f);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: bg, border: `1px solid ${bdr}`, borderRadius: 16,
        width: "min(900px, 96vw)", height: "min(680px, 92vh)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
          borderBottom: `1px solid ${bdr}`, flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: txt }}>🛠 Dev Tools</span>
          <div style={{ flex: 1 }} />
          {TOOLS.map(t => (
            <button key={t.id} onClick={() => setActiveTool(t.id)} style={{
              padding: "5px 12px", fontSize: 11, borderRadius: 6,
              background: activeTool === t.id ? "#10b981" : "transparent",
              border: `1px solid ${activeTool === t.id ? "#10b981" : bdr}`,
              color: activeTool === t.id ? "#030712" : mute,
              cursor: "pointer", fontFamily: "inherit", fontWeight: activeTool === t.id ? 700 : 400,
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <span style={{ fontSize: 10, opacity: 0.7 }}>{t.icon}</span> {t.label}
            </button>
          ))}
          <div style={{ width: 1, height: 18, background: bdr }} />
          <button onClick={onClose} style={{ padding: "4px 9px", fontSize: 14, borderRadius: 6,
            background: "transparent", border: `1px solid ${bdr}`, color: mute, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>

          {/* ── RegEx Tool ── */}
          {activeTool === "regex" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 14, gap: 10, overflow: "hidden" }}>
              {/* Pattern input */}
              <div style={{ flexShrink: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 0 }}>
                    <span style={{ padding: "7px 10px", background: bg2, border: `1px solid ${bdr}`,
                      borderRight: "none", borderRadius: "8px 0 0 8px", fontSize: 13, color: mute }}>/</span>
                    <input value={pattern} onChange={e => setPattern(e.target.value)}
                      placeholder="your pattern here"
                      style={{ flex: 1, padding: "7px 10px", background: bg3, border: `1px solid ${bdr}`,
                        borderLeft: "none", borderRight: "none", fontSize: 12, color: txt,
                        fontFamily: "monospace", outline: "none" }} />
                    <span style={{ padding: "7px 10px", background: bg2, border: `1px solid ${bdr}`,
                      borderLeft: "none", borderRadius: "0 8px 8px 0", fontSize: 13, color: mute }}>/{flags}</span>
                  </div>
                  {/* Flags */}
                  {["g", "i", "m", "s"].map(f => (
                    <button key={f} onClick={() => toggleFlag(f)} style={flagBtn(f)}>{f}</button>
                  ))}
                </div>
                {regexResult.error && <div style={{ fontSize: 11, color: "#f87171", marginTop: 5 }}>✗ {regexResult.error}</div>}
                {!regexResult.error && pattern && (
                  <div style={{ fontSize: 11, color: "#10b981", marginTop: 5 }}>
                    {regexResult.matches.length} match{regexResult.matches.length !== 1 ? "es" : ""} found
                  </div>
                )}
              </div>

              <div style={{ flex: 1, display: "flex", gap: 10, minHeight: 0 }}>
                {/* Test text */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ fontSize: 10, color: mute, letterSpacing: "0.08em", textTransform: "uppercase" }}>Test Text</span>
                  <textarea value={testText} onChange={e => setTestText(e.target.value)}
                    style={{ ...taStyle, flex: 1 }} />
                </div>

                {/* Highlighted output */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ fontSize: 10, color: mute, letterSpacing: "0.08em", textTransform: "uppercase" }}>Highlighted Output</span>
                  <div style={{ flex: 1, background: bg3, border: `1px solid ${bdr}`, borderRadius: 8,
                    padding: 10, fontSize: 11, color: txt, overflowY: "auto", lineHeight: 1.7 }}>
                    <HighlightedText text={testText} matches={regexResult.matches} dark={dark} />
                  </div>
                </div>
              </div>

              {/* Matches */}
              {regexResult.matches.length > 0 && (
                <div style={{ flexShrink: 0, maxHeight: 140, overflowY: "auto" }}>
                  <div style={{ fontSize: 10, color: mute, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>Matches</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {regexResult.matches.map((m, i) => (
                      <div key={i} style={{ background: "#10b98120", border: "1px solid #10b98140",
                        borderRadius: 5, padding: "3px 8px", fontSize: 11 }}>
                        <span style={{ color: "#10b981" }}>#{i+1}</span>
                        <span style={{ color: txt, marginLeft: 5 }}>"{m.match}"</span>
                        <span style={{ color: mute, fontSize: 10, marginLeft: 5 }}>@{m.index}</span>
                        {m.groups.length > 0 && (
                          <span style={{ color: "#60a5fa", fontSize: 10, marginLeft: 5 }}>
                            ({m.groups.map((g, j) => `$${j+1}:"${g}"`).join(", ")})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Common patterns */}
              {!pattern && (
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: mute, marginBottom: 6 }}>Common patterns:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {[
                      { label: "Email", pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}" },
                      { label: "URL", pattern: "https?:\\/\\/[^\\s]+" },
                      { label: "Phone", pattern: "\\+?[1-9]\\d{1,14}" },
                      { label: "IP", pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b" },
                      { label: "Date YYYY-MM-DD", pattern: "\\d{4}-\\d{2}-\\d{2}" },
                      { label: "Hex Color", pattern: "#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})\\b" },
                    ].map(p => (
                      <button key={p.label} onClick={() => setPattern(p.pattern)}
                        style={{ fontSize: 10, padding: "3px 9px", borderRadius: 5, background: "transparent",
                          border: `1px solid ${bdr}`, color: mute, cursor: "pointer", fontFamily: "inherit" }}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Encode/Decode Tool ── */}
          {activeTool === "encode" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 14, gap: 10, overflow: "hidden" }}>
              {/* Mode selector */}
              <div style={{ flexShrink: 0, display: "flex", gap: 5, flexWrap: "wrap" }}>
                {[
                  { id: "b64encode", label: "Base64 Encode" },
                  { id: "b64decode", label: "Base64 Decode" },
                  { id: "urlencode", label: "URL Encode" },
                  { id: "urldecode", label: "URL Decode" },
                  { id: "htmlescape", label: "HTML Escape" },
                  { id: "htmlunescape", label: "HTML Unescape" },
                ].map(m => (
                  <button key={m.id} onClick={() => setEncodeMode(m.id)} style={{
                    padding: "5px 12px", fontSize: 11, borderRadius: 6,
                    background: encodeMode === m.id ? "#10b981" : "transparent",
                    border: `1px solid ${encodeMode === m.id ? "#10b981" : bdr}`,
                    color: encodeMode === m.id ? "#030712" : mute,
                    cursor: "pointer", fontFamily: "inherit", fontWeight: encodeMode === m.id ? 700 : 400,
                  }}>{m.label}</button>
                ))}
              </div>

              <div style={{ flex: 1, display: "flex", gap: 10, minHeight: 0 }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ fontSize: 10, color: mute, letterSpacing: "0.08em", textTransform: "uppercase" }}>Input</span>
                  <textarea value={encodeInput} onChange={e => setEncodeInput(e.target.value)}
                    placeholder="Paste text to encode/decode..." style={{ ...taStyle, flex: 1 }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", color: mute, fontSize: 16 }}>⇄</div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: 10, color: mute, letterSpacing: "0.08em", textTransform: "uppercase" }}>Output</span>
                    <button onClick={() => navigator.clipboard.writeText(encodeOutput)}
                      style={{ marginLeft: "auto", fontSize: 10, padding: "2px 8px", borderRadius: 4,
                        background: "transparent", border: `1px solid ${bdr}`, color: mute, cursor: "pointer", fontFamily: "inherit" }}>
                      copy
                    </button>
                  </div>
                  <div style={{ flex: 1, background: bg2, border: `1px solid ${bdr}`, borderRadius: 8, padding: 10,
                    fontSize: 11, color: encodeOutput.startsWith("Error:") ? "#f87171" : txt,
                    overflowY: "auto", wordBreak: "break-all", lineHeight: 1.7 }}>
                    {encodeOutput || <span style={{ color: mute }}>Output appears here...</span>}
                  </div>
                </div>
              </div>

              {/* Swap button */}
              <button onClick={() => { setEncodeInput(encodeOutput); }} disabled={!encodeOutput || encodeOutput.startsWith("Error:")}
                style={{ alignSelf: "center", padding: "6px 16px", fontSize: 11, borderRadius: 6,
                  background: "transparent", border: `1px solid ${bdr}`, color: mute, cursor: "pointer", fontFamily: "inherit" }}>
                ↕ Swap input/output
              </button>
            </div>
          )}

          {/* ── Hash Tool ── */}
          {activeTool === "hash" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 14, gap: 10, overflow: "hidden" }}>
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: mute, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Input Text</div>
                <textarea value={hashInput} onChange={e => setHashInput(e.target.value)}
                  placeholder="Enter text to hash..." rows={4} style={taStyle} />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
                {hashLoading && <div style={{ color: mute, fontSize: 12 }}>Computing hashes...</div>}
                {hashes.error && <div style={{ color: "#f87171", fontSize: 12 }}>✗ {hashes.error}</div>}
                {!hashLoading && !hashes.error && Object.entries(hashes).length > 0 && (
                  [
                    ["SHA-1", hashes.sha1, "#f59e0b"],
                    ["SHA-256", hashes.sha256, "#10b981"],
                    ["SHA-384", hashes.sha384, "#60a5fa"],
                    ["SHA-512", hashes.sha512, "#c084fc"],
                  ].map(([algo, val, color]) => (
                    <div key={algo} style={{ background: bg2, border: `1px solid ${bdr}`, borderRadius: 8, padding: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color }}>{algo}</span>
                        <span style={{ fontSize: 10, color: mute, marginLeft: 8 }}>{(val?.length || 0) / 2 * 8} bits</span>
                        <button onClick={() => copyHash(algo, val)}
                          style={{ marginLeft: "auto", fontSize: 10, padding: "2px 8px", borderRadius: 4,
                            background: "transparent", border: `1px solid ${bdr}`,
                            color: copiedHash === algo ? "#10b981" : mute, cursor: "pointer", fontFamily: "inherit" }}>
                          {copiedHash === algo ? "✓ Copied" : "copy"}
                        </button>
                      </div>
                      <div style={{ fontSize: 11, color: txt, wordBreak: "break-all", fontFamily: "monospace" }}>{val}</div>
                    </div>
                  ))
                )}
                {!hashInput && <div style={{ color: mute, fontSize: 12, textAlign: "center", paddingTop: 40 }}>Type text above to compute hashes</div>}
              </div>
            </div>
          )}

          {/* ── Text Diff Tool ── */}
          {activeTool === "diff-strings" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 14, gap: 10, overflow: "hidden" }}>
              <div style={{ flex: 0.4, display: "flex", gap: 10, minHeight: 0 }}>
                {[["Original", diffA, setDiffA, "#10b981"], ["Modified", diffB, setDiffB, "#f59e0b"]].map(([label, val, setter, color]) => (
                  <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
                      <span style={{ fontSize: 10, color: mute, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
                    </div>
                    <textarea value={val} onChange={e => setter(e.target.value)}
                      placeholder={`Paste ${label.toLowerCase()} text...`} style={{ ...taStyle, flex: 1 }} />
                  </div>
                ))}
              </div>

              {textDiff && (
                <div style={{ flex: 0.6, minHeight: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: mute, letterSpacing: "0.08em", textTransform: "uppercase" }}>Diff</span>
                    <span style={{ fontSize: 10, color: "#f87171" }}>−{textDiff.filter(d => d.type === "removed" || d.type === "changed").length}</span>
                    <span style={{ fontSize: 10, color: "#10b981" }}>+{textDiff.filter(d => d.type === "added" || d.type === "changed").length}</span>
                    <span style={{ fontSize: 10, color: mute }}>{textDiff.filter(d => d.type === "same").length} unchanged</span>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", background: bg3, border: `1px solid ${bdr}`, borderRadius: 8, padding: 8 }}>
                    {textDiff.map((d, i) => {
                      if (d.type === "same") return (
                        <div key={i} style={{ display: "flex", fontSize: 11, lineHeight: 1.7 }}>
                          <span style={{ width: 30, color: mute, flexShrink: 0, userSelect: "none", fontSize: 10 }}>{i+1}</span>
                          <span style={{ color: mute }}>{d.lineA}</span>
                        </div>
                      );
                      if (d.type === "removed") return (
                        <div key={i} style={{ display: "flex", fontSize: 11, lineHeight: 1.7, background: "#f8717110", borderRadius: 3 }}>
                          <span style={{ width: 30, color: "#f87171", flexShrink: 0, userSelect: "none", fontSize: 10, fontWeight: 700 }}>−</span>
                          <span style={{ color: "#f87171" }}>{d.lineA}</span>
                        </div>
                      );
                      if (d.type === "added") return (
                        <div key={i} style={{ display: "flex", fontSize: 11, lineHeight: 1.7, background: "#10b98110", borderRadius: 3 }}>
                          <span style={{ width: 30, color: "#10b981", flexShrink: 0, userSelect: "none", fontSize: 10, fontWeight: 700 }}>+</span>
                          <span style={{ color: "#10b981" }}>{d.lineB}</span>
                        </div>
                      );
                      return (
                        <div key={i} style={{ fontSize: 11, lineHeight: 1.7, borderRadius: 3 }}>
                          <div style={{ display: "flex", background: "#f8717110" }}>
                            <span style={{ width: 30, color: "#f87171", flexShrink: 0, userSelect: "none", fontSize: 10, fontWeight: 700 }}>−</span>
                            <span style={{ color: "#f87171" }}>{d.lineA}</span>
                          </div>
                          <div style={{ display: "flex", background: "#10b98110" }}>
                            <span style={{ width: 30, color: "#10b981", flexShrink: 0, userSelect: "none", fontSize: 10, fontWeight: 700 }}>+</span>
                            <span style={{ color: "#10b981" }}>{d.lineB}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {!diffA && !diffB && (
                <div style={{ flex: 0.6, display: "flex", alignItems: "center", justifyContent: "center", color: mute, fontSize: 12 }}>
                  Paste text in both panels to see the diff
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}