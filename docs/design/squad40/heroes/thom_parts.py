# THOM ("Little Napoleon") parts at 1x: palette, heads (backwards navy cap, huge grin, squint),
# camo torso, coyote boots, two pistols (a near and a darker far variant), hands, items.
# Facing right, light from the upper front, no exterior outline (the composer draws it).
import rig
import parts as P

# ---------------------------------------------------------------- palette (24 hero colours)
PAL = {
  'A': '#f6e0a0', 'H': '#c9a862',                            # very short blond hair
  'Q': '#2c281c',                                            # darkest: lines, camo spots, deep shade
  'L': '#fff0e4', 'S': '#fccfb6', 's': '#ec9e8e', 'z': '#b0605a',  # fair, rosy skin
  'w': '#fffaf0',                                            # teeth, eye glint, cap patch
  'J': '#cfc5a2', 'j': '#a89e7e', 'q': '#7a725a',            # camo base: sand / greige
  'V': '#808c48', 'Y': '#56613a',                            # camo olive blotch (lit, shade)
  'X': '#b48a5c', 'x': '#82603e', 'v': '#4a3624',            # coyote boots; x / v = camo brown blotch
  'C': '#4a5c90', 'E': '#2e3862', 'U': '#1a1f3c',            # navy cap
  'G': '#dfe3ec', 'g': '#8f94a8', 'n': '#4f5366', 'N': '#2b2d3e',  # pistols
}
DARK = {'C': 'U', 'E': 'U', 'U': 'U', 'V': 'Y', 'Y': 'Q'}
rig.apply_hero(PAL, 'CEUVY', DARK)


def edit(rows, changes):
    out = [list(r) for r in rows]
    for y, x, s in changes:
        for i, ch in enumerate(s):
            if ch != ' ':
                out[y][x + i] = ch
    return [''.join(r) for r in out]


# ---------------------------------------------------------------- heads (17 x 13, neck at (8, 12))
# The head proper is 14 wide (cols 3..16); cols 0..2 carry the cap brim that sticks out behind.
_HEAD = [
  "......UEEEEEU....",
  "....UEECCCCCCEU..",
  "...UEECCCCCCCCCE.",
  "..UEEECCCCCCwwCCE",
  "UCEEEEEEEEEEEEEEU",
  "UUUUAHSSSSSSSHHS.",
  "...HLSzSSSSSsQQS.",
  "...SSzzSSSSSSssSL",
  "...sSszSSSSsSSSSs",
  "....QszSSQzzzzzs.",
  ".....QSSSsQwwwwz.",
  "......QsSSSzQQz..",
  ".......QzssSz....",
]
_NECK = {'neck': (8, 12)}
HEADS = {}
HEADS['fwd'] = (_HEAD, _NECK)
# the squint is his normal look; blink closes it to a flat line
HEADS['blink'] = (edit(_HEAD, [(6, 13, 'zz')]), _NECK)
# firing: eyes open wide, brows down, a yelling grin with the jaw dropped
HEADS['shout'] = (edit(_HEAD, [(5, 13, 'zQ'), (6, 13, 'wQ'), (9, 9, 'Qzzzzzs'), (10, 10, 'QwwwwQ'),
                               (11, 11, 'zQQQz'), (12, 8, 'zssSzz')]), _NECK)
HEADS['hurt'] = (edit(_HEAD, [(5, 13, 'zz'), (6, 12, 'zQQz'), (9, 9, 'Qzzzzzs'), (10, 10, 'QwQwQz'),
                              (11, 11, 'szzz')]), _NECK)
# looking up: the eye and the grin move up, the chin juts forward
HEADS['up'] = (edit(_HEAD, [(5, 13, 'QQS'), (6, 12, 'sSSSL'), (7, 15, 'Ss'), (8, 9, 'Qzzzzzs.'),
                            (9, 9, 'sQwwwwz'), (10, 5, 'QsSSSSzQQz..'), (11, 6, 'QsSSSSSSs..'), (12, 7, 'QzssSSz...')]), _NECK)
# looking down: the eye and the grin move down, the chin tucks in
HEADS['down'] = (edit(_HEAD, [(6, 12, 'sHHS'), (7, 12, 'sQQSL'), (8, 15, 'Ss'), (9, 9, 'sSSSSSz'),
                              (10, 9, 'Qzzzzz'), (11, 10, 'Qwwwz'), (12, 10, 'zQQ')]), _NECK)
# fidget: a cocky wink with an even bigger grin
HEADS['smug'] = (edit(_HEAD, [(5, 12, 'HHz'), (6, 13, 'zQ'), (9, 9, 'Qzzzzzzs'), (10, 10, 'Qwwwwwz'),
                              (11, 11, 'zQQQ')]), _NECK)
# fidget: lips pursed, blowing the smoke off the muzzle
HEADS['blow'] = (edit(_HEAD, [(6, 13, 'zz'), (9, 9, 'sSSSSSs'), (10, 10, 'SSSszQ'), (11, 11, 'SSsz'),
                              (12, 11, 'z')]), _NECK)

# ---------------------------------------------------------------- torso (12 x 11): camo field shirt
# Hand-drawn camouflage: sand/greige base (J j q), olive blotches (V lit, Y shade), brown blotches
# (x lit, v shade), a few dark spots (Q). Light from the upper front: the back columns are in shade.
# The bottom row is the dark brown belt.
_TORSO = [
  ".qjYJJJJSJ..",
  "qjYYVJJJsJJ.",
  "qjjYJJxxJJVJ",
  "qvjjjJxJJVVJ",
  "qvvjJJJJJJJJ",
  "qjjjJQJJJJxJ",
  "qYYjjJJxxJxj",
  "qjYjjjJJxJJj",
  "qqjjVVjjjJjq",
  "QqjjYjqjjjjq",
  ".QvvvvvvvvQ.",
]
_TAN = {'neck': (6, -2), 'pelvis': (6, 9), 'shN': (6.5, 2.5), 'shF': (3.5, 3.0)}
TORSOS = {'up': (_TORSO, _TAN)}
TORSOS['lean'] = P.shear(TORSOS['up'], 2)
TORSOS['lean2'] = P.shear(TORSOS['up'], 3)
TORSOS['back'] = P.shear(TORSOS['up'], -2)


# ---------------------------------------------------------------- pistols in hand (near + far)
def far(part):
    """The far-hand variant: one shade darker everywhere (hand, cuff, steel)."""
    rows, an = part
    t = str.maketrans({'L': 'S', 'S': 's', 's': 'z', 'G': 'g', 'J': 'j', 'j': 'q'})
    return [r.translate(t) for r in rows], dict(an)


def flip(part):
    rows, an = part
    w = max(len(r) for r in rows)
    return [r.ljust(w, '.')[::-1] for r in rows], {k: (w - 1 - x, y) for k, (x, y) in an.items()}


GUNS = {
 'fwd': ([
  "..ngGGGGGGg.",
  "jSSngnnnnnnN",
  "jSSSNNnN....",
  ".sssNN......",
 ], {'wrist': (0, 1.5), 'muzzle': (12, 1)}),
 'low': ([
  "..gGg.......",
  "jSSnGGg.....",
  "jSSSNnGGg...",
  ".sssNNnnGGg.",
  ".......nnnN.",
 ], {'wrist': (0, 1.5), 'muzzle': (11, 4)}),
 'up': ([
  ".gg.",
  ".Gn.",
  ".Gn.",
  ".Gn.",
  "SGnN",
  "SSSN",
  "SSsN",
  ".ss.",
  ".jj.",
 ], {'wrist': (1.5, 8.5), 'muzzle': (1.5, -1)}),
 'down': ([
  ".jj.",
  ".SS.",
  "SSSN",
  "SSsN",
  "sGnN",
  ".Gn.",
  ".Gn.",
  ".Gn.",
  ".nN.",
 ], {'wrist': (1.5, -0.5), 'muzzle': (1.5, 9)}),
 'dup': ([
  "......gn",
  ".....gGN",
  "....gGn.",
  "...gGn..",
  ".SSGn...",
  "SSSSN...",
  "jSsN....",
  "j.s.....",
 ], {'wrist': (0, 6.5), 'muzzle': (8, -1)}),
 'ddown': ([
  "j.......",
  "jSS.....",
  "SSSSN...",
  ".sSGn...",
  "...gGn..",
  "....gGn.",
  ".....gGN",
  "......nN",
 ], {'wrist': (0, 1), 'muzzle': (8, 8)}),
 # twirl on the trigger finger: barrel pointing back over the wrist, the grip up
 'back': ([
  "......Nn...",
  "......nNS..",
  "nnnnnnngSSS",
  "gGGGGGGgSSs",
  "........ss.",
 ], {'wrist': (7.5, 3), 'muzzle': (-1, 2.5)}),
 # pistol whip jab: the wrist turned so the barrel points up and the butt of the grip leads forward
 'butt': ([
  ".gg..",
  ".Gn..",
  ".Gn..",
  ".GnN.",
  "SSSnN",
  "SSSsN",
  "jsss.",
  "j....",
 ], {'wrist': (0.5, 6.5), 'muzzle': (1.5, -1), 'tip': (4.5, 4.5)}),
 # pistol whip swing: the hand high, the barrel pointing back-up, the butt leads the blow
 'raise': ([
  "gn......",
  "NGg.....",
  ".nGg....",
  "..nGSS..",
  "...SSSSj",
  "....sSSj",
  ".....ss.",
 ], {'wrist': (7.5, 4.5), 'muzzle': (-1, -1), 'tip': (5, 3)}),
}
for k in list(GUNS):
    GUNS[k + 'F'] = far(GUNS[k])

FISTS = {
 'fist': (["jSS", "jSs", ".ss"], {'wrist': (0, 1)}),
 'fistup': (["SS.", "SSs", "Ss.", "jj."], {'wrist': (0.5, 3.5)}),
}

HANDS = {
 'open': (["jSSSS", "jSSSs", ".sss."], {'wrist': (0, 1)}),
 'grenade': ([".uMM.", "uMMMG", "jSSS.", "jSSs.", ".ss.."], {'wrist': (0, 3)}),
}
HANDS['openF'] = far(HANDS['open'])
HANDS['grenadeF'] = ([".uMM.", "uMMMG", "qsss.", "qssz.", ".zz.."], {'wrist': (0, 3)})

ITEMS = {
 'pistol': ([".gGGGGg", "nnnnnnN", "NN....."], {'c': (3, 1)}),
 'pistolF': ([".nggggn", "NNNNNNN", "NN....."], {'c': (3, 1)}),
 # the far pistol tucked in the front of the belt during the grenade throw: the grip sticks up
 'tuck': (["Nn.", "nN.", "gnN"], {'c': (1, 1)}),
}
for k in ('gren0', 'gren1', 'gren2', 'gren3'):
    ITEMS[k] = P.ITEMS[k]
