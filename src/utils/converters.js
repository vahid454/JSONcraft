import yaml from "js-yaml";
import Papa from "papaparse";

// ── JSON → YAML ────────────────────────────────────────────
// Remove XML-specific metadata keys before conversion
function cleanXMLMeta(data) {
  if (Array.isArray(data)) return data.map(cleanXMLMeta);
  if (data && typeof data === "object") {
    const cleaned = {};
    for (const [k, v] of Object.entries(data)) {
      if (k.startsWith("@") || k === "#text") continue;
      cleaned[k] = cleanXMLMeta(v);
    }
    return cleaned;
  }
  return data;
}

export function jsonToYAML(data) {
  try {
    return yaml.dump(cleanXMLMeta(data), {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
      quotingType: '"',
      forceQuotes: false,
    });
  } catch(e) { return `Error: ${e.message}`; }
}

// ── YAML → JSON ────────────────────────────────────────────
export function yamlToJSON(str) {
  try {
    const result = yaml.load(str, { json: true });
    if (result === null || result === undefined) return `Error: Empty YAML`;
    return JSON.stringify(result, null, 2);
  } catch(e) { return `Error: ${e.message}`; }
}

// ── JSON → XML ─────────────────────────────────────────────
function xmlEscape(val) {
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sanitizeTag(tag) {
  let t = String(tag).replace(/[^a-zA-Z0-9_\-\.]/g, "_");
  if (/^[^a-zA-Z_]/.test(t)) t = "_" + t;
  return t || "_item";
}

// Derive singular child tag: features->feature, users->user, items->item
function singularize(tag) {
  if (tag.endsWith("ies")) return tag.slice(0, -3) + "y";
  if (tag.endsWith("ses") || tag.endsWith("xes") || tag.endsWith("zes")) return tag.slice(0, -2);
  if (tag.endsWith("s") && tag.length > 2) return tag.slice(0, -1);
  return "item";
}

function valueToXML(val, tag, depth) {
  const pad  = "  ".repeat(depth);
  const pad1 = "  ".repeat(depth + 1);
  const t    = sanitizeTag(tag);

  if (val === null || val === undefined) {
    return `${pad}<${t} nil="true"/>`;
  }

  if (typeof val !== "object") {
    return `${pad}<${t}>${xmlEscape(val)}</${t}>`;
  }

  if (Array.isArray(val)) {
    if (val.length === 0) return `${pad}<${t}/>`;
    const childTag = sanitizeTag(singularize(t));
    const items = val.map(item => {
      if (item === null || item === undefined) return `${pad1}<${childTag} nil="true"/>`;
      if (typeof item !== "object") return `${pad1}<${childTag}>${xmlEscape(item)}</${childTag}>`;
      const inner = Object.entries(item)
        .map(([k, v]) => valueToXML(v, k, depth + 2))
        .join("\n");
      return `${pad1}<${childTag}>\n${inner}\n${pad1}</${childTag}>`;
    }).join("\n");
    return `${pad}<${t}>\n${items}\n${pad}</${t}>`;
  }

  if (Object.keys(val).length === 0) return `${pad}<${t}/>`;
  const inner = Object.entries(val)
    .map(([k, v]) => valueToXML(v, k, depth + 1))
    .join("\n");
  return `${pad}<${t}>\n${inner}\n${pad}</${t}>`;
}

export function jsonToXML(data, root = "root") {
  try {
    return `<?xml version="1.0" encoding="UTF-8"?>\n${valueToXML(data, root, 0)}`;
  } catch(e) { return `Error: ${e.message}`; }
}

// ── XML → JSON ─────────────────────────────────────────────
function coerce(str) {
  if (str === "true")  return true;
  if (str === "false") return false;
  if (str === "null" || str === "") return null;
  const n = Number(str);
  if (!isNaN(n) && str.trim() !== "") return n;
  return str;
}

export function xmlToJSON(str) {
  try {
    const doc = new DOMParser().parseFromString(str, "text/xml");
    const err = doc.querySelector("parsererror");
    if (err) return `Error: ${err.textContent.trim().slice(0, 120)}`;

    function nodeToValue(node) {
      if (node.nodeType === 3) return node.nodeValue;

      const obj = {};
      const attrs = Array.from(node.attributes || []);

      // Handle nil attribute
      const nilAttr = attrs.find(a => a.name === "nil" || a.name === "xsi:nil");
      if (nilAttr && nilAttr.value === "true") return null;

      // Add non-nil attributes
      for (const attr of attrs) {
        if (attr.name !== "nil" && attr.name !== "xsi:nil") {
          obj[`@${attr.name}`] = attr.value;
        }
      }

      const children = Array.from(node.childNodes).filter(n =>
        !(n.nodeType === 3 && !n.nodeValue.trim())
      );

      if (children.length === 0) {
        const text = node.textContent.trim();
        if (Object.keys(obj).length === 0) return text === "" ? null : coerce(text);
        if (text) obj["#text"] = coerce(text);
        return obj;
      }

      if (children.length === 1 && children[0].nodeType === 3) {
        const text = children[0].nodeValue.trim();
        if (Object.keys(obj).length === 0) return coerce(text);
        obj["#text"] = coerce(text);
        return obj;
      }

      for (const child of children) {
        if (child.nodeType === 3) continue;
        const key = child.nodeName;
        const val = nodeToValue(child);
        if (obj[key] !== undefined) {
          if (!Array.isArray(obj[key])) obj[key] = [obj[key]];
          obj[key].push(val);
        } else {
          obj[key] = val;
        }
      }
      // If object has exactly one key and all element children share that tag = JSON array
      const oKeys = Object.keys(obj);
      if (oKeys.length === 1) {
        const onlyKey = oKeys[0];
        const elemChildren = Array.from(node.childNodes).filter(n => n.nodeType === 1);
        const allSameTag = elemChildren.length > 1 && elemChildren.every(n => n.nodeName === onlyKey);
        if (allSameTag || onlyKey === "item") {
          return Array.isArray(obj[onlyKey]) ? obj[onlyKey] : [obj[onlyKey]];
        }
      }
      return obj;
    }

    return JSON.stringify(nodeToValue(doc.documentElement), null, 2);
  } catch(e) { return `Error: ${e.message}`; }
}

// ── JSON → CSV ─────────────────────────────────────────────
function flattenObject(obj, prefix = "") {
  const result = {};
  for (const [key, val] of Object.entries(obj || {})) {
    // Skip XML metadata — attributes (@xmlns, @xsi) and text nodes (#text)
    if (key.startsWith("@") || key === "#text") continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (val === null || val === undefined) {
      result[path] = "";
    } else if (Array.isArray(val)) {
      if (val.length === 0) {
        result[path] = "";
      } else if (typeof val[0] === "object" && val[0] !== null) {
        val.forEach((item, i) => Object.assign(result, flattenObject(item, `${path}[${i}]`)));
      } else {
        result[path] = val.join(" | ");
      }
    } else if (typeof val === "object") {
      Object.assign(result, flattenObject(val, path));
    } else {
      result[path] = val;
    }
  }
  return result;
}

export function jsonToCSV(data) {
  try {
    const arr = Array.isArray(data) ? data : [data];
    if (arr.length === 0) return "Error: Empty array";

    const flattened = arr.map(item => {
      if (item === null || item === undefined) return { value: "" };
      if (typeof item !== "object") return { value: item };
      return flattenObject(item);
    });

    const allKeys = [...new Set(flattened.flatMap(row => Object.keys(row)))];
    const header  = allKeys.map(k => `"${k.replace(/"/g, '""')}"`).join(",");
    const rows    = flattened.map(row =>
      allKeys.map(k => {
        const v = row[k] ?? "";
        const s = String(v);
        if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      }).join(",")
    );
    return [header, ...rows].join("\n");
  } catch(e) { return `Error: ${e.message}`; }
}

// ── CSV → JSON ─────────────────────────────────────────────
export function csvToJSON(str) {
  try {
    if (!str.trim()) return `Error: Empty CSV`;
    const result = Papa.parse(str.trim(), {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      transformHeader: h => h.trim(),
    });
    if (result.errors.length && !result.data.length) {
      return `Error: ${result.errors[0].message}`;
    }
    // Restore pipe-joined arrays and clean nulls
    const cleaned = result.data.map(row => {
      const obj = {};
      for (const [k, v] of Object.entries(row)) {
        if (v === "" || v === null || v === undefined) {
          obj[k] = null;
        } else if (typeof v === "string" && v.includes(" | ")) {
          // Pipe-separated = was originally an array — restore it
          obj[k] = v.split(" | ").map(item => {
            const t = item.trim();
            if (t === "true")  return true;
            if (t === "false") return false;
            if (t === "null")  return null;
            const n = Number(t);
            return (!isNaN(n) && t !== "") ? n : t;
          });
        } else {
          obj[k] = v;
        }
      }
      return obj;
    });
    return JSON.stringify(cleaned, null, 2);
  } catch(e) { return `Error: ${e.message}`; }
}