const K='spiteblock.profile.v1';
export function loadProfile(store = globalThis.localStorage){ try{ return { best:0, runs:0, deaths:{}, holds:{}, vetoOk:0, vetoBad:0, dailyBest:{}, lastScore:null, ...JSON.parse(store?.getItem(K)||'{}') }; }catch{ return {best:0,runs:0,deaths:{},holds:{},vetoOk:0,vetoBad:0,dailyBest:{},lastScore:null}; } }
export function saveRun(profile, game, { daily=null } = {}, store = globalThis.localStorage){
  const p = { ...profile }; p.runs++; p.lastScore=game.score; p.best=Math.max(p.best, game.score);
  if (game.stats.deaths) p.deaths={...p.deaths,[game.stats.deaths]:(p.deaths[game.stats.deaths]||0)+1};
  p.holds={...p.holds}; for (const [k,v] of Object.entries(game.stats.holds)) p.holds[k]=(p.holds[k]||0)+v;
  p.vetoOk+=game.stats.vetoOk; p.vetoBad+=game.stats.vetoBad;
  if (daily) p.dailyBest={...p.dailyBest,[daily]:Math.max(p.dailyBest[daily]||0, game.score)};
  try{ store?.setItem(K, JSON.stringify(p)); }catch{}
  return p;
}
// Bias the AI toward pieces this player tends to die on (bounded small)
export function biasFrom(profile){ const b={}; for (const [k,v] of Object.entries(profile.deaths||{})) b[k]=Math.min(3, v*0.5); return b; }
export function cruelPiece(profile){ const e=Object.entries(profile.deaths||{}).sort((a,b)=>b[1]-a[1]); return e[0]?.[0]||null; }
