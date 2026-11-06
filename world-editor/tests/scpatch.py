import sys, subprocess
subprocess.run(['python3','polr.py',sys.argv[1],sys.argv[2]+'.tmp'],check=True)
s=open(sys.argv[2]+'.tmp').read()
def rep(o,n):
    global s
    assert s.count(o)==1,o[:70]; s=s.replace(o,n)
rep("  const PR = {};","  const PR = {}; const BD = {}; for (const nm of ['toa','air','ocn']) BD[nm] = new Float64Array(NY);")
rep("    if (last && oc2) for (let y = 0; y < NY; y++) { const la = latOf(y) / deg; if (Math.abs(la) < 70) continue;",
"""    if (last && oc2) for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) { const k = y * NX + x, kE = y * NX + (x + 1) % NX, kW = y * NX + (x + NX - 1) % NX, c = cB[y] / S;
      BD.toa[y] += c * (absA[k] - A - EBM.dryAir * clampW((-5 - Tu[k]) / 20, 0, 1) - (B - EBM.Bs) * ((1 - (EBM.olrU + (EBM.olrUw - EBM.olrU) * clampW(Ta[k] / 25, 0, 1))) * Ta[k] + (EBM.olrU + (EBM.olrUw - EBM.olrU) * clampW(Ta[k] / 25, 0, 1)) * Tu[k]) - EBM.Bs * T[k] - winA[k]);
      BD.air[y] += c * ((fE[k] + aiE[k]) * (Ta[kE] - Ta[k]) + (fW[k] + aiW[k]) * (Ta[kW] - Ta[k]) + (y < NY - 1 ? (fN[k] + aiN[k]) * (Ta[k + NX] - Ta[k]) : 0) + (y > 0 ? (fS[k] + aiS[k]) * (Ta[k - NX] - Ta[k]) : 0));
      if (!ro[k]) continue; const wv = (j) => hi[j] > 0 ? -1.8 : Tw[j], tk = wv(k);
      const qq = Q[y * S + s]; if (hi[k] > 0) BD.ocn[y] += c * EBM.kIce / (hi[k] + EBM.snowIns) * (-1.8 - T[k]); else BD.ocn[y] -= c * (absA[k] - EBM.solAir * qq - asA[k] - EBM.Bs * T[k] - winA[k] - gk[k] * (T[k] - Ta[k]) - gL[k] * EBM.dq0); } // the ocean's convergence: what the sea gives up to the air (all layers, a year's mean)
    if (last && oc2) for (let y = 0; y < NY; y++) { const la = latOf(y) / deg; if (Math.abs(la) < 70) continue;""")
rep("twM, hiM, PR, state:","twM, hiM, PR, BD, dl2: Rm * Rm * dlr * dlr, state:")
rep("    P._dg = withCe.PR;","    P._dg = { PR: withCe.PR, BD: withCe.BD, dl2: withCe.dl2 };")
open(sys.argv[2],'w').write(s)
