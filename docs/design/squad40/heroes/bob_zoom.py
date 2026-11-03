# dev helper: chosen frames of one page group at zoom.
#   HERO=bob python3 -m heroes.bob_zoom "<title part>" [scale] [i,j,k] [out name]
import sys
import hero
import build
from comp import step_rows, union_crop
from pose import to_png

sel = sys.argv[1].lower()
scale = int(sys.argv[2]) if len(sys.argv) > 2 else 8
idx = [int(x) for x in sys.argv[3].split(',')] if len(sys.argv) > 3 and sys.argv[3] else None
name = sys.argv[4] if len(sys.argv) > 4 else 'zz'
for g in build.groups():
    if sel in g['title'].lower():
        steps = g['steps'] if idx is None else [g['steps'][i] for i in idx]
        fr = union_crop([step_rows(s) for s in steps])
        to_png(fr, f'out/bob/{name}.png', scale=scale, cols=min(len(fr), 6))
        print(g['title'], len(fr))
        break
