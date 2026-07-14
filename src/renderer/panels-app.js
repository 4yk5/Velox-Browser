const dom = {};

window.velox.onPanel((panelId, isOpen) => {
  ['proxy-panel', 'adblock-panel', 'duck-panel'].forEach(id => {
    const p = document.getElementById(id);
    if (p) p.style.display = (id === panelId && isOpen) ? 'flex' : 'none';
  });
  
  if (isOpen) {
    if (panelId === 'proxy-panel') updProxy();
    else if (panelId === 'adblock-panel') updAd();
    else if (panelId === 'duck-panel') updDuck();
  }
});

async function updAd() {
  try {
    const s = await window.velox.adStats();
    if (dom.statsPanelEl) dom.statsPanelEl.textContent = `${s.blocked || 0} ads blocked`;
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
    if (dom.proxyVal) dom.proxyVal.textContent = s.active ? (s.currentProxy || 'Connected') : 'Disconnected';
    if (dom.proxyDisBtn) dom.proxyDisBtn.style.display = s.active ? 'block' : 'none';
  } catch (e) {}
}

async function updDuck() {
  try {
    const eng = await window.velox.getSearch();
    const isDuck = eng === 'duckduckgo';
    if (dom.engineEl) dom.engineEl.textContent = isDuck ? 'DuckDuckGo' : 'Google';
    if (dom.duckToggleBtn) {
      dom.duckToggleBtn.textContent = isDuck ? 'Disable Private Search' : 'Enable Private Search';
      dom.duckToggleBtn.style.background = isDuck ? 'rgba(239, 68, 68, 0.2)' : 'linear-gradient(135deg, #de5833, #f59e0b)';
      dom.duckToggleBtn.style.color = isDuck ? 'var(--accent-red)' : 'white';
    }
    if (dom.privateBadge) dom.privateBadge.style.display = isDuck ? 'block' : 'none';
  } catch (e) {}
}

const listen = (id, event, cb) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, cb);
};

listen('proxy-panel-close', 'click', () => window.velox.hidePanels());
listen('adblock-panel-close', 'click', () => window.velox.hidePanels());
listen('duck-panel-close', 'click', () => window.velox.hidePanels());

dom.statsPanelEl = document.getElementById('status-blocked-panel');
dom.adblockToggleBtn = document.getElementById('adblock-toggle-btn');
dom.proxyVal = document.getElementById('proxy-status-value');
dom.proxyDisBtn = document.getElementById('proxy-disconnect');
dom.engineEl = document.getElementById('current-search-engine');
dom.duckToggleBtn = document.getElementById('duck-toggle-btn');
dom.privateBadge = document.getElementById('private-search-badge');
dom.proxyAutoBtn = document.getElementById('proxy-auto');

listen('adblock-toggle-btn', 'click', async () => {
  await window.velox.adToggle();
  updAd();
});

listen('duck-toggle-btn', 'click', async () => {
  const curr = await window.velox.getSearch();
  const next = curr === 'duckduckgo' ? 'google' : 'duckduckgo';
  await window.velox.setSearch(next);
  updDuck();
});

listen('proxy-auto', 'click', async () => {
  const btn = document.getElementById('proxy-auto');
  btn.textContent = 'Connecting...';
  await window.velox.proxyAuto();
  await updProxy();
  await updDuck();
  btn.textContent = 'Auto-Connect to Velox';
});

listen('proxy-disconnect', 'click', async () => {
  await window.velox.proxyOff();
  await updProxy();
  await updDuck();
});

updAd();
updProxy();
updDuck();
setInterval(updAd, 5000);
setInterval(updProxy, 5000);
setInterval(updDuck, 5000);
