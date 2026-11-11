# The stag partier's strips (every look): poses per frame and the holds in 60 Hz ticks. Every logic
# time the game reads stays (docs/design/ams40/contract.md "stag partier"); the frame counts follow
# the plan's action classes. Drawn facing right (the game's unflipped sprite faces right).
#
# Events the game reads (exported by the bake): FIRE_POP (the frame the cork leaves) and
# FIRE_POP_TICK (its first tick = STAG.popAt), TOAST_CLINK (the frame the bottles meet), and the
# seated pedal cycle SIT_CRANK_FRAMES.
import math

import art40 as X
import castkit as K
import ext_moves as M
import pose
import rig

from . import kit

P = K.P
A = K.A
LOOK = [None]


# ------------------------------------------------------------------------------------ helpers
def hand(h, kind='fist', bend=-1, sh=(0, 0), z=None):
    return A.hand(h, kind, 'hand', bend=bend, sh=sh, z=z)


def bot(h, deg, state='corked', grip='body', bend=-1, sh=(0, 0), z=None):
    """The near hand with the bottle at deg (see kit.bhand)."""
    return hand(h, kit.bhand(deg, state, grip), bend, sh, z)


def legs(pel, far, near, fs='flat', ns='flat', fb=1, nb=1, fhip=None, nhip=None):
    p = A.legs(pel, far, near, fs, ns, fb, nb)
    if fhip is not None:
        p['legF']['hip'] = fhip
    if nhip is not None:
        p['legN']['hip'] = nhip
    return p


STAND = legs((0, -17), (-5, -4), (5, -4))
WIDE = legs((0, -16), (-7, -4), (6, -4))


def _pdy(p):
    """The look's pelvis drop (shorter legs) on any pose dict with a pelvis; a seated pose keeps its
    hip on the stool (SEAT_HIP) whatever the legs."""
    if p.get('seated'):
        p = dict(p)
        del p['seated']
        return p
    dy = LOOK[0].pdy
    if dy:
        px, py = p.get('pelvis', (0, -17))
        p = dict(p, pelvis=(px, py + dy))
    return p


def _dress(p, role):
    d = LOOK[0].dress
    return d(dict(p), role) if d else p


def game_pts(j):
    """The points the game had on every frame: hand (the near hand), head (the head centre), hip."""
    nk = j.get('head.neck') or j.get('torso.neck') or j['pel']
    return {'hand': j.get('armN.wrist', j['pel']), 'head': (nk[0] + 1, nk[1] - 7), 'hip': j['pel']}


# The anchors of a held rigid item (the bottle, the phone) that only restate the hand: the joint
# track keeps the wrist, the elbow and the item's working end ('mouth', 'cam'); the rest would make
# the smoothness gate measure the cork vanishing at the pop as motion.
ITEM_ANCHORS = ('tip', 'base', 'c', 'mid', 'neck', 'grip')


def joints_of(j):
    return {k: v for k, v in j.items() if k.split('.')[-1] not in ITEM_ANCHORS}


def tidy(rows, keep):
    """No orphan pixels (the gate's rule): an edge pixel with no 8-neighbour of its own colour is
    an outline speck (removed) or a lone colour pixel (it takes the colour of its most common opaque
    neighbour). keep: letters allowed alone (eye whites, FX)."""
    g = [list(r) for r in rows]
    h, w = len(g), len(g[0])
    at = lambda x, y: g[y][x] if 0 <= x < w and 0 <= y < h else '.'
    for _ in range(4):
        changed = False
        for y in range(h):
            for x in range(w):
                ch = g[y][x]
                if ch == '.' or ch in keep:
                    continue
                if all(at(x + dx, y + dy) != '.' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    continue
                nb = [at(x + dx, y + dy) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dx or dy]
                if ch in nb:
                    continue
                if ch == 'K':
                    g[y][x] = '.'
                else:
                    opq = [c for c in nb if c not in '.K' and c not in keep]
                    g[y][x] = max(sorted(set(opq)), key=opq.count) if opq else 'K'
                changed = True
        if not changed:
            break
    return [''.join(r) for r in g]


KEEP = 'w' + kit.FX_LETTERS


def fig(upper, lower, role=('', 0, 'stand')):
    """One standing (or seated) frame: the upper pose on the lower pose."""
    upper = _dress(upper, role)
    rows, root, j = X.humanoid(upper, _pdy(lower))
    return X.Frame(tidy(rows, KEEP), root, pts=game_pts(j), joints=joints_of(j))


def _turn(pt, piv, deg):
    a = math.radians(deg)
    dx, dy = pt[0] - piv[0], pt[1] - piv[1]
    return (piv[0] + dx * math.cos(a) + dy * math.sin(a), piv[1] - dx * math.sin(a) + dy * math.cos(a))


def seen_joints(p, j):
    """The joints where the player sees them (the 'rot' turn of the upper body, the whole-body
    'spin' and the 'squash' of the post hook), so the smoothness gate measures the drawn figure."""
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
        rx, bot_ = pose.RX, pose.RY
        j = {k: (rx + (v[0] - rx) * sx, bot_ - (bot_ - v[1]) * sy) for k, v in j.items()}
    return j


def full(p, role=('', 0, 'dead'), ground=True, lift=0):
    """One-piece frame (deaths, cower, the stool fall). ground: a figure that would sink under the
    feet anchor has its pelvis raised until its lowest row stands on the floor line. lift: the frame
    is drawn this many px above its anchor (airborne)."""
    def sink(rows, root):
        ys = [y for y, r in enumerate(rows) if r.strip('.')]
        return (max(ys) + 1 - root[1]) if ys else 0
    p = _dress(_pdy(p), role)
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
    if lift:
        root = (root[0], root[1] + lift)
    j = seen_joints(p, joints_of(j))
    return X.Frame(tidy(rows, KEEP), root, pts=game_pts(j), joints=j)


def fp(pel, far, near, fs='flat', ns='flat', **kw):
    return M.fp(pel, far, near, fs, ns, **kw)


def op(h, b=1):
    return dict(hand=h, end=('hand', 'open'), bend=b)


def squeeze(f, k):
    """The frame narrowed to k of its width around the anchor column (the Turner's in-betweens): the
    outline taken off, the columns sampled, outlined again."""
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


# ------------------------------------------------------------------------------------ idle (4)
def idle():
    """Breathing with a tipsy sway: the chest lifts (frames 1-2), the head follows a frame late, the
    bottle at his belly tips with the breath; a slow blink on the last frame."""
    by = [0, 0, 1, 1]
    hy = [0, 1, 1, 0]
    deg = [72, 70, 66, 70]
    heads = ['fwd', 'fwd', 'tipsy', 'tipsy']
    out = []
    for k in range(4):
        up = A.up(torso='in' if k in (1, 2) else 'up', head=heads[k], tor=(0, by[k]), hd=(0, hy[k] - by[k]),
                  near=bot((4, 6 - by[k] * 0.5), deg[k]), far=hand((-0.5, 9.5 - by[k] * 0.5), 'open', bend=1))
        out.append(fig(up, legs((0, -17), (-5, -4), (5, -4)), ('idle', k, 'stand')))
    return out


# ------------------------------------------------------------------------------------ walk (12)
WALK_N = 12
WALK_TPF = 4
WALK_SPEED = 0.7
STEP = WALK_SPEED * WALK_TPF          # 2.8 px a frame: the planted foot moves back this much
SHOE_Y = {'heel': -3, 'toe': -5}


def walk_foot(k):
    """One foot over the 12-frame cycle: planted for frames 0-6 (back STEP a frame, heel strike to
    toe-off), swinging for 7-11 (lift behind, the knee drives forward, reach)."""
    k %= WALK_N
    half = STEP * 3
    if k <= 6:
        x = half - STEP * k
        shoe = 'heel' if k == 0 else 'toe' if k == 6 else 'flat'
        return (x, SHOE_Y.get(shoe, -4)), shoe
    t = (k - 6) / 6
    x = -half + 2 * half * (1 - math.cos(math.pi * t)) / 2
    y = -4 - 4.0 * math.sin(math.pi * min(1.0, t * 1.1))
    shoe = 'back' if t < 0.3 else 'hang' if t < 0.75 else 'flat'
    return (x, y), shoe


def walk_lower(i):
    na, ns = walk_foot(i)
    fa, fs = walk_foot(i + 6)
    pel_y = [-16, -16.5, -17, -17, -17, -16.5][i % 6]
    return legs((0, pel_y), fa, na, fs, ns, fhip=(-1.5 + 0.5 * fa[0], 0), nhip=(1.5 + 0.5 * na[0], 0))


def walk():
    """The swagger of a man four beers in: a heavy bob, the chest rolling forward on each stride
    (the torso leans in on the push-off and rocks back on the heel strike), the bottle swinging by its
    neck like a pendulum a frame behind the near leg, the free arm swinging the other way."""
    out = []
    for i in range(WALK_N):
        ph = 2 * math.pi * i / WALK_N
        # the near arm swings against the near leg; the bottle trails the swing (follow-through)
        sx = -3.5 * math.cos(ph - 0.5) + 1.0
        sy = 9.0 - 0.05 * sx * sx
        sw = 92 + 14 * math.sin(ph - 1.4)
        fx_ = 3.0 * math.cos(ph - 0.5) - 1.0
        torso = ['lean1', 'lean1', 'up', 'up', 'lean1', 'lean'][i % 6]
        hd = (0, 1 if i % 6 == 1 else 0)
        up = A.up(torso=torso, head='tipsy' if i in (4, 5) else 'fwd', hd=hd,
                  near=bot((sx, sy), sw, 'corked', 'neck', bend=-1),
                  far=hand((fx_, 9.0), 'fist', bend=1))
        out.append(fig(up, walk_lower(i), ('walk', i, 'stand')))
    return X.plant(out)


# ------------------------------------------------------------------------------------ turn (2)
def turn():
    up = A.up(torso='up', head='fwd', near=bot((2, 7), 80), far=hand((0, 9.5), 'open', bend=1))
    base = fig(up, legs((0, -17), (-3, -4), (3, -4)), ('turn', 0, 'stand'))
    return [squeeze(base, 0.66), squeeze(base, 0.36)]


# ------------------------------------------------------------------------------------ alert (1)
def alert():
    """Caught napping: he jolts upright, eyes wide, the bottle jerked up to his chest."""
    up = A.up(torso='back1', head='panic', hd=(0, -1), near=bot((5, -1), 84), far=hand((3, 4), 'open', bend=-1, sh=(0, -1)))
    return [fig(up, legs((0, -17), (-6, -4), (5, -4)), ('alert', 0, 'stand'))]


# ------------------------------------------------------------------------------------ tell (6)
TELL_KEYS = [
    # (near hand, bottle deg, cork, far hand, torso, head, pelvis dy, fx)
    ((6, -3), 56, 'corked', (8, -2), 'back1', 'happy', 0, [('shake', 'c')]),
    ((6, 0.5), 44, 'corked', (8, 1.5), 'up', 'happy', 0.5, [('shake2', 'c')]),
    ((6, 3.5), 32, 'strain', (8, 4.5), 'lean1', 'shout', 1, [('shake', 'c'), ('fizz', 'tip')]),
    ((6, -3), 56, 'strain', (8, -2), 'back1', 'shout', 0, [('shake2', 'c'), ('leak', 'tip')]),
    ((6, 0.5), 44, 'strain', (8, 1.5), 'up', 'happy', 0.5, [('shake', 'c'), ('fizz', 'tip')]),
    ((6, 3.5), 32, 'strain', (8, 4.5), 'lean1', 'shout', 1, [('shake2', 'c'), ('leak', 'tip')]),
]


def tell_upper(k):
    nh, deg, cork, fh, torso, head, _, fx = TELL_KEYS[k]
    far = hand(fh, 'cup', bend=-1)
    return A.up(torso=torso, head=head, near=bot(nh, deg, cork), far=far,
                fx=[(n, ('armN', a, 0, 0)) for n, a in fx])


def tell():
    """The tell: he shakes the bottle hard with both hands (the thumb on the cork), the knees
    bouncing with each shake; the cork strains and foam spits from it on the second shake."""
    out = []
    for k in range(6):
        dy = TELL_KEYS[k][6]
        out.append(fig(tell_upper(k), legs((0, -17 + dy), (-6, -4), (5, -4)), ('tell', k, 'stand')))
    return out


# ------------------------------------------------------------------------------------ fire (10)
# The shot: aim (2 ticks), the thumb pushes (1), POP (frame FIRE_POP from tick 3: the cork leaves
# at x + 12, y - 25 and the foam jet bursts), the bottle kicks up and the body rocks back
# (recoil), the foam sprays and thins, he laughs and lowers the bottle (settle).
FIRE_DUR = [2, 1, 2, 2, 2, 2, 2, 2, 3, 3]
FIRE_POP = 2
FIRE_KEYS = [
    # (near hand, deg, state, far hand, torso, head, pelvis, near foot, fx)
    ((1, 0), 10, 'corked', (4, 1), 'lean1', 'shout', (0, -16), (6, -4), []),
    ((1, 0.5), 9, 'strain', (4, 1.5), 'lean', 'shout', (1, -16), (6, -4), [('fizz', 'tip')]),
    ((1.5, 0), 11, 'open', (4.5, 1), 'lean1', 'shout', (1, -16), (6, -4), [('jet', 'mouth'), ('pop', 'mouth')]),
    ((4, -2), 28, 'open', (7, -1), 'back1', 'happy', (-1, -16), (6, -4), [('jet2', 'mouth')]),
    ((4, -3), 38, 'open', (7, -2), 'back', 'happy', (-1, -16.5), (6, -4), [('jet3', 'mouth')]),
    ((5, -2), 34, 'open', (7, -1), 'back1', 'happy', (-1, -17), (6, -4), [('over1', 'mouth')]),
    ((5, 0), 30, 'open', (7, 1), 'up', 'happy', (0, -17), (6, -4), [('over0', 'mouth'), ('drip', 'base')]),
    ((5, 2), 40, 'open', (6, 3), 'up', 'fwd', (0, -17), (5, -4), [('drip', 'mouth')]),
    ((4, 4), 58, 'open', (2, 7), 'up', 'fwd', (0, -17), (5, -4), []),
    ((4, 6), 70, 'open', (-0.5, 9.5), 'up', 'tipsy', (0, -17), (5, -4), []),
]


def fire_upper(k):
    nh, deg, st, fh, torso, head, _, _, fx = FIRE_KEYS[k]
    far = hand(fh, 'cup' if k < 8 else 'open', bend=-1 if k < 8 else 1)
    return A.up(torso=torso, head=head, near=bot(nh, deg, st), far=far,
                fx=[(n, ('armN', a, 0, 0)) for n, a in fx])


def fire():
    out = []
    for k in range(10):
        pel, foot = FIRE_KEYS[k][6], FIRE_KEYS[k][7]
        out.append(fig(fire_upper(k), legs(pel, (-6, -4), foot), ('fire', k, 'stand')))
    out[FIRE_POP].smear = True            # the pop: the bottle's kick and the jet in one blur
    return out


# ------------------------------------------------------------------------------------ gag-toast (8)
# Raise, CLINK with the neighbour (frame TOAST_CLINK), the bounce back, a long swig, aah.
TOAST_DUR = [8, 6, 6, 5, 7, 12, 12, 14]
TOAST_CLINK = 2


def toast():
    S = []
    st = legs((0, -17), (-5, -4), (5, -4))
    S.append((A.up(torso='up', head='fwd', near=bot((4, 5), 70, 'open'), far=hand((-0.5, 9.5), 'open', bend=1)), st))
    # the wind-up: he leans back, the bottle comes up and back
    S.append((A.up(torso='back1', head='happy', near=bot((4, -2), 62, 'open'), far=hand((0, 8.5), 'open', bend=1)),
              legs((-1, -17), (-6, -4), (5, -4))))
    # CLINK: the arm thrusts forward and up, the bottle tips to meet the other one
    S.append((A.up(torso='lean1', head='happy', near=bot((8, -4), 48, 'open'), far=hand((1, 8), 'open', bend=1),
                   fx=[('clink', ('armN', 'tip', 1, -1))]), legs((1, -17), (-5, -4), (6, -4))))
    # the bounce back
    S.append((A.up(torso='up', head='happy', near=bot((6, -5), 62, 'open'), far=hand((0, 8.5), 'open', bend=1),
                   fx=[('leak', ('armN', 'mouth', 0, -1))]), st))
    # to the mouth
    S.append((A.up(torso='back1', head='fwd', near=bot((7, -4), 150, 'open'), far=hand((0, 8.5), 'open', bend=1)), st))
    # the swig: the head back, the bottle up; a gulp of bubbles
    S.append((A.up(torso='back', head='swig', hd=(-1, 0), near=bot((8, -6), 172, 'open'),
                   far=hand((1, 6), 'palm', bend=1), fx=[('gulp', ('armN', 'base', 0, -2))]), legs((-1, -17), (-6, -4), (5, -4))))
    S.append((A.up(torso='back2', head='swig', hd=(-1, 0), near=bot((8, -7), 190, 'open'),
                   far=hand((1, 5), 'palm', bend=1), fx=[('gulp', ('armN', 'base', 1, -3))]), legs((-1, -17), (-6, -4), (5, -4))))
    # aah: the bottle comes down, eyes shut, the free hand wipes... pats the belly
    S.append((A.up(torso='up', head='aah', near=bot((5, 2), 76, 'open'), far=hand((4, 7), 'open', bend=-1)), st))
    return [fig(u, l, ('gag-toast', k, 'stand')) for k, (u, l) in enumerate(S)]


# ------------------------------------------------------------------------------------ gag-selfie (8)
SELFIE_DUR = [6, 6, 6, 4, 8, 8, 5, 5]


def selfie():
    """Phone up at arm's length, he poses with the bottle raised by its neck, SNAP (a small flash,
    a blink), checks the picture close up, laughs, raises the phone again."""
    S = []
    st = legs((0, -17), (-5, -4), (5, -4))
    dangle = lambda h, d=96: hand(h, kit.bhand(d, 'open', 'neck'), bend=1)
    S.append(A.up(torso='back1', head='up', near=hand((8, -4), 'phone'), far=dangle((0, 8))))
    S.append(A.up(torso='back1', head='up', near=hand((10, -6), 'phone', sh=(1, 0)), far=dangle((3, -3), 88)))
    S.append(A.up(torso='back1', head='happy', hd=(-1, 0), near=hand((10, -6.5), 'phone', sh=(1, 0)), far=dangle((3, -5), 84)))
    S.append(A.up(torso='back1', head='blink', hd=(-1, 0), near=hand((10, -6.5), 'phone', sh=(1, 0)), far=dangle((3, -5), 84),
                  fx=[('snap', ('armN', 'cam', 0, -1))]))
    S.append(A.up(torso='lean1', head='fwd', hd=(0, 1), near=hand((6, -1), 'phonelow'), far=dangle((2, 1), 90)))
    S.append(A.up(torso='lean1', head='happy', hd=(0, 1), near=hand((6, 0), 'phonelow'), far=dangle((0, 8), 100)))
    S.append(A.up(torso='up', head='happy', near=hand((8, -2), 'phone'), far=dangle((0, 8), 94)))
    S.append(A.up(torso='back1', head='up', near=hand((8, -4), 'phone'), far=dangle((0, 8), 92)))
    return [fig(u, st, ('gag-selfie', k, 'stand')) for k, u in enumerate(S)]


# ------------------------------------------------------------------------------------ photo-pose (6)
PHOTO_DUR = [8, 6, 10, 10, 6, 8]


def photo_pose():
    """SAY CHEESE: the bottle thrust up over his head, the thumb up, the chest out; the flash makes
    him blink; a proud grin (a loop)."""
    out = []
    keys = [((-1, -5), 84, (6, 3), 'back1', 'fwd', 0), ((-3, -8), 96, (7, 0), 'back1', 'happy', -1),
            ((-4, -9), 104, (7, -1), 'back', 'happy', -1), ((-4, -8.5), 102, (7, -0.5), 'back', 'happy', 0),
            ((-4, -9), 104, (7, 0), 'back1', 'blink', 0), ((-3, -8), 98, (7, 0), 'back1', 'fwd', 0)]
    for k, (nh, deg, fh, torso, head, ty) in enumerate(keys):
        up = A.up(torso=torso, head=head, tor=(0, ty), near=hand(fh, 'thumb', bend=-1),
                  far=hand(nh, kit.bhand(deg, 'corked', 'body'), bend=-1))
        out.append(fig(up, legs((0, -17), (-6, -4), (5, -4)), ('photo-pose', k, 'stand')))
    return out


# ------------------------------------------------------------------------------------ gloat (6)
GLOAT_DUR = [5, 4, 5, 5, 4, 5]


def gloat_upper(k, seated=False):
    """The group selfie: the phone up and in front (its camera near STAG.phone (9, -39)), the free
    hand a peace sign by his face, the head tilted in, a bounce."""
    bob = [0, 1, 1, 0, -1, 0][k]
    tilt = ['up', 'happy', 'happy', 'up', 'happy', 'up'][k]
    peace = [(9, 3), (9, 2), (10, 3), (9, 3), (9, 2), (10, 2)][k]
    return A.up(torso='back1', head=tilt, tor=(0, max(0, bob)), near=hand((9, (-9 if seated else -7.5) + 0.5 * bob), 'phone', sh=(1, -2) if seated else (1, -1)),
                far=hand(peace, 'peace', bend=-1, z=7))


def gloat():
    return [fig(gloat_upper(k), legs((0, -17), (-5, -4), (5, -4)), ('gloat', k, 'stand')) for k in range(6)]


# ------------------------------------------------------------------------------------ cower (4)
def cower_pose(k, seated=False):
    """The T-shirt pulled up over his head, both hands holding it there, the belly out, the knees
    knocking."""
    tx = [0, 1, 0, -1][k]
    if seated:
        lower = seat_lower(0)
    else:
        knees = [((-6, -5), (5, -4)), ((-5, -5), (4, -4)), ((-6, -5), (5, -4)), ((-5, -5), (4, -4))][k]
        lower = legs((0, -12 + (k % 2) * 0.5), knees[0], knees[1], 'toe', 'flat')
    p = dict(lower)
    p.update(torso='bare_lean' if k % 2 == 0 else 'bare_lean2', head=f'bundle{k % 2}', tor=(tx, 0), hd=(1, 2),
             armN=hand((0, -12), 'up', bend=-1, sh=(0, -1)), armF=hand((1, -11), 'up', bend=-1))
    if not seated:
        p['fx'] = [('quake', (2, -9))] if k % 2 else [('quake', (-1, -9))]
    return p


def cower():
    return [full(cower_pose(k), ('cower', k, 'cower')) for k in range(4)]


# ------------------------------------------------------------------------------------ deaths
def lie(**kw):
    base = dict(rot=90, armN=op((-6, -1)), armF=op((-5, 3)))
    base.update(kw)
    return base


def die():
    """Shot: the jolt, a drunken stagger back on two steps (the bottle flailing), the knees go, he
    sits down hard (a bounce), the bottle in his lap foams over, he tips back and lies flat."""
    S = []
    S.append(fp((0, -17), (-5, -4), (5, -4), torso='back', head='hurt', armN=bot((6, -4), 70, 'corked', 'body', bend=-1),
                armF=op((-6, -3))))
    S.append(fp((-1, -17), (-7, -4), (2, -6), 'flat', 'back', rot=8, head='hurt',
                armN=bot((7, -6), 96, 'corked', 'body', bend=-1), armF=op((-7, -5)), fx=[('hic', (10, -46))]))
    S.append(fp((-3, -16), (-9, -5), (0, -4), 'toe', 'flat', rot=12, head='dazed',
                armN=bot((7, -2), 110, 'corked', 'body', bend=-1), armF=op((-8, -1)), fx=[('hic', (8, -50))]))
    S.append(fp((-3, -13), (-7, -4), (3, -5), 'flat', 'heel', rot=10, head='dazed',
                armN=bot((6, 2), 90, 'corked', 'body', bend=-1), armF=op((-7, 1))))
    S.append(fp((-3, -9), (-1, -4), (6, -5), 'flat', 'heel', rot=6, head='hurt',
                armN=bot((6, 4), 88, 'corked', 'body', bend=-1), armF=op((-6, -1))))
    # THUD: on his backside, the legs out in front (squashed a little by the impact)
    sit = ((-4, -5), (6, -3), (10, -3), 'heel', 'heel')
    S.append(fp(*sit, rot=4, head='hurt', armN=bot((6, 6), 90, 'strain', 'body', bend=-1), armF=op((-7, 4)), squash=(0.92, 1.04)))
    S.append(fp(*sit, rot=-4, head='dazed', armN=bot((6, 6), 90, 'open', 'body', bend=-1), armF=op((-7, 5)),
                fx=[('over1', ('armN', 'mouth', 0, 0))]))
    S.append(fp(*sit, rot=10, head='dazed', armN=bot((6, 6), 94, 'open', 'body', bend=-1), armF=op((-7, 6)),
                fx=[('over2', ('armN', 'mouth', 0, 0))]))
    S.append(fp((-6, -4), (5, -4), (9, -4), 'heel', 'heel', rot=56, head='dazed', armN=bot((4, 6), 140, 'open', 'body', bend=-1),
                armF=op((-6, 2)), fx=[('over1', ('armN', 'mouth', 0, 0))]))
    S.append(fp((-10, -3), (5, -4), (10, -4), 'lie', 'lie', head='blink', fx=[('over0', ('armN', 'mouth', 0, 0))],
                **lie(armN=bot((0, -3), 180, 'open', 'body', bend=1))))
    return [full(p, ('die', k, 'dead')) for k, p in enumerate(S)]


def die_knife():
    """Knifed: he doubles over (both hands to his belly, the bottle slips), sinks to his knees,
    sways and falls on his face."""
    S = []
    belly = lambda h: dict(hand=h, end=('hand', 'fist'), bend=-1)
    S.append(fp((-1, -17), (-5, -4), (5, -4), torso='lean', head='hurt', armN=belly((5, 6)), armF=belly((6, 6)),
                items=[(kit.bottle_item(100, 'corked'), (10, -16), 20)]))
    S.append(fp((-1, -16), (-6, -4), (4, -4), torso='lean2', head='hurt', hd=(1, 1), armN=belly((4, 7)), armF=belly((5, 7)),
                items=[(kit.bottle_item(70, 'corked'), (12, -9), 20)]))
    S.append(fp((-1, -13), (-7, -4), (4, -4), 'toe', 'flat', torso='lean2', head='hurt', hd=(1, 1), armN=belly((4, 7)),
                armF=belly((5, 7)), items=[(kit.bottle_item(20, 'corked'), (14, -3), 20)]))
    S.append(fp((0, -9), (-8, -2), (4, -4), 'toe', 'flat', torso='lean', head='dazed', armN=belly((4, 7)), armF=belly((5, 6)),
                items=[(kit.bottle_item(0, 'corked'), (15, -2), 20)]))
    S.append(fp((0, -9), (-8, -2), (4, -4), 'toe', 'flat', torso='up', head='dazed', armN=op((3, 9)), armF=op((2, 9)),
                items=[(kit.bottle_item(0, 'corked'), (19, -2), 20)]))
    S.append(fp((0, -9), (-8, -2), (4, -4), 'toe', 'flat', rot=-20, head='dazed', armN=op((5, 8)), armF=op((4, 9)),
                items=[(kit.bottle_item(0, 'corked'), (22, -2), 20)]))
    S.append(fp((0, -8), (-8, -2), (4, -4), 'toe', 'flat', rot=-55, head='hurt', armN=op((8, 4), -1), armF=op((8, 5), -1),
                items=[(kit.bottle_item(0, 'corked'), (25, -2), 20)]))
    S.append(fp((-2, -5), (-10, -3), (-4, -3), 'toe', 'toe', rot=-88, head='hurt', armN=op((9, 0), -1), armF=op((9, 1), -1),
                items=[(kit.bottle_item(0, 'corked'), (28, -2), 20)]))
    S.append(fp((-2, -6), (-10, -4), (-4, -5), 'toe', 'toe', rot=-82, head='hurt', armN=op((8, -1), -1), armF=op((9, 0), -1),
                items=[(kit.bottle_item(0, 'corked'), (30, -2), 20)]))
    S.append(fp((-2, -5), (-10, -3), (-4, -3), 'toe', 'toe', rot=-88, head='blink', armN=op((9, 0), -1), armF=op((9, 1), -1),
                items=[(kit.bottle_item(0, 'corked'), (31, -2), 20)]))
    return [full(p, ('die-knife', k, 'dead')) for k, p in enumerate(S)]


# the bottle's own arc in the blast (root coordinates, the angle it spins to)
BLAST_BOTTLE = [None, ((8, -40), 120), ((12, -50), 200), ((15, -54), 280), ((18, -50), 0), ((21, -40), 80),
                ((23, -26), 160), ((24, -12), 240), ((25, -3), 0), ((25, -3), 0)]


def die_blast():
    """Blown up: the blast jolts him, the game launches the body in its arc while it turns over
    backwards (8 -> 128 degrees), the limbs trail the turn and open and close; a smear whirls him
    onto his back, he slams down, bounces, lies in a wisp of smoke; the bottle flies its own arc."""
    S = []

    def bt(k):
        b = BLAST_BOTTLE[k]
        return [(kit.bottle_item(b[1], 'open'), b[0], 20)] if b else []

    def air(k, deg, pel, far, near, fs, ns, head, armN, armF, torso='back'):
        p = M.tumble(fp(pel, far, near, fs, ns, torso=torso, head=head, armN=op(armN, -1), armF=op(armF)), deg)
        p['items'] = bt(k)
        return p
    S.append(air(0, 8, (0, -18), (-7, -6), (6, -7), 'back', 'heel', 'panic', (9, -5), (-8, -5)))
    S[0]['armN'] = bot((7, -6), 120, 'open', 'body', bend=-1)
    S.append(air(1, 30, (0, -18), (-6, -8), (7, -6), 'hang', 'flat', 'panic', (10, -1), (-6, -8)))
    S.append(air(2, 54, (0, -18), (-7, -8), (7, -8), 'back', 'heel', 'panic', (9, -7), (-8, -5)))
    S.append(air(3, 78, (0, -18), (-5, -9), (5, -11), 'hang', 'hang', 'panic', (8, -6), (-7, -5), 'up'))
    S.append(air(4, 102, (0, -18), (-6, -7), (7, -9), 'back', 'heel', 'hurt', (10, -3), (-8, -7)))
    S.append(air(5, 128, (0, -18), (-5, -8), (6, -9), 'hang', 'hang', 'hurt', (9, -2), (-7, -2), 'up'))
    S.append(fp((-10, -3), (5, -5), (10, -6), 'lie', 'lie', head='hurt', items=bt(6), **lie(armN=op((-6, -2)))))
    S.append(fp((-10, -6), (3, -11), (8, -13), 'heel', 'heel', head='hurt', rot=82, armN=op((-5, -6)), armF=op((-3, -6)),
                items=bt(7)))
    S.append(fp((-10, -3), (5, -4), (10, -5), 'lie', 'lie', head='hurt', items=bt(8), **lie()))
    S.append(fp((-10, -3), (6, -3), (11, -3), 'lie', 'lie', head='blink', items=bt(9),
                fx=[('smk2', (-14, -9)), ('smk0', (-12, -15))], **lie()))
    out = [full(p, ('die-blast', k, 'dead')) for k, p in enumerate(S)]
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
    """Burnt: it catches (a jolt, the bottle dropped), the hot-foot hop with flailing arms, a soot
    statue with white eyes (a blink), then stiff as a board he tips over backwards into smoke."""
    S = []
    S.append(fp((0, -18), (-5, -4), (5, -5), 'flat', 'toe', head='panic', torso='back',
                armN=op((8, -5), -1), armF=op((-8, -5)), fx=[('fl0', (-5, -16)), ('fl1', (-6, -20))],
                items=[(kit.bottle_item(110, 'corked'), (12, -18), 20)]))
    S.append(fp((0, -20), (-6, -8), (4, -6), 'back', 'hang', head='panic',
                armN=op((8, -7), -1), armF=op((-9, -2)), fx=[('fl1', (-6, -19)), ('fl2', (-5, -27)), ('fl0', (3, -15))],
                items=[(kit.bottle_item(30, 'corked'), (14, -4), 20)]))
    S.append(fp((0, -18), (-4, -4), (6, -9), 'flat', 'hang', head='shout',
                armN=op((7, 1), -1), armF=op((-6, 1)), fx=[('fl2', (-4, -23)), ('fl2', (1, -35)), ('fl1', (-3, -13))],
                items=[(kit.bottle_item(0, 'corked'), (15, -2), 20)]))
    statue = dict(head='soot', armN=hand((2, 9), 'open', -1), armF=hand((-1, 9), 'open', -1), soot=1)
    S.append(fp((0, -17), (-5, -4), (5, -4), fx=[('fl0', (-2, -45)), ('fl0', (3, -44)), ('smk1', (-3, -50))], **statue))
    S.append(fp((0, -17), (-5, -4), (5, -4), fx=[('smk2', (1, -54)), ('smk0', (-3, -60))], **dict(statue, head='sootblink')))
    S.append(fp((-3, -15), (-6, -4), (4, -6), 'toe', 'hang', rot=40, head='soot', soot=1,
                armN=hand((3, 6), 'open', -1), armF=hand((-2, 8), 'open', -1), fx=[('smk1', (-10, -40))]))
    S.append(fp((-7, -9), (0, -4), (7, -5), 'heel', 'hang', rot=66, head='soot', soot=1,
                armN=hand((0, 3), 'open', -1), armF=hand((-4, 5), 'open', -1), fx=[('smk1', (-14, -30))]))
    S.append(fp((-10, -3), (6, -3), (11, -3), 'lie', 'lie', head='sootblink', soot=1,
                fx=[('smk1', (-10, -10)), ('smk1', (2, -9)), ('smk0', (-4, -14))], **lie()))
    return [full(p, ('die-burn', k, 'dead')) for k, p in enumerate(S)]


def die_crush():
    """Crushed: he looks up and ducks, the arms over his head, the bottle held up (anticipation); the
    impact squashes him; he lies flat as a beer mat, springs up once, flattens with stars, blinks."""
    duck = fp((0, -15), (-6, -4), (5, -4), torso='back1', head='panic',
              armN=bot((6, -5), 90, 'corked', 'body', bend=-1), armF=op((-5, -9), 1))
    flat = fp((-4, -3), (12, -3), (17, -3), 'lie', 'lie', head='hurt', **lie())
    stars = lambda a, b: [('star', a), ('star', b)]
    out = [full(duck, ('die-crush', 0, 'dead')),
           full(dict(duck, squash=(0.45, 1.25)), ('die-crush', 1, 'dead')),
           full(dict(flat, squash=(0.55, 1.15)), ('die-crush', 2, 'dead')),
           full(dict(flat, squash=(0.8, 1.05), fx=stars((-8, -14), (6, -16))), ('die-crush', 3, 'dead')),
           full(dict(flat, squash=(0.5, 1.18), fx=stars((-4, -11), (9, -10))), ('die-crush', 4, 'dead')),
           full(dict(flat, head='blink', squash=(0.55, 1.15), fx=stars((-1, -12), (11, -12))), ('die-crush', 5, 'dead'))]
    out[1].smear = True
    return out


# ------------------------------------------------------------------------------------ seated
SEAT_HIP = 18                 # the hip over the stool's floor point (beer-bike geometry: seatHip)
CRANK = (6, 11)               # the pedal crank from the hip
CRANK_R = 2.5
SIT_N = 8


def pedal_legs(a):
    """Both feet on the pedals at crank angle a (turns; the far pedal half a turn on), in root
    coordinates (the floor under the stool)."""
    def foot(t):
        x = CRANK[0] + math.cos(2 * math.pi * t) * CRANK_R
        y = -(SEAT_HIP - 1) + CRANK[1] + math.sin(2 * math.pi * t) * CRANK_R
        return (x, y)
    return dict(legN=dict(ank=foot(a), shoe='flat', bend=1), legF=dict(ank=foot(a + 0.5), shoe='flat', bend=1))


def seat_lower(a=0.0):
    # the rig's pelvis row sits a row over the joint it reports (the feet anchor is the line under
    # the soles): pelvis -(SEAT_HIP - 1) puts the 'hip' point SEAT_HIP over the stool's floor point
    return dict(pelvis=(0, -(SEAT_HIP - 1)), seated=True, **pedal_legs(a))


def sit():
    """Pedalling on the stool: the crank turns once in 8 frames (28 ticks), the body rocks with the
    push of each foot, the bottle swings with a beat and comes up for a cheer on the second half."""
    out = []
    for i in range(SIT_N):
        ph = i / SIT_N
        rock = 1 if i % 4 in (1, 2) else 0
        raise_ = i in (4, 5, 6)
        nh = (7, 1.5 - (i - 4) * 0.5) if raise_ else (6, 4 + rock * 0.5)
        deg = 88 if raise_ else 72
        up = A.up(torso='lean1' if rock else 'up', head='happy' if i in (5, 6) else 'fwd', tor=(0, rock), hd=(0, 0),
                  near=bot(nh, deg, 'corked'), far=hand((7, 4), 'fist', bend=-1))
        out.append(fig(up, seat_lower(ph), ('sit', i, 'seat')))
    return out


def seated(upper_fn, n, name):
    return [fig(upper_fn(k), seat_lower(0), (name, k, 'seat')) for k in range(n)]


def die_stool():
    """Seated, shot: the jolt on the stool, he tips over backwards (the legs come up off the
    pedals), a whirl in the air behind the stool (a smear), he slams down on his back on the floor,
    bounces once and lies dazed."""
    S = []
    up = lambda **kw: dict(**seat_lower(0), **kw)
    S.append(up(armN=op((7, -8), -1), armF=op((-2, -10)), torso='back', head='hurt', rot=-4))
    S.append(dict(pelvis=(-1, -18), legN=dict(ank=(9, -10), shoe='hang', bend=1), legF=dict(ank=(7, -12), shoe='hang', bend=1),
                  armN=op((6, -10), -1), armF=op((-4, -9)), torso='back', head='panic', rot=22))
    S.append(dict(pelvis=(-5, -18), legN=dict(ank=(6, -19), shoe='hang', bend=1), legF=dict(ank=(3, -20), shoe='hang', bend=1),
                  armN=op((3, -8), -1), armF=op((-6, -6.5)), torso='back', head='panic', rot=54))
    S.append(dict(pelvis=(-8, -14), legN=dict(ank=(4, -24), shoe='hang', bend=1), legF=dict(ank=(1, -25), shoe='hang', bend=1),
                  armN=op((2, -8), -1), armF=op((-8, -3)), torso='back', head='panic', rot=76))
    S.append(dict(pelvis=(-11, -8), legN=dict(ank=(2, -17), shoe='hang', bend=1), legF=dict(ank=(-1, -18), shoe='hang', bend=1),
                  armN=op((-2, -7), -1), armF=op((-9, 1)), torso='up', head='hurt', rot=88))
    S.append(fp((-12, -3), (2, -5), (7, -6), 'lie', 'lie', head='hurt', squash=(0.85, 1.05), **lie(armN=op((-6, -2)))))
    S.append(fp((-12, -6), (0, -11), (5, -13), 'heel', 'heel', head='hurt', rot=82, armN=op((-5, -6)), armF=op((-3, -6))))
    S.append(fp((-12, -3), (2, -4), (7, -5), 'lie', 'lie', head='dazed', **lie()))
    S.append(fp((-12, -3), (3, -3), (8, -3), 'lie', 'lie', head='dazed', **lie(armN=op((-6, -2)))))
    S.append(fp((-12, -3), (3, -3), (8, -3), 'lie', 'lie', head='blink', **lie(armN=op((-6, -2)))))
    out = [full(p, ('die-stool', k, 'dead')) for k, p in enumerate(S)]
    out[3].smear = True             # the tip over: the fastest turn, one blurred in-between
    return out


# ------------------------------------------------------------------------------------ flash (3)
FLASH = [K.grid("""
    ...........
    ...........
    .....I.....
    .....i.....
    ....iWi....
    ..IiWWWiI..
    ....iWi....
    .....i.....
    .....I.....
    ...........
    ...........
"""), K.grid("""
    .....I.....
    .....I.....
    ..y..i..y..
    ...y.W.y...
    ....WWW....
    IIiWWWWWiII
    ....WWW....
    ...y.W.y...
    ..y..i..y..
    .....I.....
    .....I.....
"""), K.grid("""
    ...........
    .....i.....
    ...........
    ...i...i...
    ...........
    .i...y...i.
    ...........
    ...i...i...
    ...........
    .....i.....
    ...........
""")]


def flash():
    return [X.Frame(f, (5, 5)) for f in FLASH]


# ------------------------------------------------------------------------------------ build
def build(s, look, with_flash=False):
    LOOK[0] = look
    kit.install(look)
    s.strip('idle', idle(), 12, cls='idle-breathing')
    s.strip('walk', walk(), WALK_TPF, cls='locomotion')
    s.strip('turn', turn(), 2, cls='turn')
    s.strip('alert', alert(), 30, cls='telegraph')
    s.strip('tell', tell(), 4, cls='telegraph',
            why='two shakes in 24 ticks (the telegraph STAG.tele); the code loops it for any tell length')
    s.strip('fire', fire(), FIRE_DUR, loop=False, cls='shoot')
    s.strip('gag-toast', toast(), TOAST_DUR, cls='idle-fidget')
    s.strip('gag-selfie', selfie(), SELFIE_DUR, cls='idle-fidget')
    s.strip('photo-pose', photo_pose(), PHOTO_DUR, defer=True, cls='victory')
    s.strip('gloat', gloat(), GLOAT_DUR, defer=True, cls='victory')
    s.strip('cower', cower(), 3, defer=True, cls='reaction')
    s.strip('die', die(), [4, 5, 5, 6, 4, 5, 6, 6, 8, 20], loop=False, cls='death-shot')
    s.strip('die-knife', die_knife(), [3, 3, 4, 4, 4, 4, 5, 3, 6, 20], loop=False, defer=True, cls='death-shot')
    s.strip('die-blast', die_blast(), [4, 4, 4, 4, 4, 3, 5, 5, 5, 12], loop=False, defer=True, cls='death-blast')
    s.strip('die-burn', die_burn(), [3, 4, 4, 10, 7, 5, 4, 5], loop=False, defer=True, cls='death-burn')
    s.strip('die-crush', die_crush(), [7, 3, 10, 6, 6, 15], loop=False, defer=True, cls='death-crush')
    s.strip('sit', sit(), [4, 3] * (SIT_N // 2), cls='idle-breathing')
    s.strip('sit-tell', seated(tell_upper, 6, 'sit-tell'), 4, cls='telegraph')
    sf = seated(fire_upper, 10, 'sit-fire')
    sf[FIRE_POP].smear = True
    s.strip('sit-fire', sf, FIRE_DUR, loop=False, cls='shoot')
    s.strip('sit-gloat', seated(lambda k: gloat_upper(k, True), 6, 'sit-gloat'), GLOAT_DUR, defer=True, cls='victory')
    s.strip('sit-cower', [full(cower_pose(k, True), ('sit-cower', k, 'cower')) for k in range(4)], 3, defer=True,
            cls='reaction')
    s.strip('die-stool', die_stool(), [4, 5, 5, 3, 5, 5, 5, 6, 4, 12], loop=False, cls='death-shot')
    if with_flash:
        s.strip('flash', flash(), [2, 3, 4], loop=False, defer=True, cls='prop')
    s.event('FIRE_POP', FIRE_POP)
    s.event('FIRE_POP_TICK', sum(FIRE_DUR[:FIRE_POP]))
    s.event('TOAST_CLINK', TOAST_CLINK)
    s.event('SIT_CRANK_FRAMES', SIT_N)
