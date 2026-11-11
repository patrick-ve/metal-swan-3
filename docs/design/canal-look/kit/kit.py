# Paint kit for the canal scenes. Written new for this study: it reads no art of the game.
# All positions and sizes are LOGICAL pixels (the 384 x 216 view). The art tier U says how many real
# pixels one logical pixel has (1, 2 or 4). At U > 1 the same drawing calls give finer art: curves and
# slopes step by real pixels, textures and dither use finer cells, thin strokes get thinner.
import math
import os
import numpy as np
from PIL import Image

VIEW_W, VIEW_H = 384, 216
U = int(os.environ.get('U', '1'))        # art tier
DET = min(U, 2)                          # detail density of texture cells and dither (1 or 2 per logical pixel)
D1 = 1.0 / U                             # one real pixel, in logical units
TH = 1.0 if U == 1 else 0.5              # thin strokes: glazing bars, rails, rigging, joints
XO = {1: 0, 2: 1, 4: 2}.get(U, 0)        # extra noise octaves at the higher tiers


def P(v):
    """Logical -> real pixel index."""
    return int(math.floor(v * U + 1e-6))


PX = P                                   # alias: some painters use P for a palette


def rq(v):
    """At tier 1 round to the pixel grid (as hand-placed pixels do). At higher tiers keep the fraction."""
    return int(math.floor(v + 0.5)) if U == 1 else v


def sub(a, b):
    """Logical positions from a to b, one per real pixel."""
    for k in range(P(a), P(b)):
        yield k / U


def hx(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


# ---------------------------------------------------------------- colour (OKLab)
def _lin(c):
    c = np.asarray(c, float) / 255
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _gam(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055) * 255


def rgb2lab(rgb):
    r, g, b = [_lin(np.asarray(rgb, float)[..., i]) for i in range(3)]
    l = np.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    m = np.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    s = np.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    return np.stack([0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
                     1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
                     0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s], -1)


def lab2rgb(lab):
    L, a, b = [np.asarray(lab, float)[..., i] for i in range(3)]
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    return np.stack([_gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
                     _gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
                     _gam(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)], -1)


def snap5(c):
    """The reference hardware has 5 bits per channel. Snap a colour to that grid."""
    c = np.clip(np.rint(np.asarray(c, float)), 0, 255).astype(int)
    q = np.clip(np.rint(c / 255 * 31), 0, 31).astype(int)
    return (q << 3) | (q >> 2)


def oklch(L, C, h):
    a = C * math.cos(math.radians(h))
    b = C * math.sin(math.radians(h))
    return tuple(int(v) for v in snap5(lab2rgb(np.array([L, a, b]))))


def ramp(n, L0, L1, C0, Cm, C1, h0, h1, gamma=1.0):
    """A ramp dark -> light. The hue turns from h0 (shade) to h1 (light): shades go cool, lights go warm."""
    out = []
    dh = ((h1 - h0 + 180) % 360) - 180
    for i in range(n):
        t = i / (n - 1)
        L = L0 + (L1 - L0) * t ** gamma
        C = C0 * (1 - t) * (1 - 2 * t) + Cm * 4 * t * (1 - t) + C1 * t * (2 * t - 1)
        out.append(oklch(L, max(C, 0), h0 + dh * t))
    return out


def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def lum(c):
    c = np.asarray(c, float)
    return (0.30 * c[..., 0] + 0.59 * c[..., 1] + 0.11 * c[..., 2]) / 255


# ---------------------------------------------------------------- noise
def _hash(ix, iy, seed):
    h = (ix.astype(np.int64) * 374761393 + iy.astype(np.int64) * 668265263 + seed * 2147483647) & 0xFFFFFFFF
    h = (h ^ (h >> 13)) * 1274126177 & 0xFFFFFFFF
    h = h ^ (h >> 16)
    return (h & 0xFFFFFF) / float(0x1000000)


def vnoise(x, y, seed=0):
    x = np.asarray(x, float); y = np.asarray(y, float)
    ix = np.floor(x); iy = np.floor(y)
    fx = x - ix; fy = y - iy
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    a = _hash(ix, iy, seed); b = _hash(ix + 1, iy, seed)
    c = _hash(ix, iy + 1, seed); d = _hash(ix + 1, iy + 1, seed)
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy


def fbm(x, y, seed=0, octv=4, gain=0.5, lac=2.0, fine=True):
    """Fractal noise. The higher tiers add octaves, so the same call gives finer detail."""
    s = 0.0; amp = 1.0; tot = 0.0
    for o in range(octv + (XO if fine else 0)):
        s = s + vnoise(x, y, seed + o * 17) * amp
        tot += amp; amp *= gain
        x = x * lac; y = y * lac
    return s / tot


def hash01(x, y, seed=0):
    return _hash(np.floor(np.asarray(x, float) + 1e-6), np.floor(np.asarray(y, float) + 1e-6), seed)


def hs(xx, yy, seed=0):
    """A random value per detail cell (one logical pixel at tier 1, half of one above)."""
    return hash01(np.asarray(xx, float) * DET, np.asarray(yy, float) * DET, seed)


def chk(xx, yy):
    """The dither checker. Its cell is one detail cell."""
    a = np.floor(np.asarray(xx, float) * DET + 1e-6) + np.floor(np.asarray(yy, float) * DET + 1e-6)
    return (a.astype(np.int64) & 1) == 0


def tones(v, n, x, y, soft=0.34):
    """Value 0..1 -> tone index 0..n-1. Between two tones lies a band of checker, as in the reference skies."""
    f = np.clip(v, 0, 1) * (n - 1)
    b = np.floor(f)
    fr = f - b
    lo, hi = 0.5 - soft / 2, 0.5 + soft / 2
    idx = b + (fr > hi) + ((fr > lo) & (fr <= hi) & chk(x, y))
    return np.clip(idx, 0, n - 1).astype(int)


def grad(H):
    """Gradient of a height field per LOGICAL pixel."""
    gy, gx = np.gradient(H)
    return gy * U, gx * U


# ---------------------------------------------------------------- layer
class Layer:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.pw, s.ph = max(1, P(w)), max(1, P(h))
        s.a = np.zeros((s.ph, s.pw, 4), np.uint8)

    # --- boxes and spans
    def rect(s, x, y, w, h, c):
        x0, y0, x1, y1 = max(0, P(x)), max(0, P(y)), min(s.pw, P(x + w)), min(s.ph, P(y + h))
        if x1 > x0 and y1 > y0:
            s.a[y0:y1, x0:x1, :3] = c; s.a[y0:y1, x0:x1, 3] = 255

    def px(s, x, y, c):
        s.rect(x, y, 1, 1, c)

    def get(s, x, y):
        x = P(x); y = P(y)
        if 0 <= x < s.pw and 0 <= y < s.ph and s.a[y, x, 3]:
            return tuple(int(v) for v in s.a[y, x, :3])
        return None

    def clear(s, x, y, w=1, h=1):
        x0, y0, x1, y1 = max(0, P(x)), max(0, P(y)), min(s.pw, P(x + w)), min(s.ph, P(y + h))
        if x1 > x0 and y1 > y0:
            s.a[y0:y1, x0:x1] = 0

    def view(s, x, y, w, h):
        """The real pixels of a logical box (a numpy view)."""
        return s.a[max(0, P(y)):min(s.ph, P(y + h)), max(0, P(x)):min(s.pw, P(x + w))]

    def hl(s, x, y, n, c, t=1):
        s.rect(x, y + (1 - t) / 2, n, t, c)

    def vl(s, x, y, n, c, t=1):
        s.rect(x + (1 - t) / 2, y, t, n, c)

    def line(s, x0, y0, x1, y1, c, t=1):
        b = max(1, int(round(t * U)))
        off = (U - b) // 2 if b < U else 0
        x0, y0, x1, y1 = [int(round(v * U)) for v in (x0, y0, x1, y1)]
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx = 1 if x0 < x1 else -1; sy = 1 if y0 < y1 else -1
        e = dx + dy
        while True:
            xa, ya = max(0, x0 + off), max(0, y0 + off)
            xb, yb = min(s.pw, x0 + off + b), min(s.ph, y0 + off + b)
            if xb > xa and yb > ya:
                s.a[ya:yb, xa:xb, :3] = c; s.a[ya:yb, xa:xb, 3] = 255
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * e
            if e2 >= dy:
                e += dy; x0 += sx
            if e2 <= dx:
                e += dx; y0 += sy

    def poly(s, pts, c):
        pts = [(p[0] * U, p[1] * U) for p in pts]
        ys = [p[1] for p in pts]
        n = len(pts)
        for y in range(max(0, int(math.floor(min(ys)))), min(s.ph, int(math.ceil(max(ys))) + 1)):
            xs = []
            for i in range(n):
                (xa, ya), (xb, yb) = pts[i], pts[(i + 1) % n]
                if ya == yb:
                    continue
                if (ya <= y + 0.5 < yb) or (yb <= y + 0.5 < ya):
                    xs.append(xa + (y + 0.5 - ya) * (xb - xa) / (yb - ya))
            xs.sort()
            for i in range(0, len(xs) - 1, 2):
                a = max(0, int(math.ceil(xs[i] - 0.5))); b = min(s.pw - 1, int(math.floor(xs[i + 1] - 0.5)))
                if b >= a:
                    s.a[y, a:b + 1, :3] = c; s.a[y, a:b + 1, 3] = 255

    def _disc(s, cx, cy, rx, ry):
        x0, x1 = max(0, P(cx - rx) - 1), min(s.pw, P(cx + rx) + 2)
        y0, y1 = max(0, P(cy - ry) - 1), min(s.ph, P(cy + ry) + 2)
        if x1 <= x0 or y1 <= y0:
            return None
        yy, xx = np.mgrid[y0:y1, x0:x1]
        return x0, y0, x1, y1, (xx + 0.5) / U - cx, (yy + 0.5) / U - cy

    def ellipse(s, cx, cy, rx, ry, c):
        r = s._disc(cx, cy, rx, ry)
        if r is None:
            return
        x0, y0, x1, y1, dx, dy = r
        m = (dx / max(rx, 0.01)) ** 2 + (dy / max(ry, 0.01)) ** 2 <= 1
        sub_ = s.a[y0:y1, x0:x1]
        sub_[..., :3][m] = c; sub_[..., 3][m] = 255

    def ring(s, cx, cy, r, c, r_in=None):
        r_in = r - 1 if r_in is None else r_in
        q = s._disc(cx, cy, r, r)
        if q is None:
            return
        x0, y0, x1, y1, dx, dy = q
        d = np.hypot(dx, dy)
        m = (d > r_in) & (d <= r)
        sub_ = s.a[y0:y1, x0:x1]
        sub_[..., :3][m] = c; sub_[..., 3][m] = 255

    # --- arrays
    def put(s, x, y, rgb, mask):
        """rgb: (h, w, 3) array, mask: (h, w) bool, both in REAL pixels. x, y logical. Clipped paste."""
        h, w = mask.shape
        x = P(x); y = P(y)
        x0, y0 = max(0, x), max(0, y); x1, y1 = min(s.pw, x + w), min(s.ph, y + h)
        if x1 <= x0 or y1 <= y0:
            return
        m = mask[y0 - y:y1 - y, x0 - x:x1 - x]
        sub_ = s.a[y0:y1, x0:x1]
        sub_[..., :3][m] = rgb[y0 - y:y1 - y, x0 - x:x1 - x][m]
        sub_[..., 3][m] = 255

    def blit(s, o, x, y):
        s.put(x, y, o.a[..., :3], o.a[..., 3] > 0)

    def mask(s):
        return s.a[..., 3] > 0

    def flip(s):
        o = Layer(s.w, s.h); o.a = s.a[:, ::-1].copy(); return o

    def image(s):
        return Image.fromarray(s.a, 'RGBA')

    def recolor(s, fn, keep=()):
        """Map every colour of the layer through fn((n,3) array) -> (n,3). Keeps the palette discrete.
           keep: colours that stay as they are (lights)."""
        m = s.a[..., 3] > 0
        if not m.any():
            return s
        px = s.a[..., :3][m]
        u, inv = np.unique(px, axis=0, return_inverse=True)
        out = np.asarray(fn(u.astype(float)), np.uint8)
        for k in keep:
            hit = np.all(u == np.array(k, np.uint8), axis=1)
            out[hit] = k
        s.a[..., :3][m] = out[inv.reshape(-1)]
        return s

    def ncolors(s):
        m = s.a[..., 3] > 0
        return len(np.unique(s.a[..., :3][m], axis=0)) if m.any() else 0

    def outline(s, c, where='br'):
        """An inner edge line, one thin stroke wide. 'br': bottom and right (shade side), 'tl': top and left."""
        m = s.mask()
        e = np.zeros_like(m)
        for k in range(1, max(1, U // 2) + 1):
            if 'b' in where:
                e[:-k] |= m[:-k] & ~m[k:]; e[-k:] |= m[-k:]
            if 'r' in where:
                e[:, :-k] |= m[:, :-k] & ~m[:, k:]; e[:, -k:] |= m[:, -k:]
            if 't' in where:
                e[k:] |= m[k:] & ~m[:-k]; e[:k] |= m[:k]
            if 'l' in where:
                e[:, k:] |= m[:, k:] & ~m[:, :-k]; e[:, :k] |= m[:, :k]
        s.a[..., :3][e] = c


def grid(x0, y0, w, h):
    """Logical coordinates of every real pixel of a logical box: (xx, yy) float arrays."""
    px0, py0 = P(x0), P(y0)
    pw, ph = max(0, P(x0 + w) - px0), max(0, P(y0 + h) - py0)
    yy, xx = np.mgrid[0:ph, 0:pw]
    return (px0 + xx) / U, (py0 + yy) / U


# ---------------------------------------------------------------- grading (key light and air)
def grader(key=None, air=None):
    """key: (dark, light, amount, desat)   the light of the hour, a two-tone mix by luminance.
       air: (dark, light, amount, desat)   atmospheric perspective: the plane takes the colour of the air."""
    def fn(c):
        c = np.asarray(c, float) / 255
        for g in (key, air):
            if not g:
                continue
            dark, light, m, sat = g
            dark = np.array(dark) / 255; light = np.array(light) / 255
            l = (0.30 * c[..., 0] + 0.59 * c[..., 1] + 0.11 * c[..., 2])[..., None]
            tgt = dark + (light - dark) * l ** 0.8
            c = c + (tgt - c) * m
            l2 = (0.30 * c[..., 0] + 0.59 * c[..., 1] + 0.11 * c[..., 2])[..., None]
            c = l2 + (c - l2) * (1 - sat * m)
        return snap5(c * 255)
    return fn


def curve(gamma=1.0, satm=1.0, gain=1.0):
    def fn(c):
        c = np.asarray(c, float) / 255
        c = np.clip(c * gain, 0, 1) ** gamma
        l = (0.30 * c[..., 0] + 0.59 * c[..., 1] + 0.11 * c[..., 2])[..., None]
        c = np.clip(l + (c - l) * satm, 0, 1)
        return snap5(c * 255)
    return fn


# ---------------------------------------------------------------- sky and clouds
def gradient_pal(stops, n):
    """stops: [(t 0..1, '#hex')], n tones sampled evenly in t (interpolated in OKLab)."""
    ts = [s[0] for s in stops]
    labs = [rgb2lab(np.array(hx(s[1]), float)) for s in stops]
    out = []
    for i in range(n):
        t = i / (n - 1)
        j = max(k for k in range(len(ts)) if ts[k] <= t + 1e-9)
        j = min(j, len(ts) - 2)
        u = (t - ts[j]) / max(ts[j + 1] - ts[j], 1e-9)
        out.append(tuple(int(v) for v in snap5(lab2rgb(labs[j] + (labs[j + 1] - labs[j]) * u))))
    return out


def sky(w, h, stops, n=14, seed=1, streak=0.035, tilt=0.18, soft=0.36, glow=None):
    """A banded sky. Band borders are torn by a streaky noise and dithered with the checker.
       glow: (cx, cy, rx, ry, strength) bends the bands around a light source."""
    L = Layer(w, h)
    pal = gradient_pal(stops, n)
    xx, yy = grid(0, 0, w, h)
    t = yy / (h - 1)
    nz = fbm(xx / 46.0 + yy * tilt / 9.0, yy / 7.0, seed, 3) - 0.5
    v = t + nz * streak * 2
    if glow:
        cx, cy, rx, ry, st = glow
        d = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
        v = v + st * np.exp(-d * d * 1.6)
    idx = tones(v, n, xx, yy, soft)
    L.a[..., :3] = np.array(pal, np.uint8)[idx]
    L.a[..., 3] = 255
    return L, pal


def _largest(m):
    """Keep the largest 4-connected part of a mask (drops loose specks)."""
    h, w = m.shape
    lab = np.zeros((h, w), int); best = (0, 0); n = 0
    for y0 in range(h):
        for x0 in range(w):
            if m[y0, x0] and not lab[y0, x0]:
                n += 1; st = [(y0, x0)]; lab[y0, x0] = n; cnt = 0
                while st:
                    y, x = st.pop(); cnt += 1
                    for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                        if 0 <= yy < h and 0 <= xx < w and m[yy, xx] and not lab[yy, xx]:
                            lab[yy, xx] = n; st.append((yy, xx))
                if cnt > best[0]:
                    best = (cnt, n)
    return lab == best[1]


def cumulus(w, h, pal, seed=1, light=(-0.55, -0.75, 0.38), flat=0.5, dens=1.0, soft=0.30, edge=0.5):
    """One cumulus cloud in a w x h box. pal: dark -> light tones. Returns a Layer.
       The mass is a union of spheres on a flat base. Light comes from the upper left."""
    import random
    r = random.Random(seed)
    L = Layer(w, h)
    xx, yy = grid(0, 0, w, h)
    H = np.zeros(xx.shape)
    base = h - 2
    nb = max(5, int(w / 9 * dens))
    for i in range(nb):
        u = r.random()
        bx = w * (0.08 + 0.84 * u)
        bell = math.sin(math.pi * u) ** 0.7
        rad = max(4.0, (h * 0.20 + h * 0.36 * bell) * r.uniform(0.65, 1.0))
        by = base - rad * r.uniform(flat, 1.0)
        d2 = (xx + 0.5 - bx) ** 2 + ((yy + 0.5 - by) * 1.15) ** 2
        H = np.maximum(H, np.sqrt(np.maximum(rad * rad - d2, 0)))
    # small puffs that sit on the top line of the mass
    for i in range(nb):
        u = r.random()
        bx = int(w * (0.14 + 0.72 * u))
        col = np.where(H[:, min(P(bx), L.pw - 1)] > 2.0)[0]
        if len(col) == 0:
            continue
        rad = h * r.uniform(0.09, 0.17)
        by = col[0] / U + rad * r.uniform(0.5, 0.9)
        d2 = (xx + 0.5 - bx) ** 2 + (yy + 0.5 - by) ** 2
        H = np.maximum(H, np.sqrt(np.maximum(rad * rad - d2, 0)) * 1.25)
    nz = fbm(xx / 9.0, yy / 6.0, seed + 5, 3)
    H = H + (nz - 0.5) * 4.0
    inside = (H > 1.6) & (yy < base + (vnoise(xx / 14.0, yy * 0, seed + 9) - 0.5) * 3)
    inside = _largest(inside)
    gy, gx = grad(H)
    nx, ny, nz3 = -gx, -gy, np.full_like(H, 1.6)
    ln = np.sqrt(nx * nx + ny * ny + nz3 * nz3)
    lx, ly, lz = light
    ll = math.sqrt(lx * lx + ly * ly + lz * lz)
    sh = (nx * lx + ny * ly + nz3 * lz) / (ln * ll)
    sh = 0.50 + 0.50 * sh
    sh = sh * (0.62 + 0.38 * np.clip((base - yy) / (h * 0.75), 0, 1))       # the base is in shade
    sh = sh + (fbm(xx / 7.0, yy / 5.0, seed + 3, 2) - 0.5) * 0.10
    idx = tones(np.clip(sh, 0, 1), len(pal), xx, yy, soft)
    L.a[..., :3] = np.array(pal, np.uint8)[idx]
    # soft lower edge: a thin checker fringe where the mass is thin and in shade
    thin = (H < 3.2) & (sh < edge) & ~chk(xx, yy)
    L.a[..., 3] = np.where(inside & ~thin, 255, 0)
    return L


def wisp(w, h, pal, seed=1, cover=0.42, sx=38.0, sy=5.0, tilt=0.0, soft=0.4):
    """Streak clouds (stratus, cirrus): a stretched noise, cut to tones, dithered into the sky."""
    L = Layer(w, h)
    xx, yy = grid(0, 0, w, h)
    n = fbm(xx / sx + yy * tilt, yy / sy, seed, 4)
    env = np.sin(np.clip(yy / (h - 1), 0, 1) * math.pi) ** 0.6
    env = env * np.clip(np.minimum(xx, w - xx) / (w * 0.14), 0, 1)        # the streak fades at both ends of its box
    v = (n - (1 - cover)) / cover * env
    idx = tones(np.clip(v * 1.5, 0, 1), len(pal), xx, yy, soft)
    L.a[..., :3] = np.array(pal, np.uint8)[idx]
    thin = (v < 0.16) & ~chk(xx, yy)
    L.a[..., 3] = np.where((v > 0.02) & ~thin, 255, 0)
    return L


def save(layer, path, scale=1):
    im = layer.image() if isinstance(layer, Layer) else layer
    if scale != 1:
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    im.save(path)
