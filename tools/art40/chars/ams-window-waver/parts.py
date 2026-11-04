# The window waver's parts at 40 px (plan docs/design/ams40.md wave 5, rule 10): the canal-house
# sash window, the waver (golden bob, teal sweater) and the ginger window cat, all inside the 20 x 26
# box of the window entity (hitbox (-10, -26, 20, 26) above the sill anchor), never larger, never cut.
#
# The look is the cast spike's approved samples (docs/design/cast40/chars/ams-window-waver.py and
# ams-window-cat.py: white frame, dark glazed upper sash, the lower sash pushed up, red curtains, a
# white sill, the green tulip box; the waver leaning out over the sill; the cat on the sill with its
# striped tail hanging over the edge), fitted to the game's window box: the sample window was 26 x 44,
# the game's is 20 x 26, so the chrome is tighter (a 4-row upper sash, a 3-row box) and the waver's
# bob is two hair columns narrower; she keeps the hero scale (a 13-row head, the sweater shoulders).
#
# Coordinates: window pixels (0..19, 0..25), drawn FACING RIGHT (the set has face -1: the bake
# mirrors every frame, so she waves at the hero who arrives from the left). Row 0 and 25, column 0
# and 19 are the outline's. ROOT is the anchor: mirrored by the bake to (10, 26), the old one.
import castkit as K

WW, WH = 20, 26
# The canvas is larger than the window so a pixel outside the box is seen (and fails), not clipped.
PAD = 4
ROOT = (PAD + 9, PAD + WH)          # bake: ox = w - 1 - 9 = 10 after the mirror; oy = 26 (the sill line)

# ------------------------------------------------------------------------------------- palette
# 27 colours with the outline (budget 28). Shared tones: the eye white is the frame white; the cat
# reuses the skin (cream muzzle, pink nose), the hair shade (stripes), the box green (eyes) and the
# hair's darkest brown (pupils).
PAL = {
    'K': '#140c0e',                                            # the warm near-black outline
    # the painted white frame and sill (lit, mid, shade)
    'a': '#fbfaf4', 'k': '#d2d2d6', 'l': '#9a9aa6',
    # glass: a cool reflection over dark panes, the dim room behind the open sash
    'G': '#8aa4c4', 'g': '#3c4e70', 'n': '#232c46', 'N': '#141a2c',
    # red curtains (and red tulips)
    'R': '#c8343c', 'r': '#7c1a28',
    # the green flower box (and the cat's eyes), gold tulips
    'X': '#5c8a3c', 'x': '#355a26', 'Y': '#f6c834', 'V': '#c08a1c',
    # golden blond bob (lit, base, shade, the darkest brown: brows, pupils, mouth)
    'A': '#f0cc78', 'H': '#c89848', 'h': '#8c5a2c', 'Q': '#2e1c12',
    # fair skin; the eye white and the teeth are the frame white
    'L': '#ffe6d2', 'S': '#f6c0a0', 's': '#dc9276', 'z': '#a05a46', 'w': '#fbfaf4',
    # teal sweater (lit, mid, shade)
    'J': '#5cc4b4', 'j': '#2e9488', 'q': '#1a6260',
    # ginger fur (lit, mid); the stripes are the hair shade 'h'
    'C': '#f8ae5c', 'E': '#d87a30',
}
# selout: an edge pixel next to a nearer part takes its dark tone
DARK = {'a': 'l', 'k': 'l', 'l': 'l', 'G': 'n', 'g': 'n', 'n': 'N', 'N': 'K', 'R': 'r', 'r': 'r',
        'X': 'x', 'x': 'x', 'Y': 'V', 'V': 'V', 'A': 'h', 'H': 'h', 'h': 'Q', 'Q': 'Q',
        'L': 'z', 'S': 'z', 's': 'z', 'z': 'z', 'w': 'l', 'J': 'q', 'j': 'q', 'q': 'q',
        'C': 'h', 'E': 'h'}


def install():
    K.palette(PAL, dark=DARK)


def px(cv, x, y, ch, z, part):
    cv.px(PAD + x, PAD + y, ch, z, part)


def rect(cv, x0, y0, w, h, ch, z, part):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            px(cv, x, y, ch, z, part)


def grid(cv, x0, y0, rows, z, part):
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch not in '. ':
                px(cv, x0 + i, y0 + j, ch, z, part)


# ------------------------------------------------------------------------------------- the window
# rows: 1-2 the top rail, 3-6 the upper sash (two panes), 7-8 the meeting rail (the lower sash
# pushed up behind it), 9-18 the opening (the dim room, curtains at both sides), 19-21 the white
# sill (sticks out one pixel at each side), 22-24 the tulip box, cups in front of the sill's edge.
TOP, GLASS0, GLASS1, RAIL, OPEN0, SILL, BOX = 1, 3, 6, 7, 9, 19, 22
FX0, FX1 = 2, 17                  # the frame's outer columns (the sill spans 1..18)


def window_back(cv, curtain=0):
    """Everything behind the sitter: the room, the curtains, the upper sash, the frame and rail.
    curtain: a small sway of the curtains' inner folds (0 or 1) for the empty window."""
    # the dim room: darker at the top
    rect(cv, FX0 + 2, OPEN0, FX1 - FX0 - 3, SILL - OPEN0, 'N', 0, 'room')
    for x in range(FX0 + 4, FX1 - 3):
        px(cv, x, SILL - 1, 'n', 0.1, 'room')                    # the floor light under the sill
    # curtains gathered at both sides (a lit fold, the deep fold), held back halfway down
    for side in (0, 1):
        for y in range(OPEN0, SILL):
            tie = 1 if 13 <= y <= 14 else 0
            if side == 0:
                cols = [(FX0 + 2, 'R'), (FX0 + 3, 'r')]
                if y < 13 or y > 15:
                    cols.append((FX0 + 4, 'R' if (y + curtain) % 5 else 'r'))
            else:
                cols = [(FX1 - 1, 'r'), (FX1 - 2, 'R')]
                if y < 13 or y > 15:
                    cols.append((FX1 - 3, 'r' if (y + curtain) % 5 else 'R'))
            for x, ch in cols:
                px(cv, x, y, 'Y' if tie and ch == 'R' else ch, 0.5, 'curtain')
    # the upper sash: two panes of dark glass, a diagonal reflection, the glazing bar
    for y in range(GLASS0, GLASS1 + 1):
        for x in range(FX0 + 2, FX1 - 1):
            d = (x - FX0) + (y - GLASS0)
            ch = 'G' if d in (5, 13) else 'g' if d in (4, 6, 12, 14) else 'n'
            px(cv, x, y, ch, 0.5, 'glass')
    mid = (FX0 + FX1) // 2
    for y in range(GLASS0, GLASS1 + 1):
        px(cv, mid, y, 'a', 1, 'frame')
        px(cv, mid + 1, y, 'k', 1, 'frame')
    # the frame: lit top and left, shaded right
    rect(cv, FX0, TOP, FX1 - FX0 + 1, 2, 'a', 1, 'frame')
    for x in range(FX0 + 1, FX1):
        px(cv, x, TOP + 1, 'k', 1, 'frame')
    for y in range(TOP, SILL):
        px(cv, FX0, y, 'a', 1, 'frame')
        px(cv, FX0 + 1, y, 'k' if y > TOP else 'a', 1, 'frame')
        px(cv, FX1 - 1, y, 'k', 1, 'frame')
        px(cv, FX1, y, 'l', 1, 'frame')
    # the meeting rail
    for x in range(FX0 + 2, FX1 - 1):
        px(cv, x, RAIL, 'a', 1.2, 'frame')
        px(cv, x, RAIL + 1, 'l', 1.2, 'frame')


TULIPS = [(4, 'R'), (7, 'Y'), (10, 'R'), (13, 'Y'), (16, 'R')]


def window_front(cv, z=30, skip=()):
    """The sill and the tulip box (in front of the sitter). skip = tulip columns left out."""
    rect(cv, 1, SILL, WW - 2, 1, 'a', z, 'sill')
    rect(cv, 1, SILL + 1, WW - 2, 1, 'k', z, 'sill')
    rect(cv, 1, SILL + 2, WW - 2, 1, 'l', z, 'sill')
    px(cv, 1, SILL + 1, 'a', z, 'sill')
    # the flower box: planks, a dark joint, the shaded bottom board
    rect(cv, 2, BOX, WW - 4, 2, 'X', z, 'box')
    rect(cv, 2, BOX + 2, WW - 4, 1, 'x', z, 'box')
    for x in (6, 12):
        px(cv, x, BOX + 1, 'x', z, 'box')
    # tulips: a two-row cup in front of the sill's lower edge, a leaf on the box
    for x, c in TULIPS:
        if x in skip:
            continue
        dark = 'r' if c == 'R' else 'V'
        part = 'tulip%d' % x
        px(cv, x - 1, SILL + 1, c, z + 1, part)
        px(cv, x + 1, SILL + 1, dark, z + 1, part)
        px(cv, x - 1, SILL + 2, c, z + 1, part)
        px(cv, x, SILL + 2, c, z + 1, part)
        px(cv, x + 1, SILL + 2, dark, z + 1, part)
        px(cv, x + 1, BOX, 'x', z + 1, part)


# ------------------------------------------------------------------------------------- the waver
# The approved bob (cast sample) two back-hair columns narrower: a side fringe, a bright eye, a
# wide open smile. Facing right; 'neck' = the jaw's bottom middle.
HEAD = K.grid("""
    ...hhHHHh....
    .hhHAAHAAAH..
    hHAAAAHAAAAH.
    hHAAHHAAAAAAh
    hHHHAAAAHHSSh
    hHHHHHsSSQQSL
    hHHHHsSSSwQSSL
    hHHHzsSSSSSSSL
    hHHHzsSSSSSsSs
    hHhhssSSSzzzs.
    hhhQsSSSzwwwz.
    .hh.QsSSSzzs..
    .....zsssss...
""")
HEAD_NECK = (7, 12)
# the blink: the eye shut (a lash line), the smile closes a little
HEAD_BLINK = K.grid("""
    ...hhHHHh....
    .hhHAAHAAAH..
    hHAAAAHAAAAH.
    hHAAHHAAAAAAh
    hHHHAAAAHHSSh
    hHHHHHsSSSSSL
    hHHHHsSSSQQSSL
    hHHHzsSSSSSSSL
    hHHHzsSSSSSsSs
    hHhhssSSSzzzs.
    hhhQsSSSzwwzs.
    .hh.QsSSSzzs..
    .....zsssss...
""")
# the call: the mouth wide open ("hoi!"), brows up
HEAD_CALL = K.grid("""
    ...hhHHHh....
    .hhHAAHAAAH..
    hHAAAAHAAAAH.
    hHAAHHAAAQQh.
    hHHHAAAAHSSSh
    hHHHHHsSSSSSL
    hHHHHsSSSwQSSL
    hHHHzsSSSSSSSL
    hHHHzsSSSSzzzs
    hHhhssSSzwwwz.
    hhhQsSSSzrrrz.
    .hh.QsSSSzrz..
    .....zsssss...
""")
HEADS = {'fwd': HEAD, 'blink': HEAD_BLINK, 'call': HEAD_CALL}

# the back of the bob: the hair ends swing with the head (secondary motion): extra pixels per
# swing state (dx, dy, letter) relative to the head's top-left; 'in' trims the hair end instead
HAIR_SWING = {
    -1: [(-1, 9, 'h'), (-1, 10, 'h'), (0, 11, 'h')],      # the ends trail out (left)
    0: [],
    1: [(0, 10, '.'), (1, 11, '.')],                     # the ends tuck in (right)
}

# the teal sweater: the shoulders and the chest over the sill, the ribbed neck under the chin
TORSO = K.grid("""
    ....qjJJj....
    .qjjjjJJJJJ..
    qjjjjjJJJJJJ.
    qjjqjjjJJJJJJ
    qjjqjjjjJJJJj
    qjjjqjjjjJJJj
""")
TORSO_NECK = (7, -1)               # the head's neck point sits one row above the collar
SH_F = (3, 2)                      # far shoulder (in the torso grid)
SH_N = (9, 2)                      # near shoulder

# hands: the waving hand (palm out, fingers spread) in three tilts, the hand resting on the sill,
# the hand coming up (half open). Anchor 'wrist' = where the forearm ends.
HAND_UP = (K.grid("""
    .S.S.
    SLSLS
    SLSSs
    SSSSs
    .SSs.
"""), (2, 4))
HAND_OUT = (K.grid("""
    S.S...
    .SLS.S
    .SSSSs
    ..SSSs
    ...Ss.
"""), (3, 4))
HAND_IN = (K.grid("""
    ...S.S
    S.SLS.
    sSSLS.
    sSSSS.
    .sSS..
"""), (2, 4))
HAND_HALF = (K.grid("""
    .SS.
    SLSS
    SSSs
    .Ss.
"""), (2, 3))
HAND_REST = (K.grid("""
    LSSs
    SSss
"""), (0, 0))

ARM_N = ['J', 'J', 'j', 'q']       # near arm (lit)
ARM_F = ['j', 'j', 'q', 'q']       # far arm (in the shade)

# ------------------------------------------------------------------------------------- the cat
# The approved ginger tabby (cast sample) in front view: cream muzzle, chest and paws, pink nose and
# inner ears, green eyes with dark slits (toward the hero: right here, left after the mirror).
# Letters: C lit fur, E mid, h stripes and shade, L cream, S pink, X green eyes, Q pupils.
CAT = K.grid("""
    .h....h.
    .CS..SE.
    CChCChCE
    CLXQCXQE
    CCLSSLCE
    .CLLLLE.
    .CCLLCE.
    CChLLChE
    CCCLLCEE
    ChCLLChE
    .LL..LL.
""")
# eyes: look at the hero (default), look away (to the street), shut (the slow blink)
CAT_EYES = {'hero': 'CLXQCXQE', 'away': 'CLQXCQXE', 'shut': 'CLhhChhE', 'half': 'CLQQCQQE'}
# the ear flick: the near ear (right) folds back for a frame
CAT_EARS = {'up': ('.h....h.', '.CS..SE.'), 'flick': ('.h......', '.CS..hEh')}
CAT_AT = (6, SILL - 11)            # top-left of the cat (its paws on the sill)
