import { describe, it, expect } from 'vitest';
import { PIECES, PIECE_NAMES, orientations, key, rotX } from '../src/pieces.js';
import { W, D, H, emptyBoard, idx, place, fits, dropY, evaluate, stackHeight } from '../src/board.js';
import { bestPlacement, rankPieces, chooseEvil } from '../src/adversary.js';
import { Game, RAGE_MAX, STUN_MS } from '../src/game.js';
import { LINES, lineCount, pick } from '../src/lines.js';
import { loadProfile, saveRun, biasFrom } from '../src/memory.js';
import { mulberry32, dailySeed } from '../src/rng.js';

const fillLayer = (b, y, except=[]) => { for (let z=0;z<D;z++) for (let x=0;x<W;x++) if(!except.some(([ex,ez])=>ex===x&&ez===z)) b[idx(x,y,z)]=1; };

describe('pieces', () => {
  it('has 9 distinct pieces of 3-5 cubes', () => {
    expect(PIECE_NAMES).toHaveLength(9);
    for (const n of PIECE_NAMES) { expect(PIECES[n].length).toBeGreaterThanOrEqual(3); expect(PIECES[n].length).toBeLessThanOrEqual(5); }
    const keys = new Set(PIECE_NAMES.map(n => orientations(n).map(key).sort()[0]));
    expect(keys.size).toBe(9);
    expect(PIECE_NAMES.join()).not.toMatch(/tris/i);
  });
  it('orientations are deduped and <=24', () => {
    for (const n of PIECE_NAMES) { const o=orientations(n); expect(o.length).toBeLessThanOrEqual(24); expect(new Set(o.map(key)).size).toBe(o.length); }
    expect(orientations('Slab').length).toBe(3);
  });
  it('four rotations return to start', () => { let c=PIECES.Hook; for(let i=0;i<4;i++) c=rotX(c); expect(key(c)).toBe(key(PIECES.Hook)); });
});

describe('board', () => {
  it('drops and clears a full layer', () => {
    const b = emptyBoard(); fillLayer(b, 0, [[0,0],[1,0]]);
    const y = dropY(b, PIECES.Plank.slice(0,2).map(c=>c), 0, 0);
    expect(y).toBe(0);
    const r = place(b, [[0,0,0],[1,0,0]], 0, 0, 0);
    expect(r.cleared).toBe(1); expect(stackHeight(r.board)).toBe(0);
  });
  it('rejects out of bounds', () => { expect(fits(emptyBoard(), PIECES.Plank, 3, 0, 0)).toBe(false); });
  it('heuristic prefers flat over holes', () => {
    const flat=emptyBoard(); const holey=emptyBoard(); holey[idx(2,1,2)]=1;
    expect(evaluate(flat)).toBeGreaterThan(evaluate(holey));
  });
});

describe('adversary', () => {
  it('best placement finds the clearing move', () => {
    const b = emptyBoard(); fillLayer(b, 0, [[0,0],[1,0],[2,0]]);
    const best = bestPlacement(b, 'Plank'); const r = place(b, best.cells, best.px, best.py, best.pz);
    expect(r.cleared).toBe(1);
  });
  it('worst piece is not the one that clears the slot', () => {
    const b = emptyBoard(); fillLayer(b, 0, [[0,0],[1,0],[2,0]]); // 1x3 gap: Plank is the "gift"
    const ranked = rankPieces(b);
    expect(ranked[ranked.length-1].name).toBe('Plank');
    const e = chooseEvil(b, { cruelty: 1, rng: () => 0.5 });
    expect(e.name).toBe(ranked[0].name); expect(e.name).not.toBe('Plank');
  });
  it('mercy rule kicks in near the top', () => {
    const b = emptyBoard(); for (let y=0;y<H-2;y++) b[idx(0,y,0)]=1;
    expect(chooseEvil(b, { cruelty:1, rng:()=>0.1 }).mode).toBe('mercy');
  });
  it('stunned picks are random', () => { expect(chooseEvil(emptyBoard(), { stunned:true, rng:()=>0 })).toEqual({ name: PIECE_NAMES[0], mode:'stunned' }); });
  it('search is fast enough', () => {
    const b = emptyBoard(); const r=mulberry32(3); for (let i=0;i<60;i++) b[idx(Math.floor(r()*5),Math.floor(r()*4),Math.floor(r()*5))]=1;
    const t=performance.now(); rankPieces(b); const ms=performance.now()-t; console.log('rankPieces ms', ms.toFixed(1)); expect(ms).toBeLessThan(500);
  });
});

describe('game', () => {
  it('every 4th piece is an AI slot', () => {
    const g = new Game({ seed: 1 }); expect(g.queue.filter(q=>q.ai).length).toBe(1);
    let ai=0; for (let i=0;i<8;i++){ if(g.queue[0].ai) ai++; g.hardDrop(); if(g.over) break; } expect(ai).toBeGreaterThanOrEqual(1);
  });
  it('same seed → same sequence (daily mode)', () => {
    const a=new Game({seed:42}), b=new Game({seed:42}); expect(a.cur.name).toBe(b.cur.name); expect(a.queue.map(q=>q.name)).toEqual(b.queue.map(q=>q.name));
    expect(dailySeed(new Date(2026,9,16))).toBe(dailySeed(new Date(2026,9,16)));
  });
  it('gravity, hold, game over', () => {
    const g = new Game({ seed: 5 }); const y0=g.cur.y; g.update(1300); expect(g.cur.y).toBe(y0-1);
    const n=g.cur.name; expect(g.doHold()).toBe(true); expect(g.hold).toBe(n); expect(g.doHold()).toBe(false);
    let i=0; while(!g.over && i++<500) g.hardDrop(); expect(g.over).toBe(true);
  });
  it('veto with real tell swaps to fair piece; wrong tell costs rage', () => {
    const g = new Game({ seed: 9 }); while (!g.queue[0].ai) g.hardDrop();
    g.queue[0].tell = g.realTell; expect(g.veto()).toBe(true); expect(g.queue[0].ai).toBe(false);
    while (!g.queue[0].ai) g.hardDrop(); g.rage=3; g.queue[0].tell = g.realTell==='yawn'?'smirk':'yawn';
    expect(g.veto()).toBe(false); expect(g.rage).toBe(2);
  });
  it('rage stun lasts 30s', () => {
    const g=new Game({seed:2}); expect(g.fireRage()).toBe(false); g.rage=RAGE_MAX; expect(g.fireRage()).toBe(true);
    expect(g.stunned).toBe(true); g.time += STUN_MS+1; expect(g.stunned).toBe(false);
  });
  it('scores a layer clear', () => {
    const g=new Game({seed:3}); fillLayer(g.board,0); g.board[idx(0,0,0)]=0; g.board[idx(1,0,0)]=0; g.board[idx(2,0,0)]=0;
    g.cur={name:'Plank',cells:[[0,0,0],[1,0,0],[2,0,0]],x:0,y:5,z:0,ai:false}; g.hardDrop();
    expect(g.score).toBe(100); expect(g.rage).toBe(1);
  });
});

describe('lines & memory', () => {
  it('~60 lines covering events', () => { expect(lineCount()).toBeGreaterThanOrEqual(60); for (const e of ['aiPick','playerClear','nearDeath','vetoSuccess','stun','gameOver']) expect(LINES[e].length).toBeGreaterThan(3); expect(pick('memory',()=>0,{piece:'Hook'})).toContain('Hook'); });
  it('persists best score', () => {
    const m=new Map(); const store={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};
    let p=loadProfile(store); const g=new Game({seed:1}); g.score=700; g.stats.deaths='Spite';
    saveRun(p,g,{daily:'2026-10-16'},store); p=loadProfile(store); expect(p.best).toBe(700); expect(biasFrom(p).Spite).toBe(0.5);
  });
});
