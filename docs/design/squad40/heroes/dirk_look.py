# DIRK look tool: python3 -m heroes.dirk_look heads|parts|idle   (HERO=dirk)
import sys, os
os.environ['HERO'] = 'dirk'
import hero
import parts as P
from pose import to_png, compose, overlay, crop
import anims as A

what = sys.argv[1] if len(sys.argv) > 1 else 'heads'
od = hero.outdir()
if what == 'heads':
    names = sys.argv[2:] or list(P.HEADS)
    fr = []
    for n in names:
        rows = P.HEADS[n][0]
        from rig import Canvas
        cv = Canvas(18, 18)
        cv.grid(2, 2, rows, 1, 'h')
        fr.append(cv.finish())
    to_png(fr, f'{od}/look_heads.png', scale=12, cols=8)
    to_png(fr, f'{od}/look_heads1.png', scale=3, cols=8)
    print(names)
elif what == 'lib':
    lib = getattr(P, sys.argv[2])
    names = sys.argv[3:] or list(lib)
    fr = []
    for n in names:
        rows = lib[n][0]
        w = max(len(r) for r in rows)
        fr.append([r.ljust(w, '.') for r in rows])
    to_png(fr, f'{od}/look_lib.png', scale=12, cols=8)
    print(names)
elif what == 'pair':
    # pair upper anim u frame i with lower l frame 0, big
    u, l = sys.argv[2], sys.argv[3]
    idx = [int(v) for v in sys.argv[4].split(',')] if len(sys.argv) > 4 else range(len(A.UPPER[u]))
    fr = []
    for i in idx:
        lp = A.LOWER[l][i % len(A.LOWER[l])][0]
        up = dict(A.UPPER[u][i][0]); up['pelvis'] = lp['pelvis']
        fr.append(overlay(compose(lp, 'lower')[0], compose(up, 'upper')[0]))
    to_png(crop(fr, (16, 20, 62, 72)), f'{od}/look_{u}_{l}.png', scale=10, cols=min(6, len(fr)))
