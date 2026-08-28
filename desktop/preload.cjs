const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("veilDesktop", {
  pickFolder: () => ipcRenderer.invoke("veil:pick-folder"),
  folder: () => ipcRenderer.invoke("veil:folder"),
});
