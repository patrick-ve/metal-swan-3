# preview: python3 prev.py <upper> <lower> [out] [scale]   (pairs frame i with frame i % len)
import sys
import hero
from pose import compose, to_png, crop, overlay
import anims as A
u, l = sys.argv[1], sys.argv[2]
out = sys.argv[3] if len(sys.argv) > 3 else f'{hero.outdir()}/{u}_{l}.png'
scale = int(sys.argv[4]) if len(sys.argv) > 4 else 6
box = tuple(int(v) for v in sys.argv[5].split(',')) if len(sys.argv) > 5 else (10, 20, 66, 72)
U = A.UPPER.get(u) or []
L = A.LOWER.get(l) or []
n = max(len(U), len(L))
frames = []
for i in range(n):
    lp = L[i % len(L)][0] if L else None
    if U:
        up = dict(U[i % len(U)][0]); up['pelvis'] = lp['pelvis'] if lp else (0, -17)
        ur, _ = compose(up, 'upper')
        br, _ = compose(up, 'back')
    if lp:
        lr, _ = compose(lp, 'lower')
    fr = overlay(lr, ur) if (U and L) else (ur if U else lr)
    if U and br:
        fr = overlay(br, fr)
    frames.append(fr)
frames = crop(frames, box)
to_png(frames, out, scale=scale, cols=min(n, 6))
print(out, n)
