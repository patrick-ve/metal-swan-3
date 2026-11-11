# The fatbike kit's drawing helpers: a PRODUCTION COPY of the cast spike's rider kit
# (docs/design/cast40/chars/delivery-rider_kit.py, frozen) for the fatbike sets (look 0 and the
# looks / pairs of stage 2, which import this package with art40.char('fatbike-youth')): flat-shaded
# discs and rings, tubes, lines, filled polygons, and a seated rider on the squad rig's IK limbs that
# also returns every joint (the smoothness gate measures them). 1x only (plan rule 7).
import math

import castkit as K

rig, pose, P = K.rig, K.pose, K.P
X1 = pose.Ctx(1)
L2 = (0.55, -0.83)          # 2D light: up and to the front


def canvas(w=104, h=84):
    return K.Canvas(w, h)


def lit(nx, ny):
    """Light term of a 2D normal (upper front)."""
    return nx * L2[0] + ny * L2[1]


def disc(cv, c, r, ramp, z, part, cut=(0.45, 0.05, -0.45), r_in=0.0, tone=None, sx=1.0):
    """A flat-shaded disc or ring (r_in < d <= r): lit on the upper front rim, dark on the lower back.
    ramp = 4 letters (hi, base, shade, deep). tone(x, y, d, a, ch) may repaint a pixel ('' = none).
    sx < 1 squeezes it into an upright ellipse (a wheel seen at an angle, the turn)."""
    cx, cy = c
    sx = max(0.08, abs(sx))
    R = int(math.ceil(r)) + 1
    for y in range(int(cy) - R, int(cy) + R + 1):
        for x in range(int(cx) - R, int(cx) + R + 1):
            dx, dy = (x - cx) / sx, y - cy
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
    """A 1 px line (spokes, chain, cable)."""
    n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1]))) + 1
    for i in range(n + 1):
        t = i / max(n, 1)
        cv.px(round(a[0] + (b[0] - a[0]) * t), round(a[1] + (b[1] - a[1]) * t), ch, z, part)


def grid(cv, x, y, rows, z, part, flip=False):
    """A hand-drawn part (castkit.grid text or rows) with its top-left at (x, y)."""
    if isinstance(rows, str):
        rows = K.grid(rows)
    cv.grid(int(round(x)), int(round(y)), rows, z, part, flip=flip)


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


def finish(cv, fx=()):
    """selout + the one outline, then the glowing effects on top (fx = [(x, y, letter)], no outline)."""
    rows = [list(r) for r in cv.finish()]
    for x, y, ch in fx:
        if 0 <= y < len(rows) and 0 <= x < len(rows[0]):
            rows[y][x] = ch
    return [''.join(r) for r in rows]


def stamp(rows, part, at, an='c'):
    """Lay a hand-drawn effect part (P.FX: rows, anchor) on finished rows (no outline: it glows)."""
    fr, a = part
    g = [list(r) for r in rows]
    x0, y0 = int(round(at[0] - a[0])), int(round(at[1] - a[1]))
    for j, r in enumerate(fr):
        for i, ch in enumerate(r):
            if ch not in '. ' and 0 <= y0 + j < len(g) and 0 <= x0 + i < len(g[0]) and g[y0 + j][x0 + i] in '.':
                g[y0 + j][x0 + i] = ch
    return [''.join(r) for r in g]


# ------------------------------------------------------------------ a rider on the rig's limbs
def foot_on(pedal, dx=-2.5, dy=-4.0):
    """Ankle target that puts the ball of the shoe on a pedal point."""
    return (pedal[0] + dx, pedal[1] + dy)


def to_grip(target, part=('hand', 'grip')):
    """Wrist target that puts a hand part's 'grip' point on the target."""
    lib = {'hand': P.HANDS, 'fist': P.FISTS, 'gun': P.GUNS}[part[0]]
    an = lib[part[1]][1]
    gx, gy = an.get('grip', an['wrist'])
    wx, wy = an['wrist']
    return (target[0] - (gx - wx), target[1] - (gy - wy))


def rider(cv, pel, torso, head, legs, arms, hd=(0, 0), z=0.0, tor=(0, 0), key=''):
    """A seated (or standing) rider on the canvas. pel = pelvis (canvas px). legs = {'legF': (ankle,
    shoe, bend), 'legN': ...} with absolute ankle targets. arms = {'armF': (target, end, bend), ...}
    (end = ('hand', 'grip') puts the part's grip point on the target; None: the wrist; a target
    ('sh', dx, dy) puts the wrist there relative to the shoulder). key prefixes
    the joint names (a passenger: 'p.'). Returns the joints: 'pel', 'torso.neck', 'head.neck',
    '<leg>.hip|knee|ankle', '<arm>.elbow|wrist' (canvas px)."""
    j = {key + 'pel': pel}
    for k, zz, ramp, hx in (('legF', 2, 'legF', -1), ('legN', 4, 'leg', 1)):
        if k in legs:
            ank, shoe, bend = legs[k]
            hip = (pel[0] + hx, pel[1])
            knee, end = pose.leg(cv, X1, hip, ank, bend, ramp, z + zz, key + k, shoe)
            j.update({f'{key}{k}.hip': hip, f'{key}{k}.knee': knee, f'{key}{k}.ankle': end})
    an = pose.place(cv, X1, P.TORSOS[torso], 'pelvis', (pel[0] + tor[0], pel[1] + tor[1]), z + 5, key + 'torso')
    j[key + 'torso.neck'] = an['neck']
    ha = pose.place(cv, X1, pose.head_part(X1, head), 'neck', (an['neck'][0] + hd[0], an['neck'][1] + hd[1]), z + 6, key + 'head')
    j[key + 'head.neck'] = ha['neck']
    for k, zz, ramp, sh in (('armF', 3.2, 'armF', an['shF']), ('armN', 7, 'arm', an['shN'])):
        if k in arms:
            tgt, end, bend = arms[k][:3]
            zo = arms[k][3] if len(arms[k]) > 3 else 0
            if isinstance(tgt[0], str):             # ('sh', dx, dy): the wrist relative to the shoulder
                wt = (sh[0] + tgt[1], sh[1] + tgt[2])
            else:
                wt = to_grip(tgt, end) if end else tgt
            info = pose.arm(cv, X1, sh, wt, bend, ramp, z + zz + zo, key + k, end)
            j[f'{key}{k}.elbow'] = info['elbow']
            j[f'{key}{k}.wrist'] = info['wrist']
    return j
