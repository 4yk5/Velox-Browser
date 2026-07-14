const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('velox', {
  tab: (url) => ipcRenderer.invoke('create-tab', url),
  close: (id) => ipcRenderer.invoke('close-tab', id),
  set: (id) => ipcRenderer.invoke('switch-tab', id),

  go: (url) => ipcRenderer.invoke('navigate', url),
  back: () => ipcRenderer.invoke('go-back'),
  fwd: () => ipcRenderer.invoke('go-forward'),
  reload: () => ipcRenderer.invoke('reload'),
  stop: () => ipcRenderer.invoke('stop-loading'),

  min: () => ipcRenderer.invoke('window-minimize'),
  max: () => ipcRenderer.invoke('window-maximize'),
  exit: () => ipcRenderer.invoke('window-close'),

  adStats: () => ipcRenderer.invoke('get-adblock-stats'),
  adToggle: () => ipcRenderer.invoke('toggle-adblock'),
  adEnabled: () => ipcRenderer.invoke('is-adblock-enabled'),

  proxyStatus: () => ipcRenderer.invoke('get-proxy-status'),
  proxySet: (p) => ipcRenderer.invoke('set-proxy', p),
  proxyOff: () => ipcRenderer.invoke('disable-proxy'),
  proxyAuto: () => ipcRenderer.invoke('auto-connect-proxy'),
  showProxy: (open) => ipcRenderer.invoke('toggle-proxy-panel', open),
  showAd: (open) => ipcRenderer.invoke('toggle-adblock-panel', open),
  showDuck: (open) => ipcRenderer.invoke('toggle-duck-panel', open),
  hidePanels: () => ipcRenderer.invoke('close-all-panels'),
  setSearch: (eng) => ipcRenderer.invoke('set-search-engine', eng),
  getSearch: () => ipcRenderer.invoke('get-search-engine'),

  onPanel: (cb) => ipcRenderer.on('panel-toggle', (_, id, open) => cb(id, open)),
  onTab: (cb) => ipcRenderer.on('tab-created', (_, d) => cb(d)),
  onTabClose: (cb) => ipcRenderer.on('tab-closed', (_, id) => cb(id)),
  onTabActive: (cb) => ipcRenderer.on('tab-activated', (_, id) => cb(id)),
  onTabTitle: (cb) => ipcRenderer.on('tab-title-updated', (_, id, t) => cb(id, t)),
  onTabUrl: (cb) => ipcRenderer.on('tab-url-updated', (_, id, u) => cb(id, u)),
  onTabLoad: (cb) => ipcRenderer.on('tab-loading', (_, id, loading) => cb(id, loading)),
  onTabState: (cb) => ipcRenderer.on('tab-nav-state', (_, id, state) => cb(id, state)),
  onTabFav: (cb) => ipcRenderer.on('tab-favicon-updated', (_, id, fav) => cb(id, fav)),
  onMax: (cb) => ipcRenderer.on('window-maximized', (_, max) => cb(max)),
});
