// Robustness: very different worlds must run, stay finite and respond the right way. node robust.js page.html
const { chromium } = require('playwright');
const page = process.argv[2] || 'page.html';
const CASES = [
  ['Earth', {}], ['tilt 0°', { axialTilt: 0 }], ['tilt 60°', { axialTilt: 60 }], ['tilt 90°', { axialTilt: 90 }],
  ['sun 85%', { solar: 0.85 }], ['sun 115%', { solar: 1.15 }], ['spin 0.25×', { rotation: 0.25 }], ['spin 3×', { rotation: 3 }],
  ['retrograde', { rotationDir: -1 }], ['more land', { continentalFraction: 0.6 }], ['less land', { continentalFraction: 0.15 }],
  ['radius 3000 km', { radiusKm: 3000 }], ['radius 12000 km', { radiusKm: 12000 }], ['+5 °C offset', { tempOffset: 5 }],
];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = []; p.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  await p.goto('file://' + process.cwd() + '/' + page);
  const idle = () => p.waitForFunction(() => !S.running && !STAGES.some((s) => S.stages[s.id].stale && S.stages[s.id].mode === 'auto'), null, { timeout: 600000 });
  await p.waitForFunction(() => document.getElementById('overlay').hidden && !S.running && S.params.plates.length, null, { timeout: 300000 });
  await p.evaluate(() => { S.params.seed = 'alpha'; invalidate(['param:seed']); }); await p.waitForTimeout(300); await idle();
  const base = await p.evaluate(() => ({ ...S.params }));
  console.log('case'.padEnd(17) + 'mean'.padStart(6) + ' eq'.padStart(6) + ' 60°'.padStart(6) + ' pole'.padStart(6) + ' NHrng'.padStart(7) + ' ice%'.padStart(6) + ' rain'.padStart(6) + '  s     problems');
  for (const [name, set] of CASES) {
    errs.length = 0;
    await p.evaluate(([bs, st]) => { const keys = new Set([...Object.keys(st), 'axialTilt', 'solar', 'rotation', 'rotationDir', 'continentalFraction', 'radiusKm', 'tempOffset']);
      for (const k of keys) S.params[k] = k in st ? st[k] : bs[k]; invalidate([...keys].map((k) => 'param:' + k)); }, [base, set]);
    const t0 = Date.now(); await p.waitForTimeout(300); try { await idle(); } catch (e) { errs.push('timeout'); }
    const r = await p.evaluate(() => { const G = S.grid, D = 180 / Math.PI; let w = 0, m = 0, eq = [0, 0], s60 = [0, 0], po = [0, 0], rg = [0, 0], ice = 0, oc = 0, pr = [0, 0], nan = [];
      for (const [id, f] of Object.entries(S.fields)) { if (f.kind !== 'scalar' || !f.base) continue; for (let i = 0; i < S.N; i += 97) if (!isFinite(f.base[i])) { nan.push(id); break; } }
      for (let i = 0; i < S.N; i++) { const la = Math.abs(G.lat[i] * D), c = Math.cos(G.lat[i]), t = val(S.fields.tempMean, i); w += c; m += c * t;
        if (la < 10) { eq[0] += t; eq[1]++; } if (la > 55 && la < 65) { s60[0] += t; s60[1]++; } if (la > 80) { po[0] += t; po[1]++; }
        if (G.lat[i] * D > 40 && G.lat[i] * D < 60 && height(i) >= 0) { rg[0] += val(S.fields.tempRange, i); rg[1]++; }
        if (height(i) < 0) { oc++; if (val(S.fields.seaIce, i) >= 1) ice++; } if (S.fields.precip) { pr[0] += c * val(S.fields.precip, i); pr[1] += c; } }
      const range = []; for (const id of ['tempMean', 'tempJan', 'tempJul', 'precip', 'sst']) { const f = S.fields[id]; if (!f || !f.base) continue; let lo = 1e9, hi = -1e9; for (let i = 0; i < S.N; i++) { const v = val(f, i); if (v < lo) lo = v; if (v > hi) hi = v; } range.push(`${id} ${lo.toFixed(0)}..${hi.toFixed(0)}`); }
      return { mean: m / w, eq: eq[0] / eq[1], s60: s60[0] / s60[1], pole: po[0] / po[1], rng: rg[1] ? rg[0] / rg[1] : NaN, ice: oc ? 100 * ice / oc : 0, rain: pr[1] ? pr[0] / pr[1] : NaN, nan, range }; });
    const prob = [...errs, ...(r.nan.length ? ['NaN in ' + r.nan.join(',')] : [])];
    console.log(name.padEnd(17) + [r.mean, r.eq, r.s60, r.pole].map((v) => v.toFixed(1).padStart(6)).join('') + r.rng.toFixed(1).padStart(7) + r.ice.toFixed(1).padStart(6) + r.rain.toFixed(0).padStart(6) + String(Math.round((Date.now() - t0) / 1000)).padStart(4) + '   ' + (prob.join('; ') || '-') + '   [' + r.range.join(', ') + ']');
  }
  await b.close();
})();
