export const W = 5, D = 5, H = 12;
export const emptyBoard = () => new Uint8Array(W*D*H);
export const idx = (x,y,z) => (y*D + z)*W + x;
export function fits(board, cells, px, py, pz) {
  for (const [cx,cy,cz] of cells) {
    const x=cx+px, y=cy+py, z=cz+pz;
    if (x<0||x>=W||z<0||z>=D||y<0) return false;
    if (y<H && board[idx(x,y,z)]) return false;
  }
  return true;
}
export function dropY(board, cells, px, pz, fromY = H) {
  let y = fromY; if (!fits(board, cells, px, y, pz)) return null;
  while (fits(board, cells, px, y-1, pz)) y--;
  return y;
}
// Place cells (value v) and clear full layers; returns {board, cleared, clearedRows}
export function place(board, cells, px, py, pz, v = 1) {
  const b = board.slice();
  for (const [cx,cy,cz] of cells) { const y=cy+py; if (y<H) b[idx(cx+px,y,cz+pz)] = v; }
  return clearLayers(b);
}
export function layerFull(b, y){ for(let i=0;i<W*D;i++) if(!b[y*W*D+i]) return false; return true; }
export function layerCount(b, y){ let n=0; for(let i=0;i<W*D;i++) if(b[y*W*D+i]) n++; return n; }
export function clearLayers(b) {
  const out = new Uint8Array(W*D*H); let dst = 0; const clearedRows=[];
  for (let y=0;y<H;y++) {
    if (layerFull(b,y)) { clearedRows.push(y); continue; }
    out.set(b.subarray(y*W*D,(y+1)*W*D), dst*W*D); dst++;
  }
  return { board: out, cleared: clearedRows.length, clearedRows };
}
export function overflow(cells, py){ return cells.some(c=>c[1]+py>=H); }
export function columnHeights(b){ const hs=[]; for(let z=0;z<D;z++)for(let x=0;x<W;x++){let h=0;for(let y=H-1;y>=0;y--)if(b[idx(x,y,z)]){h=y+1;break;}hs.push(h);} return hs; }
export function stackHeight(b){ return Math.max(0,...columnHeights(b)); }
export function evaluate(b, cleared=0, w={a:0.51,b:3.6,c:0.18,d:7.6,e:0.3}) {
  const hs = columnHeights(b); let holes=0, bump=0, deep=0;
  for (let z=0;z<D;z++) for (let x=0;x<W;x++){ const h=hs[z*W+x]; for(let y=0;y<h;y++) if(!b[idx(x,y,z)]) holes++;
    if(x<W-1) bump+=Math.abs(h-hs[z*W+x+1]); if(z<D-1) bump+=Math.abs(h-hs[(z+1)*W+x]);
    const nb=[]; if(x>0)nb.push(hs[z*W+x-1]); if(x<W-1)nb.push(hs[z*W+x+1]); if(z>0)nb.push(hs[(z-1)*W+x]); if(z<D-1)nb.push(hs[(z+1)*W+x]);
    deep=Math.max(deep, Math.min(...nb)-h); }
  const agg = hs.reduce((s,h)=>s+h,0);
  return -w.a*agg - w.b*holes - w.c*bump + w.d*cleared - w.e*Math.max(0,deep);
}
