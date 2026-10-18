/* Verification: real browser, real file:// path, real canvas.
   usage: node test/verify.js */
const path = require('path');
const fs = require('fs');
const { Browser, sleep } = require('./browser');

const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name + (extra ? '   ' + extra : '')); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '   ' + extra : '')); }
}

(async () => {
  const b = await Browser.launch({ w: 1600, h: 900, port: 9455 });
  const errs = [];
  b.handlers.push(m => {
    if (m.method === 'Runtime.exceptionThrown') errs.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push('ERR ' + m.params.args.map(a => a.value).join(' '));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errs.push('LOG ' + m.params.entry.text);
    if (m.method === 'Network.loadingFailed' && m.params.errorText !== 'net::ERR_ABORTED') errs.push('NETFAIL ' + m.params.errorText);
  });

  await b.goto('file:///' + ROOT.replace(/\\/g, '/') + '/index.html?bare=1&still=1', 1800);

  /* ---- static ---- */
  const st = await b.eval(`(function(){
    var s = window.SONG;
    var cues = K.Scene.cues;
    var ts = cues.map(function(c){return c.t;});
    var sorted = ts.every(function(v,i){ return i===0 || v > ts[i-1]; });
    var gaps = [];
    for (var i=1;i<cues.length;i++) gaps.push(+(ts[i]-ts[i-1]).toFixed(3));
    return {
      dur: s.duration, lines: s.lines.length, cues: cues.length, sorted: sorted,
      first: ts[0], last: ts[ts.length-1], maxGap: Math.max.apply(null, gaps),
      blocks: K.Code.blocks.length,
      langs: K.Code.blocks.map(function(b){return b.lang;}),
      audioDur: document.getElementById('audio').duration
    };
  })()`);
  console.log('\n[ data ]');
  ok('audio duration is 282.800', Math.abs((st.audioDur || st.dur) - 282.8) < 0.2, String(st.audioDur));
  ok('39 lyric lines', st.lines === 39);
  ok('cue times strictly increasing', st.sorted);
  ok('cues start at 0', st.first === 0);
  ok('cues cover the film', st.last > 270, 'last=' + st.last);
  ok('no gap longer than 40s', st.maxGap < 40, 'max=' + st.maxGap);
  ok('7 source languages', st.blocks === 7, st.langs.join(','));

  /* ---- every cue draws without throwing ---- */
  console.log('\n[ render ]');
  const bad = await b.eval(`(function(){
    var out = [];
    var cv = document.createElement('canvas'); cv.width=8; cv.height=8;
    var cx = cv.getContext('2d');
    K.Scene.cues.forEach(function(cu){
      var t = cu.t + 0.4;
      if (t > SONG.duration) t = cu.t;
      try {
        var c = __MV.frame(t);
        cu.draw(cx, c);
      } catch (e) { out.push(cu.id + ': ' + e.message); }
    });
    return out;
  })()`);
  ok('every cue renders', bad.length === 0, bad.join(' | '));

  /* ---- determinism ---- */
  const times = [3, 12, 34, 47, 70, 99, 120, 158, 176, 188, 210, 240, 262, 279];
  const fwd = await b.eval(`(function(){
    var T = ${JSON.stringify(times)}, out = [];
    T.forEach(function(t){ out.push(__MV.renderAt(t)); });
    return out;
  })()`);
  const back = await b.eval(`(function(){
    var T = ${JSON.stringify(times.slice().reverse())}, out = {};
    T.forEach(function(t){
      __MV.renderAt(40); __MV.renderAt(200);          /* random jumps in between */
      out[t] = __MV.renderAt(t);
    });
    return out;
  })()`);
  let same = 0;
  times.forEach((t, i) => { if (back[t] === fwd[i]) same++; });
  ok('scrub is deterministic (14/14)', same === times.length, same + '/' + times.length);
  ok('frames actually differ', new Set(fwd).size > 10, new Set(fwd).size + ' distinct');

  /* ---- performance ---- */
  const perf = await b.eval(`(function(){
    var T = [10, 30, 47, 99, 120, 158, 188, 215, 240, 262];
    var n = 0, t0 = performance.now();
    for (var k = 0; k < 3; k++) for (var i = 0; i < T.length; i++) { __MV.renderAt(T[i] + k * 0.05); n++; }
    var dt = (performance.now() - t0) / n;
    return { ms: dt, w: K.W, h: K.H };
  })()`);
  ok('frame time under 22ms', perf.ms < 22, perf.ms.toFixed(2) + 'ms @ ' + perf.w + 'x' + perf.h);

  /* ---- lyric coverage ---- */
  const cover = await b.eval(`(function(){
    var L = SONG.lines, miss = [];
    L.forEach(function(ln, i){
      var n = 40, hit = 0;
      for (var k = 0; k <= n; k++) {
        var c = __MV.frame(ln.t + (ln.d - 0.2) * k / n);
        if (c.li === i) hit++;
      }
      if (hit < 30) miss.push(i + ':' + hit + '/' + (n + 1));
    });
    return miss;
  })()`);
  ok('lyrics hold through their own line', cover.length === 0, cover.join(' '));

  /* ---- epilogue narration ---- */
  const nar = await b.eval(`(function(){
    var N = __MV.narration, bad = [];
    for (var i = 0; i < N.length; i++) {
      if (i && N[i].t <= N[i-1].t + N[i-1].d - 0.1) bad.push('overlap ' + i);
      if (N[i].t + N[i].d > __MV.duration) bad.push('past end ' + i);
      if (!N[i].en || !N[i].zh) bad.push('missing text ' + i);
    }
    return { n: N.length, first: N[0].t, last: N[N.length-1].t + N[N.length-1].d, bad: bad };
  })()`);
  ok('8 epilogue lines', nar.n === 8, JSON.stringify(nar.bad));
  ok('epilogue sits in the outro', nar.first > 247 && nar.last < 277,
    nar.first.toFixed(1) + ' → ' + nar.last.toFixed(1));

  /* ---- playback ---- */
  const play = await b.eval(`(function(){
    __MV.seek(100); __MV.play();
    return { t0: __MV.time, paused: !__MV.playing };
  })()`);
  await sleep(1400);
  const play2 = await b.eval(`(function(){
    var a = __MV.state();
    __MV.pause();
    var d = __MV.state();
    return { t: a.t, aT: a.audioT, paused: d.paused, cue: a.cue };
  })()`);
  ok('playback advances the clock', play2.t > play.t0 + 0.9, play.t0.toFixed(2) + ' → ' + play2.t.toFixed(2));
  ok('clock matches audio.currentTime', Math.abs(play2.t - play2.aT) < 0.05);
  ok('pause stops it', play2.paused === true);
  ok('seek lands on the right cue', play2.cue === 'ignite', play2.cue);

  /* ---- asset locality ---- */
  const res = await b.eval(`(function(){
    return {
      urls: performance.getEntriesByType('resource').map(function(r){ return r.name; }),
      src: document.getElementById('audio').currentSrc || document.getElementById('audio').src,
      dur: document.getElementById('audio').duration
    };
  })()`);
  const external = res.urls.filter(u => /^https?:/.test(u));
  ok('no external requests', external.length === 0, external.join(','));
  ok('audio points at kokoro.mp3', /kokoro\.mp3$/.test(res.src), res.src.split('/').pop());
  ok('audio decoded', res.dur > 280 && res.dur < 286, String(res.dur));

  console.log('\n[ console ]');
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));

  console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
  b.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
