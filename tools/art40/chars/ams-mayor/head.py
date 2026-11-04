# MECHA HASLEMA: the head piece (game id boss/ams-mayor/head-<stage>): the steel robot face plate and
# the long wave locks, in the boss's local coordinates (facing right). A robot mask: no likeness of
# any real person. Frames of the game strip: 0 smile, 1 hatch open, 2 shout, 3 blink, 4 off, 5 bald;
# this look builds 'smile' and 'shout' (wave 6 adds the others on the same geometry).
import math

from . import cv
from .cv import Layer, polymask, ellmask, sphere_l, pick, line, seam, rivet, catmull, LX, LY, LZ
from . import wig as W
from .pal import STEEL, GOLD, step

FACE = [(-8, -151), (4, -155), (15, -154), (20, -150), (22, -143), (23, -136), (23, -130), (22, -124),
        (21, -119), (19, -113), (16, -108), (13, -105), (8, -105), (3, -108), (-3, -111), (-7, -112),
        (-9, -116), (-9, -126), (-9, -138), (-9, -146)]
FACE_C = (5.0, -132.0, 19.0, 27.0)            # the sphere the plate is shaded on
FACE_Z = 7.0

# the eye slots: x0, x1 (exclusive), the top rim row; the hot core sits toward the front (+x)
EYES = [(0, 9, -140), (14, 20, -138)]

# --------------------------------------------------------------------------------------- the plate
def face_plate(L):
    fm = polymask(FACE)
    cx, cy, rx, ry = FACE_C
    for (x, y) in sorted(fm):
        L.put(x, y, pick(sphere_l(x, y, cx, cy, rx, ry), (0.90, 0.78, 0.62, 0.42, 0.18), STEEL), FACE_Z, 'face')
    # the plate seams: the forehead plate, the cheek plate down to the jaw hinge, the jaw line
    seam(L, [(-7, -147), (0, -149), (7, -149), (11, -148)], dk=2, side=(0, 1))
    seam(L, [(-3, -129), (-2, -124), (0, -119), (1, -114)], dk=2, side=(1, 0))
    seam(L, [(1, -133), (-3, -131), (-8, -131)], dk=1, side=(0, 1))
    seam(L, [(3, -109), (8, -108), (13, -107)], dk=1, side=(0, -1))
    # the specular streak along the brow ridge and the cheekbone (lit from the upper front)
    for (x, y) in ((15, -147), (16, -147), (17, -146), (18, -146), (19, -145)):
        L.over(x, y, '0')
    for (x, y) in ((20, -132), (21, -131), (21, -130)):
        L.over(x, y, '1')
    L.over(21, -129, '0')
    # rivets on the plate edges
    for (x, y) in ((-7, -144), (-7, -137), (-7, -126), (19, -124), (8, -146)):
        rivet(L, x, y)
    return fm


def eyes(L, mode='open', flicker=False):
    """The eye slots. mode: 'open' (the glare), 'up' (the cores look up: the hatch), 'narrow' (the
    upper rim row covered: the shout), 'half' (the steel lids half down: the blink in-between),
    'shut' (the lids closed: the blink), 'off' (dead glass: the death), 'dizzyA' / 'dizzyB' (the
    cores roll to the slot ends, swapped on B)."""
    for n, (x0, x1, y0) in enumerate(EYES):
        hx, hy = x1 - 2.5, y0 + 2.5                       # the white-hot core, toward the front
        if mode == 'up':
            hy -= 1.0
        elif mode in ('dizzyA', 'dizzyB'):
            left = (n == 0) == (mode == 'dizzyA')
            hx = x0 + 1.5 if left else x1 - 1.5
            hy = y0 + (1.6 if left else 3.0)
        for x in range(x0, x1):
            L.put(x, y0, '7', FACE_Z + 0.25, 'eye')       # the socket's upper rim (in shadow)
            for y in (y0 + 1, y0 + 2, y0 + 3):
                d = math.hypot((x + 0.5 - hx) * 0.8, (y + 0.5 - hy) * 1.3)
                ch = 'u' if d < 0.9 else 'v' if d < 1.7 else 'w' if d < 2.9 else 'x' if d < 4.6 else 'y'
                if x in (x0, x1 - 1):
                    ch = 'z' if y != y0 + 2 else 'y'
                if flicker and n == 1:
                    ch = step(ch, 2)
                lid = {'narrow': 1, 'half': 2, 'shut': 3}.get(mode, 0)
                if y - y0 <= lid:
                    # the steel eyelid: lit on its rounded front edge, the lowest row its lip
                    ch = '2' if y - y0 == 1 and mode != 'narrow' else '3' if y - y0 < lid else '5'
                    if mode == 'narrow':
                        ch = '6'
                elif mode == 'off':
                    ch = '6' if x in (x0, x1 - 1) else ('5' if (x - x0) == 1 and y == y0 + 1 else '7')
                L.put(x, y, ch, FACE_Z + 0.25, 'eye')
            L.put(x, y0 + 4, 'z' if x0 < x < x1 - 1 and mode not in ('shut', 'off') else '6', FACE_Z + 0.25, 'eye')
        if mode in ('open', 'up', 'narrow', 'half', 'dizzyA', 'dizzyB'):
            gy = y0 + 1 if mode not in ('narrow', 'half') else y0 + 3
            gx = x1 - 3 if mode not in ('dizzyA', 'dizzyB') else int(hx)
            L.put(gx, gy, 'u', FACE_Z + 0.26, 'eye')      # a glint on the glass
        elif mode == 'off':
            L.put(x0 + 1, y0 + 1, '4', FACE_Z + 0.26, 'eye')   # the dead glass still reflects the sky


def brows(L, bent=False, lift=0, drop=0):
    """Two heavy steel plates angled down to the nose (the glare); they overlap the eyes' inner ends.
    lift: px up (surprise: the hatch); drop: px down at the inner end (the shout)."""
    for x in range(-2, 10):
        y = -146 + (x + 2) * 6 // 11 - lift + (drop if x >= 4 else drop // 2)
        for d, ch in ((0, '1'), (1, '2'), (2, '4'), (3, '6')):
            L.put(x, y + d, ch, FACE_Z + 0.3, 'brow')
    L.put(-3, -145 - lift, '3', FACE_Z + 0.3, 'brow')
    L.put(-3, -144 - lift, '5', FACE_Z + 0.3, 'brow')
    for x in range(13, 22):
        y = -141 - (x - 13) * 3 // 8 + (1 if bent and x >= 18 else 0) - lift + (drop if x <= 16 else drop // 2)
        for d, ch in ((0, '1' if x < 17 else '2'), (1, '3'), (2, '6')):
            L.put(x, y + d, ch, FACE_Z + 0.3, 'brow')


def nose(L):
    for y in range(-135, -126):
        L.put(12, y, '4', FACE_Z + 0.3, 'nose')
        L.put(13, y, '1' if y < -130 else '2', FACE_Z + 0.3, 'nose')
    L.put(13, -134, '0', FACE_Z + 0.31, 'nose')
    for (x, ch) in ((11, '5'), (12, '6'), (13, '6'), (14, '4')):
        L.put(x, -126, ch, FACE_Z + 0.3, 'nose')         # the vent under the ridge


def mouth(L, kind='smile'):
    """The mouth grille: a rimmed speaker grille, steel slats over a red inner glow. kind: 'smile'
    (the corners turn up: smug), 'half' (opening: the shout's in-between), 'shout' (wide open, the
    glow hot), 'off' (no glow), 'wobble' (dizzy: a wavering line)."""
    for x in range(3, 20):
        u = (x - 11) / 8.0
        corner = 1 if x <= 4 or x >= 18 else 0
        if kind == 'shout':
            top, bot = -121, -110 + round(1.5 * u * u)
        elif kind == 'half':
            top, bot = -121, -113 + round(1.0 * u * u) - corner
        elif kind == 'wobble':
            wv = round(math.sin((x - 3) * 0.9))
            top, bot = -119 + wv, -116 + wv
        else:
            top = -120 - corner                                   # the corners turn up: a smug smile
            bot = -115 + round(1 - u * u) - corner
        L.put(x, top - 1, '2' if x > 6 else '3', FACE_Z + 0.3, 'mouth')      # the lit upper lip edge
        for y in range(top, bot + 1):
            if y == top or x in (3, 19):
                ch = '6'
            elif y == bot:
                ch = '5'
            elif kind in ('shout', 'half'):
                hot = 1 - abs(u)
                if x % 3 == 0:
                    ch = '4' if y == top + 1 else '3'
                elif kind == 'half':
                    ch = 'w' if hot > 0.6 and y > top + 1 else 'x' if y < bot - 1 or hot > 0.3 else 'y'
                else:
                    ch = 'w' if hot > 0.5 and y > top + 2 else 'x' if y < bot - 1 else 'y'
            elif kind == 'off':
                ch = ('4' if y == top + 1 else '5') if x % 2 == 0 else '7'
            else:
                ch = ('3' if y == top + 1 else '4') if x % 2 == 0 else ('y' if y == top + 1 else 'z')
            L.put(x, y, ch, FACE_Z + 0.3, 'mouth')
        L.put(x, bot + 1, '2' if 5 < x < 17 else '3', FACE_Z + 0.3, 'mouth')   # the lit lower lip
    # the chin plate under the grille
    cy = {'shout': -107, 'half': -109}.get(kind, -110)
    for x in range(7, 15):
        L.over(x, cy, '1' if 8 < x < 14 else '2')


def jaw_bolt(L):
    ball = cv.ball(L, -4.5, -120.5, 2.9, GOLD, FACE_Z + 0.4, 'bolt', cuts=(0.88, 0.62, 0.30, 0.0))
    L.put(-5, -121, 'k', FACE_Z + 0.41, 'bolt')
    L.put(-4, -122, 'g', FACE_Z + 0.41, 'bolt')
    return ball


# ------------------------------------------------------------------------------------------ damage
def dent(L, cx, cy, r):
    """A dent: the inside of the crater faces away from the light on its upper-left side."""
    for (x, y) in sorted(ellmask(cx, cy, r, r * 0.8)):
        ch = L.get(x, y)
        if ch is None or L.sub(x, y) != 'face':
            continue
        upper_left = (x + 0.5 - cx) + (y + 0.5 - cy) < 0
        L.over(x, y, step(ch, 2 if upper_left else -1))


def scratch(L, pts):
    for (x, y) in line(Layer('tmp'), pts, 'x', 0, ''):
        if L.sub(x, y) == 'face':
            L.over(x, y, '1')
            if L.sub(x, y + 1) == 'face':
                L.over(x, y + 1, step(L.get(x, y + 1), 2))


def damage_1(L):
    scratch(L, [(15, -131), (19, -127)])
    scratch(L, [(-6, -128), (-3, -125)])
    scratch(L, [(1, -133), (4, -131)])
    dent(L, 6.5, -127.5, 2.4)
    L.over(-7, -126, '7')                     # a rivet is gone: its hole
    L.over(-6, -126, '6')
    L.over(-7, -125, '5')


def damage_2(L):
    damage_1(L)
    # cracks running out of the dent (dark with a lit lip)
    for pts in ([(6, -128), (4, -125), (5, -122)], [(7, -129), (10, -131), (11, -134)]):
        for (x, y) in line(Layer('tmp'), pts, 'x', 0, ''):
            if L.sub(x, y) == 'face':
                L.over(x, y, '7')
                if L.sub(x + 1, y) == 'face':
                    L.over(x + 1, y, '2')
    # a cheek plate torn away: the cavity with its circuit and cut wires
    hole = polymask([(-9, -137), (-2, -138), (2, -133), (1, -126), (-5, -123), (-9, -127)])
    for (x, y) in sorted(hole):
        if L.sub(x, y) not in ('face',):
            continue
        rim_ul = (x - 1, y) not in hole or (x, y - 1) not in hole
        rim_lr = (x + 1, y) not in hole or (x, y + 1) not in hole
        ch = '7'
        if rim_ul:
            ch = '6'                          # the plate's thickness in shadow
        elif rim_lr:
            ch = '2'                          # the torn edge catches the light
        elif (x + y) % 4 == 0 and y < -129:
            ch = 'I'                          # a circuit trace
        L.over(x, y, ch, 'hole')
    for (x, y, ch) in ((-5, -134, 'H'), (-3, -131, 'G'), (-6, -130, 'H'), (-2, -134, 'I'),
                       (-4, -128, 'S'), (-3, -127, 'T'), (-2, -127, 'U'), (-1, -131, 'i'), (-1, -130, 'j'), (0, -130, 'j')):
        if L.get(x, y) is not None:
            L.over(x, y, ch)
    # soot round the wound and over the brow (FX warm greys)
    for (x, y) in sorted(ellmask(-4.0, -139.5, 4.5, 2.6)):
        ch = L.get(x, y)
        if ch and L.sub(x, y) in ('face', 'brow') and ch in STEEL[:4] + ['0']:
            L.over(x, y, '8' if ch in ('0', '1', '2') else '9')
    # sparks off the torn wires (FX, no outline)
    for (x, y, ch) in ((-11, -132, '+'), (-12, -133, '*'), (-10, -134, '*'), (-13, -131, '^'), (-13, -134, '^'),
                       (-14, -135, '~'), (-12, -130, '*')):
        L.put(x, y, ch, 20.0, 'fx')


# ------------------------------------------------------------------------------------- bald (death)
SKULL = (-3.0, -139.0, 19.0, 24.0)


def skull(L, stage=0):
    """The steel cranium under the wig (after it flies off at the death): a dome behind the face plate
    with a seam ring, rivets, the closed letter hatch on top, the three pegs the wig clipped onto and
    an audio port at the side. A comic reveal: the iron mayor was bald all along."""
    cx, cy, rx, ry = SKULL
    m = ellmask(cx, cy, rx, ry)
    for (x, y) in sorted(m):
        ch = pick(sphere_l(x, y, cx + 3, cy - 2, rx + 2, ry), (0.92, 0.80, 0.64, 0.44, 0.20), STEEL)
        L.put(x, y, ch, FACE_Z - 1.0, 'skull')
    # the specular streak on the dome (upper front)
    for (x, y) in ((6, -158), (7, -158), (8, -157), (9, -156), (10, -155)):
        L.over(x, y, '0')
    for (x, y) in ((4, -159), (5, -159), (11, -154)):
        L.over(x, y, '1')
    # the seam ring round the back of the dome (a dark line with a lit lip on its front)
    seam(L, [(-6, -162), (-12, -159), (-17, -152), (-19, -142), (-18, -131), (-15, -122)], dk=2, side=(1, 0))
    for (x, y) in ((-11, -157), (-17, -146), (-17, -133)):
        rivet(L, x, y)
    # the hatch lid in the crown, shut: a steel oval with its seam and a hinge at the back
    hx, hy = W.HATCH_C
    for (x, y) in sorted(ellmask(hx + 1, hy + 2.5, 7.0, 2.4)):
        if L.get(x, y) is None:
            continue
        edge = (x, y + 1) not in m or not ((x + 0.5 - hx - 1) / 7.0) ** 2 + ((y + 1.5 - hy - 2.5) / 2.4) ** 2 <= 1
        L.over(x, y, '5' if edge else ('2' if x > hx + 1 else '3'))
    L.over(int(hx) - 6, int(hy) + 2, '6')
    # the wig pegs: three short gold studs it clipped onto
    for (x, y) in ((-13, -160), (3, -163), (-19, -147)):
        L.put(x, y - 1, 'h', FACE_Z - 0.9, 'peg')
        L.put(x + 1, y - 1, 'i', FACE_Z - 0.9, 'peg')
        L.put(x, y, 'i', FACE_Z - 0.9, 'peg')
        L.put(x + 1, y, 'k', FACE_Z - 0.9, 'peg')
    # the audio port at the side of the head: three slats in a round recess
    for (x, y) in sorted(ellmask(-12.5, -134.5, 3.4, 3.4)):
        if L.sub(x, y) == 'skull':
            L.over(x, y, '5' if (x + 0.5 + 12.5) + (y + 0.5 + 134.5) < 0 else '3')
    for y in (-136, -134, -132):
        for x in (-14, -13, -12):
            if L.sub(x, y) == 'skull':
                L.over(x, y, '7')
    if stage >= 1:
        for pts in ([(-13, -150), (-9, -147)], [(0, -160), (4, -157)]):
            for (x, y) in line(Layer('t'), pts, 'x', 0, ''):
                if L.sub(x, y) == 'skull':
                    L.over(x, y, '1')
                    if L.sub(x, y + 1) == 'skull':
                        L.over(x, y + 1, step(L.get(x, y + 1), 2))
    if stage >= 2:
        for (x, y) in sorted(ellmask(-8.0, -152.0, 4.0, 2.6)):
            if L.sub(x, y) == 'skull':
                L.over(x, y, '8' if L.get(x, y) in ('0', '1', '2') else '9')


def stars(L, k):
    """Dizzy stars orbiting over the bald dome (FX, no outline): three small stars on a flat orbit,
    a third of a turn apart; k = 0 / 1 moves them on by a sixth."""
    for i in range(3):
        a = 2 * math.pi * (i / 3 + k / 6) + 0.4
        x = round(-1 + 15 * math.cos(a))
        y = round(-168 + 3.5 * math.sin(a))
        near = math.sin(a) > 0
        L.put(x, y, '+' if near else '*', 20.0, 'fx')
        for (dx, dy) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            L.put(x + dx, y + dy, '*' if near else '^', 20.0, 'fx')


# ------------------------------------------------------------------------------------------ public
# The head strip's frames (one strip per damage stage, the same frames at every stage). 0..5 are the
# game's roles today (mayor.ts / layout.ts); 6..9 are the new in-betweens (exported constants).
FRAMES = [
    # name, wig hatch | 'bald', eyes, brows (bent, lift, drop), mouth, stars
    ('smile', 'closed', 'open', (0, 0), 'smile', None),       # 0 HEAD_SMILE
    ('hatch', 'open', 'up', (2, 0), 'smile', None),            # 1 HEAD_HATCH   (letter rain)
    ('shout', 'closed', 'narrow', (0, 2), 'shout', None),      # 2 HEAD_SHOUT
    ('blink', 'closed', 'shut', (0, 0), 'smile', None),        # 3 HEAD_BLINK   (blink / powered off)
    ('off', 'bald', 'off', (0, 1), 'off', None),               # 4 HEAD_OFF     (death, bald)
    ('bald', 'bald', 'dizzyA', (1, 0), 'wobble', 0),           # 5 HEAD_BALD    (the wig just flew off)
    ('hatch-ajar', 'ajar', 'up', (1, 0), 'smile', None),       # 6 HEAD_HATCH_AJAR (the lid pops: anticipation)
    ('blink-half', 'closed', 'half', (0, 0), 'smile', None),   # 7 HEAD_BLINK_HALF
    ('shout-in', 'closed', 'narrow', (0, 1), 'half', None),    # 8 HEAD_SHOUT_IN (the mouth opening)
    ('bald-b', 'bald', 'dizzyB', (1, 0), 'wobble', 1),         # 9 HEAD_BALD_B  (the dizzy loop's 2nd frame)
]
EVENTS = {'HEAD_SMILE': 0, 'HEAD_HATCH': 1, 'HEAD_SHOUT': 2, 'HEAD_BLINK': 3, 'HEAD_OFF': 4, 'HEAD_BALD': 5,
          'HEAD_HATCH_AJAR': 6, 'HEAD_BLINK_HALF': 7, 'HEAD_SHOUT_IN': 8, 'HEAD_BALD_B': 9}


def _front_z(x, y):
    return 7.6 if y < -149 else 6.6                          # the sweep lies over the steel brow


def head_frame(stage, f):
    """Head frame f (FRAMES) at damage stage 0..2. Returns a Layer."""
    name, hat, eye, (lift, drop), mo, st = FRAMES[f]
    L = Layer('head')
    bald = hat == 'bald'
    if bald:
        skull(L, stage)
    else:
        W.wig(L, singe=stage, front_z=_front_z)
        W.part_line(L)
    face_plate(L)
    eyes(L, eye, flicker=stage >= 2 and eye in ('open', 'up', 'narrow', 'half'))
    brows(L, bent=stage >= 2, lift=lift, drop=drop)
    nose(L)
    mouth(L, mo)
    jaw_bolt(L)
    if stage == 1:
        damage_1(L)
    elif stage >= 2:
        damage_2(L)
    if not bald:
        W.hatch(L, hat)
    if st is not None:
        stars(L, st)
    return L


def head(stage=0, face='smile'):
    """The head piece at a damage stage with a named face (the look renders): FRAMES names."""
    return head_frame(stage, [n for n, *_ in FRAMES].index(face))
