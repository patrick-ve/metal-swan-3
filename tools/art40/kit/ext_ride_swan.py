# The Swan (the ridden mount) as shared stage sprites at the 40 px hero scale: a big white swan with
# a long low body, a thick curved neck, an arched far wing behind the rider, the near wing folded on
# the flank (it hides the rider's legs), an upturned tail, orange webbed feet on legs that bend
# backward, a dark face patch and knob at the orange beak, a dark collar and two handle grips.
# Drawn procedurally per pose (pillow-shaded polygons, shaded tubes, leaf-shaped feathers that get
# a selout line where they overlap), then split in two layers so the rider sits IN the Swan:
#   swan_b  behind the rider: far wing, both handles (the rider's fists close over the grips),
#           the neck when it is behind him, wings raised over the deck
#   swan_f  in front of the rider: body, tail, legs, the near wing on the flank (hides his hips),
#           the neck when it is in front
# Swan-local coordinates: x forward, y down, (0, 0) = the ground point under the body. The anchor
# 'c' of every frame is the seat (the rider's hip).
import math
import rig
from rig import Canvas, ik, LIGHT3

# shared non-hero letters owned by ext_ride: 5 6 7 8 9
PAL = {
  '5': '#fbfaf3',   # white feathers
  '6': '#d6dbe4',   # light grey
  '7': '#95a0b6',   # blue-grey shade
  '8': '#f08b2b',   # orange beak and feet
  '9': '#2b2f45',   # dark: face patch, knob, collar, grips, lines
}
DARKS = {'5': '7', '6': '7', '7': '9', '8': '9'}

CW, CH = 112, 92
OX, OY = 56, 82                   # the swan's ground point on her canvas
SEAT = (-3, -26)                  # the rider's hip at rest
GRIP_N, GRIP_F = (9, -5), (10, -5)        # handle grips relative to the seat
GRIP_NF, GRIP_FF = (12, -3), (13, -3)     # folded handles (the flat duck)
HULL = [(-20, -25.5), (-14, -25.5), (-8, -25), (4, -25), (9, -25.5), (12, -25), (15, -23), (17, -20), (18, -17), (17, -14),
        (14, -12), (9, -11), (-11, -11), (-16, -13), (-20, -16), (-22, -20), (-23, -23), (-22, -25)]
PIVOT = (-2, -19)                 # tilt pivot (the body centre)
HIPS = {'N': (-1, -14), 'F': (-3, -15)}
THIGH, SHANK = 7.0, 8.0
W_WHITE = ['5', '5', '6', '7']
W_FAR = ['6', '6', '7', '7']
W_NECK = ['5', '5', '6', '7']
CUT_W = (0.55, 0.12, -0.25)


# ------------------------------------------------------------------ geometry helpers
def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def bez(p0, p1, p2, p3, t):
    u = 1 - t
    return (u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
            u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1])


def inside(pts, x, y):
    c = False
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xi = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if x < xi:
                c = not c
    return c


def edge_info(pts, x, y):
    """Distance to the polygon edge and the outward normal of the nearest edge."""
    best, bn = 1e9, (0.0, -1.0)
    n = len(pts)
    for i in range(n):
        (x1, y1), (x2, y2) = pts[i], pts[(i + 1) % n]
        dx, dy = x2 - x1, y2 - y1
        l2 = dx * dx + dy * dy or 1e-9
        t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / l2))
        cx, cy = x1 + t * dx, y1 + t * dy
        d = math.hypot(x - cx, y - cy)
        if d < best:
            best = d
            if d > 1e-6:
                bn = ((cx - x) / d, (cy - y) / d)
            else:
                ln = math.sqrt(l2)
                bn = (dy / ln, -dx / ln)
    return best, bn


class Swan:
    """One pose on two canvases (b = behind the rider, f = in front)."""
    def __init__(s, dx=0, dy=0, tilt=0):
        s.cv = {'b': Canvas(CW, CH), 'f': Canvas(CW, CH)}
        s.dx, s.dy = dx, dy
        a = math.radians(tilt)
        s.ca, s.sa = math.cos(a), math.sin(a)
        s.fx = []                                  # glowing effects drawn after the outline

    def T(s, p):
        """Body-attached point -> swan-local point (tilt about PIVOT, then the body offset)."""
        x, y = p[0] - PIVOT[0], p[1] - PIVOT[1]
        return (PIVOT[0] + x * s.ca - y * s.sa + s.dx, PIVOT[1] + x * s.sa + y * s.ca + s.dy)

    @staticmethod
    def C(p):
        return (OX + p[0], OY + p[1])

    def poly(s, layer, pts, ramp, z, part, R=4.0, cut=CUT_W, lift=0.0):
        """Pillow-shaded polygon (swan-local points already transformed)."""
        cv = s.cv[layer]
        cp = [s.C(p) for p in pts]
        xs, ys = [p[0] for p in cp], [p[1] for p in cp]
        lx, ly, lz = LIGHT3
        for y in range(int(math.floor(min(ys))), int(math.ceil(max(ys))) + 1):
            for x in range(int(math.floor(min(xs))), int(math.ceil(max(xs))) + 1):
                if not inside(cp, x, y):
                    continue
                d, (nx, ny) = edge_info(cp, x, y)
                k = max(0.0, 1 - d / R)
                nx, ny = nx * k, ny * k
                nz = math.sqrt(max(0.0, 1 - nx * nx - ny * ny))
                l = nx * lx + ny * ly + nz * lz + lift
                t = 0 if l > cut[0] else 1 if l > cut[1] else 2 if l > cut[2] else 3
                cv.px(x, y, ramp[t], z, part, proc=True)

    def tube(s, layer, a, b, ra, rb, ramp, z, part, cut=CUT_W):
        s.cv[layer].tube(s.C(a), s.C(b), ra, rb, ramp, z, part, cut=cut)

    def dot(s, layer, p, ch, z, part):
        c = s.C(p)
        s.cv[layer].px(round(c[0]), round(c[1]), ch, z, part)

    def grid(s, layer, rows, at, anchor, z, part):
        c = s.C(at)
        s.cv[layer].grid(int(round(c[0] - anchor[0])), int(round(c[1] - anchor[1])), rows, z, part)

    def finish(s):
        out = {}
        for k, cv in s.cv.items():
            rows = [list(r) for r in cv.finish()]
            for ch, p in s.fx if k == 'f' else []:
                x, y = s.C(p)
                x, y = int(round(x)), int(round(y))
                if 0 <= x < CW and 0 <= y < CH:
                    rows[y][x] = ch
            out[k] = [''.join(r) for r in rows]
        return out


# ------------------------------------------------------------------ parts
def feather(root, tip, w):
    """A leaf-shaped feather from root to tip, half-width w."""
    dx, dy = tip[0] - root[0], tip[1] - root[1]
    L = math.hypot(dx, dy) or 1e-9
    nx, ny = -dy / L, dx / L
    pts = []
    for t, k in ((0.0, 0.55), (0.35, 1.0), (0.75, 0.85), (0.93, 0.45)):
        pts.append((root[0] + dx * t + nx * w * k, root[1] + dy * t + ny * w * k))
    pts.append(tip)
    for t, k in ((0.93, 0.45), (0.75, 0.85), (0.35, 1.0), (0.0, 0.55)):
        pts.append((root[0] + dx * t - nx * w * k, root[1] + dy * t - ny * w * k))
    return pts


def wing(sw, layer, sh, wr, tip, trail, z, ramp, name, n_prim=4, spread=3.0, sec=4, cov=0.55, w=2.6):
    """A wing from shoulder sh over the wrist wr to the primaries' tip; the secondaries hang along
    sh-wr toward 'trail' (a vector). The coverts sit on top of the feather roots."""
    T = sw.T
    sh, wr, tip = T(sh), T(wr), T(tip)
    tv = (trail[0] * sw.ca - trail[1] * sw.sa, trail[0] * sw.sa + trail[1] * sw.ca)
    # primaries: from near the wrist, tips fanning around 'tip' (across the wing direction)
    dx, dy = tip[0] - wr[0], tip[1] - wr[1]
    L = math.hypot(dx, dy) or 1e-9
    px, py = -dy / L, dx / L
    if px * tv[0] + py * tv[1] < 0:            # fan toward the trailing side
        px, py = -px, -py
    k = 0
    for i in range(n_prim):
        f = i - (n_prim - 1) * 0.15
        t = (spread * f) / max(1, n_prim - 1) * 2
        root = lerp(wr, sh, 0.12 * i)
        tp = (tip[0] + px * t - dx / L * i * 1.2, tip[1] + py * t - dy / L * i * 1.2)
        sw.poly(layer, feather(root, tp, w), ramp, z + 0.01 * (n_prim - i), f'{name}p{i}', R=1.6, lift=0.2)
        k += 1
    # secondaries along the arm
    for i in range(sec):
        t = (i + 0.5) / sec
        root = lerp(sh, wr, t)
        tp = (root[0] + tv[0] * (0.85 + 0.25 * t), root[1] + tv[1] * (0.85 + 0.25 * t))
        sw.poly(layer, feather(root, tp, w * 0.95), ramp, z + 0.1 + 0.01 * i, f'{name}s{i}', R=1.6, lift=0.2)
    # coverts: the arm plate with a soft scalloped lower edge
    a1 = (sh[0] + tv[0] * cov, sh[1] + tv[1] * cov)
    a2 = (wr[0] + tv[0] * cov * 0.8, wr[1] + tv[1] * cov * 0.8)
    m = lerp(sh, wr, 0.5)
    nv = math.hypot(*tv) or 1e-9
    up = (-tv[0] / nv * 1.6, -tv[1] / nv * 1.6)
    pts = [(sh[0] + up[0], sh[1] + up[1]), (m[0] + up[0] * 1.3, m[1] + up[1] * 1.3), (wr[0] + up[0], wr[1] + up[1]),
           (wr[0] + dx / L * 2.5, wr[1] + dy / L * 2.5), a2, lerp(a1, a2, 0.5), a1]
    sw.poly(layer, pts, ramp, z + 0.3, f'{name}c', R=3.0)


def folded_wing(sw, layer, z, ramp, name, lift=0.0, flat=False):
    """The near wing folded flush on the flank: coverts plate + layered tertials and primaries
    whose tips cross over the tail. lift raises the rear half (breathing, landing); flat drops the
    front so a rider lying on her back shows his face."""
    T = sw.T
    top = -25.0 + (1.5 if flat else 0)
    tips = [(-28, -23 - lift), (-27, -20.5 - lift * 0.8), (-25, -18 - lift * 0.6), (-21.5, -16 - lift * 0.4)]
    roots = [(4, -23), (2, -21), (0, -19), (-2, -17.5)]
    for i, (r, t) in enumerate(zip(roots, tips)):
        sw.poly(layer, [T(p) for p in feather(r, t, 2.6)], ramp, z + 0.02 * i, f'{name}p{i}', R=1.6, lift=0.25)
    # tertials: three shorter feathers on top, ending above the tail
    ter = [((-2, -25), (-20, -25.5 - lift)), ((-1, -23.5), (-18, -22 - lift * 0.8)), ((0, -22), (-15, -19 - lift * 0.5))]
    for i, (r, t) in enumerate(ter):
        sw.poly(layer, [T(p) for p in feather(r, t, 2.4)], ramp, z + 0.2 + 0.02 * i, f'{name}t{i}', R=1.6, lift=0.25)
    cov = [(13, -21.5), (11, -24.5), (6, top), (-6, top), (-11, top + 1.0 - lift * 0.3), (-12, -22.5 - lift * 0.3),
           (-8, -19.5), (0, -17.5), (7, -17.5), (11, -19)]
    if flat:
        cov = [(13, -21), (11, -23), (6, -24), (-6, top), (-11, top + 1.0), (-12, -22.5), (-8, -19.5), (0, -17.5),
               (7, -17.5), (11, -19)]
    sw.poly(layer, [T(p) for p in cov], ramp, z + 0.5, f'{name}c', R=3.0, lift=0.15)


FOOT = {   # orange webbed feet; anchor = the ankle joint
  'S': (["..8.....", ".8888...", "8888888.", "98989898"], (2, 0)),          # spread flat on the ground
  'P': (["8.....", "88....", "888...", ".8888.", "..9898"], (0, 0)),        # pushing off the toes
  'F': (["88.", "888", "888", ".89", ".9."], (1, 0)),                       # folded, lifted
  'U': (["......8", "....888", "..88889", "8888898", ".9898.."], (1, 3)),     # toes up (heel strike, skid)
}


def leg(sw, side, foot, state, z, lens=(THIGH, SHANK)):
    hip = sw.T(HIPS[side])
    ramp = ['7', '7', '9', '9'] if side == 'N' else ['9', '9', '9', '9']
    knee, end = ik(hip, foot, lens[0], lens[1], -1)       # the joint bends backward (a bird's ankle)
    if knee[0] > hip[0] and knee[0] > end[0]:
        knee, end = ik(hip, foot, lens[0], lens[1], 1)
    sw.tube('f', hip, knee, 1.7, 1.3, ramp, min(z, 2.5), 'thigh' + side)
    sw.tube('f', knee, end, 1.2, 1.0, ramp, z + 0.1, 'leg' + side)
    rows, an = FOOT[state]
    sw.grid('f', rows, end, an, z + 0.2, 'foot' + side)
    return end


def tail(sw, lift=0.0, z=2.0):
    T = sw.T
    base = (-19, -24)
    for i, tp in enumerate([(-29, -30 - lift), (-30, -27.5 - lift * 0.8), (-28.5, -25 - lift * 0.6)]):
        sw.poly('f', [T(p) for p in feather(base, tp, 2.2)], W_WHITE, z + 0.02 * i, f'tail{i}', R=1.8)


def body(sw, puff=0.0, z=3.0):
    pts = []
    for (x, y) in HULL:
        if x >= 15 and -21 <= y <= -13:
            x += puff
        pts.append(sw.T((x, y)))
    sw.poly('f', pts, W_WHITE, z, 'body', R=6.0)
    # a soft feather line across the breast and a darker belly band
    for (x, y) in [(14, -21), (15, -19), (15.5, -17), (15, -15)]:
        sw.dot('f', sw.T((x + puff * 0.7, y)), '6', z + 0.05, 'body')


NECK_BASE = (13, -23)


def neck(sw, layer, c1, c2, head, z=4.0, r0=3.6, r1=2.2, base=NECK_BASE):
    """Thick neck along a cubic Bezier from the base (body-attached) to the head centre (swan-local,
    not tilted: the neck poses are drawn in screen space)."""
    p0 = sw.T(base)
    pts = [bez(p0, c1, c2, head, i / 14) for i in range(15)]
    for i in range(14):
        ra = r0 + (r1 - r0) * (i / 14)
        rb = r0 + (r1 - r0) * ((i + 1) / 14)
        sw.tube(layer, pts[i], pts[i + 1], ra, rb, W_NECK, z + 0.001 * i, 'neck')
    # the dark collar at the base
    a, b = pts[1], pts[2]
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy) or 1e-9
    nx, ny = -dy / L, dx / L
    for t in [i * 0.5 for i in range(-8, 9)]:
        for s in (0, 0.6):
            p = (a[0] + nx * t * 0.5 + dx / L * s, a[1] + ny * t * 0.5 + dy / L * s)
            if math.hypot(p[0] - a[0], p[1] - a[1]) <= r0 + 0.2:
                sw.dot(layer, p, '9', z + 0.05, 'neck')
    return pts


def head(sw, layer, at, ang, z=5.0, open_=0, eye='n'):
    """Round white head at 'at' (centre), beak toward the angle ang (degrees, 0 = forward, -90 = up).
    A dark face patch from the eye to a dark knob at the beak base, then the orange beak."""
    a = math.radians(ang)
    ux, uy = math.cos(a), math.sin(a)
    back = (at[0] - ux * 1.2, at[1] - uy * 1.2)
    front = (at[0] + ux * 1.0, at[1] + uy * 1.0)
    sw.tube(layer, back, front, 2.9, 2.6, W_NECK, z, 'head')
    vx, vy = -uy, ux                      # 'down' side of the beak (for a right-facing head)
    if ux < 0:
        vx, vy = uy, -ux
    # beak: from the head front, 6 px long, upper and lower mandible
    b0 = (at[0] + ux * 2.4, at[1] + uy * 2.4)
    for i in range(7):
        t = i
        w = 1.1 if i < 3 else 0.7 if i < 6 else 0.3
        c = (b0[0] + ux * t, b0[1] + uy * t)
        if open_:
            g = open_ * (i / 6)
            for s in (-w, 0):
                sw.dot(layer, (c[0] + vx * (s - g * 0.5), c[1] + vy * (s - g * 0.5)), '8', z + 0.2, 'beak')
            for s in (0, w * 0.6):
                sw.dot(layer, (c[0] + vx * (s + 0.6 + g), c[1] + vy * (s + 0.6 + g)), '8', z + 0.2, 'beak')
        else:
            for s in (-w, 0, w):
                sw.dot(layer, (c[0] + vx * s, c[1] + vy * s), '8', z + 0.2, 'beak')
    if open_:
        for i in range(2, 6):
            c = (b0[0] + ux * i + vx * (0.3 + open_ * i / 12), b0[1] + uy * i + vy * (0.3 + open_ * i / 12))
            sw.dot(layer, c, '9', z + 0.25, 'beak')
    tipc = (b0[0] + ux * 6.2, b0[1] + uy * 6.2)
    sw.dot(layer, tipc, '9', z + 0.3, 'beak')
    # knob + face patch (dark), eye
    knob = (b0[0] - vx * 1.4 + ux * 0.2, b0[1] - vy * 1.4 + uy * 0.2)
    sw.dot(layer, knob, '9', z + 0.3, 'beak')
    sw.dot(layer, (b0[0] - ux * 0.6, b0[1] - uy * 0.6), '9', z + 0.3, 'beak')
    eye_p = (at[0] + ux * 0.6 - vx * 0.9, at[1] + uy * 0.6 - vy * 0.9)
    sw.dot(layer, eye_p, '9', z + 0.3, 'eye')
    if eye == 'n':
        sw.dot(layer, (eye_p[0] + ux, eye_p[1] + uy), '9', z + 0.3, 'eye')
    elif eye == 'shut':
        sw.dot(layer, (eye_p[0] - ux, eye_p[1] - uy), '9', z + 0.3, 'eye')
    return (b0[0] + ux * 7.2, b0[1] + uy * 7.2)


def handles(sw, folded=False):
    """Two handle grips on short stalks from the deck in front of the seat (behind the rider, so
    his fists close over them). The far one is one shade darker."""
    seat = sw.T(SEAT)
    out = {}
    for side, g, z, ramp in (('F', GRIP_FF if folded else GRIP_F, 1.0, '9'), ('N', GRIP_NF if folded else GRIP_N, 1.5, '7')):
        gx, gy = seat[0] + g[0], seat[1] + g[1]
        out[side] = (gx, gy)
        if folded:      # stalk lies forward on the deck, the grip stands up 2 px
            for k in range(4):
                sw.dot('b', (gx - 3 + k, gy + 2), '9', z, 'stalk' + side)
            for k in range(3):
                sw.dot('b', (gx, gy + 1 - k), ramp, z + 0.1, 'grip' + side)
                sw.dot('b', (gx + 1, gy + 1 - k), '9', z + 0.1, 'grip' + side)
            continue
        base_y = sw.T((SEAT[0] + g[0], -25.5))[1]
        y = gy + 2
        while y <= base_y + 0.5:
            sw.dot('b', (gx, y), '9', z, 'stalk' + side)
            y += 1
        for k in range(-2, 2):
            sw.dot('b', (gx, gy + k), ramp, z + 0.1, 'grip' + side)
            sw.dot('b', (gx + 1, gy + k), '9', z + 0.1, 'grip' + side)
        sw.dot('b', (gx, gy - 2), '9', z + 0.1, 'grip' + side)
    return out


# ------------------------------------------------------------------ poses
def pose(name):
    """Returns (rows_b, rows_f, points) for one Swan pose."""
    P = POSES[name]
    sw = Swan(P.get('dx', 0), P.get('dy', 0), P.get('tilt', 0))
    # far side (behind the rider): far wing, handles
    fw = P.get('farwing', 'arch')
    lift = P.get('lift', 0.0)
    if fw == 'arch':
        wing(sw, 'b', (4, -25), (-10, -32 - lift), (-29, -35 - lift), (1, 5), 1.0, W_FAR, 'wf', spread=2.6, cov=0.6)
    elif fw == 'up':
        wing(sw, 'b', (4, -25), (-7, -39), (-27, -47), (-8, 3), 1.0, W_FAR, 'wf', n_prim=5, spread=5.0, w=2.2, sec=5)
    elif fw == 'half':
        wing(sw, 'b', (9, -25), (-7, -36), (-29, -37), (-1, 5), 1.0, W_FAR, 'wf', spread=3.0)
    elif fw == 'busk':
        wing(sw, 'b', (9, -25), (-5, -37), (-26, -35), (0, 5.5), 1.0, W_FAR, 'wf', spread=3.0, cov=0.7)
    elif fw == 'flat':
        wing(sw, 'b', (9, -25), (-8, -28.5), (-27, -26), (0, 4), 1.0, W_FAR, 'wf', spread=2.0, cov=0.6)
    g = handles(sw, P.get('fold', False))
    # front: legs, tail, body, near wing
    feet = {}
    if 'legs' in P:
        (fF, sF), (fN, sN) = P['legs']
        lens = P.get('lens', (THIGH, SHANK))
        feet['F'] = leg(sw, 'F', fF, sF, 1.0, lens)
    tail(sw, P.get('tail', 0.0))
    body(sw, P.get('puff', 0.0))
    if 'legs' in P:
        feet['N'] = leg(sw, 'N', fN, sN, 3.5, lens)
    nw = P.get('nearwing', 'fold')
    if nw == 'up':
        for x, y in [(-14, -21), (-12, -20), (-10, -19.5), (-8, -19), (-6, -19), (-4, -19), (-2, -19.5), (0, -20), (2, -20.5),
                     (6, -16), (8, -15.5), (10, -15.5), (-16, -16), (-14, -15)]:
            sw.dot('f', sw.T((x, y)), '6', 3.2, 'body')
    if nw == 'fold':
        folded_wing(sw, 'f', 6.0, W_WHITE, 'wn', lift=lift)
    elif nw == 'flat':
        folded_wing(sw, 'f', 6.0, W_WHITE, 'wn', flat=True)
    elif nw == 'up':           # raised: behind the rider (cover rule), drawn in the back layer
        wing(sw, 'b', (9, -24), (3, -42), (-11, -58), (-9, 3), 2.0, W_WHITE, 'wn', n_prim=5, spread=5.5, w=2.3, sec=5)
    elif nw == 'half':         # rear half raised, still under the deck line in the rider's span
        folded_wing(sw, 'f', 6.0, W_WHITE, 'wn', lift=4.0)
    # neck and head
    nk = P['neck']
    layer = P.get('necklayer', 'f')
    pts = neck(sw, layer, nk['c1'], nk['c2'], nk['head'], r0=nk.get('r0', 3.6), r1=nk.get('r1', 2.2))
    beak = head(sw, layer, nk['head'], nk['ang'], open_=nk.get('open', 0), eye=nk.get('eye', 'n'))
    for ch, p in P.get('fx', []):
        sw.fx.append((ch, p))
    if P.get('rings') is not None:
        sw.fx.extend(honk_rings(beak, nk['ang'], P['rings']))
    rows = sw.finish()
    seat = sw.T(SEAT)
    pts_out = {'c': Swan.C(seat), 'feet': Swan.C((0, 0)), 'gripN': Swan.C(g['N']), 'gripF': Swan.C(g['F']),
               'neck': Swan.C(sw.T(NECK_BASE)), 'head': Swan.C(nk['head']), 'beak': Swan.C(beak)}
    for k, v in feet.items():
        pts_out['foot' + k] = Swan.C(v)
    return rows['b'], rows['f'], pts_out, seat


def honk_rings(at, ang, k):
    """Sound arcs in front of the open beak (glowing effect letters, no outline)."""
    out, seen = [], set()
    for r in ([3, 6, 9] if k == 0 else [4, 7, 10]):
        span = 28 + r * 2
        for j in range(-span, span + 1, 3):
            t = math.radians(ang + j)
            p = (round(at[0] + r * math.cos(t)), round(at[1] + r * math.sin(t)))
            if p not in seen:
                seen.add(p)
                out.append(('I' if r < 6 else 'i' if r < 9 else 'm', p))
    return out


STAND_LEGS = (((-4, 0), 'S'), ((3, 0), 'S'))
POSES = {
  # calm standing, the neck in a tall S (two breaths: the rear of the wings lifts 1 px)
  'stand0': dict(legs=STAND_LEGS, neck=dict(c1=(20, -27), c2=(12, -37), head=(18, -41), ang=8)),
  'stand1': dict(legs=STAND_LEGS, dy=1, lift=1.0, lens=(THIGH, SHANK),
                 neck=dict(c1=(20, -26), c2=(12, -36), head=(18, -40), ang=10)),
  # the run: the neck forward like a charging goose, a long stride, the body bobs
  'run0': dict(legs=(((-10, -1), 'P'), ((10, 0), 'U')), dy=1, tilt=3, lift=1.5,
               neck=dict(c1=(20, -26), c2=(19, -31), head=(25, -33), ang=6)),
  'run1': dict(legs=(((2, -6), 'F'), ((-3, 0), 'S')), dy=-1, tilt=1, lift=2.5,
               neck=dict(c1=(20, -27), c2=(19, -32), head=(25, -35), ang=4)),
  'run2': dict(legs=(((10, 0), 'U'), ((-10, -1), 'P')), dy=1, tilt=3, lift=1.5,
               neck=dict(c1=(20, -26), c2=(19, -31), head=(25, -33), ang=6)),
  'run3': dict(legs=(((-3, 0), 'S'), ((2, -6), 'F')), dy=-1, tilt=1, lift=2.5,
               neck=dict(c1=(20, -27), c2=(19, -32), head=(25, -35), ang=4)),
  # skid: nose up, feet planted ahead, the neck thrown up and back
  'skid': dict(legs=(((5, 0), 'U'), ((10, 0), 'U')), dy=3, tilt=-9, lift=1.0, farwing='half',
               neck=dict(c1=(19, -32), c2=(16, -40), head=(16, -47), ang=-70)),
  # the neck arched over the rider: the beak points back and up behind him
  'arch': dict(legs=STAND_LEGS, farwing='arch', necklayer='b',
               neck=dict(c1=(24, -40), c2=(14, -56), head=(-3, -51), ang=-150, r0=3.6, r1=2.4)),
  # flap: squat, both wings snap up behind the rider
  'flap': dict(legs=(((-5, 0), 'S'), ((4, 0), 'S')), dy=3, lens=(THIGH, SHANK), farwing='up', nearwing='up',
               neck=dict(c1=(21, -24), c2=(14, -34), head=(20, -37), ang=-10, open=1)),
  # landing: squashed, wings half up, the neck pulled in
  'land': dict(legs=(((-6, 0), 'S'), ((5, 0), 'S')), dy=4, tilt=2, farwing='half', nearwing='half',
               neck=dict(c1=(21, -23), c2=(17, -30), head=(22, -33), ang=14, eye='shut')),
  # the flat duck: keel on the ground, the neck stretched forward low, the handles folded
  'duck': dict(dy=10, tilt=2, fold=True, farwing='flat', nearwing='flat', necklayer='b', tail=-1.0,
               neck=dict(c1=(20, -12), c2=(23, -9), head=(29, -9), ang=4)),
  # the honk: wind-up (neck pulled back, breast puffed), then HONK (neck forward-up, beak wide)
  'honk0': dict(legs=STAND_LEGS, farwing='busk', puff=1.0,
                neck=dict(c1=(17, -30), c2=(11, -36), head=(15, -40), ang=-20, eye='shut')),
  'honk1': dict(legs=(((-5, 0), 'S'), ((4, 0), 'S')), farwing='busk', puff=1.5, lift=1.0,
                rings=1, neck=dict(c1=(22, -30), c2=(22, -36), head=(26, -40), ang=-28, open=2)),
}
ORDER = ['stand0', 'stand1', 'run0', 'run1', 'run2', 'run3', 'skid', 'arch', 'flap', 'land', 'duck', 'honk0', 'honk1']
IDX = {k: i for i, k in enumerate(ORDER)}


def crop(rows, pts):
    ys = [y for y, r in enumerate(rows) if r.strip('.')]
    xs = [x for r in rows for x, ch in enumerate(r) if ch != '.']
    if not xs:
        return rows, pts
    x0, y0, x1, y1 = min(xs), min(ys), max(xs) + 1, max(ys) + 1
    return [r[x0:x1] for r in rows[y0:y1]], {k: (v[0] - x0, v[1] - y0) for k, v in pts.items()}


SEATS = {}


def build_stage():
    """parts.STAGE['swan_b'] / ['swan_f']: one frame per pose in ORDER (anchor 'c' = the seat)."""
    B, F = [], []
    for name in ORDER:
        rb, rf, pts, seat = pose(name)
        if name == 'honk1':
            pass
        SEATS[name] = seat
        B.append(crop(rb, pts))
        F.append(crop(rf, pts))
    return B, F
