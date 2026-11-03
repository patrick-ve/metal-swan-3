# The window waver (ams): a canal-house sash window on the first floor (white frame, dark glass, the
# lower sash pushed up, red curtains, a white sill, a tulip box under it) with a person in a teal
# sweater leaning out over the sill and waving. ams-window-cat uses window() here with a cat inside.
# Drawn facing right, mirrored by cast.py (face=-1: she waves at the hero arriving from the left).
# Scale: the opening is about 1 m wide for a 40 px man; the whole window about 1.2 x 1.9 m.
import castkit as K

INFO = dict(
    name='WINDOW WAVER', mission=['ams'], role='npc', kind='HUMANOID', face=-1,
    pose='leans out over the sill, waving high with the far hand behind her head, the near forearm on the sill',
    note='A canal-house sash window at the hero scale (white frame, dark glazed upper sash, the lower '
         'sash pushed up, red curtains, tulip box); the person is now a full-size upper body (bob, '
         'teal sweater) leaning out instead of a small figure behind the glass.',
    old='npc/ams/ams-window-waver/person#2', air=30,
)

WINDOW_PAL = {
    # painted white frame and sill (a lit, k mid, l shade)
    'a': '#fbfaf4', 'k': '#d2d2d6', 'l': '#9a9aa6',
    # glass: a cool reflection (G, g) over dark panes (n), the dim room behind the open sash (N)
    'G': '#8aa4c4', 'g': '#3c4e70', 'n': '#232c46', 'N': '#141a2c',
    # red curtains (and the red tulips)
    'R': '#c8343c', 'r': '#7c1a28',
    # the flower box (green-painted wood) and the tulips' leaves; gold tulips
    'X': '#5c8a3c', 'x': '#355a26', 'Y': '#f6c834', 'V': '#c08a1c',
}
WINDOW_DARK = {'a': 'l', 'k': 'l', 'l': 'l', 'G': 'n', 'g': 'n', 'n': 'N', 'N': 'K', 'R': 'r', 'r': 'r',
               'X': 'x', 'x': 'x', 'Y': 'V', 'V': 'V'}

WW, WH = 26, 44          # the window's box (frame + sill + box), top-left at (OX, OY) on the canvas
OX, OY = 10, 6
SILL_Y = 36              # top row of the sill (window coordinates)
RAIL_Y = 12              # the meeting rail: the upper sash is above it, the opening below


def _rect(cv, x0, y0, w, h, ch, z, part):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            cv.px(OX + x, OY + y, ch, z, part)


def window_back(cv):
    """The frame, the upper sash and the dark room with the curtains (everything behind the sitter)."""
    # the dim room in the opening (darker at the top and the sides)
    _rect(cv, 2, RAIL_Y + 2, WW - 4, SILL_Y - RAIL_Y - 2, 'N', 0, 'room')
    # curtains gathered at both sides of the opening, a fold line in each
    for x0, fold in ((2, 3), (WW - 6, WW - 4)):
        _rect(cv, x0, RAIL_Y + 2, 4, SILL_Y - RAIL_Y - 2, 'R', 0.5, 'curtain')
        for y in range(RAIL_Y + 2, SILL_Y):
            cv.px(OX + fold, OY + y, 'r', 0.5, 'curtain')
    # the upper sash: two panes of dark glass with a diagonal reflection, a glazing bar between
    _rect(cv, 2, 2, WW - 4, RAIL_Y - 2, 'n', 0.5, 'glass')
    for x in range(2, WW - 2):
        for y in range(2, RAIL_Y):
            d = (x - 2) + (y - 2)
            if d in (6, 7, 16, 17):
                cv.px(OX + x, OY + y, 'g', 0.6, 'glass')
            elif d in (8, 18):
                cv.px(OX + x, OY + y, 'G', 0.6, 'glass')
    _rect(cv, WW // 2 - 1, 2, 2, RAIL_Y - 2, 'k', 1, 'frame')
    for y in range(2, RAIL_Y):
        cv.px(OX + WW // 2 - 1, OY + y, 'a', 1, 'frame')
    # the outer frame: lit top and front-left edges, shaded right edge
    _rect(cv, 0, 0, WW, 2, 'a', 1, 'frame')
    _rect(cv, 0, 0, 2, SILL_Y, 'a', 1, 'frame')
    _rect(cv, WW - 2, 0, 2, SILL_Y, 'k', 1, 'frame')
    for y in range(2, SILL_Y):
        cv.px(OX + 1, OY + y, 'k', 1, 'frame')
        cv.px(OX + WW - 1, OY + y, 'l', 1, 'frame')
    for x in range(1, WW - 1):
        cv.px(OX + x, OY + 1, 'k', 1, 'frame')
    # the meeting rail: the lower sash pushed up behind the upper one
    _rect(cv, 2, RAIL_Y, WW - 4, 2, 'a', 1.2, 'frame')
    for x in range(2, WW - 2):
        cv.px(OX + x, OY + RAIL_Y + 1, 'k', 1.2, 'frame')
        cv.px(OX + x, OY + RAIL_Y + 2, 'l', 1.2, 'frame')


TULIPS = [(3, 'R'), (7, 'Y'), (11, 'R'), (15, 'Y'), (19, 'R'), (23, 'Y')]


def window_front(cv, z=30, skip=()):
    """The sill and the tulip box (in front of the sitter). skip = tulip columns left out (a tail)."""
    # the sill: a white slab sticking out one pixel at each side, lit on top
    _rect(cv, -1, SILL_Y, WW + 2, 3, 'k', z, 'sill')
    _rect(cv, -1, SILL_Y, WW + 2, 1, 'a', z, 'sill')
    _rect(cv, -1, SILL_Y + 2, WW + 2, 1, 'l', z, 'sill')
    # the flower box under the sill
    _rect(cv, 1, SILL_Y + 4, WW - 2, 4, 'X', z, 'box')
    _rect(cv, 1, SILL_Y + 7, WW - 2, 1, 'x', z, 'box')
    for x in range(1, WW - 1, 5):
        cv.px(OX + x, OY + SILL_Y + 5, 'x', z, 'box')
        cv.px(OX + x, OY + SILL_Y + 6, 'x', z, 'box')
    # tulips: a stem and a leaf from the box, a two-row cup in front of the sill edge
    for x, c in TULIPS:
        if x in skip:
            continue
        dark = 'r' if c == 'R' else 'V'
        cv.px(OX + x, OY + SILL_Y + 3, 'x', z + 1, 'tulip%d' % x)
        cv.px(OX + x + 1, OY + SILL_Y + 3, 'X', z + 1, 'tulip%d' % x)
        for dx, ch in ((0, c), (1, c), (2, dark)):
            cv.px(OX + x - 1 + dx, OY + SILL_Y + 2, ch, z + 1, 'tulip%d' % x)
        cv.px(OX + x - 1, OY + SILL_Y + 1, c, z + 1, 'tulip%d' % x)
        cv.px(OX + x + 1, OY + SILL_Y + 1, dark, z + 1, 'tulip%d' % x)


def canvas():
    return K.Canvas(WW + 24, WH + 16)


def root():
    """The ground point: under the middle of the window, at the bottom of the tulip box."""
    return (OX + WW // 2, OY + SILL_Y + 8)


# ------------------------------------------------------------------ the waver
WAVER_PAL = {
    # golden blond bob
    'A': '#f0cc78', 'H': '#c89848', 'h': '#8c602c', 'Q': '#2e1c12',
    # fair skin
    'L': '#ffe6d2', 'S': '#f6c0a0', 's': '#dc9276', 'z': '#a05a46', 'w': '#fffaf0',
    # teal sweater (J lit, j mid, q shade); T / t = the cuffs of the stock hands
    'J': '#5cc4b4', 'j': '#2e9488', 'q': '#1a6260', 'T': '#5cc4b4', 't': '#1a6260',
}
WAVER_DARK = {'J': 'q', 'j': 'q', 'q': 'q', 'T': 't', 't': 't'}

# a rounded bob to the jaw with a side fringe, a bright eye, a wide open smile
HEAD = K.grid("""
    ....hhHHHHh....
    ..hhHAAAHAAAH..
    .hHAAAAHAAAAAH.
    hHHAAHHAAAAAAAh
    hHHHHHAAAAHHSSh
    hHHHHHHHsSSQQSL
    hHHHHHsSSSwQSSL
    hHHHHzsSSSSSSSSL
    hHHHHzsSSSSSsSs
    hHhhHssSSSzzzs.
    hhhhQsSSSzwwwz.
    .hh..QsSSSzzs..
    ......zsssss...
""")

# the teal sweater: a ribbed neck, a rib at the hem
TORSO = K.grid("""
    .qjJjJJJj...
    qjjjJJJJJJ..
    qjjjJJJJJJJ.
    qjjjjJJJJJJJ
    qjjqjJJJJJJJ
    qjjqjjJJJJJJ
    qjjjqjjJJJJj
    qjjjqjjjJJJj
    qqjjjqjjjJjq
    qjqjqjqjqjqq
    .qqqqqqqqqq.
""")
TAN = {'neck': (6, -2), 'pelvis': (6, 9), 'shN': (6.5, 2.5), 'shF': (3.5, 3.0)}

SPREAD = (K.grid("""
    S.S.S
    SSSSS
    SSSSs
    .SSs.
    .TT..
"""), {'wrist': (1.5, 4.5)})
REST = (K.grid("""
    TSSSS
    TSSSs
"""), {'wrist': (0, 0.5)})


def person(cv, upper, pel, zu=10):
    """Draw an upper-body pose with its pelvis at the canvas point pel (in front of the window)."""
    X = K.pose.Ctx(1)
    meta = {'pel': pel}
    K.pose.draw_upper(cv, X, upper, pel, zu, meta)
    return meta


def frame():
    K.palette({**WINDOW_PAL, **WAVER_PAL}, dark={**WINDOW_DARK, **WAVER_DARK})
    K.P.HEADS['fwd'] = (HEAD, {'neck': (6, 12)})
    K.P.TORSOS['up'] = (TORSO, TAN)
    K.P.TORSOS['lean'] = K.P.shear(K.P.TORSOS['up'], 2)
    K.P.HANDS['spread'] = SPREAD
    K.P.HANDS['rest'] = REST
    K.pose.RAMP['arm'] = ['J', 'J', 'j', 'q']
    K.pose.RAMP['armF'] = ['j', 'j', 'q', 'q']
    K.pose.UPPER, K.pose.FORE = 7.0, 6.5
    cv = canvas()
    window_back(cv)
    # the pelvis sits just below the sill top, so the sweater hem hides behind the sill
    pel = (OX + 11, OY + SILL_Y + 1)
    # she waves with the far hand, high behind her head (the face stays clear); the near forearm
    # lies on the sill
    up = K.A.up(torso='lean', far=K.A.hand((-6, -11), 'spread', 'hand', bend=1),
                near=K.A.hand((8, 3.5), 'rest', 'hand', bend=-1))
    person(cv, up, pel)
    window_front(cv)
    return K.finish(cv, root())
