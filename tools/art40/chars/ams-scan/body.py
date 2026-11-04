# SCANAUTO: the body (boss/ams-scan/body-<state>) - the compact, tall white electric hatchback in the
# city's livery, the cast sample's paint at S = 1: 4-tone white with a lit bonnet face and roof
# edge, the shoulder under the glass, the doors turning under; the red slanted bars, the bonnet
# stripes, the three crosses, the emblem; one band of tinted glass with black pillars (NOW part of
# the body: the cabin strip only holds what sits behind it); arch trims, sill, bumpers; the lamps.
#
# Damage (Boss.partState): 1 dents with lit lips, scratches across the red bars, a cracked rear
# side window; 2 more dents, a buckled bonnet, soot over the front, a cracked windscreen, a dead
# headlight, the front bumper corner hanging, the mirror dangling.
import math

from . import geo as G
from .geo import pix

DENTS = {1: [(-37.5, -12.5), (8.5, -9.5), (34.5, -11.5)],
         2: [(-37.5, -12.5), (8.5, -9.5), (34.5, -11.5), (-15.5, -10.5), (-39.5, -9.5), (20.5, -14.5), (1.5, -9.0)]}
SCUFFS = {1: [(3.5, -10.5, 8, -8.5), (10.5, -7.5, 14, -9.6)],
          2: [(3.5, -10.5, 8, -8.5), (10.5, -7.5, 14, -9.6), (-3.8, -7, 0.4, -9.8), (17.6, -12.4, 20.4, -11.2)]}


def soot(x, y):
    return max(0.0, 1 - math.hypot((x - 35) / 8.5, (y + 13.5) / 5.5))


def paint(state=0):
    """The level body as a raster (local px), every part 'body' at z 0."""
    b = {}
    for Y in range(-31, 1):
        for X in range(-44, 45):
            x, y = X + 0.5, Y + 0.5
            if state == 2 and 27 <= X <= 34 and Y == -17 and G.inpoly(x, y + 1, G.HOOD):
                b[(X, Y)] = '1'                                      # the buckled bonnet bulges up
                continue
            if not G.inpoly(x, y, G.PROFILE):
                continue
            r = G.wdist(x, y)
            if r < G.ARCH:
                b[(X, Y)] = 'o'                                      # the wheel well
                continue
            bp = G.band_part(x, y)
            if bp:
                b[(X, Y)] = 'GLASS' if bp in ('glass', 'screen') else 'p'
                continue
            if r < G.TRIM:
                wx = G.WHEEL[0] if x < 0 else G.WHEEL[1]
                b[(X, Y)] = 'P' if (y < G.WY - 5.5 and x > wx - 3) else 'p'
                continue
            if -5 <= y < -2 or (y >= -6.6 and abs(x) > 39.2):
                b[(X, Y)] = 'P' if (y < -4.2 and abs(x) < 39.2) else 'p'
                continue
            ch = '2'
            if G.inpoly(x, y, G.HOOD):
                ch = '1'
            elif y < G.belt(x) + 0.1 and not G.inpoly(x, y + 1, G.BAND) and y < -27:
                ch = '1'                                             # the roof's top edge
            elif x > 23 and abs(y - G.crease_y(x)) < 0.55 and x < 38.5:
                ch = '3'                                             # under the wing crease
            elif y > -7.4:
                ch = '3'                                             # the lower doors turn under
            elif x < -40.4:
                ch = '3'                                             # the tailgate turns away
            elif y < G.belt(x) + 1.3 and x > -40:
                ch = '1'                                             # the shoulder under the glass
            b[(X, Y)] = ch
    # door shut lines
    for sx in G.SEAMS:
        X = pix(sx, 0)[0]
        for Y in range(-31, 1):
            if b.get((X, Y)) in ('1', '2', '3'):
                x, y = X + 0.5, Y + 0.5
                if y > G.belt(x) + 0.3 and G.wdist(x, y) > G.TRIM + 0.2:
                    b[(X, Y)] = '3' if b[(X, Y)] != '3' else '4'
    # the livery
    sx1, sx2 = pix(G.SEAMS[1], 0)[0], pix(G.SEAMS[2], 0)[0]
    for (X, Y), ch in list(b.items()):
        if ch not in '123':
            continue
        x, y = X + 0.5, Y + 0.5
        if G.bar_at(x, y) >= 0 and X not in (sx1, sx2):
            b[(X, Y)] = 'R' if y < -10.6 else 'r' if y < -6.6 else 'Q'
        elif G.stripe(x, y):
            b[(X, Y)] = 'R'
    # the three crosses stacked on the rear door, 3 x 3 each
    cx0, cy0 = pix(G.CROSS['x'], -17.6)
    for k in range(3):
        X0, Y0 = cx0, cy0 + 4 * k
        for dx, dy in ((-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)):
            if b.get((X0 + dx, Y0 + dy)) in ('1', '2', '3'):
                b[(X0 + dx, Y0 + dy)] = 'R' if (dx, dy) == (1, -1) else 'r'
    # the emblem over the rear arch
    ex, ey = pix(-36.3, -16.4)
    b[(ex - 1, ey - 1)] = 'R'; b[(ex, ey - 1)] = 'r'; b[(ex - 1, ey)] = 'r'; b[(ex, ey)] = 'Q'
    # door handles (a dark recess with a lit lip)
    for hx, hy in ((-3.6, -17.4), (-24.4, -18.1)):
        X, Y = pix(hx, hy)
        b[(X, Y)] = '4'; b[(X + 1, Y)] = '4'; b[(X, Y - 1)] = '1'; b[(X + 1, Y - 1)] = '1'
    # lamps: the tail light, the headlight
    for (X, Y), ch in list(b.items()):
        x, y = X + 0.5, Y + 0.5
        if x < -40.2 and -22.8 < y < -17.0 and ch in '123':
            b[(X, Y)] = 'R' if y < -21.0 else 'r' if y < -18.6 else 'Q'
        elif G.inpoly(x, y, G.HEADLIGHT):
            b[(X, Y)] = 'p' if y < -13.2 else ('i' if x > 39 else '1')
    fx_, fy_ = pix(40.4, -13.0)
    b[(fx_, fy_)] = 'A'; b[(fx_ + 1, fy_)] = 'A'; b[(fx_ + 1, fy_ - 1)] = 'a'          # front hazard
    tx_, ty_ = pix(-41.4, -19.0)
    b[(tx_, ty_)] = 'A'; b[(tx_, ty_ + 1)] = 'a'                                          # rear hazard
    gx, gy = pix(41.2, -11.6)                                                             # the grille
    for k in range(3):
        if (gx, gy + k) in b:
            b[(gx, gy + k)] = 'o' if k != 1 else 's'
        if (gx - 1, gy + k) in b:
            b[(gx - 1, gy + k)] = 'p'
    fgx, fgy = pix(38.6, -8.0)
    b[(fgx, fgy)] = '1'; b[(fgx + 1, fgy)] = 'p'                                           # the fog lamp
    plx, ply = pix(41.4, -9.0)
    for k in range(2):
        for X in (plx, plx - 1):
            if (X, ply + k) in b:
                b[(X, ply + k)] = 'J' if X == plx - 1 or k == 0 else 'j'
    rpx, rpy = pix(-41.8, -12.6)
    for k in range(3):
        for X in (rpx, rpx + 1):
            if (X, rpy + k) in b:
                b[(X, rpy + k)] = 'J' if k else 'i'
    # the black mirror at the base of the quarter glass (state 2: it dangles on its cable)
    mx, my = pix(15.6, -19.4)
    if state < 2:
        for X, Y, ch in ((mx - 1, my - 1, 'P'), (mx, my - 1, 'P'), (mx + 1, my - 1, 'p'),
                         (mx - 1, my, 'p'), (mx, my, 'p'), (mx + 1, my, 'o')):
            b[(X, Y)] = ch
    else:
        b[(mx, my - 1)] = 'o'
        for X, Y, ch in ((mx + 1, my, 'o'), (mx + 1, my + 1, 'p'), (mx + 1, my + 2, 'P'), (mx + 2, my + 2, 'p'),
                         (mx + 1, my + 3, 'p'), (mx + 2, my + 3, 'o')):
            b[(X, Y)] = ch
    # ------------------------------------------------------------------ the tinted glass
    for (X, Y), ch in list(b.items()):
        if ch != 'GLASS':
            continue
        x, y = X + 0.5, Y + 0.5
        bp = G.band_part(x, y)
        top = not G.inpoly(x, y - 1, G.BAND)
        foot = not G.inpoly(x, y + 1, G.BAND)
        c = 'g' if (top or bp == 'screen') else 'N' if foot else 'n'
        u = x + (y + 24) * 0.9
        if -36 < x < -8 and (-30.8 < u < -29.6 or -16.2 < u < -15.6):
            c = 'G' if not foot else 'g'
        b[(X, Y)] = c
    # the headrest in the back, the steering wheel rim, the parking permit
    hr = pix(-17.5, -24.2)
    for dx, dy in ((0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1), (1, -1)):
        if b.get((hr[0] + dx, hr[1] + dy)) in ('n', 'g', 'N', 'G'):
            b[(hr[0] + dx, hr[1] + dy)] = 'v'
    sw = (G.DRIVER[0] + 8, G.DRIVER[1] + 5)
    for k, ch in enumerate('pPp'):
        if b.get((sw[0], sw[1] + k)) in ('n', 'g', 'N'):
            b[(sw[0], sw[1] + k)] = ch
    pmx, pmy = pix(16.6, -20.2)
    if b.get((pmx, pmy)) in ('n', 'g', 'N'):
        b[(pmx, pmy)] = '1'
    # ------------------------------------------------------------------ damage
    if state >= 1:
        _dents(b, DENTS[state])
        _scuffs(b, SCUFFS[state])
        _crack(b, (-33, -24), 3)                                     # the rear side window
    if state >= 2:
        _crack(b, (-20, -24), 3)                                     # the rear door glass
        _crack(b, (-14, -23), 2)
        for (X, Y), ch in list(b.items()):                          # soot over the bonnet and the front
            s = soot(X + 0.5, Y + 0.5)
            if s > 0.35 and ch in '123R':
                b[(X, Y)] = {'1': '3', '2': '3', '3': '4', 'R': 'Q'}[ch] if s < 0.75 else ('4' if ch != 'R' else 'Q')
        for (X, Y), ch in list(b.items()):                          # the dead headlight
            if G.inpoly(X + 0.5, Y + 0.5, G.HEADLIGHT) and ch in ('1', 'i'):
                b[(X, Y)] = 'p' if (X + Y) % 2 else 'Z'
        for X in (40, 41):                                           # the bumper's front corner hangs
            b[(X, -2)] = 'p'
        b[(41, -1)] = 'o'
    out = G.Raster()
    for (X, Y), ch in b.items():
        out.put(X, Y, ch, 0, 'body')
    return out


def _dents(b, spots):
    for (cx, cy) in spots:
        X, Y = pix(cx, cy)
        for dx, dy, ch in ((-1, 0, '3'), (0, 0, '4'), (1, 0, '3'), (0, 1, '3'), (-1, -1, '1'), (0, -1, '1')):
            P = (X + dx, Y + dy)
            v = b.get(P)
            if v in ('1', '2', '3'):
                b[P] = ch
            elif v in ('R', 'r', 'Q'):
                b[P] = {'3': 'r', '4': 'Q', '1': 'R'}[ch] if ch != '1' else 'R'


def _scuffs(b, lines):
    for (x0, y0, x1, y1) in lines:
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for k in range(n + 1):
            t = k / n
            P = pix(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)
            v = b.get(P)
            if v in ('R', 'r'):
                b[P] = '3' if k % 3 else '2'
            elif v == 'Q':
                b[P] = 'r'
            elif v in ('2', '1'):
                b[P] = '3'


def _crack(b, c, n):
    """A star crack in the glass: a white impact point, light lines that fade into the tint."""
    X0, Y0 = c
    if b.get((X0, Y0)) not in ('n', 'g', 'N', 'G'):
        return
    b[(X0, Y0)] = '2'
    for dx, dy in ((1, -1), (-1, 1), (1, 1), (-1, -1), (2, 0), (-2, 0)):
        for k in range(1, n + 1):
            P = (X0 + (dx * k + (1 if dx == 0 else 0)) // (2 if abs(dx) == 2 else 1), Y0 + dy * k)
            if abs(dx) == 2:
                P = (X0 + (k if dx > 0 else -k), Y0 + (k // 2) * (1 if dx > 0 else -1))
            if b.get(P) in ('n', 'g', 'N', 'G'):
                b[P] = 'G' if k < n else 'g'


def car_level(state=0):
    return paint(state)
