/* BLIP · mini juego de plataformas de un solo botón. HTML canvas, sin dependencias.
 *
 * Es determinista: paso fijo de 1/60 s y una semilla para las partículas. Eso permite grabar partidas de demostración
 * (un bot juega con el mismo código que usa una persona) y reproducirlas fotograma a fotograma.
 *
 * Controles: ESPACIO / ↑ / W / clic / toque = saltar (mantén pulsado para saltar más alto). Después de ganar o perder,
 * la misma tecla (o el botón) reinicia.
 */
(function (root) {
  'use strict';

  var DT = 1 / 60;
  var VH = 675;                       // alto lógico fijo de la pantalla (el ancho lógico se adapta, mínimo 540)
  var GY = 540;                       // y del suelo
  var SPEED = 224, GRAV = 2150, JUMP_V = 730, CUT_V = 250, COY = 5, BUF = 6;
  var PW = 28, PH = 40;               // caja de colisión del jugador
  var LEVEL_LEN = 4500, GOAL_X = 4260;
  var C = { deep: '#07101F', navy: '#0E1C36', blue: '#2F7BFF', white: '#F4F7FB', orange: '#FF7A1A' };

  /* ------------------------------------------------------------------ nivel */
  var OBS = [
    ['block', 620], ['spikes', 960, 72], ['tall', 1300], ['block', 1620], ['block', 1710], ['spikes', 1980, 104],
    ['tall', 2320], ['stairs', 2640], ['spikes', 3020, 72], ['block', 3200], ['tall', 3520], ['spikes', 3720, 72],
    ['block', 4000], ['block', 4090]
  ];
  var CHECKPOINTS = [0, 1480, 2880, 3900];
  var solids = [], spikes = [], coins = [];

  (function build() {
    function block(x, w, h, k) { solids.push({ x: x, y: GY - h, w: w, h: h, k: k || 'block' }); }
    function arc(cx, span, baseH, n, peak) {
      for (var i = 0; i < n; i++) {
        var u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
        coins.push({ x: Math.round(cx + u * span), y: Math.round(GY - baseH - 26 - peak * (1 - u * u)) });
      }
    }
    function line(x, n, y) { for (var i = 0; i < n; i++) coins.push({ x: x + i * 34, y: y }); }
    line(380, 3, GY - 30);
    OBS.forEach(function (o) {
      var t = o[0], x = o[1];
      if (t === 'block') { block(x, 56, 48); arc(x + 28, 78, 48, 5, 46); }
      else if (t === 'tall') { block(x, 52, 92, 'tall'); arc(x + 26, 78, 92, 5, 30); }
      else if (t === 'spikes') { spikes.push({ x: x, y: GY - 22, w: o[2], h: 22 }); arc(x + o[2] / 2, o[2] / 2 + 46, 22, 5, 56); }
      else if (t === 'stairs') { block(x, 64, 44); block(x + 64, 60, 88, 'tall'); arc(x + 62, 92, 60, 6, 40); }
    });
    line(2160, 3, GY - 30); line(3340, 3, GY - 30); line(3840, 2, GY - 30);
  })();
  var NCOINS = coins.length;

  /* ----------------------------------------------------------------- física */
  function newPlayer(x) {
    return { x: x, y: GY - PH, vy: 0, gr: true, coy: COY, buf: 0, sy: 1, vs: 0, ph: 0, face: 1 };
  }

  // Un paso de física del jugador. Devuelve 0 (nada) o 1 (golpe). La usan el juego y el bot (para mirar hacia delante).
  function phys(p, pressed, held, fx) {
    if (pressed) p.buf = BUF; else if (p.buf > 0) p.buf--;
    if (p.gr) p.coy = COY; else if (p.coy > 0) p.coy--;
    var jumped = false;
    if (p.buf > 0 && p.coy > 0) { p.vy = -JUMP_V; p.gr = false; p.coy = 0; p.buf = 0; jumped = true; }
    if (!held && p.vy < -CUT_V) p.vy = -CUT_V;
    p.vy += GRAV * DT; if (p.vy > 1100) p.vy = 1100;
    p.x += SPEED * DT;
    var prevBottom = p.y + PH, wasGr = p.gr;
    p.y += p.vy * DT;
    p.gr = false;
    var landed = false;
    if (p.y + PH >= GY) { p.y = GY - PH; p.vy = 0; p.gr = true; }
    for (var i = 0; i < solids.length; i++) {
      var b = solids[i];
      if (b.x > p.x + PW + 4 || b.x + b.w < p.x - 4) continue;
      if (p.x + PW > b.x && p.x < b.x + b.w && p.y + PH > b.y && p.y < b.y + b.h) {
        if (prevBottom <= b.y + 8 && p.vy >= 0) { p.y = b.y - PH; p.vy = 0; p.gr = true; }
        else return 1;
      }
    }
    for (var j = 0; j < spikes.length; j++) {
      var s = spikes[j];
      if (p.x + PW - 5 > s.x + 7 && p.x + 5 < s.x + s.w - 7 && p.y + PH > s.y + 7) return 1;
    }
    if (fx) { fx.jumped = jumped; fx.landed = p.gr && !wasGr; }
    return 0;
  }

  /* ----------------------------------------------------------------- estado */
  function rnd(G) {                                   // mulberry32 (solo para partículas)
    G.rs = (G.rs + 0x6D2B79F5) | 0;
    var t = Math.imul(G.rs ^ (G.rs >>> 15), 1 | G.rs);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function create(seed, opts) {
    var G = { seed: seed >>> 0, ev: [] };
    reset(G, opts && opts.autostart === false ? 'ready' : 'play', 0);
    return G;
  }

  function reset(G, mode, restarts) {
    G.rs = G.seed; G.t = 0; G.mode = mode; G.p = newPlayer(60); G.lives = 3; G.score = 0; G.coins = 0;
    G.got = new Uint8Array(NCOINS); G.cam = 0; G.parts = []; G.cp = 0; G.timer = 0; G.inv = 0; G.shake = 0;
    G.bonus = 0; G.restarts = restarts || 0; G.cpFlash = 0; G.trail = [];
    G.cam = Math.max(0, G.p.x - 150);
  }

  function ev(G, k, extra) { if (G.ev.length < 400) G.ev.push({ t: G.t, k: k, x: extra }); }

  function spawn(G, o) { if (G.parts.length < 160) G.parts.push(o); }
  function dust(G, x, y, n, up) {
    for (var i = 0; i < n; i++) spawn(G, { k: 'dust', x: x + (rnd(G) - 0.5) * 14, y: y, vx: (rnd(G) - 0.5) * 90 - 30, vy: -(rnd(G) * 50 + (up || 20)), l: 0, m: 0.42 + rnd(G) * 0.2, r: 3 + rnd(G) * 3 });
  }

  function step(G, inp) {
    inp = inp | 0;
    var pressed = !!(inp & 1), held = !!(inp & 2), click = !!(inp & 4);
    G.t++;
    var p = G.p;

    if (G.mode === 'ready') {
      if (pressed || click) G.mode = 'play';
      cam(G); parts(G); return G;
    }

    if (G.mode === 'play') {
      var fx = { jumped: false, landed: false };
      var hit = phys(p, pressed || (click && false), held, fx);
      if (G.inv > 0) { G.inv -= DT; hit = 0; }
      if (fx.jumped) G.trail.length = 0;
      if (!p.gr) { if (G.trail.length >= 80) G.trail.shift(); G.trail.push({ x: p.x + PW / 2, y: p.y + PH / 2 }); }
      if (fx.jumped) { dust(G, p.x + PW / 2, p.y + PH, 5, 10); p.sy = 1.3; p.vs = 0; ev(G, 'jump', Math.round(p.x)); }
      if (fx.landed) { dust(G, p.x + PW / 2, p.y + PH, 7, 14); p.sy = 0.7; p.vs = 0; ev(G, 'land'); }
      if (p.gr) p.ph += SPEED * DT * 0.075;
      // monedas
      for (var i = 0; i < NCOINS; i++) {
        if (G.got[i]) continue;
        var c = coins[i];
        if (c.x < p.x - 30) continue;
        if (c.x > p.x + 60) break;
        var dx = Math.max(p.x, Math.min(c.x, p.x + PW)) - c.x, dy = Math.max(p.y, Math.min(c.y, p.y + PH)) - c.y;
        if (dx * dx + dy * dy < 17 * 17) {
          G.got[i] = 1; G.coins++; G.score += 10; ev(G, 'coin', i);
          spawn(G, { k: 'ring', x: c.x, y: c.y, l: 0, m: 0.38, r: 10 });
          spawn(G, { k: 'txt', x: c.x, y: c.y - 10, vy: -42, l: 0, m: 0.7, s: '+10' });
          for (var q = 0; q < 5; q++) spawn(G, { k: 'chip', x: c.x, y: c.y, vx: (rnd(G) - 0.5) * 190, vy: -(rnd(G) * 130 + 20), l: 0, m: 0.4, c: 0 });
        }
      }
      // puntos de control
      for (var k = 1; k < CHECKPOINTS.length; k++) if (p.x >= CHECKPOINTS[k] && G.cp < k) { G.cp = k; G.cpFlash = 0.8; ev(G, 'checkpoint', k); }
      if (G.cpFlash > 0) G.cpFlash -= DT;
      if (hit) {
        G.mode = 'dead'; G.timer = 0; G.shake = 0.35; ev(G, 'hit', Math.round(p.x));
        for (var h = 0; h < 14; h++) spawn(G, { k: 'chip', x: p.x + PW / 2, y: p.y + PH / 2, vx: (rnd(G) - 0.5) * 420, vy: -(rnd(G) * 320 + 40), l: 0, m: 0.6, c: h % 3 === 0 ? 1 : 2 });
      } else if (p.x + PW >= GOAL_X + 18) {
        G.mode = 'clear'; G.timer = 0; ev(G, 'clear');
      }
    } else if (G.mode === 'dead') {
      G.timer += DT; G.shake = Math.max(0, G.shake - DT);
      if (G.timer >= 0.8) {
        G.lives--;
        if (G.lives <= 0) { G.mode = 'over'; G.timer = 0; ev(G, 'over'); }
        else {
          var rx = CHECKPOINTS[G.cp];
          G.p = newPlayer(rx); G.mode = 'play'; G.inv = 1.4; G.cam = Math.max(0, rx - 150); ev(G, 'respawn', rx);
        }
      }
    } else if (G.mode === 'clear') {
      G.timer += DT;
      p.x += SPEED * DT; p.y = GY - PH; p.gr = true; p.ph += SPEED * DT * 0.075;
      if (G.timer >= 0.9) {
        G.mode = 'win'; G.timer = 0; G.bonus = G.lives * 50; G.score += G.bonus; ev(G, 'win');
        for (var w = 0; w < 18; w++) spawn(G, { k: 'chip', x: GOAL_X + 40, y: GY - 80, vx: (rnd(G) - 0.5) * 340, vy: -(rnd(G) * 300 + 80), l: 0, m: 0.9, c: w % 2 });
      }
    } else if (G.mode === 'win' || G.mode === 'over') {
      G.timer += DT;
      if ((pressed || click) && G.timer > 0.7) { var r = G.restarts + 1; reset(G, 'play', r); ev(G, 'restart'); return G; }
    }

    // muelle de aplastado/estirado del jugador
    p.vs += ((1 - p.sy) * 420 - p.vs * 15) * DT; p.sy += p.vs * DT;
    cam(G); parts(G);
    return G;
  }

  function cam(G) {
    var target = Math.max(0, Math.min(LEVEL_LEN + 100, G.p.x - 150));
    G.cam += (target - G.cam) * (1 - Math.exp(-10 * DT));
  }

  function parts(G) {
    var a = G.parts, j = 0;
    for (var i = 0; i < a.length; i++) {
      var q = a[i]; q.l += DT;
      if (q.l >= q.m) continue;
      if (q.k === 'dust') { q.x += q.vx * DT; q.y += q.vy * DT; q.vy += 40 * DT; }
      else if (q.k === 'chip') { q.x += q.vx * DT; q.y += q.vy * DT; q.vy += 900 * DT; }
      else if (q.k === 'txt') { q.y += q.vy * DT; }
      a[j++] = q;
    }
    a.length = j;
  }

  /* --------------------------------------------------------------------- bot */
  // Mira hacia delante con la MISMA física: salta en el último instante en que todavía es seguro.
  var ALL = solids.concat(spikes).sort(function (a, b) { return a.x - b.x; });

  // x a partir de la cual el obstáculo (o grupo de obstáculos pegados) que tiene delante ya está superado
  var firstAheadX = 0;
  function clusterTarget(x) {
    var i = 0;
    while (i < ALL.length && ALL[i].x + ALL[i].w <= x) i++;
    if (i >= ALL.length) return -1;
    firstAheadX = ALL[i].x;
    var end = ALL[i].x + ALL[i].w;
    while (i + 1 < ALL.length && ALL[i + 1].x - end < 150) { i++; end = ALL[i].x + ALL[i].w; }
    return end + 14;
  }

  function simulate(p0, jumpAt, target) {
    var p = { x: p0.x, y: p0.y, vy: p0.vy, gr: p0.gr, coy: p0.coy, buf: p0.buf };
    for (var i = 0; i < 200; i++) {
      var pr = i === jumpAt, hd = jumpAt >= 0 && i >= jumpAt && i < jumpAt + 26;
      if (phys(p, pr, hd, null)) return false;
      if (p.x > target && p.gr) return true;
    }
    return true;
  }

  function bot(G) {
    var p = G.p;
    if (G.mode === 'win' || G.mode === 'over') return G.timer > 1.2 ? 4 : 0;
    if (G.mode !== 'play') return 0;
    if (G.holdLeft > 0) { G.holdLeft--; return 2; }
    if (!p.gr && p.coy <= 0) return 0;
    var target = clusterTarget(p.x);
    if (target < 0 || simulate(p, -1, target)) return 0;
    if (firstAheadX - (p.x + PW) > 190) return 0;       // el obstáculo aún queda lejos
    var s0 = simulate(p, 0, target), s1 = simulate(p, 1, target);
    if (s0 && !s1) { G.holdLeft = 25; return 3; }       // el último instante en que todavía es seguro saltar
    if (s1) return 0;                                    // hay margen: se espera
    for (var k = 2; k <= 70; k++) if (simulate(p, k, target)) return 0;
    G.holdLeft = 25; return 3;                           // sin salida: salta igualmente
  }

  // Graba una partida completa del bot (con reinicio al final) y devuelve las entradas paso a paso.
  // readySteps (opcional): la partida empieza en la pantalla de inicio real y "se pulsa" en ese paso, como haría una persona.
  function recordDemo(seed, extraAfterRestart, readySteps) {
    var ready = readySteps != null && readySteps >= 0;
    var G = create(seed || 7, { autostart: !ready }), inputs = [], won = -1, restartedAt = -1;
    G.holdLeft = 0;
    for (var n = 0; n < 4000; n++) {
      var inp = ready && n < readySteps ? 0 : ready && n === readySteps ? 3 : bot(G);
      inputs.push(inp);
      step(G, inp);
      if (G.mode === 'win' && won < 0) won = n;
      if (G.restarts > 0 && restartedAt < 0) restartedAt = n;
      if (restartedAt >= 0 && n >= restartedAt + (extraAfterRestart || 240)) break;
    }
    return { seed: seed || 7, ready: ready, inputs: Uint8Array.from(inputs), steps: inputs.length, winStep: won, restartStep: restartedAt, events: G.ev.slice(), final: { score: G.score, coins: G.coins, lives: G.lives, mode: G.mode } };
  }

  // Reproduce una partida grabada: stateAt(n) devuelve el estado tras n pasos (retrocede reiniciando).
  function playback(demo) {
    var G = create(demo.seed, { autostart: !demo.ready }), n = 0;
    return {
      stateAt: function (target) {
        target = Math.max(0, Math.min(Math.round(target), demo.steps));
        if (target < n) { G = create(demo.seed, { autostart: !demo.ready }); n = 0; }
        while (n < target) { step(G, demo.inputs[n]); n++; }
        return G;
      },
      inputAt: function (i) { return demo.inputs[Math.max(0, Math.min(i, demo.steps - 1))] | 0; },
      get step() { return n; }
    };
  }

  /* ----------------------------------------------------------------- dibujo */
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
  var FONT_D = "800 {s}px 'Bricolage Grotesque','Segoe UI',system-ui,sans-serif";
  var FONT_B = "800 {s}px Inter,'Segoe UI',system-ui,sans-serif";
  function font(f, s) { return f.replace('{s}', s); }
  function text(ctx, s, x, y, f, col, align, ls) {
    ctx.font = f; ctx.fillStyle = col; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = (ls || 0) + 'px';
    ctx.fillText(s, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  function hillY(u, a, b, c) { return Math.sin(u * a) * b + Math.sin(u * a * 2.3 + 1.7) * c; }

  function layer(ctx, G, camX, vw, factor, base, a, b, c, col) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(camX - 30, GY + 40);
    for (var sx = -30; sx <= vw + 30; sx += 10) ctx.lineTo(camX + sx, base + hillY(camX * factor + sx, a, b, c));
    ctx.lineTo(camX + vw + 30, GY + 40); ctx.closePath(); ctx.fill();
  }

  function hsh(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  // Skyline lejano con ventanas iluminadas (paralaje muy lento)
  function skyline(ctx, camX, vw, factor, base) {
    var col = 64, u0 = camX * factor;
    var first = Math.floor((u0 - 80) / col), last = Math.ceil((u0 + vw + 80) / col);
    for (var i = first; i <= last; i++) {
      var bw = 36 + hsh(i + 7) * 24, bh = 80 + hsh(i) * 130, bx = i * col - u0 + camX + (col - bw) / 2, by = base - bh;
      var g = ctx.createLinearGradient(0, by, 0, base); g.addColorStop(0, '#0D2A5E'); g.addColorStop(1, '#0A1F49');
      ctx.fillStyle = g; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = 'rgba(120,170,255,.22)'; ctx.fillRect(bx, by, bw, 2);
      for (var wy = by + 10, ry = 0; wy < base - 12; wy += 13, ry++) {
        for (var wx = bx + 6, rx = 0; wx < bx + bw - 8; wx += 10, rx++) {
          var r = hsh(i * 53 + ry * 7 + rx * 13);
          if (r > 0.74) { ctx.fillStyle = r > 0.95 ? 'rgba(255,122,26,.75)' : 'rgba(110,165,255,.55)'; ctx.fillRect(wx, wy, 4, 6); }
        }
      }
    }
  }

  function floorUnder(x) {
    var y = GY;
    for (var i = 0; i < solids.length; i++) if (x >= solids[i].x && x <= solids[i].x + solids[i].w) y = Math.min(y, solids[i].y);
    return y;
  }

  function drawPlayer(ctx, G, tt, o) {
    var p = G.p, cx = p.x + PW / 2, by = p.y + PH;
    if (G.mode === 'dead') return;
    var blink = G.inv > 0 && Math.floor(G.t / 4) % 2 === 0;
    if (blink) ctx.globalAlpha = 0.45;
    if (G.mode === 'clear') ctx.globalAlpha = Math.max(0, 1 - G.timer / 0.9);
    // sombra
    var fy = floorUnder(cx), hgt = Math.max(0, fy - by);
    ctx.save(); ctx.globalAlpha *= Math.max(0.15, 0.5 - hgt / 260);
    ctx.fillStyle = '#02060f'; ctx.beginPath(); ctx.ellipse(cx, fy + 1, 20 - Math.min(10, hgt / 14), 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    var sy = Math.max(0.6, Math.min(1.4, p.sy)), sx = 1 / sy;
    ctx.save(); ctx.translate(cx, by); ctx.scale(sx, sy);
    var run = p.gr ? Math.sin(p.ph * Math.PI * 2) : 0;
    // pies
    ctx.fillStyle = '#0B1A36';
    var f1 = p.gr ? run * 6 : 3, f2 = p.gr ? -run * 6 : -3;
    rr(ctx, -13 + f1, -7, 11, 8, 3); ctx.fill(); rr(ctx, 2 + f2, -7, 11, 8, 3); ctx.fill();
    // cuerpo
    var g = ctx.createLinearGradient(0, -42, 0, -6); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#CFDDF5');
    ctx.fillStyle = g; rr(ctx, -17, -42, 34, 36, 11); ctx.fill();
    // visor
    ctx.fillStyle = '#0B1A36'; rr(ctx, -6, -35, 22, 15, 7); ctx.fill();
    ctx.fillStyle = C.blue; ctx.shadowColor = C.blue; ctx.shadowBlur = 8;
    var lk = (G.mode === 'dead') ? 0 : 1;
    ctx.beginPath(); ctx.arc(2, -27, 2.8 * lk, 0, 7); ctx.arc(10, -27, 2.8 * lk, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    // antena
    var wob = Math.sin(tt * 9) * 2 - (p.gr ? 0 : p.vy * 0.004);
    ctx.strokeStyle = '#9fb3d9'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2, -42); ctx.lineTo(-5 + wob, -52); ctx.stroke();
    ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(-5 + wob, -54, 3.6, 0, 7); ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1;
  }

  function drawWorld(ctx, G, o, tt) {
    var vw = o.vw, camX = o.camX, zoom = o.zoom;
    var visW = vw / zoom;
    // cielo (en coordenadas de mundo, grande para cubrir zoom/desplazamiento)
    var top = o.camY - 40, bot = o.camY + VH / zoom + 40;
    var sky = ctx.createLinearGradient(0, 0, 0, GY);
    sky.addColorStop(0, '#060D1C'); sky.addColorStop(0.55, '#0B1D42'); sky.addColorStop(1, '#14397A');
    ctx.fillStyle = sky; ctx.fillRect(camX - 40, Math.min(top, 0) - 400, visW + 80, GY - Math.min(top, 0) + 400 + 60);
    // resplandor del horizonte y luna
    var gl = ctx.createRadialGradient(camX + visW * 0.72, GY - 40, 10, camX + visW * 0.72, GY - 40, 320);
    gl.addColorStop(0, 'rgba(47,123,255,.42)'); gl.addColorStop(1, 'rgba(47,123,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(camX - 40, GY - 400, visW + 80, 440);
    var mx = camX + visW * 0.72 - G.cam * 0.02 + camX * 0.0, my = 205;
    ctx.fillStyle = 'rgba(120,170,255,.16)'; ctx.beginPath(); ctx.arc(mx, my, 78, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(190,215,255,.26)'; ctx.beginPath(); ctx.arc(mx, my, 54, 0, 7); ctx.fill();
    // skyline y colinas con paralaje
    skyline(ctx, camX, visW, 0.07, GY - 40);
    layer(ctx, G, camX, visW, 0.10, GY - 150, 0.0042, 46, 20, '#0C2A5E');
    layer(ctx, G, camX, visW, 0.28, GY - 95, 0.0062, 38, 16, '#0E2F6B');
    layer(ctx, G, camX, visW, 0.55, GY - 46, 0.0095, 26, 12, '#10265A');
    // suelo
    var gx0 = camX - 40, gw = visW + 80;
    var gg = ctx.createLinearGradient(0, GY, 0, GY + 140); gg.addColorStop(0, '#12274D'); gg.addColorStop(1, '#0A1530');
    ctx.fillStyle = gg; ctx.fillRect(gx0, GY, gw, 400);
    ctx.fillStyle = 'rgba(244,247,251,.05)';
    for (var gxx = Math.floor(gx0 / 64) * 64; gxx < gx0 + gw; gxx += 64) ctx.fillRect(gxx, GY + 8, 2, 400);
    ctx.fillRect(gx0, GY + 34, gw, 2);
    ctx.fillStyle = C.blue; ctx.shadowColor = C.blue; ctx.shadowBlur = 14; ctx.fillRect(gx0, GY - 2, gw, 6); ctx.shadowBlur = 0;
    ctx.fillStyle = '#8DB8FF'; ctx.fillRect(gx0, GY - 2, gw, 2);
    // puntos de control
    for (var k = 1; k < CHECKPOINTS.length; k++) {
      var cxp = CHECKPOINTS[k] + 40, on = G.cp >= k;
      if (cxp < camX - 30 || cxp > camX + visW + 30) continue;
      ctx.fillStyle = '#9fb3d9'; ctx.fillRect(cxp, GY - 74, 3, 74);
      ctx.fillStyle = on ? C.orange : '#2B4272'; ctx.beginPath(); ctx.moveTo(cxp + 3, GY - 74); ctx.lineTo(cxp + 30, GY - 63); ctx.lineTo(cxp + 3, GY - 52); ctx.closePath(); ctx.fill();
    }
    // portal de meta
    drawGoal(ctx, G, camX, visW, tt);
    // bloques
    for (var i = 0; i < solids.length; i++) {
      var b = solids[i];
      if (b.x > camX + visW + 20 || b.x + b.w < camX - 20) continue;
      var bg = ctx.createLinearGradient(0, b.y, 0, b.y + b.h); bg.addColorStop(0, '#1C417F'); bg.addColorStop(1, '#122B58');
      ctx.fillStyle = bg; rr(ctx, b.x, b.y, b.w, b.h, 8); ctx.fill();
      ctx.strokeStyle = C.blue; ctx.lineWidth = 2; rr(ctx, b.x + 1, b.y + 1, b.w - 2, b.h - 2, 8); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.18)'; rr(ctx, b.x + 6, b.y + 5, b.w - 12, 3, 1.5); ctx.fill();
      ctx.fillStyle = C.orange; rr(ctx, b.x + b.w / 2 - 9, b.y + b.h - 14, 18, 5, 2.5); ctx.fill();
      if (b.k === 'tall') { ctx.fillStyle = 'rgba(7,16,31,.5)'; rr(ctx, b.x + b.w / 2 - 7, b.y + 22, 14, 22, 5); ctx.fill(); }
    }
    // pinchos
    for (var j = 0; j < spikes.length; j++) {
      var s = spikes[j];
      if (s.x > camX + visW + 20 || s.x + s.w < camX - 20) continue;
      var n = Math.max(2, Math.round(s.w / 24)), w = s.w / n;
      ctx.fillStyle = '#0B1A36'; ctx.fillRect(s.x, GY - 4, s.w, 4);
      for (var t = 0; t < n; t++) {
        var gr = ctx.createLinearGradient(0, s.y, 0, GY); gr.addColorStop(0, '#FFB36B'); gr.addColorStop(1, C.orange);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(s.x + t * w + 1, GY - 3); ctx.lineTo(s.x + t * w + w / 2, s.y); ctx.lineTo(s.x + (t + 1) * w - 1, GY - 3); ctx.closePath(); ctx.fill();
      }
    }
    // monedas
    for (var c = 0; c < NCOINS; c++) {
      if (G.got[c]) continue;
      var co = coins[c];
      if (co.x > camX + visW + 20 || co.x < camX - 20) continue;
      var ph = Math.abs(Math.cos(tt * 3.6 + c * 0.55)), cw = 4 + 8 * ph;
      var bob = Math.sin(tt * 3 + c * 0.7) * 2;
      ctx.save(); ctx.translate(co.x, co.y + bob);
      ctx.shadowColor = 'rgba(255,122,26,.7)'; ctx.shadowBlur = 10;
      ctx.fillStyle = C.orange; ctx.beginPath(); ctx.ellipse(0, 0, cw, 11, 0, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#FFC48A'; ctx.beginPath(); ctx.ellipse(-cw * 0.25, -3, Math.max(1, cw * 0.35), 5, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
    drawPlayer(ctx, G, tt, o);
    if (o.debug > 0) drawDebug(ctx, G, o);
    // partículas
    for (var q = 0; q < G.parts.length; q++) {
      var a = G.parts[q], f = a.l / a.m;
      if (a.k === 'dust') { ctx.fillStyle = 'rgba(200,220,255,' + (0.5 * (1 - f)).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r * (1 - f * 0.4), 0, 7); ctx.fill(); }
      else if (a.k === 'ring') { ctx.strokeStyle = 'rgba(255,170,90,' + (1 - f).toFixed(3) + ')'; ctx.lineWidth = 3 * (1 - f); ctx.beginPath(); ctx.arc(a.x, a.y, a.r + f * 22, 0, 7); ctx.stroke(); }
      else if (a.k === 'chip') { ctx.fillStyle = a.c === 1 ? 'rgba(255,122,26,' + (1 - f).toFixed(3) + ')' : a.c === 2 ? 'rgba(244,247,251,' + (1 - f).toFixed(3) + ')' : 'rgba(255,196,138,' + (1 - f).toFixed(3) + ')'; ctx.fillRect(a.x - 2.5, a.y - 2.5, 5, 5); }
      else if (a.k === 'txt') { text(ctx, a.s, a.x, a.y, font(FONT_B, 17), 'rgba(255,170,90,' + (1 - f * f).toFixed(3) + ')', 'center'); }
    }
  }

  // Vista de colisiones: las cajas de impacto y la trayectoria que usa la física del propio juego (no es un adorno).
  function drawDebug(ctx, G, o) {
    var z = o.zoom, p = G.p, x0 = o.camX - 20, x1 = o.camX + o.vw / z + 20;
    ctx.save(); ctx.globalAlpha = Math.min(1, o.debug); ctx.lineWidth = 1.7 / z;
    if (G.trail.length > 1) {
      ctx.setLineDash([5 / z, 7 / z]); ctx.strokeStyle = 'rgba(244,247,251,.9)'; ctx.beginPath();
      for (var i = 0; i < G.trail.length; i++) { if (i === 0) ctx.moveTo(G.trail[i].x, G.trail[i].y); else ctx.lineTo(G.trail[i].x, G.trail[i].y); }
      ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.strokeStyle = 'rgba(244,247,251,.85)'; ctx.fillStyle = 'rgba(244,247,251,.07)';
    for (var a = 0; a < solids.length; a++) { var b = solids[a]; if (b.x + b.w < x0 || b.x > x1) continue; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeRect(b.x, b.y, b.w, b.h); }
    ctx.strokeStyle = 'rgba(255,122,26,.95)'; ctx.fillStyle = 'rgba(255,122,26,.16)';
    for (var s = 0; s < spikes.length; s++) { var k = spikes[s]; if (k.x + k.w < x0 || k.x > x1) continue; ctx.fillRect(k.x + 7, k.y + 7, k.w - 14, k.h - 7); ctx.strokeRect(k.x + 7, k.y + 7, k.w - 14, k.h - 7); }
    ctx.strokeStyle = 'rgba(255,170,90,.7)';
    for (var c = 0; c < NCOINS; c++) { if (G.got[c]) continue; var co = coins[c]; if (co.x < x0 || co.x > x1) continue; ctx.beginPath(); ctx.arc(co.x, co.y, 17, 0, 7); ctx.stroke(); }
    ctx.strokeStyle = '#7FB0FF'; ctx.fillStyle = 'rgba(47,123,255,.22)';
    ctx.fillRect(p.x, p.y, PW, PH); ctx.strokeRect(p.x, p.y, PW, PH);
    ctx.restore();
  }

  function drawGoal(ctx, G, camX, visW, tt) {
    var gx = GOAL_X;
    if (gx > camX + visW + 60 || gx < camX - 140) return;
    var bw = 118, top = GY - 190;
    var beam = ctx.createLinearGradient(0, top, 0, GY); beam.addColorStop(0, 'rgba(47,123,255,0)'); beam.addColorStop(0.5, 'rgba(95,149,255,.30)'); beam.addColorStop(1, 'rgba(47,123,255,.55)');
    ctx.fillStyle = beam; ctx.fillRect(gx + 14, top, bw - 28, 190);
    ctx.fillStyle = 'rgba(190,215,255,.35)';
    for (var i = 0; i < 4; i++) { var yy = GY - ((tt * 70 + i * 48) % 190); ctx.fillRect(gx + 18, yy, bw - 36, 2); }
    ctx.fillStyle = '#16356F'; rr(ctx, gx, top, 16, 190, 6); ctx.fill(); rr(ctx, gx + bw - 16, top, 16, 190, 6); ctx.fill();
    ctx.fillStyle = C.blue; rr(ctx, gx - 6, top - 14, bw + 12, 24, 8); ctx.fill();
    text(ctx, 'META', gx + bw / 2, top + 4, font(FONT_B, 14), '#fff', 'center', 3);
    ctx.fillStyle = C.orange; ctx.fillRect(gx + 4, GY - 26, 8, 26); ctx.fillRect(gx + bw - 12, GY - 26, 8, 26);
  }

  function heart(ctx, x, y, s, fill) {
    ctx.beginPath(); ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x - s * 0.9, y - s * 0.4, x - s * 0.45, y - s * 0.95, x, y - s * 0.4);
    ctx.bezierCurveTo(x + s * 0.45, y - s * 0.95, x + s * 0.9, y - s * 0.4, x, y + s * 0.35);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }

  function pad(n, l) { var s = String(n); while (s.length < l) s = '0' + s; return s; }

  function drawHud(ctx, G, o) {
    var vw = o.vw, st = o.safeTop || 0, a = o.hud == null ? 1 : o.hud;
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    text(ctx, 'PUNTOS', 22, 30 + st, font(FONT_B, 12), 'rgba(183,196,222,.9)', 'left', 3);
    text(ctx, pad(G.score, 4), 20, 72 + st, font(FONT_D, 46), '#F4F7FB', 'left', 1);
    ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(31, 96 + st, 8, 0, 7); ctx.fill();
    text(ctx, '× ' + G.coins, 46, 102 + st, font(FONT_B, 17), '#F4F7FB', 'left');
    for (var i = 0; i < 3; i++) heart(ctx, vw - 30 - i * 30, 38 + st, 11, i < G.lives ? C.orange : 'rgba(244,247,251,.18)');
    if (o.demo) text(ctx, 'DEMO · PARTIDA AUTOMÁTICA', vw - 22, 70 + st, font(FONT_B, 9.5), 'rgba(183,196,222,.8)', 'right', 1.6);
    ctx.restore();
  }

  function button(ctx, x, y, w, h, label, hover) {
    ctx.save();
    if (hover) { ctx.shadowColor = 'rgba(47,123,255,.8)'; ctx.shadowBlur = 22; }
    ctx.fillStyle = hover ? '#5B9BFF' : C.blue; rr(ctx, x, y, w, h, h / 2); ctx.fill(); ctx.shadowBlur = 0;
    text(ctx, label, x + w / 2, y + h / 2 + 6, font(FONT_B, 17), '#fff', 'center', 2);
    ctx.restore();
  }

  function drawPanel(ctx, G, o) {
    var vw = o.vw, win = G.mode === 'win', over = G.mode === 'over';
    if (!win && !over) return;
    var k = Math.min(1, G.timer / 0.35), e = 1 - Math.pow(1 - k, 3);
    ctx.save(); ctx.fillStyle = 'rgba(7,16,31,' + (0.62 * e).toFixed(3) + ')'; ctx.fillRect(0, 0, vw, VH);
    var cw = 380, ch = 330, cx = (vw - cw) / 2, cy = (o.panelY || 150) + (1 - e) * 40;
    ctx.globalAlpha = e;
    var pg = ctx.createLinearGradient(0, cy, 0, cy + ch); pg.addColorStop(0, '#16315F'); pg.addColorStop(1, '#0E1C36');
    ctx.fillStyle = pg; rr(ctx, cx, cy, cw, ch, 28); ctx.fill();
    ctx.strokeStyle = C.blue; ctx.lineWidth = 2.5; rr(ctx, cx + 1, cy + 1, cw - 2, ch - 2, 28); ctx.stroke();
    text(ctx, win ? 'NIVEL' : 'FIN DE', vw / 2, cy + 72, font(FONT_D, 40), '#F4F7FB', 'center', 1);
    text(ctx, win ? 'SUPERADO' : 'PARTIDA', vw / 2, cy + 114, font(FONT_D, 40), win ? '#5B9BFF' : C.orange, 'center', 1);
    var rows = win ? [['MONEDAS', G.coins + ' / ' + NCOINS], ['VIDAS', '×' + G.lives + '  +' + G.bonus], ['PUNTOS', pad(G.score, 4)]] : [['MONEDAS', G.coins + ' / ' + NCOINS], ['PUNTOS', pad(G.score, 4)]];
    for (var i = 0; i < rows.length; i++) {
      var ry = cy + 156 + i * 32;
      text(ctx, rows[i][0], cx + 38, ry, font(FONT_B, 13), 'rgba(183,196,222,.95)', 'left', 3);
      text(ctx, rows[i][1], cx + cw - 38, ry, font(FONT_D, 24), '#F4F7FB', 'right');
    }
    button(ctx, cx + (cw - 250) / 2, cy + ch - 82, 250, 52, win ? 'JUGAR DE NUEVO' : 'REINTENTAR', !!o.hover);
    ctx.restore();
  }

  function drawReady(ctx, G, o, tt) {
    if (G.mode !== 'ready') return;
    var vw = o.vw;
    ctx.save(); ctx.fillStyle = 'rgba(7,16,31,.45)'; ctx.fillRect(0, 0, vw, VH);
    text(ctx, 'BLIP', vw / 2, 230, font(FONT_D, 96), '#F4F7FB', 'center', 4);
    text(ctx, 'ESPACIO, ↑ O TOQUE PARA SALTAR', vw / 2, 290, font(FONT_B, 14), '#B7C4DE', 'center', 3);
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(tt * 5);
    text(ctx, 'PULSA PARA EMPEZAR', vw / 2, 340, font(FONT_B, 17), C.orange, 'center', 4);
    ctx.restore();
  }

  /* draw(ctx, G, o): o = { scale, vw, zoom, fx, fy, hud, hover, demo, safeTop, tNow }
   *   scale = px de lienzo por unidad lógica · vw = ancho lógico visible (540 por defecto) · zoom 1 = cámara normal
   *   fx, fy = desplazamiento de la cámara (unidades lógicas, relativo al jugador) cuando zoom ≠ 1 */
  function draw(ctx, G, o) {
    o = o || {};
    var scale = o.scale || 2, vw = o.vw || 540, zoom = o.zoom || 1, tt = o.tNow != null ? o.tNow : G.t * DT;
    var camX = G.cam, camY = 0;
    var oo = { vw: vw, zoom: zoom, camX: camX, camY: camY, hud: o.hud, hover: o.hover, demo: o.demo, safeTop: o.safeTop, panelY: o.panelY, debug: o.debug };
    if (zoom !== 1) {
      var focusX = G.p.x + PW / 2 + (o.fx || 0), focusY = o.cy != null ? o.cy : G.p.y + PH / 2 + (o.fy || 0);
      camX = focusX - vw / (2 * zoom); camY = focusY - VH / (2 * zoom);
      oo.camX = camX; oo.camY = camY;
    }
    var sh = G.mode === 'dead' || G.shake > 0 ? G.shake : 0;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.deep; ctx.fillRect(0, 0, vw * scale, VH * scale);
    ctx.setTransform(scale * zoom, 0, 0, scale * zoom, (-camX + (sh ? Math.sin(G.t * 1.7) * sh * 14 : 0)) * scale * zoom, -camY * scale * zoom);
    drawWorld(ctx, G, oo, tt);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawHud(ctx, G, oo);
    drawPanel(ctx, G, oo);
    drawReady(ctx, G, oo, tt);
    ctx.restore();
  }

  var Blip = {
    DT: DT, VH: VH, GY: GY, SPEED: SPEED, PW: PW, PH: PH, LEVEL_LEN: LEVEL_LEN, GOAL_X: GOAL_X, NCOINS: NCOINS,
    OBS: OBS, solids: solids, spikes: spikes, coins: coins,
    create: create, step: step, draw: draw, bot: bot, recordDemo: recordDemo, playback: playback
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Blip;
  root.Blip = Blip;
})(typeof window !== 'undefined' ? window : globalThis);
