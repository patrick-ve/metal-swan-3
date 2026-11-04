# SCANAUTO: the game's look numbers (src/game/content/bosses/ams-scan/geometry.ts SCAN.*) and the
# raster helpers of the set.
#
# Scale: the cast sample drew the car at S = 1.07 (90 px). The game keeps S = 1 (84 px): every
# number the game reads is laid out at S = 1 (the hurtboxes of D7, the wheel, lamp, lettering,
# printer and speech points, the perspective-floor faces of section c in
# missions/ams/floor/entities.ts `scanCarFaces`, the scanner hurtbox test). A 90 px body would stick
# out of the 88 px hurtbox and off the floor faces; the look (paint ramps, livery, glass, the officer,
# the alloys, the box on its rack) is the cast sample's, sampled at S = 1.
#
# Local coordinates: facing right (front at +x), the anchor (0, 0) is the floor point under the
# car's middle, y grows down. Shapes are continuous: pixel (X, Y) covers [X, X+1) x [Y, Y+1) and is
# inside a shape when its centre is. A raster is a dict {(X, Y): (letter, z, part)} in local pixels.
import math

import art40 as X
import castkit as K

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
WHEEL_PX = [-27, 26]          # the wheel strip's centre px (geometry.ts SCAN.wheelX, wheelY)
WHEEL_PY = -7
ARCH, TRIM = 7.4, 8.6
SEAMS = [-25.6, -5.5, 17.6]
BARS = dict(x=[-4.0, 2.9, 9.8, 18.4], w=3.7, top=-12.9, bottom=-5.2, lean=0.8)
STRIPES = dict(x=[24.0, 28.4, 32.8], w=2.6, lean=1.4)
CROSS = dict(x=-9.5, y=[-16.5, -12.5, -8.5], r=1.2)
HEADLIGHT = [(34.4, -13.7), (38.4, -13.85), (40.5, -13.4), (41.4, -12.4), (40.4, -12.0), (36.4, -12.75)]
SHELL = [(-21.6, -39.4), (4.2, -39.4), (5.6, -39.0), (6.4, -38.0), (6.5, -37.1), (5.3, -34.4), (4.1, -33.6),
         (-20.2, -33.6), (-21.5, -34.4), (-23.0, -37.1), (-22.9, -38.0), (-22.3, -39.0)]
FRONT_WIN = [(5.5, -36.8), (6.4, -36.8), (5.4, -34.3), (4.4, -34.3)]
REAR_WIN = [(-22.2, -36.8), (-21.5, -36.8), (-20.5, -34.3), (-21.2, -34.3)]
SIDE_WIN = [(-20.6, -12.8), (-11.6, -4.6)]
LENS = (-8.9, -35.5)
PIVOT = (0.2, -33.6)          # the askew box turns about its front foot (state 2)
ASKEW = -0.075
TEXT = [(6, -15), (-21, -17), (-1, -36)]   # the lettering blocks' centre px (geometry.ts SCAN.text)
LAMPS = [(40, -13), (-42, -19)]
PRINTER = (7, -36)
DRIVER = (-3, -28)            # the officer's grid: top-left px (cap top under the roof)


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


def pix(x, y):
    return int(math.floor(x)), int(math.floor(y))


# ------------------------------------------------------------------------------------- rasters
class Raster(dict):
    """{(X, Y): (letter, z, part)} in local pixels; put() keeps the nearer pixel."""

    def put(self, X, Y, ch, z=0.0, part='body'):
        old = self.get((X, Y))
        if old is None or z >= old[1]:
            self[(X, Y)] = (ch, z, part)

    def ch(self, X, Y):
        v = self.get((X, Y))
        return v[0] if v else None

    def recolour(self, X, Y, ch):
        v = self.get((X, Y))
        if v:
            self[(X, Y)] = (ch, v[1], v[2])

    def moved(self, dx, dy):
        out = Raster()
        for (x, y), v in self.items():
            out[(x + dx, y + dy)] = v
        return out

    def merged(self, *others):
        out = Raster(self)
        for o in others:
            for (x, y), (ch, z, part) in o.items():
                out.put(x, y, ch, z, part)
        return out


def shear(r, s):
    """Column-wise vertical shift: column X moves by floor(-(X + 0.5) * s + 0.5) rows (s > 0: the
    front rises, the rear sinks). car.ts moves the overlays with the same rule (bodyShift)."""
    out = Raster()
    for (x, y), v in r.items():
        out[(x, y + col_shift(x, s))] = v
    return out


def col_shift(x, s):
    return int(math.floor(-(x + 0.5) * s + 0.5))


def finish_rows(r, outline=True, margin=2):
    """The raster on a canvas: selout between parts (rig DARK) and the one outline. Returns
    (rows, root, x0, y0): root = local (0, 0) in rows coordinates."""
    xs = [p[0] for p in r]
    ys = [p[1] for p in r]
    x0, y0 = min(xs) - margin, min(ys) - margin
    w, h = max(xs) - x0 + 1 + margin, max(ys) - y0 + 1 + margin
    cv = K.Canvas(w, h)
    for (x, y), (ch, z, part) in sorted(r.items()):
        cv.px(x - x0, y - y0, ch, z, part)
    rows, _ = K.finish(cv, (0, 0), outline=outline)
    return rows, (-x0, -y0), x0, y0


def overlay(rows, x0, y0, extra):
    """Paint {(X, Y): letter} (local px) over finished rows (glows, glare: no outline)."""
    g = [list(r) for r in rows]
    for (x, y), ch in extra.items():
        i, j = x - x0, y - y0
        if 0 <= j < len(g) and 0 <= i < len(g[j]):
            g[j][i] = ch
    return [''.join(r) for r in g]


def frame(r, outline=True, pts=None, extra=None, smear=False, joints=None):
    """A finished art40 Frame from a raster (anchor = local (0, 0)); pts / joints in local px."""
    rows, root, x0, y0 = finish_rows(r, outline, margin=8 if extra else 2)
    if extra:
        rows = overlay(rows, x0, y0, extra)
    conv = lambda d: {k: (v[0] - x0, v[1] - y0) for k, v in (d or {}).items()}
    return X.Frame(rows, root, pts=conv(pts), smear=smear, joints=conv(joints))
