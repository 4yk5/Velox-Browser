const state = {
  tabs: new Map(),
  activeTabId: null
};

const dom = {};

window.togglePanel = (id) => {
  if (id === 'proxy-panel') window.velox.showProxy(true);
  else if (id === 'adblock-panel') window.velox.showAd(true);
  else if (id === 'duck-panel') window.velox.showDuck(true);
};

window.hidePanels = () => {
  window.velox.hidePanels();
};

function tabEl(data) {
  const el = document.createElement('div');
  el.className = 'tab';
  el.dataset.tabId = data.id;
  el.innerHTML = `<img class="tab-favicon" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><circle cx='8' cy='8' r='6' fill='%23555'/></svg>" width="14" height="14"><span class="tab-title">${data.title}</span><span class="tab-close">&times;</span>`;
  el.addEventListener('click', (e) => {
    if (e.target.closest('.tab-close')) window.velox.close(data.id);
    else window.velox.set(data.id);
  });
  return el;
}

function setTab(id) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const el = document.querySelector(`.tab[data-tab-id="${id}"]`);
  if (el) el.classList.add('active');
  state.activeTabId = id;
  const ts = state.tabs.get(id);
  if (ts && dom.urlInput) {
    dom.urlInput.value = ts.url?.startsWith('file://') ? 'velox://newtab' : (ts.url || '');
  }
}

async function updAd() {
  try {
    const s = await window.velox.adStats();
    const text = `${s.blocked || 0} ads blocked`;
    if (dom.statsEl) dom.statsEl.textContent = text;
    if (dom.statsPanelEl) dom.statsPanelEl.textContent = text;
    if (dom.shieldBtn) dom.shieldBtn.style.color = s.enabled ? 'var(--accent-green)' : 'var(--text-muted)';
    if (dom.adblockToggleBtn) {
      dom.adblockToggleBtn.textContent = s.enabled ? 'Disable AdBlock' : 'Enable AdBlock';
      dom.adblockToggleBtn.style.background = s.enabled ? 'rgba(239, 68, 68, 0.2)' : 'linear-gradient(135deg, #10b981, #06b6d4)';
      dom.adblockToggleBtn.style.color = s.enabled ? 'var(--accent-red)' : 'white';
    }
  } catch (e) {}
}

async function updProxy() {
  try {
    const s = await window.velox.proxyStatus();
    if (dom.proxyDot) {
      dom.proxyDot.className = s.active ? 'dot-active' : '';
      if (s.connecting) dom.proxyDot.className = 'dot-connecting';
    }
    if (dom.proxyIndicator) dom.proxyIndicator.className = s.active ? 'indicator-on' : 'indicator-off';
    if (dom.statusProxyText) dom.statusProxyText.textContent = s.active ? 'Proxy: Active' : 'Direct';
    if (dom.proxyVal) dom.proxyVal.textContent = s.active ? (s.currentProxy || 'Connected') : 'Disconnected';
    if (dom.proxyDisBtn) dom.proxyDisBtn.style.display = s.active ? 'block' : 'none';
  } catch (e) {}
}

function init() {
  window.velox.onTab((data) => {
    state.tabs.set(data.id, { ...data });
    document.getElementById('tabs-list').appendChild(tabEl(data));
    setTab(data.id);
  });
  window.velox.onTabClose((id) => {
    state.tabs.delete(id);
    const el = document.querySelector(`.tab[data-tab-id="${id}"]`);
    if (el) el.remove();
  });
  window.velox.onTabActive((id) => setTab(id));
  window.velox.onTabTitle((id, title) => {
    const el = document.querySelector(`.tab[data-tab-id="${id}"] .tab-title`);
    if (el) el.textContent = title;
  });
  window.velox.onTabUrl((id, url) => {
    const ts = state.tabs.get(id);
    if (ts) ts.url = url;
    if (id === state.activeTabId && dom.urlInput) {
      if (document.activeElement !== dom.urlInput) dom.urlInput.value = url.startsWith('file://') ? 'velox://newtab' : url;
    }
  });

  const listen = (id, event, cb) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, cb);
  };

  listen('new-tab-btn', 'click', () => window.velox.tab('velox://newtab'));
  listen('btn-back', 'click', () => window.velox.back());
  listen('btn-forward', 'click', () => window.velox.fwd());
  listen('btn-reload', 'click', () => window.velox.reload());
  listen('btn-minimize', 'click', () => window.velox.min());
  listen('btn-maximize', 'click', () => window.velox.max());
  listen('btn-close', 'click', () => window.velox.exit());
  
  listen('btn-duck', 'click', () => window.togglePanel('duck-panel'));
  listen('btn-adblock', 'click', () => window.togglePanel('adblock-panel'));
  listen('btn-proxy', 'click', () => window.togglePanel('proxy-panel'));
  listen('proxy-panel-close', 'click', window.hidePanels);
  listen('adblock-panel-close', 'click', window.hidePanels);
  listen('duck-panel-close', 'click', window.hidePanels);
  
  dom.urlInput = document.getElementById('url-input');
  dom.statsEl = document.getElementById('status-blocked');
  dom.statsPanelEl = document.getElementById('status-blocked-panel');
  dom.shieldBtn = document.getElementById('btn-shield');
  dom.adblockToggleBtn = document.getElementById('adblock-toggle-btn');
  dom.proxyDot = document.getElementById('proxy-status-dot');
  dom.proxyIndicator = document.getElementById('proxy-indicator');
  dom.statusProxyText = document.getElementById('status-proxy-text');
  dom.proxyVal = document.getElementById('proxy-status-value');
  dom.proxyDisBtn = document.getElementById('proxy-disconnect');
  dom.tabsList = document.getElementById('tabs-list');

  listen('adblock-toggle-btn', 'click', async () => {
    await window.velox.adToggle();
    updAd();
  });

  listen('proxy-auto', 'click', async () => {
    const btn = document.getElementById('proxy-auto');
    btn.textContent = 'Connecting...';
    await window.velox.proxyAuto();
    await updProxy();
    btn.textContent = 'Auto-Connect to Velox';
  });

  listen('proxy-disconnect', 'click', async () => {
    await window.velox.proxyOff();
    await updProxy();
  });

  const urlInput = document.getElementById('url-input');
  if (urlInput) {
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        window.velox.go(urlInput.value.trim());
        urlInput.blur();
      }
    });
    urlInput.addEventListener('focus', () => {
      if (urlInput.value === 'velox://newtab') {
        urlInput.value = '';
      } else {
        urlInput.select();
      }
    });
  }

  updAd();
  updProxy();
  setInterval(updAd, 5000);
  setInterval(updProxy, 5000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
