#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const dest = process.argv[2] || path.join(os.homedir(), "VeilStudio");
const port = process.env.PORT || "3000";

for (const dir of ["inbox", "inbox/processed", "outbox", "library", "app"]) {
  fs.mkdirSync(path.join(dest, dir), { recursive: true });
}

const readme = fs.readFileSync(path.join(repo, "scripts/README-FOR-AI.md"), "utf8");
fs.writeFileSync(path.join(dest, "README-FOR-AI.md"), readme);
fs.writeFileSync(
  path.join(dest, "START_HERE.txt"),
  `Veil Studio drop
================
Copy this whole folder into Google Drive and keep the name VeilStudio.

Then, on your computer (Drive Desktop syncs it):
  1. From the app checkout: npm install && npm run launch
     or double-click app/Launch-VeilStudio.bat (Windows) / Launch-VeilStudio.sh
  2. Ask Gemini in Drive to drop a JSON file in inbox/, e.g.

     { "theme": "feminizing into everyday womanhood", "renderAudio": true }

  3. The running app fills outbox/. Drive syncs that back for the AI.

Google Drive does not run .exe files in the cloud. The app runs locally;
this folder is the shared inbox/outbox.
`,
);

fs.copyFileSync(
  path.join(repo, "scripts/windows/Launch-VeilStudio.bat"),
  path.join(dest, "app", "Launch-VeilStudio.bat"),
);
fs.copyFileSync(
  path.join(repo, "scripts/Launch-VeilStudio.sh"),
  path.join(dest, "app", "Launch-VeilStudio.sh"),
);

const request = {
  theme: "feminizing into everyday womanhood",
  recipeId: "auto",
  durationSec: 180,
  renderAudio: false,
};
fs.writeFileSync(
  path.join(dest, "inbox", "make-feminizing.json"),
  JSON.stringify(request, null, 2) + "\n",
);

const res = await fetch(`http://127.0.0.1:${port}/api/v1/inbox`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ scan: true, folder: dest }),
});
const json = await res.json();
console.log(JSON.stringify({ dest, scan: json }, null, 2));
