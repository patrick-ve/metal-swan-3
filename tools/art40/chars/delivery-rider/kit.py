# PRODUCTION COPY of the cast spike's rider kit (docs/design/cast40/chars/delivery-rider_kit.py, a
# frozen record): wheels, rods, filled shapes and a seated rider on the squad rig's IK limbs, drawn
# facing right on a big rig.Canvas. Additions for the full set: ellipses (a lying bike), a point
# transform (a tilted or lying bike), the joints of the seated rider for the smoothness gate.
import math

import castkit as K

rig, pose, P = K.rig, K.pose, K.P
X1 = pose.Ctx(1)
L2 = (0.55, -0.83)          # 2D light: up and to the front


def canvas(w=120, h=100):
    return K.Canvas(w, h)


def lit(nx, ny):
    """Light term of a 2D normal (upper front)."""
    return nx * L2[0] + ny * L2[1]


def disc(cv, c, r, ramp, z, part, cut=(0.45, 0.05, -0.45), r_in=0.0, sy=1.0):
    """A flat-shaded disc or ring (r_in < d <= r), squashed to an ellipse by sy (a lying wheel): lit
    on the upper front rim, dark on the lower back. ramp = 4 letters (hi, base, shade, deep)."""
    cx, cy = c
    R = int(math.ceil(r)) + 1
    for y in range(int(cy) - R, int(cy) + R + 1):
        for x in range(int(cx) - R, int(cx) + R + 1):
            dx, dy = x - cx, (y - cy) / max(sy, 1e-6)
            d = math.hypot(dx, dy)
            if r_in < d <= r:
                l = lit(dx / (d or 1), dy / (d or 1)) * min(1.0, d / max(r, 1e-6) * 1.6) if d > 0 else 0
                k = 0 if l > cut[0] else 1 if l > cut[1] else 2 if l > cut[2] else 3
                ch = ramp[k]
                if ch:
                    cv.px(x, y, ch, z, part)


def rod(cv, a, b, r, ramp, z, part, cut=(0.62, 0.2, -0.2)):
    """A tube (bike frame, post, bar): rig.Canvas.tube with a 3-4 tone ramp."""
    cv.tube(a, b, r, r, ramp, z, part, cut=cut)


def line(cv, a, b, ch, z, part):
    """A 1 px line (spokes, chain)."""
    n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1]))) + 1
    for i in range(n + 1):
        t = i / max(n, 1)
        cv.px(round(a[0] + (b[0] - a[0]) * t), round(a[1] + (b[1] - a[1]) * t), ch, z, part)


def grid(cv, x, y, rows, z, part):
    """A hand-drawn part (castkit.grid text or rows) with its top-left at (x, y)."""
    if isinstance(rows, str):
        rows = K.grid(rows)
    cv.grid(int(round(x)), int(round(y)), rows, z, part)


def hole(cv, c, r, z, part, sy=1.0):
    """Mark the open inside of a wheel: '~' so no outline is drawn there; finish() clears it."""
    disc(cv, c, r, '~~~~', z, part, sy=sy)


def finish(cv, fx=()):
    """selout + outline, then the open wheel insides and the glowing effects (no outline).
    fx = [(x, y, letter)] in canvas pixels."""
    rows = [list(r) for r in cv.finish()]
    for r in rows:
        for x, ch in enumerate(r):
            if ch == '~':
                r[x] = '.'
    for x, y, ch in fx:
        x, y = int(round(x)), int(round(y))
        if 0 <= y < len(rows) and 0 <= x < len(rows[0]):
            rows[y][x] = ch
    return [''.join(r) for r in rows]


# ------------------------------------------------------------------ a rider on the rig's limbs
def foot_on(pedal):
    """Ankle target that puts the ball of the shoe on a pedal point."""
    return (pedal[0] - 2.5, pedal[1] - 4.0)


def to_grip(target, part=('hand', 'grip')):
    """Wrist target that puts a hand part's 'grip' point on the target."""
    lib = {'hand': P.HANDS, 'fist': P.FISTS}[part[0]]
    an = lib[part[1]][1]
    gx, gy = an.get('grip', an['wrist'])
    wx, wy = an['wrist']
    return (target[0] - (gx - wx), target[1] - (gy - wy))


def rider(cv, pel, torso, head, legs, arms, hd=(0, 0), z=0.0, back=None, tor=(0, 0)):
    """A seated (or standing) rider. pel = pelvis (canvas px). legs = {'legF': (ankle, shoe, bend),
    'legN': ...} with absolute ankle targets. arms = {'armF': (target, end, bend), 'armN': ...}: with
    an end of kind 'hand' that has a 'grip' point the target is the grip, else the wrist. back(cv,
    out) draws a backpack behind the torso. Returns the anchors and every joint (canvas px)."""
    out = {}
    j = {'pel': pel}
    for key, zz, ramp, hx in (('legF', 2, 'legF', -1), ('legN', 4, 'leg', 1)):
        if key in legs:
            ank, shoe, bend = legs[key]
            hip = (pel[0] + hx, pel[1])
            knee, end = pose.leg(cv, X1, hip, ank, bend, ramp, z + zz, key, shoe)
            out[key] = (knee, end)
            j[key + '.knee'] = knee
            j[key + '.ankle'] = end
    an = pose.place(cv, X1, P.TORSOS[torso], 'pelvis', (pel[0] + tor[0], pel[1] + tor[1]), z + 5, 'torso')
    out['torso'] = an
    j['torso.neck'] = an['neck']
    out['head'] = pose.place(cv, X1, P.HEADS[head], 'neck', (an['neck'][0] + hd[0], an['neck'][1] + hd[1]), z + 6, 'head')
    j['head.neck'] = out['head']['neck']
    if back:
        back(cv, out)
    for key, zz, ramp, sh in (('armF', 3.2, 'armF', an['shF']), ('armN', 7, 'arm', an['shN'])):
        if key in arms:
            tgt, end, bend = arms[key]
            an_end = {'hand': P.HANDS, 'fist': P.FISTS}[end[0]][end[1]][1] if end else {}
            wr = to_grip(tgt, end) if end and 'grip' in an_end else tgt
            info = pose.arm(cv, X1, sh, wr, bend, ramp, z + zz, key, end)
            out[key] = info
            j[key + '.elbow'] = info['elbow']
            j[key + '.wrist'] = info['wrist']
    out['joints'] = j
    return out


def deorphan(rows, keep=''):
    """The orphan gate's rule fixed at the source: an EDGE pixel (a transparent 4-neighbour or the
    frame border) without an 8-neighbour of its own letter takes the most common letter of its
    opaque 8-neighbours (spoke ends inside the open wheels, a selout corner). Letters in keep (eye
    whites, FX) stay. Repeats until nothing changes (each change gives the pixel a twin)."""
    g = [list(r) for r in rows]
    h, w = len(g), len(g[0]) if g else 0
    for _ in range(4):
        changed = False
        for y in range(h):
            for x in range(w):
                ch = g[y][x]
                if ch == '.' or ch in keep:
                    continue
                edge = any(not (0 <= x + dx < w and 0 <= y + dy < h) or g[y + dy][x + dx] == '.'
                           for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                if not edge:
                    continue
                nb = [g[y + dy][x + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                      if (dx or dy) and 0 <= x + dx < w and 0 <= y + dy < h]
                if ch in nb:
                    continue
                opaque = sorted(c for c in nb if c != '.' and c not in keep)
                if not opaque:
                    g[y][x] = '.'
                else:
                    g[y][x] = max(sorted(set(opaque)), key=opaque.count)
                changed = True
        if not changed:
            break
    return [''.join(r) for r in g]
