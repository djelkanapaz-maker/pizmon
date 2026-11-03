"""Original 30-second score for the Paskol promo (synthesized here: no samples, no third-party audio).
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

# ── 0–5.4: tender piano (Am – F – C – G feel, arpeggios) ──
intro = [(57, [57, 64, 69, 72]), (53, [53, 60, 65, 69]), (48, [55, 60, 64, 67])]
tt = 0.15
for root, arp in intro:
    place(piano(root - 12, 3.2, 0.55), tt, -0.1)
    for i, n in enumerate(arp + arp[1:3]):
        place(piano(n, 2.2, 0.42 + 0.05 * (i % 2)), tt + i * 0.28, 0.25 * ((i % 3) - 1))
    tt += 1.75
place(pad([57, 64, 69], 5.4, 0.035, 1.2), 0.0)
# ── 5.4: the wrong song: record stop ──
place(scratch(), 5.35, 0.0, 1.0)
# ── 5.8–8.4: drone + heartbeat ──
place(pad([33, 40], 3.0, 0.08, 0.6), 5.8)
for at in (6.1, 7.0, 7.85):
    place(heartbeat(), at, 0, 0.9)
# ── 8.4–9.0: riser ──
t = np.arange(int(0.6 * SR)) / SR
sos = butter(2, 2500, 'highpass', fs=SR, output='sos')
riser = sosfilt(sos, rng.standard_normal(len(t))) * (t / 0.6) ** 2 * 0.18
place(riser, 8.4)
place(piano(81, 1.4, 0.4), 8.7, 0.3)

# ── 9.0–28: groove, 120 bpm (beat 0.5s), progression C – G – Am – F per bar (2s) ──
BEAT = 0.5
prog = [(48, [60, 64, 67]), (43, [59, 62, 67]), (45, [60, 64, 69]), (41, [60, 65, 69])]
start, end = 9.0, 28.0
bar = 0
tb = start
while tb < end - 0.01:
    root, chord = prog[bar % 4]
    last = tb + 2 > end - 0.01
    # drums
    for b in range(4):
        tb_b = tb + b * BEAT
        if tb_b >= end: break
        place(kick(), tb_b, 0, 0.95)
        if b in (1, 3): place(snare_clap(), tb_b, 0.05)
        place(hat(), tb_b + BEAT / 2, 0.3)
        if bar >= 2: place(hat(), tb_b, -0.3, 0.6)
    if bar % 4 == 3: place(hat(True), tb + 3.5 * BEAT, 0.2)
    # bass: root on beats, octave push
    for b, n in ((0, root), (1.5, root), (2, root + 12), (3, root)):
        place(bass(n - 12, 0.45), tb + b * BEAT, 0)
    # chords: off-beat piano stabs + pad
    for b in (0.5, 1.5, 2.5, 3.5):
        for n in chord:
            place(piano(n, 0.9, 0.38), tb + b * BEAT, 0.15)
    place(pad([n + 12 for n in chord], 2.0, 0.03, 0.3), tb)
    # melody from bar 2: simple, hopeful hook
    hook = [[76, None, 74, 72], [74, None, 71, 67], [72, None, 76, 79], [77, 76, 74, None]]
    if bar >= 2:
        for b, n in enumerate(hook[bar % 4]):
            if n: place(piano(n, 1.2, 0.5), tb + b * BEAT, -0.2)
    tb += 2.0; bar += 1
# ── 28: final chord rings out ──
for n in (36, 48, 55, 60, 64, 67, 72):
    place(piano(n, 2.0, 0.6), 28.0, 0.1 * ((n % 3) - 1))
place(pad([60, 64, 67, 72], 2.0, 0.05, 0.2), 28.0)
place(kick(), 28.0, 0, 0.8)

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
