# SCANAUTO: the wreck (boss/ams-scan/wreck, deferred) - the dead car (body-2, the sagging airbag in
# the glass, the bent rack, the wheels) tumbling backwards onto its roof. Square canvas round the
# turn centre (local (0, WRECK_MID)); anchor = the car anchor. Per facing (the right-facing frames
# first, then the left-facing ones, never flipped by the game: the print marks are set unmirrored):
#   0..4  the roll at 30, 60, 90, 120, 150 degrees (the front lifts first)
#   5     the impact: on its roof, the roof caved in 3 rows, the wheels jolted
#   6     at rest: the roof caved in 2 rows (it springs back 1), on the floor
import math

import castkit as K
import rig

from . import body as B
from . import cabin as C
from . import geo as G
from . import scanner as S
from . import small as T
from . import wheel as Wh

MID = -14
SIZE = 100
ROLLS = [30, 60, 90, 120, 150]
PER_FACING = len(ROLLS) + 2
ROLES = dict(WRECK_ROLLS=len(ROLLS), WRECK_IMPACT=len(ROLLS), WRECK_REST=len(ROLLS) + 1, WRECK_FACING=PER_FACING)


def _text_marks(left):
    """The print marks at their spots: {(X, Y): letter} (never mirrored)."""
    out = {}
    fr = T.text_frames()
    for i in (0, 1):
        f = fr[(0, 3)[i] if left else i]
        tx, ty = G.TEXT[i]
        if left:
            tx = -tx
        for j, row in enumerate(f.rows):
            for k, ch in enumerate(row):
                if ch != '.':
                    out[(tx + k - int(f.root[0]), ty + j - int(f.root[1]))] = ch
    return out


def car(left=False, crush=0):
    r = B.paint(2)
    # the airbag (sagging) over the glass
    for (x, y), v in C.bag_only().items():
        r.put(x, y, v[0] if v[0] != '1' else '2', 0.5, 'body')
    rk = S.gone()
    for (x, y), v in rk.items():
        r.put(x, y, v[0], -1, 'body')
    for wx in G.WHEEL_PX:
        for (x, y), v in Wh.wheel(1).items():
            r.put(x + wx, y + G.WHEEL_PY, v[0], 1, 'body')
    if crush:
        # the roof caves in: rows of the glass band go, the roof drops onto what is left
        out = G.Raster()
        for (x, y), v in r.items():
            band = x < 22 and -27 <= y < -27 + crush
            if band:
                continue
            out[(x, y + crush if (y < -27 and x < 22) else y)] = v
        r = out
    if left:
        r = G.Raster({(-x, y): v for (x, y), v in r.items()})
    for (x, y), ch in _text_marks(left).items():
        if (x, y) in r:
            r.put(x, y, ch, 2, 'body')
    return r


def _grid(r):
    """The raster on the square canvas (local (0, MID) at the canvas centre), letters only."""
    c = SIZE // 2
    g = [['.'] * SIZE for _ in range(SIZE)]
    for (x, y), (ch, z, part) in r.items():
        X, Y = x + c, y - MID + c
        if 0 <= X < SIZE and 0 <= Y < SIZE:
            g[Y][X] = ch
    return [''.join(row) for row in g]


def _outline(rows):
    out = [list(r) for r in rows]
    h, w = len(rows), len(rows[0])
    for y in range(h):
        for x in range(w):
            if rows[y][x] == '.' and any(0 <= x + dx < w and 0 <= y + dy < h and rows[y + dy][x + dx] != '.'
                                         for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out[y][x] = 'K'
    return [''.join(r) for r in out]


def _root():
    c = SIZE // 2
    return (c, c - MID)


def _settle(rows):
    """Move the picture down so its lowest pixel row sits just above the anchor row (on the floor)."""
    ys = [y for y, r in enumerate(rows) if r.strip('.')]
    root = _root()
    dy = (root[1] - 1) - max(ys)
    if dy == 0:
        return rows
    blank = '.' * SIZE
    if dy > 0:
        return [blank] * dy + rows[:-dy]
    return rows[-dy:] + [blank] * (-dy)


def frames(left):
    sgn = -1 if left else 1
    out = []
    base = _grid(car(left))
    piv = (SIZE / 2 - 0.5, SIZE / 2 - 0.5)
    for deg in ROLLS:
        rows = rig.rotsprite(base, piv, sgn * deg)
        if deg == 90:
            rows = _rot90(base, sgn)
        out.append(_outline(_specks(_clean(rows))))
    for crush in (3, 2):
        g = _grid(car(left, crush))
        flipped = [r[::-1] for r in g[::-1]]
        out.append(_settle(_outline(flipped)))
    return out


def _rot90(rows, sgn):
    """An exact quarter turn about (49.5, 49.5): counter-clockwise on screen for sgn = +1."""
    n = SIZE
    g = [['.'] * n for _ in range(n)]
    for y in range(n):
        for x in range(n):
            if sgn > 0:
                sx, sy = n - 1 - y, x
            else:
                sx, sy = y, n - 1 - x
            g[y][x] = rows[sy][sx]
    return [''.join(r) for r in g]


def _clean(rows):
    """Lone pixels the turn leaves: a pixel whose 4 neighbours share one other letter takes it."""
    g = [list(r) for r in rows]
    h, w = len(rows), len(rows[0])
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            me = rows[y][x]
            nb = [rows[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            if me != '.' and nb.count(nb[0]) == 4 and nb[0] != me and nb[0] != '.' and me not in 'RrQ':
                g[y][x] = nb[0]
    return [''.join(r) for r in g]


def _specks(rows, passes=2):
    """The turn scatters the thin marks (the city crosses, the stripes) into lone specks: a pixel
    with no 8-neighbour of its own letter takes the most common letter of its 4 neighbours (never
    the background), so diagonal lines stay and the specks merge into the paint around them."""
    for _ in range(passes):
        g = [list(r) for r in rows]
        h, w = len(rows), len(rows[0])
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                me = rows[y][x]
                if me == '.':
                    continue
                if any(rows[y + dy][x + dx] == me for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy):
                    continue
                nb = [rows[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                nb = [c for c in nb if c != '.']
                if len(nb) < 3:
                    continue
                g[y][x] = max(sorted(set(nb)), key=nb.count)
        rows = [''.join(r) for r in g]
    return rows
