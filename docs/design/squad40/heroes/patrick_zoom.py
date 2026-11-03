# dev tool: HERO=patrick python3 -m heroes.patrick_zoom out.png scale box u:i:l:j ...
import sys
import hero
from pose import compose, to_png, crop, overlay
import anims as A
out, scale, box = sys.argv[1], int(sys.argv[2]), tuple(int(v) for v in sys.argv[3].split(','))
fr = []
for spec in sys.argv[4:]:
    u, i, l, j = spec.split(':')
    if u in A.FULL:
        fr.append(compose(A.FULL[u][int(i)][0], 'full')[0]); continue
    lp = A.LOWER[l][int(j)][0]
    up = dict(A.UPPER[u][int(i)][0]); up['pelvis'] = lp['pelvis']
    fr.append(overlay(compose(lp, 'lower')[0], compose(up, 'upper')[0]))
to_png(crop(fr, box), out, scale=scale, gap=1)
