import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
// "The Dealer": masked croupier bust. Generated-art textures (public/tex), merged static meshes (~16 draws),
// tracking eyes, eyelids, brows, lip-synced mouth and gloved hands.
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const BASE = import.meta.env.BASE_URL + 'tex/';
const loader = new THREE.TextureLoader();
const tex = (f, srgb = true, rep = 1) => { const t = loader.load(BASE + f); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); } return t; };
// face texture placement (planar projection, face-local metres)
export const MASK = { cx: 0, cy: 0.0184, size: 0.1315 };
const col = (g, hex) => { const c = new THREE.Color(hex); const n = g.attributes.position.count; const a = new Float32Array(n*3); for (let i=0;i<n;i++) c.toArray(a, i*3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const strip = g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position','normal','uv','color'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2), 2)); return g; };
const lathe = (pts, seg = 40) => new THREE.LatheGeometry(pts.map(([x,y]) => new THREE.Vector2(x,y)), seg);
const xf = (g, { p = [0,0,0], r = [0,0,0], s = [1,1,1] } = {}) => g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s)));
const merge = parts => mergeGeometries(parts.map(strip));

export class Dealer {
  constructor() {
    const g = this.group = new THREE.Group();
    this.face = new THREE.Group(); g.add(this.face);
    // ---- head: sculpted lathe skull + jaw, mask art projected on the front ----
    const head = lathe([[0,-0.092],[0.024,-0.088],[0.042,-0.074],[0.053,-0.052],[0.06,-0.025],[0.066,0.005],[0.068,0.035],[0.064,0.062],[0.052,0.085],[0.032,0.1],[0,0.106]], 48);
    xf(head, { s: [1.04, 0.92, 0.86] });
    { // flatten cheeks a touch + push brow/nose forward for a real face profile
      const p = head.attributes.position, uv = head.attributes.uv;
      for (let i=0;i<p.count;i++) { let x=p.getX(i), y=p.getY(i), z=p.getZ(i);
        if (z > 0) { const nose = Math.exp(-((x/0.012)**2) - (((y+0.005)/0.022)**2)) * 0.014; const brow = Math.exp(-(((y-0.032)/0.012)**2)) * 0.004; z += nose + brow * (z/0.058); }
        p.setZ(i, z); uv.setXY(i, (x - MASK.cx)/MASK.size + 0.5, (y - MASK.cy)/MASK.size + 0.5); }
      head.computeVertexNormals();
    }
    this.faceMat = new THREE.MeshPhysicalMaterial({ map: tex('dealer_face.jpg'), color: 0xcdc2b8, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25 });
    const headM = new THREE.Mesh(head, this.faceMat); headM.castShadow = true; this.face.add(headM);
    // ---- top hat + band + ear/hair shell + collar ruff: one vertex-colored mesh ----
    const hatG = lathe([[0,0],[0.082,0],[0.088,0.004],[0.084,0.008],[0.05,0.009],[0.048,0.012],[0.05,0.075],[0.052,0.078],[0,0.078]], 40);
    const bandG = lathe([[0.0485,0.011],[0.0505,0.012],[0.0515,0.026],[0.0495,0.027]], 40);
    const hair = new THREE.SphereGeometry(0.069, 32, 16, 0, Math.PI*2, 0, Math.PI*0.62); xf(hair, { p: [0, 0.006, -0.008], r: [-0.5, 0, 0], s: [1.01, 1.03, 0.9] });
    const solid = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(0x553040) });
    const hatMesh = new THREE.Mesh(merge([
      xf(col(hatG, 0x121014), { p: [0, 0.088, -0.006], r: [-0.08, 0, -0.16] }),
      xf(col(bandG, 0x8a1022), { p: [0, 0.088, -0.006], r: [-0.08, 0, -0.16] }),
      col(hair, 0x1a1216),
    ]), solid); hatMesh.castShadow = true; this.face.add(hatMesh);
    // ---- eyes: one textured ball rotates (iris+glint painted), lid + brow ----
    const eyeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
      x.fillStyle = '#f6efe4'; x.fillRect(0,0,256,256);
      const cx = 64, cy = 128; // +z of a SphereGeometry maps to u=0.25
      let gr = x.createRadialGradient(cx,cy,4,cx,cy,34); gr.addColorStop(0,'#120a0c'); gr.addColorStop(0.32,'#120a0c'); gr.addColorStop(0.36,'#7a1626'); gr.addColorStop(0.8,'#c8902e'); gr.addColorStop(1,'#2a0c10');
      x.fillStyle = gr; x.beginPath(); x.ellipse(cx,cy,30,30,0,0,7); x.fill(); x.fillStyle = 'rgba(255,255,255,0.95)'; x.beginPath(); x.arc(cx+8,cy-9,5,0,7); x.fill();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const eyeM = new THREE.MeshPhysicalMaterial({ map: eyeTex, roughness: 0.12, clearcoat: 1 });
    const lidM = new THREE.MeshStandardMaterial({ color: 0x14090c, roughness: 0.4, metalness: 0.2 });
    const browM = new THREE.MeshStandardMaterial({ color: 0x0e0709, roughness: 0.5 });
    this.eyes = [-1, 1].map(s => {
      const socket = new THREE.Group(); socket.position.set(s*0.026, 0.02, 0.046); this.face.add(socket);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 24, 16), eyeM); ball.scale.z = 0.8; socket.add(ball);
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.0138, 20, 12, 0, Math.PI*2, 0, Math.PI/2), lidM); lid.scale.z = 0.85; socket.add(lid);
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.0022, 0.02, 4, 8), browM);
      brow.rotation.z = Math.PI/2; brow.position.set(0, 0.02, 0.008); socket.add(brow);
      return { s, socket, ball, lid, brow, look: new THREE.Vector2(), lidAmt: 0.25, browY: 0, browRot: 0 };
    });
    // ---- mouth ----
    this.mouthG = new THREE.Group(); this.mouthG.position.set(0, -0.046, 0.05); this.face.add(this.mouthG);
    const lipM = new THREE.MeshPhysicalMaterial({ color: 0x7a0f24, roughness: 0.25, clearcoat: 1 });
    this.inner = new THREE.Mesh(new THREE.SphereGeometry(0.014, 20, 12), new THREE.MeshBasicMaterial({ color: 0x1c0408 })); this.inner.scale.set(1, 0.15, 0.3); this.mouthG.add(this.inner);
    this.lipTop = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0028, 8, 24, Math.PI), lipM); this.mouthG.add(this.lipTop);
    this.lipBot = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0034, 8, 24, Math.PI), lipM); this.lipBot.rotation.z = Math.PI; this.mouthG.add(this.lipBot);
    // ---- torso: velvet vest/jacket (textured) + shirt, lapels, bowtie, buttons, neck (vertex-colored) ----
    const torso = new THREE.Group(); torso.position.set(0, -0.1, -0.02); g.add(torso); this.torso = torso;
    const jacketG = lathe([[0.028,0.03],[0.04,0.022],[0.085,0.0],[0.112,-0.03],[0.122,-0.07],[0.118,-0.13],[0.11,-0.2],[0,-0.2]], 40); xf(jacketG, { s: [1, 1, 0.6] });
    this.jacket = new THREE.Mesh(jacketG, new THREE.MeshPhysicalMaterial({ map: tex('velvet.jpg', true, 3), color: 0xa08890, roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(0x8a3048), sheenRoughness: 0.5 }));
    torso.add(this.jacket);
    const shirt = new THREE.CylinderGeometry(0.001, 0.04, 0.11, 3, 1, false, -Math.PI/3, Math.PI*2/3); // triangular bib
    const neck = new THREE.CylinderGeometry(0.024, 0.03, 0.05, 20);
    const collar = new THREE.TorusGeometry(0.029, 0.006, 8, 24);
    const lapL = new THREE.BoxGeometry(0.028, 0.1, 0.004), lapR = lapL.clone();
    const bowL = new THREE.ConeGeometry(0.013, 0.026, 4), bowR = bowL.clone(), knot = new THREE.SphereGeometry(0.0055, 10, 8);
    const btn = i => xf(col(new THREE.SphereGeometry(0.004, 8, 6), 0xd8a640), { p: [0, -0.075 - i*0.022, 0.07] });
    this.body = new THREE.Mesh(merge([
      xf(col(shirt, 0xeee6d8), { p: [0, -0.035, 0.06], r: [Math.PI + 0.12, 0, 0], s: [1, 1, 0.5] }),
      xf(col(neck, 0xd9d0c6), { p: [0, 0.035, 0] }),
      xf(col(collar, 0xf2ece0), { p: [0, 0.018, 0.004], r: [Math.PI/2 - 0.2, 0, 0], s: [1, 1, 1.2] }),
      xf(col(lapL, 0x0c0a0e), { p: [-0.032, -0.03, 0.064], r: [-0.12, 0.35, -0.42] }),
      xf(col(lapR, 0x0c0a0e), { p: [0.032, -0.03, 0.064], r: [-0.12, -0.35, 0.42] }),
      xf(col(bowL, 0x9a0f24), { p: [-0.014, 0.006, 0.05], r: [0, 0, Math.PI/2] }),
      xf(col(bowR, 0x9a0f24), { p: [0.014, 0.006, 0.05], r: [0, 0, -Math.PI/2] }),
      xf(col(knot, 0x7a0a1c), { p: [0, 0.006, 0.053] }), btn(0), btn(1), btn(2),
    ]), solid);
    torso.add(this.body);
    // ---- gloves: one merged mesh per hand (palm, fingers, thumb, cuff) ----
    const gloveM = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.6, sheen: 1, sheenColor: new THREE.Color(0xffffff) });
    const gloveGeo = s => merge([
      xf(col(new THREE.SphereGeometry(0.02, 16, 12), 0xf6f3ec), { s: [1.05, 0.5, 1.1] }),
      ...[-1.5,-0.5,0.5,1.5].map(i => xf(col(new THREE.CapsuleGeometry(0.0046, 0.02 - Math.abs(i)*0.002, 4, 8), 0xf6f3ec), { p: [i*0.0092, -0.002, 0.028], r: [Math.PI/2 + 0.15, 0, 0] })),
      xf(col(new THREE.CapsuleGeometry(0.005, 0.012, 4, 8), 0xf6f3ec), { p: [-s*0.021, 0, 0.01], r: [0, 0, s*1.2] }),
      xf(col(new THREE.CylinderGeometry(0.016, 0.019, 0.02, 16), 0x0c0a0e), { p: [0, 0, -0.028], r: [Math.PI/2, 0, 0] }),
      xf(col(new THREE.TorusGeometry(0.0165, 0.0018, 6, 20), 0xd8a640), { p: [0, 0, -0.018] }),
    ]);
    this.hands = [-1, 1].map(s => { const h = new THREE.Mesh(gloveGeo(s), gloveM); h.castShadow = true; h.position.set(s*0.13, -0.07, 0.04); g.add(h); return { s, h }; });
    // ---- dizzy stars (1 instanced draw) ----
    this.stars = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.011), new THREE.MeshBasicMaterial({ color: 0xffe066 }), 5); this.stars.position.y = 0.12; g.add(this.stars); this.stars.visible = false;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion();
    this.expr = 'idle'; this.t = 0; this.blink = 0; this.nextBlink = 2; this.hit = 0; this.mouthOpen = 0; this.smile = 0.3; this.tilt = 0;
  }
  setExpression(e) { this.expr = e; }
  hitImpact() { this.hit = 1; }
  /** card-flick: right glove snaps up and forward */
  flick() { this.flickT = 1; }
  /** target: world position to look at (active piece); viewer: camera world pos; speak: mouth level 0..1 */
  update(dt, { target, viewer, speak = 0 }) {
    this.t += dt; const t = this.t, e = this.expr;
    this.group.lookAt(viewer);
    const local = this.face.worldToLocal(target.clone()); const dir = local.normalize();
    let lx = THREE.MathUtils.clamp(dir.x * 1.6, -1, 1), ly = THREE.MathUtils.clamp(dir.y * 1.6, -1, 1);
    let lid = 0.2, browY = 0, browRot = 0, smile = 0.35, open = speak, tilt = 0, handY = 0, drum = false, spin = 0;
    if (e === 'smirk') { smile = 0.9; browRot = 0.35; lid = 0.45; tilt = 0.12; }
    if (e === 'eyeRoll') { lx = Math.cos(t*4) * 0.9; ly = 0.6 + Math.sin(t*4) * 0.4; lid = 0.3; browY = 0.004; smile = 0.1; }
    if (e === 'yawn') { const y = (Math.sin(t*1.6)+1)/2; open = Math.max(open, 0.3 + y*0.7); lid = 0.5 + y*0.4; browY = 0.004*y; smile = 0; tilt = -0.08*y; }
    if (e === 'drumroll') { drum = true; ly = -0.7; lx = 0; smile = 0.6; browY = -0.003; }
    if (e === 'gloat') { smile = 1; open = Math.max(open, 0.4 + 0.3*Math.abs(Math.sin(t*9))); browY = 0.006; browRot = -0.2; tilt = Math.sin(t*9)*0.08; handY = Math.abs(Math.sin(t*9))*0.02; }
    if (e === 'flustered') { smile = -0.6; browY = 0.006; browRot = -0.4; lid = 0; tilt = Math.sin(t*20)*0.05; }
    if (e === 'stunned') { lx = Math.cos(t*7); ly = Math.sin(t*7); lid = 0.35; smile = -0.3; open = Math.max(open, 0.35); spin = Math.sin(t*5)*0.45; }
    if (e === 'grumpy') { smile = -0.5; browRot = -0.35; lid = 0.4; }
    this.nextBlink -= dt; if (this.nextBlink < 0) { this.blink = 1; this.nextBlink = 2 + Math.random()*3; }
    this.blink = Math.max(0, this.blink - dt*8);
    for (const eye of this.eyes) {
      eye.look.x = damp(eye.look.x, lx, 10, dt); eye.look.y = damp(eye.look.y, ly, 10, dt);
      eye.ball.rotation.set(-eye.look.y*0.45, eye.look.x*0.5, 0);
      eye.lidAmt = damp(eye.lidAmt, Math.max(lid, this.blink), 18, dt);
      eye.lid.rotation.x = -Math.PI/2 + eye.lidAmt * Math.PI * 0.55 + 0.25;
      eye.browY = damp(eye.browY, browY, 10, dt); eye.browRot = damp(eye.browRot, browRot * (e==='smirk' ? (eye.s>0?1:-0.3) : 1), 10, dt);
      eye.brow.position.y = 0.02 + eye.browY; eye.brow.rotation.z = Math.PI/2 + eye.s * -eye.browRot;
    }
    this.mouthOpen = damp(this.mouthOpen, open, 25, dt); this.smile = damp(this.smile, smile, 8, dt);
    this.inner.scale.set(1 - this.mouthOpen*0.25, 0.12 + this.mouthOpen*0.9, 0.3);
    this.lipTop.position.y = this.mouthOpen*0.007; this.lipBot.position.y = -this.mouthOpen*0.009;
    this.lipTop.scale.y = 0.35 - this.smile*0.25; this.lipBot.scale.y = 0.2 + Math.max(0,this.smile)*0.6;
    this.mouthG.rotation.z = e === 'smirk' ? 0.2 : 0;
    this.hit = Math.max(0, this.hit - dt*2); this.flickT = Math.max(0, (this.flickT||0) - dt*2.5);
    this.tilt = damp(this.tilt, tilt, 6, dt);
    this.face.rotation.set(-this.hit*0.6*Math.sin(this.hit*20), Math.sin(t*0.7)*0.08, this.tilt + spin);
    this.face.position.z = -this.hit*0.03;
    this.torso.rotation.y = Math.sin(t*0.7)*0.03; this.torso.position.y = -0.1 + Math.sin(t*1.5)*0.002;
    this.hands.forEach((hd, i) => {
      const tap = drum ? Math.max(0, Math.sin(t*22 + i*1.7)) : 0;
      hd.h.position.set(hd.s*0.13, -0.07 + Math.sin(t*1.8 + i*1.3)*0.006 + handY - tap*0.008, 0.04); hd.h.rotation.set(tap*0.3, 0, Math.sin(t*1.2+i)*0.15);
      if (hd.s > 0) { const f = Math.sin((1 - this.flickT) * Math.PI) * (this.flickT > 0 ? 1 : 0); hd.h.position.y += f*0.05; hd.h.position.z = 0.04 + f*0.05; hd.h.rotation.x = -f*1.2; }
    });
    this.stars.visible = e === 'stunned';
    if (this.stars.visible) for (let i=0;i<5;i++) { const a = t*4 + i*1.2566; this._q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, t*5); this._m.compose(new THREE.Vector3(Math.cos(a)*0.08, Math.sin(t*6+i)*0.01, Math.sin(a)*0.08), this._q, new THREE.Vector3(1,1,1)); this.stars.setMatrixAt(i, this._m); }
    if (this.stars.visible) this.stars.instanceMatrix.needsUpdate = true;
  }
}
