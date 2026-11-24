"""(helpers copied from scripts/promo/music.py) Original 30-second score for the Paskol promo (synthesized here: no samples, no third-party audio).
0-5.4s tender piano · 5.4 record scratch, music stops · 5.8-8.4 low drone + heartbeat ·
8.4-9.0 riser · 9.0 downbeat: warm, upbeat 120 bpm wedding groove · 28-30 final chord rings out.
    python3 scripts/promo/music.py out.wav
"""
import sys, wave
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt

SR = 44100
DUR = 30.0
rng = np.random.default_rng(11)
L = np.zeros(int(DUR * SR)); R = np.zeros_like(L)

def hz(n): return 440.0 * 2 ** ((n - 69) / 12)

def place(sig, at, pan=0.0, gain=1.0):
    i = int(at * SR); j = min(len(L), i + len(sig))
    if j <= i: return
    s = sig[: j - i] * gain
    L[i:j] += s * np.sqrt(0.5 * (1 - pan)); R[i:j] += s * np.sqrt(0.5 * (1 + pan))

def piano(n, dur=2.5, vel=0.5):
    f = hz(n); t = np.arange(int(dur * SR)) / SR
    out = np.zeros_like(t)
    for k in range(1, 9):
        fk = f * k * np.sqrt(1 + 0.0004 * k * k)
        if fk > 16000: break
        out += np.sin(2 * np.pi * fk * t + rng.uniform(0, 6.28)) * (0.62 ** (k - 1)) * np.exp(-t * (1.2 + 0.9 * k) * (f / 440) ** 0.3)
    out *= np.minimum(1, t / 0.004)
    hammer = rng.standard_normal(int(0.012 * SR)) * np.exp(-np.arange(int(0.012 * SR)) / SR * 400) * 0.08
    out[: len(hammer)] += hammer
    rel = np.ones_like(t); rel[-int(0.15 * SR):] = np.linspace(1, 0, int(0.15 * SR))
    return 0.22 * vel * out * rel

def pad(notes, dur, amp=0.05, attack=0.8):
    t = np.arange(int(dur * SR)) / SR
    out = np.zeros_like(t)
    for n in notes:
        for det in (-0.07, 0.0, 0.07):
            f = hz(n + det)
            out += np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3 * f * t)
    env = np.minimum(1, t / attack) * np.minimum(1, (dur - t) / 0.6)
    return amp * out / (3 * len(notes)) * env

def kick(gain=0.9):
    t = np.arange(int(0.4 * SR)) / SR
    f = 48 + 110 * np.exp(-t * 32)
    return gain * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8)

def snare_clap():
    n = int(0.22 * SR); t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    sos = butter(2, [900, 7000], 'bandpass', fs=SR, output='sos')
    body = sosfilt(sos, noise) * (np.exp(-t * 22) + 0.6 * np.exp(-((t - 0.012) % 0.012) * 300) * (t < 0.036))
    return 0.32 * body

def hat(open_=False):
    n = int((0.18 if open_ else 0.05) * SR)
    sos = butter(2, 7000, 'highpass', fs=SR, output='sos')
    return 0.09 * sosfilt(sos, rng.standard_normal(n)) * np.exp(-np.arange(n) / SR * (14 if open_ else 70))

def bass(n, dur, amp=0.22):
    f = hz(n); t = np.arange(int(dur * SR)) / SR
    w = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.1 * np.sign(np.sin(2 * np.pi * f * t))
    env = np.minimum(1, t / 0.01) * np.exp(-t * 2.5) * np.minimum(1, (dur - t) / 0.03)
    return amp * w * env

def scratch():
    # a vinyl "record stop": pitch falls from the music to nothing
    d = 0.55; t = np.arange(int(d * SR)) / SR
    f = 600 * (1 - t / d) ** 2 + 40
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR)
    sos = butter(2, [300, 3000], 'bandpass', fs=SR, output='sos')
    noise = sosfilt(sos, rng.standard_normal(len(t))) * 0.6
    return 0.35 * (tone + noise) * (1 - t / d) * np.minimum(1, t / 0.005)

def heartbeat():
    out = np.zeros(int(0.5 * SR))
    for at, g in ((0, 0.7), (0.18, 0.45)):
        k = kick(g)[: int(0.25 * SR)]
        sos = butter(2, 140, 'lowpass', fs=SR, output='sos')
        k = sosfilt(sos, k)
        i = int(at * SR); out[i:i + len(k)] += k[: len(out) - i]
    return out


# ═════════════ Reel score: 120 bpm, cuts on every bar (2 s) ═════════════
# 0–3.5 filtered groove under the hook · 3.5–4 snare roll + riser · 4 drop (logo) · 4–18 full groove, a whoosh into
# every feature cut · 18–20 breakdown (light) · 19.5 riser · 20 drop on the wipe to dark · 20–28 groove · 28 final chord.
BEAT = 0.5
prog = [(48, [60, 64, 67]), (43, [59, 62, 67]), (45, [60, 64, 69]), (41, [60, 65, 69])]
hook = [[76, None, 74, 72], [74, None, 71, 67], [72, None, 76, 79], [77, 76, 74, None]]

def lowpass(sig, fc):
    return sosfilt(butter(2, fc, 'lowpass', fs=SR, output='sos'), sig)

def crash(gain=0.5):
    n = int(1.8 * SR); t = np.arange(n) / SR
    s = sosfilt(butter(2, 4000, 'highpass', fs=SR, output='sos'), rng.standard_normal(n))
    return gain * 0.35 * s * np.exp(-t * 2.4)

def impact(gain=0.9):
    n = int(0.9 * SR); t = np.arange(n) / SR
    f = 38 + 70 * np.exp(-t * 18)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4)
    return gain * (boom + 0.25 * lowpass(rng.standard_normal(n), 600) * np.exp(-t * 9))

def whoosh(d=0.35, gain=0.16):
    n = int(d * SR); t = np.arange(n) / SR
    s = sosfilt(butter(2, [1500, 9000], 'bandpass', fs=SR, output='sos'), rng.standard_normal(n))
    return gain * s * np.sin(np.pi * t / d) ** 2 * (t / d)

def riser(d, gain=0.2):
    n = int(d * SR); t = np.arange(n) / SR
    return gain * sosfilt(butter(2, 2500, 'highpass', fs=SR, output='sos'), rng.standard_normal(n)) * (t / d) ** 2

def groove(start, end, melody=True, drums=True, layer_gain=1.0, put=None):
    put = put or place
    tb, bar = start, 0
    while tb < end - 0.01:
        root, chord = prog[bar % 4]
        for b in range(4):
            t0 = tb + b * BEAT
            if t0 >= end: break
            if drums:
                put(kick(), t0, 0, 0.95 * layer_gain)
                if b in (1, 3): put(snare_clap(), t0, 0.05, layer_gain)
                put(hat(), t0 + BEAT / 2, 0.3, layer_gain)
                put(hat(), t0 + BEAT / 4, -0.3, 0.45 * layer_gain)
        if drums and bar % 2 == 1: put(hat(True), tb + 3.5 * BEAT, 0.2, layer_gain)
        for b, n in ((0, root), (0.75, root), (1.5, root), (2, root + 12), (3, root), (3.5, root + 7)):
            if tb + b * BEAT < end: put(bass(n - 12, 0.4), tb + b * BEAT, 0, layer_gain)
        for b in (0.5, 1.5, 2.5, 3.5):
            if tb + b * BEAT < end:
                for n in chord: put(piano(n, 0.8, 0.36), tb + b * BEAT, 0.15, layer_gain)
        put(pad([n + 12 for n in chord], min(2.0, end - tb), 0.03, 0.3), tb, 0, layer_gain)
        if melody:
            for b, n in enumerate(hook[bar % 4]):
                if n and tb + b * BEAT < end: put(piano(n, 1.1, 0.5), tb + b * BEAT, -0.2, layer_gain)
        tb += 2.0; bar += 1

# intro: the same groove, rendered apart and opened up from a low-pass (muffled, "next room") to full
saveL, saveR = L.copy(), R.copy()
L[:] = 0; R[:] = 0
groove(0.0, 3.5, melody=True)
iL, iR = L.copy(), R.copy()
L[:] = saveL; R[:] = saveR
n35 = int(3.5 * SR)
ramp = np.clip(np.arange(n35) / n35, 0, 1) ** 2
for src_, dst in ((iL, L), (iR, R)):
    muff = lowpass(src_[:n35], 420)
    dst[:n35] += muff * (1 - ramp) * 1.1 + lowpass(src_[:n35], 7000) * ramp * 0.85
place(impact(0.8), 0.05); place(impact(0.7), 0.95)
# 3.5–4: snare roll + riser, then the drop
for i in range(8): place(snare_clap(), 3.5 + i * 0.0625, 0.0, 0.35 + 0.08 * i)
place(riser(0.5, 0.25), 3.5)
place(impact(1.0), 4.0); place(crash(0.7), 4.0)
groove(4.0, 18.0)
for cut in (6.0, 8.0, 10.0, 12.0, 14.0, 16.0):
    place(whoosh(), cut - 0.3, 0.3 * (1 if cut % 4 else -1))
place(whoosh(0.4, 0.2), 17.7)
# 18–20: breakdown on the light screen (no drums, softer)
groove(18.0, 20.0, melody=True, drums=False, layer_gain=0.8)
place(riser(0.6, 0.22), 19.4)
for i in range(8): place(snare_clap(), 19.5 + i * 0.0625, 0.0, 0.3 + 0.08 * i)
# 20: the wipe to dark
place(impact(1.0), 20.0); place(crash(0.7), 20.0); place(whoosh(0.5, 0.22), 19.8)
groove(20.0, 28.0)
place(impact(0.7), 22.0); place(impact(0.6), 22.3); place(crash(0.5), 24.0); place(impact(0.8), 24.0)
for n in (36, 48, 55, 60, 64, 67, 72):
    place(piano(n, 2.0, 0.6), 28.0, 0.1 * ((n % 3) - 1))
place(pad([60, 64, 67, 72], 2.0, 0.05, 0.2), 28.0)
place(impact(0.8), 28.0); place(crash(0.4), 28.0)

# ── reverb, master ──
ir_t = np.arange(int(1.6 * SR)) / SR
ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 3.2)
ir = sosfilt(butter(1, 5000, 'lowpass', fs=SR, output='sos'), ir); ir /= np.sqrt(np.sum(ir ** 2))
wetL = fftconvolve(L, ir)[: len(L)]; wetR = fftconvolve(R, np.roll(ir, 220))[: len(R)]
mixL = L + 0.28 * wetL; mixR = R + 0.28 * wetR
fade = np.ones_like(mixL); n = int(0.6 * SR); fade[-n:] = np.linspace(1, 0, n)
mix = np.stack([mixL * fade, mixR * fade], 1)
mix = np.tanh(mix * 1.6) / np.tanh(1.6)
mix *= 0.89 / np.max(np.abs(mix))
pcm = (mix * 32767).astype('<i2')
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', sys.argv[1])
