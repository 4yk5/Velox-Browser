const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
];

function GetUA() {
  return UAS[Math.floor(Math.random() * UAS.length)];
}

function SetPrivacy(wc) {
  wc.setUserAgent(GetUA());

  wc.on('dom-ready', () => {
    wc.executeJavaScript(`
      if (window.RTCPeerConnection) {
        const origRTC = window.RTCPeerConnection;
        window.RTCPeerConnection = function(cfg, cst) {
          if (cfg && cfg.iceServers) cfg.iceServers = [];
          return new origRTC(cfg, cst);
        };
        window.RTCPeerConnection.prototype = origRTC.prototype;
      }

      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type) {
        const ctx = this.getContext('2d');
        if (ctx) {
          const img = ctx.getImageData(0, 0, this.width, this.height);
          for (let i = 0; i < img.data.length; i += 4) {
            img.data[i] ^= 1;
          }
          ctx.putImageData(img, 0, 0);
        }
        return origToDataURL.apply(this, arguments);
      };

      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });

      if (navigator.getBattery) {
        navigator.getBattery = () => Promise.reject('Not supported');
      }
    `).catch(() => {});

    wc.executeJavaScript(`
      const bait = document.createElement('div');
      bait.className = 'ad-banner ads adsbox ad-placement';
      bait.id = 'ad-container';
      bait.style.cssText = 'position:absolute!important;left:-9999px!important;top:-9999px!important;width:1px!important;height:1px!important;overflow:hidden!important;';
      bait.innerHTML = '<div class="ad" style="width:1px;height:1px;"></div>';
      document.body.appendChild(bait);

      Object.defineProperty(bait, 'offsetHeight', { get: () => 250 });
      Object.defineProperty(bait, 'offsetWidth', { get: () => 300 });
      Object.defineProperty(bait, 'clientHeight', { get: () => 250 });
      Object.defineProperty(bait, 'clientWidth', { get: () => 300 });

      window.canRunAds = true;
      window.adBlockEnabled = false;
      window.adblockDetected = false;
      window.__AD_BLOCKER_DETECTED__ = false;

      const origObs = MutationObserver.prototype.observe;
      MutationObserver.prototype.observe = function(target, config) {
        if (target && target.classList &&
            (target.classList.contains('ad') ||
             target.classList.contains('ads') ||
             target.id === 'ad-container')) {
          return;
        }
        return origObs.apply(this, arguments);
      };
    `).catch(() => {});
  });
}

module.exports = { SetPrivacy, GetUA };
