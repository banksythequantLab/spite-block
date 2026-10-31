import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
// "The Dealer": masked croupier. Body/head/hat/mask are a single textured mesh generated on ComfyUI
// (Qwen-Image concept -> TRELLIS.2 image-to-3D), split at runtime into body / head / jaw so the head can
// track pieces and the jaw can lip-sync. Eyes + lids are instanced overlays; gloves are merged primitives.
// Draws: body, head, jaw, mouth-inner, eyes(inst), lids(inst), 2 gloves (+ stars only when stunned).
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const URL_ = import.meta.env.BASE_URL + 'models/croupier.glb';
const gltf = await new GLTFLoader().loadAsync(URL_).catch(e => (console.warn('dealer model failed', e), null));

// ---- model-space landmarks (measured on the generated mesh, +z = face front, y up) ----
const K = 0.45;                       // model units -> metres
const CX = -0.007, EYE_Y = 0.116;     // face centre line / eye height
const NECK = new THREE.Vector3(CX, -0.09, 0.0);
const JAWP = new THREE.Vector3(CX, 0.06, -0.02);
const EYES = [[-0.075, 0.116, 0.148], [0.061, 0.116, 0.148]];
const toLocal = (x, y, z) => new THREE.Vector3((x - CX) * K, (y - EYE_Y) * K + 0.02, z * K);
const col = (g, hex) => { const c = new THREE.Color(hex); const n = g.attributes.position.count; const a = new Float32Array(n*3); for (let i=0;i<n;i++) c.toArray(a, i*3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const strip = g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position','normal','uv','color'].includes(k)) g.deleteAttribute(k); return g; };
const xf = (g, { p = [0,0,0], r = [0,0,0], s = [1,1,1] } = {}) => g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s)));

// front projection of the clean Qwen concept (the image TRELLIS was built from) onto the face: crisp mask/mustache/skin
const PROJ = new THREE.TextureLoader().load(import.meta.env.BASE_URL + 'tex/dealer_face_proj.webp'); PROJ.colorSpace = THREE.SRGBColorSpace; PROJ.anisotropy = 4;
const PX = { s: 853, cx: 510, cy: 405, x0: 330, y0: 300, w: 370, h: 350 }; // concept px per model unit, eye-centre px, crop box
const sstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t*t*(3 - 2*t); };
function addProjection(g) {
  const p = g.attributes.position, n = g.attributes.normal, out = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const px = PX.cx + (p.getX(i) - CX) * PX.s, py = PX.cy - (p.getY(i) - EYE_Y) * PX.s;
    const w = sstep(0.25, 0.6, n.getZ(i)) * sstep(345, 370, px) * sstep(675, 650, px) * sstep(318, 330, py) * sstep(640, 615, py) * (p.getZ(i) > 0.02 ? 1 : 0);
    out.set([(px - PX.x0) / PX.w, 1 - (py - PX.y0) / PX.h, w], i*3);
  }
  g.setAttribute('proj', new THREE.BufferAttribute(out, 3));
}
/** smooth normals across UV seams: average face normals per welded position */
function smoothNormals(g) {
  const p = g.attributes.position, idx = g.index.array, n = new Float32Array(p.count * 3), key = new Map(), id = new Int32Array(p.count);
  for (let i = 0; i < p.count; i++) { const k = `${Math.round(p.getX(i)*1e4)},${Math.round(p.getY(i)*1e4)},${Math.round(p.getZ(i)*1e4)}`; let v = key.get(k); if (v === undefined) key.set(k, v = key.size); id[i] = v; }
  const acc = new Float32Array(key.size * 3), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < idx.length; t += 3) { a.fromBufferAttribute(p, idx[t]); b.fromBufferAttribute(p, idx[t+1]); c.fromBufferAttribute(p, idx[t+2]);
    const f = c.sub(b).cross(a.sub(b)); for (let j = 0; j < 3; j++) { const o = id[idx[t+j]]*3; acc[o] += f.x; acc[o+1] += f.y; acc[o+2] += f.z; } }
  for (let i = 0; i < p.count; i++) { const o = id[i]*3; const v = a.set(acc[o], acc[o+1], acc[o+2]).normalize(); n.set([v.x, v.y, v.z], i*3); }
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
}
/** split the generated mesh into body / head / jaw sub-geometries (shared vertex buffers, own index lists) */
function split(src) {
  const p = src.attributes.position, idx = src.index.array, parts = { body: [], head: [], jaw: [] };
  for (let t = 0; t < idx.length; t += 3) {
    let x = 0, y = 0, z = 0; for (let j = 0; j < 3; j++) { x += p.getX(idx[t+j]); y += p.getY(idx[t+j]); z += p.getZ(idx[t+j]); } x /= 3; y /= 3; z /= 3;
    const part = (y > -0.095 && y < 0.024 && z > 0.075 && Math.abs(x - CX) < 0.085) ? 'jaw'
      : (y > -0.088 && (z > 0.0 || y > -0.03)) ? 'head' : 'body';
    parts[part].push(idx[t], idx[t+1], idx[t+2]);
  }
  const out = {};
  for (const k in parts) { const g = new THREE.BufferGeometry(); for (const a in src.attributes) g.setAttribute(a, src.attributes[a].clone()); g.setIndex(parts[k]); out[k] = g; }
  return out;
}

export class Dealer {
  constructor() {
    const g = this.group = new THREE.Group();
    this.torso = new THREE.Group(); g.add(this.torso);
    const neck = toLocal(NECK.x, NECK.y, NECK.z);
    this.face = new THREE.Group(); this.face.position.copy(neck); this.torso.add(this.face); // head pivot at neck
    let mat = new THREE.MeshStandardMaterial({ color: 0x552030 });
    let geo = null;
    if (gltf) gltf.scene.traverse(o => { if (o.isMesh && !geo) { geo = o.geometry; mat = o.material; } });
    if (geo) {
      geo = geo.clone(); smoothNormals(geo);
      mat.side = THREE.FrontSide; mat.transparent = false; mat.opacity = 1; mat.depthWrite = true;
      mat.flatShading = false; mat.needsUpdate = true; mat.metalness = 0.55; mat.roughness = 1; // driven by metallicRoughness map (gold trim/mask shine, matte velvet)
      mat.envMapIntensity = 1.2;
      addProjection(geo);
      const parts = split(geo);
      const faceMat = mat.clone(); this.faceMat = faceMat;
      faceMat.customProgramCacheKey = () => 'dealer-faceproj';
      faceMat.onBeforeCompile = sh => { sh.uniforms.projMap = { value: PROJ };
        sh.vertexShader = 'attribute vec3 proj; varying vec3 vProj;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n vProj = proj;');
        sh.fragmentShader = 'uniform sampler2D projMap; varying vec3 vProj;\n' + sh.fragmentShader
          .replace('#include <map_fragment>', '#include <map_fragment>\n vec4 pc = texture2D(projMap, vProj.xy); diffuseColor.rgb = mix(diffuseColor.rgb, pc.rgb, vProj.z);')
          .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor *= 1.0 - 0.6*vProj.z;')
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.55, vProj.z);'); };
      // body: model -> dealer-local; head: relative to neck pivot; jaw: relative to jaw pivot (inside head)
      const M = new THREE.Matrix4().makeTranslation(-CX, -EYE_Y, 0).premultiply(new THREE.Matrix4().makeScale(K, K, K)).premultiply(new THREE.Matrix4().makeTranslation(0, 0.02, 0));
      const jp = toLocal(JAWP.x, JAWP.y, JAWP.z);
      const body = new THREE.Mesh(parts.body.applyMatrix4(M), mat);
      const head = new THREE.Mesh(parts.head.applyMatrix4(M.clone().premultiply(new THREE.Matrix4().makeTranslation(-neck.x, -neck.y, -neck.z))), faceMat);
      this.parts = { body, head };
      body.castShadow = head.castShadow = true;
      this.torso.add(body); this.face.add(head);
      this._jawSrc = { jaw: parts.jaw, M, jp, neck };
      this.mat = mat; this.faceMatRef = faceMat;
    }
    // ---- jaw + inner mouth ----
    this.jaw = new THREE.Group(); this.face.add(this.jaw);
    if (geo) {
      const { jaw: jg, M, jp, neck: nk } = this._jawSrc;
      const jaw = jg.applyMatrix4(M.clone().premultiply(new THREE.Matrix4().makeTranslation(-jp.x, -jp.y, -jp.z)));
      this.jaw.position.copy(jp).sub(nk);
      const jm = new THREE.Mesh(jaw, this.faceMatRef); jm.castShadow = true; this.jaw.add(jm);
    }
    const mouthP = toLocal(CX, 0.022, 0.125).sub(neck);
    this.inner = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshBasicMaterial({ color: 0x1a0306 }));
    this.inner.position.copy(mouthP); this.inner.scale.set(0.024, 0.006, 0.014); this.face.add(this.inner);
    // ---- eyes: instanced balls (iris painted) + instanced lids, sitting in the mask's eye holes ----
    const eyeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
      x.fillStyle = '#f3ece0'; x.fillRect(0,0,256,256);
      const cx = 64, cy = 128; // +z of a SphereGeometry maps to u=0.25
      const gr = x.createRadialGradient(cx,cy,4,cx,cy,30); gr.addColorStop(0,'#0c0608'); gr.addColorStop(0.36,'#0c0608'); gr.addColorStop(0.42,'#6a2a10'); gr.addColorStop(0.85,'#b07a2a'); gr.addColorStop(1,'#2a120a');
      x.fillStyle = gr; x.beginPath(); x.ellipse(cx,cy,26,30,0,0,7); x.fill(); x.fillStyle = 'rgba(255,255,255,0.95)'; x.beginPath(); x.arc(cx+7,cy-9,4.5,0,7); x.fill();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const R = 0.0205 * K;
    this.eyeMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(R, 20, 14), new THREE.MeshPhysicalMaterial({ map: eyeTex, roughness: 0.1, clearcoat: 1 }), 2);
    this.lidMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(R * 1.12, 16, 8, 0, Math.PI*2, 0, Math.PI/2), new THREE.MeshStandardMaterial({ color: 0x0d0a0c, roughness: 0.35, metalness: 0.4 }), 2);
    this.face.add(this.eyeMesh, this.lidMesh);
    this.eyes = EYES.map(([x, y, z], i) => ({ i, s: i ? 1 : -1, pos: toLocal(x, y, z).sub(neck), look: new THREE.Vector2(), lidAmt: 0.25 }));
    // ---- white gloves with gold cuff rings: one merged mesh per hand ----
    const gloveM = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.55, sheen: 1, sheenColor: new THREE.Color(0xffffff) });
    const gloveGeo = s => mergeGeometries([
      xf(col(new THREE.SphereGeometry(0.022, 14, 10), 0xf6f3ec), { s: [1.05, 0.55, 1.15] }),
      ...[-1.5,-0.5,0.5,1.5].map(i => xf(col(new THREE.CapsuleGeometry(0.005, 0.022 - Math.abs(i)*0.002, 3, 8), 0xf6f3ec), { p: [i*0.0098, -0.002, 0.03], r: [Math.PI/2 + 0.2, 0, 0] })),
      xf(col(new THREE.CapsuleGeometry(0.0055, 0.013, 3, 8), 0xf6f3ec), { p: [-s*0.023, 0, 0.012], r: [0, 0, s*1.2] }),
      xf(col(new THREE.CylinderGeometry(0.018, 0.021, 0.022, 14), 0x2a0810), { p: [0, 0, -0.03], r: [Math.PI/2, 0, 0] }),
      xf(col(new THREE.TorusGeometry(0.0185, 0.002, 6, 18), 0xd8a640), { p: [0, 0, -0.02] }),
    ].map(strip));
    this.hands = [-1, 1].map(s => { const h = new THREE.Mesh(gloveGeo(s), gloveM); h.castShadow = true; g.add(h); return { s, h }; });
    // ---- dizzy stars (1 instanced draw, only while stunned) ----
    this.stars = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.011), new THREE.MeshBasicMaterial({ color: 0xffe066 }), 5); this.stars.position.y = 0.17; g.add(this.stars); this.stars.visible = false;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._v = new THREE.Vector3(); this._one = new THREE.Vector3(1,1,1);
    this.expr = 'idle'; this.t = 0; this.blink = 0; this.nextBlink = 2; this.hit = 0; this.mouthOpen = 0; this.tilt = 0;
    this.headYaw = 0; this.headPitch = 0;
  }
  setExpression(e) { this.expr = e; }
  hitImpact() { this.hit = 1; }
  /** card-flick: right glove snaps up and forward */
  flick() { this.flickT = 1; }
  /** world position of the right glove's fingertips (card origin) */
  gloveTip(out = new THREE.Vector3()) { const h = this.hands.find(x => x.s > 0).h; h.updateWorldMatrix(true, false); return h.localToWorld(out.set(0, 0, 0.03)); }
  /** target: world position to look at (active piece); viewer: camera world pos; speak: mouth level 0..1 */
  update(dt, { target, viewer, speak = 0 }) {
    this.t += dt; const t = this.t, e = this.expr;
    this.group.lookAt(viewer);
    const local = this.group.worldToLocal(target.clone()).sub(this.face.position); const dir = local.normalize();
    let lx = THREE.MathUtils.clamp(dir.x * 1.6, -1, 1), ly = THREE.MathUtils.clamp(dir.y * 1.6, -1, 1);
    let lid = 0.15, open = speak * 0.9, tilt = 0, pitch = 0, handY = 0, drum = false, spin = 0, headFollow = 0.35, jawSkew = 0;
    if (e === 'smirk') { lid = 0.45; tilt = 0.14; jawSkew = 0.08; pitch = 0.06; }
    if (e === 'eyeRoll') { lx = Math.cos(t*4) * 0.9; ly = 0.6 + Math.sin(t*4) * 0.4; lid = 0.3; pitch = -0.12; tilt = -0.08; headFollow = 0; }
    if (e === 'yawn') { const y = (Math.sin(t*1.6)+1)/2; open = Math.max(open, 0.3 + y*0.7); lid = 0.5 + y*0.4; pitch = -0.18*y; tilt = -0.06*y; headFollow = 0; }
    if (e === 'drumroll') { drum = true; ly = -0.7; lx = 0; pitch = 0.12; lid = 0.2; }
    if (e === 'gloat') { open = Math.max(open, 0.35 + 0.35*Math.abs(Math.sin(t*9))); pitch = -0.1 + Math.abs(Math.sin(t*9))*-0.06; tilt = Math.sin(t*9)*0.07; handY = Math.abs(Math.sin(t*9))*0.025; lid = 0.3; }
    if (e === 'flustered') { lid = 0; tilt = Math.sin(t*20)*0.05; lx = Math.sin(t*13)*0.8; spin = Math.sin(t*17)*0.06; open = Math.max(open, 0.15); }
    if (e === 'stunned') { lx = Math.cos(t*7); ly = Math.sin(t*7); lid = 0.35; open = Math.max(open, 0.4); spin = Math.sin(t*5)*0.3; headFollow = 0; }
    if (e === 'grumpy') { lid = 0.5; pitch = 0.12; open = Math.min(open, 0.25); headFollow = 0.2; }
    this.nextBlink -= dt; if (this.nextBlink < 0) { this.blink = 1; this.nextBlink = 2 + Math.random()*3; }
    this.blink = Math.max(0, this.blink - dt*8);
    for (const eye of this.eyes) {
      eye.look.x = damp(eye.look.x, lx, 10, dt); eye.look.y = damp(eye.look.y, ly, 10, dt);
      this._q.setFromEuler(this._e.set(-eye.look.y*0.45, eye.look.x*0.55, 0)); this._m.compose(eye.pos, this._q, this._one); this.eyeMesh.setMatrixAt(eye.i, this._m);
      eye.lidAmt = damp(eye.lidAmt, Math.max(lid, this.blink), 18, dt);
      const tiltLid = e === 'grumpy' ? eye.s * 0.35 : e === 'smirk' ? eye.s * -0.2 : 0;
      this._q.setFromEuler(this._e.set(-Math.PI/2 + eye.lidAmt * Math.PI * 0.55 + 0.2, 0, tiltLid)); this._m.compose(eye.pos, this._q, this._one); this.lidMesh.setMatrixAt(eye.i, this._m);
    }
    this.eyeMesh.instanceMatrix.needsUpdate = this.lidMesh.instanceMatrix.needsUpdate = true;
    // jaw / visemes: open angle + slight skew for the smirk
    this.mouthOpen = damp(this.mouthOpen, open, 25, dt);
    this.jaw.rotation.set(this.mouthOpen * 0.16, 0, jawSkew);
    this.inner.scale.set(0.024 * (1 - this.mouthOpen*0.2), 0.004 + this.mouthOpen*0.016, 0.014);
    this.hit = Math.max(0, this.hit - dt*2); this.flickT = Math.max(0, (this.flickT||0) - dt*2.5);
    this.tilt = damp(this.tilt, tilt, 6, dt);
    // head tracks the active piece (partly), plus idle drift, expression pose and hit recoil
    this.headYaw = damp(this.headYaw, lx * headFollow * 0.5 + Math.sin(t*0.7)*0.06, 5, dt);
    this.headPitch = damp(this.headPitch, -ly * headFollow * 0.25 + pitch, 5, dt);
    this.face.rotation.set(this.headPitch - this.hit*0.5*Math.sin(this.hit*20), this.headYaw, this.tilt + spin);
    this.face.position.z = toLocal(NECK.x, NECK.y, NECK.z).z - this.hit*0.03;
    // idle sway / breathing
    this.torso.rotation.y = Math.sin(t*0.7)*0.035; this.torso.rotation.z = Math.sin(t*0.5)*0.012; this.torso.position.y = Math.sin(t*1.5)*0.003;
    this.hands.forEach((hd, i) => {
      const tap = drum ? Math.max(0, Math.sin(t*22 + i*1.7)) : 0;
      hd.h.position.set(hd.s*0.13, -0.1 + Math.sin(t*1.8 + i*1.3)*0.006 + handY - tap*0.012, 0.08); hd.h.rotation.set(tap*0.4, 0, Math.sin(t*1.2+i)*0.15);
      if (hd.s > 0) { const f = Math.sin((1 - this.flickT) * Math.PI) * (this.flickT > 0 ? 1 : 0); hd.h.position.y += f*0.06; hd.h.position.z = 0.08 + f*0.06; hd.h.rotation.x = -f*1.2; }
    });
    this.stars.visible = e === 'stunned';
    if (this.stars.visible) { for (let i=0;i<5;i++) { const a = t*4 + i*1.2566; this._q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, t*5); this._m.compose(this._v.set(Math.cos(a)*0.09, Math.sin(t*6+i)*0.01, Math.sin(a)*0.09), this._q, this._one); this.stars.setMatrixAt(i, this._m); } this.stars.instanceMatrix.needsUpdate = true; }
  }
}
