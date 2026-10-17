// Preload script for electron environment
const {ipcRenderer, contextBridge} = require('electron');

// Lets the WebUI header color the native window buttons drawn over it
// (Windows/Linux title bar overlay).
contextBridge.exposeInMainWorld('__titleBarOverlay', {
  setColors: (colors) => ipcRenderer.send('title-bar-overlay', colors),
});

// Desktop-only settings the main process needs (links in the default browser).
contextBridge.exposeInMainWorld('__labDesktop', {
  setSettings: (settings) => ipcRenderer.send('desktop-settings', settings),
  // URLs that programs in a session asked to open (backend.ai-plugin SPEC 1.14).
  openExternal: (target) => ipcRenderer.send('lab-open-external', target),
});

process.once('loaded', () => {
  ipcRenderer.on('proxy-ready', (event, proxy_url) => {
	contextBridge.exposeInMainWorld('__local_proxy', {
	  url: proxy_url
    });
  });

  ipcRenderer.on('app-close-window', _ => {
    let event = new CustomEvent('backend-ai-app-close', {'detail': ''});
    document.dispatchEvent(event);
    setTimeout(function() {
      ipcRenderer.send('app-closed');
    }, 1000);
  });
});
