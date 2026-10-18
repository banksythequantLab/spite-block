import { PIECE_NAMES, normalize, rotX, rotY, rotZ, orientations } from './pieces.js';
import { W, D, H, emptyBoard, fits, dropY, place, overflow, stackHeight, layerCount } from './board.js';
import { chooseEvil } from './adversary.js';
import { mulberry32 } from './rng.js';

export const TELLS = ['smirk', 'drumroll', 'eye-roll', 'yawn'];
export const CRUELTY = { easy:0.4, normal:0.7, spiteful:0.95 };
export const RUN_CAP_MS = 8*60*1000;
export const STUN_MS = 30000;
export const RAGE_MAX = 6;

export class Game {
  constructor({ seed = Date.now(), difficulty='normal', bias={}, cruelty } = {}) {
    this.rng = mulberry32(seed);
    this.board = emptyBoard();
    this.owner = new Uint8Array(this.board.length); // 1 = AI piece cell (for Spite clears, informational)
    this.cruelty = cruelty ?? CRUELTY[difficulty] ?? 0.7;
    this.bias = bias;
    this.bag = []; this.queue = []; this.count = 0;
    this.score = 0; this.layers = 0; this.rage = 0; this.stunUntil = 0;
    this.time = 0; this.dropTimer = 0; this.hold = null; this.holdUsed = false;
    this.realTell = TELLS[Math.floor(this.rng()*TELLS.length)];
    this.events = []; this.over = false; this.won = false;
    this.crackCounter = new Array(H).fill(0);
    this.stats = { vetoOk:0, vetoBad:0, aiPicks:0, holds:{}, deaths:null, rotations:0 };
    this.fillQueue(); this.spawn();
  }
  emit(type, data={}) { this.events.push({ type, ...data }); }
  drainEvents() { const e=this.events; this.events=[]; return e; }
  get interval() { return Math.max(0.45, 1.2 - 0.05*Math.floor(this.layers/10)) * 1000; }
  get stunned() { return this.time < this.stunUntil; }
  fair() { if (!this.bag.length) { this.bag=[...PIECE_NAMES]; for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(this.rng()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];} } return this.bag.pop(); }
  fillQueue() {
    while (this.queue.length < 3) {
      this.count++;
      if (this.count % 4 === 0) {
        const tell = this.rng() < 0.4 ? this.realTell : TELLS[Math.floor(this.rng()*TELLS.length)];
        this.queue.push({ name:null, ai:true, tell, vetoed:false });
      } else this.queue.push({ name:this.fair(), ai:false });
    }
  }
  /** Next AI slot (shown as sealed envelope) */
  get pendingAI() { return this.queue.find(q=>q.ai && !q.name) || null; }
  veto() {
    const q = this.queue[0]; if (!q || !q.ai || q.vetoed) return false;
    q.vetoed = true;
    if (q.tell === this.realTell) { q.ai=false; q.name=this.fair(); this.stats.vetoOk++; this.emit('vetoSuccess'); return true; }
    this.rage = Math.max(0, this.rage-1); this.stats.vetoBad++; this.emit('vetoFail'); return false;
  }
  resolve(q) {
    if (q.name) return q.name;
    const r = chooseEvil(this.board, { cruelty:this.cruelty, rng:this.rng, bias:this.bias, stunned:this.stunned });
    q.name = r.name; q.mode = r.mode; this.stats.aiPicks++;
    this.emit(r.mode==='mercy' ? 'mercy' : 'aiPick', { piece:r.name, mode:r.mode });
    return q.name;
  }
  spawn(name) {
    let q;
    if (!name) { q = this.queue.shift(); this.fillQueue(); name = this.resolve(q); }
    const cells = normalize(orientations(name)[0]);
    const sx = Math.max(...cells.map(c=>c[0])), sz = Math.max(...cells.map(c=>c[2]));
    this.cur = { name, cells, x: Math.floor((W-1-sx)/2), z: Math.floor((D-1-sz)/2), y: H-1-Math.max(...cells.map(c=>c[1])), ai: !!(q && q.ai) };
    if (!fits(this.board, this.cur.cells, this.cur.x, this.cur.y, this.cur.z)) { this.gameOver(); }
    this.dropTimer = 0;
  }
  gameOver(){ if(this.over)return; this.over=true; this.stats.deaths=this.cur?.name; this.emit('gameOver',{score:this.score}); }
  move(dx, dz) { if (this.over) return false; const c=this.cur; if (fits(this.board,c.cells,c.x+dx,c.y,c.z+dz)) { c.x+=dx; c.z+=dz; return true; } return false; }
  moveTo(x, z) { // snap toward a column (used by hand drag)
    let moved=false; const c=this.cur;
    while (c.x!==x || c.z!==z) { const dx=Math.sign(x-c.x), dz=Math.sign(z-c.z); if (!(dx&&this.move(dx,0)) && !(dz&&this.move(0,dz))) break; moved=true; }
    return moved;
  }
  rotate(axis) {
    if (this.over) return false; const c=this.cur; const f={x:rotX,y:rotY,z:rotZ}[axis];
    const nc = normalize(f(c.cells));
    for (const [kx,ky,kz] of [[0,0,0],[-1,0,0],[1,0,0],[0,0,-1],[0,0,1],[-2,0,0],[0,0,-2],[0,-1,0],[0,1,0]]) {
      if (fits(this.board,nc,c.x+kx,c.y+ky,c.z+kz)) { c.cells=nc; c.x+=kx; c.y+=ky; c.z+=kz; this.stats.rotations++; return true; }
    }
    return false;
  }
  ghostY() { return dropY(this.board, this.cur.cells, this.cur.x, this.cur.z, this.cur.y); }
  softDrop() { if (this.over) return; const c=this.cur; if (fits(this.board,c.cells,c.x,c.y-1,c.z)) { c.y--; } else this.lock(); }
  hardDrop() { if (this.over) return; const c=this.cur; c.y = this.ghostY(); this.emit('slam',{x:c.x,y:c.y,z:c.z}); this.lock(); }
  doHold() {
    if (this.over || this.holdUsed) return false;
    const n = this.cur.name; this.stats.holds[n]=(this.stats.holds[n]||0)+1;
    if (this.hold) { const h=this.hold; this.hold=n; this.spawn(h); } else { this.hold=n; this.spawn(); }
    this.holdUsed = true; this.emit('hold',{piece:n}); return true;
  }
  fireRage() {
    if (this.rage < RAGE_MAX || this.over) return false;
    this.rage = 0; this.stunUntil = this.time + STUN_MS; this.emit('stun'); return true;
  }
  lock() {
    const c=this.cur;
    if (overflow(c.cells, c.y)) { this.gameOver(); return; }
    this.emit('lock', { name: c.name, cells: c.cells.map(([x,y,z])=>[x+c.x,y+c.y,z+c.z]) });
    const r = place(this.board, c.cells, c.x, c.y, c.z);
    let cleared = r.cleared; this.board = r.board;
    // Partial pressure: >=80% full for 3 consecutive drops cracks
    let cracked = 0;
    for (let y=0;y<H;y++){ if (layerCount(this.board,y) >= 20) { if (++this.crackCounter[y] >= 3) { for(let i=0;i<W*D;i++) this.board[y*W*D+i]=0; this.crackCounter[y]=0; cracked++; } } else this.crackCounter[y]=0; }
    if (cleared) {
      const mult = cleared>=4?10:cleared===3?6:cleared===2?3:1;
      let pts = 100*cleared*mult; if (this.stunned) pts=Math.round(pts*1.5);
      if (c.ai) { pts += 500; this.cruelty=Math.min(0.99,this.cruelty+0.05); this.emit('spiteClear'); }
      this.score += pts; this.layers += cleared;
      this.rage = Math.min(RAGE_MAX, this.rage + (cleared>=2?2:1));
      this.emit('clear', { cleared, pts, rows: r.clearedRows });
      if (this.rage>=RAGE_MAX) this.emit('rageReady');
    }
    if (cracked) { this.score += 40*cracked; this.emit('crack',{cracked}); }
    this.holdUsed = false; this.spawn();
    if (!this.over && stackHeight(this.board) >= H-3) this.emit('nearDeath');
  }
  update(dtMs) {
    if (this.over) return;
    this.time += dtMs; this.dropTimer += dtMs;
    if (this.time >= RUN_CAP_MS) { this.won=true; this.over=true; this.emit('win',{score:this.score}); return; }
    if (this.stunUntil && !this.stunned) { this.stunUntil=0; this.emit('stunEnd'); }
    while (this.dropTimer >= this.interval && !this.over) { this.dropTimer -= this.interval; this.softDrop(); }
  }
}
