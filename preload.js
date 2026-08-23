const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("liangPet", {
  send: (prompt) => ipcRenderer.invoke("liang:send", prompt),
  speak: (payload) => ipcRenderer.invoke("liang:speak", payload),
  getAppSettings: () => ipcRenderer.invoke("liang:get-app-settings"),
  chooseWorkspace: () => ipcRenderer.invoke("liang:choose-workspace"),
  toggleInterface: () => ipcRenderer.invoke("liang:toggle-interface"),
  stopSpeaking: () => ipcRenderer.send("liang:stop-speaking"),
  dragStart: (point) => ipcRenderer.send("liang:drag-start", point),
  dragMove: (point) => ipcRenderer.send("liang:drag-move", point),
  dragEnd: () => ipcRenderer.send("liang:drag-end"),
  focusWindow: () => ipcRenderer.send("liang:focus-window"),
  closeApp: () => ipcRenderer.send("liang:close-app"),
  onPartial: (callback) => ipcRenderer.on("liang:partial", (_event, text) => callback(text)),
  onStatus: (callback) => ipcRenderer.on("liang:status", (_event, text) => callback(text))
});
