# THE PASSENGER of the fatbike pairs: the second youth, sitting on the speaker box on the rear rack
# with his feet on the rear axle pegs, one hand on the rider's side. He is a youth of another look
# (pair look L carries look (L + 2) % 4, the game's youthSet rule) drawn in his OWN letters (the
# person letters translated by PMAP: skin, hair, hoodie, trackpants), so one pair palette holds
# both youths and the skins swap both by palette (rule 6).
#
# He has his own secondary motion on every bike strip: he rocks a beat behind the rider, clings in
# the wheelie (thrown back, then whipped forward), cheers the kick, dances in the gag, pumps his
# fist on the gloat's thump, photobombs the photo and hides behind the rider in the cower. The
# kit's ride.frame() calls draw() through its PASSENGER hook; the rider's joints come from a spy
# on ridekit.rider (the hook gets the bike points only).
import math

import art40 as X

from . import looks

base = looks.base
BP = looks.BP
P = looks.P
RK = base.ridekit
RD = base.ride
S = base.strips
pose = RK.pose
X1 = RK.X1
A = S.A

# The person letters of a youth -> the passenger's letters (shared: the outline K, the brows Q,
# the eye white w, the sneaker whites X x v and the drawstrings T, the black cap and the bike).
PMAP = {'L': 'E', 'S': 'C', 's': 'U', 'z': 'Z', 'H': 'V', 'h': 'Y',
        'J': 'R', 'j': 'k', 'q': 'l', 'r': 'm', 'a': '3', 'b': '4', 'B': '5'}
PT = str.maketrans(PMAP)
DARK_P = {PMAP[k]: PMAP.get(v, v) for k, v in BP.DARK.items() if k in PMAP}
LETTERS_P = ''.join(PMAP.values())


def tr(rows, t):
    return [r.translate(t) for r in rows]


def pass_pal(look, skin):
    """The passenger's colours (his letters) for his look and skin."""
    col = looks.look_colours(look, skin)
    return {PMAP[k]: col[k] for k in PMAP}


# ------------------------------------------------------------------------------------ parts
RAMPS = {'arm': ['J', 'j', 'q', 'r'], 'armF': ['j', 'q', 'r', 'r'], 'leg': ['a', 'b', 'B', 'B'], 'legF': ['b', 'B', 'B', 'o']}
LEANS = (('back2', -3), ('back', -2), ('back1', -1), ('lean1', 1), ('lean', 2), ('lean2', 3), ('lean3', 4))
MODE = {'all': False}       # True: the standard part names are the passenger's (his flee)


def ribs(part, u, v, k, ch):
    """The ribbed hoodie cuff (look 0's hook) in the passenger's letters on his arms."""
    if part.startswith('p:'):
        r = BP.ribs(part[2:], u, v, k, ch)
        return r.translate(PT) if r != ch else ch
    r = BP.ribs(part, u, v, k, ch)
    return r.translate(PT) if MODE['all'] and r != ch else r


def install_parts(look, t=None, pre='', rp=''):
    """Heads, torsos, hands and limb ramps of a look under the names pre + name (ramps rp + name),
    with the letters translated by t (None: the rider's own)."""
    t = t or str.maketrans({})
    nk = {'neck': (5, 12)}
    for name, rows in looks.head_table(look).items():
        P.HEADS[pre + name] = (tr(rows, t), nk)
    up = (tr(BP.TORSO, t), BP.TAN)
    P.TORSOS[pre + 'up'] = up
    P.TORSOS[pre + 'in'] = (tr(BP.TORSO_IN, t), BP.TAN_IN)
    for name, k in LEANS:
        P.TORSOS[pre + name] = P.shear(up, k)
    for k, (rows, an) in BP.HANDS.items():
        P.HANDS[pre + k] = (tr(rows, t), an)
        P.FISTS[pre + k] = (tr(rows, t), an)
    for k, ramp in RAMPS.items():
        pose.RAMP[rp + k] = [c.translate(t) for c in ramp]
        pose.CUT[rp + k] = pose.CUT[k]
    pose.HOOKS['pat'] = ribs


# ------------------------------------------------------------------------------------ the rider's joints
LAST = {}
_rider = RK.rider


def rider_spy(*a, **kw):
    j = _rider(*a, **kw)
    if not kw.get('key'):
        LAST.clear()
        LAST.update(j)
    return j


# ------------------------------------------------------------------------------------ one passenger
def figure(cv, b, pel, torso='lean1', head='fwd', hd=(0, 0), tor=(0, 0), armN=None, armF=None, legN=None, legF=None):
    """Draw the passenger: pel (canvas), part names without the 'p:' prefix; arms = (target, hand
    kind, bend[, z offset]) with a target ('sh', dx, dy) relative to his shoulder or ('r', dx, dy)
    relative to the rider's pelvis or absolute; legs = (ankle canvas, shoe, bend). Returns his
    joints ('p.' names)."""
    j = {'p.pel': pel}
    for k, zz, ramp, hx in (('legF', 1.5, 'plegF', -1), ('legN', 3.9, 'pleg', 1)):
        L = legN if k == 'legN' else legF
        if L:
            ank, shoe, bend = L
            hip = (pel[0] + hx, pel[1])
            knee, end = pose.leg(cv, X1, hip, ank, bend, ramp, zz, 'p:' + k, shoe)
            j.update({f'p.{k}.hip': hip, f'p.{k}.knee': knee, f'p.{k}.ankle': end})
    an = pose.place(cv, X1, P.TORSOS['p:' + torso], 'pelvis', (pel[0] + tor[0], pel[1] + tor[1]), 4.6, 'p:torso')
    j['p.torso.neck'] = an['neck']
    ha = pose.place(cv, X1, pose.head_part(X1, 'p:' + head), 'neck', (an['neck'][0] + hd[0], an['neck'][1] + hd[1]), 4.8, 'p:head')
    j['p.head.neck'] = ha['neck']
    rp = LAST.get('pel', pel)
    for k, zz, ramp, sh in (('armF', 1.4, 'parmF', an['shF']), ('armN', 6.5, 'parm', an['shN'])):
        a = armN if k == 'armN' else armF
        if not a:
            continue
        tgt, kind, bend = a[:3]
        zo = a[3] if len(a) > 3 else 0
        end = ('hand', 'p:' + kind)
        if isinstance(tgt[0], str):
            ref = sh if tgt[0] == 'sh' else rp
            wt = (ref[0] + tgt[1], ref[1] + tgt[2])
        else:
            wt = RK.to_grip(tgt, end) if kind == 'grip' else tgt
        info = pose.arm(cv, X1, sh, wt, bend, ramp, zz + zo, 'p:' + k, end)
        j[f'p.{k}.elbow'] = info['elbow']
        j[f'p.{k}.wrist'] = info['wrist']
    return j


# His seat: on top of the speaker box (bike-local; the box top is y 23.5), his feet on the pegs
# at the rear axle.
SEAT = (-17.5, 25.0)
PEG_N = (-11.5, 13.0)
PEG_F = (-12.5, 13.0)
HOLD = ('r', -3.0, -5.0)          # the near hand on the rider's side
HOLD_F = ('r', -5.0, -3.0)        # the far hand behind the rider (mostly hidden)


def at(b, xy, d=(0, 0)):
    p = b['T'](*xy)
    return (p[0] + d[0], p[1] + d[1])


def sit(b, k, strip, pel=(0, 0), torso='lean1', head='smug', hd=(0, 0), tor=(0, 0), near=None, far=None,
        feet=((0, 0), (0, 0)), shoes=('toe', 'toe')):
    return dict(pel=at(b, SEAT, pel), torso=torso, head=head, hd=hd, tor=tor,
                armN=near or (HOLD, 'grip', -1), armF=far or (HOLD_F, 'grip', -1),
                legN=(at(b, PEG_N, feet[0]), shoes[0], 1), legF=(at(b, PEG_F, feet[1]), shoes[1], 1))


def choreo(b, k, strip):
    """His pose for frame k of a bike strip."""
    if strip == 'ride':
        # pedalling under him: he rocks with the rider's down-strokes a beat late (two a turn), his
        # head nods a frame later still, the dangling feet swing on the pegs
        t0 = S.starts(S.RIDE_TICKS)[k]
        bob = 0.5 + 0.5 * math.cos(4 * math.pi * (t0 - 3) / 20.0)
        nod = 0.5 + 0.5 * math.cos(4 * math.pi * (t0 - 5) / 20.0)
        return sit(b, k, strip, pel=(0, round(-0.6 * bob)), torso='lean1' if bob > 0.5 else 'up',
                   head='groove' if k in (4, 5, 10, 11) else 'smug', hd=(1 if nod > 0.5 else 0, round(0.8 * nod)))
    if strip == 'idle':
        # breathing out of step with the rider, a blink of his own
        return sit(b, k, strip, torso='in' if k in (2, 3) else 'up', head='blink' if k == 1 else 'smug',
                   tor=(0, -1 if k in (2, 3) else 0), hd=(0, -1 if k == 3 else 0))
    if strip == 'turn':
        return sit(b, k, strip, torso='lean', head='fwd', hd=(-k, 0))
    if strip == 'alert':
        # he leans out over the rider's shoulder and points too
        return sit(b, k, strip, torso='back1', head='shout', hd=(0, -1), tor=(0, -1),
                   near=(('sh', 9, -5), 'point', -1))
    if strip == 'tell':
        # the wheelie: jolted as the rider drops onto the bar, thrown back as the front rises,
        # clutching the rider at the top (feet off the pegs), whipped forward by the overshoot, then
        # joining the shout
        seq = [dict(torso='lean1', head='fwd', hd=(1, 1), pel=(0, 0.5)),
               dict(torso='back1', head='panic', hd=(-1, 0), pel=(-0.5, -0.5)),
               dict(torso='back2', head='panic', hd=(-2, -1), pel=(-1.5, -1), feet=((2, 2), (1, 2)), shoes=('hang', 'hang')),
               dict(torso='back2', head='wail', hd=(-3, -1), pel=(-2, -1), feet=((3, 1), (2, 1)), shoes=('hang', 'hang')),
               dict(torso='back1', head='wail', hd=(-1, 0), pel=(-1.5, 0), feet=((1, 0), (0, 0))),
               dict(torso='back1', head='shout', hd=(-2, -1), pel=(-1.5, -0.5))][k]
        hug = ('r', -2.0, -4.0) if k in (2, 3, 4) else HOLD
        return sit(b, k, strip, near=(hug, 'grip', -1), **seq)
    if strip == 'kick':
        # the rider kicks: he leans back out of the way, then cheers the hit with his fist up
        fist = [(7.5, -1.0), (6.5, -3.5), (5.0, -8.0), (4.5, -10.0), (4.5, -9.0), (5.0, -8.0)][k]
        seq = [dict(torso='back1', head='grit', hd=(-1, 0)),
               dict(torso='back1', head='shout', hd=(-1, 0)),
               dict(torso='back', head='shout', hd=(-1, -1)),
               dict(torso='back', head='happy', hd=(-1, -1)),
               dict(torso='back1', head='happy', hd=(0, -1)),
               dict(torso='back1', head='smug', hd=(0, 0))][k]
        seq['near'] = (('sh',) + fist, 'fist', 1)
        return sit(b, k, strip, **seq)
    if strip == 'gag':
        # dancing to the speaker under him: his arms go up on the off-beat (call and response with
        # the rider's head bob), his head nods
        # (one beat = 4 frames: the hand on the rider, rising, up on the off-beat, coming down)
        near = [(8.0, 2.5), (7.0, -3.0), (4.5, -9.0), (7.0, -3.0)][k % 4]
        up = k % 4 == 2
        return sit(b, k, strip, torso='up' if k % 4 in (1, 2, 3) else 'lean1', head='happy' if up else 'groove',
                   hd=(0, 0 if k % 4 in (1, 2, 3) else 1), near=(('sh',) + near, 'open' if k % 4 else 'grip', 1))
    if strip == 'gloat':
        # the wheelie rock: his fist pumps on the thump (a frame behind the rock), his head nods
        fist = [(4, -9), (5, -11), (5, -10), (6, -6), (6, -5), (5, -7)][k]
        return sit(b, k, strip, torso='back2' if k < 3 else 'back', head='happy' if k in (1, 2) else 'groove',
                   pel=(-1.5, -0.5), hd=(-2, 1 if k in (3, 4) else 0), near=(('sh',) + fist, 'fist', 1))
    if strip == 'photo-pose':
        # the photobomb: he leans out behind the rider with a peace sign; the flash makes him blink
        hands = [None, (6, -4), (7, -8), (7, -8), (7, -7.5), (5, -3)][k]
        heads = ['smug', 'happy', 'happy', 'blink', 'happy', 'smug'][k]
        return sit(b, k, strip, torso='back1' if 1 <= k <= 4 else 'up', head=heads, tor=(0, -1 if 1 <= k <= 4 else 0),
                   hd=(0, -1 if k in (2, 3, 4) else 0), near=(('sh',) + hands, 'peace', -1) if hands else None)
    if strip == 'cower':
        # he hides behind the rider's back, hands over his head, shaking out of step with him
        s = (k + 1) % 2
        return sit(b, k, strip, torso='lean3', head='panic', hd=(2, 3 + s), pel=(0, 0.5),
                   near=(('sh', 4, -6 + s), 'up', -1), far=(('sh', 2, -7 + s), 'up', -1))
    raise KeyError(strip)


def draw(cv, b, k, strip, z):
    p = choreo(b, k, strip)
    j = figure(cv, b, **p)
    LAST.clear()
    return j


def install_hook():
    RK.rider = rider_spy
    RD.PASSENGER['draw'] = draw


# ------------------------------------------------------------------------------------ his flee
# He jumps off and runs for it at FATBIKE.flee * 1.1 = 2.2 px/tick (the game's tumble fx): the
# solo flee's 12 frames x 2 ticks with a 4.4 px step a frame, so the planted foot stays put.
FLEE_STEP = 4.4


def flee_foot(k):
    k %= S.FLEE_N
    st = FLEE_STEP
    if k <= 4:
        x = 2 * st - st * k
        shoe = 'heel' if k == 0 else 'toe' if k == 4 else 'flat'
        return (x, -3 if shoe == 'heel' else -4.6 if shoe == 'toe' else -4), shoe
    t = (k - 4) / 8.0
    x = -2 * st + 4 * st * (1 - math.cos(math.pi * t)) / 2
    y = -4 - 7.5 * math.sin(math.pi * min(1.0, t * 1.1)) ** 0.9
    shoe = 'back' if t < 0.35 else 'hang' if t < 0.8 else 'flat'
    return (x, y), shoe


def flee():
    """The passenger's flee (the standard part names must be his: install_parts(look, PT))."""
    out = []
    pel_y = [-15, -15.5, -15, -15.5, -16, -16.5]        # a lower, scared run: the longer stride stays in reach
    for i in range(S.FLEE_N):
        na, ns = flee_foot(i)
        fa, fs = flee_foot(i + 6)
        lower = A.legs((1, pel_y[i % 6]), fa, na, fs, ns)
        lower['legF']['hip'] = (-1 + 0.3 * fa[0], 0)
        lower['legN']['hip'] = (1 + 0.3 * na[0], 0)
        ph = 2 * math.pi * i / S.FLEE_N
        # both arms flung up, flapping a beat behind the legs; he looks back over his shoulder
        nh = (8.0 + 1.2 * math.cos(ph - 0.9), -4.5 + 2.2 * math.sin(ph - 0.9))
        fh = (-6.0 - 1.2 * math.cos(ph - 0.9), -7 - 2.0 * math.sin(ph - 0.9))
        up = A.up(torso='lean2', head='nc_panic' if (i // 3) % 2 == 0 else 'nc_wail', hd=(1, 1 if i % 6 in (2, 3) else 0),
                  near=S.hand(nh, 'up', -1), far=S.hand(fh, 'up', -1))
        out.append(S.fig(up, lower))
    return X.plant(out)
