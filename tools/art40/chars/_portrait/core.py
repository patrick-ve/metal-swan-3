# The portrait kit's core (docs/design/select40.md): a 64 x 120 canvas of (material, light value,
# group) per pixel, the palette of ramps (one letter per colour), the quantizer (hard bands with a
# narrow ordered-dither seam), the shading primitives (height-field domes, lit tubes, creases), the
# cast-shadow and outline passes and the luma the grey state reads (rig.Hero.grey). Pure Python, deterministic: no
# random, no time, no set iteration order (hash noise only).
import math

W, H = 64, 120

# ------------------------------------------------------------------------------------------ maths


def clamp(v, a=0.0, b=1.0):
    return a if v < a else b if v > b else v


def smooth(e0, e1, x):
    if e0 == e1:
        return 0.0 if x < e0 else 1.0
    t = clamp((x - e0) / (e1 - e0))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def hsh(x, y, seed=0):
    """Deterministic hash noise in [0, 1) of an integer pixel and a seed."""
    n = (int(x) * 374761393 + int(y) * 668265263 + int(seed) * 362437 + 0x9E3779B9) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    n = (n ^ (n >> 16)) & 0xFFFFFFFF
    return (n & 0xFFFF) / 65536.0


def gauss(x, y, cx, cy, sx, sy):
    dx, dy = (x - cx) / sx, (y - cy) / sy
    return math.exp(-0.5 * (dx * dx + dy * dy))


def norm3(x, y, z):
    l = math.sqrt(x * x + y * y + z * z) or 1.0
    return (x / l, y / l, z / l)


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def spline(pts):
    """A Catmull-Rom curve through [(t, v), ...] sorted by t (clamped at both ends): f(t) -> v."""
    pts = sorted(pts)
    ts = [p[0] for p in pts]
    vs = [p[1] for p in pts]
    n = len(pts)

    def f(t):
        if t <= ts[0]:
            return vs[0]
        if t >= ts[-1]:
            return vs[-1]
        i = 0
        while i < n - 2 and t > ts[i + 1]:
            i += 1
        t0, t1 = ts[i], ts[i + 1]
        u = (t - t0) / (t1 - t0)
        p0 = vs[i - 1] if i > 0 else vs[i]
        p1, p2 = vs[i], vs[i + 1]
        p3 = vs[i + 2] if i + 2 < n else vs[i + 1]
        u2, u3 = u * u, u * u * u
        return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3)
    return f


def bezier(p0, p1, p2, p3=None, n=24):
    """Points along a quadratic (3 points) or cubic (4 points) Bezier curve."""
    out = []
    for i in range(n + 1):
        t = i / n
        if p3 is None:
            a, b, c = (1 - t) ** 2, 2 * (1 - t) * t, t * t
            out.append((a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]))
        else:
            a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t ** 3
            out.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))
    return out


def seg_dist(px, py, ax, ay, bx, by):
    """Distance of a point to a segment and the segment parameter t of the nearest point."""
    vx, vy = bx - ax, by - ay
    l2 = vx * vx + vy * vy
    t = 0.0 if l2 == 0 else clamp(((px - ax) * vx + (py - ay) * vy) / l2)
    qx, qy = ax + t * vx, ay + t * vy
    return math.hypot(px - qx, py - qy), t, (qx, qy)


def poly_dist(px, py, pts):
    """Nearest distance to a polyline, its arc parameter (0..1) and the side (+1 left of travel)."""
    best = (1e9, 0.0, 1.0)
    total = sum(math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1)) or 1.0
    acc = 0.0
    for i in range(len(pts) - 1):
        (ax, ay), (bx, by) = pts[i], pts[i + 1]
        seg = math.hypot(bx - ax, by - ay)
        d, t, _ = seg_dist(px, py, ax, ay, bx, by)
        if d < best[0]:
            side = 1.0 if (bx - ax) * (py - ay) - (by - ay) * (px - ax) < 0 else -1.0
            best = (d, (acc + t * seg) / total, side)
        acc += seg
    return best


def in_poly(x, y, pts):
    c = False
    n = len(pts)
    j = n - 1
    for i in range(n):
        xi, yi = pts[i]
        xj, yj = pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi:
            c = not c
        j = i
    return c


# ------------------------------------------------------------------------------------------ light

# The key light: top-front, from the viewer's left. The rim light: from behind on the right.
KEY = norm3(-0.55, -0.6, 0.58)
RIM = norm3(0.92, -0.2, -0.32)
VIEW = (0.0, 0.0, 1.0)
HALF = norm3(KEY[0] + VIEW[0], KEY[1] + VIEW[1], KEY[2] + VIEW[2])


def lambert(n, amb=0.1, gain=0.95, power=1.0):
    d = max(0.0, dot(n, KEY))
    return amb + gain * (d ** power)


def rim(n):
    return max(0.0, dot(n, RIM))


def spec(n, k=28):
    return max(0.0, dot(n, HALF)) ** k


# ------------------------------------------------------------------------------------------ palette

# Letters for colours: '.' is transparent; K is the outline, W the glint white (hl).
POOL = 'ABCDEFGHIJLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz0123456789@$%&*+=?!<>^~:;'


class Pal:
    """The set's palette: named ramps (dark -> light) of '#rrggbb' colours, one letter per colour."""

    def __init__(self, outline='#1a0e10', glint='#ffffff'):
        self.hex = {'K': outline, 'W': glint}
        self.ramps = {}
        self._pool = [c for c in POOL]
        self._by_hex = {outline.lower(): 'K', glint.lower(): 'W'}

    def _letter(self, hx):
        hx = hx.lower()
        if hx in self._by_hex:
            return self._by_hex[hx]
        ch = self._pool.pop(0)
        self.hex[ch] = hx
        self._by_hex[hx] = ch
        return ch

    def fixed(self, ch, hx):
        """A colour under a fixed letter (taken out of the pool)."""
        self.hex[ch] = hx.lower()
        self._by_hex[hx.lower()] = ch
        if ch in self._pool:
            self._pool.remove(ch)
        return ch

    def ramp(self, name, hexes):
        self.ramps[name] = [self._letter(h) for h in hexes]
        return self.ramps[name]

    def alias(self, name, letters):
        """A ramp made of letters of other ramps (no new colour)."""
        self.ramps[name] = list(letters)
        return self.ramps[name]

    def __getitem__(self, name):
        return self.ramps[name]

    def colours(self):
        return dict(self.hex)

    def count(self):
        return len(set(self.hex.values()))


BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def quant(ramp, v, x, y, dith=0.35):
    """The ramp letter of a light value v (0..1): hard bands, an ordered-dither seam of width dith."""
    n = len(ramp)
    t = clamp(v) * (n - 1)
    i = int(t)
    f = t - i
    if i >= n - 1:
        return ramp[-1]
    th = 0.5 + (BAYER[y & 3][x & 3] - 7.5) / 16.0 * dith
    return ramp[i + 1] if f > th else ramp[i]


# ------------------------------------------------------------------------------------------ canvas


class Canvas:
    """Per pixel: material (a ramp name), light value, group (for outlines and cast shadows) and an
    optional fixed letter (hand-placed pixels: glints, pupils, lid lines)."""

    def __init__(self, w=W, h=H):
        self.w, self.h = w, h
        n = w * h
        self.m = [None] * n
        self.v = [0.0] * n
        self.g = ['bg'] * n
        self.fx = [None] * n
        self.r = [0.0] * n            # rim light per pixel (the grey state keeps it)

    def ok(self, x, y):
        return 0 <= x < self.w and 0 <= y < self.h

    def put(self, x, y, mat, v, g=None, r=0.0):
        if 0 <= x < self.w and 0 <= y < self.h:
            i = y * self.w + x
            self.m[i] = mat
            self.v[i] = v
            self.fx[i] = None
            self.r[i] = r
            if g is not None:
                self.g[i] = g

    def fix(self, x, y, ch, g=None):
        if 0 <= x < self.w and 0 <= y < self.h:
            i = y * self.w + x
            self.fx[i] = ch
            if g is not None:
                self.g[i] = g

    def unfix(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.fx[y * self.w + x] = None

    def grp(self, x, y):
        return self.g[y * self.w + x] if 0 <= x < self.w and 0 <= y < self.h else None

    def mat(self, x, y):
        return self.m[y * self.w + x] if 0 <= x < self.w and 0 <= y < self.h else None

    def val(self, x, y):
        return self.v[y * self.w + x] if 0 <= x < self.w and 0 <= y < self.h else 0.0

    def shift(self, x, y, dv, groups=None):
        """Add dv to the light value of a pixel (only of the given groups)."""
        if 0 <= x < self.w and 0 <= y < self.h:
            i = y * self.w + x
            if groups is None or self.g[i] in groups:
                self.v[i] = clamp(self.v[i] + dv)

    def paint(self, box, fn, g=None):
        """fn(x, y) -> None (skip) or (mat, v[, rim]). box = (x0, y0, x1, y1), inclusive-exclusive."""
        x0, y0, x1, y1 = box
        for y in range(max(0, int(math.floor(y0))), min(self.h, int(math.ceil(y1)))):
            for x in range(max(0, int(math.floor(x0))), min(self.w, int(math.ceil(x1)))):
                r = fn(x, y)
                if r is not None:
                    self.put(x, y, r[0], r[1], g, r[2] if len(r) > 2 else 0.0)

    def resolve(self, pal, dith=None):
        """Letter rows. dith: material -> dither width (default 0.35)."""
        dith = dith or {}
        rows = []
        for y in range(self.h):
            r = []
            for x in range(self.w):
                i = y * self.w + x
                if self.fx[i] is not None:
                    r.append(self.fx[i])
                elif self.m[i] is None:
                    r.append('.')
                else:
                    r.append(quant(pal[self.m[i]], self.v[i], x, y, dith.get(self.m[i], 0.35)))
            rows.append(''.join(r))
        return rows


# ------------------------------------------------------------------------------------------ passes


def cast(cv, casters, receivers, offs, dv):
    """Cast shadow: a receiver pixel darkens by dv when a caster pixel sits at any offset (toward the
    key light: up-left). Reads the groups before any change."""
    g = list(cv.g)
    w = cv.w
    for y in range(cv.h):
        for x in range(cv.w):
            if g[y * w + x] not in receivers:
                continue
            for ox, oy in offs:
                xx, yy = x + ox, y + oy
                if 0 <= xx < w and 0 <= yy < cv.h and g[yy * w + xx] in casters:
                    cv.shift(x, y, dv)
                    break


def outline(cv, figure, back=('bg',), ch='K'):
    """The one dark outline: every figure pixel with a 4-neighbour in a back group."""
    g = list(cv.g)
    w = cv.w
    hit = []
    for y in range(cv.h):
        for x in range(cv.w):
            if g[y * w + x] not in figure:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < cv.h and g[yy * w + xx] in back:
                    hit.append((x, y))
                    break
    for x, y in hit:
        cv.fix(x, y, ch)


def contour(cv, inner, outer, dv=-1.0, floor=0.0):
    """Selout: inner-group pixels touching an outer group darken (to the ramp's dark end)."""
    g = list(cv.g)
    w = cv.w
    hit = []
    for y in range(cv.h):
        for x in range(cv.w):
            if g[y * w + x] not in inner:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < cv.h and g[yy * w + xx] in outer:
                    hit.append((x, y))
                    break
    for x, y in hit:
        i = y * w + x
        cv.v[i] = max(floor, clamp(cv.v[i] + dv))


def frame_border(cv, ch='K'):
    """The 1 px print edge of the photo (the window's inner shadow line)."""
    for x in range(cv.w):
        cv.fix(x, 0, ch)
        cv.fix(x, cv.h - 1, ch)
    for y in range(cv.h):
        cv.fix(0, y, ch)
        cv.fix(cv.w - 1, y, ch)


# ------------------------------------------------------------------------------------------ strokes


def tube(cv, pts, w0, w1, mat, g, base=0.5, gain=0.5, amb=0.12, clip=None, tip=1.0, lift=0.0):
    """A lit round tube along a polyline (hair locks, brows, folds, straps): width w0 -> w1, shaded
    by its own cylinder normal under the key light. clip(x, y) -> bool limits it."""
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    m = max(w0, w1) / 2 + 1
    x0, x1, y0, y1 = min(xs) - m, max(xs) + m + 1, min(ys) - m, max(ys) + m + 1

    def fn(x, y):
        if clip is not None and not clip(x, y):
            return None
        d, t, side = poly_dist(x + 0.5, y + 0.5, pts)
        half = (w0 + (w1 - w0) * (t ** tip)) / 2
        if d > half or half <= 0.2:
            return None
        o = clamp(d / max(half, 0.01)) * side
        # the cylinder normal: across the stroke direction (approximated from the nearest segment)
        i = min(int(t * (len(pts) - 1)), len(pts) - 2)
        (ax, ay), (bx, by) = pts[i], pts[i + 1]
        dl = math.hypot(bx - ax, by - ay) or 1.0
        px, py = -(by - ay) / dl, (bx - ax) / dl
        nz = math.sqrt(max(0.0, 1 - o * o))
        n = norm3(px * o, py * o, nz + lift)
        return (mat, clamp(amb + gain * max(0.0, dot(n, KEY)) + base * 0.4 * nz - 0.2))
    cv.paint((x0, y0, x1, y1), fn, g)


def line(cv, pts, mat=None, v=0.0, ch=None, g=None, width=0.5, clip=None):
    """A thin line along a polyline: a fixed letter (ch) or a material value."""
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    for y in range(int(min(ys)) - 1, int(max(ys)) + 2):
        for x in range(int(min(xs)) - 1, int(max(xs)) + 2):
            if clip is not None and not clip(x, y):
                continue
            d, _, _ = poly_dist(x + 0.5, y + 0.5, pts)
            if d <= width:
                if ch is not None:
                    cv.fix(x, y, ch, g)
                else:
                    cv.put(x, y, mat, v, g)


def crease(cv, pts, depth=0.28, lit=0.12, groups=('skin',), width=0.55):
    """A skin crease (wrinkle, fold): a darker line with a lit edge below it."""
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    for y in range(int(min(ys)) - 1, int(max(ys)) + 3):
        for x in range(int(min(xs)) - 1, int(max(xs)) + 2):
            if cv.grp(x, y) not in groups:
                continue
            d, _, _ = poly_dist(x + 0.5, y + 0.5, pts)
            if d <= width:
                cv.shift(x, y, -depth)
            else:
                d2, _, _ = poly_dist(x + 0.5, y - 0.5, pts)
                if d2 <= width and lit:
                    cv.shift(x, y, lit)


# ------------------------------------------------------------------------------------------ grey


def luma(hx):
    r, g, b = (int(hx[i:i + 2], 16) for i in (1, 3, 5))
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
