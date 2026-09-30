// Preload script for electron environment
const {ipcRenderer, contextBridge} = require('electron');

// Lets the WebUI header color the native window buttons drawn over it
// (Windows/Linux title bar overlay).
contextBridge.exposeInMainWorld('__titleBarOverlay', {
  setColors: (colors) => ipcRenderer.send('title-bar-overlay', colors),
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
