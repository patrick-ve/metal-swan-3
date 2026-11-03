# THE IRON MAYOR (ams section d boss): a giant robot mayor, a fictional machine. A dark brown curly
# wig over a steel skull, a cream boucle jacket with a shawl collar, a crimson blouse, the chain of
# office with the big medallion, armoured navy legs, and the huge GESLOTEN rubber-stamp arm.
# One frame: the stamp slam wind-up (the stamp lifted high in front, the red eyes glaring, the
# medallion swung back on its chain). Drawn facing right on one big canvas in the boss's own local
# coordinates (src/game/content/bosses/ams/layout.ts: the anchor (0, 0) is the floor point between
# the feet), then cast.py mirrors it to face left as in the arena.
import math
import castkit as K

INFO = dict(
    name='THE IRON MAYOR', mission=['ams'], role='boss', kind='MACHINE', face=-1,
    pose='stamp slam wind-up: the GESLOTEN stamp lifted high, the face glaring, the medallion swung back',
    note='Keeps the layout of the current boss (long wavy wig with a side part, boucle jacket, crimson blouse, '
         'silver chain, medallion, stamp arm, navy legs); the face is now a steel robot mask with glowing eyes, '
         'the jacket is tailored, the feet are heavy robot boots.',
    old='boss/ams-mayor/body-0',
    air=0,
)

OX, OY = 54, 174            # canvas position of the local anchor (0, 0)
CW, CH = 150, 178

PAL = {
    # steel (skull, neck, joints, forearm, fists) + a white specular
    '1': '#e6ecf3', '2': '#a8b2c2', '3': '#6a7488', '4': '#383f51', '0': '#ffffff',
    # dark chocolate wig
    '5': '#a8693c', '6': '#6c3e22', '7': '#452616', '8': '#22130d',
    # cream boucle jacket
    'A': '#fdf8ec', 'B': '#e6dcc6', 'C': '#c3b398', 'E': '#877866',
    # crimson blouse (also the rubber, the medallion field, the label text)
    'R': '#e2424c', 'r': '#a91d31', 'Z': '#5e0f20',
    # navy trousers
    'N': '#5b6ba2', 'n': '#36427c', 'O': '#212852', 'o': '#121630',
    # shoes
    'X': '#4e3a38', 'x': '#271b1b',
    # gold chain and medallion rim
    'G': '#fff0a2', 'g': '#e2aa3c', 'Y': '#93591a',
    # wood of the stamp
    'H': '#cf905a', 'h': '#985e33', 'j': '#5c3518',
    # enamel shields
    'l': '#3f86d8', 'k': '#3aa45a',
    # glowing eyes
    '9': '#fff4c8', 'a': '#ff5a2a',
}
DARK = {c: d for grp, d in [('12340', '4'), ('5678', '8'), ('ABCE', 'E'), ('RrZ', 'Z'), ('NnOo', 'o'),
                            ('Xx', 'x'), ('GgY', 'Y'), ('Hhj', 'j'), ('lk', 'Y')] for c in grp}

STEEL = ['1', '2', '3', '4']
WIG = ['5', '6', '7', '8']
JACK = ['A', 'B', 'C', 'E']
BLOUSE = ['R', 'r', 'Z', 'Z']
NAVY = ['N', 'n', 'O', 'o']
NAVYF = ['n', 'O', 'o', 'o']
GOLD = ['G', 'g', 'Y', 'Y']
WOOD = ['H', 'h', 'j', 'j']

LX, LY, LZ = 0.42, -0.55, 0.72       # light: upper front (right), toward the viewer
_n = math.sqrt(LX * LX + LY * LY + LZ * LZ)
LX, LY, LZ = LX / _n, LY / _n, LZ / _n


# ---------- primitives (local coordinates) ----------
def put(cv, x, y, ch, z, part):
    cv.px(x + OX, y + OY, ch, z, part)


def inpoly(pts, x, y):
    c = False
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            c = not c
    return c


def polymask(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    m = set()
    for y in range(int(min(ys)) - 1, int(max(ys)) + 2):
        for x in range(int(min(xs)) - 1, int(max(xs)) + 2):
            if inpoly(pts, x + 0.5, y + 0.5):
                m.add((x, y))
    return m


def ellmask(cx, cy, rx, ry):
    m = set()
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1:
                m.add((x, y))
    return m


def tone(l, cut):
    return 0 if l > cut[0] else 1 if l > cut[1] else 2 if l > cut[2] else 3


def sphere_l(x, y, cx, cy, rx, ry):
    ux, uy = (x + 0.5 - cx) / (rx + 0.3), (y + 0.5 - cy) / (ry + 0.3)
    uz = math.sqrt(max(0.0, 1 - ux * ux - uy * uy))
    return ux * LX + uy * LY + uz * LZ


def tube(cv, a, b, ra, rb, ramp, z, part, cut=(0.80, 0.48, 0.12)):
    cv.tube((a[0] + OX, a[1] + OY), (b[0] + OX, b[1] + OY), ra, rb, ramp, z, part, cut=cut)


# ---------- the body ----------
def legs(cv):
    # wind-up stance: knees bent a little, the near foot forward, the far foot back
    far = [(-10, -41), (-15, -24), (-17, -13)]
    near = [(8, -41), (15, -25), (14, -13)]
    for (hip, knee, ank), ramp, z, part in ((far, NAVYF, 2.0, 'legF'), (near, NAVY, 3.0, 'legN')):
        tube(cv, hip, knee, 7.5, 6.5, ramp, z, part, cut=(0.74, 0.42, 0.10))
        tube(cv, knee, ank, 6.5, 5.5, ramp, z + 0.1, part, cut=(0.74, 0.42, 0.10))
        # robot knee joint: a steel disc on the side of the knee
        kx, ky = knee
        for (x, y) in ellmask(kx + 0.5, ky + 0.5, 3.2, 3.2):
            l = sphere_l(x, y, kx + 0.5, ky + 0.5, 3.2, 3.2)
            k = tone(l, (0.85, 0.55, 0.2))
            if z < 2.5:
                k = min(3, k + 1)
            put(cv, x, y, STEEL[k], z + 0.3, part + 'K')
    # heavy robot boots: a dark shaft, a steel cuff, a steel toe cap, a thick sole (toe to the right)
    for ax, z, part, dk in ((-17, 2.4, 'bootF', 1), (14, 3.4, 'bootN', 0)):
        pts = [(ax - 7, -18), (ax + 6, -18), (ax + 7, -11), (ax + 13, -9), (ax + 17, -6), (ax + 18, -3),
               (ax + 18, 0), (ax - 8, 0), (ax - 8, -6), (ax - 7, -11)]
        m = polymask(pts)
        tc = (ax + 12.5, -5.0)
        for (x, y) in m:
            if y >= 0:
                continue
            if y >= -2:
                ch = '3' if y == -2 else '4'                     # the sole plate
                if dk:
                    ch = '4'
            elif y <= -16:
                ch = ('2' if x > ax else '3') if not dk else ('3' if x > ax else '4')   # cuff ring
            elif x > ax + 6 and ((x + 0.5 - tc[0]) / 7.0) ** 2 + ((y + 0.5 - tc[1]) / 5.0) ** 2 <= 1:
                k = tone(sphere_l(x, y, tc[0], tc[1], 7.0, 5.0), (0.80, 0.50, 0.15))
                ch = STEEL[min(3, k + dk)]                        # the toe cap
            else:
                ch = 'X' if (x >= ax + 1 and not dk) else 'x'
            put(cv, x, y, ch, z, part)
        # a lit seam across the instep
        if not dk:
            for x in range(ax + 7, ax + 11):
                put(cv, x, -10 + (x - ax - 7) // 2, '2', z + 0.01, part)


def far_arm(cv):
    # thrown back for balance: the boucle sleeve to the elbow, a steel ball joint, a steel forearm, a fist
    sh, el, hd = (-24, -96), (-40, -83), (-45, -66)
    tube(cv, sh, el, 6.0, 5.0, ['B', 'C', 'C', 'E'], 1.0, 'armF', cut=(0.70, 0.36, 0.06))
    tube(cv, el, hd, 3.4, 3.0, ['2', '3', '3', '4'], 1.1, 'armF2', cut=(0.62, 0.32, 0.06))
    ex, ey = el[0] + 0.5, el[1] + 0.5
    for (x, y) in ellmask(ex, ey, 3.6, 3.6):
        put(cv, x, y, ['2', '2', '3', '4'][tone(sphere_l(x, y, ex, ey, 3.6, 3.6), (0.8, 0.5, 0.2))], 1.2, 'armF3')
    fist = K.grid('''
        .2221.
        222332
        233333
        233334
        .3434.
    ''')
    cv.grid(hd[0] + OX - 3, hd[1] + OY - 1, fist, 1.3, 'armF4')


# tailored: square shoulders, a nipped waist, a hem that flares and curves, a cutaway at the front
JACKET = [(-11, -108), (13, -108), (27, -101), (29, -93), (27, -83), (24, -72), (25, -63), (28, -55),
          (31, -49), (30, -46), (22, -44), (12, -44), (6, -46), (4, -50), (2, -50), (0, -46), (-6, -44),
          (-18, -44), (-28, -45), (-32, -48), (-29, -55), (-25, -63), (-24, -72), (-27, -82), (-30, -91),
          (-29, -100)]
LAPEL_N = [(-21, -109), (-8, -107), (-5, -96), (-2, -78), (0, -64), (-6, -66), (-14, -73), (-21, -85), (-24, -98)]
LAPEL_F = [(21, -109), (12, -107), (9, -96), (6, -78), (5, -64), (9, -67), (15, -75), (20, -87), (23, -99)]


def boucle(x, y, k):
    """Sparse boucle knots: short 2 px ticks one tone darker on the lit and mid areas."""
    if k in (0, 1):
        q = (x + 3 * (y // 3)) % 7
        if y % 3 == 0 and q in (0, 1) and ((x // 7) + (y // 3)) % 2 == 0:
            return k + 1
    return k


def torso(cv):
    m = polymask(JACKET)
    for (x, y) in m:
        nx = (x + 0.5 - 1) / 29.0
        l = 0.55 * nx + 0.25 - 0.004 * (y + 108)
        k = 0 if l > 0.62 else 1 if l > 0.12 else 2 if l > -0.32 else 3
        # the waist: the cloth turns away under the chest and over the hip on the lit side
        if -80 < y < -62 and x > 20:
            k = max(k, 1)
        if (x, y + 2) not in m:
            k = min(3, k + 1)      # the hem turns under
        k = boucle(x, y, k)
        put(cv, x, y, JACK[k], 5.0, 'jacket')
    # princess seams: they follow the waist in and flare out to the hem
    for y in range(-92, -47):
        t = (y + 92) / 44.0
        w = math.sin(min(1.0, t * 1.3) * math.pi) * 2.5
        for x, ch in ((round(19 - w + max(0, t - 0.6) * 8), 'C'), (round(-17 + w - max(0, t - 0.6) * 8), 'E')):
            if (x, y) in m and (x, y + 1) in m:
                put(cv, x, y, ch, 5.05, 'jacket')
    # the front opening below the medallion, curving out to the cutaway
    for y in range(-64, -49):
        put(cv, 2, y, 'C', 5.05, 'jacket')
        put(cv, 3, y, 'E', 5.05, 'jacket')
    # blouse V between the lapels
    bl = polymask([(-9, -108), (12, -108), (8, -90), (3, -64), (-2, -80), (-6, -96)])
    for (x, y) in bl:
        k = 0 if x > 4 and y < -92 else 1
        if x < -3:
            k = 2
        put(cv, x, y, BLOUSE[k], 5.5, 'blouse')
    # a soft fold of the blouse
    for y in range(-100, -84):
        put(cv, 1 + (y + 100) // 6, y, 'r', 5.5, 'blouse')
    # flap pockets: a seam, the lit flap, the shadow under its edge
    for (x0, x1, y0, near) in ((-25, -12, -63, True), (10, 22, -64, False)):
        for x in range(x0, x1 + 1):
            put(cv, x, y0, 'C', 5.1, 'jacket')
            put(cv, x, y0 + 3, 'E' if near else 'C', 5.1, 'jacket')
        for y in (y0 + 1, y0 + 2):
            put(cv, x0, y, 'C', 5.1, 'jacket')
            put(cv, x1, y, 'E' if near else 'C', 5.1, 'jacket')
    # lapels: a rolled shawl collar; the roll's crest is lit along the inner edge, the outer edge folds
    # over the body with a dark line under it (selout), the far lapel turns a step darker
    for pts, near in ((LAPEL_N, True), (LAPEL_F, False)):
        lm = polymask(pts)
        for (x, y) in lm:
            if near:
                e_in = 0 if (x + 1, y) not in lm else 1 if (x + 2, y) not in lm else 2 if (x + 3, y) not in lm else 9
                e_out = (x - 1, y) not in lm
                k = 1
                if e_in <= 1:
                    k = 0
                elif e_in == 2:
                    k = 0 if y < -80 else 1
                if e_out:
                    k = 2
            else:
                e_in = (x - 1, y) not in lm
                e_out = (x + 1, y) not in lm
                k = 0 if e_in else 1
                if e_out:
                    k = 2
            put(cv, x, y, JACK[k], 6.0, 'lapel')


def neck_head(cv):
    # steel neck (a ribbed column)
    for y in range(-114, -104):
        for x in range(-5, 10):
            k = 1 if x > 4 else 2 if x > -1 else 3
            if y % 3 == 0:
                k = min(3, k + 1)
            put(cv, x, y, STEEL[k], 4.5, 'neck')
    # face plate: the layout's face outline (3/4 view facing right)
    face = [(-8, -151), (4, -155), (15, -154), (20, -150), (22, -143), (23, -136), (23, -130), (22, -124),
            (21, -119), (19, -113), (16, -108), (13, -105), (8, -105), (3, -108), (-3, -111), (-7, -112),
            (-9, -116), (-9, -126), (-9, -138), (-9, -146)]
    fm = polymask(face)
    cx, cy, rx, ry = 5.0, -132.0, 19.0, 27.0
    for (x, y) in fm:
        l = sphere_l(x, y, cx, cy, rx, ry)
        k = tone(l, (0.84, 0.56, 0.22))
        put(cv, x, y, STEEL[k], 7.0, 'face')
    # specular streak on the brow and the cheekbone
    for (x, y) in [(14, -148), (15, -148), (16, -147), (17, -147), (18, -146)]:
        put(cv, x, y, '0', 7.05, 'face')
    # cheek plate seam: from under the near eye down to the jaw hinge, a dark line with a lit lip
    for y in range(-128, -112):
        x = -3 + (y + 128) // 5
        put(cv, x, y, '4', 7.1, 'face')
        put(cv, x + 1, y, '2', 7.1, 'face')
    # jaw hinge bolt (a gold disc where the ear would be)
    for (x, y) in ellmask(-4.5, -120.5, 2.6, 2.6):
        put(cv, x, y, 'g' if x + y > -124 - 1 and (x, y) != (-4, -121) else 'Y', 7.2, 'bolt')
    put(cv, -5, -122, 'G', 7.2, 'bolt')
    # brows: two heavy steel plates angled down to the nose (the glare)
    for x in range(-2, 10):
        y = -145 + (x + 2) * 6 // 11
        for d in (0, 1, 2):
            put(cv, x, y + d, '1' if d == 0 else '4', 7.3, 'brow')
    for x in range(13, 22):
        y = -140 - (x - 13) * 3 // 8
        for d in (0, 1, 2):
            put(cv, x, y + d, '2' if d == 0 else '4', 7.3, 'brow')
    # eye slots: dark sockets with a hot red glow, the near eye bigger
    for (x0, x1, y0) in ((0, 9, -139), (14, 20, -137)):
        for x in range(x0, x1):
            put(cv, x, y0, '4', 7.25, 'eye')
            put(cv, x, y0 + 1, 'a', 7.25, 'eye')
            put(cv, x, y0 + 2, '4' if x in (x0, x1 - 1) else 'a', 7.25, 'eye')
            put(cv, x, y0 + 3, '4', 7.25, 'eye')
        # the pupil: a white-hot core toward the front
        put(cv, x1 - 3, y0 + 1, '9', 7.26, 'eye')
        put(cv, x1 - 2, y0 + 1, '9', 7.26, 'eye')
        put(cv, x1 - 3, y0 + 2, '9', 7.26, 'eye')
    # nose: a steel ridge between the eyes (lit front edge, shadow behind)
    for y in range(-135, -125):
        put(cv, 12, y, '3', 7.3, 'nose')
        put(cv, 13, y, '1', 7.3, 'nose')
    put(cv, 12, -125, '4', 7.3, 'nose')
    put(cv, 13, -125, '4', 7.3, 'nose')
    put(cv, 14, -125, '3', 7.3, 'nose')
    # mouth: a scowling speaker grille with crimson slats
    mouth = [(3, -119), (4, -120), (19, -119), (19, -115), (17, -114), (6, -114), (3, -115)]
    for (x, y) in polymask(mouth):
        ch = 'Z' if (x % 2 == 0 or y in (-119, -115)) else 'r'
        if y <= -119 or x in (3, 4):
            ch = '4'
        put(cv, x, y, ch, 7.3, 'mouth')
    # down-turned corners of the scowl
    put(cv, 2, -114, '4', 7.3, 'mouth')
    put(cv, 20, -114, '4', 7.3, 'mouth')
    # chin plate lip
    for x in range(6, 16):
        put(cv, x, -111, '3', 7.3, 'chin')
    for x in range(8, 15):
        put(cv, x, -110, '1', 7.3, 'chin')


# The wig: a few long heavy wave locks from a side part on top. The back locks fall behind the near
# shoulder, the front lock sweeps over the forehead and falls behind the far cheek and shoulder. Each
# lock is a thick S-shaped stroke shaded as a cylinder (the crest lit where the wave turns to the
# light, a dark under-edge on the other side); a lock that lies over another gets a dark edge on the
# one under it, so the locks separate without any bubble texture.
LOCKS = [
    # (centre line control points, radius at the root, radius at the tip, far side)
    ([(10, -160), (24, -156), (33, -144), (35, -131), (31, -120), (33, -112)], 7.0, 4.5, True),
    ([(-6, -161), (-22, -160), (-36, -150), (-42, -136), (-38, -122), (-44, -108), (-50, -97), (-48, -89)], 9.5, 2.5, False),
    ([(-5, -158), (-18, -154), (-28, -143), (-30, -129), (-25, -116), (-31, -104), (-38, -95), (-37, -87)], 8.5, 2.5, False),
    ([(-7, -153), (-14, -146), (-18, -134), (-14, -122), (-19, -110), (-25, -99), (-23, -90)], 7.0, 2.5, False),
    # the front sweep from the part over the forehead, down behind the far cheek
    ([(-2, -161), (8, -161), (18, -159), (25, -152), (28, -141), (26, -129), (30, -117), (33, -108), (34, -102)], 7.5, 3.5, False),
]


def catmull(pts, step=0.25):
    """A smooth centre line through the control points (Catmull-Rom), sampled about every 'step' px."""
    P = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        n = max(2, int(math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step))
        for j in range(n):
            t = j / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2
                                    + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3) for c in (0, 1)))
    out.append(pts[-1])
    return out


def lock_pixels(ctrl, r0, r1, far):
    """{(x, y): tone} of one wave lock."""
    line = catmull(ctrl)
    acc = [0.0]
    for i in range(1, len(line)):
        acc.append(acc[-1] + math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]))
    L = acc[-1]
    xs = [p[0] for p in line]
    ys = [p[1] for p in line]
    R = max(r0, r1) + 1
    out = {}
    for y in range(int(min(ys) - R), int(max(ys) + R) + 1):
        for x in range(int(min(xs) - R), int(max(xs) + R) + 1):
            px_, py_ = x + 0.5, y + 0.5
            best, bi = 1e9, 0
            for i, (lx, ly) in enumerate(line):
                d = (px_ - lx) ** 2 + (py_ - ly) ** 2
                if d < best:
                    best, bi = d, i
            t = acc[bi] / L
            r = r0 + (r1 - r0) * (t ** 1.6)
            d = math.sqrt(best)
            if d > r:
                continue
            i0, i1 = max(0, bi - 2), min(len(line) - 1, bi + 2)
            tx, ty = line[i1][0] - line[i0][0], line[i1][1] - line[i0][1]
            tl = math.hypot(tx, ty) or 1.0
            nx, ny = -ty / tl, tx / tl
            v = (px_ - line[bi][0]) * nx + (py_ - line[bi][1]) * ny
            u = max(-1.0, min(1.0, v / (r + 0.3)))
            if bi in (0, len(line) - 1):
                u = max(-1.0, min(1.0, d / (r + 0.3))) * (1 if v >= 0 else -1)
            uz = math.sqrt(max(0.0, 1 - u * u))
            l = (nx * u) * LX + (ny * u) * LY + uz * LZ
            k = 0 if l > 0.80 else 1 if l > 0.56 else 2 if l > 0.06 else 3
            if abs(u) > 0.72 and (nx * u * LX + ny * u * LY) < 0:
                k = 3                                   # the under-edge
            if far:
                k = min(3, k + 1)
            out[(x, y)] = k
    return out


def wig_back(cv):
    tones, owner = {}, {}
    for i, (ctrl, r0, r1, far) in enumerate(LOCKS):
        for q, k in lock_pixels(ctrl, r0, r1, far).items():
            tones[q] = k
            owner[q] = i
    # a lock over another: the edge of the one underneath takes the darkest tone
    final = dict(tones)
    for (x, y), i in owner.items():
        for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if owner.get(q, -1) > i:
                final[(x, y)] = 3
                break
    front = len(LOCKS) - 1
    for (x, y), k in final.items():
        z = 6.5
        if owner[(x, y)] == front:
            z = 7.6 if y < -149 else 6.6        # the sweep lies over the steel brow
        if y > -105:
            z = 4.9                             # behind the shoulders
        put(cv, x, y, WIG[k], z, 'wig')


def wig_front(cv):
    # the side part: a short dark parting where the back locks and the sweep leave the crown
    for (x, y) in ((-3, -167), (-3, -166), (-2, -165), (-2, -164), (-2, -163)):
        if cv.c[y + OY][x + OX] != '.':
            put(cv, x, y, '8', 7.7, 'wig')


# ---------- the chain of office and the medallion ----------
MED = (-8, -77)      # swung 6 px back from the rest point (-2, -76) by the wind-up
MR = 14


def chain(cv):
    mx, my = MED
    runs = [((-18, -107), (mx - 9, my - 10), -3.0), ((19, -105), (mx + 9, my - 11), 2.5)]
    for ri, (a, b, bow) in enumerate(runs):
        n = int(math.hypot(b[0] - a[0], b[1] - a[1]) * 1.4)
        pts = []
        for i in range(n + 1):
            t = i / n
            x = a[0] + (b[0] - a[0]) * t + bow * math.sin(math.pi * t)
            y = a[1] + (b[1] - a[1]) * t
            pts.append((round(x), round(y)))
        seen = []
        for p in pts:
            if p not in seen:
                seen.append(p)
        for i, (x, y) in enumerate(seen):
            # silver links: a lit link face, a shaded side, a dark gap between the links
            ph = i % 4
            ch = '1' if ph == 0 else '2' if ph == 1 else '3' if ph == 2 else '4'
            put(cv, x, y, ch, 9.0, 'chain')
            put(cv, x + (1 if ri == 0 else -1), y, '2' if ph == 0 else '3' if ph in (1, 2) else '4', 9.0, 'chain')
        # two enamel shields on each run
        for t, col in ((0.38, 'l' if ri == 0 else 'k'), (0.74, 'R' if ri == 0 else 'l')):
            p = seen[int(t * (len(seen) - 1))]
            shield(cv, p[0] + (0 if ri == 0 else 0), p[1], col)


def shield(cv, x0, y0, col):
    g = K.grid('''
        11111
        1###2
        1###3
        2###3
        .3#3.
        ..3..
    ''')
    for j, r in enumerate(g):
        for i, ch in enumerate(r):
            if ch == '.':
                continue
            c = col if ch == '#' else ch
            if ch == '#' and i == 3 and j >= 2:
                c = {'l': '4', 'k': '4', 'R': 'r'}[col] if col != 'R' else 'r'
                c = 'r' if col == 'R' else 'n' if col == 'l' else '3'
            put(cv, x0 - 2 + i, y0 - 2 + j, c, 9.2, 'shield')


def medallion(cv):
    mx, my = MED
    cx, cy = mx + 0.5, my + 0.5
    m = ellmask(cx, cy, MR, MR)
    inner = ellmask(cx, cy, MR - 3.2, MR - 3.2)
    for (x, y) in m:
        if (x, y) in inner:
            continue
        # silver rim: a raised ring lit from the upper front
        ang = math.atan2(y + 0.5 - cy, x + 0.5 - cx)
        rr = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
        lit = math.cos(ang - math.atan2(LY, LX))
        outer_edge = rr > MR - 1.2
        if outer_edge:
            k = 0 if lit > 0.55 else 1 if lit > -0.35 else 2
        else:
            k = 2 if lit > 0.4 else 1 if lit > -0.5 else 0
            if rr < MR - 2.4:
                k = 3
            k = min(3, k + 1)
        put(cv, x, y, STEEL[k], 10.0, 'medal')
    # the field: crimson, a black pale with three white saltires
    for (x, y) in inner:
        l = sphere_l(x, y, cx, cy, MR - 3, MR - 3)
        ch = 'R' if l > 0.75 else 'r'
        if mx - 2 <= x <= mx + 2:
            ch = 'K'
        put(cv, x, y, ch, 10.0, 'medal')
    for dy in (-6, 0, 6):
        for (i, j) in ((-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)):
            put(cv, mx + i, my + dy + j, 'A', 10.1, 'medal')
    # glint on the rim
    put(cv, mx + 7, my - 11, '0', 10.2, 'medal')
    # a small gold crown on the rim where the chain runs end (as in the game)
    for x in range(mx - 4, mx + 5):
        put(cv, x, my - 14, 'g', 10.3, 'crown')
        put(cv, x, my - 13, 'Y' if x < mx - 1 else 'g', 10.3, 'crown')
    put(cv, mx - 3, my - 14, 'G', 10.3, 'crown')
    for dx in (-4, 0, 4):
        put(cv, mx + dx, my - 15, 'G' if dx >= 0 else 'g', 10.3, 'crown')


# ---------- the stamp arm ----------
SH = (24, -97)
EL = (50, -113)
KNOB = (55, -160)
BLOCK = (33, -152, 44, 19)       # x, y, w, h of the wooden block (rubber below it)

FONT = {
    'G': ['.##', '#..', '#.#', '#.#', '.##'],
    'E': ['###', '#..', '##.', '#..', '###'],
    'S': ['.##', '#..', '.#.', '..#', '##.'],
    'L': ['#..', '#..', '#..', '#..', '###'],
    'O': ['.#.', '#.#', '#.#', '#.#', '.#.'],
    'T': ['###', '.#.', '.#.', '.#.', '.#.'],
    'N': ['#..#', '##.#', '#.##', '#..#', '#..#'],
}


def stamp_arm(cv):
    # upper arm: the boucle sleeve, raised forward
    tube(cv, SH, EL, 6.8, 5.6, JACK, 11.0, 'sleeve', cut=(0.70, 0.40, 0.08))
    # crease on the inside of the bent elbow
    for (x, y) in ((44, -114), (45, -115), (46, -115)):
        put(cv, x, y, 'C', 11.05, 'sleeve')
    # steel cuff at the sleeve end and the elbow ball joint
    ex, ey = EL
    for (x, y) in ellmask(ex + 0.5, ey + 0.5, 5.2, 5.2):
        put(cv, x, y, STEEL[tone(sphere_l(x, y, ex + .5, ey + .5, 5.2, 5.2), (0.82, 0.55, 0.2))], 11.5, 'elbow')
    put(cv, ex + 2, ey - 3, '0', 11.6, 'elbow')
    # forearm: a steel piston straight up into the stamp's knob (behind the block)
    tube(cv, EL, KNOB, 4.2, 3.6, STEEL, 11.2, 'fore', cut=(0.70, 0.40, 0.08))
    # piston rings
    for y in (-122, -126):
        for x in range(48, 57):
            if cv.p[y + OY][x + OX] == 'fore':
                put(cv, x, y, '4', 11.25, 'fore')
    bx, by, bw, bh = BLOCK
    # the knob: a wooden ball gripped by a steel collar
    kx, ky = KNOB
    for (x, y) in ellmask(kx + 0.5, ky + 0.5, 5.5, 4.5):
        put(cv, x, y, WOOD[tone(sphere_l(x, y, kx + .5, ky + .5, 5.5, 4.5), (0.78, 0.45, 0.1))], 11.6, 'knob')
    for y in range(ky + 3, by):
        for x in range(kx - 2, kx + 4):
            k = 0 if x == kx + 1 else 1 if x > kx - 1 else 2
            put(cv, x, y, WOOD[k], 11.6, 'knob')
    for x in range(kx - 4, kx + 6):
        put(cv, x, ky + 1, STEEL[1 if x > kx else 2 if x > kx - 3 else 3], 11.7, 'collar')
        put(cv, x, ky + 2, STEEL[2 if x > kx else 3], 11.7, 'collar')
    # the block: a bevelled wooden body, the top face catching the light
    for y in range(by, by + bh):
        for x in range(bx, bx + bw):
            if y == by:
                ch = 'H'
            elif y == by + 1:
                ch = 'H' if x > bx + 2 else 'h'
            elif x == bx + bw - 1 or x == bx + bw - 2:
                ch = 'h'
            elif x == bx:
                ch = 'j'
            elif y >= by + bh - 2:
                ch = 'j'
            else:
                ch = 'h'
            put(cv, x, y, ch, 13.0, 'block')
    # corner chamfers
    for (x, y) in ((bx, by), (bx + bw - 1, by)):
        cv.c[y + OY][x + OX] = '.'
    # label: white paper with GESLOTEN in crimson
    lx0, ly0, lw, lh = bx + 3, by + 5, bw - 6, 10
    for y in range(ly0, ly0 + lh):
        for x in range(lx0, lx0 + lw):
            ch = 'A' if y < ly0 + lh - 1 else 'B'
            if x == lx0 + lw - 1:
                ch = 'B'
            put(cv, x, y, ch, 13.1, 'label')
    text = 'GESLOTEN'
    tw = sum(len(FONT[c][0]) for c in text) + len(text) - 1
    # drawn mirrored: cast.py (and the game, facing left) flips the frame, so the label reads
    x = lx0 + (lw - tw) // 2 + tw - 1
    for c in text:
        g = FONT[c]
        for j, r in enumerate(g):
            for i, ch in enumerate(r):
                if ch == '#':
                    put(cv, x - i, ly0 + 2 + j, 'r', 13.2, 'label')
        x -= len(g[0]) + 1
    # rubber pad under the block (the face that slams)
    for y in (by + bh, by + bh + 1, by + bh + 2):
        for x in range(bx + 1, bx + bw - 1):
            ch = 'R' if y == by + bh else 'r' if y == by + bh + 1 else 'Z'
            put(cv, x, y, ch, 12.9, 'rubber')


def fill_holes(cv):
    """Close see-through gaps inside the figure (a background pixel the outside cannot reach): they
    take the dark tone of a neighbour, so no lone outline pixel sits inside a shape."""
    W_, H_ = cv.W, cv.H
    seen = [[False] * W_ for _ in range(H_)]
    st = [(x, y) for x in range(W_) for y in (0, H_ - 1)] + [(x, y) for y in range(H_) for x in (0, W_ - 1)]
    while st:
        x, y = st.pop()
        if 0 <= x < W_ and 0 <= y < H_ and not seen[y][x] and cv.c[y][x] == '.':
            seen[y][x] = True
            st += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    for y in range(H_):
        for x in range(W_):
            if cv.c[y][x] == '.' and not seen[y][x]:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ch = cv.c[y + dy][x + dx]
                    if ch != '.':
                        cv.c[y][x] = DARK.get(ch, ch)
                        cv.z[y][x] = cv.z[y + dy][x + dx] - 0.01
                        cv.p[y][x] = cv.p[y + dy][x + dx]
                        break


def frame():
    K.palette(PAL, dark=DARK)
    cv = K.Canvas(CW, CH)
    far_arm(cv)
    legs(cv)
    torso(cv)
    wig_back(cv)
    neck_head(cv)
    wig_front(cv)
    chain(cv)
    medallion(cv)
    stamp_arm(cv)
    fill_holes(cv)
    return K.finish(cv, (OX, OY))
