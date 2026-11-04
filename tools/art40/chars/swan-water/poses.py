# The poses of the water and air strips: one dict per picture (the core's pose keys, tools/art40/
# chars/swan/poses.py, plus the keys of render.py: wings, water, foam, splash, neckpose + gun).
#
# Heights (swan-local, the feet anchor at y = 0): on the water the anchor is the float line
# (SWAN.swimDepth 16 under the surface), so the surface is y = SURFACE (-16). Swimming, the body
# sits 14 px lower than standing (the hull 4-5 px under the surface, the seat at -34: the wave 1
# look); ducked 8 px lower again (SWAN 'duck sinks 8'). In the air the anchor is the entity's foot
# line as on the ground, so the flying body keeps the standing height (dy about 0).
import math

import art40 as X

from . import render as R
from . import wings as WG

S = X.char('swan')
PO = S.PO

SURFACE = R.SURFACE
SWIM_DY = 18                        # the deck (perch) at -30 and the seat at -30: PERCH_TOP.swim, SEAT_POINT.swim (D7)
DUCK_DY = 22                        # ducked: the socket 5 px over the surface (swan-neck DUCK_SURFACE); the deck at -25


def ease(t):
    return 0.5 - 0.5 * math.cos(math.pi * t)


def lerp(a, b, t):
    return a + (b - a) * t


# ------------------------------------------------------------------ the legs
# Under water: the paddle stroke of one foot by phase k (0..N-1): the power stroke (the web spread,
# swept back low under the belly) for the first half, the recovery (the web folded, drawn forward
# close to the belly) for the second. Swan-local ankles (the body's dy is added by the caller).
def paddle_foot(k, n, dy, reach=1.0):
    k %= n
    half = n // 2
    if k < half:
        t = ease(k / (half - 1)) if half > 1 else 0.0
        x = lerp(7, -9, t) * reach
        y = -7 + 2.5 * math.sin(math.pi * t) + dy - SWIM_DY
        return (x, y), 'S'
    t = ease((k - half + 1) / half)
    x = lerp(-9, 7, t) * reach
    y = -8.5 - 1.5 * math.sin(math.pi * t) + dy - SWIM_DY
    return (x, y), 'F'


# in the air: the legs stretched back under the tail, the webs closed and trailing ('T')
AIR_LEGS = (((-21, -27), 'T'), ((-18, -25.5), 'T'))


def air_legs(dy=0.0, dx=0.0, swing=0.0):
    (fa, fs), (na, ns) = AIR_LEGS
    return (((fa[0] + dx - swing, fa[1] + dy), fs), ((na[0] + dx + swing, na[1] + dy), ns))


# ------------------------------------------------------------------ swim (12 frames, a paddle cycle)
# Two strokes a cycle (the near web on frames 0-5, the far web on 6-11): on each power stroke she
# surges and sinks 1 px, the raised wings (the mute swan's 'busk' carriage, arched over her back)
# and the tail answer one frame late; the wake drifts back on the surface.
SWIM_N = 12


def far_paddle(k, n, dy):
    """The far web's stroke: a shorter sweep 1 px higher (it is further from the eye), so the two
    strokes of a cycle read as two feet (near on 0-5, far on 6-11), not one stroke drawn twice."""
    (x, y), st = paddle_foot(k, n, dy, reach=0.65)
    return (x + 1.5, y - 1.0), st

SWIM_STROKE_A = 0                   # the near web's power stroke starts (swan/paddle)
SWIM_STROKE_B = SWIM_N // 2         # the far web's
SWIM_BOB = [0, 0, 1, 1, 1, 0]
SWIM_WING = [0.0, 0.3, 0.7, 1.0, 0.8, 0.4]


def swim_pose(i):
    h = i % 6
    lag = (i - 1) % 6
    dy = SWIM_DY + SWIM_BOB[h]
    w = SWIM_WING[lag]
    return dict(dy=dy, farwing='busk', lift=1.6 + w * 0.8, wlift=2.6 + w, arch=1.0 + w * 0.6, tail=0.6 + w * 0.6,
                paddle=(far_paddle(i + SWIM_N // 2, SWIM_N, dy), paddle_foot(i, SWIM_N, dy)),
                water=SURFACE, foam=dict(moving=True, bow=0.6 + 0.6 * (1 - abs(h - 2.5) / 2.5), wake=True),
                rider=('ride_sit', 1 if SWIM_BOB[h] else 0))


SWIM = [swim_pose(i) for i in range(SWIM_N)]


# ------------------------------------------------------------------ water-duck (4 frames, a breath)
# Ducked under fire: 8 px deeper, the wings pressed flat, the webs still under her; she breathes
# (the back rises 1 px, the wing tips lift) and the ripples ring out round her hull.
def duck_pose(i):
    b = [0, 0, 1, 1][i]
    wl = [0.0, 0.9, 1.4, 0.5][i]
    dy = DUCK_DY + 1 - b
    return dict(dy=dy, farwing='fold', lift=wl * 0.6, wlift=wl, tail=0.2 + wl * 0.5, puff=wl * 0.4,
                tucked=(((5 + i % 2, -10.5), 'F'), ((9 - i % 2, -10.5), 'S')),
                water=SURFACE, foam=dict(moving=False, bow=0.0, wake=False, ring=i),
                rider=('ride_hunch', 0))


WATER_DUCK = [duck_pose(i) for i in range(4)]




def wing(p, **kw):
    """A wing spec at beat phase p (wings.beat) with overrides."""
    d = WG.beat(p)
    d.update(kw)
    return d


def sit_neck(t):
    """The neck between the parked S (t = 0) and the standing rest S (t = 1)."""
    a, b = PO.NECK_SIT, PO.NECK_REST
    return dict(c1=PO.lerp(a['c1'], b['c1'], t), c2=PO.lerp(a['c2'], b['c2'], t), head=PO.lerp(a['head'], b['head'], t),
                ang=PO.lerp(a['ang'], b['ang'], t))


STAND = PO.STAND
GA = PO.GA
SIT = PO.SIT

# ------------------------------------------------------------------ paddle-up (4 frames, 8 ticks)
# The take-off from the water (SWAN.waterSquatTicks 8, then the jump): she rears up out of the water
# (the deck 12 -> 1 px under the standing height) and RUNS on the surface, the webs slapping it in
# turn (a splash under each), the wings beating hard: up (the anticipation), the downstroke (a
# smear), the upstroke, up again for the launch. The rider holds on (frames 0-2), then leans in.
PADDLE_UP = [
    dict(dy=11, tilt=-2, paddle=(((-4, -7), 'F'), ((4, -8), 'S')),
         wings=dict(e=42, b=22, eh=36, bh=52, spread=0.5, sec=0.85, prim=0.9), tail=1.0, water=SURFACE,
         foam=dict(moving=True, bow=1.4, wake=True), splash=((-14, 0.5, 0),), rider=('ride_hold', 0)),
    dict(dy=8, tilt=-4, paddle=(((-1, -12), 'F'), ((6, -13), 'S')),
         wings=dict(e=55, b=16, eh=54, bh=38, spread=0.7, sec=0.95, prim=0.95, tone=1), tail=1.6, water=SURFACE,
         foam=dict(moving=True, bow=1.0, wake=True), splash=((8, 0.7, 0), (-12, 0.5, 1)), rider=('ride_hold', 1)),
    dict(dy=5, tilt=-6, paddle=(((1, -16), 'F'), ((7, -17), 'S')),
         wings=dict(e=66, b=11, eh=74, bh=27, spread=0.85, sec=1.0, prim=1.0, tone=1), tail=2.0, water=SURFACE,
         foam=dict(moving=True, bow=0.6, wake=True), splash=((8, 0.8, 1), (2, 0.5, 2)), rider=('ride_hold', 0)),
    dict(dy=1, tilt=-6, legs=(((0, -21), 'P'), ((5, -22), 'P')),
         wings=dict(e=82, b=6, eh=96, bh=18, spread=0.9, sec=1.0, prim=1.0), tail=2.2, water=SURFACE,
         foam=dict(moving=True, bow=0.3, wake=True), splash=((3, 1.0, 1), (9, 0.6, 2)), rider=('ride_lean', 0)),
]

# ------------------------------------------------------------------ settle (2 frames, 4 ticks)
# The splash-down (frame roles the game picks: settleIn 0 then 1; out of the water onto a bank 1):
# 0 the contact: she skis in on her webs, the wings flared high as air brakes, the spray thrown
#   up and forward; 1 she sinks into the swim line, the wings closing over her back, the spray
#   falling.
SETTLE = [
    dict(dy=8, tilt=-4, paddle=(((11, SURFACE + 1), 'U'), ((14, SURFACE + 2), 'U')),
         wings=dict(e=60, b=10, eh=78, bh=22, spread=1.0, sec=1.0, prim=1.0, tone=1), tail=2.5, water=SURFACE,
         foam=dict(moving=True, bow=1.6, wake=False), splash=((14, 1.0, 1), (-6, 0.6, 0)), rider=('ride_brace', 0)),
    dict(dy=12, tilt=-2, paddle=(((10, -11), 'S'), ((13, -10), 'S')),
         wings=dict(e=58, b=18, eh=64, bh=42, spread=0.6, sec=0.9, prim=0.9), tail=1.8, water=SURFACE,
         foam=dict(moving=True, bow=1.0, wake=True), splash=((12, 0.8, 2),), rider=('ride_sit', 0)),
]

# ------------------------------------------------------------------ flap (4 frames, 6 ticks)
# The glide opens with one hard beat (SWAN.glideFlapVy: her only lift): the wings snap up (the
# anticipation, 1 tick), the downstroke (a smear), the bottom of the stroke (she rises 1 px, the
# hand whips through), the wings come up into the glide's V.
FLAP_D = [2, 1, 1, 2]
FLAP = [
    dict(dy=1, tilt=1, legs=air_legs(1), wings=dict(e=84, b=6, eh=100, bh=16, spread=0.8, sec=1.0, prim=1.0, tone=1),
         tail=2.0, rider=('ride_hold', 0)),
    # the downstroke: the wing just leaving the top, the sweep down to the bottom smeared after it
    dict(dy=0, tilt=0, legs=air_legs(0), wings=dict(e=74, b=8, eh=80, bh=20, spread=1.0, sec=1.0, prim=1.0,
                                                  smear=(-36, -50)), tail=1.5, smear=True, rider=('ride_hold', 1)),
    # the bottom: the hand whips through, then sweeps back up into the V (smeared)
    dict(dy=-1, tilt=-1, legs=air_legs(-1, swing=1), wings=dict(e=-34, b=10, eh=-48, bh=22, spread=1.0, sec=1.0, prim=1.0,
                                                             smear=(16, 10)), tail=0.5, smear=True, rider=('ride_hold', 0)),
    # ... and sweeps back into the glide's held wing (GW: raised, swept back past the rider)
    dict(dy=-1, tilt=0, legs=air_legs(-1), wings=dict(e=40, b=32, eh=46, bh=50, spread=1.0, sec=1.0, prim=1.0),
         tail=1.0, rider=('ride_hold', 1)),
]


# ------------------------------------------------------------------ glide (4 frames x 4 ticks)
# Soaring on a held V (the far wing higher): the hands flex on the air (the tips lift as the body
# dips 1 px, the primaries fan and close), the tail trims. The rider dips with her on GLIDE_DIP_FROM.
GLIDE_DIP_FROM = 2
# The held wing: raised and swept well back (b 45: the arm reaches behind the rider's back), so the
# broad plate and the primaries show past his silhouette over the tail; a low sweep (b 12) stood the
# wing up behind the saddle, where the rider hid it.
GW = dict(e=55, eh=60, b=45, bh=65)


def glide_pose(i):
    dip = 1 if i >= GLIDE_DIP_FROM else 0
    e = [GW['e'], GW['e'] - 2, GW['e'] - 5, GW['e'] - 2][i]
    eh = [GW['eh'], GW['eh'] + 4, GW['eh'] + 6, GW['eh'] + 2][i]
    return dict(dy=dip, tilt=[2, 1, 2, 3][i], legs=air_legs(dip), tail=[1.0, 1.4, 1.6, 1.2][i],
                wings=dict(e=e, b=GW['b'], eh=eh, bh=GW['bh'], spread=[1.0, 0.9, 0.8, 0.95][i], sec=1.0, prim=1.0),
                rider=('ride_lean', dip))


GLIDE = [glide_pose(i) for i in range(4)]


# ------------------------------------------------------------------ glide-tired (4 frames x 2 ticks)
# The last 12 ticks of the glide (swan/tired): the spent wings sag and tremble, the hands droop,
# the legs come down, the tail is pressed down.
def tired_pose(i):
    dip = 1 if i >= GLIDE_DIP_FROM else 0
    e = [16, 11, 14, 9][i]
    return dict(dy=dip, tilt=4, legs=(((-8 + i % 2, -16 + dip), 'D'), ((-4, -15 + dip), 'D')), tail=-0.5,
                wings=dict(e=e + 14, b=GW['b'], eh=e - 4 - 3 * (i % 2), bh=GW['bh'] + 8, spread=0.7 + 0.15 * (i % 2), sec=0.95, prim=0.95),
                rider=('ride_hold', dip))


GLIDE_TIRED = [tired_pose(i) for i in range(4)]

# ------------------------------------------------------------------ fold (1 frame, 2 ticks)
# The wings fold (released, tired, a landing, 0 cells): swept back and closing onto her back, the
# legs come down for the floor (the fall follows).
FOLD = [
    dict(dy=0, tilt=1, legs=(((-2, -10), 'D'), ((3, -9), 'D')), tail=1.5,
         wings=dict(e=42, b=58, eh=18, bh=118, spread=0.25, sec=0.65, prim=0.75, tone=1), rider=('ride_sit', 0)),
]


# ------------------------------------------------------------------ honk in the air (10 frames x 2 ticks)
# The HONK wind-up holds her still in the air (vy 0): she rears back, the wings cup forward and
# climb to a high brake, the tail fans (frames 0-4); on HONK_BLAST (5, tick 10: the ring leaves)
# the wings crack down (a smear) and she jolts back (the recoil); she drifts back into the glide.
def honk_air_pose(i):
    e = [30, 40, 50, 60, 70, 66, -16, -2, 12, 24][i]
    eh = [34, 48, 62, 78, 92, 80, -32, -12, 12, 28][i]
    b = [12, 8, 4, 2, 0, 2, 12, 12, 12, 12][i]
    dy = [0, -1, -1, -2, -2, -1, 1, 1, 0, 0][i]
    tilt = [0, -1, -3, -5, -6, -3, 3, 2, 1, 0][i]
    spec = dict(e=e, b=b, eh=eh, bh=b + 14, spread=1.0, sec=1.0, prim=1.0, tone=1 if 2 <= i <= 4 else 0)
    if i == 5:
        spec['smear'] = (-12, -26)          # the crack down: the sweep to the bottom smeared after the wing
    legs = air_legs(dy, dx=[0, 1, 2, 3, 4, 4, 3, 2, 1, 0][i], swing=[0, 0.5, 1, 1.5, 2, 1, 0, -0.5, 0, 0][i])
    return dict(dx=[0, 0, -1, -1, -1, -2, -1, 0, 0, 0][i], dy=dy, tilt=tilt, legs=legs, wings=spec,
                tail=[1.0, 1.8, 2.6, 3.2, 3.6, 4.0, 3.0, 2.0, 1.4, 1.0][i], puff=[0, 0.5, 1, 1.5, 2, 0.5, 0, 0, 0, 0][i],
                smear=i == 5, rider=('ride_ears', i % 2))


HONK_AIR = [honk_air_pose(i) for i in range(10)]


# ------------------------------------------------------------------ honk on the water (10 frames x 2 ticks)
# The busking display on the water: the wings lift off her back and arch up like sails, the breast
# rises out of the water (frames 0-4); on HONK_BLAST the wings flare up and open (a smear), she
# jolts back and the water bursts round her breast; then the wings sink back to the swim carriage.
def honk_swim_pose(i):
    e = [14, 26, 35, 44, 52, 58, 74, 56, 38, 22][i]
    b = [64, 54, 46, 40, 32, 26, 10, 26, 44, 58][i]
    eh = [-8, 0, 8, 14, 20, 30, 86, 52, 16, -2][i]
    bh = [110, 100, 90, 82, 74, 66, 24, 58, 90, 104][i]
    dyo = [1, 1, 0, -1, -2, -2, -1, 0, 0, 1][i]
    dy = SWIM_DY + dyo
    spec = dict(e=e, b=b, eh=eh, bh=bh, spread=[0.3, 0.4, 0.5, 0.6, 0.6, 1.0, 1.0, 0.8, 0.5, 0.35][i],
                sec=[0.7, 0.75, 0.8, 0.85, 0.85, 1.0, 1.0, 0.9, 0.8, 0.7][i], prim=0.9)
    if i == 5:
        spec['smear'] = (80, 90)            # the flare: the sweep up to the open wings smeared after it
    sp = ()
    if i == 5:
        sp = ((14, 0.8, 0),)
    elif i == 6:
        sp = ((14, 1.0, 1), (-16, 0.5, 0))
    elif i == 7:
        sp = ((14, 0.9, 2), (-16, 0.6, 1))
    return dict(dx=[0, 0, 0, 0, 0, -1, -1, 0, 0, 0][i], dy=dy, tilt=[0, 0, -1, -2, -3, 1, 1, 0, 0, 0][i],
                paddle=(paddle_foot(i + 6, 12, dy), paddle_foot(i, 12, dy)), wings=spec,
                tail=[0.8, 1.2, 1.8, 2.4, 3.0, 3.6, 3.2, 2.2, 1.4, 1.0][i], puff=[0, 0.5, 1.0, 1.5, 2.0, 1.0, 0.5, 0.2, 0, 0][i],
                water=SURFACE, foam=dict(moving=False, bow=0.6 if i in (5, 6) else 0.2, wake=False, ring=None if i < 5 else i - 5),
                splash=sp, smear=i == 5, rider=('ride_ears', i % 2))


HONK_SWIM = [honk_swim_pose(i) for i in range(10)]

# ------------------------------------------------------------------ rise (6 frames x 2 ticks)
# A rider mounts her where she sits (SWAN.riseTicks 12): she dips her head (the anticipation),
# pushes the breast up on her webs, the knees straighten (the wings lift for balance), she
# overshoots onto her toes and settles into the standing rest; the neck reaches the rest S last,
# where the neck strip takes over. The neck and the level gun are in the picture.
RISE = [
    dict(SIT, dy=1, gun=0, lift=0.5, wlift=0.3, puff=0.3, neckpose=dict(sit_neck(0.0), head=(21, -42), ang=-12),
         rider=('ride_sit', 0)),
    dict(SIT, sy=0.8, tilt=-3, dy=-6, gun=0, farwing=('fold', 'arch', 0.25), lift=0.6, wlift=0.8, tail=1.0, puff=0.6,
         neckpose=dict(sit_neck(0.2), head=(22, -48), ang=-8), rider=('ride_brace', 0)),
    # the push (a smear: the legs snap straight, the body stretched up after them)
    dict(legs=(((6, GA['S']), 'S'), ((11, GA['S']), 'S')), dy=15, tilt=-5, sy=1.0, farwing=('fold', 'arch', 0.45),
         lift=0.8, wlift=1.6, tail=1.8, puff=0.6, gun=0, smear=True,
         neckpose=dict(sit_neck(0.4), head=(22, -52), ang=-4), rider=('ride_brace', 1)),
    dict(legs=(((0, GA['P']), 'P'), ((6, GA['P']), 'P')), dy=4, tilt=-3, farwing=('fold', 'arch', 0.85), lift=1.0,
         wlift=1.8, tail=1.4, puff=0.4, gun=0, neckpose=dict(sit_neck(0.8), head=(20, -63), ang=3), rider=('ride_sit', 1)),
    dict(legs=(((-3, GA['S']), 'S'), ((4, GA['S']), 'S')), dy=1, tilt=-1, farwing='arch', lift=0.9, wlift=1.0, tail=0.8,
         puff=0.3, gun=0, neckpose=dict(sit_neck(0.95), head=(19, -67), ang=1), rider=('ride_sit', 0)),
    dict(legs=STAND, dy=0, farwing='arch', lift=0.8, wlift=0.6, tail=0.5, gun=0, neckpose=dict(PO.NECK_REST),
         rider=('ride_sit', 0)),
]
RISE_D = [3, 4, 1, 2, 1, 1]

# ------------------------------------------------------------------ sit-down (6 frames, 20 ticks)
# Left alone on land (SWAN.sitTicks 20): she lowers her rear first (the knees fold, the tail
# drops), lets the breast down, wiggles the feathers flat (the shuffle) and settles into the parked
# sit with the neck relaxed (the RIDE? bubble on the last frame).
SIT_D = [5, 4, 4, 3, 2, 2]
SIT_DOWN = [
    dict(legs=STAND, dy=2, tilt=-2, farwing='arch', lift=0.6, wlift=0.4, tail=0.3, gun=0, neckpose=dict(sit_neck(0.9))),
    dict(legs=(((-3, GA['S']), 'S'), ((4, GA['S']), 'S')), dy=9, tilt=-5, sy=0.92, farwing=('arch', 'fold', 0.2),
         lift=0.8, wlift=0.8, tail=0.0, gun=0, neckpose=dict(sit_neck(0.7))),
    dict(legs=(((1, GA['S']), 'S'), ((7, GA['S']), 'S')), dy=18, tilt=-4, sy=0.84, farwing=('arch', 'fold', 0.55),
         lift=1.2, wlift=1.0, tail=0.3, puff=0.3, gun=0, neckpose=dict(sit_neck(0.45))),
    dict(SIT, sy=0.78, tilt=-1, dy=0, lift=1.4, wlift=1.4, ruffle=1.0, tail=1.0, puff=0.6, neckpose=dict(sit_neck(0.25))),
    dict(SIT, dx=0.6, tilt=1, lift=0.8, wlift=0.6, ruffle=0.4, tail=0.6, puff=0.3, neckpose=dict(sit_neck(0.1))),
    dict(SIT, lift=0.0, wlift=0.0, tail=0.0, neckpose=dict(PO.NECK_SIT)),
]
SIT_BUBBLE_FROM = 5

# ------------------------------------------------------------------ dive (12 frames, DIVE_PX a frame)
# The SWAN DIVE charge (riderless): neck stretched low and forward, the bill open (hissing), the
# wings arched up and half open like sails, flapping with the stride; long sprinting strides: each
# web planted for 5 frames (DIVE_PX back a frame: no foot slide), 7 in the air, both off the
# ground on frames 5 and 11 (a sprint's flight phase). The body is lowest as the planted web passes
# under the hips and highest in the flight phase.
DIVE_N = 12
DIVE_PX = 8
DIVE_TPF = 3                                     # the strip's own timing (8 px at the charge's 3.4 px/tick: 2.4)
DIVE_STANCE = 5
DIVE_STRIDE = DIVE_PX * (DIVE_STANCE - 1)        # 32 px
DIVE_X0 = 0.0
DIVE_LIFT = 5
DIVE_DY = [6, 6, 7, 7, 5, 3]
DIVE_TILT = [9, 8, 8, 9, 10, 10]


def dive_foot(k):
    k %= DIVE_N
    half = DIVE_STRIDE / 2
    if k < DIVE_STANCE:
        x = half - DIVE_PX * k + DIVE_X0
        st = 'U' if k == 0 else 'P' if k == DIVE_STANCE - 1 else 'S'
        return (x, GA[st]), st
    t = (k - DIVE_STANCE + 1) / (DIVE_N - DIVE_STANCE + 1)
    x = -half + DIVE_STRIDE * ease(t) + DIVE_X0
    y = GA['S'] - DIVE_LIFT * math.sin(math.pi * t)
    return (x, y), ('F' if t < 0.7 else 'U')


def dive_pose(i):
    h = i % 6
    lag = (i - 1) % 6
    near, far = dive_foot(i), dive_foot(i + DIVE_N // 2)
    dy = DIVE_DY[h]
    w = [0.0, 0.25, 0.5, 0.75, 1.0, 0.5][lag]
    hy = DIVE_DY[lag] - 3
    plant = near[0][0] if i % DIVE_N < DIVE_STANCE else far[0][0] if DIVE_N // 2 <= i < DIVE_N // 2 + DIVE_STANCE else None
    p = dict(legs=(far, near), dy=dy, tilt=DIVE_TILT[h], tail=1.5 + w,
             wings=dict(e=46 + 14 * w, b=40 - 8 * w, eh=30 + 22 * w, bh=80 - 16 * w, spread=0.6 + 0.3 * w, sec=0.85, prim=0.9),
             gun=-10, neckpose=dict(c1=(30, -44 + dy), c2=(36, -38 + hy), head=(44, -37 + hy), ang=-6, face='open'))
    if plant is not None:
        p['plant'] = plant
    return p


DIVE = [dive_pose(i) for i in range(DIVE_N)]


# ------------------------------------------------------------------ migrate (12 frames x 2 ticks)
# Lost: she flies away up and forward (migrateVx 1, migrateVy -1.5): one full wing beat a cycle
# (the downstroke on frames 0-4: she rises 1 px; the folded upstroke on 5-11: she sinks), the neck
# stretched out ahead, the legs trailing; she honks once a cycle (the bill open on 3-5).
MIGRATE_N = 12
MIGRATE_TPF = 3                  # a 36-tick beat: the big bird's slow, deep strokes


def migrate_pose(i):
    p = i / MIGRATE_N
    w = WG.beat(p)
    dy = [0, -1, -1, -2, -2, -2, -1, -1, 0, 0, 0, 0][i]
    nod = [0, 0, 1, 1, 1, 0, 0, -1, -1, -1, 0, 0][i]
    return dict(dy=dy, tilt=-12, legs_rel=True, legs=(((-17, -12), 'T'), ((-15, -11), 'T')), tail=1.5, wings=w, gun=0,
                neckpose=dict(rel=True, c1=(8, -5), c2=(18, -10 + nod * 0.5), head=(27, -12 + nod), ang=4,
                              face='open' if 3 <= i <= 5 else 'n'))


MIGRATE = [migrate_pose(i) for i in range(MIGRATE_N)]
