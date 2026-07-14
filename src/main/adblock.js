const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const fetch = require('cross-fetch');

let blocker;
let enabled = true;
let stats = { blocked: 0, session: 0 };
let currSes;

async function InitAd(ses) {
  currSes = ses;
  if (!ses.registerPreloadScript) ses.registerPreloadScript = () => {};
  blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
  blocker.enableBlockingInSession(ses, { enablePreloads: false });
  blocker.on('request-blocked', () => {
    stats.blocked++;
    stats.session++;
  });
}

function Stats() {
  return { ...stats, enabled };
}

function Enabled() {
  return enabled;
}

function Toggle() {
  enabled = !enabled;
  if (blocker && currSes) {
    if (enabled) {
      blocker.enableBlockingInSession(currSes, { enablePreloads: false });
    } else {
      blocker.disableBlockingInSession(currSes);
    }
  }
  return enabled;
}

module.exports = { InitAd, Stats, Enabled, Toggle };
