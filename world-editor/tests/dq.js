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
  console.log(seed, await p.evaluate(() => { const Q = S.params._dg.DQ, f = (o) => Object.entries(o).filter(([k]) => k !== 'w').map(([k, v]) => `${k} ${(v / o.w).toFixed(1)}`).join(' ');
    const ice = Object.keys(Q.iceLat).sort().filter((b) => /[NS](4|5|6|7|8)0/.test(b)).map((b) => { const o = Q.iceLat[b], mx = Math.max(...o.m), mn = Math.min(...o.m), tot = o.m.reduce((a, c) => a + c, 0) / 12; return `${b}: min ${(100 * mn / (tot ? o.w * 4 / 4 : 1) / 1).toFixed(0)}`; });
    const ice2 = Object.keys(Q.iceLat).sort().map((b) => { const o = Q.iceLat[b]; const per = o.m.map((v) => v / (o.w || 1)); return `${b} ${(100 * Math.min(...per)).toFixed(0)}-${(100 * Math.max(...per)).toFixed(0)}%`; }).filter((x) => /[NS][4-8]0/.test(x));
    return `\ntropics |lat|<10: SEA ${f(Q.trop.sea)}\n                  LAND ${f(Q.trop.land)}\nseas 45-65° open water: ` + Object.entries(Q.seas).filter(([k]) => k !== 'x').map(([k, o]) => k + ': ' + f(o)).join(' || ')
      + `\nice cover by band (lowest-highest month): ${ice2.join(', ')}\nacross 20°N: shallow loop ${Q.xs.shallowV.toFixed(1)} Sv (heat ${Q.xs.shallowH.toFixed(2)} PW, rel. 0 °C), overturning ${Q.xs.ovV.toFixed(1)} Sv | water rising at the equator: shallow loop ${Q.poolEq[0].toFixed(1)} °C, overturning ${Q.poolEq[1].toFixed(1)} °C`; }));
  }
  await b.close();
})();
