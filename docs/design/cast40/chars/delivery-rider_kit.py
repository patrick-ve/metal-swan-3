# Shared drawing kit for the ams riders and their machines (delivery-rider, fatbike-youth,
# beer-bike): wheels, rods, filled shapes, a seated rider on the squad rig's IK limbs.
# Everything is drawn facing right on a big rig.Canvas; cast.py mirrors it (face=-1).
import math
import castkit as K

rig, pose, P = K.rig, K.pose, K.P
X1 = pose.Ctx(1)
L2 = (0.55, -0.83)          # 2D light: up and to the front


def canvas(w=120, h=96):
    return K.Canvas(w, h)


def lit(nx, ny):
    """Light term of a 2D normal (upper front)."""
    return nx * L2[0] + ny * L2[1]


def disc(cv, c, r, ramp, z, part, cut=(0.45, 0.05, -0.45), r_in=0.0, tone=None):
    """A flat-shaded disc or ring (r_in < d <= r): lit on the upper front rim, dark on the lower back.
    ramp = 4 letters (hi, base, shade, deep). tone(x, y, d, a, ch) may repaint a pixel."""
    cx, cy = c
    R = int(math.ceil(r)) + 1
    for y in range(int(cy) - R, int(cy) + R + 1):
        for x in range(int(cx) - R, int(cx) + R + 1):
            dx, dy = x - cx, y - cy
            d = math.hypot(dx, dy)
            if r_in < d <= r:
                l = lit(dx / (d or 1), dy / (d or 1)) * min(1.0, d / max(r, 1e-6) * 1.6) if d > 0 else 0
                k = 0 if l > cut[0] else 1 if l > cut[1] else 2 if l > cut[2] else 3
                ch = ramp[k]
                if tone:
                    ch = tone(x, y, d, math.atan2(dy, dx), ch)
                if ch:
                    cv.px(x, y, ch, z, part)


def rod(cv, a, b, r, ramp, z, part, cut=(0.62, 0.2, -0.2)):
    """A tube (bike frame, post, bar): rig.Canvas.tube with a 3-4 tone ramp."""
    cv.tube(a, b, r, r, ramp, z, part, cut=cut)


def line(cv, a, b, ch, z, part):
    """A 1 px line (spokes, chain, hose)."""
    n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1]))) + 1
    for i in range(n + 1):
        t = i / max(n, 1)
        cv.px(round(a[0] + (b[0] - a[0]) * t), round(a[1] + (b[1] - a[1]) * t), ch, z, part)


def grid(cv, x, y, rows, z, part):
    """A hand-drawn part (castkit.grid text or rows) with its top-left at (x, y)."""
    if isinstance(rows, str):
        rows = K.grid(rows)
    cv.grid(int(x), int(y), rows, z, part)


def poly(cv, pts, ch, z, part):
    """Fill a polygon (pixel centres inside)."""
    ys = [p[1] for p in pts]
    for y in range(int(math.floor(min(ys))), int(math.ceil(max(ys))) + 1):
        xs = []
        n = len(pts)
        for i in range(n):
            (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
            if (y0 <= y < y1) or (y1 <= y < y0):
                xs.append(x0 + (y - y0) * (x1 - x0) / (y1 - y0))
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            for x in range(int(math.ceil(xs[i] - 0.5)), int(math.floor(xs[i + 1] + 0.5)) + 1):
                cv.px(x, y, ch, z, part)


def hole(cv, c, r, z, part):
    """Mark the open inside of a wheel: filled with '~' so no outline is drawn there; finish() turns
    it back into '.' (the background shows between the spokes)."""
    disc(cv, c, r, '~~~~', z, part)


def finish(cv, root, fx=()):
    """selout + outline, then the open wheel insides and the glowing effects (no outline)."""
    rig.PAL.setdefault('~', '#000000')
    rows = [list(r) for r in cv.finish()]
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == '~':
                r[x] = '.'
    for x, y, ch in fx:
        if 0 <= y < len(rows) and 0 <= x < len(rows[0]):
            rows[y][x] = ch
    return [''.join(r) for r in rows], root


def rot_part(part, deg, pivot='pelvis', pad=8):
    """Turn a hand-drawn part with rotsprite (positive = counter-clockwise) and carry its anchors."""
    rows, an = part
    w = max(len(r) for r in rows)
    g = ['.' * (w + 2 * pad)] * pad + ['.' * pad + r.ljust(w, '.') + '.' * pad for r in rows] + ['.' * (w + 2 * pad)] * pad
    px, py = an[pivot][0] + pad, an[pivot][1] + pad
    out = rig.rotsprite(g, (px, py), deg)
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    an2 = {}
    for k, (x, y) in an.items():
        dx, dy = x + pad - px, y + pad - py
        an2[k] = (px + ca * dx + sa * dy, py - sa * dx + ca * dy)
    ys = [y for y, r in enumerate(out) if r.strip('.')]
    xs = [x for r in out for x, ch in enumerate(r) if ch != '.']
    x0, y0 = min(xs), min(ys)
    out = [r[x0:max(xs) + 1] for r in out[y0:max(ys) + 1]]
    return out, {k: (v[0] - x0, v[1] - y0) for k, v in an2.items()}


# ------------------------------------------------------------------ a rider on the rig's limbs
def foot_on(pedal, shoe='flat'):
    """Ankle target that puts the ball of the shoe on a pedal point."""
    return (pedal[0] - 2.5, pedal[1] - 4.0)


def to_grip(target, part=('hand', 'grip')):
    """Wrist target that puts a hand part's 'grip' point on the target."""
    lib = {'hand': P.HANDS, 'fist': P.FISTS, 'gun': P.GUNS}[part[0]]
    an = lib[part[1]][1]
    gx, gy = an.get('grip', an['wrist'])
    wx, wy = an['wrist']
    return (target[0] - (gx - wx), target[1] - (gy - wy))


def rider(cv, pel, torso, head, legs, arms, hd=(0, 0), z=0.0, back=None, tor=(0, 0)):
    """A seated (or standing) rider on the canvas. pel = pelvis (canvas px). legs = {'legF': (ankle,
    shoe, bend), 'legN': ...} with absolute ankle targets. arms = {'armF': (grip target, end, bend),
    'armN': ...}. back(cv, anchors) draws a backpack behind the torso. Returns the torso anchors,
    the head anchors and the arm infos."""
    out = {}
    for key, zz, ramp, hx in (('legF', 2, 'legF', -1), ('legN', 4, 'leg', 1)):
        if key in legs:
            ank, shoe, bend = legs[key]
            out[key] = pose.leg(cv, X1, (pel[0] + hx, pel[1]), ank, bend, ramp, z + zz, key, shoe)
    an = pose.place(cv, X1, P.TORSOS[torso], 'pelvis', (pel[0] + tor[0], pel[1] + tor[1]), z + 5, 'torso')
    out['torso'] = an
    out['head'] = pose.place(cv, X1, P.HEADS[head], 'neck', (an['neck'][0] + hd[0], an['neck'][1] + hd[1]), z + 6, 'head')
    if back:
        back(cv, out)
    for key, zz, ramp, sh in (('armF', 3.2, 'armF', an['shF']), ('armN', 7, 'arm', an['shN'])):
        if key in arms:
            tgt, end, bend = arms[key]
            out[key] = pose.arm(cv, X1, sh, to_grip(tgt, end) if end else tgt, bend, ramp, z + zz, key, end)
    return out
