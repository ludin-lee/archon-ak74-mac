const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kb', {
  setLight: (opts) => ipcRenderer.invoke('set-light', opts),
  syncTime: () => ipcRenderer.invoke('sync-time'),
  uploadScreen: (data) => ipcRenderer.invoke('upload-screen', data),
  showGif: () => ipcRenderer.invoke('show-gif'),
  isConnected: () => ipcRenderer.invoke('is-connected'),
  onProgress: (cb) => ipcRenderer.on('upload-progress', (_e, p) => cb(p)),
});
