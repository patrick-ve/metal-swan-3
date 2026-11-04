# The hero frames the game needs that the spike drew differently (or not at all): the run restrided
# to the game's speed, the crouch walk, the jump split for the game's jump / fall strips, the flip
# at its logic time, the seated mount and the salute.
import math

import anims as A
import ext_moves as EM
import pose

from . import frames as F

legs = A.legs
hand = A.hand

# ------------------------------------------------------------------------------- the run
# The game: 12 frames x 3 ticks = 36 ticks per cycle at 1.5 px/tick (TUNING.player.runSpeed and
# runTicksPerFrame), so the body moves 4.5 px per frame and a planted foot must move back exactly
# 4.5 px per frame (the foot gate: drift <= 1 px). The spike's approved run slid (its stance foot
# moved about 3.4 px a frame, and an unreachable ankle target bent the foot off the line). Here a
# foot is planted for three frames (contact at the heel, mid-stance, push), every ankle target is
# inside the leg's reach (thigh + shin 13.5 px), the pelvis sinks 1 px over the stance and rises in
# the flight, and the swinging foot kicks up behind and reaches forward on an eased path.
RUN_STEP = 4.5
# near foot per frame: (x from the pelvis, ankle y from the floor, shoe); frames 0-2 planted
RUN_NEAR = [
    (5.5, -3.0, 'heel'), (1.0, -4.0, 'flat'), (-3.5, -4.0, 'flat'),       # stance (planted; the heel shoe sits 1 px lower)
    (-7.5, -6.5, 'toe'), (-8.5, -9.0, 'back'), (-7.5, -11.0, 'back'),     # toe-off, the heel kicks up
    (-5.0, -12.5, 'back'), (-1.5, -13.0, 'hang'), (2.5, -12.5, 'hang'),   # behind the other foot's contact, under, knee high
    (6.0, -10.0, 'hang'), (8.0, -7.0, 'flat'), (7.0, -5.5, 'heel'),       # the reach, the foot comes down
]
RUN_PEL = [-15, -15, -16, -17, -17, -16, -15, -15, -16, -17, -17, -16]   # down on the contact, up in the flight
FAR_DX = -2.0          # the far hip sits 4 px behind the near one: its whole path moves back 2 px


def _swing(i):
    """The table entry, its lift scaled to the hero's leg (a short-legged hero lifts his feet less:
    the knee does not snap forward past the hip). The planted frames 0-2 are never scaled."""
    x, y, shoe = RUN_NEAR[i]
    if i < 3:
        return x, y, shoe
    k = (pose.THIGH + pose.SHIN) / 13.5
    return x, -4.0 + (y + 4.0) * k * k, shoe


def run_lower(i):
    nx, ny, ns = _swing(i)
    fx, fy, fs = _swing((i + 6) % 12)
    return legs((0, RUN_PEL[i]), (fx + FAR_DX, fy), (nx, ny), fs, ns)


def run_legs():
    return [(run_lower(i), 3) for i in range(12)]


# ------------------------------------------------------------------------------- crouch walk
# 7 frames x 5 ticks at 0.75 px/tick (crawlSpeed): 26.25 px per cycle, 3.75 px per frame. A foot is
# planted for ph < CRAWL_STANCE of the cycle and moves back linearly (no drift by construction);
# the swing lifts it at least 1.5 px so the foot gate never takes a swinging foot for a planted one.
CRAWL_N, CRAWL_T = 7, 5
CRAWL_CYCLE = CRAWL_N * CRAWL_T * 0.75
CRAWL_STANCE = 3.2 / 7


def crawl_foot(ph, xc):
    ph %= 1.0
    if ph < CRAWL_STANCE:
        return (xc - CRAWL_CYCLE * ph, -4.0), 'flat'
    s = (ph - CRAWL_STANCE) / (1 - CRAWL_STANCE)
    x0 = xc - CRAWL_CYCLE * CRAWL_STANCE
    x = x0 + (xc - x0) * F.ease(s)
    y = -4.0 - (1.5 + 2.0 * math.sin(math.pi * s))
    return (x, y), ('toe' if s < 0.3 else 'flat')


def crawl_legs():
    out = []
    for i in range(CRAWL_N):
        ph = i / CRAWL_N
        na, ns = crawl_foot(ph, 5.5)
        fa, fs = crawl_foot(ph + 0.5, 5.5 + FAR_DX)
        bob = 1 if i in (2, 5) else 0
        out.append((legs((0, -11 + bob), fa, na, fs, ns), CRAWL_T))
    return out


# ------------------------------------------------------------------------------- jump
def jump_legs():
    """The game's jump legs (once, the last frame holds while he rises; then legs-fall): the
    push-off squat, the push, two eased steps up into the tuck, the tuck."""
    j = [p for p, _ in A.LOWER['jump']]
    return [(j[0], 2), (j[1], 3), (F.mix(j[1], j[2], 0.5), 3), (j[2], 3), (F.mix(j[2], j[3], 0.5), 3), (j[3], 4)]


def flip(seq):
    """The somersault keeps its logic time (startFlip: flipT = stripTicks, 28 ticks)."""
    d = [3, 3, 4, 3, 4, 3, 4, 4]
    return [(p, t) for (p, _), t in zip(seq, d)]


# ------------------------------------------------------------------------------- mount
SEAT = dict(pel=(0, -17), far=(4, -8), near=(6, -7))


def mount():
    """Seated in a vehicle (drawSeated plays frame floor(tick / 16): the two frames alternate).
    Frame 0: one hand up on the roll bar (the ending hangs the hero by this frame's hand); frame 1:
    both hands forward on the grips (the ride fallback: its hip is at (0, -17))."""
    s = SEAT
    up = EM.fp(s['pel'], s['far'], s['near'], 'hang', 'hang', torso='up', head='fwd',
               armN=hand((1, -9), 'fist', 'fist', bend=1), armF=hand((8, 1), 'fist', 'fist'), cape=('hang', 0))
    fwd = EM.fp(s['pel'], s['far'], s['near'], 'hang', 'hang', torso='lean', head='fwd',
                armN=hand((9, 1), 'fist', 'fist'), armF=hand((9, 0), 'fist', 'fist'), cape=('hang', 0))
    return [(up, 16), (fwd, 16)]


def mount_frame(p):
    """A seated frame: its anchor is 17 px under the hip (MOUNT_HIP_DROP), so 'hip' is (0, -17).
    The hang (mount frame 0) turns the whole body about the fists, so its hip lands between pixels:
    the anchor snaps to the nearest whole pixel (the ending hangs it by 'hand', not by the hip)."""
    f = F.full(p, ground=False)
    hx, hy = f.pts['hip']
    f.root = (round(hx), round(hy) + 17)
    return f


# ------------------------------------------------------------------------------- salute
def salute():
    """The salute (68 ticks, once, the last frame holds): at ease, the arm comes up with the elbow
    out, snaps to the brow with the chest out, a small overshoot, settles, the proud hold."""
    st = ((0, -17), (-5, -4), (5, -4))
    far = hand((0, 9), 'fist', 'fist')
    def f(near, head='fwd', tor=(0, 0), hd=(0, 0)):
        return EM.fp(*st, 'flat', 'flat', torso='up', head=head, tor=tor, hd=hd, armN=near, armF=far, cape=('hang', 0))
    # the near arm: the elbow comes forward and up, the flat hand to the brow, fingers forward (in
    # profile the blade of the hand reads over the eye, the forearm in front of the jaw)
    up = lambda h: hand(h, 'open', 'hand', bend=-1, sh=(1, 0))
    return [
        (f(hand((2, 9), 'fist', 'fist')), 4),
        (f(up((7, -2))), 3),
        (f(up((6.5, -8.5)), tor=(0, -1)), 2),
        (f(up((6, -9.5)), tor=(0, -1), hd=(0, -1)), 3),
        (f(up((6.5, -8.5))), 4),
        (f(up((6.5, -8.5)), head='smug'), 52),
    ]
