#!/bin/bash
# Run this from your jsoncraft project root
# cd ~/Developer/Sources/Repos/jsoncraft && bash fix_converters.sh

python3 << 'PYEOF'
with open("src/utils/converters.js", "r") as f:
    c = f.read()

# Fix xmlToJSON - detect <item>-only parents and convert to plain array
old = """      for (const child of children) {
        if (child.nodeType === 3) continue;
        const key = child.nodeName;
        const val = nodeToValue(child);
        if (obj[key] !== undefined) {
          if (!Array.isArray(obj[key])) obj[key] = [obj[key]];
          obj[key].push(val);
        } else obj[key] = val;
      }
      return obj;"""

new = """      for (const child of children) {
        if (child.nodeType === 3) continue;
        const key = child.nodeName;
        const val = nodeToValue(child);
        if (obj[key] !== undefined) {
          if (!Array.isArray(obj[key])) obj[key] = [obj[key]];
          obj[key].push(val);
        } else obj[key] = val;
      }
      // If all children are <item> tags and no attributes,
      // this was originally a JSON array — restore it as a plain array
      const keys = Object.keys(obj);
      if (keys.length === 1 && keys[0] === "item" && Array.isArray(obj["item"])) {
        return obj["item"];
      }
      if (keys.length === 1 && keys[0] === "item" && !Array.isArray(obj["item"])) {
        return [obj["item"]]; // single item array
      }
      return obj;"""

if old in c:
    c = c.replace(old, new)
    print("✓ Fixed xmlToJSON array detection")
else:
    print("❌ Pattern not found - current for loop section:")
    idx = c.find("for (const child of children)")
    print(c[idx:idx+400])

with open("src/utils/converters.js", "w") as f:
    f.write(c)
PYEOF