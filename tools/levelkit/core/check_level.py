# The gates of the canal look for the sections of a mission (long sections on the game's floor camera).
# Usage:  U=4 python3 tools/levelkit/lk.py <mission> check l1a l1b    (no names: the mission's SECTIONS)
# A section module may define checks(sec) -> [(name, ok, value)] for the rules of its own place.
# The key hue share each hour needs comes from the mission (mission.py KEY_SHARE; default 0.45).
import glob
import importlib
import os
import sys
import numpy as np
from level import *
from check import ON, keyhue
from lkpath import load_module

import mission as _M
KEY_SHARE = getattr(_M, 'KEY_SHARE', {})


def lum_range(a):
    px = a[..., :3][a[..., 3] > 0].astype(float)
    if len(px) == 0:
        return 1.0, 1.0
    lum = (0.299 * px[:, 0] + 0.587 * px[:, 1] + 0.114 * px[:, 2]) / 255
    return float(np.percentile(lum, 5)), float(np.percentile(lum, 95))


def walk_layer(sec):
    """The walk-plane layer (depth 0, speed 1), or None."""
    for l in sec.layers:
        if l.get('depth') == 0 and not l.get('front'):
            return l['img']
    return None


def check(mod):
    sec = mod.build()
    Ls = {l['id']: l for l in sec.layers}
    res = []
    cams = [0, sec.cam // 4, sec.cam // 2, 3 * sec.cam // 4, sec.cam]
    worst_c, worst_s = 0, 1.0
    for cx in cams:
        fr = compose_level(sec, cx)
        nc = fr.ncolors()
        hue, share = keyhue(fr.a[..., :3])
        worst_c = max(worst_c, nc); worst_s = min(worst_s, share)
    res.append(('colours in a frame <= 560 (5 cameras, worst)', worst_c <= 560, worst_c))
    need = KEY_SHARE.get(sec.hour, 0.45)
    res.append(('key hue share >= %.2f (5 cameras, worst)' % need, worst_s >= need, '%.2f' % worst_s))
    # depth: the far planes take the air, the darkest tones are near
    have = [k for k in ('skyline', 'far') if k in Ls]
    if len(have) == 2:
        (s0, s1), (f0, f1) = lum_range(Ls['skyline']['img'].a), lum_range(Ls['far']['img'].a)
        near = [l for l in sec.layers if l.get('depth') is not None and l['depth'] <= 0]
        n0 = min([lum_range(l['img'].a)[0] for l in near] + [1.0])
        res.append(('darkest tone: skyline > far >= near', s0 > f0 and f0 >= n0 - 0.011, '%.2f / %.2f / %.2f' % (s0, f0, n0)))
        res.append(('light range: skyline < far', s1 - s0 < f1 - f0, '%.2f / %.2f' % (s1 - s0, f1 - f0)))
    # the colour grid
    worst, who = 1.0, ''
    for l in sec.layers:
        ims = ([l['img']] if l.get('img') is not None else []) + list(l.get('frames') or [])
        for im in ims:
            m = im.a[..., 3] > 0
            if m.any():
                v = float((ON[im.a[..., 0]] & ON[im.a[..., 1]] & ON[im.a[..., 2]] & m).sum() / m.sum())
                if v < worst:
                    worst, who = v, l['id']
    res.append(('every pixel of every layer on the 5-bit grid', worst == 1.0, '%.4f%s' % (worst, ' (%s)' % who if who else '')))
    # the layout of the game: each platform has art under its line in the walk plane; each hill (bridge) too
    N = walk_layer(sec)
    t = sec.L['terrain']
    if N is None:
        res.append(('a walk-plane layer (depth 0) exists', False, None))
    else:
        bad = []
        for g in t['platforms']:
            pts = [(p['x'], p['y']) if isinstance(p, dict) else tuple(p) for p in g]
            xs = np.arange(int(pts[0][0]) + 2, int(pts[-1][0]) - 2)
            if len(xs) == 0:
                continue
            ys = np.interp(xs, [p[0] for p in pts], [p[1] for p in pts])
            hit = 0
            for x, y in zip(xs, ys):
                col = N.a[P(y - 1):P(y + 4), min(N.pw - 1, P(x)), 3] if 0 <= P(x) < N.pw else np.zeros(1)
                hit += bool((col > 0).any())
            if hit < 0.85 * len(xs):
                bad.append('%d,%d' % (pts[0][0], pts[0][1]))
        res.append(('every platform has art at its line (walk plane)', not bad, ', '.join(bad) or len(t['platforms'])))
        bad = []
        for g in t['ground']:
            pts = [(p['x'], p['y']) if isinstance(p, dict) else tuple(p) for p in g]
            for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
                if min(y0, y1) < 174 and x1 > x0:
                    for x in np.arange(x0 + 1, x1 - 1, 2):
                        y = np.interp(x, [x0, x1], [y0, y1])
                        col = N.a[P(y - 1):P(y + 4), min(N.pw - 1, P(x)), 3]
                        if not (col > 0).any():
                            bad.append(int(x))
        res.append(('every raised ground (bridge, ramp) has a deck at its line', not bad, ('x ' + str(bad[:6])) if bad else 'ok'))
    # every layer has a sane width for its speed
    short = [l['id'] for l in sec.layers if l['kind'] in ('img',) and l['speed'] > 0 and l['img'].w < sec.lw(l['speed']) - 2]
    res.append(('every layer covers the camera travel', not short, ', '.join(short) or 'ok'))
    import street
    res += street.checks(sec)
    if hasattr(mod, 'checks'):
        res += mod.checks(sec)
    return sec, res


if __name__ == '__main__':
    names = sys.argv[1:] or list(_M.SECTIONS)
    bad = 0
    for name in names:
        sec, res = check(load_module(name))
        print('%s  %s, %s  (tier %d)' % (name, sec.name, sec.hour, U))
        for (what, ok, val) in res:
            bad += not ok
            print('  %s  %-58s %s' % ('PASS' if ok else 'FAIL', what, val))
    print('ALL GATES PASS' if not bad else '%d GATE(S) FAIL' % bad)
    sys.exit(1 if bad else 0)
