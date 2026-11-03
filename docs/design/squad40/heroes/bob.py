# BOB, "Captain Climate": a slim superhero in a leaf-green suit with a white leaf emblem, bark-brown
# gloves, belt and knee boots, and a white cape with two blue stripes and a blue six-pointed star
# (drawn as its own BACK sprite, see heroes/bob_cape.py). Weapon: the standard pistol. Melee: punches.
import math
import rig
import pose
import parts as P
import anims as A
from heroes import bob_cape

SCALES = [1]

# ---------------------------------------------------------------- palette
# hair and leather share one brown ramp; the suit ramp also colours the legs; teeth get their own
# white; the cape blue doubles as the eye colour.
rig.apply_hero({
  'A': '#a97a4c', 'H': '#6c442a', 'h': '#442a1b', 'Q': '#1d1612',          # hair + leather
  'L': '#fff0e6', 'S': '#f8d0b8', 's': '#e2a68e', 'z': '#a8634f',          # pale skin
  'b': '#d6ad9d', 'B': '#9a5e50',                                          # faint stubble, lip line
  'w': '#ffffff',                                                          # teeth, eye white
  'J': '#6fc44c', 'j': '#3f9b3b', 'q': '#256b2d',                          # leaf-green suit
  'T': '#f7f8f4', 't': '#c2c9d8',                                          # white (emblem, cape)
  'U': '#2f63d2', 'V': '#1b3b8e',                                          # blue (cape, eyes)
}, 'UV', {'U': 'V', 'V': 'V'})
for ch in 'RrPpoOXxv':                 # VINCENT's tie, trousers and shoes: not used by BOB
    rig.HERO.discard(ch)

pose.RAMP.update({
  'leg': ['J', 'j', 'q', 'Q'], 'legF': ['j', 'q', 'Q', 'Q'],
  'leg2': ['A', 'H', 'h', 'Q'], 'legF2': ['H', 'h', 'Q', 'Q'],        # knee boots
  'arm': ['J', 'j', 'q', 'Q'], 'armF': ['j', 'q', 'Q', 'Q'],
})


def _edit(rows, changes):
    out = [list(r) for r in rows]
    for y, x, s in changes:
        for i, ch in enumerate(s):
            out[y][x + i] = ch
    return [''.join(r) for r in out]


def _map(part, table):
    rows, an = part
    tr = str.maketrans(table)
    return [r.translate(tr) for r in rows], dict(an)


# ---------------------------------------------------------------- heads (14 x 14, neck at (5, 13))
_HEAD = [
  "......hAA.A...",
  "....hhAAHAAAA.",
  "..hhHAHAAHAAAA",
  ".hHHAHHAHAHHA.",
  ".hHHHAHHHHAHH.",
  "hHhHHHHHHHHSL.",
  "hhHhHHHHSsSLLL",
  "hhHHHHsSSSHHL.",
  "QhhHszsSSSwUSL",
  ".QhHszsSSSSSSL",
  "..QhssSSSSSsS.",
  "...bsSSzwwwwz.",
  "...bbSSszBBz..",
  "....zbbbbb....",
]
NK = {'neck': (5, 13)}
HEADS = {
  'fwd': (_HEAD, NK),
  'blink': (_edit(_HEAD, [(8, 10, 'sz')]), NK),
  'shout': (_edit(_HEAD, [(7, 10, 'hh'), (8, 10, 'wU'), (11, 7, 'zwwwwz'), (12, 7, 'zQQQz'), (13, 5, 'bzzbb')]), NK),
  'hurt': (_edit(_HEAD, [(7, 10, 'Hh'), (8, 10, 'zz'), (11, 7, 'SzzzzS'), (12, 7, 'zwwwz')]), NK),
}
HEADS['up'] = (_edit(_HEAD, [(7, 10, 'SS'), (6, 11, 'HH'), (7, 11, 'wU'), (8, 10, 'SS'), (11, 7, 'Szwwww'), (12, 8, 'zBBz')]), NK)
HEADS['down'] = (_edit(_HEAD, [(7, 10, 'HHS'), (8, 10, 'zU'), (11, 7, 'Szwwwz'), (12, 7, 'SszBz')]), NK)
HEADS['read'] = HEADS['down']
HEADS['read2'] = (_edit(HEADS['down'][0], [(8, 10, 'Uz')]), NK)
HEADS['proud'] = (_edit(_HEAD, [(7, 10, 'SS'), (6, 11, 'HH'), (7, 12, 'S'), (8, 10, 'wU')]), NK)
HEADS['grin'] = (_edit(_HEAD, [(7, 10, 'hH'), (8, 10, 'zU'), (11, 7, 'Szwwwz'), (12, 7, 'SszzS')]), NK)

# ---------------------------------------------------------------- torso (11 x 11): green suit,
# white leaf on the chest, brown belt with a steel buckle; 'cape' = where the cape hangs from
_TORSO = [
  ".tTTTJJJJJ..",
  "qjtTJJJJJJT.",
  "qjjjJJJJJTTJ",
  "qjjqjJJJTTtJ",
  "qjjqjjJJTtJJ",
  "qjjjqjJJtJJj",
  "qjjjqjjJJJJj",
  "qqjjjqjjjJjq",
  "QHHHHHHHGgHh",
  "QhhhhhhhgnhQ",
  ".QqqqqqqqqqQ",
]
_TAN = {'neck': (6, -2), 'pelvis': (6, 9), 'shN': (5.5, 2.5), 'shF': (3.5, 3.0), 'cape': (2.0, -0.5)}
TORSOS = {'up': (_TORSO, _TAN)}
TORSOS['lean'] = P.shear(TORSOS['up'], 2)
TORSOS['lean2'] = P.shear(TORSOS['up'], 3)
TORSOS['back'] = P.shear(TORSOS['up'], -2)

# ---------------------------------------------------------------- boots, gloves (leather = hair ramp)
BOOT = {'X': 'A', 'x': 'H', 'v': 'Q'}
GLOVE = {'S': 'H', 's': 'h', 'T': 'A', 'L': 'A'}
SHOES = {k: _map(v, BOOT) for k, v in P.SHOES.items()}
GUNS = {k: _map(v, GLOVE) for k, v in P.GUNS.items()}
FISTS = {k: _map(v, GLOVE) for k, v in P.FISTS.items()}
FISTS['punch'] = ([
  "AHHH.",
  "AHHHh",
  "AHHHh",
  ".hhh.",
], {'wrist': (0, 1.5)})
FISTS['hip'] = ([
  "Hh",
  "hh",
], {'wrist': (0.5, 0.5)})
HANDS = {k: _map(v, GLOVE) for k, v in P.HANDS.items() if k in ('open', 'grenade', 'inside')}
HANDS['pass'] = ([
  ".TTTTtU",
  ".TnnTtU",
  ".TTTTtU",
  "AHHH...",
  "AHHh...",
  ".hh....",
], {'wrist': (0, 4)})
HANDS['passlow'] = ([
  "AHH.",
  "AHTU",
  ".hh.",
], {'wrist': (0, 1)})

P.HEADS.update(HEADS)
P.TORSOS.clear(); P.TORSOS.update(TORSOS)
P.SHOES.update(SHOES)
P.GUNS.update(GUNS)
P.FISTS.update(FISTS)
P.HANDS.update(HANDS)

# impact burst for the punches (effect letters only, no outline)
P.FX['pow0'] = ([
  "...W...",
  ".y.W.y.",
  "..fWf..",
  "WWWFWWW",
  "..fWf..",
  ".y.W.y.",
  "...W...",
], (3, 3))
P.FX['pow1'] = ([
  "y..f..y",
  ".......",
  "..fFf..",
  "f.FWF.f",
  "..fFf..",
  ".......",
  "y..f..y",
], (3, 3))
P.FX['pow2'] = ([
  "f...f",
  ".....",
  "..y..",
  ".....",
  "f...f",
], (2, 2))
P.FX['swish'] = P.arc(0, 0, 12, 13, -60, 10, 1.4)

# ---------------------------------------------------------------- poses
up, gun, hand, legs = A.up, A.gun, A.hand, A.legs


def cape(p, mode, ph=0.0):
    p['cape'] = (mode, ph)
    return p


def idle_upper(k):
    by = [0, 0, 1, 1][k]
    hy = [0, 1, 1, 0][k]
    return cape(up(tor=(0, by), hd=(0, hy - by), near=gun((8, 4)), far=hand((9, 5))), 'hang', k / 4)


def run_upper(i, n=12):
    p = A.run_upper(i, n)
    return cape(p, 'run', i / n)


def shoot_set(torso='up', hd=(0, 0), base=(8, 4), mode='shoot'):
    out = []
    for k, (p, t) in enumerate(A.shoot_set(torso, hd, base)):
        out.append((cape(p, mode, k), t))
    return out


def jump_upper():
    return [(cape(p, 'jump', k), t) for k, (p, t) in enumerate(A.jump_upper())]


def tagged(seq, mode):
    return [(cape(dict(p), mode, k), t) for k, (p, t) in enumerate(seq)]


def slash_set():
    """Haymaker: wind the far fist back past the ear, swing it round in front of the body, land it
    with a burst, follow through, recover."""
    low = gun((5, 8), 'low')
    S = []
    S.append((up(torso='up', head='shout', near=low, far=hand((-4, -1), 'punch', 'fist', bend=1)), 3))
    S.append((up(torso='back', head='shout', near=low, far=hand((-8, -5), 'punch', 'fist', bend=1)), 4))
    S.append((up(torso='lean', head='shout', near=low, far=hand((6, -4), 'punch', 'fist', bend=1, z=6.5),
                 fx=[('swish', (5, -27))]), 2))
    S.append((up(torso='lean2', head='shout', near=low, far=hand((11, -1), 'punch', 'fist', bend=1, z=6.5),
                 fx=[('pow0', ('armF', 'wrist', 6, 0))]), 3))
    S.append((up(torso='lean2', head='fwd', near=low, far=hand((11, 0), 'punch', 'fist', bend=1, z=6.5),
                 fx=[('pow1', ('armF', 'wrist', 6, 0))]), 3))
    S.append((up(torso='lean', head='fwd', near=low, far=hand((8, 4), 'punch', 'fist', z=6.5),
                 fx=[('pow2', ('armF', 'wrist', 7, -1))]), 4))
    S.append((up(torso='up', head='fwd', near=gun((8, 5)), far=hand((9, 5))), 6))
    return tagged(S, 'slash')


def stab_set():
    """Straight jab: guard, snap the far fist out level with the chin, burst, pull back."""
    low = gun((6, 6), 'low')
    S = []
    S.append((up(torso='up', head='fwd', near=low, far=hand((5, 0), 'punch', 'fist', z=6.5)), 3))
    S.append((up(torso='lean', head='shout', near=low, far=hand((10, -1), 'punch', 'fist', z=6.5)), 2))
    S.append((up(torso='lean2', head='shout', near=low, far=hand((11.5, -1), 'punch', 'fist', z=6.5),
                 fx=[('pow0', ('armF', 'wrist', 6, 0))]), 3))
    S.append((up(torso='lean2', head='shout', near=low, far=hand((11.5, -1), 'punch', 'fist', z=6.5),
                 fx=[('pow2', ('armF', 'wrist', 7, 0))]), 3))
    S.append((up(torso='lean', head='fwd', near=low, far=hand((6, 1), 'punch', 'fist', z=6.5)), 4))
    S.append((up(torso='up', head='fwd', near=gun((8, 5)), far=hand((9, 5))), 6))
    return tagged(S, 'stab')


def fidget_set():
    """Hero pose: fist on the hip, chest out, chin up, the cape billows; then a sly look at a
    boarding pass, a guilty grin, the pass goes back in the belt."""
    down = gun((2.5, 6), 'down', bend=1)
    F = []
    def f(far, head='fwd', mode=('billow', 0), t=8, torso='up', hd=(0, 0), near=down):
        F.append((cape(up(torso=torso, head=head, hd=hd, near=near, far=far), *mode), t))
    hip = hand((-0.5, 5.5), 'hip', 'fist', bend=1)
    f(hand((4, 6)), 'fwd', ('hang', 0), 6, near=gun((6, 6), 'low'))
    f(hip, 'proud', ('billow', 0), 8, 'back', (0, 0))
    for k in range(1, 7):
        f(hip, 'proud' if k != 4 else 'blink', ('billow', k / 6), 7, 'back')
    f(hand((5, 7), 'passlow', 'hand', z=6.5), 'down', ('billow', 0.2), 6)
    f(hand((8, 1), 'pass', 'hand', z=6.5), 'read', ('settle', 0), 8)
    f(hand((8, 1), 'pass', 'hand', z=6.5), 'read2', ('hang', 0.5), 16)
    f(hand((8, 1), 'pass', 'hand', z=6.5), 'read', ('hang', 0.75), 12)
    f(hand((8, 2), 'pass', 'hand', z=6.5), 'grin', ('hang', 0), 18)
    f(hand((5, 7), 'passlow', 'hand', z=6.5), 'grin', ('hang', 0.25), 6)
    F.append((cape(up(head='blink', near=gun((8, 4)), far=hand((9, 5))), 'hang', 0.5), 6))
    F.append((cape(up(head='fwd', near=gun((8, 4)), far=hand((9, 5))), 'hang', 0.75), 10))
    return F


A.UPPER['idle'] = [(idle_upper(k), 9) for k in range(4)]
A.UPPER['fidget'] = fidget_set()
A.UPPER['run'] = [(run_upper(i), 3) for i in range(12)]
A.UPPER['jump'] = jump_upper()
A.UPPER['shoot'] = shoot_set()
A.UPPER['aimup'] = tagged(A.UPPER['aimup'], 'hang')
A.UPPER['shootup'] = tagged(A.shootup_set(), 'shoot')
A.UPPER['aimdown'] = tagged(A.UPPER['aimdown'], 'float')
A.UPPER['shootdown'] = tagged(A.shootdown_set(), 'float')
A.UPPER['crouchidle'] = [(cape(dict(p), 'crouch', k / 4), t) for k, (p, t) in enumerate(A.UPPER['crouchidle'])]
A.UPPER['crouchshoot'] = shoot_set(torso='lean2', hd=(1, 0), base=(9, 3), mode='cshoot')
A.UPPER['grenade'] = tagged(A.grenade_set(), 'grenade')
A.UPPER['slash'] = slash_set()
A.UPPER['stab'] = stab_set()
A.FULL['death'] = [(cape(dict(p), 'death', k), t) for k, (p, t) in enumerate(A.death_set())]
A.MELEE_TITLE = 'Hero punch'



# The knee crease marks use the thigh ramp; on BOB the shin is a brown boot, so a mark that lands
# on a boot pixel takes the same tone of the boot ramp (no green specks on the boots).
_crease = pose.crease
_BOOT_CH = set('AHh')


def _boot_crease(cv, X, a, j, b, r, ramp, z, part):
    if part not in ('legN', 'legF'):
        return _crease(cv, X, a, j, b, r, ramp, z, part)
    jx, jy = X.m(j)
    box = [(x, y) for y in range(int(jy) - 5, int(jy) + 6) for x in range(int(jx) - 5, int(jx) + 6)
           if 0 <= x < cv.W and 0 <= y < cv.H]
    before = {k: cv.c[k[1]][k[0]] for k in box}
    _crease(cv, X, a, j, b, r, ramp, z, part)
    boot = pose.RAMP['leg2' if part == 'legN' else 'legF2']
    for (x, y), old in before.items():
        new = cv.c[y][x]
        if new != old and old in _BOOT_CH and new in ramp:
            cv.c[y][x] = boot[ramp.index(new)]


pose.crease = _boot_crease
pose.HOOKS['back'] = bob_cape.draw
pose.HOOKS['post'] = bob_cape.post


# ---------------------------------------------------------------- the extension families
from heroes import bob_ext                  # noqa: E402  (new heads, items, poses, cape modes)
after_ext = bob_ext.after_ext
after_derive = bob_ext.after_derive
