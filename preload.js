const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('minerousAPI', {
  local: {
    save: (json) => ipcRenderer.invoke('local-save', json),
    load: () => ipcRenderer.invoke('local-load'),
    saveSync: (json) => ipcRenderer.send('local-save-sync', json),
  },
  auth: {
    signUp: (email, password) => ipcRenderer.invoke('auth-sign-up', { email, password }),
    signIn: (email, password) => ipcRenderer.invoke('auth-sign-in', { email, password }),
    signOut: () => ipcRenderer.invoke('auth-sign-out'),
    getSession: () => ipcRenderer.invoke('auth-get-session'),
  },
  cloud: {
    pushSave: (json) => ipcRenderer.invoke('cloud-push-save', json),
    pullSave: () => ipcRenderer.invoke('cloud-pull-save'),
  },
  updates: {
    version: () => ipcRenderer.invoke('app-version'),
    check: () => ipcRenderer.invoke('update-check'),
    install: () => ipcRenderer.invoke('update-install'),
    // Only the payload is forwarded — never the IPC event object, which would hand
    // the renderer a live channel back into the main process.
    onStatus: (callback) => ipcRenderer.on('update-status', (_event, payload) => callback(payload)),
  },
});
