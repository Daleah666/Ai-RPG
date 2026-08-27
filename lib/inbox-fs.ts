import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  AI_DRIVE_README,
  APP_FOLDER,
  INBOX_FOLDER,
  LIBRARY_FOLDER,
  OUTBOX_FOLDER,
  STUDIO_ROOT_NAME,
  runInboxRequest,
} from "./inbox";

export function guessGoogleDriveRoots(): string[] {
  const home = os.homedir();
  const extra = process.env.VEIL_DRIVE_FOLDER;
  return [
    extra,
    path.join(home, "Google Drive"),
    path.join(home, "GoogleDrive"),
    path.join(home, "My Drive"),
    path.join(home, "Library", "CloudStorage"),
    "G:\\My Drive",
    "H:\\My Drive",
  ].filter((p): p is string => Boolean(p));
}

export function resolveStudioRoot(preferred?: string): string {
  if (preferred && fs.existsSync(preferred)) return preferred;
  for (const root of guessGoogleDriveRoots()) {
    if (!fs.existsSync(root)) continue;
    const direct = path.join(root, STUDIO_ROOT_NAME);
    if (fs.existsSync(direct) || isDriveLike(root)) return direct;
    try {
      const kids = fs.readdirSync(root);
      const cloud = kids.find((k) => /google|drive/i.test(k));
      if (cloud) return path.join(root, cloud, STUDIO_ROOT_NAME);
    } catch {
      /* */
    }
  }
  return path.join(os.homedir(), STUDIO_ROOT_NAME);
}

function isDriveLike(root: string) {
  const base = path.basename(root).toLowerCase();
  return base.includes("drive") || base.includes("my drive");
}

export function ensureStudioTree(root: string) {
  for (const dir of [INBOX_FOLDER, path.join(INBOX_FOLDER, "processed"), OUTBOX_FOLDER, LIBRARY_FOLDER, APP_FOLDER]) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  }
  const readme = path.join(root, "README-FOR-AI.md");
  if (!fs.existsSync(readme)) fs.writeFileSync(readme, AI_DRIVE_README, "utf8");
  const example = path.join(root, INBOX_FOLDER, "_example-request.json");
  if (!fs.existsSync(example)) {
    fs.writeFileSync(
      example,
      JSON.stringify(
        {
          theme: "feminizing into everyday womanhood",
          recipeId: "auto",
          durationSec: 180,
          renderAudio: false,
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
  }
  return root;
}

export function scanInbox(root: string) {
  const inbox = path.join(root, INBOX_FOLDER);
  if (!fs.existsSync(inbox)) return [];
  return fs
    .readdirSync(inbox)
    .filter((name) => name.endsWith(".json") && !name.startsWith("_"))
    .map((name) => path.join(inbox, name));
}

export function processInboxPath(filePath: string, root: string) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  const { project, wav } = runInboxRequest(raw);
  const base = path.basename(filePath, ".json").replace(/[^a-z0-9_-]+/gi, "-");
  const outJson = path.join(root, OUTBOX_FOLDER, `${base}.json`);
  const libJson = path.join(root, LIBRARY_FOLDER, `${project.id}.json`);
  const json = JSON.stringify(project, null, 2);
  fs.writeFileSync(outJson, json, "utf8");
  fs.writeFileSync(libJson, json, "utf8");
  if (wav) {
    fs.writeFileSync(path.join(root, OUTBOX_FOLDER, `${base}.wav`), wav);
  }
  const processed = path.join(root, INBOX_FOLDER, "processed", path.basename(filePath));
  fs.renameSync(filePath, processed);
  return { outJson, id: project.id, theme: project.theme };
}

export function processAllInbox(root: string) {
  ensureStudioTree(root);
  const files = scanInbox(root);
  const results = [];
  for (const file of files) {
    try {
      results.push({ ok: true, ...processInboxPath(file, root) });
    } catch (error) {
      results.push({
        ok: false,
        file,
        error: error instanceof Error ? error.message : "failed",
      });
    }
  }
  return { root, processed: results };
}
