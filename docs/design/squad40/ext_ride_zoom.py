# dev: zoom chosen steps of a group -> out/ride/z.png   usage: python3 ext_ride_zoom.py "title" 0,4 [scale]
import sys
import hero, build
from comp import step_rows, union_crop
from pose import to_png
t, idx = sys.argv[1], [int(i) for i in sys.argv[2].split(',')]
sc = int(sys.argv[3]) if len(sys.argv) > 3 else 10
g = [g for g in build.groups() if t.lower() in g['title'].lower()][0]
fr = union_crop([step_rows(g['steps'][i]) for i in idx])
to_png(fr, f'{hero.outdir()}/ride_z.png' if hero.NAME != 'vincent' else 'out/ride/z.png', scale=sc, cols=len(idx))
