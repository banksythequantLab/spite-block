import * as THREE from 'three';
// Pooled, instanced particles (1 draw call each) — Quest friendly.
// Hard cap: 130 shards + 130 sparks + 40 coins = 300 particles, 3 draw calls; + 3 pooled shockwave rings.
export class FX {
  constructor(parent, caps = { shard: 130, spark: 130, coin: 40 }) {
    this.parent = parent; this.caps = caps;
    this.shards = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.009), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.3, roughness: 0.2, emissive: 0x220a00 }), caps.shard);
    this.sparks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.003, 0.003, 0.012), new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }), caps.spark);
    this.coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.009, 0.009, 0.002, 14), new THREE.MeshStandardMaterial({ color: 0xffd36a, metalness: 1, roughness: 0.25, emissive: 0x3a2400 }), caps.coin);
    for (const m of [this.shards, this.sparks, this.coins]) { m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); parent.add(m); }
    this.lists = { shard: [], spark: [], coin: [] };
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.c = new THREE.Color(); this.sc = new THREE.Vector3(); this.z = new THREE.Vector3(0,0,1); this.tv = new THREE.Vector3();
    this.flashes = [];
    this.rings = [0,1,2].map(() => { const r = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); r.rotation.x = -Math.PI/2; r.visible = false; parent.add(r); return { r, age: 9, life: 0.5, size: 0.2 }; });
  }
  burst(pos, { n = 40, color = 0xe7b65c, colors = null, speed = 0.6, spread = [0.1, 0.01, 0.1], life = 1.1, kind = 'shard' } = {}) {
    const list = this.lists[kind], cap = this.caps[kind];
    for (let i = 0; i < n; i++) {
      if (list.length >= cap) list.shift(); // recycle oldest instead of dropping new juice
      const p = new THREE.Vector3(pos.x + (Math.random()-0.5)*spread[0], pos.y + (Math.random()-0.5)*spread[1], pos.z + (Math.random()-0.5)*spread[2]);
      const v = new THREE.Vector3(Math.random()-0.5, Math.random()*0.8 + 0.2, Math.random()-0.5).normalize().multiplyScalar(speed*(0.4+Math.random()));
      const col = colors ? colors[i % colors.length] : color;
      list.push({ p, v, life: life*(0.7+Math.random()*0.5), age: 0, rot: new THREE.Euler(Math.random()*6, Math.random()*6, 0), spin: Math.random()*12, color: new THREE.Color(col).offsetHSL(0, 0, (Math.random()-0.5)*0.15) });
    }
  }
  ring(pos, { color = 0xffe6a0, size = 0.25, life = 0.5 } = {}) { const r = this.rings.reduce((a, b) => (b.age > a.age ? b : a)); r.r.position.copy(pos); r.r.material.color.set(color); r.age = 0; r.life = life; r.size = size; r.r.visible = true; }
  flash(mesh) { this.flashes.push({ mesh, age: 0 }); mesh.visible = true; }
  get count() { return this.lists.shard.length + this.lists.spark.length + this.lists.coin.length; }
  update(dt) {
    const step = (list, inst, kind) => {
      for (let i = list.length - 1; i >= 0; i--) { const s = list[i]; s.age += dt; if (s.age > s.life) { list.splice(i, 1); continue; }
        s.v.y -= (kind === 'spark' ? 1.2 : 2.2) * dt; s.p.addScaledVector(s.v, dt); s.rot.x += s.spin*dt; s.rot.y += s.spin*dt; }
      list.forEach((s, i) => { const k = 1 - s.age / s.life;
        if (kind === 'spark') this.q.setFromUnitVectors(this.z, this.tv.copy(s.v).normalize()); else this.q.setFromEuler(s.rot);
        const sk = kind === 'coin' ? Math.min(1, k*3) : k;
        this.m.compose(s.p, this.q, this.sc.set(sk, sk, sk)); inst.setMatrixAt(i, this.m); inst.setColorAt(i, this.c.copy(s.color).multiplyScalar(kind === 'spark' ? 1 + k : 1)); });
      inst.count = list.length; inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    };
    step(this.lists.shard, this.shards, 'shard'); step(this.lists.spark, this.sparks, 'spark'); step(this.lists.coin, this.coins, 'coin');
    for (const r of this.rings) { if (!r.r.visible) continue; r.age += dt; const k = r.age / r.life; if (k >= 1) { r.r.visible = false; continue; } const e = 1 - Math.pow(1-k, 3); r.r.scale.setScalar(0.02 + r.size*e); r.r.material.opacity = 0.9*(1-k); }
    for (let i = this.flashes.length - 1; i >= 0; i--) { const f = this.flashes[i]; f.age += dt; f.mesh.material.opacity = Math.max(0, 0.9 * (1 - f.age/0.45)); f.mesh.scale.setScalar(1 + f.age*0.6); if (f.age > 0.45) { f.mesh.visible = false; this.flashes.splice(i,1); } }
  }
}
// Glow trail behind a moving object (instanced additive spheres)
export class Trail {
  constructor(parent, n = 24, color = 0xff4030) {
    this.n = n; this.pts = []; this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.6, depthWrite: false }), n);
    this.mesh.frustumCulled = false; this.mesh.count = 0; parent.add(this.mesh); this.m = new THREE.Matrix4();
  }
  push(p) { this.pts.unshift({ p: p.clone(), age: 0 }); if (this.pts.length > this.n) this.pts.pop(); }
  update(dt) { this.pts.forEach(t => t.age += dt); this.pts = this.pts.filter(t => t.age < 0.4);
    this.pts.forEach((t, i) => { const k = 1 - t.age/0.4; this.m.makeScale(k, k, k).setPosition(t.p); this.mesh.setMatrixAt(i, this.m); });
    this.mesh.count = this.pts.length; this.mesh.instanceMatrix.needsUpdate = true; }
}
