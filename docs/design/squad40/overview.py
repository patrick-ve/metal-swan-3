# One overview sheet per hero: idle, fidget, run, jump, shoots, grenade, melee, death (key frames).
#   HERO=dirk python3 overview.py   -> out/<hero>/overview.png
import hero
from pose import compose, to_png, crop, overlay
import anims as A
PICK = [('idle', 'stand', [0]), ('fidget', 'stand', 'all'), ('run', 'run', [0, 2, 4, 6, 8, 10]), ('jump', 'jump', [1, 3]),
        ('shoot', 'stand', [0, 3]), ('shootup', 'stand', [0]), ('shootdown', 'jump', [0]), ('crouchshoot', 'crouch', [0]),
        ('crouchidle', 'crawl', [0, 3]), ('grenade', 'stand', 'all'), ('slash', 'stand', 'all'), ('stab', 'stand', 'all')]
frames = []
for u, l, ks in PICK:
    U, L = A.UPPER[u], A.LOWER[l]
    ks = range(len(U)) if ks == 'all' else ks
    for k in ks:
        lp = L[min(k, len(L) - 1)][0]
        up = dict(U[k % len(U)][0]); up['pelvis'] = lp['pelvis']
        rows = compose(lp, 'lower')[0]
        br = compose(up, 'back')[0]
        if br:
            rows = overlay(br, rows)
        rows = overlay(rows, compose(up, 'upper')[0])
        frames.append(rows)
frames += [compose(p, 'full')[0] for p, t in A.FULL['death']][::2]
to_png(crop(frames, (4, 10, 76, 74)), f'{hero.outdir()}/overview.png', scale=3, cols=12)
print(len(frames))
