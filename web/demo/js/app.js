/* ÉTER 01 · landing de demostración (marca y producto ficticios).
 * Todo lo que se ve en pantalla es función del scroll y del tiempo:
 *   - en vivo:   un bucle lee window.pageYOffset y el reloj.
 *   - captura:   window.EterPage.setState(y, t) fija ese estado de forma determinista (así se graba el vídeo fotograma a fotograma).
 * Sin módulos ES ni CDN: se abre con doble clic (file://). */
(function () {
  'use strict';
  var THREE = window.THREE;
  var qs = function (s, r) { return (r || document).querySelector(s); };
  var qsa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var clamp01 = function (v) { return clamp(v, 0, 1); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var smooth = function (t) { t = clamp01(t); return t * t * (3 - 2 * t); };
  var easeOut = function (t) { t = clamp01(t); return 1 - Math.pow(1 - t, 3); };

  var params = new URLSearchParams(location.search);
  var capture = params.has('capture');
  var canvas = qs('#stage');
  var VW = window.innerWidth, VH = window.innerHeight;
  var startTime = performance.now();

  var FOV = 30, CAM_D = 7.4;
  var renderer, scene, camera, hp, body, shadow;
  var parts = {}, anchors = {};

  /* ---------- entorno de estudio (lo que reflejan los metales y la piel) ---------- */
  function buildEnvironment() {
    var s = new THREE.Scene();
    var dome = new THREE.SphereGeometry(60, 48, 24), col = [], p = dome.attributes.position;
    var top = new THREE.Color(0x232731), mid = new THREE.Color(0x0b0c10), low = new THREE.Color(0x16181e);
    for (var i = 0; i < p.count; i++) {
      var t = p.getY(i) / 60;
      var c = t > 0 ? mid.clone().lerp(top, Math.pow(t, 1.3)) : mid.clone().lerp(low, Math.pow(-t, 1.1));
      col.push(c.r, c.g, c.b);
    }
    dome.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    s.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    var box = function (w, h, pos, color, k) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide, toneMapped: false }));
      m.position.set(pos[0], pos[1], pos[2]); m.lookAt(0, 0, 0); s.add(m);
    };
    box(120, 22, [0, 42, 14], 0xffffff, 7);          // tira superior
    box(14, 66, [-44, 4, 12], 0xffeedb, 8);          // columna cálida a la izquierda
    box(12, 56, [44, 8, -4], 0xbfd8ff, 7);           // columna fría a la derecha
    box(100, 5, [0, -15, 38], 0xffffff, 3.2);        // tira baja frontal
    box(44, 28, [0, 14, -48], 0xffffff, 3.6);        // caja trasera suave
    box(3, 54, [-30, 6, 44], 0xffffff, 12);          // filos finos
    box(3, 54, [31, -2, 42], 0xe4efff, 11);
    box(70, 3, [0, 8, 46], 0xffffff, 8);             // línea de horizonte
    var pm = new THREE.PMREMGenerator(renderer);
    var tex = pm.fromScene(s, 0.015).texture;
    pm.dispose();
    return tex;
  }

  /* ---------- producto: auriculares de estudio modelados con primitivas ---------- */
  function stadium(w, h, r, path) {
    var s = path || new THREE.Shape(), x = -w / 2, y = -h / 2;
    r = Math.min(r, Math.min(w, h) / 2 - 0.0008);
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  }

  function plateTexture(rot) {
    var c = document.createElement('canvas'); c.width = c.height = 512;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(256, 256, 20, 256, 256, 256);
    grad.addColorStop(0, '#3b3e46'); grad.addColorStop(1, '#25272d');
    g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1;
    for (var r = 6; r < 256; r += 5) { g.beginPath(); g.arc(256, 256, r, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = '#d8bd94'; g.font = '800 190px "Bricolage Grotesque", Inter, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('É', 256, 276);
    var tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace;
    tex.center.set(0.5, 0.5); tex.rotation = rot;
    return tex;
  }

  function buildProduct() {
    var metal = new THREE.MeshStandardMaterial({ color: 0xcbbfaa, metalness: 1, roughness: 0.3, envMapIntensity: 1.1 });   // titanio cálido anodizado
    var graphite = new THREE.MeshStandardMaterial({ color: 0x30333a, metalness: 1, roughness: 0.36, envMapIntensity: 1.0 });
    var leather = new THREE.MeshPhysicalMaterial({ color: 0x0e0f12, roughness: 0.56, metalness: 0, clearcoat: 0.18, clearcoatRoughness: 0.55,
      sheen: 0.7, sheenColor: new THREE.Color(0x7a7f8c), sheenRoughness: 0.55, envMapIntensity: 1.0 });
    var fabric = new THREE.MeshStandardMaterial({ color: 0x1a1b20, roughness: 0.95, metalness: 0 });
    var plateMats = { '1': new THREE.MeshStandardMaterial({ map: plateTexture(Math.PI / 2), metalness: 0.9, roughness: 0.42, envMapIntensity: 0.9 }),
                      '-1': new THREE.MeshStandardMaterial({ map: plateTexture(-Math.PI / 2), metalness: 0.9, roughness: 0.42, envMapIntensity: 0.9 }) };

    hp = new THREE.Group();
    body = new THREE.Group(); body.position.y = -0.8; hp.add(body);

    var CUPX = 1.28, A = 1.12, BAND_Y = 1.62, BAND_B = 0.62;
    var make = function (name, mesh) { var g = new THREE.Group(); g.add(mesh); parts[name] = { g: g, base: g.position.clone() }; body.add(g); return g; };

    // arco + almohadilla del arco
    var bandPts = [];
    for (var i = 0; i <= 64; i++) { var th = (i / 64) * Math.PI; bandPts.push(new THREE.Vector3(A * Math.cos(th), BAND_Y + BAND_B * Math.sin(th), 0)); }
    var band = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bandPts), 160, 0.052, 20, false), metal);
    var padPts = [];
    for (var j = 0; j <= 40; j++) { var t2 = Math.PI * (0.22 + 0.56 * j / 40); padPts.push(new THREE.Vector3((A - 0.1) * Math.cos(t2), BAND_Y + (BAND_B - 0.1) * Math.sin(t2) - 0.02, 0)); }
    var pad = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(padPts), 100, 0.092, 24, false), leather);
    var bandG = make('band', band); bandG.add(pad);
    var aBand = new THREE.Object3D(); aBand.position.set(0.18, BAND_Y + BAND_B + 0.03, 0); bandG.add(aBand); anchors.band = aBand;

    // brazos (horquillas) + bisagras
    [-1, 1].forEach(function (sd) {
      var pts = [new THREE.Vector3(sd * CUPX, 0.6, 0), new THREE.Vector3(sd * CUPX, 0.98, 0), new THREE.Vector3(sd * (CUPX - 0.08), 1.36, 0), new THREE.Vector3(sd * A, BAND_Y + 0.02, 0)];
      var yoke = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.056, 20, false), metal);
      var hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.32, 32), graphite);
      hinge.rotation.x = Math.PI / 2; hinge.position.set(sd * CUPX, 0.62, 0);
      var g = make(sd < 0 ? 'yokeL' : 'yokeR', yoke); g.add(hinge);
      if (sd > 0) { var ay = new THREE.Object3D(); ay.position.set(CUPX - 0.05, 1.18, 0); g.add(ay); anchors.yoke = ay; }
    });

    // chasis de cada auricular, almohadilla, tela del altavoz y tapa
    var cupGeo = new THREE.ExtrudeGeometry(stadium(0.8, 1.14, 0.4), { depth: 0.2, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.14, bevelSegments: 12, curveSegments: 48 });
    cupGeo.center(); cupGeo.rotateY(Math.PI / 2);
    var cushShape = stadium(0.76, 1.1, 0.38); stadium(0.62, 0.96, 0.31, (function () { var p = new THREE.Path(); cushShape.holes.push(p); return p; })());
    var cushGeo = new THREE.ExtrudeGeometry(cushShape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.13, bevelSize: 0.13, bevelSegments: 14, curveSegments: 48 });
    cushGeo.center(); cushGeo.rotateY(Math.PI / 2);
    var fabGeo = new THREE.ShapeGeometry(stadium(0.5, 0.84, 0.25), 32);
    var capGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.045, 96);       // tapa sólida: cara con el logo + canto de grafito
    var rimGeo = new THREE.TorusGeometry(0.405, 0.014, 16, 120);

    [-1, 1].forEach(function (sd) {
      var tag = sd < 0 ? 'L' : 'R';
      var cup = new THREE.Mesh(cupGeo, metal); cup.position.x = sd * CUPX;
      var cupG = make('cup' + tag, cup);
      var cush = new THREE.Mesh(cushGeo, leather); cush.position.x = sd * (CUPX - 0.64);
      var cushG = make('cush' + tag, cush);
      var fab = new THREE.Mesh(fabGeo, fabric); fab.rotation.y = -sd * Math.PI / 2; fab.position.x = sd * (CUPX - 0.935);
      var fabG = make('fab' + tag, fab);
      var cap = new THREE.Mesh(capGeo, [graphite, plateMats[String(sd)], graphite]); cap.rotation.z = -sd * Math.PI / 2; cap.rotation.x = sd * Math.PI / 2; cap.position.x = sd * (CUPX + 0.317);
      var rim = new THREE.Mesh(rimGeo, metal); rim.rotation.y = sd * Math.PI / 2; rim.position.x = sd * (CUPX + 0.315);
      var plateG = make('plate' + tag, cap); plateG.add(rim);
      if (sd < 0) {
        var a1 = new THREE.Object3D(); a1.position.set(-(CUPX - 0.64), -0.66, 0.3); cushG.add(a1); anchors.cush = a1;
        var a2 = new THREE.Object3D(); a2.position.set(-(CUPX + 0.32), 0.25, 0.12); plateG.add(a2); anchors.plate = a2;
        var a3 = new THREE.Object3D(); a3.position.set(-CUPX, -0.55, 0.52); cupG.add(a3); anchors.cup = a3;
      }
    });
    scene.add(hp);

    // sombra de contacto: mancha suave bajo el producto (se ve sobre fondo claro)
    var c = document.createElement('canvas'); c.width = 256; c.height = 128;
    var g = c.getContext('2d'), rg = g.createRadialGradient(128, 64, 4, 128, 64, 124);
    rg.addColorStop(0, 'rgba(10,10,12,0.55)'); rg.addColorStop(0.55, 'rgba(10,10,12,0.2)'); rg.addColorStop(1, 'rgba(10,10,12,0)');
    g.save(); g.scale(1, 0.5); g.translate(0, 64); g.fillStyle = rg; g.fillRect(0, -64, 256, 256); g.restore();
    shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0 }));
    scene.add(shadow);
  }

  /* ---------- poses del producto según el scroll ---------- */
  var POSE = {
    hero:   { fx: 0.19, fy: -0.015, s: 0.86, ry: -0.55, rx: 0.10, e: 0, sh: 0 },
    story:  { fx: 0.25, fy: 0.00, s: 0.92, ry: -1.45, rx: 0.06, e: 0, sh: 0.38 },
    partsA: { fx: 0.07, fy: -0.02, s: 0.72, ry: -0.50, rx: 0.14, e: 0, sh: 0.34 },
    partsX: { fx: 0.07, fy: -0.07, s: 0.64, ry: -0.92, rx: 0.20, e: 1, sh: 0.2 },
    partsB: { fx: 0.07, fy: -0.02, s: 0.72, ry: -1.25, rx: 0.14, e: 0, sh: 0.34 },
    why:    { fx: -0.21, fy: 0.02, s: 0.68, ry: 0.55, rx: 0.08, e: 0, sh: 0.34 },
    end:    { fx: 0.00, fy: 0.2, s: 0.56, ry: -0.35, rx: 0.10, e: 0, sh: 0 }
  };
  var A_ = {}, keys = [];
  function measure() {
    A_ = { story: qs('#story').offsetTop, parts: qs('#parts').offsetTop, why: qs('#why').offsetTop, end: qs('#end').offsetTop, doc: document.documentElement.scrollHeight };
    var vh = VH, sp = A_.why - vh - A_.parts;
    A_.spanP = sp;
    keys = [
      [0, POSE.hero], [A_.story - 0.9 * vh, POSE.hero], [A_.story - 0.05 * vh, POSE.story],
      [A_.parts - 1.1 * vh, POSE.story], [A_.parts, POSE.partsA], [A_.parts + 0.1 * sp, POSE.partsA],
      [A_.parts + 0.5 * sp, POSE.partsX], [A_.parts + 0.72 * sp, POSE.partsX], [A_.parts + 0.97 * sp, POSE.partsB],
      [A_.why - 0.1 * vh, POSE.why], [A_.end - 1.0 * vh, POSE.why], [A_.end - 0.15 * vh, POSE.end], [A_.doc, POSE.end]
    ];
  }
  function poseAt(y) {
    var k = keys, i = 0;
    if (y <= k[0][0]) return k[0][1];
    for (i = 0; i < k.length - 1; i++) {
      if (y < k[i + 1][0]) {
        var a = k[i][1], b = k[i + 1][1], u = (y - k[i][0]) / Math.max(1, k[i + 1][0] - k[i][0]);
        if (a === b) return a;
        u = smooth(u);
        var out = {}; for (var key in a) out[key] = lerp(a[key], b[key], u);
        return out;
      }
    }
    return k[k.length - 1][1];
  }

  /* ---------- estado → escena y DOM ---------- */
  var reveals = [], intros = [], coEls = [], drag = { ry: 0, rx: 0 }, navEl = qs('.nav');
  var tmp = new THREE.Vector3();
  function applyPose(P, t, opt) {
    var aspect = VW / VH, portrait = aspect < 0.85;
    var visH = 2 * CAM_D * Math.tan(FOV / 2 * Math.PI / 180), visW = visH * aspect;
    var fx = P.fx, fy = P.fy, s = P.s;
    if (portrait) {
      if (Math.abs(fx) > 0.1) { fy = (fy < 0 && fx > 0) ? -0.1 : fy + 0.27; fx = 0; }       // héroe: producto abajo; resto: arriba, con el texto debajo
      s = s * Math.min(1, (visW * 0.9) / 3.1) * (P.sh > 0 ? 0.92 : 1);
    }
    var introT = clamp01(t / 1.4), appear = easeOut(introT);
    var idle = Math.sin(t * 0.55) * 0.07, bob = Math.sin(t * 0.9) * 0.03;
    var ry = P.ry + idle + (opt.ry != null ? opt.ry : drag.ry), rx = P.rx + (opt.rx != null ? opt.rx : drag.rx);
    hp.position.set(fx * visW, fy * visH + bob, 0);
    hp.rotation.set(rx, ry, 0, 'YXZ');
    hp.scale.setScalar(s * lerp(0.94, 1, appear));
    hp.visible = true;
    var ee = smooth(P.e);
    var off = function (name, x, y, z) { var p = parts[name]; p.g.position.set(p.base.x + x, p.base.y + y, p.base.z + z); };
    off('band', 0, 0.8 * ee, 0);
    off('yokeL', -0.28 * ee, 0.36 * ee, 0); off('yokeR', 0.28 * ee, 0.36 * ee, 0);
    off('cupL', 0, 0, 0); off('cupR', 0, 0, 0);
    off('plateL', -1.05 * ee, 0, 0); off('plateR', 1.05 * ee, 0, 0);
    off('fabL', 0.36 * ee, 0, 0); off('fabR', -0.36 * ee, 0, 0);
    off('cushL', 0.78 * ee, 0, 0); off('cushR', -0.78 * ee, 0, 0);
    shadow.position.set(hp.position.x, hp.position.y - 1.58 * s, -0.5);
    shadow.scale.set(3.9 * s, 1.0 * s, 1);
    shadow.material.opacity = P.sh * appear * (1 - 0.35 * ee);
    return ee;
  }

  function updateReveals(t, y) {
    intros.forEach(function (el) {
      var r = easeOut((t - parseFloat(el.getAttribute('data-intro'))) / 0.9);
      el.style.setProperty('--r', r.toFixed(4));
    });
    reveals.forEach(function (el) {
      var d = parseFloat(el.getAttribute('data-d') || '0');
      var isSpan = el.parentElement && el.parentElement.classList.contains('line');
      var ref = isSpan ? el.parentElement : el;
      var top = ref.getBoundingClientRect().top;
      if (!isSpan) top -= (1 - (el._r == null ? 1 : el._r)) * 26;           // la posición sin el desplazamiento del propio revelado
      // en el cierre (últimos píxeles de la página) el revelado va por scroll de sección para que llegue a completarse siempre
      var base = el._end ? clamp01((y - (A_.end - VH)) / (VH * 0.5)) : clamp01((VH * 0.93 - top) / (VH * 0.3));
      var r = easeOut(clamp01((base - d * 0.55) / (1 - d * 0.55)));
      el._r = r; el.style.setProperty('--r', r.toFixed(4));
    });
  }

  function updateLabels(ee) {
    var vis = smooth((ee - 0.55) / 0.3);
    coEls.forEach(function (el) {
      var a = anchors[el.getAttribute('data-co')];
      tmp.setFromMatrixPosition(a.matrixWorld).project(camera);
      var x = (tmp.x * 0.5 + 0.5) * VW, y = (-tmp.y * 0.5 + 0.5) * VH;
      el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      el.style.setProperty('--co', vis.toFixed(3));
    });
  }

  function update(y, t, opt) {
    opt = opt || {};
    if (y == null) y = window.pageYOffset;
    var P = poseAt(y);
    var ee = applyPose(P, t, opt);
    updateReveals(t, y);
    // la barra cambia de color según la sección que tiene debajo (claro sobre fondo oscuro y al revés)
    var onPaper = (y + 40) >= A_.story && (y + 40) < A_.end;
    navEl.style.setProperty('--navfg', onPaper ? '#0b0c0f' : '#f1ede5');
    navEl.style.setProperty('--navbg', onPaper ? 'rgba(239,234,225,.92)' : 'rgba(11,12,15,.9)');
    scene.updateMatrixWorld(true);
    updateLabels(ee);
    renderer.render(scene, camera);
  }

  function resize() {
    VW = window.innerWidth; VH = window.innerHeight;
    renderer.setPixelRatio(capture ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(VW, VH, false);
    camera.aspect = VW / VH; camera.updateProjectionMatrix();
    measure();
  }

  /* ---------- arranque ---------- */
  var readyResolve, ready = new Promise(function (r) { readyResolve = r; });
  function init() {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    scene = new THREE.Scene();
    scene.environment = buildEnvironment();
    camera = new THREE.PerspectiveCamera(FOV, VW / VH, 0.1, 60);
    camera.position.set(0, 0.2, CAM_D); camera.lookAt(0, 0, 0);
    buildProduct();
    reveals = qsa('[data-r]'); intros = qsa('[data-intro]'); coEls = qsa('.co');
    reveals.forEach(function (el) { el._end = !!el.closest('#end'); });
    resize();
    window.addEventListener('resize', function () { resize(); });
    update(window.pageYOffset, capture ? 0 : 0);
    readyResolve();
    if (!capture) {
      // interacción: arrastra para girar el producto (vuelve suavemente a su pose)
      var down = false, lx = 0, ly = 0;
      window.addEventListener('pointerdown', function (e) { if (e.target.closest('a,button')) return; down = true; lx = e.clientX; ly = e.clientY; });
      window.addEventListener('pointermove', function (e) { if (!down) return; drag.ry += (e.clientX - lx) * 0.008; drag.rx = clamp(drag.rx + (e.clientY - ly) * 0.004, -0.5, 0.5); lx = e.clientX; ly = e.clientY; });
      window.addEventListener('pointerup', function () { down = false; });
      var loop = function () {
        if (!down) { drag.ry *= 0.95; drag.rx *= 0.95; }
        if (!window.EterPage._captured) update(window.pageYOffset, (performance.now() - startTime) / 1000);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  }

  /* API de captura determinista (la usa HyperFrames para grabar la web real) */
  window.EterPage = {
    _captured: false,
    ready: ready,
    setState: function (y, t, opt) {
      this._captured = true;
      window.scrollTo(0, y);
      update(y, t, opt);
    },
    info: function () { return { vw: VW, vh: VH, anchors: A_, scrollMax: document.documentElement.scrollHeight - VH }; }
  };

  var fontsReady = (document.fonts && document.fonts.load)
    ? Promise.all([document.fonts.load('800 20px "Bricolage Grotesque"'), document.fonts.load('500 14px "Inter"')]).then(function () { return document.fonts.ready; })
    : Promise.resolve();
  fontsReady.then(init);
})();
