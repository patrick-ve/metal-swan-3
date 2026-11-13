# The street people of mission sewers (docs/design/sewers.md §3) at 40 px: the palettes and the drawn
# parts of every look (heads in every expression, torsos, hands, items, shoes). Shared code of the sets
# chars/sewers-dealer-a, -b, -c, sewers-pimp-a (+ the palette variant sewers-pimp-b),
# sewers-bodyguard-a (+ the palette variant sewers-bodyguard-b).
#
# Behaviours, not groups (spec §8, the lead's P1a rule): the crooks are crooks by what they do. The
# skin tones are spread over every crook: dealer a light, b middle, c dark; pimp a light, b middle;
# bodyguard a middle, b dark. No costume is tied to one skin tone.
#
# One letter scheme for every look, so the strips code is look-agnostic:
#   K outline, Q darkest (brows, lines), L S s z skin, w eye white and teeth, A H h hair,
#   J j q the top (hoodie, jacket, coat, suit; Q its darkest), P p o O the legs, X x v the shoes,
#   B b n the headgear (hood: the top ramp), T t the shirt or the lining, Y V U gold, G g steel and the
#   mint tins, M m mint green (the tins' labels, banknotes), E red (the tongue, the hat band).
# FX letters (the shared FX ramp, outside the budget): F f c e W y (the muzzle flash, stars, notes).
import castkit as K
import limbs as HK
import rig

P = K.P
pose = K.pose

FX_LETTERS = 'FfceWy'
HL = 'w'

BASE = {
    'K': '#140c0e',
    'Q': '#1c1218',
    'w': '#fffaf0',
    'E': '#d83a34',
    'G': '#e2e8f0', 'g': '#8a93a6',                     # steel, the mint tins
    'M': '#7ee0b0', 'm': '#2f9a72',                     # mint green
    'Y': '#ffe070', 'V': '#e8b028', 'U': '#9a6a12',     # gold
    # FX (rules.json fxRamp)
    'F': '#fffbd8', 'f': '#ffd040', 'c': '#ff8a24', 'e': '#e0401c', 'W': '#ffffff', 'y': '#ffe070',
}
DARK = {'Y': 'U', 'V': 'U', 'U': 'Q', 'G': 'g', 'g': 'Q', 'M': 'm', 'm': 'Q', 'E': 'Q', 'T': 't', 't': 'Q',
        'B': 'b', 'b': 'n', 'n': 'Q', 'A': 'h', 'H': 'h', 'h': 'Q', 'w': 's'}

# Skin tones (the handhaver's three tones, the game's skinA / skinB / skinC).
SKIN = {
    'a': {'L': '#ffe2cc', 'S': '#f2b694', 's': '#d08668', 'z': '#8e4c3c'},
    'b': {'L': '#e8b890', 'S': '#c98b62', 's': '#a1643f', 'z': '#5e3424'},
    'c': {'L': '#b77a52', 'S': '#8a5236', 's': '#663a26', 'z': '#3c2016'},
}
HAIR = {
    'brown': {'A': '#8a6040', 'H': '#5a3c28', 'h': '#33221a'},
    'black': {'A': '#4a3a34', 'H': '#2c221e', 'h': '#1a1412'},
    'ginger': {'A': '#d08a4a', 'H': '#a05a2c', 'h': '#62341c'},
}


def grid(t):
    return K.grid(t)


def edit(rows, changes):
    return HK.edit(rows, changes)


def mirror(rows):
    return [r[::-1] for r in rows]


# ------------------------------------------------------------------------------------ faces
# 16 x 9 (rows 6-14 of a 15-row head), facing right, light from the upper front: the ear (z) at
# x 4-6, the brow at x 9-11, the eye (w Q) at x 10-11, the nose to x 14, the mouth at x 10-13.
# The back of the head (x 3-5, rows 6-8) is the look's hair or headgear.
FACE = grid("""
    ...hhhSSSSSSs...
    ...hhHSSSQQQS...
    ...QhSSSSSwQSL..
    ...QszsSSSSSSSL.
    ....szsSSSSSsSs.
    ....QSSSSSSSSS..
    .....QsSSSzzzzs.
    ......zsSSSSSs..
    .......zzssss...
""")
# expression edits (row in the full 15-row head, x, letters)
EXPR = {
    'fwd': [],
    'blink': [(8, 10, 'zz')],
    # sly (the whisper, the strut): the lid half down, a crooked smirk
    'sly': [(7, 9, 'SQQQ'), (8, 10, 'zQ'), (12, 10, 'SSzzQ')],
    # the whisper: the side eye, the lips pushed out in a small o
    'psst': [(7, 9, 'QQQ'), (8, 10, 'Qw'), (11, 12, 'zz'), (12, 12, 'QQ'), (13, 12, 'zs')],
    # shout (JONGENS!, the flee): brows down, the mouth wide open, the tongue
    'shout': [(7, 9, 'SSQQ'), (8, 10, 'wQ'), (11, 10, 'zQQ'), (12, 10, 'QEEQs'), (13, 10, 'zzs')],
    # the whistle: two fingers at the lips, the cheeks puffed
    'whistle': [(7, 9, 'QQQ'), (8, 10, 'zQ'), (10, 11, 'SSL'), (11, 11, 'SSSL'), (12, 10, 'zzQQ')],
    # smug (the gloat): the chin up, half-shut eyes, a thin smile
    'smug': [(7, 9, 'QQQ'), (8, 10, 'zQ'), (12, 10, 'SzzzQ')],
    # happy (the photo): eyes squeezed into arcs, a wide grin
    'happy': [(7, 9, 'SQQS'), (8, 10, 'QS'), (11, 10, 'zzzz'), (12, 10, 'QwwwQ'), (13, 10, 'zzs')],
    # grit (the jab, the charge, the shot): the teeth bared, the brow knotted
    'grit': [(7, 9, 'SQQQ'), (8, 10, 'zQ'), (11, 10, 'zzzz'), (12, 10, 'QwQwQ'), (13, 10, 'zzs')],
    # panic: brows up, wide white eyes, the mouth an open O
    'panic': [(6, 9, 'QQQ'), (7, 9, 'SSSS'), (8, 9, 'wwQ'), (11, 11, 'zQz'), (12, 11, 'QEQ'), (13, 11, 'zQz')],
    # hurt: the eye squeezed shut, the teeth clenched
    'hurt': [(7, 9, 'SQQS'), (8, 9, 'SzzQ'), (11, 10, 'zzzz'), (12, 10, 'wQwQs')],
    # dazed: an empty stare, the mouth slack
    'dazed': [(7, 9, 'SSSS'), (8, 10, 'Qz'), (12, 10, 'SzQz')],
    # looking down (counting his money, the knuckles)
    'down': [(7, 9, 'SSSS'), (8, 10, 'QQ'), (12, 11, 'zz.')],
}


# ------------------------------------------------------------------------------------ head tops
# rows 0-5 (16 wide) and the face columns the headgear covers
TOPS = {}
# dealer a: the grey hood up, its lit rim round the face, the face in its shadow
TOPS['hood'] = grid("""
    ......qqqq......
    ....qqjjjjJq....
    ...qjjjjjjJJJq..
    ..qjjjjjjjjJJJq.
    .qqjjjjjjjjjJJJq
    .qqjjjjjjjQQQQJq
""")
HOOD_SIDE = [   # rows 6-14: the hood over the back of the head and the ear, its lit rim at x 7
    (6, 1, 'qqjjjjJQss'),
    (7, 1, 'qqjjjjJs'),
    (8, 1, 'qqjjjjJ'),
    (9, 1, 'qqjjjjJ'),
    (10, 1, 'qqjjjjJ'),
    (11, 1, 'qqjjjJs'),
    (12, 2, 'qqjjJ'),
    (13, 2, 'qqqjJ'),
    (14, 3, 'qqqj'),
]
# dealer b: a black knitted beanie with the folded cuff
TOPS['beanie'] = grid("""
    ................
    .....nbBBBb.....
    ...nbBBBBBBBb...
    ..nbBBBBBBBBBb..
    ..nnbnbnbnbnbnb.
    ..nbnbnbnbnbnbn.
""")
# dealer c: a flat cap (tweed brown), the short peak forward
TOPS['flatcap'] = grid("""
    ................
    ................
    .....nbbBBBb....
    ...nbbBBBBBBBb..
    ..nbbbbBBBBBBBBb
    ..nnnbbbbbbbbnnn
""")
# the pimp: a wide-brim hat with the band (18 wide: the face moves 1 px right)
TOPS['widehat'] = grid("""
    ......nbBBBBb.....
    .....nbbBBBBBb....
    .....nbbBBBBBBb...
    .....nEEEEEEEEE...
    .nnbbbbBBBBBBBBBb.
    nnnnbbbbbbbbbbbnnn
""")
# the bodyguard: a close-cropped skull (look a: the letters are skin, bald; look b: a buzz cut)
TOPS['crop'] = grid("""
    ................
    ................
    .....hHHHHh.....
    ...hHHHHAAAHh...
    ..hHHHHHHAAAHH..
    ..hHHHHHHHHHHH..
""")
# bare heads (the hat or cap lost in the swoon)
TOPS['hair'] = grid("""
    ................
    ................
    .....hHHHHH.....
    ...hHHAAAAHHh...
    ..hHHAAHHAAHHs..
    ..hHHHHHHHHHHs..
""")


def head_rows(top, expr='fwd', side=None, extra=None, shades=False, pad=0):
    """The 15-row head: the top rows, the face (moved pad px right), the side cover, the expression,
    the extras (moustache, earpiece), the sunglasses."""
    face = ['.' * pad + r + '.' * max(0, len(top[0]) - 16 - pad) for r in FACE]
    rows = [r.ljust(len(face[0]), '.') for r in top] + face
    rows = edit(rows, [(y, x + pad, s) for y, x, s in EXPR[expr]])
    if side:
        rows = edit(rows, [(y, x + pad, s) for y, x, s in side])
    if extra:
        rows = edit(rows, [(y, x + pad, s) for y, x, s in extra])
    if shades:
        rows = edit(rows, [(y, x + pad, s) for y, x, s in SHADES])
    return rows


# the sunglasses: a black lens over the eye, the glint, the arm back to the ear
SHADES = [(7, 6, 'QQQQ'), (8, 8, 'QQGQQ'), (8, 6, 'QQ')]
SHADES_EXPR_OK = ('fwd', 'smug', 'shout', 'grit', 'happy', 'hurt', 'down', 'blink')
# the bodyguard's earpiece: the coiled wire from the ear down the neck
EARPIECE = [(9, 5, 'G'), (10, 5, 'g'), (11, 5, 'G'), (12, 6, 'g'), (13, 6, 'G')]
# the pimp's pencil moustache
MOUSTACHE = [(11, 10, 'hhhh')]
# dealer b: a thin chin-strap beard; dealer c: a neat short beard on the jaw
STUBBLE = [(13, 7, 'hhh'), (14, 8, 'hh')]
BEARD = [(12, 6, 'hh'), (13, 7, 'hhhhh'), (14, 8, 'hhhh')]
SIDEBURN = [(6, 3, 'hhh'), (7, 3, 'hhH'), (8, 4, 'h')]


def install_heads(top, side=None, extra=None, shades=False, nc_top=None, pad=0, neck=(6, 14)):
    """Every expression (P.HEADS[e]), looking back ('back_' + e: the head mirrored), and without the
    headgear / sunglasses ('nc_' + e, lost in the swoon)."""
    nk = {'neck': (neck[0] + pad, neck[1])}
    for e in EXPR:
        rows = head_rows(top, e, side, extra, shades, pad)
        P.HEADS[e] = (rows, nk)
        w = len(rows[0])
        P.HEADS['back_' + e] = (mirror(rows), {'neck': (w - 1 - nk['neck'][0], nk['neck'][1])})
        nrows = head_rows(nc_top or top, e, None if nc_top else side, extra, False, pad)
        P.HEADS['nc_' + e] = (nrows, nk)


# ------------------------------------------------------------------------------------ torsos
TORSOS = {}
# dealer a: the zip hoodie (12 x 13): the hood falls from the head down the back, the zip, the
# drawstrings, the pouch pocket the hands sit in, the ribbed hem
TORSOS['hoodie'] = grid("""
    .qjJq.......
    qjjJJq......
    qjjjJJJJJJ..
    qjjjJJJwJJJ.
    qjjjjJJJwqJJ
    qjjjjJJJwqJJ
    qjjqjjJJJqJJ
    qjjqjjJqqqqj
    qjjjqjjqJJJj
    qjjjqjjqJJJj
    qqjjjqjqjjJq
    Qqjjjjqqjjjq
    .Qqqqqqqqqq.
""")
# the bomber jacket (dealer b): the ribbed collar, the sleeve pocket, the ribbed waist
TORSOS['bomber'] = grid("""
    ..qQQq......
    .qQjjQq.....
    qjjjJJJJJJ..
    qjjjJJJJJqJ.
    qjjjjJJJJqJJ
    qjjjjJJJJqJJ
    qjjqjjJJJqJJ
    qjjqjjJJJqJJ
    qjjjqjJJJqJj
    qjjjjjJJJqJj
    qqjjjjjjjqjq
    QQQQQQQQQQQQ
    .QnQnQnQnQn.
""")
# the long camel coat (dealer c): the lapel, the belt line, the skirt over the thighs
TORSOS['coat'] = grid("""
    ..qjq.......
    .qjjJq......
    qjjjJJJJJJ..
    qjjjJJJJqTJ.
    qjjjjJJJJqTJ
    qjjjjJJJJJqJ
    qjjqjjJJJJqJ
    qjjqjjJJJJqJ
    qjjjqjJJJJqj
    qqqqqqqqqqqq
    qjjjjjJJJJqj
    qjjjjjJJJqJj
    qjjjjjjJJqJj
    qjjjjjjJJqjq
    .qjjjjjjjqq.
    ..qqqqqqqq..
""")
# the pimp's suit jacket: the wide lit lapels, the open shirt collar, two gold chains, the pocket square
TORSOS['suit'] = grid("""
    ..qjq.......
    .qjJJq......
    qjjjJJJTTJ..
    qjjjJJJqTTJ.
    qjjjjJJJqYTJ
    qjjjjJJJJqVJ
    qjjqjJEJJqYJ
    qjjqjJJJJVqJ
    qjjjqjJJJqJj
    qjjjqjJJJqJj
    qqjjjqjjjqjq
    Qqjjjjqjjjjq
    .Qqqqqqqqqq.
""")
# the bodyguard's black suit (16 x 13): square shoulders, the white shirt, the black tie, the lapel
TORSOS['bigsuit'] = grid("""
    ...qjjq.........
    .qjjJJJjq.......
    qjjjJJJJJJJJTq..
    qjjjJJJJJJJqTQJ.
    qjjjjJJJJJJqTQJJ
    qjjjjJJJJJJJqTQJ
    qjjqjjJJJJJJqTQJ
    qjjqjjJJJJJJqTQJ
    qjjjqjjJJJJJJqTJ
    qjjjqjjJJJJJJqTj
    qqjjjqjjjJJJJqqj
    Qqjjjjqjjjjjjjjq
    .Qqqqqqqqqqqqqq.
""")
TAN = {
    'hoodie': {'neck': (6, 0), 'pelvis': (6, 11), 'shN': (6.5, 4.5), 'shF': (3.5, 5.0)},
    'bomber': {'neck': (6, 0), 'pelvis': (6, 11), 'shN': (6.5, 4.5), 'shF': (3.5, 5.0)},
    'coat': {'neck': (6, 0), 'pelvis': (6, 9.5), 'shN': (6.5, 4.5), 'shF': (3.5, 5.0)},
    'suit': {'neck': (6, 0), 'pelvis': (6, 11), 'shN': (6.5, 4.5), 'shF': (3.5, 5.0)},
    'bigsuit': {'neck': (7, 0), 'pelvis': (7.5, 11), 'shN': (9, 4.0), 'shF': (4, 4.5)},
}


def opened(rows, lining_col, x0, x1, y0, y1, tins=True):
    """The coat held open: the front from x0 to x1, rows y0..y1 shows the lining (T t) with the
    rows of mint tins (G g with the mint label M) hanging in it."""
    out = [list(r) for r in rows]
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if out[y][x] != '.':
                out[y][x] = 't' if x == x0 else 'T'
    if tins:
        for ty in range(y0 + 1, y1, 3):
            for tx in range(x0 + 1, x1, 3):
                if tx + 1 <= x1 and ty + 1 <= y1:
                    out[ty][tx], out[ty][tx + 1] = 'G', 'M'
                    out[ty + 1][tx], out[ty + 1][tx + 1] = 'g', 'm'
    return [''.join(r) for r in out]


def flap(rows, y0, y1):
    """The coat flap pulled forward and held open: the front edge stands out 2 px past the chest."""
    w = max(len(r) for r in rows)
    out = [list(r.ljust(w + 2, '.')) for r in rows]
    for y in range(y0, y1 + 1):
        x = max(i for i, ch in enumerate(out[y]) if ch != '.')
        out[y][x + 1] = 'J'
        out[y][x + 2] = 'j' if y > y0 else 'J'
    return [''.join(r) for r in out]


def install_torso(name, rows=None, open_rows=None):
    rows = rows or TORSOS[name]
    tan = TAN[name]
    t = (rows, tan)
    P.TORSOS['up'] = t
    # breathing in: the chest swells a pixel at the front (rows 3-6), the shoulders and the hem stay
    w = max(len(r) for r in rows) + 1
    inn = []
    for y, r in enumerate(rows):
        r = r.ljust(w, '.')
        if 3 <= y <= 6:
            x = max(i for i, ch in enumerate(r) if ch != '.')
            r = r[:x + 1] + r[x] + r[x + 2:]
        inn.append(r)
    P.TORSOS['in'] = (inn, tan)
    for nm, k in (('back2', -3), ('back', -2), ('back1', -1), ('lean1', 1), ('lean', 2), ('lean2', 3), ('lean3', 4)):
        P.TORSOS[nm] = P.shear(t, k)
    if open_rows:
        o = (open_rows, tan)
        P.TORSOS['open'] = o
        P.TORSOS['open_lean1'] = P.shear(o, 1)
        P.TORSOS['open_back1'] = P.shear(o, -1)


# ------------------------------------------------------------------------------------ hands
def hands(cuff='J'):
    """The hands with the sleeve's cuff letter (J). Kinds: fist, open, up, point, thumb, peace, the
    knife, the gold pistol, the cane, the money, the grab (the coat flap), the ring fist."""
    c = cuff
    H = {
        'fist': ([f"{c}SS", f"{c}Ss", ".ss"], {'wrist': (0, 1)}),
        'ring': ([f"{c}SS", f"{c}YV", ".ss"], {'wrist': (0, 1)}),
        'open': ([f"{c}SSSS", f"{c}SSSs", ".sss."], {'wrist': (0, 1)}),
        'up': ([".SS", "SSs", "SSs", "Ss.", f"{c}{c}."], {'wrist': (0.5, 4)}),
        'wave': (["S.S.", "SSSs", "SSSs", "SSs.", f"{c}{c}.."], {'wrist': (0.5, 4)}),
        'point': ([f"{c}SS...", f"{c}SSSSs", ".ss..."], {'wrist': (0, 1)}),
        'thumb': ([".S..", ".SL.", f"{c}SSS", f"{c}SSs", ".ss."], {'wrist': (0, 3)}),
        'peace': (["S.S.", "S.S.", "SSs.", f"{c}SSs", f"{c}Ss.", ".s.."], {'wrist': (0, 3.5)}),
        # two fingers up to the lips (the whistle)
        'twofing': (["SS..", "SSs.", f"{c}Ss.", f"{c}s.."], {'wrist': (0, 2.5)}),
        # the flick knife: a short blade forward out of the fist (no blood, a comic glint)
        'knife': ([f"....GGW", f"{c}SSgGg.", f"{c}Ss....", ".ss...."], {'wrist': (0, 1.5), 'tip': (6, 0)}),
        # the knife held low and back (the tell: just out of the coat)
        'knifeup': ([".W.", ".G.", ".G.", "Sg.", "SSs", f"{c}Ss", ".s."], {'wrist': (0, 5)}),
        # the gold pistol (the pimp): the muzzle forward
        'pistol': (grid(f"""
            ..VYYYYYV
            {c}SSUVVVVVU
            {c}SSSUUV...
            .sssUU...
        """), {'wrist': (0, 1.5), 'muzzle': (9, 0.5)}),
        # the cane held at its gold knob (black lacquer, the ferrule)
        'cane': (grid(f"""
            .YV.
            {c}VUS
            {c}SSs
            .xs.
            .x..
            .x..
            .x..
            .x..
            .x..
            .x..
            .x..
            .v..
        """), {'wrist': (0, 1.5)}),
        # the cane tucked under the arm (the hand at the knob, the shaft back and up)
        'canetuck': (grid(f"""
            x.....
            .x....
            ..x...
            ...xYV
            ...{c}SS
            ...{c}Ss
            ....ss
        """), {'wrist': (3, 4.5)}),
        # a fan of banknotes (green, our own, no real money)
        'money': (grid(f"""
            .MMm.
            MMmMm
            mMMMm
            {c}SSm.
            {c}Ss..
            .s...
        """), {'wrist': (0, 4)}),
        # the coat flap grabbed and pulled open (the tell)
        'grab': ([f"{c}SS", f"{c}SS", ".ss"], {'wrist': (0, 1)}),
        # a finger to the earpiece (the bodyguard's gloat)
        'ear': ([".S.", "SS.", "SSs", f"{c}s."], {'wrist': (0, 3)}),
    }
    for k, v in H.items():
        P.HANDS[k] = v
        P.FISTS[k] = v


# ------------------------------------------------------------------------------------ shoes
SNEAKER = {
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
}


def install_shoes(sneaker):
    if sneaker:
        for k, v in SNEAKER.items():
            P.SHOES[k] = v


# ------------------------------------------------------------------------------------ the looks
# Every look: palette (on top of BASE), the head top, the side cover, extras, the torso, the ramps.
LOOKS = {
    # dealer a: grey zip hoodie, hood up; blue jeans; white sneakers; skin a
    'dealer-a': dict(
        pal=dict(SKIN['a'], **HAIR['brown'],
                 J='#b4b8c4', j='#80869a', q='#555a6e', T='#3a4458', t='#232a38',
                 P='#5a78b4', p='#3e5690', o='#2a3a68', O='#1a2244',
                 X='#f4f6f8', x='#b8c2d0', v='#6a7488'),
        top='hood', side=HOOD_SIDE, extra=None, torso='hoodie', sneaker=True,
        lining=(7, 11, 3, 10), nc_top=None),
    # dealer b: olive bomber jacket with the orange lining, black beanie; black joggers; skin b
    'dealer-b': dict(
        pal=dict(SKIN['b'], **HAIR['black'],
                 J='#8c9a58', j='#62703a', q='#3e4a26', T='#ff9a3c', t='#c45a1c',
                 B='#4c4c58', b='#30303a', n='#1c1218',
                 P='#4a4a56', p='#34343e', o='#24242c', O='#16161c',
                 X='#f4f6f8', x='#b8c2d0', v='#5a5e6e'),
        top='beanie', side=SIDEBURN, extra=STUBBLE, torso='bomber', sneaker=True,
        lining=(7, 11, 3, 10), nc_top='hair'),
    # dealer c: long camel coat with the dark red lining, a tweed flat cap; grey trousers; brown
    # shoes; skin c
    'dealer-c': dict(
        pal=dict(SKIN['c'], **HAIR['black'],
                 J='#d8a868', j='#a8783e', q='#6e4a22', T='#a03040', t='#5e1824',
                 B='#9a8a6a', b='#6c5e44', n='#34200f',
                 P='#6a6e7a', p='#4c505c', o='#343842', O='#20232a',
                 X='#8a5a34', x='#5e3a20', v='#34200f'),
        top='flatcap', side=SIDEBURN, extra=BEARD, torso='coat', sneaker=False,
        lining=(7, 11, 3, 13), nc_top='hair'),
    # pimp a: the purple suit and hat with the gold band, the pink shirt; skin a, ginger
    'pimp-a': dict(
        pal=dict(SKIN['a'], **HAIR['ginger'],
                 J='#b46ad8', j='#8442b0', q='#57247e',
                 P='#b46ad8', p='#8442b0', o='#57247e', O='#34124e',
                 B='#c47ee6', b='#8442b0', n='#4e1f72', E='#ffd040',
                 T='#ff9ec8', t='#c8608e',
                 X='#f4f2ea', x='#b8b2a4', v='#6e6656'),
        top='widehat', side=SIDEBURN, extra=MOUSTACHE, torso='suit', sneaker=False, pad=1,
        nc_top='hair'),
    # bodyguard a: the black suit, the white shirt, the sunglasses; bald (the crop letters are skin);
    # skin b
    'bodyguard-a': dict(
        pal=dict(SKIN['b'], A='#e8b890', H='#c98b62', h='#a1643f',
                 J='#5c6070', j='#3c3e4a', q='#26272f',
                 P='#4e525e', p='#363842', o='#24252c', O='#16161b',
                 T='#f4f4ee', t='#b4b8c2',
                 X='#4a4852', x='#24222a', v='#141218'),
        top='crop', side=None, extra=EARPIECE, torso='bigsuit', sneaker=False, shades=True,
        nc_top='crop'),
}
# the palette variants (the same pixels): pimp b (the white suit and hat, the red band, the black
# shirt; skin b, black hair) and bodyguard b (a black buzz cut over skin c)
PIMP_B = dict(SKIN['b'], **HAIR['black'],
              J='#f4f2ec', j='#c4c0b6', q='#86827a',
              P='#f4f2ec', p='#c4c0b6', o='#86827a', O='#4e4a44',
              B='#fbfaf6', b='#cfcac0', n='#8a857c', E='#d83a34',
              T='#3a3a44', t='#22222a',
              X='#2e2c34', x='#1c1a20', v='#0e0c10')
BODYGUARD_B = dict(SKIN['c'], **HAIR['black'])


def install(look):
    L = LOOKS[look]
    pal = dict(BASE, **L['pal'])
    K.palette(pal, dark=DARK, letters=''.join(pal))
    # the hood is the top ramp (its letters J j q)
    install_heads(TOPS[L['top']], L.get('side'), L.get('extra'), L.get('shades', False),
                  TOPS.get(L.get('nc_top')) if L.get('nc_top') else None, L.get('pad', 0))
    name = L['torso']
    rows = TORSOS[name]
    open_rows = None
    if L.get('lining'):
        x0, x1, y0, y1 = L['lining']
        open_rows = flap(opened(rows, None, x0, x1, y0, y1), y0 - 1, y1)
    install_torso(name, rows, open_rows)
    hands('J')
    install_shoes(L['sneaker'])
    pose.RAMP['arm'] = ['J', 'j', 'q', 'Q']
    pose.RAMP['armF'] = ['j', 'q', 'Q', 'Q']
    pose.RAMP['leg'] = ['P', 'p', 'o', 'O']
    pose.RAMP['legF'] = ['p', 'o', 'O', 'O']
    return L
