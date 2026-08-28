#!/usr/bin/env node
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.PORT || "3000";

function findDrive() {
  if (process.env.VEIL_DRIVE_FOLDER) return process.env.VEIL_DRIVE_FOLDER;
  const guesses = [
    path.join(homedir(), "Google Drive", "VeilStudio"),
    path.join(homedir(), "GoogleDrive", "VeilStudio"),
    path.join(homedir(), "My Drive", "VeilStudio"),
    path.join(homedir(), "VeilStudio"),
  ];
  for (const g of guesses) {
    if (fs.existsSync(path.dirname(g)) || fs.existsSync(g)) return g;
  }
  return path.join(homedir(), "VeilStudio");
}

async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error("Veil Studio did not start on port " + PORT);
}

const drive = findDrive();
process.env.VEIL_DRIVE_FOLDER = drive;
fs.mkdirSync(path.join(drive, "inbox"), { recursive: true });
fs.mkdirSync(path.join(drive, "outbox"), { recursive: true });

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const hasBuild = fs.existsSync(path.join(root, ".next"));
const args = hasBuild ? ["start", "-p", PORT, "-H", "127.0.0.1"] : ["dev", "-p", PORT];

const child = spawn(process.execPath, [nextBin, ...args], {
  cwd: root,
  env: { ...process.env, VEIL_DRIVE_FOLDER: drive },
  stdio: "inherit",
});

await waitForServer();

const openCmd =
  process.platform === "win32"
    ? ["cmd", ["/c", "start", "", `http://127.0.0.1:${PORT}`]]
    : process.platform === "darwin"
      ? ["open", [`http://127.0.0.1:${PORT}`]]
      : ["xdg-open", [`http://127.0.0.1:${PORT}`]];
const opener = spawn(openCmd[0], openCmd[1], { stdio: "ignore", detached: true });
opener.unref?.();

async function drain() {
  try {
    await fetch(`http://127.0.0.1:${PORT}/api/v1/inbox`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scan: true, folder: drive }),
    });
  } catch {
    /* warming */
  }
}

setInterval(() => void drain(), 4000);
void drain();
console.log(`Veil Studio open at http://127.0.0.1:${PORT}`);
console.log(`AI / Drive inbox: ${drive}/inbox`);

child.on("exit", (code) => process.exit(code ?? 0));
