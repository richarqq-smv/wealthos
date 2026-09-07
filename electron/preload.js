const { contextBridge, ipcRenderer } = require("electron");

/**
 * Minimal, whitelisted bridge for the renderer. Only exposes secure-secret
 * storage (for market-data API keys) — nothing filesystem-wide, nothing
 * Node-API-shaped. The renderer never gets raw ipcRenderer access.
 */
contextBridge.exposeInMainWorld("wealthOS", {
  secrets: {
    get: (key) => ipcRenderer.invoke("secure-storage:get", key),
    set: (key, value) => ipcRenderer.invoke("secure-storage:set", key, value),
    delete: (key) => ipcRenderer.invoke("secure-storage:delete", key),
  },
});
