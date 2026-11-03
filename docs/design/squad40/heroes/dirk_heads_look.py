# DIRK look tool: all heads (core, new, balloon) at zoom.  HERO=dirk python3 -m heroes.dirk_heads_look [names]
import sys, os
os.environ['HERO'] = 'dirk'
import hero
import parts as P
from rig import Canvas
from pose import to_png

names = sys.argv[1:] or [k for k in P.HEADS]
fr = []
for n in names:
    rows = P.HEADS[n][0]
    w = max(len(r) for r in rows)
    cv = Canvas(40, 44)
    cv.grid(2, 2, rows, 1, 'h')
    fr.append(cv.finish())
to_png(fr, f'{hero.outdir()}/look_allheads.png', scale=6, cols=8)
to_png(fr, f'{hero.outdir()}/look_allheads1.png', scale=2, cols=8)
print(names)
