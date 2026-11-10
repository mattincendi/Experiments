"""Synthesises the original intro fanfare -> public/music/intro.m4a.
Needs numpy, scipy and ffmpeg. Replace the output with any track you like."""
import os, subprocess, tempfile, numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 48000
DUR = 8.0
HIT = 1.67  # seconds: the title appears
t = np.arange(int(SR * DUR)) / SR
rng = np.random.default_rng(7)
L = np.zeros_like(t); R = np.zeros_like(t)

def hz(n): return 440 * 2 ** ((n - 69) / 12)
def lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
def env(a, peak, hold, rel):
    e = np.zeros_like(t)
    e += np.clip((t - a) / max(peak - a, 1e-3), 0, 1) * (t < peak)
    e += ((t >= peak) & (t < hold)) * 1.0
    e += (t >= hold) * np.exp(-(t - hold) / rel)
    return e * (t >= a)
def saw(f, detune=0.0):
    ph = (t * f * (1 + detune) + rng.random()) % 1.0
    return 2 * ph - 1
def add(x, pan=0.0, g=1.0):
    global L, R
    L += x * g * np.cos((pan + 1) * np.pi / 4); R += x * g * np.sin((pan + 1) * np.pi / 4)

# 1. Strings swell (D major, low), rising into the hit then sustaining.
for i, n in enumerate([38, 45, 50, 54, 57]):
    v = sum(saw(hz(n), d) for d in (-0.004, 0, 0.0035))
    v = lp(v, 900 + 400 * i)
    e = env(0, HIT, 5.6, 1.2) ** 1.6 * (0.6 + 0.4 * np.sin(2 * np.pi * 5.2 * t + i) * 0.05 + 0.4)
    add(v * e, pan=(i - 2) * 0.3, g=0.05)

# 2. Timpani roll crescendo, then accent on the hit.
roll = lp(rng.standard_normal(len(t)), 220) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 14 * t)))
roll += 0.6 * np.sin(2 * np.pi * hz(38) * t)
add(roll * np.clip(t / HIT, 0, 1) ** 2.5 * (t < HIT), g=0.35)
hit_t = np.clip(t - HIT, 0, None)
timp = (np.sin(2 * np.pi * hz(38) * hit_t * (1 + 0.04 * np.exp(-hit_t * 20))) * np.exp(-hit_t * 2.2)
        + 0.5 * lp(rng.standard_normal(len(t)), 300) * np.exp(-hit_t * 9)) * (t >= HIT)
add(timp, g=0.55)

# 3. Suspended cymbal swell into the hit, washing after.
cym = hp(rng.standard_normal(len(t)), 5000)
cym_e = np.where(t < HIT, np.clip(t / HIT, 0, 1) ** 3, np.exp(-(t - HIT) / 1.4))
add(cym * cym_e, pan=-0.3, g=0.06); add(hp(rng.standard_normal(len(t)), 5000) * cym_e, pan=0.3, g=0.06)

# 4. Brass chord on the hit (bright, then mellowing).
for i, n in enumerate([50, 54, 57, 62, 66]):
    v = sum(saw(hz(n), d) for d in (-0.003, 0.003))
    bright = 700 + 2600 * np.exp(-hit_t * 1.5)
    v = lp(v, 2400) * 0.6 + lp(v, 900) * 0.4 * (bright / 3300)
    e = env(HIT - 0.03, HIT + 0.08, 4.8, 1.3)
    add(v * e, pan=(i - 2) * 0.25, g=0.045)

# 5. Chimes: an arpeggio on the hit and a rising shimmer with the light sweep.
def bell(start, n, pan, g):
    tt = np.clip(t - start, 0, None); f = hz(n)
    x = sum(a * np.sin(2 * np.pi * f * m * tt) * np.exp(-tt * d)
            for m, a, d in ((1, 1, 1.6), (2.76, 0.4, 3.5), (5.4, 0.2, 6), (8.9, 0.1, 9)))
    add(x * (t >= start), pan=pan, g=g)
for k, n in enumerate([74, 78, 81, 86]):
    bell(HIT + 0.09 * k, n, -0.5 + k * 0.33, 0.06)
for k, n in enumerate([81, 83, 86, 88, 90, 93, 95, 98]):
    bell(3.2 + 0.11 * k, n, -0.7 + k * 0.2, 0.025)

# Reverb (hall-ish) and master.
ir_t = np.arange(int(SR * 2.8)) / SR
for ch in (0, 1):
    ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t / 0.55); ir = lp(ir, 6000); ir /= np.abs(ir).sum() ** 0.5 * 30
    src = L if ch == 0 else R
    wet = fftconvolve(src, ir)[: len(t)]
    if ch == 0: Lo = src * 0.8 + wet
    else: Ro = src * 0.8 + wet
mix = np.stack([Lo, Ro], 1)
mix *= np.clip((DUR - t) / 1.6, 0, 1)[:, None]  # fade into the first nominee
mix = np.tanh(mix / np.abs(mix).max() * 1.4) * 0.85
tmp = os.path.join(tempfile.mkdtemp(), 'intro.wav')
wavfile.write(tmp, SR, (mix * 32767).astype(np.int16))
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', tmp, '-c:a', 'aac', '-b:a', '256k',
                'public/music/intro.m4a'], check=True)
print('wrote public/music/intro.m4a')
