# Part viewer for THOM: python3 -m heroes.thom_look <lib> [names...]  -> out/thom/look.png
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ['HERO'] = 'thom'
import hero  # noqa: applies the hero
import parts as P
from rig import Canvas
from pose import to_png

lib = getattr(P, sys.argv[1].upper())
names = sys.argv[2:] or list(lib)
frames = []
for n in names:
    rows, an = lib[n]
    w = max(len(r) for r in rows)
    cv = Canvas(w + 4, len(rows) + 4)
    cv.grid(2, 2, rows, 1, 'x')
    fr = cv.finish()
    frames.append(fr)
W = max(len(f[0]) for f in frames); H = max(len(f) for f in frames)
frames = [[r.ljust(W, '.') for r in f] + ['.' * W] * (H - len(f)) for f in frames]
to_png(frames, 'out/thom/look.png', scale=int(os.environ.get('SC', 14)), cols=min(6, len(frames)))
print(names)
