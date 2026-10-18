import * as THREE from 'three';
// WebXR hand gestures from raw XRHand joints (three.js populates hand.joints).
// Thresholds are the plan's initial values; NOT tuned on a real headset.
const PINCH_ON = 0.015, PINCH_OFF = 0.03, GRAB_RADIUS = 0.08, TWIST_STEP = THREE.MathUtils.degToRad(70);
const SLAM_SPEED = 0.8, FLICK_SPEED = 1.2;
const v = () => new THREE.Vector3();

export class HandInput {
  constructor(renderer, scene, ctx) {
    this.r = renderer; this.ctx = ctx; this.hands = [0,1].map(i => {
      const h = renderer.xr.getHand(i); scene.add(h);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
      scene.add(tip); tip.visible = false;
      return { h, tip, pinching:false, grab:null, prevPalm:v(), palmVel:v(), prevPinch:v(), pinchVel:v(), slamCool:0, lostMs:0 };
    });
  }
  joint(hs, name, out) { const j = hs.h.joints?.[name]; if (!j || !j.visible) return null; return j.getWorldPosition(out); }
  update(dt) {
    if (!this.r.xr.isPresenting) return;
    const { tank, S, pocket, envelope, rageCube, rageHome, dealer, act, root } = this.ctx; const game = this.ctx.game();
    for (const hs of this.hands) {
      const thumb = this.joint(hs, 'thumb-tip', v()), index = this.joint(hs, 'index-finger-tip', v()), wristJ = hs.h.joints?.['wrist'];
      const palm = this.joint(hs, 'middle-finger-metacarpal', v());
      if (!thumb || !index || !palm || !wristJ) { hs.lostMs += dt*1000; if (hs.lostMs > 300 && hs.grab) hs.grab = null; hs.tip.visible=false; continue; }
      hs.lostMs = 0;
      const pinchPt = thumb.clone().lerp(index, 0.5), d = thumb.distanceTo(index);
      hs.palmVel.copy(palm).sub(hs.prevPalm).divideScalar(Math.max(dt,1e-3)); hs.prevPalm.copy(palm);
      hs.pinchVel.copy(pinchPt).sub(hs.prevPinch).divideScalar(Math.max(dt,1e-3)); hs.prevPinch.copy(pinchPt);
      hs.slamCool -= dt;
      const wasPinching = hs.pinching;
      if (!hs.pinching && d < PINCH_ON) hs.pinching = true; else if (hs.pinching && d > PINCH_OFF) hs.pinching = false;
      hs.tip.visible = true; hs.tip.position.copy(index); hs.tip.material.color.set(hs.pinching ? 0xe7b65c : 0xffffff);
      const local = tank.worldToLocal(pinchPt.clone()); // in tank space (metres)

      // Pinch start
      if (hs.pinching && !wasPinching) {
        if (rageCube.visible && pinchPt.distanceTo(rageCube.getWorldPosition(v())) < 0.07) hs.grab = { kind:'rage' };
        else if (pinchPt.distanceTo(pocket.getWorldPosition(v())) < 0.08) { act.hold(); }
        else if (game?.cur) {
          const c = game.cur; const centre = new THREE.Vector3((c.x+1)*S, (c.y+1)*S, (c.z+1)*S);
          if (local.distanceTo(centre) < GRAB_RADIUS + 0.04) hs.grab = { kind:'piece', q: wristJ.getWorldQuaternion(new THREE.Quaternion()) };
        }
      }
      // Holding
      if (hs.pinching && hs.grab?.kind === 'piece') {
        act.moveTo(Math.floor(local.x / S - 0.5), Math.floor(local.z / S - 0.5));
        const q = wristJ.getWorldQuaternion(new THREE.Quaternion());
        const delta = hs.grab.q.clone().invert().multiply(q); const e = new THREE.Euler().setFromQuaternion(delta, 'XYZ');
        const ax = [['x',e.x],['y',e.y],['z',e.z]].sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]))[0];
        if (Math.abs(ax[1]) > TWIST_STEP) { act.rot(ax[0]); if (ax[1] < 0) { act.rot(ax[0]); act.rot(ax[0]); } hs.grab.q = q; }
        // pinch-flick downward = slam fallback
        if (hs.pinchVel.y < -SLAM_SPEED*1.5 && hs.slamCool <= 0) { act.slam(); hs.slamCool = 0.6; hs.grab = null; }
      }
      if (hs.pinching && hs.grab?.kind === 'rage') rageCube.position.copy(root.worldToLocal(pinchPt.clone()));
      // Release
      if (!hs.pinching && wasPinching && hs.grab) {
        if (hs.grab.kind === 'piece' && pocket.getWorldPosition(v()).distanceTo(pinchPt) < 0.08) act.hold();
        if (hs.grab.kind === 'rage') {
          const toDealer = dealer.getWorldPosition(v()).sub(pinchPt).normalize();
          const sp = hs.pinchVel.length();
          if (sp > FLICK_SPEED && hs.pinchVel.clone().normalize().angleTo(toDealer) < THREE.MathUtils.degToRad(25)) act.rage();
          else if (pinchPt.distanceTo(dealer.getWorldPosition(v())) < 0.12) act.rage(); // fallback: release while at the Dealer
          rageCube.position.copy(rageHome);
        }
        hs.grab = null;
      }
      // Open-palm slam: not pinching, hand over the footprint, fast downward
      if (!hs.pinching && hs.slamCool <= 0 && hs.palmVel.y < -SLAM_SPEED) {
        const lp = tank.worldToLocal(palm.clone());
        if (lp.x > -0.03 && lp.x < 5*S+0.03 && lp.z > -0.03 && lp.z < 5*S+0.03 && lp.y > 0) { act.slam(); hs.slamCool = 0.6; }
      }
      // Veto: poke the envelope with the index tip
      if (envelope.visible && index.distanceTo(envelope.getWorldPosition(v())) < 0.04) act.veto();
    }
  }
}
