const { app, BrowserWindow, shell, dialog, ipcMain } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

const PORT = process.env.PORT || "3000";
const isDev = process.argv.includes("--dev") || process.env.VEIL_DEV === "1";
let serverProc;

function studioRoot() {
  return (
    process.env.VEIL_DRIVE_FOLDER ||
    path.join(app.getPath("home"), "VeilStudio")
  );
}

function waitForServer(url, tries = 80) {
  return new Promise((resolve, reject) => {
    const tick = (left) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (left <= 0) reject(new Error("server did not start"));
        else setTimeout(() => tick(left - 1), 250);
      });
    };
    tick(tries);
  });
}

function startNext() {
  if (isDev) return Promise.resolve();
  const standalone = app.isPackaged
    ? path.join(process.resourcesPath, "standalone", "server.js")
    : path.join(__dirname, "..", ".next", "standalone", "server.js");
  const cwd = app.isPackaged
    ? path.join(process.resourcesPath, "standalone")
    : path.join(__dirname, "..", ".next", "standalone");

  if (!fs.existsSync(standalone)) {
    const nextBin = path.join(__dirname, "..", "node_modules", "next", "dist", "bin", "next");
    serverProc = spawn(process.execPath, [nextBin, "start", "-p", PORT, "-H", "127.0.0.1"], {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, PORT, VEIL_DRIVE_FOLDER: studioRoot() },
      stdio: "inherit",
    });
    return waitForServer(`http://127.0.0.1:${PORT}`);
  }

  serverProc = spawn(process.execPath, [standalone], {
    cwd,
    env: {
      ...process.env,
      PORT,
      HOSTNAME: "127.0.0.1",
      VEIL_DRIVE_FOLDER: studioRoot(),
    },
    stdio: "inherit",
  });
  return waitForServer(`http://127.0.0.1:${PORT}`);
}

function drainInbox() {
  const root = studioRoot();
  fetch("http://127.0.0.1:" + PORT + "/api/v1/inbox", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scan: true, folder: root }),
  }).catch(() => undefined);
}

async function createWindow() {
  process.env.VEIL_DRIVE_FOLDER = studioRoot();
  await startNext();
  drainInbox();
  setInterval(drainInbox, 4000);

  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    backgroundColor: "#070708",
    title: "Veil Studio",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
    },
  });
  win.loadURL(`http://127.0.0.1:${PORT}`);
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
}

ipcMain.handle("veil:pick-folder", async () => {
  const res = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  if (res.canceled || !res.filePaths[0]) return null;
  process.env.VEIL_DRIVE_FOLDER = res.filePaths[0];
  return res.filePaths[0];
});

ipcMain.handle("veil:folder", () => studioRoot());

app.whenReady().then(() => void createWindow());
app.on("window-all-closed", () => {
  serverProc?.kill();
  app.quit();
});
