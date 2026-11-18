import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { UNITS, GROUPS, DEFAULT_ORDER, COLORS, GAP, MAX_PER_TYPE, MIN_TOTAL, M_PER_UNIT } from './config.js';
import { loadUnits, setColor, setFinish } from './model.js';

const $ = (s) => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEFAULT_DIR = new THREE.Vector3(0.45, 0.32, 1).normalize();
const FT = 3.28084;
const label = (t) => UNITS[t].label;
const m2 = (u) => (u * M_PER_UNIT).toFixed(2);

/* ---------------- state ---------------- */
let uid = 0;
const state = { order: DEFAULT_ORDER.map((type) => ({ id: ++uid, type })), colors: {}, finish: 'satin' };
const count = (t) => state.order.filter((m) => m.type === t).length;
const lastIndexOf = (t) => state.order.map((m) => m.type).lastIndexOf(t);
function add(t) {
  if (count(t) >= MAX_PER_TYPE) return;
  const i = lastIndexOf(t);
  state.order.splice(i < 0 ? state.order.length : i + 1, 0, { id: ++uid, type: t });
  layout();
}
function remove(t) {
  if (!count(t) || state.order.length <= MIN_TOTAL) return;
  state.order.splice(lastIndexOf(t), 1);
  layout();
}
function move(from, to) {
  if (to < 0 || to >= state.order.length || from === to) return;
  const [it] = state.order.splice(from, 1);
  state.order.splice(to, 0, it);
  layout({ frame: false });
}

/* ---------------- scene ---------------- */
const stage = $('#stage'), canvas = $('#view');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  $('#status').textContent = "This browser can't show 3D graphics. Try a current version of Chrome, Safari, Edge or Firefox.";
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(400, 800, 600);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(26, 1, 1, 20000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minPolarAngle = 0.2;
controls.maxPolarAngle = 1.52;
controls.minDistance = 120;
controls.maxDistance = 6000;
// Keep page scrolling working inside a Framer embed: zoom only after the person clicks the view.
controls.enableZoom = false;
canvas.addEventListener('pointerdown', () => { controls.enableZoom = true; });
canvas.addEventListener('pointerleave', () => { controls.enableZoom = false; });

const press = new THREE.Group();
scene.add(press);
const mods = new Map();

const sc = document.createElement('canvas');
sc.width = sc.height = 128;
const sx = sc.getContext('2d');
const grad = sx.createRadialGradient(64, 64, 0, 64, 64, 64);
grad.addColorStop(0, 'rgba(0,0,0,.34)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
sx.fillStyle = grad; sx.fillRect(0, 0, 128, 128);
const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false })
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = 0.2;
scene.add(shadow);

const hl = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial({ color: 0xd4141c, transparent: true, opacity: 0.22, depthWrite: false })
);
hl.visible = false;
scene.add(hl);

/* ---------------- render on demand ---------------- */
let raf = 0, goal = null, ready = false, total = 0, H = 0, W = 0;
const req = () => { if (!raf) raf = requestAnimationFrame(tick); };
controls.addEventListener('change', req);
controls.addEventListener('start', () => { goal = null; });

function stepTweens() {
  const k = reduce ? 1 : 0.2;
  let busy = false;
  for (const g of mods.values()) {
    const dx = g.userData.tx - g.position.x;
    if (Math.abs(dx) > 0.05) { g.position.x += dx * k; busy = true; } else g.position.x = g.userData.tx;
    const ds = 1 - g.scale.y;
    if (Math.abs(ds) > 0.002) { g.scale.y += ds * k; busy = true; } else g.scale.y = 1;
  }
  if (goal) {
    camera.position.lerp(goal.pos, k);
    controls.target.lerp(goal.target, k);
    if (camera.position.distanceTo(goal.pos) < 0.5 && controls.target.distanceTo(goal.target) < 0.5) {
      camera.position.copy(goal.pos); controls.target.copy(goal.target); goal = null;
    } else busy = true;
  }
  return busy;
}
function tick() {
  raf = 0;
  const busy = stepTweens();
  const moved = controls.update();
  renderer.render(scene, camera);
  if (busy || moved) req();
}

/* ---------------- framing ---------------- */
const pressBox = () => new THREE.Box3(new THREE.Vector3(-total / 2, 0, -W / 2), new THREE.Vector3(total / 2, H, W / 2));
function frameFor(cam, dir, box, aspect, pad = 1.12) {
  const c = box.getCenter(new THREE.Vector3());
  const fwd = dir.clone().normalize();
  const right = new THREE.Vector3(0, 1, 0).cross(fwd).normalize();
  const up = fwd.clone().cross(right).normalize();
  let hw = 0, hh = 0;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const p = new THREE.Vector3(x, y, z).sub(c);
    hw = Math.max(hw, Math.abs(p.dot(right)));
    hh = Math.max(hh, Math.abs(p.dot(up)));
  }
  const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  const d = Math.max(hh / t, hw / (t * aspect)) * pad + (box.max.z - box.min.z) / 2;
  return { target: c, pos: c.clone().addScaledVector(fwd, d) };
}
function reframe() {
  if (!stage.clientWidth || !total) return;
  const dir = camera.position.clone().sub(controls.target);
  if (dir.lengthSq() < 1e-6) dir.copy(DEFAULT_DIR);
  goal = frameFor(camera, dir, pressBox(), camera.aspect);
  if (!ready || reduce) { camera.position.copy(goal.pos); controls.target.copy(goal.target); goal = null; ready = true; }
  req();
}
new ResizeObserver(() => {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  reframe();
  req();
}).observe(stage);

/* ---------------- load the model, then start ---------------- */
let units;
try {
  units = await loadUnits();
} catch (e) {
  console.error(e);
  $('#status').textContent = "The 3D model couldn't be loaded. Check that models/plant.glb is in the repository.";
  throw e;
}
$('#status').hidden = true;
W = Math.max(...Object.values(units).map((u) => u.d));

/* ---------------- layout ---------------- */
function layout({ frame = true } = {}) {
  const ids = new Set(state.order.map((m) => m.id));
  for (const [id, g] of mods) if (!ids.has(id)) { press.remove(g); mods.delete(id); }
  for (const m of state.order) {
    if (mods.has(m.id)) continue;
    const u = units[m.type];
    const g = new THREE.Mesh(u.geo, u.mat);
    g.userData.fresh = true;
    g.scale.y = 0.01;
    press.add(g);
    mods.set(m.id, g);
  }
  total = state.order.reduce((s, m) => s + units[m.type].len, 0) + GAP * (state.order.length - 1);
  H = Math.max(...state.order.map((m) => units[m.type].h));
  let x = -total / 2;
  for (const m of state.order) {
    const g = mods.get(m.id);
    g.userData.tx = x;
    if (g.userData.fresh) { g.position.x = x; g.userData.fresh = false; }
    x += units[m.type].len + GAP;
  }
  shadow.scale.set(total + 160, W + 120, 1);
  sync();
  if (frame) reframe();
  req();
}

/* ---------------- options panel ---------------- */
const opts = $('#options');
GROUPS.forEach((grp) => {
  const s = document.createElement('section');
  s.innerHTML = `<h2>${grp.title}</h2><p class="cap">Up to ${MAX_PER_TYPE} of each kind</p>`;
  for (const t of grp.types) {
    const r = document.createElement('div');
    r.className = 'row';
    r.dataset.type = t;
    r.innerHTML = `<span class="name">${label(t)}</span><span class="stepper">
      <button data-act="dec" aria-label="Remove ${label(t)}">&minus;</button>
      <output aria-live="polite">0</output>
      <button data-act="inc" aria-label="Add ${label(t)}">+</button></span>`;
    s.append(r);
  }
  opts.append(s);
});
opts.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const t = b.closest('.row').dataset.type;
  b.dataset.act === 'inc' ? add(t) : remove(t);
});

function sync() {
  document.querySelectorAll('.row').forEach((r) => {
    const t = r.dataset.type, n = count(t);
    r.querySelector('output').textContent = n;
    r.querySelector('[data-act=dec]').disabled = n === 0 || state.order.length <= MIN_TOTAL;
    r.querySelector('[data-act=inc]').disabled = n >= MAX_PER_TYPE;
  });
  $('#d-len').textContent = `${m2(total)} m`;
  $('#d-len-ft').textContent = `${(total * M_PER_UNIT * FT).toFixed(1)} ft`;
  $('#d-h').textContent = `${m2(H)} m`;
  $('#d-h-ft').textContent = `${(H * M_PER_UNIT * FT).toFixed(1)} ft`;
  $('#d-w').textContent = `${m2(W)} m`;
  $('#d-w-ft').textContent = `${(W * M_PER_UNIT * FT).toFixed(1)} ft`;
  if (!$('#tray').hidden) renderTray();
}

/* colours and finish */
const colorBox = $('#colors');
for (const t of Object.keys(UNITS)) {
  const f = document.createElement('div');
  f.className = 'field';
  f.innerHTML = `<span>${label(t)}</span>`;
  const sw = document.createElement('div');
  sw.className = 'swatches'; sw.dataset.type = t;
  for (const c of COLORS) {
    const b = document.createElement('button');
    b.className = 'sw' + (c ? '' : ' orig');
    if (c) b.style.background = c;
    b.dataset.c = c ?? '';
    b.setAttribute('aria-label', c ? `${label(t)} color ${c}` : `${label(t)} original color`);
    b.title = c ?? 'Original';
    b.onclick = () => { state.colors[t] = c; look(); };
    sw.append(b);
  }
  const inp = document.createElement('input');
  inp.type = 'color'; inp.value = '#888888'; inp.setAttribute('aria-label', `${label(t)} custom color`);
  inp.oninput = () => { state.colors[t] = inp.value; look(); };
  sw.append(inp);
  f.append(sw);
  colorBox.append(f);
}
document.querySelectorAll('[data-f]').forEach((b) => { b.onclick = () => { state.finish = b.dataset.f; look(); }; });
function look() {
  for (const t of Object.keys(UNITS)) {
    const c = state.colors[t] ?? null;
    setColor(units[t].mat, c);
    setFinish(units[t].mat, state.finish);
    colorBox.querySelectorAll(`.swatches[data-type=${t}] .sw`).forEach((b) => b.classList.toggle('on', b.dataset.c === (c ?? '')));
  }
  document.querySelectorAll('[data-f]').forEach((b) => b.classList.toggle('on', b.dataset.f === state.finish));
  req();
}

/* ---------------- rearrange tray ---------------- */
const tray = $('#tray'), chips = $('#chips');
$('#rearrange').onclick = (e) => {
  tray.hidden = !tray.hidden;
  e.currentTarget.setAttribute('aria-pressed', String(!tray.hidden));
  if (tray.hidden) showHl(null); else renderTray();
};
function showHl(i) {
  const m = i == null ? null : state.order[i];
  const g = m && mods.get(m.id);
  hl.visible = !!g;
  if (g) {
    const u = units[m.type];
    hl.scale.set(u.len, u.h, u.d);
    hl.position.set(g.userData.tx + u.len / 2, u.h / 2, 0);
  }
  req();
}
function renderTray() {
  chips.innerHTML = '';
  state.order.forEach((m, i) => {
    const li = document.createElement('li');
    li.draggable = true;
    li.dataset.i = i;
    li.innerHTML = `<span class="lbl">${label(m.type)}</span>
      <button data-mv="-1" aria-label="Move ${label(m.type)} left" ${i === 0 ? 'disabled' : ''}>&#8249;</button>
      <button data-mv="1" aria-label="Move ${label(m.type)} right" ${i === state.order.length - 1 ? 'disabled' : ''}>&#8250;</button>`;
    chips.append(li);
  });
}
chips.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-mv]');
  if (!b) return;
  const i = +b.closest('li').dataset.i, d = +b.dataset.mv;
  move(i, i + d);
  const next = chips.children[i + d];
  (next?.querySelector(`[data-mv="${d}"]:not(:disabled)`) || next?.querySelector('button:not(:disabled)'))?.focus();
  showHl(i + d);
});
chips.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', e.target.dataset.i); e.target.classList.add('drag'); });
chips.addEventListener('dragend', (e) => e.target.classList.remove('drag'));
chips.addEventListener('dragover', (e) => e.preventDefault());
chips.addEventListener('drop', (e) => {
  e.preventDefault();
  const li = e.target.closest('li');
  if (li) move(+e.dataTransfer.getData('text/plain'), +li.dataset.i);
});
chips.addEventListener('mouseover', (e) => { const li = e.target.closest('li'); if (li) showHl(+li.dataset.i); });
chips.addEventListener('focusin', (e) => { const li = e.target.closest('li'); if (li) showHl(+li.dataset.i); });
chips.addEventListener('mouseleave', () => showHl(null));
chips.addEventListener('focusout', () => showHl(null));

/* ---------------- reset view ---------------- */
$('#reset').onclick = () => {
  camera.position.copy(DEFAULT_DIR).multiplyScalar(10).add(controls.target);
  reframe();
};

/* ---------------- export ---------------- */
function sequence() {
  const runs = [];
  for (const m of state.order) {
    const l = label(m.type), last = runs[runs.length - 1];
    last && last.l === l ? last.n++ : runs.push({ l, n: 1 });
  }
  return runs.map((r) => (r.n > 1 ? `${r.l} x${r.n}` : r.l)).join(', ');
}
function wrap(ctx, text, maxW) {
  const lines = []; let line = '';
  for (const w of text.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}
function withSummary(shot) {
  const Wd = shot.width, s = Wd / 3000, pad = 120 * s;
  const font = (px, wt = 400) => `${wt} ${px * s}px Archivo, system-ui, sans-serif`;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font(40);
  const lines = wrap(probe, `Order of units: ${sequence()}`, Wd - 2 * pad);
  const lineH = 58 * s;
  const footH = pad * 0.6 + 70 * s + lineH * (lines.length + 1) + pad * 0.5;
  const out = document.createElement('canvas');
  out.width = Wd; out.height = Math.round(shot.height + footH);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(shot, 0, 0);
  ctx.fillStyle = '#d4141c'; ctx.fillRect(pad, shot.height + pad * 0.3, 90 * s, 8 * s);
  ctx.fillStyle = '#1d2329'; ctx.textBaseline = 'top';
  let y = shot.height + pad * 0.6;
  ctx.font = font(56, 700); ctx.fillText('Custom configuration', pad, y); y += 70 * s;
  ctx.font = font(40);
  ctx.fillText(`Length ${m2(total)} m (${(total * M_PER_UNIT * FT).toFixed(1)} ft), height ${m2(H)} m, width ${m2(W)} m`, pad, y); y += lineH;
  for (const l of lines) { ctx.fillText(l, pad, y); y += lineH; }
  return out;
}
async function exportImage() {
  const btn = $('#export'), text = btn.textContent;
  btn.disabled = true; btn.textContent = 'Preparing image';
  await new Promise((r) => setTimeout(r, 40));
  const prevW = stage.clientWidth, prevH = stage.clientHeight, prevPR = renderer.getPixelRatio(), prevHl = hl.visible;
  try {
    const gl = renderer.getContext();
    const Wd = Math.min(3000, gl.getParameter(gl.MAX_VIEWPORT_DIMS)[0], gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
    const Hd = Math.round(Wd / 2);
    const white = $('#bg').value === 'white';
    const cam = new THREE.PerspectiveCamera(camera.fov, Wd / Hd, 1, 20000);
    const f = frameFor(cam, camera.position.clone().sub(controls.target), pressBox(), Wd / Hd, 1.12);
    cam.position.copy(f.pos); cam.lookAt(f.target);
    hl.visible = false;
    renderer.setPixelRatio(1);
    renderer.setSize(Wd, Hd, false);
    renderer.setClearColor(0xffffff, white ? 1 : 0);
    renderer.render(scene, cam);
    const shot = document.createElement('canvas');
    shot.width = Wd; shot.height = Hd;
    shot.getContext('2d').drawImage(canvas, 0, 0);
    const out = white ? withSummary(shot) : shot;
    await new Promise((res) => out.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'configuration.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      res();
    }, 'image/png'));
  } finally {
    renderer.setPixelRatio(prevPR);
    renderer.setSize(prevW, prevH, false);
    renderer.setClearColor(0x000000, 0);
    hl.visible = prevHl;
    btn.disabled = false; btn.textContent = text;
    req();
  }
}
$('#export').onclick = exportImage;

/* ---------------- go ---------------- */
if (stage.clientWidth) {
  renderer.setSize(stage.clientWidth, stage.clientHeight, false);
  camera.aspect = stage.clientWidth / stage.clientHeight;
  camera.updateProjectionMatrix();
}
look();
layout();
