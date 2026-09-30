/**
 @license
 Copyright (c) 2015-2026 Lablup Inc. All rights reserved.
 */
const {
  app,
  Menu,
  shell,
  BrowserWindow,
  WebContentsView,
  nativeTheme,
  protocol,
  session,
  clipboard,
  dialog,
  ipcMain,
} = require('electron');
process.env.electronPath = app.getAppPath();
function isDev() {
  return process.argv[2] == '--dev';
}
let debugMode = true;
if (isDev()) {
  // Dev mode from Makefile
  process.env.serveMode = 'dev'; // Prod OR debug
} else {
  process.env.serveMode = 'prod'; // Prod OR debug
  debugMode = false;
}
const url = require('url');
const path = require('path');
const { parse: toml } = require('smol-toml');
const nfs = require('fs');
const fs = require('fs').promises;
const mime = require('mime-types');
const npjoin = require('path').join;
const BASE_DIR = __dirname;
let ProxyManager;
let versions;
let es6Path;
let electronPath;
let mainIndex;
if (process.env.serveMode == 'dev') {
  ProxyManager = require(path.join(__dirname, 'app/wsproxy/wsproxy.js'));
  versions = require(path.join(__dirname, 'app/version'));
  es6Path = npjoin(__dirname, 'app'); // ES6 module loader with custom protocol
  electronPath = npjoin(__dirname);
  mainIndex = 'app/index.html';
} else {
  ProxyManager = require('./app/wsproxy/wsproxy.js');
  versions = require('./app/version');
  es6Path = npjoin(__dirname, 'app'); // ES6 module loader with custom protocol
  electronPath = npjoin(__dirname);
  mainIndex = 'app/index.html';
}

const windowWidth = 1280;
const windowHeight = 970;
// Windows/Linux: hide the native title bar and menu, and draw only the native
// minimize/maximize/close buttons over the page (Window Controls Overlay), like
// VS Code. macOS keeps its own title bar style.
const useTitleBarOverlay = process.platform !== 'darwin';
// Matches the WebUI header height (token.Layout.headerHeight).
const MAIN_TITLE_BAR_HEIGHT = 60;

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'es6',
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let mainContent;
let devtools;
const manager = new ProxyManager();
let mainURL;

app.once('ready', function () {
  let template;
  if (process.platform === 'darwin') {
    template = [
      {
        label: 'Backend.AI',
        submenu: [
          {
            label:
              'App version ' +
              versions.package +
              ' (rev.' +
              versions.revision +
              ')',
            click: function () {
              clipboard.writeText(
                versions.package + ' (rev.' + versions.revision + ')',
              );
              const response = dialog.showMessageBox({
                type: 'info',
                message: 'Version information is copied to clipboard.',
              });
            },
          },
          {
            type: 'separator',
          },
          {
            label: 'Refresh App',
            accelerator: 'Command+R',
            click: function () {
              // mainContent.reloadIgnoringCache();
              const proxyUrl = `http://localhost:${manager.port}/`;
              mainWindow.loadURL(
                url.format({
                  // Load HTML into new Window
                  pathname: path.join(mainIndex),
                  protocol: 'file',
                  slashes: true,
                }),
              );
              mainContent.executeJavaScript(
                `window.__local_proxy = {}; window.__local_proxy.url = '${proxyUrl}';`,
              );
              console.log('Re-connected to proxy: ' + proxyUrl);
            },
          },
          {
            type: 'separator',
          },
          {
            label: 'Services',
            submenu: [],
          },
          {
            type: 'separator',
          },
          {
            label: 'Hide Backend.AI Desktop',
            accelerator: 'Command+H',
            selector: 'hide:',
          },
          {
            label: 'Hide Others',
            accelerator: 'Command+Shift+H',
            selector: 'hideOtherApplications:',
          },
          {
            label: 'Show All',
            selector: 'unhideAllApplications:',
          },
          {
            type: 'separator',
          },
          {
            label: 'Quit',
            accelerator: 'Command+Q',
            click: function () {
              app.quit();
            },
          },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          {
            label: 'Undo',
            accelerator: 'Command+Z',
            selector: 'undo:',
          },
          {
            label: 'Redo',
            accelerator: 'Shift+Command+Z',
            selector: 'redo:',
          },
          {
            type: 'separator',
          },
          {
            label: 'Cut',
            accelerator: 'Command+X',
            selector: 'cut:',
          },
          {
            label: 'Copy',
            accelerator: 'Command+C',
            selector: 'copy:',
          },
          {
            label: 'Paste',
            accelerator: 'Command+V',
            selector: 'paste:',
          },
          {
            label: 'Select All',
            accelerator: 'Command+A',
            selector: 'selectAll:',
          },
        ],
      },
      {
        label: 'View',
        submenu: [
          {
            label: 'Zoom In',
            accelerator: 'Command+=',
            role: 'zoomin',
          },
          {
            label: 'Zoom Out',
            accelerator: 'Command+-',
            role: 'zoomout',
          },
          {
            label: 'Actual Size',
            accelerator: 'Command+0',
            role: 'resetzoom',
          },
          {
            label: 'Toggle Full Screen',
            accelerator: 'Ctrl+Command+F',
            click: function () {
              const focusedWindow = BrowserWindow.getFocusedWindow();
              if (focusedWindow) {
                focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
              }
            },
          },
        ],
      },
      {
        label: 'Window',
        submenu: [
          {
            label: 'Minimize',
            accelerator: 'Command+M',
            selector: 'performMiniaturize:',
          },
          {
            label: 'Close',
            accelerator: 'Command+W',
            selector: 'performClose:',
          },
          {
            type: 'separator',
          },
          {
            label: 'Bring All to Front',
            selector: 'arrangeInFront:',
          },
        ],
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Online Manual',
            click: function () {
              shell.openExternal('https://webui.docs.backend.ai/');
            },
          },
          {
            label: 'Backend.AI Project Site',
            click: function () {
              shell.openExternal('https://www.backend.ai/');
            },
          },
        ],
      },
    ];
  } else {
    template = [
      {
        label: '&File',
        submenu: [
          {
            label: 'Refresh App',
            accelerator: 'CmdOrCtrl+R',
            click: function () {
              const proxyUrl = `http://localhost:${manager.port}/`;
              mainWindow.loadURL(
                url.format({
                  // Load HTML into new Window
                  pathname: path.join(mainIndex),
                  protocol: 'file',
                  slashes: true,
                }),
              );
              mainContent.executeJavaScript(
                `window.__local_proxy = {}; window.__local_proxy.url = '${proxyUrl}';`,
              );
              console.log('Re-connected to proxy: ' + proxyUrl);
            },
          },
          {
            type: 'separator',
          },
          {
            label: '&Close',
            accelerator: 'Ctrl+W',
            click: function () {
              const focusedWindow = BrowserWindow.getFocusedWindow();
              if (focusedWindow) {
                focusedWindow.close();
              }
            },
          },
        ],
      },
      {
        label: '&View',
        submenu: [
          {
            label: 'Zoom In',
            accelerator: 'CmdOrCtrl+=',
            role: 'zoomin',
          },
          {
            label: 'Zoom Out',
            accelerator: 'CmdOrCtrl+-',
            role: 'zoomout',
          },
          {
            label: 'Actual Size',
            accelerator: 'CmdOrCtrl+0',
            role: 'resetzoom',
          },
          {
            label: 'Toggle &Full Screen',
            accelerator: 'F11',
            role: 'togglefullscreen',
          },
        ],
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Online Manual',
            click: function () {
              shell.openExternal('https://webui.docs.backend.ai/');
            },
          },
          {
            label: 'Backend.AI Project Site',
            click: function () {
              shell.openExternal('https://www.backend.ai/');
            },
          },
        ],
      },
    ];
  }

  const appmenu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(appmenu);
});

function createWindow() {
  // Create the browser window.
  devtools = null;
  setSameSitePolicy();
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    title: 'Backend.AI',
    frame: true,
    ...(useTitleBarOverlay
      ? {
          titleBarStyle: 'hidden',
          titleBarOverlay: {
            color: '#00000000',
            symbolColor: '#ffffff',
            height: MAIN_TITLE_BAR_HEIGHT,
          },
        }
      : { titleBarStyle: 'customButtonsOnHover' }),
    webPreferences: {
      nativeWindowOpen: true,
      nodeIntegration: false,
      preload: path.join(electronPath, 'preload.js'),
      devTools: debugMode === true,
      worldSafeExecuteJavaScript: false,
      contextIsolation: true,
    },
  });
  // and load the index.html of the app.
  if (process.env.LIVE_DEBUG === '1') {
    const endpoint = process.env.LIVE_DEBUG_ENDPOINT || 'http://127.0.0.1:9081';

    // Load HTML into new Window (dynamic serving for develop)
    console.log(`Running on live debug(${endpoint}) mode...`);
    mainWindow.loadURL(endpoint);
  } else {
    // Load HTML into new Window (file-based serving)
    const loadFallbackIndex = () => {
      mainURL = url.format({
        pathname: path.join(mainIndex),
        protocol: 'file',
        slashes: true,
      });
      mainWindow.loadURL(mainURL);
    };
    nfs.readFile(path.join(es6Path, 'config.toml'), 'utf-8', (err, data) => {
      console.log('Running on build-resource debug mode...');
      if (err) {
        console.log('No configuration file found.');
        loadFallbackIndex();
        return;
      }
      try {
        const config = toml(data);
        if (
          'wsproxy' in config &&
          'disableCertCheck' in config.wsproxy &&
          config.wsproxy.disableCertCheck == true
        ) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        }
        if (
          'server' in config &&
          'webServerURL' in config.server &&
          config.server.webServerURL != '' &&
          config.server.webServerURL != '""'
        ) {
          mainURL = config.server.webServerURL;
          mainWindow.loadURL(mainURL);
        } else {
          loadFallbackIndex();
        }
      } catch (parseErr) {
        console.error('config.toml parse error:', parseErr);
        loadFallbackIndex();
      }
    });
  }
  mainContent = mainWindow.webContents;
  if (debugMode === true) {
    devtools = new BrowserWindow();
    mainWindow.webContents.setDevToolsWebContents(devtools.webContents);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
  // Emitted when the window is closed.
  mainWindow.on('close', (e) => {
    if (mainWindow) {
      e.preventDefault();
      mainWindow.webContents.send('app-close-window');
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (manager.port) {
      const url = 'http://localhost:' + manager.port + '/';
      mainWindow.webContents.send('proxy-ready', url);
    } else {
      manager.once('ready', () => {
        const url = 'http://localhost:' + manager.port + '/';
        mainWindow.webContents.send('proxy-ready', url);
      });
      manager.start();
    }
  });

  // The WebUI header tells us its colors so the overlay buttons match it (and
  // follow the light/dark theme).
  ipcMain.on('title-bar-overlay', (event, colors) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!useTitleBarOverlay || !win || typeof win.setTitleBarOverlay !== 'function') {
      return;
    }
    win.setTitleBarOverlay({
      color: colors?.color || '#00000000',
      symbolColor: colors?.symbolColor || '#ffffff',
      height: MAIN_TITLE_BAR_HEIGHT,
    });
  });

  ipcMain.on('app-closed', (_) => {
    if (process.platform !== 'darwin') {
      // Force close app when it is closed even on macOS.
      // app.quit()
    }
    mainWindow = null;
    mainContent = null;
    devtools = null;
    app.quit();
  });
  mainWindow.on('closed', function () {
    mainWindow = null;
    mainContent = null;
    devtools = null;
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    return newPopupWindow(details);
  });
}

// Session app windows (VS Code, Jupyter, ...) on Windows/Linux. The app page is
// not ours, so it has no drag region and nothing keeps it clear of the native
// window buttons. By default the window shows a thin title bar of our own
// (drag region, page title, native buttons drawn over its right end) with the
// app in a WebContentsView below it. An app whose web manifest opts into Window
// Controls Overlay (a PWA such as VS Code for the Web) draws its own title bar,
// so it gets the whole window instead.
const APP_TITLE_BAR_HEIGHT = 32;
const PWA_WCO_CHECK = `(async () => {
  const link = document.querySelector('link[rel="manifest"]');
  if (!link) return false;
  try {
    const res = await fetch(link.href, { credentials: 'include' });
    const manifest = await res.json();
    return (manifest.display_override || []).includes('window-controls-overlay');
  } catch (e) {
    return false;
  }
})()`;

function appTitleBarColors() {
  return nativeTheme.shouldUseDarkColors
    ? { color: '#202020', symbolColor: '#e6e6e6' }
    : { color: '#f3f3f3', symbolColor: '#1f1f1f' };
}

// Symbol color readable on `color` (#rrggbb), or null if it cannot be parsed.
function symbolColorFor(color) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(color || '');
  if (!m) return null;
  const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1f1f1f' : '#e6e6e6';
}

// A PWA drawing its own title bar sets <meta name="theme-color"> to its title
// bar color (VS Code follows its color theme). Keep the native buttons on it:
// react to the change event, and poll every second in case it is missed.
const THEME_COLOR_READ = `(() => {
  const m = document.querySelector('meta[name="theme-color"]');
  return m ? m.content : '';
})()`;
function followThemeColor(win) {
  let last = '';
  const apply = (color) => {
    const symbolColor = symbolColorFor(color);
    if (!symbolColor || color === last || win.isDestroyed()) return;
    last = color;
    win.setTitleBarOverlay({ color, symbolColor, height: APP_TITLE_BAR_HEIGHT });
    win.setBackgroundColor(color);
  };
  win.webContents.on('did-change-theme-color', (_event, color) => apply(color));
  const timer = setInterval(() => {
    if (win.isDestroyed()) return clearInterval(timer);
    win.webContents
      .executeJavaScript(THEME_COLOR_READ)
      .then(apply)
      .catch(() => {});
  }, 1000);
  win.on('closed', () => clearInterval(timer));
}

function appTitleBarPage(colors) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; height: 100%; overflow: hidden; background: ${colors.color}; }
    #bar { height: ${APP_TITLE_BAR_HEIGHT}px; display: flex; align-items: center;
      padding-left: 12px; -webkit-app-region: drag; color: ${colors.symbolColor};
      font: 12px 'Segoe UI', system-ui, sans-serif; user-select: none;
      width: calc(env(titlebar-area-x, 0px) + env(titlebar-area-width, 100%) - 12px); }
    #title { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  </style></head><body><div id="bar"><span id="title"></span></div></body></html>`;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

function newAppWindow(details) {
  const colors = appTitleBarColors();
  const win = new BrowserWindow({
    frame: true,
    show: false,
    backgroundColor: colors.color,
    width: windowWidth,
    height: windowHeight,
    closable: true,
    modal: details.frameName === 'modal',
    titleBarStyle: 'hidden',
    titleBarOverlay: { ...colors, height: APP_TITLE_BAR_HEIGHT },
    webPreferences: { javascript: true },
  });
  const view = new WebContentsView({ webPreferences: { javascript: true } });
  let viewAttached = true;
  const layout = () => {
    if (!viewAttached) return;
    const [width, height] = win.getContentSize();
    view.setBounds({
      x: 0,
      y: APP_TITLE_BAR_HEIGHT,
      width,
      height: Math.max(height - APP_TITLE_BAR_HEIGHT, 0),
    });
  };
  win.contentView.addChildView(view);
  layout();
  win.on('resize', layout);
  win.on('maximize', layout);
  win.on('unmaximize', layout);
  win.on('enter-full-screen', layout);
  win.on('leave-full-screen', layout);

  const setTitle = (title) => {
    win.setTitle(title);
    if (viewAttached) {
      win.webContents
        .executeJavaScript(
          `document.getElementById('title').textContent = ${JSON.stringify(title)};`,
        )
        .catch(() => {});
    }
  };
  view.webContents.on('page-title-updated', (_event, title) => setTitle(title));
  view.webContents.setWindowOpenHandler((d) => newPopupWindow(d));
  win.webContents.setWindowOpenHandler((d) => newPopupWindow(d));

  // PWA with Window Controls Overlay: hand the whole window to the app, which
  // then draws its own title bar around the native buttons.
  view.webContents.once('did-finish-load', async () => {
    let wantsOverlay = false;
    try {
      wantsOverlay = await view.webContents.executeJavaScript(PWA_WCO_CHECK);
    } catch (e) {
      wantsOverlay = false;
    }
    if (!wantsOverlay || win.isDestroyed()) return;
    const appURL = view.webContents.getURL();
    viewAttached = false;
    win.contentView.removeChildView(view);
    view.webContents.close();
    win.webContents.on('page-title-updated', (_event, title) => win.setTitle(title));
    followThemeColor(win);
    win.loadURL(appURL);
  });

  win.on('closed', () => {
    if (viewAttached && !view.webContents.isDestroyed()) {
      view.webContents.close();
    }
  });
  win.once('ready-to-show', () => win.show());
  win.loadURL(appTitleBarPage(colors));
  view.webContents.loadURL(details.url);
  if (debugMode === true) {
    devtools = new BrowserWindow();
    view.webContents.setDevToolsWebContents(devtools.webContents);
    view.webContents.openDevTools({ mode: 'detach' });
  }
  return { action: 'deny' };
}

function newPopupWindow(details) {
  if (useTitleBarOverlay) {
    return newAppWindow(details);
  }
  // let disposition = details.disposition;
  let options = {
    frame: true,
    show: false,
    backgroundColor: '#EFEFEF',
    // parent: win,
    titleBarStyle: 'default',
    width: windowWidth,
    height: windowHeight,
    closable: true,
    webPreferences: {},
  };
  Object.assign(options.webPreferences, {
    javascript: true,
  });
  if (details.frameName === 'modal') {
    options.modal = true;
  }
  newGuest = new BrowserWindow(options);
  newGuest.once('ready-to-show', () => {
    newGuest.show();
  });
  newGuest.loadURL(details.url);
  if (debugMode === true) {
    devtools = new BrowserWindow();
    newGuest.webContents.setDevToolsWebContents(devtools.webContents);
    newGuest.webContents.openDevTools({ mode: 'detach' });
  }
  newGuest.webContents.setWindowOpenHandler((details) => {
    return newPopupWindow(details);
  });
  newGuest.on('close', (e) => {
    const c = BrowserWindow.getFocusedWindow();
    if (c !== null) {
      c.destroy();
    }
  });
  return { action: 'deny' };
}

function setSameSitePolicy() {
  const filter = { urls: ['http://*/*', 'https://*/*'] };
  session.defaultSession.webRequest.onHeadersReceived(
    filter,
    (details, callback) => {
      // HTTP header names are case-insensitive and Electron may normalize the
      // Set-Cookie key differently across platforms/versions, so find the
      // actual key rather than assuming 'Set-Cookie'.
      const cookieKey = Object.keys(details.responseHeaders).find(
        (key) => key.toLowerCase() === 'set-cookie',
      );
      if (cookieKey) {
        details.responseHeaders[cookieKey] = details.responseHeaders[
          cookieKey
        ].map((cookie) => {
          // Normalize any SameSite value (Lax, Strict, or missing) to None so
          // the cookie is sent on cross-site requests. Case-insensitive to
          // match RFC 6265.
          const withSameSite = /SameSite=/i.test(cookie)
            ? cookie.replace(/SameSite=\w+/i, 'SameSite=None')
            : cookie + '; SameSite=None';
          // SameSite=None requires the Secure attribute, otherwise
          // Chromium/Electron rejects the cookie.
          return /;\s*Secure/i.test(withSameSite)
            ? withSameSite
            : withSameSite + '; Secure';
        });
      }
      callback({ cancel: false, responseHeaders: details.responseHeaders });
    },
  );
}

app.on('ready', () => {
  // Registering the 'file' protocol
  protocol.handle('file', async (request) => {
    let url = request.url.substr(7); // strip 'file://' from the URL

    // file:/// URLs have a leading slash - remove it for path resolution
    if (url.startsWith('/')) {
      url = url.substring(1);
    }

    // Files in app/ directory: HTML, JS bundles, config.toml, manifest.json, etc.
    // Files at root level: resources/, manifest/
    if (!url.startsWith('app/') && !url.startsWith('resources/') && !url.startsWith('manifest/')) {
      url = path.join('app', url);
    }

    const normalizedPath = path.normalize(`${BASE_DIR}/${url}`);
    try {
      const data = await fs.readFile(normalizedPath);
      const mimeType = mime.lookup(normalizedPath);
      return new Response(data, { headers: { 'content-type': mimeType } });
    } catch (err) {
      console.error('Error reading file:', err);
      return { error: -2 }; // -2 corresponds to net::ERR_FAILED in Chromium
    }
  });
  // Registering the 'es6' protocol
  protocol.handle('es6', async (request) => {
    // Remove trailing slash that browsers may add
    const filePath = request.url.replace('es6://', '').replace(/\/$/, '');
    const fullPath = npjoin(es6Path, filePath);
    try {
      const data = await fs.readFile(fullPath);
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';

      return new Response(data, {
        headers: {
          'content-type': mimeType,
          'access-control-allow-origin': '*',
        },
      });
    } catch (err) {
      console.error('Error reading file:', err);
      return { error: -2 };
    }
  });
  createWindow();
});

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  if (mainWindow) {
    e.preventDefault();
    mainWindow.webContents.send('app-close-window');
  }
});

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});
app.on(
  'certificate-error',
  function (event, webContents, url, error, certificate, callback) {
    event.preventDefault();
    callback(true);
  },
);
// Let windows without node integration
app.on('web-contents-created', (event, contents) => {
  contents.on('will-attach-webview', (event, webPreferences, params) => {
    // Strip away preload scripts if unused or verify their location is legitimate
    delete webPreferences.preload;
    delete webPreferences.preloadURL;

    // Disable Node.js integration
    webPreferences.nodeIntegration = false;
  });
});
