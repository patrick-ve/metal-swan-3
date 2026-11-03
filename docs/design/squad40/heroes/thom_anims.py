# THOM's poses: two pistols (akimbo) everywhere; shots alternate near -> far; pistol-whip melee;
# a gunslinger fidget (twirl one pistol, blow the smoke off the muzzle). Legs: VINCENT's set.
import pose
import anims as A
from anims import up, gun, hand

DY = pose.PEL_DY
NB = (8, 4)        # near gun hand, from the near shoulder
FB = (9.5, -1.5)       # far gun hand, from the far shoulder: one gun high (far), one low (near), never one blob


def fgun(h=FB, aim='fwd', bend=-1, sh=(0, 0), z=None):
    return gun(h, aim + 'F', bend, sh, z)


def akimbo(nh=NB, fh=FB, **kw):
    return up(near=gun(nh), far=fgun(fh), **kw)


MZN = ('armN', 'muzzle', 0, 0)
MZF = ('armF', 'muzzle', 0, 0)
KICK = [(1, 0), (0, -0.5), (-1.5, -1), (-1, -0.5), (-0.5, 0)]   # recoil offsets per frame after a shot


def _kick(k, start):
    i = k - start
    return KICK[i] if 0 <= i < len(KICK) else (0, 0)


def _flash(k, start, mz, base):
    i = k - start
    if 0 <= i < 3:
        return [(base[i], mz)]
    if i == 3:
        return [(base[3], (mz[0], mz[1], -1, -1))]
    return []


FWD_FX = ['ff0', 'ff1', 'ff2', 'fsm']
UP_FX = ['fu0', 'fu1', 'fu2', 'fusm']
DN_FX = ['fd0', 'fd1', 'fd2', None]
TIMES = [2, 2, 2, 2, 2, 2, 2, 3, 4, 4]


def alt_set(make, fxs, far_start=4):
    """10 frames: the near pistol fires on frame 0, the far pistol on frame far_start."""
    out = []
    for k in range(10):
        kn, kf = _kick(k, 0), _kick(k, far_start)
        fx = [f for f in _flash(k, 0, MZN, fxs) + _flash(k, far_start, MZF, fxs) if f[0]]
        firing = k < 3 or far_start <= k < far_start + 3
        p = make(kn, kf, firing)
        if fx:
            p['fx'] = fx
        out.append((p, TIMES[k]))
    return out


def shoot_set(torso='up', hd=(0, 0), nb=NB, fb=FB):
    def make(kn, kf, firing):
        return up(torso=torso, hd=hd, head='shout' if firing else 'fwd',
                  near=gun((nb[0] + kn[0], nb[1] + kn[1])), far=fgun((fb[0] + kf[0], fb[1] + kf[1])))
    return alt_set(make, FWD_FX)


UN, UF = (8, -6.5), (5, -9)   # shoot up: near in front of the face, far behind the head (barrel above the cap)
SHU_N, SHU_F = (3.5, -1.5), (4, -3)


def shootup_set():
    def make(kn, kf, firing):
        return up(head='up', near=gun((UN[0] + kn[1] * 0.5, UN[1] - kn[0] * 0.6), 'up', sh=SHU_N),
                  far=fgun((UF[0] + kf[1] * 0.5, UF[1] - kf[0] * 0.6), 'up', sh=SHU_F))
    return alt_set(make, UP_FX)


DN, DF = (2.5, 8), (1.5, 7.5)


def shootdown_set():
    def make(kn, kf, firing):
        return up(torso='lean', head='down', near=gun((DN[0], DN[1] + kn[0] * 0.6), 'down'),
                  far=fgun((DF[0], DF[1] + kf[0] * 0.6), 'down'))
    return alt_set(make, DN_FX)


def idle_upper(k):
    by = [0, 0, 1, 1][k]
    hy = [0, 1, 1, 0][k]
    return akimbo(NB, (FB[0], FB[1] + hy * 0.5), tor=(0, by), hd=(0, hy - by))


def run_upper(i, n=12):
    import math
    ph = i / n
    sway = round(0.7 * math.sin(4 * math.pi * ph))
    sway2 = round(0.7 * math.sin(4 * math.pi * ph + 1.6))
    hd = (0, 1 if (i % 6) in (1, 2) else 0)
    return up(torso='lean', hd=hd, near=gun((9, 3 + sway)), far=fgun((10, -1.5 + sway2)))


def jump_upper():
    fars = [(9.5, 0), (9, 1.5), (9.5, -1.5), (9.5, -2.5), (9.5, -1.5), (9.5, 0)]
    near = [(8, 5), (8, 3), (8, 3), (8, 4), (8, 4), (8, 5)]
    tor = ['lean', 'up', 'up', 'up', 'up', 'lean']
    ts = [3, 4, 6, 8, 6, 5]
    return [(up(torso=tor[k], near=gun(near[k]), far=fgun(fars[k])), ts[k]) for k in range(6)]


def grenade_set():
    """The far pistol goes into the belt (a grip sticks up at the front), the far arm throws on frame 3."""
    S = []
    low = gun((6, 6), 'low')
    tuck = [('tuck', (0, -15 + DY), 4.5)]
    S.append((up(torso='up', head='fwd', near=low, far=hand((-3, 6), 'grenadeF', 'hand'), items=tuck), 3))
    S.append((up(torso='back', head='shout', near=low, far=hand((-7, 1), 'grenadeF', 'hand'), items=tuck), 5))
    S.append((up(torso='back', head='shout', near=low, far=hand((-6, -4), 'grenadeF', 'hand', bend=1), items=tuck), 2))
    S.append((up(torso='lean', head='shout', near=low, far=hand((9, -3), 'open', 'hand', bend=1, z=6.5), items=tuck), 3))
    S.append((up(torso='lean', head='fwd', near=low, far=hand((9, 1), 'open', 'hand', z=6.5), items=tuck), 5))
    S.append((akimbo((8, 5), (9.5, 0)), 6))
    return S


SL = (5, -25 + DY)   # the slash arc centre (root-relative), near the near shoulder


def slash_set():
    """Pistol whip: the near pistol swings over and down, butt first; the far pistol stays aimed."""
    fl = fgun((6, 7), 'low')
    S = []
    S.append((up(torso='up', head='shout', near=gun((8, -3.5), 'up', sh=(1, -0.5)), far=fl), 3))
    S.append((up(torso='back', head='shout', near=gun((7, -6), 'up', sh=(1.5, -1.5)), far=fl), 3))
    S.append((up(torso='lean', head='shout', near=gun((8, -4), 'fwd', bend=1), far=fl, fx=[('slash1', SL)]), 2))
    S.append((up(torso='lean2', head='shout', near=gun((9, 3), 'ddown', bend=-1), far=fl, fx=[('slash2', SL)]), 3))
    S.append((up(torso='lean', head='fwd', near=gun((6, 7), 'low', bend=-1), far=fl, fx=[('slash3', SL)]), 4))
    S.append((akimbo((8, 5), (9.5, 0)), 6))
    return S


def stab_set():
    """Butt jab: a short punch with the near pistol turned so the butt leads."""
    fl = fgun((6, 7), 'low')
    S = []
    S.append((up(torso='back', head='fwd', near=gun((3, 4), 'butt'), far=fl), 4))
    S.append((up(torso='lean', head='shout', near=gun((9, 1), 'butt'), far=fl), 2))
    S.append((up(torso='lean2', head='shout', near=gun((10, 0.5), 'butt'), far=fl,
                 fx=[('stab', ('armN', 'tip', 1, 0))]), 3))
    S.append((up(torso='lean2', head='shout', near=gun((10, 0.5), 'butt'), far=fl), 4))
    S.append((up(torso='lean', head='fwd', near=gun((6, 4), 'butt'), far=fl), 4))
    S.append((akimbo((8, 5), (9.5, 0)), 6))
    return S


def fidget_set():
    """Twirl the near pistol twice on the trigger finger (the far pistol hangs relaxed), then lift it
    in front of the chin and blow the smoke off the muzzle, wink, back to the ready pose."""
    fl = fgun((6, 7), 'low')
    TW = (8.5, 1)
    F = []
    F.append((akimbo(), 8))
    F.append((up(head='fwd', near=gun(TW, 'fwd'), far=fl), 4))
    for k, aim in enumerate(['down', 'back', 'up', 'fwd', 'down', 'back', 'up']):
        F.append((up(head='smug', near=gun(TW, aim), far=fl), 3))
    F.append((up(head='fwd', near=gun(TW, 'fwd'), far=fl), 8))
    BL = (9, 2)
    F.append((up(head='fwd', near=gun(BL, 'up'), far=fl, fx=[('fusm', ('armN', 'muzzle', 0, 0))]), 8))
    F.append((up(head='blow', near=gun(BL, 'up'), far=fl, fx=[('fusm', ('armN', 'muzzle', 1, -2))]), 12))
    F.append((up(head='blow', near=gun(BL, 'up'), far=fl, fx=[('fusm', ('armN', 'muzzle', 2, -4))]), 8))
    F.append((up(head='smug', near=gun(BL, 'up'), far=fl), 16))
    F.append((up(head='blink', near=gun(NB), far=fgun()), 6))
    F.append((akimbo(), 10))
    return F


def death_set():
    D = []

    def d(rot, pel, far, near, fs, ns, head='hurt', armN=(4, -3), armF=(-3, -4), t=4, items=None, aim='fwd', torso='up'):
        p = dict(pelvis=pel, rot=rot, torso=torso, head=head,
                 legF=dict(ank=far, shoe=fs), legN=dict(ank=near, shoe=ns),
                 armN=dict(hand=armN, end=('gun', aim) if aim else ('fist', 'fist'), bend=1),
                 armF=dict(hand=armF, end=('gun', aim + 'F') if aim else ('hand', 'openF'), bend=1))
        if items:
            p['items'] = items
        D.append((p, t))
    two = lambda a, b: [('pistol', a, 20), ('pistolF', b, 19)]
    d(0, (0, -17), (-5, -4), (5, -4), 'flat', 'flat', 'hurt', (7, 3), (-6, -1), 4, torso='back')
    d(12, (-2, -16), (-6, -4), (5, -4), 'flat', 'toe', 'hurt', (7, 0), (-6, -3), 4)
    d(28, (-4, -14), (-7, -4), (4, -6), 'toe', 'hang', 'hurt', (6, -4), (-5, -4), 4)
    d(48, (-6, -11), (-8, -4), (3, -9), 'toe', 'hang', 'hurt', (1, -9), (-6, -2), 4, aim=None,
      items=two((8, -16), (4, -22)))
    d(70, (-8, -7), (-4, -6), (6, -11), 'hang', 'heel', 'hurt', (-2, -8), (-6, 0), 4, aim=None,
      items=two((11, -9), (15, -15)))
    d(88, (-10, -4), (2, -9), (8, -12), 'heel', 'heel', 'hurt', (-5, -5), (-5, 2), 3, aim=None,
      items=two((13, -3), (20, -6)))
    for rot, pel, fa, na, an, af, t, hd in [
            (90, (-10, -3), (5, -5), (10, -6), (-6, -2), (-5, 3), 4, 'hurt'),
            (86, (-10, -4), (4, -7), (9, -8), (-6, -3), (-5, 2), 4, 'hurt'),
            (90, (-10, -3), (6, -3), (11, -3), (-6, -1), (-5, 3), 6, 'hurt'),
            (90, (-10, -3), (6, -3), (11, -3), (-6, -1), (-5, 3), 40, 'blink')]:
        d(rot, pel, fa, na, 'lie', 'lie', hd, an, af, t, aim=None, items=two((15, -2), (25, -3)))
    return D


A.UPPER.update({
  'idle': [(idle_upper(k), 9) for k in range(4)],
  'fidget': fidget_set(),
  'run': [(run_upper(i), 3) for i in range(12)],
  'jump': jump_upper(),
  'shoot': shoot_set(),
  'aimup': [(up(head='fwd', near=gun((8, -3), 'dup', sh=(1.5, -0.5)), far=fgun((10, -2), 'dup', sh=(1.5, -0.5))), 2),
            (up(head='up', near=gun(UN, 'up', sh=SHU_N), far=fgun(UF, 'up', sh=SHU_F)), 2)],
  'shootup': shootup_set(),
  'aimdown': [(up(torso='lean', head='down', near=gun((6, 6), 'ddown'), far=fgun((6, 5), 'ddown')), 2),
              (up(torso='lean', head='down', near=gun(DN, 'down'), far=fgun(DF, 'down')), 2)],
  'shootdown': shootdown_set(),
  'crouchidle': [(up(torso='lean2', tor=(0, k // 2), hd=(1, [0, 1, 0, 0][k]), near=gun((9, 3)), far=fgun((10.5, -2))), 9)
                 for k in range(4)],
  'crouchshoot': shoot_set(torso='lean2', hd=(1, 0), nb=(9, 3), fb=(10.5, -2)),
  'grenade': grenade_set(),
  'slash': slash_set(),
  'stab': stab_set(),
})
A.FULL['death'] = death_set()
A.MELEE_TITLE = 'Pistol whip'
