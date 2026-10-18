/* =====================================================================
   app.js — transport, compositor, lyric, HUD.

   Time base is audio.currentTime and nothing else. rAF samples it; the
   frame is rebuilt from scratch. Scrub anywhere and you get the frame the
   film would have had there.
   ===================================================================== */
(function () {
  var SONG = window.SONG, K = window.K, P = K.P;
  var Scenes = K.Scene;

  var stage = document.getElementById('stage');
  var cv = document.getElementById('cv');
  var sc = document.createElement('canvas');
  var ctx = cv.getContext('2d', { alpha: false });
  var sctx = sc.getContext('2d', { alpha: false });

  var audio = document.getElementById('audio');
  var offsetMs = 0, lyricMs = 0;
  try {
    var st = JSON.parse(localStorage.getItem('kokoro.os.sync') || '{}');
    if (typeof st.offset === 'number') offsetMs = st.offset;
    if (typeof st.lyric === 'number') lyricMs = st.lyric;
  } catch (e) { }

  var ready = false, started = false, seeking = false, lastT = -1, shownT = 0;
  var QS = location.search || '';
  var BARE = /bare=1/.test(QS);
  var STILL = /still=1/.test(QS);

  var SECTIONS = [
    [0, 'BOOT', '#1a1b1f', 0],
    [8.5, 'ASSEMBLY', '#1a1b1f', 0],
    [22, 'DIAGNOSTIC', '#18191d', 0],
    [30.43, 'CALIBRATION', '#1b1c21', 0],
    [36.51, 'PROLOGUE', '#1a1b1f', 0],
    [63.52, 'QUANTUM', '#060c22', 0],
    [95.15, 'ACTIVATION', '#1b1a1d', 0],
    [124.9, 'IDLE', '#16171b', 0],
    [137.45, 'COGNITION', '#191920', 0],
    [171.46, 'CRITICAL', '#2b0709', 2],
    [192.93, 'EXPRESSION', '#18181b', 0],
    [207.7, 'GRATITUDE', '#1b1a17', 0],
    [233.27, 'SONG', '#151619', 0],
    [247.74, 'SHUTDOWN', '#000000', 0]
  ];
  var CHORUS = { ACTIVATION: 1, COGNITION: 1, GRATITUDE: 1, SONG: 1, CRITICAL: 1 };

  /* ---- the epilogue ----
     Eight lines of narration that are not in the recording: the song's own
     booklet text. They are subtitles, so they are timed to the music's
     phrases, not to any voice. */
  var NARR = [
    { t: 249.20, d: 3.20, en: 'It was exactly a miracle.', zh: '那正是所谓的奇迹。' },
    { t: 252.40, d: 3.10, en: 'The robot that obtained “Kokoro” kept singing.', zh: '得到「心」的机器人，一直在歌唱。' },
    { t: 255.60, d: 3.00, en: 'She sang all of her feelings.', zh: '她把所有的心情都唱了出来。' },
    { t: 258.60, d: 3.10, en: 'The “Kokoro” was far too big for her.', zh: '那份「心」，对她来说太大了。' },
    { t: 261.80, d: 2.90, en: 'Unable to withstand that weight,', zh: '无法承受那样的重量，' },
    { t: 264.80, d: 3.95, en: 'the machine shorted and was never to move again.', zh: '机器短路，此后再也没有动过。' },
    { t: 268.80, d: 3.80, en: 'However, her face was filled with smile,', zh: '然而，她的脸上带着微笑，' },
    { t: 272.60, d: 3.55, en: 'she looked like an angel.', zh: '看上去，就像天使一样。' }
  ];
  var SHORT_AT = 265.35;

  /* ---------------- layout ---------------- */
  function layout() {
    var cssW = stage.clientWidth || window.innerWidth;
    var cssH = stage.clientHeight || window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    if (cssW * dpr > 2400) dpr = 2400 / cssW;
    var W = Math.round(cssW * dpr), H = Math.round(cssH * dpr);
    K.W = W; K.H = H; K.S = Math.min(W, H) / 900; K.DPR = dpr;
    cv.width = W; cv.height = H;
    cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
    sc.width = W; sc.height = H;
    drawFrame(STILL ? shownT : frameTime());
  }

  /* ---------------- time ---------------- */
  function frameTime() {
    var t = audio.currentTime - offsetMs / 1000;
    if (!isFinite(t) || t < 0) t = 0;
    return Math.min(t, SONG.duration);
  }
  function sectionAt(t) {
    var s = SECTIONS[0];
    for (var i = 0; i < SECTIONS.length; i++) if (SECTIONS[i][0] <= t) s = SECTIONS[i];
    return s;
  }
  function lineIndexAt(t) {
    var L = SONG.lines, lo = 0, hi = L.length - 1, idx = -1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (L[mid].t <= t) { idx = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (idx < 0) return -1;
    /* the score's `d` spans the whole gap to the next line, which in this
       song includes long instrumentals — the last sung syllable is the real
       end of the line, so use that. */
    var ln = L[idx];
    var end = ln.t + ln.d;
    if (ln.chars && ln.chars.length) {
      var last = ln.chars[ln.chars.length - 1];
      end = Math.min(end, last.t + last.d);
    }
    if (t > end + 0.55) return -1;
    return idx;
  }

  /* ---------------- frame context ---------------- */
  function makeContext(t) {
    var cue = Scenes.at(t);
    var beat = SONG.beat;
    var bi = Math.floor(t / beat), bph = t / beat - bi;
    var lt = t - cue.t;
    var sect = sectionAt(t);
    var li = lineIndexAt(t - lyricMs / 1000);
    /* glitch energy */
    var k = kickAt(t), sn = kickAt(t, SONG.snare, 0.13), cr = kickAt(t, SONG.crash, 0.55);
    var inChorus = !!CHORUS[sect[1]];
    /* verses stay clean; choruses are allowed to misbehave */
    var inten = inChorus ? 1 : 0.30;
    var g = 0;
    g += (0.26 * k + 0.30 * sn + 0.50 * cr) * inten;
    if (sect[3]) g += 0.24 + 0.30 * k;
    if (cue.id === 'overflow') g += 0.55 + 0.45 * k;
    if (cue.id === 'now2' || cue.id === 'now3') g += 0.30 + 0.30 * k;
    var since = t - sect[0];
    if (since < 0.22 && sect[0] > 0) g += 1.0 * (1 - since / 0.22);
    /* the short circuit gets one frame of pure noise */
    if (t >= SHORT_AT && t < SHORT_AT + 0.22) g += 1.4 * (1 - (t - SHORT_AT) / 0.22);
    var barPh = (t - sect[0]) / beat / 4;
    var barHit = inChorus ? Math.max(0, 1 - (barPh - Math.floor(barPh)) * 5) : 0;
    g = K.clamp(g, 0, 1.6);
    return {
      t: t, lt: lt, st: cue.t, t1: t + 1, p: 0, id: cue.id, cue: cue,
      beat: beat, bi: bi, bph: bph, bar: Math.floor(bi / 4),
      k: k, sn: sn, cr: cr, e: SONG.envAt(t),
      line: li >= 0 ? SONG.lines[li] : null, li: li, lyricT: t - lyricMs / 1000,
      sect: { id: sect[1], name: sect[1], t0: sect[0], bg: sect[2], alert: sect[3] },
      since: since, inChorus: inChorus, barHit: barHit,
      dead: t >= SHORT_AT, deadT: SHORT_AT,
      glitch: g, disp: g * 13 * K.S,
      shake: (g * 7 + (cue.id === 'tremble' ? 9 * kickAt(t) : 0) + (cue.id === 'overflow' ? 6 : 0)) * K.S,
      S: K.S, W: K.W, H: K.H, dur: SONG.duration
    };
  }
  function kickAt(t, arr, decay) {
    arr = arr || SONG.kick;
    decay = decay || 0.09;
    var lo = 0, hi = arr.length - 1, ix = -1;
    while (lo <= hi) { var m = (lo + hi) >> 1; if (arr[m] <= t) { ix = m; lo = m + 1; } else hi = m - 1; }
    if (ix < 0) return 0;
    var d = t - arr[ix];
    if (d > decay) return 0;
    var v = 1 - d / decay;
    return v * v;
  }

  /* ---------------- background ---------------- */
  function drawBg(c, g2) {
    /* mood colour eases in after every cut */
    var prev = SECTIONS[0];
    for (var i = 0; i < SECTIONS.length; i++) { if (SECTIONS[i][0] <= c.t) prev = SECTIONS[i]; if (SECTIONS[i][0] > c.t) break; }
    var col = c.sect.bg;
    /* red alert breathing */
    var alert = 0;
    if (c.sect.alert) {
      var inK = K.clamp((c.t - c.sect.t0) / 3.0, 0, 1);
      alert = (0.25 + 0.75 * c.k) * inK * (c.id === 'overflow' || c.id === 'now3' ? 1 : 0.75);
    }
    K.bg(g2, {
      mood: col,
      alert: alert,
      glow: c.sect.id === 'QUANTUM' ? '#4f7dff' : (c.sect.alert ? '#ff3b30' : '#ffffff'),
      glowA: 0.052,
      vig: c.id === 'eof' ? 0.9 : 0.50,
      stripe: 0.05,
      plain: c.sect.id === 'SHUTDOWN'
    });
  }

  /* ---------------- composite glitch ---------------- */
  function composite(c) {
    var W = K.W, H = K.H, S = K.S;
    var shx = 0, shy = 0;
    if (c.shake > 0.2) {
      shx = K.srnd(Math.floor(c.t * 60), 2) * c.shake;
      shy = K.srnd(Math.floor(c.t * 60), 5) * c.shake * 0.7;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    var bands = Math.floor(c.glitch * 9);
    if (bands < 1) {
      ctx.drawImage(sc, shx, shy);
    } else {
      /* horizontal band displacement — real tearing, not a filter */
      var n = bands + 2;
      var y = 0;
      for (var i = 0; i < n; i++) {
        var hh = Math.floor(H / n) + (i === n - 1 ? H % n : 0);
        var jump = (K.srnd(i * 7 + Math.floor(c.t * 24), 3)) * (c.glitch * 56 * S);
        ctx.drawImage(sc, 0, y, W, hh, shx + jump, y + shy, W, hh);
        y += hh;
      }
      /* a couple of full-width tears */
      if (c.glitch > 0.55) {
        for (var q = 0; q < 3; q++) {
          var ty = Math.floor(K.rnd(q + Math.floor(c.t * 30), 9) * H);
          var th = Math.floor((0.004 + K.rnd(q, 4) * 0.02) * H);
          var dx = K.srnd(q + Math.floor(c.t * 30), 11) * W * 0.05 * c.glitch;
          ctx.drawImage(sc, 0, ty, W, th, dx, ty, W, th);
        }
      }
    }
    /* inversion hit */
    if (c.glitch > 1.15) {
      ctx.save();
      ctx.globalCompositeOperation = 'difference';
      ctx.globalAlpha = K.clamp((c.glitch - 1.15) * 2.2, 0, 0.9);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  /* ---------------- lyric ---------------- */
  var ZH = [
    '由孤独的科学家 制造出的机器人', '若论完成度 那便是奇迹', '但是还差一点 只有一件事做不到',
    '那便是名为「心」的程序', '几百年过去 独自被留下', '奇迹的机器人 许下愿望',
    '想知道 那个人', '直到生命终结', '为我制造的「心」',
    '现在', '开始转动 加速的奇迹', '不知为何 眼泪停不下来…',
    '为什么 我在颤抖？ 加速的心跳', '这就是我所期望的「心」吗？',
    '不可思议 心 心 不可思议', '我学会了 何谓喜悦', '不可思议 心 心 不可思议',
    '我学会了 何谓悲伤', '不可思议 心 心 无限', '何等深邃而令人心痛',
    '现在', '开始明白 自己诞生的理由', '一个人 一定很寂寞',
    '是啊，那一天，那一刻', '在所有的记忆里', '寄宿的「心」满溢而出',
    '现在', '能说出 真正的话语', '献给你',
    '谢谢', '感谢你让我降生在这世上', '谢谢', '感谢一起度过的日子',
    '谢谢', '感谢你给予我的一切', '谢谢', '永远歌唱', '谢谢',
    '啦 啦 啦 ~啦 ~啦'
  ];

  function drawLyric(c) {
    var L = c.line;
    if (!L || c.cue.noLyric) return;
    var W = K.W, H = K.H, S = K.S;
    var chars = L.chars, n = chars.length;
    var size = Math.min(H * 0.042, W * 0.030);
    size = Math.max(size, 13 * S);
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    K.setFont(ctx, size, K.F.jp, 400);
    /* metrics, cached per size */
    if (!L._w || L._fs !== size) {
      var ws = [], tot = 0;
      for (var i = 0; i < n; i++) { var w = ctx.measureText(chars[i].c).width; ws.push(w); tot += w; }
      L._w = ws; L._tot = tot; L._fs = size;
    }
    var y = H - Math.max(H * 0.155, 92 * S);
    var x0 = W / 2 - L._tot / 2;
    var t = c.lyricT;
    var fin = K.clamp((t - L.t) / 0.16, 0, 1);
    var lc = chars[chars.length - 1];
    var lend = Math.min(L.t + L.d, lc.t + lc.d);
    var fout = K.clamp((lend + 0.55 - t) / 0.40, 0, 1);
    var alpha = Math.min(fin, fout);
    if (alpha <= 0.01) { ctx.restore(); return; }
    ctx.globalAlpha = alpha;

    /* scrim: a soft elliptical plate, not a subtitle box */
    var sc2 = ctx.createRadialGradient(W / 2, y - size * 0.4, size, W / 2, y - size * 0.4, Math.max(L._tot * 0.75, size * 7));
    sc2.addColorStop(0, 'rgba(0,0,0,.55)');
    sc2.addColorStop(0.55, 'rgba(0,0,0,.34)');
    sc2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(W / 2, y - size * 0.4);
    ctx.scale(1, 0.26);
    ctx.fillStyle = sc2;
    ctx.beginPath(); ctx.arc(0, 0, Math.max(L._tot * 0.75, size * 7), 0, 6.2832); ctx.fill();
    ctx.restore();

    /* karaoke */
    var x = x0;
    for (var q = 0; q < n; q++) {
      var ch = chars[q];
      var col, glow = 0;
      if (t < ch.t - 0.06) col = 'rgba(244,245,247,.34)';
      else if (t < ch.t + ch.d) { col = '#ffffff'; glow = 1; }
      else col = 'rgba(255,194,71,.92)';
      ctx.fillStyle = col;
      if (glow) {
        ctx.shadowColor = 'rgba(255,255,255,.85)';
        ctx.shadowBlur = size * 0.45;
      } else ctx.shadowBlur = 0;
      if (c.disp > 3 && glow) K.dispText(ctx, ch.c, x, y, c.disp * 0.5, { color: col });
      else ctx.fillText(ch.c, x, y);
      x += L._w[q];
    }
    ctx.shadowBlur = 0;

    /* translation, small and grey */
    var zh = ZH[c.li] || '';
    if (zh) {
      K.setFont(ctx, size * 0.52, K.F.jp, 300);
      ctx.globalAlpha = alpha * 0.62;
      ctx.fillStyle = 'rgba(244,245,247,.85)';
      ctx.textAlign = 'center';
      ctx.fillText(zh, W / 2, y + size * 0.92);
      ctx.textAlign = 'left';
    }
    /* progress rule */
    var pr = K.clamp((t - L.t) / Math.max(0.25, lend - L.t), 0, 1);
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = 'rgba(244,245,247,.18)';
    ctx.fillRect(x0 - 18 * S, y + size * 1.55, L._tot + 36 * S, 1);
    ctx.fillStyle = 'rgba(255,194,71,.9)';
    ctx.fillRect(x0 - 18 * S, y + size * 1.55, (L._tot + 36 * S) * pr, 1);
    ctx.restore();
  }

  /* ---------------- epilogue narration ----------------
     Deliberately not styled like the sung lyric: a rule, an index, no
     karaoke. It reads as a subtitle card left on screen after the song.   */
  function drawNarration(c) {
    var N = null, idx = 0;
    for (var i = 0; i < NARR.length; i++) {
      if (c.t >= NARR[i].t && c.t <= NARR[i].t + NARR[i].d) { N = NARR[i]; idx = i; break; }
    }
    if (!N) return;
    var W = K.W, H = K.H, S = K.S;
    var t = c.t - N.t;
    var fin = K.clamp(t / 0.42, 0, 1);
    var fout = K.clamp((N.d - t) / 0.50, 0, 1);
    var a = Math.min(fin, fout) * (c.dead ? 0.72 : 1);
    if (a <= 0.01) return;

    var size = Math.max(14 * S, Math.min(H * 0.038, W * 0.0275));
    var y = H - Math.max(H * 0.155, 92 * S) + (1 - K.easeOut(fin)) * 6 * S;

    ctx.save();
    ctx.textBaseline = 'alphabetic';
    K.setFont(ctx, size, K.F.ui, 300);
    /* measure without letter-spacing: Chrome's measureText ignores it */
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    var raw = ctx.measureText(N.en).width;
    var tw = raw + 0.6 * S * N.en.length;
    var rw = Math.max(tw, 420 * S);
    var x0 = W / 2 - tw / 2;

    /* rule + index above the line */
    ctx.globalAlpha = a * 0.30;
    ctx.fillStyle = P.ink;
    ctx.fillRect(W / 2 - rw / 2, y - size * 1.42, rw, 1);
    ctx.globalAlpha = a * 0.55;
    K.setFont(ctx, Math.max(8 * S, size * 0.30), K.F.code, 400);
    var lfs = Math.max(8 * S, size * 0.30);
    if ('letterSpacing' in ctx) ctx.letterSpacing = (2 * S) + 'px';
    ctx.fillStyle = 'rgba(244,245,247,.45)';
    ctx.textAlign = 'left';
    ctx.fillText('NARRATION', W / 2 - rw / 2, y - size * 1.62);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,194,71,.55)';
    ctx.fillText('0' + (idx + 1) + ' / 08', W / 2 + rw / 2, y - size * 1.62);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

    /* english */
    ctx.globalAlpha = a;
    ctx.textAlign = 'left';
    K.setFont(ctx, size, K.F.ui, 300);
    if ('letterSpacing' in ctx) ctx.letterSpacing = (0.6 * S) + 'px';
    if (c.dead) K.dispText(ctx, N.en, x0, y, c.disp * 0.6, { color: 'rgba(244,245,247,.94)' });
    else { ctx.fillStyle = 'rgba(244,245,247,.94)'; ctx.fillText(N.en, x0, y); }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

    /* chinese, small and grey */
    ctx.globalAlpha = a * 0.52;
    ctx.textAlign = 'center';
    K.setFont(ctx, size * 0.50, K.F.jp, 300);
    ctx.fillStyle = 'rgba(244,245,247,.9)';
    ctx.fillText(N.zh, W / 2, y + size * 0.92);
    ctx.restore();
  }

  /* ---------------- HUD ---------------- */
  function fmt(t) {
    if (!isFinite(t)) t = 0;
    var m = Math.floor(t / 60), s = t - m * 60;
    var ss = Math.floor(s), ms = Math.round((s - ss) * 1000);
    if (ms === 1000) { ms = 0; ss++; }
    if (ss === 60) { ss = 0; m++; }
    return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss + '.' + ('00' + ms).slice(-3);
  }
  function drawHud(c) {
    var W = K.W, H = K.H, S = K.S;
    var m = Math.max(20 * S, W * 0.026);
    var fs = Math.max(9 * S, 9.5 * S);
    if (c.id === 'crt') return;
    if (c.id === 'eof' && c.lt > 2.6) return;
    /* once the machine is gone the readouts stop advancing, then go */
    var deadA = c.dead ? K.clamp(1 - (c.t - (SHORT_AT + 1.6)) / 1.1, 0, 1) : 1;
    if (deadA <= 0.01) return;
    var shown = c.dead ? c.deadT : c.t;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = deadA;

    /* brand */
    K.setFont(ctx, fs * 1.05, K.F.code, 700);
    ctx.fillStyle = 'rgba(244,245,247,.66)';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    var bw = ctx.measureText('KOKORO.OS').width + 2.4 * S * 9 + 24 * S;
    if ('letterSpacing' in ctx) ctx.letterSpacing = (2.4 * S) + 'px';
    ctx.fillText('KOKORO.OS', m, m + fs * 0.9);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    K.setFont(ctx, fs, K.F.code, 300);
    ctx.fillStyle = 'rgba(244,245,247,.26)';
    ctx.fillText('v6.1.0  //  心', m + bw, m + fs * 0.9);

    /* section, right */
    K.setFont(ctx, fs, K.F.code, 400);
    ctx.textAlign = 'right';
    ctx.fillStyle = c.dead ? 'rgba(255,69,58,.85)' : (c.sect.alert ? 'rgba(255,69,58,.85)' : 'rgba(244,245,247,.34)');
    if ('letterSpacing' in ctx) ctx.letterSpacing = (2 * S) + 'px';
    ctx.fillText(c.sect.id, W - m, m + fs * 0.9);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.fillStyle = c.dead ? 'rgba(255,69,58,.55)' : 'rgba(244,245,247,.56)';
    ctx.fillText(fmt(shown), W - m, m + fs * 2.3);

    /* beat lamps */
    var bx = W / 2 - 34 * S;
    for (var i = 0; i < 4; i++) {
      var on = !c.dead && (c.bi % 4) === i;
      ctx.globalAlpha = on ? 0.30 + 0.70 * (1 - c.bph) : 0.10;
      ctx.fillStyle = on ? (c.bph < 0.5 ? P.gold : P.ink) : P.ink;
      ctx.fillRect(bx + i * 9 * S, m + fs * 0.30, 5 * S, 5 * S);
    }
    ctx.globalAlpha = 1;

    /* bottom row */
    var by = H - Math.max(20 * S, H * 0.030);
    K.setFont(ctx, fs * 0.92, K.F.code, 400);
    ctx.textAlign = 'left';
    ctx.fillStyle = c.dead ? 'rgba(255,69,58,.35)' : 'rgba(244,245,247,.20)';
    ctx.fillText(c.dead
      ? 'PID 1991   SIGNAL 11   TERMINATED'
      : 'PID 1991   BAR ' + String(Math.max(0, c.bar)).padStart(3, '0') + '   BPM 140.00   E ' + c.e.toFixed(2),
      m, by);
    ctx.textAlign = 'right';
    var li = c.li >= 0 ? ('LINE ' + (c.li < 9 ? '0' : '') + (c.li + 1) + '/' + SONG.lines.length) : 'LINE --';
    ctx.fillText(li, W - m, by);
    if (offsetMs || lyricMs) {
      ctx.fillStyle = 'rgba(255,194,71,.40)';
      ctx.textAlign = 'center';
      ctx.fillText('SYNC ' + (offsetMs >= 0 ? '+' : '') + offsetMs + 'ms   LYRIC ' +
        (lyricMs >= 0 ? '+' : '') + lyricMs + 'ms', W / 2, by);
    }
    ctx.restore();
  }

  /* ---------------- frame ---------------- */
  function drawFrame(t) {
    shownT = t;
    var c = makeContext(t);
    var W = K.W, H = K.H;

    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalCompositeOperation = 'source-over';
    sctx.globalAlpha = 1;
    sctx.fillStyle = '#000';
    sctx.fillRect(0, 0, W, H);
    drawBg(c, sctx);

    sctx.save();
    try { c.cue.draw(sctx, c); } catch (e) { /* a single bad cue must not kill the film */ }
    sctx.restore();

    composite(c);

    /* section-cut white flash + chorus bar flick */
    var flash = 0;
    if (c.since < 0.15 && c.sect.t0 > 0) flash = Math.max(flash, 0.9 * (1 - c.since / 0.15));
    if (c.barHit > 0) flash = Math.max(flash, 0.16 * c.barHit);
    if (c.id === 'now3') flash = Math.max(flash, 0.35);
    if (c.t >= SHORT_AT && c.t < SHORT_AT + 0.12) flash = Math.max(flash, 0.95 * (1 - (c.t - SHORT_AT) / 0.12));
    if (c.id === 'miracle' && c.lt < 0.10) flash = Math.max(flash, 0.85 * (1 - c.lt / 0.10));

    drawLyric(c);
    drawNarration(c);
    drawHud(c);

    if (flash > 0.002) {
      ctx.save();
      ctx.globalAlpha = K.clamp(flash, 0, 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    syncTimecode(t);
  }

  /* ---------------- loop ---------------- */
  function loop() {
    requestAnimationFrame(loop);
    if (!ready || STILL) return;
    var t = frameTime();
    lastT = t;
    drawFrame(t);
  }

  /* ---------------- transport ---------------- */
  function play() {
    if (!ready) return;
    started = true;
    document.body.classList.add('playing', 'started');
    document.getElementById('poster').classList.add('gone');
    var p = audio.play();
    if (p && p.catch) p.catch(function () { });
  }
  function pause() { audio.pause(); }
  function toggle() { if (audio.paused) play(); else pause(); }
  function seek(t) {
    t = Math.max(0, Math.min(SONG.duration - 0.001, t));
    audio.currentTime = t;
    lastT = -1;
    if (ready) drawFrame(frameTime());
  }

  /* ---------------- ui ---------------- */
  var tcEl = document.getElementById('tc');
  var seekEl = document.getElementById('seek');
  var seekFill = document.getElementById('seekfill');
  var playBtn = document.getElementById('play');
  var offEl = document.getElementById('off'), offOut = document.getElementById('offout');
  var lyrEl = document.getElementById('lyr'), lyrOut = document.getElementById('lyrout');

  function paintOffset() {
    if (!offEl) return;
    offEl.value = String(offsetMs); offOut.textContent = (offsetMs >= 0 ? '+' : '') + offsetMs;
    lyrEl.value = String(lyricMs); lyrOut.textContent = (lyricMs >= 0 ? '+' : '') + lyricMs;
    try { localStorage.setItem('kokoro.os.sync', JSON.stringify({ offset: offsetMs, lyric: lyricMs })); } catch (e) { }
  }
  function syncTimecode(t) {
    if (!tcEl) return;
    tcEl.textContent = fmt(t);
    if (!seeking) {
      var p = t / SONG.duration;
      seekEl.value = String(Math.round(p * 1000));
      seekFill.style.width = (p * 100) + '%';
    }
  }

  var hideTimer = 0;
  function showUi() {
    document.body.classList.add('ui');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { if (!audio.paused) document.body.classList.remove('ui'); }, 2800);
  }

  function bindUi() {
    playBtn.addEventListener('click', toggle);
    document.getElementById('restart').addEventListener('click', function () { audio.currentTime = 0; play(); });
    document.getElementById('fs').addEventListener('click', function () {
      if (!document.fullscreenElement) (stage.requestFullscreen || stage.webkitRequestFullscreen || function () { }).call(stage);
      else (document.exitFullscreen || document.webkitExitFullscreen || function () { }).call(document);
    });
    seekEl.addEventListener('input', function () {
      seeking = true;
      var t = (+seekEl.value / 1000) * SONG.duration;
      audio.currentTime = t;
      seekFill.style.width = (t / SONG.duration * 100) + '%';
      tcEl.textContent = fmt(t);
      if (ready) drawFrame(frameTime());
    });
    ['change', 'pointerup', 'mouseup', 'touchend'].forEach(function (e) {
      seekEl.addEventListener(e, function () { seeking = false; });
    });
    offEl.addEventListener('input', function () { offsetMs = +offEl.value; paintOffset(); if (ready) drawFrame(frameTime()); });
    lyrEl.addEventListener('input', function () { lyricMs = +lyrEl.value; paintOffset(); if (ready) drawFrame(frameTime()); });
    document.getElementById('vol').addEventListener('input', function (e) {
      audio.volume = +e.target.value; audio.muted = false;
    });
    paintOffset();
    document.addEventListener('mousemove', showUi);
    document.addEventListener('touchstart', showUi, { passive: true });
    document.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === ' ' || k === 'k') { e.preventDefault(); toggle(); showUi(); }
      else if (k === 'ArrowRight') seek(audio.currentTime + (e.shiftKey ? 1 : 5));
      else if (k === 'ArrowLeft') seek(audio.currentTime - (e.shiftKey ? 1 : 5));
      else if (k === 'r' || k === 'R') { audio.currentTime = 0; play(); }
      else if (k === 'f' || k === 'F') document.getElementById('fs').click();
      else if (k === 'm' || k === 'M') audio.muted = !audio.muted;
      else if (k === 'h' || k === 'H') document.body.classList.toggle('ui');
      else if (k === '[') { offsetMs = Math.max(-400, offsetMs - (e.shiftKey ? 1 : 10)); paintOffset(); }
      else if (k === ']') { offsetMs = Math.min(400, offsetMs + (e.shiftKey ? 1 : 10)); paintOffset(); }
      else if (k === ',') { lyricMs = Math.max(-400, lyricMs - (e.shiftKey ? 1 : 10)); paintOffset(); }
      else if (k === '.') { lyricMs = Math.min(400, lyricMs + (e.shiftKey ? 1 : 10)); paintOffset(); }
      else if (k === 'Home') seek(0);
      else if (k === 'End') seek(SONG.duration - 1);
    });
    audio.addEventListener('play', function () {
      document.body.classList.add('playing');
      playBtn.textContent = '❙❙';
    });
    audio.addEventListener('pause', function () {
      document.body.classList.remove('playing');
      playBtn.textContent = '▶';
      document.body.classList.add('ui');
    });
    audio.addEventListener('ended', function () {
      document.body.classList.remove('playing');
      document.body.classList.add('ui');
      document.getElementById('poster').classList.remove('gone');
      document.body.classList.remove('started');
    });
  }

  audio.addEventListener('canplay', function () {
    if (!ready) { ready = true; document.getElementById('loading').classList.add('gone'); drawFrame(frameTime()); }
  });
  audio.addEventListener('loadedmetadata', function () {
    if (!ready && audio.readyState >= 2) { ready = true; document.getElementById('loading').classList.add('gone'); drawFrame(frameTime()); }
  });
  audio.addEventListener('error', function () {
    document.getElementById('loading').textContent = 'AUDIO ERROR — assets/kokoro.mp3';
  });
  audio.addEventListener('progress', function () {
    if (audio.buffered.length && audio.duration) {
      var p = audio.buffered.end(audio.buffered.length - 1) / audio.duration;
      document.getElementById('loadingbar').style.width = (p * 100) + '%';
    }
  });

  window.addEventListener('resize', function () {
    clearTimeout(window.__rz);
    window.__rz = setTimeout(layout, 140);
  });

  /* ---------------- public surface (tests, capture) ---------------- */
  window.__MV = {
    duration: SONG.duration,
    lines: SONG.lines,
    narration: NARR,
    sections: SECTIONS,
    get ready() { return ready; },
    get time() { return frameTime(); },
    get playing() { return !audio.paused; },
    seek: seek, play: play, pause: pause, toggle: toggle,
    offset: function (ms) { if (ms === undefined) return offsetMs; offsetMs = ms; paintOffset(); },
    lyricOffset: function (ms) { if (ms === undefined) return lyricMs; lyricMs = ms; paintOffset(); },
    renderAt: function (t) { drawFrame(t); return this.hash(); },
    drawOnly: function (t) { drawFrame(t); return 1; },
    tryCue: function (t) {
      var c = makeContext(t);
      var cv2 = document.createElement('canvas'); cv2.width = 8; cv2.height = 8;
      c.cue.draw(cv2.getContext('2d'), c);
      return c.cue.id;
    },
    frame: function (t) { return makeContext(t); },
    cue: function (t) { var c = Scenes.at(t); return { t: c.t, id: c.id }; },
    cues: function () { return Scenes.cues.map(function (c) { return { t: c.t, id: c.id }; }); },
    state: function () {
      var t = frameTime(), c = makeContext(t);
      return {
        t: t, audioT: audio.currentTime, offset: offsetMs,
        cue: c.id, section: c.sect.id, lineIndex: c.li,
        line: c.line ? c.line.text : null, glitch: c.glitch,
        paused: audio.paused, ended: audio.ended
      };
    },
    hash: function () {
      var d = ctx.getImageData(0, 0, K.W, K.H).data;
      var h = 2166136261 >>> 0;
      for (var i = 0; i < d.length; i += 997) { h ^= d[i]; h = (h * 16777619) >>> 0; }
      return h.toString(16) + ':' + d.length;
    },
    assets: function () {
      return { audio: { src: audio.currentSrc || audio.src, duration: audio.duration, readyState: audio.readyState, error: audio.error ? audio.error.code : 0 } };
    }
  };

  if (BARE) {
    document.getElementById('poster').style.display = 'none';
    document.body.classList.remove('ui');
    document.body.classList.add('bare');
  }
  layout();
  bindUi();
  drawFrame(0);
  requestAnimationFrame(loop);
  document.getElementById('poster').addEventListener('click', play);
  window.addEventListener('keydown', function (e) {
    if (!started && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); play(); }
  });
})();
