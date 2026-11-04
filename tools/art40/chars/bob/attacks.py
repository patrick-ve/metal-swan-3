# BOB's melee at 40 px (wave 2 stage 2): Captain Climate fights with his fists. The spike's punch
# sets (kit/heroes/bob.py slash_set / stab_set) are redrawn at the plan's melee class with the
# reference's craft, inside the game's 14 knife ticks (TUNING.fire.knifeTicks, the contract):
#
#   knife   (haymaker)  cock -> deep wind-up (held) -> 2 smears round the shoulder -> impact with
#                       the torso thrown in -> recoil -> follow-through -> the guard comes back
#   knife-b (jab)       chin guard -> load -> 1 smear -> impact -> recoil -> pull back -> guard
#
# The near hand keeps the pistol low (the kit derives the heavy sets from this: heavy_swap puts the
# heavy gun in that hand) and the last frame is the ready pose (near pistol forward, no effect), so
# the crouched and heavy variants (kit ext_heavy: crouchslash, h_slash, h_stab, h_crouchslash) are
# made from these exactly as before. Installed BEFORE the kit derives them (make.py).
import anims as A
import parts as P

up, gun, hand = A.up, A.gun, A.hand


def _cape(p, mode, k):
    p['cape'] = (mode, k)
    return p


def trail(r, a0, a1, width):
    """A swing crescent whose LEADING end is the anchor (placed on the fist): the arc round a centre
    r px behind the fist, from angle a0 (faint) to a1 (bright, at the fist)."""
    import math
    rows, (cx, cy) = P.arc(0, 0, r - 1, r, a0, a1, width)
    lx = cx + r * math.cos(math.radians(a1))
    ly = cy + r * math.sin(math.radians(a1))
    return rows, (round(lx), round(ly))


def fx_parts():
    """The effect stamps the punches use (FX ramp letters only: no outline, outside the budget)."""
    # the haymaker's swing: two crescents round the far shoulder, the second longer and brighter
    # the hook's swing: a flat crescent behind the fist (the top of a wide circle), the second
    # longer and brighter
    P.FX['hay0'] = trail(16, -140, -112, 1.6)
    P.FX['hay1'] = trail(20, -122, -86, 2.4)
    # the jab: speed lines behind the fist
    P.FX['jab0'] = ([
        "mmiiiI",
        "......",
        ".mmiiI",
    ], (6, 1))
    # the impact star at full size, a ring as it opens, the sparks as it fades
    P.FX['pow3'] = ([
        "y.....y",
        "..f.f..",
        ".f...f.",
        "...W...",
        ".f...f.",
        "..f.f..",
        "y.....y",
    ], (3, 3))


def slash_set():
    """The haymaker, 8 frames in 14 ticks."""
    low = lambda x=5, y=8: gun((x, y), 'low')
    S = []
    # 0 cock: the far hand leaves the grip and swings back past the hip, the shoulders open
    S.append((up(torso='back', head='shout', tor=(-1, 0), near=low(6, 7),
                 far=hand((-5, 2), 'punch', 'fist', bend=1)), 2))
    # 1 wind-up (the held anticipation): the body coils back, the fist far behind the back
    S.append((up(torso='back', head='shout', tor=(-1, 0), hd=(-1, 0), near=low(),
                 far=hand((-8, 0), 'punch', 'fist', bend=1)), 3))
    # 2 smear: the hook comes round low across the chest, the torso turns forward
    S.append((up(torso='up', head='shout', near=low(),
                 far=hand((-3, 3), 'punch', 'fist', bend=1, z=6.5), fx=[('hay0', ('armF', 'wrist', -1, 0))]), 1, 'smear'))
    # 3 smear: the fist rises to the chin's height, the weight goes onto the front foot
    S.append((up(torso='lean', head='shout', near=low(),
                 far=hand((7, -1), 'punch', 'fist', bend=1, z=6.5), fx=[('hay1', ('armF', 'wrist', -1, 0))]), 1, 'smear'))
    # 4 impact: full reach, the body thrown in behind it, the star
    S.append((up(torso='lean2', head='shout', tor=(1, 0), near=low(4, 8),
                 far=hand((12, -1), 'punch', 'fist', bend=1, z=6.5), fx=[('pow0', ('armF', 'wrist', 6, 0))]), 2))
    # 5 recoil: the fist springs back a pixel, the star opens to a ring
    S.append((up(torso='lean2', head='shout', near=low(4, 8),
                 far=hand((11, -1), 'punch', 'fist', bend=1, z=6.5), fx=[('pow3', ('armF', 'wrist', 7, 0))]), 2))
    # 6 follow-through: the arm drops, the shoulders come back, the sparks fade
    S.append((up(torso='lean', head='fwd', near=low(6, 6),
                 far=hand((9, 2.5), 'punch', 'fist', bend=1, z=6.5), fx=[('pow2', ('armF', 'wrist', 8, -2))]), 2))
    # 7 the guard: back on the grip (the ready pose the kit swaps for the heavy / crouch idle)
    S.append((up(torso='up', head='fwd', near=gun((8, 4)), far=hand((9, 5))), 1))
    return [(_cape(p, 'slash', k), *rest) for k, (p, *rest) in enumerate(S)]


def stab_set():
    """The jab, 8 frames in 14 ticks."""
    low = lambda x=6, y=6: gun((x, y), 'low')
    S = []
    # 0 guard: the fist to the chin, the body settles back on the rear foot
    S.append((up(torso='up', head='fwd', tor=(-1, 0), near=low(6, 7), far=hand((4, 0), 'punch', 'fist', z=6.5)), 2))
    # 1 load: the shoulders turn away, the fist pulls in
    S.append((up(torso='back', head='shout', tor=(-1, 0), near=low(), far=hand((2, -1), 'punch', 'fist', z=6.5)), 2))
    # 2 smear: the snap, speed lines behind the fist
    S.append((up(torso='up', head='shout', near=low(), far=hand((5.5, -1), 'punch', 'fist', z=6.5),
                 fx=[('jab0', ('armF', 'wrist', -2, 0))]), 1, 'smear'))
    # 3 impact: full reach level with the chin
    S.append((up(torso='lean2', head='shout', tor=(1, 0), near=low(), far=hand((12, -1), 'punch', 'fist', z=6.5),
                 fx=[('pow0', ('armF', 'wrist', 6, 0))]), 2))
    # 4 recoil: the fist bounces back off the target
    S.append((up(torso='lean2', head='shout', near=low(), far=hand((10.5, -1), 'punch', 'fist', z=6.5),
                 fx=[('pow3', ('armF', 'wrist', 7, 0))]), 2))
    # 5 pull back: the fist returns to the chin, the sparks fade
    S.append((up(torso='lean', head='fwd', near=low(), far=hand((6.5, 1), 'punch', 'fist', z=6.5),
                 fx=[('pow2', ('armF', 'wrist', 9, -2))]), 2))
    # 6 settle: the hand drops toward the grip
    S.append((up(torso='up', head='fwd', near=low(7, 5), far=hand((7.5, 3.5), 'punch', 'fist', z=6.5)), 2))
    # 7 the guard
    S.append((up(torso='up', head='fwd', near=gun((8, 4)), far=hand((9, 5))), 1))
    return [(_cape(p, 'stab', k), *rest) for k, (p, *rest) in enumerate(S)]


def install():
    """Replace the spike's punch sets before the kit derives the crouched and heavy ones."""
    fx_parts()
    A.UPPER['slash'] = [(p, t) for p, t, *_ in slash_set()]
    A.UPPER['stab'] = [(p, t) for p, t, *_ in stab_set()]


SMEARS = {'slash': (2, 3), 'stab': (2,)}


def steps(key):
    """The strip steps of a melee key (kit A.UPPER after the derive: slash, stab, crouchslash,
    h_slash, h_stab, h_crouchslash) with the smear tags of the base set."""
    base = 'stab' if key.endswith('stab') else 'slash'
    sm = SMEARS[base]
    return [((p, t, 'smear') if i in sm else (p, t)) for i, (p, t) in enumerate(A.UPPER[key])]
