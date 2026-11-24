# skycake app icon — Liquid Glass (Icon Composer 27.2)

Built from `app/icon.png` (`ui/flat-metro` @ c3c9d2c), the primary Baumkuchen `sc` monogram.

## Contents
- `skycake.icon/`: Icon Composer bundle. Open it in Icon Composer, or drop it into an Xcode target. `actool` compiles it with no warnings.
- `export/png/skycake-liquidglass-{1024,512,192,180}.png`: Default-appearance renders.
- `export/appearances/`: Default, Dark, ClearLight, ClearDark, TintedLight and TintedDark at 1024/512/192/180/60.
- `export/skycake-review.png`: review sheet comparing v2 and v3, with every appearance.
- `layers/`: the separated source layers (transparent PNGs, 1024²).
- `tools/`: scripts that rebuild everything (Python with Pillow, numpy, scipy and scikit-image, plus `ictool`).

## Layer stack (top to bottom)
| Group | Layers | Glass |
|---|---|---|
| Toppings | cherry, contrail + airplane, icing, clouds | on, specular, neutral shadow 1.0, individual lighting |
| Letters | S (sky blue), C (Baumkuchen rings) | on, specular, neutral shadow 0.5, translucency off |
| Background | topo-lines over a flat `#0c0c0c` fill | off; hidden in tinted/clear |

- Toppings sit in their own group, so they cast shadows onto the letters.
- The contrail and airplane are pure white. Where they cross the S, their edges are unmixed against the sky blue, and the S underneath is filled with that blue, so the contrail shows no blue fringing.
- The source's blocky compression grain has been replaced with a flat `#0c0c0c` fill. The topo lines are re-stroked from their centrelines at about 4px, twice the original width, at the original brightness.

## Known issue
The fine Baumkuchen rings are at the pixel limit at 180px (some neighbouring rings merge) and can't be seen at 60px. This comes from how dense the rings are, not from the glass. The bolder-ring backup (option 2) would fix it: run `tools/separate.py` on that PNG, then `tools/build_icon.py`.

## Rebuild
```sh
python3 tools/separate.py <icon.png> layers 1        # last arg = extra topo half-width in px
python3 tools/build_icon.py layers skycake.icon
tools/render.sh skycake.icon export/appearances 1024
```
