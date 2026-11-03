# The stag party kit (stag-partier, stag-partier-2, stag-groom): the matching lime party T-shirt with
# a white star print (pink centre), shorts with bare sunburnt shins, the fizzy-wine bottle (green
# glass, cream label with a red band, gold foil, the cork), torsos per build. Facing right, light
# from the upper front, no exterior outline (the composer draws it).
import math
import castkit as K
from rig import rotsprite
from chars import handhaver_kit as HK

pose = K.pose

BASE = {
    'K': '#140c0e',
    'Q': '#24140e',
    'J': '#c8f04a', 'j': '#8cc828', 'q': '#4f8a1c',          # lime party T-shirt
    'T': '#fffaf0', 't': '#c9ccc0',                          # white star print, label, sneakers
    'Z': '#f0609a',                                          # pink star centre (and the tutu hi)
    'C': '#2f8a58', 'E': '#1a5a3a', 'U': '#24140e',          # deep green bottle glass (deepest = Q)
    'R': '#f6cc48', 'r': '#a87a1c',                          # gold foil (and the tiara)
    'G': '#fffaf0',                                          # glass glint
}
DARK = {'J': 'q', 'j': 'q', 'q': 'Q', 'C': 'E', 'E': 'U', 'U': 'K', 'Z': 'z', 'R': 'r', 'r': 'Q', 'G': 'E'}


def sleeves(upper=3.2, shorts=7.6):
    """Short sleeves and shorts as a limb pattern: past `upper` px along the arm the sleeve ends in
    bare skin; past `shorts` px along the leg the shorts end in bare skin (the ramp follows the
    tube's own shade index)."""
    skin = ['S', 's', 'z', 'z']
    skinF = ['s', 's', 'z', 'z']

    def pat(part, u, v, k, ch):
        if part == 'armN' and u > upper:
            return skin[k]
        if part == 'armF' and u > upper:
            return skinF[k]
        if part == 'legN' and u > shorts:
            return skin[k]
        if part == 'legF' and u > shorts:
            return skinF[k]
        return ch
    pose.HOOKS['pat'] = pat


# ------------------------------------------------------------------ torsos
# lime tee: crew neck (skin notch at the front), a fold line along the back, the white star with a
# pink centre on the chest, the hem, then the belt row (h H = belt, swapped per look)
TORSO_HEAVY = K.grid("""
    ...qjjJJJJSsJ...
    ..qjjJJJJJJJJJ..
    .qjjjJJJJJJJJJJ.
    .qjjTjJJJJJJJJJ.
    .qTTTTTJJJJJJJJJ
    .qjTZTjJJJJJJJJJ
    .qjTqTjJJJJJJJJJ
    .qjjjqjjJJJJJJJJ
    .qqjjjqjjjJJJJJj
    .Qqjjjjqjjjjjjjq
    ..QqqqqqqqqqqqQ.
    ..hHhHHHHHHRrH..
""")
TAN_HEAVY = {'neck': (7.5, -2), 'pelvis': (7.5, 10), 'shN': (8.5, 2.5), 'shF': (4.5, 3.0)}

TORSO_STOCKY = K.grid("""
    ..qjjJJJJSsJ..
    .qjjJJJJJJJJJ.
    qjjjJJJJJJJJJJ
    qjjTjJJJJJJJJJ
    qTTTTTJJJJJJJJ
    qjTZTjJJJJJJJJ
    qjTqTjJJJJJJJJ
    qjjjqjjJJJJJJj
    qqjjjqjjjJJJJj
    QqjjjjqjjjjjjQ
    .QqqqqqqqqqqQ.
    .hHhHHHHHRrHh.
""")
TAN_STOCKY = {'neck': (6.5, -2), 'pelvis': (6.5, 10), 'shN': (7.5, 2.5), 'shF': (4, 3.0)}

TORSO_NORMAL = K.grid("""
    .qjjJJJSsJ..
    qjjjJJJJJJJ.
    qjjjJJJJJJJJ
    qjjTjJJJJJJJ
    qTTTTTJJJJJJ
    qjTZTjJJJJJJ
    qjTqTjJJJJJJ
    qjjjqjjJJJJj
    qqjjjqjjJJJj
    Qqjjjjqjjjjq
    .QqqqqqqqqQ.
    .hHhHHHRrHh.
""")
TAN_NORMAL = {'neck': (6, -2), 'pelvis': (6, 10), 'shN': (6.5, 2.5), 'shF': (3.5, 3.0)}


def torso(build):
    rows, an = {'heavy': (TORSO_HEAVY, TAN_HEAVY), 'stocky': (TORSO_STOCKY, TAN_STOCKY),
                'normal': (TORSO_NORMAL, TAN_NORMAL)}[build]
    K.P.TORSOS['up'] = (rows, an)
    K.P.TORSOS['lean'] = K.P.shear(K.P.TORSOS['up'], 2)
    K.P.TORSOS['back'] = K.P.shear(K.P.TORSOS['up'], -2)


# ------------------------------------------------------------------ white sneakers
SNEAKER_PAL = {'X': '#fffaf0', 'x': '#c9ccc0', 'v': '#8a8e9a'}


def sneakers():
    K.P.SHOES['flat'] = (K.grid("""
        XXXx.....
        XXxXXx...
        XXXXXXXx.
        vvvvvvvvv
    """), {'ankle': (2, 0)})


# ------------------------------------------------------------------ the bottle
# upright (neck up), 4 px across the body: cork (D d), gold foil (R r), green glass (C E U, a glint G),
# the cream label (T t) with a red band (e)
BOTTLE_UP = K.grid("""
    .Dd.
    .Dd.
    .Rr.
    .Rr.
    .GE.
    GCEU
    CCEU
    TTtt
    eeee
    TTtt
    CCEU
    CEEU
""")


def rot(rows, an, deg, pad=4):
    """RotSprite a part around its 'wrist' (positive = counter-clockwise on screen). Returns
    (rows, anchors) cropped to the content, every anchor moved with it."""
    w = max(len(r) for r in rows)
    n = w + len(rows) + 2 * pad
    g = [['.'] * n for _ in range(n)]
    wx, wy = an['wrist']
    ox, oy = n // 2 - int(wx), n // 2 - int(wy)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            g[oy + y][ox + x] = ch
    g = [''.join(r) for r in g]
    piv = (ox + wx, oy + wy)
    out = rotsprite(g, piv, deg)
    ys = [y for y, r in enumerate(out) if r.strip('.')]
    xs = [x for r in out for x, c in enumerate(r) if c != '.']
    x0, y0 = min(xs), min(ys)
    a = math.radians(deg)

    def mv(p):
        dx, dy = p[0] - wx, p[1] - wy
        return (piv[0] + dx * math.cos(a) + dy * math.sin(a) - x0, piv[1] - dx * math.sin(a) + dy * math.cos(a) - y0)
    return [r[x0:max(xs) + 1] for r in out[y0:max(ys) + 1]], {k: mv(v) for k, v in an.items()}


def palette(look_pal, look_dark=None, extra=''):
    pal = dict(BASE)
    pal.update(look_pal)
    dark = dict(DARK)
    dark.update(look_dark or {})
    K.palette(pal, dark=dark, letters='JjqTtZCEURrG' + extra)
    pose.RAMP['arm'] = ['J', 'j', 'q', 'Q']
    pose.RAMP['armF'] = ['j', 'q', 'Q', 'Q']


def lathe(deg, prof, length=1.0, n=34):
    """A rigid turned object (a bottle) along an axis at deg above the forward horizontal: prof =
    [(s0, s1, r0, r1, ramp)] sections along the axis (flat ends, unlike the capsule tube), each
    shaded as a lit cylinder like the limbs. Returns (rows, P) with P(s) -> the canvas point."""
    from rig import LIGHT3
    a = math.radians(deg)
    ux, uy = math.cos(a), -math.sin(a)
    c0 = n / 2 - 0.5
    lx, ly, lz = LIGHT3
    out = [['.'] * n for _ in range(n)]
    for y in range(n):
        for x in range(n):
            dx, dy = x - c0, y - c0
            sa = (dx * ux + dy * uy) / length            # along the axis (object units)
            v = -dx * uy + dy * ux                       # across (px), + = below the axis
            for s0, s1, r0, r1, ramp in prof:
                if s0 <= sa < s1:
                    r = r0 + (r1 - r0) * (sa - s0) / (s1 - s0)
                    if abs(v) <= r:
                        q = v / (r + 0.35)
                        nz = math.sqrt(max(0.0, 1 - q * q))
                        # the normal across the axis: +v points to (-uy, ux) on screen
                        l = q * (-uy * lx + ux * ly) + nz * lz
                        k = 0 if l > 0.86 else 1 if l > 0.45 else 2 if l > 0.05 else 3
                        out[y][x] = ramp[k]
                    break
    rows = [''.join(r) for r in out]
    P = lambda s: (c0 + ux * s * length, c0 + uy * s * length)
    return rows, P


def crop(rows, pts):
    ys = [y for y, r in enumerate(rows) if r.strip('.')]
    xs = [x for r in rows for x, ch in enumerate(r) if ch != '.']
    x0, y0 = min(xs), min(ys)
    return [r[x0:max(xs) + 1] for r in rows[y0:max(ys) + 1]], {k: (p[0] - x0, p[1] - y0) for k, p in pts.items()}


GLASS = ['G', 'C', 'E', 'U']
LABEL = ['T', 'T', 't', 't']
BAND = ['e', 'e', 'e', 'r']
FOIL = ['R', 'R', 'r', 'r']
CORK = ['D', 'D', 'd', 'd']


def bottle(deg, length=1.0, state='corked'):
    """The fizzy-wine bottle as a loose rigid item: deg = the neck's angle above the forward
    horizontal. Green glass body, the cream label with a red band, the shoulder, the neck under gold
    foil, the cork ('corked') or the open mouth ('open'). Anchors: 'c' centre, 'neck' (the grip
    under the foil), 'base', 'tip' (the cork end)."""
    prof = [(-6.0, -4.5, 1.9, 1.9, GLASS), (-4.5, -2.5, 1.9, 1.9, LABEL), (-2.5, -1.6, 1.9, 1.9, BAND),
            (-1.6, 0.0, 1.9, 1.9, GLASS), (0.0, 2.0, 1.9, 0.8, GLASS), (2.0, 4.6, 0.8, 0.8, FOIL)]
    if state == 'corked':
        prof.append((4.6, 5.8, 0.9, 0.9, CORK))
    rows, P = lathe(deg, prof, length)
    tip = 5.8 if state == 'corked' else 4.6
    return crop(rows, {'c': P(0), 'neck': P(3.0), 'base': P(-6.0), 'mid': P(-3.5), 'grip': P(-5.0), 'tip': P(tip)})


def shoulders(build, pel=(0, -17)):
    """The near / far shoulder of the 'up' torso, relative to the ground root (for arm targets)."""
    an = K.P.TORSOS['up'][1]
    px, py = an['pelvis']
    return ((pel[0] + an['shN'][0] - px, pel[1] + an['shN'][1] - py),
            (pel[0] + an['shF'][0] - px, pel[1] + an['shF'][1] - py))


def reach(sh, at):
    return (at[0] - sh[0], at[1] - sh[1])


def in_hand(rows, an, fist, at='grip', fa=(1, 1), pad=3):
    """A hand part holding a rigid item: the fist grid (its knuckle point fa) laid over the item at
    the item's anchor 'at'. The wrist is the fist's left edge. Returns (rows, anchors) where every
    item anchor is kept and 'wrist' is added."""
    w = max(len(r) for r in rows) + 2 * pad
    h = len(rows) + 2 * pad
    g = [['.'] * w for _ in range(h)]
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.':
                g[y + pad][x + pad] = ch
    gx, gy = an[at][0] + pad, an[at][1] + pad
    x0, y0 = int(round(gx - fa[0])), int(round(gy - fa[1]))
    for y, r in enumerate(fist):
        for x, ch in enumerate(r):
            if ch != '.':
                g[y0 + y][x0 + x] = ch
    pts = {k: (v[0] + pad, v[1] + pad) for k, v in an.items()}
    pts['wrist'] = (x0 - 0.5, y0 + fa[1])
    return crop([''.join(r) for r in g], pts)
