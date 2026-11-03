# ST. PLECHELMUS, the mini-boss of the haunted town: the seated stone statue of the town's patron
# saint, a bishop, woken by the ghost. Mitre, collar, chasuble over the robe, the stole, a small
# reliquary in the raised right hand, the long crozier in the left; weathered grey-green stone with
# lichen and cracks, on a stepped plinth of square blocks with a dark plaque and a stone throne.
# One frame: the crozier sweep wind-up (geometry.ts SIT_POSES 'sweep-back'): the crozier drawn back
# and up, glowing, the stone eyes glowing, the cracks lit from inside.
#
# The art is frontal and the game never mirrors it (the crozier stays on the viewer's right). This
# module draws the final screen image (light from the upper left, toward the heroes) and returns it
# mirrored, so cast.py's face=-1 mirror gives the game's image back.
import math
import castkit as K

INFO = dict(
  name='ST. PLECHELMUS', mission=['oldenzaal'], role='boss', kind='MACHINE', face=-1,
  pose='seated on the plinth, the crozier drawn back and glowing for the sweep, eyes lit',
  note='carved flat planes with crisp chipped edges, lichen and lit cracks; mitre, crozier and the '
       'stepped plinth with the plaque read at 1x; size from geometry.ts (plinth 60 x 46, ~120 tall)',
  old='boss/oz-plechelmus/sit#1',
  air=0,
)

K.palette({
  # the statue: weathered grey-green stone (lit .. deepest)
  '1': '#d9dfcc', '2': '#aab4a0', '3': '#7f8b7b', '4': '#5a6559', '5': '#383f3c',
  # the plinth and throne: paler, warmer weathered stone
  '6': '#cec6b1', '7': '#a69e8a', '8': '#7b7465', '9': '#514b43',
  # lichen
  'a': '#a7b45c', 'k': '#6b7a39',
  # the plaque: dark bronze, raised letters
  'n': '#3c3a33', 'N': '#25231f', 'g': '#a99c70',
  # the curse's green glow (cracks, eyes, the crozier's tell)
  'Y': '#efffe2', 'V': '#86f5a0', 'C': '#2fc872', 'E': '#1d7a4c',
}, dark={'1': '5', '2': '5', '3': '5', '4': '5', '5': '5', '6': '9', '7': '9', '8': '9', '9': '9',
         'a': 'k', 'k': '5', 'n': 'N', 'N': 'N', 'g': 'n', 'Y': 'C', 'V': 'C', 'C': 'E', 'E': 'E'})

W, H = 104, 130
CX, FLOOR = 46, 125          # the plinth's foot centre on the canvas
TOP = FLOOR - 46             # the plinth's top (the saint's feet rest here)
_L = (-0.42, -0.62, 0.66)
_n = math.sqrt(sum(v * v for v in _L))
LIGHT = tuple(v / _n for v in _L)
STONE = '12345'
PLINTH = '6789'


def tone(n, ramp=STONE, bias=0.0):
    l = sum(a * b for a, b in zip(n, LIGHT)) + bias
    if ramp == STONE:
        k = 0 if l > 0.86 else 1 if l > 0.60 else 2 if l > 0.30 else 3 if l > 0.02 else 4
    else:
        k = 0 if l > 0.80 else 1 if l > 0.50 else 2 if l > 0.15 else 3
    return ramp[k]


def unit(x, y, z):
    m = math.sqrt(x * x + y * y + z * z) or 1
    return (x / m, y / m, z / m)


def hsh(x, y, s=0):
    v = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xffffffff
    v = ((v ^ (v >> 13)) * 1274126177) & 0xffffffff
    return (v & 0xffff) / 65535.0


class Stone:
    def __init__(s):
        s.cv = K.Canvas(W, H)

    def px(s, x, y, ch, z, part):
        s.cv.px(x, y, ch, z, part)

    def get(s, x, y):
        if 0 <= x < W and 0 <= y < H:
            return s.cv.c[y][x]
        return '.'

    def poly(s, pts, z, part, shade):
        """Fill a polygon (statue coords: x from the centre, y up from the plinth top is negative);
        shade(x, y) -> letter (x, y relative)."""
        P = [(CX + x, TOP + y) for x, y in pts]
        ys = [p[1] for p in P]
        for Y in range(int(math.floor(min(ys))), int(math.ceil(max(ys))) + 1):
            xs = []
            n = len(P)
            for i in range(n):
                (x1, y1), (x2, y2) = P[i], P[(i + 1) % n]
                if (y1 <= Y < y2) or (y2 <= Y < y1):
                    xs.append(x1 + (Y - y1) * (x2 - x1) / (y2 - y1))
            xs.sort()
            for a, b in zip(xs[::2], xs[1::2]):
                for X in range(int(math.ceil(a - 0.01)), int(math.floor(b + 0.01)) + 1):
                    ch = shade(X - CX, Y - TOP)
                    if ch:
                        s.px(X, Y, ch, z, part)

    def rect(s, x0, y0, x1, y1, z, part, shade):
        s.poly([(x0, y0), (x1 + 0.99, y0), (x1 + 0.99, y1 + 0.99), (x0, y1 + 0.99)], z, part, shade)

    def ell(s, cx, cy, rx, ry, z, part, shade):
        for Y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for X in range(int(cx - rx) - 1, int(cx + rx) + 2):
                u, v = (X - cx) / rx, (Y - cy) / ry
                if u * u + v * v <= 1.0:
                    ch = shade(X, Y, u, v)
                    if ch:
                        s.px(CX + X, TOP + Y, ch, z, part)

    def tube(s, a, b, ra, rb, z, part, ramp='1234', cut=(0.78, 0.45, 0.10)):
        s.cv.tube((CX + a[0], TOP + a[1]), (CX + b[0], TOP + b[1]), ra, rb, list(ramp), z, part, light=LIGHT, cut=cut)

    def grid(s, x0, y0, rows, z, part):
        s.cv.grid(CX + x0, TOP + y0, rows, z, part)


def block(S, x0, y0, x1, y1, z, part, seed, chip=True):
    """A cut stone block seen from the front: a lit top edge and left edge, a shaded right edge and
    bottom, rain streaks, a chipped corner or two, a lichen patch."""
    def sh(x, y):
        if y == y0:
            return '6'
        if y == y1:
            return '8'
        if x == x0:
            return '6' if y < y1 - 1 else '7'
        if x == x1:
            return '8'
        h = hsh(x, 0, seed)
        if h > 0.80 and (y - y0) < 3 + int(h * 9) % 6:
            return '8'
        return '7'
    S.rect(x0, y0, x1, y1, z, part, sh)
    if chip:
        c = hsh(x0, y0, seed + 1)
        if c > 0.45:      # a chipped top corner: the notch shows the shaded break
            cx = x1 if c > 0.72 else x0
            d = -1 if cx == x1 else 1
            for k in range(2):
                S.cv.c[TOP + y0][CX + cx + d * k] = '.'
            S.cv.c[TOP + y0 + 1][CX + cx] = '.'
            S.px(CX + cx + d, TOP + y0 + 1, '9', z + 0.01, part)
            S.px(CX + cx + d * 2, TOP + y0, '9', z + 0.01, part)
            S.px(CX + cx, TOP + y0 + 2, '9', z + 0.01, part)


def lichen(S, cx, cy, w, h, seed, part=None):
    """A lichen patch: a soft blob of two greens on the stone that is already there."""
    for y in range(-h, h + 1):
        for x in range(-w, w + 1):
            u, v = x / (w + 0.5), y / (h + 0.5)
            r = u * u + v * v + 0.35 * hsh(cx + x, cy + y, seed)
            X, Y = CX + cx + x, TOP + cy + y
            if r < 0.9 and S.get(X, Y) not in '.K' and (part is None or S.cv.p[Y][X] == part):
                S.cv.c[Y][X] = 'a' if (v < 0 and r < 0.6) else 'k'


def crack(S, pts, glow=True):
    """A crack in the stone: a dark break, lit green from inside where it is widest."""
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        n = int(max(abs(x2 - x1), abs(y2 - y1))) + 1
        for i in range(n + 1):
            t = i / n
            X, Y = CX + round(x1 + (x2 - x1) * t), TOP + round(y1 + (y2 - y1) * t)
            if S.get(X, Y) not in '.K':
                S.cv.c[Y][X] = 'V' if glow else '5'
                S.cv.p[Y][X] = 'fx'


# ------------------------------------------------------------------------------- the font
FONT = {
  'S': ["111", "1..", "111", "..1", "111"], 'T': ["111", ".1.", ".1.", ".1.", ".1."],
  '.': ["...", "...", "...", "...", ".1."], 'P': ["111", "1.1", "111", "1..", "1.."],
  'L': ["1..", "1..", "1..", "1..", "111"], 'E': ["111", "1..", "11.", "1..", "111"],
  'C': ["111", "1..", "1..", "1..", "111"], 'H': ["1.1", "1.1", "111", "1.1", "1.1"],
  'M': ["1.1", "111", "111", "1.1", "1.1"], 'U': ["1.1", "1.1", "1.1", "1.1", "111"],
}


def text(S, s, x0, y0, z):
    x = x0
    for ch in s:
        g = FONT[ch]
        for j, r in enumerate(g):
            for i, c in enumerate(r):
                if c == '1':
                    S.px(CX + x + i, TOP + y0 + j, 'g', z, 'plaque')
        x += 4 if ch != '.' else 2


# ------------------------------------------------------------------------------- the plinth
def plinth(S):
    # the foot slab, three courses of blocks, the top slab (the cornice overhangs)
    S.rect(-30, 41, 29, 45, 0, 'plinth', lambda x, y: '6' if y == 41 else '8' if y >= 44 else '7')
    for x0, x1 in ((-27, -10), (-9, 8), (9, 26)):
        block(S, x0, 29, x1, 40, 0.1, 'plinth', 11 + x0)
    for x0, x1 in ((-25, -23), (22, 24)):
        block(S, x0, 17, x1, 28, 0.1, 'plinth', 21 + x0, chip=False)
    for x0, x1 in ((-23, -5), (-4, 22)):
        block(S, x0, 5, x1, 16, 0.1, 'plinth', 31 + x0)
    S.rect(-26, 0, 25, 4, 0.2, 'plinth', lambda x, y: '6' if y == 0 else '9' if y == 4 else '8' if x > 20 else '7')
    # the plaque between the middle course's blocks
    S.rect(-22, 17, 21, 28, 0.3, 'plaque', lambda x, y: 'N' if y == 17 or x == -22 else 'n')
    text(S, 'ST.', -5, 18, 0.4)
    text(S, 'PLECHELMUS', -20, 23, 0.4)
    lichen(S, -24, 39, 3, 1, 3, 'plinth')
    lichen(S, 22, 16, 2, 1, 5, 'plinth')
    lichen(S, 25, 2, 2, 1, 7, 'plinth')


def streaks(S):
    """Rain streaks: short darker runs down the stone under the ledges (collar, knees, shoulders)."""
    for x0, y0, n in ((-9, -43, 5), (-6, -42, 3), (5, -42, 4), (-13, -21, 4), (-4, -21, 6), (9, -21, 3),
                      (-18, -36, 5), (3, -62, 4), (-24, -29, 6), (19, -28, 5)):
        for k in range(n):
            X, Y = CX + x0, TOP + y0 + k
            ch = S.get(X, Y)
            dk = {'1': '2', '2': '3', '3': '4', '6': '7', '7': '8'}
            if ch in dk:
                S.cv.c[Y][X] = dk[ch]


def throne(S):
    """The stone chair: a low back just showing behind the shoulders, two side blocks by the lap."""
    def back(x, y):
        if y <= -50:
            return '7'
        return '8' if x < 20 else '9'
    S.poly([(-21, -40), (21, -40), (22, -36), (22, -1), (-22, -1), (-22, -36)], -1, 'throne', back)
    for x0, x1 in ((-25, -18), (17, 24)):
        def side(x, y, x0=x0, x1=x1):
            if y <= -30:
                return '6' if x0 < 0 else '7'
            if x == x0:
                return '7'
            if x == x1:
                return '9'
            return '8'
        S.rect(x0, -31, x1, -1, 1.5, 'throne', side)


# ------------------------------------------------------------------------------- the saint
LEAN = 2


def lx(x, y):
    """The upper body leans a little toward the sweep (shoulders move, the hem stays)."""
    k = max(0.0, min(1.0, (-y - 14) / 40))
    return x + LEAN * k


def folds(x, period, phase=0.0):
    """Carved vertical folds: a ridge facing left (lit), a face to the right (shade), a groove."""
    f = ((x + phase) / period) % 1.0
    if f < 0.12:
        return unit(0, 0, 1), True           # the groove
    if f < 0.55:
        return unit(-0.55, 0, 0.84), False   # lit face
    return unit(0.6, 0, 0.8), False          # shaded face


def robe(S):
    # the cope's back: the mantle falls past the lap on both sides
    def cope(x, y):
        n = unit(-0.75 if x < 0 else 0.75, -0.1, 0.65)
        return tone(n)
    S.poly([(lx(-14, -48), -49), (lx(14, -48), -49), (22, -38), (22, -20), (20, -3), (-20, -3), (-22, -20), (-22, -38)], 2, 'cope', cope)
    # the robe from the knees to the feet: deep vertical folds
    GROOVES = (-11, -5, 1, 6, 11)

    def lower(x, y):
        if y >= -3:
            return '4' if x < 12 else '5'
        f = 1 + (y + 26) / 70.0                     # the folds fan out toward the hem
        gs = [round(g * f) for g in GROOVES]
        if x in gs:
            return '5' if y > -15 else '4'
        g = max([-17] + [gx for gx in gs if gx < x])
        rel = x - g
        if rel <= 2:
            return '2' if x < 2 else '3'            # the lit face of the ridge
        return '3' if x < 6 else '4'                # the face turned away
    S.poly([(-16, -26), (16, -26), (16, -19), (14.5, -2), (-14.5, -2), (-16, -19)], 3, 'robe', lower)
    # the shadow under the knees' overhang
    S.rect(-15, -19, 15, -18, 3.2, 'robe', lambda x, y: '4' if abs(x) < 15 else None)
    # the knees and the lap: lit tops, a valley between them
    for kx in (-8, 8):
        S.ell(kx, -23, 6.2, 4.4, 4.4, 'knee' + str(kx), lambda X, Y, u, v: '1' if v < -0.45 and u < 0.5 else '2' if v < 0.1 and u < 0.4 else '3' if v < 0.6 and u < 0.8 else '4')
    # the feet: sandalled toes under the hem
    for fx in (-6, 6):
        S.ell(fx, -1.5, 3.4, 1.6, 5, 'feet', lambda X, Y, u, v: '2' if v < -0.2 else '3' if u < 0.3 else '4')


def chasuble(S):
    # a bell from the shoulders to a soft point over the lap, slightly curved (lit on the left)
    pts = [(-11, -46), (11, -46), (15, -36), (16, -29)]
    for i in range(1, 8):
        u = i / 8
        x = 16 - 32 * u
        pts.append((x, -26 - 4 * (abs(2 * u - 1) ** 1.6)))
    pts += [(-16, -29), (-15, -36)]
    pts = [(lx(x, y), y) for x, y in pts]

    def sh(x, y):
        n, g = folds(x, 7.0, 0.5)
        if g and y > -40:
            return '4'
        cx = x / 17
        base = unit(cx * 0.9 + n[0] * 0.5, -0.15, 0.9)
        if y > -30 + abs(x) * 0.0 and y > -29:
            return tone(base, bias=-0.2)
        return tone(base)
    S.poly(pts, 5, 'chas', sh)
    # the stole: a raised band down the front with a small cross
    def stole(x, y):
        if x <= LEAN - 2:
            return '1'
        if x >= LEAN + 1:
            return '3'
        return '2'
    S.poly([(lx(-2, -46), -46), (lx(2, -46), -46), (2.5, -27), (-2.5, -27)], 6, 'stole', stole)
    cxs = lx(0, -38)
    S.rect(round(cxs) - 1, -40, round(cxs) + 1, -40, 6.5, 'cross', lambda x, y: '1')
    S.rect(round(cxs), -42, round(cxs), -37, 6.5, 'cross', lambda x, y: '1')
    # the broad collar of the cope
    S.ell(lx(0, -47), -47, 11.5, 3.4, 6.6, 'collar', lambda X, Y, u, v: '1' if v < -0.3 and u < 0.5 else '2' if v < 0.3 and u < 0.6 else '3' if u < 0.85 else '4')


def head(S):
    hx, hy = lx(0, -56), -56
    # the neck, in the collar's shadow
    S.rect(round(hx) - 3, -50, round(hx) + 3, -48, 6.7, 'neck', lambda x, y: '4' if x > hx else '3')

    gx = round(hx)
    G = [
      "...1112223...",
      "..111122223..",
      ".11111222233.",
      "1111111122334",
      "15YV51125VY54",
      "1255511355544",
      "1222211333334",
      "1222212333344",
      "1222245533344",
      ".12222223334.",
      ".12555555344.",
      "..122222334..",
      "...1223344...",
      "....22334....",
    ]
    # carved flat planes: the lit brow ridge, deep sockets with the glowing eyes, the straight nose
    # with its shadow, a firm mouth line, the chin; the ears
    S.grid(gx - 6, -63, G, 7, 'head')
    S.grid(gx - 7, -59, ["2", "2", "3"], 6.9, 'ear')
    S.grid(gx + 7, -59, ["4", "4", "5"], 6.9, 'ear')
    # the mitre: a tall shield shape to a point, the orphrey bands
    def mitre(x, y):
        if y >= -64:
            return '1' if y == -64 else '3'           # the band at the base
        if abs(x - hx) < 1.2:
            return '1' if x - hx < 0 else '2'          # the upright band
        n = unit((x - hx) / 7 * 0.8, -0.3, 0.8)
        return tone(n)
    S.poly([(hx - 6, -62), (hx + 6, -62), (hx + 6.5, -68), (hx + 4, -73), (hx, -77), (hx - 4, -73), (hx - 6.5, -68)], 7.2, 'mitre', mitre)


def arms(S):
    sR, sL = (lx(-12.5, -44), -44), (lx(12.5, -44), -44)
    # the saint's right arm (viewer's left): raised, the reliquary in the hand
    hR = (-17, -42)
    eR = (-21, -33)
    S.tube(sR, eR, 4.2, 3.8, 6, 'armR')
    S.tube(eR, hR, 3.6, 3.0, 6.2, 'armR')
    # the wide sleeve hangs below the forearm
    S.poly([(eR[0] - 3.5, eR[1] - 1), (eR[0] + 3, eR[1] + 2), (eR[0] + 1, eR[1] + 8), (eR[0] - 4, eR[1] + 6)], 5.9, 'sleeveR',
           lambda x, y: '2' if x < eR[0] - 1 else '3' if y < eR[1] + 5 else '4')
    S.grid(hR[0] - 3, hR[1] - 9, [
      "...1...",
      "..112..",
      "...1...",
      ".1112..",
      "1122223",
      ".12223.",
      ".12223.",
      ".2333..",
      "123334.",
      "1223344",
      ".23334.",
    ], 7.6, 'relic')
    # the saint's left arm (viewer's right): the crozier hand raised, drawn back for the sweep
    hL = (22, -52)
    eL = (25, -38)
    S.tube(sL, eL, 3.8, 3.4, 6, 'armL', ramp='2345', cut=(0.75, 0.42, 0.08))
    # the forearm, bare of the wide sleeve that has slid down and hangs from the elbow
    S.tube(eL, hL, 2.8, 2.4, 6.4, 'foreL', ramp='1234', cut=(0.70, 0.38, 0.05))
    S.poly([(eL[0] - 3, eL[1] - 2), (eL[0] + 3.5, eL[1] - 3), (eL[0] + 4, eL[1] + 6), (eL[0] + 1, eL[1] + 9), (eL[0] - 2, eL[1] + 5)], 6.2, 'sleeveL',
           lambda x, y: '2' if y < eL[1] - 1 else '3' if x < eL[0] + 1 else '4')
    return hL


def crozier(S, hL):
    a = math.radians(60)
    d = (math.sin(a), -math.cos(a))
    foot = (hL[0] - 44 * d[0], hL[1] - 44 * d[1])
    top = (hL[0] + 24 * d[0], hL[1] + 24 * d[1])
    # the shaft: a thin round staff of the same stone
    S.tube(foot, top, 1.7, 1.7, 8, 'crozier', ramp='1235', cut=(0.55, 0.15, -0.3))
    # the curl: a crook that turns back toward the saint, with a knop under it
    # the crook goes on from the shaft (its tangent), arcs over and curls in to a small knob
    perp = (math.cos(a), math.sin(a))            # down-right of the shaft: the crook opens outward
    R0 = 5.5
    cc = (top[0] + R0 * perp[0], top[1] + R0 * perp[1])
    t0 = math.atan2(top[1] - cc[1], top[0] - cc[0])
    pts = []
    for i in range(0, 301, 6):
        t = t0 + math.radians(i)
        r = R0 - 2.8 * i / 300
        pts.append((cc[0] + r * math.cos(t), cc[1] + r * math.sin(t)))
    for p, q in zip(pts, pts[1:]):
        S.tube(p, q, 1.6, 1.3, 8, 'crozier', ramp='1235', cut=(0.6, 0.2, -0.3))
    S.ell(top[0], top[1] + 1, 2.4, 1.6, 8.2, 'crozier', lambda X, Y, u, v: '1' if v < -0.2 else '3')
    # the fist over the shaft
    S.grid(round(hL[0]) - 3, round(hL[1]) - 3, [
      ".2233.",
      "211234",
      "212345",
      "212345",
      ".2345.",
      "..44..",
    ], 8.5, 'fist')
    return cc, foot, top


def glow(rows, parts, keep):
    """The tell: a 2 px green glow hugging the crozier's head (fx, no outline) on empty pixels."""
    src = {(x, y) for y, r in enumerate(parts) for x, p in enumerate(r) if p == 'crozier' and keep(x, y)}
    ring1, ring2 = set(), set()
    for x, y in src:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                ring1.add((x + dx, y + dy))
    for x, y in ring1:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ring2.add((x + dx, y + dy))
    for (x, y) in ring2 | ring1:
        if 0 <= y < len(rows) and 0 <= x < len(rows[0]) and rows[y][x] in '.':
            rows[y][x] = 'E'
    for (x, y) in ring1:
        if 0 <= y < len(rows) and 0 <= x < len(rows[0]) and rows[y][x] in 'KE':
            rows[y][x] = 'C'


def frame():
    S = Stone()
    plinth(S)
    throne(S)
    robe(S)
    chasuble(S)
    head(S)
    hL = arms(S)
    cc, foot, top = crozier(S, hL)
    # weathering: lichen on the shoulders and the hem, cracks lit from inside
    streaks(S)
    lichen(S, -16, -40, 3, 2, 1, 'cope')
    lichen(S, -4, -64, 2, 1, 6, 'mitre')
    lichen(S, -9, -27, 2, 1, 8, 'knee')
    lichen(S, 18, -10, 2, 2, 2, 'cope')
    lichen(S, -11, -4, 3, 1, 4, 'robe')
    parts = [r[:] for r in S.cv.p]
    rows = [list(r) for r in S.cv.finish()]
    S.cv.c = rows
    S.cv.p = [[('fx' if ch in 'YVCE' else 'x') for ch in r] for r in rows]
    crack(S, [(-6, -44), (-4, -40), (-6, -36), (-3, -31)])
    crack(S, [(8, -40), (10, -36), (9, -33)])
    crack(S, [(-12, -16), (-10, -11), (-12, -6)])
    rows = S.cv.c
    glow(rows, parts, lambda x, y: math.hypot(x - CX - cc[0], y - TOP - cc[1]) < 9)
    rows = [''.join(r) for r in rows]
    return K.mirror(rows), (W - 1 - CX, FLOOR)
