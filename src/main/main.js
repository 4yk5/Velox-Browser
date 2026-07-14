const { app, BrowserWindow, BrowserView, ipcMain, session, Menu, nativeTheme, dialog, shell } = require('electron');
const path = require('path');
const https = require('https');

app.disableHardwareAcceleration();
app.name = 'Velox';
app.commandLine.appendSwitch('background-color', '#08080c');
app.commandLine.appendSwitch('disable-metrics');
app.commandLine.appendSwitch('disable-metrics-repo');
app.commandLine.appendSwitch('no-sandbox');

const ad = require('./adblock');
const { ProxyMgr } = require('./proxy');
const { SetPrivacy } = require('./privacy');

nativeTheme.themeSource = 'dark';

let mainWin = null;
let panelWin = null;
const tabs = new Map();
let activeTabId = null;
let nextTabId = 1;
let proxyMgr = null;
let engine = 'google';
let prompted = false;

const TOOLBAR_H = 94;
const STATUS_H = 32;
const BG_COLOR = '#08080c';
const UPDATE_INTERVAL = 1000 * 60 * 60 * 6;

const PATHS = {
  preload: path.join(__dirname, '../preload/preload.js'),
  content: path.join(__dirname, '../preload/content-preload.js'),
  index: path.join(__dirname, '../renderer/index.html'),
  panels: path.join(__dirname, '../renderer/panels.html'),
  newtab: path.join(__dirname, '../renderer/newtab.html'),
  icon: path.join(__dirname, '../../assets/icon.png'),
};

function ParseVer(v) {
  return (String(v || '').match(/\d+/g) || []).map(p => parseInt(p, 10) || 0);
}

function IsNewer(curr, remote) {
  const c = ParseVer(curr);
  const r = ParseVer(remote);
  const len = Math.max(c.length, r.length);
  for (let i = 0; i < len; i++) {
    const a = c[i] || 0;
    const b = r[i] || 0;
    if (b > a) return true;
    if (b < a) return false;
  }
  return false;
}

function FetchUpdate() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: '/repos/VeloxBrowser/Velox/releases/latest',
      method: 'GET',
      headers: {
        'User-Agent': 'Velox-Update-Checker',
        'Accept': 'application/vnd.github+json',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`GitHub API error: ${res.statusCode}`));
        }
        try {
          const json = JSON.parse(data);
          const version = String(json.tag_name || '').trim();
          const url = String(json.html_url || '').trim();
          let dlUrl = '';
          if (Array.isArray(json.assets)) {
            const asset = json.assets.find(a => /\.exe$/i.test(a.name || '')) ||
                          json.assets.find(a => /\.msi$/i.test(a.name || '')) ||
                          json.assets[0];
            dlUrl = String(asset?.browser_download_url || '').trim();
          }
          resolve({ version, url, dlUrl });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function CheckUpdate(silent = false) {
  try {
    const curr = app.getVersion();
    const latest = await FetchUpdate();
    if (!latest.version) return { ok: false };

    const update = IsNewer(curr, latest.version);
    if (!update) {
      if (!silent && mainWin) {
        await dialog.showMessageBox(mainWin, {
          type: 'info',
          title: 'Velox',
          message: 'You are using the latest version.',
          detail: `Version: ${curr}`,
        });
      }
      return { ok: true, update: false };
    }

    if (silent && prompted) return { ok: true, update: true };
    prompted = true;

    if (mainWin) {
      const res = await dialog.showMessageBox(mainWin, {
        type: 'info',
        buttons: ['İndir', 'Sonra'],
        defaultId: 0,
        cancelId: 1,
        title: 'Yeni sürüm',
        message: `Yeni sürüm mevcut: ${latest.version}`,
      });
      if (res.response === 0) {
        const target = latest.dlUrl || latest.url;
        if (target) await shell.openExternal(target);
      }
    }
    return { ok: true, update: true };
  } catch (err) {
    if (!silent && mainWin) {
      await dialog.showMessageBox(mainWin, {
        type: 'error',
        title: 'Error',
        message: 'Could not check for updates.',
        detail: err.message,
      });
    }
    return { ok: false, error: err.message };
  }
}

function SchedUpdates() {
  setTimeout(() => CheckUpdate(true), 15000);
  setInterval(() => CheckUpdate(true), UPDATE_INTERVAL);
}

app.whenReady().then(() => {
  try { Menu.setApplicationMenu(null); } catch (_) {}

  app.on('web-contents-created', (_, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      const target = String(url || '').trim();
      if (!target || target === 'about:blank' || target.startsWith('javascript:')) {
        return { action: 'deny' };
      }
      if (/^https?:\/\//i.test(target)) {
        setImmediate(() => {
          if (mainWin && !mainWin.isDestroyed()) NewTab(target);
        });
      }
      return { action: 'deny' };
    });

    contents.on('did-create-window', (child, details) => {
      if (child && !child.isDestroyed()) child.destroy();
      const target = String(details?.url || '').trim();
      if (target && /^https?:\/\//i.test(target)) {
        setImmediate(() => {
          if (mainWin && !mainWin.isDestroyed()) NewTab(target);
        });
      }
    });
  });

  proxyMgr = new ProxyMgr(session.defaultSession);
  InitMain();
  ad.InitAd(session.defaultSession).catch(() => {});

  mainWin.webContents.on('did-finish-load', () => {
    if (tabs.size === 0) NewTab('velox://newtab');
  });

  CheckUpdate(true).catch(() => {});
  SchedUpdates();
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', async () => {
  if (proxyMgr) await proxyMgr.Stop();
});

function InitMain() {
  mainWin = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: BG_COLOR,
    show: false,
    icon: PATHS.icon,
    title: 'Velox Browser',
    webPreferences: {
      preload: PATHS.preload,
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  mainWin.loadFile(PATHS.index);
  mainWin.once('ready-to-show', () => {
    if (mainWin && !mainWin.isDestroyed()) mainWin.show();
  });

  InitPanel();

  mainWin.on('resize', () => {
    ResizeTab();
    MovePanel();
  });

  mainWin.on('move', MovePanel);

  mainWin.on('maximize', () => {
    Send('window-maximized', true);
    ResizeTab();
    MovePanel();
  });

  mainWin.on('unmaximize', () => {
    Send('window-maximized', false);
    ResizeTab();
    MovePanel();
  });

  mainWin.on('closed', () => {
    mainWin = null;
  });
}

function InitPanel() {
  panelWin = new BrowserWindow({
    width: 350,
    height: 600,
    parent: mainWin,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: PATHS.preload,
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  panelWin.loadFile(PATHS.panels);
  panelWin.on('closed', () => {
    panelWin = null;
  });
}

function MovePanel() {
  if (!panelWin || !mainWin || panelWin.isDestroyed() || mainWin.isDestroyed()) return;
  const [x, y] = mainWin.getPosition();
  const [w] = mainWin.getSize();
  panelWin.setPosition(x + w - 350, y + TOOLBAR_H);
}

function GetBounds() {
  if (!mainWin || mainWin.isDestroyed()) return { x: 0, y: TOOLBAR_H, width: 0, height: 0 };
  const { width, height } = mainWin.getContentBounds();
  return {
    x: 0,
    y: TOOLBAR_H,
    width,
    height: Math.max(0, height - TOOLBAR_H - STATUS_H),
  };
}

function NewTab(url = 'velox://newtab') {
  const id = nextTabId++;
  const view = new BrowserView({
    webPreferences: {
      preload: PATHS.content,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    }
  });

  if (view.setBackgroundColor) view.setBackgroundColor(BG_COLOR);
  view.setBounds(GetBounds());
  view.setAutoResize({ width: true, height: true });

  SetPrivacy(view.webContents);
  view.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const tab = { id, view, title: 'New Tab', url, isLoading: false, canBack: false, canFwd: false };
  tabs.set(id, tab);

  view.webContents.on('did-start-loading', () => {
    tab.isLoading = true;
    Send('tab-loading', id, true);
  });

  view.webContents.on('dom-ready', ResizeTab);
  view.webContents.on('did-frame-finish-load', ResizeTab);

  view.webContents.on('did-stop-loading', () => {
    tab.isLoading = false;
    tab.canBack = !!view.webContents.navigationHistory?.canGoBack();
    tab.canFwd = !!view.webContents.navigationHistory?.canGoForward();

    Send('tab-loading', id, false);
    Send('tab-nav-state', id, { canGoBack: tab.canBack, canGoForward: tab.canFwd });
    ResizeTab();
  });

  view.webContents.on('page-title-updated', (_, title) => {
    tab.title = title || 'New Tab';
    Send('tab-title-updated', id, tab.title);
  });

  view.webContents.on('did-navigate', (_, navUrl) => {
    tab.url = navUrl;
    Send('tab-url-updated', id, navUrl);
    ResizeTab();
  });

  view.webContents.on('did-navigate-in-page', (_, navUrl) => {
    tab.url = navUrl;
    Send('tab-url-updated', id, navUrl);
    ResizeTab();
  });

  view.webContents.on('page-favicon-updated', (_, favs) => {
    if (Array.isArray(favs) && favs.length > 0) {
      Send('tab-favicon-updated', id, favs[0]);
    }
  });

  if (view.webContents.setBackgroundThrottling) {
    view.webContents.setBackgroundThrottling(false);
  }

  SetTab(id);
  Go(view, url);
  Send('tab-created', { id, title: tab.title, url: tab.url });

  return id;
}

function Go(view, url) {
  if (!view || !view.webContents || view.webContents.isDestroyed()) return;
  if (url === 'velox://newtab') {
    view.webContents.loadFile(PATHS.newtab);
  } else {
    view.webContents.loadURL(url);
  }
}

function SetTab(id) {
  const tab = tabs.get(id);
  if (!tab || !mainWin || mainWin.isDestroyed()) return;
  mainWin.setBrowserView(tab.view);
  activeTabId = id;
  ResizeTab();
  Send('tab-activated', id);
}

function ResizeTab() {
  if (activeTabId === null || !mainWin || mainWin.isDestroyed()) return;
  const tab = tabs.get(activeTabId);
  if (tab) tab.view.setBounds(GetBounds());
}

function CloseTab(id) {
  const tab = tabs.get(id);
  if (!tab) return;
  const wasActive = activeTabId === id;

  if (wasActive && mainWin && !mainWin.isDestroyed()) {
    mainWin.setBrowserView(null);
  }

  if (tab.view && tab.view.webContents && !tab.view.webContents.isDestroyed()) {
    tab.view.webContents.stop();
    tab.view.webContents.close();
  }

  tabs.delete(id);
  Send('tab-closed', id);

  if (wasActive) {
    const keys = [...tabs.keys()];
    if (keys.length > 0) {
      SetTab(keys[keys.length - 1]);
    } else {
      activeTabId = null;
    }
  }

  if (tabs.size === 0) NewTab('velox://newtab');
}

function ShowPanel(panelId, open) {
  if (!panelWin || panelWin.isDestroyed()) return;
  if (open) {
    MovePanel();
    panelWin.show();
    panelWin.webContents.send('panel-toggle', panelId, true);
  } else {
    panelWin.hide();
  }
}

function Send(chan, ...args) {
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send(chan, ...args);
  }
}

async function ProxyCall(method, ...args) {
  if (!proxyMgr || typeof proxyMgr[method] !== 'function') {
    return { success: false, error: `${method} not supported` };
  }
  try {
    return await proxyMgr[method](...args);
  } catch (err) {
    return { success: false, error: err.message };
  }
}

ipcMain.handle('create-tab', (_, url) => NewTab(url));
ipcMain.handle('close-tab', (_, id) => CloseTab(id));
ipcMain.handle('switch-tab', (_, id) => SetTab(id));

ipcMain.handle('navigate', (_, val) => {
  if (activeTabId === null) return;
  const tab = tabs.get(activeTabId);
  if (!tab) return;
  let url = String(val || '').trim();
  if (!url) return;

  if (url === 'velox://newtab') {
    Go(tab.view, url);
    return;
  }

  const isUrl = /^(https?:\/\/|[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,})/.test(url);
  if (!isUrl) {
    url = engine === 'duckduckgo'
      ? `https://duckduckgo.com/?q=${encodeURIComponent(url)}`
      : `https://www.google.com/search?q=${encodeURIComponent(url)}`;
  } else if (!url.startsWith('http')) {
    url = `https://${url}`;
  }
  Go(tab.view, url);
});

ipcMain.handle('go-back', () => {
  const tab = tabs.get(activeTabId);
  if (tab?.view?.webContents && !tab.view.webContents.isDestroyed() && tab.canBack) {
    tab.view.webContents.navigationHistory.goBack();
  }
});

ipcMain.handle('go-forward', () => {
  const tab = tabs.get(activeTabId);
  if (tab?.view?.webContents && !tab.view.webContents.isDestroyed() && tab.canFwd) {
    tab.view.webContents.navigationHistory.goForward();
  }
});

ipcMain.handle('reload', () => {
  const tab = tabs.get(activeTabId);
  if (tab?.view?.webContents && !tab.view.webContents.isDestroyed()) {
    tab.view.webContents.reload();
  }
});

ipcMain.handle('stop-loading', () => {
  const tab = tabs.get(activeTabId);
  if (tab?.view?.webContents && !tab.view.webContents.isDestroyed()) {
    tab.view.webContents.stop();
  }
});

ipcMain.handle('window-minimize', () => {
  if (mainWin && !mainWin.isDestroyed()) mainWin.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (!mainWin || mainWin.isDestroyed()) return;
  mainWin.isMaximized() ? mainWin.unmaximize() : mainWin.maximize();
});

ipcMain.handle('window-close', () => {
  if (mainWin && !mainWin.isDestroyed()) mainWin.close();
});

ipcMain.handle('toggle-proxy-panel', (_, open) => ShowPanel('proxy-panel', open));
ipcMain.handle('toggle-adblock-panel', (_, open) => ShowPanel('adblock-panel', open));
ipcMain.handle('toggle-duck-panel', (_, open) => ShowPanel('duck-panel', open));
ipcMain.handle('close-all-panels', () => {
  if (panelWin && !panelWin.isDestroyed()) panelWin.hide();
});

ipcMain.handle('get-adblock-stats', () => ad.Stats());
ipcMain.handle('toggle-adblock', () => ad.Toggle());
ipcMain.handle('is-adblock-enabled', () => ad.Enabled());

ipcMain.handle('get-proxy-status', () => {
  return proxyMgr ? proxyMgr.Status() : { active: false, connecting: false, currentProxy: null, availableProxies: 0 };
});

ipcMain.handle('set-proxy', (_, proxy) => ProxyCall('Set', proxy));
ipcMain.handle('disable-proxy', () => {
  engine = 'google';
  return ProxyCall('Stop');
});
ipcMain.handle('fetch-free-proxies', () => ProxyCall('fetchFreeProxies'));
ipcMain.handle('test-proxy', (_, proxy) => ProxyCall('testProxy', proxy));
ipcMain.handle('auto-connect-proxy', () => {
  engine = 'duckduckgo';
  return ProxyCall('Rotate');
});

ipcMain.handle('set-search-engine', (_, eng) => {
  engine = eng === 'duckduckgo' ? 'duckduckgo' : 'google';
});
ipcMain.handle('get-search-engine', () => engine);
ipcMain.handle('check-for-updates', () => CheckUpdate(false));