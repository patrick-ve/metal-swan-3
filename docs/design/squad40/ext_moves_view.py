# Zoom viewer for ext_moves (writes only out/moves/): FULL keys, heads, stage sprites.
#   EXT_ONLY=moves python3 ext_moves_view.py full flip [scale]
#   EXT_ONLY=moves python3 ext_moves_view.py heads [scale]
#   EXT_ONLY=moves python3 ext_moves_view.py stage chute_fold [scale]
import os, sys
import hero
import anims as A
import parts as P
from pose import compose, to_png
from comp import union_crop

os.makedirs('out/moves', exist_ok=True)
what = sys.argv[1]
if what == 'full':
    key = sys.argv[2]
    sc = int(sys.argv[3]) if len(sys.argv) > 3 else 8
    fr = union_crop([compose(p, 'full')[0] for p, t in A.FULL[key]])
    to_png(fr, f'out/moves/{hero.NAME}_{key}.png', scale=sc, cols=min(8, len(fr)))
elif what == 'heads':
    sc = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    names = ['fwd', 'happy', 'yawn', 'sleep', 'bored', 'soot', 'sootblink']
    from pose import head_part, Ctx
    X = Ctx(1)
    rows = [head_part(X, n)[0] for n in names]
    h = max(len(r) for r in rows); w = max(len(r[0]) for r in rows)
    fr = [[r.ljust(w, '.') for r in (['.' * w] * (h - len(x)) + x)] for x in rows]
    to_png(fr, f'out/moves/{hero.NAME}_heads.png', scale=sc)
elif what == 'stage':
    key = sys.argv[2]
    sc = int(sys.argv[3]) if len(sys.argv) > 3 else 6
    fr = union_crop([r for r, an in P.STAGE[key]])
    to_png(fr, f'out/moves/stage_{key}.png', scale=sc, cols=min(6, len(fr)))
print('ok')
