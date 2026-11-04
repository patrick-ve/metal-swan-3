# From a pose to the baked pictures: render() draws the three layers, body_frame() and
# front_frame() make the art40.Frames the game draws (plan rule 2 and 3: the feet anchor, every
# point the game reads), leg_window() is the hole in the -front overlays where the rider's near leg
# shows over her flank.
#
# The game draws a ridden Swan in this order (swan.ts draw, look.md section 7):
#   1 the body strip   = layers b + f (+ n on the riderless pictures: neck, head and gun inside)
#   2 the scuffs decal on the 'hull' point
#   3 the rider        ride-<pose> with his hip on the 'seat' point
#   4 the -front strip = layer f near the rider, MINUS the leg window (+ n on a riderless ridden
#                        strip: wreck), so the rider sits IN the saddle behind her near flank
#   5 the neck strip   on the 'neck' socket (stage 2: the free neck and the barrel at the aim)
# Where a rider draws no near leg the window shows the body strip's own flank (the same pixels).
import math

import art40 as X

from . import body as B
from . import poses as PO

# body points of the old rest positions (constants.ts REST: hull, smoke; the perch deck and the
# water wake), mapped back through the rig so they move with her
HULL_S = B.inv((-3, -38))
SMOKE_S = B.inv((-20, -50))
PERCH_S = B.inv((-26, -48))
WAKE_S = B.inv((-27, -34))
BUBBLE_UP = 9                     # the RIDE? bubble's tail tip: 8 px above the pad (BUBBLE_TIP)
EGG_POINT = (-30, 0)              # constants.ts EGG_POINT: where the nervous egg lands
CROUCH_SEAT_DY = 4                # the rider lies 4 px deeper in the crouch strips (CROUCH_STRIPS)


def _lowest(rows_by_layer):
    low = None
    for rows in rows_by_layer:
        for y in range(len(rows) - 1, -1, -1):
            if rows[y].strip('.'):
                low = y if low is None else max(low, y)
                break
    return low


def _draw(P, aim, kick, neck, dy_extra=0.0):
    # ground='body': dy is added after the floor contact (render), so a breath or a strain lifts her
    dy0 = 0.0 if P.get('ground') == 'body' else P.get('dy', 0.0)
    sw = B.Swan(P.get('dx', 0.0), dy0 + dy_extra, P.get('tilt', 0.0), P.get('sy', 1.0))
    if 'air' in P:                # airborne: the body centre at this height
        sw.dy = P['air'] - (B.PIVOT[1] - B.LIFT) + dy_extra
    lift = P.get('lift', 0.0)
    B.far_wing(sw, P.get('farwing', 'arch'), lift)
    g = B.grips(sw)
    feet = {}
    rel = P.get('legs_rel', False)
    if P.get('legs'):
        (fF, sF), (fN, sN) = P['legs']
        feet['F'] = (B.leg(sw, 'F', fF, sF, 1.0, rel=rel), sF)
    if P.get('tucked'):
        (aF, sF), (aN, sN) = P['tucked']
        if P.get('tucked_local'):      # the webs given swan-local (planted on the floor)
            aF, aN = B.inv_now(sw, aF), B.inv_now(sw, aN)
        feet['F'] = (B.tucked_leg(sw, 'F', aF, sF, z=1.0), sF)
    B.tail(sw, P.get('tail', lift))
    B.body(sw, P.get('puff', 0.0))
    if P.get('legs'):
        feet['N'] = (B.leg(sw, 'N', fN, sN, 3.5, rel=rel), sN)
    if P.get('tucked'):
        feet['N'] = (B.tucked_leg(sw, 'N', aN, sN, z=3.6), sN)
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
        mz = B.barrel(sw, 2, kick=kick, deg=P['gun'])
    elif aim is not None:
        mz = B.barrel(sw, aim, kick=kick)
    if P.get('speed'):
        speed_lines(sw)
    rows = sw.finish()
    return sw, rows, st, dc, g, feet, head, mz


def speed_lines(sw):
    """Three speed streaks behind her (the fast frames: the bash, the tumble's first roll): FX
    letters, no outline, on the layer behind the rider."""
    cv = sw.cv['b']
    for k, (bx, by, n) in enumerate(((-24, -24.5, 9), (-25, -18.5, 12), (-22, -13, 7))):
        p = sw.T((bx, by))
        x, y = int(math.floor(B.OX + p[0] + 0.5)), int(math.floor(B.OY + p[1] + 0.5))
        for i in range(n):
            cv.px(x - 3 - i, y, 'c' if i < n // 2 else 'd', 0.5, 'fx')


def render(P, aim=None, kick=0.0, neck=None):
    """Draw a pose (poses.py keys). Returns {'rows': {'b','f','n'}, 'pts', 'joints'} with the
    points and joints swan-local. ground='body' poses are lowered or raised until the lowest pixel
    (the outline under her belly or her back) is the floor row y = -1."""
    if neck is None:
        neck = P.get('gun') is not None
    sw, rows, st, dc, g, feet, head, mz = _draw(P, aim, kick, neck)
    if P.get('ground') == 'body':
        # the body and the legs touch the floor; the neck is placed by its own pose (a head may
        # rest on the floor beside her)
        low = _lowest([rows['b'], rows['f']])
        shift = (B.OY - 1) - low + P.get('dy', 0.0)
        if shift:
            sw, rows, st, dc, g, feet, head, mz = _draw(P, aim, kick, neck, dy_extra=shift)
    pts = {
        'seat': st, 'neck': sw.T(B.NECK_BASE_S), 'hull': sw.T(HULL_S), 'smoke': sw.T(SMOKE_S),
        'perch': sw.T(PERCH_S), 'wake': sw.T(WAKE_S),
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
    for k in ('tail', 'wingF', 'wingN', 'kneeN', 'kneeF', 'ankleN', 'ankleF', 'head'):
        if k in sw.pts:
            joints[k] = sw.pts[k]
    if mz is not None:
        joints['muzzle'] = mz
    return {'rows': rows, 'pts': pts, 'joints': joints, 'smear': bool(P.get('smear')), 'rider': P.get('rider'),
            'water': P.get('water')}


# ------------------------------------------------------------------ composition
def overlay(*layers):
    out = [list(r) for r in layers[0]]
    for rows in layers[1:]:
        for y, r in enumerate(rows):
            o = out[y]
            for x, ch in enumerate(r):
                if ch != '.':
                    o[x] = ch
    return [''.join(r) for r in out]


def _canvas(p):
    return (B.OX + p[0], B.OY + p[1])


KEEP = set('YyZ') | set('abcd')      # hl and fx letters may stand alone (the check exempts them)


def clean_orphans(rows, drop=False):
    """Remove the edge orphans the art40 check fails on (an edge pixel with no 8-neighbour of its
    own colour): a stray outline pixel goes; another colour takes its commonest neighbour (or goes
    when drop: the -front overlays, where the body strip below shows the same pixels)."""
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
                if drop or ch == 'K' or not opaque:
                    g[y][x] = '.'
                else:
                    g[y][x] = max(sorted(set(opaque)), key=opaque.count)
                changed = True
        if not changed:
            break
    return [''.join(r) for r in g]


def frame_of(rows, r, pts, drop=False):
    """art40.Frame: rows in canvas coordinates, the feet anchor (OX, OY), points and joints moved
    to canvas coordinates (the bake makes them relative to the anchor)."""
    P = {k: _canvas(v) for k, v in pts.items()}
    J = {k: _canvas(v) for k, v in r['joints'].items()}
    return X.Frame(clean_orphans(rows, drop), (B.OX, B.OY), pts=P, smear=r['smear'], joints=J)


def game_points(r, seat_dy=0, bubble=False, egg=False):
    pts = dict(r['pts'])
    if seat_dy:
        s = pts['seat']
        pts['seat'] = (s[0], s[1] + seat_dy)
    if bubble:
        s = r['pts']['seat']
        pts['bubble'] = (s[0], s[1] - BUBBLE_UP)
    if egg:
        pts['egg'] = EGG_POINT
    return pts


def body_frame(r, contained=False, **kw):
    """The body strip's picture: b + f (+ n when the neck and gun are in the picture)."""
    L = r['rows']
    rows = overlay(L['b'], L['f'], L['n']) if contained else overlay(L['b'], L['f'])
    return frame_of(rows, r, game_points(r, **kw))


# ------------------------------------------------------------------ the -front overlay
_WINDOW = None
# The rider's box round the seat (dx0, dy0, dx1, dy1): the front overlay is layer f where the
# rider's hips and torso can be (the saddle, the back line). Below it the rider's near leg is drawn
# over the body strip (the look's rider_leg over the flank and the drum) and the scuffs decal stays
# visible on the hull.
FRONT_BOX = (-12, -34, 12, 4)


def leg_window():
    """The cells (dx, dy) relative to the seat where a rider's near leg shows over her flank: the
    kit lower body's near leg (the wave 1 look's rider_leg: the thigh forward over the saddle flap,
    the knee over the drum, the boot below it) with a few ankle positions, grown by one pixel.
    Stage 2's riders draw their near leg inside it."""
    global _WINDOW
    if _WINDOW is not None:
        return _WINDOW
    import hero
    import pose
    import anims as A
    hero.load('vincent', only=['ride'])
    cells = set()
    for ank in ((-2, -5), (-1, -5), (-3, -6), (0, -4)):
        lo = A.legs((0, -17), ank, ank, 'hang', 'hang', -1, -1)
        rows = pose.compose(lo, 'lower')[0]
        px, py = pose.RX, pose.RY - 17
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch != '.':
                    cells.add((x - px, y - py))
    grown = set(cells)
    for (x, y) in cells:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            grown.add((x + dx, y + dy))
    # only below the hip line: above it the rider's own torso covers the saddle
    _WINDOW = sorted(c for c in grown if c[1] >= -1)
    return _WINDOW


def front_frame(r, contained=False, **kw):
    """The -front overlay: layer f inside the rider's box round the seat, with the leg window cut
    out (+ layer n on a riderless ridden strip: wreck)."""
    L = r['rows']
    f = [list(row) for row in L['f']]
    pts = game_points(r, **kw)
    sx, sy = (int(math.floor(B.OX + pts['seat'][0] + 0.5)), int(math.floor(B.OY + pts['seat'][1] + 0.5)))
    x0, y0, x1, y1 = sx + FRONT_BOX[0], sy + FRONT_BOX[1], sx + FRONT_BOX[2], sy + FRONT_BOX[3]
    for y, row in enumerate(f):
        for x in range(len(row)):
            if not (x0 <= x <= x1 and y0 <= y <= y1):
                row[x] = '.'
    for dx, dy in leg_window():
        x, y = sx + dx, sy + dy
        if 0 <= y < len(f) and 0 <= x < len(f[y]):
            f[y][x] = '.'
    rows = [''.join(row) for row in f]
    if contained:
        rows = overlay(rows, L['n'])
    return frame_of(rows, r, pts, drop=True)
