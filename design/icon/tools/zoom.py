import sys; from PIL import Image
# zoom.py out.png orig.png render1.png [render2.png ...]  -- crops: C rings, S edge+clouds, cherry/icing
out, *ims = sys.argv[1:]
boxes = [(540, 520, 700, 680), (180, 420, 340, 580), (620, 270, 780, 430)]
ims = [Image.open(p).convert('RGB') for p in ims]
T = 300; sheet = Image.new('RGB', (T * len(boxes), T * len(ims)), (60, 60, 60))
for r, im in enumerate(ims):
    for c, b in enumerate(boxes): sheet.paste(im.crop(b).resize((T, T), Image.NEAREST), (c * T, r * T))
sheet.save(out)
