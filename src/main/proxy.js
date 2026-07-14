const { app } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class ProxyMgr {
  constructor(ses) {
    this.ses = ses;
    this.active = false;
    this.conn = false;
    this.currProxy = null;
    this.torProc = null;
    
    this.torDir = path.join(app.getPath('userData'), 'tor-data');
    if (!fs.existsSync(this.torDir)) {
      fs.mkdirSync(this.torDir, { recursive: true });
    }
  }

  async Start() {
    if (this.torProc) return { success: true, proxy: 'socks5://127.0.0.1:9050' };
    this.conn = true;

    return new Promise((resolve) => {
      try {
        const torPath = app.isPackaged 
          ? path.join(process.resourcesPath, 'tor', 'tor.exe') 
          : path.join(__dirname, '../../assets/tor/tor.exe');

        this.torProc = spawn(torPath, [
          '--DataDirectory', this.torDir,
          '--SocksPort', '9050'
        ]);

        let ready = false;

        this.torProc.stdout.on('data', (data) => {
          if (data.toString().includes('Bootstrapped 100%') && !ready) {
            ready = true;
            this.active = true;
            this.conn = false;
            this.currProxy = 'socks5://127.0.0.1:9050';
            this.ses.setProxy({ proxyRules: this.currProxy });
            resolve({ success: true, proxy: this.currProxy });
          }
        });

        this.torProc.stderr.on('data', () => {});

        this.torProc.on('close', () => {
          this.active = false;
          this.conn = false;
          this.currProxy = null;
          this.torProc = null;
        });
        
        setTimeout(() => {
          if (!ready) {
            this.conn = false;
            resolve({ success: false, error: 'Tor bootstrap timeout' });
          }
        }, 45000);

      } catch (err) {
        this.conn = false;
        resolve({ success: false, error: err.message });
      }
    });
  }

  async Set(proxy) {
    try {
      await this.ses.setProxy({ proxyRules: proxy });
      this.active = true;
      this.currProxy = proxy;
      return { success: true, proxy };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async Stop() {
    if (this.torProc) {
      this.torProc.kill();
      this.torProc = null;
    }
    try {
      await this.ses.setProxy({ proxyRules: '' });
      this.active = false;
      this.currProxy = null;
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  Status() {
    return {
      active: this.active,
      connecting: this.conn,
      currentProxy: this.currProxy,
      availableProxies: 1
    };
  }

  async Rotate() {
    return this.Start();
  }
}

module.exports = { ProxyMgr };
