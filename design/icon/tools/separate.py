import sys, numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage.morphology import disk, binary_opening, binary_dilation, binary_closing, binary_erosion
src, out = sys.argv[1], sys.argv[2]
a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
H, W, _ = a.shape
BG = np.array([13., 13., 13.])
d = np.sqrt(((a - BG) ** 2).sum(2))           # distance from background color
core = d > 110                                  # confident foreground
core = ndi.binary_fill_holes(core) & (d > 60) | core
lab, n = ndi.label(core)
sizes = ndi.sum(core, lab, range(1, n + 1))
core = np.isin(lab, 1 + np.where(sizes > 3)[0])  # drop noise specks/topo
# soft edge band: propagate nearest core color, alpha = d / d(core color)
idx = ndi.distance_transform_edt(~core, return_distances=False, return_indices=True)
near = a[idx[0], idx[1]]
dn = np.sqrt(((near - BG) ** 2).sum(2))
band = binary_dilation(core, disk(8)) & ~core & (d > 18)
alpha = np.zeros((H, W), np.float32); alpha[core] = 1
alpha[band] = np.clip(d[band] / np.maximum(dn[band], 1), 0, 1)
# de-matte the band: c = (p - (1-α)BG)/α, kept close to nearest core color
col = a.copy()
m = band & (alpha > 0.02)
dm = (a[m] - (1 - alpha[m, None]) * BG) / alpha[m, None]
col[m] = np.clip(dm, 0, 255)
col[band & (alpha <= 0.02)] = near[band & (alpha <= 0.02)]
fg = alpha > 0
# split left (sky) / right (cake) by component centroid
lab, n = ndi.label(binary_dilation(fg, disk(1)))
R, G, B = a[..., 0], a[..., 1], a[..., 2]
warm = core & (R > B + 60)                    # tan cake / red cherry pixels
sky = np.zeros_like(fg); cake = np.zeros_like(fg)
cnt = ndi.sum(core, lab, range(1, n + 1)); wc = ndi.sum(warm, lab, range(1, n + 1))
for i in range(1, n + 1):
    if cnt[i-1] < 25: continue                # specks
    (cake if wc[i-1] > 0.05 * cnt[i-1] else sky)[lab == i] = True
sky &= fg; cake &= fg
# orphan foreground pixels (tiny fragments of thin strokes) join the group of the nearest assigned pixel
orph = (alpha > 0.15) & ~sky & ~cake & (d > 40)
ni = ndi.distance_transform_edt(~(sky | cake), return_distances=True, return_indices=True)
close = orph & (ni[0] < 6)
sky |= close & sky[ni[1][0], ni[1][1]]; cake |= close & cake[ni[1][0], ni[1][1]]
white = (R > 200) & (G > 200) & (B > 200)
blue = (B > R + 60) & (B > 150)
red = (R > 150) & (R > G + 70) & (R > B + 60)
# S body = thick part of sky (opening removes thin contrail/plane wings stay separate blob)
s_open = binary_opening(core & sky, disk(5))
lab2, n2 = ndi.label(s_open)
blue_lab = np.bincount(lab2[blue & s_open], minlength=n2 + 1); blue_lab[0] = 0
s_body = lab2 == blue_lab.argmax()
s_layer = sky & binary_dilation(s_body, disk(4))
thin_white_in_s = s_layer & white & ~binary_opening(white & s_layer, disk(4))
plane_out = sky & ~s_layer
lp, npl = ndi.label(binary_dilation(plane_out, disk(3)))
szp = ndi.sum(plane_out, lp, range(1, npl + 1))
plane_out &= np.isin(lp, 1 + np.where(szp > 80)[0])
# contrail inside the S = thin white strokes connected to the contrail outside it (not cloud slivers)
lt, nt = ndi.label(binary_dilation(thin_white_in_s, disk(1)))
touch = np.unique(lt[binary_dilation(plane_out, disk(3)) & (lt > 0)])
contrail_seed = np.isin(lt, touch[touch > 0]) & thin_white_in_s
plane_layer = plane_out | binary_dilation(contrail_seed, disk(1)) & sky
# cake parts
labr, nr = ndi.label(binary_closing(red & cake, disk(2)))
top = [i for i, sl in enumerate(ndi.find_objects(labr), 1) if sl[0].stop < 420 and (labr[sl] == i).sum() > 300]
cherry = binary_dilation(np.isin(labr, top), disk(3)) & cake & (np.arange(H)[:, None] < 400)
icing_core = binary_opening(white & cake & ~cherry, disk(2))
icing = binary_dilation(icing_core, disk(2)) & cake & ~cherry
c_layer = cake  # full flattened cake underneath (no gaps)
# clouds = thick white blobs inside the S (the thin contrail is removed by the opening)
cloud_core = binary_opening(white & s_layer & ~binary_dilation(contrail_seed, disk(2)), disk(4))
clouds = binary_dilation(cloud_core, disk(2)) & s_layer & ~plane_layer
# widen the contrail zone so its soft white/blue edge pixels live in the contrail layer (unmixed below)
plane_layer = binary_dilation(plane_layer, disk(3)) & sky & ~binary_dilation(cloud_core, disk(1))
clouds &= ~plane_layer
def unmix(ch, v_in, v_out):  # fraction of the topping colour in a 2-colour blend
    return np.clip((a[..., ch] - v_out) / (v_in - v_out), 0, 1)
# inner-edge alpha: 1 on the topping core, unmixed against the surface it sits on in the 2px band
def inner_alpha(core_m, region, frac):
    am = np.where(core_m, 1.0, np.where(region, frac, 0.0)); return am
cloud_a = inner_alpha(cloud_core, clouds, unmix(0, 255, 80))          # white over sky-blue (R)
icing_a = inner_alpha(icing_core, icing, unmix(2, 255, 120))          # white over tan (B)
cherry_core = np.isin(labr, top) & cake
cherry_a = inner_alpha(cherry_core, cherry, np.maximum(unmix(1, 86, 255), (R > G + 60)))  # red over white icing (G)
def save(mask, name, amap=None, color=None, raw=False):
    al = mask * amap if raw else alpha * mask * (1 if amap is None else np.where(alpha < 1, 1.0, amap))  # unmix only on the letter, not at the silhouette
    rgba = np.dstack([col if color is None else color, al * 255]).round().clip(0, 255).astype(np.uint8)
    Image.fromarray(rgba).save(f'{out}/{name}.png')
    print(name, int((al > 0).sum()), 'px')
import os; os.makedirs(out, exist_ok=True)
# soft (alpha<1) silhouette pixels belong only to the topmost layer containing them
soft = alpha < 1
def stack(top_to_bottom):
    claimed = np.zeros_like(soft); outl = []
    for m in top_to_bottom:
        m = m & ~(claimed & soft); claimed |= m; outl.append(m)
    return outl
plane_layer, clouds, s_layer = stack([plane_layer, clouds, s_layer])
cherry, icing, c_layer = stack([cherry, icing, c_layer])
# contrail/airplane: pure white; where it crosses the S, alpha is unmixed against the local sky-blue
# and the S underneath is filled with that blue, so no white/blue blend pixels live in the contrail layer
WHITE = np.array([255., 255., 255.])
blue_ref = s_layer & blue & ~binary_dilation(white, disk(3)) & ~soft
bi = ndi.distance_transform_edt(~blue_ref, return_distances=False, return_indices=True)
b_loc = a[bi[0], bi[1]]
over_s = plane_layer & binary_dilation(s_body, disk(4))
v = WHITE - b_loc
frac = np.clip(((a - b_loc) * v).sum(2) / np.maximum((v * v).sum(2), 1), 0, 1)
vb = WHITE - BG
frac_bg = np.clip(((a - BG) * vb).sum(2) / (vb * vb).sum(), 0, 1)   # white over the dark background
s_shape = binary_closing((blue | cloud_core) & sky, disk(5)) & sky   # true S silhouette, contrail gap closed
plane_a = np.where(s_shape, frac, frac_bg)
plane_col = np.broadcast_to(WHITE, col.shape).copy()
under = plane_layer & s_shape & ~soft
s_layer &= ~(plane_layer & ~s_shape)   # contrail beyond the S edge sits over the background, not the S
s_col = col.copy(); s_col[under] = b_loc[under]
# toppings keep the original pixel colour; letters underneath stay complete, so stacking is exact
save(s_layer, 'sky-S-clouds', color=s_col); save(plane_layer, 'sky-contrail-airplane', plane_a, plane_col, raw=True); save(clouds, 'sky-clouds', cloud_a)
save(c_layer, 'cake-C-rings'); save(icing, 'cake-icing', icing_a); save(cherry, 'cake-cherry', cherry_a)
# background: original with foreground replaced by grain sampled from plain bg
rng = np.random.default_rng(7)
hole = binary_dilation(sky | cake, disk(1))
pool = a[(~binary_dilation(fg, disk(12))) & (d < 25)]
bg = a.copy(); bg[hole] = pool[rng.integers(0, len(pool), hole.sum())]
bg_orig = bg.copy()
# topo lines as their own transparent layer over a flat #0c0c0c fill (drops the source's blocky
# compression grain). argv[3] = extra line half-width in px (0 keeps the original ~2px width).
from scipy.ndimage import median_filter, gaussian_filter, grey_dilation
topo_r = float(sys.argv[3]) if len(sys.argv) > 3 else 0
lum = bg.mean(2)
base = median_filter(lum, size=9)                          # local grain level under the lines
sig = np.clip(lum - base, 0, None)
ridge = gaussian_filter(sig, 0.7) > 6                      # line pixels (grain alone stays below this)
lr, nl = ndi.label(ridge); sz = ndi.sum(ridge, lr, range(1, nl + 1))
lines = np.isin(lr, 1 + np.where(sz >= 40)[0]) & ~binary_dilation(fg, disk(6))
# re-stroke each line from its centreline: uniform width, anti-aliased edge, original brightness
from skimage.morphology import skeletonize
skel = skeletonize(binary_closing(lines, disk(1)))
ls, nls = ndi.label(skel, structure=np.ones((3, 3))); ssz = ndi.sum(skel, ls, range(1, nls + 1))
skel = np.isin(ls, 1 + np.where(ssz >= 25)[0])
dist = ndi.distance_transform_edt(~skel)
width = 2.0 + 2 * topo_r                                   # source lines are ~2px wide
cover = np.clip(width / 2 + 0.5 - dist, 0, 1)
peak = np.percentile(sig[skel], 75)                        # typical line brightness above the grain
FILL = 12.0                                                # #0c0c0c
topo_a = cover * peak / (255 - FILL)                       # white at low alpha over #0c0c0c
Image.fromarray(np.dstack([np.full((H, W, 3), 255, np.uint8), (topo_a * 255).round().astype(np.uint8)])).save(f'{out}/topo-lines.png')
print('topo lines layer: radius', topo_r, 'line px', int(lines.sum()), 'peak +%.0f over fill' % (topo_a.max() * 243))
flat = np.full((H, W, 3), FILL) * (1 - topo_a[..., None]) + 255 * topo_a[..., None]
Image.fromarray(flat.round().astype(np.uint8)).save(f'{out}/background-flat-preview.png')
# verification: recomposite and diff
comp = bg.copy()
for nm in ['cake-C-rings', 'cake-icing', 'cake-cherry', 'sky-S-clouds', 'sky-clouds', 'sky-contrail-airplane']:
    L = np.asarray(Image.open(f'{out}/{nm}.png')).astype(np.float32); al = L[..., 3:] / 255
    comp = L[..., :3] * al + comp * (1 - al)
diff = np.abs(comp - a).max(2)
print('recomposite diff: mean %.2f  p99 %.1f  p99.9 %.1f  max %.0f' % (diff.mean(), *np.percentile(diff, [99, 99.9]), diff.max()))
fg = sky | cake
print('fg-only diff p99.9 %.1f' % np.percentile(diff[fg], 99.9))
