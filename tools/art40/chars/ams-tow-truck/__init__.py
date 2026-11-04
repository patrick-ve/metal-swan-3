# TAKELWAGEN: the tow truck the scan car calls (boss/ams-scan/tow, hook) at 40 px (plan
# docs/design/ams40.md wave 6, decision D5: 1.2x longer). The look is the cast spike's approved sample
# (docs/design/cast40/chars/ams-tow-truck.py): a navy cab with a white band and an orange beacon bar, a
# steel flatbed with the red/white tail chevrons, a yellow crane whose black-banded boom leans back over
# the tail, a dual rear axle. One set of the shared prefix boss/ams-scan (the scan car and the wheel
# clamp are other slugs of it).
#
# Game rules kept (adds.ts AmsTowTruck, geometry.ts TRUCK): the anchor is the floor point under the
# truck's middle; the boom tip (the cable's start) stays 50 px over the floor, so the swinging hook
# still hits a standing hero's chest and misses a crouched one (TRUCK.hook, the hook box); the stop
# puts the tip TRUCK.stopIn px inside the view whatever its x. The art points the code reads ride on
# every tow frame: 'tip', 'wheel0..2' (the centres of the code-drawn wheels), 'lamp0', 'lamp1' (the
# two beacon lamps the code blinks). The hitbox TRUCK.box is unchanged (D7).
#
# tow: 6 frames = 2 damage states x the clamps still on the bed (2, 1, 0): the bed carries the two
# clamps the truck tosses, so a toss visibly takes one off. hook: 5 frames, upright and leaning 15 /
# 30 degrees each way with the cable (the code picks by the swing angle): the hook hangs along its
# cable through the swing instead of staying stiff.
import math

import art40 as X
import castkit as K

SET = X.Set(prefix='boss/ams-scan', budget=40, face=1, outline='K', hl='i')
SET.shares_prefix = True

PAL = {
    'K': '#140c0e',                                                       # the warm near-black outline
    'B': '#6e92de', 'b': '#3f62b4', 'V': '#2a438c', 'v': '#182a5c',     # navy cab
    '1': '#f6f7fb', '3': '#aab3c4',                                       # white band
    'G': '#9aaac6', 'g': '#4e5a74', 'n': '#2b3246',                       # glass
    'S': '#d4d9e2', 's': '#9aa1b0', 'z': '#676e7f', 'Z': '#3e4352',       # steel
    'P': '#56555f', 'p': '#34323b', 'o': '#1e1c23',                       # black plastic, the wells
    'J': '#ffe068', 'j': '#f0b628', 'X': '#b87c14', 'x': '#6c4410',       # crane yellow
    'A': '#ffc040', 'a': '#e0701a',                                       # beacon, indicator
    'R': '#e83e48', 'r': '#a8182a',                                       # tail chevrons, lamps
    'i': '#bfe4ff',                                                       # the headlight glint
    'y': '#5a4a4a',                                                       # soot (damaged)
}
DARK = {}
for grp, d in [('BbVv', 'v'), ('13', '3'), ('Ggn', 'n'), ('SszZ', 'Z'), ('Ppo', 'o'), ('JjXx', 'x'),
               ('Aa', 'a'), ('Rr', 'r'), ('i', 'n'), ('y', 'o')]:
    for ch in grp:
        DARK[ch] = d

W, H = 134, 66
OY = 62                     # the ground row (the lowest body pixels sit on row OY - 1)
X0 = 9                      # the bed's tail end
RX = X0 + 58                # the anchor column: the truck's middle (116 px: 1.2x the old 95)
TIP = (X0 - 4, OY - 50)     # the boom's sheave = the cable's start: 50 px over the floor (game rule)
WHEELS = [X0 + 17, X0 + 33, X0 + 92]
WHEEL_Y = OY - 7            # the code draws its 15 px wheels centred here
CX0, CX1, BX1 = X0 + 76, X0 + 101, X0 + 115   # cab back, cab front, bonnet front
LAMPS = [(CX0 + 6, OY - 48), (CX0 + 12, OY - 48)]
BED_CLAMPS = [X0 + 44, X0 + 56]               # the two clamps on the bed (the rear one goes first)


def Y(h):
    """Height above the ground -> row."""
    return OY - h


def rect(cv, x0, h0, x1, h1, ch, z, part):
    for x in range(x0, x1):
        for h in range(h0, h1):
            cv.px(x, Y(h), ch, z, part)


def bed_clamp():
    """The shut clamp of the wheel-clamp set (its approved grid), in the truck's colours."""
    return X.char('ams-wheel-clamp').G['shut']


def truck(damaged, load):
    cv = K.Canvas(W, H)
    # ---------------------------------------------------------------- chassis, bed
    rect(cv, X0 + 4, 5, X0 + 100, 13, 'p', 0, 'chassis')
    rect(cv, X0 + 4, 12, X0 + 100, 13, 'P', 0, 'chassis')
    # the fuel tank and the toolbox under the bed, between the axles and the cab
    rect(cv, X0 + 48, 6, X0 + 62, 12, 's', 0.1, 'tank')
    rect(cv, X0 + 48, 11, X0 + 62, 12, 'S', 0.1, 'tank')
    rect(cv, X0 + 48, 6, X0 + 62, 7, 'z', 0.1, 'tank')
    for x in (X0 + 52, X0 + 58):
        for h in range(7, 11):
            cv.px(x, Y(h), 'z', 0.1, 'tank')
    rect(cv, X0 + 64, 7, X0 + 74, 12, 'P', 0.1, 'box')
    rect(cv, X0 + 64, 11, X0 + 74, 12, 'S', 0.1, 'box')
    cv.px(X0 + 69, Y(9), 'S', 0.1, 'box')
    # the steel bed: a lit top lip, the side, a dark lower lip, rivets
    for x in range(X0, X0 + 76):
        for h in range(13, 22):
            ch = 'S' if h == 21 else 's' if h >= 16 else 'z'
            if h == 13:
                ch = 'Z'
            cv.px(x, Y(h), ch, 0.2, 'bed')
    for x in range(X0 + 6, X0 + 74, 7):
        cv.px(x, Y(19), 'z', 0.2, 'bed'); cv.px(x, Y(15), 'Z', 0.2, 'bed')
        cv.px(x, Y(20), 'S', 0.2, 'bed')
    # the red/white chevrons on the tail
    for x in range(X0, X0 + 3):
        for h in range(13, 22):
            ch = 'R' if ((h + x) // 2) % 2 == 0 else '1'
            if damaged and h in (17, 18) and x == X0:
                ch = 'z'                                       # scraped
            cv.px(x, Y(h), ch, 0.3, 'bed')
    cv.px(X0 + 1, Y(12), 'R', 0.3, 'bed'); cv.px(X0 + 2, Y(12), 'r', 0.3, 'bed')
    # mudguards over the rear wheels
    for wx in WHEELS[:2]:
        for x in range(wx - 9, wx + 10):
            cv.px(x, Y(13), 'p', 0.25, 'bed')
    # ---------------------------------------------------------------- the cab and the bonnet
    slope = X0 + 93
    for x in range(CX0, BX1 + 1):
        for h in range(6, 48):
            in_cab = CX0 <= x < CX1 and h < 47 and not (x >= slope and h > 46 - (x - slope) * 2.1)
            in_bon = CX1 - 1 <= x <= BX1 and h <= 26 and not (x >= BX1 - 2 and h > 26 - (x - (BX1 - 2)) * 2)
            in_bon = in_bon and not (x == BX1 and h < 9)
            if not (in_cab or in_bon):
                continue
            ch = 'b'
            if h >= 45 or (in_bon and not in_cab and h >= 25):
                ch = 'B'
            elif x >= BX1 - 1 or (in_cab and x >= slope and h > 44 - (x - slope) * 2.1):
                ch = 'B'
            elif h < 11:
                ch = 'V'
            elif x < CX0 + 2:
                ch = 'V'
            if 22 <= h <= 24:
                ch = '1' if h >= 23 else '3'
            cv.px(x, Y(h), ch, 0.5, 'cab')
    # the cab's window (the front edge follows the windscreen slope), two lit streaks
    for x in range(CX0 + 7, X0 + 99):
        for h in range(30, 43):
            if x >= slope and h > 42 - (x - slope) * 2.1:
                continue
            ch = 'g' if h >= 41 else 'n'
            u = (x - (CX0 + 7)) - (h - 30) * 0.5
            if 1.5 <= u <= 2.6 or 5 <= u <= 5.8:
                ch = 'G'
            cv.px(x, Y(h), ch, 0.55, 'cab')
    # the driver: calm at the wheel (cap and shoulder); ducked below the sill once the truck is hit
    if not damaged:
        driver = [(13, 38), (14, 38), (15, 38), (13, 37), (14, 37), (15, 37), (16, 37), (14, 36), (14, 35),
                  (13, 36), (13, 35), (11, 32), (12, 32), (13, 32), (14, 32), (11, 31), (12, 31), (13, 31),
                  (14, 31), (15, 31), (12, 33), (13, 33), (13, 34)]
    else:
        driver = [(12, 32), (13, 32), (14, 32), (12, 31), (13, 31), (14, 31), (15, 31), (11, 30), (12, 30)]
    for dx, h in driver:
        cv.px(CX0 + dx, Y(h), 'v', 0.56, 'cab')
    # the door's shut line and handle
    for h in range(8, 43):
        if not 22 <= h <= 24:
            cv.px(CX0 + 5, Y(h), 'V', 0.56, 'cab')
    for dx in (7, 8):
        cv.px(CX0 + dx, Y(27), 'v', 0.56, 'cab'); cv.px(CX0 + dx, Y(28), 'B', 0.56, 'cab')
    # the mirror on its arm at the windscreen pillar
    cv.px(X0 + 100, Y(38), 'v', 0.57, 'cab'); cv.px(X0 + 101, Y(38), 'v', 0.57, 'cab')
    for h in (36, 37, 38, 39):
        cv.px(X0 + 102, Y(h), 'P' if h == 39 else 'p', 0.57, 'mirror')
    # the orange beacon bar on the roof (the code blinks the two lamps over it)
    for x in range(CX0 + 3, CX0 + 16):
        cv.px(x, Y(47), 'p', 0.4, 'beacon')
        if CX0 + 4 <= x < CX0 + 15:
            cv.px(x, Y(48), 'a', 0.4, 'beacon')
            cv.px(x, Y(49), 'A', 0.4, 'beacon')
    # the front: headlight, indicator, grille, bumper
    if not damaged:
        cv.px(BX1, Y(18), 'i', 0.6, 'cab'); cv.px(BX1, Y(19), '1', 0.6, 'cab')
        cv.px(BX1 - 1, Y(18), '1', 0.6, 'cab'); cv.px(BX1 - 1, Y(19), '1', 0.6, 'cab')
    else:                                                       # the headlight smashed
        cv.px(BX1, Y(18), 'o', 0.6, 'cab'); cv.px(BX1, Y(19), 'G', 0.6, 'cab')
        cv.px(BX1 - 1, Y(18), 'n', 0.6, 'cab'); cv.px(BX1 - 1, Y(19), 'o', 0.6, 'cab')
    cv.px(BX1 - 2, Y(19), 'A', 0.6, 'cab')
    for h in range(11, 17):
        cv.px(BX1, Y(h), 's' if h % 2 else 'Z', 0.6, 'cab')
    sag = 1 if damaged else 0
    for x in range(BX1 - 5, BX1 + 2):
        d = sag if x >= BX1 - 1 else 0                          # the bumper's front end hangs
        for h in range(5, 11):
            cv.px(x, Y(h) + d, 'P' if h == 10 else 'p', 0.7, 'bumper')
    # ---------------------------------------------------------------- the wheel wells (cut into the body)
    for wx in WHEELS:
        for x in range(wx - 10, wx + 11):
            for h in range(0, 18):
                if math.hypot(x - wx, Y(h) - WHEEL_Y) <= 9.1 and cv.c[Y(h)][x] != '.':
                    cv.c[Y(h)][x] = 'o'
    # ---------------------------------------------------------------- the crane base on the bed
    cb0, cb1 = X0 + 12, X0 + 31
    for x in range(cb0, cb1):
        for h in range(21, 32):
            ch = 'j'
            if h == 31:
                ch = 'J'
            elif x >= cb1 - 2:
                ch = 'J'
            elif h <= 22:
                ch = 'X'
            elif x <= cb0 + 1:
                ch = 'X'
            cv.px(x, Y(h), ch, 0.8, 'base')
    for x in range(cb0 + 3, cb0 + 7):                         # the winch slot
        for h in (25, 26, 27):
            cv.px(x, Y(h), 'x' if h > 25 else 'X', 0.8, 'base')
    cv.px(cb1 - 4, Y(28), 'J', 0.8, 'base'); cv.px(cb1 - 4, Y(27), 'X', 0.8, 'base')
    if damaged:                                                 # scrapes on the base
        for x, h in ((cb0 + 9, 24), (cb0 + 10, 25), (cb0 + 11, 25), (cb0 + 12, 26)):
            cv.px(x, Y(h), 'x', 0.8, 'base')
    # ---------------------------------------------------------------- the boom: a yellow tube with black bands
    piv = (X0 + 21, Y(31))
    L = math.hypot(TIP[0] - piv[0], TIP[1] - piv[1])

    def bands(u, v, k, ch):
        if 8 < u < L - 5 and int((u + v * 0.9) / 4.0) % 2 == 0:
            return 'o' if k >= 2 else 'p'
        return ch
    cv.tube(piv, TIP, 2.6, 2.2, 'JjXx', 0.7, 'boom', pat=bands)
    # the luffing ram: a steel cylinder from the base's front to the boom's middle, the chrome rod
    rb = (piv[0] + (TIP[0] - piv[0]) * 0.42, piv[1] + (TIP[1] - piv[1]) * 0.42 + 2)
    ra = (cb1 - 3, Y(29))
    mid = (ra[0] + (rb[0] - ra[0]) * 0.55, ra[1] + (rb[1] - ra[1]) * 0.55)
    cv.tube(ra, mid, 1.4, 1.4, 'zzZZ', 0.75, 'ram')
    cv.tube(mid, rb, 0.8, 0.8, 'SSsz', 0.74, 'rod')
    # the pivot pin on the base
    for dx, dy, ch in ((0, 0, 'S'), (1, 0, 's'), (0, 1, 's'), (1, 1, 'z')):
        cv.px(piv[0] + dx - 1, piv[1] + dy - 1, ch, 0.9, 'pin')
    # the sheave at the tip
    tx, ty = TIP
    for yy in range(ty - 4, ty + 5):
        for xx in range(tx - 4, tx + 5):
            dx, dy = xx - tx, yy - ty
            r = math.hypot(dx, dy)
            if r <= 3.2:
                lit = (dx * 0.6 - dy * 0.8) / max(r, 0.01)
                ch = 'Z' if r < 1.2 else 'S' if lit > 0.3 else 's' if lit > -0.4 else 'z'
                cv.px(xx, yy, ch, 0.95, 'sheave')
    # ---------------------------------------------------------------- the clamps still on the bed
    g = bed_clamp()
    for k, cx in enumerate(BED_CLAMPS):
        if k < 2 - load:
            continue                                            # tossed (the rear one first)
        cv.grid(cx - 6, Y(22) - len(g) + 1, g, 0.6 + 0.01 * k, 'clamp%d' % k)
    # ---------------------------------------------------------------- damage on the cab
    if damaged:
        for x in range(CX0, BX1 + 1):                           # soot round the grille
            for h in range(8, 27):
                ch = cv.c[Y(h)][x]
                q = math.hypot((x - BX1) / 13.0, (h - 16) / 9.0)
                if ch in 'BbV13' and q < 0.85:
                    cv.c[Y(h)][x] = {'B': 'b', 'b': 'V', 'V': 'y', '1': '3', '3': 'z'}[ch] if q > 0.45 else {'B': 'V', 'b': 'y', 'V': 'y', '1': 'z', '3': 'y'}[ch]
        for x, h in ((CX0 + 3, 16), (CX0 + 16, 12), (CX0 + 21, 35), (X0 + 106, 19)):   # dents
            cv.c[Y(h)][x] = 'v'; cv.c[Y(h) + 1][x] = 'B'; cv.c[Y(h)][x + 1] = 'V'
        for x, h in ((X0 + 92, 39), (X0 + 93, 38), (X0 + 94, 37), (X0 + 95, 37), (X0 + 96, 36),
                     (X0 + 93, 36), (X0 + 92, 35), (X0 + 95, 39), (X0 + 96, 40)):    # the cracked windscreen
            if cv.c[Y(h)][x] in 'ngG':
                cv.c[Y(h)][x] = '1' if (x + h) % 3 == 0 else 'G'
        for x, h in ((CX0 + 9, 18), (CX0 + 10, 17), (CX0 + 11, 16), (CX0 + 12, 15), (CX0 + 13, 15)):   # a crease in the door
            cv.c[Y(h)][x] = 'v'; cv.c[Y(h) + 1][x] = 'B'
        for x, h in ((X0 + 30, 15), (X0 + 31, 15), (X0 + 58, 18), (X0 + 59, 17)):  # dents in the bed
            cv.c[Y(h)][x] = 'Z'; cv.c[Y(h) - 1][x] = 'S'
    rows, root = K.finish(cv, (RX, OY))
    pts = {'tip': TIP, 'lamp0': LAMPS[0], 'lamp1': LAMPS[1]}
    for i, wx in enumerate(WHEELS):
        pts['wheel%d' % i] = (wx, WHEEL_Y)
    return X.Frame(rows, root, pts=pts, joints=dict(pts))


# ------------------------------------------------------------------------------------------ hook
HOOK = [
    '.XjjjjjX.',
    'XjJJJJjjx',
    'XjjjZjjjx',
    'XjjjjjjXx',
    '.xxxxxxx.',
    '....SZ...',
    '....sZ...',
    '.S..sZ...',
    '.sz.sz...',
    '.sz..sz..',
    '..sSsz...',
    '...zz....',
]
HOOK_TILT_DEG = 15          # one hook frame per 15 degrees of swing
HOOK_TILTS = 2              # frames per side: 15 and 30 degrees
PAD = 8


def hook(deg):
    """The hook leaning deg degrees (positive: its bottom swung to +x) about the cable's end (the
    block's top centre = the anchor). A row shear, not a rotation: at 9 px a rotated hook loses its
    shape and its light; sheared, every row keeps its pixels and the lit top stays lit."""
    t = math.tan(math.radians(deg))
    w = len(HOOK[0]) + 2 * PAD
    rows = []
    for y, r in enumerate(HOOK):
        off = int(math.floor(t * (y + 0.5) + 0.5))
        line = ['.'] * w
        for x, ch in enumerate(r):
            if ch != '.':
                line[PAD + x + off] = ch
        rows.append(''.join(line))
    g = ['.' * w] * 2 + rows + ['.' * w] * 2
    piv = (PAD + 4, 2)
    cv = K.Canvas(w, len(g))
    cv.grid(0, 0, g, 0, 'hook')
    out, root = K.finish(cv, piv)
    bowl = (piv[0] + t * 9, piv[1] + 9)
    return X.Frame(out, root, joints={'top': piv, 'bowl': bowl})


def build(s):
    K.palette(PAL, dark=DARK, letters=''.join(PAL))
    s.colours = dict(PAL)
    tow = []
    for thrown in range(3):
        for damaged in (False, True):
            tow.append(truck(damaged, 2 - thrown))
    s.strip('tow', tow, 6, cls='mechanical')
    s.event('TOW_DAMAGED', 1)            # + this frame offset when broken or at half HP or less
    s.event('TOW_LOAD_STEP', 2)          # + this per clamp tossed off the bed
    s.event('TOW_LOADS', 2)              # clamps on the bed at the start
    tilts = [0] + [HOOK_TILT_DEG * k for k in range(1, HOOK_TILTS + 1)] + [-HOOK_TILT_DEG * k for k in range(1, HOOK_TILTS + 1)]
    s.strip('hook', [hook(d) for d in tilts], 6, cls='mechanical')
    s.event('HOOK_TILT_DEG', HOOK_TILT_DEG)   # frame 0 upright; 1..HOOK_TILTS lean +x; then the -x leans
    s.event('HOOK_TILTS', HOOK_TILTS)
