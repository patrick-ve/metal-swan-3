# dev tool: render candidate grids (outlined) from a python file of lists: python3 -m heroes.patrick_try spec.py out.png
import sys, os
os.environ.setdefault('HERO', 'patrick')
import hero
from rig import Canvas
from pose import to_png
ns = {}
exec(open(sys.argv[1]).read(), ns)
fr = []
for rows in ns['V']:
    w = max(len(r) for r in rows)
    assert all(len(r) == w for r in rows), rows
    cv = Canvas(w + 4, len(rows) + 4)
    cv.grid(2, 2, rows, 1, 'x')
    fr.append(cv.finish())
H = max(len(f) for f in fr); W = max(len(f[0]) for f in fr)
fr = [[r.ljust(W, '.') for r in f] + ['.' * W] * (H - len(f)) for f in fr]
to_png(fr, sys.argv[2], scale=int(sys.argv[3]) if len(sys.argv) > 3 else 14, gap=1)
to_png(fr, sys.argv[2].replace('.png', '_1x.png'), scale=3, gap=2)
