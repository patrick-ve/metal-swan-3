# The Swan rider at 40 px (plan docs/design/ams40.md wave 7, Swan stage 2): the nine ride poses
# (char/<hero>/ride-<pose>), refitted to the natural Swan of tools/art40/chars/swan/.
#
# The game draws the rider between the Swan's body strip and her '-front' overlay, with the hip on
# her 'seat' point (src/game/content/vehicles/swan/swan.ts draw: body, scuffs, rider, front, neck).
# The overlay is her near flank round the saddle with a window cut out where the rider's near leg
# lies (swan frames.leg_window: the kit lower body with the ankle 11-13 px under the hip, 0-3 px
# behind it, the knee forward over the drum, grown by 1 px). So every ride frame here is:
#
#   the back layer (a cape) + the near leg in that window + the upper body (hands on the grips)
#
# anchored at the pelvis, with the points the game and the scenes read: 'head', and 'hand' (the
# near hand on its grip, or the hand raised above the shoulders: the cheer, the hands at the ears).
#
# The grips (swan body.grips) sit at hip + (9, -5) near and (10, -5) far in every ridden strip; in
# the crouch strips the rider lies 4 px deeper (CROUCH_SEAT_DY), so there they are at (9, -9) /
# (10, -9). The barrel on the drum's hub (hip + (8, 12)) turns with the aim: at aim 6 (straight up)
# its muzzle ends at (8, -5), on the near grip. The 'up' pose (the neck at aims 5-6, and the pick in
# swan.ts at aim 6) lets go of the near grip and braces the near hand on the cantle behind him, so
# the barrel passes in front of the arm, never through the fist; 'hunch' (aims 7-8) keeps both
# fists on the grips, above the barrel's path.
import anims as A
import art40 as X
import castkit as K
import ext_moves as EM
import ext_ride as ER
import pose

from . import frames as F

GRIPS = ((9, -5), (10, -5))
GRIPS_LOW = ((9, -9), (10, -9))       # the crouch strips: the rider 4 px deeper, the grips stay
HANG_SWING = 34                       # degrees: the hanging body swings back under its fists
CANTLE = (-7, -2)                     # the raised back of the saddle (swan body.saddle pad)

# the near leg per pose frame: (ankle from the feet anchor, the shoe). The hip is (0, -17): a mount
# bird's seat, the thigh forward and down, the knee over the drum, the shin back under him, toes
# down. Above the hip line + 4 (the overlay's box) the thigh stays inside the leg window; below it
# the leg is drawn over her flank.
SIT = (-1, -8)
TUCK = (-2, -9)          # the heel pulled back and up (the knee squeezes)
PUSH = (1, -6)           # the leg shoved forward (braced)


def near_leg(ank, shoe='hang'):
    """The kit lower body with both legs on the same place (the far leg is behind her body)."""
    return A.legs((0, -17), ank, ank, shoe, shoe, -1, -1)


def frame(upper, ank=SIT, shoe='hang'):
    """One rider frame: the back layer, the near leg, the upper body; anchored at the pelvis."""
    up = dict(upper)
    up['pelvis'] = (0, -17)
    layers = []
    br = pose.compose(up, 'back')[0]
    if br:
        layers.append((br, 0, 0))
    lrows, lmeta = pose.compose(near_leg(ank, shoe), 'lower')
    layers.append((lrows, 0, 0))
    urows, meta = pose.compose(up, 'upper')
    layers.append((urows, 0, 0))
    rows = K.stack(layers, pose.W, pose.H)
    j = F._flat(meta)
    jl = {k: v for k, v in F._flat(lmeta).items() if k.startswith('legN') and not k.endswith('.ground')}
    j.update(jl)
    pts = {'head': F.head_pt(j)}
    wr = [j[k] for k in ('armN.wrist', 'armF.wrist') if k in j]
    pts['hand'] = j.get('armN.wrist') or j['pel']
    sh = j.get('torso.shN')
    if wr and sh:
        hi = min(wr, key=lambda w: w[1])
        if hi[1] < sh[1]:
            pts['hand'] = hi
    return X.Frame(rows, j['pel'], pts=pts, joints=j)


def _near_to(torso, tor, target, end='grip', bend=-1, z=None):
    shN, _, _ = ER._shoulders(torso, tor)
    d = dict(hand=ER._to(target, shN, end), end=('hand', end), bend=bend)
    if z is not None:
        d['z'] = z
    return d


def poses():
    """{pose: [(upper, ticks, ankle, shoe)]}: the frame counts and ticks of the contract (2-frame
    poses: frame 0 / 1 are what swan.ts pickRiderFrame syncs to the body)."""
    def R(*a, **k):
        k.setdefault('grips', GRIPS)   # the Swan's grips (one truth for every pose that holds them)
        return ER.rider(*a, **k)
    return {
        # the rest: a slow breath; the shoulders settle 1 px, the heel swings back with it
        'sit': [(R('up', 'fwd', (0, 0), cape=('hang', 0)), 20, SIT, 'hang'),
                (R('up', 'fwd', (0, 1), cape=('hang', 0.5)), 20, SIT, 'hang')],
        # the run: frame 0 up on her push, frame 1 the dip (her planted web): he sinks into the
        # saddle, the knee squeezes and the heel goes back
        'lean': [(R('lean', 'fwd', (0, 0), hd=(1, 0), cape=('run', 0)), 6, SIT, 'hang'),
                 (R('lean2', 'fwd', (0, 1), hd=(1, 0), cape=('run', 0.5)), 6, TUCK, 'hang')],
        # the neck up (aims 5-6): he leans back out of the barrel's way, the near hand braced on
        # the cantle behind him, the far fist on its grip, the leg pushed forward
        'up': [(R('back', 'up', (-1, 0), hd=(-1, 0), cape=('billow', 0.2),
                  near=_near_to('back', (-1, 0), CANTLE, bend=1)), 30, PUSH, 'flat')],
        # the neck back (aims 7-8): down behind her neck, both fists on the grips, heel tucked
        'hunch': [(R('ride_h', 'panic', (0, 1), hd=(1, 1), cape=('settle', 0)), 30, TUCK, 'hang')],
        # holding on (squat, flap, take-off, wreck): the knee clamps, the body jolts 1 px
        'hold': [(R('lean', 'shout', (0, 1), cape=('billow', 0)), 4, TUCK, 'hang'),
                 (R('lean', 'panic', (0, 1), hd=(0, 1), cape=('billow', 0.5)), 4, SIT, 'hang')],
        # the brace (a landing, a hit): pressed down, the leg shoved forward against the flank
        'brace': [(R('lean2', 'hurt', (0, 2), hd=(0, 0), cape=('crouch', 0)), 30, PUSH, 'flat')],
        # flat on her back in the crouch (the grips stay where they are, he lies 4 px deeper)
        'duck': [(R('ride_d', 'shout', (0, 2), hd=(1, 0), grips=GRIPS_LOW, cape=('run', 0.3)), 30, TUCK, 'back')],
        # the honk: hands on the ears, the knees squeeze (frame 1 winces, the heel kicks back)
        'ears': [(ER.ears('blink'), 6, SIT, 'hang'), (ER.ears('panic'), 6, TUCK, 'hang')],
        # the cheer: a fist pump, the leg kicks forward on the 'yes!'
        'cheer': [(ER.cheer(0), 8, SIT, 'hang'), (ER.cheer(1), 8, PUSH, 'flat')],
    }


ORDER = ('sit', 'lean', 'up', 'hunch', 'hold', 'brace', 'duck', 'ears', 'cheer')


# ------------------------------------------------------------------------------- mount, mount-hop
def _arm_to(torso, tor, target, end=('fist', 'fist'), bend=1, far=False, z=None):
    """An arm (A.hand) whose wrist lands on the hip-relative target."""
    shN, shF, _ = ER._shoulders(torso, tor)
    sh = shF if far else shN
    return A.hand((target[0] - sh[0], target[1] - sh[1]), end[1], end[0], bend=bend, z=z)


def _grip_arm(torso, tor, side, grips=GRIPS):
    shN, shF, _ = ER._shoulders(torso, tor)
    sh, g = (shN, grips[0]) if side == 'N' else (shF, grips[1])
    return dict(hand=ER._to(g, sh), end=('hand', 'grip'), bend=-1)


def hang():
    """mount frame 0: hanging on by the hands (the ending hangs the hero by this frame's 'hand'
    from the flyer's neck, legs and tail; Player.drawSeated shows it as the climb-in). Both arms
    stretched forward and up, the fists clear in front of the brow (a raised arm cannot clear the
    big head straight up), the eyes up on the grip, the body stretched 1 px, the legs trailing
    back in the flyer's wind, toes down."""
    tor = (0, -1)
    near = _arm_to('up', tor, (11, -15), bend=1)
    far = _arm_to('up', tor, (10, -16), bend=1, far=True)
    p = EM.fp((0, -17), (-3, -4), (0, -3), 'hang', 'hang', -1, -1, torso='up', head='up', tor=tor,
              hd=(0, 0), armN=near, armF=far, cape=('hang', 0))
    # the whole figure swings back under the fists (it hangs from them): turned about the hands
    p['spin'] = (HANG_SWING, (11, -32))
    return p


def mount():
    """Seated in a vehicle (drawSeated cycles the frames every 16 ticks): frame 0 the hang / climb-in,
    frame 1 seated with both hands forward (the cockpit drivers, the ride fallback: hip (0, -17))."""
    from . import moves as M
    return [(hang(), 16), M.mount()[1]]


def mount_hop(spike):
    """The hop onto the Swan (5 frames, 3/3/3/3/4 ticks): the spike's crouch, spring and tuck rise,
    then over the seat (the near leg swings high over her flank, both fists reach for the grips)
    and the settle, which IS the ride-sit seat (the near leg in her overlay's window, the fists on
    the grips) pressed 1 px down by the landing, so the hop hands over to ride-sit without a pop."""
    seq = [(p, t) for p, t in spike]
    over_tor = (0, 0)
    over = EM.fp((0, -17), (-7, -8), (9, -13), 'back', 'flat', -1, -1, torso='lean', head='fwd', tor=over_tor,
                 armN=_arm_to('lean', over_tor, (9, -3), bend=-1), armF=_arm_to('lean', over_tor, (10, -4), bend=-1, far=True),
                 cape=('jump', 3))
    st = (0, 1)
    settle = EM.fp((0, -17), SIT, SIT, 'hang', 'hang', -1, -1, torso='up', head='fwd', tor=st, hd=(0, 0),
                   armN=_grip_arm('up', st, 'N'), armF=_grip_arm('up', st, 'F'), cape=('hang', 0.5))
    # the holds (16 ticks, the logic time): the crouch reads for 3 ticks (the anticipation; the pop
    # to the spring is its snap), the three flight drawings 4 each (the fit's travel floor), and the
    # settle 1 tick: ride-sit (the same seat, 1 px higher) takes over from it as the rebound
    t = HOP_TICKS
    return [(seq[0][0], t[0]), (seq[1][0], t[1]), (seq[2][0], t[2]), (over, t[3]), (settle, t[4])]


HOP_TICKS = (3, 4, 4, 4, 1)
