# PATRICK's own animations: the frikandel fidget and the keyboard melee. Everything else (legs, run,
# jump, crawl, shooting, grenade, death) is VINCENT's set, which fits the same body.
from anims import up, gun, hand


def fidget_set():
    low = gun((6, 7), 'low')
    F = []

    def f(far, head='fwd', hd=(0, 0), t=8, torso='up'):
        F.append((up(torso=torso, head=head, hd=hd, near=low, far=far), t))
    f(hand((7, 2), 'inside', 'hand', z=6.5), t=8)                       # hand into the jacket
    f(hand((7, 1), 'inside', 'hand', z=6.5), 'down', t=6)
    f(hand((8, 1), 'frik', 'hand', z=6.5), 'down', t=8)                 # out comes a frikandel
    f(hand((8, 0), 'frik', 'hand', z=6.5), 'happy', t=12)               # a happy look at it
    f(hand((7, -4), 'frikflat', 'hand', z=6.5), 'bite', t=6)            # bite
    f(hand((7, -4), 'frikflat', 'hand', z=6.5), 'chew', t=4)
    f(hand((8, 1), 'frikbit', 'hand', z=6.5), 'chew', t=8)              # chew
    f(hand((8, 1), 'frikbit', 'hand', z=6.5), 'chew2', t=8)
    f(hand((8, 1), 'frikbit', 'hand', z=6.5), 'chew', t=8)
    f(hand((8, 1), 'frikbit', 'hand', z=6.5), 'chew2', (0, 1), t=8)
    f(hand((8, 1), 'frikbit', 'hand', z=6.5), 'happy', t=14)            # master of the frikandel
    f(hand((7, -4), 'frikflat', 'hand', z=6.5), 'bite', t=6)            # second bite
    f(hand((8, 1), 'frikbit2', 'hand', z=6.5), 'chew', t=8)
    f(hand((8, 1), 'frikbit2', 'hand', z=6.5), 'chew2', t=8)
    f(hand((7, 1), 'inside', 'hand', z=6.5), 'chew', t=8)               # the rest goes back in
    f(hand((9, 5)), 'blink', t=6)
    F[-1] = (up(head='blink', near=gun((8, 4)), far=hand((9, 5))), 6)
    F.append((up(head='fwd', near=gun((8, 4)), far=hand((9, 5))), 10))
    return F


SH = (-2, -23)   # the far shoulder, from the ground point (centre of the swing trails)


def slash_set():
    """A big overhead keyboard smash; keycaps fly off at the hit."""
    low = gun((5, 8), 'low')
    S = []
    S.append((up(torso='up', head='fwd', near=low, far=hand((4, -4), 'kbback', 'hand', bend=1, z=4.5)), 3))
    S.append((up(torso='back', head='shout', near=low, far=hand((-1, -8), 'kbback', 'hand', bend=1, z=4.5)), 4))
    S.append((up(torso='lean', head='shout', near=low, far=hand((9, -4), 'kbdiag', 'hand', bend=1, z=6.5),
                 fx=[('kslash1', SH)]), 2))
    S.append((up(torso='lean2', head='shout', near=low, far=hand((9, 3), 'kbdown', 'hand', bend=-1, z=6.5),
                 fx=[('kslash2', SH), ('bonk', ('armF', 'tip', 1, 1)), ('caps0', ('armF', 'tip', -1, -5))]), 3))
    S.append((up(torso='lean', head='shout', near=low, far=hand((9, 4), 'kbdown', 'hand', bend=-1, z=6.5),
                 fx=[('kslash3', SH), ('caps1', ('armF', 'tip', -1, -8))]), 4))
    S.append((up(torso='lean', head='fwd', near=low, far=hand((8, 5), 'kb', 'hand', z=6.5),
                 fx=[('caps2', ('armF', 'tip', -3, -11))]), 4))
    S.append((up(torso='up', head='fwd', near=gun((8, 5)), far=hand((9, 5))), 6))
    return S


def stab_set():
    """A quick keyboard jab, end first."""
    low = gun((5, 8), 'low')
    S = []
    S.append((up(torso='back', head='fwd', near=low, far=hand((1, 5), 'kb', 'hand')), 4))
    S.append((up(torso='lean', head='shout', near=low, far=hand((9, 1), 'kb', 'hand', z=6.5)), 2))
    S.append((up(torso='lean2', head='shout', near=low, far=hand((10, 0.5), 'kb', 'hand', z=6.5),
                 fx=[('stab', ('armF', 'tip', 1, 0))]), 3))
    S.append((up(torso='lean2', head='shout', near=low, far=hand((10, 0.5), 'kb', 'hand', z=6.5)), 4))
    S.append((up(torso='lean', head='fwd', near=low, far=hand((6, 4), 'kb', 'hand', z=6.5)), 4))
    S.append((up(torso='up', head='fwd', near=gun((8, 5)), far=hand((9, 5))), 6))
    return S


def install(A):
    A.UPPER['fidget'] = fidget_set()
    A.UPPER['slash'] = slash_set()
    A.UPPER['stab'] = stab_set()
    A.MELEE_TITLE = 'Keyboard'
