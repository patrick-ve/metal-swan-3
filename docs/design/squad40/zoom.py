# Zoomed key frames: HERO=x python3 zoom.py upper:k:lower ... -> out/<hero>/zoom.png
import sys, hero
from pose import compose, to_png, crop, overlay
import anims as A
fr = []
for spec in sys.argv[1:]:
    u, k, l = spec.split(':'); k = int(k)
    if u in A.FULL:
        fr.append(compose(A.FULL[u][k][0], 'full')[0]); continue
    L = A.LOWER[l]; lp = L[min(k, len(L) - 1)][0]
    up = dict(A.UPPER[u][k][0]); up['pelvis'] = lp['pelvis']
    rows = compose(lp, 'lower')[0]
    br = compose(up, 'back')[0]
    if br: rows = overlay(br, rows)
    fr.append(overlay(rows, compose(up, 'upper')[0]))
to_png(crop(fr, (14, 18, 66, 72)), f'{hero.outdir()}/zoom.png', scale=7, cols=len(fr))
