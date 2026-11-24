#!/bin/zsh
# render.sh <doc.icon> <outdir> <size> [renditions...]
IC="/Applications/Xcode.app/Contents/Applications/Icon Composer.app/Contents/Executables/ictool"
doc=$1; out=$2; sz=$3; shift 3; mkdir -p $out
rs=($@); (( $#rs )) || rs=(Default Dark ClearLight ClearDark TintedLight TintedDark)
for r in $rs; do
  "$IC" "$doc" --export-image --output-file "$out/${r}-${sz}.png" --platform iOS --rendition $r --width $sz --height $sz --scale 1 || echo "FAIL $r $sz"
done
