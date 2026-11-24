"""Assemble skycake.icon from separated layers.

Usage: build_icon.py <layers_dir> <out.icon> [json-overrides]

Groups (top to bottom):
  Toppings   clouds, icing, cherry, contrail+airplane - float above the letters, cast shadow onto them
  Letters    S (sky) and C (Baumkuchen rings)
  Background corner topo lines over the flat #0c0c0c fill (no glass; hidden in tinted/clear)
"""
import sys, json, os, shutil

layers, out = sys.argv[1], sys.argv[2]
ov = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
shutil.rmtree(out, ignore_errors=True)
os.makedirs(f'{out}/Assets')
for f in os.listdir(layers):
    if f.endswith('.png') and 'preview' not in f:
        shutil.copy(f'{layers}/{f}', f'{out}/Assets/{f}')


def layer(name, glass=True, **kw):
    d = {'image-name': f'{name}.png', 'name': name, 'glass': glass}
    d.update(kw)
    return d


def glass_group(name, layer_list, shadow_kind, shadow, lighting='individual'):
    return {'name': name, 'layers': layer_list,
            'shadow': {'kind': shadow_kind, 'opacity': shadow},
            'translucency': {'enabled': False, 'value': 0.2},
            'specular': True, 'lighting': lighting}


toppings = glass_group('Toppings',
                       [layer('cake-cherry'), layer('sky-contrail-airplane'), layer('cake-icing'), layer('sky-clouds')],
                       ov.get('top_shadow_kind', 'neutral'), ov.get('top_shadow', 1.0), ov.get('top_lighting', 'individual'))
letters = glass_group('Letters', [layer('sky-S-clouds'), layer('cake-C-rings')],
                      'neutral', ov.get('letters_shadow', 0.5), ov.get('letters_lighting', 'combined'))
bg = {'name': 'Background', 'layers': [layer('topo-lines', glass=False)],
      'shadow': {'kind': 'none', 'opacity': 0.5}, 'translucency': {'enabled': False, 'value': 0.5},
      'specular': False, 'lighting': 'combined',
      'hidden-specializations': [{'appearance': 'tinted', 'value': True}]}
doc = {'fill': {'solid': 'srgb:0.04706,0.04706,0.04706,1.00000'},
       'groups': [toppings, letters, bg],
       'supported-platforms': {'squares': 'shared'}}
json.dump(doc, open(f'{out}/icon.json', 'w'), indent=2)
print('wrote', out)
