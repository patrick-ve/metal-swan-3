# The tied tourist's strips: poses per frame and the holds in 60 Hz ticks. Every logic time the game
# reads stays (docs/design/ams40/contract.md "tied tourist"); the frame counts follow the plan's
# action classes. Drawn facing right (the game's unflipped sprite faces right).
import math

import art40 as X
import castkit as K
import rig

from . import parts

P = K.P
A = K.A
pose = K.pose

_LOWER = pose.draw_lower


# ------------------------------------------------------------------------------------ helpers
def _draw_lower(cv, Xc, p, pel, R, meta=None):
    """Seated (p['seat']): the near thigh lies over the seat in front of the shirt's hem (z above the
    torso), the far leg behind; standing poses use the kit's legs."""
    if not p.get('seat'):
        return _LOWER(cv, Xc, p, pel, R, meta)
    for key, z, ramp in (('legF', 2, 'legF'), ('legN', 14.5, 'leg')):
        L = p[key]
        hp = L.get('hip', (-2, 0) if key == 'legF' else (2, 0))
        hip = (pel[0] + hp[0], pel[1] + hp[1])
        ank = (R[0] + L['ank'][0], R[1] + L['ank'][1])
        knee, end = pose.leg(cv, Xc, hip, ank, L.get('bend', 1), ramp, z, key, L.get('shoe', 'flat'))
        if meta is not None:
            meta[key] = {'hip': hip, 'knee': knee, 'ankle': end, 'ground': (end[0], R[1] + 1)}


def _post(cv, Xc, p, layer, meta):
    """Props drawn with the figure before the outline pass: the chair behind it."""
    ch = p.get('chair')
    if ch is not None:
        dx, dy = ch
        pose.place(cv, Xc, P.ITEMS['chair'], 'c',
                   (K.RX + parts.CHAIR_AT[0] + dx, K.RY + parts.CHAIR_AT[1] + dy), 1, 'chair')


def hand(h, kind='fist', bend=-1, sh=(0, 0), z=None):
    return A.hand(h, kind, 'hand', bend=bend, sh=sh, z=z)


def legs(pel, far, near, fs='flat', ns='flat', fb=1, nb=1):
    return A.legs(pel, far, near, fs, ns, fb, nb)


STAND = legs((0, -17), (-4, -4), (4, -4))


def game_pts(j):
    """The points the game had on every frame: hand (the near hand), head (the head centre), hip."""
    nk = j.get('head.neck') or j.get('torso.neck') or j['pel']
    return {'hand': j.get('armN.wrist', j['pel']), 'head': (nk[0] + 1, nk[1] - 7), 'hip': j['pel']}


def fig(upper, lower, pts=None, smear=False):
    """One standing frame: the upper pose on the lower pose, the game points and every joint."""
    rows, root, j = X.humanoid(upper, lower)
    g = game_pts(j)
    if pts:
        g.update({k: (v(j) if callable(v) else v) for k, v in pts.items()})
    return X.Frame(rows, root, pts=g, joints=j, smear=smear)


def full(p, pts=None, post=None, lift=0, smear=False):
    """One-piece frame (sitting, hanging): pose.compose 'full'. post(rows, joints) -> rows edits the
    finished pixels (the rope coils). lift: the figure stands lift px above its feet anchor."""
    rows, root, j = X.full(p)
    if post:
        rows = post(rows, j)
    g = game_pts(j)
    if pts:
        g.update({k: (v(j) if callable(v) else v) for k, v in pts.items()})
    return X.Frame(rows, (root[0], root[1] + lift), pts=g, joints=j, smear=smear)


def lerp(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


# ------------------------------------------------------------------------------------ tied (8)
# On the folding chair, the hands tied behind the backrest, two rope coils round the chest and the
# post. The code picks the frame (hostages.ts tiedFrame): REST and BREATH alternate (breathing),
# BLINK now and then, LOOK (he peeks over the shades at the street), the wriggle every 120 ticks
# (STRUGGLE / STRUGGLE_B while the bubble 'MMF!' pops and the sprite shakes), STRAIN (the last pull,
# the hat knocked up), SLUMP (he gives up with a sigh), then the rest again.
TIED_ORDER = ['rest', 'breath', 'blink', 'look', 'struggle', 'struggle_b', 'strain', 'slump']
TIED = {
    # torso, head, head offset, torso offset, near hand, far hand, near ankle, near shoe, far ankle,
    # pelvis, chair offset
    'rest':       ('up', 'fwd', (0, 0), (0, 0), (-6, 6), (-5, 6), (7, -4), 'flat', (5, -4), (-1, -12)),
    'breath':     ('in', 'in', (0, -1), (0, -1), (-6, 5.5), (-5, 5.5), (7, -4), 'flat', (5, -4), (-1, -12)),
    'blink':      ('up', 'blink', (0, 0), (0, 0), (-6, 6), (-5, 6), (7, -4), 'flat', (5, -4), (-1, -12)),
    'look':       ('lean1', 'peek', (1, 0), (0, 0), (-6.5, 6), (-5.5, 6), (7, -4), 'flat', (5, -4), (-1, -12)),
    'struggle':   ('lean1', 'mmf', (1, 1), (1, 0), (-5.5, 5), (-4.5, 5), (9, -6), 'toe', (4, -4), (-1, -12)),
    'struggle_b': ('back1', 'mmf', (-1, 0), (0, -1), (-6.5, 4.5), (-5.5, 4.5), (6, -4), 'heel', (7, -6), (-1, -12.5)),
    'strain':     ('lean', 'strain', (1, 1), (1, 0), (-5, 4.5), (-4, 4.5), (9, -5), 'toe', (6, -5), (-1, -12)),
    'slump':      ('lean1', 'sigh', (1, 2), (0, 1), (-6, 7), (-5, 7), (8, -4), 'flat', (6, -4), (-1, -11.5)),
}


def seated(torso, head, hd, tor, nh, fh, na, ns, fa, pel, chair=(0, 0)):
    return dict(pelvis=pel, torso=torso, head=head, hd=hd, tor=tor, seat=True, chair=chair,
                legF=dict(ank=fa, shoe='flat', bend=1), legN=dict(ank=na, shoe=ns, bend=1),
                armN=dict(hand=nh, end=('fist', 'fist'), bend=1),
                armF=dict(hand=fh, end=('fist', 'fist'), bend=1))


def _coils(rows, j):
    ny = j['torso.neck'][1]
    return parts.rope(rows, [int(round(ny + 5)), int(round(ny + 9.5))])


def tied():
    out = []
    for name in TIED_ORDER:
        torso, head, hd, tor, nh, fh, na, ns, fa, pel = TIED[name]
        out.append(full(seated(torso, head, hd, tor, nh, fh, na, ns, fa, pel), post=_coils))
    return out


TIED_DUR = [12, 11, 11, 12, 11, 11, 11, 11]      # 90 ticks (a loop the code never plays: it picks)


# ------------------------------------------------------------------------------------ standing helpers
NEAR_REST = (2, 9)        # the near hand at the thigh (from the near shoulder)
FAR_REST = (1, 9.5)


def stand(torso='up', head='fwd', hd=(0, 0), tor=(0, 0), near=None, far=None, items=None, fx=None):
    return A.up(torso=torso, head=head, hd=hd, tor=tor, near=near or hand(NEAR_REST, 'fist'),
                far=far or hand(FAR_REST, 'fist'), items=items, fx=fx)


def lower(pel=(0, -17), far=(-4, -4), near=(4, -4), fs='flat', ns='flat', items=None, fb=1, nb=1):
    p = legs(pel, far, near, fs, ns, fb, nb)
    if items:
        p['items'] = items
    return p


# ------------------------------------------------------------------------------------ walk (12)
# Over to the rescuer, pleased: an easy stroll, the arms swinging a frame behind the legs, the head
# bobbing at the contacts. 12 x 3 = 36 ticks at 0.8 px/tick: a 28.8 px stride (the baker's and the
# handhaver's walk on the same 40 px legs; 12 x 4 = 38.4 px read as a lunge).
WALK_N = 12
WALK_TPF = 3
WALK_STEP = 0.8 * WALK_TPF
WALK_HALF = WALK_STEP * 3
SHOE_Y = {'heel': -3, 'toe': -5}


def walk_foot(k):
    k %= WALK_N
    if k <= 6:
        x = WALK_HALF - WALK_STEP * k
        shoe = 'heel' if k == 0 else 'toe' if k == 6 else 'flat'
        return (x, SHOE_Y.get(shoe, -4)), shoe
    t = (k - 6) / 6
    x = -WALK_HALF + 2 * WALK_HALF * (1 - math.cos(math.pi * t)) / 2
    y = -4 - 4.0 * math.sin(math.pi * min(1.0, t * 1.1))
    shoe = 'back' if t < 0.3 else 'hang' if t < 0.75 else 'flat'
    return (x, y), shoe


def walk():
    out = []
    for i in range(WALK_N):
        na, ns = walk_foot(i)
        fa, fs = walk_foot(i + 6)
        pel_y = [-15.5, -16, -16.5, -17, -16.5, -16][i % 6]
        lo = legs((0, pel_y), fa, na, fs, ns)
        lo['legF']['hip'] = (-1 + 0.45 * fa[0], 0)
        lo['legN']['hip'] = (1 + 0.45 * na[0], 0)
        ph = 2 * math.pi * i / WALK_N
        sx = -3.6 * math.cos(ph - 0.5) + 1
        fx_ = 3.6 * math.cos(ph - 0.5) + 1.5
        up = stand('lean1', 'happy', hd=(0, 1 if i % 6 == 1 else 0),
                   near=hand((sx, 9.6 - 0.05 * sx * sx), 'fist'), far=hand((fx_, 9.6 - 0.05 * (fx_ - 1) ** 2), 'fist'))
        out.append(fig(up, lo))
    return X.plant(out)


# ------------------------------------------------------------------------------------ run (12)
# Off the screen, whooping: a real run with a flight phase, the body tipped forward, the near hand
# clamps the sun hat on, the far arm pumps. 12 x 2 = 24 ticks at 2 px/tick: a 48 px stride; the
# planted foot moves back 4 px a frame for 5 frames (frames 5 and 11: both feet in the air).
RUN_N = 12
RUN_TPF = 2
RUN_STEP = 2.0 * RUN_TPF


def run_foot(k):
    k %= RUN_N
    if k <= 4:
        x = 8 - RUN_STEP * k
        shoe = 'heel' if k == 0 else 'toe' if k == 4 else 'flat'
        return (x, SHOE_Y.get(shoe, -4)), shoe
    t = (k - 4) / 8
    x = -8 - 2 * math.sin(math.pi * min(1, t * 2)) * (1 - t) + 16 * (1 - math.cos(math.pi * t)) / 2
    y = -4 - 7 * math.sin(math.pi * min(1.0, t * 1.15)) ** 0.9
    shoe = 'back' if t < 0.3 else 'hang' if t < 0.8 else 'flat'
    return (x, y), shoe


def run():
    out = []
    for i in range(RUN_N):
        na, ns = run_foot(i)
        fa, fs = run_foot(i + 6)
        pel_y = [-16, -15.5, -16, -16.5, -17.5, -18.5][i % 6]
        lo = legs((1, pel_y), fa, na, fs, ns)
        lo['legF']['hip'] = (-1 + 0.3 * fa[0], 0)
        lo['legN']['hip'] = (1 + 0.3 * na[0], 0)
        ph = 2 * math.pi * i / RUN_N
        fx_ = 5.5 * math.cos(ph - 0.4) + 3
        fy = 6.5 - 2.5 * math.sin(ph - 0.4)
        bob = 1 if i % 6 in (1, 2) else 0
        up = stand('lean', 'yay' if i % 6 < 3 else 'puff', hd=(1, bob),
                   near=hand((1.5, -9.5 + bob), 'up', bend=-1, z=5.5), far=hand((fx_, fy), 'fist', bend=-1))
        out.append(fig(up, lo))
    return X.plant(out)


# ------------------------------------------------------------------------------------ freed (7)
# The chair bursts (item/bind/chair-break) or the sack drops (sack-off): he crouches in surprise, the
# rope still round his arms, springs up with both fists flung high, lands, stretches the stiff back,
# lets the arms come down and settles with a grin. 20 ticks (TUNING.hostage.freedTicks).
ROPE_FLOOR = [('rope', (-7, -1), 0.5)]


def freed():
    F = [
        # torso, head, hd, near hand, near kind, far hand, far kind, pelvis, far ankle, near ankle, shoes, rope
        ('lean1', 'oh', (1, 1), (-4, 6), 'fist', (-3, 6), 'fist', (0, -12), (-5, -4), (6, -4), ('flat', 'flat'), False),
        ('lean1', 'oh', (1, 0), (-1, 2), 'open', (0, 2.5), 'open', (0, -15), (-4, -4), (5, -4), ('flat', 'flat'), True),
        ('up', 'yay', (0, -1), (2, -3), 'up', (1, -3.5), 'up', (0, -17.5), (-3, -4), (4, -5), ('flat', 'toe'), True),
        ('up', 'yay', (0, -1), (3, -6), 'up', (0, -6.5), 'up', (0, -19), (-3, -6), (3, -7), ('hang', 'hang'), True),
        ('lean1', 'yay', (1, 0), (4, -5), 'up', (1, -5.5), 'up', (0, -16), (-5, -4), (5, -4), ('flat', 'flat'), True),
        ('back1', 'happy', (-1, -1), (2, -9), 'up', (-1.5, -9), 'up', (0, -17.5), (-4, -4), (4, -4), ('flat', 'flat'), True),
        ('up', 'happy', (0, 0), (5, -3), 'open', (3, -3), 'open', (0, -17), (-4, -4), (4, -4), ('flat', 'flat'), True),
        ('up', 'happy', (0, 0), (5, 2.5), 'fist', (5, 3), 'fist', (0, -17), (-4, -4), (4, -4), ('flat', 'flat'), True),
    ]
    out = []
    for k, (torso, hd_, hdo, nh, nk, fh, fk, pel, fa, na, (fs, ns), rope_down) in enumerate(F):
        items = ROPE_FLOOR if rope_down else None
        up = stand(torso, hd_, hd=hdo, near=hand(nh, nk, bend=1 if k <= 1 else -1),
                   far=hand(fh, fk, bend=1 if k <= 1 else -1))
        lo = lower(pel, fa, na, fs, ns, items=items)
        f = fig(up, lo)
        if k == 0:
            f.rows = parts.rope(f.rows, [int(round(f.joints['torso.neck'][1] + 6))])
        out.append(f)
    return out


FREED_DUR = [3, 3, 2, 2, 3, 3, 3, 1]


# ------------------------------------------------------------------------------------ gag (8)
# SAY CHEESE!: he grabs the camera off his chest, lifts it to the eye, leans in to aim, CLICK (the
# flash fires from the flash cube: GAG_FLASH, tick 24), the camera kicks up, he lowers it with a
# cheesy grin and a thumbs up. 40 ticks (TOURIST.gagTicks); the code picks the frame by tick.
GAG_DUR = [6, 6, 6, 6, 3, 3, 6, 4]
GAG_FLASH = 4
CAM_FLASH = {'cam': (3.5, 0), 'camlow': (3, 0)}        # the flash cube on the camera grid


def _flash_pt(kind):
    """The flash point: the camera's flash cube (the camera in the hand, or on the chest)."""
    g, an = P.HANDS[kind]
    cx, cy = CAM_FLASH[kind]
    return lambda j: (j['armN.wrist'][0] + cx - an['wrist'][0], j['armN.wrist'][1] + cy - an['wrist'][1])


def _chest_cam(j):
    nk = j['torso.neck']
    return (nk[0] + 2.5, nk[1] + 5)


def gag():
    G = [
        # torso, head, hd, near (hand, kind), far (hand, kind), pelvis, legs (far, near), flash
        ('up', 'cheese', (0, 0), ((4, 3), 'fist'), ((7, -2), 'point'), (0, -17), ((-4, -4), (4, -4)), None),
        ('nocam', 'cheese', (0, 0), ((6, 1), 'camlow'), ((6.5, 2), 'fist'), (0, -17), ((-4, -4), (4, -4)), 'camlow'),
        ('nocam_back1', 'aim', (0, 0), ((5, -4.5), 'cam'), ((7, -3), 'fist'), (0, -17.5), ((-4, -4), (5, -4)), 'cam'),
        ('nocam_lean1', 'aim', (1, 1), ((6, -3.5), 'cam'), ((8, -2), 'fist'), (0, -16), ((-6, -4), (5, -4)), 'cam'),
        ('nocam_lean1', 'aim', (1, 1), ((6, -3.5), 'cam'), ((8, -2), 'fist'), (0, -16), ((-6, -4), (5, -4)), 'cam'),
        ('nocam_back1', 'cheese', (-1, 0), ((5, -5.5), 'cam'), ((6.5, -4.5), 'fist'), (0, -17), ((-5, -4), (5, -4)), 'cam'),
        ('nocam', 'cheese', (0, 0), ((5.5, 0.5), 'camlow'), ((7, -6), 'thumb'), (0, -17), ((-4, -4), (4, -4)), 'camlow'),
        ('nocam', 'happy', (0, 0), ((5.5, 3), 'camlow'), ((6, -4), 'thumb'), (0, -17), ((-4, -4), (4, -4)), 'camlow'),
    ]
    out = []
    for k, (torso, hd_, hdo, (nh, nk), (fh, fk), pel, (fa, na), fl) in enumerate(G):
        fx = [('click', ('armN', 'wrist', CAM_FLASH['cam'][0] - P.HANDS['cam'][1]['wrist'][0],
                         CAM_FLASH['cam'][1] - P.HANDS['cam'][1]['wrist'][1]))] if k == GAG_FLASH else None
        up = stand(torso, hd_, hd=hdo, near=hand(nh, nk, z=6.5 if nk == 'cam' else None), far=hand(fh, fk), fx=fx)
        f = fig(up, lower(pel, fa, na), pts={'flash': _flash_pt(fl) if fl else _chest_cam})
        out.append(f)
    return out


# ------------------------------------------------------------------------------------ give (6)
# The thank-you: he reaches behind his back, dips and draws the present out (anticipation), swings it
# round to the front, holds it out on the flat hand (GIVE_HAND_FRAME: at tick 12 the real item pops
# from the 'hand' point), the hand flicks up empty, then both hands open: here you go. 24 ticks.
GIVE_DUR = [3, 3, 3, 4, 5, 6]
GIVE_HAND_FRAME = 3
GIVE_HAND_PT = (12, -23)     # the old give frame's hand at tick 12 (anchor-relative)


def _gift_pt(kind):
    def f(j):
        w = j['armN.wrist']
        return (w[0] + 3, w[1] - (6 if kind == 'giftup' else 4))
    return f


def give():
    G = [
        ('back1', 'happy', (0, 0), ((-5, 7), 'fist', 1), ((-4, 7), 'fist', 1), (0, -17), None),
        ('lean1', 'happy', (1, 1), ((-3, 7), 'gift', 1), ((-2, 8), 'open', 1), (0, -15.5), 'gift'),
        ('lean1', 'cheese', (1, 0), ((4, 5), 'gift', -1), ((3, 7), 'open', -1), (0, -16.5), 'gift'),
        ('lean', 'cheese', (1, 0), ((6, 5.5), 'giftup', -1), ((5, 4), 'open', -1), (0, -17), 'giftup'),
        ('lean1', 'happy', (0, 0), ((8, -3), 'up', -1), ((5, 4), 'open', -1), (0, -17.5), None),
        ('up', 'happy', (0, 0), ((7, 3), 'open', -1), ((6, 3.5), 'open', -1), (0, -17), None),
    ]
    out = []
    for k, (torso, hd_, hdo, (nh, nk, nb), (fh, fk, fb), pel, gift) in enumerate(G):
        up = stand(torso, hd_, hd=hdo, near=hand(nh, nk, bend=nb, z=0.5 if nh[0] < 0 else None),
                   far=hand(fh, fk, bend=fb))
        lo = lower(pel, (-5, -4) if pel[1] > -16.5 else (-4, -4), (5, -4) if pel[1] > -16.5 else (4, -4))
        pts = {'hand': _gift_pt(gift)} if gift else None
        if k == GIVE_HAND_FRAME:
            # the gift pops from here (Hostage.handOver): the old handover point, so the item lands
            # where it always did (D7: the bot's path and the sims stay); the box is drawn round it
            rx, ry = X.feet_root()
            pts = {'hand': (rx + GIVE_HAND_PT[0], ry + GIVE_HAND_PT[1])}
        out.append(fig(up, lo, pts=pts))
    return out


# ------------------------------------------------------------------------------------ bow (6)
# The curtain call (never a salute): he takes the hat off with a flourish (the arm sweeps up and
# out), bows deep with the hat swept low over the floor, holds, comes up and puts it back on.
# 12 ticks (TUNING.hostage.bowTicks).
BOW_DUR = [2, 2, 2, 2, 2, 2]


def bow():
    B = [
        # torso, head, hd, near (hand, kind), far hand, pelvis, lean of the bow (rot)
        ('up', 'happy', (0, 0), ((2, -9), 'up'), (1, 9), (0, -17), 0),
        ('back1', 'bare_happy', (0, 0), ((5, -9), 'hat'), (0, 9), (0, -17.5), 0),
        ('lean1', 'bare_happy', (1, 1), ((7, -6), 'hat'), (-2, 8), (0, -17), 0),
        ('lean2', 'bare_happy', (2, 2), ((7.5, -2.5), 'hatlow'), (-4, 6), (-1, -15.5), 0),
        ('lean1', 'bare_happy', (1, 1), ((7, -5), 'hat'), (-2, 8), (0, -16.5), 0),
        ('up', 'happy', (0, 0), ((4, -8.5), 'up'), (1, 9), (0, -17), 0),
    ]
    out = []
    for k, (torso, hd_, hdo, (nh, nk), fh, pel, _r) in enumerate(B):
        up = stand(torso, hd_, hd=hdo, near=hand(nh, nk, z=5.5 if nh[1] < -5 else None), far=hand(fh, 'open'))
        lo = lower(pel, (-5, -4), (4, -4))
        out.append(fig(up, lo))
    return out


# ------------------------------------------------------------------------------------ turn (2)
def squeeze(f, k):
    """The frame narrowed to k of its width around the anchor column (the turn's in-betweens)."""
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
    base = fig(stand('up', 'happy', near=hand((3, 8), 'fist'), far=hand((1.5, 9), 'fist')), STAND)
    return [squeeze(base, 0.66), squeeze(base, 0.36)]


# ------------------------------------------------------------------------------------ sack (8)
# Blind in the burlap sack, hopping about (binds.ts: 0.3 px/tick inside a 48 px band): he settles,
# crouches (the sack squats), pushes off (it stretches, the shoes show), rises, wobbles at the top
# (the elbow pokes the burlap), drops, lands squashed and recovers. 26 ticks a hop.
SACK = [
    # h, w, tilt, feet (near, far), knee, bulge, lift
    (31, 18, 0.0, (0, 0), 0, 0, 0),
    (28, 20, -1.0, (0, 0), 0, 1, 0),
    (33, 16, 1.0, (2, 1), 1, 0, 1),
    (33, 16, 1.5, (3, 2), 2, 0, 4),
    (32, 17, 0.5, (3, 3), 1, 2, 6),
    (33, 16, -0.5, (2, 3), 0, 1, 4),
    (27, 21, 0.0, (0, 0), 0, 0, 0),
    (31, 18, 0.5, (0, 0), 0, 1, 0),
]
SACK_DUR = [3, 3, 3, 3, 4, 3, 4, 3]


def sack():
    from . import props
    out = []
    for h, w, tilt, feet, knee, bulge, lift in SACK:
        rows, root = props.sack(h, w, tilt, feet, knee, bulge, lift)
        out.append(X.Frame(rows, root))
    return out


# ------------------------------------------------------------------------------------ mast (8)
# Tied standing to the parade float's mast (the pole and the rope bands are the bind's): the hands
# behind the pole, the TIED frame roles of the chair (the code picks them the same way).
MAST = {
    'rest':       ('up', 'fwd', (0, 0), (0, 0), (0, -17)),
    'breath':     ('in', 'in', (0, -1), (0, -1), (0, -17)),
    'blink':      ('up', 'blink', (0, 0), (0, 0), (0, -17)),
    'look':       ('lean1', 'peek', (1, 0), (0, 0), (0, -17)),
    'struggle':   ('lean1', 'mmf', (1, 1), (1, 0), (0, -16.5)),
    'struggle_b': ('back1', 'mmf', (-1, 0), (-1, 0), (0, -17.5)),
    'strain':     ('lean', 'strain', (1, 1), (1, 0), (0, -16)),
    'slump':      ('lean1', 'sigh', (1, 2), (0, 1), (0, -16)),
}


def mast():
    out = []
    for name in TIED_ORDER:
        torso, hd_, hdo, tor, pel = MAST[name]
        up = stand(torso, hd_, hd=hdo, tor=tor, near=hand((-4, 7), 'fist', bend=1, z=0.5),
                   far=hand((-3, 7), 'fist', bend=1))
        kick = name in ('struggle', 'strain')
        out.append(fig(up, lower(pel, (-4, -4), (6, -6) if kick else (4, -4), 'flat', 'toe' if kick else 'flat')))
    return out


# ------------------------------------------------------------------------------------ caged (8)
# Sitting on the floor of the hanging cage (20 x 30: a standing tourist does not fit, plan rule 10),
# the knees up, the hands on the bars; the TIED frame roles: the struggle shakes the bars.
CAGED = {
    'rest':       ('lean1', 'fwd', (0, 1), (6, -3), (7, -1), (0, -6)),
    'breath':     ('in', 'in', (0, 0), (6, -3.5), (7, -1.5), (0, -6)),
    'blink':      ('lean1', 'blink', (0, 1), (6, -3), (7, -1), (0, -6)),
    'look':       ('lean1', 'peek', (1, 0), (6, -4), (7, -2), (0, -6)),
    'struggle':   ('lean', 'mmf', (1, 1), (8, -7), (9, -6), (0, -6)),
    'struggle_b': ('back1', 'mmf', (0, 0), (7, -8), (8, -7), (0, -6.5)),
    'strain':     ('lean', 'strain', (1, 1), (8, -9), (9, -8), (0, -6)),
    'slump':      ('lean1', 'sigh', (1, 2), (5, -1), (6, 0), (0, -5.5)),
}


def caged():
    from . import props
    out = []
    for name in TIED_ORDER:
        torso, hd_, hdo, nh, fh, pel = CAGED[name]
        p = dict(pelvis=pel, torso=torso, head=hd_, hd=hdo, seat=True,
                 legF=dict(ank=(6, -6), shoe='flat', bend=1), legN=dict(ank=(8, -6), shoe='flat', bend=1),
                 armN=dict(hand=nh, end=('hand', 'open'), bend=-1), armF=dict(hand=fh, end=('hand', 'open'), bend=-1))
        rows, root, j = X.full(p)
        # the cage round him on its own canvas: back bars, the figure, front bars, outlined once
        x0 = int(root[0]) - props.CAGE_W // 2 + 1
        y0 = int(root[1]) - props.CAGE_H - 1           # the plate's outline on row -1 (rule 2)
        cv = rig.Canvas(len(rows[0]), len(rows))
        props.cage(cv, x0, y0, 'back')
        for y, r in enumerate(rows):
            for x, ch in enumerate(r):
                if ch != '.':
                    cv.px(x, y, ch, 10, 'fig')
        shake = 1 if name in ('struggle', 'strain') else -1 if name == 'struggle_b' else 0
        props.cage(cv, x0 + (shake if name != 'rest' else 0) * 0, y0, 'front')
        rows = cv.finish()
        out.append(X.Frame(rows, root, pts=game_pts(j), joints=j))
    return out


# ------------------------------------------------------------------------------------ dangle (8)
# Hanging from the weather balloon's rope by both hands (binds.ts: the hands at DANGLE_HANDS = -35
# from the hostage's anchor): the legs pedal the air, the body swings a little under the grip.
DANGLE_HANDS = -35
DANGLE_DUR = [4, 3, 4, 3, 4, 3, 4, 3]


def dangle():
    out = []
    for k in range(8):
        ph = 2 * math.pi * k / 8
        sw = 1.2 * math.sin(ph)
        na = (2 + 3 * math.cos(ph), -2 - 2.5 * max(0, math.sin(ph)))
        fa = (-1 - 3 * math.cos(ph), -2 - 2.5 * max(0, -math.sin(ph)))
        up = A.up(torso='back1' if sw < -0.5 else 'lean1' if sw > 0.5 else 'up', head='mmf' if k in (2, 3) else 'oh',
                  hd=(1, 2), near=hand((3 + sw * 0.3, -17.5), 'up', bend=-1, z=5.5),
                  far=hand((4 + sw * 0.3, -17), 'up', bend=-1, z=5.4))
        lo = legs((sw * 0.5, -17), fa, na, 'hang', 'hang')
        # a cartoon stretch of the arms (the rig's 5.5 + 5.0 cannot reach over the sun hat)
        old = (pose.UPPER, pose.FORE)
        pose.UPPER, pose.FORE = 9.5, 9.0
        try:
            rows, root, j = X.humanoid(up, lo)
        finally:
            pose.UPPER, pose.FORE = old
        w = j['armN.wrist']
        top = round(min(j['armN.wrist'][1], j['armF.wrist'][1]) - 3.5)   # the top of the gripping fists
        anchor = (round(w[0]), top - DANGLE_HANDS)
        g = game_pts(j)
        g['hand'] = (anchor[0], top)
        out.append(X.Frame(rows, anchor, pts=g, joints=j))
    return out


# ------------------------------------------------------------------------------------ chute (8)
# Floating down under the red and white canopy (the balloon's rope was shot): he holds the risers,
# the legs swing slowly, the canopy breathes. The feet anchor under the shoes.
def chute():
    from . import props
    out = []
    for k in range(8):
        ph = k / 8
        sw = math.sin(2 * math.pi * ph)
        up = A.up(torso='up', head='happy' if k < 4 else 'oh', hd=(0, 0),
                  near=hand((2 + sw * 0.5, -6), 'fist', bend=-1, z=5.5), far=hand((3 + sw * 0.5, -6.5), 'fist', bend=-1))
        lo = legs((0, -18), (-2 - sw, -3), (2 + sw, -2.5), 'hang', 'hang')
        rows, root, j = X.humanoid(up, lo)
        H = len(rows)
        W = len(rows[0])
        top_pad = 22
        cv = rig.Canvas(W, H + top_pad)
        nk = j['torso.neck']
        cx = nk[0] + sw * 0.6
        hem, hw = props.canopy(cv, cx, int(nk[1] + top_pad - 30), ph)
        for y, r in enumerate(rows):
            for x, ch in enumerate(r):
                if ch != '.':
                    cv.px(x, y + top_pad, ch, 10, 'fig')
        rows2 = cv.finish()
        rows2 = [list(r) for r in rows2]
        wn, wf = j['armN.wrist'], j['armF.wrist']
        for (hx, hy) in ((cx - hw + 1, hem), (cx - hw * 0.35, hem), (cx + hw * 0.35, hem), (cx + hw - 1, hem)):
            tx, ty = (wf if hx < cx else wn)
            ty += top_pad - 3
            n = int(max(abs(tx - hx), abs(ty - hy))) + 1
            for i in range(1, n):
                t = i / n
                x = int(round(hx + (tx - hx) * t))
                y = int(round(hy + 1 + (ty - hy - 1) * t))
                if 0 <= y < len(rows2) and 0 <= x < W and rows2[y][x] == '.':
                    rows2[y][x] = 'K'
        rows2 = [''.join(r) for r in rows2]
        jj = {kk: (v[0], v[1] + top_pad) for kk, v in j.items()}
        # the feet anchor under the dangling shoes (he lands on them)
        low = max(y for y, r in enumerate(rows2) if r.strip('.')) + 1
        out.append(X.Frame(rows2, (root[0], max(root[1] + top_pad, low)), pts=game_pts(jj), joints=jj))
    return out


# ------------------------------------------------------------------------------------ build
def build(s):
    pose.draw_lower = _draw_lower
    pose.HOOKS['post'] = _post
    P.FX['click'] = (['....W....', '.W..F..W.', '..FyFyF..', '.WyFWFyW.', 'WFWWWWWFW', '.WyFWFyW.',
                      '..FyFyF..', '.W..F..W.', '....W....'], (4, 4))
    s.strip('tourist/tied', tied(), TIED_DUR, cls='idle-fidget')
    for i, name in enumerate(TIED_ORDER):
        s.event('TIED_' + name.upper(), i)
    s.strip('tourist/caged', caged(), TIED_DUR, cls='idle-fidget')
    s.strip('tourist/mast', mast(), TIED_DUR, cls='idle-fidget')
    s.strip('tourist/sack', sack(), SACK_DUR, cls='idle-fidget')
    s.strip('tourist/sack-turn', [squeeze(f, k) for f, k in ((sack()[0], 0.66), (sack()[0], 0.36))], [2, 2], cls='turn')
    s.strip('tourist/dangle', dangle(), DANGLE_DUR, cls='idle-fidget')
    s.strip('tourist/chute', chute(), [5] * 8, cls='idle-fidget')
    s.strip('tourist/freed', freed(), FREED_DUR, loop=False, cls='victory')
    s.strip('tourist/walk', walk(), [WALK_TPF] * WALK_N, cls='locomotion')
    s.strip('tourist/run', run(), [RUN_TPF] * RUN_N, cls='locomotion')
    s.strip('tourist/gag', gag(), GAG_DUR, cls='idle-fidget')
    s.event('GAG_CARD', 0)
    s.event('GAG_RAISE', 1)
    s.event('GAG_FLASH', GAG_FLASH)
    s.event('GAG_FLASH_TICK', sum(GAG_DUR[:GAG_FLASH]))
    s.event('GAG_AFTER', 6)
    s.strip('tourist/give', give(), GIVE_DUR, loop=False, cls='victory')
    s.event('GIVE_HAND_FRAME', GIVE_HAND_FRAME)
    s.event('GIVE_HANDOVER', sum(GIVE_DUR[:GIVE_HAND_FRAME + 1]) - 1)
    s.strip('tourist/bow', bow(), BOW_DUR, loop=False, cls='victory')
    s.strip('tourist/turn', turn(), [2, 2], cls='turn')
    from . import flash
    s.strip('flash', flash.frames(), [2, 3, 3], loop=False, cls='prop')
