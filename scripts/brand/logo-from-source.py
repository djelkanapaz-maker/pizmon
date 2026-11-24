"""Builds the transparent Paskol logo files from Elkana's full-quality source (the logo on its ivory background).

  python3 scripts/brand/logo-from-source.py <source.png>

The ivory around the logo (and the thin ivory outlines that separate the letters from the record, which reach the
edge) becomes transparent with a soft, colour-corrected edge. Ivory areas enclosed inside the artwork (the centre
of the ס, the light-gold highlights) stay as they are. Writes public/brand/paskol-logo.png (full size, about
1000×922), paskol-logo.webp and the small versions.
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

src = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(np.float32)
# the background colour, from the four corners
c = 12
bg = np.median(np.concatenate([src[:c, :c], src[:c, -c:], src[-c:, :c], src[-c:, -c:]]).reshape(-1, 3), 0)
d = np.sqrt(((src - bg) ** 2).sum(-1))
near = d < 16   # only true background; the light-gold sheen on the record stays artwork
lab, _ = nd.label(near)
outside_ids = set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])) - {0}
outside = np.isin(lab, list(outside_ids))
# soft alpha only where the outside background meets the artwork
art = ~outside
edge_zone = nd.binary_dilation(art, iterations=3) & ~nd.binary_erosion(art, iterations=2)
alpha = art.astype(np.float32)
soft = np.clip((d - 5) / 25, 0, 1)
alpha[edge_zone] = soft[edge_zone]
# un-mix the background from the edge pixels so no ivory fringe is left
a3 = alpha[..., None]
rgb = np.where(a3 > 0.02, (src - (1 - a3) * bg) / np.maximum(a3, 0.02), 0)
rgb = np.clip(rgb, 0, 255)

ys, xs = np.nonzero(alpha > 0.02)
x0, x1, y0, y1 = xs.min() - 2, xs.max() + 3, ys.min() - 2, ys.max() + 3
out = np.dstack([rgb, alpha * 255])[y0:y1, x0:x1].astype(np.uint8)
img = Image.fromarray(out, 'RGBA')
print('logo', img.size, 'background', bg.round())
B = 'public/brand'
img.save(f'{B}/paskol-logo.png', optimize=True)
img.save(f'{B}/paskol-logo.webp', quality=96, method=6)
sm = img.resize((360, round(360 * img.height / img.width)), Image.LANCZOS)
sm.save(f'{B}/paskol-logo-sm.png', optimize=True)
sm.save(f'{B}/paskol-logo-sm.webp', quality=95, method=6)
