import { useState, useCallback } from "react";
import Editor from "./components/Editor";
import TreeView from "./components/TreeView";
import Toolbar from "./components/Toolbar";
import StatusBar from "./components/StatusBar";

export default function App() {
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState(null);
  const [dark, setDark] = useState(true);
  const [activeTab, setActiveTab] = useState("tree");
  const [copyLabel, setCopyLabel] = useState("Copy");

  const tryParse = useCallback((val) => {
    setInput(val);
    if (!val.trim()) { setParsed(null); setError(null); return; }
    try {
      setParsed(JSON.parse(val));
      setError(null);
    } catch (e) {
      setParsed(null);
      setError(e.message);
    }
  }, []);

  const format = () => {
    if (!parsed) return;
    setInput(JSON.stringify(parsed, null, 2));
  };

  const minify = () => {
    if (!parsed) return;
    setInput(JSON.stringify(parsed));
  };

  const copy = () => {
    navigator.clipboard.writeText(input).then(() => {
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy"), 2000);
    });
  };

  const clear = () => { setInput(""); setParsed(null); setError(null); };

  const loadSample = () => {
    const sample = JSON.stringify({
      name: "JSONcraft",
      version: "1.0.0",
      features: ["format", "minify", "tree view", "dark mode"],
      author: { name: "You", role: "developer" },
      meta: { stars: 42, active: true }
    }, null, 2);
    tryParse(sample);
  };

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-mono" style={{fontFamily:"'JetBrains Mono', 'Fira Code', monospace"}}>

        <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between bg-gray-950">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-emerald-500 flex items-center justify-center text-gray-950 font-bold text-sm">J</div>
            <span className="text-white font-semibold tracking-tight text-lg" style={{fontFamily:"'JetBrains Mono', monospace"}}>JSONcraft</span>
            <span className="text-xs text-gray-500 bg-gray-900 px-2 py-0.5 rounded-full border border-gray-800">v1.0</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadSample} className="text-xs text-gray-400 hover:text-emerald-400 transition-colors px-3 py-1.5 rounded border border-gray-800 hover:border-emerald-800 bg-gray-900">
              Load sample
            </button>
            <button onClick={() => setDark(!dark)} className="text-xs text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded border border-gray-800 bg-gray-900">
              {dark ? "☀ Light" : "☾ Dark"}
            </button>
          </div>
        </header>

        <Toolbar onFormat={format} onMinify={minify} onCopy={copy} onClear={clear} copyLabel={copyLabel} hasParsed={!!parsed} />

        <div className="flex flex-1 overflow-hidden" style={{height:"calc(100vh - 110px)"}}>
          <div className="flex-1 flex flex-col border-r border-gray-800 min-w-0">
            <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-800 bg-gray-950 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              INPUT
            </div>
            <div className="flex-1 overflow-hidden">
              <Editor value={input} onChange={tryParse} dark={dark} error={!!error} />
            </div>
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-800 bg-gray-950 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {["tree", "raw"].map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`uppercase text-xs tracking-wider transition-colors ${activeTab === tab ? "text-emerald-400" : "text-gray-500 hover:text-gray-300"}`}>
                    {tab}
                  </button>
                ))}
              </div>
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
            </div>
            <div className="flex-1 overflow-auto bg-gray-950 p-4">
              {error && (
                <div className="flex items-start gap-3 bg-red-950 border border-red-800 rounded-lg p-4 text-sm text-red-300">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <div>
                    <div className="font-semibold text-red-200 mb-1">Invalid JSON</div>
                    <div className="text-xs font-mono opacity-80">{error}</div>
                  </div>
                </div>
              )}
              {!input && !error && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3 opacity-30">
                  <div className="text-4xl">{ }</div>
                  <div className="text-sm text-gray-400">Paste JSON on the left to get started</div>
                </div>
              )}
              {parsed && activeTab === "tree" && <TreeView data={parsed} />}
              {parsed && activeTab === "raw" && (
                <pre className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
                  {JSON.stringify(parsed, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>

        <StatusBar input={input} parsed={parsed} error={error} />
      </div>
    </div>
  );
}