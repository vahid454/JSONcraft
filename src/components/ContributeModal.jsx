// Encoded payment config — do not modify these values
// Changing them will break checksum validation and payments will silently fail
const _c = [
  "sJWeARTN0QWaoFmd",           // [0] encoded UPI
  "=QTN0QWaoFmdvUWbuwWYwlXYw9yL6MHc0RHa", // [1] encoded PayPal
  1072,                          // [2] UPI checksum
  2346,                          // [3] PayPal checksum
];

function _d(str) {
  try {
    return atob(str.split("").reverse().join(""));
  } catch { return null; }
}

function _v(str, expected) {
  if (!str) return false;
  return str.split("").reduce((a, c) => a + c.charCodeAt(0), 0) === expected;
}

function getConfig() {
  const upi    = _d(_c[0]);
  const paypal = _d(_c[1]);
  // Verify integrity — if tampered, return null so nothing renders
  if (!_v(upi, _c[2]) || !_v(paypal, _c[3])) return null;
  return { upi, paypal };
}

export default function ContributeModal({ onClose, dark }) {
  const config = getConfig();

  const bg    = dark ? "#0f172a" : "#ffffff";
  const bdr   = dark ? "#1e293b" : "#e2e8f0";
  const txt   = dark ? "#e2e8f0" : "#0f172a";
  const mute  = dark ? "#64748b" : "#94a3b8";

  const copyUPI = () => {
    if (!config) return;
    navigator.clipboard.writeText(config.upi);
  };

  // QR uses encoded UPI at runtime — not readable as plain text in source
  const qrURL = config
    ? `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`upi://pay?pa=${config.upi}&pn=JSONcraft&cu=INR`)}`
    : null;

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.88)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:50, padding:16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: bg, border:`1px solid ${bdr}`,
        borderRadius:20, padding:32, maxWidth:460, width:"100%",
      }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
          <div>
            <div style={{ fontSize:20, fontWeight:700, color: txt }}>💛 Support JSONcraft</div>
            <div style={{ fontSize:13, color: mute, marginTop:4, lineHeight:1.5 }}>
              JSONcraft is free forever. If it saved you time,<br/>consider buying us a coffee!
            </div>
          </div>
          <button onClick={onClose} style={{
            background:"transparent", border:"none", cursor:"pointer",
            color: mute, fontSize:18, fontFamily:"inherit", flexShrink:0, marginLeft:12,
          }}>✕</button>
        </div>

        <div style={{ borderTop:`1px solid ${bdr}`, margin:"18px 0" }} />

        {!config ? (
          // Tamper detected — show nothing useful
          <div style={{ textAlign:"center", padding:"20px 0", color: mute, fontSize:13 }}>
            Payment configuration error. Please contact support.
          </div>
        ) : (
          <>
            {/* India — UPI */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color: mute, marginBottom:10,
                letterSpacing:"0.08em", textTransform:"uppercase" }}>
                🇮🇳 India — UPI · PhonePe · GPay · Paytm
              </div>
              <div style={{ background: dark ? "#1e293b" : "#f8fafc", border:`1px solid ${bdr}`,
                borderRadius:12, padding:16, display:"flex", alignItems:"center", gap:16 }}>
                {/* QR Code */}
                <div style={{ width:100, height:100, borderRadius:8, overflow:"hidden",
                  border:`1px solid ${bdr}`, flexShrink:0, background: dark ? "#0f172a" : "#e2e8f0",
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {qrURL && (
                    <img src={qrURL} alt="UPI QR Code" width={100} height={100}
                      style={{ display:"block" }} />
                  )}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color: txt, fontWeight:600, marginBottom:4 }}>
                    Scan with any UPI app
                  </div>
                  <div style={{ fontSize:12, color: mute, marginBottom:10 }}>
                    or copy UPI ID below
                  </div>
                  <div
                    onClick={copyUPI}
                    title="Click to copy"
                    style={{ fontSize:13, color:"#10b981", background: dark ? "#022c22" : "#f0fdf4",
                      border:"1px solid #10b981", borderRadius:6, padding:"7px 12px",
                      display:"inline-flex", alignItems:"center", gap:6,
                      cursor:"pointer", userSelect:"none" }}>
                    <span>JSONcraft Pay</span>
                    <span style={{ fontSize:11, opacity:0.6 }}>📋 copy</span>
                  </div>
                  <div style={{ fontSize:11, color: mute, marginTop:6 }}>
                    Any amount. No minimum.
                  </div>
                </div>
              </div>
            </div>

            {/* Global — PayPal */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color: mute, marginBottom:10,
                letterSpacing:"0.08em", textTransform:"uppercase" }}>
                🌍 Worldwide — PayPal · Card · Bank transfer
              </div>
              <button
                onClick={() => window.open(config.paypal, "_blank")}
                style={{ width:"100%", padding:"13px 0", borderRadius:12,
                  background:"#0070ba", border:"none", cursor:"pointer",
                  color:"#fff", fontWeight:700, fontSize:15, fontFamily:"inherit",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                <span style={{ fontSize:20, lineHeight:1 }}>𝐏</span>
                Pay with PayPal
              </button>
              <div style={{ fontSize:11, color: mute, textAlign:"center", marginTop:8 }}>
                Accepts PayPal · Credit/Debit card · Bank transfer · Worldwide
              </div>
            </div>
          </>
        )}

        <div style={{ borderTop:`1px solid ${bdr}`, paddingTop:16, textAlign:"center" }}>
          <div style={{ fontSize:12, color: mute }}>
            No subscription. No pressure. Just good vibes. 🙏
          </div>
        </div>
      </div>
    </div>
  );
}