export default function Toolbar({ onFormat, onMinify, onCopy, onClear, copyLabel, hasParsed }) {
  const btn = "px-4 py-1.5 text-xs rounded border transition-all duration-150 font-mono tracking-wide";
  const active = `${btn} border-emerald-800 text-emerald-400 bg-emerald-950 hover:bg-emerald-900 hover:border-emerald-600`;
  const muted = `${btn} border-gray-800 text-gray-500 bg-gray-900 cursor-not-allowed opacity-40`;
  const normal = `${btn} border-gray-700 text-gray-300 bg-gray-900 hover:border-gray-500 hover:text-white`;
  const danger = `${btn} border-gray-800 text-gray-500 bg-gray-900 hover:border-red-800 hover:text-red-400`;

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-950 flex-wrap">
      <button onClick={onFormat} disabled={!hasParsed} className={hasParsed ? active : muted}>
        ⌥ Format
      </button>
      <button onClick={onMinify} disabled={!hasParsed} className={hasParsed ? normal : muted}>
        ⊟ Minify
      </button>
      <div className="w-px h-4 bg-gray-800 mx-1" />
      <button onClick={onCopy} disabled={!hasParsed} className={hasParsed ? normal : muted}>
        {copyLabel === "Copied!" ? "✓ Copied!" : "⎘ Copy"}
      </button>
      <div className="w-px h-4 bg-gray-800 mx-1" />
      <button onClick={onClear} className={danger}>
        ✕ Clear
      </button>
    </div>
  );
}