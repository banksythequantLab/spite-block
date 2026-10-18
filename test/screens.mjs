import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text()));
await p.goto('http://localhost:4173/'); await p.waitForTimeout(2000);
await p.screenshot({ path: 'screens/01-start.png' });
// play a bit: drop pieces at varied spots until an AI slot is next
await p.evaluate(() => { const s = window.__spite; for (let i=0;i<9;i++){ const g=s.game; g.move(i%3-1, (i%2)?1:-1); if(i%2) g.rotate('x'); g.hardDrop(); if (g.queue[0].ai) break; } });
await p.waitForTimeout(1500);
await p.screenshot({ path: 'screens/02-dealer-tell.png' });
await p.evaluate(() => { const g = window.__spite.game; g.rage = 6; g.fireRage(); for (let i=0;i<4;i++){ g.move(1,1); g.hardDrop(); } });
await p.mouse.move(640,400); await p.mouse.down(); await p.mouse.move(820,360,{steps:10}); await p.mouse.up();
await p.waitForTimeout(1500);
await p.screenshot({ path: 'screens/03-stunned-orbit.png' });
const st = await p.evaluate(() => { const g=window.__spite.game; return { score:g.score, over:g.over, aiPicks:g.stats.aiPicks, stunned:g.stunned, cap: document.getElementById('caption').textContent }; });
console.log(JSON.stringify(st), 'errors:', JSON.stringify(errs));
await b.close();
