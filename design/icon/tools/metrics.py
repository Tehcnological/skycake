"""metrics.py render.png [...] -- colour fidelity inside shapes and rim darkening/halo just outside, vs src/icon.png"""
import sys, numpy as np
from PIL import Image
from skimage.morphology import disk, binary_erosion, binary_dilation
from skimage.color import rgb2lab, deltaE_ciede2000

o = np.asarray(Image.open('src/icon.png').convert('RGB')) / 255.
al = sum(np.asarray(Image.open(f'layers/{n}.png'))[..., 3] / 255.
         for n in ['sky-S-clouds', 'sky-contrail-airplane', 'cake-C-rings']).clip(0, 1)
fg = al > 0.5
inner = binary_erosion(fg, disk(6))
outer = binary_dilation(fg, disk(7)) & ~binary_dilation(fg, disk(2))
lo = rgb2lab(o)
for p in sys.argv[1:]:
    r = np.asarray(Image.open(p).convert('RGB').resize(o.shape[1::-1])) / 255.
    lr = rgb2lab(r)
    de = deltaE_ciede2000(lo, lr)
    print(f'{p:42s} interior dE00 mean {de[inner].mean():5.2f} p95 {np.percentile(de[inner], 95):5.2f} | '
          f'outer rim L* orig {lo[..., 0][outer].mean():5.2f} render {lr[..., 0][outer].mean():5.2f} '
          f'(p95 {np.percentile(lr[..., 0][outer], 95):5.2f})')
