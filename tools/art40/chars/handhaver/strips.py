# The handhaver's strips: poses per frame and the holds in 60 Hz ticks. Every logic time the game
# reads stays (docs/design/ams40/contract.md "handhaver"); the frame counts follow the plan's
# action classes. Drawn facing right (the game's unflipped sprite faces right).
import math

import art40 as X
import castkit as K
import ext_moves as M
import pose          # the spin / squash / soot post hook and the flame and smoke FX
import rig

P = K.P
A = K.A


# ------------------------------------------------------------------------------------ helpers
def hand(h, kind='fist', bend=-1, sh=(0, 0), z=None):
    return A.hand(h, kind, 'hand', bend=bend, sh=sh, z=z)


def legs(pel, far, near, fs='flat', ns='flat', fb=1, nb=1, fhip=None, nhip=None):
    p = A.legs(pel, far, near, fs, ns, fb, nb)
    if fhip is not None:
        p['legF']['hip'] = fhip
    if nhip is not None:
        p['legN']['hip'] = nhip
    return p


STAND = legs((0, -17), (-4, -4), (4, -4))
WIDE = legs((0, -16), (-7, -4), (6, -4))          # the throwing stance: the near foot forward


def game_pts(j):
    """The points the game had on every frame: hand (the near hand), head (the head centre), hip."""
    nk = j.get('head.neck') or j.get('torso.neck') or j['pel']
    return {'hand': j.get('armN.wrist', j['pel']), 'head': (nk[0] + 1, nk[1] - 7), 'hip': j['pel']}


def fig(upper, lower):
    """One standing frame: the upper pose on the lower pose, with the game points and every joint."""
    rows, root, j = X.humanoid(upper, lower)
    return X.Frame(rows, root, pts=game_pts(j), joints=j)


def _turn(pt, piv, deg):
    """A point turned like rig.rotsprite turns pixels (positive deg = counter-clockwise on screen)."""
    a = math.radians(deg)
    dx, dy = pt[0] - piv[0], pt[1] - piv[1]
    return (piv[0] + dx * math.cos(a) + dy * math.sin(a), piv[1] - dx * math.sin(a) + dy * math.cos(a))


def seen_joints(p, j):
    """The joints where the player SEES them (wave 1 verify): X.full records the rig joints before
    the 'rot' turn of the upper body (about the pelvis), the whole-body 'spin' (ext_moves.tumble)
    and the 'squash' of the post hook. The smoothness gate must measure the drawn figure."""
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


def full(p, pts=None, ground=True):
    """One-piece frame (deaths, cower): pose.compose 'full' with the post hook (spin, squash, soot).
    ground: a figure that would sink under the feet anchor (a lying torso, a kneeling knee) has its
    pelvis raised until its lowest row stands on the floor line (rule 2: 'feet' is the ground
    contact; wave 1 verify). The feet and items stay where the pose put them."""
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
        if below > 0:                       # a foot itself (a 'toe' shoe) reaches under: lift it all
            root = (root[0], root[1] + below)
    j = seen_joints(p, j)
    g = game_pts(j)
    if pts:
        g.update(pts)
    return X.Frame(rows, root, pts=g, joints=j)


def fp(pel, far, near, fs='flat', ns='flat', **kw):
    return M.fp(pel, far, near, fs, ns, **kw)


def book_far(h=(7, 6), kind='book', z=None):
    """The far hand holds the ticket book (shut: in front of the belly; open: up at the chest)."""
    return hand(h, kind, -1, z=z)


def edit_pts(f, **kw):
    f.pts.update(kw)
    return f


# ------------------------------------------------------------------------------------ idle (4)
def idle():
    # breathing: the chest lifts (frames 1-2), the head follows a frame late, the hands ride along
    by = [0, 0, 1, 1]
    hy = [0, 1, 1, 0]
    out = []
    for k in range(4):
        up = A.up(torso='in' if k in (1, 2) else 'up', head='fwd', tor=(0, by[k]), hd=(0, hy[k] - by[k]),
                  near=hand((1, 9.5 - by[k] * 0.5)), far=book_far((7.5, 6 - by[k] * 0.5)))
        out.append(fig(up, STAND))
    return out


# ------------------------------------------------------------------------------------ walk (12)
WALK_N = 12
STEP = 2.4            # 0.6 px/tick x 4 ticks per frame: the planted foot moves back 2.4 px a frame
SHOE_Y = {'heel': -3, 'toe': -5}


def walk_foot(k):
    """One foot over the 12-frame cycle: planted for frames 0-6 (back 2.4 px a frame, heel strike
    to toe-off), swinging for 7-11 (lift behind, the knee drives forward, reach)."""
    k %= WALK_N
    if k <= 6:
        x = 7.2 - STEP * k
        shoe = 'heel' if k == 0 else 'toe' if k == 6 else 'flat'
        return (x, SHOE_Y.get(shoe, -4)), shoe
    t = (k - 6) / 6
    x = -7.2 + 14.4 * (1 - math.cos(math.pi * t)) / 2
    y = -4 - 4.0 * math.sin(math.pi * min(1.0, t * 1.1))
    shoe = 'back' if t < 0.3 else 'hang' if t < 0.75 else 'flat'
    return (x, y), shoe


def walk_lower(i):
    na, ns = walk_foot(i)
    fa, fs = walk_foot(i + 6)
    pel_y = [-16, -16.5, -17, -17, -17, -16.5][i % 6]
    # the hips turn with the stride: the hip of the forward leg moves forward
    return legs((0, pel_y), fa, na, fs, ns, fhip=(-1 + 0.45 * fa[0], 0), nhip=(1 + 0.45 * na[0], 0))


def walk():
    out = []
    for i in range(WALK_N):
        ph = 2 * math.pi * i / WALK_N
        # the near arm swings against the near leg (the near foot strikes at frame 0: the arm back);
        # the swing trails the legs by a frame (follow-through), the book bobs with the chest
        sx = -4.0 * math.cos(ph - 0.5) + 0.5
        sy = 9.6 - 0.06 * sx * sx
        up = A.up(torso='lean1', head='fwd', hd=(0, 1 if i % 6 == 1 else 0),
                  near=hand((sx, sy)), far=book_far((7.5, 5.5 + (0.5 if i % 6 in (0, 1) else 0))))
        out.append(fig(up, walk_lower(i)))
    return X.plant(out)


# ------------------------------------------------------------------------------------ turn (2)
def squeeze(f, k):
    """The frame narrowed to k of its width around the anchor column (the Turner's two in-betweens:
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
    # he squares up to the player: the arms come in to the body, the head turns with him
    up = A.up(torso='up', head='fwd', near=hand((0.5, 9.5)), far=book_far((5, 6)))
    base = fig(up, legs((0, -17), (-3, -4), (3, -4)))
    return [squeeze(base, 0.66), squeeze(base, 0.36)]


# ------------------------------------------------------------------------------------ alert (1)
def alert():
    up = A.up(torso='back1', head='shout', near=hand((9, -3), 'point', bend=-1), far=book_far((6, 5)))
    return [fig(up, legs((0, -17), (-5, -4), (5, -4)))]


# ------------------------------------------------------------------------------------ tell (4)
def tell():
    out = []
    # 0: opens the book at his chest, the pencil hand comes up
    out.append(fig(A.up(torso='up', head='down', hd=(0, 1), near=hand((5, 4), 'pencil'),
                        far=book_far((6, 3), 'bookopen', z=1)), STAND))
    # 1: licks the pencil
    out.append(fig(A.up(torso='back1', head='lick', near=hand((5, -4), 'pencilup', bend=-1),
                        far=book_far((6, 4), 'bookopen', z=1)), STAND))
    # 2: tears the ticket off the book
    out.append(fig(A.up(torso='up', head='down', hd=(0, 1), near=hand((8, 1), 'tear'),
                        far=book_far((6, 4), 'bookopen', z=1)), legs((0, -17), (-5, -4), (5, -4))))
    # 3: the wind-up (held until the ticket leaves): the ticket back over his shoulder, BOETE!
    out.append(fig(A.up(torso='back', head='shout', near=hand((-10, -5), 'ticket', sh=(-1, 0)),
                        far=book_far((6, 5), 'bookopen', z=1)), WIDE))
    return out


# ------------------------------------------------------------------------------------ throw (6)
def throw():
    out = []
    fwd = legs((2, -16), (-7, -5), (6, -4), 'toe', 'flat')
    # 0: the flick, the hand open (the game's ticket leaves it on this frame, at x + 10, y - 25:
    # THROW_RELEASE)
    out.append(fig(A.up(torso='lean', head='shout', near=hand((8, -1.5), 'open', bend=-1),
                        far=book_far((3, 6), 'bookopen', z=1)), fwd))
    # 1: follow-through, the hand open past the hip
    out.append(fig(A.up(torso='lean2', head='shout', near=hand((9, 5), 'open', bend=-1, sh=(1, 0)),
                        far=book_far((2, 7), 'bookopen', z=1)), fwd))
    # 2: the overshoot settles
    out.append(fig(A.up(torso='lean', head='fwd', near=hand((6, 8), 'open'),
                        far=book_far((4, 7), 'book', z=1)), legs((1, -16), (-6, -4), (6, -4))))
    # 3: the back straightens, the book shuts
    out.append(fig(A.up(torso='lean1', head='fwd', near=hand((3, 9)), far=book_far((5, 6))),
                   legs((1, -16.5), (-5, -4), (5, -4))))
    # 4-5: the back foot draws in, the arm eases down to the side
    out.append(fig(A.up(torso='up', head='fwd', near=hand((1.5, 9.5)), far=book_far((6, 6))),
                   legs((0, -17), (-4, -5), (4, -4), 'toe', 'flat')))
    out.append(fig(A.up(torso='up', head='blink', near=hand((1, 9.5)), far=book_far((6, 6))), STAND))
    return out


# ------------------------------------------------------------------------------------ photo-pose (6)
def photo_pose():
    """Poses for the tourist's camera: the thumb comes up, the chest puffs out, a proud grin, the
    flash makes him blink, a smug look (a loop)."""
    out = []
    pose_ = lambda h, hd, tor=(0, 0), torso='back1': A.up(
        torso=torso, head=hd, tor=tor, near=hand(h, 'thumb', bend=-1), far=book_far((6, 6)))
    st = legs((0, -17), (-5, -4), (5, -4))
    out.append(fig(pose_((7, 4), 'smug', (0, 0), 'up'), st))
    out.append(fig(pose_((8.5, 1), 'smug', (0, -1), 'in'), st))
    out.append(fig(pose_((8.5, 0), 'happy', (0, -1), 'in'), st))
    out.append(fig(pose_((8.5, 0.5), 'happy', (0, 0), 'in'), st))
    out.append(fig(pose_((8.5, 1), 'blink', (0, 0)), st))
    out.append(fig(pose_((8, 1.5), 'smug', (0, 0)), st))
    return out


# ------------------------------------------------------------------------------------ gloat (6)
GLOAT_ROLES = ('WRITE', 'WRITE2', 'TEAR', 'HOLD', 'DROP', 'DONE')


def gloat():
    out = []
    bk = book_far((6, 3), 'bookopen', z=1)
    # write, write2: the pencil scribbles on the open page, the head bent over it
    out.append(fig(A.up(torso='lean1', head='down', hd=(0, 1), near=hand((6, 2), 'pencil'), far=bk), STAND))
    out.append(fig(A.up(torso='lean1', head='down', hd=(0, 1), near=hand((8, 3), 'pencil'), far=bk), STAND))
    # tear: pinches the page and rips it off (the book jerks down)
    out.append(fig(A.up(torso='up', head='fwd', near=hand((8, 0), 'tear'),
                        far=book_far((6, 5), 'bookopen', z=1)), STAND))
    # hold: holds the page up beside his cap, the chin up
    out.append(fig(A.up(torso='back1', head='smug', near=hand((8, -8), 'page', sh=(1, -1)),
                        far=book_far((6, 5), 'book')), STAND))
    # drop: lets it go, the hand open, palm down (the page leaves from x + 9, y - 32)
    out.append(fig(A.up(torso='back1', head='smug', near=hand((8, -8.5), 'up', sh=(1, -1)),
                        far=book_far((6, 5), 'book')), STAND))
    # done: stands back, the book shut at his chest, the free hand on his belt, the chin up
    out.append(fig(A.up(torso='back', head='smug', near=hand((-1, 8), 'fist', bend=1),
                        far=book_far((5, 3), 'book')), legs((0, -17), (-5, -4), (4, -4))))
    return out


# ------------------------------------------------------------------------------------ cower (4)
def cower():
    out = []
    crouch = ((0, -11), (-6, -5), (5, -4), 'toe', 'flat')
    for k, (tx, hd, nh) in enumerate(((0, (0, 0), (3, -8)), (1, (0, 1), (4, -8)), (0, (1, 0), (3, -7)), (-1, (0, 1), (2, -8)))):
        p = fp(*crouch, torso='lean2', head='panic', tor=(tx, 0), hd=(hd[0] + 1, hd[1] + 3),
               armN=hand((nh[0] - 2, nh[1] - 1), 'open', bend=-1, sh=(1, -1)), armF=hand((2, -9), 'open', bend=-1, sh=(0, -1)))
        out.append(full(p))
    return out


# ------------------------------------------------------------------------------------ deaths
def lie(**kw):
    base = dict(rot=90, armN=dict(hand=(-6, -1), end=('hand', 'open'), bend=1),
                armF=dict(hand=(-5, 3), end=('hand', 'open'), bend=1))
    base.update(kw)
    return base


def cap(i, at):
    return [(f'cap{i}', at, 20)]


def die():
    """Shot: the jolt, the cap pops off, he swoons (the back of the hand to his brow), the knees
    buckle, he falls back, bounces once and lies dazed; the cap lands beside him."""
    S = []
    op = lambda h, b=1: dict(hand=h, end=('hand', 'open'), bend=b)
    S.append(fp((0, -17), (-5, -4), (5, -4), torso='back', head='hurt', armN=op((8, 0), -1), armF=op((-6, -2))))
    S.append(fp((-1, -17), (-6, -4), (4, -5), 'flat', 'toe', rot=8, head='nc_hurt', armN=op((8, -3), -1),
                armF=op((-7, -4)), items=cap(1, (2, -44))))
    S.append(fp((-2, -16), (-6, -4), (5, -4), rot=14, head='nc_dazed', armN=op((7, 3), -1),
                armF=op((-8, -3)), items=cap(2, (1, -49))))
    S.append(fp((-3, -15), (-6, -4), (5, -4), rot=18, head='nc_dazed', armN=op((5, 6), -1),
                armF=op((-8, -1)), items=cap(3, (0, -50))))
    S.append(fp((-4, -13), (-7, -4), (4, -6), 'toe', 'hang', rot=32, head='nc_dazed', armN=op((5, 4), -1),
                armF=op((-7, -3)), items=cap(4, (-2, -46))))
    S.append(fp((-6, -10), (-8, -4), (3, -9), 'toe', 'hang', rot=52, head='nc_hurt', armN=op((4, 6), -1),
                armF=op((-6, -2)), items=cap(5, (-4, -36))))
    S.append(fp((-8, -6), (-4, -6), (6, -11), 'hang', 'heel', rot=72, head='nc_hurt', armN=op((0, -1)),
                armF=op((-6, 0)), items=cap(6, (-6, -24))))
    S.append(fp((-10, -3), (5, -5), (10, -6), 'lie', 'lie', head='nc_hurt', items=cap(0, (14, -9)), **lie()))
    S.append(fp((-10, -5), (3, -9), (8, -11), 'heel', 'heel', rot=84, head='nc_dazed',
                armN=op((-5, -5)), armF=op((-3, -5)), items=[('capfloor', (15, -3), 20)]))
    S.append(fp((-10, -3), (6, -3), (11, -3), 'lie', 'lie', head='nc_blink', items=[('capfloor', (15, -3), 20)], **lie()))
    return [full(p) for p in S]


def die_knife():
    """Knifed: he doubles over (both hands to his belly), sinks to his knees, sways and falls on
    his face; the cap rolls off forward."""
    S = []
    belly = lambda h: dict(hand=h, end=('hand', 'fist'), bend=-1)
    op = lambda h, b=1: dict(hand=h, end=('hand', 'open'), bend=b)
    S.append(fp((-1, -17), (-5, -4), (5, -4), torso='lean', head='hurt', armN=belly((5, 6)), armF=belly((6, 6))))
    S.append(fp((-1, -16), (-6, -4), (4, -4), torso='lean2', head='hurt', hd=(1, 1), armN=belly((4, 7)), armF=belly((5, 7))))
    S.append(fp((-1, -13), (-7, -4), (4, -4), 'toe', 'flat', torso='lean2', head='hurt', hd=(1, 1), armN=belly((4, 7)), armF=belly((5, 7))))
    S.append(fp((0, -9), (-8, -2), (4, -4), 'toe', 'flat', torso='lean', head='dazed', armN=belly((4, 7)), armF=belly((5, 6))))
    S.append(fp((0, -9), (-8, -2), (4, -4), 'toe', 'flat', torso='up', head='dazed', armN=op((3, 9)), armF=op((2, 9))))
    S.append(fp((0, -9), (-8, -2), (4, -4), 'toe', 'flat', rot=-20, head='nc_dazed', armN=op((5, 8)), armF=op((4, 9)),
                items=cap(1, (13, -30))))
    S.append(fp((0, -8), (-8, -2), (4, -4), 'toe', 'flat', rot=-55, head='nc_hurt', armN=op((8, 4), -1), armF=op((8, 5), -1),
                items=cap(2, (19, -14))))
    S.append(fp((-2, -5), (-10, -3), (-4, -3), 'toe', 'toe', rot=-88, head='nc_hurt', armN=op((9, 0), -1), armF=op((9, 1), -1),
                items=cap(3, (22, -6))))
    S.append(fp((-2, -6), (-10, -4), (-4, -5), 'toe', 'toe', rot=-82, head='nc_hurt', armN=op((8, -1), -1), armF=op((9, 0), -1),
                items=[('capfloor', (24, -3), 20)]))
    S.append(fp((-2, -5), (-10, -3), (-4, -3), 'toe', 'toe', rot=-88, head='nc_blink', armN=op((9, 0), -1), armF=op((9, 1), -1),
                items=[('capfloor', (24, -3), 20)]))
    return [full(p) for p in S]


BLAST_CAP = [None, (6, -44), (10, -54), (14, -58), (18, -54), (21, -44), (23, -30), (24, -16), (25, -6), (25, -6)]


def die_blast():
    """Blown up: the blast jolts him, the game launches the body in its arc while it turns over
    backwards (8 -> 125 degrees, about 25 a frame), the limbs trail the turn and open and close
    (follow-through, wave 1 verify: no rigid doll); a smear whirls him onto his back, he slams
    down, bounces, lies in a wisp of smoke; the cap flies its own arc."""
    S = []
    op = lambda h, b=1: hand(h, 'open', b)

    def air(k, deg, pel, far, near, fs, ns, head, armN, armF, torso='back'):
        p = M.tumble(fp(pel, far, near, fs, ns, torso=torso, head=head, armN=op(armN, -1), armF=op(armF)), deg)
        p['items'] = capk(k)
        return p

    def capk(k):
        c = BLAST_CAP[k]
        return [(f'cap{k % 6}', c, 20)] if c else []
    # 0: the jolt: the chest thrown back, arms and legs flung out
    S.append(air(0, 8, (0, -18), (-7, -6), (6, -7), 'back', 'heel', 'panic', (9, -5), (-8, -5)))
    # 1: launched: the arms and the legs trail the turn (forward and down), the cap pops off
    S.append(air(1, 30, (0, -18), (-6, -8), (7, -6), 'hang', 'flat', 'nc_panic', (10, -1), (-6, -8)))
    # 2: the body opens wide at the top of the arc
    S.append(air(2, 54, (0, -18), (-7, -8), (7, -8), 'back', 'heel', 'nc_panic', (9, -7), (-8, -5)))
    # 3: the knees tuck, the arms come in (the turn speeds up)
    S.append(air(3, 78, (0, -18), (-5, -9), (5, -11), 'hang', 'hang', 'nc_panic', (8, -6), (-7, -5), 'up'))
    # 4: head down, he opens again as he falls
    S.append(air(4, 102, (0, -18), (-6, -7), (7, -9), 'back', 'heel', 'nc_hurt', (10, -3), (-8, -7)))
    # 5: the smear: he whirls round onto his back (a smoke streak behind him)
    S.append(air(5, 128, (0, -18), (-5, -8), (6, -9), 'hang', 'hang', 'nc_hurt', (9, -2), (-7, -2), 'up'))
    S.append(fp((-10, -3), (5, -5), (10, -6), 'lie', 'lie', head='nc_hurt', items=capk(6), **lie(armN=dict(hand=(-6, -2), end=('hand', 'open'), bend=1))))
    S.append(fp((-10, -6), (3, -11), (8, -13), 'heel', 'heel', head='nc_hurt', rot=82,
                armN=dict(hand=(-5, -6), end=('hand', 'open'), bend=1), armF=dict(hand=(-3, -6), end=('hand', 'open'), bend=1),
                items=capk(7)))
    S.append(fp((-10, -3), (5, -4), (10, -5), 'lie', 'lie', head='nc_hurt', items=[('capfloor', (25, -3), 20)], **lie()))
    S.append(fp((-10, -3), (6, -3), (11, -3), 'lie', 'lie', head='nc_blink', items=[('capfloor', (25, -3), 20)],
                fx=[('smk2', (-14, -9)), ('smk0', (-12, -15))], **lie()))
    # airborne frames 0-5 are in the air (the game's launch arc): no grounding for them
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
    """Burnt: it catches (a jolt), the hot-foot hop with flailing arms, a soot statue with white
    eyes (a blink), then stiff as a board he tips over backwards into a puff of smoke."""
    S = []
    op = lambda h, b=1: hand(h, 'open', b)
    S.append(fp((0, -18), (-5, -4), (5, -5), 'flat', 'toe', head='panic', torso='back',
                armN=op((8, -5), -1), armF=op((-8, -5)), fx=[('fl0', (-5, -16)), ('fl1', (-6, -20))]))
    S.append(fp((0, -20), (-6, -8), (4, -6), 'back', 'hang', head='panic',
                armN=op((8, -7), -1), armF=op((-9, -2)), fx=[('fl1', (-6, -19)), ('fl2', (-5, -27)), ('fl0', (3, -15))]))
    S.append(fp((0, -18), (-4, -4), (6, -9), 'flat', 'hang', head='shout',
                armN=op((8, 2), -1), armF=op((-6, 1)), fx=[('fl2', (-4, -23)), ('fl2', (1, -35)), ('fl1', (-3, -13))]))
    statue = dict(head='soot', armN=hand((2, 9), 'open', -1), armF=hand((-1, 9), 'open', -1), soot=1)
    S.append(fp((0, -17), (-5, -4), (5, -4), fx=[('fl0', (-2, -45)), ('fl0', (3, -44)), ('smk1', (-3, -50))], **statue))
    S.append(fp((0, -17), (-5, -4), (5, -4), fx=[('smk2', (1, -54)), ('smk0', (-3, -60))], **dict(statue, head='sootblink')))
    S.append(fp((-3, -15), (-6, -4), (4, -6), 'toe', 'hang', rot=40, head='soot', soot=1,
                armN=hand((3, 6), 'open', -1), armF=hand((-2, 8), 'open', -1), fx=[('smk1', (-10, -40))]))
    # stiff as a board, halfway down (the tip in two steps: the gate measures the drawn figure)
    S.append(fp((-7, -9), (0, -4), (7, -5), 'heel', 'hang', rot=66, head='soot', soot=1,
                armN=hand((0, 3), 'open', -1), armF=hand((-4, 5), 'open', -1), fx=[('smk1', (-14, -30))]))
    S.append(fp((-10, -3), (6, -3), (11, -3), 'lie', 'lie', head='sootblink', soot=1,
                fx=[('smk1', (-10, -10)), ('smk1', (2, -9)), ('smk0', (-4, -14))], **lie()))
    return [full(p) for p in S]


def die_crush():
    """Crushed (wave 1 verify: drawn poses, no rotated resample): he looks up and ducks, arms over
    his cap (anticipation); the impact squashes him; he lies flat as a ticket on his back (face,
    cap, vest and book still read), springs up once, flattens again with stars, blinks."""
    op = lambda h, b=-1: dict(hand=h, end=('hand', 'open'), bend=b)
    duck = fp((0, -15), (-6, -4), (5, -4), torso='back1', head='panic',
              armN=op((8, -10)), armF=op((-5, -11), 1))
    # the flat body lies 6 px further right than the other lie frames: the widening squash keeps
    # the cap peak inside the canvas
    flat = fp((-4, -3), (12, -3), (17, -3), 'lie', 'lie', head='hurt', **lie())
    stars = lambda a, b: [('star', a), ('star', b)]
    out = [full(duck),
           full(dict(duck, squash=(0.45, 1.25))),
           full(dict(flat, squash=(0.55, 1.15))),
           full(dict(flat, squash=(0.8, 1.05), fx=stars((-8, -14), (6, -16)))),
           full(dict(flat, squash=(0.5, 1.18), fx=stars((-4, -11), (9, -10)))),
           full(dict(flat, head='blink', squash=(0.55, 1.15), fx=stars((-1, -12), (11, -12))))]
    out[1].smear = True                       # the impact: one squashed in-between
    return out


# ------------------------------------------------------------------------------------ build
def install_fx():
    for k, v in M.FX.items():
        P.FX[k] = v
    M._hook()


def build(s):
    install_fx()
    s.strip('idle', idle(), 12, cls='idle')
    s.strip('walk', walk(), 4, cls='locomotion')
    s.strip('turn', turn(), 2, cls='turn')
    s.strip('alert', alert(), 30, cls='telegraph')
    s.strip('tell', tell(), [5, 4, 7, 9999], cls='telegraph')
    s.strip('throw', throw(), [3, 3, 3, 3, 4, 4], loop=False, cls='throw')
    s.strip('photo-pose', photo_pose(), [8, 6, 10, 10, 6, 8], cls='victory')
    s.strip('gloat', gloat(), [8, 8, 6, 6, 12, 58], loop=False, defer=True, cls='victory')
    s.strip('cower', cower(), 3, defer=True, cls='reaction')
    s.strip('die', die(), [4, 4, 5, 5, 4, 5, 4, 5, 6, 26], loop=False, cls='die')
    s.strip('die-knife', die_knife(), [3, 3, 4, 4, 4, 4, 5, 3, 6, 20], loop=False, cls='die')
    s.strip('die-blast', die_blast(), [4, 4, 4, 4, 4, 3, 5, 5, 5, 12], loop=False, cls='die-blast')
    # burn: a fast catch and hop, the soot statue and its blink held, a fast tip in two steps, the settle (42)
    s.strip('die-burn', die_burn(), [3, 4, 4, 10, 7, 5, 4, 5], loop=False, cls='die-burn')
    s.strip('die-crush', die_crush(), [6, 3, 10, 6, 6, 16], loop=False, cls='die-crush')
    s.event('THROW_RELEASE', 0)
    s.event('TELL_WINDUP', 3)
    for i, r in enumerate(GLOAT_ROLES):
        s.event('GLOAT_' + r, i)
