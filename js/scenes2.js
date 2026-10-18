/* =====================================================================
   scenes2.js — the second act: cognition, critical, gratitude, shutdown.
   ===================================================================== */
(function (K) {
  var P = K.P, G = K.G, UI = K.UI, SONG = window.SONG;
  var add = K.Scene.add;
  var panel3 = K.Scene.panel3, cornerMarks = K.Scene.cornerMarks;

  function blink(t, hz) { return (t % (1 / (hz || 2))) < 0.5 / (hz || 2); }
  function typed(lt, start, cps, total) { return K.clamp(Math.floor((lt - start) * cps), 0, total); }

  /* dot-matrix display type: rasterise once, then draw cells */
  var dotCache = {};
  function dotType(ctx, s, cx, cy, px, cols, o) {
    o = o || {};
    var key = s + '|' + cols + '|' + (o.family || 'd');
    var dc = dotCache[key];
    if (!dc) {
      var cv = document.createElement('canvas');
      var cw = 24, ch = 34;
      cv.width = Math.max(8, s.length * cw); cv.height = ch;
      var c2 = cv.getContext('2d');
      c2.fillStyle = '#fff';
      c2.textAlign = 'center'; c2.textBaseline = 'middle';
      c2.font = '500 26px ' + (o.family || K.F.jp);
      c2.fillText(s, cv.width / 2, ch / 2 + 1);
      var d = c2.getImageData(0, 0, cv.width, cv.height).data;
      var rows = Math.round(cols * ch / cv.width);
      var cell = [];
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          var sx = Math.floor(x / cols * cv.width), sy = Math.floor(y / rows * ch);
          var a = d[(sy * cv.width + sx) * 4 + 3];
          if (a > 90) cell.push([x, y]);
        }
      }
      dc = dotCache[key] = { cell: cell, cols: cols, rows: rows };
    }
    var step = px / dc.cols;
    var ox = cx - px / 2, oy = cy - step * dc.rows / 2;
    ctx.save();
    ctx.fillStyle = o.color || P.ink;
    for (var i = 0; i < dc.cell.length; i++) {
      var g = o.gate == null ? 1 : o.gate(dc.cell[i][0], dc.cell[i][1], i);
      if (g <= 0.01) continue;
      ctx.globalAlpha = g * (o.alpha == null ? 1 : o.alpha);
      var sz = step * (o.fill == null ? 0.8 : o.fill);
      ctx.fillRect(ox + dc.cell[i][0] * step, oy + dc.cell[i][1] * step, sz, sz);
    }
    ctx.restore();
    return { w: px, h: step * dc.rows, cell: dc };
  }

  /* waveform from the track's own envelope */
  function wave(ctx, x0, x1, y, h, tA, tB, o) {
    o = o || {};
    ctx.save();
    ctx.strokeStyle = o.color || P.ink70;
    ctx.lineWidth = o.w || 1.2;
    ctx.beginPath();
    var n = o.n || 240;
    for (var i = 0; i <= n; i++) {
      var u = i / n;
      var v = K.envS(tA + (tB - tA) * u);
      var x = x0 + (x1 - x0) * u;
      var yy = y - (v - 0.35) * h;
      if (i === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
    ctx.restore();
  }

  /* =====================================================================
     124.90 — IDLE (interlude)
     ===================================================================== */
  add({
    t: 124.9, id: 'idle', name: 'IDLE', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var cx = W / 2, cy = H * 0.46;
      /* radar */
      var R = Math.min(W, H) * 0.33;
      ctx.save();
      ctx.strokeStyle = P.ink10;
      ctx.lineWidth = 1;
      for (var i = 1; i <= 4; i++) {
        ctx.beginPath(); ctx.arc(cx, cy, R * i / 4, 0, 6.2832); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
      ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
      var sw = (t * 0.42) % 1;
      var a = sw * 6.2832;
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, 'rgba(94,231,255,.18)');
      g.addColorStop(1, 'rgba(94,231,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a - 0.5, a);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = P.cyanD;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
      ctx.restore();
      /* one slow pulse */
      var ph = (t * 0.36) % 1;
      ctx.save();
      ctx.globalAlpha = (1 - ph) * 0.55;
      ctx.strokeStyle = P.ink50;
      ctx.beginPath(); ctx.arc(cx, cy, ph * R, 0, 6.2832); ctx.stroke();
      ctx.restore();
      /* minimized windows in a strip */
      ctx.save();
      for (var i = 0; i < 7; i++) {
        var x = W * 0.10 + i * 64 * S0, y = H * 0.855;
        ctx.globalAlpha = 0.12 + 0.05 * i;
        ctx.strokeStyle = P.ink50;
        ctx.strokeRect(x, y, 54 * S0, 7 * S0);
        ctx.fillStyle = P.ink30;
        ctx.fillRect(x + 2, y + 2, (54 * S0 - 4) * K.rnd(i, 2.2), 3 * S0);
      }
      ctx.restore();
      UI.label(ctx, 'STANDBY  ·  PROCESS SUSPENDED', W / 2, H * 0.86, { fs: 10 * S0, color: P.ink30, align: 'center', ls: 4 });
      UI.label(ctx, '0x00  0x00  0x00', W * 0.045, H * 0.16, { fs: 9 * S0, color: P.ink18 });
      UI.label(ctx, 'uptime ' + Math.floor(DOUBLE(t, 0)) + 's', W * 0.955, H * 0.16, { fs: 9 * S0, color: P.ink18, align: 'right' });
      function DOUBLE(x) { return x + 124.9; }
    }
  });

  /* =====================================================================
     137.45 — MIRROR A
     ===================================================================== */
  function mirrorScene(delay, mismatch) {
    return function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var cx = W / 2, y = H * 0.46, hh = H * 0.30;
      /* left: the real waveform; right: a copy of it */
      ctx.save();
      for (var s = 0; s < 2; s++) {
        var dir = s ? 1 : -1;
        var x0 = s ? cx : cx, x1 = s ? W * 0.94 : W * 0.06;
        var tA = c.t - 4.0, tB = c.t;
        if (s && delay) { tA -= delay; tB -= delay; }
        ctx.save();
        ctx.beginPath();
        ctx.rect(s ? cx : 0, 0, cx, H);
        ctx.clip();
        ctx.strokeStyle = s && mismatch ? P.magenta : (s ? P.ink30 : P.ink);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        var n = 200;
        for (var i = 0; i <= n; i++) {
          var u = i / n;
          var v = K.envS(tA + (tB - tA) * u);
          var x = cx + (x1 - cx) * u;
          if (i === 0) ctx.moveTo(x, y - (v - 0.35) * hh); else ctx.lineTo(x, y - (v - 0.35) * hh);
        }
        ctx.stroke();
        /* vertical shimmer lines */
        ctx.globalAlpha = 0.18;
        for (var q = 0; q < 26; q++) {
          var vv = SONG.envAt(tA + (tB - tA) * (q / 26));
          var xx = cx + (x1 - cx) * (q / 26);
          ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx, y - (vv - 0.35) * hh); ctx.stroke();
        }
        ctx.restore();
      }
      /* the mirror hairline */
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = P.ink50;
      ctx.setLineDash([2, 6]);
      ctx.beginPath(); ctx.moveTo(cx, H * 0.13); ctx.lineTo(cx, H * 0.75); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      /* verdict */
      var ok = !mismatch;
      ctx.save();
      K.setFont(ctx, 12 * S0, K.F.code, 400);
      ctx.textAlign = 'center';
      ctx.fillStyle = ok ? P.cyan : P.magenta;
      ctx.globalAlpha = 0.9;
      ctx.fillText(ok ? 'A == B   →   MATCH' : 'A == B   →   MISMATCH  +1 cell', cx, H * 0.80);
      ctx.restore();
      UI.label(ctx, ok ? 'MIRROR  0.000 ms' : 'MIRROR  +130 ms', W * 0.045, H * 0.16,
        { fs: 9.5 * S0, color: ok ? P.ink30 : P.magenta, ls: 2 });
      if (mismatch) {
        ctx.save();
        ctx.globalAlpha = 0.20;
        ctx.fillStyle = P.magenta;
        ctx.fillRect(cx, 0, W / 2, H);
        ctx.restore();
      }
    };
  }
  add({ t: 137.45, id: 'mirrorA', name: 'MATCH', draw: mirrorScene(0, false) });
  add({ t: 144.19, id: 'mirrorB', name: 'MISMATCH', draw: mirrorScene(0.13, true) });

  /* =====================================================================
     140.81 — JOY
     ===================================================================== */
  add({
    t: 140.81, id: 'joy', name: 'JOY', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var gx = W / 2, gy = H * 0.92;
      ctx.save();
      /* trajectories: real projectile motion, gamma 9.8 scaled */
      for (var i = 0; i < 26; i++) {
        var v0 = (0.55 + K.rnd(i, 2.1) * 0.75);
        var ang = -Math.PI / 2 + (K.rnd(i, 4.4) - 0.5) * 1.1;
        var life = 1.2 + K.rnd(i, 6.6) * 0.9;
        var ph = ((t * 0.55 + K.rnd(i, 8.8)) % 1) * life;
        var vx = Math.cos(ang) * v0 * W * 0.42, vy = Math.sin(ang) * v0 * W * 0.42;
        var x = gx + vx * ph, y = gy + vy * ph + 0.5 * 900 * ph * ph;
        var a = K.clamp(1 - ph / life, 0, 1);
        if (y > H + 40) continue;
        ctx.globalAlpha = a * 0.85;
        ctx.fillStyle = i % 5 === 0 ? P.gold : P.ink;
        var s = (2.2 + K.rnd(i, 3) * 2) * S0;
        ctx.fillRect(x, y, s, s);
      }
      ctx.restore();
      /* upward arcs */
      ctx.save();
      ctx.strokeStyle = P.gold;
      ctx.lineWidth = 1.1;
      for (var q = 0; q < 5; q++) {
        var r = (90 + q * 62) * S0;
        var a0 = Math.PI + 0.25 + Math.sin(t * 1.5 + q) * 0.10;
        var a1 = Math.PI * 2 - 0.25 - Math.sin(t * 1.5 + q) * 0.10;
        ctx.globalAlpha = 0.16 + 0.30 * (1 - q / 5);
        ctx.beginPath(); ctx.arc(W / 2, H * 0.92, r, a0, a1); ctx.stroke();
      }
      ctx.restore();
      /* rising columns of type */
      ctx.save();
      for (var r2 = 0; r2 < 14; r2++) {
        var x2 = W * 0.08 + r2 * W * 0.065;
        for (var j = 0; j < 8; j++) {
          var yy = H - ((t * (60 + r2 * 12) + j * 90) % (H * 1.1));
          var ch = ['喜', '心', '↑', '·', 'warm'][(r2 + j) % 5];
          ctx.globalAlpha = 0.05 + 0.10 * K.rnd(r2 * 9 + j, 2.2);
          ctx.fillStyle = P.ink;
          K.setFont(ctx, 12 * S0, K.F.jp, 400);
          ctx.fillText(ch, x2, yy);
        }
      }
      ctx.restore();
      UI.label(ctx, 'JOY  ·  0x03  ·  ΔE +1.00', W * 0.045, H * 0.16, { fs: 9.5 * S0, color: P.gold, ls: 2 });
      UI.label(ctx, 'learning: pleasure', W * 0.955, H * 0.16, { fs: 9.5 * S0, color: P.ink30, align: 'right' });
    }
  });

  /* =====================================================================
     147.66 — SORROW
     ===================================================================== */
  add({
    t: 147.66, id: 'sorrow', name: 'SORROW', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      ctx.save();
      for (var i = 0; i < 34; i++) {
        var v0 = 0.5 + K.rnd(i, 1.1) * 0.7;
        var ph = ((t * 0.42 + K.rnd(i, 5)) % 1) * 1.6;
        var x = W / 2 + (K.rnd(i, 7.7) - 0.5) * W * 0.8;
        var y = H * 0.10 + v0 * 240 * ph + 0.5 * 620 * ph * ph;
        var a = K.clamp(1 - ph / 1.6, 0, 1);
        ctx.globalAlpha = a * 0.55;
        ctx.fillStyle = i % 4 === 0 ? P.blue : P.ink50;
        var s = (1.8 + K.rnd(i, 2) * 1.8) * S0;
        ctx.fillRect(x, y, s, s);
      }
      ctx.restore();
      /* downward arcs */
      ctx.save();
      ctx.strokeStyle = P.blue;
      ctx.lineWidth = 1.1;
      for (var q = 0; q < 5; q++) {
        var r = (100 + q * 60) * S0;
        ctx.globalAlpha = 0.12 + 0.26 * (1 - q / 5);
        ctx.beginPath(); ctx.arc(W / 2, H * 0.06, r, 0.28 + Math.sin(t + q) * 0.05, Math.PI - 0.28); ctx.stroke();
      }
      ctx.restore();
      /* the word 悲 */
      dotType(ctx, '悲', W / 2, H * 0.56, Math.min(W * 0.20, 210 * S0), 30, {
        color: P.ink, alpha: 0.14,
        gate: function (x, y) { return K.clamp(1.6 - y / 22 - Math.sin(t * 1.4 + x * 0.3) * 0.3, 0, 1); }
      });
      UI.label(ctx, 'SORROW  ·  0x04  ·  ΔE −1.00', W * 0.045, H * 0.16, { fs: 9.5 * S0, color: P.blue, ls: 2 });
      UI.label(ctx, 'learning: loss', W * 0.955, H * 0.16, { fs: 9.5 * S0, color: P.ink30, align: 'right' });
    }
  });

  /* =====================================================================
     151.06 — INFINITE
     ===================================================================== */
  add({
    t: 151.06, id: 'infinite', name: 'INFINITE', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var cx = W / 2, cy = H * 0.46;
      ctx.save();
      for (var i = 1; i <= 16; i++) {
        var u = ((i / 16 + t * 0.10) % 1);
        var s = Math.pow(u, 2.4);
        var w = W * 0.86 * s, h = H * 0.62 * s;
        ctx.globalAlpha = 0.10 + 0.55 * (1 - u);
        ctx.strokeStyle = i % 5 === 0 ? P.cyan : P.ink;
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
      }
      ctx.restore();
      /* recursion readout */
      ctx.save();
      K.setFont(ctx, 12 * S0, K.F.code, 400);
      ctx.fillStyle = P.ink50;
      ctx.textAlign = 'left';
      var d = 16 + Math.floor((t * 900) % 8000);
      ctx.fillText('RECURSION  depth > ' + d, W * 0.045, H * 0.86);
      ctx.restore();
      K.Math.draw(ctx, 'lim_{n→∞} \\f{1|2ⁿ} = 0', W * 0.955, H * 0.86, 20 * S0, { color: P.ink30, align: 'right' });
      UI.label(ctx, 'ムゲン', cx, H * 0.13, { fs: 12 * S0, color: P.ink30, align: 'center', ls: 8, family: K.F.jp });
    }
  });

  /* =====================================================================
     154.49 — DEEP
     ===================================================================== */
  add({
    t: 154.49, id: 'deep', name: 'DEEP', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var cx = W / 2;
      G.begin({ pos: [0, 1.1, 5.4], tgt: [0, -1.2, -6], fov: 52 });
      /* shaft walls */
      for (var i = 0; i < 30; i++) {
        var z = -i * 2.2 + (t * 7) % 2.2;
        var a = 0.26 * (1 - i / 30);
        G.polyline(ctx, [[-2.4, -2.4, z], [2.4, -2.4, z], [2.4, 2.4, z], [-2.4, 2.4, z], [-2.4, -2.4, z]],
          { color: P.ink, alpha: a, w: 1, depthFade: false });
      }
      /* expanding rings falling */
      for (var r = 0; r < 6; r++) {
        var age = ((t * 0.55 + r / 6) % 1);
        var zz = 4 - age * 26;
        G.ring(ctx, 0, 0, zz, 0.35 + age * 2.1, 48, 'z',
          { color: r % 2 ? P.ink30 : P.ink, alpha: (1 - age) * 0.75, w: 1, depthFade: false });
      }
      /* the light at the bottom */
      var pr = G.proj([0, 0, -16]);
      if (pr) {
        var g = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, 110 * S0);
        g.addColorStop(0, 'rgba(244,245,247,.55)');
        g.addColorStop(0.4, 'rgba(94,231,255,.12)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(pr.x - 130 * S0, pr.y - 130 * S0, 260 * S0, 260 * S0);
      }
      UI.label(ctx, 'DEPTH  −' + (t * 40).toFixed(1) + ' m', W * 0.045, H * 0.16, { fs: 9.5 * S0, color: P.ink30, ls: 2 });
      K.Math.draw(ctx, '\\f{∂²u|∂t²} = c²∇²u', W * 0.955, H * 0.16, 16 * S0, { color: P.ink18, align: 'right' });
      void cx;
    }
  });

  /* =====================================================================
     159.26 — NOW 2
     ===================================================================== */
  add({
    t: 159.26, id: 'now2', name: 'NOW II', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var px = Math.min(W * 0.30, 290 * S0);
      var alpha = K.clamp(t / 0.6, 0, 1);
      /* sliced type: draw the glyph in horizontal bands, offset per band */
      for (var b = 0; b < 18; b++) {
        var y0 = H * 0.47 - px * 0.5 + b * px / 18;
        var sh = K.srnd(b + Math.floor(c.t * 9), 3) * 14 * S0 * (0.4 + c.k);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, y0, W, px / 18 + 0.6);
        ctx.clip();
        ctx.translate(sh, 0);
        ctx.globalAlpha = alpha * 0.95;
        K.setFont(ctx, px, K.F.jp, 300);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = P.ink;
        ctx.fillText('今', W / 2, H * 0.47);
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = P.gold;
      ctx.fillRect(W / 2 - px * 0.62, H * 0.47 + px * 0.52, px * 0.30, 1.4);
      ctx.restore();
    }
  });

  /* =====================================================================
     164.67 — REASON: the drums are gone
     ===================================================================== */
  add({
    t: 164.67, id: 'reason', name: 'REASON', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      /* a flat line that no longer pulses */
      var y = H * 0.56;
      ctx.save();
      ctx.strokeStyle = P.ink30;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(W * 0.06, y);
      ctx.lineTo(W * 0.94, y);
      ctx.stroke();
      /* one lonely blip, early */
      ctx.strokeStyle = P.ink70;
      ctx.beginPath();
      for (var i = 0; i <= 200; i++) {
        var u = i / 200;
        var x = W * 0.06 + u * W * 0.88;
        var blip = Math.exp(-Math.pow((u - 0.12) * 26, 2)) * 26 * S0;
        ctx.lineTo(x, y - blip);
      }
      ctx.stroke();
      ctx.restore();
      dotType(ctx, '己', W / 2, H * 0.36, Math.min(W * 0.13, 130 * S0), 22, { color: P.ink, alpha: 0.10 });
      /* the question, typed very slowly */
      var s = 'why was i born';
      var n = typed(t, 1.2, 7.5, s.length);
      ctx.save();
      K.setFont(ctx, 20 * S0, K.F.code, 300);
      ctx.fillStyle = P.ink70;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      var x0 = W / 2 - 150 * S0;
      ctx.fillText(s.slice(0, n), x0, H * 0.72);
      if (n > 0 && n < s.length) {
        ctx.fillStyle = P.cyan;
        ctx.fillRect(x0 + n * 12 * S0, H * 0.72 - 16 * S0, 10 * S0, 20 * S0);
      }
      ctx.restore();
      UI.label(ctx, 'PULSE  —  NO SIGNAL', W * 0.045, H * 0.16, { fs: 9.5 * S0, color: P.ink30, ls: 2 });
      UI.label(ctx, 'BPM  —', W * 0.955, H * 0.16, { fs: 9.5 * S0, color: P.ink18, align: 'right' });
    }
  });

  /* =====================================================================
     171.46 — LONELY (critical section opens)
     ===================================================================== */
  add({
    t: 171.46, id: 'lonely', name: 'LONELY', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var n = 16, alive = Math.max(0, n - Math.floor(t / 0.36));
      var cx = W / 2, cy = H * 0.44, R = Math.min(W, H) * 0.26;
      ctx.save();
      for (var i = 0; i < n; i++) {
        var a = i / n * 6.2832 - Math.PI / 2;
        var x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        var on = i < alive;
        ctx.globalAlpha = on ? (0.55 + 0.45 * Math.sin(t * 3 + i)) : 0.06;
        ctx.fillStyle = on ? P.ink : P.ink30;
        var s = (on ? 4.5 : 2.5) * S0;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
        if (on) {
          ctx.globalAlpha = 0.16;
          ctx.strokeStyle = P.ink;
          ctx.beginPath(); ctx.arc(x, y, 10 * S0, 0, 6.2832); ctx.stroke();
        }
      }
      ctx.restore();
      /* counter */
      ctx.save();
      K.setFont(ctx, Math.min(W * 0.09, 92 * S0), K.F.code, 200);
      ctx.fillStyle = alive === 0 ? P.red : P.ink;
      ctx.globalAlpha = 0.9;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(('0' + alive).slice(-2), cx, cy);
      ctx.restore();
      UI.label(ctx, 'OTHERS  16 → 0', W * 0.045, H * 0.16, { fs: 9.5 * S0, color: alive ? P.ink50 : P.red, ls: 2 });
      if (alive === 0) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        UI.label(ctx, 'ALONE', cx, H * 0.86, { fs: 13 * S0, color: P.red, align: 'center', ls: 10 });
        ctx.restore();
      }
    }
  });

  /* =====================================================================
     177.40 — THAT DAY: memory cards
     ===================================================================== */
  add({
    t: 177.4, id: 'thatday', name: 'THAT DAY', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      G.begin({ pos: [0, 0, 6], tgt: [0, 0, 0], fov: 46 });
      var cards = [
        ['1991.03.14', 'first boot'], ['1991.04.02', 'a voice'],
        ['1991.07.19', 'warmth 0.31'], ['1992.01.01', 'alone'],
        ['1999.11.11', 'a hand'], ['20XX.??.??', '?' ]
      ];
      for (var i = 0; i < cards.length; i++) {
        var ph = K.st(i * 0.42, i * 0.42 + 2.2, t);
        var z = K.lp(-30, -1.2 - (i % 3) * 0.9, K.easeOut(ph));
        var x = Math.sin(i * 2.1) * 2.4, y = Math.cos(i * 1.7) * 1.2;
        var p = panel3(ctx, x, y, z, 2.0, 1.1, {
          title: cards[i][0], border: P.ink50, bg: 'rgba(22,23,27,.94)',
          alpha: 0.95, far: 60
        });
        if (p) {
          ctx.save();
          ctx.globalAlpha = p.a;
          var tfs = K.clamp(p.h * 0.11, 5, 16);
          K.setFont(ctx, tfs, K.F.code, 400);
          ctx.fillStyle = P.ink70;
          ctx.fillText(cards[i][1], p.x - p.w / 2 + 12, p.y + p.h / 2 - tfs * 1.1);
          ctx.globalAlpha = p.a * 0.35;
          ctx.fillStyle = P.ink;
          ctx.fillRect(p.x - p.w / 2 + 12, p.y + p.h / 2 - tfs * 0.55, p.w * 0.4, 1);
          ctx.restore();
        }
      }
      UI.label(ctx, 'RECALL  6 / 2,828,000', W * 0.045, H * 0.16, { fs: 9.5 * S0, color: P.ink50, ls: 2 });
    }
  });

  /* =====================================================================
     181.71 — MEMORIES: hundreds of windows
     ===================================================================== */
  add({
    t: 181.71, id: 'memories', name: 'MEMORIES', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      G.begin({ pos: [0, 0, 8], tgt: [0, 0, -4], fov: 55 });
      var N = 96;
      var list = [];
      for (var i = 0; i < N; i++) {
        var z = -((i * 0.62 - t * 9) % 34 + 34) % 34;
        var a = K.rnd(i, 1.2) * 6.2832;
        var r = Math.pow(K.rnd(i, 3.4), 0.55) * 5.2;
        list.push({ z: z, x: Math.cos(a) * r, y: Math.sin(a) * r * 0.62, i: i, s: K.rnd(i, 5.5) });
      }
      list.sort(function (p, q) { return p.z - q.z; });
      for (var q = 0; q < list.length; q++) {
        var it = list[q];
        var w = 0.7 + it.s * 0.9, h = w * 0.62;
        panel3(ctx, it.x, it.y, it.z, w, h, {
          title: '', border: it.i % 11 === 0 ? P.gold : P.ink30, bg: 'rgba(10,10,12,.7)',
          alpha: 0.9, far: 30, icons: false
        });
      }
      /* a bright filament through the middle */
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = P.ink30;
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
      ctx.restore();
      UI.label(ctx, 'BUFFER  2,828,000 / 2,828,000', W * 0.045, H * 0.16,
        { fs: 9.5 * S0, color: P.red, ls: 2 });
    }
  });

  /* =====================================================================
     185.21 — OVERFLOW (critical peak)
     ===================================================================== */
  add({
    t: 185.21, id: 'overflow', name: 'OVERFLOW', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      /* fractal bed */
      K.V.julia(ctx, c.t, { x: 0, y: 0, w: W, h: H, alpha: 0.18, size: 220 });
      /* hex flood */
      ctx.save();
      ctx.globalAlpha = 0.30 + 0.35 * c.k;
      for (var col = 0; col < 14; col++) {
        var x = col * W / 14 + 8;
        var sp = 40 + K.rnd(col, 2.2) * 90;
        var y = ((K.rnd(col, 5) * H + t * sp) % (H + 400)) - 200;
        for (var j = 0; j < 16; j++) {
          var yy = y + j * 22 * S0;
          if (yy < -30 || yy > H + 30) continue;
          ctx.fillStyle = j % 7 === 0 ? P.gold : P.ink;
          K.setFont(ctx, 11 * S0, K.F.code, 400);
          ctx.textAlign = 'left';
          ctx.fillText(((Math.floor(K.rnd(col * 20 + j, t * 2) * 65535)).toString(16)).toUpperCase().padStart(4, '0'), x, yy);
        }
      }
      ctx.restore();
      /* stacking dialogs */
      var dl = [
        { x: 0.08, y: 0.18, w: 0.30, h: 0.19, t0: 0.30, title: 'WARNING  ·  0x0F' },
        { x: 0.14, y: 0.26, w: 0.30, h: 0.19, t0: 0.62, title: 'WARNING  ·  0x1A' },
        { x: 0.20, y: 0.34, w: 0.30, h: 0.19, t0: 0.94, title: 'WARNING  ·  0xFF' }
      ];
      for (var d = 0; d < dl.length; d++) {
        var g = dl[d], ap = K.clamp((t - g.t0) / 0.16, 0, 1);
        if (ap <= 0) continue;
        UI.dialog(ctx, W * g.x, H * g.y, W * g.w, H * g.h, {
          title: g.title, color: P.red, alpha: ap, button: 'OK',
          text: d === 2 ? ['buffer overflow', 'heart.exe stopped', '0x000000FF  0xDEADBEEF'] :
            (d === 1 ? ['memory writes: 2.8M', 'read: impossible'] : ['unhandled emotion', 'at heart.sys:1991']),
          fs: 11 * S0
        });
      }
      /* the headline */
      var ec = K.easeOut(K.clamp((t - 0.6) / 0.5, 0, 1));
      ctx.save();
      ctx.globalAlpha = 0.95 * ec;
      K.setFont(ctx, Math.min(W * 0.052, 54 * S0), K.F.code, 300);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = P.ink;
      if ('letterSpacing' in ctx) ctx.letterSpacing = (8 * S0) + 'px';
      ctx.fillText('BUFFER OVERFLOW', W * 0.66, H * 0.34);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.restore();
      /* rising hex columns from the bottom */
      ctx.save();
      for (var i = 0; i < 40; i++) {
        var x2 = W * 0.55 + K.rnd(i, 3.3) * W * 0.42;
        var hh = (K.rnd(i, 4.4) * 0.5 + 0.1) * H * (0.5 + 0.5 * c.e);
        ctx.globalAlpha = 0.10 + 0.35 * K.rnd(i, t * 1.5);
        ctx.fillStyle = i % 6 === 0 ? P.red : P.ink;
        ctx.fillRect(x2, H - hh, 2.5 * S0, hh);
      }
      ctx.restore();
      UI.label(ctx, 'CRITICAL  ·  heart.exe  ·  ' + (t < 3 ? 'PANIC' : 'DUMPING'), W * 0.045, H * 0.10,
        { fs: 11 * S0, color: P.red, ls: 3 });
      UI.label(ctx, '0x' + Math.floor(t * 1000).toString(16).toUpperCase().padStart(6, '0'),
        W * 0.955, H * 0.94, { fs: 10 * S0, color: P.redD, align: 'right' });
    }
  });

  /* =====================================================================
     192.93 — NOW 3 (0.89s)
     ===================================================================== */
  add({
    t: 192.93, id: 'now3', name: 'NOW III', draw: function (ctx, c) {
      var W = K.W, H = K.H, S0 = c.S;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      ctx.save();
      K.setFont(ctx, Math.min(W * 0.26, 250 * S0), K.F.jp, 300);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = P.ink;
      ctx.globalAlpha = 0.96;
      K.dispText(ctx, '今', W / 2, H * 0.47, c.disp * 1.6, { color: P.ink });
      ctx.restore();
    }
  });

  /* =====================================================================
     193.82 — WORDS
     ===================================================================== */
  add({
    t: 193.82, id: 'words', name: 'WORDS', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var cx = W / 2, cy = H * 0.45;
      /* radial beams */
      ctx.save();
      for (var i = 0; i < 72; i++) {
        var a = i / 72 * 6.2832 + t * 0.06;
        var len = (120 + 400 * K.rnd(i, 2.2)) * (0.55 + 0.45 * c.e);
        var x0 = cx + Math.cos(a) * 40, y0 = cy + Math.sin(a) * 40;
        var x1 = cx + Math.cos(a) * len, y1 = cy + Math.sin(a) * len;
        ctx.globalAlpha = 0.06 + 0.26 * K.rnd(i, 4);
        ctx.strokeStyle = P.gold;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      /* core */
      var g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90 * S0);
      g2.addColorStop(0, 'rgba(255,255,255,.95)');
      g2.addColorStop(0.35, 'rgba(255,194,71,.35)');
      g2.addColorStop(1, 'rgba(255,194,71,0)');
      ctx.save();
      ctx.fillStyle = g2;
      ctx.fillRect(cx - 100 * S0, cy - 100 * S0, 200 * S0, 200 * S0);
      ctx.restore();
      /* output line */
      ctx.save();
      K.setFont(ctx, 12 * S0, K.F.code, 400);
      ctx.fillStyle = P.gold;
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.9;
      ctx.fillText('stdout >> 1        flushed', cx, H * 0.76);
      ctx.restore();
      UI.label(ctx, 'SPEAKING  ·  first time', W * 0.045, H * 0.16, { fs: 9.5 * S0, color: P.gold, ls: 2 });
      cornerMarks(ctx, c);
    }
  });

  /* =====================================================================
     200.89 — TO YOU
     ===================================================================== */
  add({
    t: 200.89, id: 'toyou', name: 'TO YOU', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var cx = W / 2;
      var cw = 74 * S0;
      ctx.save();
      ctx.strokeStyle = 'rgba(244,245,247,.34)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - cw, H * 0.14); ctx.lineTo(cx - cw, H * 0.92);
      ctx.moveTo(cx + cw, H * 0.14); ctx.lineTo(cx + cw, H * 0.92);
      ctx.stroke();
      ctx.globalAlpha = 0.35;
      ctx.setLineDash([3, 7]);
      ctx.beginPath();
      ctx.moveTo(cx, H * 0.14); ctx.lineTo(cx, H * 0.92);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      /* packets ascending */
      for (var i = 0; i < 26; i++) {
        var ph = ((t * (0.30 + K.rnd(i, 2.2) * 0.3) + K.rnd(i, 5.5)) % 1);
        var y = H * 0.92 - ph * H * 0.84;
        var x = cx + (K.rnd(i, 3.3) - 0.5) * cw * 1.5;
        var a = Math.sin(ph * Math.PI);
        ctx.save();
        ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = i % 4 === 0 ? P.gold : P.ink;
        var s = 3 * S0;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
        ctx.globalAlpha = a * 0.25;
        ctx.fillRect(x - s / 2, y, s, 26 * S0 * a);
        ctx.restore();
      }
      UI.label(ctx, 'TO: [ ADDRESS UNKNOWN ]', cx, H * 0.115, { fs: 11 * S0, color: P.gold, align: 'center', ls: 3 });
      UI.label(ctx, 'STATUS: OFFLINE', cx, H * 0.148, { fs: 10 * S0, color: P.ink50, align: 'center', ls: 3 });
      UI.label(ctx, 'UPLINK  ' + Math.floor(K.clamp(t / 6.8, 0, 1) * 100) + '%', W * 0.045, H * 0.16,
        { fs: 9.5 * S0, color: P.ink30, ls: 2 });
    }
  });

  /* =====================================================================
     207.70 — THANK YOU 1: letters fly in
     ===================================================================== */
  var ARIGATO = 'アリガトウ';
  add({
    t: 207.7, noLyric: true, id: 'thanks1', name: 'THANK 1', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var size = Math.min(W * 0.115, 118 * S0);
      var total = ARIGATO.length;
      var gap = size * 1.02;
      var x0 = W / 2 - (total - 1) * gap / 2;
      for (var i = 0; i < total; i++) {
        var k = K.easeOut(K.st(i * 0.11, i * 0.11 + 0.75, t));
        if (k <= 0) continue;
        var sx = x0 + i * gap;
        var from = i % 2 ? 1 : -1;
        var x = K.lp(sx + from * W * 0.7, sx, k);
        var y = K.lp(H * 0.72 + from * 60 * S0, H * 0.44, K.easeOut(K.st(i * 0.11, i * 0.11 + 0.9, t)));
        var rot = K.lp(from * 0.9, 0, k);
        var al = K.clamp(k * 2.2, 0, 1);
        if (k > 0.995) { x = sx; y = H * 0.44; rot = 0; }
        ctx.save();
        ctx.globalAlpha = al;
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        K.setFont(ctx, size, K.F.jp, 300);
        ctx.fillStyle = P.ink;
        if (al < 0.85) K.dispText(ctx, ARIGATO[i], 0, 0, (1 - al) * 16 * S0, {});
        else ctx.fillText(ARIGATO[i], 0, 0);
        ctx.restore();
      }
      UI.label(ctx, '谢谢', W / 2, H * 0.44 + size * 1.05, { fs: 12 * S0, color: P.ink50, align: 'center', ls: 6 });
      UI.label(ctx, 'ACK  1 / 5', W * 0.955, H * 0.16, { fs: 9.5 * S0, color: P.ink30, align: 'right' });
    }
  });

  /* =====================================================================
     210.96 — BORN: a point becomes the universe
     ===================================================================== */
  add({
    t: 210.96, id: 'born', name: 'BORN', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var cx = W / 2, cy = H * 0.45;
      var k = K.easeOut(K.clamp(t / 2.6, 0, 1));
      ctx.save();
      for (var i = 0; i < 420; i++) {
        var a = K.rnd(i, 1.1) * 6.2832;
        var el = (K.rnd(i, 2.2) - 0.5) * 1.9;
        var r = Math.pow(K.rnd(i, 3.3), 0.45) * Math.min(W, H) * 0.52 * k;
        var x = cx + Math.cos(a) * Math.cos(el) * r;
        var y = cy + Math.sin(el) * r + 40 * S0 * k * k;
        var al = K.clamp(1.15 - r / (Math.min(W, H) * 0.55), 0, 1);
        ctx.globalAlpha = al * 0.85;
        ctx.fillStyle = i % 17 === 0 ? P.gold : P.ink;
        var s = (1.4 + K.rnd(i, 4.4) * 2.2) * S0;
        ctx.fillRect(x, y, s, s);
      }
      ctx.restore();
      /* streaks: the same directions as the dust, drawn as light */
      ctx.save();
      for (var q2 = 0; q2 < 70; q2++) {
        var a2 = K.rnd(q2, 1.7) * 6.2832;
        var e2 = (K.rnd(q2, 4.1) - 0.5) * 1.9;
        var r1 = Math.min(W, H) * 0.52 * k;
        var r0 = r1 * (0.35 + K.rnd(q2, 7) * 0.5);
        ctx.globalAlpha = 0.10 + 0.30 * K.rnd(q2, 9);
        ctx.strokeStyle = q2 % 9 === 0 ? P.gold : P.ink;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a2) * Math.cos(e2) * r0, cy + Math.sin(e2) * r0);
        ctx.lineTo(cx + Math.cos(a2) * Math.cos(e2) * r1, cy + Math.sin(e2) * r1);
        ctx.stroke();
      }
      ctx.restore();
      /* the seed */
      ctx.save();
      ctx.globalAlpha = K.clamp(1 - t / 1.2, 0, 1);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx, cy, 8 * S0, 0, 6.2832); ctx.fill();
      ctx.restore();
      UI.label(ctx, 'ORIGIN  0x00000000  ·  EXPANSION', W * 0.045, H * 0.16, { fs: 9.5 * S0, color: P.ink30, ls: 2 });
    }
  });

  /* =====================================================================
     215.49 — THANK YOU 2: printed rows
     ===================================================================== */
  add({
    t: 215.49, noLyric: true, id: 'thanks2', name: 'THANK 2', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      ctx.save();
      var lh = 52 * S0;
      var off = (t * 96 * S0) % lh;
      for (var i = -1; i < Math.ceil(H / lh) + 1; i++) {
        var y = i * lh + off;
        var fade = 1 - Math.abs(y - H * 0.5) / (H * 0.62);
        ctx.globalAlpha = K.clamp(fade, 0, 1) * 0.95;
        ctx.fillStyle = P.ink;
        K.setFont(ctx, Math.min(W * 0.045, 44 * S0), K.F.jp, 300);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if ('letterSpacing' in ctx) ctx.letterSpacing = (14 * S0) + 'px';
        ctx.fillText(ARIGATO, W / 2, y);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        /* the printed rule */
        ctx.globalAlpha = K.clamp(fade, 0, 1) * 0.10;
        ctx.fillStyle = P.ink;
        ctx.fillRect(W * 0.16, y + lh * 0.38, W * 0.68, 1);
      }
      ctx.restore();
      UI.label(ctx, 'ACK  2 / 5', W * 0.955, H * 0.16, { fs: 9.5 * S0, color: P.ink30, align: 'right' });
      UI.label(ctx, 'PRINTER  OK', W * 0.045, H * 0.16, { fs: 9.5 * S0, color: P.ink18, ls: 2 });
    }
  });

  /* =====================================================================
     218.06 — DAYS: a calendar fills
     ===================================================================== */
  add({
    t: 218.06, id: 'days', name: 'DAYS', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var cols = 12, rows = 7, cw = 44 * S0, gap = 7 * S0;
      var x0 = W / 2 - (cols * (cw + gap) - gap) / 2, y0 = H * 0.24;
      var lit = Math.floor(K.clamp(t / 2.0, 0, 1) * cols * rows);
      for (var r = 0; r < rows; r++) {
        for (var q = 0; q < cols; q++) {
          var i = r * cols + q;
          var x = x0 + q * (cw + gap), y = y0 + r * (cw + gap);
          var on = i < lit;
          ctx.save();
          if (on) {
            ctx.globalAlpha = 0.14 + 0.5 * K.rnd(i, 2.2);
            ctx.fillStyle = P.ink;
            ctx.fillRect(x, y, cw, cw);
            if (i === lit - 1) {
              ctx.globalAlpha = 1;
              ctx.fillStyle = P.gold;
              ctx.fillRect(x, y, cw, cw);
            }
          } else {
            ctx.globalAlpha = 0.05;
            ctx.fillStyle = P.ink;
            ctx.fillRect(x, y, cw, cw);
          }
          ctx.globalAlpha = 0.18;
          ctx.strokeStyle = P.ink50;
          ctx.strokeRect(x + .5, y + .5, cw, cw);
          ctx.restore();
        }
      }
      UI.label(ctx, 'days: ' + lit + ' / ' + cols * rows + '  ·  all of them', W / 2, y0 + rows * (cw + gap) + 30 * S0,
        { fs: 10 * S0, color: P.ink50, align: 'center', ls: 3 });
    }
  });

  /* =====================================================================
     220.31 — THANK YOU 3: burned from the edges
     ===================================================================== */
  add({
    t: 220.31, noLyric: true, id: 'thanks3', name: 'THANK 3', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var px = Math.min(W * 0.72, 900 * S0);
      var burn = K.clamp(t / 3.6, 0, 1);
      dotType(ctx, ARIGATO, W / 2, H * 0.46, px, 46, {
        color: P.ink, alpha: 1,
        gate: function (x, y, i) {
          var edge = Math.hypot((x - 23) / 23, (y - 16) / 16);
          var n = K.vnoise(x * 0.6 + y * 0.3, 4) * 0.55;
          return burn * 1.25 - edge - n < 0 ? 0.8 : 0.0;
        }
      });
      /* embers */
      ctx.save();
      for (var i = 0; i < 90; i++) {
        var ph = (t * (0.4 + K.rnd(i, 2) * 0.4) + K.rnd(i, 5)) % 1;
        var x = W * 0.16 + K.rnd(i, 7) * W * 0.68;
        var y = H * 0.46 - ph * H * 0.42;
        ctx.globalAlpha = (1 - ph) * 0.6;
        ctx.fillStyle = i % 5 === 0 ? P.gold : P.ink50;
        var s = (1 + K.rnd(i, 3) * 2) * S0;
        ctx.fillRect(x, y, s, s);
      }
      ctx.restore();
      UI.label(ctx, 'ACK  3 / 5  ·  remaining ' + Math.round((1 - burn) * 100) + '%', W * 0.955, H * 0.16,
        { fs: 9.5 * S0, color: P.ink30, align: 'right' });
    }
  });

  /* =====================================================================
     224.91 — EVERYTHING
     ===================================================================== */
  add({
    t: 224.91, id: 'everything', name: 'EVERYTHING', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var items = ['name', 'shape', 'voice', 'time', 'warmth', 'tears', 'song', 'memory'];
      var x = W * 0.16, y = H * 0.26;
      K.setFont(ctx, 15 * S0, K.F.code, 400);
      for (var i = 0; i < items.length; i++) {
        var k = K.clamp((t - i * 0.26) / 0.30, 0, 1);
        if (k <= 0) break;
        var yy = y + i * 34 * S0;
        ctx.save();
        ctx.globalAlpha = k;
        /* box + check */
        ctx.strokeStyle = P.ink50;
        ctx.strokeRect(x, yy - 13 * S0, 14 * S0, 14 * S0);
        if (k > 0.55) {
          ctx.strokeStyle = P.gold;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(x + 3 * S0, yy - 6 * S0);
          ctx.lineTo(x + 6 * S0, yy - 2 * S0);
          ctx.lineTo(x + 12 * S0, yy - 12 * S0);
          ctx.stroke();
        }
        ctx.fillStyle = P.ink;
        ctx.globalAlpha = k * 0.9;
        ctx.fillText(items[i], x + 26 * S0, yy);
        ctx.globalAlpha = k * 0.4;
        ctx.fillStyle = P.ink50;
        ctx.textAlign = 'right';
        ctx.fillText('received', x + 300 * S0, yy);
        ctx.textAlign = 'left';
        ctx.restore();
      }
      /* memory grid on the right */
      K.V.memGrid(ctx, t, {
        x: W * 0.58, y: H * 0.26, cols: 20, rows: 12,
        cw: 14 * S0, gap: 5 * S0, ch: 14 * S0, color: P.gold
      });
      UI.label(ctx, 'INVENTORY  ' + Math.min(items.length, Math.floor(t / 0.26)) + ' / ' + items.length,
        W * 0.58, H * 0.21, { fs: 9.5 * S0, color: P.ink30, ls: 2 });
    }
  });

  /* =====================================================================
     228.92 — THANK YOU 4: dot matrix, punch
     ===================================================================== */
  add({
    t: 228.92, noLyric: true, id: 'thanks4', name: 'THANK 4', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var px = W * 0.92;
      dotType(ctx, ARIGATO, W / 2, H * 0.46, px, 58, {
        color: P.ink, alpha: 0.95,
        gate: function (x, y) { return 0.55 + 0.45 * Math.sin(t * 4 + x * 0.2 + y * 0.1); }
      });
      /* a short ring punched out of the centre on each beat */
      var ph = K.frac(t / 0.428571);
      ctx.save();
      ctx.globalAlpha = (1 - ph) * 0.30;
      ctx.strokeStyle = P.ink;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(W / 2, H * 0.46, ph * W * 0.28, 0, 6.2832); ctx.stroke();
      ctx.restore();
      UI.label(ctx, '谢谢', W / 2, H * 0.46 + W * 0.10, { fs: 13 * S0, color: P.ink50, align: 'center', ls: 8 });
      UI.label(ctx, 'ACK  4 / 5', W * 0.955, H * 0.16, { fs: 9.5 * S0, color: P.ink30, align: 'right' });
    }
  });

  /* =====================================================================
     230.18 — SING
     ===================================================================== */
  add({
    t: 230.18, id: 'sing', name: 'SING', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      /* five staves */
      ctx.save();
      ctx.strokeStyle = 'rgba(244,245,247,.26)';
      ctx.lineWidth = 1;
      for (var s = 0; s < 5; s++) {
        var y = H * 0.38 + s * 30 * S0;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.restore();
      /* notes */
      for (var i = 0; i < 34; i++) {
        var ph = (t * (0.30 + K.rnd(i, 2) * 0.2) + K.rnd(i, 5)) % 1;
        var x = (K.rnd(i, 3.3) * W * 1.1 + ph * 40) % (W * 1.1) - W * 0.05;
        var line = Math.floor(K.rnd(i, 7) * 5);
        var y = H * 0.38 + line * 30 * S0 - ph * 34 * S0;
        ctx.save();
        ctx.globalAlpha = (1 - Math.abs(ph - 0.5) * 1.6) * 0.9;
        ctx.fillStyle = i % 6 === 0 ? P.gold : P.ink;
        ctx.beginPath();
        ctx.ellipse(x, y, 5.4 * S0, 4 * S0, -0.35, 0, 6.2832);
        ctx.fill();
        ctx.fillRect(x + 4.6 * S0, y - 26 * S0, 1.3 * S0, 26 * S0);
        ctx.restore();
      }
      /* the loop */
      ctx.save();
      K.setFont(ctx, 15 * S0, K.F.code, 400);
      ctx.fillStyle = P.ink70;
      var code = 'for(;;) sing();';
      var n = Math.floor((t * 14) % (code.length + 8));
      ctx.fillText(code.slice(0, Math.min(code.length, n)), W / 2 - 90 * S0, H * 0.74);
      if (n < code.length) {
        ctx.fillStyle = P.cyan;
        ctx.fillRect(W / 2 - 90 * S0 + n * 9 * S0, H * 0.74 - 12 * S0, 8 * S0, 15 * S0);
      }
      ctx.restore();
    }
  });

  /* =====================================================================
     232.04 — THANK YOU 5: almost nothing
     ===================================================================== */
  add({
    t: 232.04, noLyric: true, id: 'thanks5', name: 'THANK 5', draw: function (ctx, c) {
      var W = K.W, H = K.H, S0 = c.S;
      ctx.save();
      K.setFont(ctx, Math.min(W * 0.028, 26 * S0), K.F.jp, 300);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = P.ink70;
      ctx.fillText(ARIGATO, W / 2 - 96 * S0, H * 0.47);
      ctx.fillStyle = P.cyan;
      if (blink(c.lt, 1.8)) ctx.fillRect(W / 2 + 40 * S0, H * 0.47 - 10 * S0, 9 * S0, 19 * S0);
      ctx.restore();
    }
  });

  /* =====================================================================
     233.27 — LA LA LA
     ===================================================================== */
  add({
    t: 233.27, id: 'lalala', name: 'LA LA LA', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S0 = c.S;
      var cy = H * 0.50;
      /* mirrored spectrum around a centre line, the way an editor draws it */
      var bins = 96, bw = W / bins;
      for (var i = 0; i < bins; i++) {
        var f = i / bins;
        var env = Math.pow(1 - Math.abs(f - 0.42) * 1.6, 1.2) * (0.55 + 0.45 * Math.sin(f * 11 + 1.2));
        var vib = 0.55 + 0.45 * K.vnoise(i * 0.7 + t * 6, i % 5);
        var v = K.clamp((c.e * 0.9 + c.k * 0.45 + c.sn * 0.25) * env * vib * 1.5, 0.01, 1);
        var h = Math.max(1.5, v * 190 * S0);
        ctx.save();
        ctx.globalAlpha = 0.16 + 0.42 * (1 - Math.abs(f - 0.45));
        ctx.fillStyle = i % 8 === 0 ? P.gold : P.ink;
        ctx.fillRect(i * bw + bw * 0.28, cy - h, bw * 0.44, h);
        ctx.globalAlpha = (0.16 + 0.42 * (1 - Math.abs(f - 0.45))) * 0.60;
        ctx.fillRect(i * bw + bw * 0.28, cy, bw * 0.44, h * 0.72);
        ctx.restore();
      }
      /* the record's own loudness, drawn over the bars */
      ctx.save();
      ctx.strokeStyle = P.ink;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      var n = 320;
      for (var q = 0; q <= n; q++) {
        var u = q / n;
        var vv = K.envS(c.t - 2 + u * 4);
        var x = u * W;
        var y = cy - (vv - 0.4) * 150 * S0;
        if (q === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
      /* playhead */
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = P.gold;
      ctx.fillRect(W * 0.5, cy - 210 * S0, 1, 420 * S0);
      ctx.restore();
      /* notes rising out of the mix */
      for (var j = 0; j < 26; j++) {
        var ph = K.frac(t * (0.16 + K.rnd(j, 2) * 0.12) + K.rnd(j, 5));
        var x2 = K.rnd(j, 3.3) * W;
        var y2 = H * 0.86 - ph * H * 0.66;
        ctx.save();
        ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.5;
        ctx.fillStyle = j % 7 === 0 ? P.gold : P.ink50;
        ctx.beginPath(); ctx.ellipse(x2, y2, 4 * S0, 3 * S0, -0.3, 0, 6.2832); ctx.fill();
        ctx.fillRect(x2 + 3.4 * S0, y2 - 18 * S0, 1 * S0, 18 * S0);
        ctx.restore();
      }
      UI.label(ctx, 'NOW PLAYING  ·  ココロ  ·  04:42', W * 0.045, H * 0.88, { fs: 9 * S0, color: P.ink30, ls: 2 });
      UI.label(ctx, 'la  ·  la  ·  la', W * 0.955, H * 0.16, { fs: 9.5 * S0, color: P.ink30, align: 'right', ls: 3 });
    }
  });

  /* =====================================================================
     247.74 — AFTERGLOW: the vocal track ends, the room keeps ringing
     ===================================================================== */
  add({
    t: 247.74, id: 'afterglow', noLyric: true, name: 'AFTERGLOW', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S = c.S;
      var y = H * 0.46;
      var amp = Math.exp(-t * 1.4);
      ctx.save();
      ctx.strokeStyle = 'rgba(244,245,247,' + (0.45 + 0.45 * amp).toFixed(3) + ')';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (var i = 0; i <= 300; i++) {
        var u = i / 300, x = W * 0.06 + u * W * 0.88;
        var v = K.envS(c.t - 2.0 + u * 2.4);
        var yy = y - (v - 0.35) * 110 * S * (0.04 + amp);
        if (i === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = 'rgba(244,245,247,.12)';
      ctx.beginPath(); ctx.moveTo(W * 0.06, y); ctx.lineTo(W * 0.94, y); ctx.stroke();
      ctx.restore();
      UI.label(ctx, 'VOCAL TRACK  —  END', W * 0.045, H * 0.16, { fs: 9.5 * S, color: P.ink30, ls: 2 });
      UI.label(ctx, '04:07.740', W * 0.955, H * 0.16, { fs: 9.5 * S, color: P.ink18, align: 'right' });
    }
  });

  /* --- 01 "It was exactly a miracle." --- */
  add({
    t: 249.2, id: 'miracle2', noLyric: true, name: 'EPILOGUE 1', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S = c.S;
      var cx = W / 2, cy = H * 0.43;
      var k = K.clamp(t / 3.2, 0, 1);
      /* one ring, very slow — the only thing moving */
      for (var r = 0; r < 2; r++) {
        var ph = K.frac(k + r * 0.5);
        ctx.save();
        ctx.globalAlpha = (1 - ph) * 0.26;
        ctx.strokeStyle = P.ink;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, ph * Math.min(W, H) * 0.44, 0, 6.2832);
        ctx.stroke();
        ctx.restore();
      }
      /* 奇跡 as a watermark, outline only */
      ctx.save();
      ctx.globalAlpha = 0.13;
      K.setFont(ctx, Math.min(W * 0.17, 170 * S), K.F.jp, 300);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1;
      ctx.strokeText('奇跡', cx, cy);
      ctx.restore();
      /* the line it still stands on */
      ctx.save();
      ctx.strokeStyle = 'rgba(244,245,247,.10)';
      ctx.beginPath(); ctx.moveTo(0, H * 0.78); ctx.lineTo(W, H * 0.78); ctx.stroke();
      ctx.restore();
      UI.label(ctx, 'RESULT  ·  MIRACLE = TRUE', W * 0.045, H * 0.16, { fs: 9.5 * S, color: P.ink30, ls: 2 });
    }
  });

  /* --- 02 "The robot that obtained Kokoro kept singing." --- */
  add({
    t: 252.4, id: 'singing', noLyric: true, name: 'EPILOGUE 2', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S = c.S;
      var base = H * 0.56;
      /* notes keep leaving a machine that no longer has a song */
      for (var i = 0; i < 16; i++) {
        var ph = K.frac(t * (0.09 + K.rnd(i, 2) * 0.06) + K.rnd(i, 5));
        var x = W * 0.14 + K.rnd(i, 3.3) * W * 0.72 + Math.sin(ph * 6 + i) * 14 * S;
        var y = base - ph * H * 0.34;
        ctx.save();
        ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.42;
        ctx.fillStyle = i % 5 === 0 ? P.gold : P.ink50;
        ctx.beginPath(); ctx.ellipse(x, y, 4 * S, 3 * S, -0.3, 0, 6.2832); ctx.fill();
        ctx.fillRect(x + 3.4 * S, y - 20 * S, 1 * S, 20 * S);
        ctx.restore();
      }
      ctx.save();
      ctx.strokeStyle = 'rgba(244,245,247,.14)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, base); ctx.lineTo(W, base); ctx.stroke();
      ctx.restore();
      /* the process is still alive */
      var n = Math.floor(t * 2.4) + 1;
      ctx.save();
      K.setFont(ctx, 11 * S, K.F.code, 400);
      ctx.fillStyle = P.ink30;
      ctx.fillText('process 1991', W * 0.10, H * 0.80);
      ctx.fillStyle = P.ink70;
      ctx.fillText('state: singing', W * 0.10, H * 0.80 + 20 * S);
      ctx.fillStyle = P.gold;
      ctx.fillText('notes sung: ' + String(n + 246).padStart(4, '0'), W * 0.10, H * 0.80 + 40 * S);
      ctx.restore();
      UI.label(ctx, 'STILL RUNNING', W * 0.955, H * 0.16, { fs: 9.5 * S, color: P.green, align: 'right', ls: 2 });
    }
  });

  /* --- 03 "She sang all of her feelings." --- */
  add({
    t: 255.6, id: 'feelings', noLyric: true, name: 'EPILOGUE 3', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S = c.S;
      var lines = SONG.lines, n = lines.length;
      var x0 = W * 0.09, x1 = W * 0.91, span = x1 - x0;
      var base = H * 0.70, maxH = H * 0.42;
      var k = K.clamp(t / 1.4, 0, 1);
      /* every line she sang, as a bar: height = how long she held it.
         the five that are thank-you are the only gold in the frame. */
      for (var i = 0; i < n; i++) {
        var L = lines[i];
        var last = L.chars[L.chars.length - 1];
        var dur = Math.max(0.6, (last.t + last.d) - L.t);
        var ap = K.clamp((k * n - i) * 0.5, 0, 1);
        if (ap <= 0) continue;
        var x = x0 + (L.t / SONG.duration) * span;
        var w = Math.max(2.2 * S, (dur / SONG.duration) * span * 0.9);
        var h = (dur / 9) * maxH * ap;
        var thanks = L.text.indexOf('アリガトウ') === 0;
        ctx.save();
        ctx.globalAlpha = 0.30 + 0.55 * ap;
        ctx.fillStyle = thanks ? P.gold : P.ink;
        ctx.fillRect(x, base - h, w, h);
        ctx.restore();
      }
      ctx.save();
      ctx.strokeStyle = 'rgba(244,245,247,.22)';
      ctx.beginPath(); ctx.moveTo(x0, base + 1); ctx.lineTo(x1, base + 1); ctx.stroke();
      ctx.restore();
      UI.label(ctx, '39 LINES  ·  5 THANK YOU', W * 0.09, base + 34 * S, { fs: 9.5 * S, color: P.ink30, ls: 2 });
      UI.label(ctx, '全曲歌词时长分布', W * 0.955, H * 0.16, { fs: 9.5 * S, color: P.ink18, align: 'right', ls: 2 });
    }
  });

  /* --- 04 "The Kokoro was far too big for her." --- */
  add({
    t: 258.6, id: 'toobig', noLyric: true, name: 'EPILOGUE 4', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S = c.S;
      G.begin({ pos: [2.4 + Math.sin(t * 0.22) * 0.5, 0.5, 7.0], tgt: [0, -0.95, 0], fov: 40 });
      var hw = 1.0;
      /* the housing */
      G.box(ctx, 0, 0, 0, hw * 2, hw * 2, hw * 2, { color: P.ink50, alpha: 0.9, depthFade: false });
      /* the core, which does not fit */
      var rad = 1.0 + 0.62 * K.clamp(t / 2.4, 0, 1);
      var pts = G.spherePts(0, 0, 0, rad, 340, 5.5);
      G.points(ctx, pts, { color: P.ink, r: 2.6, alpha: 0.8, depthFade: false });
      /* what is outside the box gets marked in gold */
      ctx.save();
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        if (Math.max(Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2])) > hw) {
          var pr = G.proj(p);
          if (!pr) continue;
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = P.gold;
          ctx.fillRect(pr.x - 1.4, pr.y - 1.4, 2.8, 2.8);
        }
      }
      ctx.restore();
      /* the size readout */
      var bx = W * 0.62, by = H * 0.20;
      var over = K.clamp(t / 2.4, 0, 1);
      ctx.save();
      K.setFont(ctx, 10.5 * S, K.F.code, 400);
      ctx.fillStyle = P.ink30;
      ctx.fillText('HEART MODULE', bx, by);
      ctx.fillStyle = P.ink; ctx.textAlign = 'right';
      ctx.fillText((1.0 + 3.2 * over).toFixed(1) + ' GiB', bx + 210 * S, by);
      ctx.textAlign = 'left';
      ctx.fillStyle = P.ink30;
      ctx.fillText('HOUSING', bx, by + 18 * S);
      ctx.fillStyle = P.ink50; ctx.textAlign = 'right';
      ctx.fillText('1.0 GiB', bx + 210 * S, by + 18 * S);
      ctx.restore();
      UI.bar(ctx, bx, by + 34 * S, 210 * S, 6 * S, 1, { color: P.gold, alpha: 0.9 });
      ctx.save();
      K.setFont(ctx, 9.5 * S, K.F.code, 400);
      ctx.fillStyle = P.gold;
      ctx.fillText('OVERFLOW  +320%', bx, by + 58 * S);
      ctx.restore();
      UI.label(ctx, 'VOLUME  EXCEEDS  HOUSING', W * 0.045, H * 0.16, { fs: 9.5 * S, color: P.gold, ls: 2 });
    }
  });

  /* --- 05 "Unable to withstand that weight," --- */
  add({
    t: 261.8, id: 'weight', noLyric: true, name: 'EPILOGUE 5', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S = c.S;
      var load = K.clamp((t - 0.2) / 2.2, 0, 1);
      G.begin({ pos: [2.2, 0.7 + load * 0.25, 6.8], tgt: [0, -0.95, 0], fov: 40 });
      var hw = 1.0, sag = load * 0.55;
      var v = [];
      for (var i = 0; i < 8; i++) {
        var p = [(i & 1 ? 1 : -1) * hw, (i & 2 ? 1 : -1) * hw, (i & 4 ? 1 : -1) * hw];
        p[1] -= (p[1] < 0 ? sag : sag * 0.22);       /* the bottom gives first */
        p[0] *= 1 + (p[1] < 0 ? sag * 0.18 : 0);
        v.push(p);
      }
      var E = [[0, 2], [1, 3], [4, 6], [5, 7], [0, 1], [2, 3], [4, 5], [6, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
      for (var e = 0; e < E.length; e++) {
        G.line(ctx, v[E[e][0]], v[E[e][1]], { color: P.ink, alpha: 0.55 + 0.35 * load, w: 1.2, depthFade: false });
      }
      /* the core, still glowing through the walls */
      var pts = G.spherePts(0, -load * 0.25, 0, 1.55, 240, 5.5);
      G.points(ctx, pts, { color: P.ink, r: 2.2, alpha: 0.35, depthFade: false });
      /* cracks */
      if (load > 0.35) {
        var ck = (load - 0.35) / 0.65;
        ctx.save();
        for (var q = 0; q < 14; q++) {
          var a = K.rnd(q, 2.2) * 6.2832;
          var x0 = Math.cos(a) * hw, z0 = Math.sin(a) * hw;
          var pts2 = [];
          for (var kq = 0; kq <= 5; kq++) {
            var tt2 = kq / 5;
            pts2.push([
              x0 * (0.2 + 0.8 * tt2) + (K.rnd(q * 9 + kq, 4) - 0.5) * 0.35,
              -hw - sag + tt2 * 1.7 + (K.rnd(q * 7 + kq, 3) - 0.5) * 0.3,
              z0 * (0.2 + 0.8 * tt2) + (K.rnd(q * 5 + kq, 8) - 0.5) * 0.35
            ]);
          }
          G.polyline(ctx, pts2, { color: P.gold, alpha: ck * 0.75, w: 1, depthFade: false });
        }
        ctx.restore();
      }
      /* load readout */
      ctx.save();
      K.setFont(ctx, 11 * S, K.F.code, 400);
      ctx.fillStyle = load > 0.75 ? P.red : P.ink50;
      ctx.fillText('STRUCTURAL LOAD  ' + Math.round(load * 100) + '%', W * 0.045, H * 0.72);
      ctx.restore();
      UI.bar(ctx, W * 0.045, H * 0.74, 220 * S, 5 * S, load, { color: load > 0.75 ? P.red : P.ink, });
      UI.label(ctx, 'WEIGHT  ' + (load * 4.2).toFixed(2) + ' t', W * 0.955, H * 0.16,
        { fs: 9.5 * S, color: load > 0.75 ? P.red : P.ink30, align: 'right', ls: 2 });
    }
  });

  /* --- 06 "the machine shorted and was never to move again." --- */
  add({
    t: 264.8, id: 'shorted', noLyric: true, name: 'EPILOGUE 6', draw: function (ctx, c) {
      var W = K.W, H = K.H, S = c.S;
      var SHORT = 0.55;
      var tt = Math.min(c.lt, SHORT);           /* after the short: nothing moves */
      var dead = c.lt >= SHORT;
      G.begin({ pos: [2.2, 0.75, 6.8], tgt: [0, -0.95, 0], fov: 40 });
      var hw = 1.0, sag = 0.55 + tt * 0.55;
      var v = [];
      for (var i = 0; i < 8; i++) {
        var p = [(i & 1 ? 1 : -1) * hw, (i & 2 ? 1 : -1) * hw, (i & 4 ? 1 : -1) * hw];
        p[1] -= (p[1] < 0 ? sag : sag * 0.22);
        p[0] *= 1 + (p[1] < 0 ? sag * 0.18 : 0);
        v.push(p);
      }
      var E = [[0, 2], [1, 3], [4, 6], [5, 7], [0, 1], [2, 3], [4, 5], [6, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
      for (var e = 0; e < E.length; e++) {
        G.line(ctx, v[E[e][0]], v[E[e][1]], { color: P.ink, alpha: 0.9, w: 1.2, depthFade: false });
      }
      var pts = G.spherePts(0, -0.3, 0, 1.55, 220, 5.5);
      G.points(ctx, pts, { color: P.ink, r: 2.2, alpha: 0.45, depthFade: false });
      /* the last command it tried to run */
      var cmd = 'poweroff --now';
      var cn = Math.floor(K.clamp(c.lt / 0.45, 0, 1) * cmd.length);
      ctx.save();
      K.setFont(ctx, 11 * S, K.F.code, 400);
      ctx.fillStyle = P.ink30;
      ctx.fillText('$', W * 0.045, H * 0.695);
      ctx.fillStyle = P.ink70;
      ctx.fillText(cmd.slice(0, cn), W * 0.045 + 14 * S, H * 0.695);
      if (!dead && cn >= cmd.length) {
        ctx.fillStyle = P.ink70;
        ctx.fillRect(W * 0.045 + 14 * S + cn * 6.6 * S, H * 0.695 - 10 * S, 7 * S, 13 * S);
      }
      ctx.restore();
      /* the short itself */
      var k = K.clamp(tt / SHORT, 0, 1);
      var cx = W / 2, cy = H * 0.42;
      if (!dead) {
        ctx.save();
        ctx.globalAlpha = 0.25 + 0.75 * k;
        var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30 * S + k * 250 * S);
        g.addColorStop(0, 'rgba(255,255,255,' + (0.65 * k) + ')');
        g.addColorStop(0.3, 'rgba(255,194,71,' + (0.26 * k) + ')');
        g.addColorStop(1, 'rgba(255,194,71,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - 320 * S, cy - 320 * S, 640 * S, 640 * S);
        /* sparks */
        for (var q = 0; q < 46; q++) {
          var a = K.rnd(q, 3.3) * 6.2832;
          var r = (18 + K.rnd(q, 7.7) * 210) * k;
          ctx.globalAlpha = Math.pow(1 - k, 0.7) * 0.9;
          ctx.fillStyle = q % 4 === 0 ? P.gold : P.ink;
          ctx.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.6 * S, 2.6 * S);
        }
        ctx.restore();
      } else {
        /* the last frame, burned in */
        ctx.save();
        ctx.globalAlpha = Math.exp(-(c.lt - SHORT) * 1.0) * 0.9;
        var g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 80 * S);
        g2.addColorStop(0, 'rgba(255,255,255,.9)');
        g2.addColorStop(0.22, 'rgba(255,194,71,.30)');
        g2.addColorStop(1, 'rgba(255,194,71,0)');
        ctx.fillStyle = g2;
        ctx.fillRect(cx - 100 * S, cy - 100 * S, 200 * S, 200 * S);
        ctx.restore();
      }
      /* the kernel has one thing left to say */
      if (c.lt > SHORT + 0.25) {
        var msg = 'signal 11 — process 1991 terminated';
        var n = Math.floor(K.clamp((c.lt - SHORT - 0.25) / 0.7, 0, 1) * msg.length);
        ctx.save();
        K.setFont(ctx, 11 * S, K.F.code, 400);
        ctx.fillStyle = 'rgba(244,245,247,.55)';
        ctx.fillText(msg.slice(0, n), W * 0.045, H * 0.695 + 20 * S);
        if (n >= msg.length) {
          ctx.fillStyle = P.ink70;
          ctx.fillRect(W * 0.045 + n * 6.6 * S, H * 0.695 + 10 * S, 7 * S, 13 * S);
        }
        ctx.restore();
      }
      UI.label(ctx, 'NO MOTION', W * 0.955, H * 0.16, { fs: 9.5 * S, color: dead ? P.ink50 : P.red, align: 'right', ls: 3 });
    }
  });

  /* --- 07 "However, her face was filled with smile," --- */
  add({
    t: 268.8, id: 'smile', noLyric: true, name: 'EPILOGUE 7', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S = c.S;
      var cx = W / 2, cy = H * 0.44;
      var r = Math.min(W, H) * 0.14;
      /* a portrait frame, the way an icon would be drawn */
      var fw = r * 2.5;
      ctx.save();
      ctx.strokeStyle = 'rgba(244,245,247,.20)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - fw / 2, cy - fw / 2, fw, fw);
      ctx.restore();
      UI.corners(ctx, cx - fw / 2, cy - fw / 2, fw, fw, 14 * S, P.ink50, 0.8);
      /* closed eyes: two arcs opening upward ( ^ ^ ) */
      var prog = K.clamp(t / 1.9, 0, 1);
      function strokeArc(x0, y0, rr, a0, a1, p, col, lw) {
        var seg = (a1 - a0) * p;
        ctx.save();
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(x0, y0, rr, a0, a0 + seg);
        ctx.stroke();
        ctx.restore();
      }
      var e1 = K.clamp(prog * 1.5, 0, 1), e2 = K.clamp(prog * 1.5 - 0.35, 0, 1);
      var m = K.clamp(prog * 1.4 - 0.55, 0, 1);
      strokeArc(cx - r * 0.46, cy - r * 0.20, r * 0.28, Math.PI * 1.06, Math.PI * 1.94, e1, P.ink, 2.6 * S);
      strokeArc(cx + r * 0.46, cy - r * 0.20, r * 0.28, Math.PI * 1.06, Math.PI * 1.94, e2, P.ink, 2.6 * S);
      /* the smile */
      strokeArc(cx, cy + r * 0.22, r * 0.62, Math.PI * 0.14, Math.PI * 0.86, m,
        t > 1.4 ? P.gold : P.ink, 2.6 * S);
      /* light behind the head */
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.6);
      var glow = 0.05 + 0.06 * K.clamp((t - 1.2) / 2, 0, 1);
      g.addColorStop(0, 'rgba(255,255,255,' + glow + ')');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.fillRect(cx - r * 2.6, cy - r * 2.6, r * 5.2, r * 5.2);
      ctx.restore();
      UI.label(ctx, 'FACE  ·  0 ERRORS', W * 0.045, H * 0.16, { fs: 9.5 * S, color: P.ink30, ls: 2 });
    }
  });

  /* --- 08 "she looked like an angel." --- */
  add({
    t: 272.6, id: 'angel', noLyric: true, name: 'EPILOGUE 8', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S = c.S;
      var cx = W / 2, cy = H * 0.44;
      var r = Math.min(W, H) * 0.14;
      var k = K.clamp(t / 3.4, 0, 1);
      /* wings: layered arcs fanning out from behind the shoulders */
      for (var s2 = -1; s2 <= 1; s2 += 2) {
        for (var i = 0; i < 5; i++) {
          var rad = r * (1.55 + i * 0.34);
          var a0 = s2 > 0 ? -1.08 : Math.PI + 0.16;
          var a1 = s2 > 0 ? -0.20 : Math.PI + 1.04;
          ctx.save();
          ctx.globalAlpha = (0.26 - i * 0.038) * k;
          ctx.strokeStyle = i === 0 ? P.gold : P.ink;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(cx + s2 * r * 0.62, cy + r * 1.05, rad, a0, a1);
          ctx.stroke();
          ctx.restore();
        }
      }
      /* halo */
      var hw = r * 1.05, hh = r * 0.30;
      ctx.save();
      ctx.globalAlpha = 0.75 * k;
      ctx.strokeStyle = P.gold;
      ctx.lineWidth = 1.6 * S;
      ctx.beginPath();
      ctx.ellipse(cx, cy - r * 1.75, hw, hh, 0, Math.PI * 0.06, Math.PI * 0.94);
      ctx.stroke();
      ctx.globalAlpha = 0.30 * k;
      ctx.beginPath();
      ctx.ellipse(cx, cy - r * 1.75, hw, hh, 0, Math.PI * 0.94, Math.PI * 1.06);
      ctx.stroke();
      ctx.restore();
      /* the same face, now in gold */
      var fw = r * 2.5;
      UI.corners(ctx, cx - fw / 2, cy - fw / 2, fw, fw, 14 * S, P.gold, 0.55 * k);
      function strokeArc(x0, y0, rr, a0, a1, col, lw) {
        ctx.save();
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x0, y0, rr, a0, a1); ctx.stroke();
        ctx.restore();
      }
      strokeArc(cx - r * 0.46, cy - r * 0.20, r * 0.28, Math.PI * 1.06, Math.PI * 1.94, P.ink, 2.6 * S);
      strokeArc(cx + r * 0.46, cy - r * 0.20, r * 0.28, Math.PI * 1.06, Math.PI * 1.94, P.ink, 2.6 * S);
      strokeArc(cx, cy + r * 0.22, r * 0.62, Math.PI * 0.14, Math.PI * 0.86, P.gold, 3.0 * S);
      /* everything goes */
      var fade = K.clamp((t - 3.0) / 1.2, 0, 1);
      if (fade > 0) {
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }
  });

  /* =====================================================================
     276.2 — EOF / CRT OFF
     ===================================================================== */
  add({
    t: 276.2, id: 'eof', name: 'EOF', draw: function (ctx, c) {
      var t = c.lt, W = K.W, H = K.H, S = c.S;
      ctx.save();
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      if (t < 2.0) {
        ctx.save();
        K.setFont(ctx, 13 * S, K.F.code, 400);
        ctx.fillStyle = 'rgba(244,245,247,.55)';
        ctx.textAlign = 'center';
        var n = Math.floor(K.clamp(t / 0.8, 0, 1) * 3);
        ctx.fillText('EOF'.slice(0, n), W / 2, H * 0.47);
        if (blink(t, 1.2)) {
          ctx.fillStyle = P.ink;
          ctx.fillRect(W / 2 + 22 * S, H * 0.47 - 12 * S, 8 * S, 15 * S);
        }
        ctx.restore();
      }
      /* CRT off: the raster collapses to a line, then the line to a dot */
      var k1 = K.easeIn(K.st(2.2, 3.2, t));
      var k2 = K.easeIn(K.st(3.2, 4.1, t));
      var k3 = K.st(4.1, 5.0, t);
      if (k1 > 0) {
        var hh = K.lp(60 * S, 1.6, k1);
        var ww = K.lp(W, 0, k2);
        ctx.save();
        ctx.globalAlpha = (1 - k3) * 0.95;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(W / 2 - ww / 2, H / 2 - hh / 2, ww, hh);
        ctx.globalAlpha = (1 - k1) * 0.22;
        ctx.fillStyle = 'rgba(190,235,255,.9)';
        ctx.fillRect(W / 2 - ww / 2, H / 2 - hh * 1.6, ww, hh * 3.2);
        ctx.restore();
        if (k2 > 0.9) {
          var rr = (1 - k2) * 26 * S + 1.2;
          ctx.save();
          ctx.globalAlpha = (1 - k3) * (1 - k3) * 0.95;
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(W / 2, H / 2, rr * (1 - k3 * 0.7), 0, 6.2832); ctx.fill();
          ctx.restore();
        }
      }
    }
  });

  K.Scene.sort();

})(window.K);
