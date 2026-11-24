import sys, numpy as np; from PIL import Image
from scipy import ndimage as ndi
d, out = sys.argv[1], sys.argv[2]
a=np.asarray(Image.open('src/icon.png').convert('RGB')).astype(np.float32)
comp=np.asarray(Image.open(f'{d}/background-topo.png').convert('RGB')).astype(np.float32)
names=['cake-C-rings','cake-icing','cake-cherry','sky-S-clouds','sky-contrail-airplane']
for nm in names:
    L=np.asarray(Image.open(f'{d}/{nm}.png')).astype(np.float32); al=L[...,3:]/255; comp=L[...,:3]*al+comp*(1-al)
diff=np.abs(comp-a).max(2); lab,n=ndi.label(diff>40); print('regions>40:',n, [ (s[0].start,s[1].start) for s in ndi.find_objects(lab)][:12])
S=420; chk=((np.indices((1024,1024)).sum(0)//32)%2*40+60).astype(np.float32)[...,None].repeat(3,2)
tiles=[Image.fromarray(np.asarray(Image.open(f'{d}/background-topo.png').convert('RGB'))).resize((S,S),Image.LANCZOS)]
for nm in names:
    L=np.asarray(Image.open(f'{d}/{nm}.png')).astype(np.float32); al=L[...,3:]/255
    tiles.append(Image.fromarray((L[...,:3]*al+chk*(1-al)).astype(np.uint8)).resize((S,S),Image.LANCZOS))
sheet=Image.new('RGB',(S*3,S*2))
for i,t in enumerate(tiles): sheet.paste(t,((i%3)*S,(i//3)*S))
sheet.save(out+'/sheet.png'); Image.fromarray(np.clip(diff*4,0,255).astype(np.uint8)).save(out+'/diff.png')
