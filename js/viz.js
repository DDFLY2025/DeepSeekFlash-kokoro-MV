/* =====================================================================
   viz.js — the visualisations are computed, not faked.

   · double pendulum : RK4 integrated once at load, then sampled by time
   · Lorenz          : RK4 integrated once at load, drawn as a 3D polyline
   · tesseract       : real 4D rotation matrices, then 4D->3D->2D
   · wavefunction    : |psi|^2 of a two-state superposition
   · Fourier         : rotating vectors that actually sum to the drawn curve
   · Julia set       : escape-time, cached per quantised parameter
   · spectrum        : harmonic comb driven by the track's own RMS envelope
   ===================================================================== */
(function (K) {

  /* ---------------- double pendulum (RK4, precomputed) ---------------- */
  var DP = (function () {
    var g = 9.81, L1 = 1, L2 = 1, m1 = 1, m2 = 1;
    var th1 = Math.PI * 0.72, th2 = Math.PI * 0.72 + 0.02;
    var w1 = 0, w2 = 0;
    var dt = 1 / 500, steps = 7000, out = [], acc = 0;

    function accel(a1, a2, v1, v2) {
      var d = a1 - a2, den = 2 * m1 + m2 - m2 * Math.cos(2 * d);
      var A1 = (-g * (2 * m1 + m2) * Math.sin(a1) - m2 * g * Math.sin(a1 - 2 * a2)
        - 2 * Math.sin(d) * m2 * (v2 * v2 * L2 + v1 * v1 * L1 * Math.cos(d))) / (L1 * den);
      var A2 = (2 * Math.sin(d) * (v1 * v1 * L1 * (m1 + m2) + g * (m1 + m2) * Math.cos(a1)
        + v2 * v2 * L2 * m2 * Math.cos(d))) / (L2 * den);
      return [A1, A2];
    }
    for (var i = 0; i < steps; i++) {
      var k1 = accel(th1, th2, w1, w2);
      var k2 = accel(th1 + 0.5 * dt * w1, th2 + 0.5 * dt * w2, w1 + 0.5 * dt * k1[0], w2 + 0.5 * dt * k1[1]);
      var k3 = accel(th1 + 0.5 * dt * (w1 + 0.5 * dt * k1[0]), th2 + 0.5 * dt * (w2 + 0.5 * dt * k1[1]),
        w1 + 0.5 * dt * k2[0], w2 + 0.5 * dt * k2[1]);
      var k4 = accel(th1 + dt * (w1 + 0.5 * dt * k2[0]), th2 + dt * (w2 + 0.5 * dt * k2[1]),
        w1 + dt * k3[0], w2 + dt * k3[1]);
      w1 += dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
      w2 += dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      th1 += dt * w1; th2 += dt * w2;
      var x1 = L1 * Math.sin(th1), y1 = -L1 * Math.cos(th1);
      var x2 = x1 + L2 * Math.sin(th2), y2 = y1 - L2 * Math.cos(th2);
      out.push([x1, y1, x2, y2, th1, th2]);
    }
    return out;
  })();

  function pendulum(ctx, t, o) {
    o = o || {};
    var i = Math.floor((t * (o.rate || 60)) % (DP.length - 1));
    var frame = DP[i];
    var s = o.scale || 1.6;
    var ox = o.x || 0, oy = o.y || 1.55;
    var p0 = [ox, oy, 0], p1 = [ox + frame[0] * s, oy + frame[1] * s, 0], p2 = [ox + frame[2] * s, oy + frame[3] * s, 0];
    /* trail: the last 90 sampled positions of the tip */
    var trail = [];
    for (var k = 90; k >= 0; k--) {
      var j = (i - k * 3 + DP.length * 4) % DP.length;
      trail.push([ox + DP[j][2] * s, oy + DP[j][3] * s, 0]);
    }
    K.G.polyline(ctx, trail, { color: o.trail || K.P.ink30, alpha: 0.75, w: 1 });
    K.G.line(ctx, p0, p1, { color: o.arm || K.P.ink70, w: 1.6, depthFade: false });
    K.G.line(ctx, p1, p2, { color: o.arm || K.P.ink70, w: 1.6, depthFade: false });
    [p8(p0), p8(p1), p8(p2)].forEach(function (p, ix) {
      var pr = K.G.proj(p);
      if (!pr) return;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = ix === 2 ? (o.dot || K.P.cyan) : K.P.ink;
      var r = ix === 2 ? 5.5 : 3;
      ctx.beginPath(); ctx.arc(pr.x, pr.y, r * pr.s / 110, 0, 6.2832); ctx.fill();
      ctx.restore();
    });
    function p8(p) { return p; }
    return { p1: K.G.proj(p1), p2: K.G.proj(p2) };
  }

  /* ---------------- Lorenz ---------------- */
  var LZ = (function () {
    var s = 10, r = 28, b = 8 / 3;
    var x = 0.1, y = 0, z = 0, dt = 0.0035, out = [];
    for (var i = 0; i < 26000; i++) {
      var dx = s * (y - x), dy = x * (r - z) - y, dz = x * y - b * z;
      var x2 = x + dx * dt, y2 = y + dy * dt, z2 = z + dz * dt;
      var dx2 = s * (y2 - x2), dy2 = x2 * (r - z2) - y2, dz2 = x2 * y2 - b * z2;
      x += (dx + dx2) * 0.5 * dt; y += (dy + dy2) * 0.5 * dt; z += (dz + dz2) * 0.5 * dt;
      if (i > 1200 && i % 3 === 0) out.push([(x - 0) * 0.115, (y) * 0.115, (z - 25) * 0.115]);
    }
    return out;
  })();

  function lorenz(ctx, t, o) {
    o = o || {};
    var n = o.n || 1400;
    var head = Math.floor((t * (o.speed || 120)) % (LZ.length - n)) + n;
    var pts = LZ.slice(head - n, head);
    if (o.rot) pts = pts.map(function (p) { return K.G.rotY(K.G.rotX(p, o.rot[0] || 0), o.rot[1] || 0); });
    ctx.save();
    for (var i = 0; i < pts.length - 1; i++) {
      var a = 0.10 + 0.90 * (i / n);
      K.G.line(ctx, pts[i], pts[i + 1], { color: o.color || K.P.cyan, alpha: a * (o.alpha == null ? 1 : o.alpha), w: 1, depthFade: false });
    }
    ctx.restore();
  }

  /* ---------------- 4D tesseract ---------------- */
  var T4 = [];
  (function () {
    for (var i = 0; i < 16; i++) {
      T4.push([(i & 1 ? 1 : -1), (i & 2 ? 1 : -1), (i & 4 ? 1 : -1), (i & 8 ? 1 : -1)]);
    }
  })();
  function tesseract(ctx, t, o) {
    o = o || {};
    var s = o.size || 1.5;
    var a1 = t * (o.s1 || 0.5), a2 = t * (o.s2 || 0.31);
    var pts = T4.map(function (v) {
      var p = v.slice();
      /* rotate in XW */
      var c = Math.cos(a1), sn = Math.sin(a1);
      p = [p[0] * c - p[3] * sn, p[1], p[2], p[0] * sn + p[3] * c];
      /* rotate in YZ */
      var c2 = Math.cos(a2), s2 = Math.sin(a2);
      p = [p[0], p[1] * c2 - p[2] * s2, p[1] * s2 + p[2] * c2, p[3]];
      return p;
    });
    /* 4D -> 3D: perspective divide on w */
    var p3 = pts.map(function (p) {
      var k = 2.4 / (3.0 - p[3] * 0.9);
      return [p[0] * s * k, p[1] * s * k, p[2] * s * k];
    });
    var E = [];
    for (var i = 0; i < 16; i++) for (var j = i + 1; j < 16; j++) {
      var d = 0;
      for (var q = 0; q < 4; q++) if (T4[i][q] !== T4[j][q]) d++;
      if (d === 1) E.push([i, j]);
    }
    var col = o.color || K.P.ink;
    for (var e = 0; e < E.length; e++) {
      var A = p3[E[e][0]], B = p3[E[e][1]];
      /* classify by orientation: axis-4 edges are the "w" ones */
      var isW = E[e][0] !== (E[e][1] ^ 8) ? false : true;
      K.G.line(ctx, A, B, { color: isW ? (o.wColor || K.P.cyan) : col, alpha: o.alpha == null ? 0.8 : o.alpha, w: isW ? 1.4 : 1, depthFade: false });
    }
    if (o.verts) K.G.points(ctx, p3, { color: K.P.ink, r: 2.2, alpha: 0.9, depthFade: false });
  }

  /* ---------------- wavefunction ----------------
     |psi|^2 of a two-state superposition, drawn straight in screen space:
     a filled probability density above the baseline and the real part as a
     thin trace, so the collapse reads as a graph rather than a decoration. */
  function psi(ctx, t, o) {
    o = o || {};
    var x0 = o.x == null ? K.W * 0.5 : o.x;
    var y0 = o.y == null ? K.H * 0.70 : o.y;
    var w = o.w || K.W * 0.66, h = o.h || 150;
    var n = 240;
    var k1 = Math.PI, k2 = Math.PI * 2;
    var e1 = 1.0, e2 = 2.6;
    var pts = [], amps = [];
    for (var i = 0; i <= n; i++) {
      var u = i / n;
      var a = Math.sin(k1 * u) * Math.cos(e1 * t);
      var b = 0.55 * Math.sin(k2 * u) * Math.cos(e2 * t + 1.2);
      var re = a + b;
      var im = Math.sin(k1 * u) * Math.sin(e1 * t) + 0.55 * Math.sin(k2 * u) * Math.sin(e2 * t + 1.2);
      var p = re * re + im * im;
      var x = x0 - w / 2 + u * w;
      pts.push([x, y0 - p * h * 0.40]);
      amps.push([x, y0 - re * h * 0.22]);
    }
    ctx.save();
    /* density fill */
    var g = ctx.createLinearGradient(0, y0 - h * 0.5, 0, y0);
    g.addColorStop(0, K.rgba(o.color || '#5ee7ff', 0.22));
    g.addColorStop(1, K.rgba(o.color || '#5ee7ff', 0.01));
    ctx.beginPath();
    ctx.moveTo(pts[0][0], y0);
    for (var q = 0; q < pts.length; q++) ctx.lineTo(pts[q][0], pts[q][1]);
    ctx.lineTo(pts[pts.length - 1][0], y0);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    /* density line */
    ctx.beginPath();
    for (var q2 = 0; q2 < pts.length; q2++) {
      if (q2 === 0) ctx.moveTo(pts[q2][0], pts[q2][1]); else ctx.lineTo(pts[q2][0], pts[q2][1]);
    }
    ctx.strokeStyle = o.color || K.P.cyan;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    /* real part */
    if (o.amp !== false) {
      ctx.beginPath();
      for (var q3 = 0; q3 < amps.length; q3++) {
        if (q3 === 0) ctx.moveTo(amps[q3][0], amps[q3][1]); else ctx.lineTo(amps[q3][0], amps[q3][1]);
      }
      ctx.strokeStyle = 'rgba(244,245,247,.34)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    /* baseline + ticks */
    ctx.strokeStyle = 'rgba(244,245,247,.16)';
    ctx.beginPath();
    ctx.moveTo(x0 - w / 2, y0); ctx.lineTo(x0 + w / 2, y0);
    ctx.stroke();
    for (var tq = 0; tq <= 10; tq++) {
      var tx = x0 - w / 2 + w * tq / 10;
      ctx.beginPath(); ctx.moveTo(tx, y0); ctx.lineTo(tx, y0 + 4); ctx.stroke();
    }
    ctx.restore();
    return pts;
  }

  /* ---------------- Fourier epicycles ---------------- */
  function fourier(ctx, t, o) {
    o = o || {};
    var terms = o.terms || 7;
    var cx = o.x || 0, cy = o.y || 0, r0 = o.r || 1.1;
    var x = cx, y = cy;
    var path = [];
    var N = 240;
    function tipAt(time) {
      var px = cx, py = cy, rad = r0;
      for (var i = 1; i <= terms; i++) {
        var n = i * 2 - 1;
        var a = n * time * 2 * Math.PI;
        var amp = 4 / (n * Math.PI);
        px += rad * amp * Math.cos(a);
        py -= rad * amp * Math.sin(a);
      }
      return [px, py];
    }
    for (var s = 0; s <= N; s++) path.push(tipAt(t * 0.28 - s / N * 1.0));
    K.G.polyline(ctx, path, { color: o.trail || K.P.ink50, alpha: 0.55, w: 1, depthFade: false });
    for (var i = 1; i <= terms; i++) {
      var n = i * 2 - 1;
      var a = n * t * 0.28 * 2 * Math.PI;
      var amp = 4 / (n * Math.PI);
      var nx = x + r0 * amp * Math.cos(a);
      var ny = y - r0 * amp * Math.sin(a);
      K.G.ring(ctx, x, y, 0, r0 * amp, 40, 'z', { color: K.P.ink30, alpha: 0.8, w: 1, depthFade: false });
      K.G.line(ctx, [x, y, 0], [nx, ny, 0], { color: o.arm || K.P.gold, alpha: 0.9, w: 1.2, depthFade: false });
      x = nx; y = ny;
    }
    var pr = K.G.proj([x, y, 0]);
    if (pr) {
      ctx.save(); ctx.fillStyle = K.P.gold; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 3, 0, 6.2832); ctx.fill(); ctx.restore();
    }
  }

  /* ---------------- Julia set (cached) ---------------- */
  var juliaCache = { key: '', cv: null };
  function julia(ctx, t, o) {
    o = o || {};
    var size = o.size || 240;
    var kq = Math.round(t * 2) / 2;                 /* quantised → cacheable */
    var cr = -0.72 + 0.16 * Math.sin(kq * 0.7), ci = 0.27 + 0.14 * Math.cos(kq * 0.53);
    var key = size + '|' + cr.toFixed(3) + '|' + ci.toFixed(3);
    if (juliaCache.key !== key) {
      var cv = juliaCache.cv || document.createElement('canvas');
      cv.width = size; cv.height = size;
      var cx2 = cv.getContext('2d');
      var img = cx2.createImageData(size, size);
      var d = img.data;
      var iter = 26;
      for (var y = 0; y < size; y++) {
        for (var x = 0; x < size; x++) {
          var zr = (x / size - .5) * 3.0, zi = (y / size - .5) * 3.0;
          var k = 0;
          while (k < iter && zr * zr + zi * zi < 4) {
            var t0 = zr * zr - zi * zi + cr;
            zi = 2 * zr * zi + ci; zr = t0; k++;
          }
          var v = k >= iter ? 0 : Math.pow(k / iter, 0.55);
          var idx = (y * size + x) * 4;
          d[idx] = 244 * v; d[idx + 1] = 245 * v; d[idx + 2] = 247 * v;
          d[idx + 3] = k >= iter ? 0 : 200 * v;
        }
      }
      cx2.putImageData(img, 0, 0);
      juliaCache.cv = cv; juliaCache.key = key;
    }
    if (juliaCache.cv) {
      ctx.save();
      ctx.globalAlpha = o.alpha == null ? 0.9 : o.alpha;
      ctx.drawImage(juliaCache.cv, o.x || 0, o.y || 0, o.w || K.W, o.h || K.H);
      ctx.restore();
    }
  }

  /* ---------------- synthetic spectrum from the real envelope ----------------
     64 bins: a fixed harmonic comb multiplied by the track's own RMS at t,
     with per-bin noise so it moves like an analyser but stays seekable.   */
  function spectrum(ctx, c, o) {
    o = o || {};
    var bins = o.bins || 64;
    var x0 = o.x || 0, w = o.w || K.W, base = o.base || K.H * 0.72;
    var hmax = o.h || 200;
    var e = c.e || 0;
    var k = c.k || 0, sn = c.sn || 0;
    var bw = w / bins;
    for (var i = 0; i < bins; i++) {
      var f = i / bins;
      var env = Math.pow(1 - f, 0.55) * (0.55 + 0.45 * Math.sin(f * 9 + 1.2));
      var vib = 0.55 + 0.45 * K.vnoise(i * 0.7 + c.t * 6, i % 5);
      var v = (e * 0.85 + k * 0.5 + sn * 0.3) * env * vib;
      v = K.clamp(v * 1.35, 0.02, 1);
      var h = Math.max(1.5, v * hmax);
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = i % 8 === 0 ? K.P.gold : (o.color || K.P.ink70);
      ctx.fillRect(x0 + i * bw + bw * 0.18, base - h, bw * 0.64, h);
      ctx.restore();
    }
  }

  /* ---------------- memory grid ---------------- */
  function memGrid(ctx, t, o) {
    o = o || {};
    var cols = o.cols || 16, rows = o.rows || 10;
    var cw = o.cw || 18, gap = o.gap || 4;
    var x0 = o.x || 0, y0 = o.y || 0;
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var i = y * cols + x;
        var r = K.rnd(i, 3.1);
        var live = r > 0.18 + 0.35 * Math.sin(t * 0.7 + i * 0.3);
        var heat = K.rnd(i, t * 2.3) ;
        ctx.save();
        if (live) {
          ctx.fillStyle = o.color || K.P.ink;
          ctx.globalAlpha = 0.10 + 0.55 * heat;
        } else {
          ctx.fillStyle = K.P.ink;
          ctx.globalAlpha = 0.045;
        }
        ctx.fillRect(x0 + x * (cw + gap), y0 + y * (cw + gap), cw, o.ch || cw);
        ctx.restore();
      }
    }
  }

  /* ---------------- spacetime sheet ---------------- */
  function spacetime(ctx, t, o) {
    o = o || {};
    var N = o.n || 22, span = o.span || 7, y = o.y == null ? -2.2 : o.y;
    var well = o.well == null ? 2.2 : o.well;
    var warp = o.warp || 0;
    var lines = [];
    for (var i = 0; i <= N; i++) {
      var row = [], col = [];
      for (var j = 0; j <= N; j++) {
        var u = (i / N - .5) * span * 2, v = (j / N - .5) * span * 2;
        var r = Math.sqrt(u * u + v * v) + 0.001;
        var dip = -well / (1 + r * r * 0.55) * (0.6 + 0.4 * Math.sin(t * 0.9));
        var rip = Math.sin(r * 2.4 - t * 2.2) * 0.06 * warp;
        row.push([u, y + dip + rip, v]);
        col.push([u, y + dip + rip, v]);
      }
      lines.push(row);
    }
    for (var a = 0; a < lines.length; a++) {
      K.G.polyline(ctx, lines[a], { color: o.color || K.P.ink, alpha: o.alpha == null ? 0.16 : o.alpha, w: 1, depthFade: true, far: 26 });
    }
  }

  /* ---------------- hex dump ---------------- */
  function hexdump(ctx, c, o) {
    o = o || {};
    var rows = o.rows || 10, x = o.x || 0, y = o.y || 0;
    var size = o.size || 13, lh = o.lh || size * 1.45;
    K.setFont(ctx, size, K.F.code, 400);
    var base = Math.floor((c.t * (o.rate || 6)) % 4096);
    ctx.save();
    ctx.globalAlpha = o.alpha == null ? 0.85 : o.alpha;
    for (var r = 0; r < rows; r++) {
      var addr = (base + r * 16) & 0xffff;
      var hex = '', asc = '';
      for (var b = 0; b < 16; b++) {
        var v = Math.floor(K.rnd(addr + b * 31, 7.3) * 256);
        hex += (v < 16 ? '0' : '') + v.toString(16).toUpperCase() + (b === 7 ? '  ' : ' ');
        asc += v >= 32 && v < 127 ? String.fromCharCode(v) : '.';
      }
      ctx.fillStyle = K.P.syn.cmt;
      ctx.fillText(('0000' + addr.toString(16)).slice(-4) + '  ', x, y + r * lh);
      ctx.fillStyle = o.color || K.P.ink70;
      ctx.fillText(hex, x + size * 6.4, y + r * lh);
      ctx.fillStyle = K.P.syn.str;
      ctx.fillText(asc, x + size * 40, y + r * lh);
    }
    ctx.restore();
  }

  K.V = {
    pendulum: pendulum, lorenz: lorenz, tesseract: tesseract, psi: psi,
    fourier: fourier, julia: julia, spectrum: spectrum, memGrid: memGrid,
    spacetime: spacetime, hexdump: hexdump,
    DP: DP, LZ: LZ
  };

})(window.K);
