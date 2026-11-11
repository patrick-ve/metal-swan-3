# The groom's own parts (a part swap on the stag kit, plan rule 6): the head with the parted brown
# hair, the blush and the small gold tiara; the lime party tee with the L-plate where the others
# wear the star; the pink tutu (five states for its secondary motion); the white veil (drawn by a
# generator: its angle, curl and flutter per frame are the secondary motion); the shirt bundle with
# the L-plate (cower); the triple foam jet of his three corks; the flying veil (the FX strip
# enemy/stag-groom/veil). The approved look: docs/design/cast40/chars/stag-groom.py.
#
# Letters over the stag kit (kit.BASE): Y = the tutu's lit pink (Z and k of the kit are its mid and
# dark), M = the L-plate's red. The veil uses the kit's whites T t and the sneaker grey v.
import math

import castkit as K
import rig

P = K.P

# ------------------------------------------------------------------------------------ head
HEAD = [
    "......R.Z.R....",
    "......rRRRr....",
    "....hhHHHHHh...",
    "..hhHAAHhHAAH..",
    ".hHHAAHHhHAAAH.",
    "hhHHHHHHhHHSSL.",
    "hhhHHHHHSSSSLL.",
    "QhhHHHSSQQQSSL.",
    "QhhHHsSSSwQSSL.",
    "QhhHszsSSSSSSSL",
    ".QhHszsSSbbSSs.",
    ".QhSSSSSSQwwwQ.",
    "..QsSSSSSQzzQ..",
    "...zsSSSSSQQs..",
    "....zzsssss....",
]
NECK = (5, 14)
# the veil's comb: at the back of the crown, under the tiara's back prong
VEIL_AT = (4, 2)


def expressions(kit):
    e = kit.expressions(eye=8, ex=9, mth=11, mx=9)
    # looking up at the phone: the brow and the eye a row up, the chin out
    e['up'] = [(6, 8, 'SSQQQ'), (7, 8, 'SSwQS'), (8, 8, 'SSSSS'), (11, 8, 'SQwwwQ')]
    return e


# ------------------------------------------------------------------------------------ torso
# The lime tee of the normal build (kit.TORSO_NORMAL) with the L-plate (white, the red L, a shaded
# lower edge) on the chest where the others wear the star.
TORSO = [
    ".qjjJJJSsJ..",
    "qjjjJJJJJJJ.",
    "qTTTTTjJJJJJ",
    "qTMTTTjJJJJJ",
    "qTMTTTjJJJJJ",
    "qTMMMTjJJJJJ",
    "qtttttjJJJJj",
    "qjjjqjjJJJJj",
    "qqjjjqjjJJJj",
    "Qqjjjjqjjjjq",
    ".QqqqqqqqqQ.",
    ".hHhHHHRrHh.",
]
TAN = {'neck': (6, -2), 'pelvis': (6, 10), 'shN': (6.5, 2.5), 'shF': (3.5, 3.0)}

# ------------------------------------------------------------------------------------ tutu
# Pleats Y (lit) Z (mid) k (fold), light from the upper front (right); the waist row first, the
# scalloped hem last. The waist is centred on the torso's pelvis column.
TUTU_REST = [
    "..kZYZYZYZYZYZ..",
    ".kZYZYYZYYZYYZY.",
    "kZZYZZYZZYZZYZZY",
    "kkZkZZkZZkZZkZZZ",
    ".k.kk.kk.kk.kZk.",
]
# the hem flies up and spreads (the body has just dropped: a heel strike, a sit-down, a jolt)
TUTU_LIFT = [
    "...kZYZYZYZYZYZ...",
    ".kkZYZYYZYYZYYZYY.",
    "kZZkZZYZZYZZYZZYZY",
    ".k.kk.kk.kk.kk.kZ.",
]
# the hem hangs long and close (the body has just risen: it lags down)
TUTU_DROP = [
    "..kZYZYZYZYZYZ..",
    "..kZYZYYZYYZYZ..",
    ".kZZYZZYZZYZZYZ.",
    ".kZkZZkZZkZZkZZ.",
    ".kkZkkZkkZkkZkZ.",
    "..k.kk.kk.kk.k..",
]


def _shift(rows, per_row):
    """The hem trailing: row r moves right by round(per_row * r) (negative: back)."""
    ks = [int(round(per_row * r)) for r in range(len(rows))]
    lo, hi = min(ks), max(ks)
    w = max(len(r) for r in rows) + hi - lo
    return [('.' * (k - lo) + r).ljust(w, '.') for k, r in zip(ks, rows)], -lo


TUTUS = {
    0: (TUTU_REST, 0),
    1: (TUTU_LIFT, 0),
    2: (TUTU_DROP, 0),
    3: _shift(TUTU_REST, -0.5),     # moving forward: the frills trail back
    4: _shift(TUTU_REST, 0.5),      # stopping or pushed back: the frills swing on forward
}


def with_tutu(part, state):
    """A torso part with the tutu hung under its belt row, centred on its pelvis column."""
    rows, an = part
    tr, lead = TUTUS[state]
    tw = max(len(r) for r in tr)
    px = an['pelvis'][0]
    # the waist row's middle on the pelvis column (16 wide: x -2 .. 13 for the pelvis at 6)
    x0 = int(math.floor(px + 0.5 - tw / 2)) - lead
    w = max(len(r) for r in rows)
    pad_l = max(0, -x0)
    pad_r = max(0, x0 + tw - w)
    out = ['.' * pad_l + r.ljust(w, '.') + '.' * pad_r for r in rows]
    W = w + pad_l + pad_r
    for r in tr:
        line = ['.'] * W
        for i, ch in enumerate(r):
            if ch != '.':
                line[x0 + pad_l + i] = ch
        out.append(''.join(line))
    return out, {k: (v[0] + pad_l, v[1]) for k, v in an.items()}


# ------------------------------------------------------------------------------------ bundle
def bundles(kit):
    """The shirt pulled over his head (cower): the kit's bundle with the L-plate on top."""
    out = []
    for b in kit.BUNDLE:
        g = [list(r) for r in b]
        # the star (rows 3-6) becomes a 4 x 4 plate with the red L
        ys = [y for y, r in enumerate(b) if 'T' in r]
        xs = [x for r in b for x, ch in enumerate(r) if ch == 'T']
        y0, x0 = min(ys), min(xs)
        plate = ["TTTT", "TMTT", "TMMT", "tttt"]
        for dy, row in enumerate(plate):
            for dx, ch in enumerate(row):
                g[y0 + dy][x0 + dx] = ch
        out.append([''.join(r) for r in g])
    return out


# ------------------------------------------------------------------------------------ veil
VEIL_LEN = 14.0


def veil_cells(ang, curl, wave, length=VEIL_LEN, width=1.0):
    """The veil as cells {(x, y): letter} relative to its comb (0, 0), drawn facing right.

    ang   the angle of the veil at the comb, from straight down towards the back (deg)
    curl  the extra angle at the hem (deg; positive: the hem lifts back, the wind of a run)
    wave  the flutter phase (radians): a travelling ripple along the sheet and the hem
    The sheet widens from the comb to the hem; folds run along it (t, the deepest near the comb v);
    the hem is scalloped tulle. A small gathered puff at the comb."""
    cells = {}
    x, y = 0.0, 0.0
    ds = 0.2
    n = int(length / ds)
    for i in range(n + 1):
        u = i * ds / length
        # gravity: a veil blown far back sags at the hem
        sag = 0.55 * max(0.0, ang - 24)
        th = math.radians(ang + (curl - sag) * u * u + 9.0 * math.sin(wave - u * 4.5) * u)
        dx, dy = -math.sin(th), math.cos(th)
        nx, ny = math.cos(th), math.sin(th)
        hw = (1.0 + 3.2 * u ** 0.75) * width
        steps = int(hw / 0.2) + 1
        for j in range(-steps, steps + 1):
            v = j * 0.2
            if abs(v) > hw:
                continue
            vn = v / hw
            # the scalloped hem: the last rows of the sheet only where a scallop hangs
            if u > 0.9 and math.sin(vn * 6.5 + wave * 0.8) < -0.2 - (1 - u) * 6:
                continue
            fold = math.sin(math.pi * vn * 2.0 + wave * 0.6 + u * 2.2)
            if u > 0.9:
                ch = 't' if fold > 0.2 else 'T'
            elif fold > 0.72:
                ch = 'v' if u < 0.4 else 't'
            elif vn > 0.78 and u < 0.6:
                ch = 't'         # the edge turned away (under the head's shadow)
            else:
                ch = 'T'
            key = (int(math.floor(x + nx * v + 0.5)), int(math.floor(y + ny * v + 0.5)))
            cells[key] = ch
        x += dx * ds
        y += dy * ds
    # the gathered puff under the comb, just over the crown
    for (px, py, ch) in ((-1, -1, 'T'), (0, -1, 'T'), (-2, 0, 'T'), (-1, 0, 'T'), (1, -1, 't'), (-2, -1, 't')):
        cells.setdefault((px, py), ch)
    return cells


def veil_back(cv, X, p, meta, z):
    """pose.HOOKS['back']: the veil behind the head and back, from the head's 'veil' point."""
    v = p.get('veil')
    if not v or 'head' not in meta or 'veil' not in meta['head']:
        return
    ax, ay = X.m(meta['head']['veil'])
    ox, oy = int(round(ax)), int(round(ay))
    for (cx, cy), ch in sorted(veil_cells(*v).items()):
        cv.px(ox + cx, oy + cy, ch, z, 'veil')


def flying_veil(k):
    """The veil off his head (his death: the game tumbles it, 4 frames at 6 ticks): a crumpled
    sheet turning over, the tiara's comb a gold glint. Returns (rows, root) with an outline."""
    params = [(70, -40, 0.0), (110, -70, 1.6), (150, -110, 3.1), (100, -30, 4.7)][k]
    cells = veil_cells(*params, length=10.0, width=1.05)
    deg = [0, 80, 175, 265][k]
    a = math.radians(deg)
    pts = {}
    for (x, y), ch in cells.items():
        rx = x * math.cos(a) - y * math.sin(a)
        ry = x * math.sin(a) + y * math.cos(a)
        pts.setdefault((int(math.floor(rx + 0.5)), int(math.floor(ry + 0.5))), ch)
    # fill one-pixel holes the turn left
    xs = [q[0] for q in pts]
    ys = [q[1] for q in pts]
    for y in range(min(ys), max(ys) + 1):
        for x in range(min(xs), max(xs) + 1):
            if (x, y) not in pts and all((x + dx, y + dy) in pts for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                pts[(x, y)] = 'T'
    # the comb (gold) where the veil was gathered
    cr = (int(round(0 * math.cos(a))), int(round(0 * math.sin(a))))
    pts[cr] = 'R'
    x0, y0 = min(q[0] for q in pts) - 1, min(q[1] for q in pts) - 1
    w = max(q[0] for q in pts) - x0 + 2
    h = max(q[1] for q in pts) - y0 + 2
    cv = rig.Canvas(w, h)
    for (x, y), ch in sorted(pts.items()):
        cv.px(x - x0, y - y0, ch, 0, 'veil')
    rows = cv.finish()
    return rows, (w // 2, h // 2)


# ------------------------------------------------------------------------------------ FX
# The groom's pop sends three corks (vy 0, -0.22, -0.44): the foam jet fans into three streams.
FX = {
    'jetg': (K.grid("""
        ............I.I
        .........IiI...
        ......IiI..I...
        ....IiI.....I..
        ..IiWiI..I.I...
        IWWWiIiIiIi.I..
        .IIiIiIii.I....
        ...IiI.I.......
        .....I.........
    """), (0, 5)),
    'jetg2': (K.grid("""
        .......I.I
        .....IiI..
        ...IiI.I..
        ..IiI.I.I.
        .IiiI.I...
        IWWiI.I...
        .IiI.i....
        ..I.......
    """), (0, 5)),
}
JET_SWAP = {'jet': 'jetg', 'jet2': 'jetg2'}
