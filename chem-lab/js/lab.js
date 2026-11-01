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

  // ---------- input ----------
  const ptr = { x: 0, y: 0, down: false, moved: 0, t: 0, still: 0, type: 'mouse' };
  let drag = null, pending = null, hover = null, rotHold = 0;

  function topVesselAt(x, y) { for (let i = vessels.length - 1; i >= 0; i--) if (vessels[i].contains(x, y)) return vessels[i]; return null; }
  function pos(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

  cv.addEventListener('pointerdown', e => {
    const [x, y] = pos(e); ptr.type = e.pointerType;
    const v = topVesselAt(x, y);
    hideTip(); hover = null;
    if (!v) return;
    cv.setPointerCapture(e.pointerId);
    pending = { v, x, y, t: performance.now(), id: e.pointerId };
    ptr.x = x; ptr.y = y;
  });
  cv.addEventListener('pointermove', e => {
    const [x, y] = pos(e);
    const dist = Math.hypot(x - ptr.x, y - ptr.y);
    ptr.x = x; ptr.y = y;
    if (pending && !drag && Math.hypot(x - pending.x, y - pending.y) > 6) {
      const v = pending.v;
      drag = { v, ox: v.x - x, oy: v.y - y, id: pending.id };
      vessels.splice(vessels.indexOf(v), 1); vessels.push(v);
      pending = null; hideTip();
      document.getElementById('rot').classList.add('on');
    }
    if (!drag && !pending && e.pointerType === 'mouse') {
      const v = topVesselAt(x, y);
      if (v !== (hover && hover.v) || dist > 3) { if (!hover || hover.v !== v || dist > 3) { if (hover && hover.v === v && tip.classList.contains('show')) { placeTip(); } else { hover = v ? { v, t: performance.now() } : null; if (!v) hideTip(); } } }
    }
  });
  function endPtr() {
    if (pending && !drag && pending.v && performance.now() - pending.t > 450) { hover = { v: pending.v, t: 0 }; }
    if (drag) { drag.v.manualTilt = 0; drag.v.autoTilt = 0; drag = null; document.getElementById('rot').classList.remove('on'); }
    pending = null;
  }
  cv.addEventListener('pointerup', endPtr);
  cv.addEventListener('pointercancel', endPtr);
  cv.addEventListener('pointerleave', () => { if (!drag) { hover = null; hideTip(); } });
  cv.addEventListener('wheel', e => { if (drag) { drag.v.manualTilt = clampTilt(drag.v.manualTilt + Math.sign(e.deltaY) * 0.12); e.preventDefault(); } }, { passive: false });
  addEventListener('keydown', e => { if (!drag) return; if (e.key === 'q' || e.key === 'Q') drag.v.manualTilt = clampTilt(drag.v.manualTilt - 0.15); if (e.key === 'e' || e.key === 'E') drag.v.manualTilt = clampTilt(drag.v.manualTilt + 0.15); });
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
    h += `<div class="t-grid"><span>Volume</span><b>${tot.toFixed(1)} / ${v.cap} mL</b><span>Temperature</span><b>${c.T.toFixed(1)} °C</b>`;
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
      if (S.note) notes.push(S.note);
    }
    if (c.vol > 0.01) aq.unshift(`<li><i class="dot clear"></i><b>H₂O</b> Water<em>${c.vol.toFixed(1)} mL</em></li>`);
    if (aq.length) h += `<div class="t-h">In solution</div><ul>${aq.join('')}</ul>`;
    if (sol.length) h += `<div class="t-h">Solids</div><ul>${sol.join('')}</ul>`;
    const gs = Object.entries(c.gases).filter(([, m]) => m > 1e-7);
    if (gs.length) h += `<div class="t-h">Gas released</div><ul>${gs.map(([k, m]) => `<li><b>${Chem.SPECIES[k].formula}</b> ${Chem.SPECIES[k].name}<em>${fmtMol(m)} ≈ ${(m * 24.5 * 1000).toFixed(1)} mL</em></li>`).join('')}</ul>`;
    if (c.log.length) h += `<div class="t-h">Reactions observed</div><ul class="eq">${c.log.slice(-6).map(e => `<li>${e}</li>`).join('')}</ul>`;
    if (notes.length) h += `<div class="t-note">💡 ${notes[(Math.floor(performance.now() / 4000)) % notes.length]}</div>`;
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
  function update(dt, now) {
    if (drag) {
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
        const ta = v.manualTilt || v.autoTilt;
        v.angle += (ta - v.angle) * Math.min(1, dt * 7);
      } else {
        v.vy += G * dt; v.x += v.vx * dt; v.y += v.vy * dt;
        v.angle += (0 - v.angle) * Math.min(1, dt * 9);
      }
      v.updateWorld();
      // bench collision
      let bottom = -Infinity; for (const p of v.wp) bottom = Math.max(bottom, p[1]);
      if (bottom > benchY) { v.y -= bottom - benchY; if (v.vy > 0) v.vy = Math.abs(v.vy) > 120 ? -v.vy * 0.18 : 0; v.vx *= Math.pow(0.001, dt); }
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
      if (v.liquid && Math.abs(v.angle) > 0.05) {
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
      const ev = Chem.step(v.c, dt);
      Chem.cool(v.c, dt);
      if (ev.active) v.syncGrains();
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
      if (v.liquid && v.c.T > 45 && Math.random() < (v.c.T - 45) / 40) {
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
    if (hover && !drag && vessels.includes(hover.v) && now - hover.t > 1000) showTip(hover.v, now);
    else if (!hover || drag) hideTip();
  }

  // drop on bin → delete
  const _end = endPtr;
  cv.removeEventListener('pointerup', endPtr);
  cv.addEventListener('pointerup', () => {
    if (drag && drag.overBin) { const v = drag.v; vessels.splice(vessels.indexOf(v), 1); document.getElementById('bin').classList.remove('hot'); }
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
      ctx.fillText(v.reagent.short, 0, ly + 11, lw - 4);
      ctx.font = '7px system-ui'; ctx.fillStyle = v.reagent.hazard ? '#b3261e' : '#555';
      ctx.fillText(v.reagent.hazard || v.reagent.cat, 0, ly + 21, lw - 4);
      ctx.textAlign = 'left';
    }
    // glass outline (open top) + highlight
    ctx.lineJoin = 'round';
    path(v.shape, false); ctx.strokeStyle = v.flash > 0 ? 'rgba(255,255,255,0.95)' : 'rgba(210,230,255,0.75)'; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(v.w / 2 - 9, v.top + 18); ctx.lineTo(v.w / 2 - 9, v.bot - 16); ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawBackground();
    for (const s of splats) { ctx.globalAlpha = Math.min(1, s.life) * 0.7; ctx.fillStyle = s.col; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * 1.8, s.r * 0.35, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    for (const v of vessels) drawVessel(v);
    for (const d of drops) { ctx.fillStyle = d.col; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill(); }
    for (const s of steam) { ctx.fillStyle = `rgba(230,235,245,${0.18 * (1 - s.life / 2)})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }
    if (drag && (drag.v.manualTilt || drag.v.autoTilt > 0.05 || drag.v.autoTilt < -0.05)) {
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
    const groups = { Glassware: Object.entries({ beaker: 'Beaker 250 mL', smallBeaker: 'Beaker 100 mL', flask: 'Erlenmeyer flask 250 mL', tube: 'Test tube 20 mL' }).map(([k, n]) => ({ n, add: () => spawn(k) })) };
    for (const rg of Chem.REAGENTS) (groups[rg.cat] = groups[rg.cat] || []).push({ n: rg.name, sub: rg.hazard, add: () => addReagent(rg) });
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
          const b = document.createElement('button'); b.className = 'item';
          b.innerHTML = `${it.n}${it.sub ? `<small>${it.sub}</small>` : ''}`;
          b.onclick = () => { it.add(); if (innerWidth < 760) document.body.classList.remove('side-open'); };
          d.appendChild(b);
        }
        list.appendChild(d);
      }
    }
    search.addEventListener('input', render); render();
    document.getElementById('clear').onclick = () => { vessels.length = 0; drops.length = 0; splats.length = 0; };
    document.getElementById('menu').onclick = () => document.body.classList.toggle('side-open');
  }
  buildSidebar();

  // starter scene
  const start = [['beaker'], ['tube'], ['flask'], ['reagent', 'hcl'], ['reagent', 'naoh'], ['reagent', 'php'], ['reagent', 'cuso4'], ['reagent', 'agno3'], ['reagent', 'nacl']];
  start.forEach(([k, id], i) => {
    const v = k === 'reagent' ? addReagent(Chem.REAGENTS.find(r => r.id === id)) : spawn(k);
    v.x = Math.min(W - 40, 60 + i * (W - 120) / (start.length - 1)); v.y = benchY - v.h / 2 - 1; v.updateWorld();
  });

  window.Lab = { vessels, spawn, addReagent, Chem };
  requestAnimationFrame(frame);
})();
