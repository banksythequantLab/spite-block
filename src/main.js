import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { Game, RAGE_MAX } from './game.js';
import { W, D, H, idx } from './board.js';
import { MATERIAL, orientations } from './pieces.js';
import { pick } from './lines.js';
import { loadProfile, saveRun, biasFrom, cruelPiece } from './memory.js';
import { dailySeed } from './rng.js';
import { Voice } from './voice.js';
import { Audio } from './audio.js';
import { HandInput } from './hands.js';
import { Dealer } from './dealer.js';
import { FX, Trail } from './fx.js';

const S = 0.04;
const $ = id => document.getElementById(id);
let quality = localStorage.getItem('spiteblock.quality') || 'high';

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight); renderer.xr.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const desktopBg = new THREE.Color(0x15111a); scene.background = desktopBg; scene.fog = new THREE.Fog(0x15111a, 1.4, 3.5);
const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.8;
const camera = new THREE.PerspectiveCamera(48, innerWidth/innerHeight, 0.01, 20);
camera.position.set(0.5, 1.5, 0.95);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xffe9d0, 0x2a2030, 0.6));
const keyL = new THREE.DirectionalLight(0xfff0dc, 2.4); keyL.position.set(0.5, 1.9, 0.5); keyL.castShadow = true;
Object.assign(keyL.shadow.camera, { left: -0.3, right: 0.3, top: 0.3, bottom: -0.3, near: 0.3, far: 2 }); keyL.shadow.radius = 4; keyL.shadow.bias = -0.0005;
scene.add(keyL); scene.add(keyL.target);
const rim = new THREE.DirectionalLight(0x8fb4ff, 1.2); rim.position.set(-0.6, 1.3, -0.8); scene.add(rim);
const warm = new THREE.PointLight(0xffa860, 0.6, 1.2); warm.position.set(0.25, 1.05, 0.2); scene.add(warm);

const root = new THREE.Group(); root.position.set(0, 0.8, -0.1); scene.add(root);
keyL.target = root;
// desktop-only table + backdrop
const deskGroup = new THREE.Group(); scene.add(deskGroup);
const woodTex = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#4a2f20'; x.fillRect(0,0,512,512); for (let i=0;i<140;i++){ x.strokeStyle = `rgba(${30+Math.random()*40},${15+Math.random()*20},10,${0.15+Math.random()*0.25})`; x.lineWidth = 1+Math.random()*3; x.beginPath(); const y=Math.random()*512; x.moveTo(0,y); x.bezierCurveTo(170,y+Math.random()*20-10,340,y+Math.random()*20-10,512,y); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2,1); return t; })();
const table = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.03, 0.8), new THREE.MeshPhysicalMaterial({ map: woodTex, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3 }));
table.position.set(0, 0.785, -0.1); table.receiveShadow = true; deskGroup.add(table);
const felt = new THREE.Mesh(new THREE.CircleGeometry(0.36, 48), new THREE.MeshStandardMaterial({ color: 0x1d4a3a, roughness: 1 }));
felt.rotation.x = -Math.PI/2; felt.position.set(0, 0.8015, -0.1); felt.receiveShadow = true; deskGroup.add(felt);

// tank (well floor ~25 cm above table)
const tank = new THREE.Group(); tank.position.set(-W*S/2, 0.25, -D*S/2); root.add(tank);
const camTarget = new THREE.Vector3(0, 0.8+0.25+H*S/2 + 0.06, -0.1); controls.target.copy(camTarget); controls.update();

// contact shadow under the tank: gradient blob on the table (works in AR, no shadow map needed) + shadow catcher
const blob = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64,64,10,64,64,64); g.addColorStop(0,'rgba(0,0,0,0.65)'); g.addColorStop(1,'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0,0,128,128); return new THREE.CanvasTexture(c); })();
const contact = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false }));
contact.rotation.x = -Math.PI/2; contact.position.y = 0.0025; root.add(contact);
const catcher = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), new THREE.ShadowMaterial({ opacity: 0.35 }));
catcher.rotation.x = -Math.PI/2; catcher.position.y = 0.003; catcher.receiveShadow = true; root.add(catcher);
// pedestal + legs (the tank floats on a brass stand)
const brassM = new THREE.MeshPhysicalMaterial({ color: 0xc89b45, metalness: 1, roughness: 0.28, clearcoat: 0.4 });
const base = new THREE.Mesh(new RoundedBoxGeometry(W*S+0.04, 0.02, D*S+0.04, 3, 0.006), brassM); base.position.set(0, 0.24, 0); base.castShadow = true; root.add(base);
[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b]) => { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.01, 0.23, 12), brassM); leg.position.set(a*(W*S/2+0.01), 0.115, b*(D*S/2+0.01)); leg.castShadow = true; root.add(leg); });
const floorPlate = new THREE.Mesh(new THREE.BoxGeometry(W*S, 0.004, D*S), new THREE.MeshPhysicalMaterial({ color: 0x1b1720, roughness: 0.35, metalness: 0.3, clearcoat: 1 }));
floorPlate.position.set(W*S/2, -0.002, D*S/2); floorPlate.receiveShadow = true; tank.add(floorPlate);

// glass panes (transmission on High, plain alpha on Low)
const glassHigh = new THREE.MeshPhysicalMaterial({ color: 0xe8f6ff, metalness: 0, roughness: 0.05, transmission: 1, thickness: 0.006, ior: 1.45, transparent: true, opacity: 1, specularIntensity: 1, envMapIntensity: 1.2, side: THREE.DoubleSide, depthWrite: false, attenuationColor: new THREE.Color(0xc8ecff), attenuationDistance: 0.5 });
const glassLow = new THREE.MeshPhysicalMaterial({ color: 0xcfe9f2, roughness: 0.05, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.5 });
const panes = []; const paneGeo = new THREE.PlaneGeometry(W*S, H*S);
[[W*S/2, D*S, 0], [W*S/2, 0, Math.PI], [0, D*S/2, -Math.PI/2], [W*S, D*S/2, Math.PI/2]].forEach(([x,z,r]) => { const p = new THREE.Mesh(paneGeo, glassLow); p.position.set(x, H*S/2, z); p.rotation.y = r; p.renderOrder = 2; tank.add(p); panes.push(p); });
// brass trim: 4 vertical posts + top & bottom frames
const trimGeo = new THREE.BoxGeometry(0.005, H*S + 0.006, 0.005);
[[0,0],[W*S,0],[0,D*S],[W*S,D*S]].forEach(([x,z]) => { const t = new THREE.Mesh(trimGeo, brassM); t.position.set(x, H*S/2, z); tank.add(t); });
[0, H*S].forEach(y => { [[W*S/2,0,W*S,0.005],[W*S/2,D*S,W*S,0.005],[0,D*S/2,0.005,D*S],[W*S,D*S/2,0.005,D*S]].forEach(([x,z,w,d]) => { const t = new THREE.Mesh(new THREE.BoxGeometry(w+0.005, 0.006, d+0.005), brassM); t.position.set(x, y, z); tank.add(t); }); });
// subtle etched grid on floor + height ticks
const grid = new THREE.GridHelper(W*S, W, 0xd9a646, 0xd9a646); grid.material.transparent = true; grid.material.opacity = 0.18; grid.position.set(W*S/2, 0.001, D*S/2); tank.add(grid);
const danger = new THREE.Mesh(new THREE.PlaneGeometry(W*S, D*S), new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
danger.rotation.x = -Math.PI/2; danger.position.set(W*S/2, (H-3)*S, D*S/2); tank.add(danger);
const clearFlash = new THREE.Mesh(new THREE.BoxGeometry(W*S, S, D*S), new THREE.MeshBasicMaterial({ color: 0xfff1c0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
clearFlash.visible = false; tank.add(clearFlash);

// ---------- block materials by family ----------
const MATS = {
  glass: new THREE.MeshPhysicalMaterial({ color: 0xbfe6ee, roughness: 0.08, transmission: 0.0, transparent: true, opacity: 0.72, ior: 1.5, clearcoat: 1, envMapIntensity: 1.6, specularIntensity: 1 }),
  cork: new THREE.MeshPhysicalMaterial({ color: 0xb5895a, roughness: 0.85, sheen: 0.6, sheenColor: new THREE.Color(0xffd9a8), sheenRoughness: 0.8 }),
  brass: new THREE.MeshPhysicalMaterial({ color: 0xd2a650, metalness: 1, roughness: 0.22, clearcoat: 0.3 }),
  enamel: new THREE.MeshPhysicalMaterial({ color: 0x1f6f80, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 }),
  obsidian: new THREE.MeshPhysicalMaterial({ color: 0x2a0f22, roughness: 0.06, metalness: 0.2, clearcoat: 1, emissive: 0x5a0018, emissiveIntensity: 0.6, iridescence: 0.6 }),
};
const settledMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2, metalness: 0.1 });
const cubeGeo = new RoundedBoxGeometry(S*0.94, S*0.94, S*0.94, 3, S*0.2);
const settled = new THREE.InstancedMesh(cubeGeo, settledMat, W*D*H); settled.count = 0; settled.frustumCulled = false; settled.castShadow = true; settled.receiveShadow = true; tank.add(settled);
const SETTLED_TINT = { glass: 0xa9cdd6, cork: 0xa47a4e, brass: 0xb8913f, enamel: 0x2a6474, obsidian: 0x4a1a36 };
const cellFamily = new Array(W*D*H).fill(null);

// current piece instanced (1 draw call), ghost fresnel
const curMesh = new THREE.InstancedMesh(cubeGeo, MATS.glass, 5); curMesh.castShadow = true; curMesh.frustumCulled = false; tank.add(curMesh);
const ghostMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uColor: { value: new THREE.Color(0x9fe8ff) }, uTime: { value: 0 } },
  vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * instanceMatrix * vec4(position,1.); vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uColor; uniform float uTime; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1. - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(uColor * (0.08 + 0.9*f) * (0.85+0.15*sin(uTime*4.)), 1.); }` });
const ghostMesh = new THREE.InstancedMesh(cubeGeo, ghostMat, 5); ghostMesh.frustumCulled = false; tank.add(ghostMesh);
const m4 = new THREE.Matrix4();
function setInst(mesh, cells, ox, oy, oz, scale = 1) { cells.forEach(([x,y,z], i) => { m4.makeScale(scale,scale,scale).setPosition((x+ox+0.5)*S, (y+oy+0.5)*S, (z+oz+0.5)*S); mesh.setMatrixAt(i, m4); }); mesh.count = cells.length; mesh.instanceMatrix.needsUpdate = true; }
function miniPiece(name, scale = 0.55) { const cells = orientations(name)[0]; const m = new THREE.InstancedMesh(cubeGeo, MATS[MATERIAL[name]], cells.length); setInst(m, cells, 0, 0, 0, scale); m.children = []; m.scale.setScalar(scale); m.castShadow = true;
  cells.forEach(([x,y,z], i) => { m4.makeTranslation((x+0.5)*S, (y+0.5)*S, (z+0.5)*S); m.setMatrixAt(i, m4); }); return m; }

// ---------- Dealer ----------
const dealer = new Dealer(); const dealerHome = new THREE.Vector3(0, 0.25+H*S+0.13, -D*S/2-0.13); dealer.group.position.copy(dealerHome); root.add(dealer.group);

// ---------- side props ----------
const pocket = new THREE.Group(); pocket.position.set(-W*S/2 - 0.13, 0.27, 0); root.add(pocket);
{ const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.02, 32, 1, true), brassM); tray.material = brassM; pocket.add(tray);
  const bot = new THREE.Mesh(new THREE.CircleGeometry(0.05, 32), new THREE.MeshStandardMaterial({ color: 0x3a1020, roughness: 1 })); bot.rotation.x = -Math.PI/2; bot.position.y = -0.008; pocket.add(bot); }
const pocketLabel = labelSprite('BANK', 0xd9a646); pocketLabel.position.set(0, 0.035, 0.05); pocket.add(pocketLabel);
const holdSlot = new THREE.Group(); holdSlot.position.set(-0.028, -0.0, -0.028); pocket.add(holdSlot);
const previews = [0,1].map(i => { const g = new THREE.Group(); g.position.set(W*S/2 + 0.07, 0.25 + H*S - 0.1 - i*0.12, -0.03); root.add(g); return g; });
const nextLabel = labelSprite('NEXT', 0xd9a646); nextLabel.position.set(W*S/2 + 0.1, 0.25 + H*S - 0.02, 0); root.add(nextLabel);
const envCanvas = document.createElement('canvas'); envCanvas.width = 256; envCanvas.height = 170;
{ const c = envCanvas.getContext('2d'); const g = c.createLinearGradient(0,0,0,170); g.addColorStop(0,'#efe1bd'); g.addColorStop(1,'#cdb98d'); c.fillStyle = g; c.fillRect(0,0,256,170); c.strokeStyle = '#8a7350'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(4,4); c.lineTo(128,98); c.lineTo(252,4); c.stroke(); c.fillStyle = '#7a1424'; c.beginPath(); c.arc(128,98,26,0,7); c.fill(); c.fillStyle = '#f2d48a'; c.font = 'bold 36px Georgia'; c.textAlign = 'center'; c.fillText('?', 128, 111); }
const envTex = new THREE.CanvasTexture(envCanvas); envTex.colorSpace = THREE.SRGBColorSpace;
const envelope = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.004), new THREE.MeshPhysicalMaterial({ map: envTex, roughness: 0.7, sheen: 0.5 })); envelope.castShadow = true; root.add(envelope); envelope.visible = false;
const revealEnv = envelope.clone(); revealEnv.material = envelope.material.clone(); revealEnv.material.transparent = true; revealEnv.visible = false; root.add(revealEnv);
const rageCube = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.045, 0.045, 3, 0.01), new THREE.MeshPhysicalMaterial({ color: 0xe0242c, emissive: 0xff2010, emissiveIntensity: 0.8, roughness: 0.2, clearcoat: 1 }));
const rageHome = new THREE.Vector3(W*S/2 + 0.1, 0.28, 0.12); rageCube.position.copy(rageHome); rageCube.visible = false; root.add(rageCube);
const rageLight = new THREE.PointLight(0xff3020, 0, 0.3); rageCube.add(rageLight);
const pipMat = () => new THREE.MeshBasicMaterial({ color: 0x3a1818 });
const ragePips = []; for (let i=0;i<RAGE_MAX;i++){ const p=new THREE.Mesh(new THREE.SphereGeometry(0.007,12,8), pipMat()); p.position.set(-W*S/2 + i*(W*S/(RAGE_MAX-1)), 0.255, D*S/2+0.035); root.add(p); ragePips.push(p); }
const fx = new FX(root); const trail = new Trail(root);
function labelSprite(text, color) { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#' + color.toString(16).padStart(6,'0'); x.font = '600 34px Georgia'; x.textAlign = 'center'; x.fillText(text, 128, 44);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); s.scale.set(0.08, 0.02, 1); return s; }

// in-world caption panel (for AR)
const capCanvas = document.createElement('canvas'); capCanvas.width = 1024; capCanvas.height = 256;
const capTex = new THREE.CanvasTexture(capCanvas); capTex.colorSpace = THREE.SRGBColorSpace;
const capPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.1), new THREE.MeshBasicMaterial({ map: capTex, transparent: true, depthWrite: false }));
capPanel.position.set(0, 0.25 + H*S + 0.29, -D*S/2-0.12); root.add(capPanel);
let panelDirty = true;
function drawPanel() {
  const c = capCanvas.getContext('2d'); c.clearRect(0,0,1024,256);
  c.fillStyle = 'rgba(16,10,18,0.78)'; c.beginPath(); c.roundRect(4,4,1016,248,36); c.fill(); c.strokeStyle = '#c89b45'; c.lineWidth = 3; c.stroke();
  c.fillStyle = '#e7b65c'; c.font = '600 42px Georgia'; c.textAlign = 'center';
  c.fillText(`${game.score.toLocaleString()}  ·  rage ${'◆'.repeat(game.rage)}${'◇'.repeat(RAGE_MAX-game.rage)}${game.stunned?'  ·  STUNNED':''}${game.over?'  ·  GAME OVER':''}`, 512, 66);
  c.fillStyle = '#f4e3c1'; c.font = 'italic 38px Georgia';
  const words = (lastCaption||'').split(' '); let line='', y=138;
  for (const w of words) { if (c.measureText(line+w).width > 940) { c.fillText(line, 512, y); line=''; y+=48; } line += w+' '; }
  c.fillText(line, 512, y); capTex.needsUpdate = true; panelDirty = false;
}

// ---------- state ----------
let profile = loadProfile();
let game, daily = null, paused = false, lastCaption = '';
const audio = new Audio();
const voice = new Voice(text => { lastCaption = text; const el = $('caption'); el.innerHTML = `<span class="who">THE DEALER</span>${text}`; el.classList.add('on'); panelDirty = true; clearTimeout(voice._t); voice._t = setTimeout(()=>el.classList.remove('on'), 4800); });
const unlock = () => audio.ensure(); addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);

function newGame() {
  daily = $('daily').checked ? new Date().toISOString().slice(0,10) : null;
  const seed = daily ? dailySeed() : (Date.now() & 0xffffffff);
  game = new Game({ seed, difficulty: $('diff').value, bias: biasFrom(profile) });
  cellFamily.fill(null); $('banner').className = ''; $('banner').textContent = ''; dealer.setExpression('idle');
  const nemesis = cruelPiece(profile);
  voice.say(profile.runs && nemesis && Math.random()<0.6 ? pick('memory', Math.random, { piece: nemesis, best: profile.best }) : pick('start'), true);
  rebuildSettled(); refreshPiece(); refreshSide(true);
}
$('new').onclick = () => { newGame(); $('new').blur(); };
$('voice').onchange = e => voice.enabled = e.target.checked;
$('music').onchange = e => { audio.ensure(); audio.setMusic(e.target.checked); };
$('sfx').onchange = e => audio.sfxOn = e.target.checked;
$('quality').value = quality; $('quality').onchange = e => { quality = e.target.value; localStorage.setItem('spiteblock.quality', quality); applyQuality(); e.target.blur(); };
function applyQuality() {
  const hi = quality === 'high';
  renderer.setPixelRatio(hi ? Math.min(2, devicePixelRatio) : 1);
  renderer.shadowMap.enabled = hi; keyL.shadow.mapSize.set(hi ? 1024 : 512, hi ? 1024 : 512); if (keyL.shadow.map) { keyL.shadow.map.dispose(); keyL.shadow.map = null; }
  panes.forEach(p => p.material = hi ? glassHigh : glassLow);
  MATS.glass.transmission = 0; // keep pieces cheap even on high
  scene.traverse(o => { if (o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; });
  renderer.xr.setFramebufferScaleFactor?.(hi ? 1.0 : 0.85);
}
applyQuality();

// settled cells keep a tint from the family that placed them
function rebuildSettled() {
  let n = 0; const col = new THREE.Color();
  for (let y=0;y<H;y++) for (let z=0;z<D;z++) for (let x=0;x<W;x++) { const i = idx(x,y,z); if (game.board[i]) {
    m4.makeTranslation((x+0.5)*S, (y+0.5)*S, (z+0.5)*S); settled.setMatrixAt(n, m4);
    col.set(SETTLED_TINT[cellFamily[i] || 'cork']).offsetHSL(0, 0, -0.04 + 0.01*y); settled.setColorAt(n, col); n++; } else cellFamily[i] = null; }
  settled.count = n; settled.instanceMatrix.needsUpdate = true; if (settled.instanceColor) settled.instanceColor.needsUpdate = true;
}
function shiftFamilies(rows) { const out = new Array(W*D*H).fill(null); let dst = 0; for (let y=0;y<H;y++){ if (rows.includes(y)) continue; for (let i=0;i<W*D;i++) out[dst*W*D+i] = cellFamily[y*W*D+i]; dst++; } cellFamily.splice(0, cellFamily.length, ...out); }
let curName = null;
function refreshPiece() {
  const c = game.cur; if (!c) return;
  if (c.name !== curName) { curMesh.material = MATS[MATERIAL[c.name]]; curName = c.name; }
  setInst(curMesh, c.cells, c.x, c.y, c.z);
  const gy = game.ghostY(); setInst(ghostMesh, c.cells, c.x, gy ?? c.y, c.z, 1.02); ghostMesh.visible = gy !== null && gy !== c.y;
}
let sideKey = '', lastScore = 0, lastRage = 0;
function refreshSide(force) {
  const k = `${game.hold}|${game.queue.slice(0,2).map(q=>q.name+q.ai).join()}`;
  if (k !== sideKey || force) { sideKey = k;
    holdSlot.clear(); if (game.hold) holdSlot.add(miniPiece(game.hold));
    envelope.visible = false;
    game.queue.slice(0,2).forEach((q,i) => { previews[i].clear();
      if (q.ai && !q.name) { envelope.visible = true; envelope.position.copy(previews[i].position).add(new THREE.Vector3(0.035, 0.03, 0.03)); }
      else previews[i].add(miniPiece(q.name)); });
    $('hold').textContent = game.hold || '—';
    $('next').innerHTML = game.queue.slice(0,2).map(q => q.ai && !q.name ? '<span class="env">✉ Dealer’s pick</span>' : q.name).join(' · ');
  }
  if (game.score !== lastScore) { const el = $('score'); el.textContent = game.score.toLocaleString(); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); lastScore = game.score; panelDirty = true; }
  $('best').textContent = Math.max(profile.best, game.score).toLocaleString(); $('layers').textContent = game.layers;
  if (game.rage !== lastRage || force) { $('rage').innerHTML = Array.from({length:RAGE_MAX},(_,i)=>`<i class="${i<game.rage?'on':''}${game.rage>=RAGE_MAX?' full':''}"></i>`).join(''); lastRage = game.rage; panelDirty = true; }
  $('stun').textContent = game.stunned ? `STUNNED ${Math.ceil((game.stunUntil-game.time)/1000)}s · ×1.5` : (game.rage>=RAGE_MAX ? 'RAGE READY — B' : '');
  const q0 = game.queue[0];
  $('tell').innerHTML = !game.over && q0 && q0.ai && !q0.vetoed ? `<b>The Dealer is choosing.</b> Tell: <em>${q0.tell}</em> — <kbd>V</kbd> call the bluff` : '';
  rageCube.visible = game.rage >= RAGE_MAX && !game.over;
  const nearTop = game.board.subarray((H-3)*W*D).some(v=>v); danger.material.opacity = nearTop ? 0.25 + 0.15*Math.sin(performance.now()/150) : 0.0;
  if (panelDirty) drawPanel();
}

// ---------- events → voice / sfx / vfx / expressions ----------
let exprUntil = 0, shake = 0, dirtySettled = false, lastBoard = null;
function express(e, secs = 2) { dealer.setExpression(e); exprUntil = performance.now() + secs*1000; }
function tankCellWorld(x, y, z) { return new THREE.Vector3((x+0.5)*S, (y+0.5)*S, (z+0.5)*S).add(tank.position); }
function handleEvents() {
  for (const e of game.drainEvents()) {
    switch (e.type) {
      case 'lock': e.cells.forEach(([x,y,z]) => { if (y < H) cellFamily[idx(x,y,z)] = MATERIAL[e.name]; }); dirtySettled = true; break;
      case 'aiPick': voice.say(pick('aiPick')); audio.play('envelope'); express('smirk', 2.5); revealEnvelope(); break;
      case 'mercy': voice.say("I'll let you live. For now."); audio.play('envelope'); revealEnvelope(); break;
      case 'clear': {
        if (Math.random()<0.7) voice.say(pick('playerClear')); audio.play('clear', e.cleared); express('flustered', 1.6);
        (e.rows||[0]).forEach((row, k) => { const p = tankCellWorld(2, row, 2); fx.burst(p, { n: 45, color: 0xf0d090, speed: 0.7, spread: [W*S, S, D*S] }); fx.burst(p, { n: 30, color: 0xffe6a0, speed: 1.0, spread: [W*S, S, D*S], kind: 'spark', life: 0.7 });
          clearFlash.position.set(W*S/2, (row+0.5)*S, D*S/2); });
        shiftFamilies(e.rows||[]); fx.flash(clearFlash); flash(0xfff0b0); break; }
      case 'spiteClear': voice.say(pick('spiteClear'), true); express('flustered', 3); break;
      case 'nearDeath': voice.say(pick('nearDeath')); express('smirk', 2); break;
      case 'vetoSuccess': voice.say(pick('vetoSuccess'), true); audio.play('veto'); express('flustered', 2.5); flash(0x60ff90);
        fx.burst(envelope.getWorldPosition(new THREE.Vector3()).sub(root.position), { n: 25, color: 0x80ff9a, kind: 'spark', speed: 0.5, spread: [0.05,0.04,0.01] }); break;
      case 'vetoFail': voice.say(pick('vetoFail'), true); audio.play('vetoFail'); express('gloat', 2); flash(0xff4040); break;
      case 'stun': voice.say(pick('stun'), true); audio.play('rageFire'); setTimeout(()=>audio.play('stun'), 120); dealer.hitImpact();
        fx.burst(dealerHome, { n: 40, color: 0xff5030, speed: 0.8, kind: 'spark', spread: [0.05,0.05,0.05], life: 0.8 }); fx.burst(dealerHome, { n: 20, color: 0xffe066, speed: 0.4, spread: [0.04,0.04,0.04] }); break;
      case 'stunEnd': voice.say(pick('stunEnd')); express('grumpy', 2); break;
      case 'rageReady': voice.say(pick('rageReady')); audio.play('rageCharge'); break;
      case 'slam': audio.play('slam'); shake = 0.012; { fx.burst(tankCellWorld(e.x+1, e.y, e.z+1), { n: 22, color: 0xffb060, kind: 'spark', speed: 0.6, spread: [0.06,0.005,0.06], life: 0.5 }); } break;
      case 'gameOver': case 'win':
        voice.say(pick(e.type), true); audio.play('gameOver'); express(e.type==='win' ? 'grumpy' : 'gloat', 999);
        $('banner').innerHTML = e.type==='win' ? 'YOU SURVIVED<small>The Dealer concedes. Press N.</small>' : `GAME OVER<small>${game.score.toLocaleString()} pts · press N</small>`; $('banner').className = 'show';
        profile = saveRun(profile, game, { daily }); break;
      case 'crack': audio.play('clear', 1); break;
    }
  }
}
let flashT = 0; const trimBase = new THREE.Color(0xc89b45);
function flash(c){ brassM.emissive.set(c); brassM.emissiveIntensity = 1.2; flashT = 0.4; }
function revealEnvelope() { if (!envelope.visible && !envelope.userData.lastPos) return; revealEnv.position.copy(envelope.userData.lastPos || envelope.position); revealEnv.userData.t = 0; revealEnv.visible = true; }

// wrap actions with feedback
const act = {
  move: (dx,dz) => { const [a,b] = camRelative(dx,dz); if (game.move(a,b)) audio.play('move'); },
  rot: a => { if (game.rotate(a)) audio.play('rotate'); }, slam: () => game.hardDrop(), soft: () => game.softDrop(),
  hold: () => { if (game.doHold()) audio.play('rotate'); }, veto: () => game.veto(), rage: () => game.fireRage(),
};
function camRelative(dx, dz) { const v = new THREE.Vector3(); camera.getWorldDirection(v); const q = Math.round(Math.atan2(v.x, -v.z) / (Math.PI/2)) & 3; return [[dx,dz],[-dz,dx],[-dx,-dz],[dz,-dx]][q]; }
addEventListener('keydown', e => {
  if (e.target.tagName === 'SELECT') return;
  const k = e.key.toLowerCase();
  if (k === 'n') return newGame();
  if (k === 'm') { $('music').checked = !$('music').checked; $('music').onchange({ target: $('music') }); return; }
  if (k === 'p') { paused = !paused; $('banner').innerHTML = paused ? 'PAUSED' : ''; $('banner').className = paused ? 'show' : ''; return; }
  if (!game || game.over || paused) return;
  const rev = a => () => { game.rotate(a); game.rotate(a); act.rot(a); };
  const map = { arrowleft:()=>act.move(-1,0), a:()=>act.move(-1,0), arrowright:()=>act.move(1,0), d:()=>act.move(1,0),
    arrowup:()=>act.move(0,-1), w:()=>act.move(0,-1), arrowdown:()=>act.move(0,1), s:()=>act.move(0,1),
    q:()=>act.rot('y'), e:rev('y'), r:()=>act.rot('x'), f:rev('x'), t:()=>act.rot('z'), g:rev('z'),
    ' ':act.slam, shift:act.soft, c:act.hold, v:act.veto, b:act.rage };
  if (map[k]) { e.preventDefault(); map[k](); }
});

// ---------- WebXR hands ----------
const handInput = new HandInput(renderer, scene, { root, tank, S, pocket, envelope, rageCube, rageHome, dealer: dealer.group, game: () => game, act: {
  moveTo: (x,z) => { if (game.moveTo(x,z)) audio.play('move'); }, rot: act.rot, slam: act.slam, hold: act.hold, veto: act.veto, rage: act.rage } });
document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hand-tracking'], optionalFeatures: ['local-floor'] }));
renderer.xr.addEventListener('sessionstart', () => {
  audio.ensure(); scene.background = null; scene.fog = null; deskGroup.visible = false; $('hud').style.display='none';
  setTimeout(() => { const cam = renderer.xr.getCamera(); const p = new THREE.Vector3(); cam.getWorldPosition(p);
    const f = new THREE.Vector3(0,0,-1).applyQuaternion(cam.quaternion); f.y = 0; f.normalize();
    root.position.copy(p).addScaledVector(f, 0.45); root.position.y = p.y - 0.4 - 0.25 - H*S/2; root.rotation.y = Math.atan2(-f.x, -f.z); rootBase.copy(root.position); }, 300);
});
renderer.xr.addEventListener('sessionend', () => { scene.background = desktopBg; scene.fog = new THREE.Fog(0x15111a, 1.4, 3.5); deskGroup.visible = true; $('hud').style.display=''; });

// ---------- loop ----------
const clock = new THREE.Clock(); let tAccum = 0, frames = 0, fpsT = 0; const rootBase = root.position.clone();
const tmpV = new THREE.Vector3(), viewer = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.1, clock.getDelta()); tAccum += dt; frames++; fpsT += dt; if (fpsT > 1) { $('fps').textContent = `${Math.round(frames/fpsT)} fps`; frames = 0; fpsT = 0; }
  if (game && !paused) {
    handInput.update(dt);
    game.update(dt*1000);
    handleEvents(); if (dirtySettled || game.board !== lastBoard) { rebuildSettled(); if (dirtySettled) audio.play('lock'); dirtySettled = false; lastBoard = game.board; }
    refreshPiece(); refreshSide();
  }
  // expressions
  const q0 = game?.queue[0]; const tell = !game?.over && q0 && q0.ai && !q0.vetoed ? q0.tell : null;
  if (game?.stunned) dealer.setExpression('stunned');
  else if (performance.now() > exprUntil) dealer.setExpression(tell ? ({ 'eye-roll': 'eyeRoll' }[tell] || tell) : 'idle');
  const c = game?.cur; const target = c ? tankCellWorld(c.x+1, c.y, c.z+1).applyMatrix4(root.matrixWorld) : camTarget;
  (renderer.xr.isPresenting ? renderer.xr.getCamera() : camera).getWorldPosition(viewer);
  dealer.group.position.y = dealerHome.y + Math.sin(tAccum*1.5)*0.008;
  dealer.update(dt, { target, viewer, speak: voice.level(dt) });
  capPanel.lookAt(viewer);
  // held-piece rim glow (hands) / gentle pulse (desktop)
  const held = handInput.hands.some(h => h.grab?.kind === 'piece'); const em = curMesh.material;
  em.emissive?.setHex(held ? 0xffd890 : (MATERIAL[curName]==='obsidian' ? 0x5a0018 : 0x000000)); if (em.emissiveIntensity !== undefined) em.emissiveIntensity = held ? 0.35 + 0.15*Math.sin(tAccum*8) : 0.6;
  ghostMat.uniforms.uTime.value = tAccum;
  // envelope reveal: flip, rise, fade
  if (envelope.visible) envelope.userData.lastPos = envelope.position.clone();
  envelope.rotation.y = Math.sin(tAccum*2)*0.2; envelope.position.y += Math.sin(tAccum*3)*0.0002;
  if (revealEnv.visible) { const t = (revealEnv.userData.t += dt); revealEnv.rotation.y = t*12; revealEnv.position.lerp(tmpV.set(0, 0.25+H*S+0.02, 0), dt*4); revealEnv.material.opacity = Math.max(0, 1 - t/0.7); revealEnv.scale.setScalar(1 + t);
    if (t > 0.7) { revealEnv.visible = false; fx.burst(revealEnv.position, { n: 18, color: 0xc0283c, kind: 'spark', speed: 0.4, spread: [0.03,0.03,0.03], life: 0.5 }); } }
  // rage cube glow + trail
  rageCube.rotation.y += dt*2; rageLight.intensity = rageCube.visible ? 0.6 + 0.3*Math.sin(tAccum*6) : 0;
  if (rageCube.visible) { rageCube.material.emissiveIntensity = 0.6 + 0.4*Math.sin(tAccum*6); if (rageCube.position.distanceTo(rageHome) > 0.01 || handInput.hands.some(h=>h.grab?.kind==='rage')) trail.push(rageCube.position); }
  trail.update(dt);
  ragePips.forEach((p,i) => { const on = game && i < game.rage; p.material.color.setHex(on ? 0xff3a2a : 0x3a1818); p.scale.setScalar(on ? 1.15 + (game.rage>=RAGE_MAX ? 0.25*Math.sin(tAccum*8+i) : 0) : 1); });
  // shake (tank only, so it also works in AR) + flash decay
  if (shake > 0) { root.position.set(rootBase.x + (Math.random()-0.5)*shake, rootBase.y + (Math.random()-0.5)*shake, rootBase.z + (Math.random()-0.5)*shake); shake = Math.max(0, shake - dt*0.06); if (shake === 0) root.position.copy(rootBase); }
  if (flashT > 0) { flashT -= dt; brassM.emissiveIntensity = Math.max(0, flashT/0.4)*1.2; if (flashT <= 0) brassM.emissive.set(0); }
  fx.update(dt);
  controls.update();
  renderer.render(scene, camera);
});
addEventListener('resize', () => { camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

newGame();
window.__spite = { camera, controls, get game(){ return game; }, act, newGame, voice, dealer, express, audio, renderer };
