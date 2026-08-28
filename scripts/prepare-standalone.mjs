import fs from "node:fs";
import path from "node:path";

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

const standalone = path.join(".next", "standalone");
if (!fs.existsSync(standalone)) {
  console.warn("No standalone output; skip copy.");
  process.exit(0);
}
copyDir(path.join(".next", "static"), path.join(standalone, ".next", "static"));
copyDir("public", path.join(standalone, "public"));
console.log("Standalone ready.");
