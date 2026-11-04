# The Swan's rig at 40 px: a natural mute swan built from the squad spike's ridden swan
# (kit ext_ride_swan: the pillow-shaded hull, the feather wings, the folded near wing), made tall
# enough for the game's Swan contract: the body is lifted on long running legs so the rider's hip
# (the 'seat' point) stays where the game reads it (about (-4, -48) from the feet anchor) and the
# hurtboxes of plan D7 still cover her.
#
# Coordinates: swan-local, x forward, y down, (0, 0) = the feet anchor (the line under the soles).
# Body-attached points are given in the spike's body coordinates and mapped by Swan.T (tilt about
# the spike's PIVOT, the body stretched SY in height, lifted LIFT, then the pose offset).
#
# Three layers, each finished on its own canvas (selout + the one outline), like the game's sprites:
#   'b'  behind the rider: the far wing, the far leg, the two grips on their posts
#   'f'  in front of the rider: the near leg, the tail, the body, the near wing, the saddle cloth,
#        the saddle, the two belts with buckles, the steel drum
#   'n'  the neck strip: the leather collar, the neck, the head and the barrel (the 9 aim angles)
import math
import rig
import ext_ride_swan as SW
from rig import LIGHT3, ik, rotsprite
from .canvas import SCanvas
from . import palette as SP

CW, CH = 132, 118
OX, OY = 62, 108                  # the feet anchor on the canvas
PIVOT = SW.PIVOT                  # (-2, -19) in spike body coordinates
SX, SY = 1.15, 1.5                # the body is longer and deeper than the spike's (a big mount bird)
LIFT = 29.0 - 7.0 * SY            # ... and sits on long legs: the seat stays at y = -48 (the contract)
SEAT_S = SW.SEAT                  # (-3, -26): the rider's hip (spike body coordinates)
NECK_BASE_S = (14, -22.5)
HIPS_S = {'N': (-1, -14), 'F': (-3, -15)}
LEG = (16.0, 16.0)                # the black legs: tibia, tarsus (the ankle bends backward)
DRUM_S = (4.0, -12.0)             # the steel drum low on the near flank, under the rider's knee: standing,
                                  # its hub (5, -27) keeps the level shot inside the 30 px hurtboxes (D7)
DRUM_S_LOW = (4.0, -18.0)         # ... drawn up against the flank when she sits low (sy 0.74: crouch, parked)
DRUM_R = 6.2
BELTS_S = (-2.0, 9.6)             # the two belts round her body (spike x), over the drum's rims
GRIP_N, GRIP_F = SW.GRIP_N, SW.GRIP_F   # the grips relative to the seat: the rider poses close on them
CUT = (0.55, 0.12, -0.25)


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def inv_now(sw, q):
    return sw.Tinv(q)


def inv(p):
    """The body point under the swan-local point p at rest (no tilt, no squash, no offset)."""
    return ((p[0] - PIVOT[0]) / SX + PIVOT[0], (p[1] + LIFT - PIVOT[1]) / SY + PIVOT[1])


class Swan:
    """One Swan picture under construction: three layer canvases ('b' behind the rider, 'f' in front
    of him, 'n' the neck and the gun) and the body transform: tilt (degrees, + = clockwise on
    screen, about the body centre), squash sy (the body pressed flat: crouch, sitting) and the
    offset (dx, dy) in swan-local pixels."""

    def __init__(s, dx=0.0, dy=0.0, tilt=0.0, sy=1.0):
        s.cv = {k: SCanvas(CW, CH) for k in 'bfn'}
        s.dx, s.dy = dx, dy
        s.tilt = tilt
        a = math.radians(tilt)
        s.ca, s.sa = math.cos(a), math.sin(a)
        s.sy = sy
        s.pts = {}

    # ---------------------------------------------------------------- coordinates
    def T(s, p):
        """A body point (the spike's body coordinates) -> swan-local (x forward, y down, feet anchor 0, 0)."""
        x, y = (p[0] - PIVOT[0]) * SX, (p[1] - PIVOT[1]) * SY * s.sy
        rx, ry = x * s.ca - y * s.sa, x * s.sa + y * s.ca
        return (PIVOT[0] + rx + s.dx, PIVOT[1] + ry - LIFT + s.dy)

    def Tinv(s, q):
        """The body point that T maps to the swan-local point q (this pose's transform)."""
        x, y = q[0] - PIVOT[0] - s.dx, q[1] - PIVOT[1] + LIFT - s.dy
        rx, ry = x * s.ca + y * s.sa, -x * s.sa + y * s.ca
        return (rx / SX + PIVOT[0], ry / (SY * s.sy) + PIVOT[1])

    def V(s, v):
        """A vector in the body frame (swan-local units, unsquashed) turned with the body."""
        return (v[0] * s.ca - v[1] * s.sa, v[0] * s.sa + v[1] * s.ca)

    def R(s, origin, v):
        """origin + V(v): a point given relative to a body point, turned with the body."""
        w = s.V(v)
        return (origin[0] + w[0], origin[1] + w[1])

    @staticmethod
    def C(p):
        return (OX + p[0], OY + p[1])

    # ---------------------------------------------------------------- drawing primitives
    def poly(s, layer, pts, ramp, z, part, R=4.0, cut=CUT, lift=0.0):
        """A pillow-shaded polygon (swan-local points, already mapped)."""
        cv = s.cv[layer]
        cp = [s.C(p) for p in pts]
        xs, ys = [p[0] for p in cp], [p[1] for p in cp]
        lx, ly, lz = LIGHT3
        for y in range(int(math.floor(min(ys))), int(math.ceil(max(ys))) + 1):
            for x in range(int(math.floor(min(xs))), int(math.ceil(max(xs))) + 1):
                if not SW.inside(cp, x, y):
                    continue
                d, (nx, ny) = SW.edge_info(cp, x, y)
                k = max(0.0, 1 - d / R)
                nx, ny = nx * k, ny * k
                nz = math.sqrt(max(0.0, 1 - nx * nx - ny * ny))
                l = nx * lx + ny * ly + nz * lz + lift
                t = 0 if l > cut[0] else 1 if l > cut[1] else 2 if l > cut[2] else 3
                cv.px(x, y, ramp[t], z, part, proc=True)

    def flat(s, layer, pts, ch, z, part):
        cv = s.cv[layer]
        cp = [s.C(p) for p in pts]
        xs, ys = [p[0] for p in cp], [p[1] for p in cp]
        for y in range(int(math.floor(min(ys))), int(math.ceil(max(ys))) + 1):
            for x in range(int(math.floor(min(xs))), int(math.ceil(max(xs))) + 1):
                if SW.inside(cp, x, y):
                    cv.px(x, y, ch, z, part)

    def tube(s, layer, a, b, ra, rb, ramp, z, part, cut=CUT, pat=None):
        s.cv[layer].tube(s.C(a), s.C(b), ra, rb, ramp, z, part, cut=cut, pat=pat)

    def dot(s, layer, p, ch, z, part):
        c = s.C(p)
        s.cv[layer].px(int(math.floor(c[0] + 0.5)), int(math.floor(c[1] + 0.5)), ch, z, part)

    def grid(s, layer, rows, at, anchor, z, part):
        c = s.C(at)
        s.cv[layer].grid(int(math.floor(c[0] - anchor[0] + 0.5)), int(math.floor(c[1] - anchor[1] + 0.5)), rows, z, part)

    def finish(s):
        return {k: cv.finish() for k, cv in s.cv.items()}


# ------------------------------------------------------------------ the body
HULL = [(-20, -25.5), (-14, -26), (-8, -25.5), (4, -25.5), (9, -25.5), (12.5, -25), (16, -23), (18.5, -20.5),
        (19.5, -17), (18.5, -13.5), (15, -11.2), (9, -10.2), (0, -10.0), (-8, -10.6), (-13, -12), (-17, -14),
        (-20, -16.5), (-22, -19.5), (-23, -23), (-22, -25)]
# wave 1 verify: the breast rounds forward into the neck root and the underside is boat-shaped
# (it rises to the tail), so the body no longer reads as a box


def body(sw, puff=0.0, z=3.0):
    pts = []
    for (x, y) in HULL:
        if x >= 14 and -22 <= y <= -12:
            x += puff
        pts.append(sw.T((x, y)))
    sw.poly('f', pts, SP.RAMP['white'], z, 'body', R=7.0)
    # the breast feathers: a soft scallop line, and the belly line (one tone darker)
    for (x, y) in [(15.5, -20.5), (16.5, -18.5), (17, -16.5), (16.5, -14.5), (15, -12.8)]:
        sw.dot('f', sw.T((x + puff * 0.7, y)), 'v', z + 0.05, 'body')
    for x in range(-12, 10, 3):
        sw.dot('f', sw.T((x, -11.6)), 'v', z + 0.05, 'body')


def tail(sw, lift=0.0, z=2.0):
    base = (-19, -24)
    for i, tp in enumerate([(-29, -30.5 - lift), (-30.5, -27.5 - lift * 0.8), (-29, -24.5 - lift * 0.6)]):
        sw.poly('f', [sw.T(p) for p in SW.feather(base, tp, 2.3)], SP.RAMP['white'], z + 0.02 * i, f'tail{i}', R=1.8)
    sw.pts['tail'] = sw.T((-30.5, -27.5 - lift * 0.8))


# black webbed feet (anchor = the ankle); the toes point forward (right)
FOOT = {
    'S': (["..NN.......",
           ".NnnN......",
           ".nnnnNN....",
           "NnnnnnnNNN.",
           "nnNnnNnnnnN"], (3, 0)),         # spread flat on the ground
    'P': (["N......",
           "nN.....",
           "nnN....",
           "nnnNN..",
           ".nnnnNN",
           "..nnnnn"], (0, 0)),              # pushing off the toes
    'F': (["NN..",
           "nnN.",
           "nnnN",
           ".nnn",
           ".nn.",
           "..n."], (1, 0)),                 # folded, lifted (the web closed)
    'U': (["........N",
           "......NNn",
           "....NNnnn",
           "NNNNnnnn.",
           "nnnnnn...",
           ".nn......"], (1, 2)),            # toes up: the heel strike
}


# vertical mirrors for the feet of a swan on her back or in a tumble (the toes still point forward)
for _k in list(FOOT):
    _rows, (_ax, _ay) = FOOT[_k]
    FOOT[_k + 'v'] = (list(reversed(_rows)), (_ax, len(_rows) - 1 - _ay))
# dangling: the web hangs from the ankle, the toes down and forward (a jump, a fall)
FOOT['D'] = (["NN...",
              "nnN..",
              ".nnN.",
              ".nnnN",
              "..nnn",
              "...n."], (1, 0))


def leg(sw, side, foot, state, z, rel=False, bend=None):
    """A long black running leg: the feathered 'trousers' at the hip, the tibia, the ankle that
    bends backward, the tarsus, the webbed foot. foot = the ankle target (swan-local, or a body
    point when rel). Returns the ankle (swan-local)."""
    hip = sw.T(HIPS_S[side])
    if rel:
        foot = sw.T(foot)
    if bend is None:
        knee, end = ik(hip, foot, LEG[0], LEG[1], -1)
        if knee[0] > hip[0] and knee[0] > end[0]:
            knee, end = ik(hip, foot, LEG[0], LEG[1], 1)
    else:
        knee, end = ik(hip, foot, LEG[0], LEG[1], bend)
    near = side == 'N'
    ramp = SP.RAMP['leg' if near else 'legF']
    layer = 'f' if near else 'b'
    sw.tube(layer, hip, knee, 1.25, 0.85, ramp, z, 'leg' + side)
    sw.tube(layer, knee, end, 0.85, 0.7, ramp, z + 0.1, 'leg' + side)
    # the feathered thigh over the top of the tibia (white, or the far side's grey)
    th = lerp(hip, knee, 0.3)
    top = sw.R(hip, (0.5, -1.5))
    sw.tube(layer, top, th, 3.0, 1.8, SP.RAMP['white' if near else 'far'], z + 0.15, 'thigh' + side)
    if state:
        rows, an = FOOT[state]
        sw.grid(layer, rows, end, an, z + 0.2, 'foot' + side)
    sw.pts['ankle' + side] = end
    sw.pts['knee' + side] = knee
    return end


def tucked_leg(sw, side, at, state='F', z=None):
    """A leg folded under the body (sitting, crouching): only the web peeks out under the belly at
    `at` (a body point)."""
    near = side == 'N'
    layer = 'f' if near else 'b'
    rows, an = FOOT[state]
    p = sw.T(at)
    sw.grid(layer, rows, p, an, (3.5 if near else 1.0) if z is None else z, 'foot' + side)
    sw.pts['ankle' + side] = p
    return p


# ------------------------------------------------------------------ wings (the spike's feather wings)
def plume_wing(sw, layer, sh, wr, tip, trail, z, name, n_prim=4, spread=3.0, sec=5, cov=0.6, w=3.0):
    """The far wing in clean feather groups (wave 1 verify: the kit wing's many small pillow-shaded
    feathers read as a grid of grey dashes at this size). Three groups, each a flat 2-3 tone ramp:
    - the secondaries: ONE part (no lines between them), a single mid tone with a lit top band;
      their tips make the scalloped trailing edge;
    - the primaries: separate, darker feathers fanned at the tip (the outline separates them);
    - the coverts: a lit plate over the roots with a soft lower edge (pillow shaded).
    Swan-body points like the kit's wing (sh, wr, tip; trail is a vector)."""
    T = sw.T
    sh, wr, tip = T(sh), T(wr), T(tip)
    tv = (trail[0] * sw.ca - trail[1] * sw.sa, trail[0] * sw.sa + trail[1] * sw.ca)
    dx, dy = tip[0] - wr[0], tip[1] - wr[1]
    L = math.hypot(dx, dy) or 1e-9
    px, py = -dy / L, dx / L
    if px * tv[0] + py * tv[1] < 0:
        px, py = -px, -py
    # primaries: back to front, each one tone darker toward the tip of the fan
    for i in range(n_prim):
        f = i - (n_prim - 1) * 0.15
        t = (spread * f) / max(1, n_prim - 1) * 2
        root = lerp(wr, sh, 0.14 * i)
        tp = (tip[0] + px * t - dx / L * i * 1.4, tip[1] + py * t - dy / L * i * 1.4)
        sw.flat(layer, SW.feather(root, tp, w * 0.9), 'u' if i < 2 else 'v', z + 0.01 * (n_prim - i), f'{name}p{i}')
    # secondaries: one part, mid tone, the scallops on the trailing edge
    for i in range(sec):
        t = (i + 0.5) / sec
        root = lerp(sh, wr, t)
        k = 0.95 + 0.2 * t
        tp = (root[0] + tv[0] * k, root[1] + tv[1] * k)
        sw.flat(layer, SW.feather(root, tp, w), 'v', z + 0.1, f'{name}s')
    # coverts: the lit plate on the arm
    a1 = (sh[0] + tv[0] * cov, sh[1] + tv[1] * cov)
    a2 = (wr[0] + tv[0] * cov * 0.8, wr[1] + tv[1] * cov * 0.8)
    m = lerp(sh, wr, 0.5)
    nv = math.hypot(*tv) or 1e-9
    up = (-tv[0] / nv * 1.6, -tv[1] / nv * 1.6)
    mid = lerp(a1, a2, 0.5)
    pts = [(sh[0] + up[0], sh[1] + up[1]), (m[0] + up[0] * 1.3, m[1] + up[1] * 1.3), (wr[0] + up[0], wr[1] + up[1]),
           (wr[0] + dx / L * 2.5, wr[1] + dy / L * 2.5), a2, (mid[0] + tv[0] * 0.12, mid[1] + tv[1] * 0.12), a1]
    sw.poly(layer, pts, ['w', 'w', 'v', 'u'], z + 0.3, f'{name}c', R=2.5)


FAR_WINGS = {
    # kind: (shoulder, wrist, tip, trail, options) in body coordinates; lift raises wrist and tip
    'arch': ((4, -25), (-10, -31), (-29, -33.5), (1, 5), dict(spread=2.6, cov=0.6)),
    'half': ((9, -25), (-5, -35), (-26, -39), (-1, 5), dict(n_prim=4, spread=4.0, w=2.8)),
    'busk': ((9, -25), (-4, -37), (-25, -37), (0, 6), dict(n_prim=4, spread=3.5, cov=0.8, w=2.8)),
    # the far wing raised high (the honk's flare, the shake): the hand up over the back
    'raise': ((9, -25), (0, -40), (-14, -52), (-4, 5), dict(n_prim=5, spread=4.5, w=2.8)),
    # folded flat on the back (sitting, crouching): a sliver of the far wing over the back line
    'fold': ((4, -24), (-12, -27), (-29, -28.5), (1, 3), dict(n_prim=3, spread=1.6, sec=4, cov=0.5, w=2.4)),
    # flung open forward (the bash, the tumble): the primaries splayed
    'fling': ((9, -25), (4, -35), (-8, -43), (-4, 4), dict(n_prim=5, spread=5.0, w=2.8)),
}


def _mixw(a, b, t):
    """A far wing between two kinds (t 0 -> a, 1 -> b): the joints glide, so a wing that climbs
    from the busking arch to the flare moves smoothly frame to frame."""
    A, Bk = FAR_WINGS[a], FAR_WINGS[b]
    m = lambda p, q: (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)
    kw = dict(A[4])
    for k, v in Bk[4].items():
        if isinstance(v, float) and k in kw:
            kw[k] = kw[k] + (v - kw[k]) * t
    return m(A[0], Bk[0]), m(A[1], Bk[1]), m(A[2], Bk[2]), m(A[3], Bk[3]), kw


def far_wing(sw, kind, lift=0.0):
    """kind: a FAR_WINGS key, or (a, b, t): the wing between two kinds."""
    if not kind:
        return
    if isinstance(kind, tuple):
        sh, wr, tip, trail, kw = _mixw(*kind)
        kind = kind[0] if kind[2] < 0.5 else kind[1]
    else:
        sh, wr, tip, trail, kw = FAR_WINGS[kind]
    k = {'arch': 1.0, 'half': 1.4, 'busk': 1.0}.get(kind, 1.0)
    plume_wing(sw, 'b', sh, (wr[0], wr[1] - lift), (tip[0], tip[1] - lift * k), trail, 1.0, 'wf', **kw)
    sw.pts['wingF'] = sw.T((tip[0], tip[1] - lift * k))


def near_wing(sw, lift=0.0, z=6.0, arch=0.0, ruffle=0.0):
    """The near wing folded on the flank (the kit's folded wing with a rounder coverts plate: wave 1
    verify, the kit's straight-edged plate framed the drum like an armour panel): the primaries and
    tertials cross over the tail, the coverts plate has a rounded front and a scalloped lower edge.
    arch lifts the wing off the back (the busking threat display: hiss, honk); ruffle fans the
    feather tips apart (the shake)."""
    T = sw.T
    ramp = SP.RAMP['white']
    a = arch
    tips = [(-28, -23 - lift - a * 1.6), (-27, -20.5 - lift * 0.8 - a * 1.2 + ruffle * 1.5),
            (-25, -18 - lift * 0.6 - a * 0.8 + ruffle * 3.0), (-21.5, -16 - lift * 0.4 - a * 0.5 + ruffle * 4.0)]
    roots = [(4, -23 - a * 0.3), (2, -21 - a * 0.3), (0, -19 - a * 0.2), (-2, -17.5)]
    for i, (r, t) in enumerate(zip(roots, tips)):
        sw.poly('f', [T(p) for p in SW.feather(r, t, 2.6)], ramp, z + 0.02 * i, f'wnp{i}', R=1.6, lift=0.25)
    ter = [((-2, -25 - a * 0.4), (-20, -25.5 - lift - a * 1.4 - ruffle)), ((-1, -23.5 - a * 0.3), (-18, -22 - lift * 0.8 - a)),
           ((0, -22 - a * 0.2), (-15, -19 - lift * 0.5 - a * 0.6 + ruffle * 2))]
    for i, (r, t) in enumerate(ter):
        sw.poly('f', [T(p) for p in SW.feather(r, t, 2.4)], ramp, z + 0.2 + 0.02 * i, f'wnt{i}', R=1.6, lift=0.25)
    cov = [(12.5, -21), (11, -23.5 - a * 0.3), (7, -25 - a * 0.6), (-6, -25.2 - a), (-11, -24 - lift * 0.3 - a), (-12.5, -22 - lift * 0.3 - a * 0.6),
           (-9, -19.6), (-5, -18.6), (-1, -17.6), (3, -18.2), (7, -17.8), (10.5, -19)]
    sw.poly('f', [T(p) for p in cov], ramp, z + 0.5, 'wnc', R=3.0, lift=0.15)
    sw.pts['wingN'] = T(tips[0])


# ------------------------------------------------------------------ the tack
def seat(sw):
    return sw.T(SEAT_S)


def grips(sw):
    """Two leather grips on short steel posts in front of the seat (behind the rider: his fists
    close over them). The far one is one shade darker."""
    st = seat(sw)
    out = {}
    for side, g, z, ramp in (('F', GRIP_F, 1.0, 'm'), ('N', GRIP_N, 1.5, 'l')):
        gx, gy = st[0] + g[0], st[1] + g[1]
        out[side] = (gx, gy)
        base_y = sw.T((SEAT_S[0] + g[0], -25.0))[1]
        y = gy + 2
        while y <= base_y + 0.5:
            sw.dot('b', (gx, y), 'G' if side == 'N' else 'h', z, 'post' + side)
            y += 1
        for k in range(-2, 2):
            sw.dot('b', (gx, gy + k), ramp, z + 0.1, 'grip' + side)
            sw.dot('b', (gx + 1, gy + k), 'M' if side == 'F' else 'm', z + 0.1, 'grip' + side)
        sw.dot('b', (gx, gy - 2), 'Y' if side == 'N' else 'y', z + 0.1, 'grip' + side)
    return out


def saddle(sw):
    """A small leather saddle on the base of the neck's back line: a red cloth with a dark trim
    under it, a raised cantle behind the rider and a pommel in front (the grip posts stand on it)."""
    st = seat(sw)
    sx, sy = st
    t = lambda pts: [(sx + a, sy + b) for a, b in pts]
    # the saddle cloth on the flank (behind the drum)
    cloth = t([(-10, 0), (6, 0), (7, 4), (6, 9), (-9, 9), (-11, 4)])
    sw.poly('f', cloth, SP.RAMP['cloth'], 7.0, 'cloth', R=2.0)
    for a in range(-9, 7):
        sw.dot('f', (sx + a, sy + 9), 'x', 7.05, 'cloth')
    for a in range(-8, 6, 2):
        sw.dot('f', (sx + a, sy + 8), 'r', 7.05, 'cloth')
    # the saddle: seat pad, cantle, pommel, a skirt flap with one stitch row
    pad = t([(-7.5, -1.5), (-6, -2.5), (-5, 1), (4, 1), (5.5, -0.5), (6.5, 1.5), (5, 5.5), (-5.5, 5.5), (-7.5, 2)])
    sw.poly('f', pad, SP.RAMP['leather'], 7.2, 'saddle', R=1.6)
    for a in range(-4, 4, 2):
        sw.dot('f', (sx + a, sy + 4.0), 'm', 7.25, 'saddle')
    return st


def belts(sw):
    """Two leather belts round her body (over the folded wing) with brass buckles at the belly;
    they cross the drum's rims, so the drum reads as strapped on."""
    pts = []
    for i, bx in enumerate(BELTS_S):
        top, bot = sw.T((bx, -25.6)), sw.T((bx + 0.6, -11.0))
        sw.tube('f', top, bot, 1.05, 1.05, SP.RAMP['leather'], 7.5, f'belt{i}')
        b = lerp(top, bot, 0.84)
        sw.grid('f', ["yYy", "y.y", "yZy"], b, (1, 1), 8.6, f'buckle{i}')
        # the belt's tongue end through the buckle
        sw.dot('f', (b[0], b[1] + 2.4), 'm', 8.65, f'buckle{i}')
        pts.append(b)
    return pts


def drum_s(sw):
    """The drum's hub in body coordinates for this pose: low on the flank when she stands (DRUM_S),
    strapped up against the flank as her body squashes down to sit (DRUM_S_LOW at sy 0.74), so a
    crouched or parked Swan rests on her belly, not on the drum. Linear in sy between the two.
    Afloat (sw.afloat: the swim strips and their necks) the drum rides high (DRUM_S_LOW), so the
    gun fires over the water line as the old Swan did."""
    if getattr(sw, 'afloat', False):
        return DRUM_S_LOW      # afloat: strapped high, so the barrel stays over the water line
    t = min(1.0, max(0.0, (sw.sy - 0.74) / 0.26))
    return (DRUM_S_LOW[0] + (DRUM_S[0] - DRUM_S_LOW[0]) * t, DRUM_S_LOW[1] + (DRUM_S[1] - DRUM_S_LOW[1]) * t)


def hub(sw):
    """The drum's hub (swan-local) of this pose: the pivot the barrel turns on."""
    return sw.T(drum_s(sw))


def drum(sw):
    """The round steel drum (the gun's housing) on her near flank: a lit rim (specular top front),
    a dark inner ring, the face, four rivets, the brass hub the barrel turns on."""
    c = hub(sw)
    cx, cy = sw.C(c)
    cv = sw.cv['f']
    R = DRUM_R
    lx, ly = 0.55, -0.83
    for y in range(int(cy - R - 1), int(cy + R + 2)):
        for x in range(int(cx - R - 1), int(cx + R + 2)):
            dx, dy = x - cx, y - cy
            d = math.hypot(dx, dy)
            if d > R:
                continue
            l = (dx * lx + dy * ly) / (d or 1)
            if d > R - 1.0:                      # the dark edge (the drum's own line on the plumage)
                ch = 'G' if l > 0.75 else 'h'
            elif d > R - 2.6:                    # the rim: lit upper front, dark lower back
                ch = 'S' if l > 0.55 else 's' if l > -0.1 else 'g' if l > -0.7 else 'G'
            elif d > R - 3.4 and l < 0.2:        # the rim's shadow on the recessed face
                ch = 'h'
            else:                                # the recessed face: lit at its lower back
                ch = 's' if -l > 0.5 else 'g' if -l > -0.5 else 'G'
            cv.px(x, y, ch, 8.0, 'drum')
    for a in (45, 135, 225, 315):
        r = R - 1.8
        cv.px(int(round(cx + r * math.cos(math.radians(a)))), int(round(cy - r * math.sin(math.radians(a)))),
              'y' if a < 180 else 'Z', 8.1, 'drum')
    return c


# ------------------------------------------------------------------ the neck and the head
# the head, facing right, the bill a little down (the mute swan's carriage): white crown, the black
# knob over the bill base, the black lores round the eye, the orange bill with its black nail
HEAD = ["..WWW.......",
        ".WWWWWn.....",
        "WWWWWnnN....",
        "WWWwKnnOO...",
        "wwwwwnoOOOo.",
        "vwwwvvqooooo",
        ".vvv...qqqnn"]
HEAD_NECK = (2.5, 5.5)            # where the neck joins (grid coordinates)

# the head's faces (the same skull; the neck strips of stage 2 use them too):
#   'n' open eye, 'blink' the eye shut (the lores close over it), 'open' the bill open (hiss,
#   honk: the gullet dark), 'squint' straining (the eye a slit, the bill pressed shut)
HEADS = {
    'n': HEAD,
    'blink': [r.replace('K', 'n') for r in HEAD],
    'open': ["..WWW.........",
             ".WWWWWn.......",
             "WWWWWnnN......",
             "WWWwKnnOOO....",
             "wwwwwnoOOOOo..",
             "vwwwvvqooooooo",
             ".vvv..qMMM....",
             "......qoooo...",
             ".......qqqnn.."],
    'squint': ["..WWW.......",
               ".WWWWWn.....",
               "WWWWWnnN....",
               "WWWwnnnOO...",
               "wwwwKnoOOOo.",
               "vwwwvvqooooo",
               ".vvv...qqqnn"],
}


def neck_shade(a, b, r):
    """The neck as one smooth cylinder (wave 1 verify: the per-segment round caps made grey bars
    across it): the tone comes only from the distance across the neck (v), lit on the upper front
    side, with a single shade step on the far side; no tone change along the neck."""
    ramp = SP.RAMP['neck']
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy) or 1e-9
    nx, ny = -dy / L, dx / L                       # v > 0 points this way (screen)
    lx, ly, lz = rig.LIGHT3

    def pat(u, v, k, ch):
        q = max(-1.0, min(1.0, v / (r + 0.35)))
        l = q * (nx * lx + ny * ly) + math.sqrt(max(0.0, 1 - q * q)) * lz
        return ramp[0 if l > 0.80 else 1 if l > 0.40 else 2 if l > 0.05 else 3]
    return pat


def head_rows(face='n', ang=0.0, flip=False):
    """The head grid for a face, turned by ang degrees (+ = the bill up) and mirrored when flip (the
    bill points back: the head turned to look behind, or tucked on the back). Returns (rows, the
    neck joint in the rows)."""
    rows = HEADS[face]
    w = max(len(r) for r in rows)
    rows = [r.ljust(w, '.') for r in rows]
    an = HEAD_NECK
    if flip:
        rows = [r[::-1] for r in rows]
        an = (w - 1 - an[0], an[1])
        ang = -ang
    if ang:
        pad = 6
        g = ['.' * (w + 2 * pad)] * pad + ['.' * pad + r + '.' * pad for r in rows] + ['.' * (w + 2 * pad)] * pad
        rows = rotsprite(g, (an[0] + pad, an[1] + pad), ang)
        an = (an[0] + pad, an[1] + pad)
    return rows, an


def neck_head(sw, c1, c2, head_at, ang=0.0, z=4.0, r0=4.2, r1=2.5, eye=True, face=None, flip=False, collar=True,
              base=None, layer='n'):
    """The thick S-neck from the collar to head_at (swan-local, screen space), the head turned by
    ang degrees (positive = the bill up, counter-clockwise), a leather collar over the root.
    face: a HEADS key (default 'n', or 'blink' when eye is False); flip: the head looks back."""
    p0 = sw.T(NECK_BASE_S) if base is None else base
    pts = [SW.bez(p0, c1, c2, head_at, i / 16) for i in range(17)]
    lea = SP.RAMP['leather']
    for i in range(16):
        ra = r0 + (r1 - r0) * (i / 16)
        rb = r0 + (r1 - r0) * ((i + 1) / 16)
        # the leather collar (the saddle's breast strap) is the band of segment 1 over the root
        pat = (lambda u, v, k, ch: lea[min(3, k + 0)]) if (i == 1 and collar) else neck_shade(pts[i], pts[i + 1], (ra + rb) / 2)
        sw.tube(layer, pts[i], pts[i + 1], ra, rb, SP.RAMP['neck'], z + 0.001 * i, 'neck', pat=pat)
    if collar:
        c = pts[1]
        sw.dot(layer, (c[0] + 1.5, c[1] - 1.0), 'Y', z + 0.06, 'collar')
    rows, an = head_rows(face or ('n' if eye else 'blink'), ang, flip)
    sw.grid(layer, rows, head_at, an, z + 0.5, 'head')
    sw.pts['head'] = head_at
    return pts


def neck_rel(sw, c1, c2, head, ang=0.0, **kw):
    """neck_head with the Bezier controls and the head given relative to the socket in the body's
    own frame: they turn with the body (tumble, the swan on her back); the head's angle too."""
    p0 = sw.T(NECK_BASE_S)
    return neck_head(sw, sw.R(p0, c1), sw.R(p0, c2), sw.R(p0, head), ang - sw.tilt, base=p0, **kw)


# ------------------------------------------------------------------ the gun (plan D3)
AIM_DEG = [45 - 22.5 * i for i in range(9)]     # the game's neck frames: theta = +45 - 22.5 i (y down)
BARREL = (3.5, 9.5, 3.5)                        # receiver, cooling jacket, muzzle (px)


def barrel(sw, i, z=9.0, kick=0.0, deg=None, layer='n'):
    """The short barrel on the drum's hub at aim step i (0..8): a receiver block, the perforated
    cooling jacket, the muzzle with a flash-hider ring. deg (instead of i): the angle in the body's
    frame (it turns with the body). Returns the muzzle point (swan-local)."""
    th = math.radians(AIM_DEG[i] if deg is None else deg + sw.tilt)
    ux, uy = math.cos(th), math.sin(th)
    hb = hub(sw)
    p = lambda d: (hb[0] + ux * (d - kick), hb[1] + uy * (d - kick))
    r0, r1, r2 = BARREL
    L = r0 + r1 + r2
    sw.tube(layer, p(-1.0), p(r0), 1.9, 1.9, SP.RAMP['steel'], z, 'recv')
    jac = SP.RAMP['jacket']

    sw.tube(layer, p(r0), p(r0 + r1), 1.6, 1.6, jac, z + 0.1, 'jacket')
    for k in range(1, int(r1) - 1, 2):    # the row of cooling holes along the jacket
        sw.dot(layer, p(r0 + k + 0.5), 'h', z + 0.15, 'jacket')
    sw.tube(layer, p(r0 + r1), p(L - 0.6), 0.8, 0.8, SP.RAMP['dark'], z + 0.2, 'muzzle')
    sw.tube(layer, p(L - 1.2), p(L - 0.2), 1.25, 1.25, SP.RAMP['steel'], z + 0.25, 'muzzle')
    # the brass pivot bolt on the hub (over the receiver)
    sw.grid(layer, ["yY", "Zy"], hb, (0.5, 0.5), z + 0.4, 'hub')
    tip = p(L + 0.5)
    sw.pts['muzzle'] = tip
    return tip


def muzzle_at(sw, i=2, deg=None, kick=0.0):
    """The barrel tip at aim step i (or the body-frame angle deg) without drawing: the body frames'
    `muzzle` / `cannon` fallback point (the game's 0 deg aim)."""
    th = math.radians(AIM_DEG[i] if deg is None else deg + sw.tilt)
    hb = hub(sw)
    L = sum(BARREL) + 0.5 - kick
    return (hb[0] + math.cos(th) * L, hb[1] + math.sin(th) * L)
