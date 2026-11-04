# From a pose to the baked pictures of the water and air strips. The core's render (tools/art40/
# chars/swan/frames.py) is extended by:
#   - spread wings (wings.py) on a fourth layer 'w': the near wing behind the rider, in front of
#     her body (the rider sits between the wings); the far wing on 'b';
#   - the water line (plan rule 10): rows at or under the surface are repainted in the water ramp
#     (palette.UNDER), the outline there turns navy; foam, a bow wave and the wake on the surface;
#   - splash FX (the shared FX ramp) for the take-off, the splash-down and the honk on the water.
# The game draws a ridden Swan as: the body strip (b + f + w), the rider, the -front strip (layer
# f near the rider without his leg window and without the near wing's pixels), the neck strip.
import math

import art40 as X

from . import palette as WP
from . import wings as WG

S = X.char('swan')
B, F, PO, SP = S.B, S.F, S.PO, S.palette
from importlib import import_module  # noqa: E402

SCanvas = import_module(S.__name__ + '.canvas').SCanvas

# the web trailing behind in flight (the toes back, closed): the core's FOOT table has none; this
# process only (every set bakes in a process of its own)
B.FOOT.setdefault('T', (["....NN",
                         "..NNnN",
                         "NNnnn.",
                         "nnn..."], (5, 0)))

SURFACE = -16                       # the water surface above the feet anchor (SWAN.swimDepth: the float line)
KEEP = set('YyZ') | set(WP.FX)      # hl and fx letters may stand alone


# Under water only the lower leg shows below her belly: the tarsus from the hull's underside (the
# heel hidden in the plumage) to the ankle, and the web. KNEE_S: where it leaves the belly (body
# coordinates, per side); the drawn length follows the ankle (no IK, no knee to flip).
KNEE_S = {'N': (0.0, -11.0), 'F': (-2.0, -11.5)}


def paddle_leg(sw, side, ankle, state, z):
    """A paddling leg under water: the tarsus from the belly to the ankle (swan-local) and the web."""
    near = side == 'N'
    top = sw.T(KNEE_S[side])
    layer = 'f' if near else 'b'
    sw.tube(layer, top, ankle, 0.9, 0.7, SP.RAMP['leg' if near else 'legF'], z, 'leg' + side)
    if state:
        rows, an = B.FOOT[state]
        sw.grid(layer, rows, ankle, an, z + 0.2, 'foot' + side)
    sw.pts['ankle' + side] = ankle
    return ankle


def _draw(P, neck, dy_extra=0.0):
    dy0 = 0.0 if P.get('ground') == 'body' else P.get('dy', 0.0)
    sw = B.Swan(P.get('dx', 0.0), dy0 + dy_extra, P.get('tilt', 0.0), P.get('sy', 1.0))
    sw.afloat = P.get('water') is not None       # on the water the drum rides high (body.drum_s)
    sw.cv['w'] = SCanvas(B.CW, B.CH)
    spread = P.get('wings')
    lift = P.get('lift', 0.0)
    if spread:
        WG.draw(sw, 'b', False, **WG.kw_far(spread))
    else:
        B.far_wing(sw, P.get('farwing', 'arch'), lift)
    g = B.grips(sw)
    feet = {}
    rel = P.get('legs_rel', False)
    if P.get('legs'):
        (fF, sF), (fN, sN) = P['legs']
        feet['F'] = (B.leg(sw, 'F', fF, sF, 1.0, rel=rel), sF)
    if P.get('paddle'):
        (fF, sF), (fN, sN) = P['paddle']
        feet['F'] = (paddle_leg(sw, 'F', fF, sF, 1.0), sF)
    if P.get('tucked'):
        (aF, sF), (aN, sN) = P['tucked']
        if P.get('tucked_local'):
            aF, aN = B.inv_now(sw, aF), B.inv_now(sw, aN)
        feet['F'] = (B.tucked_leg(sw, 'F', aF, sF, z=1.0), sF)
    B.tail(sw, P.get('tail', lift))
    B.body(sw, P.get('puff', 0.0))
    if P.get('legs'):
        feet['N'] = (B.leg(sw, 'N', fN, sN, 3.5, rel=rel), sN)
    if P.get('paddle'):
        feet['N'] = (paddle_leg(sw, 'N', fN, sN, 3.5), sN)
    if P.get('tucked'):
        feet['N'] = (B.tucked_leg(sw, 'N', aN, sN, z=3.6), sN)
    if spread:
        WG.draw(sw, 'w', True, **WG.kw_near(spread))
    else:
        B.near_wing(sw, P.get('wlift', lift), arch=P.get('arch', 0.0), ruffle=P.get('ruffle', 0.0))
    st = B.saddle(sw)
    B.belts(sw)
    dc = B.drum(sw)
    head = None
    if neck:
        nk = P.get('neckpose') or PO.NECK_REST
        kw = dict(face=nk.get('face'), flip=nk.get('flip', False))
        if nk.get('rel'):
            B.neck_rel(sw, nk['c1'], nk['c2'], nk['head'], nk.get('ang', 0.0), **kw)
        else:
            B.neck_head(sw, nk['c1'], nk['c2'], nk['head'], nk.get('ang', 0.0), **kw)
        head = sw.pts['head']
    mz = None
    if P.get('gun') is not None:
        mz = B.barrel(sw, 2, deg=P['gun'])
    rows = sw.finish()
    return sw, rows, st, dc, g, feet, head, mz


def render(P):
    """Draw a pose (the core's pose keys, plus: wings = a spread-wing spec (wings.draw kwargs, far =
    overrides for the far wing), water = the surface y (swan-local) or None, foam / splash = the
    surface FX, neckpose + gun = a riderless picture). Returns the core's picture dict plus 'w'."""
    neck = P.get('gun') is not None
    sw, rows, st, dc, g, feet, head, mz = _draw(P, neck)
    if P.get('ground') == 'body':
        low = F._lowest([rows['b'], rows['f']])
        shift = (B.OY - 1) - low + P.get('dy', 0.0)
        if shift:
            sw, rows, st, dc, g, feet, head, mz = _draw(P, neck, dy_extra=shift)
    pts = {
        'seat': st, 'neck': sw.T(B.NECK_BASE_S), 'hull': sw.T(F.HULL_S), 'smoke': sw.T(F.SMOKE_S),
        'perch': sw.T(F.PERCH_S), 'wake': sw.T(F.WAKE_S),
    }
    m = mz if mz is not None else B.muzzle_at(sw, 2)
    pts['muzzle'] = m
    pts['cannon'] = m
    for side in ('N', 'F'):
        if side in feet:
            (ax, ay), state = feet[side]
            rows_, an = B.FOOT[state] if state else (['.'], (0, 0))
            pts['foot' + side] = (ax + 1, ay + len(rows_) - an[1] - 1)
        else:
            pts['foot' + side] = sw.T(B.HIPS_S[side])
    if head is not None:
        pts['head'] = head
    if 'plant' in P:
        pts['plant'] = (P['plant'], -1)
    joints = {'socket': pts['neck'], 'seat': st, 'drum': dc, 'gripN': g['N'], 'gripF': g['F']}
    for k in ('tail', 'wingF', 'wingN', 'wristN', 'wristF', 'kneeN', 'kneeF', 'ankleN', 'ankleF', 'head'):
        if k in sw.pts:
            joints[k] = sw.pts[k]
    if mz is not None:
        joints['muzzle'] = mz
    return {'rows': rows, 'pts': pts, 'joints': joints, 'smear': bool(P.get('smear')), 'P': P}


# ------------------------------------------------------------------ the water line
def under_water(rows, surface=SURFACE):
    """Repaint every pixel on or under the surface row (swan-local y >= surface) in the water ramp."""
    y0 = B.OY + surface
    out = []
    for y, r in enumerate(rows):
        if y < y0:
            out.append(r)
        else:
            out.append(''.join(WP.UNDER.get(ch, ch) for ch in r))
    return out


def _span(rows, y):
    xs = [x for x, ch in enumerate(rows[y]) if ch != '.'] if 0 <= y < len(rows) else []
    return (min(xs), max(xs)) if xs else None


def foam(rows, k, surface=SURFACE, moving=True, bow=1.0, wake=True, ring=None):
    """The surface FX round her hull (FX letters, no outline): a foam line at the hull's ends on
    the surface row, a bow wave at the breast (bow = its size), two wake dashes that drift back
    (k = the frame of the cycle: the dashes move 2 px a frame), ripple rings when still."""
    g = [list(r) for r in rows]
    y = B.OY + surface - 1                       # the row on top of the water
    sp = _span(rows, y + 1)
    if sp is None:
        return rows
    x0, x1 = sp
    W = len(g[0])

    def put(x, yy, ch):
        if 0 <= yy < len(g) and 0 <= x < W and g[yy][x] == '.':
            g[yy][x] = ch
    for d in (1, 2):
        put(x0 - d, y, 'c' if d == 1 else 'd')
        put(x1 + d, y, 'c' if d == 1 else 'd')
    if bow > 0:
        n = int(round(2 + 2 * bow))
        for i in range(n):
            put(x1 + 1 + i, y, 'c' if i < n - 1 else 'e')
        put(x1 + 1, y - 1, 'c')
        if bow >= 1.0:
            put(x1 + 2, y - 1, 'd')
            put(x1 + 2, y - 2, 'e' if k % 2 else 'd')
    if wake:
        for j, (off, n) in enumerate(((5, 4), (14, 3), (22, 2))):
            o = off + (2 * k) % 8 if moving else off
            for i in range(n):
                put(x0 - o - i, y, 'c' if i == 0 and j == 0 else 'd' if i < 2 else 'e')
    if ring is not None:
        # still water: a ripple ring that spreads out from her hull and fades (ring = its age)
        d = 2 + 3 * (ring % 4)
        ch = 'd' if ring % 4 < 2 else 'e'
        for x in (x0 - d, x0 - d - 1, x1 + d, x1 + d + 1):
            put(x, y + 1, ch)
    return [''.join(r) for r in g]


def splash(rows, at_x, size, k, surface=SURFACE):
    """A splash crown on the surface at swan-local x (the take-off, the splash-down): drops thrown
    up and out in two fans, size 0..1, k = its age (0 rising, 1 at the top, 2 falling)."""
    g = [list(r) for r in rows]
    W = len(g[0])
    y0 = B.OY + surface - 1
    cx = B.OX + at_x

    def put(x, yy, ch):
        x, yy = int(round(x)), int(round(yy))
        if 0 <= yy < len(g) and 0 <= x < W and g[yy][x] == '.':
            g[yy][x] = ch
    h = [4, 7, 5][min(k, 2)] * size
    for side in (-1, 1):
        for j, ang in enumerate((70, 52, 34)):
            a = math.radians(ang)
            r = h * (1.0 - 0.18 * j) / max(0.3, math.sin(a))
            for t in range(int(r) + 1):
                xx = cx + side * (4 + t * math.cos(a) * 0.9)
                yy = y0 - t * math.sin(a) + (t * t * 0.06 if k >= 2 else 0)
                ch = 'c' if t < r * 0.5 else 'd' if t < r * 0.8 else 'e'
                if k >= 2 and t % 2:
                    continue
                put(xx, yy, ch)
    for x in range(int(cx - 8 * size - 3), int(cx + 8 * size + 4)):
        put(x, y0, 'c' if (x + k) % 3 else 'd')
    return [''.join(r) for r in g]


# ------------------------------------------------------------------ composition
def clean_orphans(rows, drop=False):
    """The core's clean-up (frames.clean_orphans) with this set's fx letters kept."""
    g = [list(r) for r in rows]
    H, W = len(g), max((len(r) for r in g), default=0)
    for r in g:
        r.extend('.' * (W - len(r)))
    at = lambda x, y: g[y][x] if 0 <= x < W and 0 <= y < H else '.'
    for _ in range(4):
        changed = False
        for y in range(H):
            for x in range(W):
                ch = g[y][x]
                if ch == '.' or ch in KEEP:
                    continue
                if all(at(x + dx, y + dy) != '.' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    continue
                nb = [at(x + dx, y + dy) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dx or dy]
                if ch in nb:
                    continue
                opaque = [c for c in nb if c != '.' and c not in KEEP]
                if drop or ch in 'KE' or not opaque:
                    g[y][x] = '.'
                else:
                    g[y][x] = max(sorted(set(opaque)), key=opaque.count)
                changed = True
        if not changed:
            break
    return [''.join(r) for r in g]


def _canvas(p):
    return (B.OX + p[0], B.OY + p[1])


def frame_of(rows, r, pts, drop=False):
    P = {k: _canvas(v) for k, v in pts.items()}
    J = {k: _canvas(v) for k, v in r['joints'].items()}
    return X.Frame(clean_orphans(rows, drop), (B.OX, B.OY), pts=P, smear=r['smear'], joints=J)


def _surface_fx(rows, r, k):
    P = r['P']
    if P.get('water') is None:
        return rows
    rows = under_water(rows, P['water'])
    fo = P.get('foam')
    if fo is not None:
        rows = foam(rows, k, P['water'], **fo)
    for sp in P.get('splash', ()):
        rows = splash(rows, sp[0], sp[1], sp[2], P['water'])
    return rows


def body_frame(r, k=0, contained=False, **kw):
    """The body strip's picture: b + f + w (+ n when the neck and the gun are in the picture), the
    water line and the surface FX."""
    L = r['rows']
    layers = [L['b'], L['f'], L['w']] + ([L['n']] if contained else [])
    rows = _surface_fx(F.overlay(*layers), r, k)
    return frame_of(rows, r, F.game_points(r, **kw))


def front_frame(r, k=0, contained=False, **kw):
    """The -front overlay: layer f inside the rider's box round the seat (core FRONT_BOX), minus his
    leg window and minus the near wing's pixels (the wing lies in front of her body there, behind
    the rider) (+ n on a riderless ridden strip: rise), under water repainted like the body."""
    L = r['rows']
    f = [list(row) for row in L['f']]
    wl = L['w']
    pts = F.game_points(r, **kw)
    sx, sy = (int(math.floor(B.OX + pts['seat'][0] + 0.5)), int(math.floor(B.OY + pts['seat'][1] + 0.5)))
    x0, y0, x1, y1 = sx + F.FRONT_BOX[0], sy + F.FRONT_BOX[1], sx + F.FRONT_BOX[2], sy + F.FRONT_BOX[3]
    for y, row in enumerate(f):
        for x in range(len(row)):
            if not (x0 <= x <= x1 and y0 <= y <= y1) or wl[y][x] != '.':
                row[x] = '.'
    for dx, dy in F.leg_window():
        x, y = sx + dx, sy + dy
        if 0 <= y < len(f) and 0 <= x < len(f[y]):
            f[y][x] = '.'
    rows = [''.join(row) for row in f]
    if contained:
        rows = F.overlay(rows, L['n'])
    if r['P'].get('water') is not None:
        rows = under_water(rows, r['P']['water'])
    return frame_of(rows, r, pts, drop=True)
