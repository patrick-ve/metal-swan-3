# The herring gull's strips: poses per frame and the holds in 60 Hz ticks (contract:
# docs/design/ams40/contract.md "herring gull (seagull)"). Logic times that stay (plan rule 4): the
# take-off 10 ticks and the pull-up 6 (the game reads the baked durations: TAKEOFF_TIMING,
# PULLUP_TIMING), the turn 2 ticks a frame (TURN_TICKS), the gloat 44 with the peck on GLOAT_PECK,
# the death totals (die 52, die-blast 47, die-burn 62, die-crush 47: the corpse timer), the tell 20
# (the telegraph at NORMAL). The frame counts follow the plan's class table.
#
# Anchors (as today): the flying strips at the body centre; the standing strips (perch, gag,
# gag-fries, alert, gloat) at the feet, the body centre 11 px over them (the game's PERCH_LIFT); the
# take-off at the body centre with the standing feet 11 px under it; the deaths at the feet, the body
# centre 7 px over the anchor while it is still in the air (the game moves the anchor 7 px down when
# it dies).
import math

import art40 as X
import rig

from . import gull as G
from . import palette as PL

C0 = G.C0
LIFT = G.LIFT                    # feet -> body centre of a standing gull
DROP = 7                         # body centre -> the death anchor (seagull.ts deathEffects)


# ------------------------------------------------------------------------------------ frames
def _frame(b, root, smear=False, fx=None, remap=None, ground=False):
    rows, _, j = G.finish(b)
    if remap:
        rows = [''.join(remap.get(ch, ch) for ch in r) for r in rows]
    if fx:
        rows = stamp(rows, fx)
    if ground:
        ys = [y for y, r in enumerate(rows) if r.strip('.')]
        root = (root[0], max(ys) + 1)
    pts = {'head': j['head'], 'mouth': j['beak']}
    return X.Frame(rows, root, pts=pts, smear=smear, joints=j)


def stamp(rows, fx):
    """FX shapes (flames, smoke, stars, speed lines) over a finished frame: [(name or (rows, anchor),
    (x, y) canvas point)]. FX pixels carry no outline (they glow)."""
    g = [list(r) for r in rows]
    for item, (x, y) in fx:
        if isinstance(item, str):
            grid, (ax, ay) = PL.FX[item]
        else:
            grid, (ax, ay) = item
        for j, r in enumerate(grid):
            for i, ch in enumerate(r):
                if ch in '. ':
                    continue
                X_, Y_ = int(round(x - ax)) + i, int(round(y - ay)) + j
                if 0 <= X_ < G.CW and 0 <= Y_ < G.CH:
                    g[Y_][X_] = ch
    # an outline pixel the FX cut off from the rest of the outline (alone on the edge) goes
    h, w = len(g), len(g[0])
    for y in range(h):
        for x in range(w):
            if g[y][x] != 'K':
                continue
            edge = any(not (0 <= x + dx < w and 0 <= y + dy < h) or g[y + dy][x + dx] == '.'
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            mate = any(0 <= x + dx < w and 0 <= y + dy < h and g[y + dy][x + dx] == 'K'
                       for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy)
            if edge and not mate:
                g[y][x] = '.'
    return [''.join(r) for r in g]


def fly(pose, **kw):
    """A flying frame: anchor = the body centre (C0; 'at' moves the body off it)."""
    return _frame(G.draw(pose), C0, **kw)


def stand(pose, **kw):
    """A standing frame: anchor = the feet (C0 + LIFT)."""
    return _frame(G.draw(pose), (C0[0], C0[1] + LIFT), **kw)


def dead(pose, air=True, squash=None, **kw):
    """A death frame: anchor = the feet; in the air the body centre is DROP px over it, on the
    ground the lowest pixel's outline sits on it."""
    b = G.draw(pose)
    if squash:
        G.squash(b, *squash)
    f = _frame(b, (C0[0], C0[1] + DROP), ground=not air, **kw)
    f.air = air
    return f


def lift_air(frames):
    """The frames still in the air never reach under the anchor (the body falls onto the floor:
    nothing may sink into it): the whole airborne run is lifted by the same few px (the hit pops
    the body up a little), so it keeps its own motion."""
    air = [f for f in frames if getattr(f, 'air', False)]
    low = max((max(y for y, r in enumerate(f.rows) if r.strip('.')) + 1 - f.root[1] for f in air), default=0)
    if low > 0:
        for f in air:
            f.root = (f.root[0], f.root[1] + low)
    return frames


def W(th, fold=0.0, lag=0.0, **kw):
    d = dict(th=th, fold=fold, lag=lag)
    d.update(kw)
    return d


def both(w, far=None):
    return {'wN': w, 'wF': dict(far if far is not None else w)}


def feet(nx=1.2, fx=-1.6, kN='flat', kF='flat', lift=0.0):
    """Standing feet: the near foot a little forward, the far one back (anchor space: the ankle 3 px
    over the ground, the foot grid's 2 rows and the outline under them)."""
    a = LIFT - 3
    return {'N': ('w', nx, a - lift), 'F': ('w', fx, a - lift * 0.5), 'kN': kN, 'kF': kF}


STAND = dict(wings='folded', legs='stand', pitch=14, ha=-14)


def standing(**kw):
    d = dict(STAND)
    d['feet'] = feet()
    d.update(kw)
    return d


# ------------------------------------------------------------------------------------ the flap
# The 12-frame flap (a locomotion cycle; the gull flies, no foot contact): the top, the down-stroke
# (the hand lags: follow-through), the bottom (the tips whip past), the up-stroke (the wrist leads,
# the hand trails folded back). The body rises on the down-stroke, the head stays steady (it bobs
# against the body), the tail counters.
FLAP = [(62, 0.10, -18), (55, 0.0, -2), (40, 0.0, 12), (20, 0.0, 16), (-2, 0.0, 14), (-22, 0.0, 6),
        (-38, 0.0, -6), (-40, 0.1, -16), (-26, 0.32, -26), (2, 0.55, -30), (32, 0.5, -28), (54, 0.3, -24)]


def flap_pose(k, amp=1.0, base=None, extra=None):
    th, fo, lag = FLAP[k % 12]
    if base is not None:
        th = base + (th - 11) * amp
    ph = (k % 12) / 12
    p = dict(both(W(th, fo, lag * amp)))
    p['at'] = (0.0, -1.0 * amp * math.sin(2 * math.pi * (ph - 0.05)))
    p['hd'] = (0.0, 0.6 * amp * math.sin(2 * math.pi * (ph - 0.05)))
    p['tail'] = 4 * amp * math.sin(2 * math.pi * ph)
    if extra:
        p.update(extra)
    return p


def walk():
    return [fly(flap_pose(k)) for k in range(12)]


def idle():
    """The hover (the gloat's hover, any idle in the air): body up, the tail fanned down, the feet
    hanging, a shallow quick beat high over the back; the head kept level."""
    out = []
    for k in range(12):
        dang = {'N': (0.6, 8.4), 'F': (-0.8, 8.0), 'kN': 'curl', 'kF': 'curl'}
        p = flap_pose(k, amp=0.62, base=34, extra=dict(pitch=16, ha=-16, fan=2.0, legs='dangle', feet=dang))
        p['tail'] = -10 + 3 * math.sin(2 * math.pi * k / 12)
        out.append(fly(p))
    return out


def takeoff():
    """Off the perch (10 ticks), after the notice (alert: the wings already half open): the crouch
    (head down, the wings lifting), the wings up, the push off the toes with the first down-stroke
    (two smears: the wing blurred over its sweep), the bottom, the feet trailing. The anchor stays
    the body centre (the rising anchor carries the lift)."""
    S = []
    S.append((dict(both(W(40, 0.5, -18)), legs='stand', feet=feet(), pitch=10, at=(0.0, 1.4), hd=(0.6, 1.0),
                   ha=-18, tail=6), False))
    S.append((dict(both(W(52, 0.32, -18)), legs='stand', feet=feet(), pitch=16, at=(0.0, 0.6), ha=-14,
                   hd=(0.0, -0.4), tail=2), False))
    S.append((dict(both(W(60, 0.18, -10)), wN2=W(34, 0.1, 8), wF2=W(34, 0.1, 8), legs='stand',
                   feet={'N': ('w', 0.0, LIFT - 4), 'F': ('w', -2.4, LIFT - 4), 'kN': 'toe', 'kF': 'toe'}, pitch=18, ha=-14, at=(0.0, -0.4), tail=-4,
                   fan=1.5, beak='open'), True))
    S.append((dict(both(W(14, 0.0, 16)), wN2=W(-12, 0.0, 10), wF2=W(-12, 0.0, 10), legs='dangle',
                   feet={'N': (-2.0, 9.0), 'F': (-3.4, 8.4), 'kN': 'toe', 'kF': 'toe'}, pitch=12, ha=-10,
                   at=(0.0, -0.6), tail=-2, fan=1.0), True))
    S.append((dict(both(W(-28, 0.0, 6)), legs='dangle', feet={'N': (-4.0, 7.6), 'F': (-5.0, 7.0), 'kN': 'toe', 'kF': 'toe'},
                   pitch=8, ha=-6, at=(0.0, -1.0), tail=0), False))
    S.append((dict(both(W(-36, 0.1, -10)), legs='dangle', feet={'N': (-5.0, 6.6), 'F': (-5.8, 6.0), 'kN': 'curl', 'kF': 'curl'},
                   pitch=4, ha=-2, at=(0.0, -0.8), tail=2), False))
    return [fly(p, smear=sm) for p, sm in S]


def pull_up():
    """Out of the dive (6 ticks): the swept wings open up and forward (the brake), the body pitches
    up, the tail fans down, the feet come down; it ends near a flap's top."""
    S = []
    for t in (0.0, 0.2, 0.4, 0.6, 0.8, 1.0):
        pitch = -20 + 34 * t
        wN = W(20 + 42 * t, 0.3 - 0.2 * t, 14 - 30 * t, arm=-56 + 44 * t, hand=-86 + 58 * t)
        wF = W(38 + 26 * t, 0.3 - 0.2 * t, 8 - 24 * t, arm=-50 + 38 * t, hand=-92 + 64 * t)
        S.append(dict(wN=wN, wF=wF, pitch=pitch, ha=-pitch * 0.6, tail=-8 * t, fan=2.2 * t, legs='dangle',
                      feet={'N': (-5.0 + 2.0 * t, 4.4 + 2.8 * t), 'F': (-5.8 + 1.8 * t, 4.0 + 2.6 * t),
                            'kN': 'curl', 'kF': 'curl'}))
    return [fly(p) for p in S]


def turn():
    """The mid-air turn (the Turner's 2 widths, each shown 2 ticks): it banks toward the viewer, the
    body foreshortened, the wings lifting (frame 1 is shown on both sides of the flip)."""
    b0 = G.draw(dict(wN=W(30, 0.1, 4), wF=W(40, 0.1, 4), pitch=4, ha=-4))
    G.squash(b0, 0.72, 1.0, 0)
    b1 = G.draw(dict(wN=W(40, 0.05, 6), wF=W(52, 0.05, 6), pitch=6, ha=-6, hd=(-0.6, 0.0)))
    G.squash(b1, 0.5, 1.0, 0)
    return [_frame(b0, C0), _frame(b1, C0)]


# ------------------------------------------------------------------------------------ the attack
def tell():
    """KAW! (the telegraph, 20 ticks at NORMAL): it rears up in the air, wings high and flared,
    beating short and quick, the tail fanned, the feet forward like brakes, the head pumping with
    each KAW (the gape on the down-beats), the head finally lowered at the hero."""
    out = []
    TH = [70, 58, 46, 58, 70, 58, 46, 52]
    HD = [(-1.0, -1.0), (0.6, 0.0), (1.4, 0.6), (0.4, 0.0), (-1.0, -1.0), (0.6, 0.0), (1.4, 0.6), (1.4, 1.2)]
    BK = ['open', 'gape', 'gape', 'open', 'open', 'gape', 'gape', 'shut']
    HA = [20, 6, -2, 8, 20, 6, -2, -14]
    for k in range(8):
        w = W(TH[k], 0.15, (TH[(k + 7) % 8] - TH[k]) * 0.8, sweep=-8)
        p = dict(both(w), pitch=26, at=(0.0, -0.6 if TH[k] < 55 else 0.4), hd=HD[k], ha=HA[k] - 26,
                 beak=BK[k], face='mean', tail=-12, fan=2.6, legs='dangle',
                 feet={'N': (3.2, 7.4), 'F': (2.0, 7.0), 'kN': 'toe', 'kF': 'toe'})
        out.append(fly(p))
    return out


def attack():
    """The dive (loops for the whole dive): beak first, the wings half folded up and back in a W,
    the tips shivering in the rush, the head pumping, the beak snapping twice (peck, peck), wind
    streaks trailing off the wing tips."""
    out = []
    SNAP = ['shut', 'shut', 'open', 'gape', 'shut', 'shut', 'shut', 'open', 'gape', 'shut']
    for k in range(10):
        a = 2 * math.pi * k / 10
        wN = W(20 + 3 * math.sin(a), 0.3, 14 + 6 * math.sin(2 * a + 1.0), arm=-56, hand=-86)
        wF = W(38 + 3 * math.sin(a + 0.6), 0.3, 8 + 6 * math.sin(2 * a + 1.6), arm=-50, hand=-92)
        jab = {'open': 0.6, 'gape': 1.2}.get(SNAP[k], 0.0)
        p = dict(wN=wN, wF=wF, pitch=-22, hd=(0.4 + jab, 0.0), ha=4, beak=SNAP[k], face='mean',
                 tail=2 * math.sin(a))
        b = G.draw(p)
        out.append(_frame(b, C0, fx=_streaks(b, k)))
    return out


def _streaks(b, k):
    """Wind streaks behind the wing tips and the tail (FX, no outline), flickering along."""
    fx = []
    dx, dy = -math.cos(math.radians(22)), -math.sin(math.radians(22))
    for key, n in (('wingF.tip', 4), ('wingN.tip', 5), ('tail', 4)):
        if key not in b.j:
            continue
        x, y = b.j[key]
        off = (k * 2 + n) % 3
        L = n + (k % 2)
        for i in range(L):
            fx.append(((['I' if i < L - 2 else 'i'], (0, 0)), (x - 2 + dx * (off + i), y + dy * (off + i) - 1)))
    return fx


# ------------------------------------------------------------------------------------ perched
def perch():
    """On the post (the breath, a blink, a look round): 50 ticks."""
    S = [standing(breath=0.0),
         standing(breath=0.4, face='half', hd=(0.2, -0.2)),
         standing(breath=0.6, ha=-8, hd=(0.4, -0.4)),
         standing(breath=0.2, ha=-24, hd=(0.4, 0.4))]
    return [stand(p) for p in S]


def gag():
    """Asleep on the post (60 ticks): the head tucked into the back, the breath (the back rises,
    the folded wings lift), a ruffle, one eye peeks out and closes again."""
    tuck = dict(tucked=True, hd=(-6.4, 1.4), face='shut')
    S = [standing(**tuck, breath=0.0, fold_lift=0.0),
         standing(**tuck, breath=0.5, fold_lift=0.6),
         standing(**tuck, breath=0.9, fold_lift=1.0),
         standing(**tuck, breath=0.4, fold_lift=0.5),
         standing(**dict(tuck, hd=(-5.6, 0.6)), breath=0.2, fold_lift=1.6, puff=0.4),
         standing(**dict(tuck, hd=(-5.2, 0.2), face='half'), breath=0.2, fold_lift=0.8),
         standing(**dict(tuck, hd=(-5.2, 0.2), face='mean'), breath=0.1, fold_lift=0.6),
         standing(**dict(tuck, hd=(-6.0, 1.0), face='half'), breath=0.0, fold_lift=0.2)]
    return [stand(p) for p in S]


def _cone(tipped=False, dx=12.0):
    rows = PL.CONE_TIPPED if tipped else PL.CONE

    def draw(b):
        b.cv.grid(int(round(C0[0] + dx - 3)), int(round(C0[1] + LIFT - 1 - len(rows))), rows, 3.6, 'cone')
    return draw


def _fry_air(dx, dy, rot=0):
    """A single fry tossed in the air (anchor space)."""
    rows = [["Y", "Y", "O"], ["YYO"], [".O", "Y."]][rot]

    def draw(b):
        b.cv.grid(int(round(C0[0] + dx)), int(round(C0[1] + LIFT + dy)), rows, 3.7, 'fry')
    return draw


def _blur(a, b):
    """A strike smear: pale speed lines along the head's path (body-local a -> b, FX letters)."""
    def draw(b_):
        for t in (0.0, 0.25, 0.5, 0.75):
            p = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
            c = b_.T(p)
            b_.cv.px(int(c[0]), int(c[1]), 'I' if t < 0.5 else 'i', 1.0, 'fx')
    return draw


def _lump(at):
    """The gulped fry going down the neck: a bump on the throat."""
    def draw(b):
        b.px(at, '1', 2.3, 'neck')
        b.px((at[0], at[1] + 1.0), '2', 2.3, 'neck')
    return draw


def gag_fries():
    """The chip steal (46 ticks): it eyes the stolen cone, rears back (anticipation), stabs (the
    strike: a smear), its beak deep in the cone, tugs (the cone tips), yanks a fry out, tosses it up,
    catches and gulps it (eyes shut, the lump goes down), and settles with a smug look."""
    S = [(standing(ha=-30, hd=(0.6, 0.6), extra=[_cone()]), False),
         (standing(ha=-2, hd=(-1.6, -1.8), at=(-0.4, 0.4), extra=[_cone()]), False),
         (standing(pitch=4, ha=-34, hd=(1.4, 2.0), beak='open', extra=[_cone(), _blur((2.0, -1.0), (8.0, 4.0))]), True),
         (standing(pitch=-6, ha=-62, hd=(3.2, 5.2), fold_lift=0.8, extra=[_cone(True)]), False),
         (standing(pitch=6, ha=-18, hd=(1.4, 1.0), fry=True, extra=[_cone()]), False),
         (standing(pitch=16, ha=14, hd=(0.4, -1.2), beak='gape', extra=[_cone(), _fry_air(10, -27, 0)]), False),
         (standing(pitch=18, ha=22, hd=(0.0, -1.6), face='happy', extra=[_cone(), _lump((6.4, -2.4))]), False),
         (standing(ha=-10, hd=(0.2, -0.4), breath=0.5, extra=[_cone(), _lump((4.8, -1.0))]), False)]
    return [stand(p, smear=sm) for p, sm in S]


def _ground_fries(n=3):
    def draw(b):
        rows = PL.GROUND_FRIES[0 if n >= 3 else 1]
        b.cv.grid(int(round(C0[0] + 9)), int(round(C0[1] + LIFT - 3)), rows, 3.6, 'fries')
    return draw


GLOAT_PECK = 3


def gloat():
    """The gloat (44 ticks, landed by the hero's lost fries): it eyes them, rears back, strikes (a
    smear), PECKS (frame GLOAT_PECK, tick 16 as before: the beak hits the cobbles, the game's peck
    sound), comes up with a fry, tosses its head and gulps it, then puffs up, smug."""
    S = [(standing(ha=-34, hd=(0.8, 0.8), extra=[_ground_fries(3)]), False),
         (standing(ha=-2, hd=(-1.4, -1.8), at=(-0.4, 0.4), extra=[_ground_fries(3)]), False),
         (standing(pitch=-2, ha=-34, hd=(1.6, 2.0), beak='open', extra=[_ground_fries(3), _blur((2.0, -1.0), (8.0, 5.0))]), True),
         (standing(pitch=-14, ha=-70, hd=(4.4, 3.0), beak='open', extra=[_ground_fries(3)]), False),
         (standing(pitch=4, ha=-20, hd=(1.4, 1.4), fry=True, extra=[_ground_fries(2)]), False),
         (standing(pitch=16, ha=20, hd=(0.0, -1.6), face='happy', extra=[_ground_fries(2), _lump((6.4, -2.4))]), False),
         (standing(ha=-6, hd=(0.0, -0.6), breath=0.8, puff=0.3, extra=[_ground_fries(2)]), False)]
    return [stand(p, smear=sm) for p, sm in S]


def alert():
    """Woken on the post (the double-take, SAY CHEESE, the cower on a perch): head up, the wings
    lift half open, KAW, and fold again."""
    S = [standing(hd=(0.0, -1.4), ha=-4, beak='open', fold_lift=1.6),
         dict(both(W(26, 0.62, -20)), legs='stand', feet=feet(), pitch=16, ha=-8, hd=(0.2, -1.8), beak='gape'),
         dict(both(W(44, 0.5, -20)), legs='stand', feet=feet(), pitch=18, ha=-6, hd=(0.4, -2.0), beak='gape'),
         dict(both(W(22, 0.66, -16)), legs='stand', feet=feet(), pitch=16, ha=-10, hd=(0.2, -1.6), beak='open')]
    return [stand(p) for p in S]


# ------------------------------------------------------------------------------------ reactions
def photo_pose():
    """SAY CHEESE in the air: a showy glide, the wings up in a proud V, the chest out, a smug grin
    and a slow wink."""
    out = []
    for k in range(6):
        a = 2 * math.pi * k / 6
        p = dict(both(W(52 + 6 * math.sin(a), 0.05, 4 * math.cos(a))), pitch=10, ha=-2, puff=0.6,
                 at=(0.0, 0.8 * math.sin(a)), hd=(0.4, -0.4), face='happy' if k in (2, 3) else 'mean',
                 tail=-4, fan=1.8)
        out.append(fly(p))
    return out


def cower():
    """Startled in the air: puffed up, wings beating short and frantic high over the back, the head
    pulled in, a wide eye, the beak open, the feet dangling, a tremble."""
    out = []
    for k in range(6):
        w = W([76, 62, 70, 58, 74, 64][k], 0.2, [-10, 8, -6, 10, -8, 6][k])
        p = dict(both(w), pitch=14, ha=-10, puff=1.0, at=([0.5, -0.5, 0.5, -0.5, 0.0, 0.0][k], 0.0),
                 hd=(-1.2, 1.0), face='wide', beak='open', tail=-8, fan=2.4, legs='dangle',
                 feet={'N': (0.4, 7.8), 'F': (-1.0, 7.2), 'kN': 'curl', 'kF': 'curl'})
        out.append(fly(p))
    return out


# ------------------------------------------------------------------------------------ deaths
LEGS_UP = {'N': (0.0, 8.6), 'F': (-1.8, 7.8), 'kN': 'up', 'kF': 'up', 'vflipN': True, 'vflipF': True}
CURL = {'N': (0.0, 8.0), 'F': (-1.4, 7.6), 'kN': 'curl', 'kF': 'curl'}


def die():
    """Shot (52 ticks): the hit (a smear: the wings flung up, the head snapped back, X eyes), a
    backward tumble as the wings fold limp, the drop (a smear: the limp wings blurred), the bump on
    the ground (a squash), a little bounce, on its back with the feet up; the last frame holds (the
    corpse timer)."""
    S = [(dict(both(W(70, 0.0, 22)), wN2=W(40, 0.0, 10), wF2=W(44, 0.0, 10), at=(-1.0, 0.0), ha=30, face='x',
               beak='gape', tail=8, fan=2), True, None),
         (dict(both(W(36, 0.7, 2)), pitch=24, at=(-1.4, 0.0), ha=24, face='x', beak='gape', tail=10, fan=2), True, None),
         (dict(wN=W(20, 0.8, -6), wF=W(28, 0.8, -6), pitch=54, at=(-1.4, 0.4), ha=16, face='x', beak='open',
               legs='dangle', feet=CURL), True, None),
         (dict(wN=W(6, 0.85, -6), wF=W(16, 0.85, -6), pitch=86, at=(-1.2, 0.6), ha=10, face='x', beak='open',
               legs='dangle', feet=CURL), True, None),
         (dict(wN=W(-6, 0.88, -6), wF=W(6, 0.88, -6), pitch=118, at=(-1.0, 0.8), ha=6, face='x', beak='open',
               legs='dangle', feet=CURL), True, None),
         (dict(wN=W(-14, 0.88, -4), wF=W(2, 0.88, -4), wN2=W(-24, 0.9, -4), wF2=W(-4, 0.9, -4), pitch=150,
               at=(-0.6, 1.2), face='x', beak='open', legs='dangle', feet=LEGS_UP), True, None)]
    lie = dict(wN=W(-30, 0.9, -4), wF=W(-6, 0.9, -4), pitch=180, face='x', beak='open', legs='dangle', feet=LEGS_UP)
    S += [(dict(lie), False, (1.12, 0.72)),
          (dict(lie, at=(0.0, -1.0), wN=W(-20, 0.8, 6), feet=dict(LEGS_UP, N=(0.6, 9.4))), False, None),
          (dict(lie), False, None),
          (dict(lie, beak='shut', feet=dict(LEGS_UP, N=(1.2, 9.2), kN='toe')), False, None)]
    return lift_air([dead(p, air=air, squash=(sq[0], sq[1], None) if sq else None, smear=(k in (0, 5)))
                     for k, (p, air, sq) in enumerate(S)])


FEATHERS = [([".KK..", "K112K", ".KK2K", "...K."], (2, 1)),
            (["..K.", ".K1K", "K12K", "K2K.", ".K.."], (2, 2)),
            ([".KKK.", "K1122K", ".KKKK."], (2, 1)),
            (["K..", "1KK", "K12K", ".KK."], (1, 2))]


FEATHERS = [G.outline_grid(r) for r in (["112", ".22"], ["1.", "12", ".2"], ["1122"], [".1", "12"])]


def _feathers(k, n=5):
    """Loose feathers flying off (blast): little white plates with the outline, flying out and
    sinking as the body tumbles (stamped over the soot: they stay white)."""
    pts = [(-9, -10), (8, -12), (-12, 2), (11, 0), (2, -15), (-4, 9)]
    t = (k + 1) * 0.6
    out = []
    for i, (x, y) in enumerate(pts[:n]):
        px, py = C0[0] + x * (1 + t * 0.35), C0[1] + y * (1 + t * 0.25) + t * 1.2
        rows = FEATHERS[(i + k) % 4]
        out.append(((rows, (len(rows[0]) // 2, len(rows) // 2)), (px, py)))
    return out


def die_blast():
    """Blown up (47 ticks): scorched in the flash, wings clamped, it somersaults through the air
    shedding white feathers (two smears: the fastest turns, with a smoke streak), and lands belly
    down, sooty and dazed, the far wing sticking up crooked, the smoke curling up."""
    S = []
    for k, pt in enumerate([15, 55, 95, 135, 200, 240, 280]):
        S.append((dict(both(W(-12, 0.95, -4)), pitch=pt, face='sootx', beak='gape' if k < 3 else 'open',
                       hd=(-1.0, 1.4), ha=-24, tail=4, fan=1.5, legs='dangle', feet=CURL), True))
    flat = dict(wN=W(-12, 0.95, -4), wF=W(58, 0.4, -30), pitch=-4, hd=(0.6, 3.4), ha=-8, face='sootx',
                beak='open', tail=6, fan=2.4)
    S += [(dict(flat), False), (dict(flat, wF=W(50, 0.45, -24), face='soot'), False),
          (dict(flat, wF=W(46, 0.5, -20), beak='shut'), False)]
    out = []
    for k, (p, air) in enumerate(S):
        fx = _feathers(k, 5 - k // 2) if k < 5 else []
        if k in (3, 6):
            fx += [('smk2', (C0[0] - 12, C0[1] + 2)), ('smk0', (C0[0] - 16, C0[1] + 4))]
        if k >= 7:
            fx += [('smk1', (C0[0] - 6, C0[1] - 6 - (k - 7) * 2)), ('smk0', (C0[0] + 2, C0[1] - 10 - (k - 7) * 3))]
        out.append(dead(p, air=air, remap=PL.SOOT, fx=fx, smear=(k in (3, 6))))
    return lift_air(out)


def die_burn():
    """Burnt (62 ticks): the tail catches (wide eyes), it flaps in a panic as the flames climb, it
    is engulfed and roasted golden brown and tips over (a smear: the fall), lands on its back as a
    roast with its drumsticks up, steaming; a blink; the last frame holds."""
    S = [(dict(both(W(60, 0.1, 10)), pitch=12, face='wide', beak='gape', tail=10, fan=2), True, None,
          [('fl0', (-9, 1)), ('fl0', (-12, 2))], False),
         (dict(both(W(40, 0.2, 14)), pitch=20, face='wide', beak='gape', tail=8, fan=2), True, None,
          [('fl1', (-9, 1)), ('fl0', (-2, -4)), ('fl0', (-13, 0))], False),
         (dict(both(W(38, 0.3, 4)), wN2=W(6, 0.7, -4), wF2=W(14, 0.7, -4), pitch=36, face='soot', beak='gape',
               tail=6), True, PL.ROAST, [('fl2', (-4, 0)), ('fl1', (4, -4)), ('fl0', (-10, -2))], True),
         (dict(wN=W(-10, 0.85, -4), wF=W(10, 0.85, -4), pitch=150, face='soot', beak='open',
               legs='dangle', feet=LEGS_UP), True, PL.ROAST, [('fl1', (0, -4)), ('fl0', (-6, -2))], False)]
    roast = dict(wN=W(-30, 0.95, -4), wF=W(-6, 0.95, -4), pitch=180, face='soot', beak='open', legs='dangle',
                 feet=LEGS_UP)
    S += [(dict(roast), False, PL.ROAST, [('smk1', (-2, -14)), ('fl0', (4, -6))], False),
          (dict(roast, beak='shut'), False, PL.ROAST, [('smk2', (0, -18)), ('smk0', (-5, -13))], False),
          (dict(roast, beak='shut', face='sootx'), False, PL.ROAST, [('smk0', (2, -20)), ('smk2', (-4, -16))], False),
          (dict(roast, beak='shut', face='soot'), False, PL.ROAST, [('smk2', (-1, -22)), ('smk0', (3, -15))], False)]
    out = []
    for p, air, remap, fx, sm in S:
        b = G.draw(p)
        rows, _, j = G.finish(b)
        if remap:
            rows = [''.join(remap.get(ch, ch) for ch in r) for r in rows]
        ys = [y for y, r in enumerate(rows) if r.strip('.')]
        root = (C0[0], C0[1] + DROP) if air else (C0[0], max(ys) + 1)
        base = C0[1] if air else root[1] - 6
        rows = stamp(rows, [(n, (C0[0] + x, base + y)) for n, (x, y) in fx])
        f = X.Frame(rows, root, pts={'head': j['head'], 'mouth': j['beak']}, smear=sm, joints=j)
        f.air = air
        out.append(f)
    return lift_air(out)


def die_crush():
    """Crushed (47 ticks): it looks up and flinches (wings up, head pulled in), the impact squashes
    it (a smear), flat as a pancake with the wings spread on the cobbles, it springs up a little,
    flattens again with stars, blinks."""
    look = dict(both(W(66, 0.3, -8)), pitch=20, hd=(-1.0, 1.2), ha=30, face='wide', beak='open',
                legs='tuck')
    flat = dict(wN=W(-12, 0.95, -4), wF=W(-4, 0.95, -4), pitch=0, hd=(0.6, 3.0), ha=-6, face='x', beak='open',
                fan=3, legs='dangle', feet={'N': (2.6, 6.0), 'F': (-2.4, 5.6), 'kN': 'flat', 'kF': 'flat'})
    out = [dead(look, air=True),
           dead(dict(look, face='x'), air=False, squash=(1.18, 0.5, None), smear=True),
           dead(flat, air=False, squash=(1.2, 0.42, None)),
           dead(dict(flat, beak='shut'), air=False, squash=(1.06, 0.7, None)),
           dead(dict(flat, face='x', beak='shut'), air=False, squash=(1.18, 0.44, None)),
           dead(dict(flat, face='shut', beak='shut'), air=False, squash=(1.18, 0.44, None))]
    for k in (3, 4, 5):                        # stars over the pancake (FX), as the handhaver's crush
        f = out[k]
        top = min(y for y, r in enumerate(f.rows) if r.strip('.'))
        sx = [(-8, -4), (6, -6), (-2, -8)][k - 3]
        f.rows = stamp(f.rows, [('star', (C0[0] + sx[0], top + sx[1])), ('star', (C0[0] - sx[0] + 3, top + sx[1] + 2))])
    return out


def feather():
    """A loose feather (the death puff FX): it rocks to and fro as it drifts down."""
    base = ["..1112", "112223", ".33..."]
    out = []
    for deg in (-36, -20, 0, 20, 36, 20, 0, -20):
        g = ['.' * 11] * 2 + ['..' + r.ljust(9, '.') for r in base] + ['.' * 11] * 4
        rot = [list(r) for r in rig.rotsprite(g, (5, 3), deg)]
        h, w = len(rot), len(rot[0])
        res = [r[:] for r in rot]
        for y in range(h):
            for x in range(w):
                if rot[y][x] == '.' and any(0 <= x + dx < w and 0 <= y + dy < h and rot[y + dy][x + dx] != '.'
                                            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    res[y][x] = 'K'
        out.append(X.Frame([''.join(r) for r in res], (5, 4)))
    return out


# ------------------------------------------------------------------------------------ build
def build(s):
    s.strip('walk', walk(), [2, 2, 2, 3, 3, 3, 2, 3, 3, 2, 3, 3], cls='flap',
            why='the flight flap: a flap cycle (class ride, 12 frames), no floor contact')
    s.strip('idle', idle(), [2, 2, 2, 2, 2, 2, 2, 3, 2, 2, 2, 3], cls='flap',
            why='a flying gull has no standing idle: the hover is a slow, shallow flap (12 frames)')
    s.strip('takeoff', takeoff(), [2, 2, 1, 1, 2, 2], loop=False, cls='jump')
    s.strip('pull-up', pull_up(), 1, loop=False, cls='jump')
    s.strip('turn', turn(), 2, cls='turn')
    s.strip('tell', tell(), [3, 2, 2, 3, 3, 2, 2, 3], cls='telegraph')
    s.strip('attack', attack(), 2, cls='shoot')
    s.strip('perch', perch(), [16, 8, 16, 10], cls='idle-breathing')
    s.strip('gag', gag(), [10, 8, 10, 8, 6, 6, 6, 6], cls='idle-fidget')
    s.strip('gag-fries', gag_fries(), [8, 4, 2, 6, 5, 3, 8, 10], cls='idle-fidget')
    s.strip('alert', alert(), [4, 2, 2, 4], cls='telegraph')
    s.strip('photo-pose', photo_pose(), [6, 4, 4, 6, 4, 4], cls='victory')
    s.strip('gloat', gloat(), [10, 4, 2, 8, 8, 6, 6], defer=True, cls='victory')
    s.event('GLOAT_PECK', GLOAT_PECK)
    s.strip('cower', cower(), 3, defer=True, cls='reaction')
    s.strip('die', die(), [3, 4, 4, 4, 4, 4, 4, 3, 5, 17], loop=False, cls='death-shot')
    s.strip('die-blast', die_blast(), [4, 4, 4, 4, 4, 4, 4, 5, 6, 8], loop=False, cls='death-blast')
    s.strip('die-burn', die_burn(), [4, 4, 5, 6, 6, 8, 9, 20], loop=False, cls='death-burn')
    s.strip('die-crush', die_crush(), [4, 2, 14, 6, 8, 13], loop=False, cls='death-crush')
    s.strip('feather', feather(), 3, cls='prop')
