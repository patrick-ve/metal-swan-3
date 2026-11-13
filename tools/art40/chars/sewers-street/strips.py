# The strips of mission sewers' street crooks (docs/design/sewers.md §3): poses per frame and the holds
# in 60 Hz ticks. Every strip, anchor and logic time the game reads stays (content/sewers/street/
# dealer.ts, pimp.ts, bodyguard.ts, person.ts): the swoon `die` keeps its 56 ticks (person.ts waits
# for its end before the crawl), the tells keep their telegraph times (20, 24, 30), the pimp's
# `shoot` its 10 ticks a shot. Frame counts follow the plan's action classes. Drawn facing right
# (the game's unflipped sprite faces right).
import math

import art40 as X
import castkit as K
import ext_moves as M
import limbs as HK
import pose
import rig

P = K.P
A = K.A


# ------------------------------------------------------------------------------------ helpers
def hand(h, kind='fist', bend=-1, sh=(0, 0), z=None):
    return A.hand(h, kind, 'hand', bend=bend, sh=sh, z=z)


def pocket(h, bend=1, z=None):
    """An arm that ends in a pocket (no hand shows: the sleeve runs into the coat)."""
    a = dict(hand=h, bend=bend)
    if z is not None:
        a['z'] = z
    return a


def legs(pel, far, near, fs='flat', ns='flat', fb=1, nb=1, fhip=None, nhip=None):
    p = A.legs(pel, far, near, fs, ns, fb, nb)
    if fhip is not None:
        p['legF']['hip'] = fhip
    if nhip is not None:
        p['legN']['hip'] = nhip
    return p


def game_pts(j):
    nk = j.get('head.neck') or j.get('torso.neck') or j['pel']
    return {'hand': j.get('armN.wrist', j['pel']), 'head': (nk[0] + 1, nk[1] - 7)}


def fig(upper, lower, pts=None, smear=False):
    rows, root, j = X.humanoid(upper, lower)
    g = game_pts(j)
    if pts:
        g.update({k: (v(j) if callable(v) else v) for k, v in pts.items()})
    return X.Frame(rows, root, pts=g, joints=j, smear=smear)


def _turn(pt, piv, deg):
    a = math.radians(deg)
    dx, dy = pt[0] - piv[0], pt[1] - piv[1]
    return (piv[0] + dx * math.cos(a) + dy * math.sin(a), piv[1] - dx * math.sin(a) + dy * math.cos(a))


def seen_joints(p, j):
    """The joints where the player sees them: the 'rot' turn of the upper body about the pelvis."""
    j = dict(j)
    rot = p.get('rot', 0)
    if rot:
        piv = j['pel']
        j = {k: (v if k.startswith('leg') or k == 'pel' else _turn(v, piv, rot)) for k, v in j.items()}
    return j


def full(p, ground=True):
    """One-piece frame (the swoon, the crawl, the cower). ground: a figure that would sink under the
    feet anchor is lifted until its lowest row stands on the floor line (the feet anchor is the
    ground contact)."""
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
    return X.Frame(rows, root, pts=game_pts(j), joints=j)


def fp(pel, far, near, fs='flat', ns='flat', **kw):
    return M.fp(pel, far, near, fs, ns, **kw)


# ------------------------------------------------------------------------------------ cycles
SHOE_Y = {'heel': -3, 'toe': -5}


def walk_foot(k, n, step, lift=4.0):
    """One foot over an n-frame walk: planted for frames 0..n/2 (back `step` px a frame, heel strike
    to toe-off), swinging for the rest."""
    k %= n
    half = step * n / 4
    h = n // 2
    if k <= h:
        x = half - step * k
        shoe = 'heel' if k == 0 else 'toe' if k == h else 'flat'
        return (x, SHOE_Y.get(shoe, -4)), shoe
    t = (k - h) / h
    x = -half + 2 * half * (1 - math.cos(math.pi * t)) / 2
    y = -4 - lift * math.sin(math.pi * min(1.0, t * 1.1))
    shoe = 'back' if t < 0.3 else 'hang' if t < 0.75 else 'flat'
    return (x, y), shoe


def walk_lower(i, n, step, pel=-17, bob=(0, -0.5, -1, -1, -1, -0.5), lift=4.0, hipk=0.45):
    na, ns = walk_foot(i, n, step, lift)
    fa, fs = walk_foot(i + n // 2, n, step, lift)
    py = pel + 1 + bob[i % len(bob)]
    return legs((0, py), fa, na, fs, ns, fhip=(-1 + hipk * fa[0] / max(1.0, step), 0), nhip=(1 + hipk * na[0] / max(1.0, step), 0))


def run_foot(k, n, step):
    """A run with a flight phase: planted for n/3 frames + 1 (back `step` px a frame), then the swing."""
    k %= n
    st = n // 3
    half = step * st / 2
    if k <= st:
        x = half - step * k
        shoe = 'heel' if k == 0 else 'toe' if k == st else 'flat'
        return (x, SHOE_Y.get(shoe, -4)), shoe
    t = (k - st) / (n - st)
    x = -half + 2 * half * (1 - math.cos(math.pi * t)) / 2
    y = -4 - 6 * math.sin(math.pi * min(1.0, t * 1.15)) ** 0.9
    shoe = 'back' if t < 0.3 else 'hang' if t < 0.8 else 'flat'
    return (x, y), shoe


def run_lower(i, n, step, pel=-17):
    na, ns = run_foot(i, n, step)
    fa, fs = run_foot(i + n // 2, n, step)
    py = pel + [1, 1.5, 1, 0.5, -0.5, -1.5][i % 6]
    return legs((1, py), fa, na, fs, ns, fhip=(-1 + 0.3 * fa[0], 0), nhip=(1 + 0.3 * na[0], 0))


# the flee's holds: every third frame (the knee passing under the hip) a tick longer (28 ticks a cycle)
RUN_DUR = [2, 2, 3] * 4


# ------------------------------------------------------------------------------------ the build
class Build:
    """One character's strips with its own parameters (pelvis height, stance, arm poses)."""

    def __init__(self, kind, pel=-17, lost='', stand=((-4, -4), (4, -4))):
        self.kind = kind
        self.pel = pel
        self.lost = lost            # head prefix after the swoon: 'nc_' (hat, shades lost) or ''
        self.stand = stand

    def stance(self, dy=0, wide=0):
        f, n = self.stand
        return legs((0, self.pel + dy), (f[0] - wide, f[1]), (n[0] + wide, n[1]))


# ------------------------------------------------------------------------------------ common strips
def flee(b, upper, n=12, tpf=2, speed=2.4):
    """The flee (person.ts FLEE.speed 2.6 px/tick): a sprint with a flight phase, the planted foot back
    speed x tpf px a frame (drawn at 2.4: the smoothness gate's 3 px/tick for the knee; no foot gate
    without a contract speed). upper(i, ph, bob) gives the upper body."""
    step = speed * tpf
    out = []
    for i in range(n):
        lo = run_lower(i, n, step, b.pel)
        ph = 2 * math.pi * i / n
        bob = 1 if i % (n // 2) in (1, 2) else 0
        out.append(fig(upper(i, ph, bob), lo))
    return X.plant(out)


def walking(b, upper, n=12, tpf=2, speed=1.2, lift=4.0):
    step = speed * tpf
    out = []
    for i in range(n):
        lo = walk_lower(i, n, step, b.pel, lift=lift)
        ph = 2 * math.pi * i / n
        out.append(fig(upper(i, ph), lo))
    return X.plant(out)


def cower(b, far_kind='up', near_kind='up'):
    """SAY CHEESE's opposite: he crouches, both hands up over his head, panic; a shiver (4 frames)."""
    out = []
    p0 = b.pel + 6
    for k, (tx, hd, nh) in enumerate(((0, (0, 0), (3, -8)), (1, (0, 1), (4, -8)), (0, (1, 0), (3, -7)), (-1, (0, 1), (2, -8)))):
        p = fp((0, p0), (-6, -5), (5, -4), 'toe', 'flat', torso='lean2', head='panic', tor=(tx, 0), hd=(hd[0] + 1, hd[1] + 3),
               armN=hand((nh[0] - 2, nh[1] - 1), near_kind, bend=-1, sh=(1, -1)), armF=hand((2, -9), far_kind, bend=-1, sh=(0, -1)))
        out.append(full(p))
    return out


def lie(**kw):
    base = dict(rot=90, armN=dict(hand=(-6, -1), end=('hand', 'open'), bend=1),
                armF=dict(hand=(-5, 3), end=('hand', 'open'), bend=1))
    base.update(kw)
    return base


def swoon(b):
    """The comedy defeat (person.ts): a jolt, the back of the hand to the brow, the knees buckle, he
    swoons onto his back, bounces once and lies dazed (the hat or the sunglasses fly off as their own
    sprite at the jolt). 56 ticks: the crawl starts at its end."""
    S = []
    h = b.lost
    pl = b.pel
    op = lambda hh, bb=1: dict(hand=hh, end=('hand', 'open'), bend=bb)
    S.append(fp((0, pl), (-5, -4), (5, -4), torso='back', head=h + 'hurt', armN=op((8, 0), -1), armF=op((-6, -2))))
    S.append(fp((-1, pl), (-6, -4), (4, -5), 'flat', 'toe', rot=8, head=h + 'hurt', armN=op((7, -6), -1), armF=op((-7, -4))))
    S.append(fp((-2, pl + 1), (-6, -4), (5, -4), rot=14, head=h + 'dazed', armN=op((5, -8), -1), armF=op((-8, -3))))
    S.append(fp((-3, pl + 2), (-6, -4), (5, -4), rot=20, head=h + 'dazed', armN=op((4, -8), -1), armF=op((-8, -1))))
    S.append(fp((-4, pl + 4), (-7, -4), (4, -6), 'toe', 'hang', rot=34, head=h + 'dazed', armN=op((5, -6), -1), armF=op((-7, -3))))
    S.append(fp((-6, pl + 7), (-8, -4), (3, -9), 'toe', 'hang', rot=54, head=h + 'hurt', armN=op((4, -3), -1), armF=op((-6, -2))))
    S.append(fp((-8, pl + 11), (-4, -6), (6, -11), 'hang', 'heel', rot=74, head=h + 'hurt', armN=op((0, -1)), armF=op((-6, 0))))
    S.append(fp((-10, -3), (5, -5), (10, -6), 'lie', 'lie', head=h + 'hurt', **lie()))
    S.append(fp((-10, -5), (3, -9), (8, -11), 'heel', 'heel', rot=84, head=h + 'dazed', armN=op((-5, -5)), armF=op((-3, -5))))
    S.append(fp((-10, -3), (6, -3), (11, -3), 'lie', 'lie', head=h + 'blink', **lie()))
    return [full(p) for p in S]


SWOON_DUR = [3, 4, 4, 4, 5, 6, 4, 5, 6, 15]     # 56 ticks (the stand-in's 6 + 6 + 6 + 8 + 30)


def crawl(b):
    """After the swoon: on hands and knees, away (person.ts CRAWL 0.4 px/tick): the near hand and the
    far knee move together, the head low and dazed (7 frames x 5 ticks)."""
    out = []
    h = b.lost
    n = 7
    for i in range(n):
        ph = 2 * math.pi * i / n
        s = math.sin(ph)
        c = math.cos(ph)
        pel = (-5, -10 + 0.5 * abs(s))
        na = (-13 + 2.0 * s, -3 - max(0.0, 1.5 * c))
        fa = (-12 - 2.0 * s, -3 - max(0.0, -1.5 * c))
        p = fp(pel, fa, na, 'toe', 'toe', fb=1, nb=1, rot=-50, torso='lean1', head=h + ('dazed' if i % 3 else 'blink'),
               hd=(1, 1),
               armN=dict(hand=(9 + 2.5 * c, -1 + 1.5 * max(0.0, s)), end=('hand', 'open'), bend=-1),
               armF=dict(hand=(9 - 2.5 * c, 0 + 1.5 * max(0.0, -s)), end=('hand', 'open'), bend=-1))
        out.append(full(p))
    return out


# ------------------------------------------------------------------------------------ dealer
def dealer(s):
    """The dealer: hood (or beanie, cap) and coat, the hands in his pockets, the whisper lean; the
    tell (looks left, right, opens the coat: the lining full of mint tins, the knife), the jab, the
    flee; the gloat (a mint tin tossed and caught while he looks out for customers)."""
    b = Build('dealer')
    st = b.stance()
    pk = lambda dy=0: pocket((3, 8 + dy), bend=1)
    pf = lambda dy=0: pocket((4.5, 8 + dy), bend=1)

    def up(torso='lean1', head='sly', tor=(0, 0), hd=(0, 0), near=None, far=None, fx=None, items=None):
        return A.up(torso=torso, head=head, tor=tor, hd=hd, near=near or pk(), far=far or pf(), fx=fx, items=items)

    # idle (4): hunched, the hands in the pockets, breathing; a glance
    by = [0, 0, 1, 1]
    idle = []
    for k in range(4):
        idle.append(fig(up('in' if k in (1, 2) else 'lean1', 'sly' if k != 2 else 'fwd', tor=(0, by[k]), hd=(0, [0, 1, 1, 0][k] - by[k]),
                           near=pk(-by[k] * 0.5), far=pf(-by[k] * 0.5)), st))
    s.strip('idle', idle, [15, 15, 15, 15], cls='idle')

    # lurk (4): waiting in a doorway, looking away (the head turned back), the weight on one leg
    lk = []
    lst = legs((0, -17), (-3, -4), (5, -4), 'flat', 'flat')
    for k, hd_ in enumerate(('back_sly', 'back_sly', 'back_blink', 'back_fwd')):
        lk.append(fig(up('back1' if k % 2 == 0 else 'in', hd_, tor=(0, k % 2), hd=(-1, 0)), lst))
    s.strip('lurk', lk, [20, 20, 20, 20], cls='idle')

    # walk (12 x 2 at 1.2 px/tick: a 2.4 px step, the sidle): hunched, the hands stay in the pockets,
    # the shoulders roll
    def wu(i, ph):
        return up('lean1', 'sly', hd=(0, 1 if i % 6 == 1 else 0), near=pk(0.5 * math.sin(ph)), far=pf(-0.5 * math.sin(ph)))
    s.strip('walk', walking(b, wu, 12, 2, 1.2), 2, cls='locomotion')

    # run (the flee, 12 x 2 at 2.6): the arms flung up, RATTEN!!
    def ru(i, ph, bob):
        return A.up(torso='lean', head='panic' if i % 6 < 3 else 'shout', hd=(1, bob),
                    near=hand((3 + 3 * math.cos(ph), -9 + bob - 2 * math.sin(ph)), 'open', bend=-1, z=5.5),
                    far=hand((2 - 3 * math.cos(ph), -10 + bob + 2 * math.sin(ph)), 'open', bend=-1))
    s.strip('run', flee(b, ru), RUN_DUR, cls='locomotion')

    # tell (20 ticks): looks left (back), looks right, opens the coat (the tins), the knife comes out
    T = []
    T.append(fig(up('lean1', 'back_psst', hd=(-1, 0)), st))
    T.append(fig(up('lean1', 'psst', hd=(1, 0)), st))
    T.append(fig(up('open_back1', 'sly', near=hand((7, 2), 'grab', bend=-1, z=0.5), far=pf()), legs((0, -17), (-5, -4), (5, -4))))
    T.append(fig(up('open', 'psst', near=hand((7, 3), 'grab', bend=-1, z=0.5), far=pf()), legs((0, -17), (-5, -4), (5, -4))))
    T.append(fig(up('lean1', 'grit', near=hand((6, 6), 'knifeup', bend=-1), far=pf()), legs((0, -16.5), (-6, -4), (5, -4))))
    s.strip('tell', T, [4, 4, 4, 4, 4], loop=False, cls='telegraph')

    # jab (15 ticks; the knife box is live 6 ticks from the start): the lunge, full reach (belly
    # height, dealer.ts jabBox), the hold, the pull back, the settle
    J = []
    lunge = legs((2, -15.5), (-8, -4), (7, -4), 'toe', 'flat')
    J.append(fig(up('lean2', 'grit', near=hand((10, 5), 'knife', bend=-1), far=pf()), lunge))
    J.append(fig(up('lean3', 'grit', near=hand((13, 5), 'knife', bend=-1, sh=(1, 0)), far=pf()), legs((3, -15), (-9, -4), (8, -4), 'toe', 'flat')))
    J.append(fig(up('lean3', 'grit', near=hand((13, 5.5), 'knife', bend=-1, sh=(1, 0)), far=pf()), legs((3, -15), (-9, -4), (8, -4), 'toe', 'flat')))
    J.append(fig(up('lean1', 'sly', near=hand((8, 6), 'knife', bend=-1), far=pf()), legs((1, -16), (-7, -4), (6, -4))))
    J.append(fig(up('lean1', 'sly', near=hand((5, 7), 'knife', bend=-1), far=pf()), legs((0, -16.5), (-6, -4), (5, -4))))
    J.append(fig(up('lean1', 'sly', near=hand((4, 7), 'knifeup', bend=-1), far=pf()), st))
    J[1].smear = True
    s.strip('jab', J, [2, 2, 3, 3, 3, 2], loop=False, cls='melee')

    # gloat (6, 80 ticks): looks out for customers, tosses a mint tin up and catches it
    G = []
    G.append(fig(up('lean1', 'sly'), st))
    G.append(fig(up('lean1', 'back_sly', hd=(-1, 0)), st))
    G.append(fig(up('up', 'smug', near=hand((6, 4), 'tin', bend=-1)), st))
    G.append(fig(up('back1', 'smug', near=hand((6, 2), 'open', bend=-1), items=[('tin', (8, -36), 20)]), st))
    G.append(fig(up('up', 'smug', near=hand((6, 3), 'tin', bend=-1)), st))
    G.append(fig(up('lean1', 'sly', near=hand((5, 5), 'tin', bend=-1)), st))
    s.strip('gloat', G, [14, 14, 12, 14, 14, 12], cls='victory')

    common(s, b, photo=lambda: [
        fig(up('back1', k, near=hand(h, 'peace', bend=-1), far=pf()), st)
        for k, h in (('sly', (7, -2)), ('smug', (8, -5)), ('happy', (8, -6)), ('happy', (8, -6.5)), ('blink', (8, -6)), ('smug', (7.5, -5)))])


# ------------------------------------------------------------------------------------ pimp
def pimp(s):
    """The pimp: the loud suit and wide hat, gold chains and rings, the cane; he struts. The pistol tell
    (adjusts his hat, the cane under the arm, the gold pistol up), the shot, the whistle (two fingers
    in the mouth, then he waves the boys in), the flee; the gloat (counts his money)."""
    b = Build('pimp', lost='nc_')
    st = b.stance()
    cane = lambda h=(5, 9.5): hand(h, 'cane', bend=-1)
    hip = lambda: hand((-1, 7), 'ring', bend=1)

    def up(torso='back1', head='smug', tor=(0, 0), hd=(0, 0), near=None, far=None, fx=None, items=None):
        return A.up(torso=torso, head=head, tor=tor, hd=hd, near=near or cane(), far=far or hip(), fx=fx, items=items)

    by = [0, 0, 1, 1]
    s.strip('idle', [fig(up('in' if k in (1, 2) else 'back1', 'smug' if k != 2 else 'sly', tor=(0, by[k]),
                            hd=(0, [0, 1, 1, 0][k] - by[k]), near=cane((5, 9.5 - by[k] * 0.5))), st) for k in range(4)],
            [15, 15, 15, 15], cls='idle')

    # walk (12 x 3 at 1.0 px/tick: the strut, a 3 px step, a bounce; the cane swings out with the step)
    def wu(i, ph):
        return up('back1', 'sly', hd=(0, 1 if i % 6 == 1 else 0),
                  near=cane((5 + 3 * math.cos(ph - 0.5), 9 - 0.8 * abs(math.sin(ph - 0.5)))))
    s.strip('walk', walking(b, wu, 12, 3, 1.0, lift=5.0), 3, cls='locomotion')

    # run (the flee): one hand clamps the hat on, the cane flails in the other, WEG HIER!
    def ru(i, ph, bob):
        return A.up(torso='lean', head='panic' if i % 6 < 3 else 'shout', hd=(1, bob),
                    near=hand((2.5, -10 + bob), 'up', bend=-1, z=5.5),
                    far=hand((3 + 5 * math.cos(ph - 0.4), 6 - 2.5 * math.sin(ph - 0.4)), 'fist', bend=-1))
    s.strip('run', flee(b, ru), RUN_DUR, cls='locomotion')

    # tell (24): adjusts his hat, tucks the cane under the arm, reaches in the jacket, the pistol up
    T = []
    T.append(fig(up('back1', 'smug', near=hand((4, -9), 'fist', bend=-1, z=5.5)), st))
    T.append(fig(up('back1', 'sly', hd=(0, -1), near=hand((5, -9.5), 'fist', bend=-1, z=5.5)), st))
    T.append(fig(up('up', 'sly', near=hand((2, 2), 'canetuck', bend=1)), st))
    T.append(fig(up('up', 'grit', near=hand((4, 3), 'fist', bend=-1), far=hand((5, 3), 'canetuck', bend=-1)), legs((0, -17), (-5, -4), (5, -4))))
    T.append(fig(up('back1', 'grit', near=hand((9, 2), 'pistol', bend=-1), far=hand((4, 3), 'canetuck', bend=-1)), legs((0, -17), (-6, -4), (5, -4))))
    for f in T:
        f.pts['muzzle'] = f.joints.get('armN.muzzle', f.pts['hand'])
    s.strip('tell', T, [5, 5, 5, 5, 4], loop=False, cls='telegraph')

    # shoot (10 ticks a shot, restarted per shot): the flash, the recoil, the settle, the aim again
    S = []
    aim = legs((0, -17), (-6, -4), (5, -4))
    far = hand((4, 3), 'canetuck', bend=-1)
    S.append(fig(up('back1', 'grit', near=hand((9.5, 2), 'pistol', bend=-1), far=far,
                    fx=[('mflash', ('armN', 'muzzle', 1, 0))]), aim))
    S.append(fig(up('back', 'grit', near=hand((8.5, 0.5), 'pistol', bend=-1), far=far), aim))
    S.append(fig(up('back1', 'smug', near=hand((9, 1.5), 'pistol', bend=-1), far=far), aim))
    S.append(fig(up('back1', 'grit', near=hand((9.5, 2), 'pistol', bend=-1), far=far), aim))
    for f in S:
        f.pts['muzzle'] = f.joints['armN.muzzle']
    s.strip('shoot', S, [2, 2, 3, 3], cls='shoot', why='the code restarts the strip every 10 ticks (one shot): 4 frames fill the 10 ticks')

    # tell-whistle (30): two fingers to the lips, the cheeks fill, he leans back into the whistle
    W = []
    W.append(fig(up('up', 'sly', near=hand((5, -2), 'twofing', bend=-1, z=5.5)), st))
    W.append(fig(up('up', 'whistle', near=hand((5, -4.5), 'twofing', bend=-1, z=5.5)), st))
    W.append(fig(up('back1', 'whistle', near=hand((5, -5), 'twofing', bend=-1, z=5.5)), st))
    W.append(fig(up('back', 'whistle', near=hand((4.5, -5.5), 'twofing', bend=-1, z=5.5), fx=[('note', (12, -38))]), st))
    s.strip('tell-whistle', W, [8, 8, 7, 7], loop=False, cls='telegraph')

    # whistle (the call, held 16 ticks): JONGENS!, the arm waves the boys in
    C = []
    for k in range(4):
        C.append(fig(up('back1', 'shout', hd=(0, k % 2), near=hand((3 + k % 2 * 2, -11 + k % 2), 'wave', bend=-1, z=5.5)), st))
    s.strip('whistle', C, [4, 4, 4, 4], cls='victory', why='the call the code holds 16 ticks: a 4-frame wave loop')

    # gloat (40): counts his money, licks the thumb, a smug look
    G = []
    nf = hand((6, 4), 'money', bend=-1)
    G.append(fig(up('up', 'down', near=nf, far=hand((7, 5), 'fist', bend=-1)), st))
    G.append(fig(up('up', 'down', near=nf, far=hand((8, 3), 'fist', bend=-1)), st))
    G.append(fig(up('up', 'down', near=nf, far=hand((7, 5), 'fist', bend=-1)), st))
    G.append(fig(up('up', 'sly', near=hand((6, 3), 'money', bend=-1), far=hand((4, -5), 'fist', bend=-1)), st))
    G.append(fig(up('back1', 'smug', near=hand((7, 1), 'money', bend=-1), far=hip()), st))
    G.append(fig(up('back1', 'smug', near=hand((7, 0), 'money', bend=-1), far=hip()), st))
    s.strip('gloat', G, [7, 7, 6, 7, 7, 6], cls='victory')

    common(s, b, photo=lambda: [
        fig(up('back1', k, near=hand(h, 'thumb', bend=-1)), st)
        for k, h in (('smug', (7, 2)), ('smug', (8, -1)), ('happy', (8, -2)), ('happy', (8, -2.5)), ('blink', (8, -2)), ('smug', (7.5, -1)))])


# ------------------------------------------------------------------------------------ bodyguard
def bodyguard(s):
    """The bodyguard: big, the black suit, sunglasses, the earpiece; he walks, never runs (unless the
    rats come). The tell (cracks his knuckles, plants his feet), the shoulder charge, the stun, the
    gloat (a word into his earpiece)."""
    pose.THIGH, pose.SHIN = 8.0, 7.5
    pose.UPPER, pose.FORE = 6.0, 5.5
    HK.install_limbs(1.3, 1.3)
    b = Build('bodyguard', pel=-19, lost='nc_', stand=((-5, -4), (5, -4)))
    st = b.stance()
    clasp_n = lambda dy=0: hand((4, 10 + dy), 'fist', bend=1)
    clasp_f = lambda dy=0: hand((7, 9 + dy), 'fist', bend=1)

    def up(torso='up', head='fwd', tor=(0, 0), hd=(0, 0), near=None, far=None, fx=None, items=None):
        return A.up(torso=torso, head=head, tor=tor, hd=hd, near=near or clasp_n(), far=far or clasp_f(), fx=fx, items=items)

    by = [0, 0, 1, 1]
    s.strip('idle', [fig(up('in' if k in (1, 2) else 'up', 'fwd', tor=(0, by[k]), hd=(0, [0, 1, 1, 0][k] - by[k]),
                            near=clasp_n(-by[k] * 0.5), far=clasp_f(-by[k] * 0.5)), st) for k in range(4)],
            [15, 15, 15, 15], cls='idle')

    # walk (12 x 3 at 0.9 px/tick: a 2.7 px step): heavy, the arms swing a little, the shoulders roll
    def wu(i, ph):
        sx = -3.0 * math.cos(ph - 0.5) + 1
        return up('lean1', 'fwd', hd=(0, 1 if i % 6 == 1 else 0), tor=(0, 1 if i % 6 in (1, 2) else 0),
                  near=hand((sx, 11 - 0.05 * sx * sx), 'fist'), far=hand((2 - sx * 0.8, 11 - 0.05 * sx * sx), 'fist'))
    s.strip('walk', walking(b, wu, 12, 3, 0.9, lift=4.0), 3, cls='locomotion')

    # run (the flee): BAAS, RENNEN! the big arms pump
    def ru(i, ph, bob):
        return A.up(torso='lean', head='panic' if i % 6 < 3 else 'shout', hd=(1, bob),
                    near=hand((4 + 5 * math.cos(ph), 6 - 3 * math.sin(ph)), 'fist', bend=-1),
                    far=hand((4 - 5 * math.cos(ph), 6 + 3 * math.sin(ph)), 'fist', bend=-1))
    s.strip('run', flee(b, ru), RUN_DUR, cls='locomotion')

    # tell (24): cracks his knuckles (twice), rolls the neck, plants his feet, the shoulder drops
    T = []
    T.append(fig(up('up', 'fwd', near=hand((7, 4), 'fist', bend=-1), far=hand((8, 4), 'open', bend=-1)), st))
    T.append(fig(up('in', 'grit', near=hand((8, 3), 'fist', bend=-1), far=hand((9, 3.5), 'open', bend=-1), fx=[('crack', (12, -32))]), st))
    T.append(fig(up('up', 'fwd', hd=(1, 0), near=hand((7, 4), 'open', bend=-1), far=hand((8, 4), 'fist', bend=-1)), st))
    T.append(fig(up('in', 'grit', hd=(-1, 0), near=hand((8, 3.5), 'open', bend=-1), far=hand((9, 3), 'fist', bend=-1), fx=[('crack', (12, -32))]), st))
    T.append(fig(up('lean1', 'grit', near=hand((6, 6), 'fist', bend=-1), far=hand((2, 8), 'fist', bend=1)),
                 legs((0, -17.5), (-8, -4), (7, -4))))
    T.append(fig(up('lean2', 'grit', tor=(0, 1), near=hand((5, 6), 'fist', bend=-1), far=hand((0, 9), 'fist', bend=1)),
                 legs((0, -17), (-9, -4), (8, -4))))
    s.strip('tell', T, [4, 4, 4, 4, 4, 4], loop=False, cls='telegraph')

    # charge (2.4 px/tick, 8 x 2 ticks: a 4.8 px step): the shoulder down, head down, the arms tucked
    def cu(i, ph, bob):
        return A.up(torso='lean3', head='grit', hd=(2, 1 + bob), tor=(1, bob),
                    near=hand((5, 5), 'fist', bend=-1), far=hand((1 - 2 * math.cos(ph), 9), 'fist', bend=1))
    s.strip('charge', flee(b, cu, 8, 2, 2.4), 2, cls='locomotion', why='a loop the charge plays 30 ticks: 8 frames x 2 ticks, a 4.8 px step')

    # stun (40 ticks, a loop): knocked back from the wall, he sways, the arms loose (the game draws
    # the dizzy stars)
    Z = []
    for k in range(4):
        sw = [-1, 0, 1, 0][k]
        Z.append(fig(up('back' if sw < 0 else 'back1' if sw == 0 else 'up', 'dazed', hd=(sw, 1), tor=(sw, 0),
                        near=hand((1 + sw, 11), 'open', bend=1), far=hand((0 - sw, 11), 'open', bend=1)),
                     legs((sw * 0.5, -18.5), (-6, -4), (6, -4))))
    s.strip('stun', Z, [5, 5, 5, 5], cls='reaction')

    # gloat (40): a finger to the earpiece, a word, a nod
    G = []
    for k, (hd_, dy) in enumerate((('fwd', 0), ('shout', 0), ('fwd', 1), ('smug', 0), ('shout', 0), ('smug', 1))):
        G.append(fig(up('up', hd_, hd=(0, dy), near=hand((-1.5, -6), 'ear', bend=-1, z=5.5), far=clasp_f()), st))
    s.strip('gloat', G, [8, 6, 8, 6, 6, 6], cls='victory')

    common(s, b, photo=lambda: [
        fig(up('back1', k, near=hand(h, 'fist', bend=-1, z=5.5), far=clasp_f()), st)
        for k, h in (('fwd', (5, -2)), ('smug', (6, -7)), ('smug', (6, -8)), ('happy', (6, -8.5)), ('smug', (6, -8)), ('fwd', (6, -7)))])


# ------------------------------------------------------------------------------------ shared tail
def common(s, b, photo):
    s.strip('cower', cower(b), [4, 4, 4, 4], defer=True, cls='reaction')
    s.strip('photo-pose', photo(), [8, 6, 10, 10, 6, 8], cls='victory')
    s.strip('die', swoon(b), SWOON_DUR, loop=False, cls='die')
    s.strip('crawl', crawl(b), [5] * 7, cls='crouch-walk')


def install_fx():
    for k, v in M.FX.items():
        P.FX[k] = v
    M._hook()
    # the gold pistol's muzzle flash
    P.FX['mflash'] = (['..W..', '.WFf.', 'WFFfc', '.Wfc.', '..c..'], (0, 2))
    # a whistle note (two short lines)
    P.FX['note'] = (['W..W', '.W.W', '..W.'], (1, 1))
    # the knuckle crack (a small star)
    P.FX['crack'] = (['.y.', 'yWy', '.y.'], (1, 1))
    # a mint tin in the air (the gloat): silver with the mint label
    P.ITEMS['tin'] = (['GMG', 'gmg'], {'c': (1, 1)})
    P.HANDS['tin'] = (['.GM', 'JgS', 'JSs', '.s.'], {'wrist': (0, 2)})
    P.FISTS['tin'] = P.HANDS['tin']


def build(s, kind):
    install_fx()
    {'dealer': dealer, 'pimp': pimp, 'bodyguard': bodyguard}[kind](s)
