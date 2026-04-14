import { useState, useMemo } from "react";

function b64urlDecode(str) {
  try {
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - b64.length % 4) : "";
    return JSON.parse(atob(b64 + pad));
  } catch { return null; }
}

function b64urlDecodeRaw(str) {
  try {
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - b64.length % 4) : "";
    return atob(b64 + pad);
  } catch { return null; }
}

function parseJWT(token) {
  const parts = (token || "").trim().split(".");
  if (parts.length !== 3) return null;
  const header  = b64urlDecode(parts[0]);
  const payload = b64urlDecode(parts[1]);
  const sig     = parts[2];
  if (!header || !payload) return null;
  return { header, payload, sig, raw: parts };
}

function isExpired(payload) {
  if (!payload?.exp) return null;
  return Date.now() / 1000 > payload.exp;
}

function formatDate(ts) {
  try { return new Date(ts * 1000).toLocaleString(); } catch { return "—"; }
}

function JsonBlock({ data, dark, color }) {
  const bdr = dark ? "#30363d" : "#d0d7de";
  const bg  = dark ? "#0d1117" : "#f6f8fa";

  const colorize = (key, val) => {
    if (typeof val === "string") return <span style={{ color: "#79c0ff" }}>"{val}"</span>;
    if (typeof val === "number") return <span style={{ color: "#f78166" }}>{val}</span>;
    if (typeof val === "boolean") return <span style={{ color: "#ffa657" }}>{String(val)}</span>;
    if (val === null) return <span style={{ color: "#8b949e" }}>null</span>;
    return <span style={{ color: dark?"#e6edf3":"#24292f" }}>{JSON.stringify(val)}</span>;
  };

  return (
    <div style={{
      background: bg, border: `1px solid ${color || bdr}`,
      borderRadius: 8, padding: 16, fontFamily: "'JetBrains Mono',monospace",
      fontSize: 13, lineHeight: 1.8, overflow: "auto",
    }}>
      {"{"}<br />
      {Object.entries(data).map(([k, v], i, arr) => (
        <div key={k} style={{ paddingLeft: 20 }}>
          <span style={{ color: "#56d364" }}>"{k}"</span>
          <span style={{ color: dark?"#e6edf3":"#24292f" }}>: </span>
          {colorize(k, v)}
          {i < arr.length - 1 ? "," : ""}
        </div>
      ))}
      {"}"}
    </div>
  );
}

function ClaimRow({ label, value, dark, highlight }) {
  const bg  = dark ? "#161b22" : "#f6f8fa";
  const bdr = dark ? "#30363d" : "#d0d7de";
  const txt = dark ? "#e6edf3" : "#24292f";
  const mut = dark ? "#8b949e" : "#656d76";

  return (
    <div style={{
      display: "flex", gap: 0, borderRadius: 6, overflow: "hidden",
      border: `1px solid ${highlight ? highlight+"44" : bdr}`,
      background: highlight ? highlight+"11" : bg, marginBottom: 4,
    }}>
      <div style={{ width: 140, flexShrink: 0, padding: "8px 12px",
        borderRight: `1px solid ${bdr}`, fontSize: 11, fontWeight: 700,
        color: mut, textTransform: "uppercase", letterSpacing: "0.06em",
        display: "flex", alignItems: "center" }}>
        {label}
      </div>
      <div style={{ flex: 1, padding: "8px 14px", fontSize: 12, color: highlight || txt,
        fontFamily: "'JetBrains Mono',monospace", display: "flex", alignItems: "center",
        wordBreak: "break-all" }}>
        {value}
      </div>
    </div>
  );
}

export default function JWTPage({ dark, onClose, onDarkToggle }) {
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState("");

  const bg  = dark ? "#0d1117" : "#ffffff";
  const bg2 = dark ? "#161b22" : "#f6f8fa";
  const bdr = dark ? "#30363d" : "#d0d7de";
  const txt = dark ? "#e6edf3" : "#24292f";
  const mut = dark ? "#8b949e" : "#656d76";

  const jwt = useMemo(() => parseJWT(token), [token]);
  const expired = jwt ? isExpired(jwt.payload) : null;

  const copy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    });
  };

  const sampleJWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

  const parts = (token || "").trim().split(".");
  const isValidStructure = parts.length === 3;

  const renderColoredToken = () => {
    if (!token.trim()) return null;
    const p = token.trim().split(".");
    const colors = ["#f78166", "#79c0ff", "#ffa657"];
    const labels = ["header", "payload", "signature"];
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 0, wordBreak: "break-all",
        fontFamily: "'JetBrains Mono',monospace", fontSize: 12, lineHeight: 1.8 }}>
        {p.map((part, i) => (
          <span key={i}>
            <span style={{ color: colors[i] || "#e6edf3" }}>{part}</span>
            {i < p.length - 1 && <span style={{ color: mut }}>.</span>}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column",
      background: bg, color: txt, fontFamily: "'JetBrains Mono','Fira Code',monospace" }}>

      {/* Top bar */}
      <div style={{ flexShrink: 0, height: 52, display: "flex", alignItems: "center", gap: 10,
        padding: "0 20px", borderBottom: `1px solid ${bdr}`, background: bg2 }}>
        <button onClick={onClose} style={{
          fontSize: 13, padding: "6px 12px", borderRadius: 7, cursor: "pointer",
          border: `1px solid ${bdr}`, background: "transparent", color: mut,
          fontFamily: "inherit", fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
        }}>← Parsly</button>
        <div style={{ width: 1, height: 24, background: bdr }} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>🔑 JWT Decoder</span>
        <span style={{ fontSize: 11, color: mut }}>Decode & inspect JSON Web Tokens</span>
        <div style={{ flex: 1 }} />
        {jwt && expired !== null && (
          <span style={{
            fontSize: 11, padding: "4px 12px", borderRadius: 20, fontWeight: 700,
            background: expired ? (dark?"#3d1010":"#ffebe9") : (dark?"#0d2d1a":"#dafbe1"),
            color: expired ? "#f85149" : "#3fb950",
            border: `1px solid ${expired ? "#f8514944" : "#3fb95044"}`,
          }}>
            {expired ? "⚠ EXPIRED" : "✓ Valid (not expired)"}
          </span>
        )}
        <button onClick={onDarkToggle} style={{ fontSize: 14, padding: "5px 9px", borderRadius: 6,
          cursor: "pointer", border: `1px solid ${bdr}`, background: "transparent", color: mut, fontFamily: "inherit" }}>
          {dark ? "☀" : "☾"}
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>

        {/* Left: Input */}
        <div style={{ width: "42%", display: "flex", flexDirection: "column", borderRight: `1px solid ${bdr}` }}>
          <div style={{ padding: "10px 16px", borderBottom: `1px solid ${bdr}`,
            background: bg2, fontSize: 11, fontWeight: 700, color: mut,
            textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#38bdf8" }} />
            JWT Token Input
            <button onClick={() => setToken(sampleJWT)} style={{
              marginLeft: "auto", fontSize: 10, padding: "3px 10px", borderRadius: 5,
              cursor: "pointer", border: `1px solid ${bdr}`, background: "transparent",
              color: "#38bdf8", fontFamily: "inherit",
            }}>Try Sample</button>
            {token && <button onClick={() => setToken("")} style={{
              fontSize: 10, padding: "3px 8px", borderRadius: 5, cursor: "pointer",
              border: `1px solid ${bdr}`, background: "transparent", color: mut, fontFamily: "inherit",
            }}>✕</button>}
          </div>

          <textarea
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder={"Paste your JWT token here...\n\neyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
            spellCheck={false}
            style={{
              flex: 1, resize: "none", border: "none", outline: "none",
              padding: "16px", background: bg, color: txt,
              fontSize: 12, lineHeight: 1.7, fontFamily: "'JetBrains Mono',monospace",
              boxSizing: "border-box",
            }}
          />

          {/* Colored token preview */}
          {token.trim() && (
            <div style={{ padding: 16, borderTop: `1px solid ${bdr}`, background: bg2 }}>
              <div style={{ fontSize: 10, color: mut, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Token Structure
              </div>
              {renderColoredToken()}
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                {["header","payload","signature"].map((l, i) => (
                  <span key={l} style={{ fontSize: 10, color: ["#f78166","#79c0ff","#ffa657"][i],
                    display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%",
                      background: ["#f78166","#79c0ff","#ffa657"][i] }} />
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Decoded */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
          {!token.trim() && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: 12, opacity: 0.3 }}>
              <div style={{ fontSize: 48, color: mut }}>🔑</div>
              <div style={{ fontSize: 14, color: mut }}>Paste a JWT token to decode it</div>
            </div>
          )}

          {token.trim() && !jwt && (
            <div style={{ background: dark?"#3d1010":"#ffebe9", border: "1px solid #f8514944",
              borderRadius: 8, padding: 16, color: "#f85149", fontSize: 13 }}>
              ✗ Invalid JWT — must have 3 dot-separated base64url parts
            </div>
          )}

          {jwt && (
            <>
              {/* Header */}
              <section>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#f78166",
                    textTransform: "uppercase", letterSpacing: "0.08em" }}>Header</h3>
                  <button onClick={() => copy(JSON.stringify(jwt.header, null, 2), "hdr")} style={{
                    fontSize: 10, padding: "3px 10px", borderRadius: 5, cursor: "pointer",
                    border: `1px solid ${bdr}`, background: "transparent",
                    color: copied === "hdr" ? "#3fb950" : mut, fontFamily: "inherit",
                  }}>{copied === "hdr" ? "✓ Copied" : "Copy"}</button>
                </div>
                <JsonBlock data={jwt.header} dark={dark} color="#f78166" />
              </section>

              {/* Payload */}
              <section>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#79c0ff",
                    textTransform: "uppercase", letterSpacing: "0.08em" }}>Payload</h3>
                  <button onClick={() => copy(JSON.stringify(jwt.payload, null, 2), "pay")} style={{
                    fontSize: 10, padding: "3px 10px", borderRadius: 5, cursor: "pointer",
                    border: `1px solid ${bdr}`, background: "transparent",
                    color: copied === "pay" ? "#3fb950" : mut, fontFamily: "inherit",
                  }}>{copied === "pay" ? "✓ Copied" : "Copy"}</button>
                </div>
                <JsonBlock data={jwt.payload} dark={dark} color="#79c0ff" />

                {/* Well-known claims */}
                {(jwt.payload.iss || jwt.payload.sub || jwt.payload.aud ||
                  jwt.payload.iat || jwt.payload.exp || jwt.payload.nbf) && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, color: mut, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Standard Claims
                    </div>
                    {jwt.payload.iss  && <ClaimRow label="iss (issuer)"    value={jwt.payload.iss}  dark={dark} />}
                    {jwt.payload.sub  && <ClaimRow label="sub (subject)"   value={jwt.payload.sub}  dark={dark} />}
                    {jwt.payload.aud  && <ClaimRow label="aud (audience)"  value={String(jwt.payload.aud)} dark={dark} />}
                    {jwt.payload.iat  && <ClaimRow label="iat (issued at)" value={`${formatDate(jwt.payload.iat)} (${jwt.payload.iat})`} dark={dark} />}
                    {jwt.payload.exp  && <ClaimRow label="exp (expires)"   value={`${formatDate(jwt.payload.exp)} (${jwt.payload.exp})`} dark={dark} highlight={expired ? "#f85149" : "#3fb950"} />}
                    {jwt.payload.nbf  && <ClaimRow label="nbf (not before)" value={formatDate(jwt.payload.nbf)} dark={dark} />}
                  </div>
                )}
              </section>

              {/* Signature */}
              <section>
                <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#ffa657",
                  textTransform: "uppercase", letterSpacing: "0.08em" }}>Signature</h3>
                <div style={{
                  background: dark?"#0d1117":"#f6f8fa", border: "1px solid #ffa65744",
                  borderRadius: 8, padding: 14, fontSize: 11,
                  fontFamily: "'JetBrains Mono',monospace", color: "#ffa657",
                  wordBreak: "break-all", lineHeight: 1.6,
                }}>
                  {jwt.sig}
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: mut }}>
                  Algorithm: <span style={{ color: "#ffa657", fontWeight: 600 }}>{jwt.header.alg || "unknown"}</span>
                  {" · "}Note: signature can only be verified server-side with the secret/key
                </div>
              </section>

              {/* Raw parts */}
              <section>
                <div style={{ fontSize: 11, color: mut, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Raw Parts
                </div>
                {["Header","Payload","Signature"].map((label, i) => (
                  <div key={label} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 10, color: mut, marginBottom: 3 }}>{label}</div>
                    <div style={{
                      background: dark?"#0d1117":"#f6f8fa", border: `1px solid ${bdr}`,
                      borderRadius: 6, padding: "8px 12px", fontSize: 11,
                      fontFamily: "monospace", wordBreak: "break-all", color: ["#f78166","#79c0ff","#ffa657"][i],
                    }}>{jwt.raw[i]}</div>
                  </div>
                ))}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}