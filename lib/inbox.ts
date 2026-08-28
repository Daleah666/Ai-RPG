import { generateProject } from "./engine";
import { generateSchema } from "./schema";
import { renderProjectWav } from "./audio/render";
import type { SubliminalProject } from "./types";

export const INBOX_FOLDER = "inbox";
export const OUTBOX_FOLDER = "outbox";
export const LIBRARY_FOLDER = "library";
export const APP_FOLDER = "app";
export const STUDIO_ROOT_NAME = "VeilStudio";

export type InboxResult = {
  fileName: string;
  project: SubliminalProject;
  wav?: Buffer;
  error?: string;
};

export function parseInboxRequest(raw: unknown) {
  return generateSchema.parse(raw);
}

export function runInboxRequest(raw: unknown): {
  project: SubliminalProject;
  wav?: Buffer;
} {
  const body = parseInboxRequest(raw);
  const project = generateProject(body);
  const wav = body.renderAudio
    ? renderProjectWav(project, {
        durationSec: Math.min(project.durationSec, 90),
        sampleRate: 22050,
      })
    : undefined;
  return { project, wav };
}

export const AI_DRIVE_README = `# Veil Studio — for you (and for AI in Google Drive)

This folder is the private workspace. Put the Windows \`.exe\` (or the Launch script) in \`app/\`. Keep the app running while you work.

## How an AI (Gemini in Drive, or any assistant) makes a subliminal

Create a new file in **inbox/** named anything ending in \`.json\`, for example \`inbox/feminizing.json\`:

\`\`\`json
{
  "theme": "feminizing into everyday womanhood",
  "recipeId": "auto",
  "durationSec": 180,
  "renderAudio": true
}
\`\`\`

Other useful themes: \`"dropping easily into deep trance"\`, \`"anti-racism as a lived habit"\`.

When Veil Studio is running (the .exe or \`npm run launch\`), it picks up that file and writes:

- \`outbox/<name>.json\` — full project (script, methods, layers)
- \`outbox/<name>.wav\` — mixed audio, if \`"renderAudio": true\`
- The request moves to \`inbox/processed/\`

Then you (or Drive AI) can read the outbox files.

## Launch

Windows: double-click \`app/Veil Studio.exe\` or \`app/Launch-VeilStudio.bat\`.
Mac/Linux: \`app/Launch-VeilStudio.sh\` or \`npm run launch\` from the project.

The app must be running on this computer. Google Drive does not execute .exe files in the cloud — Drive syncs the folder, the local app does the work, results sync back.
`;
