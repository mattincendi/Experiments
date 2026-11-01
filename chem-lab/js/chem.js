/* Chemistry engine: species, reagents, reactions, and solution state.
 * Everything here is data-driven — add a species/reagent/reaction by adding an entry. */
(function () {
  // state: aq (dissolved), s (solid), g (gas). color: [r,g,b], str = absorptivity per mol/L.
  // mv = molar bulk volume (mL/mol) for solids, M = molar mass (g/mol).
  const SPECIES = {
    'H+':     { name: 'Hydrogen ion', formula: 'H⁺', state: 'aq', M: 1.008 },
    'OH-':    { name: 'Hydroxide', formula: 'OH⁻', state: 'aq', M: 17.01 },
    'Na+':    { name: 'Sodium ion', formula: 'Na⁺', state: 'aq', M: 22.99 },
    'K+':     { name: 'Potassium ion', formula: 'K⁺', state: 'aq', M: 39.10 },
    'Cl-':    { name: 'Chloride', formula: 'Cl⁻', state: 'aq', M: 35.45 },
    'I-':     { name: 'Iodide', formula: 'I⁻', state: 'aq', M: 126.9 },
    'NO3-':   { name: 'Nitrate', formula: 'NO₃⁻', state: 'aq', M: 62.00 },
    'SO4--':  { name: 'Sulfate', formula: 'SO₄²⁻', state: 'aq', M: 96.06 },
    'HCO3-':  { name: 'Bicarbonate', formula: 'HCO₃⁻', state: 'aq', M: 61.02 },
    'CO3--':  { name: 'Carbonate', formula: 'CO₃²⁻', state: 'aq', M: 60.01 },
    'SCN-':   { name: 'Thiocyanate', formula: 'SCN⁻', state: 'aq', M: 58.08 },
    'Ag+':    { name: 'Silver ion', formula: 'Ag⁺', state: 'aq', M: 107.9 },
    'Ba++':   { name: 'Barium ion', formula: 'Ba²⁺', state: 'aq', M: 137.3 },
    'Pb++':   { name: 'Lead(II) ion', formula: 'Pb²⁺', state: 'aq', M: 207.2 },
    'Mg++':   { name: 'Magnesium ion', formula: 'Mg²⁺', state: 'aq', M: 24.31 },
    'Cu++':   { name: 'Copper(II) ion', formula: 'Cu²⁺', state: 'aq', M: 63.55, color: [70, 150, 255], str: 5,
                note: 'Hydrated [Cu(H₂O)₆]²⁺ absorbs red-orange light, so it looks blue.' },
    'Fe+++':  { name: 'Iron(III) ion', formula: 'Fe³⁺', state: 'aq', M: 55.85, color: [255, 185, 50], str: 6 },
    'FeSCN++':{ name: 'Thiocyanatoiron(III)', formula: '[Fe(SCN)]²⁺', state: 'aq', M: 113.9, color: [170, 10, 10], str: 60,
                note: 'Intensely blood-red complex — a classic test for Fe³⁺.' },
    'HIn':    { name: 'Phenolphthalein', formula: 'C₂₀H₁₄O₄', state: 'aq', M: 318.3, indicator: 'phenolphthalein',
                note: 'Colorless below pH 8.2, pink-magenta above.' },
    'UI':     { name: 'Universal indicator', formula: 'mixture', state: 'aq', M: 300, indicator: 'universal',
                note: 'A blend of dyes: red (acid) → green (neutral) → violet (base).' },
    // solids
    'AgCl':   { name: 'Silver chloride', formula: 'AgCl', state: 's', M: 143.3, mv: 26, color: [245, 245, 238], grain: 1.6,
                note: 'Darkens slowly in light as Ag⁺ is reduced to silver.' },
    'AgI':    { name: 'Silver iodide', formula: 'AgI', state: 's', M: 234.8, mv: 41, color: [240, 228, 150], grain: 1.6 },
    'Cu(OH)2':{ name: 'Copper(II) hydroxide', formula: 'Cu(OH)₂', state: 's', M: 97.56, mv: 29, color: [80, 150, 235], grain: 2 },
    'Fe(OH)3':{ name: 'Iron(III) hydroxide', formula: 'Fe(OH)₃', state: 's', M: 106.9, mv: 31, color: [160, 75, 20], grain: 2 },
    'Mg(OH)2':{ name: 'Magnesium hydroxide', formula: 'Mg(OH)₂', state: 's', M: 58.32, mv: 25, color: [250, 250, 250], grain: 1.6,
                note: 'Milk of magnesia.' },
    'BaSO4':  { name: 'Barium sulfate', formula: 'BaSO₄', state: 's', M: 233.4, mv: 52, color: [252, 252, 252], grain: 1.4,
                note: 'So insoluble it is swallowed as an X-ray contrast agent.' },
    'BaCO3':  { name: 'Barium carbonate', formula: 'BaCO₃', state: 's', M: 197.3, mv: 46, color: [250, 250, 245], grain: 1.5 },
    'PbI2':   { name: 'Lead(II) iodide', formula: 'PbI₂', state: 's', M: 461.0, mv: 75, color: [255, 210, 0], grain: 1.8,
                note: '"Golden rain" — dissolves when hot, recrystallizes as glittering flakes.' },
    'Mg':     { name: 'Magnesium', formula: 'Mg', state: 's', M: 24.31, mv: 14, color: [175, 178, 188], grain: 4, metal: true },
    'Cu':     { name: 'Copper', formula: 'Cu', state: 's', M: 63.55, mv: 7.1, color: [190, 110, 55], grain: 2.2, metal: true },
    'NaHCO3(s)': { name: 'Sodium bicarbonate', formula: 'NaHCO₃', state: 's', M: 84.01, mv: 38, color: [250, 250, 250], grain: 2,
                note: 'Baking soda.' },
    'NaCl(s)':{ name: 'Sodium chloride', formula: 'NaCl', state: 's', M: 58.44, mv: 27, color: [248, 248, 252], grain: 2.2 },
    'CuSO4(s)':{ name: 'Copper(II) sulfate pentahydrate', formula: 'CuSO₄·5H₂O', state: 's', M: 249.7, mv: 110, color: [40, 110, 230], grain: 2.6 },
    // gases (leave the solution as bubbles)
    'CO2':    { name: 'Carbon dioxide', formula: 'CO₂', state: 'g', M: 44.01 },
    'H2':     { name: 'Hydrogen', formula: 'H₂', state: 'g', M: 2.016, note: 'Flammable — gives a squeaky pop near a flame.' },
  };

  // dH in kJ per mol of reaction; k in 1/s at 25 °C (rate doubles every +10 °C).
  const REACTIONS = [
    { r: { 'H+': 1, 'OH-': 1 }, p: {}, dH: -55.8, k: 25, eq: 'H⁺ + OH⁻ → H₂O', name: 'Neutralization' },
    { r: { 'H+': 1, 'CO3--': 1 }, p: { 'HCO3-': 1 }, dH: -15, k: 25, eq: 'H⁺ + CO₃²⁻ → HCO₃⁻' },
    { r: { 'OH-': 1, 'HCO3-': 1 }, p: { 'CO3--': 1 }, dH: -40, k: 25, eq: 'OH⁻ + HCO₃⁻ → CO₃²⁻ + H₂O' },
    { r: { 'H+': 1, 'HCO3-': 1 }, p: { 'CO2': 1 }, dH: 12, k: 2.5, eq: 'H⁺ + HCO₃⁻ → H₂O + CO₂(g)', name: 'Acid–bicarbonate fizz' },
    { r: { 'Ag+': 1, 'Cl-': 1 }, p: { 'AgCl': 1 }, dH: -65.5, k: 12, eq: 'Ag⁺ + Cl⁻ → AgCl(s)', name: 'Precipitation' },
    { r: { 'Ag+': 1, 'I-': 1 }, p: { 'AgI': 1 }, dH: -112, k: 12, eq: 'Ag⁺ + I⁻ → AgI(s)', name: 'Precipitation' },
    { r: { 'Cu++': 1, 'OH-': 2 }, p: { 'Cu(OH)2': 1 }, dH: -45, k: 10, eq: 'Cu²⁺ + 2OH⁻ → Cu(OH)₂(s)', name: 'Precipitation' },
    { r: { 'Fe+++': 1, 'OH-': 3 }, p: { 'Fe(OH)3': 1 }, dH: -60, k: 10, eq: 'Fe³⁺ + 3OH⁻ → Fe(OH)₃(s)', name: 'Precipitation' },
    { r: { 'Mg++': 1, 'OH-': 2 }, p: { 'Mg(OH)2': 1 }, dH: -3, k: 6, eq: 'Mg²⁺ + 2OH⁻ → Mg(OH)₂(s)', name: 'Precipitation' },
    { r: { 'Ba++': 1, 'SO4--': 1 }, p: { 'BaSO4': 1 }, dH: -26, k: 12, eq: 'Ba²⁺ + SO₄²⁻ → BaSO₄(s)', name: 'Precipitation' },
    { r: { 'Ba++': 1, 'CO3--': 1 }, p: { 'BaCO3': 1 }, dH: -4, k: 10, eq: 'Ba²⁺ + CO₃²⁻ → BaCO₃(s)', name: 'Precipitation' },
    { r: { 'Pb++': 1, 'I-': 2 }, p: { 'PbI2': 1 }, dH: -63, k: 10, eq: 'Pb²⁺ + 2I⁻ → PbI₂(s)', name: 'Golden rain' },
    { r: { 'Fe+++': 1, 'SCN-': 1 }, p: { 'FeSCN++': 1 }, dH: -5, k: 15, eq: 'Fe³⁺ + SCN⁻ → [Fe(SCN)]²⁺', name: 'Complexation' },
    { r: { 'Cu(OH)2': 1, 'H+': 2 }, p: { 'Cu++': 1 }, dH: -60, k: 2, eq: 'Cu(OH)₂ + 2H⁺ → Cu²⁺ + 2H₂O' },
    { r: { 'Fe(OH)3': 1, 'H+': 3 }, p: { 'Fe+++': 1 }, dH: -80, k: 1.5, eq: 'Fe(OH)₃ + 3H⁺ → Fe³⁺ + 3H₂O' },
    { r: { 'Mg(OH)2': 1, 'H+': 2 }, p: { 'Mg++': 1 }, dH: -110, k: 2, eq: 'Mg(OH)₂ + 2H⁺ → Mg²⁺ + 2H₂O' },
    { r: { 'BaCO3': 1, 'H+': 2 }, p: { 'Ba++': 1, 'CO2': 1 }, dH: -5, k: 1, eq: 'BaCO₃ + 2H⁺ → Ba²⁺ + H₂O + CO₂(g)' },
    { r: { 'Mg': 1, 'H+': 2 }, p: { 'Mg++': 1, 'H2': 1 }, dH: -467, k: 0.35, eq: 'Mg + 2H⁺ → Mg²⁺ + H₂(g)', name: 'Metal + acid' },
    { r: { 'Mg': 1, 'Cu++': 1 }, p: { 'Mg++': 1, 'Cu': 1 }, dH: -532, k: 0.25, eq: 'Mg + Cu²⁺ → Mg²⁺ + Cu(s)', name: 'Displacement' },
    // dissolution of solid reagents
    { r: { 'NaHCO3(s)': 1 }, p: { 'Na+': 1, 'HCO3-': 1 }, dH: 17, k: 0.8, eq: 'NaHCO₃(s) → Na⁺ + HCO₃⁻', name: 'Dissolving' },
    { r: { 'NaCl(s)': 1 }, p: { 'Na+': 1, 'Cl-': 1 }, dH: 3.9, k: 0.8, eq: 'NaCl(s) → Na⁺ + Cl⁻', name: 'Dissolving' },
    { r: { 'CuSO4(s)': 1 }, p: { 'Cu++': 1, 'SO4--': 1 }, dH: 11.5, k: 0.5, eq: 'CuSO₄·5H₂O(s) → Cu²⁺ + SO₄²⁻ + 5H₂O', name: 'Dissolving' },
  ];

  // Reagents: `aq` = mol/L in the solution; `solid` = mol of solid per bottle.
  const REAGENTS = [
    { id: 'water', cat: 'Solvents', name: 'Distilled water', short: 'H₂O', aq: {} },
    { id: 'hcl', cat: 'Acids', name: 'Hydrochloric acid 1 M', short: 'HCl 1M', aq: { 'H+': 1, 'Cl-': 1 }, hazard: 'Corrosive' },
    { id: 'hno3', cat: 'Acids', name: 'Nitric acid 1 M', short: 'HNO₃ 1M', aq: { 'H+': 1, 'NO3-': 1 }, hazard: 'Corrosive, oxidizer' },
    { id: 'h2so4', cat: 'Acids', name: 'Sulfuric acid 0.5 M', short: 'H₂SO₄ .5M', aq: { 'H+': 1, 'SO4--': 0.5 }, hazard: 'Corrosive' },
    { id: 'naoh', cat: 'Bases', name: 'Sodium hydroxide 1 M', short: 'NaOH 1M', aq: { 'Na+': 1, 'OH-': 1 }, hazard: 'Corrosive' },
    { id: 'naoh01', cat: 'Bases', name: 'Sodium hydroxide 0.1 M', short: 'NaOH .1M', aq: { 'Na+': 0.1, 'OH-': 0.1 }, hazard: 'Irritant' },
    { id: 'nacl', cat: 'Salt solutions', name: 'Sodium chloride 1 M', short: 'NaCl 1M', aq: { 'Na+': 1, 'Cl-': 1 } },
    { id: 'agno3', cat: 'Salt solutions', name: 'Silver nitrate 0.1 M', short: 'AgNO₃', aq: { 'Ag+': 0.1, 'NO3-': 0.1 }, hazard: 'Stains skin black' },
    { id: 'cuso4', cat: 'Salt solutions', name: 'Copper(II) sulfate 0.5 M', short: 'CuSO₄', aq: { 'Cu++': 0.5, 'SO4--': 0.5 }, hazard: 'Harmful' },
    { id: 'fecl3', cat: 'Salt solutions', name: 'Iron(III) chloride 0.2 M', short: 'FeCl₃', aq: { 'Fe+++': 0.2, 'Cl-': 0.6 }, hazard: 'Corrosive' },
    { id: 'kscn', cat: 'Salt solutions', name: 'Potassium thiocyanate 0.1 M', short: 'KSCN', aq: { 'K+': 0.1, 'SCN-': 0.1 } },
    { id: 'bacl2', cat: 'Salt solutions', name: 'Barium chloride 0.5 M', short: 'BaCl₂', aq: { 'Ba++': 0.5, 'Cl-': 1 }, hazard: 'Toxic' },
    { id: 'na2so4', cat: 'Salt solutions', name: 'Sodium sulfate 0.5 M', short: 'Na₂SO₄', aq: { 'Na+': 1, 'SO4--': 0.5 } },
    { id: 'pbno3', cat: 'Salt solutions', name: 'Lead(II) nitrate 0.1 M', short: 'Pb(NO₃)₂', aq: { 'Pb++': 0.1, 'NO3-': 0.2 }, hazard: 'Toxic' },
    { id: 'ki', cat: 'Salt solutions', name: 'Potassium iodide 0.5 M', short: 'KI', aq: { 'K+': 0.5, 'I-': 0.5 } },
    { id: 'nahco3', cat: 'Salt solutions', name: 'Sodium bicarbonate 0.5 M', short: 'NaHCO₃', aq: { 'Na+': 0.5, 'HCO3-': 0.5 } },
    { id: 'php', cat: 'Indicators', name: 'Phenolphthalein', short: 'Phenol.', aq: { 'HIn': 0.01 } },
    { id: 'ui', cat: 'Indicators', name: 'Universal indicator', short: 'Univ. ind.', aq: { 'UI': 0.01 } },
    { id: 'mg', cat: 'Solids', name: 'Magnesium turnings', short: 'Mg', solid: { 'Mg': 0.6 }, hazard: 'Flammable' },
    { id: 'bsoda', cat: 'Solids', name: 'Sodium bicarbonate', short: 'NaHCO₃(s)', solid: { 'NaHCO3(s)': 0.5 } },
    { id: 'saltS', cat: 'Solids', name: 'Sodium chloride crystals', short: 'NaCl(s)', solid: { 'NaCl(s)': 0.6 } },
    { id: 'cuso4s', cat: 'Solids', name: 'Copper(II) sulfate crystals', short: 'CuSO₄(s)', solid: { 'CuSO4(s)': 0.15 }, hazard: 'Harmful' },
  ];

  const EPS = 1e-9;
  const isSolid = (id) => SPECIES[id].state === 's';

  function create(T = 22) { return { vol: 0, sp: {}, T, log: [], gases: {} }; }

  function fromReagent(rg, volume) {
    const c = create();
    if (rg.solid) { for (const k in rg.solid) c.sp[k] = rg.solid[k]; }
    else { c.vol = volume; for (const k in rg.aq) c.sp[k] = rg.aq[k] * volume / 1000; }
    return c;
  }

  // total occupied volume in mL (liquid + bulk solids)
  function total(c) {
    let v = c.vol;
    for (const k in c.sp) if (isSolid(k)) v += c.sp[k] * SPECIES[k].mv;
    return v;
  }

  // remove a fraction of everything (used for pouring)
  function take(c, f) {
    f = Math.min(1, Math.max(0, f));
    const out = { vol: c.vol * f, sp: {}, T: c.T, log: c.log.slice(-8) };
    c.vol -= out.vol;
    for (const k in c.sp) { const m = c.sp[k] * f; out.sp[k] = m; c.sp[k] -= m; if (c.sp[k] < EPS) delete c.sp[k]; }
    return out;
  }

  function mix(c, p) {
    const a = c.vol + 0.01, b = p.vol + 0.01;
    c.T = (c.T * a + p.T * b) / (a + b);
    c.vol += p.vol;
    for (const k in p.sp) c.sp[k] = (c.sp[k] || 0) + p.sp[k];
    for (const e of p.log || []) if (!c.log.includes(e)) c.log.push(e);
  }

  function conc(c, k) { return c.vol > 0.001 ? (c.sp[k] || 0) / (c.vol / 1000) : 0; }

  function pH(c) {
    if (c.vol < 0.01) return null;
    const h = conc(c, 'H+') - conc(c, 'OH-');
    // carbonate/bicarbonate buffer (rough): bicarbonate solutions sit near 8.3, carbonate ~11
    const hc = conc(c, 'HCO3-'), co = conc(c, 'CO3--');
    if (Math.abs(h) < 1e-6 && (hc > 1e-5 || co > 1e-5)) {
      if (co > 1e-5 && hc > 1e-5) return 10.33 + Math.log10(co / hc);
      return co > 1e-5 ? 11.5 : 8.3;
    }
    const H = (h + Math.sqrt(h * h + 4e-14)) / 2;
    return -Math.log10(H);
  }

  function indicatorColor(type, ph) {
    if (ph == null) return null;
    if (type === 'phenolphthalein') {
      const f = Math.min(1, Math.max(0, (ph - 8.2) / 1.6));
      return f > 0 ? { color: [255, 30, 170], str: 900 * f } : null;
    }
    // universal indicator hue ramp: pH 1 red → 7 green → 13 violet
    const stops = [[1, [230, 20, 20]], [3, [255, 120, 0]], [5, [250, 220, 0]], [7, [40, 180, 60]],
                   [9, [20, 120, 200]], [11, [60, 40, 180]], [13, [130, 20, 160]]];
    let col = stops[0][1];
    for (let i = 0; i < stops.length - 1; i++) {
      const [p0, c0] = stops[i], [p1, c1] = stops[i + 1];
      if (ph >= p0 && ph <= p1) { const t = (ph - p0) / (p1 - p0); col = c0.map((v, j) => v + (c1[j] - v) * t); break; }
      if (ph > p1) col = c1;
    }
    return { color: col, str: 500 };
  }

  // Beer–Lambert style colour: each coloured species multiplies the transmittance.
  function color(c) {
    const ph = pH(c);
    let T = [1, 1, 1], absorb = 0;
    for (const k in c.sp) {
      const s = SPECIES[k];
      if (s.state !== 'aq') continue;
      let col = s.color, str = s.str;
      if (s.indicator) { const ic = indicatorColor(s.indicator, ph); if (!ic) continue; col = ic.color; str = ic.str; }
      if (!col) continue;
      const a = conc(c, k) * str * 0.35;
      for (let i = 0; i < 3; i++) T[i] *= Math.pow(Math.max(col[i], 4) / 255, a);
      absorb += a;
    }
    // suspended solids make it cloudy
    let cloud = 0, cc = [0, 0, 0], cw = 0;
    for (const k in c.sp) if (isSolid(k) && !SPECIES[k].metal && c.vol > 0.01) {
      const w = c.sp[k] / (c.vol / 1000); cw += w; SPECIES[k].color.forEach((v, i) => cc[i] += v * w);
    }
    if (cw > 0) { cloud = Math.min(0.55, cw * 6); cc = cc.map(v => v / cw); }
    let rgb = T.map((t, i) => 205 * t + 40 * t);
    rgb = rgb.map((v, i) => v * (1 - cloud) + cc[i] * cloud);
    const alpha = Math.min(0.92, 0.28 + (1 - (T[0] + T[1] + T[2]) / 3) * 0.75 + cloud);
    return `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${alpha.toFixed(3)})`;
  }

  // advance reactions; returns { gas: {CO2: mol, H2: mol}, active: bool }
  function step(c, dt) {
    const ev = { gas: {}, active: false };
    if (c.vol < 0.05) return ev;
    const tf = Math.pow(2, (c.T - 25) / 10);
    for (const rx of REACTIONS) {
      let lim = Infinity;
      for (const k in rx.r) lim = Math.min(lim, (c.sp[k] || 0) / rx.r[k]);
      if (!(lim > 1e-10)) continue;
      const x = lim * (1 - Math.exp(-rx.k * tf * dt));
      if (x < 1e-12) continue;
      for (const k in rx.r) { c.sp[k] -= x * rx.r[k]; if (c.sp[k] < 1e-11) delete c.sp[k]; }
      for (const k in rx.p) {
        if (SPECIES[k].state === 'g') { ev.gas[k] = (ev.gas[k] || 0) + x * rx.p[k]; c.gases[k] = (c.gases[k] || 0) + x * rx.p[k]; }
        else c.sp[k] = (c.sp[k] || 0) + x * rx.p[k];
      }
      // heat: q = -ΔH·ξ ; ΔT = q / (m·c)
      c.T += (-rx.dH * 1000 * x) / (4.184 * Math.max(c.vol, 1));
      if (x > 1e-7 && !c.log.includes(rx.eq)) c.log.push(rx.eq);
      ev.active = true;
    }
    c.T = Math.min(100, Math.max(0, c.T));
    return ev;
  }

  function cool(c, dt, ambient = 22) { c.T += (ambient - c.T) * (1 - Math.exp(-dt * 0.03)); }

  window.Chem = { SPECIES, REACTIONS, REAGENTS, create, fromReagent, total, take, mix, conc, pH, color, step, cool, isSolid };
})();
