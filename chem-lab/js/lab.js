/* Lab scene: glassware physics, pouring, rendering, input, tooltips. */
(function () {
  const cv = document.getElementById('lab');
  const ctx = cv.getContext('2d');
  const tip = document.getElementById('tip');
  let W = 0, H = 0, DPR = 1, benchY = 0;
  const G = 1800; // px/s²

  // ---------- geometry helpers ----------
  function polyArea(p) { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(a / 2); }
  // keep the part of polygon where x*nx + y*ny >= d
  function clip(p, nx, ny, d) {
    const out = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      const da = a[0] * nx + a[1] * ny - d, db = b[0] * nx + b[1] * ny - d;
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
  }
  function inside(p, x, y) {
    let c = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++)
      if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
    return c;
  }
  function arc(cx, cy, r, a0, a1, n) { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; }

  // Shapes are centred on (0,0), y down; first & last points are the mouth (open top).
  const KINDS = {
    beaker: { name: 'Beaker', cap: 250, grad: true, shape: () => { const w = 92, h = 112; return [[-w / 2 - 5, -h / 2], [-w / 2, -h / 2 + 8], [-w / 2, h / 2 - 6], [-w / 2 + 6, h / 2], [w / 2 - 6, h / 2], [w / 2, h / 2 - 6], [w / 2, -h / 2 + 8], [w / 2 + 5, -h / 2]]; } },
    smallBeaker: { name: 'Beaker', cap: 100, grad: true, shape: () => { const w = 66, h = 80; return [[-w / 2 - 4, -h / 2], [-w / 2, -h / 2 + 6], [-w / 2, h / 2 - 5], [-w / 2 + 5, h / 2], [w / 2 - 5, h / 2], [w / 2, h / 2 - 5], [w / 2, -h / 2 + 6], [w / 2 + 4, -h / 2]]; } },
    tube: { name: 'Test tube', cap: 20, shape: null }, // built below
    flask: { name: 'Erlenmeyer flask', cap: 250, grad: true, shape: () => { const w = 104, h = 124, n = 15; return [[-n - 3, -h / 2], [-n, -h / 2 + 4], [-n, -h / 2 + 36], [-w / 2, h / 2 - 5], [-w / 2 + 5, h / 2], [w / 2 - 5, h / 2], [w / 2, h / 2 - 5], [n, -h / 2 + 36], [n, -h / 2 + 4], [n + 3, -h / 2]]; } },
    bottle: { name: 'Reagent bottle', cap: 100, label: true, shape: () => { const w = 58, h = 96, n = 11; return [[-n, -h / 2], [-n, -h / 2 + 14], [-w / 2, -h / 2 + 26], [-w / 2, h / 2], [w / 2, h / 2], [w / 2, -h / 2 + 26], [n, -h / 2 + 14], [n, -h / 2]]; } },
    jar: { name: 'Sample jar', cap: 60, label: true, shape: () => { const w = 60, h = 66; return [[-w / 2 + 6, -h / 2], [-w / 2 + 6, -h / 2 + 6], [-w / 2, -h / 2 + 12], [-w / 2, h / 2], [w / 2, h / 2], [w / 2, -h / 2 + 12], [w / 2 - 6, -h / 2 + 6], [w / 2 - 6, -h / 2]]; } },
  };
  KINDS.dropper = { name: 'Dropper pipette', cap: 3, dropper: true, shape: () => [[-4, -48], [-4, 36], [-1.3, 54], [1.3, 54], [4, 36], [4, -48]] };
  for (const [k, t] of Object.entries({ beaker: ['Beaker', 'A straight-sided container with a pouring spout, used for mixing and heating. The volume marks are only approximate, to about ±5 %.'], smallBeaker: ['Beaker', 'A smaller beaker, good for small mixtures and indicator tests.'], flask: ['Erlenmeyer_flask', 'A conical flask. The narrow neck reduces splashing and evaporation, which makes it the usual flask for swirling and titrations.'], tube: ['Test_tube', 'A small tube for qualitative tests with a few mL. You can hold it directly in a Bunsen flame to heat it.'], bottle: ['Laboratory_glassware', 'A stock bottle of reagent.'], jar: ['Laboratory_glassware', 'A wide-mouth jar for solids. Tilt it to tip out some of the contents.'], dropper: ['Eye_dropper', 'Dip the tip into a liquid to draw some up, about 3 mL. Then hold it over a container and it releases drops of about 0.05 mL each, which is useful for indicators and careful titrations.'] })) { KINDS[k].wiki = t[0]; KINDS[k].info = t[1]; }

  const DEVICES = {
    hotplate: { name: 'Hot plate', w: 124, h: 30, levels: [0, 120, 260, 500], wiki: 'Hot_plate', info: 'Electric heating plate. Tap it to cycle through off, low (120 W), medium (260 W) and high (500 W). Containers resting on the plate absorb that power, minus heat lost to the room.' },
    bunsen: { name: 'Bunsen burner', w: 96, h: 120, levels: [0, 450], wiki: 'Bunsen_burner', info: 'Gas burner under a tripod and wire gauze. Tap it to light it or turn it off. It delivers about 450 W to a container on the gauze, and you can also hold a test tube directly in the flame.' },
  };
  const devices = [];
  class Device {
    constructor(kind, x) { this.kind = kind; this.D = DEVICES[kind]; this.w = this.D.w; this.h = this.D.h; this.x = x; this.level = 0; this.id = ++uid; }
    get top() { return benchY - this.h; }
    get power() { return this.D.levels[this.level]; }
    hit(x, y) { return Math.abs(x - this.x) < this.w / 2 && y > this.top - 4 && y < benchY; }
    flame() { return this.kind === 'bunsen' && this.level ? { x: this.x, y0: benchY - 62, y1: benchY - 62 - 46 } : null; }
  }
  // test tube: build properly (straight walls + rounded bottom)
  KINDS.tube.shape = () => { const w = 26, h = 130; return [[-w / 2 - 2, -h / 2], [-w / 2, -h / 2 + 4], ...arc(0, h / 2 - w / 2, w / 2, Math.PI, 0, 12), [w / 2, -h / 2 + 4], [w / 2 + 2, -h / 2]]; };

  // ---------- vessels ----------
  let uid = 0;
  const vessels = [], drops = [], splats = [], steam = [];

  class Vessel {
    constructor(kind, x, reagent) {
      const K = KINDS[kind];
      this.id = ++uid; this.kind = kind; this.K = K;
      this.shape = K.shape(); this.area = polyArea(this.shape);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [px, py] of this.shape) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
      this.w = x1 - x0; this.h = y1 - y0; this.top = y0; this.bot = y1;
      this.cap = K.cap;
      this.x = x; this.y = benchY - this.h / 2 - 60; this.vx = 0; this.vy = 0; this.pvx = 0;
      this.angle = 0; this.slosh = 0; this.sloshV = 0;
      this.reagent = reagent || null;
      this.c = reagent ? Chem.fromReagent(reagent, this.cap * 0.8) : Chem.create();
      this.grains = []; this.bubbles = []; this.pourAcc = 0; this.flash = 0;
      this.manualTilt = 0; this.autoTilt = 0; this.dwell = 0;
      this.updateWorld();
      if (reagent && reagent.solid) this.syncGrains(true);
    }
    get title() { return this.reagent ? this.reagent.name : `${this.K.name} (${this.cap} mL)`; }
    toWorld(px, py) { const c = Math.cos(this.angle), s = Math.sin(this.angle); return [this.x + px * c - py * s, this.y + px * s + py * c]; }
    toLocal(wx, wy) { const c = Math.cos(this.angle), s = Math.sin(this.angle), dx = wx - this.x, dy = wy - this.y; return [dx * c + dy * s, -dx * s + dy * c]; }
    updateWorld() {
      this.wp = this.shape.map(p => this.toWorld(p[0], p[1]));
      // liquid surface: half-plane p·n >= d, n tilted by slosh angle
      this.nx = Math.sin(this.slosh); this.ny = Math.cos(this.slosh);
      const tot = Chem.total(this.c);
      this.fill = Math.min(1, tot / this.cap);
      this.liquid = null;
      if (tot > 0.01) {
        const target = this.fill * this.area;
        let lo = Infinity, hi = -Infinity;
        for (const p of this.wp) { const d = p[0] * this.nx + p[1] * this.ny; lo = Math.min(lo, d); hi = Math.max(hi, d); }
        for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (polyArea(clip(this.wp, this.nx, this.ny, m)) > target) lo = m; else hi = m; }
        this.d = (lo + hi) / 2;
        this.liquid = clip(this.wp, this.nx, this.ny, this.d);
      }
    }
    contains(x, y) { return inside(this.wp, x, y); }
    inLiquid(x, y) { return this.liquid && x * this.nx + y * this.ny >= this.d && inside(this.wp, x, y); }
    syncGrains(scatterTop) {
      const counts = {};
      for (const g of this.grains) counts[g.sp] = (counts[g.sp] || 0) + 1;
      for (const k in this.c.sp) {
        const S = Chem.SPECIES[k]; if (S.state !== 's') continue;
        const mol = this.c.sp[k];
        const want = mol < 1e-7 ? 0 : Math.max(2, Math.min(S.metal ? 40 : 160, Math.round(Math.sqrt(mol) * (S.metal ? 60 : 2400))));
        let have = counts[k] || 0;
        while (have < want) { this.addGrain(k, scatterTop); have++; }
        if (have > want) { let rm = have - want; this.grains = this.grains.filter(g => !(g.sp === k && rm-- > 0)); }
      }
      this.grains = this.grains.filter(g => this.c.sp[g.sp] > 1e-7);
    }
    addGrain(sp, scatterTop) {
      const S = Chem.SPECIES[sp];
      for (let t = 0; t < 30; t++) {
        const lx = (Math.random() - 0.5) * this.w * 0.9;
        const ly = scatterTop ? this.top + 10 + Math.random() * 20 : this.bot - Math.random() * this.h * Math.max(0.15, this.fill) * 0.9;
        if (inside(this.shape, lx, ly)) { this.grains.push({ sp, x: lx, y: ly, vy: 0, r: S.grain * (0.6 + Math.random() * 0.8), rot: Math.random() * 6, settled: false }); return; }
      }
    }
  }

  // ---------- spawning / layout ----------
  function freeX(w) {
    const area = W - 40;
    for (let t = 0; t < 40; t++) {
      const x = 40 + w / 2 + Math.random() * (area - w - 40);
      if (vessels.every(v => Math.abs(v.x - x) > (v.w + w) / 2 + 8)) return x;
    }
    return W / 2 + (Math.random() - 0.5) * 100;
  }
  function spawn(kind, reagent) {
    const v = new Vessel(kind, 0, reagent);
    v.x = freeX(v.w); v.y = benchY - v.h - 80; v.updateWorld();
    vessels.push(v); return v;
  }
  function addReagent(rg) { return spawn(rg.solid ? 'jar' : 'bottle', rg); }
  function addDevice(kind) {
    const d = new Device(kind, 0);
    for (let t = 0; t < 40; t++) { const x = 40 + d.w / 2 + Math.random() * (W - d.w - 80); if (devices.every(o => Math.abs(o.x - x) > (o.w + d.w) / 2 + 10)) { d.x = x; break; } d.x = W / 2; }
    devices.push(d); return d;
  }

  // ---------- input ----------
  const ptr = { x: 0, y: 0, down: false, moved: 0, t: 0, still: 0, type: 'mouse' };
  let drag = null, pending = null, hover = null, rotHold = 0, speed = 1;

  function deviceAt(x, y) { for (let i = devices.length - 1; i >= 0; i--) if (devices[i].hit(x, y)) return devices[i]; return null; }
  function topVesselAt(x, y) { for (let i = vessels.length - 1; i >= 0; i--) if (vessels[i].contains(x, y)) return vessels[i]; return null; }
  function pos(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

  cv.addEventListener('pointerdown', e => {
    const [x, y] = pos(e); ptr.type = e.pointerType;
    const v = topVesselAt(x, y), dv = v ? null : deviceAt(x, y);
    hideTip(); hover = null;
    if (!v && !dv) return;
    cv.setPointerCapture(e.pointerId);
    pending = { v, dv, x, y, t: performance.now(), id: e.pointerId };
    ptr.x = x; ptr.y = y;
  });
  cv.addEventListener('pointermove', e => {
    const [x, y] = pos(e);
    const dist = Math.hypot(x - ptr.x, y - ptr.y);
    ptr.x = x; ptr.y = y;
    if (pending && pending.dv && !drag && Math.hypot(x - pending.x, y - pending.y) > 6) {
      drag = { dev: pending.dv, ox: pending.dv.x - x, v: null }; pending = null;
    }
    if (pending && !drag && Math.hypot(x - pending.x, y - pending.y) > 6) {
      const v = pending.v;
      drag = { v, ox: v.x - x, oy: v.y - y, id: pending.id };
      vessels.splice(vessels.indexOf(v), 1); vessels.push(v);
      pending = null; hideTip();
      document.getElementById('rot').classList.add('on');
    }
    if (!drag && !pending && e.pointerType === 'mouse') {
      const v = topVesselAt(x, y);
      if (!v && hover) { hover = null; hideTip(); }
      if (v !== (hover && hover.v) || dist > 3) { if (!hover || hover.v !== v || dist > 3) { if (hover && hover.v === v && tip.classList.contains('show')) { placeTip(); } else { hover = v ? { v, t: performance.now() } : null; if (!v) hideTip(); } } }
    }
  });
  function endPtr() {
    if (pending && !drag && performance.now() - pending.t < 350) {
      if (pending.dv) { const d = pending.dv; d.level = (d.level + 1) % d.D.levels.length; }
      else if (pending.v) openWiki(pending.v.reagent ? 'rg:' + pending.v.reagent.id : pending.v);
    }
    if (drag && drag.dev) { drag = null; pending = null; return; }
    if (drag) { drag.v.vx *= 0.15; drag.v.vy *= 0.3; drag.v.manualTilt = 0; drag.v.autoTilt = 0; drag = null; document.getElementById('rot').classList.remove('on'); }
    pending = null;
  }
  cv.addEventListener('pointerup', endPtr);
  cv.addEventListener('pointercancel', endPtr);
  cv.addEventListener('pointerleave', () => { if (!drag) { hover = null; hideTip(); } });
  cv.addEventListener('wheel', e => { if (drag && drag.v) { drag.v.manualTilt = clampTilt(drag.v.manualTilt + Math.sign(e.deltaY) * 0.12); e.preventDefault(); } }, { passive: false });
  addEventListener('keydown', e => { if (e.key === 'Escape') closeWiki(); if (!drag || !drag.v) return; if (e.key === 'q' || e.key === 'Q') drag.v.manualTilt = clampTilt(drag.v.manualTilt - 0.15); if (e.key === 'e' || e.key === 'E') drag.v.manualTilt = clampTilt(drag.v.manualTilt + 0.15); });
  function clampTilt(a) { return Math.max(-2.3, Math.min(2.3, a)); }
  for (const [id, dir] of [['rotL', -1], ['rotR', 1]]) {
    const b = document.getElementById(id);
    b.addEventListener('pointerdown', e => { e.preventDefault(); rotHold = dir; });
    b.addEventListener('pointerup', () => rotHold = 0); b.addEventListener('pointerleave', () => rotHold = 0); b.addEventListener('pointercancel', () => rotHold = 0);
  }

  // ---------- tooltip ----------
  function fmtMol(m) { return m >= 0.01 ? m.toFixed(3) + ' mol' : (m * 1000).toFixed(m >= 1e-4 ? 2 : 3) + ' mmol'; }
  function fmtConc(c) { return c >= 0.1 ? c.toFixed(2) + ' M' : c >= 1e-4 ? (c * 1000).toFixed(1) + ' mM' : (c * 1e6).toFixed(1) + ' µM'; }
  function phLabel(p) { return p < 3 ? 'strongly acidic' : p < 6.5 ? 'acidic' : p <= 7.5 ? 'neutral' : p < 11 ? 'basic' : 'strongly basic'; }
  function tipHTML(v) {
    const c = v.c, tot = Chem.total(c), ph = Chem.pH(c);
    let mass = c.vol; // water ≈ 1 g/mL
    for (const k in c.sp) mass += c.sp[k] * Chem.SPECIES[k].M;
    let h = `<div class="t-title">${v.title}</div>`;
    if (v.reagent && v.reagent.hazard) h += `<div class="t-haz">⚠ ${v.reagent.hazard}</div>`;
    h += `<div class="t-grid"><span>Volume</span><b>${tot.toFixed(1)} / ${v.cap} mL</b><span>Temperature</span><b>${c.T.toFixed(1)} °C${v.heating ? ` <i>(heating ${v.heating} W${c.T >= 99.9 && c.vol > 0 ? ', boiling' : ''})</i>` : ''}</b>`;
    if (ph != null) h += `<span>pH</span><b>${ph.toFixed(2)} <i>(${phLabel(ph)})</i></b>`;
    if (tot > 0) h += `<span>Mass</span><b>${mass.toFixed(2)} g</b>`;
    h += `</div>`;
    if (tot < 0.01) return h + `<div class="t-empty">Empty</div>`;
    const aq = [], sol = [], notes = [];
    for (const k in c.sp) {
      const S = Chem.SPECIES[k], m = c.sp[k]; if (m < 1e-9) continue;
      const dot = S.color ? `<i class="dot" style="background:rgb(${S.color})"></i>` : `<i class="dot clear"></i>`;
      if (S.state === 'aq') aq.push(`<li>${dot}<b>${S.formula}</b> ${S.name}<em>${fmtConc(Chem.conc(c, k))}</em></li>`);
      else sol.push(`<li>${dot}<b>${S.formula}</b>(s) ${S.name}<em>${(m * S.M * 1000).toFixed(m * S.M > 0.01 ? 0 : 1)} mg</em></li>`);
      if (S.info && S.state !== 'aq' || S.color || S.indicator) notes.push(S.info);
    }
    if (c.vol > 0.01) aq.unshift(`<li><i class="dot clear"></i><b>H₂O</b> Water<em>${c.vol.toFixed(1)} mL</em></li>`);
    if (aq.length) h += `<div class="t-h">In solution</div><ul>${aq.join('')}</ul>`;
    if (sol.length) h += `<div class="t-h">Solids</div><ul>${sol.join('')}</ul>`;
    const gs = Object.entries(c.gases).filter(([, m]) => m > 1e-7);
    if (gs.length) h += `<div class="t-h">Gas released</div><ul>${gs.map(([k, m]) => `<li><b>${Chem.SPECIES[k].formula}</b> ${Chem.SPECIES[k].name}<em>${fmtMol(m)} ≈ ${(m * 24.5 * 1000).toFixed(1)} mL</em></li>`).join('')}</ul>`;
    if (c.log.length) h += `<div class="t-h">Reactions observed</div><ul class="eq">${c.log.slice(-6).map(e => `<li>${e}</li>`).join('')}</ul>`;
    if (notes.length) h += `<div class="t-note">${notes[(Math.floor(performance.now() / 5000)) % notes.length]}</div>`;
    h += `<div class="t-foot">Tap or click for the wiki</div>`;
    return h;
  }
  let tipTimer = 0;
  function placeTip() {
    const r = cv.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.left + ptr.x + 18, y = r.top + ptr.y + 18;
    if (x + tw > innerWidth - 8) x = r.left + ptr.x - tw - 18;
    if (x < 8) x = 8;
    if (y + th > innerHeight - 8) y = Math.max(8, innerHeight - th - 8);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function showTip(v, now) {
    if (now - tipTimer > 250 || !tip.classList.contains('show')) { tip.innerHTML = tipHTML(v); tipTimer = now; }
    if (!tip.classList.contains('show')) { tip.classList.add('show'); }
    placeTip();
  }
  function hideTip() { tip.classList.remove('show'); }

  // ---------- simulation ----------
  function heaterPower(v) {
    let P = 0;
    const bottom = Math.max(...v.wp.map(p => p[1]));
    for (const d of devices) {
      if (!d.level) continue;
      if (Math.abs(v.x - d.x) < d.w / 2 - 4 && Math.abs(bottom - d.top) < 3) P += d.power;
      const f = d.flame();
      if (f) { const b = v.wp.reduce((a, p) => p[1] > a[1] ? p : a); if (Math.abs(b[0] - f.x) < 16 && b[1] > f.y1 - 10 && b[1] < f.y0) P += 350; }
    }
    return P;
  }
  function update(dt, now) {
    const cdt = dt * speed; // chemistry & heat time
    if (drag && drag.dev) {
      const d = drag.dev, nx = Math.max(d.w / 2, Math.min(W - d.w / 2, ptr.x + drag.ox)), dx = nx - d.x;
      for (const v of vessels) { const b = Math.max(...v.wp.map(p => p[1])); if (Math.abs(v.x - d.x) < d.w / 2 && Math.abs(b - d.top) < 4) { v.x += dx; v.updateWorld(); } }
      d.x = nx;
    }
    if (drag && drag.v && drag.v.K.dropper) {
      const v = drag.v, tip = v.toWorld(0, v.bot - 1);
      const src = vessels.find(t => t !== v && t.inLiquid(tip[0], tip[1]));
      if (src && Chem.total(v.c) < v.cap - 0.01) {
        const want = Math.min(v.cap - Chem.total(v.c), 3 * dt), tot = Chem.total(src.c);
        if (tot > 0) { Chem.mix(v.c, Chem.take(src.c, Math.min(1, want / tot))); src.syncGrains(); v.syncGrains(); }
        v.dwell = 0;
      } else if (!src && v.c.vol > 0.01) {
        const tgt = vessels.find(t => t !== v && !t.K.dropper && Math.abs(t.toWorld(0, t.top)[0] - tip[0]) < t.w / 2 - 2 && tip[1] < t.toWorld(0, t.top)[1] + 30);
        v.dwell = tgt && Math.hypot(v.vx, v.vy) < 120 ? v.dwell + dt : 0;
        if (v.dwell > 0.35) {
          v.pourAcc += dt;
          if (v.pourAcc > 0.25) { v.pourAcc = 0; const p = Chem.take(v.c, Math.min(1, 0.05 / Chem.total(v.c))); drops.push({ x: tip[0], y: tip[1] + 2, vx: 0, vy: 30, p, src: v, age: 0, col: Chem.color(p), r: 2.4 }); }
        }
      }
    }
    if (drag && drag.v && !drag.v.K.dropper) {
      const v = drag.v;
      if (rotHold) v.manualTilt = clampTilt(v.manualTilt + rotHold * dt * 1.6);
      // auto-tilt: hold a vessel above another one's mouth and it starts pouring
      let target = null, best = Infinity;
      const vb = Math.max(...v.wp.map(p => p[1]));
      for (const t of vessels) {
        if (t === v) continue;
        const tm = t.toWorld(0, t.top);
        const dx = tm[0] - v.x;
        if (vb < tm[1] + 10 && Math.abs(dx) < (v.w + t.w) / 2 + 50 && tm[1] - vb < 260 && Math.abs(dx) < best) { best = Math.abs(dx); target = t; }
      }
      const speed = Math.hypot(v.vx, v.vy);
      v.dwell = target && speed < 120 ? v.dwell + dt : Math.max(0, v.dwell - dt * 3);
      const want = target && v.dwell > 0.35 && v.manualTilt === 0 ? Math.sign((target.x - v.x) || 1) * 1.75 : 0;
      v.autoTilt += (want - v.autoTilt) * Math.min(1, dt * (want ? 1.4 : 4));
    }
    for (const v of vessels) {
      if (drag && drag.v === v) {
        const tx = ptr.x + drag.ox, ty = ptr.y + drag.oy;
        const nx = v.x + (tx - v.x) * Math.min(1, dt * 22), ny = v.y + (ty - v.y) * Math.min(1, dt * 22);
        v.vx = (nx - v.x) / dt; v.vy = (ny - v.y) / dt; v.x = nx; v.y = ny;
        const ta = v.K.dropper ? 0 : (v.manualTilt || v.autoTilt);
        v.angle += (ta - v.angle) * Math.min(1, dt * 7);
      } else {
        v.vy += G * dt; v.x += v.vx * dt; v.y += v.vy * dt;
        v.angle += (0 - v.angle) * Math.min(1, dt * 9);
      }
      v.updateWorld();
      // bench collision
      let bottom = -Infinity; for (const p of v.wp) bottom = Math.max(bottom, p[1]);
      let floor = benchY;
      for (const d of devices) if (Math.abs(v.x - d.x) < d.w / 2 - 4 && bottom <= d.top + 16) floor = Math.min(floor, d.top);
      if (bottom > floor) { v.y -= bottom - floor; if (v.vy > 0) v.vy = Math.abs(v.vy) > 120 ? -v.vy * 0.18 : 0; v.vx *= Math.pow(1e-6, dt); }
      const half = v.w / 2;
      if (v.x < half) { v.x = half; v.vx = 0; } if (v.x > W - half) { v.x = W - half; v.vx = 0; }
      if (v.y < v.h / 2) { v.y = v.h / 2; v.vy = 0; }
      // slosh: liquid surface lags acceleration (damped spring)
      const ax = (v.vx - v.pvx) / Math.max(dt, 1e-3); v.pvx = v.vx;
      const st = Math.max(-0.5, Math.min(0.5, -ax / 9000));
      v.sloshV += ((st - v.slosh) * 140 - v.sloshV * 7) * dt;
      v.slosh = Math.max(-0.6, Math.min(0.6, v.slosh + v.sloshV * dt));
      v.updateWorld();
    }
    // side-by-side collisions on the bench
    for (let i = 0; i < vessels.length; i++) for (let j = i + 1; j < vessels.length; j++) {
      const a = vessels[i], b = vessels[j];
      if ((drag && (drag.v === a || drag.v === b))) continue;
      const ov = (a.w + b.w) / 2 + 2 - Math.abs(a.x - b.x);
      const vy = Math.abs(a.y - b.y) < (a.h + b.h) / 2;
      if (ov > 0 && vy) { const s = a.x < b.x ? -1 : 1; a.x += s * ov / 2; b.x -= s * ov / 2; a.vx = b.vx = 0; a.updateWorld(); b.updateWorld(); }
    }

    for (const v of vessels) {
      // pouring: liquid above the lowest lip corner flows out
      if (v.liquid && Math.abs(v.angle) > 0.05 && !v.K.dropper) {
        const a = v.wp[0], b = v.wp[v.wp.length - 1];
        const da = a[0] * v.nx + a[1] * v.ny, db = b[0] * v.nx + b[1] * v.ny;
        const lip = da > db ? a : b, other = da > db ? b : a, dl = Math.max(da, db);
        if (dl > v.d) {
          const below = polyArea(clip(v.wp, v.nx, v.ny, dl)) / v.area * v.cap;
          const excess = Chem.total(v.c) - below;
          if (excess > 0) {
            v.pourAcc += excess * (1 - Math.exp(-dt * 6)) + Math.min(excess, dt * 2);
            const chunk = Math.max(0.12, v.cap / 500);
            let ux = lip[0] - other[0], uy = lip[1] - other[1]; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
            while (v.pourAcc >= chunk && Chem.total(v.c) > 0.001) {
              v.pourAcc -= chunk;
              const tot = Chem.total(v.c);
              const p = Chem.take(v.c, Math.min(1, chunk / tot));
              drops.push({ x: lip[0] + ux * 3 + (Math.random() - .5) * 2, y: lip[1] + uy * 3, vx: ux * 40 + v.vx * 0.5 + (Math.random() - .5) * 10, vy: 20 + v.vy * 0.3, p, src: v, age: 0, col: Chem.color(p), r: p.vol > 0.001 ? 3 + Math.min(3, chunk) : 2.5 });
            }
            v.syncGrains();
          }
        }
      }
      // chemistry
      const ev = Chem.step(v.c, cdt);
      const P = heaterPower(v);
      const evap = Chem.heat(v.c, P, cdt);
      v.heating = P;
      if (ev.active || evap > 0) v.syncGrains();
      // boiling: vapour bubbles form at the hot bottom
      if (v.liquid && v.c.T > 99 && P > 0) for (let i = 0; i < 3; i++) { const bx = (Math.random() - .5) * v.w * 0.7, by = v.bot - 3; if (inside(v.shape, bx, by)) v.bubbles.push({ x: bx, y: by, r: 1.5 + Math.random() * 3, wob: Math.random() * 6 }); }
      let gas = 0; for (const k in ev.gas) gas += ev.gas[k];
      let nb = Math.min(12, gas * 40000);
      while (nb > 0 && v.liquid) {
        if (nb < 1 && Math.random() > nb) break; nb--;
        const metal = v.grains.filter(g => Chem.SPECIES[g.sp].metal || g.sp === 'NaHCO3(s)');
        const g = metal.length ? metal[(Math.random() * metal.length) | 0] : null;
        const bx = g ? g.x : (Math.random() - .5) * v.w * 0.8, by = g ? g.y : v.bot - 4 - Math.random() * 6;
        if (inside(v.shape, bx, by)) v.bubbles.push({ x: bx, y: by, r: 1 + Math.random() * 2.2, wob: Math.random() * 6 });
      }
      // grains settle (local frame)
      for (const g of v.grains) {
        if (g.settled && Math.random() > 0.01) continue;
        g.vy = Math.min(g.vy + (v.c.vol > 0.1 ? 60 : 900) * dt, v.c.vol > 0.1 ? 25 + g.r * 6 : 400);
        const ny = g.y + g.vy * dt;
        if (inside(v.shape, g.x, ny + g.r) && !v.grains.some(o => o !== g && o.settled && Math.abs(o.x - g.x) < g.r + o.r - 0.6 && o.y > g.y && o.y - ny < g.r + o.r - 0.6)) { g.y = ny; g.settled = false; }
        else { g.vy = 0; g.settled = true; if (!inside(v.shape, g.x, g.y)) g.x *= 0.9; }
      }
      // bubbles rise in world-up direction
      const lu = [-Math.sin(v.angle), -Math.cos(v.angle)]; // world up (0,-1) in local coords
      for (const b of v.bubbles) { b.wob += dt * 8; b.y += lu[1] * 90 * dt; b.x += lu[0] * 90 * dt + Math.sin(b.wob) * 8 * dt; }
      v.bubbles = v.bubbles.filter(b => { const w = v.toWorld(b.x, b.y); return v.inLiquid(w[0], w[1]); });
      // steam for hot liquids
      if (v.c.vol > 0.05 && v.c.T > 45 && Math.random() < (v.c.T - 45) / 30) {
        const m = v.toWorld((Math.random() - 0.5) * v.w * 0.4, v.top);
        steam.push({ x: m[0], y: m[1], vx: (Math.random() - .5) * 10, vy: -25 - Math.random() * 20, life: 0, r: 4 + Math.random() * 4 });
      }
      v.flash = Math.max(0, v.flash - dt);
    }

    // falling drops
    for (const d of drops) {
      d.age += dt; d.vy += G * dt; d.x += d.vx * dt; d.y += d.vy * dt;
      for (let i = vessels.length - 1; i >= 0; i--) {
        const t = vessels[i];
        if (t === d.src && d.age < 0.25) continue;
        if (drag && drag.v === t && t === d.src) continue;
        if (t.contains(d.x, d.y)) {
          const wasSolids = Object.keys(d.p.sp).some(Chem.isSolid);
          Chem.mix(t.c, d.p); t.flash = 0.2; if (wasSolids) t.syncGrains(); d.dead = true;
          // splash makes the surface jiggle
          t.sloshV += (Math.random() - .5) * 2;
          break;
        }
      }
      if (!d.dead && d.y > benchY) { d.dead = true; splats.push({ x: d.x, y: benchY + 2, col: d.col, r: 4 + Math.random() * 5, life: 1 }); }
      if (d.y > H + 50 || d.x < -50 || d.x > W + 50) d.dead = true;
    }
    for (let i = drops.length - 1; i >= 0; i--) if (drops[i].dead) drops.splice(i, 1);
    for (const s of splats) s.life -= dt * 0.08;
    for (let i = splats.length - 1; i >= 0; i--) if (splats[i].life <= 0) splats.splice(i, 1);
    if (splats.length > 300) splats.splice(0, splats.length - 300);
    for (const s of steam) { s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.r += dt * 8; }
    for (let i = steam.length - 1; i >= 0; i--) if (steam[i].life > 2) steam.splice(i, 1);

    // trash
    const bin = document.getElementById('bin');
    if (drag) {
      const r = bin.getBoundingClientRect(), cr = cv.getBoundingClientRect();
      const over = ptr.x + cr.left > r.left - 10 && ptr.x + cr.left < r.right + 10 && ptr.y + cr.top > r.top - 10 && ptr.y + cr.top < r.bottom + 10;
      bin.classList.toggle('hot', over); drag.overBin = over;
    } else bin.classList.remove('hot');

    // tooltip logic
    if (pending && !drag && now - pending.t > 450) { hover = { v: pending.v, t: 0 }; }
    if (hover && !drag && !wikiOpen() && vessels.includes(hover.v) && now - hover.t > 1000) showTip(hover.v, now);
    else if (!hover || drag) hideTip();
  }

  // drop on bin → delete
  const _end = endPtr;
  cv.removeEventListener('pointerup', endPtr);
  cv.addEventListener('pointerup', () => {
    if (drag && drag.overBin) { if (drag.dev) devices.splice(devices.indexOf(drag.dev), 1); else vessels.splice(vessels.indexOf(drag.v), 1); document.getElementById('bin').classList.remove('hot'); }
    _end();
  });

  // ---------- rendering ----------
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, benchY);
    g.addColorStop(0, '#1b2433'); g.addColorStop(1, '#273246');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, benchY);
    // tiles
    ctx.strokeStyle = 'rgba(255,255,255,0.035)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, benchY); ctx.stroke(); }
    for (let y = 0; y < benchY; y += 48) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); ctx.stroke(); }
    const b = ctx.createLinearGradient(0, benchY, 0, H);
    b.addColorStop(0, '#3a3f47'); b.addColorStop(0.06, '#2b2f36'); b.addColorStop(1, '#1d2025');
    ctx.fillStyle = b; ctx.fillRect(0, benchY, W, H - benchY);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, benchY, W, 1.5);
  }
  function path(p, close) { ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); if (close) ctx.closePath(); }

  function drawVessel(v) {
    // shadow
    const sb = Math.max(...v.wp.map(p => p[1]));
    if (benchY - sb < 200) { ctx.fillStyle = `rgba(0,0,0,${0.25 * (1 - (benchY - sb) / 200)})`; ctx.beginPath(); ctx.ellipse(v.x, benchY + 3, v.w * 0.55, 5, 0, 0, Math.PI * 2); ctx.fill(); }
    // glass body tint
    path(v.wp, true); ctx.fillStyle = 'rgba(190,220,255,0.06)'; ctx.fill();
    // liquid
    if (v.liquid && v.liquid.length > 2 && v.c.vol > 0.01) {
      const col = Chem.color(v.c);
      path(v.liquid, true); ctx.fillStyle = col; ctx.fill();
      // meniscus highlight along surface
      const s = v.liquid.filter(p => Math.abs(p[0] * v.nx + p[1] * v.ny - v.d) < 0.5);
      if (s.length >= 2) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]); ctx.lineTo(s[s.length - 1][0], s[s.length - 1][1]); ctx.stroke(); }
    }
    // local-frame stuff
    ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(v.angle);
    path(v.shape, true); ctx.save(); ctx.clip();
    for (const g of v.grains) {
      const S = Chem.SPECIES[g.sp];
      ctx.fillStyle = `rgb(${S.color})`;
      if (S.metal) { ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.rot); ctx.fillRect(-g.r * 1.6, -g.r * 0.35, g.r * 3.2, g.r * 0.7); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.8;
    for (const b of v.bubbles) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    // graduations
    if (v.K.grad) {
      ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '8px system-ui'; ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) { const y = v.bot - (v.bot - v.top) * 0.8 * i / 5 - 4; ctx.beginPath(); ctx.moveTo(-v.w / 2 + 6, y); ctx.lineTo(-v.w / 2 + (i % 2 ? 14 : 18), y); ctx.stroke(); if (v.kind !== 'flask') ctx.fillText(Math.round(v.cap * 0.8 * i / 5 / 10) * 10, -v.w / 2 + 20, y + 3); }
    }
    // label
    if (v.K.label && v.reagent) {
      const lw = v.w - 12, lh = 26, ly = v.kind === 'jar' ? -2 : 4;
      ctx.fillStyle = 'rgba(245,240,225,0.92)'; ctx.fillRect(-lw / 2, ly, lw, lh);
      ctx.fillStyle = '#222'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(v.reagent.short, 0, ly + 16, lw - 4);
      ctx.textAlign = 'left';
    }
    if (v.K.dropper) { ctx.fillStyle = '#b8402f'; ctx.beginPath(); ctx.ellipse(0, v.top - 10, 7, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-3, v.top - 18, 2, 10); }
    // glass outline (open top) + highlight
    ctx.lineJoin = 'round';
    path(v.shape, false); ctx.strokeStyle = v.flash > 0 ? 'rgba(255,255,255,0.95)' : 'rgba(210,230,255,0.75)'; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 3;
    if (!v.K.dropper) { ctx.beginPath(); ctx.moveTo(v.w / 2 - 9, v.top + 18); ctx.lineTo(v.w / 2 - 9, v.bot - 16); ctx.stroke(); }
    ctx.restore();
  }

  function drawDevice(d, t) {
    const x = d.x, top = d.top, w = d.w;
    if (d.kind === 'hotplate') {
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, benchY + 3, w * 0.55, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d9dde3'; ctx.beginPath(); ctx.roundRect(x - w / 2, top + 7, w, d.h - 7, 5); ctx.fill();
      const g = d.level / 3;
      ctx.fillStyle = `rgb(${60 + 180 * g},${62 + 30 * g},${66 - 30 * g})`; ctx.beginPath(); ctx.roundRect(x - w / 2 + 6, top, w - 12, 8, 2); ctx.fill();
      if (g) { ctx.fillStyle = `rgba(255,90,30,${0.15 * g})`; ctx.fillRect(x - w / 2 + 6, top - 10, w - 12, 10); }
      ctx.fillStyle = '#3b3f46'; ctx.beginPath(); ctx.arc(x + w / 2 - 20, top + 19, 7, 0, Math.PI * 2); ctx.fill();
      const a = -Math.PI * 0.75 + d.level * Math.PI * 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + w / 2 - 20, top + 19); ctx.lineTo(x + w / 2 - 20 + Math.cos(a) * 6, top + 19 + Math.sin(a) * 6); ctx.stroke();
      ctx.fillStyle = d.level ? '#ff5a3c' : '#555'; ctx.beginPath(); ctx.arc(x - w / 2 + 14, top + 19, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a6070'; ctx.font = '9px system-ui'; ctx.fillText(['OFF', 'LOW', 'MED', 'HIGH'][d.level], x - w / 2 + 22, top + 22);
    } else {
      ctx.strokeStyle = '#8a9099'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * (w / 2 - 4), benchY); ctx.lineTo(x + s * (w / 2 - 12), top + 4); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(x - 3, benchY); ctx.lineTo(x, top + 4); ctx.stroke();
      const hot = d.level ? 1 : 0;
      ctx.fillStyle = hot ? '#c4683a' : '#6f757e'; ctx.fillRect(x - w / 2, top, w, 4);
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 0.6; for (let i = -w / 2; i < w / 2; i += 5) { ctx.beginPath(); ctx.moveTo(x + i, top); ctx.lineTo(x + i + 4, top + 4); ctx.stroke(); }
      ctx.fillStyle = '#5b6068'; ctx.beginPath(); ctx.roundRect(x - 16, benchY - 8, 32, 8, 2); ctx.fill();
      ctx.fillStyle = '#9aa0a8'; ctx.fillRect(x - 5, benchY - 62, 10, 54);
      ctx.fillStyle = '#7d838b'; ctx.fillRect(x - 6, benchY - 30, 12, 6);
      const f = d.flame();
      if (f) {
        const fl = 1 + Math.sin(t * 0.03) * 0.06 + Math.random() * 0.05;
        const gr = ctx.createLinearGradient(0, f.y0, 0, f.y1);
        gr.addColorStop(0, 'rgba(90,150,255,.95)'); gr.addColorStop(0.5, 'rgba(110,170,255,.55)'); gr.addColorStop(1, 'rgba(160,200,255,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - 6, f.y0); ctx.quadraticCurveTo(x - 9, f.y0 - 20, x, f.y0 - 46 * fl); ctx.quadraticCurveTo(x + 9, f.y0 - 20, x + 6, f.y0); ctx.fill();
        ctx.fillStyle = 'rgba(40,90,255,.9)'; ctx.beginPath(); ctx.moveTo(x - 4, f.y0); ctx.quadraticCurveTo(x, f.y0 - 26 * fl, x + 4, f.y0); ctx.fill();
      }
    }
  }

  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawBackground();
    for (const s of splats) { ctx.globalAlpha = Math.min(1, s.life) * 0.7; ctx.fillStyle = s.col; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * 1.8, s.r * 0.35, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    const t = performance.now();
    for (const d of devices) drawDevice(d, t);
    for (const v of vessels) drawVessel(v);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '11px system-ui'; ctx.textAlign = 'right';
    ctx.fillText(`time ×${speed}`, W - 14, 22); ctx.textAlign = 'left';
    for (const d of drops) { ctx.fillStyle = d.col; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill(); }
    for (const s of steam) { ctx.fillStyle = `rgba(230,235,245,${0.18 * (1 - s.life / 2)})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }
    if (drag && drag.v && (drag.v.manualTilt || drag.v.autoTilt > 0.05 || drag.v.autoTilt < -0.05)) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '11px system-ui';
      ctx.fillText(`tilt ${(drag.v.angle * 180 / Math.PI).toFixed(0)}°`, drag.v.x + drag.v.w / 2 + 10, drag.v.y - drag.v.h / 2);
    }
  }

  function resize() {
    const r = cv.getBoundingClientRect();
    DPR = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height; cv.width = W * DPR; cv.height = H * DPR;
    benchY = H - Math.max(50, H * 0.14);
  }
  addEventListener('resize', resize);
  resize();

  let last = performance.now();
  function frame(now) {
    let dt = Math.min(0.033, (now - last) / 1000); last = now;
    // substeps keep pouring & collisions stable
    const n = 2; for (let i = 0; i < n; i++) update(dt / n, now);
    draw();
    requestAnimationFrame(frame);
  }

  // ---------- sidebar ----------
  function buildSidebar() {
    const list = document.getElementById('catalog');
    const groups = {
      Glassware: Object.entries({ beaker: 'Beaker 250 mL', smallBeaker: 'Beaker 100 mL', flask: 'Erlenmeyer flask 250 mL', tube: 'Test tube 20 mL', dropper: 'Dropper pipette' }).map(([k, n]) => ({ n, add: () => spawn(k), ref: 'kind:' + k })),
      Equipment: Object.keys(DEVICES).map(k => ({ n: DEVICES[k].name, add: () => addDevice(k), ref: 'dev:' + k })),
    };
    for (const rg of Chem.REAGENTS) (groups[rg.cat] = groups[rg.cat] || []).push({ n: rg.name, add: () => addReagent(rg), ref: 'rg:' + rg.id });
    const search = document.getElementById('search');
    function render() {
      const q = search.value.trim().toLowerCase();
      list.innerHTML = '';
      for (const g in groups) {
        const items = groups[g].filter(it => !q || it.n.toLowerCase().includes(q) || g.toLowerCase().includes(q));
        if (!items.length) continue;
        const d = document.createElement('details'); d.open = true;
        d.innerHTML = `<summary>${g}<span>${items.length}</span></summary>`;
        for (const it of items) {
          const row = document.createElement('div'); row.className = 'row';
          const b = document.createElement('button'); b.className = 'item'; b.textContent = it.n; b.title = 'Add to bench';
          b.onclick = () => { it.add(); if (innerWidth < 760) document.body.classList.remove('side-open'); };
          const i = document.createElement('button'); i.className = 'info'; i.textContent = 'i'; i.title = 'Open in wiki'; i.setAttribute('aria-label', 'About ' + it.n);
          i.onclick = () => openWiki(it.ref);
          row.append(b, i); d.appendChild(row);
        }
        list.appendChild(d);
      }
    }
    search.addEventListener('input', render); render();
    document.getElementById('clear').onclick = () => { vessels.length = 0; devices.length = 0; drops.length = 0; splats.length = 0; };
    document.querySelectorAll('#speed button').forEach(b => b.onclick = () => { speed = +b.dataset.s; document.querySelectorAll('#speed button').forEach(o => o.classList.toggle('on', o === b)); });
    document.getElementById('menu').onclick = () => document.body.classList.toggle('side-open');
  }
  buildSidebar();

  // ---------- wiki ----------
  const wiki = document.getElementById('wiki'), wbody = document.getElementById('wiki-body');
  let wstack = [];
  function wikiOpen() { return !wiki.hidden; }
  function closeWiki() { wiki.hidden = true; wstack = []; }
  const link = (ref, text) => `<a href="#" data-ref="${ref}">${text}</a>`;
  const spLink = id => link('sp:' + id, Chem.SPECIES[id].formula);
  const eqHTML = rx => `<li><code>${rx.eq}</code>${rx.name ? `<span>${rx.name}</span>` : ''}<span class="parts">${[...Object.keys(rx.r), ...Object.keys(rx.p)].map(spLink).join(' · ')}</span></li>`;
  const ext = w => w ? `<a class="ext" href="https://en.wikipedia.org/wiki/${w}" target="_blank" rel="noopener">Read more on Wikipedia ↗</a>` : '';
  function wikiHTML(ref) {
    if (typeof ref === 'object') { // a vessel's current contents
      const v = ref, ids = Object.keys(v.c.sp).filter(k => v.c.sp[k] > 1e-9);
      return `<h2>${v.title}</h2><p class="sub">Current contents · ${Chem.total(v.c).toFixed(1)} mL · ${v.c.T.toFixed(1)} °C</p>
        <p>${v.K.info || ''} ${link('kind:' + v.kind, 'About this glassware')}</p>
        ${ids.length ? `<h3>Contains</h3><ul class="list">${ids.map(k => `<li>${spLink(k)} ${Chem.SPECIES[k].name}</li>`).join('')}</ul>` : '<p>Empty.</p>'}
        ${v.c.log.length ? `<h3>Reactions so far</h3><ul class="eqs">${v.c.log.map(e => `<li><code>${e}</code></li>`).join('')}</ul>` : ''}`;
    }
    const [type, id] = ref.split(':');
    if (type === 'rg') {
      const rg = Chem.REAGENTS.find(r => r.id === id), comp = rg.solid || rg.aq;
      const ids = Object.keys(comp);
      const rxs = Chem.REACTIONS.filter(rx => ids.some(k => k in rx.r || k in rx.p));
      return `<h2>${rg.name}</h2><p class="sub">${rg.cat}</p><p>${rg.info || ''}</p>
        <h3>Composition</h3><ul class="list">${rg.solid ? '' : `<li>${link('sp:H2O', 'H₂O')} Water (solvent)</li>`}${ids.map(k => `<li>${spLink(k)} ${Chem.SPECIES[k].name}<em>${rg.solid ? (comp[k] * Chem.SPECIES[k].M).toFixed(1) + ' g' : comp[k] + ' mol/L'}</em></li>`).join('')}</ul>
        ${rg.hazard ? `<h3>Safety</h3><p>${rg.hazard}.</p>` : ''}
        ${rxs.length ? `<h3>Reactions</h3><ul class="eqs">${rxs.map(eqHTML).join('')}</ul>` : ''}${ext(rg.wiki)}`;
    }
    if (type === 'sp') {
      if (id === 'H2O') return `<h2>Water</h2><p class="sub">H₂O · 18.02 g/mol · liquid</p><p>The solvent. It boils at 100 °C, absorbing 2257 J/g as it evaporates, and has a heat capacity of 4.18 J/g·K. It ionises very slightly: [H⁺][OH⁻] = 10⁻¹⁴ at 25 °C.</p>${ext('Properties_of_water')}`;
      const S = Chem.SPECIES[id], rxs = Chem.reactionsOf(id);
      const st = { aq: 'dissolved (aq)', s: 'solid (s)', g: 'gas (g)' }[S.state];
      const ksp = rxs.find(rx => rx.K && id in rx.p && Chem.isSolid(id) && Object.keys(rx.r).every(k => !Chem.isSolid(k)));
      const sw = S.color ? `<i class="sw" style="background:rgb(${S.color})"></i>` : '';
      const inR = Chem.REAGENTS.filter(r => id in (r.aq || r.solid || {}));
      return `<h2>${sw}${S.name}</h2><p class="sub">${S.formula} · ${S.M} g/mol · ${st}</p><p>${S.info || ''}</p>
        ${ksp ? `<p><b>Ksp</b> = ${(1 / ksp.K).toExponential(1)} at 25 °C</p>` : ''}
        ${inR.length ? `<h3>Found in</h3><ul class="list">${inR.map(r => `<li>${link('rg:' + r.id, r.name)}</li>`).join('')}</ul>` : ''}
        ${rxs.length ? `<h3>Reactions</h3><ul class="eqs">${rxs.map(eqHTML).join('')}</ul>` : ''}${ext(S.wiki)}`;
    }
    if (type === 'kind') { const K = KINDS[id]; return `<h2>${K.name}</h2><p class="sub">Capacity ${K.cap} mL</p><p>${K.info}</p>${ext(K.wiki)}`; }
    if (type === 'dev') { const D = DEVICES[id]; return `<h2>${D.name}</h2><p class="sub">Equipment</p><p>${D.info}</p>${ext(D.wiki)}`; }
    return '';
  }
  function openWiki(ref, push = true) {
    hideTip(); hover = null;
    if (push && wikiOpen()) wstack.push(wiki.dataset.cur);
    if (!wikiOpen()) wstack = [];
    wiki._ref = ref; wiki.dataset.cur = typeof ref === 'string' ? ref : '';
    wbody.innerHTML = wikiHTML(ref); wiki.hidden = false; wbody.scrollTop = 0;
    document.getElementById('wiki-back').hidden = !wstack.length;
  }
  wbody.addEventListener('click', e => { const a = e.target.closest('a[data-ref]'); if (a) { e.preventDefault(); openWiki(a.dataset.ref); } });
  document.getElementById('wiki-close').onclick = closeWiki;
  document.getElementById('wiki-back').onclick = () => { const r = wstack.pop(); if (r) openWiki(r, false); };

  // starter scene
  const start = [['beaker'], ['tube'], ['flask'], ['reagent', 'hcl'], ['reagent', 'naoh'], ['reagent', 'php'], ['reagent', 'cuso4']];
  const span = Math.max(W * 0.6, 420);
  start.forEach(([k, id], i) => {
    const v = k === 'reagent' ? addReagent(Chem.REAGENTS.find(r => r.id === id)) : spawn(k);
    v.x = 60 + i * (span - 60) / (start.length - 1); v.y = benchY - v.h / 2 - 1; v.updateWorld();
  });

  const hp = addDevice('hotplate'); hp.x = Math.min(W - 70, span + 90); const bb = addDevice('bunsen'); bb.x = Math.min(W - 60, span + 230);
  window.Lab = { vessels, devices, spawn, addReagent, addDevice, Chem, openWiki };
  requestAnimationFrame(frame);
})();
