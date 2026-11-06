// Scorecard: every Earth target at once, both test worlds. node score.js [page.html]
const { chromium } = require('playwright');
const page = process.argv[2] || 'psc.html';
const T = [ // name, Earth, tolerance
  ['zonal 0°', 26, 1.5], ['zonal 10°', 26, 1.5], ['zonal 20°', 24.5, 1.5], ['zonal 30°', 20, 1.5], ['zonal 40°', 14, 1.5], ['zonal 50°', 6, 1.5],
  ['zonal 60°', -1, 2], ['zonal 70°', -10, 3], ['zonal 80°', -17, 3], ['zonal 90°', -20, 3],
  ['land 20-30N Jul', 31, 2.5], ['land 30-40N Jul', 27.5, 2], ['land 40-50N Jan', -6, 3], ['land 40-50N Jul', 22, 2.5], ['land 60-70N Jan', -27, 4], ['land 60-70N Jul', 13, 2.5],
  ['SST 0°', 27.5, 1.5], ['SST 15°', 26, 1.5], ['SST 30°', 21, 2], ['SST 45°', 12, 2.5], ['SST 60°', 4, 3],
  ['SST west coasts 18-38°', 23, 2], ['SST east coasts 18-38°', 18, 2], ['sea seasonal range 45-65°', 5, 2],
  ['sea ice perennial %', 3, 1.5], ['sea ice at most %', 8, 3],
  ['TOA global W/m²', 0, 0.5], ['transport 35N PW', 5.5, 1], ['transport 70N PW', 1.8, 0.5], ['ocean transport 20N PW', 1.6, 0.7],
  ['polar winter surface (N)', -31, 5], ['polar OLR winter (N)', 165, 10], ['polar OLR summer (N)', 225, 15],
];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto('file://' + process.cwd() + '/' + page);
  const idle = () => p.waitForFunction(() => !S.running && !STAGES.some((s) => S.stages[s.id].stale && S.stages[s.id].mode === 'auto'), null, { timeout: 300000 });
  await p.waitForFunction(() => document.getElementById('overlay').hidden && !S.running && S.params.plates.length, null, { timeout: 300000 });
  const res = {};
  for (const seed of ['alpha', 'beta']) {
    await p.evaluate((sd) => { S.params.seed = sd; invalidate(['param:seed']); }, seed); await p.waitForTimeout(300); await idle();
    res[seed] = await p.evaluate(() => {
      const G = S.grid, D = 180 / Math.PI, pos = G.pos, out = {}, av = (a) => a[0] / a[1], add = (o, k, v) => { o[k] = o[k] || [0, 0]; o[k][0] += v; o[k][1]++; };
      const z = {}, L = {}, sst = {}; let rng = [0, 0], ice2 = 0, ice1 = 0, oc = 0, wc = [0, 0], ec = [0, 0];
      for (let i = 0; i < S.N; i++) { const h = height(i), la = G.lat[i] * D, a = Math.abs(la);
        add(z, Math.round(a / 10) * 10, val(S.fields.tempMean, i) + (h > 0 ? 6.5 * h / 1000 : 0));
        if (h >= 0 && h < 400) for (const [lo, hi2] of [[20, 30], [30, 40], [40, 50], [60, 70]]) if (la >= lo && la < hi2) { add(L, `${lo}-${hi2}N Jan`, val(S.fields.tempJan, i)); add(L, `${lo}-${hi2}N Jul`, val(S.fields.tempJul, i)); }
        if (h < 0) { oc++; const si = val(S.fields.seaIce, i); if (si === 2) ice2++; if (si >= 1) ice1++;
          add(sst, Math.round(a / 15) * 15, val(S.fields.sst, i)); if (a > 45 && a < 65) { rng[0] += val(S.fields.tempRange, i); rng[1]++; }
          if (a > 18 && a < 38) { let lx = 0, ly = 0, lz = 0, c = 0; for (let q = G.off[i]; q < G.off[i + 1]; q++) { const j = G.nbr[q]; if (height(j) >= 0) { lx += pos[j * 3] - pos[i * 3]; ly += pos[j * 3 + 1] - pos[i * 3 + 1]; lz += pos[j * 3 + 2] - pos[i * 3 + 2]; c++; } }
            if (c) { const lo = G.lon[i], e = (lx * Math.cos(lo) - lz * Math.sin(lo)) / Math.hypot(lx, ly, lz); if (e < -0.6) { wc[0] += val(S.fields.sst, i); wc[1]++; } else if (e > 0.6) { ec[0] += val(S.fields.sst, i); ec[1]++; } } } } }
      for (const k of [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]) out[`zonal ${k}°`] = av(z[k]);
      for (const k in L) out['land ' + k] = av(L[k]);
      for (const k of [0, 15, 30, 45, 60]) out[`SST ${k}°`] = av(sst[k]);
      out['SST west coasts 18-38°'] = av(wc); out['SST east coasts 18-38°'] = av(ec); out['sea seasonal range 45-65°'] = av(rng);
      out['sea ice perennial %'] = 100 * ice2 / oc; out['sea ice at most %'] = 100 * ice1 / oc;
      const dg = S.params._dg; if (dg) { const B = dg.BD, NY = B.toa.length; let g = 0, ar = 0; for (let y = 0; y < NY; y++) { g += B.toa[y]; ar += Math.cos((y * 2 - 89) * Math.PI / 180) * 180; } out['TOA global W/m²'] = g / ar;
        const edge = (L2) => Math.round((L2 + 90) / 2) - 1, capS = (a, y) => { let s2 = 0; for (let j = y + 1; j < NY; j++) s2 += a[j]; return s2 * dg.dl2 / 1e15; };
        out['transport 35N PW'] = -capS(B.toa, edge(35)); out['transport 70N PW'] = -capS(B.toa, edge(70)); out['ocean transport 20N PW'] = capS(B.ocn, edge(20));
        const pw = dg.PR['N winter'], ps = dg.PR['N summer']; out['polar winter surface (N)'] = pw.Tsfc / pw.w; out['polar OLR winter (N)'] = (pw.OLRair + pw.OLRsfc) / pw.w; out['polar OLR summer (N)'] = (ps.OLRair + ps.OLRsfc) / ps.w; }
      return out; });
  }
  let pass = 0; console.log('target'.padEnd(28) + 'alpha'.padStart(8) + 'beta'.padStart(8) + '   Earth ± tol');
  for (const [n, e, t] of T) { const a = res.alpha[n], bb = res.beta[n], ok = [a, bb].every((v) => v != null && Math.abs(v - e) <= t); if (ok) pass++;
    console.log(n.padEnd(28) + (a == null ? '—' : a.toFixed(1)).padStart(8) + (bb == null ? '—' : bb.toFixed(1)).padStart(8) + `   ${e} ± ${t}`.padEnd(16) + (ok ? 'ok' : 'OUT')); }
  console.log(`\n${pass}/${T.length} within tolerance on both worlds`);
  await b.close();
})();
