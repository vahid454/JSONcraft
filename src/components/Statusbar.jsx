export default function StatusBar({ input, parsed, error }) {
  const size = new Blob([input]).size;
  const fmt = size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`;

  const countKeys = (obj) => {
    if (!obj || typeof obj !== "object") return 0;
    let count = Object.keys(obj).length;
    Object.values(obj).forEach(v => { count += countKeys(v); });
    return count;
  };

  return (
    <div className="flex items-center gap-4 px-4 py-1.5 border-t border-gray-800 bg-gray-950 text-xs text-gray-600 font-mono">
      {error ? (
        <span className="text-red-500">✗ Invalid JSON</span>
      ) : parsed ? (
        <span className="text-emerald-600">✓ Valid JSON</span>
      ) : (
        <span>Ready</span>
      )}
      <div className="w-px h-3 bg-gray-800" />
      <span>{fmt}</span>
      {parsed && (
        <>
          <div className="w-px h-3 bg-gray-800" />
          <span>{countKeys(parsed)} keys</span>
          {Array.isArray(parsed) && (
            <><div className="w-px h-3 bg-gray-800" /><span>{parsed.length} items</span></>
          )}
        </>
      )}
      <div className="flex-1" />
      <span>JSONcraft © 2025</span>
    </div>
  );
}