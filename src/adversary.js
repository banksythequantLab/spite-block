import { orientations, PIECE_NAMES } from './pieces.js';
import { W, D, H, dropY, place, evaluate, overflow, stackHeight } from './board.js';

// Player's best achievable heuristic for a piece (1-ply, hard-drop placements)
export function bestPlacement(board, name) {
  let best = { score: -Infinity };
  for (const cells of orientations(name)) {
    const sx = Math.max(...cells.map(c=>c[0])), sz = Math.max(...cells.map(c=>c[2]));
    for (let px=0; px<W-sx; px++) for (let pz=0; pz<D-sz; pz++) {
      const py = dropY(board, cells, px, pz); if (py===null) continue;
      if (overflow(cells, py)) { if (best.score===-Infinity) best={score:-1e6,cells,px,py,pz}; continue; }
      const r = place(board, cells, px, py, pz);
      const s = evaluate(r.board, r.cleared);
      if (s > best.score) best = { score:s, cells, px, py, pz };
    }
  }
  return best;
}
// Rank pieces worst-first for the player
export function rankPieces(board, bias = {}) {
  return PIECE_NAMES.map(n => ({ name:n, value: bestPlacement(board,n).score - (bias[n]||0) }))
    .sort((a,b)=>a.value-b.value);
}
/** Choose the AI's piece.
 * cruelty: probability of the very worst piece; otherwise 2nd/3rd worst.
 * mercy: when stack is within 3 of the top, choose from the middle of the ranking.
 * stunned: fair random. */
export function chooseEvil(board, { cruelty=0.7, rng=Math.random, bias={}, stunned=false, mercyMargin=3 } = {}) {
  if (stunned) return { name: PIECE_NAMES[Math.floor(rng()*PIECE_NAMES.length)], mode:'stunned' };
  const ranked = rankPieces(board, bias);
  if (stackHeight(board) >= H - mercyMargin) {
    const mid = ranked.slice(3, 6); return { name: mid[Math.floor(rng()*mid.length)].name, mode:'mercy', ranked };
  }
  if (rng() < cruelty) return { name: ranked[0].name, mode:'worst', ranked };
  return { name: ranked[1 + Math.floor(rng()*2)].name, mode:'soft', ranked };
}
