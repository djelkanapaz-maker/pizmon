"""Generates ORIGINAL placeholder audio for development (company-owned, no samples, no third-party material).
Output: public/demo-audio/*.mp3. Requires numpy and ffmpeg.
    python3 scripts/seed/make-demo-audio.py
"""
import os, subprocess, tempfile, wave
import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'demo-audio')
rng = np.random.default_rng(7)

def note(freq, dur, kind='saw', amp=0.2, attack=0.01, release=0.08):
    t = np.arange(int(dur * SR)) / SR
    if kind == 'sine':
        w = np.sin(2 * np.pi * freq * t)
    elif kind == 'pad':
        w = sum(np.sin(2 * np.pi * freq * m * t + i) / (i + 1) for i, m in enumerate([1, 2.003, 3.01, 0.5]))
    else:
        w = 2 * ((freq * t) % 1) - 1
    env = np.minimum(1, t / max(attack, 1e-4)) * np.minimum(1, (dur - t) / max(release, 1e-4))
    return amp * w * np.clip(env, 0, 1)

def kick():
    t = np.arange(int(0.35 * SR)) / SR
    f = 50 + 120 * np.exp(-t * 30)
    return 0.9 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)

def hat():
    n = int(0.05 * SR)
    return 0.12 * rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 80)

def clap():
    n = int(0.15 * SR)
    return 0.25 * rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 25)

def place(buf, sig, at):
    i = int(at * SR); j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i]

def lowpass(x, a=0.08):
    y = np.zeros_like(x); acc = 0.0
    for i, v in enumerate(x):
        acc += a * (v - acc); y[i] = acc
    return y

def track(bpm, bars, chords, bass_kind='saw', drums=True, pad_amp=0.08):
    beat = 60 / bpm; dur = bars * 4 * beat
    buf = np.zeros(int(dur * SR) + SR)
    for bar in range(bars):
        root = chords[bar % len(chords)]
        t0 = bar * 4 * beat
        place(buf, note(root, 4 * beat, 'pad', pad_amp, attack=0.4, release=0.6), t0)
        place(buf, note(root * 1.26, 4 * beat, 'pad', pad_amp * 0.7, attack=0.4, release=0.6), t0)
        place(buf, note(root * 1.5, 4 * beat, 'pad', pad_amp * 0.6, attack=0.4, release=0.6), t0)
        for b in range(4):
            if drums:
                place(buf, kick(), t0 + b * beat)
                place(buf, hat(), t0 + b * beat + beat / 2)
                if b in (1, 3): place(buf, clap(), t0 + b * beat)
            if bass_kind:
                place(buf, lowpass(note(root / 2, beat * 0.45, bass_kind, 0.25)), t0 + b * beat + beat / 2)
    buf = buf[: int(dur * SR)]
    fade = int(1.5 * SR); buf[:fade] *= np.linspace(0, 1, fade); buf[-fade:] *= np.linspace(1, 0, fade)
    return buf / (np.max(np.abs(buf)) + 1e-9) * 0.85

def write(name, x):
    os.makedirs(OUT, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        path = f.name
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', path, '-b:a', '96k', '-metadata',
                    'comment=Original demo audio generated for WEDDING MUSIC CLUB development', os.path.join(OUT, name)], check=True)
    os.remove(path)
    print('wrote', name)

A, D, E, F, G, C = 220.0, 146.83, 164.81, 174.61, 196.0, 130.81
write('golden-hour.mp3', track(122, 24, [A, F, C * 2, G]))
write('disco-floor.mp3', track(118, 20, [D * 2, G, A, F]))
write('morning-run.mp3', track(128, 24, [E * 2, C * 2, D * 2, A]))
write('chuppah-sketch.mp3', track(70, 12, [D * 2, A, G * 2 / 2 * 2, F * 2], bass_kind=None, drums=False, pad_amp=0.12))
