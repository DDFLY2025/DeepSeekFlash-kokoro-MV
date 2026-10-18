/* =====================================================================
   g3d.js — a hand-rolled 3D layer that projects onto the same 2D canvas.

   Why not WebGL: the whole film's look is flat white vector primitives with
   hairline strokes, and Canvas2D gives real typesetting (code, formulas,
   Japanese) for free. A 200-line projector beats a shader pipeline here.

   The two tricks the brief asks for and how they are done:
     · long lens first, then dolly  — fov starts at 3° (near orthographic,
       so a helix reads as a perfect circle) and opens to 55° while the
       camera orbits, which is exactly how you reveal a 3D object.
     · 2D net folds into 3D       — six quads hinged on shared edges, each
       rotating about its hinge by an animated angle.
   ===================================================================== */
(function (K) {

  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function len(a) { return Math.sqrt(dot(a, a)); }
  function norm(a) { var l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function rotY(p, a) { var c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; }
  function rotX(p, a) { var c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; }
  function rotZ(p, a) { var c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; }

  var cam = {
    pos: [0, 0, 6], tgt: [0, 0, 0], fov: 45, roll: 0, tq: 0.5
  };
  var basis = null, W = 0, H = 0, focal = 1, nearZ = 0.06;

  function setup(o) {
    cam.pos = o.pos || [0, 0, 6];
    cam.tgt = o.tgt || [0, 0, 0];
    cam.fov = o.fov == null ? 45 : o.fov;
    cam.roll = o.roll || 0;
    cam.near = o.near || 0.08;
    W = K.W; H = K.H;
    focal = (H / 2) / Math.tan(cam.fov * Math.PI / 360);
    var f = norm(sub(cam.tgt, cam.pos));
    var up = o.up || [0, 1, 0];
    if (Math.abs(dot(f, norm(up))) > 0.999) up = [0, 0, 1];
    var r = norm(cross(f, up));
    var u = cross(r, f);
    basis = { f: f, r: r, u: u };
    return cam;
  }

  function proj(p) {
    var d = sub(p, cam.pos);
    var z = dot(d, basis.f);
    if (z < cam.near) return null;
    var s = focal / z;
    var x = W / 2 + dot(d, basis.r) * s;
    var y = H / 2 - dot(d, basis.u) * s;
    if (cam.roll) {
      var c = Math.cos(cam.roll), sn = Math.sin(cam.roll);
      var dx = x - W / 2, dy = y - H / 2;
      x = W / 2 + dx * c - dy * sn;
      y = H / 2 + dx * sn + dy * c;
    }
    return { x: x, y: y, z: z, s: s };
  }

  /* ---------------- ordered drawing ---------------- */
  var Q = [];
  function begin(o) { setup(o); Q.length = 0; }
  function push(z, fn) { Q.push({ z: z, fn: fn }); }
  function flush(ctx) {
    Q.sort(function (a, b) { return b.z - a.z; });
    for (var i = 0; i < Q.length; i++) Q[i].fn(ctx);
    Q.length = 0;
  }

  /* ---------------- stroke helpers ---------------- */
  function line(ctx, a, b, o) {
    o = o || {};
    var pa = a.z != null ? a : proj(a), pb = b.z != null ? b : proj(b);
    if (!pa || !pb) return;
    var al = (o.alpha == null ? 1 : o.alpha) * fade(pa, pb, o);
    if (al <= 0.004) return;
    ctx.strokeStyle = o.color || K.P.ink70;
    ctx.globalAlpha = al;
    ctx.lineWidth = Math.max(0.4, (o.w || 1) * Math.sqrt(pa.s / 90));
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function fade(a, b, o) {
    if (o.depthFade === false) return 1;
    var far = o.far || 40;
    var z = Math.max(a.z, b.z);
    return K.clamp(1 - (z - (o.near || 0)) / far, 0, 1);
  }
  function polyline(ctx, pts, o) {
    o = o || {};
    ctx.save();
    ctx.strokeStyle = o.color || K.P.ink70;
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.lineWidth = o.w || 1;
    ctx.beginPath();
    var started = false;
    for (var i = 0; i < pts.length; i++) {
      var p = proj(pts[i]);
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }
  function points(ctx, pts, o) {
    o = o || {};
    ctx.save();
    ctx.fillStyle = o.color || K.P.ink;
    for (var i = 0; i < pts.length; i++) {
      var p = proj(pts[i]);
      if (!p) continue;
      var r = (o.r || 1.4) * p.s / 90;
      ctx.globalAlpha = (o.alpha == null ? 1 : o.alpha) * (o.depthFade === false ? 1 : K.clamp(1 - p.z / (o.far || 40), 0, 1));
      ctx.fillRect(p.x - r / 2, p.y - r / 2, r, r);
    }
    ctx.restore();
  }
  function quad(ctx, pts, o) {
    o = o || {};
    var pp = [];
    var zs = 0;
    for (var i = 0; i < pts.length; i++) {
      var p = proj(pts[i]);
      if (!p) return;
      pp.push(p); zs += p.z;
    }
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pp[0].x, pp[0].y);
    for (var j = 1; j < pp.length; j++) ctx.lineTo(pp[j].x, pp[j].y);
    ctx.closePath();
    if (o.fill) { ctx.globalAlpha = o.alpha == null ? 1 : o.alpha; ctx.fillStyle = o.fill; ctx.fill(); }
    if (o.stroke) {
      ctx.globalAlpha = (o.strokeAlpha == null ? 1 : o.strokeAlpha) * (o.alpha == null ? 1 : o.alpha);
      ctx.strokeStyle = o.stroke; ctx.lineWidth = o.w || 1; ctx.stroke();
    }
    ctx.restore();
    return zs / pp.length;
  }

  /* ---------------- billboard text ----------------
     A flat panel that always faces the camera — this is how a 2D window can
     sit inside a 3D space without becoming unreadable.                     */
  function text3(ctx, s, p, size, o) {
    o = o || {};
    var pr = proj(p);
    if (!pr) return null;
    var sz = size * pr.s / 90;
    if (sz < 1.2) return null;
    var a = (o.alpha == null ? 1 : o.alpha) * (o.depthFade === false ? 1 : K.clamp(1 - pr.z / (o.far || 60), 0, 1.15));
    if (a <= 0.006) return null;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = o.color || K.P.ink;
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = o.base || 'middle';
    ctx.font = (o.weight || 400) + ' ' + sz.toFixed(1) + 'px ' + (o.family || K.F.code);
    if (o.mono === false) ctx.font = (o.weight || 400) + ' ' + sz.toFixed(1) + 'px ' + (o.family || K.F.ui);
    if (o.ls != null && 'letterSpacing' in ctx) ctx.letterSpacing = (o.ls * sz) + 'px';
    if (o.disp) K.dispText(ctx, s, pr.x, pr.y, o.disp * pr.s / 90, { color: ctx.fillStyle });
    else ctx.fillText(s, pr.x, pr.y);
    if (o.ls != null && 'letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.restore();
    return pr;
  }

  /* ---------------- 3D solid primitives ---------------- */
  function boxWire(ctx, cx, cy, cz, w, h, d, o) {
    var hx = w / 2, hy = h / 2, hz = d / 2;
    var v = [];
    for (var i = 0; i < 8; i++) {
      v.push([cx + (i & 1 ? hx : -hx), cy + (i & 2 ? hy : -hy), cz + (i & 4 ? hz : -hz)]);
    }
    var E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (var e = 0; e < E.length; e++) line(ctx, v[E[e][0]], v[E[e][1]], o);
    return v;
  }
  function ring(ctx, cx, cy, cz, r, seg, axis, o) {
    var pts = [];
    for (var i = 0; i <= seg; i++) {
      var a = i / seg * Math.PI * 2;
      var p = [Math.cos(a) * r, Math.sin(a) * r, 0];
      if (axis === 'x') p = [0, p[0], p[1]];
      else if (axis === 'y') p = [p[0], 0, p[1]];
      pts.push([cx + p[0], cy + p[1], cz + p[2]]);
    }
    polyline(ctx, pts, o);
  }
  function spherePts(cx, cy, cz, r, n, seed) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var u = K.rnd(i, seed || 1), v = K.rnd(i, (seed || 1) + 7.7);
      var th = Math.acos(2 * u - 1), ph = v * Math.PI * 2;
      out.push([cx + r * Math.sin(th) * Math.cos(ph), cy + r * Math.cos(th), cz + r * Math.sin(th) * Math.sin(ph)]);
    }
    return out;
  }

  /* ---------------- extruded type ----------------
     Solid lettering without a 3D font: the same glyph repeated along an
     extrusion vector, back to front, then a bright front face. This is what
     "formula extruded and slammed in from off-frame" is made of.           */
  function extrude(ctx, s, x, y, size, o) {
    o = o || {};
    var depth = o.depth == null ? 14 : o.depth;
    var ang = o.ang == null ? -0.5 : o.ang;
    var dx = Math.cos(ang) * depth, dy = Math.sin(ang) * depth;
    var steps = o.steps || 18;
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.skew) ctx.transform(1, 0, o.skew, 1, 0, 0);
    if (o.scale) ctx.scale(o.scale, o.scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = (o.weight || 300) + ' ' + size + 'px ' + (o.family || K.F.ui);
    if (o.ls != null && 'letterSpacing' in ctx) ctx.letterSpacing = o.ls + 'px';
    var a = o.alpha == null ? 1 : o.alpha;
    for (var i = steps; i >= 1; i--) {
      var k = i / steps;
      ctx.globalAlpha = a * (0.30 + 0.55 * (1 - k));
      ctx.fillStyle = o.side || K.mix('#000000', o.color || '#ffffff', 0.16 + 0.34 * (1 - k));
      ctx.fillText(s, dx * k, dy * k);
    }
    ctx.globalAlpha = a;
    ctx.fillStyle = o.color || K.P.ink;
    if (o.disp) K.dispText(ctx, s, 0, 0, o.disp, {});
    else ctx.fillText(s, 0, 0);
    if (o.stroke) {
      ctx.globalAlpha = a * 0.85;
      ctx.strokeStyle = o.stroke;
      ctx.lineWidth = o.strokeW || 1;
      ctx.strokeText(s, 0, 0);
    }
    if (o.ls != null && 'letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* ---------------- perspective wall of type ----------------
     Lines are laid out on a plane that leans away from the camera. Because
     the plane only leans about one horizontal axis, every line has a single
     uniform scale — so a per-line transform is exact, and cheap.           */
  function wall(ctx, block, o) {
    o = o || {};
    var size = o.size || 14;
    K.setFont(ctx, size, K.F.code, 400);
    var cw = ctx.measureText('M').width;
    var lh = o.lh || size * 1.6;
    var tilt = o.tilt == null ? 0.055 : o.tilt;
    var y0 = o.y || K.H * 0.5;
    var alpha = o.alpha == null ? 1 : o.alpha;
    var lines = block.tok;
    for (var i = 0; i < lines.length; i++) {
      var d = 1 + i * tilt;              /* scale falls off with depth */
      var sc = 1 / Math.max(0.12, d);
      var ly = y0 + i * lh * sc * (o.spread || 1);
      var sx = o.align === 'right' ? (o.x || K.W / 2) - 520 * sc : (o.x || K.W / 2);
      ctx.save();
      ctx.globalAlpha = alpha * K.clamp(1.25 - i / (lines.length + 2), 0, 1);
      ctx.translate(sx, ly);
      ctx.scale(sc, sc);
      var col = 0;
      for (var j = 0; j < lines[i].length; j++) {
        var tk = lines[i][j];
        if (tk.s.trim()) {
          ctx.fillStyle = K.P.syn[tk.c] || K.P.syn.var;
          ctx.fillText(tk.s, col * cw, 0);
        }
        col += tk.s.length;
      }
      ctx.restore();
    }
  }

  /* camera path helper: orbit with breathing radius */
  function orbit(t, o) {
    o = o || {};
    var r = (o.r || 6) + Math.sin(t * (o.breath || 0.3)) * (o.rv || 0.4);
    var a = (o.a0 || 0) + t * (o.speed || 0.35);
    var y = (o.y || 0) + Math.sin(t * (o.yv || 0.22)) * (o.yamp || 0.7);
    return [Math.sin(a) * r, y, Math.cos(a) * r];
  }

  /* Distance needed to frame an object of half-size `half` at `fill` of the
     half-frame, for a given fov. This is what makes a 2° lens usable: you
     stand proportionally further away, and the object keeps its size while
     the perspective flattens to orthographic. */
  function fit(fov, half, fill) {
    return half / (Math.tan(fov * Math.PI / 360) * (fill || 0.6));
  }

  K.G = {
    begin: begin, push: push, flush: flush, proj: proj, cam: func_cam(),
    set: setup,
    line: line, polyline: polyline, points: points, quad: quad, text3: text3,
    box: boxWire, ring: ring, spherePts: spherePts, extrude: extrude, wall: wall,
    orbit: orbit, fit: fit,
    sub: sub, add: add, mul: mul, dot: dot, cross: cross, len: len, norm: norm,
    rotX: rotX, rotY: rotY, rotZ: rotZ
  };
  function func_cam() { return cam; }

})(window.K);
