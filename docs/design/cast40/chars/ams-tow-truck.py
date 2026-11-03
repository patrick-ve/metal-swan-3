# The tow truck the scan car calls (TOW CALL, phase 2): a navy cab with a white band and an orange
# beacon bar, a steel flatbed with the red/white hazard chevrons at the tail, a yellow crane on the
# bed whose boom (yellow with black hazard bands) leans back over the tail, and the hook on its
# cable, swinging low. It backs in rear first, so the hook leads: drawn facing right (face=1), the
# hook swings out towards the hero on the left.
#
# Size: the game's truck is 95 px from tail to bumper (4.3 m at 22 px/m), short for a truck; this
# sample is 1.2x that: 116 px (about 5.3 m, a compact city crane truck) with the cab roof 47 px up.
import math
import castkit as K

INFO = dict(
    name='TAKELWAGEN', mission=['ams'], role='enemy', kind='MACHINE', face=1,
    pose='parked at work, the crane hook swinging out low on its cable',
    note='The game design kept (navy cab, white band, orange beacon, steel bed, red/white tail chevrons, '
         'yellow crane with a black-banded boom, yellow block hook); 1.2x longer for a truck at the 40 px '
         'scale, the boom shaded as a tube, dual rear axle, steel wheels.',
    old='boss/ams-scan/tow',
)

W, H = 150, 84
OY = 80                     # ground row
X0 = 24                     # the bed's tail end

PAL = {
    'B': '#6e92de', 'b': '#3f62b4', 'V': '#2a438c', 'v': '#182a5c',     # navy cab
    '1': '#f6f7fb', '3': '#aab3c4',                                       # white band
    'G': '#9aaac6', 'g': '#4e5a74', 'n': '#2b3246',                       # glass
    'S': '#d4d9e2', 's': '#9aa1b0', 'z': '#676e7f', 'Z': '#3e4352',       # steel
    'P': '#56555f', 'p': '#34323b', 'o': '#1e1c23',                       # black plastic / tyre
    'J': '#ffe068', 'j': '#f0b628', 'X': '#b87c14', 'x': '#6c4410',       # crane yellow
    'A': '#ffc040', 'a': '#e0701a',                                       # beacon
    'R': '#e83e48', 'r': '#a8182a',                                       # tail chevrons, lamps
}
DARK = {}
for grp, d in [('BbVv', 'v'), ('13', '3'), ('Ggn', 'n'), ('SszZ', 'Z'), ('Ppo', 'o'), ('JjXx', 'x'),
               ('Aa', 'a'), ('Rr', 'r')]:
    for ch in grp:
        DARK[ch] = d


def Y(h):
    """Height above the ground -> row."""
    return OY - h


def frame():
    K.palette(PAL, dark=DARK)
    cv = K.Canvas(W, H)

    def rect(x0, h0, x1, h1, ch, z, part):
        for x in range(x0, x1):
            for h in range(h0, h1):
                cv.px(x, Y(h), ch, z, part)

    WR = 7.5
    wheels = [X0 + 17, X0 + 33, X0 + 92]
    # ---------------------------------------------------------------- chassis, bed
    rect(X0 + 4, 5, X0 + 100, 13, 'p', 0, 'chassis')
    rect(X0 + 4, 12, X0 + 100, 13, 'P', 0, 'chassis')
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
            cv.px(x, Y(h), 'R' if ((h + x) // 2) % 2 == 0 else '1', 0.3, 'bed')
    # tail lamp under the chevrons
    cv.px(X0 + 1, Y(12), 'R', 0.3, 'bed'); cv.px(X0 + 2, Y(12), 'r', 0.3, 'bed')
    # mudguards over the rear wheels
    for wx in wheels[:2]:
        for x in range(wx - 9, wx + 10):
            cv.px(x, Y(13), 'p', 0.25, 'bed')
    # ---------------------------------------------------------------- the cab and the bonnet
    cx0, cx1 = X0 + 76, X0 + 101          # cab
    bx1 = X0 + 115                        # bonnet front
    for x in range(cx0, bx1 + 1):
        for h in range(6, 48):
            in_cab = cx0 <= x < cx1 and h < 47 and not (x >= X0 + 93 and h > 46 - (x - (X0 + 93)) * 2.1)
            in_bon = cx1 - 1 <= x <= bx1 and h <= 26 and not (x >= bx1 - 2 and h > 26 - (x - (bx1 - 2)) * 2)
            in_bon = in_bon and not (x == bx1 and h < 9)
            if not (in_cab or in_bon):
                continue
            # navy: lit top / front, base, the lower part turns under
            ch = 'b'
            if h >= 45 or (in_bon and not in_cab and h >= 25):
                ch = 'B'
            elif x >= bx1 - 1 or (in_cab and x >= X0 + 93 and h > 44 - (x - (X0 + 93)) * 2.1):
                ch = 'B'
            elif h < 11:
                ch = 'V'
            elif x < cx0 + 2:
                ch = 'V'
            if 22 <= h <= 24:
                ch = '1' if h == 24 else '3' if h == 22 else '1'
            cv.px(x, Y(h), ch, 0.5, 'cab')
    # the cab's window (the front edge follows the windscreen slope)
    for x in range(cx0 + 7, X0 + 99):
        for h in range(30, 43):
            if x >= X0 + 93 and h > 42 - (x - (X0 + 93)) * 2.1:
                continue
            ch = 'g' if h >= 41 else 'n'
            if 1.5 <= (x - (cx0 + 7)) - (h - 30) * 0.5 <= 2.6 or 5 <= (x - (cx0 + 7)) - (h - 30) * 0.5 <= 5.8:
                ch = 'G'
            cv.px(x, Y(h), ch, 0.55, 'cab')
    # a dim driver in the cab: cap and shoulder (navy on the glass)
    for x, h in ((cx0 + 13, 38), (cx0 + 14, 38), (cx0 + 15, 38), (cx0 + 13, 37), (cx0 + 14, 37), (cx0 + 15, 37),
                 (cx0 + 16, 37), (cx0 + 14, 36), (cx0 + 14, 35), (cx0 + 13, 36), (cx0 + 13, 35),
                 (cx0 + 11, 32), (cx0 + 12, 32), (cx0 + 13, 32), (cx0 + 14, 32), (cx0 + 11, 31),
                 (cx0 + 12, 31), (cx0 + 13, 31), (cx0 + 14, 31), (cx0 + 15, 31), (cx0 + 12, 33), (cx0 + 13, 33), (cx0 + 13, 34)):
        cv.px(x, Y(h), 'v', 0.56, 'cab')
    # the door's shut line and handle, the mirror arm
    for h in range(8, 43):
        if not 22 <= h <= 24:
            cv.px(cx0 + 5, Y(h), 'V', 0.56, 'cab')
    cv.px(cx0 + 7, Y(27), 'v', 0.56, 'cab'); cv.px(cx0 + 8, Y(27), 'v', 0.56, 'cab'); cv.px(cx0 + 7, Y(28), 'B', 0.56, 'cab'); cv.px(cx0 + 8, Y(28), 'B', 0.56, 'cab')
    # the orange beacon bar on the roof
    for x in range(cx0 + 3, cx0 + 16):
        cv.px(x, Y(47), 'p', 0.4, 'beacon')
        if cx0 + 4 <= x < cx0 + 15:
            cv.px(x, Y(48), 'a', 0.4, 'beacon')
            cv.px(x, Y(49), 'A', 0.4, 'beacon')
    # the front: headlight, grille, bumper, indicator
    for h in (18, 19):
        cv.px(bx1, Y(h), 'i' if h == 18 else '1', 0.6, 'cab'); cv.px(bx1 - 1, Y(h), '1', 0.6, 'cab')
    cv.px(bx1 - 2, Y(19), 'A', 0.6, 'cab')
    for h in range(11, 17):
        cv.px(bx1, Y(h), 's' if h % 2 else 'Z', 0.6, 'cab')
    rect(bx1 - 5, 5, bx1 + 2, 11, 'p', 0.7, 'bumper')
    rect(bx1 - 5, 10, bx1 + 2, 11, 'P', 0.7, 'bumper')
    # ---------------------------------------------------------------- the wheel wells (cut into the body)
    for wx in wheels:
        for x in range(wx - 10, wx + 11):
            for h in range(0, 18):
                d = math.hypot(x + 0.5 - wx, h - 0.5 - 7.5)
                if d <= WR + 1.6 and cv.c[Y(h)][x] != '.':
                    cv.c[Y(h)][x] = 'o'
    # ---------------------------------------------------------------- wheels (steel rims with a hub)
    for wx in wheels:
        cx, cy = wx, Y(7.5) + 0.5
        for yy in range(int(cy) - 9, int(cy) + 9):
            for xx in range(int(cx) - 9, int(cx) + 10):
                dx, dy = xx + 0.5 - cx, yy + 0.5 - cy
                r = math.hypot(dx, dy)
                if r > WR or yy >= OY:
                    continue
                lit = (dx * 0.6 - dy * 0.8) / max(r, 0.01)
                if r > 4.8:
                    ch = 'P' if lit > 0.55 else 'p' if lit > -0.35 else 'o'
                elif r > 3.8:
                    ch = 'S' if lit > 0.2 else 's' if lit > -0.5 else 'z'
                elif r > 1.6:
                    ch = 'z' if lit > -0.1 else 'Z'
                    a = math.atan2(dy, dx)
                    if abs(r - 2.8) < 0.6 and math.cos(6 * a) > 0.6:
                        ch = 'Z'
                else:
                    ch = 'S' if lit > 0 else 's'
                cv.px(xx, yy, ch, 1, 'wheel')
    # ---------------------------------------------------------------- the crane base on the bed
    for x in range(X0 + 24, X0 + 44):
        for h in range(21, 32):
            ch = 'j'
            if h == 31:
                ch = 'J'
            elif x >= X0 + 42:
                ch = 'J'
            elif h <= 22:
                ch = 'X'
            elif x <= X0 + 25:
                ch = 'X'
            cv.px(x, Y(h), ch, 0.8, 'base')
    for x in range(X0 + 27, X0 + 31):            # the dark slot (the winch)
        for h in (25, 26, 27):
            cv.px(x, Y(h), 'x' if h > 25 else 'X', 0.8, 'base')
    cv.px(X0 + 39, Y(28), 'J', 0.8, 'base'); cv.px(X0 + 39, Y(27), 'X', 0.8, 'base')
    # ---------------------------------------------------------------- the boom: a yellow tube with black bands
    piv = (X0 + 33.5, Y(30.5))
    tip = (X0 - 4.5, Y(64.5))
    L = math.hypot(tip[0] - piv[0], tip[1] - piv[1])

    def bands(u, v, k, ch):
        if 9 < u < L - 5 and int((u + v * 0.9) / 4.0) % 2 == 0:
            return 'o' if k >= 2 else 'p'
        return ch
    cv.tube(piv, tip, 2.6, 2.3, 'JjXx', 0.7, 'boom', pat=bands)
    # the pivot pin on the base
    for dx, dy, ch in ((0, 0, 'S'), (1, 0, 's'), (0, 1, 's'), (1, 1, 'z')):
        cv.px(int(piv[0]) + dx - 1, int(piv[1]) + dy - 1, ch, 0.9, 'pin')
    # the sheave at the tip
    tx, ty = tip
    for yy in range(int(ty) - 4, int(ty) + 5):
        for xx in range(int(tx) - 4, int(tx) + 5):
            dx, dy = xx + 0.5 - tx, yy + 0.5 - ty
            r = math.hypot(dx, dy)
            if r <= 3.2:
                lit = (dx * 0.6 - dy * 0.8) / max(r, 0.01)
                ch = 'z' if r < 1.2 else 'S' if lit > 0.3 else 's' if lit > -0.4 else 'z'
                cv.px(xx, yy, ch, 0.95, 'sheave')
    # ---------------------------------------------------------------- the hook, swung out
    ang = 0.42                                   # swing: the hook out to the left
    cl = 21.0
    hx, hy = tx - cl * math.sin(ang), ty + cl * math.cos(ang)
    hook = K.grid('''
        .XjjjjjX.
        XjJJJJjjx
        XjjjZjjjx
        XjjjjjjXx
        .xxxxxxx.
        ....SZ...
        ....sZ...
        .S..sZ...
        .sz.sz...
        .sz..sz..
        ..sSsz...
        ...zz....
    ''')
    hw = len(hook[0])
    # upright on the cable's end (a tilted 1x hook loses its shape; the cable carries the swing)
    cv.grid(int(round(hx - hw / 2 + 0.5)), int(round(hy)), hook, 2, 'hook')
    rows, root = K.finish(cv, (X0 + 58, OY))
    # the cable: a thin dark steel line from the sheave to the hook block (no outline)
    rows = [list(r) for r in rows]
    n = int(cl * 3)
    for i in range(n + 1):
        t = i / n
        x = int(math.floor(tx + (hx - tx) * t))
        y = int(math.floor(ty + (hy - ty) * t))
        if rows[y][x] == '.':
            rows[y][x] = 'Z'
    # swing lines: two short arcs trailing the hook (it swings out to the left)
    for rad, a0, a1 in ((cl + 9.5, 0.10, 0.30), (cl + 5.5, 0.06, 0.24)):
        for k in range(24):
            a = a0 + (a1 - a0) * k / 23
            x = int(math.floor(tx - rad * math.sin(a)))
            y = int(math.floor(ty + rad * math.cos(a)))
            if 0 <= y < H and rows[y][x] == '.':
                rows[y][x] = 'W'
    return [''.join(r) for r in rows], root
