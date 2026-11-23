#!/usr/bin/env python3
"""Builds the Pizmon couples tutorial: frames (out/pz-frames) + one narration clip per part.
Usage: pz-assemble.py <voice-dir> <out.mp4> [music.mp3]   (voice files: any name ending in <part>.wav)"""
import glob, json, re, subprocess, sys

voice_dir, out = sys.argv[1], sys.argv[2]
music = sys.argv[3] if len(sys.argv) > 3 else 'public/demo-audio/golden-hour.mp3'
FR = 'scripts/tutorial/out/pz-frames'
index = json.load(open(f'{FR}/index.json'))
PLAN = json.load(open('scripts/tutorial/pz-plan.json'))
import os
os.makedirs('scripts/tutorial/out/pz-voice', exist_ok=True)
voices = {}
for f in glob.glob(f'{voice_dir}/*.wav'):
    n = int(re.search(r'(\d+)\.wav$', f).group(1))
    dst = f'scripts/tutorial/out/pz-voice/{n:02d}.wav'
    # clean + loudness-normalize each clip once, as plain 48 kHz stereo
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', f, '-af', 'highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=9,aresample=48000',
                    '-ac', '2', '-ar', '48000', dst], check=True)
    voices[n] = dst
# the music bed sits at a fixed loudness (about -26 LUFS before ducking), however loud the track is mastered
def lufs(f):
    o = subprocess.run(['ffmpeg', '-hide_banner', '-t', '120', '-i', f, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', o)[-1])
BED_GAIN = 10 ** ((-26.0 - lufs(music)) / 20)
dur = lambda f: float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]))

T = 0.5                 # crossfade
INTRO, OUTRO = 3.6, 5.0
LEAD, TAIL = 0.8, 1.3   # silence before / after each part narration

segs = [('intro', INTRO)]   # (frame, planned seconds)
voice_at = []               # (file, start seconds)
t = INTRO
parts = sorted({x['part'] for x in index})
for p in parts:
    frames = [x['name'] for x in index if x['part'] == p]
    d = dur(voices[p])
    block = LEAD + d + TAIL
    voice_at.append((voices[p], t + LEAD))
    cues = PLAN['parts'][p - 1].get('cues')
    if cues and len(cues) == len(frames):
        # each screen appears at the word it belongs to (seconds into the recording)
        starts = [0.0] + [max(0.0, LEAD + c - 0.3) for c in cues[1:]]  # the crossfade lands on the word
        ends = starts[1:] + [block]
        for f, a0, a1 in zip(frames, starts, ends):
            segs.append((f, a1 - a0))
    else:
        # first frame of a part gets a bit more time (title is being read)
        w = [1.25] + [1.0] * (len(frames) - 1)
        for f, wi in zip(frames, w):
            segs.append((f, block * wi / sum(w)))
    t += block
segs.append(('outro', OUTRO))
total = sum(s for _, s in segs)

cmd = ['ffmpeg', '-loglevel', 'error', '-y']
for i, (f, s) in enumerate(segs):
    L = s + (T if i < len(segs) - 1 else 0)
    cmd += ['-loop', '1', '-framerate', '30', '-t', f'{L:.3f}', '-i', f'{FR}/{f}.png']
nv = len(segs)
for f, _ in voice_at:
    cmd += ['-i', f]
cmd += ['-stream_loop', '-1', '-i', music]

g = []
for i in range(nv):
    g.append(f'[{i}:v]format=yuv420p,setsar=1[v{i}]')
prev, off = 'v0', 0.0
for i in range(1, nv):
    off += segs[i - 1][1]
    g.append(f'[{prev}][v{i}]xfade=transition=fade:duration={T}:offset={off:.3f}[x{i}]')
    prev = f'x{i}'
g.append(f'[{prev}]fade=t=in:st=0:d=0.6,fade=t=out:st={total - 1.2:.3f}:d=1.2[vout]')

vo = []
for k, (_, start) in enumerate(voice_at):
    ms = int(start * 1000)
    g.append(f'[{nv + k}:a]asetpts=PTS-STARTPTS,adelay={ms}|{ms}[n{k}]')
    vo.append(f'[n{k}]')
g.append(f'{"".join(vo)}amix=inputs={len(vo)}:duration=longest:normalize=0,apad,atrim=0:{total:.3f},asplit=2[voice][sc]')
m = nv + len(voice_at)
g.append(f'[{m}:a]asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,volume={BED_GAIN:.4f},atrim=0:{total:.3f},afade=t=in:d=1.5,afade=t=out:st={total - 3.5:.3f}:d=3.5[bed]')
g.append('[bed][sc]sidechaincompress=threshold=0.02:ratio=9:attack=60:release=700:makeup=1[ducked]')
g.append('[voice][ducked]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.79[aout]')

cmd += ['-filter_complex', ';'.join(g), '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
        '-r', '30', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', f'{total:.3f}', out]
subprocess.run(cmd, check=True)
json.dump({'segments': segs, 'voice': voice_at, 'total': total}, open(out + '.timeline.json', 'w'), ensure_ascii=False, indent=1)
print(f'{out}: {total:.1f}s')
