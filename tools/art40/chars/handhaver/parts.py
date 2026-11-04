# The handhaver's own drawn parts and palette (the look of the cast spike's approved sample,
# tools/art40/kit/samples/handhaver.py): the head with the peaked cap in every expression, the head
# without the cap (deaths), the vest torso, the hands with the ticket book, the pencil and the
# ticket, the loose cap and book (items), the FX letters mapped onto the shared FX ramp.
#
# install(look) patches the shared kit tables (one set per process, bake.py): look 'a' = short hair
# under the cap (skins a and b), look 'c' = curly hair (skin c: a part change, contract).
import castkit as K
import limbs as HK
import rig

P = K.P
pose = K.pose

# ------------------------------------------------------------------------------------ palette
# 26 colours (plan D1: at most 28): the outline K, the navy uniform (J j q Q: sleeves, cap, trousers share it),
# the warm hi-vis (Y V U), silver bands and radio (G g n N), the gold badge (R r), black shoes /
# cap band / visor (X x v), skin (L S s z), hair (A H h), paper (T t), the red ticket header E,
# the eye white w. The soot of the burn death and the FX letters reuse colours (merged by the bake)
# or the shared FX ramp (outside the budget).
PAL = {
    'K': '#140c0e',                                   # the one warm near-black outline (rig)
    'Q': '#121726',                                   # darkest navy: brows, lines, deep shade
    'A': '#7a5a44', 'H': '#4e3628', 'h': '#2e2018',   # hair (lit, base, shade): skin a
    'L': '#ffe2cc', 'S': '#f2b694', 's': '#d08668', 'z': '#8e4c3c',
    'J': '#4c64a4', 'j': '#33467c', 'q': '#222f56',   # navy uniform
    'P': '#4c64a4', 'p': '#33467c', 'o': '#222f56', 'O': '#121726',   # trousers (same ramp)
    'Y': '#ffe040', 'V': '#e0b018', 'U': '#9a700e',   # warm hi-vis yellow
    'G': '#eef2f8', 'g': '#a4abbe', 'n': '#5c6276', 'N': '#262a38',   # silver bands, radio
    'R': '#f6c840', 'r': '#a87818',                   # gold badge
    'X': '#4a4852', 'x': '#24222a', 'v': '#24222a',   # black shoes, cap band, visor (v = x: a near
    # twin of the outline K read as a second outline at 1x; merged, wave 1 verify)
    'T': '#fbfbf6', 't': '#c8ccd6',                   # paper
    'E': '#d83a34',                                   # red ticket header, the tongue
    'w': '#fbfbf6',                                   # eye white (= the paper T: merged, wave 1 verify)
    # soot (burn death): merged into existing colours, no new ones
    '0': '#121726', '1': '#262a38', '2': '#5c6276',
    # FX letters: colours of the shared FX ramp (rules.json fxRamp), outside the budget
    'F': '#fffbd8', 'f': '#ffd040', 'c': '#ff8a24', 'e': '#e0401c', 'W': '#ffffff', 'y': '#ffe070',
    'D': '#7a6e70', 'd': '#4a4046', 'I': '#ffffff', 'i': '#bfe4ff',
}
FX_LETTERS = 'FfceWyDdIi'
DARK = {'Y': 'U', 'V': 'U', 'U': 'Q', 'E': 'r', 'A': 'h', 'H': 'h', 'h': 'Q', 'R': 'r', 'r': 'Q',
        'T': 't', 't': 'n', '0': '0', '1': '0', '2': '0'}

# Skin b and c (contract: skinB / skinC with hair A): the variant colours.
SKIN_B = {'L': '#e8b890', 'S': '#c98b62', 's': '#a1643f', 'z': '#5e3424',
          'A': '#4a3a30', 'H': '#2c221c', 'h': '#1a1410'}
SKIN_C = {'L': '#b77a52', 'S': '#8a5236', 's': '#663a26', 'z': '#3c2016',
          'A': '#4a3a30', 'H': '#2c221c', 'h': '#1a1410'}


def grid(t):
    return K.grid(t)


def edit(rows, changes):
    return HK.edit(rows, changes)


# ------------------------------------------------------------------------------------ heads
# 16 x 15, neck (6, 14). Rows 0-5 the cap (crown, gold badge, band, visor peak forward), rows 6-14
# the face in profile (facing right). Light from the upper front.
CAP = grid("""
    .....qjjjjq.....
    ...qjjJJJJJjq...
    ..qjjJJJJRRJJq..
    ..qjjjJJJRrJJJq.
    ..QqqqqqqqqqqqqX
    ...xxxxxxxxxxvvv
""")
FACE = grid("""
    ...hhhsssssss...
    ...hhHSSSQQQS...
    ...QhSSSSSwQSL..
    ...QszsSSSSSSSL.
    ....szsSSSSSsSs.
    ....QSSSSSSSSS..
    .....QsSSSzzzzs.
    ......zsSSSSSs..
    .......zzssss...
""")
# curly hair (look c): the curls bulge out under the cap at the back and over the ear
FACE_C = grid("""
    ..hHhhsssssss...
    .hHhHhSSSQQQS...
    .hAhhSSSSSwQSL..
    ..hHhzsSSSSSSSL.
    ..hhszsSSSSSsSs.
    ...hQSSSSSSSSS..
    .....QsSSSzzzzs.
    ......zsSSSSSs..
    .......zzssss...
""")
# hair tops without the cap (rows 0-5): short (a) and curly (c)
TOP_A = grid("""
    ................
    ................
    .....hHHHHH.....
    ...hHHAAAAHHh...
    ..hHHAAHHAAHHs..
    ..hHHHHHHHHHHs..
""")
TOP_C = grid("""
    ................
    .....hH.hH......
    ...hHAAhHAAh....
    ..hHAAhHAAhHAh..
    .hHAhHAAhHAAhHs.
    .hHhHHhHHhHHhs..
""")

# expression edits on the face rows (row index in the full 15-row head, x, letters)
EXPR = {
    'fwd': [],
    'blink': [(8, 10, 'zz')],
    # BOETE!: brows down to the nose, the mouth wide open (dark inside, the tongue)
    'shout': [(7, 9, 'SSQQ'), (8, 10, 'wQ'), (11, 10, 'zQQ'), (12, 10, 'QEEQs'), (13, 10, 'zzs')],
    # licks the pencil: eyes half shut, the tongue out at the lips
    'lick': [(8, 10, 'zQ'), (12, 10, 'zzQE'), (13, 12, 'Es')],
    # looks down at the book (lids low, the mouth pursed)
    'down': [(7, 9, 'SSSS'), (8, 10, 'QQ'), (12, 11, 'zz.')],
    # smug: the chin up, half-shut eyes, a thin satisfied smile
    'smug': [(7, 9, 'QQQ'), (8, 10, 'zQ'), (12, 10, 'SzzzQ')],
    # happy (photo): eyes squeezed into arcs, a wide grin
    'happy': [(7, 9, 'SQQS'), (8, 10, 'QS'), (11, 10, 'zzzz'), (12, 10, 'QwwwQ'), (13, 10, 'zzs')],
    # panic: brows up, wide white eyes, the mouth an open O
    'panic': [(6, 9, 'QQQ'), (7, 9, 'SSSS'), (8, 9, 'wwQ'), (11, 11, 'zQz'), (12, 11, 'QEQ'), (13, 11, 'zQz')],
    # hurt: the eye squeezed shut, the teeth clenched
    'hurt': [(7, 9, 'SQQS'), (8, 9, 'SzzQ'), (11, 10, 'zzzz'), (12, 10, 'wQwQs')],
    # dazed: an empty stare (the pupil lost), the mouth slack
    'dazed': [(7, 9, 'SSSS'), (8, 10, 'Qz'), (12, 10, 'SzQz')],
    # soot (burn): wide white eyes in the blackened face, the mouth agape
    'soot': [(8, 9, 'wwQ'), (11, 11, 'zQz'), (12, 11, 'QQQ')],
    'sootblink': [(8, 9, 'zzz'), (11, 11, 'zQz'), (12, 11, 'QQQ')],
}


def head_rows(expr='fwd', cap=True, look='a'):
    face = FACE_C if look == 'c' else FACE
    top = CAP if cap else (TOP_C if look == 'c' else TOP_A)
    rows = top + face
    return edit(rows, [(y, x, s) for y, x, s in EXPR[expr]])


def install_heads(look):
    """Every head expression with the cap ('fwd', 'shout' ...) and without it ('nc_hurt' ...)."""
    nk = {'neck': (6, 14)}
    for e in EXPR:
        P.HEADS[e] = (head_rows(e, True, look), nk)
        P.HEADS['nc_' + e] = (head_rows(e, False, look), nk)


# ------------------------------------------------------------------------------------ torsos
# The sample's vest torso: navy collar and shoulders, the yellow hi-vis with two silver bands, the
# radio on the chest, the black belt with its silver buckle.
TORSO = grid("""
    ..VYYqJJjYY..
    .VYYYYjJjYYY.
    VUYYYYYjNnYYY
    VUYYYYYYNNYYY
    VUVYYYYYnNYYY
    VUVYYYYYYYYYY
    UgggGGGGGGGGG
    VUVYYYYYYYYYV
    UgggGGGGGGGGG
    VUVYYYYYYYYVV
    QxxxxxxxGgxxQ
""")
TAN = {'neck': (6.5, -2), 'pelvis': (6.5, 9), 'shN': (7.5, 2.5), 'shF': (4, 3.0)}
# breathing in: the chest lifts a row (the vest opens over the radio), the belt stays
TORSO_IN = grid("""
    ..VYYqJJjYY..
    .VYYYYjJjYYY.
    VUYYYYYjNnYYY
    VUYYYYYYNNYYY
    VUVYYYYYnNYYYY
    VUVYYYYYYYYYY
    UgggGGGGGGGGGG
    VUVYYYYYYYYYV
    UgggGGGGGGGGG
    VUVYYYYYYYYVV
    QxxxxxxxGgxxQ
""")


def install_torsos():
    P.TORSOS['up'] = (TORSO, TAN)
    P.TORSOS['in'] = (TORSO_IN, TAN)
    P.TORSOS['back'] = P.shear(P.TORSOS['up'], -2)
    P.TORSOS['back1'] = P.shear(P.TORSOS['up'], -1)
    P.TORSOS['lean1'] = P.shear(P.TORSOS['up'], 1)
    P.TORSOS['lean'] = P.shear(P.TORSOS['up'], 2)
    P.TORSOS['lean2'] = P.shear(P.TORSOS['up'], 3)


# ------------------------------------------------------------------------------------ hands
# Navy sleeve cuffs (J) instead of the hero's white shirt cuff.
HANDS = {
    'fist': (["JSS", "JSs", ".ss"], {'wrist': (0, 1)}),
    'open': (["JSSSS", "JSSSs", ".sss."], {'wrist': (0, 1)}),
    # palm down, the fingers spread (lets the page go)
    'drop': (["JSSSS", "JSsSs", ".s.s."], {'wrist': (0, 1)}),
    # pointing: the index finger out
    'point': (["JSS...", "JSSSSs", ".ss..."], {'wrist': (0, 1)}),
    # fingers up, the palm open (lets the page go above his cap)
    'up': ([".SS", "SSs", "SSs", "Ss.", "JJ."], {'wrist': (0.5, 4)}),
    # thumbs up (the photo pose)
    'thumb': ([".S..", ".SL.", "JSSS", "JSSs", ".ss."], {'wrist': (0, 3)}),
    # the shut ticket book held by its lower edge (navy cover, gold crest, the page block)
    'book': (grid("""
        .qJJJJJt
        .qJJJJJT
        .qJJrRJT
        .qJJJJJT
        .qJJJJJT
        JSSSSqqt
        JSSs....
        .ss.....
    """), {'wrist': (0, 5.5)}),
    # the book held open (the sample): two white pages, the right one half written, the red total
    'bookopen': (grid("""
        ...tTTqTTt.
        ..tTttqTEtt
        .tTTTTqTttT
        JStTttqTTTt
        JSqqqqqqqqq
        .ss........
    """), {'wrist': (0, 3.5)}),
    # the writing fist with the pencil (yellow, the graphite tip down on the page)
    'pencil': (grid("""
        ..Y.
        ..V.
        JSSV
        JSSN
        .ss.
    """), {'wrist': (0, 3)}),
    # the pencil at the lips (the tip up)
    'pencilup': (grid("""
        .N..
        .Y..
        .V..
        SSS.
        SSs.
        JJ..
    """), {'wrist': (0.5, 5)}),
    # the sample's wind-up: the near hand pinching the ticket, the paper fluttering up and back
    'ticket': (grid("""
        ...tTT...
        ..tTTTTE.
        .tTTTTEE.
        tTTTTtE..
        .tTTt....
        ..JSS....
        ..JSSs...
        ...ss....
    """), {'wrist': (2.5, 6.5)}),
    # the torn page held up by its lower edge (gloat)
    'page': (grid("""
        .tTTTt.
        tTEEETt
        tTTTTTt
        tTtttTt
        tTTTTTt
        .tSSt..
        ..SSs..
        ..JJ...
    """), {'wrist': (2.5, 7)}),
    # tearing: the fingers pinch a page off the book (the far hand holds the book below)
    'tear': (grid("""
        .tTt.
        tTTTt
        tSSTt
        JSSs.
        JSs..
    """), {'wrist': (0, 3.5)}),
}


def install_hands():
    for k, v in HANDS.items():
        P.HANDS[k] = v
    P.FISTS['fist'] = HANDS['fist']


# ------------------------------------------------------------------------------------ items
def cap_item(deg=0):
    """The loose cap (it flies off in a fall), turned by deg."""
    rows = [r for r in CAP]
    w = max(len(r) for r in rows) + 8
    pad = ['.' * w] * 4
    rows = pad + ['....' + r.ljust(w - 8, '.') + '....' for r in rows] + pad
    if deg:
        rows = rig.rotsprite(rows, (w / 2, 7), deg)
    x0, y0, x1, y1 = K.bbox(rows)
    rows = [r[x0:x1] for r in rows[y0:y1]]
    return rows, {'c': ((x1 - x0) / 2 - 0.5, (y1 - y0) / 2 - 0.5)}


def install_items():
    for i, d in enumerate((0, 35, 90, 160, 200, 300, 0)):
        P.ITEMS[f'cap{i}'] = cap_item(d)
    # the cap lying on the ground, crown down? no: on its side, the peak up (it lands as a bowl)
    P.ITEMS['capfloor'] = cap_item(0)
    P.ITEMS['book'] = (grid("""
        qJJJJt
        qJrRJT
        qJJJJT
        qqqqqt
    """), {'c': (2.5, 1.5)})
    P.ITEMS['bookopen'] = (grid("""
        tTTqTTt
        tTtqTEt
        qqqqqqq
    """), {'c': (3, 1)})
    P.ITEMS['ticket'] = (grid("""
        tTTTt
        tEEEt
        tTtTt
    """), {'c': (2, 1)})


# ------------------------------------------------------------------------------------ install
def install(look='a'):
    K.palette(PAL, dark=DARK, letters='QAHhLSszJjqPpoOYVUGgnNRrXxvTtEw')
    install_heads(look)
    install_torsos()
    install_hands()
    install_items()
    pose.RAMP['arm'] = ['J', 'j', 'q', 'Q']
    pose.RAMP['armF'] = ['j', 'q', 'Q', 'Q']
    pose.RAMP['leg'] = ['P', 'p', 'o', 'O']
    pose.RAMP['legF'] = ['p', 'o', 'O', 'O']
