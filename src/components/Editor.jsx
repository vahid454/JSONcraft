import MonacoEditor from "@monaco-editor/react";

export default function Editor({ value, onChange, dark, error }) {
  return (
    <MonacoEditor
      height="100%"
      defaultLanguage="json"
      value={value}
      onChange={(val) => onChange(val || "")}
      theme={dark ? "vs-dark" : "light"}
      options={{
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        lineNumbers: "on",
        renderLineHighlight: "line",
        cursorBlinking: "smooth",
        smoothScrolling: true,
        padding: { top: 16, bottom: 16 },
        scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        glyphMargin: false,
        folding: true,
        lineDecorationsWidth: 8,
        contextmenu: false,
      }}
    />
  );
}