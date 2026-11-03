# VINCENT at reference fidelity: a 40 px hero on the 384x216 grid (1x pixels).
# Hand-drawn rigid parts (heads, torsos, shoes, hands, guns, effects) + limbs rasterised offline per
# frame as shaded tubes, then one selout pass (a far part's edge pixel next to a nearer part takes the
# far part's dark tone) and one exterior outline pass. Light comes from the upper front.
import math

PAL = {
  'K': '#140c0e',                                            # outline
  'A': '#9a6840', 'H': '#5e3a24', 'h': '#3a2216',            # hair (hi, base, shade)
  'Q': '#26150f',                                            # darkest brown: hair/jacket/brow/lines
  'L': '#ffe4cc', 'S': '#f4b896', 's': '#d4886c', 'z': '#94503e',  # skin
  'b': '#9a6e5c', 'B': '#6a4a3e',                            # stubble beard
  'w': '#fffaf0',                                            # teeth / eye white
  'J': '#d6a466', 'j': '#9c6c3e', 'q': '#5f3d22',            # tweed jacket
  'T': '#f6f6f2', 't': '#c3c7d2',                            # white shirt
  'R': '#b0283c', 'r': '#6c1628',                            # thin maroon tie
  'P': '#b6ada2', 'p': '#7e766e', 'o': '#4f4945', 'O': '#2b2625',  # dark trousers
  'X': '#5a5662', 'x': '#2f2c35', 'v': '#1c1a20',            # black shoes
  'G': '#e2e6ef', 'g': '#9297aa', 'n': '#535769', 'N': '#2f3142',  # pistol
  # effects (not part of the hero palette)
  'F': '#fffbd8', 'f': '#ffd040', 'c': '#ff8a24', 'e': '#e0401c', 'W': '#ffffff',
  'I': '#ffffff', 'i': '#bfe4ff', 'm': '#7fb4e8',
  'D': '#e6dac2', 'd': '#b4a486', 'M': '#7c8a44', 'u': '#3e4620',
  'y': '#ffe070',
}
HERO = set('KAHhQLSszbBwJjqTtRrPpoOXxvGgnN')
DARK = {}
for grp, d in [('AHh', 'Q'), ('LSs', 'z'), ('bB', 'B'), ('Jjq', 'Q'), ('Tt', 't'), ('Rr', 'r'),
               ('Ppo', 'O'), ('Xx', 'v'), ('Ggn', 'N')]:
    for ch in grp:
        DARK[ch] = d

def apply_hero(pal=None, hero='', dark=None):
    """Per-hero palette: recolour hero letters and add new ones (in place, so every importer sees it).
    hero = extra hero letters; dark = {letter: its selout dark tone} for the extra letters."""
    PAL.update(pal or {})
    HERO.update(set(hero))
    DARK.update(dark or {})


LIGHT = (0.55, -0.83)  # 2D: toward the light, up and to the front (the hero faces right)
_l = (0.32, -0.62, 0.72)
_n = math.sqrt(sum(v * v for v in _l))
LIGHT3 = tuple(v / _n for v in _l)  # 3D: up, front, toward the viewer
W, H = 80, 76
RX, RY = 36, 70        # root: the ground point under the hero's centre; soles end on row RY-1


class Canvas:
    def __init__(s, w=None, h=None):
        s.W, s.H = w or W, h or H
        W_, H_ = s.W, s.H
        s.c = [['.'] * W_ for _ in range(H_)]
        s.z = [[-9.0] * W_ for _ in range(H_)]
        s.p = [[None] * W_ for _ in range(H_)]
        s.proc = [[False] * W_ for _ in range(H_)]

    def px(s, x, y, ch, z, part, proc=False):
        x, y = int(x), int(y)
        if 0 <= x < s.W and 0 <= y < s.H and z >= s.z[y][x]:
            s.c[y][x] = ch; s.z[y][x] = z; s.p[y][x] = part; s.proc[y][x] = proc

    def grid(s, x0, y0, rows, z, part, flip=False):
        n = max(len(r) for r in rows)
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch not in '. ':
                    xi = (n - 1 - i) if flip else i
                    s.px(x0 + xi, y0 + j, ch, z, part)

    def tube(s, a, b, ra, rb, ramp, z, part, light=None, cut=(0.80, 0.48, 0.12), pat=None, u0=0.0):
        """Tapered capsule from a to b (pixel-centre coords), shaded as a 3D cylinder lit from the
        upper front (the highlight sits on the top of the limb, like a hand-drawn hero).
        pat(u, v, k, ch) -> ch lets a hero paint a cloth pattern that sticks to the limb: u = distance
        along the limb from its root (u0 + along this segment), v = signed distance from the axis,
        k = shade index 0..3, ch = the plain ramp colour. u and v are in canvas pixels."""
        lx, ly, lz = light or LIGHT3
        R = max(ra, rb) + 1
        x0, x1 = int(math.floor(min(a[0], b[0]) - R)), int(math.ceil(max(a[0], b[0]) + R))
        y0, y1 = int(math.floor(min(a[1], b[1]) - R)), int(math.ceil(max(a[1], b[1]) + R))
        dx, dy = b[0] - a[0], b[1] - a[1]
        l2 = dx * dx + dy * dy or 1e-9
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                t = max(0.0, min(1.0, ((x - a[0]) * dx + (y - a[1]) * dy) / l2))
                cx, cy = a[0] + t * dx, a[1] + t * dy
                r = ra + (rb - ra) * t
                d = math.hypot(x - cx, y - cy)
                if d <= r:
                    ux, uy = (x - cx) / (r + 0.35), (y - cy) / (r + 0.35)
                    uz = math.sqrt(max(0.0, 1 - ux * ux - uy * uy))
                    l = ux * lx + uy * ly + uz * lz
                    k = 0 if l > cut[0] else 1 if l > cut[1] else 2 if l > cut[2] else 3
                    ch = ramp[k]
                    if pat:
                        ln = math.sqrt(l2)
                        ch = pat(u0 + t * ln, ((x - cx) * -dy + (y - cy) * dx) / ln, k, ch)
                    s.px(x, y, ch, z, part, proc=True)

    def clean(s):
        """Remove lone shading pixels inside procedural limbs (a tone none of its 4 neighbours share)."""
        c = s.c
        out = [r[:] for r in c]
        for y in range(1, s.H - 1):
            for x in range(1, s.W - 1):
                if not s.proc[y][x]:
                    continue
                me, part = c[y][x], s.p[y][x]
                nb = [(c[y + dy][x + dx], s.p[y + dy][x + dx]) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                same = [ch for ch, p in nb if p == part]
                if len(same) >= 3 and me not in same:
                    out[y][x] = max(sorted(set(same)), key=same.count)
        s.c = out

    def finish(s, outline=True):
        s.clean()
        c = s.c
        out = [r[:] for r in c]
        # selout: a part's edge pixel that touches a clearly nearer part takes the part's dark tone
        for y in range(s.H):
            for x in range(s.W):
                ch = c[y][x]
                if ch == '.' or ch not in DARK or s.p[y][x] in ('fx',):
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    X, Y = x + dx, y + dy
                    if 0 <= X < s.W and 0 <= Y < s.H and c[Y][X] != '.' and s.p[Y][X] != 'fx' \
                            and s.p[Y][X].split(':')[0] != s.p[y][x].split(':')[0] and s.z[Y][X] > s.z[y][x] + 0.4:
                        out[y][x] = DARK[ch]
                        break
        if outline:
            for y in range(s.H):
                for x in range(s.W):
                    if c[y][x] == '.':
                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                            X, Y = x + dx, y + dy
                            if 0 <= X < s.W and 0 <= Y < s.H and c[Y][X] != '.' and s.p[Y][X] != 'fx':
                                out[y][x] = 'K'
                                break
        # effects drawn after the outline (they glow, no outline)
        return [''.join(r) for r in out]


def ik(a, target, l1, l2, bend):
    """Two-bone IK. bend=+1 / -1 picks the side of the middle joint. Returns (joint, end)."""
    ax, ay = a
    tx, ty = target
    d0 = math.hypot(tx - ax, ty - ay)
    d = max(1e-6, min(d0, l1 + l2 - 0.01))
    ang = math.atan2(ty - ay, tx - ax)
    cosb = max(-1.0, min(1.0, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))
    b = math.acos(cosb)
    j = ang - b * bend
    end = (ax + d * math.cos(ang), ay + d * math.sin(ang))
    return (ax + l1 * math.cos(j), ay + l1 * math.sin(j)), end


def scale2x(g):
    h, w = len(g), len(g[0])
    out = [['.'] * (w * 2) for _ in range(h * 2)]
    for y in range(h):
        for x in range(w):
            P = g[y][x]
            A = g[y - 1][x] if y > 0 else P
            B = g[y][x + 1] if x < w - 1 else P
            C = g[y][x - 1] if x > 0 else P
            D = g[y + 1][x] if y < h - 1 else P
            e0 = A if (C == A and C != D and A != B) else P
            e1 = B if (A == B and A != C and B != D) else P
            e2 = C if (D == C and D != B and C != A) else P
            e3 = D if (B == D and B != A and D != C) else P
            out[2 * y][2 * x] = e0; out[2 * y][2 * x + 1] = e1
            out[2 * y + 1][2 * x] = e2; out[2 * y + 1][2 * x + 1] = e3
    return out


def rotsprite(rows, pivot, deg):
    """Rotate a 1x grid around pivot (pixel coords) by deg (positive = counter-clockwise on screen)
    the RotSprite way: Scale2x three times, rotate by nearest sampling, sample back at 1x."""
    g = [list(r) for r in rows]
    for _ in range(3):
        g = scale2x(g)
    h, w = len(rows), len(rows[0])
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    out = [['.'] * w for _ in range(h)]
    px, py = pivot
    for y in range(h):
        for x in range(w):
            dx, dy = x - px, y - py
            # inverse rotation (screen y points down: counter-clockwise visual = negative math angle)
            sx = px + dx * ca - dy * sa
            sy = py + dx * sa + dy * ca
            X, Y = int(math.floor(sx * 8 + 4)), int(math.floor(sy * 8 + 4))
            if 0 <= X < w * 8 and 0 <= Y < h * 8:
                out[y][x] = g[Y][X]
    return [''.join(r) for r in out]
