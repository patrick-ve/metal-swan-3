# The FABEL FRIET owner's strips: poses per frame and the holds in 60 Hz ticks. Every logic time the
# game reads stays (docs/design/ams40/contract.md "Fabel Friet baker"); the frame counts follow the
# plan's action classes. Drawn facing right (the game's unflipped sprite faces right).
#
# The scoop: he holds it at rest (idle), points with it while he talks, waves it, and flings the
# player's prize out of it (toss: the item leaves the bowl, the 'hand' point of TOSS_RELEASE). On
# the walk, the clap and the cheer it sits in his apron pocket (its handle shows).
import math

import art40 as X
import castkit as K

from . import parts

P = K.P
A = K.A


# ------------------------------------------------------------------------------------ helpers
def hand(h, kind='fist', bend=-1, sh=(0, 0), z=None):
    return A.hand(h, kind, 'hand', bend=bend, sh=sh, z=z)


def legs(pel, far, near, fs='flat', ns='flat', fb=1, nb=1, fhip=None, nhip=None, apron=None):
    p = A.legs(pel, far, near, fs, ns, fb, nb)
    if fhip is not None:
        p['legF']['hip'] = fhip
    if nhip is not None:
        p['legN']['hip'] = nhip
    if apron:
        p['apron'] = apron
    return p


STAND = legs((0, -17), (-4, -4), (4, -4))


def game_pts(j):
    """The points the game had on every frame: hand (the near hand), head (the head centre), hip."""
    nk = j.get('head.neck') or j.get('torso.neck') or j['pel']
    return {'hand': j.get('armN.wrist', j['pel']), 'head': (nk[0] + 1, nk[1] - 7), 'hip': j['pel']}


def fig(upper, lower, pocket=False, hand_pt=None, reach=None):
    """One standing frame: the upper pose on the lower pose, with the game points and every joint.
    pocket: the scoop sits in the apron pocket. hand_pt: the 'hand' point moved by (dx, dy) from the
    wrist (the toss's release: the bowl of the scoop). reach: (upper arm, forearm) lengths for a
    frame with the arms thrown up (the cheer, the wave: the fists reach over the cap, a cartoon
    stretch of the 5.5 + 5.0 rig arm)."""
    parts.STATE['pocket'] = pocket
    old = (K.pose.UPPER, K.pose.FORE)
    if reach:
        K.pose.UPPER, K.pose.FORE = reach
    try:
        rows, root, j = X.humanoid(upper, lower)
    finally:
        K.pose.UPPER, K.pose.FORE = old
        parts.STATE['pocket'] = False
    g = game_pts(j)
    if hand_pt is not None:
        w = j['armN.wrist']
        g['hand'] = (w[0] + hand_pt[0], w[1] + hand_pt[1])
    return X.Frame(rows, root, pts=g, joints=j)


REACH = (6.5, 6.0)
CHEER_REACH = (7.5, 7.0)


def lerp(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


# ------------------------------------------------------------------------------------ idle (4)
SCOOP_REST = (5, 6)      # the scoop hand at the belt (from the near shoulder), the bowl up
FAR_REST = (1.5, 9.5)


def idle_up(k):
    by = [0, 0, 1, 1][k]
    hy = [0, 1, 1, 0][k]
    return A.up(torso='in' if k in (1, 2) else 'up', head='blink' if k == 2 else 'fwd', tor=(0, by),
                hd=(0, hy - by), near=hand((SCOOP_REST[0], SCOOP_REST[1] - by * 0.5), 'scoop'),
                far=hand((FAR_REST[0], FAR_REST[1] - by * 0.5), 'open'))


def idle():
    return [fig(idle_up(k), STAND) for k in range(4)]


# ------------------------------------------------------------------------------------ talk (8)
# He explains: the scoop points and beats out the words, the free hand opens to the front, the
# head nods on the stressed word, the mouth opens and shuts (a syllable a frame).
TALK = [
    # near (scoop) hand, kind, far hand, far kind, head, head dy, torso
    ((7, 1), 'scooppoint', (3, 8), 'open', 'talk', 0, 'up'),
    ((8, -1), 'scooppoint', (5, 6), 'open', 'talk2', 0, 'in'),
    ((8.5, -2.5), 'scooppoint', (7, 4), 'up', 'talk3', 0, 'in'),
    ((9, -1.5), 'scooppoint', (8, 3), 'up', 'talk', 1, 'lean1'),
    ((8.5, 0.5), 'scooppoint', (7, 4), 'up', 'fwd', 1, 'lean1'),
    ((8, 0), 'scooppoint', (6, 5), 'open', 'talk2', 0, 'up'),
    ((7.5, -1), 'scooppoint', (5, 6), 'open', 'talk', 0, 'up'),
    ((7, 0.5), 'scooppoint', (4, 7), 'open', 'fwd', 0, 'up'),
]


def talk():
    out = []
    for nh, nk, fh, fk, hd, hdy, torso in TALK:
        up = A.up(torso=torso, head=hd, hd=(0, hdy), near=hand(nh, nk), far=hand(fh, fk))
        out.append(fig(up, STAND))
    return out


# ------------------------------------------------------------------------------------ walk (12)
WALK_N = 12
WALK_TPF = 3          # 12 x 3 = 36 t: a 28.8 px stride at 0.8 px/tick (the handhaver's and the crew's;
                      # 12 x 4 = 38.4 px read as a lunge on 40 px legs)
STEP = 0.8 * WALK_TPF  # the planted foot moves back 2.4 px a frame
HALF = STEP * 3       # the planted foot runs from +HALF to -HALF over 6 frames
SHOE_Y = {'heel': -3, 'toe': -5}


def walk_foot(k):
    """One foot over the 12-frame cycle: planted for frames 0-6 (back 3.2 px a frame, heel strike
    to toe-off), swinging for 7-11 (lift behind, the knee drives forward, reach)."""
    k %= WALK_N
    if k <= 6:
        x = HALF - STEP * k
        shoe = 'heel' if k == 0 else 'toe' if k == 6 else 'flat'
        return (x, SHOE_Y.get(shoe, -4)), shoe
    t = (k - 6) / 6
    x = -HALF + 2 * HALF * (1 - math.cos(math.pi * t)) / 2
    y = -4 - 4.0 * math.sin(math.pi * min(1.0, t * 1.1))
    shoe = 'back' if t < 0.3 else 'hang' if t < 0.75 else 'flat'
    return (x, y), shoe


def walk_lower(i):
    na, ns = walk_foot(i)
    fa, fs = walk_foot(i + 6)
    # the pelvis is lowest at the contact (frames 0, 6) and highest at the passing (3, 9)
    pel_y = [-15.5, -16, -16.5, -17, -16.5, -16][i % 6]
    # the apron swings a frame behind the legs (follow-through)
    sway = 0.8 * math.sin(2 * math.pi * (i - 1.5) / 6)
    return legs((0, pel_y), fa, na, fs, ns, fhip=(-1 + 0.45 * fa[0], 0), nhip=(1 + 0.45 * na[0], 0),
                apron={'sway': sway})


def walk():
    out = []
    for i in range(WALK_N):
        ph = 2 * math.pi * i / WALK_N
        # the arms swing against the legs, a frame late (follow-through); the head bobs at contact
        sx = -3.8 * math.cos(ph - 0.5) + 0.5
        sy = 9.6 - 0.06 * sx * sx
        fx = 3.8 * math.cos(ph - 0.5) + 1.5
        fy = 9.6 - 0.06 * (fx - 1) ** 2
        up = A.up(torso='lean1', head='fwd', hd=(0, 1 if i % 6 == 1 else 0),
                  near=hand((sx, sy), 'fist'), far=hand((fx, fy), 'fist'))
        out.append(fig(up, walk_lower(i), pocket=True))
    return X.plant(out)


# ------------------------------------------------------------------------------------ toss (6)
# The prize leaves the scoop: he crouches and draws the full scoop back low behind his hip
# (anticipation 2 frames), swings it forward and up underhand (the smear), flicks it over at the
# top (the item leaves the bowl: TOSS_RELEASE), follows through up on his toes, and settles.
TOSS_DUR = [6, 5, 3, 3, 6, 5]        # 28 ticks, the release frame starts at tick 14 (contract)
TOSS_RELEASE = 3


def toss():
    out = []
    # 0: he dips, the weight back, the scoop drawn back past the hip, the far arm forward
    out.append(fig(A.up(torso='back1', head='effort', near=hand((-3, 9), 'scoopback', bend=1),
                        far=hand((8, 3), 'open')),
                   legs((-1, -15.5), (-6, -4), (5, -4), apron={'sway': -0.5})))
    # 1: the deep wind-up: low, the scoop far back, the far hand points at the catcher
    out.append(fig(A.up(torso='back', head='effort', near=hand((-7, 10), 'scoopback', bend=1),
                        far=hand((9, 0), 'open')),
                   legs((-2, -14), (-7, -4), (5, -4), 'flat', 'flat', apron={'sway': -1})))
    # 2: the swing (smear): the body rises and lunges, the scoop sweeps forward under the hip, the
    # arc of its path trails behind it
    f = fig(A.up(torso='lean1', head='effort', near=hand((1, 10), 'scoop'), far=hand((2, 7), 'fist'),
                 fx=[('swoosh', ('armN', 'wrist', 2, 1))]),
            legs((1, -16), (-7, -5), (6, -4), 'toe', 'flat', apron={'sway': 1}))
    f.smear = True
    out.append(f)
    # 3: the flick in front of his chin: the bowl tips over, the prize leaves it (a few fries fly)
    out.append(fig(A.up(torso='lean', head='shout', near=hand((11.5, -3.5), 'scoopflick', bend=-1),
                        far=hand((-1, 8), 'fist'),
                        fx=[('arc', ('armN', 'wrist', 6, -9))],
                        items=[('fry', (24, -42), 12), ('fry3', (27, -45), 12), ('fry2', (22, -46), 12)]),
                   legs((2, -17.5), (-7, -6), (6, -4), 'toe', 'flat', apron={'sway': 1.5}),
                   hand_pt=parts.BOWL['scoopflick'], reach=REACH))
    # 4: follow-through: the arm goes on up, the empty scoop over, up on his toes
    out.append(fig(A.up(torso='lean1', head='happy', near=hand((10.5, -6.5), 'scoopover', bend=-1),
                        far=hand((0, 9), 'open'), items=[('fry3', (28, -47), 12)]),
                   legs((2, -17), (-6, -6), (6, -4), 'back', 'flat', apron={'sway': 0.5}), reach=REACH))
    # 5: settle: the back foot comes down, the scoop lowers to his chest, a pleased grin
    out.append(fig(A.up(torso='up', head='pleased', near=hand((5.5, 7.5), 'scoophalf'),
                        far=hand((1.5, 9.5), 'open')),
                   legs((1, -16.5), (-5, -4), (5, -4), apron={'sway': -0.5})))
    return out


# ------------------------------------------------------------------------------------ wave (6)
# He waves the scoop hello in front of his face: the elbow out at shoulder height, the forearm up
# below the chin and clear of the nose, the scoop sweeps about 5 px around the elbow with eased ends
# (the 4-tick holds at frames 0 and 3), the body leans a little into the far end.
WAVE = [(11, -2.5), (12.5, -3.4), (14, -3.6), (15, -2.8), (14, -3.6), (12.5, -3.4)]
WAVE_SH = [0, 0.5, 1, 1.5, 1, 0.5]   # the shoulder follows the swing forward (the sweep about 5.5 px)
WAVE_KIND = ['scoop', 'scoop', 'scoop', 'scoop', 'scoop', 'scoop']
WAVE_DUR = [4, 3, 3, 4, 3, 3]          # 20 ticks a wave, as before


def wave():
    out = []
    for k, h in enumerate(WAVE):
        up = A.up(torso='back1' if k in (2, 3, 4) else 'up', head='happy' if k in (2, 3, 4) else 'talk',
                  hd=(0, 0), tor=(0, 0),
                  near=hand(h, WAVE_KIND[k], bend=-1, sh=(WAVE_SH[k], 0)), far=hand((1.5, 9.5), 'open'))
        out.append(fig(up, STAND, reach=CHEER_REACH))
    return out


# ------------------------------------------------------------------------------------ clap (6)
# Hands apart -> they meet in front of the chest (the clap: impact lines) -> the rebound. The far
# hand reaches further forward than the near one, so both hands read in profile.
CLAP = [((6, 3), (12, 2)), ((7, 3), (11, 2.5)), ((8.5, 3), (10.5, 3)), ((8, 3.5), (10.5, 3.5)),
        ((7, 3), (11.5, 2.5)), ((6, 3), (12.5, 2))]


def clap():
    out = []
    for k, (n, f) in enumerate(CLAP):
        hd = 'shout' if k in (2, 3) else 'pleased' if k == 5 else 'happy'
        fx = [('clap', ('armN', 'wrist', 2, -2))] if k == 2 else [('clap2', ('armN', 'wrist', 2, -2))] if k == 3 else None
        up = A.up(torso='in' if k in (2, 3) else 'up', head=hd, hd=(0, 1 if k == 2 else 0),
                  near=hand(n, 'up'), far=hand(f, 'up'), fx=fx)
        out.append(fig(up, legs((0, -17 + (0.5 if k == 2 else 0)), (-4, -4), (4, -4)), pocket=True))
    return out


# ------------------------------------------------------------------------------------ cheer (6)
# A hop with both fists up: the squat (anticipation, the fists at the chest), the spring (the arms
# swing up), the top (feet off the floor: the far fist high over the cap behind the head, the near
# fist punched up in front of the face, clear of it), the landing squash (the fists pump down to
# the chest), the fists up again, the settle. No arm crosses the face; each fist has its own
# silhouette.
def cheer():
    S = [
        # far hand, near hand, pelvis, feet y, shoe, head, torso, apron lift, kind
        ((5, 3), (7.5, 3.5), -14.5, -4, 'flat', 'happy', 'lean1', 0, 'fist'),
        ((-3, -9.5), (9, -1), -18, -5, 'toe', 'shout', 'back1', 0, 'fistup'),
        ((-5.5, -13), (11, -6), -20, -7, 'hang', 'shout', 'back1', 1, 'fistup'),
        ((-1, -2), (8.5, 1), -15, -4, 'flat', 'shout', 'lean1', 0, 'fist'),
        ((-5, -13), (11, -5.5), -17, -4, 'flat', 'happy', 'back1', 0, 'fistup'),
        ((-3, -10.5), (10, -2), -16.5, -4, 'flat', 'happy', 'up', 0, 'fistup'),
    ]
    out = []
    for k, (fh, nh, py, fy, shoe, hd, torso, lift, kind) in enumerate(S):
        lo = legs((0, py), (-4, fy), (4, fy), shoe, shoe, apron={'lift': lift})
        up = A.up(torso=torso, head=hd, near=hand(nh, kind, bend=-1), far=hand(fh, kind, bend=-1))
        out.append(fig(up, lo, pocket=True, reach=CHEER_REACH if fh[1] < -3 else None))
    return out


CHEER_DUR = [6, 4, 6, 6, 4, 6]         # 32 ticks, as before (the landing holds, the pump snaps up)


# ------------------------------------------------------------------------------------ turn (2)
def squeeze(f, k):
    """The frame narrowed to k of its width around the anchor column (the turn's two in-betweens:
    narrowing, the flip, widening): the outline is taken off, the columns sampled, outlined again."""
    rows = [r.replace('K', '.') for r in f.rows]
    rx = f.root[0]
    w = len(rows[0])
    out = []
    for r in rows:
        line = []
        for x in range(w):
            sx = rx + (x - rx) / k
            i = int(math.floor(sx + 0.5))
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
    pts = {n: (rx + (p[0] - rx) * k, p[1]) for n, p in f.pts.items()}
    return X.Frame([''.join(r) for r in res], f.root, pts=pts)


def turn():
    # he squares up: the scoop comes in to the chest, the free hand to the side
    up = A.up(torso='up', head='fwd', near=hand((2, 5), 'scoop'), far=hand((1, 9.5), 'open'))
    base = fig(up, legs((0, -17), (-3, -4), (3, -4)))
    return [squeeze(base, 0.66), squeeze(base, 0.36)]


# ------------------------------------------------------------------------------------ in-<mode> (2)
# Two eased in-betweens from the idle frame to the mode's first frame (played back to leave).
def in_frames(mode):
    if mode == 'talk':
        keys = [((6.5, 3.5), 'scoop', (2.5, 9), 'open', 'fwd'), ((7, 2), 'scooppoint', (3, 8.5), 'open', 'talk2')]
    elif mode == 'wave':
        keys = [((7.5, 3), 'scoop', (1.5, 9.5), 'open', 'fwd'), ((9.5, -0.5), 'scoop', (1.5, 9.5), 'open', 'talk')]
    elif mode == 'clap':
        # the scoop goes into the apron pocket, both hands come up
        keys = [((4, 9), 'fist', (5, 7), 'open', 'fwd'), ((6, 5), 'up', (10, 4), 'up', 'happy')]
    else:   # cheer
        keys = [((5, 7), 'fist', (4, 7.5), 'fist', 'happy'), ((6.5, 5), 'fist', (5.5, 5), 'fist', 'happy')]
    out = []
    for k, (nh, nk, fh, fk, hd) in enumerate(keys):
        pocket = mode in ('clap', 'cheer')
        z = 4.5 if nh[1] < -2 else None       # a raised near arm goes behind the head
        up = A.up(torso='up', head=hd, near=hand(nh, nk, z=z), far=hand(fh, fk))
        out.append(fig(up, STAND, pocket=pocket))
    return out


# ------------------------------------------------------------------------------------ build
def build(s):
    s.strip('idle', idle(), [15, 15, 15, 15], cls='idle-breathing')
    s.strip('talk', talk(), [4] * 8, cls='idle-fidget')
    s.strip('walk', walk(), [WALK_TPF] * WALK_N, cls='locomotion')
    s.strip('toss', toss(), TOSS_DUR, loop=False, cls='throw')
    s.event('TOSS_RELEASE', TOSS_RELEASE)
    s.strip('clap', clap(), [2] * 6, cls='victory')
    s.strip('cheer', cheer(), CHEER_DUR, cls='victory')
    s.strip('wave', wave(), WAVE_DUR, cls='victory')
    for m in ('talk', 'clap', 'cheer', 'wave'):
        s.strip(f'in-{m}', in_frames(m), [3, 3], loop=False, cls='turn')
    s.strip('turn', turn(), [2, 2], cls='turn')
