# The Swan's poses: one dict per picture, read by render() (__init__.py).
#
# Keys (all optional unless said):
#   dx, dy, tilt, sy   the body transform (swan-local px; tilt + = clockwise; sy < 1 presses her flat)
#   ground             'body': dy is computed so the lowest hull pixel's outline sits on the floor
#                      (sitting, lying), then dy is added on top; 'feet' (default): dy as given
#   legs               ((far ankle, foot), (near ankle, foot)): swan-local ankles (body points when
#                      legs_rel); foot = a FOOT state ('S' flat, 'P' push-off, 'U' heel strike, 'F'
#                      folded, 'D' dangling, + 'v' for upside down) or None
#   tucked             ((far at, foot), (near at, foot)): the legs folded under her, only the web shows
#   farwing, lift      the far wing kind (body.FAR_WINGS) and how far its hand is raised
#   wlift, arch, ruffle  the folded near wing: tips raised, the whole wing arched (busking), fanned
#   tail, puff         the tail raised, the breast puffed forward
#   neck               dict(c1, c2, head, ang, face, flip) in swan-local px; or with rel=True relative
#                      to the socket in the body's frame (it turns with her); None = no neck (the
#                      ridden strips: the game draws the neck strip on the socket)
#   gun                the barrel's angle in the body frame (deg, y down) when the barrel is drawn
#                      in the picture (the riderless strips); None = the neck strip carries it
#   rider              (VINCENT's kit ride key, frame) for the review renders only
import math

# ------------------------------------------------------------------ the floor contact
# The ankle height that puts each web's bottom outline on the floor row (y = -1): the foot grids
# hang from the ankle (body.FOOT), so the ankle sits this far above the floor.
GA = {'S': -6, 'P': -7, 'U': -5}

STAND = (((-5, GA['S']), 'S'), ((3, GA['S']), 'S'))

NECK_REST = dict(c1=(32, -46), c2=(8, -58), head=(19, -68), ang=0)
NECK_RUN = dict(c1=(26, -47), c2=(30, -55), head=(37, -57), ang=6)


def neck(base, dy=0.0, dx=0.0, **kw):
    """A neck dict moved by (dx, dy) (the whole S with the body), with overrides."""
    n = dict(base)
    for k in ('c1', 'c2', 'head'):
        n[k] = (n[k][0] + dx, n[k][1] + dy)
    n.update(kw)
    return n


def lerp(a, b, t):
    if isinstance(a, tuple):
        return tuple(lerp(x, y, t) for x, y in zip(a, b))
    return a + (b - a) * t


def ease(t):
    return 0.5 - 0.5 * math.cos(math.pi * t)


# ------------------------------------------------------------------ idle (4 frames, a breath)
# The breath: she draws air (the breast fills, the wing tips rise), holds, sinks 1 px as she lets
# it go, the tail flicks once on the out-breath (secondary motion).
IDLE = [
    dict(legs=STAND, farwing='arch', lift=0.0, wlift=0.0, puff=0.0, tail=0.0, rider=('ride_sit', 0)),
    dict(legs=STAND, farwing='arch', lift=0.8, wlift=0.6, puff=0.6, tail=0.4, rider=('ride_sit', 0)),
    dict(legs=STAND, farwing='arch', lift=1.4, wlift=1.0, puff=0.9, tail=1.2, dy=1, rider=('ride_sit', 1)),
    dict(legs=STAND, farwing='arch', lift=0.6, wlift=0.4, puff=0.3, tail=0.6, dy=1, rider=('ride_sit', 1)),
]

# ------------------------------------------------------------------ the run (12 frames)
# The odometer picks one frame per RUN_PX (6) px (swan.ts): each foot is planted for 6 frames
# (heel strike 'U', flat 'S', push-off 'P'; 6 px back a frame, 30 px a stride: no foot slide) and
# swings for 6 (the web folds 'F', the toes come up 'U' for the next strike). The body is lowest
# when the planted foot passes under the hips and highest on the push; the wings and the neck trail
# the body by one frame (secondary motion: they lift on the push).
RUN_N = 12
RUN_PX = 6
STANCE = 6
STRIDE = RUN_PX * (STANCE - 1)          # 30 px: the planted foot's travel under her
RUN_CONTACT_A = 0                       # the near foot strikes (swan/step, dust)
RUN_CONTACT_B = RUN_N // 2              # the far foot strikes
RUN_X0 = -1.0                           # the stride's centre under the hips
RUN_DY = [1, 2, 3, 2, 0, -1]           # per half cycle: contact, load, passing (low), push, flight
RUN_TILT = [3, 2, 1, 1, 2, 3]
RUN_WING = [1.0, 2.0, 3.0, 4.0, 4.5, 3.0]


def run_foot(k):
    """One foot at frame k of the cycle (k = 0: its heel strike). Returns (ankle, foot state)."""
    k %= RUN_N
    half = STRIDE / 2
    if k < STANCE:
        x = half - RUN_PX * k + RUN_X0
        st = 'U' if k == 0 else 'P' if k == STANCE - 1 else 'S'
        return (x, GA[st]), st
    t = (k - STANCE + 1) / (RUN_N - STANCE + 1)
    x = -half + STRIDE * (1 - math.cos(math.pi * t)) / 2 + RUN_X0
    y = GA['S'] - 10 * math.sin(math.pi * t)
    return (x, y), ('F' if t < 0.7 else 'U')


def run_pose(i):
    h = i % 6
    lag = (i - 1) % 6                 # the wings and the neck answer the body one frame late
    near, far = run_foot(i), run_foot(i + RUN_N // 2)
    wl = RUN_WING[lag]
    hy = RUN_DY[lag] - 1
    return dict(legs=(far, near), dy=RUN_DY[h], tilt=RUN_TILT[h], farwing='half', lift=wl, wlift=wl + 2,
                tail=0.5 + wl * 0.3, plant=near[0][0] if i % RUN_N < STANCE else far[0][0],
                neckpose=dict(NECK_RUN, c2=(30, -55 + hy), head=(37, -57 + hy)),
                rider=('ride_lean', 1 if RUN_DY[h] >= 2 else 0))


RUN = [run_pose(i) for i in range(RUN_N)]

# ------------------------------------------------------------------ the jump: squat 2, jump 3, fall 2, land 3
# squat (4 ticks): the anticipation, she sinks on bent legs and the wings start to open
SQUAT = [
    dict(legs=STAND, dy=3, tilt=2, farwing='half', lift=1.0, wlift=1.5, tail=0.5, rider=('ride_hold', 0)),
    dict(legs=STAND, dy=6, tilt=4, farwing='half', lift=2.0, wlift=2.5, tail=1.0, puff=0.4, rider=('ride_hold', 1)),
]
# jump: the push-off (legs straight down and back, the toes last off the ground), the beat (the
# legs fold, the wings sweep), the tuck held while she rises
JUMP = [
    dict(legs=(((-10, -8), 'P'), ((-6, -7), 'P')), dy=-2, tilt=-4, farwing='half', lift=4.0, wlift=3.5, tail=1.5,
         rider=('ride_hold', 0)),
    dict(legs=(((-10, -12), 'F'), ((-6, -11), 'F')), dy=-2, tilt=-3, farwing='half', lift=6.0, wlift=3.0, tail=2.0,
         rider=('ride_lean', 0)),
    dict(legs=(((-7, -15), 'F'), ((-3, -14), 'F')), dy=-1, tilt=-2, farwing='half', lift=4.0, wlift=2.2, tail=1.5,
         rider=('ride_lean', 1)),
]
# fall: the legs reach down for the floor, the wings held up for balance, beating a little
FALL = [
    dict(legs=(((1, -8), 'D'), ((5, -7), 'D')), dy=0, tilt=1, farwing='half', lift=4.5, wlift=3.0, tail=2.0,
         rider=('ride_sit', 0)),
    dict(legs=(((0, -9), 'D'), ((6, -8), 'D')), dy=-1, tilt=0, farwing='half', lift=5.5, wlift=3.8, tail=2.6,
         rider=('ride_sit', 1)),
]
# land (4 ticks): the contact (knees take it), the deepest squash (the wings still up: follow-
# through), the rebound
LAND = [
    dict(legs=(((-3, GA['S']), 'S'), ((5, GA['S']), 'S')), dy=4, tilt=2, farwing='half', lift=5.0, wlift=3.5, tail=2.0,
         puff=0.3, rider=('ride_brace', 0)),
    dict(legs=(((-3, GA['S']), 'S'), ((5, GA['S']), 'S')), dy=7, tilt=4, farwing='half', lift=4.0, wlift=2.6, tail=1.5,
         puff=0.6, rider=('ride_brace', 1)),
    dict(legs=(((-3, GA['S']), 'S'), ((5, GA['S']), 'S')), dy=5, tilt=3, farwing='half', lift=3.2, wlift=2.0, tail=1.0,
         puff=0.4, rider=('ride_sit', 0)),
]
# stomp (4 ticks, in the air on an enemy's head): the feet slam down, then the spring off
STOMP = [
    dict(legs=(((-2, GA['S']), 'S'), ((4, GA['S']), 'S')), dy=4, tilt=3, farwing='half', lift=6.0, wlift=4.0, tail=2.0,
         rider=('ride_brace', 0)),
    dict(legs=(((-4, -8), 'P'), ((1, -7), 'P')), dy=1, tilt=0, farwing='half', lift=4.5, wlift=3.0, tail=1.2,
         rider=('ride_brace', 1)),
]
# skid (a reverse at speed): the brake (the webs thrown forward, toes up, the body back, the wings
# flared as air brakes), then the chatter of the webs on the stones (frames 1 and 2 alternate)
SKID = [
    dict(legs=(((11, GA['U']), 'U'), ((16, GA['U']), 'U')), dy=2, tilt=-7, farwing='raise', lift=0.0, wlift=4.0, tail=3.0,
         rider=('ride_up', 0)),
    dict(legs=(((12, GA['U']), 'U'), ((17, GA['U']), 'U')), dy=3, tilt=-9, farwing='raise', lift=2.0, wlift=5.0, tail=3.5,
         rider=('ride_up', 0)),
    dict(legs=(((13, GA['S']), 'S'), ((16, GA['U']), 'U')), dy=4, tilt=-8, farwing='raise', lift=1.0, wlift=4.5, tail=3.0,
         rider=('ride_up', 1)),
]

# ------------------------------------------------------------------ low: crouch, waddle, slide
# Pressed flat (sy) with her belly on the floor: the deck top at about -20 (PERCH_TOP.crouch,
# HURT crouch), the rider lies along her back. The legs fold under her; only the webs peek out.
LOW = dict(sy=0.74, ground='body', farwing='fold')
CROUCH = [
    dict(LOW, tucked=(((6, -12.5), 'S'), ((10, -12.5), 'S')), lift=0.0, wlift=0.0, puff=0.0, tail=0.0, rider=('ride_duck', 0)),
    dict(LOW, tucked=(((6, -12.5), 'S'), ((10, -12.5), 'S')), lift=0.6, wlift=0.6, puff=0.5, tail=0.5, rider=('ride_duck', 0)),
    dict(LOW, sy=0.77, tucked=(((6, -12.5), 'S'), ((10, -12.5), 'S')), lift=1.0, wlift=1.0, puff=0.8, tail=1.0, rider=('ride_duck', 1)),
    dict(LOW, sy=0.76, tucked=(((6, -12.5), 'S'), ((10, -12.5), 'S')), lift=0.4, wlift=0.4, puff=0.3, tail=0.5, rider=('ride_duck', 1)),
]
# the waddle: 7 frames, 3 px a frame (swan.ts: the odometer), small steps under her belly: each web
# is planted for 4 frames (3 px back a frame) and swings for 3 (lifted 2 px); the body rocks.
WADDLE_N = 7
WADDLE_PX = 3


def waddle_foot(k, centre):
    k %= WADDLE_N
    if k < 4:
        return centre + 4.5 - WADDLE_PX * k, 0.0, 'S'
    t = (k - 3) / 4
    return centre - 4.5 + 9 * ease(t), -2.0 * math.sin(math.pi * t), 'F' if t < 0.6 else 'U'


def waddle_pose(i):
    nx, ny, ns = waddle_foot(i, 9.0)
    fx, fy, fs = waddle_foot(i + 4, 8.0)
    rock = [0, 0, -1, -1, 0, -1, -1][i]
    return dict(LOW, dy=rock, tilt=[0, 1, 1, 0, -1, -1, 0][i], foot_rows=True,
                tucked=(((fx, -12.5 + fy), fs), ((nx, -12.5 + ny), ns)),
                plant=(nx if i < 3 else fx),
                lift=0.5 + 0.4 * (i % 3), wlift=0.6 + 0.5 * ((i + 1) % 3), tail=[0, 1, 2, 1, 0, 1, 2][i] * 0.6,
                rider=('ride_duck', i % 2))


WADDLE = [waddle_pose(i) for i in range(WADDLE_N)]
# the belly slide: nose up a little, the webs trailing behind, the wings half open, the body
# chattering on the stones
SLIDE = [
    dict(LOW, tilt=-1, tucked=(((-14, -13), 'F'), ((-10, -12.5), 'F')), lift=1.5, wlift=2.0, tail=2.0, puff=0.6,
         farwing='arch', rider=('ride_duck', 0)),
    dict(LOW, tilt=-2, sy=0.76, tucked=(((-15, -13), 'F'), ((-11, -12.5), 'F')), lift=2.5, wlift=3.0, tail=2.6, puff=0.6,
         farwing='arch', rider=('ride_duck', 1)),
    dict(LOW, tilt=-1, tucked=(((-14, -13), 'F'), ((-10, -12.5), 'F')), lift=2.0, wlift=2.4, tail=3.0, puff=0.4,
         farwing='arch', rider=('ride_duck', 0)),
    dict(LOW, tilt=0, sy=0.76, tucked=(((-13, -13), 'F'), ((-10, -12.5), 'F')), lift=1.0, wlift=1.6, tail=2.2, puff=0.6,
         farwing='arch', rider=('ride_duck', 1)),
]

# ------------------------------------------------------------------ honk (10 frames x 2 ticks)
# The wind-up (frames 0-4: she gathers, the breast fills, the wings arch up in the busking display
# and the far wing climbs), the HONK on frame HONK_BLAST = 5 (tick 10, the ring leaves: SWAN.honk
# windup): pushed up on her toes, the far wing flared high, the tail cocked; the hold and the settle.
HONK_BLAST = 5


def honk_pose(i):
    #            0    1    2    3    4    5     6     7    8    9
    puff = [0.5, 1.5, 2.5, 3.0, 3.5, 1.0, 0.6, 0.4, 0.2, 0.0][i]
    dy = [1, 2, 2, 1, 0, -1, -2, -1, 0, 1][i]
    tilt = [1, 0, -1, -1, -2, -3, -4, -3, -1, 0][i]
    arch = [0.5, 1.5, 2.5, 3.0, 3.5, 4.5, 4.0, 3.0, 2.0, 1.0][i]
    t = [0.1, 0.28, 0.46, 0.64, 0.82, 1.0, 0.9, 0.76, 0.6, 0.44][i]
    lift = 1.5
    tail = [0.5, 1.0, 1.5, 2.0, 2.5, 3.5, 3.5, 2.5, 1.5, 0.8][i]
    return dict(legs=STAND, dy=dy, tilt=tilt, puff=puff, arch=arch, farwing=('busk', 'raise', t), lift=lift,
                wlift=arch * 0.6, tail=tail, rider=('ride_ears', i % 2))


HONK = [honk_pose(i) for i in range(10)]

# ------------------------------------------------------------------ riderless: the dive's ends
# The gun rests level (0 deg) on the riderless strips; the neck and head are in the picture.
HEAD_LOW = dict(c1=(30, -40), c2=(28, -36), head=(36, -33), ang=-4)
HISS = [
    # draws the neck back (the anticipation), the bill opening, the wings start to arch
    dict(legs=STAND, farwing='busk', lift=1.0, arch=2.0, wlift=1.0, tail=1.0, puff=0.5, gun=0,
         neckpose=dict(c1=(30, -50), c2=(16, -52), head=(24, -50), ang=-6, face='open')),
    # lunges low and forward (a smear: the neck stretched), hissing, the busking wings up
    dict(legs=STAND, tilt=2, farwing='busk', lift=2.0, arch=3.0, wlift=1.5, tail=1.5, puff=0.8, gun=0, smear=True,
         neckpose=dict(c1=(30, -47), c2=(22, -46), head=(28, -46), ang=-6, face='open')),
    dict(legs=STAND, tilt=5, dy=1, farwing='busk', lift=4.0, arch=5.0, wlift=2.5, tail=2.5, puff=1.2, gun=0,
         neckpose=dict(c1=(31, -40), c2=(31, -34), head=(38, -32), ang=-8, face='open')),
]
# bash (6 ticks): the IMPACT (a smear: her head and the gun rammed into the target, speed lines),
# the squash (the neck folds, the wings fling up), the recoil (she rocks back: the tumble follows)
BASH = [
    dict(legs=(((-10, GA['P']), 'P'), ((6, GA['U']), 'U')), tilt=9, dy=1, farwing='fling', lift=0.0, arch=3.0, wlift=4.0,
         tail=3.0, gun=0, smear=True, speed=True,
         neckpose=dict(c1=(32, -38), c2=(38, -30), head=(44, -27), ang=-12, face='blink')),
    dict(legs=(((-6, GA['S']), 'S'), ((5, GA['S']), 'S')), tilt=7, dy=4, sy=0.94, farwing='fling', lift=3.0, arch=5.0,
         wlift=5.0, tail=4.0, gun=0, puff=-0.5,
         neckpose=dict(c1=(28, -40), c2=(34, -34), head=(36, -30), ang=10, face='blink')),
    dict(legs=(((-5, GA['S']), 'S'), ((6, GA['U']), 'U')), tilt=5, dy=3, farwing='fling', lift=4.0, arch=4.5, wlift=4.5,
         tail=3.5, gun=0,
         neckpose=dict(c1=(27, -42), c2=(32, -37), head=(35, -34), ang=18, face='blink')),
]
# tumble (8 ticks): she bounces back and rolls over backwards onto her back (dazed follows)
TUMBLE = [
    dict(air=-34, tilt=-35, legs_rel=True, legs=(((6, -4), 'F'), ((9, -2), 'F')), farwing='fling', lift=2.0, arch=3.0,
         wlift=4.0, tail=3.0, gun=0, smear=True, speed=True,
         neckpose=dict(rel=True, c1=(14, -8), c2=(14, -18), head=(8, -24), ang=40, face='blink')),
    dict(air=-30, tilt=-100, legs_rel=True, legs=(((8, -3), 'F'), ((11, -1), 'F')), farwing='fling', lift=4.0, arch=4.0,
         wlift=4.0, tail=2.0, gun=0, smear=True,
         neckpose=dict(rel=True, c1=(12, -6), c2=(4, -16), head=(-4, -16), ang=80, face='blink')),
    dict(ground='body', tilt=-173, legs_rel=True, legs=(((5, -1), 'Fv'), ((9, 0), 'Fv')), farwing='arch', lift=3.5,
         arch=2.0, wlift=3.0, tail=1.0, gun=0,
         neckpose=dict(rel=True, c1=(8, 2), c2=(12, -4), head=(16, -7), ang=-196, flip=True, face='blink')),
    dict(ground='body', tilt=-176, legs_rel=True, legs=(((4, -1), 'Fv'), ((8, 1), 'Fv')), farwing='arch', lift=2.5,
         arch=1.5, wlift=2.5, tail=0.5, gun=0,
         neckpose=dict(rel=True, c1=(7, 1.5), c2=(12, -4.5), head=(16, -7), ang=-190, flip=True, face='blink')),
]


# dazed (8 frames x 8): on her back, the webs pedal slowly in the air, the head lolls on the floor
def dazed_pose(i):
    a = 2 * math.pi * i / 8
    return dict(ground='body', tilt=-180 + 2 * math.sin(a), legs_rel=True,
                legs=(((4 + 2 * math.cos(a + math.pi), -1 + 1.5 * math.sin(a + math.pi)), 'Fv'),
                      ((8 + 2 * math.cos(a), 1 + 1.5 * math.sin(a)), 'Fv')),
                farwing='arch', lift=1.0 + 0.8 * math.sin(a), arch=1.0, wlift=2.0 + math.sin(a), tail=0.5, gun=0,
                neckpose=dict(rel=True, c1=(7, 1), c2=(12, -6), head=(16 + 0.6 * math.cos(a), -8 + 0.5 * math.sin(a)),
                              ang=-186 + 6 * math.sin(a), flip=True, face='blink' if i in (3, 4) else 'n'))


DAZED = [dazed_pose(i) for i in range(8)]


# right (12 ticks): she rocks on her back, kicks over onto her front (the two smears: 1 tick each),
# then pushes up onto her webs in three steps (the knees straighten, the neck rises last)
RIGHT_D = [1, 1, 3, 3, 3, 1]
RIGHT = [
    dict(ground='body', tilt=-172, legs_rel=True, legs=(((6, -2), 'Fv'), ((11, 0), 'Fv')), farwing='arch', lift=5.0, arch=2.0,
         wlift=3.5, tail=1.0, gun=0, smear=True,
         neckpose=dict(rel=True, c1=(8, 0), c2=(12, -4), head=(15, -8), ang=-200, flip=True)),
    dict(air=-37, tilt=-100, legs_rel=True, legs=(((6, 0), 'F'), ((11, 2), 'F')), farwing='fling', lift=5.0, arch=4.0,
         wlift=4.0, tail=2.0, gun=0, smear=True, speed=True,
         neckpose=dict(rel=True, c1=(12, -6), c2=(10, -14), head=(8, -18), ang=100)),
    # on her belly, the webs planted under her, the neck coming up
    dict(dy=18, tilt=-8, sy=0.9, tucked_local=True, tucked=(((-3, GA['S']), 'S'), ((5, GA['S']), 'S')),
         farwing='half', lift=2.8, arch=2.5, wlift=3.0, tail=1.6, gun=0,
         neckpose=dict(rel=True, c1=(14, -4), c2=(12, -12), head=(14, -18), ang=24)),
    # pushing up: the knees straighten
    dict(legs=(((-3, GA['S']), 'S'), ((5, GA['S']), 'S')), dy=12, tilt=-6, sy=0.95, farwing='half', lift=2.4, arch=2.0,
         wlift=2.5, tail=1.3, gun=0, neckpose=dict(rel=True, c1=(15, -4), c2=(8, -14), head=(11, -21), ang=16)),
    dict(legs=(((-4, GA['S']), 'S'), ((4, GA['S']), 'S')), dy=6, tilt=-3.5, farwing='half', lift=1.9, arch=1.0, wlift=1.8,
         tail=1.0, gun=0, neckpose=dict(rel=True, c1=(16, -3), c2=(-4, -14), head=(5, -23), ang=8)),
    dict(legs=STAND, dy=2, tilt=-1, farwing='arch', lift=1.0, wlift=1.0, tail=0.5, gun=0,
         neckpose=dict(rel=True, c1=(16, -2), c2=(-8, -14), head=(3, -24), ang=4)),
]


# shake (8 ticks): standing, she shakes out her feathers: the body shimmies, the near wing fans,
# the far wing flicks open, the tail wags, the head shakes (fast: 1-tick frames in the middle)
SHAKE_D = [2, 1, 1, 1, 1, 2]


def shake_pose(i):
    s = [0, 1, -1, 1, -1, 0][i]
    return dict(legs=STAND, dx=s * 0.6, dy=[1, 0, 0, 0, 0, 1][i], tilt=[0, 0.6, -0.6, 0.6, -0.6, 0][i], farwing='half',
                lift=[1.0, 2.0, 2.4, 2.0, 1.6, 1.0][i], ruffle=[0.5, 1.5, 1.0, 1.5, 1.0, 0.3][i],
                wlift=[0.5, 1.2, 1.0, 1.2, 0.6, 0.3][i], tail=[0.5, 1.2, 0.7, 1.2, 0.7, 0.8][i], puff=0.5, gun=0,
                neckpose=dict(c1=(32, -46), c2=(8, -58), head=(19 + s, -68), ang=8 * s, face='blink' if i in (2, 3) else 'n'))


SHAKE = [shake_pose(i) for i in range(6)]


# wreck (doomed): she staggers on bent legs, the neck droops, the wings hang, smoke from her back
def wreck_pose(i):
    w = [0, 1, 0, -1][i]
    return dict(legs=(((-6, GA['S']), 'S'), ((5, GA['S']), 'S')), dy=6 + abs(w), tilt=4 + w, farwing='arch', lift=-1.0,
                wlift=-0.5 + 0.5 * abs(w), tail=-0.5, gun=10,
                neckpose=dict(c1=(30, -42), c2=(34, -30), head=(30, -22 - w), ang=-30 - 6 * w, face='blink' if i == 2 else 'n'),
                rider=('ride_hold', i % 2))


WRECK = [wreck_pose(i) for i in range(4)]

# ------------------------------------------------------------------ parked: empty, empty-look, empty-lay
SIT = dict(sy=0.74, ground='body', farwing='fold', tucked=(((7, -12.5), 'S'), ((11, -12.5), 'S')), gun=0)
NECK_SIT = dict(c1=(26, -30), c2=(12, -40), head=(19, -46), ang=0)
EMPTY = [
    # dozing: the neck sunk in a low S, the head resting on the breast, eye shut; the breath
    dict(SIT, puff=0.0, lift=0.0, wlift=0.0, tail=0.0, neckpose=dict(c1=(26, -24), c2=(30, -16), head=(26, -14), ang=-24, face='blink')),
    dict(SIT, puff=0.5, lift=0.6, wlift=0.5, tail=0.4, neckpose=dict(c1=(26, -24), c2=(30, -17), head=(26, -15), ang=-22, face='blink')),
    dict(SIT, sy=0.77, puff=0.8, lift=1.0, wlift=0.8, tail=0.8, neckpose=dict(c1=(26, -25), c2=(30, -18), head=(26, -16), ang=-20, face='blink')),
    dict(SIT, sy=0.76, puff=0.3, lift=0.4, wlift=0.3, tail=0.4, neckpose=dict(c1=(26, -25), c2=(30, -17), head=(26, -15), ang=-22, face='blink')),
]
# looking at the nearest player: 0 behind + low, 1 ahead + low, 2 behind + high, 3 ahead + high, 4 blink
EMPTY_LOOK = [
    dict(SIT, neckpose=dict(c1=(24, -30), c2=(18, -34), head=(16, -32), ang=8, flip=True)),
    dict(SIT, neckpose=dict(c1=(26, -28), c2=(26, -30), head=(30, -30), ang=-6)),
    dict(SIT, neckpose=dict(c1=(26, -34), c2=(6, -44), head=(12, -48), ang=-14, flip=True)),
    dict(SIT, neckpose=dict(c1=(28, -34), c2=(12, -46), head=(22, -50), ang=12)),
    dict(SIT, neckpose=dict(c1=(26, -28), c2=(26, -30), head=(30, -30), ang=-6, face='blink')),
]
# the nervous egg (110 ticks, the egg at tick 52 = frame LAY_EGG_FRAME 5): she looks up, looks back,
# shuffles, strains twice (the body lifts, the eye squeezed), the egg pops out behind her, she
# looks back at it and puffs up proudly
LAY_EGG_FRAME = 5
EMPTY_LAY = [
    dict(SIT, neckpose=dict(NECK_SIT)),
    dict(SIT, neckpose=dict(c1=(24, -34), c2=(10, -44), head=(8, -46), ang=10, flip=True)),
    dict(SIT, dy=-1, lift=1.5, wlift=1.5, tail=1.0, neckpose=dict(NECK_SIT, head=(20, -45), ang=4)),
    dict(SIT, dy=-2, lift=2.0, wlift=2.0, tail=2.0, puff=0.8, neckpose=dict(c1=(26, -30), c2=(14, -38), head=(20, -43), ang=-8, face='squint')),
    dict(SIT, dy=-3, lift=3.0, wlift=3.0, tail=3.0, puff=1.2, neckpose=dict(c1=(26, -30), c2=(14, -37), head=(21, -41), ang=-12, face='squint')),
    dict(SIT, dy=0, lift=0.5, wlift=0.5, tail=-0.5, puff=0.2, neckpose=dict(NECK_SIT, head=(21, -48), ang=14, face='open')),
    dict(SIT, neckpose=dict(c1=(24, -34), c2=(8, -42), head=(4, -42), ang=-8, flip=True)),
    dict(SIT, puff=1.2, lift=0.8, tail=1.0, neckpose=dict(NECK_SIT, head=(20, -49), ang=10)),
]

# the game's rider pick for the aim steps (swan.ts pickPose): i >= 7 hunch, i 5-6 up, else sit
def aim_rider(i):
    return ('ride_hunch', 0) if i >= 7 else ('ride_up', 0) if i in (5, 6) else ('ride_sit', 0)


# ------------------------------------------------------------------ the wave 1 look poses (look.py)
POSES = {
    'stand0': dict(legs=STAND, farwing='arch', neckpose=NECK_REST, rider=('ride_sit', 0)),
    'stand1': dict(legs=STAND, dy=1, lift=1.0, farwing='arch', neckpose=neck(NECK_REST, 1), rider=('ride_sit', 1)),
    'swim': dict(dy=14, farwing='busk', lift=2.0, wlift=3.0, neckpose=neck(NECK_REST, 14), rider=('ride_sit', 0), water=-16),
}
for _i in range(RUN_N):
    POSES['run%d' % _i] = RUN[_i]
