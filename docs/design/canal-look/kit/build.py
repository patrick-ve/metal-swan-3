# Shared scene machinery: layer list, parallax compose (the same maths as the page), shade and light passes.
# Positions are logical pixels; the arrays hold real pixels (tier U, see kit.py).
import math
import random
import numpy as np
from PIL import Image
from kit import *
from parts import *
from parts2 import *
from parts3 import *
from parts4 import *

WORLD = 960                      # width of the walk plane
CAM = WORLD - VIEW_W             # camera travel


def lw(speed):
    """Logical width a layer needs at a parallax speed."""
    return int(math.ceil(VIEW_W + CAM * speed)) + 1


class Scene:
    def __init__(s, key, name, hour):
        s.key, s.name, s.hour = key, name, hour
        s.layers = []            # dicts: id, kind ('img' | 'tile' | 'rows' | 'frames'), speed, y, img | frames, drift, s0, s1
        s.walk = 198
        s.notes = {}

    def add(s, id_, img, speed, y=0, kind='img', **kw):
        d = dict(id=id_, img=img, speed=speed, y=y, kind=kind)
        d.update(kw)
        ims = ([img] if img is not None else []) + list(d.get('frames') or []) + list((d.get('v3') or {}).get('imgs', {}).values())
        if d.get('refl') is not None:
            ims.append(d['refl'])
        for im in ims:                                   # the rule of the look: every colour sits on the 5-bit grid
            im.a[..., :3] = snap5(im.a[..., :3])
        s.layers.append(d)
        return d


def compose(sc, cx, frame=0, hero=None, t=0):
    out = Layer(VIEW_W, VIEW_H)
    VW = out.pw
    for ly in sc.layers:
        if ly['id'] == 'fg' and hero is not None:
            hx_, hy_ = 150, sc.walk
            xx, yy = grid(hx_ - 13, hy_ - 4, 27, 6)
            m = (((xx - hx_) / 12.5) ** 2 + ((yy - (hy_ - 1)) / 2.6) ** 2 <= 1) & chk(xx, yy)
            out.put(hx_ - 13, hy_ - 4, np.broadcast_to(np.array(sc.notes.get('shadow', (40, 44, 66)), np.uint8), xx.shape + (3,)), m)
            out.blit(hero, hx_ - 18, hy_ - 46)
        if ly['kind'] == 'img':
            ox = int(cx * ly['speed'] * U)
            im = ly['img']
            out.put(0, ly['y'], im.a[:, ox:ox + VW, :3], im.a[:, ox:ox + VW, 3] > 0)
        elif ly['kind'] == 'vista':                    # the page draws this in perspective; the preview shows the flat copy
            im = ly['refl']
            ox = int(cx * ly['speed'] * U)
            out.put(0, 0, im.a[:, ox:ox + VW, :3], im.a[:, ox:ox + VW, 3] > 0)
        elif ly['kind'] == 'tile':
            im = ly['img']
            ox = int((cx * ly['speed'] + t * ly.get('drift', 0)) * U) % im.pw
            a = np.concatenate([im.a[:, ox:], im.a[:, :ox]], 1)[:, :VW]
            out.put(0, ly['y'], a[..., :3], a[..., 3] > 0)
        elif ly['kind'] == 'frames':
            im = ly['frames'][frame % len(ly['frames'])]
            ox = int(cx * ly['speed'] * U)
            out.put(0, ly['y'], im.a[:, ox:ox + VW, :3], im.a[:, ox:ox + VW, 3] > 0)
        elif ly['kind'] == 'rows':
            im = ly['frames'][frame % len(ly['frames'])]
            n = im.ph
            y0 = PX(ly['y'])
            for j in range(n):
                sp = ly['s0'] + (ly['s1'] - ly['s0']) * j / max(n - 1, 1)
                ox = int(cx * sp * U)
                seg = im.a[j, ox:ox + VW]
                m = seg[:, 3] > 0
                out.a[y0 + j, :, :3][m] = seg[:, :3][m]
                out.a[y0 + j, :, 3] = 255
    return out


def shade(L, mask, mul=(0.70, 0.72, 0.84)):
    """Cast shade: darken and cool the masked pixels (a discrete recolour, no blending)."""
    m = mask & L.mask()
    if not m.any():
        return
    px = L.a[..., :3][m].astype(float) * np.array(mul)
    L.a[..., :3][m] = snap5(px)


class Props:
    """Things that stand on the walk plane. They cast their shade on the ground before they are drawn."""
    def __init__(s):
        s.items = []

    def add(s, layer, x, y, base=None, cast=True):
        s.items.append((layer, x, y, y + layer.h if base is None else base, cast))

    def shadows(s, N, y_top, kx=0.30, ky=0.16, mul=(0.66, 0.70, 0.86)):
        m = np.zeros((N.ph, N.pw), bool)
        for (ly, x, y, base, cast) in s.items:
            if not cast:
                continue
            ys, xs = np.nonzero(ly.mask())
            bp = PX(base)
            hgt = bp - (PX(y) + ys)
            sx = np.rint(PX(x) + xs + hgt * kx).astype(int); sy = np.rint(bp - 1 + hgt * ky).astype(int)
            ok = (sx >= 0) & (sx < N.pw) & (sy >= PX(y_top)) & (sy < N.ph) & (hgt >= 0)
            m[sy[ok], sx[ok]] = True
        shade(N, m, mul)
        return m

    def draw(s, N):
        for (ly, x, y, base, cast) in s.items:
            N.blit(ly, x, y)


def flatten(layers, w, h):
    """Opaque RGB (real pixels) of some layers stacked (for the mirror in the water). Items: (layer, mode[, y])."""
    W, H = PX(w), PX(h)
    out = np.zeros((H, W, 3), np.uint8)
    for it in layers:
        im, mode = it[0], it[1]
        y = PX(it[2]) if len(it) > 2 else 0
        if mode == 'stretch':                         # a slower layer: sample it across its own width
            idx = (np.arange(W) * (im.pw / W)).astype(int)
        elif mode == 'tilex':
            idx = np.arange(W) % im.pw
        else:
            idx = np.minimum(np.arange(W), im.pw - 1)
        src = im.a[:, idx]
        if mode == 'copy' and im.pw < W:
            src[:, im.pw:] = 0
        a = np.zeros((H, W, 4), np.uint8)
        hh = min(H - y, im.ph)
        if hh > 0:
            a[y:y + hh] = src[:hh]
        m = a[..., 3] > 0
        out[m] = a[..., :3][m]
    return out


def glow(L, x, y, rad, pal, seed=1, squash=1.0):
    """A dithered halo around a light: rings of the given colours (inner -> outer), thinned by the checker."""
    xx, yy = grid(x - rad, y - rad, 2 * rad + 1, 2 * rad + 1)
    if xx.size == 0:
        return
    n = len(pal)
    d = np.hypot(xx - x, (yy - y) / squash) / rad
    k = np.floor(d * n).astype(int)
    fr = d * n - k
    odd = ~chk(xx, yy)
    k = k + ((fr > 0.5) & odd)
    on = d < 1
    over = k >= n
    on &= ~over | (~odd & (fr < 0.5))
    k = np.minimum(k, n - 1)
    on &= ~((k >= n - 1) & odd)
    L.put(x - rad, y - rad, np.array(pal, np.uint8)[k], on)


def hero_frames():
    """Vincent, as the game has him (40 px). For the previews only, his pixels are repeated to the tier."""
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    run = np.asarray(Image.open(os.path.join(here, 'vin', 'run.png')).convert('RGBA'))
    idle = np.asarray(Image.open(os.path.join(here, 'vin', 'idle.png')).convert('RGBA'))

    def cut(a, n):
        out = []
        for i in range(n):
            L = Layer(48, 48)
            L.a = np.repeat(np.repeat(a[:, i * 48:(i + 1) * 48], U, 0), U, 1).copy()
            out.append(L)
        return out
    return cut(run, 12), cut(idle, 4)
