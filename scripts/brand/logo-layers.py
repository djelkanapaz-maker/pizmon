"""Splits the Paskol logo into layers for the animated opening screen, in both tones.

  record  – the vinyl only (the parts hidden behind the letters and the horn filled in from the grooves around them),
            centred on its own spindle so it can spin
  top     – the wordmark, the horn and the two swooshes, drawn over the record

Run from the repo root:  python3 scripts/brand/logo-layers.py <out-dir>
Writes record.png + top.png (the original colors, for the light skin), record-light.png + top-light.png (light tones,
for the dark skin) and
layers.json (the record's centre and radius in the logo's pixels).
"""
import json, sys
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage as nd

OUT = sys.argv[1] if len(sys.argv) > 1 else 'public/brand/opening'
SRC = 'public/brand/paskol-logo.png'
a = np.asarray(Image.open(SRC).convert('RGBA')).astype(np.float32) / 255
H, W = a.shape[:2]
alpha = a[..., 3]
solid = alpha > 0.5
S = W / 900   # the probe points and the horn's neck below were drawn on the 900-wide logo
sc = lambda *v: tuple(int(round(x * S)) for x in v)

# ---- parts of the logo, by connected shape (they are drawn with transparent gaps between them) ----
lab, n = nd.label(solid)
sizes = nd.sum(solid, lab, range(1, n + 1))
boxes = nd.find_objects(lab)
def comp_at(x, y, r=0):
    # the component at (x, y), or the nearest one within r pixels
    if lab[y, x] or not r: return lab[y, x]
    win = lab[max(0, y - r):y + r + 1, max(0, x - r):x + r + 1]
    yy, xx = np.nonzero(win)
    if not len(yy): return 0
    i = np.argmin((yy - min(r, y)) ** 2 + (xx - min(r, x)) ** 2)
    return win[yy[i], xx[i]]
letters = [comp_at(*sc(x, y)) for x, y in ((60, 450), (240, 450), (330, 450), (320, 600), (560, 420), (780, 450))]
letters = [c for c in letters if c]
# the two thin swooshes outside the record: the mid-sized shapes that are not letters
swooshes = [i + 1 for i, s in enumerate(sizes) if 2000 * S * S < s < 9000 * S * S and (i + 1) not in letters]
# make sure the probes hit the right shapes: the swooshes are thin arcs outside the record
letters_mask = np.isin(lab, letters)
swoosh_mask = np.isin(lab, [c for c in swooshes if c])

# ---- the record: a circle fitted to the outer edge of its visible parts ----
rec_comps = [i + 1 for i, s in enumerate(sizes) if s > 300 * S * S and (i + 1) not in letters and (i + 1) not in swooshes]
rec_any = np.isin(lab, rec_comps)
edge = rec_any & ~nd.binary_erosion(rec_any, iterations=2)
ys, xs = np.nonzero(edge)
keep = (xs < 560 * S) | (ys > 470 * S)           # leave out the horn's outline
xs, ys = xs[keep].astype(np.float64), ys[keep].astype(np.float64)
# outer edge only: the points farthest from a first-guess centre in each direction
cx0, cy0 = xs.mean(), ys.mean()
ang = np.arctan2(ys - cy0, xs - cx0); dist = np.hypot(xs - cx0, ys - cy0)
bins = np.digitize(ang, np.linspace(-np.pi, np.pi, 181))
px, py = [], []
for b in np.unique(bins):
    i = np.flatnonzero(bins == b); j = i[np.argmax(dist[i])]; px.append(xs[j]); py.append(ys[j])
px, py = np.array(px), np.array(py)
A = np.c_[2 * px, 2 * py, np.ones_like(px)]
sol, *_ = np.linalg.lstsq(A, px ** 2 + py ** 2, rcond=None)
cx, cy = sol[0], sol[1]; R = float(np.sqrt(sol[2] + cx ** 2 + cy ** 2))
# the full-quality logo has the same art as the 900-wide one; its fit there (419.14, 467.33, r 344.18) is cleaner than a
# fit on the larger file, where the ivory outlines cut the record's rim into more pieces
cx, cy, R = 419.14 * S, 467.33 * S, 344.18 * S
yy, xx = np.mgrid[0:H, 0:W]
rr = np.hypot(xx - cx, yy - cy)
disk = rr <= R + 1.5

# ---- the horn: everything of the record's shapes outside the disk, plus its neck inside it ----
neck = np.zeros((H, W), np.uint8)
cv2.fillPoly(neck, [np.array([sc(x, y) for x, y in ((445, 322), (640, 168), (765, 0), (899, 0), (899, 430), (860, 414), (800, 378), (700, 353),
                              (620, 351), (560, 358), (505, 386), (470, 352))], np.int32)], 1)
horn = rec_any & ((~disk) | (neck > 0))
horn = nd.binary_closing(horn, iterations=2) & rec_any
record_vis = rec_any & ~horn & disk

top_mask = letters_mask | swoosh_mask | horn
# a soft alpha for each layer from the original alpha
def layer(mask, grow=1):
    m = nd.binary_dilation(mask, iterations=grow)
    out = a.copy(); out[..., 3] = alpha * m
    return out
top = layer(top_mask)

# ---- fill the record where the letters and horn hide it: unwrap to polar, fill along the grooves ----
NT, NR = 4096, int(R) + 2
theta = np.linspace(0, 2 * np.pi, NT, endpoint=False)
rad = np.arange(NR, dtype=np.float32)
mapx = (cx + rad[:, None] * np.cos(theta)[None, :]).astype(np.float32)
mapy = (cy + rad[:, None] * np.sin(theta)[None, :]).astype(np.float32)
rgb = a[..., :3]
valid = (record_vis & (alpha > 0.9) & ~nd.binary_dilation(horn, iterations=round(14 * S)) & ~nd.binary_dilation(letters_mask, iterations=round(4 * S))).astype(np.float32)
valid = nd.binary_erosion(valid > 0, iterations=2).astype(np.float32)   # stay clear of the anti-aliased edges
pol = cv2.remap(rgb, mapx, mapy, cv2.INTER_LINEAR)
pv = cv2.remap(valid, mapx, mapy, cv2.INTER_NEAREST) > 0.5
filled = pol.copy()
for r in range(NR):
    v = pv[r]
    if v.sum() < 8:
        continue
    idx = np.flatnonzero(v)
    # circular interpolation of every colour channel along the groove
    ext = np.r_[idx - NT, idx, idx + NT]
    for c in range(3):
        vals = pol[r, idx, c]
        filled[r, :, c] = np.interp(np.arange(NT), ext, np.r_[vals, vals, vals])
# rows the letters cover all the way round (near the spindle): the label colour of the nearest filled row
row_ok = np.array([pv[r].sum() >= 8 for r in range(NR)])
last = None
for r in range(NR - 1, -1, -1):
    if row_ok[r]: last = r
    elif last is not None: filled[r] = filled[last].mean(0)
first_ok = np.flatnonzero(row_ok)[0]
for r in range(first_ok): filled[r] = filled[first_ok].mean(0)

# the centre label (under the letters; the original only shows bits of it): a clean gold label with a thin rim,
# so nothing from the horn's neck spins with the record
RL = int(R * 0.34)
gold = a[int(cy - 115 * S):int(cy - 95 * S), int(cx + 40 * S):int(cx + 80 * S), :3].reshape(-1, 3)
gold = gold[(gold.max(1) - gold.min(1)) > 0.15].mean(0) if ((gold.max(1) - gold.min(1)) > 0.15).any() else np.array([0.80, 0.66, 0.48])
for r in range(min(RL + 6, NR)):
    if r >= RL:      # the dark rim between label and grooves
        filled[r] = np.array([0.06, 0.05, 0.05])
    else:
        filled[r] = gold * (0.86 + 0.14 * (1 - r / RL)) + 0.06 * np.cos(np.linspace(0, 4 * np.pi, NT))[:, None]  # a soft sheen, so the label shows the turn
# back to a square image of just the record, centred on the spindle (so a CSS rotate spins it in place)
S = int(np.ceil(R)) * 2 + 4; c0 = S / 2
gy, gx = np.mgrid[0:S, 0:S].astype(np.float32)
dx, dy = gx - c0, gy - c0
gr = np.hypot(dx, dy); gt = (np.arctan2(dy, dx) % (2 * np.pi)) / (2 * np.pi) * NT
rec_rgb = cv2.remap(filled, gt, np.clip(gr, 0, NR - 1).astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP)
rec_a = np.clip(R - gr + 0.5, 0, 1)                      # a clean anti-aliased rim
record = np.dstack([rec_rgb, rec_a])

# ---- tones ----
def light_tone(img, record_layer=False):
    rgb, al = img[..., :3], img[..., 3:]
    mx, mn = rgb.max(-1), rgb.min(-1); L = (mx + mn) / 2; C = mx - mn
    w = np.clip((C - 0.05) / 0.18, 0, 1)[..., None]       # 0 = neutral black/white, 1 = clearly gold
    inv = 1 - rgb
    if record_layer:
        # vinyl: brushed silver with the grooves still dark enough to read, not a flat white disk
        g = 1 - L
        inv = (0.18 + 0.66 * g ** 1.6)[..., None] * np.ones(3)
    lift = rgb + (1 - rgb) * np.clip(0.5 - L, 0, 0.5)[..., None]
    out = inv * (1 - w) + lift * w
    ivory = np.array([0.965, 0.945, 0.915])                # ivory, not paper white: sits softer on black
    out = out * ivory
    return np.concatenate([np.clip(out, 0, 1), al], -1)

def save(img, name):
    al = img[..., 3]
    # feather the cut edges by half a pixel so nothing looks pasted on
    img = img.copy(); img[..., 3] = cv2.GaussianBlur(al, (0, 0), 0.6)
    Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), 'RGBA').save(f'{OUT}/{name}.png', optimize=True)

import os
os.makedirs(OUT, exist_ok=True)
save(record, 'record'); save(top, 'top')
save(light_tone(record, True), 'record-light'); save(light_tone(top), 'top-light')
json.dump({'w': W, 'h': H, 'cx': round(float(cx), 2), 'cy': round(float(cy), 2), 'r': round(R, 2), 'size': S}, open(f'{OUT}/layers.json', 'w'))
print('centre', round(float(cx), 1), round(float(cy), 1), 'radius', round(R, 1), 'letters', letters, 'swooshes', swooshes)
