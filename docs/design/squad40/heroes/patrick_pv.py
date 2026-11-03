# dev tool: HERO=patrick python3 -m heroes.patrick_pv out.png lib:name ...   (outlined parts, scale 14)
import sys
import hero
import parts as P
from rig import Canvas
from pose import to_png
fr = []
for spec in sys.argv[2:]:
    lib, name = spec.split(':')
    rows, an = getattr(P, lib)[name]
    w = max(len(r) for r in rows)
    cv = Canvas(w + 4, len(rows) + 4)
    cv.grid(2, 2, rows, 1, 'x')
    fr.append(cv.finish())
H = max(len(f) for f in fr); W = max(len(f[0]) for f in fr)
fr = [[r.ljust(W, '.') for r in f] + ['.' * W] * (H - len(f)) for f in fr]
to_png(fr, sys.argv[1], scale=int(sys.argv[1].split('@')[1].split('.')[0]) if '@' in sys.argv[1] else 14, gap=1)
