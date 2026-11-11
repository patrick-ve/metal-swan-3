# The herring gull drawer: one parametric bird (pose dict -> one finished frame), drawn facing RIGHT
# (the game's unflipped gull faces right). The look is the cast spike's approved sample
# (docs/design/cast40/chars/seagull.py): white head and body, silver-grey mantle and wings with black
# tips and white mirror spots, a white trailing edge, a yellow beak with the red gonys spot and a
# hooked tip, a pale frowning eye, pink legs. Bigger than life so it reads and can be hit.
#
# Body-local coordinates: x forward (to the beak), y down, (0, 0) = the body centre (the game's flying
# anchor). The pose pitches the body around its centre (+ = nose up). The wings are a small 3D model:
# a wing plane hinged at the shoulder that rises and falls (elevation, + = up), the arm and the hand
# fold back (fold 0 = spread, 1 = folded along the body), the hand lags the arm (follow-through); the
# camera looks a little down on the bird, so the near wing drops in front of the body and the far one
# shows over the back. Everything is drawn on the rig canvas (z-buffered parts, selout + outline in
# finish), the beak and the eye are hand-drawn grids turned with RotSprite.
import math

import castkit as K
import rig

from . import palette as PL

CW, CH = 76, 66                       # the work canvas
C0 = (38, 32)                         # the body centre on it
CAM = 0.42                            # camera elevation: a point nearer the viewer sits this much lower per px
CUT = (0.55, 0.12, -0.25)             # pillow-shading cuts (the cast sample)

# ------------------------------------------------------------------------------------ geometry
SHOULDER = {'N': (1.6, -2.4, 1.8), 'F': (-0.6, -3.0, -1.8)}   # x, y, z (z toward the viewer)
ARM, HAND = 8.0, 12.0
NECK0 = (4.2, -2.2)                   # the neck root on the body
HEAD = (8.2, -5.0)                    # the head centre at rest
HEAD_R = 3.9
TAIL0 = (-5.8, -0.4)
HIP = {'N': (-0.4, 3.4), 'F': (-1.4, 3.0)}
LIFT = 11                             # feet -> body centre of a standing gull (the game's PERCH_LIFT)


def _rot(p, deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return (p[0] * c + p[1] * s, -p[0] * s + p[1] * c)


def poly(cv, pts, ramp, z, part, R=3.0, cut=CUT, lift=0.0):
    """Directional-lit polygon (light from the upper front), the cast sample's plate shading."""
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    lx, ly, lz = rig.LIGHT3
    for y in range(int(math.floor(min(ys))), int(math.ceil(max(ys))) + 1):
        for x in range(int(math.floor(min(xs))), int(math.ceil(max(xs))) + 1):
            if not _inside(pts, x + 0.5, y + 0.5):
                continue
            d, (nx, ny) = _edge(pts, x + 0.5, y + 0.5)
            k = max(0.0, 1 - d / R)
            nx, ny = nx * k, ny * k
            nz = math.sqrt(max(0.0, 1 - nx * nx - ny * ny))
            v = nx * lx + ny * ly + nz * lz + lift
            t = 0 if v > cut[0] else 1 if v > cut[1] else 2 if v > cut[2] else 3
            cv.px(x, y, ramp[t], z, part, proc=True)


def _inside(pts, x, y):
    c = False
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            if x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
                c = not c
    return c


def _edge(pts, x, y):
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


class Bird:
    """One frame of the gull: body-local -> canvas transform (pitch, flip, offset, squash)."""

    def __init__(self, pose):
        self.p = pose
        self.cv = K.Canvas(CW, CH)
        self.pitch = pose.get('pitch', 0.0)
        self.flip = pose.get('flip', False)           # belly up (lying on its back)
        self.off = pose.get('at', (0.0, 0.0))         # body centre offset (canvas px)
        self.sq = pose.get('squash', (1.0, 1.0))      # (sx, sy) about the ground line (crush)
        self.ground = pose.get('ground', None)        # local y of the squash pivot
        self.j = {}                                   # joints (canvas coords)

    def T(self, p):
        x, y = p
        if self.flip:
            y = -y
        x, y = _rot((x, y), self.pitch)
        x, y = x + self.off[0], y + self.off[1]
        if self.sq != (1.0, 1.0):
            g = self.ground if self.ground is not None else 0.0
            x, y = x * self.sq[0], g + (y - g) * self.sq[1]
        return (C0[0] + x, C0[1] + y)

    def Tl(self, pts):
        return [self.T(p) for p in pts]

    def px(self, p, ch, z, part):
        c = self.T(p)
        self.cv.px(int(math.floor(c[0])), int(math.floor(c[1])), ch, z, part)

    def tube(self, a, b, ra, rb, ramp, z, part, cut=CUT):
        k = (self.sq[0] + self.sq[1]) / 2
        self.cv.tube(self.T(a), self.T(b), ra * k, rb * k, ramp, z, part, cut=cut)

    def poly(self, pts, ramp, z, part, R=3.0, lift=0.0):
        poly(self.cv, self.Tl(pts), ramp, z, part, R=R, lift=lift)


# ------------------------------------------------------------------------------------ the wing
def _wing3d(side, th, fold, lag, spread=1.0, sweep=0.0, arm=None, hand_a=None):
    """The wing's outline points (body-local x, y after the camera) and its joints.
    th: elevation of the arm (deg, + up); fold 0..1; lag: the hand's extra elevation (follow-through);
    spread: the hand length factor (foreshortening of a wing turned to the viewer); sweep: extra
    backward sweep of the whole wing (deg, the dive)."""
    sx, sy, sz = SHOULDER[side]
    sgn = 1 if side == 'N' else -1
    # arm and hand angles in the wing plane (0 = straight out, -90 = straight back); 'arm' / 'hand_a'
    # set them directly (the stoop: the wing a swept blade over the back)
    aA = math.radians(arm if arm is not None else -12 - 40 * fold - sweep)
    aH = math.radians(hand_a if hand_a is not None else max(-150.0, -28 - 112 * fold - sweep * 1.3))
    tA, tH = math.radians(th), math.radians(th + lag)

    def R(u, w, t):
        return (u, -w * math.sin(t), sgn * w * math.cos(t))

    def add(a, b):
        return (a[0] + b[0], a[1] + b[1], a[2] + b[2])

    def proj(q):
        return (q[0], q[1] + q[2] * CAM)

    S = (sx, sy, sz)
    arm = (math.sin(aA) * ARM, math.cos(aA) * ARM)
    hl = HAND * spread
    hand = (math.sin(aH) * hl, math.cos(aH) * hl)
    Wr = add(S, R(arm[0], arm[1], tA))
    Tp = add(Wr, R(hand[0], hand[1], tH))

    def perp(v):                       # the in-plane perpendicular toward the back
        L = math.hypot(*v) or 1e-9
        return (-v[1] / L, v[0] / L) if True else None

    def back(v):
        p = perp(v)
        return p if p[0] <= 0 else (-p[0], -p[1])

    pa, ph = back(arm), back(hand)
    hn = (hand[0] / (math.hypot(*hand) or 1), hand[1] / (math.hypot(*hand) or 1))
    chA = 8.4 - 3.0 * fold
    chW = 7.6 - 2.4 * fold

    def onA(t, c):                     # arm point: t along the arm, c behind it
        return add(S, R(arm[0] * t + pa[0] * c, arm[1] * t + pa[1] * c, tA))

    def onH(t, c):                     # hand point
        return add(Wr, R(hand[0] * t + ph[0] * c, hand[1] * t + ph[1] * c, tH))

    lead = [add(S, R(0.8, 0.0, tA)), onA(0.5, -0.7), Wr, onH(0.45, -0.3), Tp]
    trail = [onH(1.0, 1.4), onH(0.8, 3.6), onH(0.45, 5.6), onH(0.08, chW), onA(0.55, chA + 0.2),
             onA(0.0, chA)]
    out = [proj(q) for q in lead + trail]
    tip = [proj(q) for q in (onH(0.6, -0.2), Tp, onH(1.0, 1.4), onH(0.8, 3.6), onH(0.6, 4.8))]
    edge = [proj(onA(t, chA * (1.0 - 0.1 * t) - 0.6)) for t in (0.1, 0.3, 0.5, 0.7, 0.9)]
    cov = [proj(onA(t, 1.9)) for t in (0.15, 0.35, 0.55, 0.75, 0.95)] + [proj(onH(0.12, 1.6))]
    mirror = [proj(onH(0.9, 0.9)), proj(onH(0.78, 1.6))]
    # which side the viewer sees: the top (lit grey) or the underside (pale)
    top = math.sin(math.radians(17) - tA * (1 if side == 'N' else -1)) > 0
    joints = {'shoulder': proj(S), 'wrist': proj(Wr), 'tip': proj(Tp)}
    return dict(out=out, tip=tip, edge=edge, cov=cov, mirror=mirror, top=top, joints=joints)


def wing(b, side, w, ramps):
    """Draw one wing: w = dict(th, fold, lag, spread, sweep); ramps from the palette module."""
    if w is None:
        return
    g = _wing3d(side, w.get('th', 0.0), w.get('fold', 0.0), w.get('lag', 0.0), w.get('spread', 1.0),
                w.get('sweep', 0.0), w.get('arm'), w.get('hand'))
    near = side == 'N'
    z = (3.0 if near else 0.8) + w.get('dz', 0.0)
    face = 'top' if g['top'] else 'under'
    b.poly(g['out'], ramps[side][face], z, 'wing' + side, R=2.6, lift=0.08 if g['top'] else 0.0)
    b.poly(g['tip'], ramps[side]['tip'], z + 0.05, 'wing' + side, R=1.4)
    if near and g['top']:
        for p in g['edge']:
            b.px(p, '2', z + 0.08, 'wing' + side)          # the white trailing edge
        for p in g['cov'][1:-1]:
            b.px(p, '5', z + 0.07, 'wing' + side)          # the coverts' line
    if w.get('mirror', True):
        c = b.T(g['mirror'][0])                             # a white mirror spot in the black tip
        x, y = int(math.floor(c[0])), int(math.floor(c[1]))
        if 0 <= x < b.cv.W and 0 <= y < b.cv.H and b.cv.c[y][x] in '78' and b.cv.p[y][x] == 'wing' + side:
            b.cv.px(x, y, '1', z + 0.09, 'wing' + side)
    for k, v in g['joints'].items():
        b.j[f'wing{side}.{k}'] = b.T(v)


def folded(b, side, lift=0.0, droop=0.0, z=None):
    """The wing folded on the flank (standing): the grey plate, the white tertial crescent, the
    black primaries crossing over the tail with white spots. lift raises the rear (a shrug, a
    ruffle); droop lowers the tip (asleep, hot)."""
    near = side == 'N'
    zz = z if z is not None else (3.0 if near else 0.6)
    oy = 0.0 if near else -1.2
    plate = [(4.6, -2.6 + oy), (2.0, -4.0 + oy), (-4.0, -3.6 + oy - lift * 0.4), (-8.0, -2.4 + oy - lift),
             (-8.6, -0.6 + oy - lift * 0.6), (-4.5, 1.6 + oy), (0.5, 2.4 + oy), (3.8, 1.0 + oy)]
    ramp = PL.WING_TOP if near else PL.WING_FAR
    b.poly(plate, ramp, zz, 'wing' + side, R=2.4, lift=0.05)
    prim = [(-6.0, -2.2 + oy - lift), (-14.5, -2.6 + oy - lift * 1.4 + droop), (-15.2, -1.4 + oy - lift * 1.2 + droop),
            (-13.0, -0.4 + oy - lift * 0.8 + droop), (-6.4, 0.6 + oy - lift * 0.5)]
    b.poly(prim, PL.TIP_TOP if near else PL.TIP_FAR, zz + 0.05, 'wing' + side, R=1.3)
    if near:
        for p in ((-3.5, 1.0), (-1.5, 1.7), (0.6, 1.9), (-5.4, 0.2)):
            b.px((p[0], p[1] + oy), '2', zz + 0.1, 'wing' + side)        # tertial crescent / trailing edge
        for p in ((2.6, -1.4), (0.6, -1.8), (-1.4, -1.6)):
            b.px((p[0], p[1] + oy), '5', zz + 0.1, 'wing' + side)        # coverts' line
        b.px((-13.4, -1.6 + oy - lift * 1.2 + droop), '1', zz + 0.12, 'wing' + side)
        b.px((-10.6, -1.3 + oy - lift * 1.0 + droop * 0.6), '1', zz + 0.12, 'wing' + side)
    b.j[f'wing{side}.tip'] = b.T((-15.0, -1.8 + oy - lift + droop))
    b.j[f'wing{side}.wrist'] = b.T((2.0, -3.0 + oy))


# ------------------------------------------------------------------------------------ body parts
def body(b, puff=0.0, breath=0.0):
    r0, r1 = 3.5 + puff * 0.6, 4.7 + puff + breath
    b.tube((-5.6, -0.2), (3.6, 0.2 - breath * 0.3), r0, r1, PL.WHITE, 2.0, 'body')
    if puff:
        for p in ((-2.0, 4.0 + puff), (0.5, 4.6 + puff), (3.0, 4.2 + puff)):
            b.px(p, '2', 2.05, 'body')
    b.j['body'] = b.T((0.0, 0.0))


def mantle(b):
    """The silver-grey back between the wing roots (seen when the wings are up)."""
    b.poly([(3.6, -3.9), (-1.0, -4.0), (-5.6, -3.0), (-5.0, -1.8), (3.6, -2.2)], PL.WING_TOP, 2.1, 'body', R=2.0)


def tail(b, ang=0.0, fan=0.0, z=1.5):
    piv = TAIL0
    pts = [(-5.6, -2.8), (-12.4, -2.4 - fan * 0.6), (-13.2, -0.6), (-12.6, 1.3 + fan), (-5.6, 2.4)]
    pts = [_add(piv, _rot(_sub(p, piv), ang)) for p in pts]
    b.poly(pts, PL.WHITE, z, 'tail', R=2.0)
    b.j['tail'] = b.T(_add(piv, _rot((-7.0, 0.0), ang)))


def neck(b, head):
    b.tube(NECK0, head, 3.2, 3.0, PL.WHITE, 2.15, 'neck')


def head(b, at, ang=0.0, face='mean', beak='shut', z=2.4, fry=False, flipgrid=None):
    """The head disc at body-local `at`, the beak and eye grid turned by the head angle + the pitch
    (+ = beak up). face: mean / wide / shut / half / x / happy / wink / soot; beak: shut / open /
    gape / peck (a sharp snap) / back (tucked: pointing backward, mostly hidden)."""
    b.tube(at, at, HEAD_R, HEAD_R, PL.WHITE, z, 'head')
    grid, piv = PL.head_grid(face, beak, fry)
    flip = b.flip if flipgrid is None else flipgrid
    if flip:
        grid = grid[::-1]
        piv = (piv[0], len(grid) - 1 - piv[1])
    deg = (ang if not b.flip else -ang) + b.pitch
    if b.flip:
        deg = b.pitch - ang
    grid = rig.rotsprite(grid, piv, deg) if abs(deg) > 0.5 else grid
    c = b.T(at)
    x0, y0 = int(round(c[0] - piv[0])), int(round(c[1] - piv[1]))
    for j, r in enumerate(grid):
        for i, ch in enumerate(r):
            if ch in '. ':
                continue
            if ch == 'w':            # head white that only fills the disc edge under the rotation
                b.cv.px(x0 + i, y0 + j, '1', z + 0.01, 'head')
            else:
                b.cv.px(x0 + i, y0 + j, ch, z + 0.2, 'head')
    tipx, tipy = PL.BEAK_TIP[beak]
    a = math.radians(deg)
    dx, dy = tipx - piv[0], tipy - piv[1]
    if flip:
        dy = -dy
    tx, ty = dx * math.cos(a) + dy * math.sin(a), -dx * math.sin(a) + dy * math.cos(a)
    b.j['head'] = c
    b.j['beak'] = (c[0] + tx, c[1] + ty)


def foot_at(b, f):
    """A foot point: ('w', x, y) = anchor space (the ground the gull stands on), else body-local."""
    if len(f) == 3 and f[0] == 'w':
        return (C0[0] + f[1], C0[1] + f[2])
    return b.T(f)


def legs(b, mode='tuck', feet=None, zf=None):
    """Legs: 'tuck' (flight: the feet under the tail), or the legs to feet = {'N': pt, 'F': pt,
    'kN': foot kind, 'kF': ...} (standing: anchor-space ground points ('w', x, y); dangling or up:
    body-local points). Foot kinds: flat / toe / curl / up."""
    if mode == 'tuck':
        b.px((-4.4, 4.0), 'p', 1.8, 'legF')
        b.px((-5.4, 4.0), 'P', 1.85, 'legN')
        b.px((-6.4, 3.6), 'P', 1.85, 'legN')
        b.j['footN'] = b.T((-5.4, 4.0))
        return
    for side in ('F', 'N'):
        hip = b.T(HIP[side])
        c = foot_at(b, feet[side])
        ramp = PL.LEG if side == 'N' else PL.LEG_FAR
        z = (3.2 if side == 'N' else 0.5) if zf is None else zf[side]
        b.cv.tube(hip, c, 1.05, 0.85, ramp, z, 'leg' + side, cut=(0.7, 0.2, -0.3))
        kind = feet.get('k' + side, 'flat')
        rows, an = PL.FEET[kind]
        if side == 'F':
            rows = [r.replace('P', 'p') for r in rows]
        if feet.get('vflip' + side, False):
            rows = rows[::-1]
            an = (an[0], len(rows) - 1 - an[1])
        if feet.get('hflip' + side, False):
            rows = [r[::-1] for r in rows]
            an = (len(rows[0]) - 1 - an[0], an[1])
        b.cv.grid(int(round(c[0] - an[0])), int(round(c[1] - an[1])), rows, z + 0.1, 'foot' + side)
        b.j['foot' + side] = c


def _add(a, b):
    return (a[0] + b[0], a[1] + b[1])


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


# ------------------------------------------------------------------------------------ the frame
def draw(pose):
    """Draw a pose; returns the Bird (canvas filled, joints set). Keys:
    pitch, at, flip, squash, ground; wings: wN / wF (dict th, fold, lag, spread, sweep) or 'folded';
    fold_lift, fold_droop; tail (deg), fan; head: hd (offset of the head from HEAD), ha (deg), face,
    beak, fry; neck (bool); legs ('tuck' / 'dangle' / 'stand' / 'up'), feet; puff, breath;
    extra: a callable(bird) drawing props (fries, flames) into the canvas."""
    b = Bird(pose)
    p = pose
    hd = p.get('hd', (0.0, 0.0))
    hc = (HEAD[0] + hd[0], HEAD[1] + hd[1])
    tucked = p.get('tucked', False)
    if p.get('wings') == 'folded':
        folded(b, 'F', p.get('fold_lift', 0.0), p.get('fold_droop', 0.0))
        folded(b, 'N', p.get('fold_lift', 0.0), p.get('fold_droop', 0.0))
    else:
        # a smear: the wing drawn at a second pose too (the same part: one blurred shape); drawn
        # first, so the joints are the main pose's
        if p.get('wF2'):
            wing(b, 'F', p['wF2'], PL.RAMPS)
        if p.get('wN2'):
            wing(b, 'N', p['wN2'], PL.RAMPS)
        wing(b, 'F', p.get('wF'), PL.RAMPS)
        wing(b, 'N', p.get('wN'), PL.RAMPS)
        mantle(b)
    tail(b, p.get('tail', 0.0), p.get('fan', 0.0))
    body(b, p.get('puff', 0.0), p.get('breath', 0.0))
    legs(b, p.get('legs', 'tuck'), p.get('feet'))
    if tucked:
        head(b, hc, p.get('ha', 0.0), p.get('face', 'shut'), 'back', z=1.95)
    else:
        if p.get('neck', True):
            neck(b, hc)
        head(b, hc, p.get('ha', 0.0), p.get('face', 'mean'), p.get('beak', 'shut'), fry=p.get('fry', False))
    for f in p.get('extra', ()):
        f(b)
    return b


def squash(b, sx, sy, gy):
    """Squash the drawn canvas (before the outline) about the body-centre x and the ground row
    C0.y + gy (the crush): nearest sampling of the letters, the depth and the parts."""
    cv = b.cv
    if gy is None:                     # the lowest drawn row (+1: the outline row under it)
        gy = max(y for y in range(cv.H) if any(ch != '.' for ch in cv.c[y])) + 1 - C0[1]
    gx, g = C0[0], C0[1] + gy
    c = [r[:] for r in cv.c]
    z = [r[:] for r in cv.z]
    pp = [r[:] for r in cv.p]
    pr = [r[:] for r in cv.proc]
    for y in range(cv.H):
        for x in range(cv.W):
            X_ = int(math.floor(gx + (x + 0.5 - gx) / sx))
            Y_ = int(math.floor(g + (y + 0.5 - g) / sy))
            if 0 <= X_ < cv.W and 0 <= Y_ < cv.H:
                cv.c[y][x], cv.z[y][x], cv.p[y][x], cv.proc[y][x] = c[Y_][X_], z[Y_][X_], pp[Y_][X_], pr[Y_][X_]
            else:
                cv.c[y][x], cv.z[y][x], cv.p[y][x], cv.proc[y][x] = '.', -9.0, None, False
    for k, (x, y) in list(b.j.items()):
        b.j[k] = (gx + (x - gx) * sx, g + (y - g) * sy)


def finish(b, root_local=None, ground=False):
    """Selout + outline, despeckle; returns (rows, root, joints) with root = the body centre or,
    ground=True, the ground point under it (the soles' outline row + 1)."""
    rows = b.cv.finish(outline=True)
    rows = despeckle(rows, '1234567')
    if ground:
        ys = [y for y, r in enumerate(rows) if r.strip('.')]
        root = (b.T((0, 0))[0], max(ys) + 1)
    else:
        root = b.T(root_local or (0.0, 0.0))
    return rows, root, dict(b.j)


def despeckle(rows, letters):
    """Drop lone shading specks: a ramp pixel whose 4 neighbours hold 3 or 4 of one other tone takes
    that tone (the cast sample's clean-up)."""
    out = [list(r) for r in rows]
    h, w = len(rows), len(rows[0])
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            c = rows[y][x]
            if c not in letters:
                continue
            nb = [rows[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            if c in nb:
                continue
            for t in sorted(set(nb)):
                if t in letters and nb.count(t) >= 3:
                    out[y][x] = t
    return [''.join(r) for r in out]


def outline_grid(rows):
    """A small prop grid (feathers, bits) with the one outline around it (no anti-aliasing)."""
    h, w = len(rows) + 2, max(len(r) for r in rows) + 2
    g = [['.'] * w for _ in range(h)]
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch not in '. ':
                g[j + 1][i + 1] = ch
    out = [r[:] for r in g]
    for y in range(h):
        for x in range(w):
            if g[y][x] == '.' and any(0 <= x + dx < w and 0 <= y + dy < h and g[y + dy][x + dx] != '.'
                                      for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out[y][x] = 'K'
    return [''.join(r) for r in out]
