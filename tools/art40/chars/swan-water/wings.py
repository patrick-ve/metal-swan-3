# The Swan's spread wings (flight, the take-off from the water, the splash-down, the busking honk):
# the core rig (tools/art40/chars/swan/body.py) only has the folded near wing and a far wing in
# fixed kinds, so the water and air strips draw both wings here.
#
# A wing is a 3D stroke seen from the side: the arm (shoulder -> wrist) and the hand (wrist -> tip)
# each have an ELEVATION e (degrees, +90 straight up, 0 level, - down) and a SWEEP b (degrees back
# from the span axis). On screen a segment of length L points
#     (-L sin b, -L sin e cos b)            (x forward, y down; turned with the body's tilt)
# so a level wing is foreshortened to its sweep and a raised or lowered wing shows its full length.
# The trailing edge runs along the body axis (backward), so it is never foreshortened: a raised
# wing is a broad plate, a level wing a short one.
#
# Three feather groups, each a flat tone, separated by the canvas's selout (each group a step
# higher in z) the way the core's far wing (body.plume_wing) is:
#   the secondaries   ONE part along the arm, the scalloped trailing edge (no lines inside)
#   the primaries     5 separate feathers fanned at the hand, darker toward the tip of the fan
#   the coverts       a pillow-shaded lit plate along the leading edge over the feather roots
# The near wing is drawn on its own layer 'w' (behind the rider, in front of her body: the rider
# sits between the wings); the far wing on 'b', one tone darker, its shoulder a little back and up.
import math

import art40 as X

S = X.char('swan')
B = S.B
SW = B.SW

ARM, HAND = 14.0, 9.0              # px: the arm and the hand of the wing (the primaries add PRIM)
PRIM = 14.0                         # px: the longest primary beyond the hand's tip
SEC = 15.0                          # px: the secondaries' length (the trailing edge)
SHOULDER_N = (9.0, -25.0)           # body coordinates of the near shoulder
SHOULDER_F = (5.5, -27.0)           # the far shoulder: a little back and up (perspective)

NEAR = dict(prim=('w', 'v', 'v', 'u', 'u'), sec='w', cov=['W', 'W', 'w', 'v'], smear='v')
FAR = dict(prim=('v', 'v', 'u', 'u', 'U'), sec='v', cov=['w', 'w', 'v', 'u'], smear='u')


def seg(e, b, L):
    """The screen vector of a wing segment (body frame, before the tilt)."""
    e, b = math.radians(e), math.radians(b)
    return (-L * math.sin(b), -L * math.sin(e) * math.cos(b))


def _unit(v):
    L = math.hypot(*v) or 1e-9
    return (v[0] / L, v[1] / L)


def geometry(sw, near, e, b=14.0, eh=None, bh=None, lift=0.0, arm=1.0):
    """Shoulder, wrist and hand tip of a wing (swan-local, turned with the body)."""
    eh = e if eh is None else eh
    bh = b + 16.0 if bh is None else bh
    sh = sw.T(SHOULDER_N if near else SHOULDER_F)
    a = sw.V(seg(e, b, ARM * arm))
    h = sw.V(seg(eh, bh, HAND * arm))
    wr = (sh[0] + a[0], sh[1] + a[1] - lift)
    tip = (wr[0] + h[0], wr[1] + h[1] - lift)
    return sh, wr, tip


def draw(sw, layer, near, e, b=14.0, eh=None, bh=None, spread=1.0, sec=1.0, z=None, name=None, lift=0.0,
         smear=None, arm=1.0, prim=1.0, tone=0):
    """Draw one spread wing. spread: how far the primaries fan (1 = open, 0 = closed into a point);
    sec: the trailing edge's length (1 = full; a wing swept back on the recovery shows less);
    smear: (e0, eh0) the elevation the wing came from on this frame (a downstroke smear: the arc
    between is filled in one flat tone, no feather lines); tone: 1 = one step darker (the
    underside: an upstroke shows it)."""
    tones = NEAR if near else FAR
    if tone:
        tones = FAR if near else dict(FAR, prim=('u', 'u', 'U', 'U', 'U'), sec='u', cov=['v', 'v', 'u', 'U'])
    z = (6.0 if near else 1.0) if z is None else z
    name = name or ('wn' if near else 'wf')
    sh, wr, tip = geometry(sw, near, e, b, eh, bh, lift, arm)
    tv = sw.V((-SEC * sec, 1.0 * sec))
    tn = _unit(tv)
    u = _unit((tip[0] - wr[0], tip[1] - wr[1]))
    if math.hypot(tip[0] - wr[0], tip[1] - wr[1]) < 1.0:
        u = _unit((wr[0] - sh[0], wr[1] - sh[1]))
    # the smear: the swept arc of the wing between the elevation it came from and now
    if smear:
        e0, eh0 = smear
        for k in range(1, 5):
            t = k / 5.0
            s2, w2, t2 = geometry(sw, near, e0 + (e - e0) * t, b, eh0 + ((e if eh is None else eh) - eh0) * t, bh, lift, arm)
            p2 = (t2[0] + u[0] * PRIM * 0.7 * prim, t2[1] + u[1] * PRIM * 0.7 * prim)
            sw.flat(layer, [s2, w2, p2, (w2[0] + tv[0], w2[1] + tv[1]), (s2[0] + tv[0], s2[1] + tv[1])],
                    tones['smear'], z - 0.6, name + 'sm')
    # the secondaries: one part, the scallops at the trailing edge
    n = 6
    for i in range(n):
        t = (i + 0.5) / n
        root = B.lerp(sh, wr, t)
        k = 0.85 + 0.25 * t
        tp = (root[0] + tv[0] * k, root[1] + tv[1] * k)
        sw.flat(layer, SW.feather(root, tp, 2.6), tones['sec'], z, name + 's')
    # the inner primaries continue the trailing edge at the hand
    hb = B.lerp(wr, tip, 0.45)
    sw.flat(layer, SW.feather(wr, (wr[0] + tv[0] * 1.05 + u[0] * 2, wr[1] + tv[1] * 1.05 + u[1] * 2), 2.8),
            tones['sec'], z, name + 's')
    tp_ = (-u[1], u[0])
    if tp_[0] * tn[0] + tp_[1] * tn[1] < 0:
        tp_ = (u[1], -u[0])
    # the primaries: back (the inner, nearest the trailing edge) to front (the outermost, leading)
    for i in range(4, -1, -1):
        f = i / 4.0
        L = PRIM * prim * (1.0 - 0.1 * i)
        root = B.lerp(hb, wr, 0.25 * f)
        a = math.radians(80.0 * f * spread)
        d = (u[0] * math.cos(a) + tp_[0] * math.sin(a), u[1] * math.cos(a) + tp_[1] * math.sin(a))
        base = B.lerp(tip, wr, 0.42 * f)
        tp = (base[0] + d[0] * L, base[1] + d[1] * L)
        sw.flat(layer, SW.feather(root, tp, 1.9 + 0.3 * (1 - f)), tones['prim'][i], z + 0.5 + 0.5 * (4 - i),
                f'{name}p{i}')
    # the coverts: the lit plate along the arm and over the hand's base (the leading edge)
    cz = z + 3.2
    nrm = (-tn[0] * 1.4, -tn[1] * 1.4)
    pts = [(sh[0] + nrm[0] * 0.6, sh[1] + nrm[1] * 0.6), (wr[0] + nrm[0], wr[1] + nrm[1]),
           (hb[0] + nrm[0] * 0.5 + u[0], hb[1] + nrm[1] * 0.5 + u[1]),
           (hb[0] + tv[0] * 0.15, hb[1] + tv[1] * 0.15),
           (wr[0] + tv[0] * 0.32, wr[1] + tv[1] * 0.32),
           (B.lerp(sh, wr, 0.5)[0] + tv[0] * 0.40, B.lerp(sh, wr, 0.5)[1] + tv[1] * 0.40),
           (sh[0] + tv[0] * 0.35, sh[1] + tv[1] * 0.35)]
    sw.poly(layer, pts, tones['cov'], cz, name + 'c', R=2.2)
    end = (tip[0] + u[0] * PRIM * prim, tip[1] + u[1] * PRIM * prim)
    sw.pts['wingN' if near else 'wingF'] = end
    sw.pts['wristN' if near else 'wristF'] = wr
    return end


def kw_far(spec):
    """The far wing's keywords of a pose's wing spec: the near wing's, then the 'far' overrides
    (default: 8 degrees higher, the darker tones; no smear unless the spec gives the far one)."""
    k = {kk: v for kk, v in spec.items() if kk not in ('far', 'smear')}
    k['e'] = k.get('e', 0.0) + 7.0
    k['b'] = k.get('b', 14.0) + 6.0
    if k.get('eh') is not None:
        k['eh'] = k['eh'] + 7.0
    if k.get('bh') is not None:
        k['bh'] = k['bh'] + 6.0
    k.update(spec.get('far', {}))
    return k


def kw_near(spec):
    return {kk: v for kk, v in spec.items() if kk != 'far'}


# ------------------------------------------------------------------ the beat (a locomotion cycle)
# One wing beat by phase p in [0, 1): 0 = the top of the upstroke. The downstroke (0 .. DOWN_END)
# is the power stroke: the arm sweeps from TOP to BOTTOM, the hand lags (bent up) at the start and
# whips through at the bottom (follow-through). The upstroke (DOWN_END .. 1) is the recovery: the
# hand swept back and folded, the primaries closed, the underside shown, the arm rising slower.
DOWN_END = 0.42
TOP, BOTTOM = 78.0, -42.0


def ease(t):
    return 0.5 - 0.5 * math.cos(math.pi * t)


def beat(p, top=TOP, bottom=BOTTOM):
    """dict(e, b, eh, bh, spread, sec, prim, tone) of the wing at phase p."""
    p %= 1.0
    if p < DOWN_END:
        t = ease(p / DOWN_END)
        e = top + (bottom - top) * t
        lag = 26.0 * math.sin(math.pi * min(1.0, t * 1.3))      # the hand bends up, then whips down
        eh = e + lag * (1 - t) - 14.0 * t * t
        return dict(e=e, b=10.0, eh=eh, bh=24.0, spread=1.0, sec=1.0, prim=1.0)
    t = ease((p - DOWN_END) / (1 - DOWN_END))
    e = bottom + (top - bottom) * t
    fold = math.sin(math.pi * t)                                 # most folded at mid-upstroke
    eh = e - 40.0 * fold - 4.0
    return dict(e=e, b=10.0 + 18.0 * fold, eh=eh, bh=24.0 + 40.0 * fold, spread=1.0 - 0.7 * fold,
                sec=1.0 - 0.3 * fold, prim=1.0 - 0.25 * fold, tone=1 if fold > 0.45 else 0)
