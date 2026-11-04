# The FABEL FRIET crew's strips (one animation for the three looks, plan rule 6): poses per frame
# and the holds in 60 Hz ticks. Drawn facing right (the game's unflipped person faces right).
# Contract: docs/design/ams40/contract.md "Fabel Friet crew 0-2": idle, walk, clap, cheer, wave, the
# transitions in-clap / in-cheer / in-wave (2 frames x PERSON_TR_TICKS) and the turn (2 frames x
# PERSON_TURN_TICKS); walk drawn for 0.8 px/tick. Frame counts follow the plan's action classes.
#
# A pose is a small spec (dict): pel (pelvis), lf / ln (far / near ankle and shoe), fh / nh (far /
# near hand: target from the shoulder, hand part, bend, z), torso, head, tor, hd, hair (the hair
# state: rest / lag / up / down), apron (hem sway px), lift (apron hem lift 0..1), fx. Specs can be
# eased into each other (tween), which makes the transitions and the in-betweens.
import math

import art40 as X
import castkit as K

from . import parts

A = K.A

# the hair variant per look for each hair state (parts.TAIL0 / CURL1 / BOB2)
HAIR = [
    {'rest': 0, 'lag': 1, 'up': 2, 'down': -1},
    {'rest': 0, 'lag': 0, 'up': -1, 'down': 1},
    {'rest': 0, 'lag': 1, 'up': 1, 'down': -1},
]
LOOK = [0]                 # the look being drawn (set by build)

FX_LETTERS = 'WF'          # the clap's spark: colours of the shared FX ramp (outside the budget)
FX_PAL = {'W': '#ffffff', 'F': '#fffbd8'}
SPARK = {
    'spark0': (K.grid("""
        W...W
        .F.F.
        ..W..
    """), (2, 2)),
    'spark1': (K.grid("""
        W.....W
        .......
        ...F...
    """), (3, 2)),
}

STAND = dict(pel=(0, -17), lf=(-4, -4, 'flat'), ln=(4, -4, 'flat'))
REST = dict(STAND, nh=(1.5, 11.5, 'open', -1, None), fh=(2.5, 11, 'open', -1, None),
            torso='up', head='fwd', tor=(0, 0), hd=(0, 0), hair='rest', apron=0.0, lift=0.0)


def spec(base=REST, **kw):
    s = dict(base)
    s.update(kw)
    return s


def _hand(h):
    """(x, y, part, bend, z[, sh]): the hand target from the shoulder, its part, the elbow side, the
    layer (None: the arm's own), and the shoulder's own shift (it lifts and comes forward to wave)."""
    x, y, kind, bend, z = h[:5]
    return A.hand((x, y), kind, 'hand', bend=bend, z=z, sh=h[5] if len(h) > 5 else (0, 0))


def game_pts(j):
    """The points the old frames had: hand (the near hand), head (the head centre), hip."""
    nk = j.get('head.neck') or j.get('torso.neck') or j['pel']
    return {'hand': j.get('armN.wrist', j['pel']), 'head': (nk[0] + 1, nk[1] - 7), 'hip': j['pel']}


def frame(s, smear=False):
    look = LOOK[0]
    head = f"{s['head']}:{HAIR[look][s['hair']]}"
    up = A.up(torso=s['torso'], head=head, tor=s['tor'], hd=s['hd'], near=_hand(s['nh']), far=_hand(s['fh']))
    lo = A.legs(s['pel'], s['lf'][:2], s['ln'][:2], s['lf'][2], s['ln'][2])
    if 'fhip' in s:
        lo['legF']['hip'] = s['fhip']
    if 'nhip' in s:
        lo['legN']['hip'] = s['nhip']
    lo['apron'] = s['apron']
    lo['apronlift'] = s['lift']
    rows, root, j = X.humanoid(up, lo)
    if s.get('fx'):
        rows = put_fx(rows, j, s['fx'])
    return X.Frame(rows, root, pts=game_pts(j), joints=j, smear=smear)


def put_fx(rows, j, fx):
    """FX on top (no outline): (name, joint, dx, dy) placed at a joint of the frame."""
    g = [list(r) for r in rows]
    for name, at, dx, dy in fx:
        fr, an = SPARK[name]
        bx, by = j[at]
        x0, y0 = int(round(bx + dx - an[0])), int(round(by + dy - an[1]))
        for jj, r in enumerate(fr):
            for i, ch in enumerate(r):
                if ch != '.' and 0 <= y0 + jj < len(g) and 0 <= x0 + i < len(g[0]) and g[y0 + jj][x0 + i] == '.':
                    g[y0 + jj][x0 + i] = ch
    return [''.join(r) for r in g]


def _mix(a, b, t):
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return a + (b - a) * t
    if isinstance(a, tuple) and isinstance(b, tuple) and len(a) == len(b):
        return tuple(_mix(x, y, t) for x, y in zip(a, b))
    return b if t >= 0.5 else a


def tween(a, b, t, **kw):
    """The pose t of the way from a to b (numbers eased linearly, parts switch at the middle)."""
    s = {k: _mix(a[k], b.get(k, a[k]), t) for k in a}
    for k in b:
        if k not in s:
            s[k] = b[k]
    s.update(kw)
    return s


def ease(t):
    return 0.5 - 0.5 * math.cos(math.pi * t)


# ------------------------------------------------------------------------------------ idle (4)
def idle_specs():
    """Breathing: the chest lifts (frames 1-2), the head follows a frame late, the hands ride along,
    the hair settles a frame after the head."""
    out = []
    by = [0, 0, 1, 1]
    hy = [0, 1, 1, 0]
    for k in range(4):
        out.append(spec(torso='in' if k in (1, 2) else 'up', tor=(0, by[k]), hd=(0, hy[k] - by[k]),
                        nh=(1.5, 11.5 - by[k] * 0.5 + (0.5 if k == 2 else 0), 'open', -1, None),
                        fh=(2.5, 11 - by[k] * 0.5, 'open', -1, None),
                        hair='down' if k == 2 else 'rest', apron=-0.6 if k == 2 else 0.0))
    return out


# ------------------------------------------------------------------------------------ walk (12)
WALK_N = 12
WALK_TPF = 3
WALK_SPEED = 0.8
STEP = WALK_SPEED * WALK_TPF      # 2.4 px a frame: the planted foot moves back with the floor
SHOE_Y = {'heel': -3, 'toe': -5}


def walk_foot(k):
    """One foot over the cycle: planted for frames 0-6 (heel strike to toe-off, back STEP a frame),
    swinging for 7-11 (lift behind, the knee drives forward, reach)."""
    k %= WALK_N
    half = STEP * 3
    if k <= 6:
        x = half - STEP * k
        shoe = 'heel' if k == 0 else 'toe' if k == 6 else 'flat'
        return (x, SHOE_Y.get(shoe, -4), shoe)
    t = (k - 6) / 6
    x = -half + 2 * half * (1 - math.cos(math.pi * t)) / 2
    y = -4 - 4.0 * math.sin(math.pi * min(1.0, t * 1.1))
    shoe = 'back' if t < 0.3 else 'hang' if t < 0.75 else 'flat'
    return (x, y, shoe)


def walk_specs():
    out = []
    pel_y = [-16, -16.5, -17, -17.5, -17, -16.5]
    for i in range(WALK_N):
        ph = 2 * math.pi * i / WALK_N
        na = walk_foot(i)
        fa = walk_foot(i + 6)
        # the arms swing against the legs and trail them by half a frame (follow-through); the far
        # arm swings opposite; the apron hem trails the near knee; the hair bounces a frame after
        # the body drops at each contact and trails behind in between
        sw = -3.8 * math.cos(ph - 0.5)
        k = i % 6
        out.append(spec(pel=(0, pel_y[k]), lf=fa, ln=na, fhip=(-1 + 0.45 * fa[0], 0), nhip=(1 + 0.45 * na[0], 0),
                        torso='lean1', hd=(0, 1 if k == 1 else 0),
                        nh=(sw + 1, 11.2 - 0.08 * sw * sw, 'open', -1, None),
                        fh=(2 - 0.5 * sw, 10.8 - 0.04 * sw * sw, 'open', -1, None),
                        hair='up' if k in (1, 2) else 'lag', apron=-1.2 * math.sin(ph - 0.9)))
    return out


# ------------------------------------------------------------------------------------ clap (6)
# apart (a wide V in front of the chest), closing (fast), the IMPACT (palms together, the shoulders
# hunch, a spark), the rebound, opening, apart (eased)
CLAP_APART = dict(nh=(4.5, 7, 'clapN', -1, None), fh=(10.5, 1, 'clapF', -1, 5.5))
CLAP_MEET = dict(nh=(7, 4, 'clapM', -1, None), fh=(9, 3, 'clapF', -1, 5.5))


def clap_specs():
    a = spec(head='smile', **CLAP_APART)
    m = spec(head='joy', tor=(0, 1), hd=(1, 0), hair='down', apron=0.5,
             fx=[('spark0', 'armN.wrist', 3, -5)], **CLAP_MEET)
    return [
        a,
        tween(a, m, 0.6, head='smile', fx=None),
        m,
        tween(m, a, 0.3, head='joy', tor=(0, 0), hd=(0, 0), hair='up', fx=[('spark1', 'armN.wrist', 3, -6)]),
        tween(m, a, 0.7, head='smile', hair='rest', fx=None),
        spec(a, nh=(4, 7.5, 'clapN', -1, None), fh=(10, 1.5, 'clapF', -1, 5.5)),
    ]


def clap_durations(total):
    # the hands snap together (1 tick), the impact holds; 12 ticks (looks 0, 2) or 16 (look 1)
    return {12: [2, 1, 3, 2, 2, 2], 16: [3, 1, 4, 3, 3, 2]}[total]


# ------------------------------------------------------------------------------------ cheer (8)
ARMS_UP = dict(nh=(5.5, -13.2, 'spread', 1, 4), fh=(-6, -12.6, 'spread', -1, None))


def cheer_specs():
    """A hop for joy with both arms thrown up (the approved sample's pose at the top): the crouch
    (anticipation, the fists cocked in front of the chest), the push, up, the apex (knees tucked), the
    fall (the legs reach), the landing squash (the fists come down to the chest), the rebound, settle.
    The fists are over the head only from the push to the fall; never beside the head (ears)."""
    # the fists cocked in front of the chest (never beside the head: there they read as ears)
    cock = dict(nh=(7, -1, 'fist', -1, None), fh=(5.5, 0, 'fist', -1, None))
    S = []
    S.append(spec(pel=(0, -14), lf=(-5, -4, 'flat'), ln=(5, -4, 'flat'), torso='lean1', head='smile',
                  hd=(0, 1), apron=0.5, **cock))
    S.append(spec(pel=(0, -19), lf=(-3, -2, 'toe'), ln=(3, -2, 'toe'), torso='back1', head='cheer', hair='down',
                  nh=(6, -10, 'spread', 1, 4), fh=(-5, -10, 'spread', -1, None), apron=-0.5, lift=0.5))
    S.append(spec(pel=(0, -22), lf=(-4, -6, 'hang'), ln=(4, -5, 'hang'), torso='back1', head='cheer', hair='down',
                  lift=0.5, **ARMS_UP))
    S.append(spec(pel=(0, -23), lf=(-2, -9, 'hang'), ln=(5, -9, 'hang'), torso='up', head='cheer', hair='rest',
                  lift=1.0, nh=(6, -13.5, 'spread', 1, 4), fh=(-6.5, -13, 'spread', -1, None)))
    S.append(spec(pel=(0, -20), lf=(-4, -4, 'hang'), ln=(4, -3, 'hang'), torso='up', head='cheer', hair='up',
                  lift=1.0, **ARMS_UP))
    # the landing squash: the fists come down in front of the chest (the far one tucked behind)
    S.append(spec(pel=(0, -14), lf=(-5, -4, 'flat'), ln=(5, -4, 'flat'), torso='lean1', head='joy', hair='up',
                  hd=(0, 1), apron=0.8, lift=0.5, nh=(7, -3, 'fist', -1, None), fh=(-1, -4, 'fist', -1, None)))
    # the rebound: up out of the squash, the fists shake in front of the chest
    S.append(spec(pel=(0, -16), lf=(-5, -4, 'flat'), ln=(5, -4, 'flat'), torso='up', head='cheer', hair='rest',
                  nh=(7.5, -1, 'fist', -1, None), fh=(3, -1.5, 'fist', -1, None)))
    # the settle: the fists draw back to the chest (the loop goes on into the crouch of the next hop)
    S.append(spec(pel=(0, -17), lf=(-5, -4, 'flat'), ln=(5, -4, 'flat'), torso='up', head='smile', hair='rest',
                  nh=(6.5, -2.5, 'fist', -1, None), fh=(5, -1, 'fist', -1, None)))
    return S


CHEER_DURATIONS = [7, 3, 4, 4, 6, 3, 3, 2]     # 32 ticks (the old 4 x 8): a long crouch, a fast hop


# ------------------------------------------------------------------------------------ wave (6)
def wave_specs():
    """The near hand up beside the head, the forearm swinging out and in around the elbow; the palm
    trails the swing and flips at each end (follow-through); the body sways with it, the far arm
    hangs loose."""
    far = (2.5, 9.5, 'open', -1, None)
    W = [((9.5, -6.5), 'waveback', 0), ((10.5, -7.5), 'waveback', 0), ((11.5, -5.5), 'spread', 1),
         ((12, -4.5), 'wavefwd', 1), ((10.5, -7.5), 'wavefwd', 0), ((10, -7), 'spread', 0)]
    out = []
    for k, (h, kind, tx) in enumerate(W):
        out.append(spec(nh=(h[0], h[1], kind, WAVE_BEND[0], 4, (2, -1)), fh=far, head='smile' if k not in (2, 3) else 'joy',
                        tor=(tx, 0), hd=(tx, 0), hair='lag' if k in (3, 4) else 'rest', apron=0.4 * tx))
    return out


WAVE_BEND = [-1]
WAVE_DURATIONS = [4, 3, 3, 4, 3, 3]            # 20 ticks (the old 4 x 5)


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


def turn_frames():
    # the arms come in to the body, the head turns with the body (the hair swings out)
    base = frame(spec(nh=(1, 11.5, 'open', -1, None), fh=(1.5, 11, 'open', -1, None), lf=(-3, -4, 'flat'),
                      ln=(3, -4, 'flat'), hair='lag'))
    return [squeeze(base, 0.66), squeeze(base, 0.36)]


# ------------------------------------------------------------------------------------ transitions
def into(target):
    """in-<mode>: two in-betweens from idle frame 0 to the mode's first frame (played forward into
    the mode, backward out of it): the first eases out of the rest pose (a small dip of the body:
    anticipation), the second is nearly there."""
    a = idle_specs()[0]
    one = tween(a, target, 0.4)
    one['hd'] = (one['hd'][0], one['hd'][1] + 1)
    one['hair'] = 'down'
    two = tween(a, target, 0.72)
    two['hair'] = 'up'
    return [one, two]


def cheer_in():
    """in-cheer: the knees give (the dip into the crouch), the fists come up the chest to the
    shoulders, the near elbow swinging forward."""
    a = idle_specs()[0]
    t = cheer_specs()[0]
    one = tween(a, t, 0.4, nh=(3, 8, 'fist', 1, 4), fh=(1, 7.5, 'fist', -1, None), hair='down', head='smile')
    one['hd'] = (0, 1)
    two = tween(a, t, 0.75, nh=(5, 1.5, 'fistup', 1, 4), fh=(-1.5, 2.5, 'fistup', -1, None), hair='up')
    return [one, two]


def wave_in():
    a = idle_specs()[0]
    t = wave_specs()[0]
    # the hand rises with the elbow leading (the forearm hangs, then swings up beside the head)
    one = tween(a, t, 0.35, nh=(5.5, 2.5, 'open', -1, 4.5), head='smile')
    two = tween(a, t, 0.7, nh=(8.5, -4.5, 'palm', -1, 4.5), head='smile', hair='up')
    return [one, two]


# ------------------------------------------------------------------------------------ build
def install(look):
    LOOK[0] = look
    parts.install(look)
    K.palette(FX_PAL, letters='')
    for k, v in SPARK.items():
        K.P.FX[k] = v


def build(s, look):
    install(look)
    idle_ticks = 15 + 2 * look                 # 15 / 17 / 19 a frame (contract: the looks' tempo)
    clap_total = 12 if look % 2 == 0 else 16  # 3 / 4 a frame (contract)
    s.strip('idle', [frame(x) for x in idle_specs()], idle_ticks, cls='idle')
    s.strip('walk', X.plant([frame(x) for x in walk_specs()]), WALK_TPF, cls='locomotion')
    clap = [frame(x) for x in clap_specs()]
    s.strip('clap', clap, clap_durations(clap_total), cls='victory')
    s.strip('cheer', [frame(x) for x in cheer_specs()], CHEER_DURATIONS, cls='victory')
    s.strip('wave', [frame(x) for x in wave_specs()], WAVE_DURATIONS, cls='victory')
    s.strip('in-clap', [frame(x) for x in into(clap_specs()[0])], 3, loop=False, cls='turn')
    s.strip('in-cheer', [frame(x) for x in cheer_in()], 3, loop=False, cls='turn')
    s.strip('in-wave', [frame(x) for x in wave_in()], 3, loop=False, cls='turn')
    s.strip('turn', turn_frames(), 2, cls='turn')
