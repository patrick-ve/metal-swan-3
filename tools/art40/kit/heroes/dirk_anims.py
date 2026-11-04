# DIRK's own animations: the plunger melee (slash = overhead smack, stab = thrust that sticks and
# pops off) and the plumber fidget (strokes his mustache, then hitches up his trousers). Everything
# else is VINCENT's pose set, which already uses DIRK's parts through the shared tables.
import anims as A
import parts as P
from anims import up, gun, hand

TIP = ('armF', 'tip', 2, 0)
IDLE = lambda t: (up(torso='up', head='fwd', near=gun((8, 5)), far=hand((9, 5))), t)

# plunger swing trails around the far shoulder (longer reach than a knife)
P.FX['pswing1'] = P.arc(0, 0, 18, 19, -120, -20, 2.6)
P.FX['pswing2'] = P.arc(0, 0, 19, 20, -95, 35, 3.4)
P.FX['pswing3'] = P.arc(0, 0, 19, 19, 10, 60, 1.8)
SW = (1, -24)


def slash_set():
    low = gun((5, 8), 'low')
    pl = lambda h, kind, **k: hand(h, kind, 'hand', z=6.5, **k)
    S = []
    # wind-up: the far arm goes up behind the body, the cup shows above and behind the head
    S.append((up(torso='up', head='shout', near=low, far=hand((1, -7), 'pl_back', 'hand', z=1)), 3))
    S.append((up(torso='back', head='shout', near=low, far=hand((0, -8), 'pl_back', 'hand', z=1)), 4))
    S.append((up(torso='lean', head='shout', near=low, far=hand((8, -5), 'pl_dup', 'hand', z=4, bend=1), fx=[('pswing1', SW)]), 2))
    S.append((up(torso='lean2', head='shout', near=low, far=pl((10, 0), 'pl_fwd', bend=1), fx=[('pswing2', SW)]), 2))
    S.append((up(torso='lean2', head='shout', near=low, far=pl((9, 4), 'pl_ddn'),
                 fx=[('pswing3', SW), ('plop0', ('armF', 'tip', 0, 1))]), 3))
    S.append((up(torso='lean', head='fwd', near=low, far=pl((8, 6), 'pl_ddn'), fx=[('plop1', ('armF', 'tip', 0, 1))]), 4))
    S.append(IDLE(6))
    return S


def stab_set():
    low = gun((5, 8), 'low')
    pl = lambda h, kind, **k: hand(h, kind, 'hand', z=6.5, **k)
    S = []
    S.append((up(torso='back', head='fwd', near=low, far=pl((1, 5), 'pl_fwd')), 4))
    S.append((up(torso='lean', head='shout', near=low, far=pl((9, 1), 'pl_fwd')), 2))
    S.append((up(torso='lean2', head='shout', near=low, far=pl((10, 0.5), 'pl_sq'), fx=[('plop0', TIP)]), 3))
    S.append((up(torso='lean2', head='shout', near=low, far=pl((10, 0.5), 'pl_sq'), fx=[('plop1', TIP)]), 4))
    S.append((up(torso='lean', head='fwd', near=low, far=pl((7, 3), 'pl_fwd'), fx=[('plop2', ('armF', 'tip', 1, 0))]), 4))
    S.append(IDLE(6))
    return S


def fidget_set():
    """Strokes his mustache with two fingers (eyes shut, pleased), a slow nod, back to the gun."""
    low = gun((6, 7), 'low')
    F = []
    def f(far, head='fwd', t=8, tor=(0, 0), hd=(0, 0)):
        F.append((up(torso='up', head=head, tor=tor, hd=hd, near=low, far=far), t))
    st = lambda h, b=BEND: hand(h, 'stroke', 'hand', z=4.5, bend=b, sh=(2, -1))
    f(hand((7, 1), 'fist', z=6.5), t=6)
    f(st((7.5, -5)), 'smug', t=10)
    f(st((6.5, -4.5)), 'smug', t=7)
    f(st((7.5, -5)), 'smug', t=7)
    f(st((6.5, -4.5)), 'smug', t=7)
    f(st((7.5, -5)), 'smug', t=8)
    f(st((7.5, -4)), 'smug', t=8, hd=(0, 1))
    f(st((7.5, -5)), 'blink', t=10)
    f(hand((7, 1), 'fist', z=6.5), 'fwd', t=6)
    F.append((up(head='blink', near=gun((8, 4)), far=hand((9, 5))), 6))
    F.append((up(head='fwd', near=gun((8, 4)), far=hand((9, 5))), 10))
    return F


BEND = -1
A.UPPER['slash'] = slash_set()
A.UPPER['stab'] = stab_set()
A.UPPER['fidget'] = fidget_set()
A.MELEE_TITLE = 'Plunger'


def shootup_set():
    """VINCENT's shoot-up with the gun arm further forward, so the dark sleeve passes under the
    chin instead of over the mustache and jaw."""
    U0 = (8.5, -6)
    seq = [(U0, 'fu0', 2), ((8.5, -5.5), 'fu1', 2), ((8.5, -5), 'fu2', 2), ((8.5, -5), 'fusm', 3),
           ((8.5, -5.5), None, 3), (U0, None, 3), (U0, None, 4), (U0, None, 4), (U0, None, 4), (U0, None, 4)]
    out = []
    for hnd, f, t in seq:
        p = up(head='up', near=gun(hnd, 'up', sh=(2.5, -1)), far=hand((8, 4), 'fist'))
        if f:
            p['fx'] = [(f, A.MZ)]
        out.append((p, t))
    return out


A.UPPER['shootup'] = shootup_set()
A.UPPER['aimup'][1] = (up(head='up', near=gun((8.5, -6), 'up', sh=(2.5, -1)), far=hand((8, 4))), 2)
