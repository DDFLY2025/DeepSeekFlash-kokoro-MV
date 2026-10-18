/* Renders chosen timestamps headlessly and writes PNGs, so the picture can be
   looked at without a human sitting through four minutes.
   usage: node test/shot.js [t1 t2 ...] */
const path = require('path');
const fs = require('fs');
const { Browser, sleep } = require('./browser');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'test', 'stills');
const TIMES = process.argv.slice(2).map(Number).filter(n => !isNaN(n));
const TS = TIMES.length ? TIMES : [1.6, 5.5, 12, 19, 24.4, 28.6, 33.2, 35.4, 40, 46, 53, 60, 67, 73, 78.6, 82.6, 88, 93, 95.6, 99, 105, 112, 120, 128, 139, 142.6, 146, 149, 152.6, 156.5, 161, 168, 174, 179, 183.5, 188, 193.4, 197, 204, 209, 213, 217, 219.4, 223, 226.5, 229.6, 231.4, 238, 246, 252, 262, 279];

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const b = await Browser.launch({ w: 1600, h: 900, port: 9422 });
  const errs = [];
  b.handlers.push(m => {
    if (m.method === 'Runtime.exceptionThrown') errs.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push('ERR ' + m.params.args.map(a => a.value).join(' '));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errs.push('LOG ' + m.params.entry.text);
  });
  await b.goto('file:///' + ROOT.replace(/\\/g, '/') + '/index.html?bare=1&still=1', 1600);

  const info = await b.eval(`(function(){ try { return {ok:!!window.__MV, dur: window.__MV && __MV.duration, cues: (window.K&&K.Scene.cues.length)} } catch(e){ return {err:String(e)} } })()`);
  console.log('page:', JSON.stringify(info));
  if (errs.length) console.log(errs.join('\n'));

  for (const t of TS) {
    try {
      const r = await b.eval(`(function(){ __MV.renderAt(${t}); return 1 })()`);
      await sleep(60);
      await b.shot(path.join(OUT, `t${String(Math.round(t * 10)).padStart(5, '0')}.png`));
      console.log('shot', t.toFixed(1), r);
    } catch (e) {
      console.log('FAIL', t, e.message);
    }
  }
  if (errs.length) console.log('--- errors ---\n' + errs.join('\n'));
  b.close();
})().catch(e => { console.error(e); process.exit(1); });
