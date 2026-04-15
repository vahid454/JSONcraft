import { useRef, useCallback } from "react";

// Fixed drag & drop — reads file as UTF-8 text properly
async function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsText(file, "UTF-8"); // explicit encoding fixes corruption
  });
}

export default function Editor({ value, onChange, dark, error, language }) {
  const textareaRef = useRef(null);

  const bg  = dark ? "#080f1e" : "#ffffff";
  const txt = dark ? "#e2e8f0" : "#1a2535";
  const ph  = dark ? "#2d3f55" : "#94a3b8";

  const borderColor = error
    ? "rgba(248,113,113,0.5)"
    : dark ? "#1a2540" : "#e2e8f0";

  // Fix: handle drag & drop with proper file reading
  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      onChange(text);
    } catch (err) {
      console.error("Drop read error:", err);
    }
  }, [onChange]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Smart tab key support
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end   = ta.selectionEnd;
      const newVal = value.slice(0, start) + "  " + value.slice(end);
      onChange(newVal);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  }, [value, onChange]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        placeholder={`Paste ${language === "xml" ? "XML" : "JSON, XML, CSV or YAML"} here…\nor drag & drop any file`}
        style={{
          width: "100%",
          height: "100%",
          resize: "none",
          border: `1px solid ${borderColor}`,
          outline: "none",
          padding: "14px 16px",
          background: bg,
          color: txt,
          fontSize: 13,
          lineHeight: 1.75,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
          boxSizing: "border-box",
          display: "block",
          overflowY: "auto",
          whiteSpace: "pre",
          overflowWrap: "normal",
          tabSize: 2,
          caretColor: "#10b981",
          transition: "border-color 0.2s, background 0.2s",
        }}
      />
      {/* Error glow */}
      {error && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          boxShadow: "inset 0 0 0 1px rgba(248,113,113,0.4)",
          borderRadius: 0,
        }} />
      )}
    </div>
  );
}