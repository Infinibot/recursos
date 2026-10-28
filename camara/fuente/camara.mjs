// CAM-01 · cámara fotográfica ORIGINAL y sin marca, modelada con geometría procedimental (Three.js 0.170.0).
// Es un modelo CONCEPTUAL: las piezas y su despiece no representan la construcción interna de ninguna cámara real.
// Eje del objetivo = +Z (hacia el espectador). Unidades ≈ px. Lo usan el carrusel (escena3d.mjs) y el recurso interactivo.
import * as THREE from "three";

const TAU = Math.PI * 2;
export const NOMBRES = ["LENTE FRONTAL", "ANILLO EXTERIOR", "GRUPO ÓPTICO", "BARRIL DEL OBJETIVO", "MONTURA", "CUERPO", "SENSOR CONCEPTUAL", "PANTALLA TRASERA"];
export const N_PIEZAS = NOMBRES.length;

// z del origen de cada pieza: [montada, despiezada]
const Z = { lente: [196, 520], anillo: [188, 450], barril: [72, 120], montura: [60, 55], cuerpo: [0, -130], sensor: [-40, -10], pantalla: [-68, -240] };
const ZOPT = [[100, 290], [126, 345], [150, 395]];            // las tres lentes del grupo óptico
export const Z_MONTADO = { min: -75, max: 234, centro: 80 };
export const Z_DESPIEZADO = { min: -250, max: 558, centro: 154 };
// ventanas de la barra de separación (0–1) en las que se mueve cada pieza: el orden en el que se desmonta
const VENT = [[0, .30], [.05, .38], [.12, .52], [.22, .62], [.34, .74], [.40, .80], [.46, .88], [.56, 1]];
const suave = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * t * (t * (t * 6 - 15) + 10); };
export function pDesdeS(s) { return VENT.map(([a, b]) => suave((s - a) / (b - a))); }   // s en 0–1 → progreso de cada pieza

function lcg(seed) { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }

// ---------- texturas procedurales (deterministas) ----------
function texRuido(tam, semilla, grano, contraste) {
  const c = document.createElement("canvas"); c.width = c.height = tam;
  const g = c.getContext("2d"), r = lcg(semilla);
  g.fillStyle = "#808080"; g.fillRect(0, 0, tam, tam);
  for (let i = 0; i < tam * tam / grano; i++) {
    const v = 128 + (r() - .5) * contraste;
    g.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
    g.beginPath(); g.arc(r() * tam, r() * tam, 1 + r() * 1.6, 0, TAU); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 60, 1 / 60);
  return t;
}
function texPantalla() {
  const c = document.createElement("canvas"); c.width = 612; c.height = 352;
  const g = c.getContext("2d");
  const f = g.createLinearGradient(0, 0, 0, 352); f.addColorStop(0, "#0d2350"); f.addColorStop(.55, "#1c4fb8"); f.addColorStop(.56, "#0a1226"); f.addColorStop(1, "#05080f");
  g.fillStyle = f; g.fillRect(0, 0, 612, 352);
  g.strokeStyle = "rgba(244,247,251,.18)"; g.lineWidth = 1.5;
  for (const x of [204, 408]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 352); g.stroke(); }
  for (const y of [117, 235]) { g.beginPath(); g.moveTo(0, y); g.lineTo(612, y); g.stroke(); }
  g.strokeStyle = "#FF7A1A"; g.lineWidth = 4;
  const bx = 262, by = 120, bw = 88, bh = 88, l = 22;
  for (const [x, y, dx, dy] of [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]]) {
    g.beginPath(); g.moveTo(x, y + dy * l); g.lineTo(x, y); g.lineTo(x + dx * l, y); g.stroke();
  }
  g.fillStyle = "rgba(5,8,15,.7)"; g.fillRect(0, 0, 612, 40); g.fillRect(0, 312, 612, 40);
  g.fillStyle = "#F4F7FB"; g.font = "700 22px Arial, sans-serif"; g.textBaseline = "middle";
  g.fillText("CAM-01   ISO 200   1/250   F2.8", 20, 21);
  g.fillStyle = "#7fb0ff"; g.font = "700 18px Arial, sans-serif"; g.fillText("DEMO · MODELO 3D CONCEPTUAL", 20, 332);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function texEtiqueta(texto) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#101319"; g.fillRect(0, 0, 256, 64);
  g.strokeStyle = "#9aa3b2"; g.lineWidth = 3; g.strokeRect(3, 3, 250, 58);
  g.fillStyle = "#c9d1de"; g.font = "700 34px Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(texto, 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- entorno de estudio (lo que reflejan metales y cristales) ----------
export function crearEntorno(renderer) {
  const s = new THREE.Scene();
  const cupula = new THREE.SphereGeometry(60, 48, 24), col = [], p = cupula.attributes.position;
  const alto = new THREE.Color(0x1d3f8c), hor = new THREE.Color(0x010308), suelo = new THREE.Color(0x0b1f4d);
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / 60;
    const c = t > 0.02 ? hor.clone().lerp(alto, Math.pow(t, .7)) : t > -0.02 ? hor.clone() : hor.clone().lerp(suelo, Math.pow(-t, .9));
    col.push(c.r, c.g, c.b);
  }
  cupula.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(cupula, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const caja = (w, h, pos, color, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide, toneMapped: false }));
    m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m);
  };
  caja(110, 46, [0, 46, 8], 0xffffff, 9);                    // gran softbox superior
  caja(12, 80, [-46, 4, 10], 0x6fa6ff, 16);                  // tira alta azul, izquierda
  caja(10, 76, [47, 6, 2], 0xeaf2ff, 18);                    // tira alta blanca fría, derecha
  caja(8, 70, [-30, 2, -46], 0x2f7bff, 22);                  // contraluz azul eléctrico
  caja(8, 70, [32, 2, -45], 0xffffff, 16);                   // contraluz blanco
  caja(90, 7, [0, -24, 40], 0x4f8dff, 6);                    // relleno inferior
  caja(2.4, 60, [-24, 4, 46], 0xffffff, 26);                 // filos finos: dibujan el borde de los cilindros
  caja(2.4, 60, [26, 4, 46], 0xffffff, 22);
  caja(60, 3, [0, 22, 44], 0xffffff, 14);
  caja(120, 64, [-34, 22, 42], 0xdfeaff, 3.2);               // softbox frontal amplio: da degradados a cristales y caras planas
  caja(70, 40, [30, -4, 44], 0x7fb0ff, 2.2);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.01).texture;
  pm.dispose();
  return tex;
}

// ---------- geometrías ----------
function lathe(perfil, seg = 112) {                            // perfil [[radio, z], …] → sólido de revolución con eje Z
  const g = new THREE.LatheGeometry(perfil.map(([r, z]) => new THREE.Vector2(r, z)), seg);
  g.rotateX(Math.PI / 2); return g;
}
function engranaje(rInt, rExt, dientes, prof, largo, bisel = .8) {   // anillo estriado, eje Z, ocupa z = 0…largo
  const s = new THREE.Shape(), N = dientes * 6;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU, w = .5 + .5 * Math.cos(dientes * a);
    const k = Math.min(1, Math.max(0, (w - .2) / .6)), k2 = k * k * (3 - 2 * k);
    const r = rExt - prof * (1 - k2), x = Math.cos(a) * r, y = Math.sin(a) * r;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  s.closePath();
  if (rInt > 0) { const h = new THREE.Path(); h.absarc(0, 0, rInt, 0, TAU, true); s.holes.push(h); }
  return new THREE.ExtrudeGeometry(s, { depth: largo - 2 * bisel, bevelEnabled: true, bevelThickness: bisel, bevelSize: bisel * .8, bevelSegments: 2, curveSegments: 32 }).translate(0, 0, bisel);
}
function rr(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  return s;
}
function extr(forma, largo, bisel, segs = 5) {                // sólido biselado centrado en z = 0
  const g = new THREE.ExtrudeGeometry(forma, { depth: largo - 2 * bisel, bevelEnabled: true, bevelThickness: bisel, bevelSize: bisel, bevelSegments: segs, curveSegments: 40 });
  return g.translate(0, 0, -(largo - 2 * bisel) / 2);
}
function lente(R, t, sf, sr, nseg = 120) {                      // lente de vidrio: sagita frontal sf (negativa = cóncava) y trasera sr
  const pts = [], n = 18;
  for (let i = 0; i <= n; i++) { const r = R * i / n; pts.push([r, -t / 2 - sr * (1 - (r / R) ** 2)]); }
  for (let i = n; i >= 0; i--) { const r = R * i / n; pts.push([r, t / 2 + sf * (1 - (r / R) ** 2)]); }
  return lathe(pts, nseg);
}

// ---------- la cámara ----------
export function crearCamara() {
  const raiz = new THREE.Group();
  const M = {
    carcasa: new THREE.MeshPhysicalMaterial({ color: 0x15171c, roughness: .46, metalness: .5, bumpMap: texRuido(256, 11, 5, 150), bumpScale: 1.6, clearcoat: .3, clearcoatRoughness: .45, envMapIntensity: 1.15 }),
    goma: new THREE.MeshPhysicalMaterial({ color: 0x0b0c0f, roughness: .82, metalness: 0, bumpMap: texRuido(256, 29, 3, 200), bumpScale: 2.2, envMapIntensity: .55 }),
    metal: new THREE.MeshPhysicalMaterial({ color: 0xc3c8d1, roughness: .22, metalness: 1, anisotropy: .6, envMapIntensity: 1.3 }),
    grafito: new THREE.MeshPhysicalMaterial({ color: 0x2b2f38, roughness: .3, metalness: 1, envMapIntensity: 1.25 }),
    negro: new THREE.MeshPhysicalMaterial({ color: 0x07080b, roughness: .65, metalness: .15, envMapIntensity: .5, side: THREE.DoubleSide }),
    interior: new THREE.MeshStandardMaterial({ color: 0x030304, roughness: .95, metalness: 0, side: THREE.DoubleSide }),
    naranja: new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: .35, metalness: .2, emissive: 0xff5a00, emissiveIntensity: .45 }),
    vidrio: [0, 1, 2, 3].map((k) => new THREE.MeshPhysicalMaterial({
      color: [0x050b1a, 0x04120f, 0x0d0624, 0x03090f][k], roughness: .02, metalness: .3, ior: 2.1, clearcoat: 1, clearcoatRoughness: .01,
      iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [[180, 420], [260, 520], [340, 640], [220, 460]][k], envMapIntensity: 3.6 })),
  };
  const partes = [];
  const nueva = (id) => { const g = new THREE.Group(); g.name = NOMBRES[id]; g.userData.id = id; raiz.add(g); partes[id] = g; return g; };
  const malla = (g, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };

  // 0 · LENTE FRONTAL: casquillo de filtro + cúpula de cristal con tratamiento
  { const g = nueva(0);
    malla(g, lathe([[56, 0], [70, 0], [70, 18], [66.5, 24], [60, 24], [56, 22]]), M.negro);
    malla(g, lathe([[56, 18], [58.4, 18], [58.4, 24.2], [56, 24.2]]), M.metal);
    malla(g, lathe([[59.2, 24.3], [61.4, 24.3], [61.4, 24.9], [59.2, 24.9]]), M.naranja);
    const dom = []; for (let i = 0; i <= 24; i++) { const r = 57 * i / 24; dom.push([r, 6 + 22 * (1 - (r / 57) ** 2)]); }
    dom.push([57, 6]); dom.push([0, 6]);
    malla(g, lathe(dom), M.vidrio[0]);
    malla(g, lente(48, 10, -6, 4), M.vidrio[2], 0, 0, 2); }

  // 1 · ANILLO EXTERIOR: aro metálico estriado con filo pulido
  { const g = nueva(1);
    malla(g, engranaje(70, 88, 120, 1.5, 14, 1.6), M.metal);
    malla(g, lathe([[70, 2], [74.5, 2], [74.5, 12], [70, 12]]), M.interior);
    malla(g, lathe([[88.2, 5], [88.8, 5], [88.8, 9], [88.2, 9]]), M.naranja); }

  // 2 · GRUPO ÓPTICO: tres lentes sueltas, cada una con su montura
  { const g = nueva(2);
    const defs = [{ R: 50, t: 14, sf: 9, sr: 5, m: 1 }, { R: 44, t: 12, sf: -7, sr: 8, m: 3 }, { R: 38, t: 12, sf: 6, sr: 6, m: 2 }];
    defs.forEach((d, k) => {
      const e = new THREE.Group(); e.userData.k = k; g.add(e);
      malla(e, lente(d.R, d.t, d.sf, d.sr), M.vidrio[d.m]);
      malla(e, lathe([[d.R - .5, -d.t / 2 - 1], [d.R + 7, -d.t / 2 - 1], [d.R + 7, d.t / 2 + 1], [d.R - .5, d.t / 2 + 1]]), M.grafito);
      malla(e, lathe([[d.R + 7, -2], [d.R + 7.6, -2], [d.R + 7.6, 2], [d.R + 7, 2]]), M.metal);
    }); }

  // 3 · BARRIL DEL OBJETIVO: tubo con flocado interior, aro de enfoque de goma y bandas metálicas
  { const g = nueva(3);
    malla(g, lathe([[53, 0], [68, 0], [68, 122], [60, 122], [53, 122]], 96), M.negro);
    malla(g, engranaje(66, 79.5, 72, 3.2, 54, 1.2), M.goma, 0, 0, 30);
    malla(g, lathe([[68, 22], [71.5, 22], [71.5, 28], [68, 28]]), M.metal);
    malla(g, lathe([[68, 88], [71.5, 88], [71.5, 94], [68, 94]]), M.metal);
    malla(g, lathe([[68, 100], [69.4, 100], [69.4, 103], [68, 103]]), M.naranja);
    malla(g, lathe([[69, 110], [72, 110], [72, 122], [69, 122]]), M.grafito); }

  // 4 · MONTURA: anillo de bayoneta de acero con tres garras, tornillos y marca naranja
  { const g = nueva(4);
    malla(g, lathe([[58, 0], [82, 0], [82, 9], [79, 12], [58, 12]], 128), M.metal);
    for (let k = 0; k < 3; k++) {
      const s = new THREE.Shape(); const a0 = k * TAU / 3 + .3, a1 = a0 + .62;
      s.absarc(0, 0, 58.2, a0, a1, false); s.absarc(0, 0, 49, a1, a0, true);
      const m = malla(g, new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: false, curveSegments: 12 }), M.metal, 0, 0, 5);
    }
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; malla(g, lathe([[0, 12], [3.2, 12], [3.2, 13], [0, 13]], 20), M.negro, Math.cos(a) * 71, Math.sin(a) * 71, 0); }
    malla(g, lathe([[0, 12], [5, 12], [5, 13.4], [0, 13.4]], 24), M.naranja, 0, 72, 0); }

  // 5 · CUERPO: carcasa de goma y magnesio con visor, empuñadura, rueda de modos, disparador y correas
  { const g = nueva(5);
    const bs = 7, forma = rr(380 - 2 * bs, 236 - 2 * bs, 30), h = new THREE.Path(); h.absarc(0, 0, 77, 0, TAU, true); forma.holes.push(h);
    malla(g, extr(forma, 120, bs, 6), [M.carcasa, M.carcasa]);
    // empuñadura (a la izquierda, mirando de frente)
    malla(g, extr(rr(78 - 8, 222 - 8, 24), 30, 4, 4), M.goma, -150, 0, 66);
    // visor
    const sh = new THREE.Shape(); const pt = [[-56, 108], [-52, 140], [-40, 154], [30, 156], [48, 146], [52, 108]];
    pt.forEach(([z, y], i) => (i ? sh.lineTo(-z, y) : sh.moveTo(-z, y)));
    const gv = new THREE.ExtrudeGeometry(sh, { depth: 96, bevelEnabled: true, bevelThickness: 6, bevelSize: 6, bevelSegments: 5 }); gv.translate(0, 0, -48); gv.rotateY(Math.PI / 2);
    malla(g, gv, M.carcasa, -6, 0, 0);
    malla(g, new THREE.BoxGeometry(58, 3, 38), M.metal, -6, 164, -2);                       // zapata
    malla(g, new THREE.BoxGeometry(46, 1.6, 6), M.grafito, -6, 165.5, -2);
    // rueda de modos y disparador
    const rueda = engranaje(0, 31, 40, 2.2, 15, 1.2); rueda.rotateX(-Math.PI / 2);
    malla(g, rueda, M.grafito, 118, 118, 0);
    malla(g, lathe([[0, 0], [24, 0], [24, 2.4], [0, 2.4]], 64).rotateX(-Math.PI / 2), M.metal, 118, 134, 0);
    malla(g, lathe([[0, 0], [5, 0], [5, 1.2], [0, 1.2]], 20).rotateX(-Math.PI / 2), M.naranja, 118, 136.6, -14);
    const ring = engranaje(0, 20, 30, 1.6, 8, .8); ring.rotateX(-Math.PI / 2);
    malla(g, ring, M.goma, -152, 118, 20);
    malla(g, lathe([[0, 0], [11, 0], [11, 6], [8, 9], [0, 9]], 40).rotateX(-Math.PI / 2), M.metal, -152, 126, 20);
    malla(g, lathe([[11.2, 6.6], [13, 6.6], [13, 8], [11.2, 8]], 40).rotateX(-Math.PI / 2), M.naranja, -152, 126, 20);
    // anillas de correa y detalles frontales
    for (const x of [-196, 196]) malla(g, new THREE.CylinderGeometry(6, 6, 14, 24).rotateZ(Math.PI / 2), M.metal, x, 96, -34);
    malla(g, new THREE.SphereGeometry(7, 24, 16), M.naranja, -104, 90, 62);
    const et = new THREE.Mesh(new THREE.PlaneGeometry(56, 14), new THREE.MeshStandardMaterial({ map: texEtiqueta("CAM-01"), roughness: .5, metalness: .4 }));
    et.position.set(120, -92, 60.8); g.add(et); }

  // 6 · SENSOR CONCEPTUAL: placa con cristal de tratamiento (representación esquemática)
  { const g = nueva(6);
    malla(g, extr(rr(104 - 4, 76 - 4, 6), 6, 2, 3), M.grafito);
    malla(g, new THREE.BoxGeometry(92, 62, 2.4), M.vidrio[1], 0, 0, 4);
    malla(g, new THREE.BoxGeometry(94, 1.2, 2.8), M.metal, 0, 31.8, 4);
    malla(g, new THREE.BoxGeometry(94, 1.2, 2.8), M.metal, 0, -31.8, 4);
    malla(g, new THREE.BoxGeometry(1.2, 64.8, 2.8), M.metal, -46.8, 0, 4);
    malla(g, new THREE.BoxGeometry(1.2, 64.8, 2.8), M.metal, 46.8, 0, 4);
    malla(g, new THREE.CylinderGeometry(2.6, 2.6, 1.2, 16).rotateX(Math.PI / 2), M.naranja, -44, 33, 3.5); }

  // 7 · PANTALLA TRASERA: marco articulado (bisagra a la izquierda) con panel de imagen en la cara trasera; al despiezar se abre hacia fuera
  { const g = nueva(7), q = new THREE.Group(); q.position.x = 176; g.add(q);
    malla(q, extr(rr(340 - 4, 210 - 4, 22), 14, 2, 3), M.carcasa);
    const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(306, 176), new THREE.MeshStandardMaterial({
      map: texPantalla(), emissive: 0xffffff, emissiveMap: texPantalla(), emissiveIntensity: .85, roughness: .08, metalness: 0 }));
    pantalla.rotation.y = Math.PI; pantalla.position.z = -7.2; q.add(pantalla);
    malla(q, new THREE.CylinderGeometry(7, 7, 118, 28), M.metal, -176, 0, 3);
    for (const y of [-52, 52]) malla(q, new THREE.CylinderGeometry(9, 9, 12, 28), M.grafito, -176, y, 3);
    g.position.x = -176; }

  // eje de movimiento común (hilo fino azul que aparece al desmontar)
  const eje = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, 1, 8).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4f8dff, transparent: true, opacity: 0, toneMapped: false }));
  raiz.add(eje);

  const lerp = (a, b, t) => a + (b - a) * t;
  function mover(p) {
    partes[0].position.z = lerp(Z.lente[0], Z.lente[1], p[0]);
    partes[1].position.z = lerp(Z.anillo[0], Z.anillo[1], p[1]);
    partes[3].position.z = lerp(Z.barril[0], Z.barril[1], p[3]);
    partes[4].position.z = lerp(Z.montura[0], Z.montura[1], p[4]);
    partes[5].position.z = lerp(Z.cuerpo[0], Z.cuerpo[1], p[5]);
    partes[6].position.z = lerp(Z.sensor[0], Z.sensor[1], p[6]);
    partes[7].position.z = lerp(Z.pantalla[0], Z.pantalla[1], p[7]);
    partes[7].rotation.y = 1.9 * p[7];
    partes[2].children.forEach((e) => { e.position.z = lerp(ZOPT[e.userData.k][0], ZOPT[e.userData.k][1], p[2]); });
    const u = Math.max(...p);
    const z0 = lerp(Z.pantalla[0], Z.pantalla[1], p[7]) - 20, z1 = lerp(Z.lente[0], Z.lente[1], p[0]) + 40;
    eje.scale.z = Math.max(1, z1 - z0); eje.position.z = (z0 + z1) / 2;
    eje.material.opacity = Math.min(1, u * 3) * .55;
    eje.visible = u > 0.01;
  }
  mover([0, 0, 0, 0, 0, 0, 0, 0]);

  // resaltado de una pieza (recurso interactivo): material clonado con brillo azul
  const guardado = new Map();
  function resaltar(id) {
    partes.forEach((g, i) => g.traverse((o) => {
      if (!o.isMesh) return;
      if (!guardado.has(o)) guardado.set(o, { orig: o.material, luz: null });
      const r = guardado.get(o);
      if (i === id) {
        if (!r.luz) { const clon = (m) => { const c = m.clone(); if (c.emissive) { c.emissive = new THREE.Color(0x2f7bff); c.emissiveIntensity = .55; } return c; }; r.luz = Array.isArray(r.orig) ? r.orig.map(clon) : clon(r.orig); }
        o.material = r.luz;
      } else o.material = r.orig;
    }));
  }
  return { raiz, partes, mover, resaltar, M };
}
