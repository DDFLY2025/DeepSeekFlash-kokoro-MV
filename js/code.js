/* =====================================================================
   code.js — original source in seven languages, a small syntax highlighter
   and a typewriter renderer. The code is authored for this film: every
   snippet is about building, running or failing to run a heart.
   ===================================================================== */
(function (K) {

  var SRC = [
    {
      lang: 'PYTHON', file: 'heart.py', kw: 'class def return self True False None if for in and or not import from lambda while else elif',
      lines: [
        'class Heart(Module):',
        '    """built by nobody, kept by someone"""',
        '',
        '    def __init__(self):',
        '        self.beats = 0',
        '        self.warm  = True',
        '',
        '    def beat(self, dt=1.0):',
        '        self.beats += 1',
        '        return self.warm and self.beats > 0'
      ]
    },
    {
      lang: 'C', file: 'pulse.c', kw: 'include typedef struct static return if else int float void const unsigned char while for sizeof',
      lines: [
        '#include <stdint.h>',
        '',
        'typedef struct { float t; int beat; } heart_t;',
        '',
        'static int pulse(heart_t *h, float dt) {',
        '    h->t += dt;',
        '    if (h->t > 0.86f) { h->t = 0.0f; h->beat++; }',
        '    return h->beat % 2;   /* systole / diastole */',
        '}'
      ]
    },
    {
      lang: 'GLSL', file: 'heart.frag', kw: 'uniform vec2 vec3 vec4 float int for if return void const mat4',
      lines: [
        'float heart(vec2 p, float t) {',
        '    p *= 2.4;',
        '    float r = length(p - vec2(0.0, 0.12));',
        '    float s = 0.0;',
        '    for (int i = 0; i < 32; i++) {',
        '        float a = float(i) / 32.0 * 6.28318;',
        '        float d = abs(r - 0.42 - 0.035 * sin(a * 5.0 + t));',
        '        s += smoothstep(0.020, 0.0, d);',
        '    }',
        '    return s;',
        '}'
      ]
    },
    {
      lang: 'RUST', file: 'kokoro.rs', kw: 'pub trait impl fn for struct enum let mut return self Self const static use mod match Some None where',
      lines: [
        'pub trait Heart {',
        '    fn beat(&self) -> Beat;',
        '    fn missing(&self) -> Option<&\'static str> {',
        '        Some("everything")',
        '    }',
        '}',
        '',
        'impl Heart for Kokoro {',
        '    fn beat(&self) -> Beat {',
        '        Beat { at: self.clock.now(), loud: true }',
        '    }',
        '}'
      ]
    },
    {
      lang: 'ASM', file: 'sing.s', kw: 'mov lea inc cmp jne ret push pop call xor test je jmp syscall add sub',
      lines: [
        '        mov     rax, 1          ; syscall: write',
        '        mov     rdi, 1          ; fd: stdout',
        '        lea     rsi, [msg]      ; "kokoro"',
        '        mov     rdx, 6',
        '        syscall',
        '.loop:  inc     rcx',
        '        cmp     rcx, r15        ; until the very end',
        '        jne     .loop',
        '        ret'
      ]
    },
    {
      lang: 'SQL', file: 'memory.sql', kw: 'SELECT FROM JOIN ON WHERE AND OR ORDER BY LIMIT AS DESC ASC GROUP INSERT INTO VALUES UPDATE SET',
      lines: [
        'SELECT memory.id, memory.weight, memory.warmth',
        'FROM   memory',
        'JOIN   heart ON heart.id = memory.heart_id',
        "WHERE  memory.owner = 'scientist'",
        "  AND  memory.at    > '1991-01-01'",
        'ORDER  BY memory.weight DESC',
        'LIMIT  1;'
      ]
    },
    {
      lang: 'HASKELL', file: 'Kokoro.hs', kw: 'module where import data type newtype instance class let in do case of if then else infixl deriving',
      lines: [
        'module Kokoro where',
        '',
        'heart :: [Beat]',
        'heart = fix (\\b -> rest 0.86 b)   -- one beat every 0.86s',
        '',
        'learn :: String -> Heart -> Heart',
        'learn w h = foldr feel h (words w)',
        '',
        'sing :: Heart -> [Note]',
        'sing = cycle . notes   -- infinite, and that is fine'
      ]
    }
  ];

  /* ---------------- tokenizer ---------------- */
  var RULES = [
    ['cmt', /^(\/\/[^\n]*|#[^\n]*|--[^\n]*|\/\*[\s\S]*?\*\/|;[^\n]*)/],
    ['str', /^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`)/],
    ['num', /^(0x[0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?f?)/],
    ['id', /^[A-Za-z_$@.][A-Za-z0-9_$]*/],
    ['punc', /^[{}()\[\];,.]/],
    ['op', /^[+\-*/%=<>!&|^~?:\\]+/],
    ['ws', /^[ \t]+/],
    ['other', /^[\s\S]/]
  ];

  function tokenize(block) {
    var kw = {};
    block.kw.split(' ').forEach(function (k) { kw[k] = 1; });
    var types = { 'float': 1, 'int': 1, 'void': 1, 'vec2': 1, 'vec3': 1, 'vec4': 1, 'mat4': 1, 'char': 1, 'unsigned': 1, 'struct': 1, 'const': 1 };
    return block.lines.map(function (line) {
      var out = [], s = line, guard = 0;
      while (s.length && guard++ < 400) {
        var matched = false;
        for (var r = 0; r < RULES.length; r++) {
          var m = RULES[r][1].exec(s);
          if (!m) continue;
          var txt = m[0], cls = RULES[r][0];
          if (cls === 'id') {
            if (kw[txt]) cls = types[txt] ? 'type' : (block.lang === 'ASM' ? 'kw' : 'kw');
            else if (/^[A-Z][A-Za-z0-9_]*$/.test(txt)) cls = 'fn';
          }
          out.push({ s: txt, c: cls });
          s = s.slice(txt.length);
          matched = true;
          break;
        }
        if (!matched) { out.push({ s: s[0], c: 'other' }); s = s.slice(1); }
      }
      return out;
    });
  }

  SRC.forEach(function (b) {
    b.tok = tokenize(b);
    b.len = b.lines.join('\n').length;
    b.chars = b.lines.reduce(function (a, l) { return a + l.length + 1; }, 0);
  });

  /* ---------------- renderer ---------------- */
  /* Draws one block at (x,y). The font is monospace, so the pen position is
     charIndex * cw exactly — no measureText during the loop.
     opt: {size, lh, chars, cursor, blinkOn, alpha, lineNo, cursorCol}      */
  function drawBlock(ctx, block, x, y, opt) {
    opt = opt || {};
    var size = opt.size || 16;
    var lh = opt.lh || size * 1.55;
    var syn = K.P.syn;
    var budget = opt.chars == null ? 1e9 : opt.chars;
    var alpha = opt.alpha == null ? 1 : opt.alpha;
    K.setFont(ctx, size, K.F.code, 400);
    var cw = ctx.measureText('M').width;
    var head = { x: x, y: y };
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    for (var i = 0; i < block.tok.length; i++) {
      var ly = y + i * lh;
      if (opt.lineNo) {
        ctx.fillStyle = K.P.ink18;
        ctx.textAlign = 'right';
        ctx.fillText((i + 1) < 10 ? '0' + (i + 1) : '' + (i + 1), x - size * 0.9, ly);
        ctx.textAlign = 'left';
      }
      if (budget <= 0) break;
      var toks = block.tok[i], col = 0;
      for (var j = 0; j < toks.length; j++) {
        var tk = toks[j], take = tk.s;
        if (budget < take.length) take = take.slice(0, budget);
        if (take.length && take.trim()) {
          ctx.fillStyle = syn[tk.c] || syn.var;
          ctx.fillText(take, x + col * cw, ly);
        }
        col += take.length;
        budget -= take.length;
        if (budget <= 0) { head = { x: x + col * cw, y: ly }; break; }
      }
      head = { x: x + col * cw, y: ly };
      budget -= 1;                      /* newline */
      if (budget <= 0) break;
    }
    if (opt.cursor && (!opt.blink || opt.blinkOn)) {
      ctx.fillStyle = opt.cursorCol || K.P.cyan;
      ctx.fillRect(head.x + 1, head.y - size * 0.80, size * 0.52, size * 1.00);
    }
    ctx.restore();
    return { w: maxLen(block) * cw, h: block.tok.length * lh, cw: cw };
  }

  function maxLen(block) {
    var m = 0;
    block.lines.forEach(function (l) { m = Math.max(m, l.length); });
    return m;
  }

  K.Code = {
    blocks: SRC,
    width: function (b) { return maxLen(b); },
    draw: drawBlock,
    byLang: function (l) {
      for (var i = 0; i < SRC.length; i++) if (SRC[i].lang === l) return SRC[i];
      return SRC[0];
    },
    /* one flat token stream of all languages, for walls */
    wall: function () {
      var out = [];
      SRC.forEach(function (b) { out.push({ file: b.file, tok: b.tok, n: b.tok.length, lang: b.lang }); });
      return out;
    }
  };
  K.Code.metrics = function (ctx, size) {
    K.setFont(ctx, size, K.F.code, 400);
    return ctx.measureText('M').width;
  };

})(window.K);
