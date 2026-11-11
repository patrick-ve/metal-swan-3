# The fatbike youth's strips: poses per frame and the holds in 60 Hz ticks. Every logic time the
# game reads stays (docs/design/ams40/contract.md "fatbike youth"); the frame counts follow the
# plan's action classes. Drawn facing right (the game's unflipped sprite faces right).
#
# On the bike (ride, idle, turn, alert, tell, kick, gag, gloat, photo-pose, cower): ride.frame()
# (the bike and the seated youth, the PASSENGER hook of stage 2). Off the bike (the deaths, the
# fall off the seat, the get-up, the flee): the squad rig's full figure (X.full), without the cap
# (it flies off as its own sprite, enemy/fatbike-youth/cap).
import math

import art40 as X
import castkit as K
import ext_moves as M
import pose
import rig

from . import bike as BK
from . import ride as RD
from . import ridekit as RK

P = K.P
A = K.A

# Ride strip: the logic time of one crank turn (RIDE_DURATIONS: 20 ticks) in 12 frames; the
# crank angle of each frame is the angle at its start tick, so the crank turns at one speed.
RIDE_TICKS = [2, 2, 1] * 4
GAG_TICKS = [4, 3] * 4
# The tyre knobs travel with the ground: 1.8 px/tick (fast) is 0.36 knobs a tick (7 knobs a ride
# loop of 20 ticks); the gag laps at 0.8 px/tick (4 knobs a gag loop of 28 ticks).
RIDE_KNOBS = 7
GAG_KNOBS = 4


def starts(durs):
    out, t = [], 0
    for d in durs:
        out.append(t)
        t += d
    return out


def hand(h, kind='fist', bend=-1, sh=(0, 0), z=None):
    return A.hand(h, kind, 'hand', bend=bend, sh=sh, z=z)


# ------------------------------------------------------------------------------------ on the bike
def ride():
    """Pedalling hard: the hips rock with the down-stroke (twice a crank turn), the shoulders work
    against them, the head stays level a beat behind; the hood strings swing."""
    out = []
    t0 = starts(RIDE_TICKS)
    for i, t in enumerate(t0):
        ph = t / 20.0
        crank = 360 * ph
        bob = 0.5 + 0.5 * math.cos(4 * math.pi * ph)          # 1 at the down-strokes
        f, _ = RD.frame(bike=dict(crank=crank, roll=RIDE_KNOBS * ph),
                        torso='lean2' if bob > 0.5 else 'lean', head='fwd',
                        pel=(0, round(-0.6 * bob)), tor=(0, 0), hd=(1 if bob < 0.5 else 0, round(0.7 * bob)), k=i, strip='ride')
        out.append(f)
    return out


def idle():
    """Stopped, sitting back on the bench: breathing (the chest lifts, the head follows a frame late)."""
    out = []
    by = [0, -1, -1, 0]
    hy = [0, 0, -1, -1]
    for k in range(4):
        f, _ = RD.frame(bike=dict(crank=200), torso='in' if k in (1, 2) else 'lean1', head='blink' if k == 3 else 'fwd',
                        pel=(-0.5, 0), tor=(0, by[k]), hd=(0, hy[k] - by[k]), k=k, strip='idle')
        out.append(f)
    return out


def turn():
    """The U-turn (played forward then backward by the game): the bike swings towards the viewer
    (yaw 0.72, 0.44, 0.18 of its side length), the wheels foreshorten, he looks over his shoulder."""
    out = []
    for k, yaw in enumerate((0.72, 0.44, 0.18)):
        f, _ = RD.frame(bike=dict(crank=200, yaw=yaw), torso='lean1' if k == 0 else 'up', head='fwd', hd=(-k, 0),
                        k=k, strip='turn')
        out.append(f)
    return out


def alert():
    """He spots the player: up in the seat, the near hand points, the mouth open (OI)."""
    f, _ = RD.frame(bike=dict(crank=200), torso='back1', head='shout',
                    arms=lambda b: RD.grip_arms(b, near=((b['grip'][0] + 9, b['grip'][1] - 6), ('hand', 'point'), -1)),
                    k=0, strip='alert')
    return [f]


# the tell: anticipation (he drops onto the bar, the forks compress), the yank, the front rises,
# overshoots, settles into the held wheelie (held by the game for the rest of the telegraph)
TELL_TILT = [0.0, 6.0, 14.0, 21.0, 17.0, 18.5]
TELL_TICKS = [3, 3, 3, 3, 2, 2]


def tell():
    out = []
    poses = [
        dict(torso='lean3', head='grit', pel=(1, 1.5), hd=(1, 1)),
        dict(torso='lean1', head='shout', pel=(0, 0), hd=(0, 0)),
        dict(torso='back1', head='shout', pel=(-0.5, 0), hd=(-1, 0)),
        dict(torso='back2', head='shout', pel=(-1, 0), hd=(-1, -1)),
        dict(torso='back', head='shout', pel=(-0.5, 0), hd=(-1, 0)),
        dict(torso='back', head='shout', pel=(-0.5, 0), hd=(-1, 0)),
    ]
    for k, (tilt, p) in enumerate(zip(TELL_TILT, poses)):
        f, _ = RD.frame(bike=dict(tilt=tilt, crank=200 + 25 * k), k=k, strip='tell', **p)
        out.append(f)
    return out


# the kick (shown 8 ticks, the box live from the start): the front wheel slams down while the near
# knee chambers (anticipation), a whip (smear), the leg out at knee height from tick 3 (KICK_HIT),
# the impact (a star at the sole, the body thrown back), a snap back (smear), the foot back to the
# pedal (held while the game rides away)
KICK_TICKS = [2, 1, 2, 1, 1, 29]
KICK_HIT = 2
KICK_TILT = [7.0, 2.0, 0.0, 1.5, 0.5, 0.0]


def kick():
    out = []
    # the near ankle (bike-local px: x forward of the bottom bracket, y up) and the hips sliding
    # forward on the bench so the sole reaches past the bar
    ank = [(0, 16), (4.5, 18), (12, 19), (12.5, 19.5), (10, 19.5), None]
    shoe = ['hang', 'toe', 'heel', 'heel', 'toe', 'pedal']
    tors = ['lean2', 'back1', 'back', 'back2', 'back1', 'lean1']
    heads = ['grit', 'grit', 'shout', 'shout', 'grit', 'fwd']
    pels = [(1, -0.5), (3, -0.5), (4, -0.5), (3.5, -0.5), (2, -0.5), (0, 0)]
    hds = [(1, 1), (0, 0), (-1, 0), (-1, -1), (0, 0), (0, 0)]
    for k in range(6):
        def legs(b, k=k):
            if ank[k] is None:
                return RD.pedal_legs(b)
            bb = b['bb']
            a = (bb[0] + ank[k][0], bb[1] + 9 - ank[k][1])
            return RD.pedal_legs(b, lift={'legN': (a, shoe[k], 1)})
        f, b = RD.frame(bike=dict(tilt=KICK_TILT[k], crank=200), torso=tors[k], head=heads[k], pel=pels[k], hd=hds[k],
                        legs=legs, k=k, strip='kick')
        if k == 3:
            # the impact: a star burst at the sole
            bb = b['bb']
            f.rows = RK.stamp(f.rows, P.FX['star'], (bb[0] + 20, bb[1] + 9 - 18))
            f.rows = RK.stamp(f.rows, P.FX['star'], (bb[0] + 19, bb[1] + 9 - 23))
            f.rows = RK.stamp(f.rows, P.FX['star'], (bb[0] + 21, bb[1] + 9 - 13))
        if k in (1, 4):
            f.smear = True
            f.rows = streak(f.rows, b['bb'], k)
        out.append(f)
    return out


def streak(rows, bb, k):
    """The kick's smear: speed lines along the leg's arc (FX letters, no outline)."""
    g = [list(r) for r in rows]
    x0, y0 = int(bb[0]), int(bb[1])
    lines = [(4, -12, 4), (5, -9, 5), (3, -6, 3)] if k == 1 else [(16, -12, 4), (15, -9, 4)]
    for dx, dy, n in lines:
        for i in range(n):
            x = x0 + dx - i if k == 1 else x0 + dx + i
            y = y0 + dy
            if 0 <= y < len(g) and 0 <= x < len(g[0]) and g[y][x] == '.':
                g[y][x] = 'D' if i < 2 else 'd'
    return [''.join(r) for r in g]


def gag():
    """Laps round the spot with the music on: pedalling slowly (one crank turn a loop), bobbing his
    head and shoulders to the beat (two beats a loop), eyes shut, grinning."""
    out = []
    t0 = starts(GAG_TICKS)
    for i, t in enumerate(t0):
        ph = t / 28.0
        beat = math.cos(4 * math.pi * ph)            # +1 on the beat (head down)
        down = beat > 0.3
        f, _ = RD.frame(bike=dict(crank=360 * ph + 90, roll=GAG_KNOBS * ph),
                        torso='lean1' if down else ('up' if beat < -0.3 else 'lean1'),
                        head='groove' if i % 4 != 3 else 'smug', hd=(1 if down else 0, 1 if down else 0),
                        tor=(0, 1 if down else 0), pel=(0, 0.5 if down else 0), k=i, strip='gag')
        out.append(f)
    return out


# the gloat: a slow one-handed wheelie in place, rocking on the back wheel (one rock = one 36-tick
# beat of the speaker), no hands: the free hand on his thigh, the head nodding to the thump
GLOAT_TILT = [16.0, 13.5, 12.0, 12.5, 14.5, 17.0]


def gloat():
    out = []
    # no hands: the free hand rests on his thigh, riding the rock
    beck = [(3, 9), (3.5, 8.5), (4, 8), (4, 8), (3.5, 8.5), (3, 9)]
    heads = ['smug', 'smug', 'groove', 'groove', 'smug', 'happy']
    for k, tilt in enumerate(GLOAT_TILT):
        def arms(b, k=k):
            return RD.grip_arms(b, near=(('sh',) + beck[k], ('hand', 'open'), 1, 2))
        f, _ = RD.frame(bike=dict(tilt=tilt, crank=180), torso='back' if k in (0, 5) else 'back1', head=heads[k],
                        hd=(0, 1 if k in (2, 3) else 0), pel=(-0.5, 0), arms=arms, k=k, strip='gloat')
        out.append(f)
    return out


PHOTO_TICKS = [4, 3, 3, 4, 3, 3]


def photo_pose():
    """For the tourist's camera: sits up, throws the peace sign, the grin, the flash makes him
    blink, the chin up (a loop)."""
    out = []
    hands = [(8, 0), (9.5, -3), (10, -4), (10, -4), (10, -3.5), (9, -1.5)]
    heads = ['smug', 'happy', 'happy', 'blink', 'smug', 'smug']
    tors = ['up', 'back1', 'back1', 'back1', 'back1', 'up']
    for k in range(6):
        def arms(b, k=k):
            return RD.grip_arms(b, near=(('sh',) + hands[k], ('hand', 'peace'), -1, 2))
        f, _ = RD.frame(bike=dict(crank=200), torso=tors[k], head=heads[k], hd=(0, -1 if k in (2, 3) else 0),
                        tor=(0, -1 if k in (1, 2, 3) else 0), arms=arms, k=k, strip='photo-pose')
        out.append(f)
    return out


def cower():
    """Hunched over the bar, both forearms up before his face, the bike rocking under him (a loop)."""
    out = []
    tilt = [0.0, 2.0, 0.5, 2.5]
    lift = [0, 1, 0, 1]
    for k in range(4):
        def arms(b, k=k):
            g = b['grip']
            return {'armN': ((g[0] - 3, g[1] - 9 + (k % 2)), ('hand', 'up'), -1, 2),
                    'armF': ((g[0] - 2, g[1] - 10 + ((k + 1) % 2)), ('hand', 'up'), -1)}
        f, _ = RD.frame(bike=dict(tilt=tilt[k], crank=200), torso='lean3', head='panic', hd=(2, 3 + (k % 2)),
                        pel=(0, 1), arms=arms, dy=lift[k], k=k, strip='cower')
        out.append(f)
    return out


def bike_wreck():
    """The riderless bike (an FX the game slides along the road and drops): it topples (two steps),
    crashes on its side with sparks, skids, then a dust cloud swallows it (no dithered fade)."""
    out = []
    for k in range(6):
        cv = RK.canvas(RD.W, RD.H)
        Rg = RD.R
        if k == 0:
            BK.fat_bike(cv, Rg, tilt=4, crank=40, roll=0.3, yaw=0.9)
        else:
            BK.wreck(cv, Rg, k)
        rows = RK.finish(cv)
        gx, gy = Rg
        if k in (1, 2):
            for at in ((gx + 18, gy - 2), (gx - 21, gy - 1)) if k == 1 else ((gx + 15, gy - 3),):
                rows = RK.stamp(rows, P.FX['star'], at)
        if k == 3:
            rows = RK.stamp(rows, P.FX['smk1'], (gx - 25, gy - 4))
        if k >= 4:
            if k == 5:
                rows = ['.' * len(r) for r in rows]
            rows = cloud(rows, gx, gy, k)
        out.append(X.Frame(rows, (Rg[0], Rg[1] + 1), pts={}))
    return out


PUFFS = {4: [(-12, -5, 4.5), (-3, -7, 5.5), (7, -6, 5), (15, -4, 4), (-19, -3, 3.5)],
         5: [(-8, -8, 3.5), (2, -10, 4), (11, -8, 3), (-15, -6, 2.5)]}


def cloud(rows, gx, gy, k):
    """The dust cloud of the wreck: round puffs (FX greys: lit tops D, shaded bottoms d)."""
    g = [list(r) for r in rows]
    for cx, cy, r in PUFFS[k]:
        cx, cy = gx + cx, gy + cy
        for y in range(int(cy - r) - 1, int(cy + r) + 2):
            for x in range(int(cx - r) - 1, int(cx + r) + 2):
                d = math.hypot(x - cx, y - cy)
                if d <= r and 0 <= y < len(g) and 0 <= x < len(g[0]):
                    lit = (y - cy) < (r * 0.25) - (x - cx) * 0.2
                    g[y][x] = 'D' if lit and d < r - 0.8 else 'd'
    return [''.join(r) for r in g]


def cap():
    """The cap flying off (the game tumbles it): 8 turning steps, the centre anchor."""
    out = []
    for k in range(8):
        rows, an = P.ITEMS[f'cap{k}']
        cv = RK.canvas(24, 24)
        RK.grid(cv, 12 - an['c'][0], 12 - an['c'][1], rows, 1, 'cap')
        out.append(X.Frame(RK.finish(cv), (12, 12), pts={}))
    return out


def install_fx():
    for k, v in M.FX.items():
        P.FX[k] = v
    M._hook()


# ------------------------------------------------------------------------------------ off the bike
def game_pts(j):
    """The points the old art had on every rider frame: hand (the near hand), head, hip."""
    nk = j.get('head.neck') or j.get('torso.neck') or j['pel']
    return {'hand': j.get('armN.wrist', j['pel']), 'head': (nk[0] + 2, nk[1] - 6), 'hip': j['pel']}


def _turn(pt, piv, deg):
    a = math.radians(deg)
    dx, dy = pt[0] - piv[0], pt[1] - piv[1]
    return (piv[0] + dx * math.cos(a) + dy * math.sin(a), piv[1] - dx * math.sin(a) + dy * math.cos(a))


def seen_joints(p, j):
    """The joints where the player sees them: after the 'rot' of the upper body, the whole-body
    'spin' and the 'squash' of the post hook (the handhaver's measure)."""
    j = dict(j)
    rot = p.get('rot', 0)
    if rot:
        piv = j['pel']
        j = {k: (v if k.startswith('leg') or k == 'pel' else _turn(v, piv, rot)) for k, v in j.items()}
    if p.get('spin'):
        deg, (ox, oy) = p['spin']
        piv = (pose.RX + ox, pose.RY + oy)
        j = {k: _turn(v, piv, deg) for k, v in j.items()}
    if p.get('squash'):
        sy, sx = p['squash']
        rx, bot = pose.RX, pose.RY
        j = {k: (rx + (v[0] - rx) * sx, bot - (bot - v[1]) * sy) for k, v in j.items()}
    return j


def full(p, ground=True):
    """One-piece frame: pose.compose 'full' with the post hook (spin, squash, soot). ground: a figure
    that would sink under the feet anchor has its pelvis raised until it stands on the floor line."""
    def sink(rows, root):
        ys = [y for y, r in enumerate(rows) if r.strip('.')]
        return (max(ys) + 1 - root[1]) if ys else 0
    rows, root, j = X.full(p)
    below = sink(rows, root)
    if ground and below > 0:
        # raise the pelvis until nothing reaches under the floor line (a lying or kneeling figure:
        # the outline under it stays inside the canvas)
        px, py = p.get('pelvis', (0, -17))
        for lift in range(below, below + 6):
            q = dict(p, pelvis=(px, py - lift))
            r2, root2, j2 = X.full(q)
            if sink(r2, root2) <= 0:
                p, rows, root, j = q, r2, root2, j2
                below = 0
                break
        if below > 0:
            root = (root[0], root[1] + below)
    j = seen_joints(p, j)
    return X.Frame(rows, root, pts=game_pts(j), joints=j)


def fig(upper, lower):
    rows, root, j = X.humanoid(upper, lower)
    return X.Frame(rows, root, pts=game_pts(j), joints=j)


def fp(pel, far, near, fs='flat', ns='flat', **kw):
    return M.fp(pel, far, near, fs, ns, **kw)


def op(h, b=1, kind='open'):
    return dict(hand=h, end=('hand', kind), bend=b)


def lie(**kw):
    base = dict(rot=90, armN=op((-6, -1)), armF=op((-5, 3)))
    base.update(kw)
    return base


# the seat: where the youth sat on the bike (the pelvis, relative to the bike's ground point)
SEAT = (-5.5, -22)


def die():
    """Shot off the bike: the jolt in the seat, he goes over backwards (the legs swing up as the
    bike shoots out from under him), lands on his shoulders, the legs flop down, a bounce, he lies
    dazed (the cap is its own sprite: it already flew)."""
    S = []
    sx, sy = SEAT
    S.append(fp((sx, sy), (sx + 6, sy + 10), (sx + 8, sy + 12), 'pedal', 'pedal', torso='back2', head='nc_hurt',
                armN=op((9, -2), -1), armF=op((8, 0), -1)))
    S.append(fp((sx - 1, sy + 1), (sx + 7, sy + 7), (sx + 9, sy + 8), 'toe', 'flat', rot=18, head='nc_hurt',
                armN=op((8, -5), -1), armF=op((6, -3), -1)))
    S.append(fp((sx - 3, sy + 3), (sx + 6, sy + 2), (sx + 9, sy + 3), 'hang', 'heel', rot=38, head='nc_panic',
                armN=op((7, -7), -1), armF=op((4, -6), -1)))
    S.append(fp((sx - 5, sy + 7), (sx + 4, sy - 3), (sx + 8, sy - 1), 'hang', 'heel', rot=58, head='nc_panic',
                armN=op((5, -8), -1), armF=op((2, -7), -1)))
    S.append(fp((sx - 6, sy + 12), (sx + 2, sy - 2), (sx + 6, sy + 1), 'hang', 'heel', rot=78, head='nc_hurt',
                armN=op((6, -7), -1), armF=op((3, -7), -1)))
    # lands on his shoulders, the legs still up
    S.append(fp((-12, -6), (-6, -18), (-2, -17), 'heel', 'heel', rot=96, head='nc_hurt', armN=op((-2, -7), -1), armF=op((-5, -5), -1)))
    S.append(fp((-12, -4), (-1, -11), (3, -10), 'heel', 'heel', rot=92, head='nc_hurt', armN=op((-6, -2)), armF=op((-5, 1))))
    S.append(fp((-12, -3), (2, -5), (7, -6), 'lie', 'lie', head='nc_hurt', **lie()))
    S.append(fp((-12, -5), (1, -8), (6, -9), 'heel', 'heel', rot=84, head='nc_dazed', armN=op((-5, -4)), armF=op((-3, -4))))
    S.append(fp((-12, -3), (3, -3), (8, -3), 'lie', 'lie', head='nc_dazed', **lie()))
    return [full(p, ground=k >= 5) for k, p in enumerate(S)]


def die_knife():
    """Knifed: he doubles over on the seat (both hands to his belly), slides off, his feet find the
    road, the knees give, he sways and falls on his face."""
    S = []
    sx, sy = SEAT
    belly = lambda h: dict(hand=h, end=('hand', 'fist'), bend=-1)
    S.append(fp((sx, sy), (sx + 6, sy + 10), (sx + 8, sy + 12), 'pedal', 'pedal', torso='lean2', head='nc_hurt', hd=(1, 1),
                armN=belly((5, 6)), armF=belly((6, 6))))
    S.append(fp((sx + 1, sy + 2), (sx + 5, sy + 13), (sx + 8, sy + 14), 'toe', 'toe', torso='lean3', head='nc_hurt', hd=(1, 1),
                armN=belly((4, 7)), armF=belly((5, 7))))
    S.append(fp((sx + 3, sy + 5), (-3, -6), (3, -5), 'toe', 'toe', torso='lean2', head='nc_hurt', hd=(1, 1),
                armN=belly((4, 7)), armF=belly((5, 7))))
    S.append(fp((-1, -14), (-5, -4), (4, -4), 'flat', 'flat', torso='lean2', head='nc_hurt', hd=(1, 1),
                armN=belly((4, 7)), armF=belly((5, 7))))
    S.append(fp((0, -10), (-8, -2), (4, -4), 'toe', 'flat', torso='lean', head='nc_dazed', armN=belly((4, 7)), armF=belly((5, 6))))
    S.append(fp((0, -9), (-8, -2), (4, -4), 'toe', 'flat', torso='up', head='nc_dazed', armN=op((3, 9)), armF=op((2, 9))))
    S.append(fp((0, -9), (-8, -2), (4, -4), 'toe', 'flat', rot=-22, head='nc_dazed', armN=op((5, 8)), armF=op((4, 9))))
    S.append(fp((0, -8), (-8, -2), (4, -4), 'toe', 'flat', rot=-55, head='nc_hurt', armN=op((8, 4), -1), armF=op((8, 5), -1)))
    # face down: the hands land beside his head (along the body frame: up = forward after the fall)
    S.append(fp((-1, -6), (-9, -2), (0, -4), 'toe', 'toe', rot=-74, head='nc_hurt', armN=op((6, -2), -1), armF=op((7, -1), -1)))
    S.append(fp((-2, -5), (-10, -3), (-4, -3), 'toe', 'toe', rot=-88, head='nc_hurt', armN=op((3, -7), -1), armF=op((4, -6), -1)))
    S.append(fp((-2, -5), (-10, -3), (-4, -3), 'toe', 'toe', rot=-86, head='nc_hurt', armN=op((3, -6), -1), armF=op((4, -5), -1)))
    return [full(p) for p in S]


def die_blast():
    """Blown off the bike: the blast jolts him out of the seat, the game launches the body in its
    arc while he turns over backwards (about 25 degrees a frame, the limbs trail the turn), a smear
    whirls him onto his back, he slams down, bounces, lies in a wisp of smoke."""
    S = []

    def air(deg, pel, far, near, fs, ns, head, armN, armF, torso='back'):
        return M.tumble(fp(pel, far, near, fs, ns, torso=torso, head=head, armN=op(armN, -1), armF=op(armF)), deg)
    sx, sy = SEAT
    S.append(air(6, (sx + 1, sy), (sx + 6, sy + 9), (sx + 9, sy + 10), 'back', 'heel', 'nc_panic', (9, -6), (-8, -5)))
    S.append(air(30, (sx + 2, sy + 1), (-6, -8), (7, -6), 'hang', 'flat', 'nc_panic', (10, -1), (-6, -8)))
    S.append(air(55, (0, -19), (-7, -8), (7, -8), 'back', 'heel', 'nc_panic', (9, -7), (-8, -5)))
    S.append(air(80, (0, -18), (-5, -9), (5, -11), 'hang', 'hang', 'nc_panic', (8, -6), (-7, -5), 'up'))
    S.append(air(104, (0, -18), (-6, -7), (7, -9), 'back', 'heel', 'nc_hurt', (10, -3), (-8, -7)))
    S.append(air(130, (0, -18), (-5, -8), (6, -9), 'hang', 'hang', 'nc_hurt', (9, -2), (-7, -2), 'up'))
    S.append(fp((-10, -3), (5, -5), (10, -6), 'lie', 'lie', head='nc_hurt', **lie(armN=op((-6, -2)))))
    S.append(fp((-10, -6), (3, -11), (8, -13), 'heel', 'heel', head='nc_hurt', rot=82, armN=op((-5, -6)), armF=op((-3, -6))))
    S.append(fp((-10, -3), (5, -4), (10, -5), 'lie', 'lie', head='nc_hurt', **lie()))
    S.append(fp((-10, -3), (6, -3), (11, -3), 'lie', 'lie', head='nc_blink', fx=[('smk2', (-14, -9)), ('smk0', (-12, -15))], **lie()))
    out = [full(p, ground=k >= 6) for k, p in enumerate(S)]
    out[5].smear = True
    out[5].rows = smoke_streak(out[5].rows)
    return out


def smoke_streak(rows):
    g = [list(r) for r in rows]
    x0, y0, x1, y1 = K.bbox(rows)
    my = (y0 + y1) // 2
    for dy, n in ((-2, 3), (0, 5), (2, 3)):
        for i in range(n):
            x = x0 - 1 - i
            if 0 <= x and g[my + dy][x] == '.':
                g[my + dy][x] = 'D' if i < 2 else 'd'
    return [''.join(r) for r in g]


def die_burn():
    """Burnt: it catches in the seat (a jolt), he leaps off with flailing arms, the hot-foot hop,
    a soot statue with white eyes (a blink), stiff as a board he tips over into a puff of smoke."""
    S = []
    sx, sy = SEAT
    S.append(fp((sx, sy), (sx + 6, sy + 10), (sx + 8, sy + 12), 'pedal', 'pedal', head='nc_panic', torso='back1',
                armN=op((9, -3), -1), armF=op((-7, -5)), fx=[('fl0', (-8, -18)), ('fl1', (-6, -24))]))
    S.append(fp((sx + 3, sy - 3), (-4, -12), (3, -10), 'back', 'hang', head='nc_panic',
                armN=op((9, -4), -1), armF=op((-9, -3)), fx=[('fl1', (-6, -22)), ('fl2', (-5, -30)), ('fl0', (1, -18))]))
    S.append(fp((0, -18), (-4, -4), (6, -9), 'flat', 'hang', head='nc_wail',
                armN=op((9, 0), -1), armF=op((-8, -1)), fx=[('fl2', (-4, -23)), ('fl2', (1, -35)), ('fl1', (-3, -13))]))
    statue = dict(head='nc_soot', armN=hand((2, 9), 'open', -1), armF=hand((-1, 9), 'open', -1), soot=1)
    S.append(fp((0, -17), (-5, -4), (5, -4), fx=[('fl0', (-2, -45)), ('fl0', (3, -44)), ('smk1', (-3, -50))], **statue))
    S.append(fp((0, -17), (-5, -4), (5, -4), fx=[('smk2', (1, -54)), ('smk0', (-3, -60))], **dict(statue, head='nc_sootblink')))
    S.append(fp((-4, -13), (-4, -4), (5, -6), 'heel', 'hang', rot=48, head='nc_soot', soot=1,
                armN=hand((1, 5), 'open', -1), armF=hand((-3, 7), 'open', -1), fx=[('smk1', (-12, -36))]))
    S.append(fp((-10, -3), (6, -3), (11, -3), 'lie', 'lie', head='nc_sootblink', soot=1,
                fx=[('smk1', (-10, -10)), ('smk1', (2, -9)), ('smk0', (-4, -14))], **lie()))
    return [full(p, ground=k != 1) for k, p in enumerate(S)]


def die_crush():
    """Crushed: he looks up and ducks, arms over his head (anticipation); the impact squashes him;
    flat as a ticket on his back, springs once with stars, blinks."""
    duck = fp((-1, -13), (-6, -4), (5, -4), 'toe', 'flat', torso='back1', head='nc_panic',
              armN=op((7, -11), -1), armF=op((-4, -11), 1))
    flat = fp((-4, -3), (12, -3), (17, -3), 'lie', 'lie', head='nc_hurt', **lie())
    stars = lambda a, b: [('star', a), ('star', b)]
    out = [full(duck),
           full(dict(duck, squash=(0.45, 1.25))),
           full(dict(flat, squash=(0.55, 1.15))),
           full(dict(flat, squash=(0.8, 1.05), fx=stars((-8, -14), (6, -16)))),
           full(dict(flat, head='nc_dazed', squash=(0.55, 1.15), fx=stars((-1, -12), (11, -12))))]
    out[1].smear = True
    return out


def die_seat():
    """He falls off the back of the seat (the bike shoots out from under him), lands on his backside
    (an impact squash), bounces, and sits in the road dazed, swaying, seeing stars (the game then
    plays get-up and the flee)."""
    S = []
    sx, sy = SEAT
    sit = lambda pel, **kw: fp(pel, (pel[0] + 9, -3), (pel[0] + 13, -3), 'heel', 'heel', **kw)
    lap = dict(armN=hand((3, 9), 'open', 1), armF=hand((-6, 8), 'open', 1))
    S.append(fp((sx, sy), (sx + 6, sy + 10), (sx + 8, sy + 12), 'pedal', 'pedal', torso='back2', head='nc_panic',
                armN=op((9, -2), -1), armF=op((8, 0), -1)))
    S.append(fp((sx - 2, sy + 3), (sx + 7, sy + 8), (sx + 10, sy + 9), 'toe', 'flat', torso='back2', head='nc_panic',
                armN=op((9, -4), -1), armF=op((6, -3), -1)))
    S.append(fp((sx - 3, sy + 7), (sx + 6, sy + 6), (sx + 10, sy + 7), 'heel', 'heel', torso='back2', head='nc_panic',
                armN=op((8, -5), -1), armF=op((4, -4), -1)))
    S.append(fp((-9.5, -9), (sx + 5, -10), (sx + 9, -10), 'heel', 'heel', torso='back1', head='nc_panic',
                armN=op((7, -3), -1), armF=op((3, -2), -1)))
    # the impact (a smear: squashed on his backside)
    S.append(sit((-10, -4), torso='lean', head='nc_hurt', armN=op((6, 1), -1), armF=op((1, 2), -1), squash=(0.85, 1.08)))
    S.append(sit((-10, -6), torso='back1', head='nc_hurt', armN=op((5, 6), 1), armF=op((-5, 7))))
    S.append(sit((-10, -5), torso='up', head='nc_dazed', **lap))
    S.append(sit((-10, -5), torso='back1', head='nc_dazed', hd=(-1, 0), fx=[('star', (-12, -27)), ('star', (-3, -30))], **lap))
    S.append(sit((-10, -5), torso='up', head='nc_dazed', fx=[('star', (-8, -31)), ('star', (0, -27))], **lap))
    S.append(sit((-10, -5), torso='lean1', head='nc_dazed', hd=(1, 0), fx=[('star', (-4, -30)), ('star', (-13, -28))], **lap))
    S.append(sit((-10, -5), torso='up', head='nc_dazed', fx=[('star', (-11, -29)), ('star', (-2, -29))], **lap))
    S.append(sit((-10, -5), torso='up', head='nc_blink', **lap))
    out = [full(p, ground=k >= 4) for k, p in enumerate(S)]
    out[4].smear = True
    return out


def get_up():
    """From sitting in the road: shakes his head, tucks a leg, up onto one knee, pushes up, stands,
    and turns to run, wailing (the flee follows)."""
    S = []
    S.append(fp((-10, -5), (-1, -3), (3, -3), 'heel', 'heel', torso='up', head='nc_hurt', hd=(1, 0),
                armN=hand((3, 9), 'open', 1), armF=hand((-6, 8), 'open', 1)))
    S.append(fp((-9, -6), (-3, -3), (-1, -4), 'flat', 'toe', torso='lean1', head='nc_dazed',
                armN=hand((5, 8), 'open', -1), armF=hand((-5, 9), 'open', 1)))
    S.append(fp((-6, -9), (-12, -2), (-1, -4), 'toe', 'flat', torso='lean2', head='nc_dazed',
                armN=hand((4, 8), 'fist', -1), armF=hand((-2, 9), 'open', 1)))
    S.append(fp((-3, -14), (-7, -4), (1, -4), 'toe', 'flat', torso='lean1', head='nc_panic',
                armN=hand((5, 6), 'open', -1), armF=hand((-2, 8), 'open', 1)))
    S.append(fp((-1, -17), (-5, -4), (3, -4), torso='up', head='nc_panic', armN=hand((6, 2), 'open', -1), armF=hand((-5, 6), 'open', 1)))
    S.append(fp((0, -16), (-5, -4), (5, -4), 'toe', 'flat', torso='lean2', head='nc_wail',
                armN=hand((8, -2), 'up', -1), armF=hand((-6, -4), 'up', -1)))
    return [full(p) for p in S]


# the flee: a 12-frame panic run at 2 px/tick (2 ticks a frame: the planted foot moves back 4 px a
# frame, 48 px a cycle), two flight frames, the arms flailing over his head, wailing MAMA!
FLEE_N = 12
FLEE_STEP = 4.0


def flee_foot(k):
    k %= FLEE_N
    if k <= 4:
        x = 8 - FLEE_STEP * k
        shoe = 'heel' if k == 0 else 'toe' if k == 4 else 'flat'
        return (x, -3 if shoe == 'heel' else -4), shoe
    t = (k - 4) / 8.0
    x = -8 + 16 * (1 - math.cos(math.pi * t)) / 2
    y = -4 - 7.5 * math.sin(math.pi * min(1.0, t * 1.1)) ** 0.9
    shoe = 'back' if t < 0.35 else 'hang' if t < 0.8 else 'flat'
    return (x, y), shoe


def flee():
    out = []
    pel_y = [-16, -16.5, -16, -16.5, -17, -18]
    for i in range(FLEE_N):
        na, ns = flee_foot(i)
        fa, fs = flee_foot(i + 6)
        lower = A.legs((1, pel_y[i % 6]), fa, na, fs, ns)
        lower['legF']['hip'] = (-1 + 0.3 * fa[0], 0)
        lower['legN']['hip'] = (1 + 0.3 * na[0], 0)
        ph = 2 * math.pi * i / FLEE_N
        # the arms flail: the near hand flung up ahead of his face, the far one up behind his
        # head, flapping out of step (a beat behind the legs)
        nh = (8.5 + 1.0 * math.cos(ph - 0.6), -3.5 + 2.0 * math.sin(ph - 0.6))
        fh = (-6.5 - 1.0 * math.cos(ph - 0.6), -6 - 2.0 * math.sin(ph - 0.6))
        up = A.up(torso='lean2', head='nc_wail' if (i // 3) % 2 == 0 else 'nc_panic', hd=(1, 1 if i % 6 in (1, 2) else 0),
                  near=hand(nh, 'up', -1), far=hand(fh, 'up', -1))
        out.append(fig(up, lower))
    return X.plant(out)


# ------------------------------------------------------------------------------------ build
def build(s, with_cap=True):
    install_fx()
    s.strip('ride', ride(), RIDE_TICKS, cls='locomotion')
    s.strip('idle', idle(), [10, 5, 10, 5], cls='idle')
    s.strip('turn', turn(), 2, loop=False, cls='turn')
    s.strip('alert', alert(), 30, cls='telegraph')
    s.strip('tell', tell(), TELL_TICKS, loop=False, cls='telegraph')
    s.strip('kick', kick(), KICK_TICKS, loop=False, cls='melee')
    s.strip('gag', gag(), GAG_TICKS, cls='fidget')
    s.strip('gloat', gloat(), 6, defer=True, cls='victory')
    s.strip('photo-pose', photo_pose(), PHOTO_TICKS, cls='victory')
    s.strip('cower', cower(), 3, defer=True, cls='reaction')
    s.strip('die', die(), [4, 4, 4, 4, 4, 4, 5, 5, 6, 10], loop=False, cls='die')
    s.strip('die-knife', die_knife(), [3, 3, 4, 4, 4, 4, 4, 3, 3, 4, 10], loop=False, cls='die')
    s.strip('die-blast', die_blast(), [4, 4, 4, 4, 4, 3, 5, 5, 5, 12], loop=False, cls='die-blast')
    s.strip('die-burn', die_burn(), [3, 5, 5, 10, 6, 6, 7], loop=False, cls='die-burn')
    s.strip('die-crush', die_crush(), [7, 3, 13, 10, 14], loop=False, cls='die-crush')
    s.strip('die-seat', die_seat(), [3, 3, 3, 4, 2, 4, 4, 4, 4, 4, 3, 3], loop=False, defer=True, cls='die')
    s.strip('get-up', get_up(), [6, 4, 4, 4, 4, 4], loop=False, defer=True, cls='get-up')
    s.strip('flee', flee(), 2, cls='locomotion')
    s.strip('bike', bike_wreck(), [6, 6, 6, 8, 6, 6], loop=False, cls='prop')
    if with_cap:
        s.strip('cap', cap(), 2, cls='prop')
    s.event('KICK_HIT', KICK_HIT)
