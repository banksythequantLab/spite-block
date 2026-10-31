import * as THREE from 'three';
// "The Dealer": procedural porcelain mask with brows, tracking eyes, eyelids, lip-synced mouth and floating gloves.
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export class Dealer {
  constructor() {
    const g = this.group = new THREE.Group();
    this.face = new THREE.Group(); g.add(this.face);
    const porcelain = new THREE.MeshPhysicalMaterial({ color: 0xf4ede4, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15, sheen: 0.3 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 40, 30), porcelain); head.scale.set(1, 1.18, 0.78); head.castShadow = true; this.face.add(head);
    const chin = new THREE.Mesh(new THREE.SphereGeometry(0.04, 24, 16), porcelain); chin.position.set(0, -0.065, 0.02); chin.scale.set(1.1, 0.8, 0.9); this.face.add(chin);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.03, 12), porcelain); nose.rotation.x = Math.PI/2.4; nose.position.set(0, 0.0, 0.062); this.face.add(nose);
    // gold-leaf cheek swirls + beauty mark for character
    const gold = new THREE.MeshStandardMaterial({ color: 0xd4a547, metalness: 1, roughness: 0.3 });
    [-1, 1].forEach(s => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0018, 6, 20, Math.PI*1.4), gold); t.position.set(s*0.042, -0.018, 0.048); t.rotation.set(0, s*0.5, s); this.face.add(t); });
    const hat = new THREE.Group(); hat.position.set(0, 0.085, -0.005); hat.rotation.z = -0.18; this.face.add(hat);
    const felt = new THREE.MeshStandardMaterial({ color: 0x241820, roughness: 0.7 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.006, 32), felt); hat.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.06, 32), felt); crown.position.y = 0.032; hat.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0505, 0.0505, 0.012, 32), new THREE.MeshStandardMaterial({ color: 0x8b1a2b, roughness: 0.5 })); band.position.y = 0.012; hat.add(band);
    // eyes
    const white = new THREE.MeshStandardMaterial({ color: 0xfffaf2, roughness: 0.2 });
    const pupilM = new THREE.MeshPhysicalMaterial({ color: 0x150d18, roughness: 0.1, clearcoat: 1 });
    const lidM = porcelain;
    this.eyes = [-1, 1].map(s => {
      const socket = new THREE.Group(); socket.position.set(s*0.027, 0.02, 0.05); this.face.add(socket);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.014, 20, 16), white); ball.scale.z = 0.6; socket.add(ball);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 16, 12), pupilM); pupil.position.z = 0.008; pupil.scale.z = 0.5; socket.add(pupil);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.0016, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); glint.position.set(0.002, 0.002, 0.011); socket.add(glint);
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.0155, 20, 12, 0, Math.PI*2, 0, Math.PI/2), lidM); lid.scale.z = 0.7; socket.add(lid);
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.0028, 0.022, 4, 8), new THREE.MeshStandardMaterial({ color: 0x2a1a22, roughness: 0.6 }));
      brow.rotation.z = Math.PI/2; brow.position.set(0, 0.022, 0.006); socket.add(brow);
      return { s, socket, pupil, glint, lid, brow, look: new THREE.Vector2(), lidAmt: 0.25, browY: 0, browRot: 0 };
    });
    // mouth: lips (torus arc) + dark interior whose height = openness
    this.mouthG = new THREE.Group(); this.mouthG.position.set(0, -0.038, 0.058); this.face.add(this.mouthG);
    const lipM = new THREE.MeshPhysicalMaterial({ color: 0x8e1830, roughness: 0.3, clearcoat: 0.8 });
    this.inner = new THREE.Mesh(new THREE.SphereGeometry(0.018, 20, 12), new THREE.MeshBasicMaterial({ color: 0x2a0710 })); this.inner.scale.set(1, 0.15, 0.3); this.mouthG.add(this.inner);
    this.lipTop = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.0035, 8, 24, Math.PI), lipM); this.mouthG.add(this.lipTop);
    this.lipBot = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 8, 24, Math.PI), lipM); this.lipBot.rotation.z = Math.PI; this.mouthG.add(this.lipBot);
    // gloved hands
    const glove = new THREE.MeshPhysicalMaterial({ color: 0xfbfbf8, roughness: 0.55, sheen: 1, sheenColor: new THREE.Color(0xffffff) });
    this.hands = [-1, 1].map(s => {
      const h = new THREE.Group(); h.position.set(s*0.13, -0.07, 0.04); g.add(h);
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), glove); palm.scale.set(1, 0.55, 1.1); palm.castShadow = true; h.add(palm);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.018, 16), new THREE.MeshStandardMaterial({ color: 0x241820, roughness: 0.7 })); cuff.rotation.x = Math.PI/2; cuff.position.z = -0.028; h.add(cuff);
      const fingers = [-1.5,-0.5,0.5,1.5].map(i => { const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.005, 0.018, 4, 8), glove); f.rotation.x = Math.PI/2; f.position.set(i*0.0095, -0.002, 0.028); h.add(f); return f; });
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0055, 0.012, 4, 8), glove); thumb.position.set(-s*0.022, 0, 0.008); thumb.rotation.z = s*1.2; h.add(thumb);
      return { s, h, fingers };
    });
    // stars
    this.stars = new THREE.Group(); this.stars.position.y = 0.12; g.add(this.stars);
    for (let i=0;i<5;i++) this.stars.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.011), new THREE.MeshBasicMaterial({ color: 0xffe066 })));
    this.stars.visible = false;
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
    // look direction in face-local space
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
    // blink
    this.nextBlink -= dt; if (this.nextBlink < 0) { this.blink = 1; this.nextBlink = 2 + Math.random()*3; }
    this.blink = Math.max(0, this.blink - dt*8);
    for (const eye of this.eyes) {
      eye.look.x = damp(eye.look.x, lx, 10, dt); eye.look.y = damp(eye.look.y, ly, 10, dt);
      eye.pupil.position.set(eye.look.x*0.006, eye.look.y*0.005, 0.008); eye.glint.position.set(eye.look.x*0.006+0.002, eye.look.y*0.005+0.002, 0.011);
      eye.lidAmt = damp(eye.lidAmt, Math.max(lid, this.blink), 18, dt);
      eye.lid.rotation.x = -Math.PI/2 + eye.lidAmt * Math.PI * 0.55 + 0.25; // rotates down over the eyeball
      eye.browY = damp(eye.browY, browY, 10, dt); eye.browRot = damp(eye.browRot, browRot * (e==='smirk' ? (eye.s>0?1:-0.3) : 1), 10, dt);
      eye.brow.position.y = 0.022 + eye.browY; eye.brow.rotation.z = Math.PI/2 + eye.s * -eye.browRot;
    }
    this.mouthOpen = damp(this.mouthOpen, open, 25, dt); this.smile = damp(this.smile, smile, 8, dt);
    this.inner.scale.set(1 - this.mouthOpen*0.25, 0.12 + this.mouthOpen*0.9, 0.3);
    this.lipTop.position.y = this.mouthOpen*0.008; this.lipBot.position.y = -this.mouthOpen*0.01;
    this.lipTop.scale.y = 0.35 - this.smile*0.25; this.lipBot.scale.y = 0.2 + Math.max(0,this.smile)*0.6;
    this.mouthG.rotation.z = e === 'smirk' ? 0.2 : 0;
    // head motion
    this.hit = Math.max(0, this.hit - dt*2); this.flickT = Math.max(0, (this.flickT||0) - dt*2.5);
    this.tilt = damp(this.tilt, tilt, 6, dt);
    this.face.rotation.set(-this.hit*0.6*Math.sin(this.hit*20), Math.sin(t*0.7)*0.08, this.tilt + spin);
    this.face.position.z = -this.hit*0.03;
    this.hands.forEach((hd, i) => {
      hd.h.position.y = -0.07 + Math.sin(t*1.8 + i*1.3)*0.006 + handY; hd.h.rotation.z = Math.sin(t*1.2+i)*0.15;
      if (hd.s > 0) { const f = Math.sin((1 - this.flickT) * Math.PI) * (this.flickT > 0 ? 1 : 0); hd.h.position.y += f*0.05; hd.h.position.z = 0.04 + f*0.05; hd.h.rotation.x = -f*1.2; }
      hd.fingers.forEach((f, j) => { f.rotation.y = drum ? Math.max(0, Math.sin(t*22 - j*0.9)) * 0.7 : 0.08; f.position.y = -0.002 - (drum ? Math.max(0, Math.sin(t*22 - j*0.9))*0.006 : 0); });
    });
    this.stars.visible = e === 'stunned';
    if (this.stars.visible) this.stars.children.forEach((s,i)=>{ const a = t*4 + i*1.2566; s.position.set(Math.cos(a)*0.08, Math.sin(t*6+i)*0.01, Math.sin(a)*0.08); s.rotation.y = t*5; });
  }
}
