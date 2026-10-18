// Original polycube set (3-5 cubes). Coordinates [x,y,z], y is up.
export const PIECES = {
  Pebble: [[0,0,0],[1,0,0],[2,0,0],[1,0,1]], // 4-cube flat T (plan's domino replaced to keep all pieces 3-5 cubes)
  Elbow:  [[0,0,0],[1,0,0],[0,0,1]],
  Stair:  [[0,0,0],[1,0,0],[1,1,0],[2,1,0]],
  Tripod: [[0,0,0],[1,0,0],[0,1,0],[0,0,1]],
  Plank:  [[0,0,0],[1,0,0],[2,0,0]],
  Slab:   [[0,0,0],[1,0,0],[0,0,1],[1,0,1]],
  Hook:   [[0,0,0],[1,0,0],[2,0,0],[2,0,1],[2,1,1]],
  Twist:  [[0,0,0],[1,0,0],[1,0,1],[1,1,1]],
  Spite:  [[1,0,0],[0,0,1],[1,0,1],[2,0,1],[1,0,2]],
};
export const PIECE_NAMES = Object.keys(PIECES);
// Material families (not one bright colour per shape)
export const MATERIAL = {
  Pebble:'glass', Plank:'glass', Slab:'cork', Elbow:'cork', Stair:'brass',
  Tripod:'brass', Twist:'enamel', Hook:'enamel', Spite:'obsidian',
};

export function normalize(cells) {
  const mx = Math.min(...cells.map(c=>c[0])), my = Math.min(...cells.map(c=>c[1])), mz = Math.min(...cells.map(c=>c[2]));
  return cells.map(([x,y,z])=>[x-mx,y-my,z-mz]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2]);
}
export const key = cells => normalize(cells).map(c=>c.join(',')).join(';');
export const rotX = cells => cells.map(([x,y,z])=>[x,-z,y]);
export const rotY = cells => cells.map(([x,y,z])=>[z,y,-x]);
export const rotZ = cells => cells.map(([x,y,z])=>[-y,x,z]);

const orientCache = {};
export function orientations(name) {
  if (orientCache[name]) return orientCache[name];
  const seen = new Map(); const stack = [normalize(PIECES[name])];
  while (stack.length) {
    const c = stack.pop(); const k = key(c); if (seen.has(k)) continue;
    seen.set(k, normalize(c));
    for (const r of [rotX, rotY, rotZ]) stack.push(normalize(r(c)));
  }
  return (orientCache[name] = [...seen.values()]);
}
