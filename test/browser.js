/* Minimal Chrome DevTools Protocol client — no dependencies, no install.
   Used only by the verification script; the film itself never needs it. */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const CANDIDATES = [
  process.env.MV_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
];

function findBrowser() {
  for (const c of CANDIDATES) if (c && fs.existsSync(c)) return c;
  return null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function httpJson(url) {
  return new Promise((res, rej) => {
    http.get(url, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } }); })
      .on('error', rej);
  });
}

class Browser {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.events = []; this.handlers = [];
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        if (m.error) rej(new Error(m.error.message)); else res(m.result);
      } else if (m.method) {
        this.events.push(m);
        this.handlers.forEach(h => h(m));
      }
    };
  }
  static async launch(opts) {
    opts = opts || {};
    const bin = findBrowser();
    if (!bin) throw new Error('no Chrome/Edge found (set MV_BROWSER=/path/to/browser)');
    const port = opts.port || 9411;
    const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'mvprof-'));
    const proc = spawn(bin, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--mute-audio',
      '--autoplay-policy=no-user-gesture-required', '--force-device-scale-factor=1',
      '--disable-features=PaintHolding,TranslateUI', '--no-first-run', '--no-default-browser-check',
      '--window-size=' + (opts.w || 1600) + ',' + (opts.h || 900),
      '--remote-debugging-port=' + port, '--user-data-dir=' + prof, 'about:blank'
    ], { stdio: ['ignore', 'ignore', 'ignore'] });

    let list = null;
    for (let i = 0; i < 80; i++) {
      try { list = await httpJson(`http://127.0.0.1:${port}/json/list`); if (list && list.length) break; } catch (e) { }
      await sleep(150);
    }
    if (!list || !list.length) throw new Error('devtools endpoint never came up');
    const page = list.find(t => t.type === 'page') || list[0];
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    const b = new Browser(ws);
    b.proc = proc; b.profile = prof;
    await b.send('Page.enable');
    await b.send('Runtime.enable');
    await b.send('Log.enable');
    await b.send('Network.enable');
    await b.send('Emulation.setDeviceMetricsOverride', {
      width: opts.w || 1600, height: opts.h || 900, deviceScaleFactor: 1, mobile: false
    });
    if (opts.onEvent) b.handlers.push(opts.onEvent);
    return b;
  }
  send(method, params) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  async goto(url, waitMs) {
    await this.send('Page.navigate', { url });
    await sleep(waitMs === undefined ? 800 : waitMs);
  }
  async eval(expr, awaitPromise) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr, awaitPromise: awaitPromise !== false, returnByValue: true
    });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error('page threw: ' + (d.exception && d.exception.description || d.text));
    }
    return r.result.value;
  }
  async shot(file) {
    const r = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
  }
  close() {
    try { this.ws.close(); } catch (e) { }
    try { this.proc.kill(); } catch (e) { }
    try { fs.rmSync(this.profile, { recursive: true, force: true }); } catch (e) { }
  }
}

module.exports = { Browser, findBrowser, sleep };
