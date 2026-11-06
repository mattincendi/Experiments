import sys
s=open(sys.argv[1]).read()
o="    if (last && oc2) for (let y = 0; y < NY; y++) { const la = latOf(y) / deg; if (Math.abs(la) < 70) continue; const hemi = la > 0 ? 'N' : 'S';"
assert s.count(o)==1
s=s.replace(o,"""    if (last && oc2) for (let y = 0; y < NY; y++) { const la = latOf(y) / deg; if (la < 70) continue; const mk = 'N m' + String(Math.min(11, Math.floor(t * 12)) + 1).padStart(2, '0');
      for (let x = 0; x < NX; x++) { const k = y * NX + x, c = cB[y]; acc(mk, 'w', c); acc(mk, 'ASR', c * absA[k]); acc(mk, 'ice', c * (ro[k] && hi[k] > 0 ? 1 : 0)); acc(mk, 'hi', c * (ro[k] ? hi[k] : 0)); acc(mk, 'Tsfc', c * T[k]); acc(mk, 'Ta', c * Ta[k]); acc(mk, 'q', c * Q[y * S + s]); } }
"""+o)
open(sys.argv[2],'w').write(s)
