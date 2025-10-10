const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Platform information
    platform: process.platform,
    isElectron: true,  // Flag to detect Electron environment

    // Disable web-specific features
    disableResizing: true,  // Disable manual panel resizing (window handles it)
    disableDimensionSaving: true,  // Disable localStorage dimension persistence

    // Future: Window controls for custom title bar
    // minimize: () => ipcRenderer.send('window-minimize'),
    // maximize: () => ipcRenderer.send('window-maximize'),
    // close: () => ipcRenderer.send('window-close'),

    // Future: File operations
    // saveFile: (content) => ipcRenderer.invoke('save-file', content),
    // openFile: () => ipcRenderer.invoke('open-file'),
});

// Log that preload script has executed
console.log('🔒 Electron preload script loaded - context isolation enabled');
