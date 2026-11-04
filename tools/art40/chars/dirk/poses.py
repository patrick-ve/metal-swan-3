# DIRK's polished poses (wave 2, stage 2): the plunger melee rebuilt with the reference's attack
# craft (anticipation, the cocked spring, two smears, the impact, the rebound, the settle), the
# heavy and crouched versions of it, the stuck thrust that pops off, the tool pouch that swings
# on the run, and the poses where his dark polo sleeve crossed his face (the salute, the seated
# mount). Everything else is the approved squad spike's DIRK (tools/art40/kit/heroes/dirk*.py).
#
# install() runs once per process after hero.load('dirk') and before the strips are built: it
# replaces entries of the kit's shared tables (anims.UPPER / FULL, the hero moves), the way the
# kit's own hero modules do.
import math

import anims as A
import ext_heavy as EH
import ext_ride_helium as HE
from anims import up, gun, hand

from . import parts as DP

LOW = gun((5, 8), 'low')
BACK = gun((6.5, 6.5), 'low')      # the pistol coming back up to the ready pose
READY = lambda: up(torso='up', head='fwd', near=gun((8, 5)), far=hand((9, 5)))
SW = (1, -24)            # the swing arcs' centre (over the far shoulder, root-relative as in the kit)


def PL(h, kind, z=6.5, bend=-1, sh=(0, 0)):
    """The far hand with a plunger part (lit like the near arm when it is in front: z >= 4)."""
    return hand(h, kind, 'hand', z=z, bend=bend, sh=sh)


# ------------------------------------------------------------------------------------ the smack
# The overhead smack (knife, 14 ticks; the hit is applied when the button goes down, so the
# contact reads by tick 5). Each entry: (pose, ticks, tag); tag 'smear' marks a drawn smear.
def slash_set():
    S = []
    # 0 anticipation: the shoulders drop back, the plunger comes up behind the head
    S.append((up(torso='back', head='shout', tor=(-1, 1), near=LOW, far=PL((-2, -6), 'pl_back', z=1, bend=1)), 1, None))
    # 1 cocked: the cup low behind the back, the chest open, the eyes on the target
    S.append((up(torso='back', head='shout', tor=(-1, 1), hd=(-1, 0), near=LOW, far=PL((-2.5, -5), 'pl_cock', z=1, bend=1)), 3, None))
    # 2 smear: over the top (the cup over the back of the crown, the handle down to the fist
    # behind the head, the full arc; further forward the cup floated alone over the head)
    S.append((up(torso='up', head='shout', near=LOW, far=PL((-3, -10), 'pl_sm1', z=1, bend=1),
                 fx=[('pswingA', SW)]), 1, 'smear'))
    # 3 smear: down the front
    S.append((up(torso='lean2', head='shout', near=LOW, far=PL((10, 1.5), 'pl_sm2', bend=1),
                 fx=[('pswing2', SW)]), 1, 'smear'))
    # 4 impact: the cup flat on the target, the body dips, the star
    S.append((up(torso='lean2', head='shout', tor=(1, 1), near=LOW, far=PL((9, 4), 'pl_ddn'),
                 fx=[('pswing3', SW), ('plop0', ('armF', 'tip', 0, 1))]), 2, None))
    # 5 rebound: the rubber springs the plunger back up, the shoulders follow
    S.append((up(torso='lean', head='fwd', tor=(1, 0), near=LOW, far=PL((9, 1), 'pl_reb'),
                 fx=[('plop1', ('armF', 'tip', 1, 2))]), 2, None))
    # 6 follow-through: a small settle down, the last sparkles
    S.append((up(torso='lean', head='fwd', near=BACK, far=PL((8, 4), 'pl_ddn'),
                 fx=[('plop2', ('armF', 'tip', 0, 1))]), 2, None))
    # 7 the plunger back under the arm, both hands on the pistol (the ready pose)
    S.append((READY(), 2, None))
    return S


def heavy_slash_src():
    """With the heavy gun hanging at the hip the smack lands forward at chest height (a smack down
    would hit the heavy barrel)."""
    S = slash_set()
    S[3] = (up(torso='lean2', head='shout', near=LOW, far=PL((10, 1), 'pl_sm2', bend=1), fx=[('pswing2', SW)]), 1, 'smear')
    S[4] = (up(torso='lean2', head='shout', tor=(1, 1), near=LOW, far=PL((10, -0.5), 'pl_fwd', bend=1),
               fx=[('pswing3', SW), ('plop0', ('armF', 'tip', 0, 0))]), 2, None)
    S[5] = (up(torso='lean', head='fwd', tor=(1, 0), near=LOW, far=PL((9, -1.5), 'pl_reb'),
               fx=[('plop1', ('armF', 'tip', 1, 1))]), 2, None)
    S[6] = (up(torso='lean', head='fwd', near=BACK, far=PL((9, 0.5), 'pl_fwd'), fx=[('plop2', ('armF', 'tip', 0, 0))]), 2, None)
    return S


# ------------------------------------------------------------------------------------ the thrust
# knife-b (14 ticks): the pull-back, the lunge (smear), the cup sticks (squash), the pull that
# stretches the rubber, the pop (the cup comes off, the arm snaps back), the recoil, the guard.
def stab_set(heavy=False):
    hy = -1.5 if heavy else 0
    S = []
    # 0 the pull-back: the cup at the hip, the shoulders back
    S.append((up(torso='back', head='fwd', near=LOW, far=PL((2, 3.5 + hy), 'pl_fwd')), 2, None))
    # 1 the lunge (smear): the long handle, the speed lines
    S.append((up(torso='lean', head='shout', near=LOW, far=PL((6, 2 + hy), 'pl_lunge'),
                 fx=[('lunge', ('armF', 'tip', 0, 0))]), 2, 'smear'))
    # 2 the cup sticks: squashed flat on the target, the body leans in
    S.append((up(torso='lean2', head='shout', tor=(1, 0), near=LOW, far=PL((10, 0.5 + hy), 'pl_sq'),
                 fx=[('plop0', ('armF', 'tip', 1, 0))]), 2, None))
    # 3 the pull: the rubber stretches, the cup holds
    S.append((up(torso='lean', head='shout', near=LOW, far=PL((8.5, 0.5 + hy), 'pl_pull'),
                 fx=[('plop1', ('armF', 'tip', 1, 0))]), 2, None))
    # 4 the pop: the cup comes off, the arm snaps back
    S.append((up(torso='up', head='fwd', near=LOW, far=PL((5.5, 1.5 + hy), 'pl_fwd'),
                 fx=[('pop0', ('armF', 'tip', 3, 0))]), 2, None))
    # 5 the recoil: the shoulders rock back, the ring opens
    S.append((up(torso='back', head='fwd', near=LOW, far=PL((4, 3 + hy), 'pl_fwd'),
                 fx=[('pop1', ('armF', 'tip', 5, 0))]), 1, None))
    # 6 the settle, 7 the guard
    S.append((up(torso='up', head='fwd', near=BACK, far=PL((6, 4 + hy * 0.5), 'pl_ddn')), 2, None))
    S.append((READY(), 1, None))
    if heavy:
        # the far hand goes on to the heavy gun's front grip (its shoulder rolls forward, as in
        # the heavy ready pose): the recoil and the settle carry it half way each
        S[5] = (up(torso='back', head='fwd', near=LOW, far=PL((6, 2.5 + hy), 'pl_fwd', sh=(1.5, 0.5)),
                   fx=[('pop1', ('armF', 'tip', 5, 0))]), 2, None)
        S[6] = (up(torso='up', head='fwd', near=BACK, far=PL((8, 3.5 + hy * 0.5), 'pl_ddn', sh=(4, 1))), 1, None)
    return S


# ------------------------------------------------------------------------------------ run pouch
# The pouch lags the body: it swings back while he pushes off, bounces up at the top of the
# flight and comes forward against the hip on the contact (two strides of 6 frames).
POUCH_RUN = ['f', None, 'b', 'b', 'u', None, 'f', None, 'b', 'b', 'u', None]


def run_set(key):
    out = []
    for i, (p, t) in enumerate(A.UPPER[key]):
        m = POUCH_RUN[i % 12]
        q = dict(p)
        if m and q.get('torso', 'up') in ('up', 'lean', 'lean2', 'back'):
            q['torso'] = q.get('torso', 'up') + '~' + m
        out.append((q, t))
    return out


# ------------------------------------------------------------------------------------ the salute
def salute():
    """The salute (68 ticks, once, the last frame holds; the game-over screen), DIRK's way: the
    elbow stays low and forward and the shoulder rolls forward, so the hand reaches the brow over
    the eye with the forearm in front of the mouth (the straight arm of the shared salute put his
    dark sleeve over the whole face); the chest comes out, a small overshoot, the proud hold."""
    import ext_moves as EM
    st = ((0, -17), (-5, -4), (5, -4))
    far = hand((0, 9), 'fist', 'fist')

    def f(near, head='fwd', tor=(0, 0), hd=(0, 0)):
        return EM.fp(*st, 'flat', 'flat', torso='up', head=head, tor=tor, hd=hd, armN=near, armF=far, cape=('hang', 0))
    upa = lambda h, sh=(2, 0): hand(h, 'open', 'hand', bend=-1, sh=sh)
    return [
        (f(hand((2, 9), 'fist', 'fist')), 4),
        (f(upa((8, 0), sh=(1, 0))), 3),
        (f(upa((6.5, -7.5)), tor=(0, -1)), 2),
        (f(upa((6, -8.5), sh=(2, -0.5)), tor=(0, -1), hd=(0, -1)), 3),
        (f(upa((6, -8))), 4),
        (f(upa((6, -8)), head='smug'), 52),
    ]


# ------------------------------------------------------------------------------------ install
CHANGED_UPPER = ('slash', 'stab', 'crouchslash', 'h_slash', 'h_crouchslash', 'h_stab', 'run', 'h_run')
TAGS = {}                  # UPPER key -> the tags of its frames (strips.py reads them)


def _set(key, seq3):
    A.UPPER[key] = [(p, t) for p, t, _ in seq3]
    TAGS[key] = [g for _, _, g in seq3]


def install():
    DP.install()
    sl, hs, st, hst = slash_set(), heavy_slash_src(), stab_set(), stab_set(heavy=True)
    _set('slash', sl)
    _set('stab', st)
    U = A.UPPER
    hi, hc, ci = EH.U('h_idle'), EH.U('h_crouchidle'), EH.U('crouchidle')
    # the heavy and crouched versions through the kit's own helpers (the near shoulder roll of
    # the kit's heavy fix is part of h_idle / h_crouchidle already)
    for key, src, fn in (('crouchslash', sl, lambda s: EH.crouch_set(s, ci)),
                         ('h_slash', hs, lambda s: EH.heavy_swap(s, ready=hi)),
                         ('h_crouchslash', hs, lambda s: EH.heavy_swap(s, crouch=True, ready=hc)),
                         ('h_stab', hst, lambda s: EH.heavy_swap(s, ready=hi))):
        seq = fn([(p, t) for p, t, _ in src])
        _set(key, [(p, t, g) for (p, t), (_, _, g) in zip(seq, src)])
    U['run'] = run_set('run')
    U['h_run'] = run_set('h_run')
    # the Helium Head twins of the changed sets (the balloon head on the same poses)
    for k in CHANGED_UPPER:
        if 'he_' + k in U or k in ('slash', 'stab', 'h_slash', 'h_stab', 'run', 'h_run'):
            U['he_' + k] = [(HE._swap(p), t) for p, t in U[k]]
            if k in TAGS:
                TAGS['he_' + k] = TAGS[k]
