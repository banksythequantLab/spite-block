import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text()));
await p.goto('http://localhost:4173/'); await p.waitForTimeout(2500);
// build a stack of mixed families
await p.evaluate(() => { const g = window.__spite.game; for (let i=0;i<6;i++){ g.move((i%3)-1, i%2?1:-1); if (i%2) g.rotate('x'); g.hardDrop(); } });
await p.waitForTimeout(800);
await p.screenshot({ path: 'screens/v2-01-table.png' });
// Dealer close-up with smirk tell
await p.evaluate(() => { const s = window.__spite; s.express('smirk', 5); s.voice.say('Oh, you wanted the long one? Adorable.', true); });
await p.evaluate(() => { const s = window.__spite; s.camera.position.set(0.08, 1.62, 0.12); s.controls.target.set(0, 1.58, -0.25); });
await p.waitForTimeout(900);
await p.screenshot({ path: 'screens/v2-02-dealer-smirk.png' });
await p.evaluate(() => { const s = window.__spite; s.camera.position.set(0.5, 1.5, 0.95); s.controls.target.set(0, 1.35, -0.1); }); await p.waitForTimeout(400);
// layer clear burst: fill bottom layer except a 1x3 gap, drop a Plank into it
await p.evaluate(() => { const g = window.__spite.game; const nb = new Uint8Array(g.board.length); for (let i=0;i<50;i++) nb[i]=1; nb[25]=nb[26]=nb[27]=0; for (let i=50;i<62;i++) nb[i]=1; g.board = nb;
  g.cur = { name:'Plank', cells:[[0,0,0],[1,0,0],[2,0,0]], x:0, y:6, z:0, ai:true }; g.hardDrop(); });
await p.waitForTimeout(160);
await p.screenshot({ path: 'screens/v2-03-clear-burst.png' });
// stun + game over gloat
await p.evaluate(() => { const g = window.__spite.game; g.rage = 6; g.fireRage(); });
await p.waitForTimeout(500);
await p.screenshot({ path: 'screens/v2-04-stunned.png' });
await p.evaluate(() => { const g = window.__spite.game; let i=0; g.stunUntil = 0; while(!g.over && i++<300) g.hardDrop(); });
await p.waitForTimeout(900);
await p.screenshot({ path: 'screens/v2-05-gameover-gloat.png' });
console.log('expr', await p.evaluate(()=>window.__spite.dealer.expr), 'fps', await p.textContent('#fps'), 'errors', JSON.stringify(errs));
await b.close();
