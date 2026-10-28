// Visor interactivo de CAM-01 (modelo 3D conceptual, original y sin marca). Usa el mismo modelo y la misma barra de separación que el carrusel.
import * as THREE from "three";
import { crearCamara, crearEntorno, pDesdeS, NOMBRES } from "./camara.mjs";

const DESC = [
  "Cristal convexo con tratamiento, dentro de su casquillo.",
  "Aro metálico estriado que remata el frente del objetivo.",
  "Tres lentes sueltas, cada una con su montura (simplificado).",
  "Tubo del objetivo con el aro de enfoque de goma.",
  "Anillo de bayoneta que une objetivo y cuerpo.",
  "Carcasa con visor, empuñadura, rueda de modos y disparador.",
  "Representación esquemática: no es un sensor real.",
  "Pantalla abatible con su bisagra."
];
const ESTADOS = [[0, "Cámara ensamblada"], [12, "Empieza a salir la lente frontal"], [25, "Lente frontal separada"], [50, "Objetivo parcialmente desmontado"], [75, "Componentes separados"], [95, "Despiece completo"]];

const $ = (id) => document.getElementById(id);
const lienzo = $("gl"), marco = $("escena");
const renderer = new THREE.WebGLRenderer({ canvas: lienzo, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.environment = crearEntorno(renderer);
const modelo = crearCamara();
scene.add(modelo.raiz);
const sol = new THREE.DirectionalLight(0xffffff, 1.2);
sol.position.set(-500, 900, 900); sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -900, right: 900, top: 900, bottom: -900, near: 100, far: 3200 });
sol.shadow.bias = -0.0005; sol.shadow.radius = 6;
const contra = new THREE.DirectionalLight(0x4f8dff, 1.4); contra.position.set(700, 300, -900);
scene.add(sol, contra);
const suelo = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: .55 }));
suelo.position.y = -140; suelo.receiveShadow = true; scene.add(suelo);
const cam = new THREE.PerspectiveCamera(26, 1, 10, 9000);

// estado
const INICIAL = { az: -34, el: 12 };
let s = 0, az = INICIAL.az * Math.PI / 180, el = INICIAL.el * Math.PI / 180, rotar = false, anim = null, demo = false, sel = -1, env = 0;

function ponerS(v) {
  s = Math.min(1, Math.max(0, v));
  $("sep").value = Math.round(s * 100);
  $("val").textContent = Math.round(s * 100);
  const n = Math.round(s * 100);
  let t = ESTADOS[0][1]; for (const [u, txt] of ESTADOS) if (n >= u) t = txt;
  $("estado").textContent = t;
}
function animar(hasta, dur, fin) {                                    // power2.inOut sobre s; reversible
  const desde = s, t0 = performance.now();
  anim = (ahora) => {
    const k = Math.min(1, (ahora - t0) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    ponerS(desde + (hasta - desde) * e);
    if (k >= 1) { anim = null; if (fin) fin(); }
  };
}
function parar() { anim = null; demo = false; $("demo").setAttribute("aria-pressed", "false"); $("demo").textContent = "Demo automática"; }

function seleccionar(id) {
  sel = id;
  modelo.resaltar(id < 0 ? null : id);
  $("nombre").textContent = id < 0 ? "Toca una pieza" : NOMBRES[id];
  $("desc").textContent = id < 0 ? "Toca el modelo o un nombre de la lista para destacarla." : DESC[id];
  document.querySelectorAll("#piezas button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.i === id)));
}

// controles
$("sep").addEventListener("input", (e) => { parar(); ponerS(e.target.value / 100); });
$("rotar").addEventListener("click", (e) => { rotar = !rotar; e.currentTarget.setAttribute("aria-pressed", String(rotar)); });
$("separar").addEventListener("click", () => { parar(); animar(s > .5 ? 0 : 1, 1800); });
$("reiniciar").addEventListener("click", () => {
  parar(); rotar = false; $("rotar").setAttribute("aria-pressed", "false");
  az = INICIAL.az * Math.PI / 180; el = INICIAL.el * Math.PI / 180; ponerS(0); seleccionar(-1);
});
$("demo").addEventListener("click", (e) => {
  if (demo) { parar(); return; }
  parar(); demo = true; e.currentTarget.setAttribute("aria-pressed", "true"); e.currentTarget.textContent = "Parar demo";
  const ciclo = () => { if (!demo) return; animar(1, 2600, () => { if (!demo) return; setTimeout(() => { if (!demo) return; animar(0, 2600, () => setTimeout(ciclo, 700)); }, 900); }); };
  ciclo();
});
const lista = $("piezas");
NOMBRES.forEach((n, i) => {
  const b = document.createElement("button"); b.type = "button"; b.dataset.i = i; b.textContent = n; b.setAttribute("aria-pressed", "false");
  b.addEventListener("click", () => seleccionar(sel === i ? -1 : i)); lista.appendChild(b);
});

// arrastrar para girar; un toque corto selecciona la pieza
const ray = new THREE.Raycaster(), pt = new THREE.Vector2();
let arrastre = null;
lienzo.addEventListener("pointerdown", (e) => { lienzo.setPointerCapture(e.pointerId); arrastre = { x: e.clientX, y: e.clientY, mov: 0 }; });
lienzo.addEventListener("pointermove", (e) => {
  if (!arrastre) return;
  const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
  arrastre.x = e.clientX; arrastre.y = e.clientY; arrastre.mov += Math.abs(dx) + Math.abs(dy);
  az -= dx * .006; el = Math.min(1.2, Math.max(-.2, el + dy * .004));
});
lienzo.addEventListener("pointerup", (e) => {
  if (arrastre && arrastre.mov < 6) {
    const r = lienzo.getBoundingClientRect();
    pt.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pt, cam);
    const h = ray.intersectObjects(modelo.raiz.children, true).find((x) => x.object.isMesh && x.object.visible);
    let o = h && h.object; while (o && o.userData.id === undefined) o = o.parent;
    seleccionar(o ? (o.userData.id === sel ? -1 : o.userData.id) : -1);
  }
  arrastre = null;
});
lienzo.addEventListener("pointercancel", () => { arrastre = null; });

function medir() {
  const w = marco.clientWidth, h = marco.clientHeight;
  renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
}
new ResizeObserver(medir).observe(marco); medir();

let antes = performance.now();
function bucle(ahora) {
  const dt = Math.min(.05, (ahora - antes) / 1000); antes = ahora;
  if (anim) anim(ahora);
  if (rotar && !arrastre) az += dt * .45;
  env += dt * .05;
  modelo.mover(pDesdeS(s));
  // encuadre: se aleja a medida que se separa, y se adapta a pantallas estrechas
  const ancho = 560 + (1000 - 560) * s, alto = 470, tz = 80 + 70 * s;
  const tanV = Math.tan(13 * Math.PI / 180);
  const dist = 1.12 * Math.max(alto / 2 / tanV, ancho / 2 / (tanV * cam.aspect));
  cam.position.set(dist * Math.sin(az) * Math.cos(el), dist * Math.sin(el), tz + dist * Math.cos(az) * Math.cos(el));
  cam.lookAt(0, 0, tz);
  scene.environmentRotation.set(0, env, 0);
  renderer.render(scene, cam);
  requestAnimationFrame(bucle);
}
ponerS(0); seleccionar(-1);
requestAnimationFrame(bucle);
window.__visor = { get s() { return s; }, ponerS, seleccionar, get sel() { return sel; } };   // para pruebas

// copiar prompt
const btn = $("copiar"), pre = $("prompt");
const hecho = () => { btn.textContent = "Copiado"; btn.classList.add("ok"); setTimeout(() => { btn.textContent = "Copiar prompt"; btn.classList.remove("ok"); }, 2200); };
const alternativa = () => { const r = document.createRange(); r.selectNodeContents(pre); const x = window.getSelection(); x.removeAllRanges(); x.addRange(r); btn.textContent = "Selecciona y copia"; setTimeout(() => { btn.textContent = "Copiar prompt"; }, 2600); };
btn.addEventListener("click", () => { const t = pre.innerText; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(hecho, alternativa); else alternativa(); });
