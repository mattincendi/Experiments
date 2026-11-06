const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto('file://' + process.cwd() + '/page.html');
  const idle = () => p.waitForFunction(() => !S.running && !STAGES.some((s) => S.stages[s.id].stale && S.stages[s.id].mode === 'auto'), null, { timeout: 400000 });
  await p.waitForFunction(() => document.getElementById('overlay').hidden && !S.running && S.params.plates.length, null, { timeout: 300000 });
  await p.evaluate(() => { S.params.seed = 'alpha'; invalidate(['param:seed']); }); await p.waitForTimeout(300); await idle();
  for (const id of ['sst', 'tempJan', 'precip', 'seaIce']) { const el = await p.$('#layer-' + id); if (!el) { console.log('no layer', id); continue; } await el.click();
    for (const [yaw, nm] of [[0, 'a'], [2.6, 'b']]) { await p.evaluate((yw) => { view.yaw = yw; view.pitch = 0.3; view.dist = 3.6; updateCamera(); }, yaw); await p.waitForTimeout(500); await p.screenshot({ path: `v-${id}-${nm}.png`, clip: { x: 300, y: 90, width: 590, height: 690 } }); } }
  await b.close(); })();
