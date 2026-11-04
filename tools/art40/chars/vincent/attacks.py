# VINCENT's knife at 40 px (plan docs/design/ams40.md wave 2, the user's pilot review: every attack
# clearly better than today's: more in-betweens, anticipation, smears, impact and recoil inside the
# same logic time). Applied after hero.load('vincent'), before the shared hero module builds the
# strips (this process only; tools/art40/chars/_hero stays as it is):
#
# - the slash (knife, crouch-knife): the knife cocked high behind the head (the face stays clear),
#   the top held a beat, the swing smear, the IMPACT (a warm burst at the blade, the body thrown in,
#   held 3 ticks), the bounce, the follow-through low, the in-between and the guard;
# - the stab (knife-b): the coil (the knife drawn back to the ribs), the lunge smear with speed
#   lines, the IMPACT (burst at the tip, held 3 ticks), the recoil, the pull-out, the guard.
#
# The game strikes at tick 0 of the action (player.ts knife()), so the wind-up is short: the blade
# lands on tick 3 (stab) and tick 4 (slash). Logic time stays: every knife strip is 14 ticks
# (TUNING.fire.knifeTicks). The near hand keeps the pistol low and the last pose is the ready pose,
# so the kit derives the crouched, heavy and Helium Head twins from these sets exactly as before.
import importlib

import anims as A
import ext_heavy as EH
import parts as P

up, gun, hand = A.up, A.gun, A.hand

KNIFE_TICKS = 14

FX = {
    # the impact burst at the blade (frame of contact), the ring as it opens, the sparks as it fades
    'vk_hit0': ([
        "...f...",
        ".f.F.f.",
        "..FWF..",
        "fFWWWFf",
        "..FWF..",
        ".f.F.f.",
        "...f...",
    ], (3, 3)),
    'vk_hit1': ([
        "f...f",
        ".F.F.",
        "..y..",
        ".F.F.",
        "f...f",
    ], (2, 2)),
    'vk_hit2': ([
        "c...c",
        ".....",
        ".....",
        ".....",
        "c...c",
    ], (2, 2)),
    # speed lines behind the stab
    'vk_jab': ([
        "iiii....",
        "..mmmiii",
        "iiii....",
    ], (8, 1)),
}
# the slash arcs round the far shoulder (the spike's own centre)
FX['vk_top'] = P.arc(0, 0, 14, 15, -150, -110, 1.4)
FX['vk_sw1'] = P.arc(0, 0, 15, 17, -110, 10, 3.4)
FX['vk_sw2'] = P.arc(0, 0, 16, 17, -30, 55, 2.6)
FX['vk_sw3'] = P.arc(0, 0, 16, 16, 25, 70, 1.4)
ARC = (3, -26)                 # the arcs' centre (root-relative, as the spike's slash1-3)


def ready():
    return up(torso='up', head='fwd', near=gun((8, 5)), far=hand((9, 5)))


def slash_set():
    """The slash, 7 keys."""
    low = gun((5, 8), 'low')
    lowb = gun((4, 8.5), 'low')
    k = lambda h, kind='knifeup', **kw: hand(h, kind, 'hand', z=6.5, **kw)
    S = []
    # the cock: the body winds back, the knife goes up behind the head line (the eye stays clear)
    S.append((up(torso='back', head='shout', hd=(-1, 0), near=lowb, far=k((-2, -8.5), bend=1)), 1))
    # the top: held a beat, a faint streak over the head
    S.append((up(torso='back', head='shout', tor=(-1, 0), hd=(-1, 0), near=lowb, far=k((-3, -10), bend=1),
                 fx=[('vk_top', ARC)]), 2))
    # the swing smear over the front
    S.append((up(torso='lean', head='shout', near=low, far=k((9, -4), 'knife', bend=1), fx=[('vk_sw1', ARC)]), 1))
    # IMPACT: the body thrown in, the blade through the target at chest height, the burst
    S.append((up(torso='lean2', head='shout', tor=(1, 0), near=low, far=k((10.5, 0), 'knife'),
                 fx=[('vk_sw2', ARC), ('vk_hit0', ('armF', 'tip', 0, 0))]), 3))
    # the bounce: the blade rides down and back, the ring opens
    S.append((up(torso='lean2', head='shout', near=low, far=k((9.5, 2.5), 'knifedown'),
                 fx=[('vk_sw3', ARC), ('vk_hit1', ('armF', 'tip', 2, -3))]), 2))
    # the follow-through low, the sparks fade
    S.append((up(torso='lean', head='smug', near=low, far=k((8, 5.5), 'knifedown'),
                 fx=[('vk_hit2', ('armF', 'tip', 3, -4))]), 2))
    S.append((ready(), 2))
    return S


def stab_set():
    """The stab, 6 keys (an in-between to the guard is mixed in)."""
    low = gun((5, 8), 'low')
    k = lambda h, **kw: hand(h, 'knife', 'hand', **kw)
    S = []
    # the coil: the knife drawn back to the ribs, the shoulder turns away
    S.append((up(torso='back', head='shout', tor=(-1, 0), hd=(-1, 0), near=gun((4, 8.5), 'low'), far=k((0, 4.5))), 2))
    # the lunge smear, speed lines behind the fist
    S.append((up(torso='lean2', head='shout', near=low, far=k((10, 0.5), z=6.5), fx=[('vk_jab', ('armF', 'wrist', -3, -1))]), 1))
    # IMPACT: the over-reach, the burst at the tip
    S.append((up(torso='lean2', head='shout', tor=(1, 0), near=low, far=k((11, 0.5), z=6.5),
                 fx=[('vk_hit0', ('armF', 'tip', 1, 0))]), 3))
    # the recoil
    S.append((up(torso='lean2', head='shout', near=low, far=k((9.5, 1), z=6.5), fx=[('vk_hit1', ('armF', 'tip', 2, 0))]), 2))
    # the pull-out
    S.append((up(torso='lean', head='fwd', near=low, far=k((6.5, 3.5), z=6.5), fx=[('vk_hit2', ('armF', 'tip', 4, -1))]), 2))
    S.append((ready(), 2))
    return S


def knife(seq):
    """The slash's steps (14 ticks): the blade lands on tick 4; fit() only moves ticks. A 'smear'
    step is the frame whose OUTGOING move is the fast one (the top's swing, the smear's strike)."""
    s = [p for p, _ in seq]
    mix = _H.frames.mix
    return [(s[0], 1), (s[1], 2, 'smear'), (s[2], 1, 'smear'), (s[3], 3), (s[4], 2), (s[5], 2),
            (mix(s[5], s[6], 0.5, keep='b'), 1, 'ib'), (s[6], 2)]


def stab(seq):
    """The stab's steps (14 ticks): the tip lands on tick 3."""
    s = [p for p, _ in seq]
    mix = _H.frames.mix
    return [(s[0], 2, 'smear'), (s[1], 1), (s[2], 3), (s[3], 2), (s[4], 2), (mix(s[4], s[5], 0.5, keep='b'), 2, 'ib'), (s[5], 2)]


_H = None


def apply(H):
    """Install the knife: the effects, the pose sets and their crouch, heavy and Helium Head
    derivations, and the strip builders of the shared module (this process only)."""
    global _H
    _H = H
    S = importlib.import_module(H.__name__ + '.strips')
    importlib.import_module(H.__name__ + '.frames')
    P.FX.update(FX)
    U = A.UPPER
    U['slash'] = slash_set()
    U['stab'] = stab_set()
    U['crouchslash'] = EH.crouch_set(U['slash'], U['crouchidle'][0][0])
    hi, hc = U['h_idle'][0][0], U['h_crouchidle'][0][0]
    U['h_slash'] = EH.heavy_swap(U['slash'], ready=hi)
    U['h_stab'] = EH.heavy_swap(U['stab'], ready=hi)
    U['h_crouchslash'] = EH.heavy_swap(U['slash'], crouch=True, ready=hc)
    for k in ('slash', 'stab', 'crouchslash', 'h_slash', 'h_stab', 'h_crouchslash'):
        U.pop('he_' + k, None)
    # every knife set of this process is derived from the two above
    S.knife = knife
    S.stab = stab
