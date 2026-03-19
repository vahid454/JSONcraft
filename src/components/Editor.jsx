// Replaced Monaco with a lightweight textarea
// Monaco was causing black screen on load and language switches
export default function Editor({ value, onChange, dark, error, language }) {
  const bg     = dark ? "#030712" : "#ffffff";
  const txt    = dark ? "#e2e8f0" : "#1e293b";
  const border = error
    ? "1px solid #7f1d1d"
    : `1px solid ${dark ? "#1f2937" : "#e2e8f0"}`;

  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      spellCheck={false}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      placeholder={`Paste ${language === "xml" ? "XML" : "JSON, XML, CSV or YAML"} here...`}
      style={{
        width: "100%",
        height: "100%",
        resize: "none",
        border: "none",
        outline: "none",
        padding: "14px 16px",
        background: bg,
        color: txt,
        fontSize: 12,
        lineHeight: 1.7,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
        boxSizing: "border-box",
        display: "block",
        overflowY: "auto",
        whiteSpace: "pre",
        overflowWrap: "normal",
        tabSize: 2,
      }}
    />
  );
}