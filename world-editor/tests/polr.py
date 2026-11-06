import sys
s=open(sys.argv[1]).read()
def rep(o,n):
    global s
    assert s.count(o)==1,o[:70]; s=s.replace(o,n)
rep("  const twM = oc2 ? new Float64Array(12 * RN) : null, hiM = oc2 ? new Float64Array(12 * RN) : null;",
"  const twM = oc2 ? new Float64Array(12 * RN) : null, hiM = oc2 ? new Float64Array(12 * RN) : null;\n  const PR = {}; const absA = new Float64Array(RN), winA = new Float64Array(RN), asA = new Float64Array(RN);\n  const acc = (key, nm, v) => { const o = PR[key] = PR[key] || {}; o[nm] = (o[nm] || 0) + v; };")
rep("f = q * (1 - Math.max(snowE[k] > 0 ? EBM.snowAlb : EBM.iceAlb, albedo(y, Tk))) + C * Told[k] - 1.8 * kc; }","f = q * (1 - Math.max(snowE[k] > 0 ? EBM.snowAlb : EBM.iceAlb, albedo(y, Tk))) + C * Told[k] - 1.8 * kc; absA[k] = q * (1 - Math.max(snowE[k] > 0 ? EBM.snowAlb : EBM.iceAlb, albedo(y, Tk))); }")
rep("oL[1].up[k] * Tt[k] + oResid - oc2.shade[k]; } // open water","oL[1].up[k] * Tt[k] + oResid - oc2.shade[k]; absA[k] = q * (1 - albedo(y, 0)) - oc2.shade[k]; } // open water")
rep("      } else f = q * (1 - albedo(y, Tk, k)) + C * Told[k];","      } else { f = q * (1 - albedo(y, Tk, k)) + C * Told[k]; absA[k] = q * (1 - albedo(y, Tk, k)); }")
rep("      f -= asK + Math.max(EBM.dryLoss * dry, hb ? EBM.highLoss * hk : 0);","      winA[k] = Math.max(EBM.dryLoss * dry, hb ? EBM.highLoss * hk : 0); asA[k] = asK; f -= asK + winA[k];")
rep("    if (last) { const m = Math.min(11, Math.floor(t * 12)); for (let k = 0; k < RN; k++) months[m * RN + k] += T[k] * 12 / S;",
"""    if (last && oc2) for (let y = 0; y < NY; y++) { const la = latOf(y) / deg; if (Math.abs(la) < 70) continue; const hemi = la > 0 ? 'N' : 'S';
      const winter = la > 0 ? (t < 0.12 || t > 0.95) : (t > 0.45 && t < 0.62), summer = la > 0 ? (t > 0.45 && t < 0.62) : (t < 0.12 || t > 0.95);
      for (let x = 0; x < NX; x++) { const k = y * NX + x, kE = y * NX + (x + 1) % NX, kW = y * NX + (x + NX - 1) % NX, c = cB[y];
        const olrA = (A - asA[k]) + (B - EBM.Bs) * ((1 - EBM.olrU - (EBM.olrUw - EBM.olrU) * clampW(Ta[k] / 25, 0, 1)) * Ta[k] + (EBM.olrU + (EBM.olrUw - EBM.olrU) * clampW(Ta[k] / 25, 0, 1)) * Tu[k]) + EBM.dryAir * clampW((-5 - Tu[k]) / 20, 0, 1), olrS = asA[k] + EBM.Bs * T[k] + winA[k];
        const imp = fE[k] * (Ta[kE] - Ta[k]) + fW[k] * (Ta[kW] - Ta[k]) + (y < NY - 1 ? fN[k] * (Ta[k + NX] - Ta[k]) : 0) + (y > 0 ? fS[k] * (Ta[k - NX] - Ta[k]) : 0)
          + aiE[k] * (Ta[kE] - Ta[k]) + aiW[k] * (Ta[kW] - Ta[k]) + (y < NY - 1 ? aiN[k] * (Ta[k + NX] - Ta[k]) : 0) + (y > 0 ? aiS[k] * (Ta[k - NX] - Ta[k]) : 0);
        for (const key of [hemi + ' year', ...(winter ? [hemi + ' winter'] : []), ...(summer ? [hemi + ' summer'] : [])]) {
          acc(key, 'w', c); acc(key, 'ASR', c * absA[k]); acc(key, 'OLRair', c * olrA); acc(key, 'OLRsfc', c * olrS); acc(key, 'Ta', c * Ta[k]); acc(key, 'Tsfc', c * T[k]); acc(key, 'airImport', c * imp);
          acc(key, 'land', c * (ro[k] ? 0 : 1)); acc(key, 'seaIce', c * (ro[k] && hi[k] > 0 ? 1 : 0)); acc(key, 'window+', c * winA[k]); } } }
    if (last) { const m = Math.min(11, Math.floor(t * 12)); for (let k = 0; k < RN; k++) months[m * RN + k] += T[k] * 12 / S;""")
rep("twM, hiM, state:","twM, hiM, PR, state:")
rep("    const twMean = new Float64Array(RNb), hiMin","    P._dg = withCe.PR;\n    const twMean = new Float64Array(RNb), hiMin")
rep("writes: ['sst', 'current',","writes: ['param:_dg', 'sst', 'current',")
open(sys.argv[2],'w').write(s)
