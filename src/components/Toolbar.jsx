export default function Toolbar({ onFormat, onMinify, onCopy, onClear, copyLabel, hasParsed }) {
  const base = "px-3 py-1.5 text-xs rounded-md border transition-all duration-150 tracking-wide flex items-center gap-1.5";
  const on   = `${base} border-emerald-800 text-emerald-400 bg-emerald-950/60 hover:bg-emerald-900/60 hover:border-emerald-600`;
  const off  = `${base} border-gray-800 text-gray-600 bg-gray-900/50 cursor-not-allowed`;
  const norm = `${base} border-gray-700 text-gray-400 bg-gray-900 hover:border-gray-500 hover:text-white`;
  const del  = `${base} border-gray-800 text-gray-600 bg-gray-900 hover:border-red-800 hover:text-red-400`;

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-950/80 flex-wrap shrink-0">
      <button onClick={onFormat} disabled={!hasParsed} className={hasParsed ? on : off}>
        ⌥ Format
      </button>
      <button onClick={onMinify} disabled={!hasParsed} className={hasParsed ? norm : off}>
        ⊟ Minify
      </button>
      <div className="w-px h-4 bg-gray-800 mx-1" />
      <button onClick={onCopy} disabled={!hasParsed} className={hasParsed ? norm : off}>
        {copyLabel === "Copied!" ? "✓ Copied!" : "⎘ Copy"}
      </button>
      <div className="w-px h-4 bg-gray-800 mx-1" />
      <button onClick={onClear} className={del}>
        ✕ Clear
      </button>
      <div className="ml-auto text-xs text-gray-700 hidden sm:block">
        JSONcraft · format · validate · convert · search
      </div>
    </div>
  );
}