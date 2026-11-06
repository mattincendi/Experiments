import sys
s=open(sys.argv[1]).read()
def rep(o,n):
    global s
    assert s.count(o)==1,o[:70]; s=s.replace(o,n)
rep("  const PR = {};","""  const PR = {}; const DQ = { trop: {}, iceLat: {}, xs: { shallowV: 0, ovV: 0, shallowH: 0 }, poolEq: [0, 0, 0], seas: {} };
  const dqa = (o, nm, v) => { o[nm] = (o[nm] || 0) + v; };""")
rep("    if (last && oc2) for (let y = 0; y < NY; y++) { const la = latOf(y) / deg; if (Math.abs(la) < 70) continue;",
"""    if (last && oc2) { const eqY = Math.round(90 / R) - 1, y20 = Math.round(110 / R) - 1;
      DQ.poolEq[0] += oL[0].pool[eqY] / S; DQ.poolEq[1] += oL[1].pool[eqY] / S; DQ.poolEq[2] += (oL[0].pool[eqY + 1]) / S;
      for (let x = 0; x < NX; x++) { const k = y20 * NX + x; if (!ro[k] || !ro[k + NX]) continue; const H = mixDepth(y20, t); // across the face at 20°N
        const ek = Math.min(1, 50 / H), vs = oFg.fn[k] + ek * oFe.fn[k], vo = oFo.fn[k], len = Rm * cFN[y20] * dlr;
        DQ.xs.shallowV += vs * len * H / 1e6 / S; DQ.xs.ovV += vo * len * H / 1e6 / S; DQ.xs.shallowH += 4.1e6 * vs * len * H * (vs > 0 ? Tw[k] : Tw[k + NX]) / 1e15 / S; }
      for (let y = 0; y < NY; y++) { const la = latOf(y) / deg, band = (la > 0 ? 'N' : 'S') + Math.floor(Math.abs(la) / 10) * 10, mth = Math.min(11, Math.floor(t * 12));
        for (let x = 0; x < NX; x++) { const k = y * NX + x, c = cB[y] / S;
          if (Math.abs(la) < 10) { const key = ro[k] ? 'sea' : 'land'; const o = DQ.trop[key] = DQ.trop[key] || {}; dqa(o, 'w', c); dqa(o, 'T', c * T[k]); dqa(o, 'Ta', c * Ta[k]); dqa(o, 'g', c * gk[k]);
            if (ro[k]) { dqa(o, 'sun', c * absA[k]); dqa(o, 'mixflux', c * oc2.mix[k] * (EBM.Td - T[k])); dqa(o, 'ret', c * oRet[y]); dqa(o, 'airflux', c * (gk[k] * (Ta[k] - T[k]) - EBM.As - EBM.Bs * T[k])); dqa(o, 'mixK', c * oc2.mix[k]); } }
          if (ro[k]) { const o = DQ.iceLat[band] = DQ.iceLat[band] || { w: 0, m: new Array(12).fill(0) }; o.m[mth] += (hi[k] > 0 ? 1 : 0) * cB[y]; if (mth === 0 && s % 4 === 0) o.w += cB[y];
            if (Math.abs(la) > 45 && Math.abs(la) < 65 && !(hi[k] > 0)) { const o2 = DQ.seas[la > 0 ? (t < 0.25 ? 'Nwin' : t > 0.45 && t < 0.7 ? 'Nsum' : 'x') : (t > 0.45 && t < 0.7 ? 'Swin' : t < 0.25 ? 'Ssum' : 'x')] = DQ.seas[la > 0 ? (t < 0.25 ? 'Nwin' : t > 0.45 && t < 0.7 ? 'Nsum' : 'x') : (t > 0.45 && t < 0.7 ? 'Swin' : t < 0.25 ? 'Ssum' : 'x')] || {};
              dqa(o2, 'w', c); dqa(o2, 'T', c * T[k]); dqa(o2, 'sun', c * absA[k]); dqa(o2, 'air', c * (gk[k] * (Ta[k] - T[k]) - EBM.As - EBM.Bs * T[k])); dqa(o2, 'H', c * mixDepth(y, t)); dqa(o2, 'g', c * gk[k]); } } } } }
    if (last && oc2) for (let y = 0; y < NY; y++) { const la = latOf(y) / deg; if (Math.abs(la) < 70) continue;""")
rep("twM, hiM, PR, BD, dl2: Rm * Rm * dlr * dlr, state:","twM, hiM, PR, BD, DQ, dl2: Rm * Rm * dlr * dlr, state:")
rep("    P._dg = { PR: withCe.PR, BD: withCe.BD, dl2: withCe.dl2 };","    P._dg = { PR: withCe.PR, BD: withCe.BD, DQ: withCe.DQ, dl2: withCe.dl2 };")
open(sys.argv[2],'w').write(s)
