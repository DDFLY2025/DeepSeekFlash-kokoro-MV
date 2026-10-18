/* =====================================================================
   math.js — a very small math typesetter.

   Not LaTeX: a deliberately tiny language that covers what this film needs.

     A^{2}           superscript
     x_{i}           subscript
     \f{a|b}         fraction (real bar, numerator over denominator)
     \s{x}           square root (radical + overbar)
     letters         set italic, digits and operators upright — the way a
                     maths font is actually used.

   Layout is measured first, then drawn, so formulas can be centred,
   rotated onto a 3D plane, or scaled without re-flowing.
   ===================================================================== */
(function (K) {

  var LETTER = /[A-Za-zΑ-Ωα-ω]/;

  /* ---------------- parse ---------------- */
  function parse(src, i, stop) {
    var nodes = [], buf = '';
    i = i || 0;
    while (i < src.length) {
      var ch = src[i];
      if (stop && ch === stop) { if (buf) nodes.push({ t: 'run', s: buf }); return { nodes: nodes, i: i + 1 }; }
      if (ch === '\\') {
        var cmd = src.substr(i, 2);
        if (cmd === '\\f') {
          if (buf) { nodes.push({ t: 'run', s: buf }); buf = ''; }
          var a = parse(src, i + 3, '|');           /* \f{  */
          var b = parse(src, a.i, '}');
          nodes.push({ t: 'frac', n: a.nodes, d: b.nodes });
          i = b.i; continue;
        }
        if (cmd === '\\s') {
          if (buf) { nodes.push({ t: 'run', s: buf }); buf = ''; }
          var r = parse(src, i + 3, '}');
          nodes.push({ t: 'sqrt', n: r.nodes });
          i = r.i; continue;
        }
        if (cmd === '\\r') {                        /* upright run */
          if (buf) { nodes.push({ t: 'run', s: buf }); buf = ''; }
          var u = parse(src, i + 3, '}');
          nodes.push({ t: 'up', n: u.nodes });
          i = u.i; continue;
        }
        buf += ch; i++; continue;
      }
      if (ch === '^' || ch === '_') {
        if (buf) { nodes.push({ t: 'run', s: buf }); buf = ''; }
        var inner = parse(src, i + 2, '}');
        nodes.push({ t: ch === '^' ? 'sup' : 'sub', n: inner.nodes });
        i = inner.i; continue;
      }
      if (ch === '{' || ch === '}') { i++; continue; }
      buf += ch; i++;
    }
    if (buf) nodes.push({ t: 'run', s: buf });
    return { nodes: nodes, i: i };
  }

  /* ---------------- measure ----------------
     returns {w,h,items:[{x,y,s,size,it}], bar:[{x,y,w}]}            */
  function layout(nodes, size, italicOn, ctx) {
    var items = [], bars = [], x = 0, up = size * 0.74, down = size * 0.26;
    function put(s, dx, dy, sz, ital) {
      if (!s) return 0;
      ctx.font = (ital ? 'italic ' : '') + '400 ' + sz.toFixed(1) + 'px ' + K.F.math;
      var w = ctx.measureText(s).width;
      items.push({ x: x + dx, y: dy, s: s, size: sz, it: ital });
      return w;
    }
    for (var i = 0; i < nodes.length; i++) {
      var nd = nodes[i];
      if (nd.t === 'run') {
        /* split into italic / upright runs */
        var s = nd.s, start = 0, mode = null;
        for (var k = 0; k <= s.length; k++) {
          var m = k < s.length ? (LETTER.test(s[k]) && italicOn !== false) : null;
          if (m !== mode) {
            if (mode !== null && k > start) x += put(s.slice(start, k), 0, 0, size, mode);
            start = k; mode = m;
          }
        }
      } else if (nd.t === 'up') {
        var sub = layout(nd.n, size, false, ctx);
        sub.items.forEach(function (it) { items.push({ x: x + it.x, y: it.y, s: it.s, size: it.size, it: it.it }); });
        sub.bars.forEach(function (b) { bars.push({ x: x + b.x, y: b.y, w: b.w }); });
        x += sub.w;
      } else if (nd.t === 'sup' || nd.t === 'sub') {
        var sz2 = size * 0.60;
        var sm = layout(nd.n, sz2, italicOn, ctx);
        var dy = nd.t === 'sup' ? -size * 0.40 : size * 0.20;
        sm.items.forEach(function (it) { items.push({ x: x + it.x, y: it.y + dy, s: it.s, size: it.size, it: it.it }); });
        sm.bars.forEach(function (b) { bars.push({ x: x + b.x, y: b.y + dy, w: b.w }); });
        x += sm.w + size * 0.02;
        if (nd.t === 'sup') up = Math.max(up, size * 0.40 + sz2 * 0.74);
        else down = Math.max(down, size * 0.20 + sz2 * 0.26);
      } else if (nd.t === 'frac') {
        var szn = size * 0.66;
        var nm = layout(nd.n, szn, italicOn, ctx);
        var dm = layout(nd.d, szn, italicOn, ctx);
        var wmax = Math.max(nm.w, dm.w) + size * 0.16;
        var nx = x + (wmax - nm.w) / 2, dx2 = x + (wmax - dm.w) / 2;
        var yBar = -size * 0.30;
        nm.items.forEach(function (it) { items.push({ x: nx + it.x, y: it.y - size * 0.44, s: it.s, size: it.size, it: it.it }); });
        dm.items.forEach(function (it) { items.push({ x: dx2 + it.x, y: it.y + size * 0.30, s: it.s, size: it.size, it: it.it }); });
        bars.push({ x: x + size * 0.03, y: yBar, w: wmax - size * 0.06 });
        up = Math.max(up, size * 0.44 + szn * 0.74);
        down = Math.max(down, size * 0.30 + szn * 0.26);
        x += wmax + size * 0.10;
      } else if (nd.t === 'sqrt') {
        var inner = layout(nd.n, size, italicOn, ctx);
        var pw = size * 0.52;
        items.push({ x: x, y: 0, s: '√', size: size * 0.96, it: false });
        items.push({ x: x, y: 0, s: '', size: size, it: false, over: { x0: x + pw, x1: x + pw + inner.w + size * 0.06, dy: -size * 0.70 } });
        inner.items.forEach(function (it) { items.push({ x: x + pw + it.x, y: it.y, s: it.s, size: it.size, it: it.it }); });
        x += pw + inner.w + size * 0.10;
      }
    }
    return { w: x, h: up + down, up: up, down: down, items: items, bars: bars };
  }

  /* ---------------- draw ---------------- */
  /* opt: {color, alpha, align:'left'|'center', weight} */
  function draw(ctx, tex, x, y, size, opt) {
    opt = opt || {};
    var key = tex + '|' + size.toFixed(1);
    var cache = draw._c || (draw._c = {});
    var L = cache[key];
    ctx.save();
    if (!L) L = cache[key] = layout(parse(tex, 0, null).nodes, size, true, ctx);
    var ox = opt.align === 'center' ? -L.w / 2 : (opt.align === 'right' ? -L.w : 0);
    ctx.globalAlpha = opt.alpha == null ? 1 : opt.alpha;
    ctx.fillStyle = opt.color || K.P.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    for (var i = 0; i < L.items.length; i++) {
      var it = L.items[i];
      if (it.over) {
        ctx.save();
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = Math.max(1, size * 0.045);
        ctx.beginPath();
        ctx.moveTo(it.over.x0 + ox, it.over.dy);
        ctx.lineTo(it.over.x1 + ox, it.over.dy);
        ctx.stroke();
        ctx.restore();
        continue;
      }
      ctx.font = (it.it ? 'italic ' : '') + '400 ' + it.size.toFixed(1) + 'px ' + K.F.math;
      ctx.fillText(it.s, x + it.x + ox, y + it.y);
    }
    ctx.fillStyle = ctx.fillStyle;
    for (var b = 0; b < L.bars.length; b++) {
      var bb = L.bars[b];
      ctx.fillRect(x + bb.x + ox, y + bb.y, bb.w, Math.max(1, size * 0.035));
    }
    ctx.restore();
    return L.w;
  }


  /* ---------------- sprite: a formula baked into a canvas ----------------
     Needed for extrusion: a formula is many runs in two fonts, so it cannot
     be drawn with a single fillText. Bake it once, then draw the bitmap N
     times along an extrusion vector. */
  function sprite(tex, size) {
    var key = tex + '|' + Math.round(size);
    var cache = sprite._c || (sprite._c = {});
    if (cache[key]) return cache[key];
    var m = document.createElement('canvas');
    var cx = m.getContext('2d');
    var L = layout(parse(tex, 0, null).nodes, size, true, cx);
    var pad = 8;
    var up = L.up;                       /* baseline sits this far down */
    m.width = Math.ceil(L.w + pad * 2);
    m.height = Math.ceil(L.h + pad * 2);
    cx = m.getContext('2d');
    cx.fillStyle = '#fff';
    cx.textAlign = 'left'; cx.textBaseline = 'alphabetic';
    for (var i = 0; i < L.items.length; i++) {
      var it = L.items[i];
      if (it.over) {
        cx.strokeStyle = '#fff';
        cx.lineWidth = Math.max(1, size * 0.045);
        cx.beginPath();
        cx.moveTo(it.over.x0 + pad, it.over.dy + pad + up);
        cx.lineTo(it.over.x1 + pad, it.over.dy + pad + up);
        cx.stroke();
        continue;
      }
      cx.font = (it.it ? 'italic ' : '') + '400 ' + it.size.toFixed(1) + 'px ' + K.F.math;
      cx.fillText(it.s, it.x + pad, it.y + pad + up);
    }
    for (var b = 0; b < L.bars.length; b++) {
      var bb = L.bars[b];
      cx.fillRect(bb.x + pad, bb.y + pad + up, bb.w, Math.max(1, size * 0.035));
    }
    var o = { cv: m, w: m.width, h: m.height };
    cache[key] = o;
    return o;
  }

  /* draw a baked formula as a solid object: side faces, then front face.
     opt: {x, y, depth, ang, color, side, alpha, rot, scale, disp} */
  function solid(ctx, tex, x, y, size, opt) {
    opt = opt || {};
    var sp = sprite(tex, size);
    var depth = opt.depth == null ? 12 : opt.depth;
    var ang = opt.ang == null ? -0.55 : opt.ang;
    var dx = Math.cos(ang), dy = Math.sin(ang);
    var steps = opt.steps || 14;
    var sc = opt.scale == null ? 1 : opt.scale;
    var a = opt.alpha == null ? 1 : opt.alpha;
    ctx.save();
    ctx.translate(x, y);
    if (opt.rot) ctx.rotate(opt.rot);
    ctx.scale(sc, sc);
    ctx.globalAlpha = a;
    for (var i = steps; i >= 1; i--) {
      var k = i / steps;
      ctx.globalAlpha = a * (0.55 + 0.45 * (1 - k));
      ctx.filter = 'brightness(' + (0.22 + 0.30 * (1 - k)).toFixed(2) + ')';
      ctx.drawImage(sp.cv, -sp.w / 2 + dx * depth * k, -sp.h / 2 + dy * depth * k);
    }
    ctx.filter = 'none';
    ctx.globalAlpha = a;
    ctx.drawImage(sp.cv, -sp.w / 2, -sp.h / 2);
    ctx.restore();
    ctx.filter = 'none';
  }

  K.Math = { draw: draw, sprite: sprite, solid: solid, layout: function (tex, size, ctx) { return layout(parse(tex, 0, null).nodes, size, true, ctx); } };

})(window.K);
