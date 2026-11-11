# The fatbike youth's drawn parts and palette, look 0 (the cast spike's approved sample,
# docs/design/cast40/chars/fatbike-youth.py): the black cap with the peak forward over every
# expression, the bare head (deaths, the flee: the cap flies off as its own sprite), the red hoodie
# torso (hood bunched at the neck, drawstrings, pouch pocket, ribbed hem), hands with ribbed red
# cuffs, white sneakers, the loose cap (the tumbling prop), the FX letters on the shared FX ramp.
#
# install() patches the shared kit tables (one set per process, bake.py). The looks of stage 2
# (fatbike-youth-1..3) call install() and then swap parts (heads, torso, palette letters).
import castkit as K
import limbs as HK

P = K.P
pose = K.pose


def grid(t):
    return K.grid(t)


# ------------------------------------------------------------------------------------ palette
# 27 colours (plan D1: at most 28), the bike included: the outline K; skin (L S s z); the brows and
# lines Q; hair (H, its shade = the tyre black o); the red hoodie (J j q r); the black cap, tyres,
# seat and speaker (A P p o O); the grey trackpants (a b B); white sneakers, drawstrings, the eye
# white and the lamp (X x v); the gold frame (G g n N); the silver rims and the speaker cone t.
PAL = {
    'K': '#140c0e',
    'L': '#ffe4cc', 'S': '#f6c39e', 's': '#dc9670', 'z': '#a8522e',      # skin a
    'Q': '#26150f',                                                      # brows, lines
    'H': '#4a3a40', 'h': '#282a33',                                      # dark hair (h = o)
    'J': '#f06045', 'j': '#c62f30', 'q': '#861a2e', 'r': '#4a0f1f',      # red hoodie
    'A': '#6c7180', 'P': '#4f5360', 'p': '#3a3d48', 'o': '#282a33', 'O': '#1b1c23',   # black: cap, tyres
    'a': '#8c93a6', 'b': '#686e80', 'B': '#4b5062',                      # mid-grey trackpants
    'X': '#f8fbff', 'x': '#c9dbea', 'v': '#8694a6',                      # white sneakers
    'T': '#f8fbff', 'w': '#f8fbff',                                      # drawstrings, eye white (= X)
    'G': '#fff184', 'g': '#f6c537', 'n': '#c98c22', 'N': '#8c5a17',      # gold frame
    't': '#a9b0bd',                                                      # rims, speaker cone
    # the burn's soot: existing colours (no new ones)
    '0': '#1b1c23', '1': '#282a33', '2': '#4f5360',
    # FX letters: colours of the shared FX ramp (rules.json fxRamp), outside the budget
    'F': '#fffbd8', 'f': '#ffd040', 'c': '#ff8a24', 'e': '#e0401c', 'W': '#ffffff', 'y': '#ffe070',
    'D': '#7a6e70', 'd': '#4a4046', 'I': '#ffffff', 'i': '#bfe4ff',
}
FX_LETTERS = 'FfceWyDdIi'
DARK = {'J': 'r', 'j': 'r', 'q': 'r', 'r': 'r', 'H': 'h', 'h': 'h', 'A': 'o', 'T': 'x', 'w': 'x',
        'X': 'v', 'x': 'v', 'G': 'n', 'g': 'n', 'n': 'N', 'N': 'N', 't': 'o', 'P': 'O', 'p': 'O',
        'o': 'O', 'O': 'O', 'a': 'B', 'b': 'B', 'B': 'o', 'L': 'z', 'S': 'z', 's': 'z', 'z': 'z',
        'Q': 'Q', '0': '0', '1': '0', '2': '0'}

# Skin b and c: palette variants of the same pixels (contract: skinB / skinC; the handhaver's tones).
SKIN_B = {'L': '#e8b890', 'S': '#c98b62', 's': '#a1643f', 'z': '#5e3424', 'H': '#2c221c'}
SKIN_C = {'L': '#b77a52', 'S': '#8a5236', 's': '#663a26', 'z': '#3c2016', 'H': '#2c221c'}


def edit(rows, changes):
    return HK.edit(rows, changes)


# ------------------------------------------------------------------------------------ heads
# 18 x 13, neck (5, 12). Rows 0-4 the cap (crown lit from the upper front, the band, the peak
# forward), rows 5-13 the face in profile (facing right): the hair at the back of the head and
# under the cap, the ear, a cocky young face.
CAP = grid("""
    ....ooppppPPo.....
    ..oppPPPPAAPPo....
    .oppPPPPPPPPPPo...
    .opppppppppppPAAAA
    hhhoooooooooopPPPp
""")
FACE = grid("""
    hhhhsSSSQQSSL...
    QhhhzsSSwQSSSL..
    .QhhzsSSSSSSSSL.
    .QhhsSSSSSSSSs..
    ..QhsSSSSzQQs...
    ...QzsSSSSSs....
    ....zzsSSSsz....
    .....zsz........
""")
# the bare head (rows 0-4): short dark hair, the fringe pushed up by the cap that just flew off
TOP = grid("""
    ..................
    .....hHHHH........
    ...hHHHHHHHh......
    ..hHHHHHHHHHh.....
    hhhHHHHHHHHh......
""")

# expression edits (row in the full 13-row head, x, letters)
EXPR = {
    'fwd': [],
    'blink': [(6, 8, 'zz')],
    # OI!: brows down to the nose, the mouth a big open O (dark inside, the tongue)
    'shout': [(5, 8, 'SQQQ'), (6, 8, 'wQ'), (8, 9, 'SQQQs'), (9, 9, 'zQrQ.'), (10, 9, 'SQQs')],
    # cocky (the gloat, the bob): half-shut eyes, a lopsided grin
    'smug': [(5, 8, 'QQQ'), (6, 8, 'zQ'), (9, 9, 'SzzQ')],
    # bob to the beat: eyes shut, a grin
    'groove': [(5, 8, 'SSS'), (6, 8, 'QQ'), (9, 9, 'zzzQ')],
    # happy (photo): eyes squeezed into arcs, a wide grin with teeth
    'happy': [(5, 8, 'SQQS'), (6, 8, 'QS'), (8, 10, 'zzz'), (9, 9, 'QwwwQ'), (10, 10, 'zz')],
    # effort (the kick): teeth bared, the brows down hard
    'grit': [(5, 8, 'SQQQ'), (6, 8, 'zQ'), (8, 10, 'zzz'), (9, 9, 'QwQwQ'), (10, 10, 'zz')],
    # panic: brows up, wide white eyes, the mouth an open O
    'panic': [(4, 8, 'QQ'), (5, 8, 'SSS'), (6, 8, 'wwQ'), (8, 10, 'zQz'), (9, 10, 'QrQ'), (10, 10, 'zQz')],
    # MAMA!: the mouth wide, eyes shut tight
    'wail': [(5, 8, 'QSSQ'), (6, 8, 'zzQ'), (8, 9, 'zQQQ'), (9, 9, 'QrrQ'), (10, 9, 'zQQs')],
    # hurt: the eye squeezed shut, the teeth clenched
    'hurt': [(5, 8, 'SQQS'), (6, 8, 'SzzQ'), (8, 10, 'zzz'), (9, 9, 'wQwQ')],
    # dazed: an empty stare, the mouth slack
    'dazed': [(5, 8, 'SSSS'), (6, 8, 'Qz'), (9, 9, 'SzQz')],
    # soot (burn): wide white eyes in the blackened face, the mouth agape
    'soot': [(6, 8, 'wwQ'), (8, 10, 'zQz'), (9, 10, 'QQQ')],
    'sootblink': [(6, 8, 'zzz'), (8, 10, 'zQz'), (9, 10, 'QQQ')],
}


def head_rows(expr='fwd', cap=True, face=None, top=None, capr=None):
    rows = (capr or CAP) if cap else (top or TOP)
    rows = rows + (face or FACE)
    return edit(rows, [(y, x, s) for y, x, s in EXPR[expr]])


def install_heads(face=None, top=None, capr=None):
    """Every expression with the cap ('fwd', 'shout' ...) and without it ('nc_hurt' ...)."""
    nk = {'neck': (5, 12)}
    for e in EXPR:
        P.HEADS[e] = (head_rows(e, True, face, top, capr), nk)
        P.HEADS['nc_' + e] = (head_rows(e, False, face, top, capr), nk)


# ------------------------------------------------------------------------------------ torsos
# The red hoodie (12 x 13): the hood bunched behind the neck, the drawstrings T, the pouch pocket
# (the q seam), the ribbed hem r.
TORSO = grid("""
    .qjJq.......
    qjjJJq......
    qjjjJJJJJJ..
    qjjjJJJTJJJ.
    qjjjjJJJTJJJ
    qjjjjJJJJJJJ
    qjjqjjJJJJJJ
    qjjqjjJJJJJj
    qjjjqjqqqqqj
    qjjjqjjJJJJj
    qqjjjqjjjJjq
    Qqjjjjqjjjjq
    .rqqqqqqqqr.
""")
TAN = {'neck': (6, 0), 'pelvis': (6, 11), 'shN': (6.5, 4.5), 'shF': (3.5, 5.0)}
# breathing in: the chest lifts a row, the drawstrings swing forward
TORSO_IN = grid("""
    .qjJq.......
    qjjJJq......
    qjjjJJJJJJ..
    qjjjJJJJTJJ.
    qjjjjJJJJTJJ
    qjjjjJJJJJJJ
    qjjqjjJJJJJJ
    qjjqjjJJJJJJ
    qjjjqjqqqqqj
    qjjjqjjJJJJj
    qqjjjqjjjJjq
    .rqqqqqqqqr.
""")
TAN_IN = {'neck': (6, 0), 'pelvis': (6, 10), 'shN': (6.5, 4.5), 'shF': (3.5, 5.0)}


def install_torsos(torso=None, torso_in=None):
    t = (torso or TORSO, TAN)
    P.TORSOS['up'] = t
    P.TORSOS['in'] = (torso_in or TORSO_IN, TAN_IN)
    for name, k in (('back2', -3), ('back', -2), ('back1', -1), ('lean1', 1), ('lean', 2), ('lean2', 3), ('lean3', 4)):
        P.TORSOS[name] = P.shear(t, k)


# ------------------------------------------------------------------------------------ hands
# Ribbed red hoodie cuffs (J) on every hand.
HANDS = {
    'grip': (["JSSS", "JSSs", ".ss."], {'wrist': (0, 1), 'grip': (1.5, 1)}),
    'fist': (["JSS", "JSs", ".ss"], {'wrist': (0, 1)}),
    'open': (["JSSSS", "JSSSs", ".sss."], {'wrist': (0, 1)}),
    # fingers up, the palm out (the cower, the swoon)
    'up': ([".SS", "SSs", "SSs", "Ss.", "JJ."], {'wrist': (0.5, 4)}),
    # the peace sign (the photo, the gloat)
    'peace': (["S.S.", "S.S.", "SSs.", "JSSs", "JSs.", ".s.."], {'wrist': (0, 3.5)}),
    # pointing at the player (the alert)
    'point': (["JSS...", "JSSSSs", ".ss..."], {'wrist': (0, 1)}),
    # thumbs up
    'thumb': ([".S..", ".SL.", "JSSS", "JSSs", ".ss."], {'wrist': (0, 3)}),
}

# White sneakers (the cast sample's flat and toe; the kit's other shoes in the same letters).
SHOES = {
    'flat': (grid("""
        xXXX....
        xXXXXX..
        xXXXXXXX
        vvvvvvvv
    """), {'ankle': (2, 0)}),
    'toe': (grid("""
        xXX....
        xXXX...
        xXXXXX.
        .vxXXXX
        ..vvvvv
    """), {'ankle': (1, 0)}),
    'pedal': (grid("""
        xXX....
        xXXXX..
        xXXXXXX
        .vvvvvv
    """), {'ankle': (1, 0)}),
}

# ------------------------------------------------------------------------------------ items
# the cap, loose (lands beside him in the deaths that keep it in frame, the tumbling prop)
CAP_ITEM = grid("""
    ..oppPPo...
    .opPPAAPo..
    oppppppPPAA
    .ooooooopPp
""")
CAP_FLOOR = grid("""
    ...oppPo...
    .opPPAAPPo.
    oooooooopPp
""")


def install_items():
    P.ITEMS['cap0'] = (CAP_ITEM, {'c': (5, 2)})
    P.ITEMS['capfloor'] = (CAP_FLOOR, {'c': (5, 2)})
    from castkit import rig
    import math
    for k in range(1, 8):
        rows = rig.rotsprite(['.' * 17] * 6 + ['...' + r + '...' for r in CAP_ITEM] + ['.' * 17] * 6, (8, 8), 45 * k)
        ys = [y for y, r in enumerate(rows) if r.strip('.')]
        xs = [x for r in rows for x, ch in enumerate(r) if ch != '.']
        cut = [r[min(xs):max(xs) + 1] for r in rows[min(ys):max(ys) + 1]]
        P.ITEMS[f'cap{k}'] = (cut, {'c': (8 - min(xs), 8 - min(ys))})
    _ = math


def install(pal=None):
    """Look 0: palette, heads, torsos, hands, shoes, items (patched into the shared kit tables)."""
    K.palette(dict(PAL, **(pal or {})), dark=DARK, letters='ab0123GgnNtTw')
    pose.RAMP['arm'] = ['J', 'j', 'q', 'r']
    pose.RAMP['armF'] = ['j', 'q', 'r', 'r']
    pose.RAMP['leg'] = ['a', 'b', 'B', 'B']
    pose.RAMP['legF'] = ['b', 'B', 'B', 'o']
    pose.HOOKS['pat'] = ribs
    install_heads()
    install_torsos()
    for k, v in HANDS.items():
        P.HANDS[k] = v
        P.FISTS[k] = v
    for k, v in SHOES.items():
        P.SHOES[k] = v
    install_items()


def ribs(part, u, v, k, ch):
    """The hoodie cuff is ribbed (a darker band at the wrist); the trackpants carry a white side
    stripe on the near leg (the cast sample dropped it on the bike: kept off the shin)."""
    if part.startswith('arm') and u > pose.UPPER + pose.FORE - 1.2:
        return ['j', 'q', 'r', 'r'][min(3, k)]
    return ch
