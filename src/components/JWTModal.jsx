import { useState, useEffect, useCallback } from "react";

// ─── Base64url helpers ────────────────────────────────────────────────────────
function base64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  try {
    return atob(str);
  } catch {
    throw new Error("Invalid base64url encoding");
  }
}

function base64urlEncode(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64urlEncodeBytes(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return base64urlEncode(binary);
}

// ─── JWT decode (no verification - client-side display only) ─────────────────
function decodeJWT(token) {
  const parts = token.trim().split(".");
  if (parts.length !== 3) throw new Error("JWT must have 3 parts separated by dots");
  const header  = JSON.parse(base64urlDecode(parts[0]));
  const payload = JSON.parse(base64urlDecode(parts[1]));
  const sig     = parts[2];
  return { header, payload, signature: sig, parts };
}

// ─── HMAC-SHA256 sign (using Web Crypto API) ──────────────────────────────────
async function signHS256(headerB64, payloadB64, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const data = enc.encode(`${headerB64}.${payloadB64}`);
  const sig  = await crypto.subtle.sign("HMAC", key, data);
  return base64urlEncodeBytes(new Uint8Array(sig));
}

// ─── Timestamp formatter ──────────────────────────────────────────────────────
function fmtTimestamp(ts) {
  if (!ts || typeof ts !== "number") return null;
  try { return new Date(ts * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC"); }
  catch { return null; }
}

// ─── Expiry status ────────────────────────────────────────────────────────────
function getExpiry(payload) {
  const now = Math.floor(Date.now() / 1000);
  if (!payload?.exp) return null;
  if (now > payload.exp) return { status: "expired", label: "EXPIRED", color: "#f87171" };
  const remaining = payload.exp - now;
  if (remaining < 300) return { status: "soon", label: `Expires in ${remaining}s`, color: "#f59e0b" };
  return { status: "valid", label: "VALID", color: "#10b981" };
}

// ─── JSON editor ──────────────────────────────────────────────────────────────
function JSONEditor({ value, onChange, label, dark, color }) {
  const [text, setText] = useState(typeof value === "object" ? JSON.stringify(value, null, 2) : value);
  const [err, setErr] = useState(null);
  const bdr = dark ? "#1f2937" : "#e2e8f0";
  const bg  = dark ? "#111827" : "#f8fafc";
  const txt = dark ? "#d1d5db" : "#374151";
  const mute = dark ? "#6b7280" : "#94a3b8";

  useEffect(() => {
    const str = typeof value === "object" ? JSON.stringify(value, null, 2) : value;
    setText(str);
    setErr(null);
  }, [value]);

  const handleChange = (val) => {
    setText(val);
    try {
      const parsed = JSON.parse(val);
      setErr(null);
      onChange(parsed);
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
        <span style={{ fontSize: 10, color: mute, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
        {err && <span style={{ fontSize: 10, color: "#f87171", marginLeft: "auto" }}>⚠ Invalid JSON</span>}
      </div>
      <textarea
        value={text}
        onChange={e => handleChange(e.target.value)}
        spellCheck={false}
        style={{
          flex: 1, width: "100%", background: bg, border: `1px solid ${err ? "#7f1d1d" : bdr}`,
          borderRadius: 8, padding: 10, fontSize: 11, color: txt, fontFamily: "inherit",
          resize: "none", outline: "none", boxSizing: "border-box", lineHeight: 1.6,
        }}
      />
    </div>
  );
}

// ─── Main JWTModal ────────────────────────────────────────────────────────────
export default function JWTModal({ onClose, dark }) {
  const [mode, setMode] = useState("decode"); // "decode" | "encode"
  const [token, setToken] = useState("");
  const [decoded, setDecoded] = useState(null);
  const [decodeErr, setDecodeErr] = useState(null);

  // Encode state
  const [header, setHeader] = useState({ alg: "HS256", typ: "JWT" });
  const [payload, setPayload] = useState({
    sub: "1234567890", name: "John Doe", iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  });
  const [secret, setSecret] = useState("your-secret-key");
  const [encodedToken, setEncodedToken] = useState("");
  const [encoding, setEncoding] = useState(false);
  const [copied, setCopied] = useState(null);

  const bg   = dark ? "#030712" : "#ffffff";
  const bg2  = dark ? "#0f172a" : "#f8fafc";
  const bg3  = dark ? "#111827" : "#ffffff";
  const bdr  = dark ? "#1f2937" : "#e2e8f0";
  const txt  = dark ? "#d1d5db" : "#374151";
  const mute = dark ? "#6b7280" : "#94a3b8";

  // ESC to close
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleDecode = useCallback((val) => {
    setToken(val);
    if (!val.trim()) { setDecoded(null); setDecodeErr(null); return; }
    try {
      const result = decodeJWT(val.trim());
      setDecoded(result);
      setDecodeErr(null);
    } catch (e) {
      setDecoded(null);
      setDecodeErr(e.message);
    }
  }, []);

  const handleEncode = useCallback(async () => {
    setEncoding(true);
    try {
      const hB64 = base64urlEncode(JSON.stringify(header));
      const pB64 = base64urlEncode(JSON.stringify(payload));
      const sig   = await signHS256(hB64, pB64, secret);
      setEncodedToken(`${hB64}.${pB64}.${sig}`);
    } catch (e) {
      setEncodedToken(`Error: ${e.message}`);
    } finally {
      setEncoding(false);
    }
  }, [header, payload, secret]);

  // Auto-encode when fields change
  useEffect(() => {
    if (mode === "encode") {
      const timer = setTimeout(handleEncode, 400);
      return () => clearTimeout(timer);
    }
  }, [header, payload, secret, mode, handleEncode]);

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const expiry = decoded ? getExpiry(decoded.payload) : null;

  // Part colors
  const partColors = ["#f59e0b", "#10b981", "#f87171"];
  const partLabels = ["HEADER", "PAYLOAD", "SIGNATURE"];

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: bg, border: `1px solid ${bdr}`, borderRadius: 16,
        width: "min(1000px, 96vw)", height: "min(720px, 92vh)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
          borderBottom: `1px solid ${bdr}`, flexShrink: 0 }}>
          <span style={{ fontSize: 16 }}>🔐</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: txt }}>JWT</span>
          <span style={{ fontSize: 11, color: mute }}>JSON Web Token Encoder / Decoder</span>
          <div style={{ flex: 1 }} />
          {/* Mode toggle */}
          {["decode", "encode"].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: "5px 14px", fontSize: 11, borderRadius: 6,
              background: mode === m ? "#10b981" : "transparent",
              border: `1px solid ${mode === m ? "#10b981" : bdr}`,
              color: mode === m ? "#030712" : mute,
              cursor: "pointer", fontFamily: "inherit", fontWeight: mode === m ? 700 : 400,
            }}>{m === "decode" ? "🔍 Decode" : "✏️ Encode"}</button>
          ))}
          <button onClick={onClose} style={{ padding: "4px 9px", fontSize: 14, borderRadius: 6,
            background: "transparent", border: `1px solid ${bdr}`, color: mute, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
          {/* ── DECODE MODE ── */}
          {mode === "decode" && (
            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
              {/* Left: token input */}
              <div style={{ width: "45%", display: "flex", flexDirection: "column",
                borderRight: `1px solid ${bdr}`, padding: 14, gap: 10 }}>
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: mute, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                    Paste JWT Token
                  </div>
                  <textarea
                    value={token}
                    onChange={e => handleDecode(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    spellCheck={false}
                    style={{
                      width: "100%", height: 130, background: bg3,
                      border: `1px solid ${decodeErr ? "#7f1d1d" : bdr}`, borderRadius: 8,
                      padding: 10, fontSize: 11, color: txt, fontFamily: "inherit",
                      resize: "none", outline: "none", boxSizing: "border-box", lineHeight: 1.6,
                    }}
                  />
                  {decodeErr && <div style={{ fontSize: 11, color: "#f87171", marginTop: 5 }}>✗ {decodeErr}</div>}
                  {!token && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 10, color: mute, marginBottom: 5 }}>Try a sample:</div>
                      <button onClick={() => handleDecode("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c")}
                        style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, background: "transparent",
                          border: `1px solid ${bdr}`, color: mute, cursor: "pointer", fontFamily: "inherit" }}>
                        Load sample HS256 token
                      </button>
                    </div>
                  )}
                </div>

                {/* Colored token display */}
                {decoded && (
                  <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                    <div style={{ fontSize: 10, color: mute, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Token Parts</div>
                    <div style={{ background: bg2, border: `1px solid ${bdr}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
                      {renderColoredToken(token.trim())}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                      {partColors.map((color, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                          <span style={{ fontSize: 10, color: mute }}>{partLabels[i]}</span>
                        </div>
                      ))}
                    </div>
                    {expiry && (
                      <div style={{ background: `${expiry.color}10`, border: `1px solid ${expiry.color}40`,
                        borderRadius: 6, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: expiry.color }} />
                        <span style={{ fontSize: 11, color: expiry.color, fontWeight: 600 }}>{expiry.label}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right: decoded output */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {!decoded && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: mute, fontSize: 12 }}>
                    Paste a JWT token on the left to decode
                  </div>
                )}
                {decoded && (
                  <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Header */}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b" }} />
                        <span style={{ fontSize: 10, color: mute, letterSpacing: "0.08em", textTransform: "uppercase" }}>Header</span>
                        <button onClick={() => copyText(JSON.stringify(decoded.header, null, 2), "header")}
                          style={{ marginLeft: "auto", fontSize: 10, color: copied === "header" ? "#10b981" : mute,
                            background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                          {copied === "header" ? "✓ Copied" : "copy"}
                        </button>
                      </div>
                      <pre style={{ background: bg2, border: `1px solid ${bdr}`, borderRadius: 8,
                        padding: 10, fontSize: 11, color: "#f59e0b", margin: 0, lineHeight: 1.6,
                        whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {JSON.stringify(decoded.header, null, 2)}
                      </pre>
                    </div>

                    {/* Payload */}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981" }} />
                        <span style={{ fontSize: 10, color: mute, letterSpacing: "0.08em", textTransform: "uppercase" }}>Payload</span>
                        <button onClick={() => copyText(JSON.stringify(decoded.payload, null, 2), "payload")}
                          style={{ marginLeft: "auto", fontSize: 10, color: copied === "payload" ? "#10b981" : mute,
                            background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                          {copied === "payload" ? "✓ Copied" : "copy"}
                        </button>
                      </div>
                      <pre style={{ background: bg2, border: `1px solid ${bdr}`, borderRadius: 8,
                        padding: 10, fontSize: 11, color: "#10b981", margin: 0, lineHeight: 1.6,
                        whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {JSON.stringify(decoded.payload, null, 2)}
                      </pre>
                      {/* Claim explanations */}
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                        {decoded.payload.iat && (
                          <div style={{ fontSize: 10, color: mute }}>
                            <span style={{ color: "#10b981" }}>iat</span> → Issued: {fmtTimestamp(decoded.payload.iat)}
                          </div>
                        )}
                        {decoded.payload.exp && (
                          <div style={{ fontSize: 10, color: mute }}>
                            <span style={{ color: "#10b981" }}>exp</span> → Expires: {fmtTimestamp(decoded.payload.exp)}
                          </div>
                        )}
                        {decoded.payload.nbf && (
                          <div style={{ fontSize: 10, color: mute }}>
                            <span style={{ color: "#10b981" }}>nbf</span> → Not Before: {fmtTimestamp(decoded.payload.nbf)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Signature */}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f87171" }} />
                        <span style={{ fontSize: 10, color: mute, letterSpacing: "0.08em", textTransform: "uppercase" }}>Signature</span>
                      </div>
                      <div style={{ background: bg2, border: `1px solid ${bdr}`, borderRadius: 8, padding: 10 }}>
                        <span style={{ fontSize: 11, color: "#f87171", wordBreak: "break-all" }}>{decoded.signature}</span>
                        <div style={{ fontSize: 10, color: mute, marginTop: 6 }}>
                          ⚠ Signature verification requires the secret key. This tool only decodes the token client-side.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── ENCODE MODE ── */}
          {mode === "encode" && (
            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
              {/* Left: editors */}
              <div style={{ width: "50%", display: "flex", flexDirection: "column",
                borderRight: `1px solid ${bdr}`, padding: 14, gap: 10, overflow: "hidden" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
                  <div style={{ height: "25%", display: "flex", flexDirection: "column" }}>
                    <JSONEditor label="Header" value={header} onChange={setHeader} dark={dark} color="#f59e0b" />
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <JSONEditor label="Payload" value={payload} onChange={setPayload} dark={dark} color="#10b981" />
                  </div>
                </div>
                {/* Secret */}
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: mute, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>
                    Secret (for HMAC-SHA256)
                  </div>
                  <input
                    type="text"
                    value={secret}
                    onChange={e => setSecret(e.target.value)}
                    placeholder="your-secret-key"
                    style={{
                      width: "100%", padding: "8px 12px", borderRadius: 8,
                      background: bg3, border: `1px solid ${bdr}`, color: txt,
                      fontSize: 11, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Right: encoded output */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 14, gap: 10, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, color: mute, letterSpacing: "0.08em", textTransform: "uppercase" }}>Encoded Token</span>
                  {encoding && <span style={{ fontSize: 10, color: mute }}>signing...</span>}
                  {encodedToken && !encoding && <span style={{ fontSize: 10, color: "#10b981" }}>✓ Signed</span>}
                  {encodedToken && (
                    <button onClick={() => copyText(encodedToken, "encoded")}
                      style={{ marginLeft: "auto", fontSize: 10, padding: "3px 10px", borderRadius: 5,
                        background: "transparent", border: `1px solid ${copied === "encoded" ? "#10b981" : bdr}`,
                        color: copied === "encoded" ? "#10b981" : mute, cursor: "pointer", fontFamily: "inherit" }}>
                      {copied === "encoded" ? "✓ Copied" : "Copy Token"}
                    </button>
                  )}
                </div>
                <div style={{ background: bg2, border: `1px solid ${bdr}`, borderRadius: 8, padding: 12, flex: 1, overflowY: "auto" }}>
                  {encodedToken ? renderColoredToken(encodedToken) :
                    <span style={{ color: mute, fontSize: 11 }}>Token will appear here...</span>}
                </div>

                {/* Legend */}
                <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                  {[["#f59e0b", "Header"], ["#10b981", "Payload"], ["#f87171", "Signature"]].map(([color, label]) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
                      <span style={{ fontSize: 10, color: mute }}>{label}</span>
                    </div>
                  ))}
                </div>

                {/* Quick presets */}
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: mute, marginBottom: 5 }}>Quick presets:</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {[
                      { label: "Access Token", payload: { sub: "usr_123", role: "user", iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+900 } },
                      { label: "Refresh Token", payload: { sub: "usr_123", type: "refresh", iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+2592000 } },
                      { label: "API Key", payload: { client_id: "app_456", scopes: ["read", "write"], iat: Math.floor(Date.now()/1000) } },
                    ].map(preset => (
                      <button key={preset.label} onClick={() => setPayload(preset.payload)}
                        style={{ fontSize: 10, padding: "3px 9px", borderRadius: 5, background: "transparent",
                          border: `1px solid ${bdr}`, color: mute, cursor: "pointer", fontFamily: "inherit" }}>
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

function renderColoredToken(tok) {
 const parts = tok.split(".");
      if (parts.length !== 3) return <span style={{ color: txt, wordBreak: "break-all", fontSize: 12 }}>{tok}</span>;
     return (
           <span style={{ wordBreak: "break-all", fontSize: 12, lineHeight: 1.8, fontFamily: "monospace" }}>
        {parts.map((p, i) => (
           <span key={i} style={{ color: partColors[i] }}>
             {i > 0 && <span style={{ color: mute }}>.</span>}
             {p}
           </span>
         ))}
 </span>
 );
}
}