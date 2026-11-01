/* Chemistry engine: species, reagents, reactions, and solution state.
 * Data-driven — add a species/reagent/reaction by adding an entry.
 *
 * Model:
 *  - Reactions with `K` are reversible equilibria. Each step the solver finds the extent that
 *    satisfies Q = K(T) (van 't Hoff temperature dependence from ΔH) and relaxes toward it at rate k.
 *    Precipitation/dissolution, water autoionization, weak acids and complexes all use this.
 *  - Reactions with `rate` are irreversible mass-action kinetics (gas evolution, metals).
 *  - Heat: reaction enthalpy, heaters, Newtonian cooling, boiling/evaporation at 100 °C.
 */
(function () {
  const R = 8.314;
  // state: aq (dissolved), s (solid), g (gas). color: [r,g,b], str = absorptivity per mol/L.
  // mv = molar bulk volume (mL/mol) for solids, M = molar mass (g/mol), cp = solid heat capacity (J/g·K).
  const SPECIES = {
    'H+':     { name: 'Hydrogen ion', formula: 'H⁺', state: 'aq', M: 1.008, wiki: 'Hydron_(chemistry)', info: 'A proton, carried by water as H₃O⁺. Its concentration sets the pH: pH = −log[H⁺].' },
    'OH-':    { name: 'Hydroxide', formula: 'OH⁻', state: 'aq', M: 17.01, wiki: 'Hydroxide', info: 'The ion that makes solutions basic. In water, [H⁺][OH⁻] = 1.0×10⁻¹⁴ at 25 °C.' },
    'Na+':    { name: 'Sodium ion', formula: 'Na⁺', state: 'aq', M: 22.99, wiki: 'Sodium', info: 'A spectator ion in nearly every reaction here. Almost all sodium salts are soluble.' },
    'K+':     { name: 'Potassium ion', formula: 'K⁺', state: 'aq', M: 39.10, wiki: 'Potassium', info: 'Spectator ion. Gives a lilac flame colour.' },
    'Cl-':    { name: 'Chloride', formula: 'Cl⁻', state: 'aq', M: 35.45, wiki: 'Chloride', info: 'Forms insoluble salts with Ag⁺ and (when concentrated) Pb²⁺.' },
    'I-':     { name: 'Iodide', formula: 'I⁻', state: 'aq', M: 126.9, wiki: 'Iodide', info: 'Forms the yellow precipitates AgI and PbI₂.' },
    'NO3-':   { name: 'Nitrate', formula: 'NO₃⁻', state: 'aq', M: 62.00, wiki: 'Nitrate', info: 'All nitrates are soluble, which is why nitrate salts are used to supply metal ions.' },
    'SO4--':  { name: 'Sulfate', formula: 'SO₄²⁻', state: 'aq', M: 96.06, wiki: 'Sulfate', info: 'Precipitates with Ba²⁺ as BaSO₄, the standard test for sulfate.' },
    'HCO3-':  { name: 'Bicarbonate', formula: 'HCO₃⁻', state: 'aq', M: 61.02, wiki: 'Bicarbonate', info: 'Amphoteric: reacts with acid to release CO₂, and with base to form carbonate.' },
    'H2CO3':  { name: 'Carbonic acid', formula: 'H₂CO₃', state: 'aq', M: 62.03, wiki: 'Carbonic_acid', info: 'Dissolved CO₂. Above about 0.034 M (its saturation at 1 atm) it escapes as bubbles. This is why acid added to bicarbonate fizzes.' },
    'CO3--':  { name: 'Carbonate', formula: 'CO₃²⁻', state: 'aq', M: 60.01, wiki: 'Carbonate', info: 'Conjugate base of bicarbonate (pKa 10.3).' },
    'SCN-':   { name: 'Thiocyanate', formula: 'SCN⁻', state: 'aq', M: 58.08, wiki: 'Thiocyanate', info: 'Binds Fe³⁺ to form a blood-red complex.' },
    'HAc':    { name: 'Acetic acid', formula: 'CH₃COOH', state: 'aq', M: 60.05, wiki: 'Acetic_acid', info: 'A weak acid (pKa 4.76): only about 0.4 % of it is ionised in 1 M solution. It is what makes vinegar sour.' },
    'Ac-':    { name: 'Acetate', formula: 'CH₃COO⁻', state: 'aq', M: 59.04, wiki: 'Acetate', info: 'Conjugate base of acetic acid. Acetic acid plus acetate makes a buffer.' },
    'Ag+':    { name: 'Silver ion', formula: 'Ag⁺', state: 'aq', M: 107.9, wiki: 'Silver', info: 'Precipitates halides: AgCl (white), AgI (yellow).' },
    'Ba++':   { name: 'Barium ion', formula: 'Ba²⁺', state: 'aq', M: 137.3, wiki: 'Barium', info: 'Soluble barium salts are toxic. Gives a green flame.' },
    'Pb++':   { name: 'Lead(II) ion', formula: 'Pb²⁺', state: 'aq', M: 207.2, wiki: 'Lead', info: 'Toxic heavy-metal ion. Precipitates as PbI₂ (yellow) and PbCl₂ (white).' },
    'Mg++':   { name: 'Magnesium ion', formula: 'Mg²⁺', state: 'aq', M: 24.31, wiki: 'Magnesium', info: 'Colourless. Precipitates as Mg(OH)₂ in strong base.' },
    'Cu++':   { name: 'Copper(II) ion', formula: 'Cu²⁺', state: 'aq', M: 63.55, color: [70, 150, 255], str: 5, wiki: 'Copper',
                info: 'Hydrated [Cu(H₂O)₆]²⁺ absorbs red-orange light, so it looks blue.' },
    'Fe+++':  { name: 'Iron(III) ion', formula: 'Fe³⁺', state: 'aq', M: 55.85, color: [255, 185, 50], str: 6, wiki: 'Iron(III)', info: 'Yellow-orange in water. Precipitates as rust-brown Fe(OH)₃ in base.' },
    'FeSCN++':{ name: 'Thiocyanatoiron(III)', formula: '[Fe(SCN)]²⁺', state: 'aq', M: 113.9, color: [170, 10, 10], str: 60, wiki: 'Iron(III)_thiocyanate',
                info: 'Intensely blood-red complex, used as a classic test for Fe³⁺. Its formation is an equilibrium, so it is a common demonstration of Le Chatelier\'s principle.' },
    'HIn':    { name: 'Phenolphthalein', formula: 'C₂₀H₁₄O₄', state: 'aq', M: 318.3, indicator: 'phenolphthalein', wiki: 'Phenolphthalein',
                info: 'Acid–base indicator: colourless below pH 8.2, pink-magenta above about pH 10.' },
    'UI':     { name: 'Universal indicator', formula: 'mixture', state: 'aq', M: 300, indicator: 'universal', wiki: 'Universal_indicator',
                info: 'A blend of dyes that runs red (pH 1) → orange → yellow → green (7) → blue → violet (13).' },
    // solids
    'AgCl':   { name: 'Silver chloride', formula: 'AgCl', state: 's', M: 143.3, mv: 26, cp: 0.36, color: [245, 245, 238], grain: 1.6, wiki: 'Silver_chloride',
                info: 'White curdy precipitate, Ksp 1.8×10⁻¹⁰. It darkens slowly in light as Ag⁺ is reduced to silver, the chemistry behind early photography.' },
    'AgI':    { name: 'Silver iodide', formula: 'AgI', state: 's', M: 234.8, mv: 41, cp: 0.24, color: [240, 228, 150], grain: 1.6, wiki: 'Silver_iodide', info: 'Pale yellow, extremely insoluble (Ksp 8.5×10⁻¹⁷). Used for cloud seeding.' },
    'Cu(OH)2':{ name: 'Copper(II) hydroxide', formula: 'Cu(OH)₂', state: 's', M: 97.56, mv: 29, cp: 0.8, color: [80, 150, 235], grain: 2, wiki: 'Copper(II)_hydroxide', info: 'Pale blue gelatinous precipitate. Dissolves in acid.' },
    'Fe(OH)3':{ name: 'Iron(III) hydroxide', formula: 'Fe(OH)₃', state: 's', M: 106.9, mv: 31, cp: 0.8, color: [160, 75, 20], grain: 2, wiki: 'Iron(III)_oxide-hydroxide', info: 'Rust-brown precipitate, Ksp about 10⁻³⁹. Essentially rust.' },
    'Mg(OH)2':{ name: 'Magnesium hydroxide', formula: 'Mg(OH)₂', state: 's', M: 58.32, mv: 25, cp: 1.3, color: [250, 250, 250], grain: 1.6, wiki: 'Magnesium_hydroxide', info: 'Milk of magnesia, used as an antacid.' },
    'BaSO4':  { name: 'Barium sulfate', formula: 'BaSO₄', state: 's', M: 233.4, mv: 52, cp: 0.44, color: [252, 252, 252], grain: 1.4, wiki: 'Barium_sulfate',
                info: 'So insoluble (Ksp 1.1×10⁻¹⁰) that it is swallowed as an X-ray contrast agent, even though Ba²⁺ is toxic.' },
    'BaCO3':  { name: 'Barium carbonate', formula: 'BaCO₃', state: 's', M: 197.3, mv: 46, cp: 0.43, color: [250, 250, 245], grain: 1.5, wiki: 'Barium_carbonate', info: 'White precipitate that dissolves and fizzes in acid.' },
    'PbI2':   { name: 'Lead(II) iodide', formula: 'PbI₂', state: 's', M: 461.0, mv: 75, cp: 0.17, color: [255, 210, 0], grain: 1.8, wiki: 'Lead(II)_iodide',
                info: 'Bright yellow. Its solubility rises steeply with temperature: heat it until it dissolves, then let it cool, and glittering "golden rain" crystals form.' },
    'PbCl2':  { name: 'Lead(II) chloride', formula: 'PbCl₂', state: 's', M: 278.1, mv: 48, cp: 0.24, color: [245, 245, 245], grain: 1.6, wiki: 'Lead(II)_chloride', info: 'White needles, moderately soluble (Ksp 1.7×10⁻⁵) and much more soluble in hot water.' },
    'Mg':     { name: 'Magnesium', formula: 'Mg', state: 's', M: 24.31, mv: 14, cp: 1.02, color: [175, 178, 188], grain: 4, metal: true, wiki: 'Magnesium',
                info: 'Reactive metal. It dissolves in acid releasing hydrogen, and displaces copper from Cu²⁺ solutions.' },
    'Cu':     { name: 'Copper', formula: 'Cu', state: 's', M: 63.55, mv: 7.1, cp: 0.39, color: [190, 110, 55], grain: 2.2, metal: true, wiki: 'Copper', info: 'Salmon-pink metal, deposited when a more reactive metal reduces Cu²⁺.' },
    'NaHCO3(s)': { name: 'Sodium bicarbonate', formula: 'NaHCO₃', state: 's', M: 84.01, mv: 38, cp: 1.0, color: [250, 250, 250], grain: 2, wiki: 'Sodium_bicarbonate', info: 'Baking soda. Solubility about 96 g/L at 20 °C.' },
    'NaCl(s)':{ name: 'Sodium chloride', formula: 'NaCl', state: 's', M: 58.44, mv: 27, cp: 0.86, color: [248, 248, 252], grain: 2.2, wiki: 'Sodium_chloride', info: 'Table salt. Solubility about 360 g/L, almost independent of temperature. Boil brine dry and cubic crystals appear.' },
    'CuSO4(s)':{ name: 'Copper(II) sulfate pentahydrate', formula: 'CuSO₄·5H₂O', state: 's', M: 249.7, mv: 110, cp: 1.1, color: [40, 110, 230], grain: 2.6, wiki: 'Copper(II)_sulfate', info: 'Blue vitriol: bright blue crystals.' },
    // gases (leave the solution as bubbles)
    'CO2':    { name: 'Carbon dioxide', formula: 'CO₂', state: 'g', M: 44.01, wiki: 'Carbon_dioxide', info: 'Released as bubbles when acid meets a carbonate or bicarbonate. Turns limewater milky.' },
    'H2':     { name: 'Hydrogen', formula: 'H₂', state: 'g', M: 2.016, wiki: 'Hydrogen', info: 'The lightest gas. Flammable: it gives a squeaky "pop" with a lit splint.' },
  };

  // K: equilibrium constant at 25 °C over aqueous concentrations (solids & water = 1).
  // dH: kJ per mol of reaction (forward). k: relaxation rate 1/s. rate: mass-action constant for irreversible ones.
  const REACTIONS = [
    { r: {}, p: { 'H+': 1, 'OH-': 1 }, K: 1.0e-14, dH: 55.8, k: 40, eq: 'H₂O ⇌ H⁺ + OH⁻', name: 'Water autoionization (neutralization in reverse)', quiet: 1e-5 },
    { r: { 'HAc': 1 }, p: { 'H+': 1, 'Ac-': 1 }, K: 1.75e-5, dH: 0.4, k: 40, eq: 'CH₃COOH ⇌ H⁺ + CH₃COO⁻', name: 'Weak acid dissociation', quiet: 1e-5 },
    { r: { 'HCO3-': 1 }, p: { 'H+': 1, 'CO3--': 1 }, K: 4.7e-11, dH: 14.7, k: 40, eq: 'HCO₃⁻ ⇌ H⁺ + CO₃²⁻', name: 'Bicarbonate dissociation', quiet: 1e-5 },
    { r: { 'H2CO3': 1 }, p: { 'H+': 1, 'HCO3-': 1 }, K: 4.45e-7, dH: 7.6, k: 40, eq: 'H₂CO₃ ⇌ H⁺ + HCO₃⁻', name: 'Carbonic acid dissociation', quiet: 1e-5 },
    // direct proton transfers (same chemistry as above, but they converge without waiting on the tiny H⁺/OH⁻ pool)
    { r: { 'HCO3-': 2 }, p: { 'H2CO3': 1, 'CO3--': 1 }, K: 4.7e-11 / 4.45e-7, dH: 7.1, k: 40, eq: '2HCO₃⁻ ⇌ H₂CO₃ + CO₃²⁻', quiet: 1 },
    { r: { 'HAc': 1, 'HCO3-': 1 }, p: { 'Ac-': 1, 'H2CO3': 1 }, K: 1.75e-5 / 4.45e-7, dH: -7.2, k: 20, eq: 'CH₃COOH + HCO₃⁻ ⇌ CH₃COO⁻ + H₂CO₃', name: 'Weak acid + bicarbonate' },
    { r: { 'OH-': 1, 'HCO3-': 1 }, p: { 'CO3--': 1 }, K: 4.7e-11 / 1e-14, dH: -41.1, k: 40, eq: 'OH⁻ + HCO₃⁻ ⇌ CO₃²⁻ + H₂O', quiet: 1e-5 },
    { r: { 'OH-': 1, 'HAc': 1 }, p: { 'Ac-': 1 }, K: 1.75e-5 / 1e-14, dH: -55.4, k: 40, eq: 'OH⁻ + CH₃COOH ⇌ CH₃COO⁻ + H₂O', name: 'Weak acid neutralization', quiet: 1e-5 },
    { r: { 'H2CO3': 1 }, p: { 'CO2': 1 }, rate: 2.5, sat: 0.034, dH: 20, eq: 'H₂CO₃ → H₂O + CO₂(g)', name: 'Degassing (fizz)' },
    { r: { 'Ag+': 1, 'Cl-': 1 }, p: { 'AgCl': 1 }, K: 1 / 1.77e-10, dH: -65.5, k: 12, eq: 'Ag⁺ + Cl⁻ ⇌ AgCl(s)', name: 'Precipitation' },
    { r: { 'Ag+': 1, 'I-': 1 }, p: { 'AgI': 1 }, K: 1 / 8.5e-17, dH: -112, k: 12, eq: 'Ag⁺ + I⁻ ⇌ AgI(s)', name: 'Precipitation' },
    { r: { 'Cu++': 1, 'OH-': 2 }, p: { 'Cu(OH)2': 1 }, K: 1 / 2.2e-20, dH: -45, k: 10, eq: 'Cu²⁺ + 2OH⁻ ⇌ Cu(OH)₂(s)', name: 'Precipitation' },
    { r: { 'Fe+++': 1, 'OH-': 3 }, p: { 'Fe(OH)3': 1 }, K: 1 / 2.8e-39, dH: -60, k: 10, eq: 'Fe³⁺ + 3OH⁻ ⇌ Fe(OH)₃(s)', name: 'Precipitation' },
    { r: { 'Mg++': 1, 'OH-': 2 }, p: { 'Mg(OH)2': 1 }, K: 1 / 5.6e-12, dH: -3, k: 6, eq: 'Mg²⁺ + 2OH⁻ ⇌ Mg(OH)₂(s)', name: 'Precipitation' },
    { r: { 'Ba++': 1, 'SO4--': 1 }, p: { 'BaSO4': 1 }, K: 1 / 1.1e-10, dH: -26, k: 12, eq: 'Ba²⁺ + SO₄²⁻ ⇌ BaSO₄(s)', name: 'Precipitation' },
    { r: { 'Ba++': 1, 'CO3--': 1 }, p: { 'BaCO3': 1 }, K: 1 / 2.6e-9, dH: -4, k: 10, eq: 'Ba²⁺ + CO₃²⁻ ⇌ BaCO₃(s)', name: 'Precipitation' },
    { r: { 'Pb++': 1, 'I-': 2 }, p: { 'PbI2': 1 }, K: 1 / 9.8e-9, dH: -63, k: 6, eq: 'Pb²⁺ + 2I⁻ ⇌ PbI₂(s)', name: 'Precipitation (golden rain)' },
    { r: { 'Pb++': 1, 'Cl-': 2 }, p: { 'PbCl2': 1 }, K: 1 / 1.7e-5, dH: -26, k: 4, eq: 'Pb²⁺ + 2Cl⁻ ⇌ PbCl₂(s)', name: 'Precipitation' },
    { r: { 'Fe+++': 1, 'SCN-': 1 }, p: { 'FeSCN++': 1 }, K: 138, dH: -5, k: 15, eq: 'Fe³⁺ + SCN⁻ ⇌ [Fe(SCN)]²⁺', name: 'Complexation' },
    { r: { 'NaHCO3(s)': 1 }, p: { 'Na+': 1, 'HCO3-': 1 }, K: 1.3, dH: 17, k: 0.6, eq: 'NaHCO₃(s) ⇌ Na⁺ + HCO₃⁻', name: 'Dissolving' },
    { r: { 'NaCl(s)': 1 }, p: { 'Na+': 1, 'Cl-': 1 }, K: 37.7, dH: 3.9, k: 0.6, eq: 'NaCl(s) ⇌ Na⁺ + Cl⁻', name: 'Dissolving' },
    { r: { 'CuSO4(s)': 1 }, p: { 'Cu++': 1, 'SO4--': 1 }, K: 2.0, dH: 11.5, k: 0.4, eq: 'CuSO₄·5H₂O(s) ⇌ Cu²⁺ + SO₄²⁻ + 5H₂O', name: 'Dissolving' },
    { r: { 'Mg': 1, 'H+': 2 }, p: { 'Mg++': 1, 'H2': 1 }, rate: 0.012, dH: -467, eq: 'Mg + 2H⁺ → Mg²⁺ + H₂(g)', name: 'Metal + acid', solidRate: true },
    { r: { 'Mg': 1, 'Cu++': 1 }, p: { 'Mg++': 1, 'Cu': 1 }, rate: 0.008, dH: -532, eq: 'Mg + Cu²⁺ → Mg²⁺ + Cu(s)', name: 'Displacement', solidRate: true },
  ];

  // Reagents: `aq` = mol/L in the solution; `solid` = mol of solid per jar.
  const REAGENTS = [
    { id: 'water', cat: 'Solvents', name: 'Distilled water', short: 'H₂O', aq: {}, wiki: 'Distilled_water', info: 'Purified water, pH 7.00 at 25 °C. Its own ions (H⁺ and OH⁻ at 10⁻⁷ M) are tracked too.' },
    { id: 'hcl', cat: 'Acids', name: 'Hydrochloric acid 1 M', short: 'HCl 1M', aq: { 'H+': 1, 'Cl-': 1 }, hazard: 'Corrosive', wiki: 'Hydrochloric_acid', info: 'A strong acid that ionises completely: HCl → H⁺ + Cl⁻. pH 0 at 1 M.' },
    { id: 'hno3', cat: 'Acids', name: 'Nitric acid 1 M', short: 'HNO₃ 1M', aq: { 'H+': 1, 'NO3-': 1 }, hazard: 'Corrosive, oxidizer', wiki: 'Nitric_acid', info: 'Strong acid. Unlike HCl, its anion forms no precipitates.' },
    { id: 'h2so4', cat: 'Acids', name: 'Sulfuric acid 0.5 M', short: 'H₂SO₄ .5M', aq: { 'H+': 1, 'SO4--': 0.5 }, hazard: 'Corrosive', wiki: 'Sulfuric_acid', info: 'Diprotic strong acid. It supplies sulfate, so it precipitates Ba²⁺.' },
    { id: 'vinegar', cat: 'Acids', name: 'Vinegar (acetic acid 0.8 M)', short: 'Vinegar', aq: { 'HAc': 0.8 }, wiki: 'Vinegar', info: 'About 5 % acetic acid. Because acetic acid is weak, pH is about 2.4 rather than 0.1.' },
    { id: 'naoh', cat: 'Bases', name: 'Sodium hydroxide 1 M', short: 'NaOH 1M', aq: { 'Na+': 1, 'OH-': 1 }, hazard: 'Corrosive', wiki: 'Sodium_hydroxide', info: 'Lye. A strong base, pH 14 at 1 M. Dissolving it in water releases heat.' },
    { id: 'naoh01', cat: 'Bases', name: 'Sodium hydroxide 0.1 M', short: 'NaOH .1M', aq: { 'Na+': 0.1, 'OH-': 0.1 }, hazard: 'Irritant', wiki: 'Sodium_hydroxide', info: 'Dilute lye, pH 13. Good for titrations.' },
    { id: 'nacl', cat: 'Salt solutions', name: 'Sodium chloride 1 M', short: 'NaCl 1M', aq: { 'Na+': 1, 'Cl-': 1 }, wiki: 'Saline_water', info: 'Brine, a source of chloride ions.' },
    { id: 'agno3', cat: 'Salt solutions', name: 'Silver nitrate 0.1 M', short: 'AgNO₃', aq: { 'Ag+': 0.1, 'NO3-': 0.1 }, hazard: 'Stains skin black', wiki: 'Silver_nitrate', info: 'Test reagent for halides: white AgCl, cream AgBr, yellow AgI.' },
    { id: 'cuso4', cat: 'Salt solutions', name: 'Copper(II) sulfate 0.5 M', short: 'CuSO₄', aq: { 'Cu++': 0.5, 'SO4--': 0.5 }, hazard: 'Harmful', wiki: 'Copper(II)_sulfate', info: 'The classic blue solution.' },
    { id: 'fecl3', cat: 'Salt solutions', name: 'Iron(III) chloride 0.2 M', short: 'FeCl₃', aq: { 'Fe+++': 0.2, 'Cl-': 0.6 }, hazard: 'Corrosive', wiki: 'Iron(III)_chloride', info: 'Orange-yellow. Used to etch circuit boards.' },
    { id: 'kscn', cat: 'Salt solutions', name: 'Potassium thiocyanate 0.1 M', short: 'KSCN', aq: { 'K+': 0.1, 'SCN-': 0.1 }, wiki: 'Potassium_thiocyanate', info: 'Turns blood-red with Fe³⁺.' },
    { id: 'bacl2', cat: 'Salt solutions', name: 'Barium chloride 0.5 M', short: 'BaCl₂', aq: { 'Ba++': 0.5, 'Cl-': 1 }, hazard: 'Toxic', wiki: 'Barium_chloride', info: 'Test reagent for sulfate: gives a white BaSO₄ precipitate.' },
    { id: 'na2so4', cat: 'Salt solutions', name: 'Sodium sulfate 0.5 M', short: 'Na₂SO₄', aq: { 'Na+': 1, 'SO4--': 0.5 }, wiki: 'Sodium_sulfate', info: 'A neutral source of sulfate ions.' },
    { id: 'pbno3', cat: 'Salt solutions', name: 'Lead(II) nitrate 0.01 M', short: 'Pb(NO₃)₂', aq: { 'Pb++': 0.01, 'NO3-': 0.02 }, hazard: 'Toxic', wiki: 'Lead(II)_nitrate', info: 'A soluble lead salt. For golden rain, mix about 10 mL with 5 mL KI, heat until the yellow dissolves, then let it cool.' },
    { id: 'ki', cat: 'Salt solutions', name: 'Potassium iodide 0.05 M', short: 'KI', aq: { 'K+': 0.05, 'I-': 0.05 }, wiki: 'Potassium_iodide', info: 'A source of iodide ions.' },
    { id: 'nahco3', cat: 'Salt solutions', name: 'Sodium bicarbonate 0.5 M', short: 'NaHCO₃', aq: { 'Na+': 0.5, 'HCO3-': 0.5 }, wiki: 'Sodium_bicarbonate', info: 'Mildly basic (pH about 8.3). Fizzes with acids.' },
    { id: 'php', cat: 'Indicators', name: 'Phenolphthalein', short: 'Phenol.', aq: { 'HIn': 0.01 }, wiki: 'Phenolphthalein', info: 'Colourless in acid, pink in base. The usual titration indicator.' },
    { id: 'ui', cat: 'Indicators', name: 'Universal indicator', short: 'Univ. ind.', aq: { 'UI': 0.01 }, wiki: 'Universal_indicator', info: 'Shows the approximate pH as a colour.' },
    { id: 'mg', cat: 'Solids', name: 'Magnesium turnings', short: 'Mg', solid: { 'Mg': 0.6 }, hazard: 'Flammable', wiki: 'Magnesium', info: 'Drop into acid for hydrogen bubbles, or into CuSO₄ to plate out copper.' },
    { id: 'bsoda', cat: 'Solids', name: 'Sodium bicarbonate', short: 'NaHCO₃(s)', solid: { 'NaHCO3(s)': 0.5 }, wiki: 'Sodium_bicarbonate', info: 'Baking soda powder.' },
    { id: 'saltS', cat: 'Solids', name: 'Sodium chloride crystals', short: 'NaCl(s)', solid: { 'NaCl(s)': 0.6 }, wiki: 'Sodium_chloride', info: 'Table salt.' },
    { id: 'cuso4s', cat: 'Solids', name: 'Copper(II) sulfate crystals', short: 'CuSO₄(s)', solid: { 'CuSO4(s)': 0.15 }, hazard: 'Harmful', wiki: 'Copper(II)_sulfate', info: 'Blue crystals that dissolve to give the blue Cu²⁺ solution. The dissolving is slightly endothermic.' },
  ];

  const isSolid = (id) => SPECIES[id].state === 's';

  function create(T = 22) { return { vol: 0, sp: {}, T, log: [], gases: {} }; }

  function fromReagent(rg, volume) {
    const c = create();
    if (rg.solid) { for (const k in rg.solid) c.sp[k] = rg.solid[k]; }
    else { c.vol = volume; for (const k in rg.aq) c.sp[k] = rg.aq[k] * volume / 1000; }
    for (let i = 0; i < 40; i++) step(c, 0.25);
    c.log = []; c.T = 22;
    return c;
  }

  function total(c) {
    let v = c.vol;
    for (const k in c.sp) if (isSolid(k)) v += c.sp[k] * SPECIES[k].mv;
    return v;
  }

  function take(c, f) {
    f = Math.min(1, Math.max(0, f));
    const out = { vol: c.vol * f, sp: {}, T: c.T, log: c.log.slice(-8), gases: {} };
    c.vol -= out.vol;
    for (const k in c.sp) { const m = c.sp[k] * f; out.sp[k] = m; c.sp[k] -= m; if (c.sp[k] <= 0) delete c.sp[k]; }
    return out;
  }

  function heatCap(c) {
    let C = 4.184 * c.vol + 60; // water + a little glass
    for (const k in c.sp) if (isSolid(k)) C += c.sp[k] * SPECIES[k].M * (SPECIES[k].cp || 0.8);
    return C;
  }

  function mix(c, p) {
    const a = heatCap(c), b = heatCap(p) - 60;
    c.T = (c.T * a + p.T * Math.max(b, 0.01)) / (a + Math.max(b, 0.01));
    c.vol += p.vol;
    for (const k in p.sp) c.sp[k] = (c.sp[k] || 0) + p.sp[k];
    for (const e of p.log || []) if (!c.log.includes(e)) c.log.push(e);
  }

  function conc(c, k) { return c.vol > 0.001 ? (c.sp[k] || 0) / (c.vol / 1000) : 0; }

  function pH(c) {
    if (c.vol < 0.01) return null;
    const h = conc(c, 'H+');
    return h > 0 ? Math.max(-1.5, Math.min(15.5, -Math.log10(h))) : 7;
  }

  function Kat(rx, T) { return Math.log(rx.K) - (rx.dH * 1000 / R) * (1 / (T + 273.15) - 1 / 298.15); }

  // extent x (mol) at which Q = K, bounded by available amounts
  function eqExtent(c, rx, lnK) {
    const V = c.vol / 1000;
    let xmax = Infinity, xmin = -Infinity;
    for (const k in rx.r) xmax = Math.min(xmax, (c.sp[k] || 0) / rx.r[k]);
    for (const k in rx.p) xmin = Math.max(xmin, -(c.sp[k] || 0) / rx.p[k]);
    if (xmax === Infinity) xmax = V * 2;
    if (xmin === -Infinity) xmin = -V * 2;
    if (xmax - xmin < 1e-30) return 0;
    const f = (x) => {
      let s = -lnK;
      for (const k in rx.p) if (!isSolid(k)) s += rx.p[k] * Math.log(Math.max(((c.sp[k] || 0) + rx.p[k] * x) / V, 1e-40));
      for (const k in rx.r) if (!isSolid(k)) s -= rx.r[k] * Math.log(Math.max(((c.sp[k] || 0) - rx.r[k] * x) / V, 1e-40));
      return s;
    };
    if (f(xmax) <= 0) return xmax;
    if (f(xmin) >= 0) return xmin;
    let lo = xmin, hi = xmax;
    for (let i = 0; i < 64; i++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; }
    return (lo + hi) / 2;
  }

  function apply(c, rx, x, ev) {
    for (const k in rx.r) { c.sp[k] = (c.sp[k] || 0) - x * rx.r[k]; if (c.sp[k] <= 1e-30) delete c.sp[k]; }
    for (const k in rx.p) {
      if (SPECIES[k].state === 'g') { ev.gas[k] = (ev.gas[k] || 0) + x * rx.p[k]; c.gases[k] = (c.gases[k] || 0) + x * rx.p[k]; }
      else { c.sp[k] = (c.sp[k] || 0) + x * rx.p[k]; if (c.sp[k] <= 1e-30) delete c.sp[k]; }
    }
    c.T += (-rx.dH * 1000 * x) / heatCap(c);
    if (Math.abs(x) > (rx.quiet || 1e-7) && !c.log.includes(rx.eq)) c.log.push(rx.eq);
    if (Math.abs(x) > 1e-9) ev.active = true;
  }

  // advance chemistry; returns { gas: {CO2: mol, H2: mol}, active }
  function step(c, dt) {
    const ev = { gas: {}, active: false };
    if (c.vol < 0.05) return ev;
    const tf = Math.min(60, Math.pow(2, (c.T - 25) / 10));
    const V = c.vol / 1000;
    // equilibria are coupled (e.g. water + carbonic acid), so sweep them a few times per step
    for (let sweep = 0; sweep < 5; sweep++) for (const rx of REACTIONS) {
      if (!rx.K) continue;
      const xe = eqExtent(c, rx, Kat(rx, c.T));
      const x = xe * (1 - Math.exp(-rx.k * tf * dt / 5));
      if (x !== 0) apply(c, rx, x, ev);
    }
    for (const rx of REACTIONS) {
      if (rx.K) continue;
      {

        let rate = rx.rate * tf, lim = Infinity;
        for (const k in rx.r) {
          const n = c.sp[k] || 0; lim = Math.min(lim, n / rx.r[k]);
          if (!isSolid(k)) rate *= Math.pow(n / V, rx.solidRate ? 1 : rx.r[k]);
        }
        if (!(lim > 0)) continue;
        if (rx.sat) { lim = Math.min(lim, (c.sp[Object.keys(rx.r)[0]] || 0) - rx.sat * V); if (!(lim > 0)) continue; rate = rx.rate * tf * lim; }
        else if (!rx.solidRate) rate *= V;
        const x = Math.min(lim, rate * dt);
        if (x > 1e-14) apply(c, rx, x, ev);
      }
    }
    c.T = Math.min(400, Math.max(-5, c.T));
    return ev;
  }

  // heaters, cooling, boiling. Returns grams of water evaporated.
  function heat(c, watts, dt, ambient = 22) {
    const C = heatCap(c);
    const loss = 0.45 * (c.T - ambient);
    c.T += (watts - loss) * dt / C;
    let evap = 0;
    if (c.vol > 0 && c.T > 100) {
      evap = Math.min(c.vol, (c.T - 100) * C / 2257);
      c.vol -= evap; c.T = 100;
    }
    // slow evaporation below boiling
    if (c.vol > 0 && c.T > 40) { const e = Math.min(c.vol, 2e-5 * (c.T - 40) * dt * Math.sqrt(c.vol)); c.vol -= e; evap += e; }
    if (c.vol < 1e-4) c.vol = 0;
    c.T = Math.min(400, c.T);
    return evap;
  }

  // reactions that a species takes part in (for the wiki)
  function reactionsOf(id) { return REACTIONS.filter(rx => id in rx.r || id in rx.p); }

  window.Chem = { SPECIES, REACTIONS, REAGENTS, create, fromReagent, total, take, mix, conc, pH, color, step, heat, isSolid, reactionsOf, heatCap };

  function indicatorColor(type, ph) {
    if (ph == null) return null;
    if (type === 'phenolphthalein') {
      const f = Math.min(1, Math.max(0, (ph - 8.2) / 1.6));
      return f > 0 ? { color: [255, 30, 170], str: 900 * f } : null;
    }
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

  // Beer–Lambert style colour
  function color(c) {
    const ph = pH(c);
    let T = [1, 1, 1];
    for (const k in c.sp) {
      const s = SPECIES[k];
      if (s.state !== 'aq') continue;
      let col = s.color, str = s.str;
      if (s.indicator) { const ic = indicatorColor(s.indicator, ph); if (!ic) continue; col = ic.color; str = ic.str; }
      if (!col) continue;
      const a = conc(c, k) * str * 0.35;
      for (let i = 0; i < 3; i++) T[i] *= Math.pow(Math.max(col[i], 4) / 255, a);
    }
    let cloud = 0, cc = [0, 0, 0], cw = 0;
    for (const k in c.sp) if (isSolid(k) && !SPECIES[k].metal && c.vol > 0.01) {
      const w = c.sp[k] / (c.vol / 1000); cw += w; SPECIES[k].color.forEach((v, i) => cc[i] += v * w);
    }
    if (cw > 0) { cloud = Math.min(0.55, cw * 6); cc = cc.map(v => v / cw); }
    let rgb = T.map(t => 245 * t);
    rgb = rgb.map((v, i) => v * (1 - cloud) + cc[i] * cloud);
    const alpha = Math.min(0.92, 0.28 + (1 - (T[0] + T[1] + T[2]) / 3) * 0.75 + cloud);
    return `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${alpha.toFixed(3)})`;
  }
})();
