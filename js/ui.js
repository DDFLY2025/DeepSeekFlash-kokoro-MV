/* =====================================================================
   ui.js — the operating-system furniture: windows, dialogs, terminals,
   progress bars, hex chrome. Flat white strokes, no shadows, 1px borders
   snapped to the pixel grid so they stay hairline at any size.
   ===================================================================== */
(function (K) {
  var P = K.P;

  function crisp(ctx, x, y, w, h, col, a) {
    ctx.save();
    ctx.globalAlpha = a == null ? 1 : a;
    ctx.strokeStyle = col || P.ink30;
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(x) + .5, Math.round(y) + .5, Math.round(w), Math.round(h));
    ctx.restore();
  }

  /* window with title bar */
  function win(ctx, x, y, w, h, o) {
    o = o || {};
    var a = o.alpha == null ? 1 : o.alpha;
    ctx.save();
    ctx.globalAlpha = a;
    if (o.fill !== false) {
      ctx.fillStyle = o.bg || 'rgba(8,9,11,.72)';
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    }
    ctx.strokeStyle = o.border || P.ink30;
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(x) + .5, Math.round(y) + .5, Math.round(w), Math.round(h));
    var th = o.th == null ? 24 : o.th;
    if (th) {
      ctx.strokeStyle = o.border || P.ink18;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + .5, Math.round(y + th) + .5);
      ctx.lineTo(Math.round(x + w) - .5, Math.round(y + th) + .5);
      ctx.stroke();
      var fs = o.fs || 10;
      K.setFont(ctx, fs, K.F.code, 400);
      ctx.fillStyle = o.titleCol || P.ink70;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      if ('letterSpacing' in ctx) ctx.letterSpacing = '1.4px';
      ctx.fillText((o.title || '').toUpperCase(), x + (o.icons === false ? 10 : 46), y + th / 2 + 0.5);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      if (o.icons !== false) {
        for (var i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(x + 13 + i * 10, y + th / 2, 3, 0, 6.2832);
          ctx.strokeStyle = o.dotCol || (i === 0 ? P.goldD : P.ink30);
          ctx.stroke();
        }
      }
      if (o.close) {
        ctx.strokeStyle = P.ink50;
        ctx.beginPath();
        var cx = x + w - 14, cy = y + th / 2;
        ctx.moveTo(cx - 4, cy - 4); ctx.lineTo(cx + 4, cy + 4);
        ctx.moveTo(cx + 4, cy - 4); ctx.lineTo(cx - 4, cy + 4);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* terminal block: prompt lines, optional caret */
  function term(ctx, x, y, w, o) {
    o = o || {};
    var fs = o.fs || 12, lh = o.lh || fs * 1.62;
    K.setFont(ctx, fs, K.F.code, 400);
    var lines = o.lines || [];
    ctx.save();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (ln == null) continue;
      if (typeof ln === 'string') ln = { t: ln };
      K.setFont(ctx, ln.fs || fs, K.F.code, 400);
      var px = x;
      if (ln.prompt !== false) {
        ctx.fillStyle = ln.pcol || P.cyan;
        ctx.fillText(ln.p || '>>>', px, y + i * lh);
        px += (ln.p ? ln.p.length : 3) * (ln.fs || fs) * 0.60 + (ln.fs || fs) * 0.4;
      }
      ctx.fillStyle = ln.c || P.ink70;
      ctx.fillText(ln.t, px, y + i * lh);
      if (ln.caret) {
        var cw = ctx.measureText(ln.t).width;
        ctx.fillStyle = P.cyan;
        ctx.fillRect(px + cw + 2, y + i * lh - fs * 0.78, fs * 0.5, fs * 0.96);
      }
    }
    ctx.restore();
    return lines.length * lh;
  }

  /* segmented progress bar */
  function bar(ctx, x, y, w, h, v, o) {
    o = o || {};
    v = K.clamp(v, 0, 1);
    ctx.save();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.strokeStyle = o.border || P.ink30;
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(x) + .5, Math.round(y) + .5, Math.round(w), Math.round(h));
    var seg = o.seg || 0;
    if (seg) {
      ctx.fillStyle = o.color || P.ink;
      var sw = w / seg;
      for (var i = 0; i < seg; i++) {
        if (i / seg >= v) break;
        ctx.fillRect(x + i * sw + 1, y + 1, Math.max(1, sw - 1.6), h - 2);
      }
    } else {
      ctx.fillStyle = o.color || P.ink;
      ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * v), h - 2);
    }
    ctx.restore();
  }

  /* alert dialog */
  function dialog(ctx, x, y, w, h, o) {
    o = o || {};
    var a = o.alpha == null ? 1 : o.alpha;
    var col = o.color || P.gold;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = o.bg || 'rgba(10,10,12,.88)';
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    ctx.strokeStyle = col;
    ctx.lineWidth = o.w || 1;
    ctx.strokeRect(Math.round(x) + .5, Math.round(y) + .5, Math.round(w), Math.round(h));
    /* title strip */
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), 20);
    K.setFont(ctx, 10, K.F.code, 700);
    ctx.fillStyle = '#0b0b0c';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
    ctx.fillText(o.title || 'WARNING', x + 10, y + 10.5);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    /* icon */
    var ix = x + 26, iy = y + h * 0.52;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(ix, iy - 13); ctx.lineTo(ix + 13, iy + 11); ctx.lineTo(ix - 13, iy + 11);
    ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ix, iy - 4); ctx.lineTo(ix, iy + 3); ctx.stroke();
    ctx.beginPath(); ctx.arc(ix, iy + 7, 1.1, 0, 6.2832); ctx.fillStyle = col; ctx.fill();
    /* text */
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    K.setFont(ctx, o.fs || 12, K.F.code, 400);
    ctx.fillStyle = o.textCol || P.ink;
    var lines = o.text || [];
    for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], x + 48, y + 44 + i * (o.lh || 16));
    /* button */
    if (o.button) {
      var bw = o.bw || 64, bh = 20;
      var bx = x + w - bw - 12, by = y + h - bh - 12;
      ctx.strokeStyle = col;
      ctx.strokeRect(Math.round(bx) + .5, Math.round(by) + .5, bw, bh);
      ctx.fillStyle = col;
      K.setFont(ctx, 10, K.F.code, 700);
      ctx.textAlign = 'center';
      ctx.fillText(o.button, bx + bw / 2, by + 14);
    }
    ctx.restore();
  }

  /* small caps label with a leading tick */
  function label(ctx, s, x, y, o) {
    o = o || {};
    ctx.save();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    K.setFont(ctx, o.fs || 10, o.family || K.F.code, o.weight || 400);
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = (o.ls == null ? 2.2 : o.ls) + 'px';
    ctx.fillStyle = o.color || P.ink50;
    var tx = x;
    if (o.tick) {
      ctx.fillStyle = o.color || P.ink50;
      ctx.fillRect(x, y - (o.fs || 10) * 0.42, 1, (o.fs || 10) * 0.72);
      tx = x + 7;
    }
    ctx.fillStyle = o.color || P.ink50;
    ctx.fillText(s, tx, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.restore();
  }

  /* corner brackets */
  function corners(ctx, x, y, w, h, len, col, a) {
    ctx.save();
    ctx.globalAlpha = a == null ? 1 : a;
    ctx.strokeStyle = col || P.ink50;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
    ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
    ctx.moveTo(x + w, y + h - len); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - len, y + h);
    ctx.moveTo(x + len, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - len);
    ctx.stroke();
    ctx.restore();
  }

  /* crosshair reticle */
  function reticle(ctx, x, y, r, a, col) {
    ctx.save();
    ctx.globalAlpha = a == null ? 1 : a;
    ctx.strokeStyle = col || P.cyan;
    ctx.lineWidth = 1;
    for (var i = 0; i < 4; i++) {
      var ang = i * Math.PI / 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang) * r * 0.55, y + Math.sin(ang) * r * 0.55);
      ctx.lineTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* hatched band (fills a rect with diagonal hairlines) */
  function hatch(ctx, x, y, w, h, step, col, a) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.globalAlpha = a == null ? 0.4 : a;
    ctx.strokeStyle = col || P.ink50;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = -h; i < w; i += step) {
      ctx.moveTo(x + i, y + h);
      ctx.lineTo(x + i + h, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function ticker(ctx, s, x, y, fs, col, a) {
    ctx.save();
    ctx.globalAlpha = a == null ? 0.6 : a;
    K.setFont(ctx, fs || 10, K.F.code, 400);
    ctx.fillStyle = col || P.ink50;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1.6px';
    ctx.fillText(s, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.restore();
  }

  K.UI = {
    win: win, term: term, bar: bar, dialog: dialog, label: label,
    corners: corners, reticle: reticle, hatch: hatch, ticker: ticker, crisp: crisp
  };
})(window.K);
