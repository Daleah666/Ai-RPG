import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runInboxRequest } from "@/lib/inbox";
import { ensureStudioTree, processAllInbox } from "@/lib/inbox-fs";

describe("drive AI inbox", () => {
  it("builds a project from a dropped JSON request", () => {
    const { project } = runInboxRequest({ theme: "feminizing", renderAudio: false });
    expect(project.category).toBe("feminine");
    expect(project.audio.layers).toBeGreaterThanOrEqual(6);
  });

  it("drains inbox files into outbox", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "veil-inbox-"));
    ensureStudioTree(root);
    fs.writeFileSync(
      path.join(root, "inbox", "job.json"),
      JSON.stringify({ theme: "deep sleep" }),
    );
    const res = processAllInbox(root);
    expect(res.processed[0]?.ok).toBe(true);
    expect(fs.existsSync(path.join(root, "outbox", "job.json"))).toBe(true);
    expect(fs.existsSync(path.join(root, "inbox", "job.json"))).toBe(false);
    expect(fs.existsSync(path.join(root, "README-FOR-AI.md"))).toBe(true);
  });
});
