import * as THREE from 'three';
// Pooled, instanced particles (1 draw call each) — Quest friendly.
export class FX {
  constructor(parent, max = 260) {
    this.parent = parent;
    const shardGeo = new THREE.TetrahedronGeometry(0.009);
    this.shards = new THREE.InstancedMesh(shardGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.5, roughness: 0.2, emissive: 0x332200 }), max);
    this.shards.frustumCulled = false; this.shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage); parent.add(this.shards);
    this.sparks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.003, 0.003, 0.012), new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }), max);
    this.sparks.frustumCulled = false; parent.add(this.sparks);
    this.ps = []; this.ss = []; this.max = max; this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.c = new THREE.Color();
    this.flashes = [];
  }
  burst(pos, { n = 40, color = 0xe7b65c, speed = 0.6, spread = [0.1, 0.01, 0.1], life = 1.1, kind = 'shard' } = {}) {
    const list = kind === 'shard' ? this.ps : this.ss;
    for (let i = 0; i < n && list.length < this.max; i++) {
      const p = new THREE.Vector3(pos.x + (Math.random()-0.5)*spread[0], pos.y + (Math.random()-0.5)*spread[1], pos.z + (Math.random()-0.5)*spread[2]);
      const v = new THREE.Vector3(Math.random()-0.5, Math.random()*0.8 + 0.2, Math.random()-0.5).normalize().multiplyScalar(speed*(0.4+Math.random()));
      list.push({ p, v, life, age: 0, rot: new THREE.Euler(Math.random()*6, Math.random()*6, 0), spin: Math.random()*10, color: new THREE.Color(color).offsetHSL(0, 0, (Math.random()-0.5)*0.2) });
    }
  }
  flash(mesh) { this.flashes.push({ mesh, age: 0 }); mesh.visible = true; }
  update(dt) {
    const step = (list, inst, isSpark) => {
      for (let i = list.length - 1; i >= 0; i--) { const s = list[i]; s.age += dt; if (s.age > s.life) { list.splice(i, 1); continue; }
        s.v.y -= (isSpark ? 1.2 : 2.2) * dt; s.p.addScaledVector(s.v, dt); s.rot.x += s.spin*dt; s.rot.y += s.spin*dt; }
      list.forEach((s, i) => { const k = 1 - s.age / s.life;
        if (isSpark) { this.q.setFromUnitVectors(new THREE.Vector3(0,0,1), s.v.clone().normalize()); } else this.q.setFromEuler(s.rot);
        this.m.compose(s.p, this.q, new THREE.Vector3(k, k, k)); inst.setMatrixAt(i, this.m); inst.setColorAt(i, this.c.copy(s.color).multiplyScalar(isSpark ? 1 + k : 1)); });
      inst.count = list.length; inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    };
    step(this.ps, this.shards, false); step(this.ss, this.sparks, true);
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
