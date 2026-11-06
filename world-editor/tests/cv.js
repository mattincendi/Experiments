const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  p.on('pageerror', e => console.log('pageerror:', e.message));
  p.on('console', m => { if (m.type()==='error') console.log('console:', m.text()); });
  await p.goto('file://' + process.cwd() + '/page.html');
  const idle = () => p.waitForFunction(() => !S.running && !STAGES.some(s=>S.stages[s.id].stale && S.stages[s.id].mode==='auto'), null, {timeout:180000});
  await p.waitForFunction(() => document.getElementById('overlay').hidden && !S.running && S.params.plates.length, null, { timeout: 180000 });
  const offCur = process.argv[2] === 'off';
  for (const seed of (process.argv[3]||'0,alpha').split(',')) {
  await p.evaluate(([sd,off]) => { if (off) S.stages.currents.mode='off'; S.params.seed = sd; invalidate(['param:seed']); }, [seed,offCur]); await p.waitForTimeout(300); await idle();
  console.log(seed, await p.evaluate(() => { const C = S.params._dg.CV, P = S.params._dg.PR; const m = (k) => (C[k] / C[k + 'N']).toFixed(3);
    return `mean |correction| °C: pole first ${m('poleFirst')} last ${m('poleLast')} | rest first ${m('restFirst')} last ${m('restLast')} || N winter Ta ${(P['N winter'].Ta / P['N winter'].w).toFixed(1)} summer Ta ${(P['N summer'].Ta / P['N summer'].w).toFixed(1)} winter sfc ${(P['N winter'].Tsfc / P['N winter'].w).toFixed(1)}`; }));
  }
  await b.close();
})();
