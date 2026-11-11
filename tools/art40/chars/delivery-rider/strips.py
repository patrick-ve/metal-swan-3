# The delivery rider's strips: poses per frame and the holds in 60 Hz ticks. Every logic time the
# game reads stays (docs/design/ams40/contract.md "delivery rider"); the frame counts follow the
# plan's action classes. Drawn facing right (the game's unflipped sprite faces right).
#
# On the bike (rider.py): ride, turn, alert, tell, gag, kick, photo-pose, gloat, cower. On foot (the
# rig's full figure; the bike leaves as the 'bike' FX, the cube bag as the 'food-cube' prop): the
# five deaths and flee. Props: bike (the riderless wreck), food-cube (the popped bag).
import math

import art40 as X
import castkit as K
import ext_moves as M
import pose
import rig

from . import bike as B
from . import kit
from . import parts
from . import rider as RD

F = RD.frame
A = K.A

# ------------------------------------------------------------------------------------ ride (12)
RIDE_N = 12
# 20 ticks a crank turn (the old RIDE_DURATIONS total): 12 crank positions 30 degrees apart
RIDE_DUR = [2, 2, 1] * 4
SPIN = 20          # the spokes turn 20 degrees a frame (a 60-degree pattern: 240 a loop, reads forward)


def crank_of(k, n=RIDE_N, c0=90):
    return c0 + 360 * k / n


def bob(c):
    """1 when a pedal is in its power stroke (front, going down): the torso dips a pixel."""
    return 1 if (c % 180) < 75 else 0


def ride_frames(n=RIDE_N, head='fwd', upper=None, c0=90):
    """A pedalling loop of n frames: the cranks turn, the torso dips on each power stroke, the head
    follows a frame late, the cube bag two frames late (secondary motion). upper(k) -> extra
    keyword arguments of RD.frame (arms, head, fx) per frame."""
    cs = [crank_of(k, n, c0) for k in range(n)]
    bobs = [bob(c) for c in cs]
    out = []
    for k in range(n):
        b = bobs[k]
        kw = dict(crank=cs[k], spin=SPIN * k * 12 / n, torso='lean', head=head, tor=(0, b),
                  hd=(1, bobs[k - 1] - b), cube=(bobs[k - 2] - b, 0))
        if upper:
            kw.update(upper(k))
        out.append(F(**kw))
    return out


# ------------------------------------------------------------------------------------ stopped
# Stopped (idle, photo, gloat, cower): he slides forward off the saddle onto the frame, the near
# foot down on the road, the far foot up on its pedal ready to push off (crank 120).
STOP = dict(crank=120, pel=(4, 2), legN=((-1, -4), 'flat', 1))


def stop(**kw):
    a = dict(STOP)
    a.update(kw)
    return F(**a)


def idle():
    # breathing: the chest swells (frames 1-2), the head follows a frame late, the bag settles last;
    # a blink on the last frame
    by = [0, 0, 1, 1]
    hy = [0, 1, 1, 0]
    cy = [1, 0, 0, 1]
    out = []
    for k in range(4):
        out.append(stop(torso='in' if k in (1, 2) else 'lean1', head='blink' if k == 3 else 'fwd',
                        tor=(0, by[k]), hd=(1, hy[k] - by[k]), cube=(cy[k] - by[k], 0)))
    return out


# ------------------------------------------------------------------------------------ turn (3)
def squeeze(f, k):
    """The frame narrowed to k of its width around the anchor column (the Turner's in-betweens):
    the outline is taken off, the columns sampled, outlined again; the joints squeeze with it."""
    rows = [r.replace('K', '.') for r in f.rows]
    rx = f.root[0]
    w = len(rows[0])
    out = []
    for r in rows:
        line = []
        for x in range(w):
            i = int(math.floor(rx + (x - rx) / k + 0.5))
            line.append(r[i] if 0 <= i < w else '.')
        out.append(''.join(line))
    g = [list(r) for r in out]
    res = [r[:] for r in g]
    for y in range(len(g)):
        for x in range(w):
            if g[y][x] == '.':
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    X_, Y_ = x + dx, y + dy
                    if 0 <= X_ < w and 0 <= Y_ < len(g) and g[Y_][X_] != '.':
                        res[y][x] = 'K'
                        break
    sq = lambda p: (rx + (p[0] - rx) * k, p[1])
    return X.Frame([''.join(r) for r in res], f.root, pts={n: sq(p) for n, p in f.pts.items()},
                   joints={n: sq(p) for n, p in f.joints.items()})


def turn():
    # the bike swings round under him (old TURN_WIDTHS 0.75, 0.5, 0.25; played forward then back)
    base = F(crank=90, torso='lean1', head='fwd', hd=(1, 0))
    return [squeeze(base, w) for w in (0.75, 0.5, 0.25)]


# ------------------------------------------------------------------------------------ alert (1)
def alert():
    return [F(crank=90, torso='up', head='shout', hd=(0, -1), tor=(0, -1))]


# ------------------------------------------------------------------------------------ tell (12)
RING = [0, 1, 6, 7]                       # the thumb presses the lever: the bell rings
RING_FX = [[(3, -3, 'y'), (4, -2, 'y'), (5, -1, 'y'), (2, -5, 'y'), (3, -6, 'y'), (5, -5, 'y'), (6, -4, 'y')],
           [(4, -4, 'y'), (5, -3, 'y'), (6, -2, 'y'), (3, -7, 'y'), (4, -8, 'y'), (7, -6, 'y'), (8, -5, 'y'), (6, -7, 'W')]]


def tell():
    """TRING TRING!: pedalling on (the same 20-tick crank turn), leaning in, shouting; the near thumb
    flicks the bell lever twice a turn (every 10 ticks, the old bell rhythm), the ring marks burst
    and spread."""
    def up(k):
        if k in RING:
            r = RING.index(k) % 2
            return dict(armN=((1.5, -1.0), ('hand', 'thumbdn'), -1), head='shout', fx=RING_FX[r], torso='lean2')
        thumb = 'thumb' if k % 6 in (4, 5) else 'grip'
        return dict(armN=((0.5, -0.5), ('hand', thumb), -1), head='shout' if k % 6 == 2 else 'grit', torso='lean2')
    return ride_frames(upper=up)


# ------------------------------------------------------------------------------------ gag (12)
def gag():
    """SORRY, LATE ORDER!: riding one-handed, slowly (a 24-tick crank turn), the phone up in the near
    hand, eyes on the screen; the thumb scrolls (the phone dips), a glance up and a blink."""
    def up(k):
        dy = [0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0][k]
        head = 'blink' if k == 9 else 'fwd' if k in (5, 6) else 'down'
        return dict(armN=((2, -5 + dy), ('hand', 'phone'), -1), head=head, torso='lean1')
    return ride_frames(upper=up)


# ------------------------------------------------------------------------------------ kick (6)
def kick():
    """The kick while passing: anticipation (the near knee comes up off the pedal, the back
    straightens), the chamber (smear: the knee high, the foot cocked), the whip (smear: the leg snaps
    forward, speed lines), the impact (the sole out at shin height, a star; the body leans back
    against it), the recoil (the knee gives), the retract (back toward the pedal, held). The far
    foot keeps pedalling. Ticks [1, 1, 1, 2, 2, 29]: the extended frame starts at tick 3 (KICK_HIT),
    the box is live for ticks 1-6 (the code), the strip keeps its 36 ticks."""
    c0 = 90
    cr = [c0 + 25 * k for k in range(6)]
    # FX relative to the bell (ground point + (8, -25))
    smear_lines = lambda: [(-5, 6, 'W'), (-4, 6, 'W'), (-3, 6, 'i'), (-7, 9, 'W'), (-6, 9, 'i'), (-5, 9, 'i'),
                           (-6, 3, 'i'), (-5, 3, 'W')]
    star = [(13, 11, 'y'), (14, 10, 'W'), (14, 12, 'W'), (15, 11, 'W'), (14, 11, 'F'), (16, 9, 'y'), (16, 13, 'y'),
            (12, 9, 'y'), (12, 13, 'y')]
    frames = [
        # 0: anticipation: the near knee lifts off the pedal, the back straightens, teeth bared
        F(crank=cr[0], spin=0, torso='up', head='grit', hd=(1, 0), pel=(2, -2), legN=((2, -15), 'toe', 1), cube=(1, 0)),
        # 1: chamber (smear): up off the saddle, the knee high to the chest, the foot cocked
        F(crank=cr[1], spin=20, torso='back1', head='grit', hd=(0, 0), pel=(3, -2), legN=((3, -17), 'toe', 1), cube=(1, -1),
          smear=True),
        # 2: the whip (smear): he lunges over the top tube, the leg snaps out, speed lines behind it
        F(crank=cr[2], spin=40, torso='back', head='shout', hd=(0, 0), pel=(6, -1), legN=((10, -18), 'flat', 1), cube=(0, -1),
          fx=smear_lines(), smear=True),
        # 3: the impact: the sole out ahead of the front wheel at shin height, a star at the toe,
        # the body leans back against it
        F(crank=cr[3], spin=60, torso='back', head='shout', hd=(0, 0), pel=(8, -1), legN=((14, -15), 'flat', 1), cube=(-1, -1),
          fx=star),
        # 4: the recoil: the knee gives, the foot bounces back, the bag swings on
        F(crank=cr[4], spin=80, torso='back1', head='grit', hd=(0, 0), pel=(7, -1), legN=((10, -14), 'flat', 1), cube=(-1, 0)),
        # 5: retract (held): back onto the saddle, the foot down toward its pedal, a grin
        F(crank=cr[5], spin=100, torso='lean1', head='happy', hd=(1, 0), pel=(5, -1), legN=((6, -11), 'toe', 1), cube=(0, 0)),
    ]
    return frames


KICK_DUR = [1, 1, 1, 2, 2, 29]
KICK_HIT = 3


# ------------------------------------------------------------------------------------ photo-pose (6)
def photo_pose():
    """SAY CHEESE: stopped, the near hand comes off the bar into a peace sign beside the helmet, a
    big grin, the flash makes him blink, the hand wavers (a loop)."""
    hs = [((1, -2), 'open'), ((3.5, -4), 'peace'), ((4, -4.5), 'peace'), ((4, -4.5), 'peace'), ((3.5, -4), 'peace'), ((3, -3.5), 'peace')]
    heads = ['happy', 'happy', 'happy', 'smug', 'blink', 'happy']
    tor = [0, -1, -1, 0, 0, 0]
    out = []
    for k in range(6):
        h, e = hs[k]
        out.append(stop(torso='up' if k else 'lean1', head=heads[k], tor=(0, tor[k]), hd=(1, 0),
                        armN=(h, ('hand', e), -1), cube=(0 if k else 1, 0)))
    return out


# ------------------------------------------------------------------------------------ gloat (6)
def gloat():
    """The gloat (every player out): stopped, facing the spot, checking his phone (the screen lit):
    reads, scrolls (the thumb, the phone dips), smirks, a smug glance up over it, back to reading."""
    ph = [(2, -5), (2, -4), (2, -5), (2, -5), (2, -6), (2, -5)]
    heads = ['down', 'down', 'smirk', 'smirk', 'smug', 'blink']
    tor = [0, 0, 0, -1, -1, 0]
    out = []
    for k in range(6):
        out.append(stop(torso='lean1', head=heads[k], tor=(0, tor[k]), hd=(1, 0),
                        armN=(ph[k], ('hand', 'phone'), -1)))
    return out


# ------------------------------------------------------------------------------------ cower (4)
def cower():
    """Forearms up before the face, hunched over the bar, the bike rocking under him."""
    out = []
    for k in range(4):
        sh = [0, 1, 0, -1][k]
        out.append(stop(torso='lean3', head='panic', tor=(0, 1), hd=(2, 2 + (k % 2)), rot=[-3, 0, -2, 0][k],
                        armN=((-3 + sh, -11 - k % 2), ('hand', 'open'), -1),
                        armF=((-4, -10 + k % 2), ('hand', 'open'), -1), cube=(1 - k % 2, 0)))
    return out


# ------------------------------------------------------------------------------------ on foot
def game_pts(j):
    nk = j.get('head.neck') or j.get('torso.neck') or j['pel']
    return {'hand': j.get('armN.wrist', j['pel']), 'head': (nk[0] + 1, nk[1] - 7), 'hip': j['pel']}


def _turn(pt, piv, deg):
    a = math.radians(deg)
    dx, dy = pt[0] - piv[0], pt[1] - piv[1]
    return (piv[0] + dx * math.cos(a) + dy * math.sin(a), piv[1] - dx * math.sin(a) + dy * math.cos(a))


def seen_joints(p, j):
    """The joints where the player SEES them (the handhaver's rule): turned with 'rot' (the upper
    body about the pelvis), 'spin' (the whole body) and squashed with 'squash'."""
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


def full(p, ground=True, smear=False):
    """One-piece frame (deaths): pose.compose 'full' with the post hook (spin, squash, soot); a
    figure that would sink under the feet anchor is raised until it stands on the floor line."""
    def sink(rows, root):
        ys = [y for y, r in enumerate(rows) if r.strip('.')]
        return (max(ys) + 1 - root[1]) if ys else 0
    rows, root, j = X.full(p)
    below = sink(rows, root)
    if ground and below > 0:
        px, py = p.get('pelvis', (0, -17))
        q = dict(p, pelvis=(px, py - below))
        r2, root2, j2 = X.full(q)
        if sink(r2, root2) < below:
            p, rows, root, j = q, r2, root2, j2
            below = sink(rows, root)
        if below > 0:
            root = (root[0], root[1] + below)
    j = seen_joints(p, j)
    return X.Frame(rows, root, pts=game_pts(j), joints=j, smear=smear)


fp = M.fp


def op(h, b=1, kind='open'):
    return dict(hand=h, end=('hand', kind), bend=b)


def lie(**kw):
    base = dict(rot=90, armN=op((-6, -1)), armF=op((-5, 3)))
    base.update(kw)
    return base


# Seated on air (the saddle is gone from under him: the bike is the 'bike' FX at the same spot on
# the first frames): the pelvis at the saddle, the feet where the pedals were.
SEAT_PEL = (-6, -20)


def die():
    """Shot off the bike: the jolt in the saddle, thrown back off it (the arms fly up, the legs come
    off the pedals), he turns over backwards in the air, lands on his back (the helmet bounces him
    once), lies dazed, blinks."""
    S = [
        fp(SEAT_PEL, (-1, -12), (2, -5), 'toe', 'flat', torso='back1', head='hurt', armN=op((8, -4), -1), armF=op((6, -6), -1)),
        fp((-7, -22), (-2, -13), (1, -9), 'toe', 'toe', rot=14, head='hurt', armN=op((8, -7), -1), armF=op((3, -9), -1)),
        fp((-8, -21), (-5, -14), (-1, -12), 'hang', 'toe', rot=32, head='dazed', armN=op((7, -8), -1), armF=op((2, -9), -1)),
        fp((-9, -18), (-6, -15), (-3, -14), 'hang', 'hang', rot=52, head='dazed', armN=op((6, -8), -1), armF=op((1, -9), -1)),
        fp((-10, -13), (-6, -14), (-2, -15), 'heel', 'heel', rot=70, head='hurt', armN=op((5, -8), -1), armF=op((0, -9), -1)),
        fp((-10, -3), (-4, -6), (1, -7), 'lie', 'lie', head='hurt', **lie(armN=op((4, -8), -1), armF=op((-1, -9), -1))),
        fp((-10, -5), (-6, -10), (-1, -12), 'heel', 'heel', rot=84, head='dazed', armN=op((0, -7), -1), armF=op((-3, -7))),
        fp((-10, -3), (-3, -5), (2, -5), 'lie', 'lie', head='dazed', **lie(armN=op((-3, -4)), armF=op((-4, 0)))),
        fp((-10, -3), (-3, -4), (2, -4), 'lie', 'lie', head='dazed', **lie(armN=op((-6, -2)))),
        fp((-10, -3), (-3, -3), (2, -3), 'lie', 'lie', head='blink', **lie()),
    ]
    out = [full(p, ground=k >= 5) for k, p in enumerate(S)]
    # the slam (a smear): he drops the last few px onto his back in a streak
    out[4].smear = True
    out[4].rows = streak(out[4].rows)
    return out


def die_knife():
    """Knifed in the saddle: he doubles over the bar (both hands to his belly), slides off sideways
    onto his feet, sinks to his knees, sways, falls on his face."""
    belly = lambda h: dict(hand=h, end=('fist', 'fist'), bend=-1)
    S = [
        fp(SEAT_PEL, (-1, -12), (2, -5), 'toe', 'flat', torso='lean2', head='hurt', armN=belly((5, 6)), armF=belly((6, 6))),
        fp((-5, -19), (-2, -10), (1, -6), 'toe', 'flat', torso='lean3', head='hurt', hd=(1, 1), armN=belly((4, 7)), armF=belly((5, 7))),
        fp((-3, -16), (-6, -4), (3, -4), 'toe', 'flat', torso='lean2', head='hurt', hd=(1, 1), armN=belly((4, 7)), armF=belly((5, 7))),
        fp((-2, -13), (-7, -4), (3, -4), 'toe', 'flat', torso='lean2', head='hurt', hd=(1, 1), armN=belly((4, 7)), armF=belly((5, 7))),
        fp((-1, -9), (-8, -2), (4, -4), 'toe', 'flat', torso='lean', head='dazed', armN=belly((4, 7)), armF=belly((5, 6))),
        fp((-1, -9), (-8, -2), (4, -4), 'toe', 'flat', torso='up', head='dazed', armN=op((3, 9)), armF=op((2, 9))),
        fp((-1, -9), (-8, -2), (4, -4), 'toe', 'flat', rot=-22, head='dazed', armN=op((5, 8)), armF=op((4, 9))),
        fp((-1, -8), (-8, -2), (4, -4), 'toe', 'flat', rot=-55, head='hurt', armN=op((8, 4), -1), armF=op((8, 5), -1)),
        fp((-3, -5), (-11, -3), (-5, -3), 'toe', 'toe', rot=-88, head='hurt', armN=op((9, 0), -1), armF=op((9, 1), -1)),
        fp((-3, -5), (-11, -3), (-5, -3), 'toe', 'toe', rot=-88, head='blink', armN=op((9, 0), -1), armF=op((9, 1), -1)),
    ]
    return [full(p) for p in S]


def die_blast():
    """Blown off the bike: the jolt, the game launches the body in its arc while it turns over
    backwards (8 -> 128 degrees, about 25 a frame), the limbs trail the turn and open and close; a
    smear whirls him onto his back, he slams down, bounces, lies in a wisp of smoke."""
    def air(deg, pel, far, near, fs, ns, head, armN, armF, torso='back'):
        return M.tumble(fp(pel, far, near, fs, ns, torso=torso, head=head, armN=op(armN, -1), armF=op(armF)), deg)
    S = [
        air(8, (0, -18), (-7, -6), (6, -7), 'back', 'heel', 'panic', (9, -5), (-8, -5)),
        air(30, (0, -18), (-6, -8), (7, -6), 'hang', 'flat', 'panic', (10, -1), (-6, -8)),
        air(54, (0, -18), (-7, -8), (7, -8), 'back', 'heel', 'panic', (9, -7), (-8, -5)),
        air(78, (0, -18), (-5, -9), (5, -11), 'hang', 'hang', 'panic', (8, -6), (-7, -5), 'up'),
        air(102, (0, -18), (-6, -7), (7, -9), 'back', 'heel', 'hurt', (10, -3), (-8, -7)),
        air(128, (0, -18), (-5, -8), (6, -9), 'hang', 'hang', 'hurt', (9, -2), (-7, -2), 'up'),
        fp((-10, -3), (5, -5), (10, -6), 'lie', 'lie', head='hurt', **lie(armN=op((-6, -2)))),
        fp((-10, -6), (3, -11), (8, -13), 'heel', 'heel', head='hurt', rot=82, armN=op((-5, -6)), armF=op((-3, -6))),
        fp((-10, -3), (5, -4), (10, -5), 'lie', 'lie', head='hurt', **lie()),
        fp((-10, -3), (6, -3), (11, -3), 'lie', 'lie', head='blink', fx=[('smk2', (-14, -9)), ('smk0', (-12, -15))], **lie()),
    ]
    out = [full(p, ground=k >= 6) for k, p in enumerate(S)]
    out[5].smear = True
    out[5].rows = streak(out[5].rows)
    return out


def streak(rows):
    """A smear: a short smoke streak behind the whirling body (FX letters, no outline)."""
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
    """Set alight in the saddle: it catches (a jolt), he leaps off with the hot-foot hop and
    flailing arms, a soot statue with white eyes (a blink), then stiff as a board he tips over
    backwards into a puff of smoke."""
    S = [
        fp(SEAT_PEL, (-1, -12), (2, -5), 'toe', 'flat', head='panic', torso='back', armN=op((8, -5), -1), armF=op((-6, -6)),
           fx=[('fl0', (-8, -18)), ('fl1', (-9, -22))]),
        fp((-3, -21), (-6, -9), (2, -7), 'back', 'hang', head='panic', armN=op((8, -7), -1), armF=op((-9, -2)),
           fx=[('fl1', (-7, -21)), ('fl2', (-5, -29)), ('fl0', (1, -17))]),
        fp((0, -18), (-4, -4), (6, -9), 'flat', 'hang', head='shout', armN=op((7, 1), -1), armF=op((-6, 1)),
           fx=[('fl2', (-4, -23)), ('fl2', (1, -35)), ('fl1', (-3, -13))]),
    ]
    statue = dict(head='soot', armN=op((2, 9), -1), armF=op((-1, 9), -1), soot=1)
    S.append(fp((0, -17), (-5, -4), (5, -4), fx=[('fl0', (-2, -45)), ('fl0', (3, -44)), ('smk1', (-3, -50))], **statue))
    S.append(fp((0, -17), (-5, -4), (5, -4), fx=[('smk2', (1, -54)), ('smk0', (-3, -60))], **dict(statue, head='sootblink')))
    S.append(fp((-3, -15), (-6, -4), (4, -6), 'toe', 'hang', rot=40, head='soot', soot=1,
                armN=op((3, 6), -1), armF=op((-2, 8), -1), fx=[('smk1', (-10, -40))]))
    S.append(fp((-7, -9), (0, -4), (7, -5), 'heel', 'hang', rot=66, head='soot', soot=1,
                armN=op((0, 3), -1), armF=op((-4, 5), -1), fx=[('smk1', (-14, -30))]))
    S.append(fp((-10, -3), (6, -3), (11, -3), 'lie', 'lie', head='sootblink', soot=1,
                fx=[('smk1', (-10, -10)), ('smk1', (2, -9)), ('smk0', (-4, -14))], **lie()))
    return [full(p, ground=k != 1) for k, p in enumerate(S)]


def die_crush():
    """Crushed: he looks up and ducks, arms over the helmet (anticipation); the impact squashes him;
    flat on his back (helmet, face and jacket still read), springs up once, flattens again with
    stars, blinks."""
    duck = fp((0, -15), (-6, -4), (5, -4), torso='back1', head='panic', armN=op((8, -10), -1), armF=op((-5, -11)))
    flat = fp((-4, -3), (12, -3), (17, -3), 'lie', 'lie', head='hurt', **lie())
    stars = lambda a, b: [('star', a), ('star', b)]
    out = [full(duck),
           full(dict(duck, squash=(0.45, 1.25)), smear=True),
           full(dict(flat, squash=(0.55, 1.15))),
           full(dict(flat, squash=(0.8, 1.05), fx=stars((-8, -14), (6, -16)))),
           full(dict(flat, squash=(0.5, 1.18), fx=stars((-4, -11), (9, -10)))),
           full(dict(flat, head='blink', squash=(0.55, 1.15), fx=stars((-1, -12), (11, -12))))]
    return out


# ------------------------------------------------------------------------------------ flee (12)
FLEE_DUR = [1, 1, 2] * 4            # 16 ticks (the old total), 12 frames
FLEE_SPEED = 2.0                    # px per tick (the contract)
FLEE_T = sum(FLEE_DUR)
STANCE = 0.4                       # the share of the cycle a foot is down


def flee_foot(t):
    """One foot at tick t of the 16-tick cycle: planted (back 2 px a tick), then the swing."""
    t %= FLEE_T
    st = STANCE * FLEE_T
    half = FLEE_SPEED * st / 2
    if t < st:
        x = half - FLEE_SPEED * t
        shoe = 'heel' if t < 1 else 'toe' if t > st - 1.5 else 'flat'
        return (x, -3 if shoe == 'heel' else -5 if shoe == 'toe' else -4), shoe
    s = (t - st) / (FLEE_T - st)
    x = -half + 2 * half * (0.5 * s + 0.25 * (1 - math.cos(math.pi * s)))
    y = -4 - 6 * math.sin(math.pi * min(1.0, s * 1.15)) ** 0.9
    shoe = 'back' if s < 0.3 else 'hang' if s < 0.8 else 'flat'
    if shoe == 'back':
        y = min(y, -6)
    return (x, y), shoe


def flee():
    """Running for it on foot, arms flailing over the helmet (panic), 2 px a tick."""
    out = []
    t = 0
    for k in range(12):
        na, ns = flee_foot(t)
        fa, fs = flee_foot(t + FLEE_T / 2)
        ph = 2 * math.pi * t / FLEE_T
        lift = 1 if math.cos(2 * ph) > 0.3 else 0
        lower = A.legs((0, -17 + lift), fa, na, fs, ns)
        sw = math.sin(ph)
        up = A.up(torso='lean1', head='panic', hd=(1, 0),
                  near=dict(hand=(2 + 3 * sw, -9 - 2 * abs(sw)), end=('hand', 'open'), bend=-1),
                  far=dict(hand=(1 - 3 * sw, -9 - 2 * abs(math.cos(ph))), end=('hand', 'open'), bend=-1))
        rows, root, j = X.humanoid(up, lower)
        out.append(X.Frame(rows, root, pts=game_pts(j), joints=j))
        t += FLEE_DUR[k]
    return X.plant(out)


# ------------------------------------------------------------------------------------ bike (6)
def wreck(sy, rot, spin, dust=(), sparks=(), crank=150):
    cv = kit.canvas(RD.W, RD.H)
    g = B.Geo(RD.R, rot=rot, sy=sy)
    B.draw(cv, g, crank=crank, spin=spin, bell=sy > 0.8, light=True)
    gx, gy = RD.R
    rows = kit.finish(cv, [(gx + x, gy + y, ch) for x, y, ch in list(dust) + list(sparks)])
    return X.Frame(rows, RD.ROOT, pts={})


def puff(x, y, big):
    """A dust puff (FX greys) centred at (x, y) relative to the ground point."""
    if big == 2:
        pat = ['..dd.dd..', '.dDDdDDd.', 'dDDDDDDDd', 'dDDDDDDDd', '.ddDDDdd.']
    elif big:
        pat = ['.dd.', 'dDDd', 'DDDd']
    else:
        pat = ['dd', 'Dd']
    return [(x + i, y + j - len(pat) + 1, ch) for j, r in enumerate(pat) for i, ch in enumerate(r) if ch != '.']


def bike():
    """The riderless bike: it rears and tips (the crash), falls onto its side (squashed: the wheels
    become ellipses), skids on in sparks and dust, the front wheel still turning, then a dust cloud
    swallows it (the FX ends with the strip)."""
    sparks0 = [(-6, 0, 'f'), (-8, -1, 'y'), (-10, 0, 'W')]
    return [
        wreck(1.0, -12, 0),
        wreck(0.7, -4, 25, sparks=[(14, 0, 'y'), (16, -1, 'W')]),
        wreck(0.42, 0, 50, sparks=sparks0 + [(18, 0, 'f')], dust=puff(-25, 0, False)),
        wreck(0.35, 0, 75, dust=puff(-29, 0, True) + puff(-24, 0, False), sparks=[(-9, 0, 'y'), (20, 0, 'f')]),
        wreck(0.35, 0, 90, dust=puff(-33, -1, True) + puff(-27, 0, True) + puff(22, 0, False)),
        wreck(0.35, 0, 100, dust=puff(-35, -1, True) + puff(-28, 0, 2) + puff(-20, -1, 2) + puff(-12, 0, 2)
              + puff(-4, -1, 2) + puff(4, 0, 2) + puff(12, -1, 2) + puff(18, 0, True)),
    ]


# ------------------------------------------------------------------------------------ food-cube (4)
def food_cube():
    """The popped cube bag tumbling end over end (quarter turns, the lid flapping)."""
    out = []
    base = parts.CUBE_OPEN
    for k in range(4):
        rows = list(base)
        for _ in range(k):                       # a quarter turn clockwise
            rows = [''.join(rows[len(rows) - 1 - y][x] for y in range(len(rows))) for x in range(len(rows[0]))]
        cv = kit.canvas(24, 24)
        h, w = len(rows), len(rows[0])
        kit.grid(cv, 12 - w // 2, 12 - h // 2, rows, 1, 'cube')
        out.append(X.Frame(kit.finish(cv), (12, 12), pts={}))
    return out


# ------------------------------------------------------------------------------------ build
def install_fx():
    for k, v in M.FX.items():
        K.P.FX[k] = v
    M._hook()


KEEP = 'w' + parts.FX_LETTERS


class _Clean:
    """s.strip with the orphan fix (kit.deorphan) on every frame."""

    def __init__(self, s):
        self.s = s

    def strip(self, name, frames, *a, **kw):
        for f in frames:
            f.rows = kit.deorphan(f.rows, KEEP)
        self.s.strip(name, frames, *a, **kw)


def build(s0):
    install_fx()
    s = _Clean(s0)
    s.strip('ride', ride_frames(), RIDE_DUR, cls='ride')
    s.strip('idle', idle(), [10, 5, 10, 5], cls='idle')
    s.strip('turn', turn(), 2, loop=False, cls='turn')
    s.strip('alert', alert(), 30, cls='telegraph')
    s.strip('tell', tell(), RIDE_DUR, cls='telegraph')
    s.strip('gag', gag(), 2, cls='fidget')
    s.strip('kick', kick(), KICK_DUR, loop=False, cls='melee')
    s.strip('photo-pose', photo_pose(), [4, 3, 3, 4, 3, 3], cls='victory')
    s.strip('gloat', gloat(), [6, 4, 4, 6, 4, 4], defer=True, cls='victory')
    s.strip('cower', cower(), 3, defer=True, cls='reaction')
    s.strip('die', die(), [5, 5, 4, 4, 3, 5, 4, 5, 5, 10], loop=False, cls='die')
    s.strip('die-knife', die_knife(), [3, 3, 4, 4, 4, 4, 5, 4, 5, 10], loop=False, cls='die')
    s.strip('die-blast', die_blast(), [4, 4, 4, 4, 4, 3, 5, 5, 5, 12], loop=False, cls='die-blast')
    s.strip('die-burn', die_burn(), [3, 4, 4, 10, 7, 5, 4, 5], loop=False, cls='die-burn')
    s.strip('die-crush', die_crush(), [6, 3, 10, 6, 6, 16], loop=False, cls='die-crush')
    s.strip('flee', flee(), FLEE_DUR, cls='locomotion')
    s.strip('bike', bike(), [6, 6, 6, 8, 6, 6], loop=False, cls='prop')
    s.strip('food-cube', food_cube(), 5, cls='prop')
    s0.event('KICK_HIT', KICK_HIT)
