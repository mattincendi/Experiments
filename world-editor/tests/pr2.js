const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  p.on('pageerror', e => console.log('pageerror:', e.message));
  p.on('console', m => { if (m.type()==='error') console.log('console:', m.text()); });
  await p.goto('file://' + process.cwd() + '/pdq.html');
  const idle = () => p.waitForFunction(() => !S.running && !STAGES.some(s=>S.stages[s.id].stale && S.stages[s.id].mode==='auto'), null, {timeout:180000});
  await p.waitForFunction(() => document.getElementById('overlay').hidden && !S.running && S.params.plates.length, null, { timeout: 180000 });
  const offCur = process.argv[2] === 'off';
  for (const seed of (process.argv[3]||'0,alpha').split(',')) {
  await p.evaluate(([sd,off]) => { if (off) S.stages.currents.mode='off'; S.params.seed = sd; invalidate(['param:seed']); }, [seed,offCur]); await p.waitForTimeout(300); await idle();
  console.log(seed, await p.evaluate(() => { const PR = S.params._dg.PR; return '\n' + Object.keys(PR).sort().map((key) => { const o = PR[key];
    return key.padEnd(10) + Object.entries(o).filter(([k]) => k !== 'w').map(([k, v]) => `${k} ${(v / o.w).toFixed(k === 'land' || k === 'seaIce' ? 2 : 0)}`).join('  ') + `  OLR ${((o.OLRair + o.OLRsfc) / o.w).toFixed(0)}`; }).join('\n'); }));
  }
  await b.close();
})();
