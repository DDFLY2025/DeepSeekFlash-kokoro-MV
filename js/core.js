/* =====================================================================
   core.js — palette, deterministic noise, easing, canvas helpers.
   Everything here is a pure function of its arguments, so every frame can
   be rebuilt from a single scalar t.
   ===================================================================== */
window.K = {};
(function (K) {

  K.W = 1600; K.H = 900; K.S = 1; K.DPR = 1;

  /* ---------------- palette ----------------
     black / white / gray base, with syntax-highlight accents used the way a
     code editor uses them: purple = keyword, green = string, amber = number,
     cyan = function. Cyan and gold are the film's two "warm" poles.        */
  K.P = {
    ink: '#f4f5f7',
    ink90: 'rgba(244,245,247,.90)',
    ink70: 'rgba(244,245,247,.70)',
    ink50: 'rgba(244,245,247,.50)',
    ink30: 'rgba(244,245,247,.30)',
    ink18: 'rgba(244,245,247,.18)',
    ink10: 'rgba(244,245,247,.10)',
    ink06: 'rgba(244,245,247,.06)',
    cyan: '#5ee7ff',
    cyanD: 'rgba(94,231,255,.55)',
    gold: '#ffc247',
    goldD: 'rgba(255,194,71,.55)',
    purple: '#c39bff',
    green: '#9ee493',
    amber: '#ffb454',
    red: '#ff453a',
    redD: 'rgba(255,69,58,.55)',
    blue: '#7aa2ff',
    magenta: '#ff7ad9',
    /* syntax theme */
    syn: {
      kw: '#c39bff', type: '#c39bff', str: '#9ee493', num: '#ffb454',
      fn: '#5ee7ff', cmt: 'rgba(244,245,247,.34)', op: 'rgba(244,245,247,.82)',
      var: 'rgba(244,245,247,.94)', punc: 'rgba(244,245,247,.55)', pre: '#ffb454'
    }
  };

  K.F = {
    code: '"Cascadia Mono",Consolas,"SF Mono","Yu Gothic UI","Yu Gothic","Meiryo","Noto Sans JP",monospace',
    ui: '"Inter","Segoe UI",system-ui,"Helvetica Neue",Arial,sans-serif',
    jp: '"Yu Gothic UI","Yu Gothic","Meiryo","Hiragino Sans","Noto Sans JP",sans-serif',
    math: '"Cambria Math","STIX Two Math","Latin Modern Math","Times New Roman",serif'
  };

  /* ---------------- math ---------------- */
  K.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  K.lp = function (a, b, t) { return a + (b - a) * t; };
  K.st = function (a, b, t) { return K.clamp((t - a) / (b - a), 0, 1); };
  K.smooth = function (t) { t = K.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  K.easeOut = function (t) { t = K.clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); };
  K.easeIn = function (t) { t = K.clamp(t, 0, 1); return t * t * t; };
  K.easeInOut = function (t) { t = K.clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  K.easeExpo = function (t) { t = K.clamp(t, 0, 1); return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); };
  K.easeBack = function (t) { t = K.clamp(t, 0, 1); var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  K.lerp2 = function (ax, ay, bx, by, t) { return [K.lp(ax, bx, t), K.lp(ay, by, t)]; };

  K.frac = function (x) { return x - Math.floor(x); };

  /* the stored envelope is sampled every 100 ms; read between samples so a
     drawn waveform is a curve and not a staircase */
  K.envS = function (t) {
    var s = window.SONG, st = s.envStep;
    var x = t / st, i = Math.floor(x), f = x - i;
    return K.lp(s.envAt(i * st), s.envAt((i + 1) * st), f);
  };

  /* deterministic hash noise — the only source of "randomness" in the film */
  K.rnd = function (i, s) {
    var x = Math.sin(i * 12.9898 + (s || 0) * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  K.rnd2 = function (x, y, s) {
    var v = Math.sin(x * 127.1 + y * 311.7 + (s || 0) * 74.7) * 43758.5453;
    return v - Math.floor(v);
  };
  K.srnd = function (i, s) { return K.rnd(i, s) * 2 - 1; };
  /* smooth 1d value noise */
  K.vnoise = function (x, s) {
    var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return K.lp(K.rnd(i, s), K.rnd(i + 1, s), u);
  };
  /* signed beat impulse: 1 at the hit, decays over `k` seconds */
  K.imp = function (t, times, k) {
    var best = 0;
    for (var i = 0; i < times.length; i++) {
      var d = t - times[i];
      if (d >= 0 && d < k) { var v = 1 - d / k; v *= v; if (v > best) best = v; }
      if (times[i] > t) break;
    }
    return best;
  };

  /* ---------------- color ---------------- */
  K.hex2rgb = function (h) {
    if (h[0] !== '#') return [255, 255, 255];
    h = h.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  K.rgba = function (hex, a) {
    var c = K.hex2rgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  };
  K.mix = function (h1, h2, t) {
    var a = K.hex2rgb(h1), b = K.hex2rgb(h2);
    return 'rgb(' + Math.round(K.lp(a[0], b[0], t)) + ',' + Math.round(K.lp(a[1], b[1], t)) + ',' +
      Math.round(K.lp(a[2], b[2], t)) + ')';
  };

  /* ---------------- canvas ---------------- */
  K.setFont = function (ctx, px, family, weight, italic) {
    ctx.font = (italic ? 'italic ' : '') + (weight || 400) + ' ' + px.toFixed(1) + 'px ' + family;
  };
  K.text = function (ctx, s, x, y, opt) {
    opt = opt || {};
    if (opt.font) ctx.font = opt.font;
    if (opt.align) ctx.textAlign = opt.align;
    if (opt.base) ctx.textBaseline = opt.base;
    if (opt.color) ctx.fillStyle = opt.color;
    if (opt.alpha != null) ctx.globalAlpha = opt.alpha;
    if (opt.ls != null && 'letterSpacing' in ctx) ctx.letterSpacing = opt.ls + 'px';
    ctx.fillText(s, x, y);
    if (opt.ls != null && 'letterSpacing' in ctx) ctx.letterSpacing = '0px';
  };

  /* draw a string three times with channel offsets — chromatic dispersion.
     This is the film's signature mis-registration, applied per element.     */
  K.dispText = function (ctx, s, x, y, amt, opt) {
    if (amt < 0.35) { K.text(ctx, s, x, y, opt); return; }
    var a = ctx.globalAlpha;
    var o = opt || {};
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a * 0.55;
    K.text(ctx, s, x - amt, y - amt * 0.16, merge(o, { color: 'rgba(255,60,50,.9)' }));
    K.text(ctx, s, x + amt, y + amt * 0.16, merge(o, { color: 'rgba(70,235,255,.85)' }));
    ctx.restore();
    ctx.globalAlpha = a;
    K.text(ctx, s, x, y, opt);
  };
  function merge(a, b) {
    var o = {}, k;
    for (k in a) o[k] = a[k];
    for (k in b) o[k] = b[k];
    return o;
  }

  /* rounded rect path */
  K.rr = function (ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  /* ---------------- background ----------------
     deep grey vertical pinstripes, mood tint, top glow, vignette.
     `mood` is a colour that the whole frame is washed with; `alert` adds the
     red breathing that the critical section needs.                          */
  /* The background is a fixed composite of fill, pinstripes, glow and
     vignette, so it is built once per mood colour and then blitted. Drawing
     a few hundred one-pixel rects every frame was the single biggest cost in
     the whole renderer. */
  var bgCache = { key: '', base: null, alert: null };

  function buildBg(W, H, S, opt) {
    var c = bgCache.base || (bgCache.base = document.createElement('canvas'));
    c.width = W; c.height = H;
    var g2 = c.getContext('2d');
    g2.fillStyle = opt.mood || '#141518';
    g2.fillRect(0, 0, W, H);

    if (opt.plain) {                       /* the ending: nothing but black */
      var vg0 = g2.createRadialGradient(W * 0.5, H * 0.5, H * 0.34, W * 0.5, H * 0.5, H * 1.0);
      vg0.addColorStop(0, 'rgba(0,0,0,0)');
      vg0.addColorStop(1, 'rgba(0,0,0,.55)');
      g2.fillStyle = vg0;
      g2.fillRect(0, 0, W, H);
      return;
    }
    var pitch = (opt.pitch || 7) * S;
    g2.fillStyle = opt.stripCol || 'rgba(255,255,255,.05)';
    for (var i = 0; i < Math.ceil(W / pitch); i++) {
      if (i % 2 === 0) g2.fillRect(i * pitch, 0, pitch * 0.46, H);
    }
    g2.fillStyle = 'rgba(0,0,0,' + ((opt.stripe || 0.05) * 0.9).toFixed(3) + ')';
    var p2 = pitch * 9;
    for (var j = 0; j < Math.ceil(W / p2); j++) g2.fillRect(j * p2, 0, p2 * 0.5, H);

    var g = g2.createRadialGradient(W * 0.5, -H * 0.25, 0, W * 0.5, -H * 0.25, H * 1.25);
    g.addColorStop(0, K.rgba(opt.glow || '#ffffff', opt.glowA == null ? 0.05 : opt.glowA));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    g2.fillStyle = g;
    g2.fillRect(0, 0, W, H);

    var vg = g2.createRadialGradient(W * 0.5, H * 0.48, H * 0.30, W * 0.5, H * 0.48, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, K.rgba('#000000', opt.vig == null ? 0.5 : opt.vig));
    g2.fillStyle = vg;
    g2.fillRect(0, 0, W, H);
  }

  function buildAlert(W, H) {
    var c = bgCache.alert || (bgCache.alert = document.createElement('canvas'));
    c.width = W; c.height = H;
    var g2 = c.getContext('2d');
    var ag = g2.createRadialGradient(W * 0.5, H * 0.5, H * 0.22, W * 0.5, H * 0.5, H * 0.95);
    ag.addColorStop(0, 'rgba(255,30,24,0)');
    ag.addColorStop(1, 'rgba(255,26,20,.55)');
    g2.fillStyle = ag;
    g2.fillRect(0, 0, W, H);
  }

  K.bg = function (ctx, opt) {
    var W = K.W, H = K.H, S = K.S;
    var key = (opt.mood || '') + '|' + W + 'x' + H + '|' + S.toFixed(2) + '|' +
      (opt.vig == null ? 0.5 : opt.vig) + '|' + (opt.glow || '') + (opt.plain ? '|plain' : '');
    if (bgCache.key !== key) {
      buildBg(W, H, S, opt);
      buildAlert(W, H);
      bgCache.key = key;
    }
    ctx.drawImage(bgCache.base, 0, 0);
    if (opt.alert > 0.004) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, opt.alert);
      ctx.drawImage(bgCache.alert, 0, 0);
      ctx.restore();
    }
  };

  /* thin hairline grid — the "flat UI" substrate */
  K.hair = function (ctx, step, alpha, col) {
    var W = K.W, H = K.H;
    ctx.save();
    ctx.strokeStyle = col || 'rgba(244,245,247,' + (alpha || 0.05) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = 0; x <= W; x += step) { ctx.moveTo(Math.round(x) + .5, 0); ctx.lineTo(Math.round(x) + .5, H); }
    for (var y = 0; y <= H; y += step) { ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(W, Math.round(y) + .5); }
    ctx.stroke();
    ctx.restore();
  };

  /* small deterministic PRNG for per-frame particle fields */
  K.mulberry = function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };

})(window.K);
