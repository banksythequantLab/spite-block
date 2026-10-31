import * as THREE from 'three';
// Velvet Casino Noir: procedural textures + materials (no image assets).
const canvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

// Jewel-tone family colours (casino chips)
export const FAMILY_COLOR = { glass: 0x1d4fd8, cork: 0x0e8f57, brass: 0xe0a92e, enamel: 0xc3142f, obsidian: 0x16080d };

// Chip face: white base (multiplied by instance/material colour), darker bevel band, inset ring with edge "spots".
export const chipTex = canvas(256, 256, (x, w) => {
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, w);
  const g = x.createRadialGradient(128, 128, 60, 128, 128, 182); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.7, 'rgba(0,0,0,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
  x.fillStyle = g; x.fillRect(0, 0, w, w);
  x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 10; x.strokeRect(5, 5, w - 10, w - 10);           // dark bevel edge
  x.strokeStyle = 'rgba(255,240,210,0.85)'; x.lineWidth = 5; x.beginPath(); x.arc(128, 128, 78, 0, 7); x.stroke(); // inset ring
  x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 2; x.beginPath(); x.arc(128, 128, 66, 0, 7); x.stroke();
  x.fillStyle = 'rgba(255,246,225,0.9)'; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; x.save(); x.translate(128 + Math.cos(a) * 104, 128 + Math.sin(a) * 104); x.rotate(a); x.fillRect(-7, -14, 14, 28); x.restore(); }
});
export const lacquer = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, map: chipTex, roughness: 0.22, metalness: 0.05, envMapIntensity: 1.3, ...extra });

// Red-vein emissive map for sabotage pieces
export const veinTex = canvas(256, 256, (x, w) => {
  x.fillStyle = '#000'; x.fillRect(0, 0, w, w); x.lineCap = 'round';
  const crack = (px, py, a, len, wid) => { for (let i = 0; i < len; i++) { const nx = px + Math.cos(a) * 9, ny = py + Math.sin(a) * 9; x.strokeStyle = '#ff2a2a'; x.lineWidth = wid; x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke(); px = nx; py = ny; a += (Math.random() - 0.5) * 0.9; if (Math.random() < 0.12 && wid > 1.2) crack(px, py, a + (Math.random() - 0.5) * 2, len / 2, wid * 0.6); } };
  x.shadowColor = '#ff0000'; x.shadowBlur = 8;
  for (let i = 0; i < 5; i++) crack(Math.random() * w, Math.random() * w, Math.random() * 7, 26, 3.2);
  x.shadowBlur = 0; x.strokeStyle = '#ff5a3a'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, w - 6);
});
export const spiteMat = new THREE.MeshStandardMaterial({ color: 0x0c0608, roughness: 0.12, metalness: 0.3, envMapIntensity: 1.6, emissive: 0xff2020, emissiveMap: veinTex, emissiveIntensity: 1.4 });
// Inverted-hull rim outline (one instanced draw)
export const rimMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, side: THREE.BackSide, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });

// Soft radial halo for fake glow (additive sprite)
export const haloTex = canvas(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
export const halo = (color, size) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(size); return s; };

// Playing card (face: red spade + SPITE, back: crimson lattice)
const suit = (x, cx, cy, r, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(cx, cy - r); x.bezierCurveTo(cx + r * 1.3, cy - r * 0.1, cx + r * 0.9, cy + r * 0.9, cx, cy + r * 0.35); x.bezierCurveTo(cx - r * 0.9, cy + r * 0.9, cx - r * 1.3, cy - r * 0.1, cx, cy - r); x.fill(); x.beginPath(); x.moveTo(cx, cy + r * 0.2); x.lineTo(cx + r * 0.35, cy + r * 1.05); x.lineTo(cx - r * 0.35, cy + r * 1.05); x.fill(); };
export const cardFaceTex = canvas(180, 256, (x, w, h) => { x.fillStyle = '#f6efe1'; x.beginPath(); x.roundRect(0, 0, w, h, 16); x.fill(); x.strokeStyle = '#b8902f'; x.lineWidth = 5; x.beginPath(); x.roundRect(8, 8, w - 16, h - 16, 10); x.stroke();
  suit(x, 90, 110, 42, '#c0142c'); x.fillStyle = '#16080d'; x.font = 'bold 30px Georgia'; x.textAlign = 'center'; x.fillText('SPITE', 90, 222); x.fillStyle = '#c0142c'; x.font = 'bold 26px Georgia'; x.fillText('♠', 26, 40); });
export const cardBackTex = canvas(180, 256, (x, w, h) => { x.fillStyle = '#5a0b1a'; x.beginPath(); x.roundRect(0, 0, w, h, 16); x.fill(); x.strokeStyle = 'rgba(226,178,90,0.55)'; x.lineWidth = 2; for (let i = -h; i < w + h; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke(); x.beginPath(); x.moveTo(i, h); x.lineTo(i + h, 0); x.stroke(); } x.strokeStyle = '#e2b25a'; x.lineWidth = 6; x.beginPath(); x.roundRect(8, 8, w - 16, h - 16, 10); x.stroke(); });
export function makeCard() {
  const g = new THREE.Group(); const geo = new THREE.PlaneGeometry(0.063, 0.09);
  const f = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: cardFaceTex, transparent: true })); g.add(f);
  const b = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: cardBackTex, transparent: true })); b.rotation.y = Math.PI; g.add(b);
  return g;
}
// Suit badge that floats over a sabotage piece
export const suitBadgeTex = canvas(128, 128, (x) => { x.fillStyle = 'rgba(20,6,10,0.85)'; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.fill(); x.strokeStyle = '#e2b25a'; x.lineWidth = 6; x.stroke(); suit(x, 64, 56, 30, '#ff2a3a'); });

// Floating score text sprite (pooled by caller)
export function textSprite() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(0.16, 0.04, 1); s.visible = false;
  s.userData.set = (text, color) => { const x = c.getContext('2d'); x.clearRect(0, 0, 512, 128); x.font = 'bold 84px Georgia'; x.textAlign = 'center'; x.lineWidth = 10; x.strokeStyle = 'rgba(20,6,10,0.9)'; x.strokeText(text, 256, 96); x.fillStyle = color; x.fillText(text, 256, 96); t.needsUpdate = true; };
  return s;
}
