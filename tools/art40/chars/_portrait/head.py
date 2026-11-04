# The head of the portrait kit: a parametric skull in head space (u: px from the face's centre line,
# v: px down, the rest pose's screen y), mapped to the 64 x 120 window by a roll (tilt) about a pivot
# under the jaw and a whole-pixel shift (breath, jolt). The skin is shaded from the skull's base
# normal plus a field of bumps (brow ridge, sockets, nose, cheekbones, gaunt cheeks, muzzle, chin)
# under the key light, with a rim from behind on the right, cavity darkness and soft shade fields
# (the brow's shadow over the eyes, the nose's shadow). Texture noise is keyed to head space so it
# stays on the face when the head moves.
import math

from .core import KEY, RIM, HALF, clamp, dot, gauss, hsh, norm3, smooth, spline

# Light of the skin: value = AMB + GAIN * (n . key) ** POW + RIMK * rim ** 2 - cavities - shade
# - the core shadow (a dark band where the form turns away from the key, CORE deep at n . key =
# CORE_AT) - the shadow side (SHADOW per unit of n . key below 0): hard, low-key arcade modelling.
AMB, GAIN, POW, RIMK = 0.1, 0.84, 1.25, 0.8
CORE, CORE_AT, CORE_W, SHADOW = 0.2, 0.12, 0.14, 0.3


class Bump:
    """A Gaussian bump of the height field (amp px; negative = a hollow)."""
    __slots__ = ('u', 'v', 'su', 'sv', 'amp')

    def __init__(self, u, v, su, sv, amp):
        self.u, self.v, self.su, self.sv, self.amp = u, v, su, sv, amp


class Head:
    """The skull of one frame. p: the hero's head parameters (fixed), q: the pose (animated).

    p keys: cx, pivot, top, brow, eye, nose, mouth, chin (v positions); cran, temple, cheek, jaw,
    chinw (half widths); tilt (degrees, + rolls the top to the viewer's right); cap (the chin cap's
    height); eye_dx (half distance of the eye centres).
    q keys: dx, dy (whole-pixel shift), tilt (added), jaw (chin drop, px), smile (0..1 lifts the
    cheeks), gaunt (0..1 hollows the cheeks), turn (px: the features shift sideways).
    """

    def __init__(self, p, q=None):
        q = q or {}
        self.p, self.q = p, q
        self.cx = p['cx'] + q.get('dx', 0)
        self.dy = q.get('dy', 0)
        self.pv = p['pivot']
        t = math.radians(p.get('tilt', 0.0) + q.get('tilt', 0.0))
        self.co, self.si = math.cos(t), math.sin(t)
        self.top = p['top']
        self.jaw = q.get('jaw', 0.0)
        self.turn = q.get('turn', 0.0)
        self.brow, self.eye, self.nose = p['brow'], p['eye'], p['nose']
        self.mouth = p['mouth']
        self.chin0 = p['chin']
        self.chin = p['chin'] + self.jaw
        self.cap = p.get('cap', 7.0)
        vc = self.top + p['cran'] * 0.92
        self.vc = vc
        self._w = spline([(vc, p['cran']), (self.eye, p['temple']), (self.eye + 8, p['cheek']),
                          (self.mouth, p['jaw']), (self.chin0 - self.cap, p['chinw'])])
        self._ny = spline([(self.brow - 4, -0.16), (self.eye, -0.02), (self.nose, 0.0), (self.mouth, 0.06),
                           (self.chin0 - self.cap, 0.3), (self.chin0, 0.92)])
        self.bumps = []
        self.shades = []          # (u, v, su, sv, amount): soft darkness (cast shadows)
        self._skull_bumps()

    # -- space ----------------------------------------------------------------------------
    def uv(self, x, y):
        """Screen pixel (its centre) -> head space."""
        dx = x + 0.5 - self.cx
        dy = y + 0.5 - self.dy - self.pv
        u = dx * self.co + dy * self.si
        w = -dx * self.si + dy * self.co
        return u, w + self.pv

    def xy(self, u, v):
        """Head space -> screen (float)."""
        w = v - self.pv
        return (self.cx + u * self.co - w * self.si, self.pv + self.dy + u * self.si + w * self.co)

    def box(self, u0, v0, u1, v1, pad=1):
        """The screen box (x0, y0, x1, y1) that holds a head-space box."""
        pts = [self.xy(u0, v0), self.xy(u1, v0), self.xy(u0, v1), self.xy(u1, v1)]
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        return (int(math.floor(min(xs))) - pad, int(math.floor(min(ys))) - pad,
                int(math.ceil(max(xs))) + pad + 1, int(math.ceil(max(ys))) + pad + 1)

    def each(self, u0, v0, u1, v1, pad=1):
        """Every screen pixel of a head-space box with its head-space centre: (x, y, u, v)."""
        x0, y0, x1, y1 = self.box(u0, v0, u1, v1, pad)
        for y in range(max(0, y0), min(120, y1)):
            for x in range(max(0, x0), min(64, x1)):
                u, v = self.uv(x, y)
                yield x, y, u, v

    def pts(self, uvs):
        """Head-space points -> screen points."""
        return [self.xy(u, v) for u, v in uvs]

    def lower(self, v):
        """The rest-pose v of a point (undo the jaw drop below the mouth)."""
        if self.jaw and v > self.mouth:
            return self.mouth + (v - self.mouth) * (self.chin0 - self.mouth) / (self.chin - self.mouth)
        return v

    def sh(self, v, depth=1.0):
        """Sideways shift of a feature (turn) at depth 0..1 (1 = the nose tip)."""
        return self.turn * depth

    # -- shape ----------------------------------------------------------------------------
    def width(self, v):
        """Half width of the skull at v (0 outside)."""
        if v < self.top:
            return 0.0
        if v < self.vc:
            t = (self.vc - v) / (self.vc - self.top)
            return self.p['cran'] * math.sqrt(max(0.0, 1 - t * t))
        v0 = self.lower(v)
        cap0 = self.chin0 - self.cap
        if v0 <= cap0:
            return max(0.0, self._w(v0))
        if v0 >= self.chin0:
            return 0.0
        t = (v0 - cap0) / self.cap
        return self.p['chinw'] * math.sqrt(max(0.0, 1 - t ** 2.2))

    def inside(self, u, v):
        w = self.width(v)
        return w > 0 and abs(u - self.turn * 0.25) <= w

    # -- the height field ------------------------------------------------------------------
    def bump(self, u, v, su, sv, amp):
        self.bumps.append(Bump(u, v, su, sv, amp))

    def shade(self, u, v, su, sv, amount):
        self.shades.append((u, v, su, sv, amount))

    def _skull_bumps(self):
        p, q = self.p, self.q
        ex = p['eye_dx']
        e, b, n, m = self.eye, self.brow, self.nose, self.mouth
        t = self.turn
        smile = q.get('smile', 0.0)
        gaunt = q.get('gaunt', 0.6)
        # brow ridge and the hollow of the eye sockets
        self.bump(t * 0.4, b + 1.5, ex + 5, 2.4, 1.6)
        for s in (-1, 1):
            self.bump(s * ex + t * 0.45, e + 0.5, 5.2, 3.6, -2.6 - q.get('sunk', 0.0))
            # cheekbones (lifted by a smile) and the gaunt hollow under them
            self.bump(s * (ex + 3) + t * 0.4, e + 8 - smile * 2, 4.5, 3.2, 1.6 + smile * 1.2)
            self.bump(s * (ex + 4.5) + t * 0.3, m - 3, 3.6, 5.5, -1.9 * gaunt)
            # temples
            self.bump(s * (p['temple'] - 2.5) + t * 0.2, e - 7, 3.0, 5.0, -1.0)
            # nostril wings
            self.bump(s * 2.8 + t, n - 0.3, 1.5, 1.5, 1.0)
        # the nose: bridge (rising to the tip) and the bulb
        for i in range(5):
            k = i / 4.0
            self.bump(t * (0.5 + 0.5 * k), b + 3 + (n - b - 4) * k, 1.4 + 0.7 * k, 2.6, 1.1 + 1.6 * k)
        self.bump(t, n - 1.2, p.get('nose_w', 2.4), 2.0, 2.6)
        # the muzzle, the dent under the lower lip, the chin (they follow the jaw)
        self.bump(t * 0.7, m - 1, p.get('mouth_w', 9) + 2, 4.0, 1.4)
        self.bump(t * 0.6, m + 4.5 + self.jaw, 4.5, 1.6, -0.9)
        self.bump(t * 0.5, self.chin - 5.5, 5.5, 3.0, 1.8)
        # shade: the brow's shadow over the sockets, the nose's shadow (away from the key light)
        for s in (-1, 1):
            self.shade(s * ex + t * 0.45, e - 1.2, 5.5, 2.4, 0.16 + q.get('gloom', 0.0) * 0.12)
        self.shade(t + 3.4, n - 0.5, 1.6, 3.6, 0.32)
        self.shade(t * 0.8 + 0.8, n + 2.2, 3.0, 1.0, 0.3)
        self.shade(t * 0.6, self.chin - 1.2, 6.0, 1.6, 0.12)

    def field(self, u, v):
        """Height (px) and its gradient at a head-space point."""
        f = gu = gv = 0.0
        for k in self.bumps:
            du, dv = (u - k.u) / k.su, (v - k.v) / k.sv
            e2 = du * du + dv * dv
            if e2 > 16:
                continue
            g = k.amp * math.exp(-0.5 * e2)
            f += g
            gu -= g * du / k.su
            gv -= g * dv / k.sv
        return f, gu, gv

    def shadow(self, u, v):
        s = 0.0
        for (su_, sv_, a, b, amt) in self.shades:
            s += amt * gauss(u, v, su_, sv_, a, b)
        return s

    def normal(self, u, v, k=0.62):
        w = self.width(v) or 1.0
        nx = clamp((u - self.turn * 0.25) / w, -0.999, 0.999)
        if v < self.vc:
            ny = -0.97 * ((self.vc - v) / (self.vc - self.top)) ** 1.4 - 0.16
        else:
            ny = self._ny(self.lower(v))
        ny = clamp(ny, -0.98, 0.98)
        f, gu, gv = self.field(u, v)
        c = math.sqrt(1 - ny * ny)
        n = norm3(nx * c - k * gu, ny - k * gv, math.sqrt(1 - nx * nx) * c)
        return n, f

    def light(self, u, v, sheen=0.0):
        """(value, rim) of the skin at a head-space point."""
        n, f = self.normal(u, v)
        dk = dot(n, KEY)
        d = max(0.0, dk)
        r = max(0.0, dot(n, RIM))
        val = AMB + GAIN * d ** POW + RIMK * r * r - 0.05 * max(0.0, -f) - self.shadow(u, v)
        val -= CORE * math.exp(-((dk - CORE_AT) / CORE_W) ** 2) * (1 - r)
        val -= SHADOW * min(1.0, max(0.0, -dk) * 2.5) * (1 - r)
        if sheen:
            val += sheen * max(0.0, dot(n, HALF)) ** 30
        return clamp(val, 0.0, 1.0), r

    def noise(self, u, v, seed=0):
        """Texture noise keyed to head space (stays on the face when the head moves)."""
        return hsh(int(math.floor(u + 100)), int(math.floor(self.lower(v))), seed)


def skin(cv, hd, mat='skin', sheen=0.35, g='skin'):
    """Paint the skull's skin (the face and cranium under the hair)."""
    w = max(hd.p['cran'], hd.p['cheek'], hd.p['temple']) + 2
    for x, y, u, v in hd.each(-w, hd.top - 1, w, hd.chin + 1):
        if not hd.inside(u, v):
            continue
        val, r = hd.light(u, v, sheen)
        cv.put(x, y, mat, val, g, r)


def ears(cv, hd, mat='skin', v0=None, v1=None, out=2.6, g='ear'):
    """Two ears behind the skull's sides (drawn before the skin)."""
    v0 = hd.eye - 3 if v0 is None else v0
    v1 = hd.nose + 2 if v1 is None else v1
    vm, hv = (v0 + v1) / 2, (v1 - v0) / 2
    for s in (-1, 1):
        wm = hd.width(vm)
        cu = s * (wm + out * 0.35)
        for x, y, u, v in hd.each(cu - out - 2, v0 - 1, cu + out + 2, v1 + 1):
            du = (u - cu) / (out + 0.6)
            dv = (v - vm) / hv
            if du * du + dv * dv > 1 or abs(u) < hd.width(v) - 0.5:
                continue
            nx = clamp(du * s * 0.8 + s * 0.35, -1, 1)
            n = norm3(nx, dv * 0.6, math.sqrt(max(0.0, 1 - nx * nx)))
            val = AMB + GAIN * max(0.0, dot(n, KEY)) - 0.18
            inner = (abs(du - s * 0.1) < 0.45 and abs(dv) < 0.55)
            if inner:
                val -= 0.2
            cv.put(x, y, mat, clamp(val), g, max(0.0, dot(n, RIM)))


def neck(cv, hd, top, bottom, hw, mat='skin', g='neck', lean=0.0):
    """The neck: a dark lit cylinder under the jaw (the head's shadow on its upper part)."""
    for y in range(int(top), int(bottom)):
        for x in range(0, 64):
            cx = hd.cx + lean * (y - top) / max(1, bottom - top)
            dx = (x + 0.5 - cx) / hw
            if abs(dx) > 1:
                continue
            n = norm3(dx, 0.1, math.sqrt(1 - dx * dx))
            val = AMB + GAIN * 0.72 * max(0.0, dot(n, KEY)) - 0.1
            cv.put(x, y, mat, clamp(val), g, max(0.0, dot(n, RIM)))


def jaw_shadow(cv, hd, depth=0.32, reach=7, groups=('neck', 'body', 'shirt')):
    """The head's cast shadow under the jaw and the chin (key light from above), and the dark
    line where the jaw meets the neck (the selout of the chin)."""
    g0 = list(cv.g)
    for x in range(64):
        for y in range(120):
            if g0[y * 64 + x] not in groups:
                continue
            for k in range(1, reach + 1):
                yy, xx = y - k, x - (k // 3)
                if 0 <= yy < 120 and 0 <= xx < 64 and g0[yy * 64 + xx] in ('skin', 'beard'):
                    if k == 1:
                        cv.fix(x, y, 'K')
                    else:
                        cv.shift(x, y, -depth * (1 - (k - 2) / (reach + 1)))
                    break
