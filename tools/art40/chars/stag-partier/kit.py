# THE STAG KIT: the shared parts of the stag party at 40 px (plan docs/design/ams40.md wave 3), the
# production form of the approved cast samples docs/design/cast40/chars/stag-partier_kit.py,
# stag-partier.py and stag-partier-2.py. Used by the sets stag-partier (look 0), stag-partier-2
# (look 2) and stag-groom (the groom builder: a Look with his own parts).
#
#   kit = X.char('stag-partier').kit
#   look = kit.Look(name='groom', build='normal', pal={...}, head=HEAD, ...)   # see Look
#   kit.install(look)            # palette, heads, torsos, hands, shoes, FX (patches the rig tables)
#   strips = X.char('stag-partier').strips
#   strips.build(s, look)        # every partier strip with this look's parts
#
# A Look carries the parts that differ (palette, head grid, build, limb sizes, shorts, sneakers) and
# two hooks: `install_extra()` (register more parts after install) and `dress(p, role)` (change a
# pose dict before it is drawn: items, fx, a back layer; role = (strip name, frame index, kind) with
# kind 'stand' | 'seat' | 'dead' | 'cower'). The animation is the same for every look (rule 6).
#
# Drawn facing right (the game's unflipped sprite faces right), light from the upper front, the one
# warm near-black outline K, selout from the rig.
import math

import castkit as K
import limbs as HK
import rig
from rig import rotsprite

P = K.P
pose = K.pose

# ------------------------------------------------------------------------------------ palette
# The party colours every look shares. One letter per colour, merged by the bake where colours are
# the same. Look 0 counts 26 colours, look 2 27 (plan D1: at most 28): the outline K, the darkest
# brown Q, the lime tee (J j q), white (T t: the star print, the label, sneakers, eye whites), pink
# (Z k: the star centre and the phone), the bottle glass (C E), gold foil (R r), the cork (a), the
# label band (b: the blush colour of look 0), hair (A H h), skin (L S s z), shorts (P p o), the
# sneakers (look 0: T t v; look 2: X x and Q). The foam, flash, flame and smoke letters are the
# shared FX ramp (outside the budget).
BASE = {
    'K': '#140c0e',
    'Q': '#24140e',
    'J': '#c8f04a', 'j': '#8cc828', 'q': '#4f8a1c',          # lime party T-shirt
    'T': '#fffaf0', 't': '#c9ccc0',                          # white: star print, label, eye white
    'w': '#fffaf0', 'G': '#fffaf0',                          # eye white, glass glint (= T)
    'Z': '#f0609a', 'k': '#a82e62',                          # pink: star centre, the phone
    'C': '#2f8a58', 'E': '#1a5a3a', 'U': '#24140e',          # green glass (deepest = Q)
    'R': '#f6cc48', 'r': '#a87a1c',                          # gold foil
    'a': '#d8a060',                                          # the cork
    'b': '#ff7a72',                                          # the label band (look 0: blush too)
    'O': '#24140e',                                          # shorts deepest (= Q)
    # FX letters: colours of the shared FX ramp (rules.json fxRamp), outside the budget
    'F': '#fffbd8', 'f': '#ffd040', 'c': '#ff8a24', 'e': '#e0401c', 'W': '#ffffff', 'y': '#ffe070',
    'I': '#ffffff', 'i': '#bfe4ff', 'm': '#7fb4e8', 'D': '#7a6e70', 'd': '#4a4046',
}
FX_LETTERS = 'FfceWyIimDd'
DARK = {'J': 'q', 'j': 'q', 'q': 'Q', 'T': 't', 't': 'v', 'w': 't', 'G': 'E', 'Z': 'k', 'k': 'Q',
        'C': 'E', 'E': 'Q', 'U': 'Q', 'R': 'r', 'r': 'Q', 'a': 'r', 'b': 'z',
        'A': 'h', 'H': 'h', 'h': 'Q', 'L': 'z', 'S': 'z', 's': 'z', 'z': 'Q',
        'P': 'o', 'p': 'o', 'o': 'Q', 'O': 'Q', 'X': 'x', 'x': 'v', 'v': 'Q'}
BODY = 'QJjqTtwGZkCEURrabAHhLSszPpoOXxv'


class Look:
    """One partier look (a part swap on the shared animation, rule 6).

    name     'look0', 'look2', 'groom' ...
    build    'heavy' | 'stocky' | 'normal' (the torso grid; wider, not taller)
    pal      letter -> '#rrggbb' over BASE (hair A H h, skin L S s z, shorts P p o, sneakers X x v, ...)
    head     the head grid (facing right, 15-16 px wide, about 13-14 rows), neck at `neck`
    expr     {name: [(row, x, letters)]} edits of the head per expression (see EXPRESSIONS)
    limbs    (leg radius, arm radius) multipliers (1.0 = VINCENT)
    legs     (THIGH, SHIN) lengths
    sleeves  (sleeve end along the arm, shorts end along the leg) in px
    pdy      +1 moves the pelvis down a pixel (shorter legs) on every pose
    soot     the letters whose colours the soot statue uses for dark / mid / light
    sneaker  'white' | 'black'
    install_extra()   more parts after install (the groom's veil, L-plate ...)
    dress(p, role)    change a pose dict before it is drawn (role = (strip, index, kind))
    """

    def __init__(self, name, build, pal, head, neck, expr=None, dark=None, limbs=(1.0, 1.0), legs=(7.0, 6.5),
                 sleeves=(3.0, 7.4), pdy=0, soot=('Q', 'o', 'v'), sneaker='white', install_extra=None, dress=None,
                 bundle=None):
        self.name, self.build, self.pal, self.head, self.neck = name, build, pal, head, neck
        self.expr = expr or {}
        self.dark = dark or {}
        self.limbs, self.legs, self.sleeves, self.pdy = limbs, legs, sleeves, pdy
        self.soot, self.sneaker = soot, sneaker
        self.install_extra, self.dress = install_extra, dress
        self.bundle = bundle


# ------------------------------------------------------------------------------------ torsos
# The lime tee: crew neck (a skin notch at the front), a fold along the back, the white star with a
# pink centre on the chest, the hem, then the belt row (h H the belt, R r the buckle).
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

TORSOS = {'heavy': (TORSO_HEAVY, TAN_HEAVY), 'stocky': (TORSO_STOCKY, TAN_STOCKY), 'normal': (TORSO_NORMAL, TAN_NORMAL)}


def breathe_in(rows):
    """The chest lifts on the in-breath: the belly row under the print pulls in a pixel at the front
    (the front edge of rows 7-9 moves back one), the shoulders stay."""
    out = list(rows)
    for y in (8, 9):
        r = out[y].rstrip('.')
        out[y] = (r[:-1]).ljust(len(rows[y]), '.')
    return out


def bare(rows):
    """The torso with the T-shirt pulled up over the head (cower): the belly and chest bare (skin
    ramp), a navel, the belt stays."""
    m = str.maketrans({'J': 'S', 'j': 's', 'q': 'z', 'T': 'S', 'Z': 's'})
    out = [r.translate(m) if y < len(rows) - 1 else r for y, r in enumerate(rows)]
    w = len(out[0])
    mid = w // 2 + 1
    out[7] = out[7][:mid] + 'z' + out[7][mid + 1:]
    out[0] = out[0].replace('S', 'z', 1)
    return out


def install_torsos(look):
    rows, an = TORSOS[look.build]
    P.TORSOS['up'] = (rows, an)
    P.TORSOS['in'] = (breathe_in(rows), an)
    for k, v in (('back2', -3), ('back', -2), ('back1', -1), ('lean1', 1), ('lean', 2), ('lean2', 3)):
        P.TORSOS[k] = P.shear(P.TORSOS['up'], v)
    P.TORSOS['bare'] = (bare(rows), an)
    P.TORSOS['bare_lean'] = P.shear(P.TORSOS['bare'], 2)
    P.TORSOS['bare_lean2'] = P.shear(P.TORSOS['bare'], 3)


# ------------------------------------------------------------------------------------ heads
# Expression edits on the look's head grid: (row, x, letters), ' ' keeps a pixel. Every look's grid
# puts the brow on row EYE - 1, the eye (white w, pupil Q) on row EYE at x EX, the mouth on row MTH
# at x MX; a look passes its own numbers in expr (see stag-partier __init__ / stag-partier-2).
def expressions(eye, ex, mth, mx):
    """The expression edits for a head whose eye white is at (ex, eye) and whose grin starts at
    (mx, mth) (Q w w w Q)."""
    return {
        'fwd': [],
        # half shut, merry eyes: the lid drops over the eye (tipsy)
        'tipsy': [(eye, ex, 'zQ')],
        'blink': [(eye, ex, 'zz')],
        # the shout (alert, fire): the brow down, the mouth wide open (dark inside, the tongue)
        'shout': [(eye - 1, ex - 1, 'QQQ'), (eye, ex, 'wQ'), (mth, mx, 'QQQQQ'), (mth + 1, mx, 'QbbQ')],
        # laughing: eyes squeezed into arcs, the grin wide open
        'happy': [(eye - 1, ex - 1, 'SQQ'), (eye, ex - 1, 'QSS'), (mth, mx, 'QwwwQ'), (mth + 1, mx, 'QbbQ')],
        # hurt: the eye squeezed shut, the teeth clenched
        'hurt': [(eye - 1, ex - 1, 'QQS'), (eye, ex, 'QQ'), (mth, mx, 'QwQwQ')],
        # dazed: an empty stare (the pupil lost), the mouth slack
        'dazed': [(eye, ex, 'Qw'), (mth, mx, 'SQQQS'), (mth + 1, mx, ' QQ  ')],
        # panic: the brow up, the eye wide, the mouth an open O
        'panic': [(eye - 2, ex - 1, 'QQQ'), (eye - 1, ex - 1, 'SSS'), (eye, ex - 1, 'wwQ'), (mth, mx, 'SQQQS'),
                  (mth + 1, mx, ' QbQ ')],
        # the swig: eyes shut in bliss, the lips round the bottle neck
        'swig': [(eye, ex, 'zz'), (mth, mx, 'SSQQS'), (mth + 1, mx, ' SzS ')],
        # aah: eyes shut, the mouth open in a satisfied sigh
        'aah': [(eye, ex, 'zz'), (mth, mx, 'SQQQS'), (mth + 1, mx, ' QbQ ')],
        # soot (the burn): white eyes in the blackened face, the mouth agape
        'soot': [(eye, ex - 1, 'wwQ'), (mth, mx, 'SQQQS')],
        'sootblink': [(eye, ex - 1, 'zzz'), (mth, mx, 'SQQQS')],
    }


def install_heads(look):
    nk = {'neck': look.neck}
    for e, ch in look.expr.items():
        P.HEADS[e] = (HK.edit(look.head, ch), nk)
    # the shirt bundle over the head (cower): a lime wad, the star print on top, the neck hole
    for i, b in enumerate(look.bundle or BUNDLE):
        P.HEADS[f'bundle{i}'] = (b, nk)


BUNDLE = [K.grid("""
    ....qjjjjq.....
    ..qjjJJJJJjq...
    .qjJJJJJJJJJq..
    qjJJJTJJJJJJJq.
    qjJJTTTJJJJJJjq
    qjJJTZTJJJJJJjq
    qjjJTqTJJJJJjjq
    qjjjJJJJJJJjjq.
    .qjjjjJJJjjjq..
    .qqjjjjjjjjqq..
    ..QqqqjjjqqQ...
    ...Qqq.qqqQ....
    ....SSsSSs.....
"""), K.grid("""
    ...qjjjjq......
    .qjjJJJJJjq....
    qjJJJJJJJJJq...
    qjJJTJJJJJJJq..
    qjJTTTJJJJJJjq.
    qjJTZTJJJJJJjq.
    qjjTqTJJJJJjjq.
    qjjjJJJJJJjjjq.
    .qjjjjJJJjjjq..
    .qqjjjjjjjjqq..
    ..QqqqjjjqqQ...
    ...Qqq.qqqQ....
    ....SSsSSs.....
""")]


# ------------------------------------------------------------------------------------ hands
HANDS = {
    'fist': (["SSS", "SSs", ".ss"], {'wrist': (0, 1)}),
    'open': (["SSSSS", "SSSSs", ".sss."], {'wrist': (0, 1)}),
    # the palm up and open (a shrug, the free hand in the toast)
    'palm': ([".S.S.", "SSSSS", "SSSs.", ".ss.."], {'wrist': (0, 2)}),
    # the fingers spread up (the cower, holding the shirt over the head)
    'up': ([".S.S", "SSSs", "SSs.", "Ss.."], {'wrist': (0.5, 3)}),
    # the peace sign (the selfie)
    'peace': (["S.S.", "S.S.", "SSSs", "SSs.", ".s.."], {'wrist': (0, 3)}),
    # the thumbs up (photo)
    'thumb': ([".S..", ".SL.", "SSSS", "SSSs", ".ss."], {'wrist': (0, 3)}),
    'point': (["SS....", "SSSSSs", ".ss..."], {'wrist': (0, 1)}),
    # the pink phone held up, the camera at the top
    'phone': (K.grid("""
        .kZZ
        .kZZ
        .kZw
        .kZZ
        SSSS
        SSSs
        .ss.
    """), {'wrist': (0, 4.5), 'cam': (3, 0)}),
    # the phone held flat in front of him (he checks the picture)
    'phonelow': (K.grid("""
        .kkZZ
        kZZZw
        SSSs.
        .ss..
    """), {'wrist': (0, 2.5), 'cam': (4, 0)}),
    # the free hand cupped under the bottle's base (both hands on the bottle)
    'cup': (["SSS.", "sSSs", ".ss."], {'wrist': (0, 1)}),
}
FIST_BODY = K.grid("""
    .SSS.
    SSSSS
    sSSs.
    .ss..
""")
FIST_NECK = K.grid("""
    SSS
    SSs
    .s.
""")


def install_hands():
    for k, v in HANDS.items():
        P.HANDS[k] = v
    P.FISTS['fist'] = HANDS['fist']


# ------------------------------------------------------------------------------------ the bottle
GLASS = ['G', 'C', 'E', 'U']
LABEL = ['T', 'T', 't', 't']
BAND = ['b', 'b', 'b', 'r']
FOIL = ['R', 'R', 'r', 'r']
CORK = ['a', 'a', 'r', 'r']
BOTTLE_LEN = 1.05


def lathe(deg, prof, length=1.0, n=34):
    """A rigid turned object (the bottle) along an axis at deg above the forward horizontal: prof =
    [(s0, s1, r0, r1, ramp)] sections along the axis, each shaded as a lit cylinder like the limbs.
    Returns (rows, P) with P(s) -> the canvas point."""
    from rig import LIGHT3
    a = math.radians(deg)
    ux, uy = math.cos(a), -math.sin(a)
    c0 = n / 2 - 0.5
    lx, ly, lz = LIGHT3
    out = [['.'] * n for _ in range(n)]
    for y in range(n):
        for x in range(n):
            dx, dy = x - c0, y - c0
            sa = (dx * ux + dy * uy) / length
            v = -dx * uy + dy * ux
            for s0, s1, r0, r1, ramp in prof:
                if s0 <= sa < s1:
                    r = r0 + (r1 - r0) * (sa - s0) / (s1 - s0)
                    if abs(v) <= r:
                        q = v / (r + 0.35)
                        nz = math.sqrt(max(0.0, 1 - q * q))
                        l = q * (-uy * lx + ux * ly) + nz * lz
                        k = 0 if l > 0.86 else 1 if l > 0.45 else 2 if l > 0.05 else 3
                        out[y][x] = ramp[k]
                    break
    rows = [''.join(r) for r in out]
    Pf = lambda s: (c0 + ux * s * length, c0 + uy * s * length)
    return rows, Pf


def crop(rows, pts):
    ys = [y for y, r in enumerate(rows) if r.strip('.')]
    xs = [x for r in rows for x, ch in enumerate(r) if ch != '.']
    x0, y0 = min(xs), min(ys)
    return [r[x0:max(xs) + 1] for r in rows[y0:max(ys) + 1]], {k: (p[0] - x0, p[1] - y0) for k, p in pts.items()}


def bottle(deg, state='corked', length=BOTTLE_LEN):
    """The fizzy-wine bottle: deg = the neck's angle above the forward horizontal. Green glass, the
    cream label with the band, the shoulder, the neck under gold foil, the cork ('corked'), the cork
    pushed half out ('strain') or the open mouth ('open'). Anchors: 'c' centre, 'neck' (the grip under
    the foil), 'base', 'grip' (the body grip), 'tip' (the mouth / cork end)."""
    prof = [(-6.0, -4.5, 1.9, 1.9, GLASS), (-4.5, -2.5, 1.9, 1.9, LABEL), (-2.5, -1.6, 1.9, 1.9, BAND),
            (-1.6, 0.0, 1.9, 1.9, GLASS), (0.0, 2.0, 1.9, 0.8, GLASS), (2.0, 4.6, 0.8, 0.8, FOIL)]
    tip = 4.6
    if state == 'corked':
        prof.append((4.6, 5.8, 0.9, 0.9, CORK))
        tip = 5.8
    elif state == 'strain':
        prof.append((4.6, 6.8, 0.9, 1.0, CORK))
        tip = 6.8
    rows, Pf = lathe(deg, prof, length)
    return crop(rows, {'c': Pf(0), 'neck': Pf(3.0), 'base': Pf(-6.0), 'mid': Pf(-3.5), 'grip': Pf(-4.2),
                       'tip': Pf(tip), 'mouth': Pf(4.6)})


def in_hand(rows, an, fist, at='grip', fa=(1, 1), pad=3, under=False):
    """A hand part holding the bottle: the fist grid (its knuckle point fa) laid over (or under) the
    bottle at the bottle's anchor 'at'. Every bottle anchor is kept; 'wrist' is the fist's left
    edge."""
    w = max(len(r) for r in rows) + 2 * pad
    h = len(rows) + 2 * pad
    g = [['.'] * w for _ in range(h)]
    gx, gy = an[at][0] + pad, an[at][1] + pad
    x0, y0 = int(round(gx - fa[0])), int(round(gy - fa[1]))
    if under:
        for y, r in enumerate(fist):
            for x, ch in enumerate(r):
                if ch != '.':
                    g[y0 + y][x0 + x] = ch
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.':
                g[y + pad][x + pad] = ch
    if not under:
        for y, r in enumerate(fist):
            for x, ch in enumerate(r):
                if ch != '.':
                    g[y0 + y][x0 + x] = ch
    pts = {k: (v[0] + pad, v[1] + pad) for k, v in an.items()}
    pts['wrist'] = (x0 - 0.5, y0 + fa[1])
    return crop([''.join(r) for r in g], pts)


def bhand(deg, state='corked', grip='body'):
    """Register (once) and name the hand part holding the bottle at deg: grip 'body' (the fist round
    the body, the neck forward like a gun, the thumb on the cork) or 'neck' (dangling or swigging by
    the neck)."""
    deg = int(round(deg))
    name = f'bt_{deg}_{state}_{grip}'
    if name not in P.HANDS:
        rows, an = bottle(deg, state)
        if grip == 'neck':
            P.HANDS[name] = in_hand(rows, an, FIST_NECK, 'neck', (1, 1))
        else:
            P.HANDS[name] = in_hand(rows, an, FIST_BODY, 'grip', (2, 1))
    return name


def bottle_item(deg, state='open'):
    """A loose bottle (it slips from the hand in a death), anchored at its centre."""
    name = f'bottle_{int(round(deg))}_{state}'
    if name not in P.ITEMS:
        rows, an = bottle(deg, state)
        P.ITEMS[name] = (rows, {'c': an['c'], 'tip': an['tip']})
    return name


# ------------------------------------------------------------------------------------ FX
# Foam and fizz (I i m: the FX ramp's whites and blues), the shake lines, the selfie flash (W y f),
# flames (F f c e W) and smoke (D d). No outline: they glow.
FX = {
    'leak': (K.grid("""
        ..I.
        .IiI
        IiI.
        .I..
    """), (0, 2)),
    'fizz': (K.grid("""
        .I.
        I.i
        .i.
    """), (0, 2)),
    'shake': (K.grid("""
        ..i....
        .i.....
        .......
        .......
        .......
        .....i.
        ....i..
    """), (3, 3)),
    'shake2': (K.grid("""
        .....i.
        ......i
        .......
        .......
        .......
        i......
        .i.....
    """), (3, 3)),
    # the pop: a white ring burst at the mouth
    'pop': (K.grid("""
        .W.y.
        y...W
        .....
        W...y
        .y.W.
    """), (2, 2)),
    # the foam jet of the pop, straight ahead (anchored at the mouth, left middle)
    'jet': (K.grid("""
        ...........I..
        ......I.IiI...
        ..IIiIIiiIi.I.
        IWWWWiIiWIi.I.
        .IIiIiIii.I...
        ...IiI.I......
        .....I........
    """), (0, 3)),
    # the jet thins and arcs up as the bottle kicks up
    'jet2': (K.grid("""
        ......I.I.
        ...IiIi.I.
        .IIiiI.I..
        IWWiI.I...
        .IiI.i....
        ..I.......
    """), (0, 3)),
    'jet3': (K.grid("""
        ....I.
        ..IiI.
        .IiI..
        IWi...
        .I....
    """), (0, 3)),
    # foam bubbling over the mouth of an upright bottle and running down the glass
    'over0': (K.grid("""
        .III.
        IWiIi
        I.i.I
    """), (2, 2)),
    'over1': (K.grid("""
        ..I.I..
        .IIIiI.
        IIWiiII
        I.iWi.I
        i..i..I
        ...I..i
    """), (3, 3)),
    'over2': (K.grid("""
        .I..I...
        ..IIi.I.
        .IWiiII.
        IIiWWiII
        I..ii..I
        i..I...i
        ...i....
    """), (4, 3)),
    'drip': (K.grid("""
        I
        i
        .
        i
    """), (0, 0)),
    # the bubbles of the swig (a gulp)
    'gulp': (K.grid("""
        .i.
        i.I
        .I.
    """), (1, 1)),
    # the selfie flash at the phone's camera (small; the gloat spawns the big one)
    'snap': (K.grid("""
        ...I...
        .I.i.I.
        ..iWi..
        IiWWWiI
        ..iWi..
        .I.i.I.
        ...I...
    """), (3, 3)),
    # the clink of the toast
    'clink': (K.grid("""
        y...y
        .W.W.
        ..W..
        .W.W.
        y...y
    """), (2, 2)),
    # the hic! bubble of the drunk stagger
    'hic': (K.grid("""
        .ii.
        i..i
        i..i
        .ii.
    """), (1, 3)),
    # knee-knocking lines (cower)
    'quake': (K.grid("""
        i.i
        ...
        i.i
    """), (1, 1)),
}


def install_fx():
    import ext_moves as M
    for k, v in M.FX.items():
        P.FX[k] = v
    for k, v in FX.items():
        P.FX[k] = v
    M._hook()


# ------------------------------------------------------------------------------------ shoes
SNEAKERS = {
    # white sneakers (look 0): the white upper, a grey lace line, the grey sole
    'white': {'X': '#fffaf0', 'x': '#c9ccc0', 'v': '#8a8e9a'},
    # black sneakers (look 2)
    'black': {'X': '#4c4a56', 'x': '#2a2830'},
}


SNEAKER_FLAT = (K.grid("""
    XXXx.....
    XXxXXx...
    XXXXXXXx.
    vvvvvvvvv
"""), {'ankle': (2, 0)})


def install_shoes(look):
    """The kit's shoe shapes (flat, toe, hang, heel, back, lie) as sneakers: black ones keep the kit
    shading (x body, X lit edge, v sole); white ones swap body and lines (X white body, x grey
    creases and laces, v grey sole) and use the cast sample's flat sneaker."""
    if look.sneaker != 'white':
        return
    sw = str.maketrans({'x': 'X', 'X': 'x'})
    for k, (rows, an) in list(P.SHOES.items()):
        P.SHOES[k] = ([r.translate(sw) for r in rows], an)
    P.SHOES['flat'] = SNEAKER_FLAT


# ------------------------------------------------------------------------------------ install
def sleeves(upper=3.0, shorts=7.4):
    """Short sleeves and shorts as a limb pattern: past `upper` px along the arm the sleeve ends in
    bare skin; past `shorts` px along the leg the shorts end in bare skin."""
    skin = ['S', 's', 'z', 'z']
    skinF = ['s', 's', 'z', 'z']

    def pat(part, u, v, k, ch):
        if part in ('armN', 'armF') and u > upper:
            return (skin if part == 'armN' else skinF)[k]
        if part in ('legN', 'legF') and u > shorts:
            return (skin if part == 'legN' else skinF)[k]
        return ch
    pose.HOOKS['pat'] = pat


def install(look):
    """Patch the shared rig tables for this look (one set per process, bake.py)."""
    pal = dict(BASE)
    pal.update(SNEAKERS[look.sneaker])
    pal.update(look.pal)
    # soot (the burn): the statue in three of the look's own dark tones
    for i, ch in enumerate(look.soot):
        pal[str(i)] = pal[ch]
    dark = dict(DARK)
    dark.update(look.dark)
    K.palette(pal, dark=dark, letters=''.join(ch for ch in BODY + ''.join(look.pal) if ch in pal and ch not in '012'))
    HK.install_limbs(*look.limbs)
    pose.THIGH, pose.SHIN = look.legs
    sleeves(*look.sleeves)
    pose.RAMP['arm'] = ['J', 'j', 'q', 'Q']
    pose.RAMP['armF'] = ['j', 'q', 'Q', 'Q']
    pose.RAMP['leg'] = ['P', 'p', 'o', 'O']
    pose.RAMP['legF'] = ['p', 'o', 'O', 'O']
    install_torsos(look)
    install_heads(look)
    install_hands()
    install_shoes(look)
    install_fx()
    if look.install_extra:
        look.install_extra()


# ------------------------------------------------------------------------------------ geometry
def shoulders(pel=(0, -17), torso='up'):
    """The near / far shoulder of a torso with its pelvis at pel (root coordinates)."""
    an = P.TORSOS[torso][1]
    px, py = an['pelvis']
    return ((pel[0] + an['shN'][0] - px, pel[1] + an['shN'][1] - py),
            (pel[0] + an['shF'][0] - px, pel[1] + an['shF'][1] - py))
