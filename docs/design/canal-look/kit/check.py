# The gates of the canal look, as a script. It builds scenes at the art tier U (env) and prints PASS or FAIL
# for each gate. Usage:  U=4 python3 check.py scene2 scene4      (no names: the four reference scenes)
# A scene module may define checks(sc) -> [(name, ok, value)] for the rules of its own place.
import importlib
import sys
import numpy as np
from build import *

ON = np.zeros(256, bool)
ON[[(q << 3) | (q >> 2) for q in range(32)]] = True          # the 5-bit colour grid


def keyhue(rgb):
    r, g, b = [rgb[..., i].astype(float) / 255 for i in range(3)]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); d = mx - mn
    dd = np.where(d > 1e-6, d, 1)
    h = np.where(mx == r, ((g - b) / dd) % 6, np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4)) * 60
    s = np.where(mx > 0, d / np.where(mx > 0, mx, 1), 0)
    hist, _ = np.histogram(h[s > 0.12], bins=36, range=(0, 360), weights=s[s > 0.12])
    top = int(np.argmax(hist))
    return top * 10, float(sum(hist[(top + k) % 36] for k in (-2, -1, 0, 1, 2)) / max(hist.sum(), 1))


def plane(layer):
    px = layer.a[..., :3][layer.a[..., 3] > 0].astype(float)
    lum = (0.299 * px[:, 0] + 0.587 * px[:, 1] + 0.114 * px[:, 2]) / 255
    return float(np.percentile(lum, 5)), float(np.percentile(lum, 95))


def check(mod):
    sc = mod.build()
    L = {l['id']: l for l in sc.layers}
    res = []
    fr = compose(sc, 288, 0, None)
    hue, share = keyhue(fr.a[..., :3])
    res.append(('colours in a frame <= 560', fr.ncolors() <= 560, fr.ncolors()))
    res.append(('key hue share >= 0.45', share >= 0.45, '%.2f at %d deg' % (share, hue)))
    (s0, s1), (f0, f1), (n0, n1) = [plane(L[k]['img']) for k in ('skyline', 'far', 'near')]
    res.append(('darkest tone: skyline > far >= near', s0 > f0 and f0 >= n0 - 0.011, '%.2f / %.2f / %.2f' % (s0, f0, n0)))
    res.append(('light range: skyline < far', s1 - s0 < f1 - f0, '%.2f / %.2f' % (s1 - s0, f1 - f0)))
    worst, who = 1.0, ''
    for l in sc.layers:
        ims = ([l['img']] if l.get('img') is not None else []) + list(l.get('frames') or [])
        ims += list((l.get('v3') or {}).get('imgs', {}).values())
        for im in ims:
            m = im.a[..., 3] > 0
            if m.any():
                v = float((ON[im.a[..., 0]] & ON[im.a[..., 1]] & ON[im.a[..., 2]] & m).sum() / m.sum())
                if v < worst:
                    worst, who = v, l['id']
    res.append(('every pixel of every layer on the 5-bit grid', worst == 1.0, '%.4f%s' % (worst, ' (%s)' % who if who else '')))
    if 'water' in L:                                                  # a scene without water has no water line
        F = L['far']['img']
        row = F.a[P(L['water']['y']) - 1, :, 3] > 0                   # the last row above the water line
        need = np.ones(F.pw, bool)
        if 'vista' in L:                                              # the water of a side canal is open
            v = L['vista']['v3']['v']
            xs = np.arange(F.pw) / U
            need &= ~((xs >= v['u0'] + v['qw'] - 6) & (xs <= v['u1'] - v['qw'] + 6))
        res.append(('no hole in the far side at the water line', int((need & ~row).sum()) == 0, int((need & ~row).sum())))
    N = L['near']['img']
    res.append(('walk line at y 198 with ground under it', sc.walk == 198 and bool((N.a[P(sc.walk), :, 3] > 0).all()), sc.walk))
    rows = np.where(L['fg']['img'].a[..., 3].any(axis=1))[0]
    res.append(('front things stay below y 176', len(rows) > 0 and rows[0] / U >= 176, rows[0] / U if len(rows) else None))
    if hasattr(mod, 'checks'):
        res += mod.checks(sc)
    return sc, res


if __name__ == '__main__':
    names = sys.argv[1:] or ['scene1', 'scene2', 'scene3', 'scene4']
    bad = 0
    for name in names:
        sc, res = check(importlib.import_module(name))
        print('%s  %s, %s  (tier %d)' % (name, sc.name, sc.hour, U))
        for (what, ok, val) in res:
            bad += not ok
            print('  %s  %-52s %s' % ('PASS' if ok else 'FAIL', what, val))
    print('ALL GATES PASS' if not bad else '%d GATE(S) FAIL' % bad)
    sys.exit(1 if bad else 0)
