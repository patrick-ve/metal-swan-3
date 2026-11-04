# SCANAUTO: the cabin (boss/ams-scan/cabin) - what sits behind the tinted glass, drawn over the body
# (the glass itself is the body's): the handhaver at the wheel seen in profile through the side
# window (navy cap, the lit face, the yellow vest with its silver band), by frame role, and the
# airbag. Car anchor; masked to the glass of the level body; no outline (it is behind glass).
from . import body as B
from . import geo as G
import art40 as X

# Legend: V cap, v cap shade / peak, L lit skin, l skin shade, N eye / dark, o open mouth, w teeth /
# eye white, Y vest, X vest shade, q the silver band.
CALM = '''
.VVVV....
VVVVVVv..
vvvvvvvv.
.lLLLl...
.lLLNL...
.lLLlL...
.YllYY...
qqqqqqX..
YXYYYYXX.
'''
SHOUT = '''
..VVVV...
.VVVVVVv.
.vvvvvvvv
..lLLvL..
..lLLNL..
..lLLoo..
..YllLo..
.qqqqqqX.
.YXYYYYXX
'''
SHOUT_B = '''
..VVVV...
.VVVVVVvL
.vvvvvvLL
..lLLvLlL
..lLLNL.Y
..lLoo..Y
..YllLoYX
.qqqqqqX.
.YXYYYYXX
'''
SHOCK = '''
VVVV.....
VVVVVvv..
vvvvvv.vv
lLLLwl...
lLLwNL...
lLLoL....
YllYY....
qqqqqX...
XYYYYXX..
'''
BACK = '''
...VVVV..
..vVVVVVV
.vvvvvvvv
...lLLLl.
...LNLLl.
...LlLLl.
YY.YllYY.
YXqqqqqqX
.YXYYYYXX
'''
GOTCHA = '''
..VVVV...
.VVVVVVv.
.vvvvvvvv
..lLLvL..
..lLLNL..
..lLwwL..
..YllLY..
.qqqqqqX.
.YXYYYYXX
'''
POP_DRIVER = '''
VVVV.....
VVVVVv...
vvvvvvv..
lLLLl....
lLLNL....
lLLlL....
YllYY....
qqqqqX...
XYYYYXX..
'''
GLASS = set('ngNG')


def _glass():
    lvl = B.paint(0)
    return {p for p, v in lvl.items() if v[0] in GLASS}


PATCH = (-7, 23)            # the cabin frames carry the front door glass (B-pillar to windscreen)


def _patch(mask):
    """The level body's glass and steering wheel round the officer: every cabin frame starts from it,
    so its edges are glass rows, not cut-off details."""
    r = G.Raster()
    for (x, y), v in B.paint(0).items():
        if PATCH[0] <= x <= PATCH[1] and (G.band_part(x + 0.5, y + 0.5) or (x, y) in _WHEEL):
            r.put(x, y, v[0], -1 if v[0] in GLASS else 2, 'cab')
    # no lone end pixels (the windscreen's top tip, the mirror's root): the body shows them anyway
    for (x, y), v in list(r.items()):
        if not any((x + dx, y + dy) in r and r[(x + dx, y + dy)][0] == v[0]
                   for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy):
            del r[(x, y)]
    return r


_WHEEL = {(G.DRIVER[0] + 8, G.DRIVER[1] + 5 + k) for k in range(3)}


def _driver(grid, mask, dx=0):
    r = _patch(mask)
    rows = [l for l in grid.strip('\n').split('\n')]
    x0, y0 = G.DRIVER
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            P = (x0 + i + dx, y0 + j)
            if ch != '.' and P in mask:
                r.put(P[0], P[1], ch, 0, 'cab')
    return r


def _empty(mask):
    return _patch(mask)


def _bag(r, mask, cx, cy, rad):
    """The airbag: a white cushion lit on its upper front, the seam shaded."""
    import math
    for Y in range(int(cy - rad - 1), int(cy + rad + 2)):
        for Xp in range(int(cx - rad - 1), int(cx + rad + 2)):
            if (Xp, Y) not in mask:
                continue
            dx, dy = Xp + 0.5 - cx, (Y + 0.5 - cy) * 1.15
            d = math.hypot(dx, dy)
            if d > rad:
                continue
            lit = (dx * 0.55 - dy * 0.83) / max(d, 0.01)
            ch = '1' if (lit > 0.25 and d > rad * 0.35) or d < rad * 0.35 else '2' if lit > -0.45 else '3'
            if d > rad - 0.8 and lit < -0.2:
                ch = '3'
            r.put(Xp, Y, ch, 1, 'cab')


def frames():
    """By role: 0 calm, 1 shout, 2 shock, 3 airbag, 4 empty, 5 shout (fist), 6 looking back (the
    reverse), 7 the airbag popping, 8 gotcha (SCAN LOCK)."""
    m = _glass()
    out = []
    for grid, dx in ((CALM, 0), (SHOUT, 0), (SHOCK, -1)):
        out.append(_driver(grid, m, dx))
    bag = _driver(POP_DRIVER, m, -2)
    _bag(bag, m, 4.5, -22.5, 4.6)
    out.append(bag)
    out.append(_empty(m))
    out.append(_driver(SHOUT_B, m, 0))
    out.append(_driver(BACK, m, -1))
    pop = _driver(POP_DRIVER, m, -1)
    _bag(pop, m, 6.0, -22.0, 2.6)
    out.append(pop)
    out.append(_driver(GOTCHA, m, 1))
    res = []
    for r in out:
        _despeckle(r)
        if not r:
            res.append(X.Frame(['.'], (0, 1)))
        else:
            res.append(G.frame(r, outline=False))
    return res


def bag_only():
    """The sagging airbag alone (the wreck: the officer is hidden behind it)."""
    r = G.Raster()
    _bag(r, _glass(), 3.5, -23.0, 4.8)
    return r


def _despeckle(r):
    """An edge pixel (a transparent 4-neighbour) with no 8-neighbour of its own letter takes the
    letter most of its neighbours share (a cut-off detail of the officer at the band's edge)."""
    for _ in range(2):
        for (x, y), (ch, z, part) in sorted(r.items()):
            n4 = [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
            if all(p in r for p in n4):
                continue
            n8 = [r[(x + dx, y + dy)][0] for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                  if (dx or dy) and (x + dx, y + dy) in r]
            if ch in n8:
                continue
            if not n8:
                del r[(x, y)]
                continue
            r[(x, y)] = (max(sorted(set(n8)), key=n8.count), z, part)


ROLES = dict(CAB_CALM=0, CAB_SHOUT=1, CAB_SHOCK=2, CAB_AIRBAG=3, CAB_EMPTY=4, CAB_SHOUT_B=5, CAB_BACK=6,
             CAB_AIRBAG_POP=7, CAB_GOTCHA=8)
