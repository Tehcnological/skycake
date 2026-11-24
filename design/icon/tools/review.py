"""review.py <appearances_dir> <before_1024.png> <out.png> -- labelled review sheet"""
import sys
from PIL import Image, ImageDraw, ImageFont
D, before, out = sys.argv[1:4]
F = ImageFont.truetype('/System/Library/Fonts/SFNS.ttf', 22); Fs = ImageFont.truetype('/System/Library/Fonts/SFNS.ttf', 18)
LIGHT = (236, 236, 242, 255); DARK = (28, 28, 32, 255)
def on(img, c): return Image.alpha_composite(Image.new('RGBA', img.size, c), img.convert('RGBA')).convert('RGB')
names = ['Default', 'Dark', 'ClearLight', 'ClearDark', 'TintedLight', 'TintedDark']
sheet = Image.new('RGB', (1500, 1330), (18, 18, 20)); d = ImageDraw.Draw(sheet)
def lab(x, y, t): d.text((x, y), t, font=Fs, fill=(200, 200, 200))
d.text((30, 20), 'skycake.icon — clean contrail, flat #0c0c0c, 2x topo lines (Icon Composer 27.2)', font=F, fill=(240, 240, 240))
# before / after, large
y = 70; S = 600
crop = (60, 60, 964, 964)
sheet.paste(on(Image.open(before).crop(crop).resize((S, S), Image.LANCZOS), DARK), (30, y)); lab(30, y + S + 6, 'before (v2)')
sheet.paste(on(Image.open(f'{D}/Default-1024.png').crop(crop).resize((S, S), Image.LANCZOS), DARK), (650, y)); lab(650, y + S + 6, 'after (v3)')
# small sizes, right column
x = 1275; yy = y
for s in (180, 60):
    sheet.paste(on(Image.open(f'{D}/Default-{s}.png'), DARK), (x, yy)); lab(x, yy + s + 4, f'{s}px 1:1'); yy += s + 40
im = on(Image.open(f'{D}/Default-60.png'), DARK).resize((180, 180), Image.NEAREST); sheet.paste(im, (x, yy)); lab(x, yy + 184, '60px ×3')
# appearances at 180 1:1
y = 720; x = 30
for n in names:
    sheet.paste(on(Image.open(f'{D}/{n}-180.png'), DARK if 'Dark' in n else LIGHT), (x, y)); lab(x, y + 186, f'{n} 180'); x += 200
# appearances at 1024 shrunk
y = 940; x = 30
for n in names:
    sheet.paste(on(Image.open(f'{D}/{n}-1024.png').resize((230, 230), Image.LANCZOS), DARK if 'Dark' in n else LIGHT), (x, y)); lab(x, y + 236, f'{n} 1024'); x += 245
sheet.save(out); print(sheet.size)
