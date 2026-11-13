# DE RATTENJONG's drawer: one frame from a pose dict. Shaded fur volumes (ellipsoids lit from the
# upper front, tufted rims, short fur strands), pink skin tubes (paws, feet, the tail), the head
# with the long snout, the big yellow teeth, the red eye, the ears, the crown of a bent bicycle
# wheel and a bottle cap, Gerrit's gold chain on his neck, mange patches, the trash knots on the
# tail. Local coordinates: facing right, the anchor (0, 0) is the floor point under his feet
# (seated: the seat on the throne), y grows down.
import math

import castkit as K
import rig

W, H = 240, 130
RX, RY = 125, 112              # the anchor in canvas pixels
L3 = rig.LIGHT3
FUR = ['1', '2', '3', '4']
FURF = ['2', '3', '4', '5']   # the far limbs, one tone darker
BELLY = ['b', 'c', '3', '4']
SKIN = ['P', 'p', 'q', 'Q']
SKINF = ['p', 'q', 'Q', 'Q']
STEEL = ['S', 's', 'z', 'z']
KNOTS = [('N', 'n'), ('V', 'v'), ('Y', 'J'), ('L', 'l'), ('6', '7')]


def h(n):
    v = (int(n) * 374761393 + 668265263) & 0xffffffff
    v = ((v ^ (v >> 13)) * 1274126177) & 0xffffffff
    return ((v ^ (v >> 16)) & 0xffffffff) / 4294967296.0


def vnoise(x, y, seed, cell=3.0):
    gx, gy = x / cell, y / cell
    x0, y0 = math.floor(gx), math.floor(gy)
    fx, fy = gx - x0, gy - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    v = lambda i, j: h(seed + (x0 + i) * 7919 + (y0 + j) * 104729)
    return (v(0, 0) * (1 - fx) + v(1, 0) * fx) * (1 - fy) + (v(0, 1) * (1 - fx) + v(1, 1) * fx) * fy


class Pic:
    """A canvas in local coordinates, with the eye pixels remembered."""

    def __init__(self):
        self.cv = K.Canvas(W, H)
        self.eye = []
        self.fxo = []             # FX pixels painted after the outline, only on empty pixels

    def px(self, x, y, ch, z, part):
        self.cv.px(RX + x, RY + y, ch, z, part)

    def get(self, x, y):
        X, Y = RX + x, RY + y
        if 0 <= X < W and 0 <= Y < H:
            return self.cv.c[Y][X], self.cv.p[Y][X]
        return '.', None

    def recolour(self, x, y, ch, part=None):
        X, Y = RX + x, RY + y
        if 0 <= X < W and 0 <= Y < H and self.cv.c[Y][X] != '.' and (part is None or self.cv.p[Y][X] == part):
            self.cv.c[Y][X] = ch

    # -- volumes ------------------------------------------------------------------------------
    def blob(self, cx, cy, rx, ry, z, part, ramp=FUR, ang=0.0, fur=True, seed=1, cut=(0.78, 0.50, 0.18), belly=None):
        """A lit ellipsoid (rotated by ang degrees). fur: a tufted rim on the top and back and short
        fur strands. belly: (ex, ey, erx, ery) local ellipse painted in the belly ramp."""
        a = math.radians(ang)
        ca, sa = math.cos(a), math.sin(a)
        R = max(rx, ry) + 2
        for y in range(int(cy - R), int(cy + R) + 1):
            for x in range(int(cx - R), int(cx + R) + 1):
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                u, v = dx * ca + dy * sa, -dx * sa + dy * ca
                nx, ny = u / rx, v / ry
                d2 = nx * nx + ny * ny
                lim = 1.0
                if fur:
                    th = math.atan2(ny, nx)
                    k = int((th + math.pi) / (2 * math.pi) * (rx + ry) * 0.9)
                    tuft = h(seed * 977 + k)
                    if ny < 0.45:                       # tufts on the top and the back only
                        lim = 1.0 + 0.16 * (tuft - 0.35)
                if d2 > lim * lim:
                    continue
                nz = math.sqrt(max(0.0, 1 - min(1.0, d2)))
                wx, wy = nx * ca - ny * sa, nx * sa + ny * ca
                l = wx * L3[0] + wy * L3[1] + nz * L3[2]
                t = 0 if l > cut[0] else 1 if l > cut[1] else 2 if l > cut[2] else 3
                rp = ramp
                if belly:
                    ex, ey, erx, ery = belly
                    if ((x + 0.5 - ex) / erx) ** 2 + ((y + 0.5 - ey) / ery) ** 2 <= 1:
                        rp = BELLY
                if fur and d2 < 0.78 and t < 3:
                    # short fur strands: diagonal dashes one tone darker
                    s = (x * 2 + y) // 3
                    if h(seed * 31 + s * 7 + (y // 4) * 131) > 0.80 and (x + y) % 2 == 0:
                        t += 1
                self.px(x, y, rp[t], z, part)

    def tube(self, a, b, ra, rb, ramp, z, part):
        self.cv.tube((RX + a[0], RY + a[1]), (RX + b[0], RY + b[1]), ra, rb, ramp, z, part)

    def limb(self, a, j, b, r0, r1, r2, ramp, z, part):
        self.tube(a, j, r0, r1, ramp, z, part)
        self.tube(j, b, r1, r2, ramp, z, part)

    def mange(self, cx, cy, r, seed, part='body'):
        """A raw pink patch with a darker rim (only on fur already drawn of that part)."""
        for y in range(int(cy - r - 1), int(cy + r + 2)):
            for x in range(int(cx - r - 1), int(cx + r + 2)):
                d = math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.2) + (vnoise(x, y, seed, 1.7) - 0.5) * 2.2
                ch, p = self.get(x, y)
                if p != part or ch not in '12345bc':
                    continue
                if d < r - 0.8:
                    self.recolour(x, y, 'M' if d < r - 1.8 or (x + y) % 3 else 'p')
                elif d < r:
                    self.recolour(x, y, 'q')


def paw(pic, at, z, part, open_=False, far=False):
    """A pink hand with claws (facing right)."""
    x, y = at
    sk = SKINF if far else SKIN
    pic.blob(x, y, 2.6, 2.0, z, part, sk, fur=False)
    fingers = [(2, -1), (3, 0), (2, 1)] if not open_ else [(2, -2), (3, -1), (3, 1), (2, 2)]
    for fx, fy in fingers:
        pic.px(int(x + fx), int(y + fy), sk[1], z + 0.1, part)
        pic.px(int(x + fx + 1), int(y + fy), 'T' if not far else 't', z + 0.2, part)


def foot(pic, heel, toe, z, part, far=False):
    sk = SKINF if far else SKIN
    pic.tube(heel, toe, 2.4, 1.6, sk, z, part)
    for k in (0, 2):
        pic.px(int(toe[0] + 2), int(toe[1] - 1 + k), 't' if not far else 'u', z + 0.2, part)


def tail(pic, pts, z, part='tail', knots=(1, 2, 3, 4)):
    """The tail: a pink taper through pts, trash knots tied at the given points."""
    n = len(pts) - 1
    for i in range(n):
        r0 = 3.4 - 2.3 * i / n
        r1 = 3.4 - 2.3 * (i + 1) / n
        pic.tube(pts[i], pts[i + 1], r0, r1, SKIN, z, part)
    # scale rings
    for i in range(n):
        ax, ay = pts[i]
        bx, by = pts[i + 1]
        for t in (0.33, 0.66):
            x, y = int(round(ax + (bx - ax) * t)), int(round(ay + (by - ay) * t))
            ch, p = pic.get(x, y)
            if p == part:
                pic.recolour(x, y, 'q')
    for i in knots:
        if 0 < i <= n:
            x, y = pts[i]
            c, d = KNOTS[(i - 1) % len(KNOTS)]
            r = 2.6 - 0.3 * i
            pic.blob(x, y - 0.5, r + 0.6, r, z + 0.5, 'knot%d' % i, [c, c, d, d], fur=False)
            pic.px(int(x) - 1, int(y - r), c, z + 0.6, 'knot%d' % i)      # the knot's ear
            pic.px(int(x) + 1, int(y - r), d, z + 0.6, 'knot%d' % i)


def crown(pic, cx, cy, z, tilt=0.0):
    """A bent bicycle wheel worn as a crown (an oval rim, spokes) with a red bottle cap on top."""
    a = math.radians(tilt)
    pts = {}
    for k in range(48):
        t = 2 * math.pi * k / 48
        ex, ey = 8.6 * math.cos(t), 3.6 * math.sin(t) - 1.1 * math.cos(2 * t)    # bent
        x, y = ex * math.cos(a) - ey * math.sin(a), ex * math.sin(a) + ey * math.cos(a)
        X, Y = int(math.floor(cx + x + 0.5)), int(math.floor(cy + y + 0.5))
        lit = math.sin(t) < 0.2
        pts[(X, Y)] = 'S' if lit and math.cos(t) > -0.3 else 's' if lit else 'z'
    # spokes
    for k in range(5):
        t = math.pi * k / 5 + 0.3
        for s in (0.35, 0.65):
            x, y = 8.0 * s * math.cos(t), 3.4 * s * math.sin(t)
            X, Y = int(math.floor(cx + x * math.cos(a) - y * math.sin(a) + 0.5)), int(math.floor(cy + x * math.sin(a) + y * math.cos(a) + 0.5))
            pts.setdefault((X, Y), 's')
    for (X, Y), ch in pts.items():
        back = Y < cy - 1
        pic.px(X, Y, ch, z + (-4 if back else 0.6), 'crown')
    # the bottle cap on the front of the rim, crimped edge
    bx, by = int(cx + 2), int(cy - 2)
    cap = ['.CCC.', 'CCSCk', 'kCCkk', '.k.k.']
    for j, r in enumerate(cap):
        for i, ch in enumerate(r):
            if ch != '.':
                pic.px(bx - 2 + i, by - 3 + j, ch, z + 0.8, 'cap')


def chain(pic, a, b, sag, z):
    """Gerrit's gold chain on his neck: lit links from a to b, sagging; the medallion at the low point."""
    n = int(max(6, math.hypot(b[0] - a[0], b[1] - a[1]) * 1.3))
    low = None
    for i in range(n + 1):
        t = i / n
        x = a[0] + (b[0] - a[0]) * t
        y = a[1] + (b[1] - a[1]) * t + sag * math.sin(math.pi * t)
        X, Y = int(math.floor(x + 0.5)), int(math.floor(y + 0.5))
        pic.px(X, Y, 'G' if i % 2 == 0 else 'g', z, 'chain')
        pic.px(X, Y + 1, 'h' if i % 2 == 0 else 'g', z - 0.1, 'chain')
        if low is None or Y > low[1]:
            low = (X, Y)
    X, Y = low
    for j, r in enumerate(['gGg', 'GTg', 'ghh']):
        for i, ch in enumerate(r):
            pic.px(X - 1 + i, Y + 2 + j, ch, z + 0.2, 'medal')


def head(pic, hx, hy, z, p, look=0.0):
    """The head at (hx, hy) (skull centre), the snout toward +x, turned up by `look` degrees.
    p: mouth 0 shut / 1 half / 2 wide, flash, daze, crown."""
    a = math.radians(-look)
    def rot(dx, dy):
        return hx + dx * math.cos(a) - dy * math.sin(a), hy + dx * math.sin(a) + dy * math.cos(a)
    mouth = p.get('mouth', 0)
    # the far ear (behind), the skull, the snout, the cheek
    ex, ey = rot(-2, -9)
    pic.blob(ex + 4, ey - 1, 4.6, 5.2, z - 3, 'earF', ['p', 'q', 'Q', 'Q'], fur=False)
    pic.blob(hx, hy, 10.5, 9.5, z, 'head', FUR, ang=-look, seed=11, belly=None)
    sx, sy = rot(14, 2.5)
    pic.blob(sx, sy, 9.5, 5.2, z + 0.5, 'head', FUR, ang=-look - 8, seed=12)
    # the lower jaw (drops when the mouth opens)
    jx, jy = rot(9, 6.5 + mouth * 1.6)
    pic.blob(jx, jy, 7.0, 2.8, z + 0.2 - (0.6 if mouth else 0), 'jaw', ['b', 'c', '3', '4'], ang=-look + 6 + mouth * 9, fur=False)
    if mouth:
        # the mouth inside between the snout and the jaw
        for k in range(14):
            for j in range(mouth * 2 + 1):
                mx, my = rot(4 + k, 5 + j + k * mouth * 0.12)
                pic.px(int(mx), int(my), 'm', z + 0.3, 'mouth')
    # the cheek ruff
    cx, cy = rot(1, 4)
    pic.blob(cx, cy, 5, 4.5, z + 0.6, 'head', FUR, ang=-look, seed=13, belly=(cx + 2, cy + 3, 5, 3))
    # the nose
    nx, ny = rot(23, 1.5)
    pic.blob(nx, ny, 2.6, 2.3, z + 1.0, 'nose', SKIN, fur=False)
    # the teeth: two big yellow incisors under the snout tip
    tx, ty = rot(18.5, 6.5 + (1 if mouth else 0))
    for i in range(3):
        for j in range(4 + mouth):
            ch = 'T' if i == 0 or (i == 1 and j < 2) else 't' if j < 3 + mouth else 'u'
            if i == 1 and j > 0 and j < 3 + mouth and False:
                ch = 'u'
            pic.px(int(tx) + i, int(ty) + j, ch, z + 1.2, 'teeth')
    pic.px(int(tx) + 1, int(ty) + 1, 'u', z + 1.3, 'teeth')      # the gap between the two incisors
    if mouth == 2:
        bx, by = rot(15, 9 + mouth * 1.6)
        pic.px(int(bx), int(by) - 1, 'T', z + 1.2, 'teeth')
        pic.px(int(bx) + 1, int(by) - 1, 't', z + 1.2, 'teeth')
    # whiskers
    wx, wy = rot(18, 2)
    for k, (dx, dy) in enumerate(((10, -3), (11, 0), (9, 3))):
        for s in range(2, 9):
            t = s / 9
            X, Y = int(round(wx + dx * t)), int(round(wy + dy * t + (t * t * 1.5 if k == 2 else 0)))
            if (X + Y + k) % 4 != 0:
                pic.px(X, Y, 'c', z - 0.5, 'whisker')
    # the near ear
    ex, ey = rot(-7, -7)
    pic.blob(ex, ey, 5.0, 5.6, z + 2.5, 'ear', ['2', '3', '4', '4'], fur=False)
    pic.blob(ex + 0.8, ey + 0.5, 3.2, 3.8, z + 2.6, 'ear', ['P', 'p', 'q', 'q'], fur=False)
    # the eye (3 x 2, the tell: a bigger white flash 4 x 3)
    ex, ey = rot(8, -2)
    ex, ey = int(ex), int(ey)
    pic.px(ex - 1, ey - 1, '4', z + 1.5, 'brow')
    pic.px(ex, ey - 1, '4', z + 1.5, 'brow')
    pic.px(ex + 1, ey - 1, '5', z + 1.5, 'brow')
    if p.get('daze'):
        # dazed: the lids half shut, a dim red slit still glows
        for i in range(3):
            pic.px(ex + i, ey + (1 if i == 1 else 0), 'r', z + 1.6, 'eye')
            pic.eye.append((ex + i, ey + (1 if i == 1 else 0)))
        for i in range(3):
            pic.px(ex + i, ey - (0 if i == 1 else 0) - 0, '4' if i != 1 else '4', z + 1.55, 'lid')
    elif p.get('flash'):
        for j in range(3):
            for i in range(4):
                ch = 'O' if 0 < i < 3 or j == 1 else 'F'
                pic.px(ex - 1 + i, ey - 1 + j + 1 - 1, ch, z + 1.7, 'eye')
                pic.eye.append((ex - 1 + i, ey - 1 + j))
    else:
        for (dx, dy, ch) in ((0, 0, 'E'), (1, 0, 'R'), (2, 0, 'R'), (0, 1, 'R'), (1, 1, 'R'), (2, 1, 'r')):
            pic.px(ex + dx, ey + dy, ch, z + 1.6, 'eye')
            pic.eye.append((ex + dx, ey + dy))
    # mange on the head, the crown
    pic.mange(hx - 4, hy + 2, 2.4, 31, 'head')
    if p.get('crown', True):
        cx, cy = rot(1, -11)
        crown(pic, cx, cy, z + 2, tilt=-look * 0.6 - 6)


def finish(pic, flash=False):
    rows = pic.cv.finish()
    if pic.fxo:
        g = [list(r) for r in rows]
        for x, y, ch in pic.fxo:
            X, Y = RX + x, RY + y
            if 0 <= X < W and 0 <= Y < H and g[Y][X] == '.':
                g[Y][X] = ch
        rows = [''.join(r) for r in g]
    # the eye pixels that survived (a paw in front may hide them)
    eyes = []
    for (x, y) in pic.eye:
        X, Y = RX + x, RY + y
        ch = rows[Y][X]
        if ch in 'ERrOF':
            eyes.append((X, Y, ch))
    return rows, (RX, RY), eyes
