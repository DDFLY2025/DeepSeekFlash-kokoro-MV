/* =====================================================================
   scenes.js — the score.

   Every cue is {t, id, name, draw(ctx, c)}. A cue is a pure function of the
   frame context: no state survives between calls, so scrubbing backwards
   produces exactly the frame the film would have had at that time.
   ===================================================================== */
(function (K) {
  var P = K.P, G = K.G, UI = K.UI;
  var cues = [];

  function add(o) { cues.push(o); return o; }
  function S(l) { return K.Code.byLang(l); }
  function blink(t, hz) { return (t % (1 / (hz || 2))) < 0.5 / (hz || 2); }
  function typed(lt, start, cps, total) { return K.clamp(Math.floor((lt - start) * cps), 0, total); }

  /* rotate point p about the line (A, unit axis u) by th — Rodrigues */
  function rotAxis(p, A, u, th) {
    var v = [p[0] - A[0], p[1] - A[1], p[2] - A[2]];
    var c = Math.cos(th), s = Math.sin(th);
    var d = v[0] * u[0] + v[1] * u[1] + v[2] * u[2];
    var cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    return [
      A[0] + v[0] * c + cr[0] * s + u[0] * d * (1 - c),
      A[1] + v[1] * c + cr[1] * s + u[1] * d * (1 - c),
      A[2] + v[2] * c + cr[2] * s + u[2] * d * (1 - c)
    ];
  }

  /* a 2D panel floating in 3D: viewport-aligned, scaled by depth */
  function panel3(ctx, x, y, z, w, h, o) {
    o = o || {};
    var pr = G.proj([x, y, z]);
    if (!pr) return null;
    var s = pr.s;                 /* pixels per world unit */
    var pw = w * s, ph = h * s;
    if (pw < 4 || ph < 4) return null;
    var a = (o.alpha == null ? 1 : o.alpha) * K.clamp(1 - Math.max(0, pr.z - 4) / (o.far || 46), 0, 1);
    if (a < 0.02) return null;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = o.bg || 'rgba(9,10,12,.82)';
    ctx.fillRect(pr.x - pw / 2, pr.y - ph / 2, pw, ph);
    ctx.strokeStyle = o.border || P.ink30;
    ctx.lineWidth = K.clamp(s * 0.006, 0.7, 1.6);
    ctx.strokeRect(pr.x - pw / 2, pr.y - ph / 2, pw, ph);
    if (o.title) {
      var th = K.clamp(ph * 0.24, 9, 20);
      ctx.beginPath();
      ctx.moveTo(pr.x - pw / 2, pr.y - ph / 2 + th);
      ctx.lineTo(pr.x + pw / 2, pr.y - ph / 2 + th);
      ctx.strokeStyle = o.border || P.ink18;
      ctx.stroke();
      K.setFont(ctx, K.clamp(ph * 0.10, 5, 10.5), K.F.code, 400);
      ctx.fillStyle = o.titleCol || P.ink70;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(o.title.toUpperCase(), pr.x - pw / 2 + 7, pr.y - ph / 2 + th * 0.55);
    }
    /* when the panel is too small to read, suggest text with rules —
       the eye reads it as a document, and it costs nothing */
    if (o.autobars !== false && pw < 250 && pw > 46) {
      var pad = 7;
      var top = pr.y - ph / 2;
      var th2 = K.clamp(ph * 0.24, 9, 20);
      var step = Math.max(2.4, ph * 0.085);
      var rows = Math.floor((ph - th2 - 10) / step);
      ctx.fillStyle = o.barCol || P.ink;
      for (var r2 = 0; r2 < rows && r2 < 9; r2++) {
        var ww = pw * (0.26 + K.rnd(r2 + (o.seed || 0), 3.7) * 0.60);
        ctx.globalAlpha = a * (0.16 + 0.20 * K.rnd(r2 * 3 + (o.seed || 0), 1.3));
        ctx.fillRect(pr.x - pw / 2 + pad, top + th2 + 8 + r2 * step, ww, Math.max(0.8, step * 0.32));
      }
      ctx.globalAlpha = a;
    }
    ctx.restore();
    return { x: pr.x, y: pr.y, s: s, a: a, z: pr.z, w: pw, h: ph };
  }

  /* ---------- shared bits ---------- */
  function topRule(ctx, c, txt, right) {
    var m = K.W * 0.045, y = K.H * 0.055;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = P.ink18;
    ctx.beginPath();
    ctx.moveTo(m, y + 14); ctx.lineTo(K.W - m, y + 14);
    ctx.stroke();
    ctx.restore();
    UI.label(ctx, txt, m, y, { fs: 10 * c.S, color: P.ink50, tick: true });
    if (right) UI.label(ctx, right, K.W - m, y, { fs: 10 * c.S, color: P.ink30, align: 'right' });
  }

  function cornerMarks(ctx, c) {
    var m = K.W * 0.022;
    UI.corners(ctx, m, m, K.W - m * 2, K.H - m * 2, 26 * c.S, P.ink18, 0.8);
  }

  /* =====================================================================
     0.0 — CRT POWER ON
     ===================================================================== */
  add({
    t: 0, id: 'crt', name: 'POWER', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var cy = H * 0.5;
      ctx.save();
      if (t < 0.30) {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        var w = K.easeOut(t / 0.30) * W;
        ctx.fillStyle = 'rgba(255,255,255,' + (0.9 * K.easeOut(t / 0.12)) + ')';
        ctx.fillRect(W / 2 - w / 2, cy - 1, w, 2);
        ctx.fillStyle = 'rgba(94,231,255,.22)';
        ctx.fillRect(W / 2 - w / 2, cy - 6, w, 12);
      } else if (t < 0.66) {
        var hh = K.easeOut((t - 0.30) / 0.34) * H;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, cy - hh / 2, W, hh);
      } else if (t < 1.12) {
        var k = K.clamp((t - 0.66) / 0.46, 0, 1);
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = (1 - k) * 0.9;
        ctx.fillRect(0, cy - 1 - k * 6, W, 2 + k * 12);
      } else {
        /* the room is dark; one cursor is already waiting where the BIOS
           will print its first line */
        var m = W * 0.075;
        ctx.fillStyle = 'rgba(244,245,247,' + (blink(t, 1.5) ? 0.85 : 0.10) + ')';
        ctx.fillRect(m, H * 0.30 - 12 * S0, 9 * S0, 15 * S0);
      }
      /* degauss */
      if (t > 0.66 && t < 1.5) {
        var n = Math.floor(t * 34);
        ctx.globalAlpha = 0.05 * (1 - (t - 0.66) / 0.84);
        ctx.fillStyle = P.cyan;
        for (var i = 0; i < 7; i++) ctx.fillRect(0, K.rnd(n + i, 2) * H, W, 1 + K.rnd(n + i, 9) * 3);
      }
      ctx.restore();
    }
  });

  /* multi-colour typewriter line block: each line is a list of segments */
  function segLines(ctx, lines, x, y, fs, lh, budget, o) {
    o = o || {};
    K.setFont(ctx, fs, K.F.code, 400);
    var cw = ctx.measureText('M').width;
    var head = null;
    for (var i = 0; i < lines.length; i++) {
      var segs = lines[i], col = 0;
      for (var j = 0; j < segs.length; j++) {
        var s = segs[j].s, take = s;
        if (budget < s.length) take = s.slice(0, Math.max(0, budget));
        if (take.length) {
          ctx.fillStyle = segs[j].c || P.ink70;
          ctx.fillText(take, x + col * cw, y + i * lh);
        }
        col += s.length; budget -= take.length;
        if (budget <= 0) { head = { x: x + col * cw, y: y + i * lh }; break; }
      }
      if (budget <= 0) break;
      budget -= 1;
      head = { x: x + col * cw, y: y + i * lh };
    }
    if (o.caret && head) {
      ctx.fillStyle = P.cyan;
      ctx.fillRect(head.x + 1, head.y - fs * 0.80, fs * 0.52, fs);
    }
  }
  function segLen(lines) {
    var n = 0;
    for (var i = 0; i < lines.length; i++) {
      var m = 0;
      for (var j = 0; j < lines[i].length; j++) m += lines[i][j].s.length;
      n += m + 1;
    }
    return n;
  }

  /* =====================================================================
     2.2 — BIOS POST
     ===================================================================== */
  add({
    t: 2.2, id: 'bios', name: 'POST', draw: function (ctx, c) {
      var W = K.W, H = K.H, S0 = c.S, m = W * 0.075;
      var t = c.lt;
      topRule(ctx, c, 'KOKORO BIOS  v6.1.0', 'POST  ' + (t < 3.4 ? 'RUNNING' : 'OK'));
      var L = [
        [{ s: 'KOKORO SYSTEMS', c: P.ink }, { s: '   (C) 1991-20XX   ALL RIGHTS RESERVED', c: P.ink30 }],
        [],
        [{ s: 'CPU   LONELY CORE  @ 140.00 BPM', c: P.ink70 }, { s: '        OK', c: P.green }],
        [{ s: 'MEM   2,828,000 CELLS', c: P.ink70 }, { s: '                 OK', c: P.green }],
        [{ s: 'BUS   44,100 Hz / 16 BIT', c: P.ink70 }, { s: '               OK', c: P.green }],
        [{ s: 'DISK  /dev/kokoro  87% OCCUPIED', c: P.ink70 }, { s: '       OK', c: P.green }],
        [],
        [{ s: 'PROBE  heart', c: P.ink70 }, { s: ' ........................ ', c: P.ink30 }, { s: 'NOT FOUND', c: P.gold }],
        [{ s: 'PROBE  memory', c: P.ink70 }, { s: ' ....................... ', c: P.ink30 }, { s: '39 LINES', c: P.green }],
        [{ s: 'PROBE  others', c: P.ink70 }, { s: ' ....................... ', c: P.ink30 }, { s: '0', c: P.gold }],
        [],
        [{ s: '> mount /dev/kokoro', c: P.ink }]
      ];
      var fs = 14 * S0, lh = fs * 1.74;
      var total = segLen(L);
      var n = typed(t, 0.1, 56, total);
      ctx.save();
      ctx.textBaseline = 'alphabetic';
      segLines(ctx, L, m, H * 0.27, fs, lh, n, { caret: n < total && blink(t, 2.0) });
      ctx.restore();

      /* right: the empty socket */
      var cx = W * 0.775, cy = H * 0.40, r = Math.min(96 * S0, W * 0.07);
      ctx.save();
      ctx.strokeStyle = P.ink10;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.72, 0, 6.2832); ctx.stroke();
      ctx.strokeStyle = P.ink30;
      ctx.beginPath();
      for (var q = 0; q < 12; q++) {
        var a0 = q * Math.PI / 6;
        ctx.moveTo(cx + Math.cos(a0) * r * 0.80, cy + Math.sin(a0) * r * 0.80);
        ctx.lineTo(cx + Math.cos(a0) * r * 0.92, cy + Math.sin(a0) * r * 0.92);
      }
      ctx.stroke();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = P.goldD;
      ctx.strokeRect(cx - 15 * S0, cy - 15 * S0, 30 * S0, 30 * S0);
      ctx.setLineDash([]);
      /* progress: probing */
      UI.label(ctx, 'SOCKET  HEART', cx, cy + r + 30 * S0, { fs: 9.5 * S0, color: P.ink30, align: 'center', ls: 3 });
      UI.label(ctx, t > 3.2 ? 'EMPTY' : 'PROBING', cx, cy + r + 48 * S0,
        { fs: 9.5 * S0, color: t > 3.2 ? P.gold : P.ink30, align: 'center', ls: 3 });
      ctx.restore();

      /* memory count line at the bottom */
      ctx.save();
      K.setFont(ctx, 11 * S0, K.F.code, 400);
      ctx.fillStyle = P.ink30;
      ctx.fillText('MEMORY TEST  ' + String(Math.floor(K.clamp(t / 5.6, 0, 1) * 2828000)).replace(/\B(?=(\d{3})+(?!\d))/g, ','), m, H * 0.80);
      ctx.fillStyle = P.ink18;
      ctx.fillText('ESC: skip    DEL: setup    F2: restore heart', m, H * 0.845);
      ctx.restore();
      cornerMarks(ctx, c);
    }
  });

  /* =====================================================================
     8.5 — ASSEMBLY, long lens then orbit
     ===================================================================== */
  add({
    t: 8.5, id: 'build', name: 'ASSEMBLY', draw: function (ctx, c) {
      var t = c.lt, S0 = c.S;
      var open = K.easeInOut(K.st(1.9, 5.9, t));
      var fov = K.lp(2.0, 52, open);
      var sc = 1.75;
      var dist = G.fit(fov, sc, 0.55);
      var az = K.lp(0.02, 0.78, K.easeInOut(K.st(1.2, 6.0, t)));
      G.begin({ pos: [Math.sin(az) * dist, 0.30 + t * 0.05, Math.cos(az) * dist], tgt: [0, 0, 0], fov: fov });

      /* edges, welded in order: front face -> depth -> back face */
      var v = [];
      for (var i = 0; i < 8; i++) v.push([(i & 1 ? 1 : -1) * sc, (i & 2 ? 1 : -1) * sc, (i & 4 ? 1 : -1) * sc]);
      var E = [[0, 2], [1, 3], [4, 6], [5, 7], [0, 1], [2, 3], [4, 5], [6, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
      var order = [4, 5, 6, 7, 0, 1, 2, 3, 8, 9, 10, 11];
      for (var q = 0; q < order.length; q++) {
        var e = E[order[q]];
        var t0 = 0.25 + q * 0.30;
        var k = K.easeOut(K.st(t0, t0 + 0.34, t));
        if (k <= 0) continue;
        var a = v[e[0]], b = v[e[1]];
        var tip = [K.lp(a[0], b[0], k), K.lp(a[1], b[1], k), K.lp(a[2], b[2], k)];
        G.line(ctx, a, tip, { color: P.ink, alpha: 0.95, w: 1.15, depthFade: false });
        /* the ghost of the rest of the edge */
        G.line(ctx, tip, b, { color: P.ink, alpha: 0.10, w: 1, depthFade: false });
        if (k < 0.998) {
          var pp = G.proj(tip);
          if (pp) {
            ctx.save();
            ctx.globalAlpha = 0.95;
            ctx.fillStyle = P.cyan;
            ctx.fillRect(pp.x - 2, pp.y - 2, 4, 4);
            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = P.cyan;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(pp.x, pp.y, 10 + 26 * (1 - k), 0, 6.2832); ctx.stroke();
            ctx.restore();
          }
        }
      }
      /* corner nodes */
      for (var n = 0; n < 8; n++) {
        var pn = G.proj(v[n]);
        if (!pn) continue;
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = P.ink;
        ctx.fillRect(pn.x - 1.5, pn.y - 1.5, 3, 3);
        ctx.restore();
      }
      /* orbital guides */
      if (t > 2.2) {
        var aa = K.clamp((t - 2.2) / 1.2, 0, 1);
        for (var r = 0; r < 3; r++) {
          var pts = [];
          var rr = 3.0 + r * 0.95;
          for (var u = 0; u <= 72; u++) {
            var an = u / 72 * 6.2832 + t * (0.22 + r * 0.12);
            pts.push([Math.cos(an) * rr, Math.sin(an * 1.1 + r * 2) * 0.34, Math.sin(an) * rr]);
          }
          G.polyline(ctx, pts, { color: P.ink, alpha: 0.13 * aa, w: 1, depthFade: false });
        }
      }
      G.text3(ctx, 'ARTIFACT #0001', [0, sc + 0.62, 0], 11, { color: P.ink50, ls: 0.24, depthFade: false });
      G.text3(ctx, 'BUILD  ' + String(Math.min(100, Math.floor(t * 22))).padStart(3, ' ') + '%', [0, -sc - 0.62, 0], 11, { color: P.cyan, depthFade: false });
      G.text3(ctx, 'x', [-sc - 0.28, -sc, -sc], 9, { color: P.gold, depthFade: false });
      G.text3(ctx, 'y', [-sc - 0.28, 0, -sc], 9, { color: P.gold, depthFade: false });
      G.text3(ctx, 'z', [-sc - 0.28, sc, -sc], 9, { color: P.gold, depthFade: false });
      cornerMarks(ctx, c);
      UI.label(ctx, 'LENS  ' + fov.toFixed(1) + '°  →  PERSPECTIVE', K.W * 0.955, K.H * 0.94,
        { fs: 9 * S0, color: P.ink30, align: 'right' });
    }
  });

  /* =====================================================================
     15.5 — the net folds into a solid
     ===================================================================== */
  add({
    t: 15.5, id: 'fold', name: 'FOLD', draw: function (ctx, c) {
      var t = c.lt;
      G.begin({ pos: [4.6 + Math.sin(t * 0.3) * 0.5, 2.5, 5.4], tgt: [0.2, 0.55, 0], fov: 42 });
      var th = K.easeInOut(K.st(1.4, 4.4, t)) * Math.PI / 2;
      var faces = [];
      var a = 1.0, h = a / 2;
      faces.push({ p: [[-h, -h, 0], [h, -h, 0], [h, h, 0], [-h, h, 0]], lab: 'heart.dll' });
      /* north: hinge y=+h, folds about x */
      var N = rotate([[ -h, h, 0], [h, h, 0], [h, h + a, 0], [-h, h + a, 0]], [0, h, 0], [1, 0, 0], -th);
      faces.push({ p: N, lab: 'voice' });
      var Sf = rotate([[-h, -h, 0], [h, -h, 0], [h, -h - a, 0], [-h, -h - a, 0]], [0, -h, 0], [1, 0, 0], th);
      faces.push({ p: Sf, lab: 'time' });
      var E = rotate([[h, -h, 0], [h, h, 0], [h + a, h, 0], [h + a, -h, 0]], [h, 0, 0], [0, 1, 0], -th);
      faces.push({ p: E, lab: 'warmth' });
      var Wf = rotate([[-h, -h, 0], [-h, h, 0], [-h - a, h, 0], [-h - a, -h, 0]], [-h, 0, 0], [0, 1, 0], th);
      faces.push({ p: Wf, lab: 'tears' });
      var T0 = [[-h, h + a, 0], [h, h + a, 0], [h, h + 2 * a, 0], [-h, h + 2 * a, 0]];
      var T1 = rotate(T0, [0, h + a, 0], [1, 0, 0], -th);
      var T2 = rotate(T1, [0, h, 0], [1, 0, 0], -th);
      faces.push({ p: T2, lab: '?' });

      function rotate(pts, A, u, th2) { return pts.map(function (p) { return rotAxis(p, A, u, th2); }); }

      for (var i = 0; i < faces.length; i++) {
        var f = faces[i];
        G.quad(ctx, f.p, { fill: 'rgba(10,11,14,.55)', stroke: i === 5 ? P.gold : P.ink50, w: 1, alpha: 1 });
        /* label only when the face is actually readable, not edge-on */
        var p0 = G.proj(f.p[0]), p1 = G.proj(f.p[1]), p2 = G.proj(f.p[2]);
        var area = 0;
        if (p0 && p1 && p2) area = Math.abs((p1.x - p0.x) * (p2.y - p0.y) - (p2.x - p0.x) * (p1.y - p0.y));
        var cen = [(f.p[0][0] + f.p[2][0]) / 2, (f.p[0][1] + f.p[2][1]) / 2, (f.p[0][2] + f.p[2][2]) / 2];
        if (area > 2600 * c.S) G.text3(ctx, f.lab, cen, 11, { color: i === 5 ? P.gold : P.ink50, ls: 0.16, depthFade: false });
      }
      /* hinge hairs */
      G.polyline(ctx, [[-h, -h, 0], [h, -h, 0], [h, h, 0], [-h, h, 0], [-h, -h, 0]], { color: P.cyan, alpha: 0.5, w: 1 });
      UI.label(ctx, 'UNFOLDED  6 × 1 UNIT', K.W * 0.045, K.H * 0.94, { fs: 9 * c.S, color: P.ink30 });
      UI.label(ctx, th > 1.5 ? 'CLOSED  VOLUME 1.000' : 'FOLDING  θ = ' + (th * 57.3).toFixed(1) + '°',
        K.W * 0.955, K.H * 0.94, { fs: 9 * c.S, color: th > 1.5 ? P.gold : P.ink50, align: 'right' });
      cornerMarks(ctx, c);
    }
  });

  /* =====================================================================
     22.0 — DIAGNOSTIC: code wall + nested windows
     ===================================================================== */
  add({
    t: 22, id: 'diag', name: 'DIAGNOSTIC', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      /* wall of source, leaning away */
      G.begin({ pos: [0, 0, 6], tgt: [0, 0, 0], fov: 45 });
      var scroll = (t * 26) % 40;
      ctx.save();
      ctx.globalAlpha = 0.85;
      for (var b = 0; b < K.Code.blocks.length; b++) {
        var blk = K.Code.blocks[b];
        var x = W * 0.02 + (b % 4) * W * 0.255;
        var y = H * 0.10 - scroll * 0.5 + Math.floor(b / 4) * H * 0.56;
        K.Code.draw(ctx, blk, x, y, { size: 10.5 * S0, lh: 15.5 * S0, alpha: 0.55, chars: 9999 });
        ctx.save();
        ctx.globalAlpha = 0.5;
        K.setFont(ctx, 9 * S0, K.F.code, 400);
        ctx.fillStyle = P.ink30;
        ctx.fillText(blk.file + '  ·  ' + blk.lang, x, y - 8 * S0);
        ctx.restore();
      }
      ctx.restore();

      /* scan sweep */
      var sy = ((t * 0.45) % 1) * H;
      ctx.save();
      var g = ctx.createLinearGradient(0, sy - 60, 0, sy + 60);
      g.addColorStop(0, 'rgba(94,231,255,0)');
      g.addColorStop(0.5, 'rgba(94,231,255,.10)');
      g.addColorStop(1, 'rgba(94,231,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, sy - 60, W, 120);
      ctx.restore();

      /* three nested windows */
      var defs = [
        { x: W * 0.16, y: H * 0.20, w: W * 0.34, h: H * 0.30, d: 0.0, title: 'heart.sys — readonly' },
        { x: W * 0.24, y: H * 0.30, w: W * 0.34, h: H * 0.30, d: 0.45, title: 'heart.sys — inspector' },
        { x: W * 0.32, y: H * 0.40, w: W * 0.34, h: H * 0.30, d: 0.9, title: 'heart.sys — ?' }
      ];
      for (var i = 0; i < defs.length; i++) {
        var d = defs[i];
        var ap = K.easeOut(K.st(d.d, d.d + 0.5, t));
        if (ap <= 0) continue;
        ctx.save();
        ctx.globalAlpha = ap;
        UI.win(ctx, d.x, d.y, d.w, d.h, { title: d.title, close: i === 2, fs: 9 * S0 });
        if (i === 2) {
          UI.term(ctx, d.x + 14 * S0, d.y + 58 * S0, d.w - 28 * S0, {
            fs: 10.5 * S0, lh: 17 * S0,
            lines: [
              { p: '>>>', t: 'inspect --deep' },
              { p: '', t: 'stack .......... 0000 0000' },
              { p: '', t: 'return ......... null' },
              { p: '', t: 'reason ......... unknown', caret: true }
            ]
          });
        } else if (i === 0) {
          K.Code.draw(ctx, S('C'), d.x + 14 * S0, d.y + 52 * S0, { size: 10 * S0, lh: 15 * S0, chars: t * 90 });
        } else {
          K.V.memGrid(ctx, t, { x: d.x + 16 * S0, y: d.y + 52 * S0, cols: 14, rows: 7, cw: 14 * S0, gap: 4 * S0, ch: 14 * S0 });
        }
        ctx.restore();
      }

      /* right column readout */
      var rx = W * 0.70, ry = H * 0.22;
      K.V.hexdump(ctx, c, { x: rx, y: ry, rows: 12, size: 10 * S0, lh: 14.5 * S0, alpha: 0.55, rate: 9 });
      UI.label(ctx, 'DIAGNOSTIC  ' + String(Math.floor(K.clamp(t / 8, 0, 1) * 100)).padStart(3, '0') + '%',
        rx, ry - 22 * S0, { fs: 10 * S0, color: P.cyan, ls: 2 });
      UI.bar(ctx, rx, ry + 12 * 14.5 * S0 + 10, 300 * S0, 6 * S0, K.clamp(t / 8, 0, 1), { seg: 40, color: P.ink70 });

      cornerMarks(ctx, c);
      topRule(ctx, c, 'DIAGNOSTIC / 3 PROCESSES', 'T+ ' + t.toFixed(2) + 's');
    }
  });

  /* =====================================================================
     26.5 — CALIBRATION: arms close, lock
     ===================================================================== */
  add({
    t: 26.5, id: 'lock', name: 'CALIBRATE', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var k = K.easeOut(K.st(0, 2.6, t));
      var cx = W / 2, cy = H * 0.46;
      var maxR = Math.min(W, H) * 0.42;
      var r = K.lp(maxR, 62 * S0, k);
      ctx.save();
      ctx.strokeStyle = P.ink18;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, maxR, 0, 6.2832); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, maxR * 0.66, 0, 6.2832); ctx.stroke();
      /* arms */
      for (var i = 0; i < 4; i++) {
        var a = Math.PI / 4 + i * Math.PI / 2;
        var x0 = cx + Math.cos(a) * maxR, y0 = cy + Math.sin(a) * maxR;
        var x1 = cx + Math.cos(a) * r, y1 = cy + Math.sin(a) * r;
        ctx.strokeStyle = P.ink70;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.fillStyle = P.cyan;
        ctx.fillRect(x1 - 2, y1 - 2, 4, 4);
      }
      /* crosshair */
      ctx.strokeStyle = P.ink30;
      ctx.beginPath();
      ctx.moveTo(cx - r - 26, cy); ctx.lineTo(cx - r, cy);
      ctx.moveTo(cx + r, cy); ctx.lineTo(cx + r + 26, cy);
      ctx.moveTo(cx, cy - r - 26); ctx.lineTo(cx, cy - r);
      ctx.moveTo(cx, cy + r); ctx.lineTo(cx, cy + r + 26);
      ctx.stroke();
      ctx.strokeStyle = P.ink;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.30, 0, 6.2832); ctx.stroke();
      ctx.restore();

      /* sweep band */
      var sw = ((t * 0.8) % 1);
      ctx.save();
      ctx.globalAlpha = (1 - sw) * 0.5;
      ctx.fillStyle = P.cyan;
      ctx.fillRect(cx - maxR, cy + maxR - sw * maxR * 2, maxR * 2, 1);
      ctx.restore();

      if (t > 2.8) {
        var pul = 1 - ((t - 2.8) % 0.428571) / 0.428571;
        ctx.save();
        ctx.globalAlpha = 0.25 + pul * 0.5;
        ctx.strokeStyle = P.gold;
        ctx.lineWidth = 1.4;
        ctx.strokeRect(cx - r - 6, cy - r - 6, r * 2 + 12, r * 2 + 12);
        ctx.restore();
        UI.label(ctx, 'LOCK  x16  OK', cx, cy + maxR * 0.86, { fs: 12 * S0, color: P.gold, align: 'center', ls: 4 });
      } else {
        UI.label(ctx, 'ALIGNING  ' + Math.round(k * 100) + '%', cx, cy + maxR * 0.86,
          { fs: 12 * S0, color: P.ink50, align: 'center', ls: 4 });
      }
      cornerMarks(ctx, c);
    }
  });

  /* =====================================================================
     30.43 — CIRCLE / SINE / HELIX  (the 2D→3D reveal)
     ===================================================================== */
  add({
    t: 30.43, id: 'circle', name: 'HELIX', draw: function (ctx, c) {
      var t = c.lt, S0 = c.S;
      /* reveal starts on the last bar of the section */
      var rv = K.easeInOut(K.st(3.85, 5.90, t));
      var fov = K.lp(2.6, 52, rv);
      var ang = K.lp(0.001, Math.PI / 2, rv);
      var dist = G.fit(fov, 1.45, 0.52);
      G.begin({
        pos: [Math.sin(ang) * dist, 0.55 * rv + 0.02, Math.cos(ang) * dist],
        tgt: [0, 0, 0], fov: fov, up: [0, 1, 0]
      });
      var helix = [], L = 2.6, turns = 3.2;
      for (var i = 0; i <= 260; i++) {
        var u = i / 260;
        var z = -L + u * 2 * L;
        var a = u * turns * 2 * Math.PI;
        helix.push([Math.cos(a) * 1.0, Math.sin(a) * 1.0, z]);
      }
      /* the unit circle it projects to, on the far plane */
      var circ = [];
      for (var q = 0; q <= 120; q++) {
        var aa = q / 120 * 6.2832;
        circ.push([Math.cos(aa), Math.sin(aa), -L]);
      }
      G.polyline(ctx, circ, { color: P.cyan, alpha: 0.22 * (1 - rv) + 0.10, w: 1, depthFade: false });
      /* the sine it projects to, on the x=0 plane */
      var sine = [];
      for (var q2 = 0; q2 <= 200; q2++) {
        var uu = q2 / 200;
        sine.push([0, Math.sin(uu * turns * 2 * Math.PI), -L + uu * 2 * L]);
      }
      G.polyline(ctx, sine, { color: P.gold, alpha: 0.10 + 0.25 * rv, w: 1, depthFade: false });
      G.polyline(ctx, helix, { color: P.ink, alpha: 0.92, w: 1.5, depthFade: false });
      /* the moving point */
      var ph = (t * 0.55) % 1;
      var pz = -L + ph * 2 * L, pa = ph * turns * 2 * Math.PI;
      var pt = [Math.cos(pa) * 1.0, Math.sin(pa) * 1.0, pz];
      var pr = G.proj(pt);
      /* axis */
      G.line(ctx, [0, 0, -L], [0, 0, L], { color: P.ink18, w: 1, depthFade: false });
      if (pr) {
        ctx.save();
        ctx.fillStyle = P.gold;
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(pr.x, pr.y, 4.5, 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = P.gold;
        ctx.beginPath(); ctx.arc(pr.x, pr.y, 12, 0, 6.2832); ctx.stroke();
        ctx.restore();
      }
      /* the cos / sin decomposition, drawn on the plane of the point */
      var base = [0, 0, pz];
      var onX = [Math.cos(pa), 0, pz];
      G.line(ctx, base, onX, { color: P.ink, alpha: 0.30, w: 1, depthFade: false });
      G.line(ctx, onX, pt, { color: P.ink, alpha: 0.30, w: 1, depthFade: false });
      G.line(ctx, base, pt, { color: P.gold, alpha: 0.42, w: 1, depthFade: false });
      /* 2D annotations fade out as the third dimension arrives */
      var annA = 1 - rv * 0.85;
      if (annA > 0.02) {
        ctx.save();
        ctx.globalAlpha = annA;
        K.Math.draw(ctx, 'x = \\r{cos} θ', K.W * 0.075, K.H * 0.28, 24 * S0, { color: P.ink70 });
        K.Math.draw(ctx, 'y = \\r{sin} θ', K.W * 0.075, K.H * 0.28 + 38 * S0, 24 * S0, { color: P.ink70 });
        K.Math.draw(ctx, 'r = 1', K.W * 0.075, K.H * 0.28 + 76 * S0, 19 * S0, { color: P.ink50 });
        K.Math.draw(ctx, 'θ = ωt', K.W * 0.075, K.H * 0.28 + 108 * S0, 19 * S0, { color: P.ink30 });
        ctx.restore();
      }
      UI.label(ctx, rv > 0.02 ? 'AXIS VIEW  →  ORBIT  /  fov ' + fov.toFixed(1) + '°' : 'AXIS VIEW  fov 2.6°',
        K.W * 0.955, K.H * 0.94, { fs: 9 * S0, color: P.ink30, align: 'right' });
      UI.label(ctx, rv > 0.5 ? 'IT WAS NEVER A CIRCLE' : 'UNIT CIRCLE', K.W * 0.045, K.H * 0.94,
        { fs: 9 * S0, color: rv > 0.5 ? P.gold : P.ink30 });
      cornerMarks(ctx, c);
    }
  });

  /* =====================================================================
     36.51 — PROLOGUE: created
     ===================================================================== */
  add({
    t: 36.51, id: 'created', name: 'CREATED', draw: function (ctx, c) {
      var t = c.lt, S0 = c.S, W = K.W, H = K.H;
      /* a slow lateral pan down a corridor of windows: the only motion in the
         first verse is the camera, and it never stops */
      var px = K.lp(-0.9, 0.9, K.easeInOut(K.clamp(t / 6.8, 0, 1)));
      G.begin({ pos: [px, 0.10, 1.4], tgt: [px * 1.15, 0.05, -9], fov: 46 });
      var walls = [
        [-1.55, 0.35, -3.2, 1.30, 0.80, 'heart.py'],
        [1.60, -0.25, -4.4, 1.25, 0.78, 'pulse.c'],
        [-1.85, -0.45, -7.4, 1.20, 0.74, 'kokoro.rs'],
        [1.85, 0.45, -8.6, 1.20, 0.74, 'memory.sql'],
        [-0.75, 0.95, -6.0, 1.05, 0.66, 'sing.s'],
        [0.85, -0.95, -6.6, 1.05, 0.66, 'Kokoro.hs']
      ];
      for (var i = 0; i < walls.length; i++) {
        var w = walls[i];
        var blk = K.Code.byLang(w[5] === 'heart.py' ? 'PYTHON' : w[5] === 'pulse.c' ? 'C' :
          w[5] === 'kokoro.rs' ? 'RUST' : w[5] === 'memory.sql' ? 'SQL' :
            w[5] === 'sing.s' ? 'ASM' : 'HASKELL');
        var p = panel3(ctx, w[0], w[1], w[2], w[3], w[4], {
          title: w[5], border: P.ink30, bg: 'rgba(12,13,16,.90)', alpha: 1, far: 90, seed: i * 7
        });
        if (p) {
          ctx.save();
          ctx.globalAlpha = p.a * 0.9;
          var cfs = Math.min(22, (p.w * 0.88) / (K.Code.width(blk) * 0.60));
          K.Code.draw(ctx, blk, p.x - p.w / 2 + 7, p.y - p.h / 2 + K.clamp(p.h * 0.24, 9, 20) + 8, {
            size: cfs, lh: cfs * 1.5, chars: 150
          });
          ctx.restore();
        }
      }
      /* the subject: one cursor, one missing parent */
      var pr = G.proj([0.15, 0.05, -2.2]);
      if (pr) {
        ctx.save();
        ctx.globalAlpha = blink(t, 1.5) ? 0.95 : 0.12;
        ctx.fillStyle = P.ink;
        ctx.fillRect(pr.x - 4, pr.y - 15 * S0, 8, 30 * S0);
        ctx.restore();
        UI.label(ctx, 'creator', pr.x, pr.y - 34 * S0, { fs: 9.5 * S0, color: P.ink30, align: 'center', ls: 4 });
        UI.label(ctx, '[ LOST ]', pr.x, pr.y + 40 * S0, { fs: 11 * S0, color: P.gold, align: 'center', ls: 3 });
      }
      UI.label(ctx, 'PID 1991   ·   NO PARENT PROCESS', W * 0.045, H * 0.94, { fs: 9 * S0, color: P.ink30 });
      UI.label(ctx, 'T+' + t.toFixed(2), W * 0.955, H * 0.94, { fs: 9 * S0, color: P.ink18, align: 'right' });
      cornerMarks(ctx, c);
    }
  });

  /* =====================================================================
     43.34 — MIRACLE: extruded type slams in
     ===================================================================== */
  add({
    t: 43.34, id: 'miracle', name: 'MIRACLE', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      /* radial dot field */
      var cx = W / 2, cy = H * 0.44;
      ctx.save();
      for (var r = 1; r < 15; r++) {
        var rr = r * r * 3.2 * S0;
        var n = 8 + r * 5;
        for (var i = 0; i < n; i++) {
          var a = i / n * 6.2832 + r * 0.21;
          var jitter = 1 + 0.10 * Math.sin(c.t * 1.6 + r * 0.7 + i);
          var x = cx + Math.cos(a) * rr * jitter, y = cy + Math.sin(a) * rr * jitter * 0.94;
          var al = K.clamp(1 - r / 15, 0, 1) * (0.45 + 0.45 * c.k);
          ctx.globalAlpha = al;
          ctx.fillStyle = P.ink;
          var s = 2.8 * S0;
          ctx.fillRect(x, y, s, s);
        }
      }
      ctx.restore();
      /* shock ring on the downbeat */
      var kk = K.clamp(t / 1.1, 0, 1);
      if (kk < 1) {
        ctx.save();
        ctx.globalAlpha = (1 - kk) * 0.8;
        ctx.strokeStyle = P.ink;
        ctx.lineWidth = 2 * (1 - kk) + 0.5;
        ctx.beginPath(); ctx.arc(cx, cy, K.easeOut(kk) * W * 0.55, 0, 6.2832); ctx.stroke();
        ctx.restore();
      }
      /* the word, slammed in on the first beat */
      var e = K.easeOut(K.st(0, 0.90, t));
      var sc = K.lp(2.6, 1, K.easeOut(K.st(0, 0.55, t)));
      var rot = K.lp(-0.30, 0, K.easeInOut(K.st(0, 0.85, t)));
      var y = K.lp(cy - 30, cy, K.easeOut(K.st(0, 0.7, t)));
      G.extrude(ctx, '奇跡', cx, y, Math.min(W * 0.19, 178 * S0), {
        depth: 9 * S0, ang: -1.15, color: P.ink, side: '#2a2d33',
        alpha: K.clamp(t / 0.12, 0, 1), rot: rot, scale: sc, family: K.F.jp, weight: 300,
        ls: 0.02, disp: c.disp * 1.2
      });
      /* English hairline under it */
      ctx.save();
      ctx.globalAlpha = K.clamp((t - 0.8) / 0.6, 0, 1) * 0.8;
      UI.label(ctx, 'M I R A C L E', cx, y + Math.min(W * 0.19, 178 * S0) * 0.72,
        { fs: 11 * S0, color: P.ink50, align: 'center', ls: 8 });
      ctx.restore();
      K.Math.draw(ctx, 'P(\\s{perfection}) → 1.000', W * 0.955, H * 0.90, 15 * S0,
        { color: P.ink30, align: 'right' });
      cornerMarks(ctx, c);
    }
  });

  /* =====================================================================
     50.15 — MISSING: one cell
     ===================================================================== */
  add({
    t: 50.15, id: 'missing', name: 'MISSING', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var cols = 9, rows = 5, cw = 54 * S0, gap = 12 * S0;
      var x0 = W / 2 - (cols * (cw + gap) - gap) / 2, y0 = H * 0.27;
      var hole = 4 * cols + 2;
      for (var r = 0; r < rows; r++) {
        for (var q = 0; q < cols; q++) {
          var i = r * cols + q;
          var x = x0 + q * (cw + gap), y = y0 + r * (cw + gap);
          var appear = K.st(i * 0.02, i * 0.02 + 0.3, t);
          if (appear <= 0) continue;
          if (i === hole) {
            var pulse = 0.5 + 0.5 * Math.sin(t * 4.4);
            ctx.save();
            ctx.globalAlpha = appear * (0.25 + pulse * 0.7);
            ctx.strokeStyle = P.gold;
            ctx.setLineDash([4, 5]);
            ctx.lineDashOffset = -t * 20;
            ctx.strokeRect(x + .5, y + .5, cw, cw);
            ctx.setLineDash([]);
            ctx.globalAlpha = appear * (0.4 + pulse * 0.6);
            K.setFont(ctx, 30 * S0, K.F.code, 300);
            ctx.fillStyle = P.gold;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('?', x + cw / 2, y + cw / 2 + 1);
            ctx.restore();
          } else {
            ctx.save();
            ctx.globalAlpha = appear * (0.12 + 0.10 * K.rnd(i, 2.2));
            ctx.fillStyle = P.ink;
            ctx.fillRect(x, y, cw, cw);
            ctx.globalAlpha = appear * 0.5;
            ctx.strokeStyle = P.ink30;
            ctx.strokeRect(x + .5, y + .5, cw, cw);
            ctx.restore();
          }
        }
      }
      UI.label(ctx, 'MISSING  01 CELL', W / 2, y0 + rows * (cw + gap) + 34 * S0,
        { fs: 11 * S0, color: P.gold, align: 'center', ls: 4 });
      /* a ring with a gap */
      var cx = W / 2, cy = H * 0.83;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = P.ink50;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(cx, cy, 40 * S0, 0.35 + t * 0.4, 6.2832 - 0.55 + t * 0.4); ctx.stroke();
      ctx.restore();
      cornerMarks(ctx, c);
    }
  });

  /* =====================================================================
     56.94 — PROGRAM: typed struct
     ===================================================================== */
  add({
    t: 56.94, id: 'program', name: 'PROGRAM', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var bx = W * 0.09, by = H * 0.22, bw = W * 0.46, bh = H * 0.38;
      UI.win(ctx, bx, by, bw, bh, { title: 'heart.sys — writing', close: true, fs: 9.5 * S0 });
      var blk = S('C');
      var n = typed(t, 0.25, 62, blk.chars);
      K.Code.draw(ctx, blk, bx + 22 * S0, by + 56 * S0, {
        size: 14 * S0, lh: 24 * S0, chars: n, lineNo: true,
        cursor: true, blink: true, blinkOn: blink(t, 2.2), cursorCol: P.cyan
      });
      /* hex column */
      var hx = W * 0.60, hy = H * 0.26;
      UI.label(ctx, 'MEMORY  @ 0x00A1', hx, hy - 12 * S0, { fs: 9.5 * S0, color: P.ink30, ls: 2 });
      K.V.hexdump(ctx, c, { x: hx, y: hy + 16 * S0, rows: 9, size: 11 * S0, lh: 17 * S0, alpha: 0.7, rate: 5 });
      /* the word spelled by highlight */
      var word = 'HEART';
      var reveal = K.st(1.6, 4.2, t);
      for (var i = 0; i < word.length; i++) {
        var on = reveal > i * 0.16;
        ctx.save();
        ctx.globalAlpha = on ? 1 : 0.10;
        ctx.fillStyle = on ? P.ink : P.ink;
        K.setFont(ctx, 34 * S0, K.F.code, 300);
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        var chx = hx + (i - 2) * 40 * S0 + 2, chy = H * 0.735;
        ctx.fillText(word[i], chx, chy);
        if (on) {
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = P.cyan;
          ctx.strokeRect(chx - 17 * S0, chy - 30 * S0, 34 * S0, 38 * S0);
        }
        ctx.restore();
      }
      UI.label(ctx, 'hexdump: 48 45 41 52 54', hx - 60 * S0, H * 0.785, { fs: 9 * S0, color: P.ink30, ls: 1.4 });
      cornerMarks(ctx, c);
    }
  });

  /* =====================================================================
     63.52 — CENTURIES (quantum)
     ===================================================================== */
  add({
    t: 63.52, id: 'centuries', name: 'CENTURIES', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      G.begin({ pos: [0, 0.1, 7], tgt: [0, 0, 0], fov: 42 });
      /* year counter */
      var yr = Math.floor(1991 + Math.pow(K.clamp(t / 6.6, 0, 1), 2.2) * 8008);
      ctx.save();
      K.setFont(ctx, Math.min(W * 0.14, 150 * S0), K.F.code, 200);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.13;
      ctx.fillStyle = P.ink;
      ctx.fillText('' + yr, W / 2, H * 0.45);
      ctx.restore();
      /* a real formula, extruded, slammed in from outside the frame on the
         first downbeat of the quantum section */
      var e = K.clamp(t / 0.55, 0, 1);
      var ee = 1 - Math.pow(1 - e, 3);
      var fy = K.lp(-H * 0.55, H * 0.30, ee);
      var fr = K.lp(-0.42, 0, ee);
      var fsc = K.lp(1.9, 1, ee);
      var fa = K.clamp(t / 0.18, 0, 1);
      if (t < 1.2) {
        /* impact ring on landing */
        var imp = K.clamp((t - 0.45) / 0.6, 0, 1);
        if (imp > 0 && imp < 1) {
          ctx.save();
          ctx.globalAlpha = (1 - imp) * 0.35;
          ctx.strokeStyle = P.gold;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(W / 2, H * 0.30, imp * W * 0.45, imp * 40 * S0, 0, 0, 6.2832);
          ctx.stroke();
          ctx.restore();
        }
      }
      K.Math.solid(ctx, 'Δx·Δp ≥ \\f{ℏ|2}', W / 2, fy, Math.min(W * 0.082, 84 * S0), {
        depth: 9 * S0, ang: -0.62, alpha: fa, rot: fr, scale: fsc
      });
      /* wavefunction */
      K.V.psi(ctx, c.t, { x: W * 0.5, y: H * 0.72, w: W * 0.72, h: 150 * S0, color: P.cyan });
      /* decoherence dots */
      ctx.save();
      for (var i = 0; i < 140; i++) {
        var a = K.rnd(i, 1.7) * 6.2832 + t * 0.12 * (0.6 + K.rnd(i, 5));
        var rr = 60 + K.rnd(i, 3.3) * 320 * S0;
        var x = W / 2 + Math.cos(a) * rr, y = H * 0.44 + Math.sin(a) * rr * 0.42;
        ctx.globalAlpha = 0.16 + 0.5 * K.rnd(i, t * 0.6);
        ctx.fillStyle = K.rnd(i, 9) > 0.9 ? P.gold : P.ink;
        ctx.fillRect(x, y, 1.6 * S0, 1.6 * S0);
      }
      ctx.restore();
      UI.label(ctx, 'OTHERS  0', W * 0.045, H * 0.18, { fs: 11 * S0, color: P.ink50, ls: 3 });
      UI.label(ctx, 't = 8.08 × 10² years', W * 0.955, H * 0.18, { fs: 10 * S0, color: P.ink30, align: 'right' });
      K.Math.draw(ctx, 'iℏ ∂ψ/∂t = −(ℏ²/2m)∇²ψ + Vψ', W * 0.955, H * 0.90, 16 * S0,
        { color: P.ink50, align: 'right' });
      cornerMarks(ctx, c);
    }
  });

  /* =====================================================================
     70.28 — WISH
     ===================================================================== */
  add({
    t: 70.28, id: 'wish', name: 'WISH', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      G.begin({ pos: [0, 0.2, 8], tgt: [0, 0, 0], fov: 40 });
      /* the line */
      var ly = H * 0.55;
      var g = ctx.createLinearGradient(W * 0.1, 0, W * 0.9, 0);
      g.addColorStop(0, 'rgba(244,245,247,0)');
      g.addColorStop(0.5, 'rgba(244,245,247,.75)');
      g.addColorStop(1, 'rgba(244,245,247,0)');
      ctx.save();
      ctx.fillStyle = g;
      ctx.fillRect(W * 0.1, ly, W * 0.8, 1);
      ctx.restore();
      /* the single breathing point */
      var br = 0.5 + 0.5 * Math.sin(t * 2.2);
      var px = W * 0.5;
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.45 * br;
      ctx.fillStyle = P.ink;
      ctx.beginPath(); ctx.arc(px, ly, 4 * S0 + br * 2, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 0.10 + 0.18 * br;
      ctx.fillStyle = P.cyan;
      ctx.beginPath(); ctx.arc(px, ly, 40 * S0 + br * 18, 0, 6.2832); ctx.fill();
      /* the question mark climbs */
      ctx.restore();
      var qy = ly - 40 * S0 - t * 26 * S0;
      ctx.save();
      ctx.globalAlpha = K.clamp(1 - (ly - qy) / (H * 0.5), 0.12, 1);
      K.setFont(ctx, 30 * S0, K.F.code, 200);
      ctx.fillStyle = P.gold;
      ctx.textAlign = 'center';
      ctx.fillText('?', px, qy);
      ctx.restore();
      K.V.lorenz(ctx, c.t, { color: P.cyan, alpha: 0.5, n: 900, speed: 90 });
      UI.label(ctx, 'WISH  →  [UNRESOLVED]', W * 0.5, H * 0.88, { fs: 10 * S0, color: P.ink50, align: 'center', ls: 3 });
      cornerMarks(ctx, c);
    }
  });

  /* =====================================================================
     77.08 — QUERY: no rows
     ===================================================================== */
  add({
    t: 77.08, id: 'query', name: 'QUERY', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var bx = W * 0.09, by = H * 0.24, bw = W * 0.52, bh = H * 0.30;
      UI.win(ctx, bx, by, bw, bh, { title: 'psql — kokoro', fs: 9.5 * S0 });
      var blk = S('SQL');
      var n = typed(t, 0.15, 95, blk.chars);
      K.Code.draw(ctx, blk, bx + 20 * S0, by + 50 * S0, {
        size: 15 * S0, lh: 26 * S0, chars: n, cursor: true, blinkOn: blink(t, 2), cursorCol: P.green
      });
      if (n >= blk.chars) {
        var a = K.clamp((t - 1.1) / 0.3, 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        K.setFont(ctx, 13 * S0, K.F.code, 400);
        ctx.fillStyle = P.ink50;
        ctx.fillText('(0 rows)', bx + 20 * S0, by + 50 * S0 + (blk.tok.length + 2) * 26 * S0);
        ctx.fillStyle = P.gold;
        ctx.fillText('record not found: scientist', bx + 20 * S0, by + 50 * S0 + (blk.tok.length + 3.2) * 26 * S0);
        ctx.restore();
      }
      /* data lost block, torn */
      var dx = W * 0.64, dy = H * 0.30, dw = W * 0.27, dh = H * 0.26;
      ctx.save();
      ctx.strokeStyle = P.ink30;
      ctx.strokeRect(dx, dy, dw, dh);
      for (var i = 0; i < 9; i++) {
        var yy = dy + i * dh / 9;
        var offx = (K.rnd(i + Math.floor(t * 8), 4) - 0.5) * 22 * S0;
        ctx.globalAlpha = 0.20 + K.rnd(i, 3) * 0.35;
        ctx.fillStyle = P.ink;
        ctx.fillRect(dx + offx + 8, yy + 4, dw * (0.25 + K.rnd(i, 5) * 0.6), 3 * S0);
      }
      ctx.globalAlpha = 1;
      K.setFont(ctx, 12 * S0, K.F.code, 400);
      ctx.fillStyle = P.gold;
      ctx.textAlign = 'center';
      ctx.fillText('[ DATA LOST ]', dx + dw / 2, dy + dh / 2 + 5);
      ctx.restore();
      cornerMarks(ctx, c);
    }
  });

  /* =====================================================================
     80.60 — UNTIL THE END
     ===================================================================== */
  add({
    t: 80.6, id: 'untilend', name: 'UNTIL END', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var y = H * 0.5;
      var life = 1 - K.easeIn(K.st(0.6, 3.2, t));
      ctx.save();
      ctx.strokeStyle = P.ink50;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      var n = 420;
      for (var i = 0; i <= n; i++) {
        var u = i / n;
        var x = W * 0.08 + u * W * 0.84;
        var ecg = Math.exp(-Math.pow(((u * 6) % 1 - 0.18) * 9, 2)) * 44 * S0 * life;
        var yy = y - ecg + Math.sin(u * 60 + t * 3) * 1.2 * life;
        if (i === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
      ctx.restore();
      /* the collapse */
      var k = K.st(1.9, 3.4, t);
      if (k > 0) {
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = P.ink;
        var h = K.lp(140 * S0, 2, K.easeIn(k));
        ctx.fillRect(W / 2 - 0.5, y - h / 2, 1.6, h);
        ctx.globalAlpha = K.easeOut(k);
        ctx.fillRect(W / 2 - 8 * S0 * (1 - k), y - 1, 16 * S0 * (1 - k) + 2, 2);
        ctx.restore();
      }
      if (t > 3.3) {
        ctx.save();
        ctx.globalAlpha = blink(t - 3.3, 1.4) ? 0.95 : 0.1;
        ctx.fillStyle = P.ink;
        var cw2 = 16 * S0;
        ctx.fillRect(W / 2 - cw2 * 0.3, y - cw2 * 0.6, cw2 * 0.6, cw2 * 1.2);
        ctx.restore();
      }
      UI.label(ctx, 'lifetime  →  remaining', W * 0.045, H * 0.16, { fs: 10 * S0, color: P.ink30, ls: 2 });
      K.Math.draw(ctx, '\\f{dT|dt} → 0', W * 0.955, H * 0.84, 20 * S0, { color: P.ink30, align: 'right' });
      cornerMarks(ctx, c);
    }
  });

  /* =====================================================================
     84.03 — EXTRACT: the 87% stall
     ===================================================================== */
  add({
    t: 84.03, id: 'extract', name: 'EXTRACT', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      /* progress: races to 87%, stalls through the dead bar, then finishes */
      var p;
      if (t < 2.2) p = K.easeOut(t / 2.2) * 0.87;
      else if (t < 5.6) p = 0.87 + Math.max(0, (t - 5.0) / 0.6) * 0.02;
      else p = K.clamp(0.89 + (t - 5.6) / 3.4 * 0.11, 0, 1);
      var done = p >= 0.999;

      G.begin({ pos: [0, 0, 7.4], tgt: [0, 0, 0], fov: 40 });
      /* the core, growing */
      var rad = K.clamp((p - 0.55) / 0.45, 0, 1);
      if (rad > 0) {
        var pts = G.spherePts(0, 0, 0, 0.9 * rad, 260, 4.4);
        G.points(ctx, pts, { color: P.ink, r: 2.2, alpha: 0.75, depthFade: false });
        G.ring(ctx, 0, 0, 0, 0.9 * rad * (1.0 + 0.05 * Math.sin(t * 6)), 64, 'y', { color: P.ink30, alpha: 0.7, w: 1, depthFade: false });
        G.ring(ctx, 0, 0, 0, 0.9 * rad * 1.14, 64, 'x', { color: P.ink18, alpha: 0.6, w: 1, depthFade: false });
      }
      var bw = Math.min(W * 0.62, 760 * S0), bh = 10 * S0;
      var bx = W / 2 - bw / 2, by = H * 0.62;
      UI.bar(ctx, bx, by, bw, bh, p, { seg: 64, color: done ? P.gold : P.ink });
      ctx.save();
      K.setFont(ctx, 12 * S0, K.F.code, 400);
      ctx.fillStyle = P.ink50; ctx.textAlign = 'left';
      ctx.fillText('unpacking  heart.tar.zst', bx, by - 14 * S0);
      ctx.textAlign = 'right';
      ctx.fillStyle = done ? P.gold : (t > 2.2 && t < 5.0 ? P.gold : P.ink70);
      ctx.fillText((p * 100).toFixed(1) + '%', bx + bw, by - 14 * S0);
      ctx.restore();
      if (t > 2.2 && t < 5.2) {
        ctx.save();
        ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 9);
        UI.label(ctx, 'STALLED  ·  waiting for a heartbeat', W / 2, by + 34 * S0,
          { fs: 10 * S0, color: P.gold, align: 'center', ls: 2 });
        ctx.restore();
      }
      if (done) {
        ctx.save();
        ctx.globalAlpha = 0.9;
        UI.label(ctx, 'EXTRACT OK  ·  2,828,000 CELLS', W / 2, by + 34 * S0,
          { fs: 10 * S0, color: P.gold, align: 'center', ls: 3 });
        ctx.restore();
      }
      cornerMarks(ctx, c);
      UI.label(ctx, 'T+' + t.toFixed(2), W * 0.955, H * 0.94, { fs: 9 * S0, color: P.ink18, align: 'right' });
    }
  });

  /* =====================================================================
     95.15 — NOW (1.46s)
     ===================================================================== */
  add({
    t: 95.15, id: 'now1', name: 'NOW', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var k = K.easeIn(K.clamp(t / 1.46, 0, 1));
      ctx.save();
      ctx.fillStyle = 'rgba(10,10,12,' + (0.55 * (1 - k)) + ')';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      /* the character hurtles toward the lens and we pass through it */
      var sc = K.lp(1, 7.5, K.easeIn(t / 1.46));
      G.extrude(ctx, '今', W / 2, H * 0.47, Math.min(W * 0.30, 280 * S0), {
        depth: 16 * S0, ang: -1.1, color: P.ink, side: '#15161a',
        alpha: K.clamp(t / 0.10, 0, 1), scale: sc, family: K.F.jp, weight: 300,
        disp: c.disp
      });
      if (t > 1.1) {
        ctx.save();
        ctx.globalAlpha = K.clamp((t - 1.1) / 0.36, 0, 1) * 0.9;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }
  });

  /* =====================================================================
     96.61 — IGNITION: a tunnel of frames, then through it
     ===================================================================== */
  add({
    t: 96.61, id: 'ignite', name: 'IGNITION', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var rush = Math.min(1, t / 5.2);
      var speed = 7 + rush * 17;
      var shakeK = c.k * 0.6;
      G.begin({
        pos: [K.srnd(Math.floor(c.t * 30), 3) * shakeK, K.srnd(Math.floor(c.t * 30), 6) * shakeK * 0.6, 4.4],
        tgt: [0, 0, -14], fov: 64
      });
      /* the core we are flying into */
      var core = G.proj([0, 0, -30]);
      if (core) {
        var g = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, 190 * S0);
        g.addColorStop(0, 'rgba(255,255,255,.55)');
        g.addColorStop(0.28, 'rgba(255,194,71,.18)');
        g.addColorStop(1, 'rgba(255,194,71,0)');
        ctx.save();
        ctx.fillStyle = g;
        ctx.fillRect(core.x - 200 * S0, core.y - 200 * S0, 400 * S0, 400 * S0);
        ctx.restore();
      }
      /* tunnel frames: same world size, receding — so they converge */
      for (var i = 0; i < 16; i++) {
        var z = -(((i * 2.4 - t * speed) % 38) + 38) % 38 - 1.2;
        var rot = i * 0.16 + t * 0.12;
        var hw = 3.1, hh = 1.75;
        var pts = [[-hw, -hh, z], [hw, -hh, z], [hw, hh, z], [-hw, hh, z], [-hw, -hh, z]];
        var rp = pts.map(function (p) {
          var x = p[0] * Math.cos(rot) - p[1] * Math.sin(rot) * 0.3;
          var y = p[0] * Math.sin(rot) * 0.3 + p[1] * Math.cos(rot);
          return [x, y, p[2]];
        });
        var near = K.clamp(1 - (-z) / 40, 0, 1);
        G.polyline(ctx, rp, {
          color: i % 4 === 0 ? P.gold : P.ink,
          alpha: 0.12 + 0.55 * near, w: i % 4 === 0 ? 1.5 : 1, depthFade: false
        });
      }
      /* floor + ceiling rails */
      for (var s2 = 0; s2 < 2; s2++) {
        var yy = s2 ? 1.9 : -1.9;
        for (var q = -3; q <= 3; q++) {
          G.line(ctx, [q * 1.6, yy, -1], [q * 1.6, yy, -36], {
            color: P.ink, alpha: 0.10, w: 1, depthFade: false
          });
        }
      }
      /* windows overtaking us on both sides */
      var items = [];
      for (var j = 0; j < 10; j++) {
        var zz = -(((j * 5.0 - t * speed) % 46) + 46) % 46 - 1.5;
        items.push({ z: zz, x: (j % 2 ? 1 : -1) * 2.5, y: (K.rnd(j, 3) - 0.5) * 1.5, i: j });
      }
      items.sort(function (a, b) { return a.z - b.z; });
      for (var m = 0; m < items.length; m++) {
        var it = items[m], blk = K.Code.blocks[it.i % K.Code.blocks.length];
        var pp = panel3(ctx, it.x, it.y, it.z, 2.6, 1.45, {
          title: blk.file, alpha: 1, border: it.i % 4 === 1 ? P.cyan : P.ink50,
          bg: 'rgba(28,30,35,.94)', far: 40, seed: it.i
        });
        if (pp) {
          ctx.save();
          ctx.globalAlpha = pp.a * 0.95;
          if (pp.w > 250) {
            var ifs = Math.min(26, (pp.w * 0.86) / (K.Code.width(blk) * 0.60));
            K.Code.draw(ctx, blk, pp.x - pp.w / 2 + 7, pp.y - pp.h / 2 + K.clamp(pp.h * 0.24, 9, 20) + 8, {
              size: ifs, lh: ifs * 1.5, chars: 200
            });
          }
          ctx.restore();
        }
      }
      /* speed lines */
      var rnd = K.mulberry(77);
      ctx.save();
      for (var s3 = 0; s3 < 110; s3++) {
        var a = rnd() * 6.2832;
        var r0 = 50 + rnd() * 340 * (1.1 - rush * 0.4);
        var len = 40 + rnd() * 300 * rush;
        var x0 = W / 2 + Math.cos(a) * r0, y0 = H / 2 + Math.sin(a) * r0;
        ctx.globalAlpha = (0.08 + rnd() * 0.40) * rush;
        ctx.strokeStyle = rnd() > 0.9 ? P.gold : P.ink;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(W / 2 + Math.cos(a) * (r0 + len), H / 2 + Math.sin(a) * (r0 + len));
        ctx.stroke();
      }
      ctx.restore();
      cornerMarks(ctx, c);
      UI.label(ctx, 'VELOCITY  ' + (speed * 12).toFixed(0) + ' u/s', W * 0.955, H * 0.94,
        { fs: 9 * S0, color: P.ink30, align: 'right' });
    }
  });

  /* =====================================================================
     102.84 — TEARS
     ===================================================================== */
  add({
    t: 102.84, id: 'tears', name: 'TEARS', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      ctx.save();
      for (var i = 0; i < 120; i++) {
        var x = K.rnd(i, 1.3) * W;
        var sp = 90 + K.rnd(i, 2.7) * 260;
        var y = ((K.rnd(i, 9.1) * H + t * sp) % (H + 200)) - 100;
        var len = 30 + K.rnd(i, 4.4) * 130;
        var a = 0.10 + K.rnd(i, 6.2) * 0.45;
        var g = ctx.createLinearGradient(x, y - len, x, y);
        g.addColorStop(0, 'rgba(94,231,255,0)');
        g.addColorStop(1, 'rgba(180,240,255,' + a + ')');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1 + K.rnd(i, 8) * 1.2;
        ctx.beginPath(); ctx.moveTo(x, y - len); ctx.lineTo(x, y); ctx.stroke();
      }
      ctx.restore();
      /* the water line */
      var wl = H * 0.695;
      var g2 = ctx.createLinearGradient(0, wl - 40 * S0, 0, H);
      g2.addColorStop(0, 'rgba(94,231,255,0)');
      g2.addColorStop(0.5, 'rgba(94,231,255,.12)');
      g2.addColorStop(1, 'rgba(94,231,255,.02)');
      ctx.save();
      ctx.fillStyle = g2;
      ctx.fillRect(0, wl - 40 * S0, W, H - wl + 40 * S0);
      ctx.strokeStyle = 'rgba(180,240,255,.5)';
      ctx.beginPath(); ctx.moveTo(0, wl); ctx.lineTo(W, wl); ctx.stroke();
      /* ripples on the beat */
      for (var r = 0; r < 3; r++) {
        var age = ((t * 0.75 + r / 3) % 1);
        ctx.globalAlpha = (1 - age) * 0.35 * (0.4 + c.k);
        ctx.strokeStyle = P.cyan;
        ctx.beginPath();
        ctx.ellipse(W / 2, wl, age * W * 0.45, age * 40 * S0, 0, 0, 6.2832);
        ctx.stroke();
      }
      ctx.restore();
      K.Math.draw(ctx, '∂²u/∂t² = c²∇²u', W * 0.955, H * 0.16, 16 * S0, { color: P.ink30, align: 'right' });
      UI.label(ctx, 'fluid: saline  ·  volume: rising', W * 0.045, H * 0.16, { fs: 9.5 * S0, color: P.ink30, ls: 1.6 });
      cornerMarks(ctx, c);
    }
  });

  /* =====================================================================
     108.84 — TREMBLE: shake, ECG, double pendulum
     ===================================================================== */
  add({
    t: 108.84, id: 'tremble', name: 'TREMBLE', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      ctx.save();
      G.begin({ pos: [0, 0.3, 6.2], tgt: [0, 0.2, 0], fov: 44 });
      K.V.pendulum(ctx, c.t, {
        x: 0, y: 1.5, scale: 1.55, rate: 60,
        trail: 'rgba(94,231,255,.45)', arm: P.ink, dot: P.gold
      });
      /* ECG across the full width */
      var y = H * 0.30;
      ctx.save();
      ctx.strokeStyle = P.ink70;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      var n = 500;
      for (var i = 0; i <= n; i++) {
        var u = i / n;
        var x = u * W;
        var beat = Math.exp(-Math.pow((K.frac(u * 7 - c.t * 0.8) - 0.2) * 12, 2)) * 96 * S0;
        var noise = (K.rnd(i + Math.floor(c.t * 30), 3) - 0.5) * 4 * S0;
        var yy = y - beat + noise;
        if (i === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
      ctx.restore();
      ctx.restore();
      UI.label(ctx, 'BPM  140.00  ·  Δ ±' + (6 + 12 * c.k).toFixed(1) + 'px', W * 0.045, H * 0.16,
        { fs: 10 * S0, color: P.gold, ls: 2 });
      UI.label(ctx, 'tremor detected', W * 0.955, H * 0.16, { fs: 10 * S0, color: P.ink50, align: 'right' });
      cornerMarks(ctx, c);
    }
  });

  /* =====================================================================
     116.59 — QUESTION: four quadrants
     ===================================================================== */
  add({
    t: 116.59, id: 'question', name: 'QUESTION', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var cx = W / 2, cy = H * 0.44;
      ctx.save();
      ctx.strokeStyle = P.ink30;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, 0); ctx.lineTo(cx, H);
      ctx.moveTo(0, cy); ctx.lineTo(W, cy);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      /* Q1: tesseract */
      ctx.beginPath(); ctx.rect(0, 0, cx, cy); ctx.clip();
      G.begin({ pos: [0, 0.6, 4.2], tgt: [0, 0, 0], fov: 40 });
      ctx.save(); ctx.translate(0, -cy * 0.55); G.points(ctx, [], {}); ctx.restore();
      G.begin({ pos: [Math.sin(t * 0.4) * 5, 0.3, Math.cos(t * 0.4) * 5], tgt: [0, 0, 0], fov: 40 });
      ctx.save(); ctx.translate(cx * 0.5 - W / 2, cy * 0.5 - H / 2);
      K.V.tesseract(ctx, c.t, { size: 0.55, color: P.ink50, alpha: 0.8, verts: true });
      ctx.restore();
      ctx.restore();
      /* Q2: julia */
      ctx.save();
      ctx.beginPath(); ctx.rect(cx, 0, cx, cy); ctx.clip();
      K.V.julia(ctx, c.t, { x: cx, y: 0, w: cx, h: cy, alpha: 0.30, size: 420 });
      ctx.restore();
      /* Q3: hexdump */
      ctx.save();
      ctx.beginPath(); ctx.rect(0, cy, cx, H - cy); ctx.clip();
      K.V.hexdump(ctx, c, { x: W * 0.06, y: cy + 40 * S0, rows: 10, size: 11 * S0, lh: 18 * S0, alpha: 0.5, rate: 11 });
      ctx.restore();
      /* Q4: pendulum, mirrored */
      ctx.save();
      ctx.beginPath(); ctx.rect(cx, cy, cx, H - cy); ctx.clip();
      G.begin({ pos: [0, 0.2, 5.4], tgt: [0, 0.2, 0], fov: 44 });
      ctx.translate(cx + cx / 2 - W / 2, cy + (H - cy) / 2 - H / 2);
      K.V.pendulum(ctx, c.t, { x: 0, y: 1.4, scale: 1.0, rate: 42, trail: 'rgba(195,155,255,.35)', arm: P.ink50, dot: P.purple });
      ctx.restore();
      /* the question */
      var pulse = 0.5 + 0.5 * Math.sin(t * 3.1);
      ctx.save();
      K.setFont(ctx, Math.min(W * 0.13, 132 * S0), K.F.ui, 700);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = P.ink;
      ctx.globalAlpha = 0.92;
      ctx.fillText('?', cx, cy + 4);
      ctx.globalAlpha = 0.25 + pulse * 0.3;
      ctx.strokeStyle = P.gold;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, 60 * S0 + pulse * 14 * S0, 0, 6.2832); ctx.stroke();
      ctx.restore();
      UI.label(ctx, 'IS THIS THE HEART I ASKED FOR', cx, H * 0.93, { fs: 10 * S0, color: P.ink30, align: 'center', ls: 3 });
    }
  });

  K.Scene = {
    cues: cues,
    add: add,
    panel3: panel3, cornerMarks: cornerMarks, topRule: topRule, segLines: segLines,
    at: function (t) {
      var lo = 0, hi = cues.length - 1, idx = 0;
      while (lo <= hi) {
        var mid = (lo + hi) >> 1;
        if (cues[mid].t <= t) { idx = mid; lo = mid + 1; } else hi = mid - 1;
      }
      return cues[idx];
    },
    sort: function () { cues.sort(function (a, b) { return a.t - b.t; }); return cues.length; }
  };

})(window.K);
