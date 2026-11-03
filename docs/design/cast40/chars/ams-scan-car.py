# The parking scan car (ams section c boss) at the SCAN LOCK moment: the compact, tall white
# electric hatchback in the city's livery, the big white scanner box lifted on its rack with its
# camera windows lit red and the lens locked on the hero. The handhaver sits at the wheel, seen
# through the tinted glass (navy cap, yellow hi-vis vest).
#
# The shapes keep the game's look numbers (geometry.ts SCAN.*: the side profile, the window band,
# the bonnet face, the bars, the stripes, the crosses, the scanner shell), sampled at pixel centres
# at S = 1.07 (84 -> 90 px long against the 40 px hero), then shaded by hand rules and finished
# with selout + one outline. Drawn facing right; cast.py mirrors it (face=-1), so the lettering
# hint is drawn pre-mirrored.
import math
import castkit as K

INFO = dict(
    name='SCANAUTO', mission=['ams'], role='boss', kind='MACHINE', face=-1,
    pose='SCAN LOCK: the scanner box lifted, its camera windows lit red, the lens locked on the hero',
    note='The game design kept (white hatchback, red slanted bars, bonnet stripes, XXX, floating roof, '
         'scanner box on a rack); now 90 px long with 4-tone white paint, alloy wheels with spokes, '
         'a visible officer (navy cap, yellow vest) and a print-hint band for PARKEERCONTROLE.',
    old='boss/ams-scan/body-0',
)

S = 1.07
W, H = 104, 54
OX, OY = 52, 50          # the ground point (the wheels' last row is OY-1)

PAL = {
    # white paint (hi, base, turn, dark)
    '1': '#fdfdff', '2': '#e1e6ef', '3': '#b3bccc', '4': '#77809a',
    # tinted glass (glint, top, base, foot)
    'G': '#8d9cb8', 'g': '#4e5a74', 'n': '#2f3649', 'N': '#1e2232',
    # black plastic / tyre (lit, base, dark)
    'P': '#55545f', 'p': '#33323b', 'o': '#1f1d24',
    # red livery
    'R': '#ee4a50', 'r': '#c8202f', 'Q': '#86121f',
    # alloy / chrome
    'S': '#f4f6fa', 's': '#b8bfcc', 'z': '#7c8394', 'Z': '#4b5060',
    # driver: skin, cap, vest
    'L': '#eeb08a', 'l': '#a86c52', 'V': '#3c4c80', 'v': '#232b4e', 'Y': '#dfe63a', 'X': '#97a01c',
    # amber hazard, yellow plate
    'A': '#ffb12c', 'a': '#c96a10', 'J': '#f2c230', 'j': '#a87c14',
    # the scan: red cast, the lit lens
    'O': '#ff4436', 'w': '#ffe0cc', 'E': '#b81c22',
    # grey band on the box
    'q': '#9aa3b5',
}
DARK = {}
for grp, d in [('1234', '4'), ('GgnN', 'N'), ('Ppo', 'o'), ('RrQ', 'Q'), ('SszZ', 'Z'), ('Ll', 'l'),
               ('Vv', 'v'), ('YX', 'X'), ('Aa', 'a'), ('Jj', 'j'), ('OwE', 'E'), ('q', '4')]:
    for ch in grp:
        DARK[ch] = d

# ------------------------------------------------------------------ the game's look numbers
PROFILE = [(-42, -8), (-41.8, -5.2), (-41.0, -3.0), (-39.6, -2), (39.6, -2), (41.0, -3.0), (41.8, -5.2),
           (42, -9.4), (41.7, -11.8), (41.0, -13.3), (40.0, -14.3), (36.0, -15.5), (30.0, -16.9),
           (25.0, -18.1), (22.4, -18.8), (12.0, -23.84), (5.6, -26.94), (3.0, -28.2), (0.6, -29.0),
           (-3, -29.3), (-12, -29.4), (-24, -29.1), (-33, -28.6), (-37.4, -28.1), (-39.4, -27.7),
           (-40.5, -26.9), (-40.9, -25.6), (-41.3, -21.0), (-41.7, -16.0), (-42, -12.0)]
BAND = [(22.4, -18.8), (3.2, -28.1), (-6, -28.15), (-20, -28.0), (-32, -27.45), (-37, -26.85),
        (-39.6, -26.0), (-40.75, -24.6), (-41.05, -22.64), (-26, -20.54)]
HOOD = [(22.4, -18.8), (25.0, -18.1), (30.0, -16.9), (36.0, -15.5), (39.4, -14.5), (37.4, -13.6),
        (30.0, -14.5), (23.4, -16.1)]
WHEEL = [-26.5, 26.5]
WY = -6.5
ARCH, TRIM = 7.4, 8.6
SEAMS = [-25.6, -5.5, 17.6]
BARS = dict(x=[-4.0, 2.9, 9.8, 18.4], w=3.7, top=-12.9, bottom=-5.2, lean=0.8)
STRIPES = dict(x=[24.0, 28.4, 32.8], w=2.6, lean=1.4)
CROSS = dict(x=-9.5, y=[-16.5, -12.5, -8.5], r=1.2)
HEADLIGHT = [(34.4, -13.7), (38.4, -13.85), (40.5, -13.4), (41.4, -12.4), (40.4, -12.0), (36.4, -12.75)]
SHELL = [(-21.6, -39.4), (4.2, -39.4), (5.6, -39.0), (6.4, -38.0), (6.5, -37.1), (5.3, -34.4), (4.1, -33.6),
         (-20.2, -33.6), (-21.5, -34.4), (-23.0, -37.1), (-22.9, -38.0), (-22.3, -39.0)]
RISE = 2


def inpoly(x, y, poly):
    c = False
    n = len(poly)
    for i in range(n):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            c = not c
    return c


def belt(x):
    return -18.8 - (22.4 - x) * 0.036 if x >= -26 else -20.54 - (-26 - x) * 0.14


def wdist(x, y):
    return min(math.hypot(x - wx, y - WY) for wx in WHEEL)


def screen_d(x, y):
    (ax, ay), (bx, by) = (3.2, -28.1), (22.4, -18.8)
    vx, vy = bx - ax, by - ay
    return ((x - ax) * vy - (y - ay) * vx) / -math.hypot(vx, vy)


def band_part(x, y):
    if not inpoly(x, y, BAND):
        return None
    sd = screen_d(x, y)
    if sd < 0.8:
        return 'screen'
    if sd < 1.9:
        return 'apillar'
    if 12.7 <= x < 13.6:
        return 'pillar'
    for x0, x1 in ((-6.6, -4.5), (-27.2, -25.4)):
        if x0 <= x < x1:
            return 'pillar'
    if x < -39.5:
        return 'pillar'
    return 'glass'


def bar_at(x, y):
    B = BARS
    if y < B['top'] or y >= B['bottom']:
        return -1
    t = (B['bottom'] - y) / (B['bottom'] - B['top'])
    for i, bx in enumerate(B['x']):
        x0 = bx + B['lean'] * t
        if x0 <= x < x0 + B['w']:
            return i
    return -1


def crease_y(x):
    (x7, y7), (x5, y5) = HOOD[7], HOOD[5]
    return y7 + (x - x7) * (y5 - y7) / (x5 - x7)


def stripe(x, y):
    if not inpoly(x, y, HOOD):
        return False
    (x0, y0), (x4, y4) = HOOD[0], HOOD[4]
    ye = y0 + (x - x0) * (y4 - y0) / (x4 - x0)
    yc = crease_y(x)
    t = max(0.0, min(1.0, (yc - y) / max(0.5, yc - ye)))
    return any(xb + STRIPES['lean'] * t <= x < xb + STRIPES['lean'] * t + STRIPES['w'] for xb in STRIPES['x'])


def cross(x, y, w=0.6):
    dx = abs(x - CROSS['x'])
    for cy in CROSS['y']:
        dy = abs(y - cy)
        if dx <= CROSS['r'] + 0.3 and dy <= CROSS['r'] + 0.3 and abs(dx - dy) < w * 1.2:
            return True
    return False


def loc(X, Y):
    """Pixel (X, Y) centre in the game's local units."""
    return (X + 0.5 - OX) / S, (Y + 0.5 - OY) / S


def pix(x, y):
    """Local units -> pixel."""
    return int(math.floor(OX + x * S)), int(math.floor(OY + y * S))


def frame():
    K.palette(PAL, dark=DARK)
    cv = K.Canvas(W, H)
    body = {}
    # ---------------------------------------------------------------- the body
    for Y in range(H):
        for X in range(W):
            x, y = loc(X, Y)
            if not inpoly(x, y, PROFILE):
                continue
            r = wdist(x, y)
            if r < ARCH:
                body[(X, Y)] = 'o'                                   # the wheel well
                continue
            bp = band_part(x, y)
            if bp:
                body[(X, Y)] = 'GLASS' if bp in ('glass', 'screen') else 'p'
                continue
            if r < TRIM:
                wx = WHEEL[0] if x < 0 else WHEEL[1]
                body[(X, Y)] = 'P' if (y < WY - 5.5 and x > wx - 3) else 'p'
                continue
            if -5 <= y < -2 or (y >= -6.6 and abs(x) > 39.2):
                body[(X, Y)] = 'P' if (y < -4.2 and abs(x) < 39.2) else 'p'
                continue
            # white paint: base, with the form
            ch = '2'
            if inpoly(x, y, HOOD):
                ch = '1'
            elif y < belt(x) + 0.1 and not inpoly(x, y + 1 / S, BAND) and y < -27:
                ch = '1'                                             # the roof's top edge
            elif x > 23 and abs(y - crease_y(x)) < 0.55 and x < 38.5:
                ch = '3'                                             # under the wing crease
            elif y > -7.4:
                ch = '3'                                             # the lower doors turn under
            elif x < -40.4:
                ch = '3'                                             # the tailgate turns away
            elif y < belt(x) + 1.3 and x > -40:
                ch = '1'                                             # the shoulder under the glass
            body[(X, Y)] = ch
    # door shut lines
    for sx in SEAMS:
        X = pix(sx, 0)[0]
        for Y in range(H):
            if body.get((X, Y)) in ('1', '2', '3'):
                x, y = loc(X, Y)
                if y > belt(x) + 0.3 and wdist(x, y) > TRIM + 0.2:
                    body[(X, Y)] = '3' if body[(X, Y)] != '3' else '4'
    # the livery
    sx1, sx2 = pix(SEAMS[1], 0)[0], pix(SEAMS[2], 0)[0]
    for (X, Y), ch in list(body.items()):
        if ch not in '123':
            continue
        x, y = loc(X, Y)
        if bar_at(x, y) >= 0 and X not in (sx1, sx2):
            body[(X, Y)] = 'R' if y < -10.6 else 'r' if y < -6.6 else 'Q'
        elif stripe(x, y):
            body[(X, Y)] = 'R'

    # the three crosses (X X X) stacked on the rear door, 3 x 3 each
    cx0, cy0 = pix(CROSS['x'], -17.6)
    for k in range(3):
        X0, Y0 = cx0, cy0 + 5 * k
        for dx, dy in ((-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)):
            if body.get((X0 + dx, Y0 + dy)) in ('1', '2', '3'):
                body[(X0 + dx, Y0 + dy)] = 'R' if (dx, dy) == (1, -1) else 'r'
    # the emblem over the rear arch
    ex, ey = pix(-36.3, -16.4)
    body[(ex - 1, ey - 1)] = 'R'; body[(ex, ey - 1)] = 'r'; body[(ex - 1, ey)] = 'r'; body[(ex, ey)] = 'Q'
    # the PARKEERCONTROLE print hint over the front door's bars (two rows of glyph strokes;
    # drawn mirrored, the sprite is flipped on output)
    hint = ['ppo.pp.p.p.pp.pp.ppo.pp.pp.pp.p.p.pp.pp.pp.p',
            'p.p.pp.pp..pp.pp.p.p.pp.p..p.p.pp.p..p.p.p.p']
    hint = ['popp.ppo.p.ppo.pp.p.pop.ppo.p.pp.pop.p',
            'p.p..p.p.p.p.p.p..p.p.p.p.p.p.p..p.p.p']
    hx0 = pix(-7.0, 0)[0]
    hy0 = pix(0, -16.1)[1]
    for j, row in enumerate(hint):
        for i, ch in enumerate(row):
            if ch != '.' and body.get((hx0 + i, hy0 + j)) in ('1', '2'):
                body[(hx0 + i, hy0 + j)] = 'p' if ch == 'p' else 'o'
    # door handles (a dark recess with a lit lip)
    for hx, hy in ((-3.6, -17.4), (-24.4, -18.1)):
        X, Y = pix(hx, hy)
        body[(X, Y)] = '4'; body[(X + 1, Y)] = '4'; body[(X, Y - 1)] = '1'; body[(X + 1, Y - 1)] = '1'
    # lamps: the tail light, the headlight, the hazards, the grille, the fog lamp, the plates
    for (X, Y), ch in list(body.items()):
        x, y = loc(X, Y)
        if x < -40.2 and -22.8 < y < -17.0 and ch in '123':
            body[(X, Y)] = 'R' if y < -21.0 else 'r' if y < -18.6 else 'Q'
        elif inpoly(x, y, HEADLIGHT):
            body[(X, Y)] = 'p' if y < -13.2 else ('i' if x > 39 else '1')
    fx_, fy_ = pix(40.4, -13.0)
    body[(fx_, fy_)] = 'A'; body[(fx_ + 1, fy_)] = 'A'; body[(fx_ + 1, fy_ - 1)] = 'a'     # front hazard
    tx_, ty_ = pix(-41.4, -19.0)
    body[(tx_, ty_)] = 'A'; body[(tx_, ty_ + 1)] = 'a'                                     # rear hazard
    gx, gy = pix(41.2, -11.6)                                                              # the grille
    for k in range(3):
        if (gx, gy + k) in body:
            body[(gx, gy + k)] = 'o' if k != 1 else 's'
        if (gx - 1, gy + k) in body:
            body[(gx - 1, gy + k)] = 'p'
    fgx, fgy = pix(38.6, -8.0)
    body[(fgx, fgy)] = '1'; body[(fgx + 1, fgy)] = 'p'                                      # the fog lamp
    plx, ply = pix(41.4, -9.0)
    for k in range(2):
        for X in (plx, plx - 1):
            if (X, ply + k) in body:
                body[(X, ply + k)] = 'J' if X == plx - 1 or k == 0 else 'j'
    rpx, rpy = pix(-41.8, -12.6)
    for k in range(3):
        for X in (rpx, rpx + 1):
            if (X, rpy + k) in body:
                body[(X, rpy + k)] = 'J' if k else 'i'
    # the black mirror at the base of the quarter glass
    mx, my = pix(15.6, -19.4)
    for X, Y, ch in ((mx - 1, my - 1, 'P'), (mx, my - 1, 'P'), (mx + 1, my - 1, 'p'),
                     (mx - 1, my, 'p'), (mx, my, 'p'), (mx + 1, my, 'o')):
        body[(X, Y)] = ch
    # ---------------------------------------------------------------- the tinted glass and the driver
    for (X, Y), ch in list(body.items()):
        if ch != 'GLASS':
            continue
        x, y = loc(X, Y)
        bp = band_part(x, y)
        top = not inpoly(x, y - 1 / S, BAND)
        foot = not inpoly(x, y + 1 / S, BAND)
        c = 'g' if (top or bp == 'screen') else 'N' if foot else 'n'
        # glint streaks (slanted, in the rear windows)
        u = x + (y + 24) * 0.9
        if -36 < x < -8 and (-30.8 < u < -29.6 or -16.2 < u < -15.6):
            c = 'G' if not foot else 'g'
        body[(X, Y)] = c
    # headrest in the back
    hr = pix(-17.5, -24.2)
    for dx, dy in ((0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1), (1, -1)):
        if body.get((hr[0] + dx, hr[1] + dy)) in ('n', 'g', 'N', 'G'):
            body[(hr[0] + dx, hr[1] + dy)] = 'v'
    # the handhaver at the wheel: cap peak forward, a lit face in profile, the yellow vest at the belt
    dx0, dy0 = pix(-2.6, -27.6)
    drv = K.grid('''
        .VVVV...
        VVVVVVv.
        vvvvvvvv
        .lLLLl..
        .lLL.L..
        .lLLlL..
        .YllYY..
        qqqqqqX.
        YXYYYYXX
    ''')
    # eye at col 4 row 4 ('.' there means: keep a dark eye)
    for j, row in enumerate(drv):
        for i, ch in enumerate(row):
            P = (dx0 + i, dy0 + j)
            if body.get(P) in ('n', 'g', 'N', 'G'):
                if ch != '.':
                    body[P] = ch
                elif (i, j) == (4, 4):
                    body[P] = 'N'
    # the steering wheel rim in front of him
    sw = (dx0 + 9, dy0 + 5)
    for k in range(3):
        if body.get((sw[0], sw[1] + k)) in ('n', 'g', 'N'):
            body[(sw[0], sw[1] + k)] = 'p'
    # parking permit behind the windscreen
    pmx, pmy = pix(16.6, -20.2)
    if body.get((pmx, pmy)) in ('n', 'g', 'N'):
        body[(pmx, pmy)] = '1'
    for (X, Y), ch in body.items():
        cv.px(X, Y, ch, 0, 'body')
    # ---------------------------------------------------------------- the wheels
    for wx in WHEEL:
        cx, cy = OX + wx * S, OY + WY * S
        for Y in range(int(cy) - 8, int(cy) + 9):
            for X in range(int(cx) - 8, int(cx) + 9):
                dx, dy = X + 0.5 - cx, Y + 0.5 - cy
                r = math.hypot(dx, dy)
                if r > 6.6 or Y >= OY:
                    continue
                lit = (dx * 0.6 - dy * 0.8) / max(r, 0.01)
                if r > 4.5:
                    ch = 'P' if lit > 0.55 else 'p' if lit > -0.35 else 'o'
                elif r > 3.6:
                    ch = 'S' if lit > 0.3 else 's' if lit > -0.5 else 'z'
                elif r < 1.2:
                    ch = 'z'
                else:
                    a = math.atan2(dy, dx)
                    spoke = math.cos(5 * (a + 0.3)) > 0.05
                    ch = ('S' if lit > 0.2 else 's') if spoke else ('Z' if lit > -0.2 else 'o')
                cv.px(X, Y, ch, 1, 'wheel')
        hx, hy = int(cx), int(cy)
        cv.px(hx, hy, 'S', 1.1, 'wheel')
    # ---------------------------------------------------------------- the scanner rack and box
    for Y in range(H):
        for X in range(W):
            x, y = loc(X, Y)
            # the rack: the mounting bar and its two feet down to the roof
            if -19.8 <= x < 2.6 and -33.6 <= y < -32.4:
                cv.px(X, Y, 'P' if y < -33.0 else 'p', -1.5, 'rack')
            elif -32.4 <= y < -28.9 and any(f0 + 0.2 <= x < f1 - 0.2 for f0, f1 in ((-19.4, -16.2), (-1.4, 1.8))):
                cv.px(X, Y, 'p' if x < -17.6 or x < 0.2 else 'o', -1.5, 'rack')
            # the lift struts
            elif -33.6 - RISE <= y < -33.6 and any(sx <= x < sx + 1.1 for sx in (-14, -4)):
                cv.px(X, Y, 's', -1.4, 'rack')
            v = y + RISE
            if inpoly(x, v, SHELL):
                ch = '2'
                if v < -38.25:
                    ch = '1'                                         # the lid's top face
                elif abs(v - -37.1) < 0.5:
                    ch = '3'                                         # the seam round the lid
                elif v > -34.6:
                    ch = '3'                                         # the sides slope in underneath
                elif x > 5.0:
                    ch = '1'                                         # the front end faces the light
                elif x < -21.8:
                    ch = '3'
                # side camera windows (smoked, lit red from inside), the front window
                for x0, x1 in ((-20.6, -12.8), (-11.6, -4.6)):
                    if x0 <= x < x1 and -36.7 <= v < -34.2:
                        ch = 'E' if v > -35.2 else 'Q'
                if inpoly(x, v, [(5.5, -36.8), (6.4, -36.8), (5.4, -34.3), (4.4, -34.3)]):
                    ch = 'O'
                if inpoly(x, v, [(-22.2, -36.8), (-21.5, -36.8), (-20.5, -34.3), (-21.2, -34.3)]):
                    ch = 'Q'
                # the grey band with the number
                t = (v + 39.4) / 5.8
                bx0 = -1.9 + (-2.5 - -1.9) * t
                if bx0 <= x < bx0 + 3.6 and v > -38.25 and abs(v - -37.1) >= 0.5:
                    ch = 'q'
                cv.px(X, Y, ch, -1, 'scan')
    # the number 24 on the grey band (two dark marks) and the lens behind the middle window
    nx, ny = pix(-2.2, -36.4 - RISE)
    cv.px(nx, ny, '4', -1, 'scan'); cv.px(nx + 2, ny, '4', -1, 'scan')
    cv.px(nx, ny + 1, '4', -1, 'scan'); cv.px(nx + 2, ny + 1, '4', -1, 'scan'); cv.px(nx + 1, ny + 1, '4', -1, 'scan')
    lx, ly = pix(-8.9, -35.5 - RISE)
    cv.px(lx, ly, 'w', -1, 'scan'); cv.px(lx + 1, ly, 'O', -1, 'scan'); cv.px(lx, ly + 1, 'O', -1, 'scan')
    cv.px(lx - 1, ly, 'O', -1, 'scan')
    rows, root = K.finish(cv, (OX, OY))
    # ---------------------------------------------------------------- the lock: the front camera fires a red ray
    rows = [list(r) for r in rows]
    fx0, fy0 = pix(6.6, -35.6 - RISE)
    # a glare on the front camera window, then a tapering beam down towards the hero (1 down per 2 across)
    ray = [(fx0, fy0, 'w'), (fx0 + 1, fy0, 'w'), (fx0 + 1, fy0 - 1, 'O'), (fx0 + 1, fy0 + 1, 'O'), (fx0 + 2, fy0, 'O')]
    for i in range(3, 19):
        Y = fy0 + (i - 1) // 2
        ray.append((fx0 + i, Y, 'O' if i < 13 else 'E'))
        if i < 9:
            ray.append((fx0 + i, Y + 1, 'E'))
    for X, Y, ch in ray:
        if 0 <= X < W and 0 <= Y < H and rows[Y][X] in '.K':
            rows[Y][X] = ch
    return [''.join(r) for r in rows], root
