# MECHA HASLEMA: the drawing layer. One Layer per game part (body, head, chain, medallion, legs,
# stamp-arm, arm-back), in the boss's local coordinates: (0, 0) is the floor point between her feet,
# pixel (x, y) covers [x, x + 1) x [y, y + 1), she faces RIGHT (the game's unflipped sprites face
# right; the stamp arm's frames 6-11 are pre-mirrored by the bake). Pure Python, deterministic: every
# mask is iterated sorted, no random, no time.
import math

from .pal import DARK, OUTLINE, step

# light from the upper front (facing right), toward the viewer
_L = (0.42, -0.55, 0.72)
_n = math.sqrt(sum(v * v for v in _L))
LX, LY, LZ = (v / _n for v in _L)


class Layer:
    """A sparse z-buffered picture: (x, y) -> (letter, z, sub). `sub` names the sub-part (selout runs
    between sub-parts of one layer whose z differ by more than 0.4)."""

    def __init__(self, name):
        self.name = name
        self.c = {}

    def put(self, x, y, ch, z=0.0, sub=''):
        x, y = int(math.floor(x)), int(math.floor(y))
        cur = self.c.get((x, y))
        if cur is None or z >= cur[1]:
            self.c[(x, y)] = (ch, z, sub)

    def over(self, x, y, ch, sub=None):
        """Recolour an existing pixel, keeping its depth (details painted on a surface)."""
        cur = self.c.get((x, y))
        if cur is not None:
            self.c[(x, y)] = (ch, cur[1], cur[2] if sub is None else sub)

    def get(self, x, y):
        v = self.c.get((x, y))
        return v[0] if v else None

    def sub(self, x, y):
        v = self.c.get((x, y))
        return v[2] if v else None

    def erase(self, x, y):
        self.c.pop((x, y), None)

    def fill(self, mask, fn, z, sub):
        """fn(x, y) -> letter or None for every pixel of mask (sorted)."""
        for (x, y) in sorted(mask):
            ch = fn(x, y)
            if ch:
                self.put(x, y, ch, z, sub)


# ------------------------------------------------------------------------------------------ masks
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


def edge(mask, x, y):
    return any((x + dx, y + dy) not in mask for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))


# ---------------------------------------------------------------------------------------- shading
def sphere_l(x, y, cx, cy, rx, ry):
    ux, uy = (x + 0.5 - cx) / (rx + 0.3), (y + 0.5 - cy) / (ry + 0.3)
    uz = math.sqrt(max(0.0, 1 - ux * ux - uy * uy))
    return ux * LX + uy * LY + uz * LZ


def pick(l, cuts, ramp):
    """The ramp tone for light l: cuts descending, len(cuts) == len(ramp) - 1."""
    for i, c in enumerate(cuts):
        if l > c:
            return ramp[i]
    return ramp[len(cuts)]


STEEL_CUTS = (0.90, 0.76, 0.58, 0.36, 0.12)
CLOTH_CUTS = (0.86, 0.66, 0.42, 0.16, -0.12)


def ball(L, cx, cy, r, ramp, z, sub, cuts=STEEL_CUTS, spec=None, dk=0):
    """A shaded sphere (a ball joint, a rivet head, a knob). spec = the glint letter."""
    m = ellmask(cx, cy, r, r)
    for (x, y) in sorted(m):
        ch = pick(sphere_l(x, y, cx, cy, r, r), cuts, ramp)
        L.put(x, y, step(ch, dk) if dk else ch, z, sub)
    if spec and r >= 2.2:
        L.put(math.floor(cx + r * 0.35), math.floor(cy - r * 0.45), spec, z + 0.01, sub)
    return m


def tube(L, a, b, ra, rb, ramp, z, sub, cuts=CLOTH_CUTS, pat=None):
    """A tapered capsule a -> b shaded as a cylinder lit from the upper front. pat(u, v, ch, l) ->
    letter paints along the limb (u = along from a, v = signed across)."""
    R = max(ra, rb) + 1
    x0, x1 = int(math.floor(min(a[0], b[0]) - R)), int(math.ceil(max(a[0], b[0]) + R))
    y0, y1 = int(math.floor(min(a[1], b[1]) - R)), int(math.ceil(max(a[1], b[1]) + R))
    dx, dy = b[0] - a[0], b[1] - a[1]
    l2 = dx * dx + dy * dy or 1e-9
    ln = math.sqrt(l2)
    m = set()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px, py = x + 0.5, y + 0.5
            t = max(0.0, min(1.0, ((px - a[0]) * dx + (py - a[1]) * dy) / l2))
            cx, cy = a[0] + t * dx, a[1] + t * dy
            r = ra + (rb - ra) * t
            d = math.hypot(px - cx, py - cy)
            if d <= r:
                ux, uy = (px - cx) / (r + 0.35), (py - cy) / (r + 0.35)
                uz = math.sqrt(max(0.0, 1 - ux * ux - uy * uy))
                l = ux * LX + uy * LY + uz * LZ
                ch = pick(l, cuts, ramp)
                if pat:
                    ch = pat(t * ln, ((px - cx) * -dy + (py - cy) * dx) / ln, ch, l)
                if ch:
                    L.put(x, y, ch, z, sub)
                    m.add((x, y))
    return m


def line(L, pts, ch, z, sub, over=False):
    """A 1 px polyline through integer points (Bresenham); over=True only recolours existing pixels."""
    out = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        e = dx + dy
        while True:
            out.append((x0, y0))
            if (x0, y0) == (x1, y1):
                break
            e2 = 2 * e
            if e2 >= dy:
                e += dy
                x0 += sx
            if e2 <= dx:
                e += dx
                y0 += sy
    seen = []
    for p in out:
        if p not in seen:
            seen.append(p)
    for (x, y) in seen:
        if over:
            if L.get(x, y) is not None:
                L.over(x, y, ch if isinstance(ch, str) else ch(L.get(x, y)))
        else:
            L.put(x, y, ch, z, sub)
    return seen


def seam(L, pts, dk=2, lit=1, side=(0, 1)):
    """A panel seam on a surface: the line one or two tones darker than the surface under it, the
    pixel beside it (side) a tone lighter (the lit lip of the plate edge)."""
    for (x, y) in line(Layer('tmp'), pts, 'x', 0, ''):
        ch = L.get(x, y)
        if ch is None:
            continue
        L.over(x, y, step(ch, dk))
        q = (x + side[0], y + side[1])
        c2 = L.get(*q)
        if lit and c2 is not None and q not in [(x, y)]:
            L.over(q[0], q[1], step(c2, -lit))


def rivet(L, x, y, lit_ch='1', dark_ch=None):
    """A 2 x 2 rivet head on a steel plate: lit upper-left, the plate's darker tones lower-right."""
    base = L.get(x, y)
    if base is None:
        return
    L.over(x, y, lit_ch)
    for (qx, qy) in ((x + 1, y), (x, y + 1)):
        if L.get(qx, qy) is not None:
            L.over(qx, qy, step(base, 1))
    if L.get(x + 1, y + 1) is not None:
        L.over(x + 1, y + 1, dark_ch or step(base, 3))


def catmull(pts, step_=0.25):
    """A smooth centre line through the control points (Catmull-Rom)."""
    P = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        n = max(2, int(math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step_))
        for j in range(n):
            t = j / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2
                                    + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3) for c in (0, 1)))
    out.append(pts[-1])
    return out


# ------------------------------------------------------------------------------------------ finish
def clean(L, subs, keep=''):
    """Remove lone shading pixels inside procedural shapes of the given sub-parts: a tone that none of
    its 4 neighbours share, when 3 or 4 neighbours are of the same sub-part, takes their commonest
    tone (keep = letters that stay, e.g. the lit curls)."""
    out = {}
    for (x, y), (ch, z, sub) in sorted(L.c.items()):
        if sub not in subs or ch in keep:
            continue
        nb = [L.c.get((x + dx, y + dy)) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
        same = [v[0] for v in nb if v and v[2] == sub]
        if len(same) >= 3 and ch not in same:
            out[(x, y)] = (max(sorted(set(same)), key=same.count), z, sub)
    L.c.update(out)


def fill_holes(L):
    """Close see-through gaps inside a layer: a background pixel the outside cannot reach takes the
    darkest tone of a neighbour (so no lone outline pixel sits inside a shape)."""
    if not L.c:
        return
    xs = [p[0] for p in L.c]
    ys = [p[1] for p in L.c]
    x0, x1, y0, y1 = min(xs) - 1, max(xs) + 1, min(ys) - 1, max(ys) + 1
    seen = set()
    st = [(x0, y0)]
    while st:
        x, y = st.pop()
        if (x, y) in seen or not (x0 <= x <= x1 and y0 <= y <= y1) or (x, y) in L.c:
            continue
        seen.add((x, y))
        st += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if (x, y) not in L.c and (x, y) not in seen:
                for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
                    v = L.c.get((x + dx, y + dy))
                    if v:
                        L.c[(x, y)] = (DARK.get(v[0], v[0]), v[1] - 0.01, v[2])
                        break


def finish(L, outline=True, fx=''):
    """Selout + the one warm near-black outline. Returns {(x, y): letter}. FX letters glow: they get
    no outline and no selout."""
    fill_holes(L)
    out = {}
    for (x, y), (ch, z, sub) in sorted(L.c.items()):
        nc = ch
        if ch in DARK and ch not in fx:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                v = L.c.get((x + dx, y + dy))
                if v and v[0] not in fx and v[2].split(':')[0] != sub.split(':')[0] and v[1] > z + 0.4:
                    nc = DARK[ch]
                    break
        out[(x, y)] = nc
    if outline:
        ring = {}
        for (x, y), ch in sorted(out.items()):
            if ch in fx:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if q not in out:
                    ring[q] = OUTLINE
        out.update(ring)
    return out


# ------------------------------------------------------------------------------------- composition
def compose(pieces):
    """Draw finished pieces back to front: [(pixels, dx, dy)] -> one {(x, y): letter}."""
    pic = {}
    for px, dx, dy in pieces:
        for (x, y), ch in px.items():
            pic[(x + dx, y + dy)] = ch
    return pic


def mirror(pic):
    """Face left: pixel x covers [x, x + 1), so it lands on -1 - x."""
    return {(-1 - x, y): ch for (x, y), ch in pic.items()}


def bbox(pic):
    xs = [p[0] for p in pic]
    ys = [p[1] for p in pic]
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1


def to_rows(pic):
    """{(x, y): letter} -> (rows, root): rows over letters ('.' empty), root = where (0, 0) lands."""
    x0, y0, x1, y1 = bbox(pic)
    rows = [''.join(pic.get((x, y), '.') for x in range(x0, x1)) for y in range(y0, y1)]
    return rows, (-x0, -y0)
