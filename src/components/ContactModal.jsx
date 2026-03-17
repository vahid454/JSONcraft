import { useState } from "react";

export default function ContactModal({ onClose, dark }) {
  const [form, setForm]     = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState(null); // null | "sending" | "sent" | "error"

  const s = (prop) => ({ ...inputStyle(dark), ...(prop || {}) });

  const send = async () => {
    if (!form.name || !form.email || !form.message) {
      setStatus("empty"); return;
    }
    setStatus("sending");
    try {
      await fetch(`https://formsubmit.co/ajax/vahidmansuri702@gmail.com`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: form.name, email: form.email, message: form.message,
          _subject: `JSONcraft message from ${form.name}`,
        }),
      });
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: dark ? "#0f172a" : "#ffffff",
        border: `1px solid ${dark ? "#1e293b" : "#e2e8f0"}`,
        borderRadius: 20, padding: 32, maxWidth: 420, width: "100%",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: dark ? "#fff" : "#0f172a" }}>Get in touch</div>
            <div style={{ fontSize: 12, color: dark ? "#64748b" : "#94a3b8", marginTop: 2 }}>We reply within 24 hours</div>
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: dark ? "#475569" : "#94a3b8", fontSize: 18, fontFamily: "inherit",
          }}>✕</button>
        </div>

        {status === "sent" ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#10b981", marginBottom: 6 }}>Message sent!</div>
            <div style={{ fontSize: 13, color: dark ? "#64748b" : "#94a3b8" }}>We'll get back to you at {form.email}</div>
            <button onClick={onClose} style={{
              marginTop: 20, padding: "8px 24px", background: "#10b981", color: "#030712",
              border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13,
            }}>Close</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle(dark)}>Your name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Your name" style={s()} />
            </div>
            <div>
              <label style={labelStyle(dark)}>Email address</label>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com" type="email" style={s()} />
            </div>
            <div>
              <label style={labelStyle(dark)}>Message</label>
              <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
                placeholder="Your feedback, bug report, or just a hello..." rows={4}
                style={{ ...s(), resize: "vertical", lineHeight: 1.6 }} />
            </div>
            {status === "empty" && (
              <div style={{ fontSize: 12, color: "#f87171" }}>Please fill in all fields.</div>
            )}
            {status === "error" && (
              <div style={{ fontSize: 12, color: "#f87171" }}>Something went wrong. Please try again.</div>
            )}
            <button onClick={send} disabled={status === "sending"} style={{
              background: "#10b981", color: "#030712", border: "none", borderRadius: 10,
              padding: "12px 0", fontWeight: 700, fontSize: 14, cursor: "pointer",
              fontFamily: "inherit", opacity: status === "sending" ? 0.7 : 1,
            }}>
              {status === "sending" ? "Sending..." : "Send message"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = (dark) => ({
  width: "100%", padding: "10px 12px", borderRadius: 8, fontFamily: "inherit",
  fontSize: 13, outline: "none", boxSizing: "border-box",
  background: dark ? "#1e293b" : "#f8fafc",
  border: `1px solid ${dark ? "#334155" : "#e2e8f0"}`,
  color: dark ? "#e2e8f0" : "#0f172a",
});

const labelStyle = (dark) => ({
  display: "block", fontSize: 11, fontWeight: 600, marginBottom: 5,
  color: dark ? "#64748b" : "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase",
});