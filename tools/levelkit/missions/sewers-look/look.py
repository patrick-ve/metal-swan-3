# The review frames of the sewer look sample: per variant, at four cameras, the ambient frame, the lit frame (the
# flashlight's key) and the cone composite (the hero holds the flashlight forward: inside the cone the lit frame,
# outside the ambient one, a dithered soft edge). Writes tmp/sewers/look/<var>-cam<i>-<amb|lit|cone>-u<U>.png.
#   U=4 python3 tools/levelkit/lk.py sewers-look run look v1 [v2 v3]        (all four cameras)
#   U=1 python3 tools/levelkit/lk.py sewers-look run look v1 --cams 1       (one camera, for the tier-1 / tier-2 frames)
import math
import os
import sys
import numpy as np
from level import *
from lkpath import repo_path
import sw_d

OUT = repo_path('tmp/sewers/look')
CAMS = (0, 300, 600, 896)

# The cone (a proposal for the spec): from the hand that holds the gun, forward, 5 degrees down; 20 degrees each side
# of its axis; 210 px long (16 m on the walk plane). Every edge is a soft ordered-dither ramp that follows the beam
# (no hard arc, no box): 6 degrees wide at its sides, the last 35 % of its length fading out; a hot core of 8 degrees
# steps the lit colours a little warmer; two elliptical light pools (on the walkway, and where the beam lands).
CONE = dict(down=5.0, half=20.0, length=210.0, band=6.0, fade=0.35, hot=8.0)


def hand(run_frame):
    """The screen point of the gun's muzzle in the hero frame (drawn at 158, y - 46 by compose_level)."""
    a = run_frame.a[..., 3] > 0
    rows = np.where(a.any(axis=1))[0]
    best = None
    for r in range(rows[0] + int(rows.size * 0.30) * 1, rows[0] + int(rows.size * 0.62)):
        cols = np.where(a[r])[0]
        if cols.size and (best is None or cols[-1] > best[1]):
            best = (r, cols[-1])
    return 158 + (best[1] + 1) / U, 176 - 46 + best[0] / U


def _polar(ox, oy):
    yy, xx = np.mgrid[0:P(VIEW_H), 0:P(VIEW_W)]
    lx, ly = (xx + 0.5) / U, (yy + 0.5) / U
    dx, dy = lx - ox, ly - oy
    return lx, ly, np.hypot(dx, dy), np.abs(np.degrees(np.arctan2(dy, dx)) - CONE['down']), dx


def cone_level(ox, oy, c=CONE):
    """How lit each real pixel is, 0..1: 1 inside, a ramp across the side band and over the last part of the length."""
    lx, ly, r, off, dx = _polar(ox, oy)
    L = c['length']
    side = np.clip((c['half'] + c['band'] / 2 - off) / c['band'], 0, 1)
    end = np.clip((L - r) / (L * c['fade']), 0, 1)
    return lx, ly, r, off, np.where(dx > 0, np.minimum(side, end), 0.0)


def cone_mask(ox, oy, c=CONE):
    """True: lit. The ramp of cone_level as an ordered dither (a light pool: dither allowed)."""
    from parts_sewers import bay
    lx, ly, r, off, lev = cone_level(ox, oy, c)
    m = (lev >= 0.999) | bay(lx, ly, lev)
    hot = (off < c['hot']) & (r < c['length'] * 0.55) & (r > 6) & chk(lx, ly) & (lev > 0.99)
    return m, hot


def pools(ox, oy):
    """Two elliptical light pools, each two steps (inner solid, outer on the checker) and both inside the beam: on the
       walkway in front of the hero, and where the beam's axis lands (the far wall, the water or the fatberg)."""
    lx, ly, r, off, lev = cone_level(ox, oy)
    ck = chk(lx, ly)
    L = CONE['length']
    a = np.radians(CONE['down'])
    ex, ey = ox + 0.72 * L * np.cos(a), oy + 0.72 * L * np.sin(a)                 # where the axis lands
    d1 = ((lx - (ox + 80)) / 62.0) ** 2 + ((ly - 178) / 12.0) ** 2                # on the walkway
    d2 = ((lx - ex) / 30.0) ** 2 + ((ly - ey) / 20.0) ** 2
    d = np.minimum(np.where(ly > 161, d1, 9), d2)
    inner = (d < 0.40) & (lev > 0.5)
    outer = (d < 1.0) & ~inner & (lev > 0.2)
    return [(inner, 0.28), (outer & ck, 0.16)]


def haze(ox, oy):
    from parts_sewers import bay
    lx, ly, r, off, lev = cone_level(ox, oy)
    dens = np.clip(0.16 * (1 - r / CONE['length']), 0, 0.16) * lev
    return bay(lx + 1, ly + 2, dens) & (r > 4)


def frames_for(var, cams, tag=''):
    os.makedirs(OUT, exist_ok=True)
    amb = sw_d.build(var, 'amb')
    lit = sw_d.build(var, 'lit')
    run, idle = hero_frames()
    for i, cx in enumerate(cams):
        hero = run[(i * 3 + 1) % len(run)]
        A = compose_level(amb, cx, 0, hero)
        Lf = compose_level(lit, cx, 0, hero)
        ox, oy = hand(hero)
        m, hot = cone_mask(ox, oy)
        C = Layer(VIEW_W, VIEW_H)
        C.a = A.a.copy()
        C.a[m] = Lf.a[m]
        warm = np.array((255, 236, 200), float)
        hot &= m
        px = C.a[..., :3][hot].astype(float)
        C.a[..., :3][hot] = snap5(px + (warm - px) * 0.22)
        # the light pools where the beam lands: on the walkway in front of the hero and on the far wall / the mass at
        # the end of the beam (two steps toward the warm light, the outer one on the checker)
        for (pm_, a1) in pools(ox, oy):
            pm_ &= m
            px = C.a[..., :3][pm_].astype(float)
            C.a[..., :3][pm_] = snap5(px + (warm - px) * a1)
        # the beam in the air: a faint ordered haze of warm motes, denser near the lamp (dither: air only)
        hz = haze(ox, oy) & m
        C.a[..., :3][hz] = snap5(np.array((200, 184, 150), float))
        k = CAMS.index(cx) if cx in CAMS else i
        for name, im in (('amb', A), ('lit', Lf), ('cone', C)):
            save(im, os.path.join(OUT, '%s-cam%d-%s-u%d.png' % (var, k + 1, name, U)))
        print(var, 'cam', cx, 'hand', round(ox, 1), round(oy, 1), 'colours amb/lit/cone', A.ncolors(), Lf.ncolors(), C.ncolors(),
              flush=True)


if __name__ == '__main__':
    args = sys.argv[1:]
    cams = CAMS
    if '--cams' in args:
        i = args.index('--cams')
        cams = tuple(CAMS[int(c) - 1] for c in args[i + 1].split(','))
        args = args[:i] + args[i + 2:]
    for var in args or ['v1']:
        frames_for(var, cams)
