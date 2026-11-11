# The delivery rider's own drawn parts and palette (the look of the cast spike's approved sample,
# docs/design/cast40/chars/delivery-rider.py): the black bike helmet in every expression, the slate
# jacket with the green collar and cuffs, black gloves (grip, bell thumb, phone, open, peace sign),
# black trousers and shoes, the big green cube backpack with the plain burger, the FX letters on the
# shared FX ramp.
#
# install() patches the shared kit tables (one set per process, bake.py). Skins a and c are palette
# variants of skin b (the base id; contract: a separate rendered style per skin = a palette swap).
import castkit as K
import limbs as HK

P = K.P
pose = K.pose

# ------------------------------------------------------------------------------------ palette
# 28 colours (plan D1): the outline K, skin (L S s z), the eye white w, the deepest slate Q (lines,
# brows, mouth), the slate jacket (J j q), the black gear ramp (A P p o O: helmet, gloves,
# trousers, shoes, tyres, saddle), the green trim and cube (C E U V), the stone bike frame
# (G g n N), chrome (T t: bell, rims, stem), the burger (Y Z), the red tail light / tongue (R).
# The helmet (H h), shoes (X x v) share the black gear colours (merged by the bake). The soot of
# the burn death maps onto existing colours. FX letters (outside the budget): the shared FX ramp.
PAL = {
    'K': '#140c0e',                                                      # the one warm near-black outline
    'L': '#f2c995', 'S': '#d9a36e', 's': '#b07d55', 'z': '#85583c',      # skin b (the base id)
    'w': '#fffaf0',
    'Q': '#1c1f2b',                                                      # lines, deepest slate
    'J': '#7d8aa0', 'j': '#58657a', 'q': '#3b4457',                      # slate jacket
    'A': '#6c7180', 'P': '#4f5360', 'p': '#3a3d48', 'o': '#282a33', 'O': '#1b1c23',   # black gear
    'C': '#93c94f', 'E': '#529a38', 'U': '#2f6d2f', 'V': '#1b4529',      # green trim + cube
    'G': '#beb1a2', 'g': '#8e827a', 'n': '#635857', 'N': '#3d3437',      # stone bike frame
    'T': '#eef1f5', 't': '#a9b0bd',                                      # chrome (bell, rims)
    'Y': '#f6c537', 'Z': '#c98c22',                                      # burger bun
    'R': '#d4423a',                                                      # tail light, tongue
    'H': '#4f5360', 'h': '#282a33',                                      # helmet = black gear
    'X': '#4f5360', 'x': '#282a33', 'v': '#1b1c23',                      # shoes = black gear
    # soot (burn death): existing colours
    '0': '#1c1f2b', '1': '#282a33', '2': '#635857',
    # FX letters: colours of the shared FX ramp (rules.json fxRamp), outside the budget
    'F': '#fffbd8', 'f': '#ffd040', 'c': '#ff8a24', 'e': '#e0401c', 'W': '#ffffff', 'y': '#ffe070',
    'D': '#7a6e70', 'd': '#4a4046', 'I': '#ffffff', 'i': '#bfe4ff',
}
FX_LETTERS = 'FfceWyDdIi'
DARK = {'C': 'U', 'E': 'U', 'U': 'V', 'V': 'V', 'G': 'n', 'g': 'n', 'n': 'N', 'N': 'N', 'T': 't',
        't': 'n', 'Y': 'Z', 'Z': 'z', 'A': 'h', 'H': 'h', 'h': 'h', 'J': 'Q', 'j': 'Q', 'q': 'Q',
        'R': 'z', 'P': 'o', 'p': 'o', 'o': 'O', 'O': 'O', '0': '0', '1': '0', '2': '0'}

# Skins a and c (contract: skinA / skinC): only the four skin tones change.
SKIN_A = {'L': '#ffe2cc', 'S': '#f2b694', 's': '#d08668', 'z': '#8e4c3c'}
SKIN_C = {'L': '#b77a52', 'S': '#8a5236', 's': '#663a26', 'z': '#3c2016'}


def grid(t):
    return K.grid(t)


def edit(rows, changes):
    return HK.edit(rows, changes)


# ------------------------------------------------------------------------------------ heads
# 15 x 14, neck (5, 12): the sample's head. Rows 0-5 the black helmet (lit dome, two vents, the
# rim), rows 6-13 the face in profile (facing right) with the chin strap down the cheek.
HEAD = grid('''
    ....hhHHHHh....
    ..hhHHAAAAHH...
    .hHHhAAAHAAHH..
    hHHHHhHHHhHHHH.
    hhHHHHHHHHHHHHh
    hhhhhhhhhhhhhhh
    .hhhzsSSSQQQS..
    .hhhszsSSwQSSL.
    ..hhzsSSSSSSSs.
    ...hhsSSSSSss..
    ....hsSSzQQQs..
    .....hsSSSSs...
    ......zssssz...
    .....hzsz......
''')

# expression edits (row, x, letters) on the face rows
EXPR = {
    'fwd': [],
    'blink': [(7, 9, 'zz')],
    # TRING TRING!: brows down, the mouth wide open (teeth, the dark inside)
    'shout': [(6, 8, 'QQQS'), (9, 9, 'zzz'), (10, 8, 'zwwwQ'), (11, 9, 'QQQ')],
    # looks down at the phone: the lid low, the mouth set
    'down': [(6, 9, 'SSS'), (7, 9, 'QQ'), (10, 9, 'zQ.')],
    # reading the phone, a smirk
    'smirk': [(6, 9, 'SQQ'), (7, 9, 'QQ'), (10, 9, 'zzQ')],
    # happy (photo): eyes squeezed into arcs, a wide grin
    'happy': [(6, 9, 'QQQ'), (7, 9, 'SQ'), (9, 9, 'zzz'), (10, 8, 'zwwwz'), (11, 9, 'zz')],
    # smug (gloat): the chin up, half-shut eyes, a thin smile
    'smug': [(6, 9, 'QQQ'), (7, 9, 'zQ'), (10, 8, 'SzzzQ')],
    # panic: brows up into the rim, wide white eyes, the mouth an open O
    'panic': [(6, 9, 'SSS'), (5, 9, 'QQQ'), (7, 9, 'wwQ'), (10, 9, 'zQz'), (11, 9, 'QRQ')],
    # hurt: the eye squeezed shut, the teeth clenched
    'hurt': [(6, 9, 'QQQ'), (7, 9, 'zzQ'), (10, 8, 'zwQwz')],
    # dazed: an empty stare, the mouth slack
    'dazed': [(6, 9, 'SSS'), (7, 9, 'Qz'), (10, 8, 'SzQz')],
    # effort (the kick): brows down, teeth bared
    'grit': [(6, 8, 'QQQS'), (7, 9, 'wQ'), (10, 8, 'zwwwz')],
    # soot (burn): wide white eyes in the blackened face, the mouth agape
    'soot': [(7, 9, 'wwQ'), (10, 9, 'zQz'), (11, 9, 'QQQ')],
    'sootblink': [(7, 9, 'zzz'), (10, 9, 'zQz'), (11, 9, 'QQQ')],
}


def head_rows(expr='fwd'):
    return edit(list(HEAD), [(y, x, s) for y, x, s in EXPR[expr]])


def install_heads():
    nk = {'neck': (5, 12)}
    for e in EXPR:
        P.HEADS[e] = (head_rows(e), nk)


# ------------------------------------------------------------------------------------ torsos
# 12 x 11: the slate jacket, the green collar, green piping down the zip, the hem.
TORSO = grid('''
    .qjjJECCCCC.
    qjjjJJEECJJ.
    qjjjjJJJJEJJ
    qjjjjjJJJEJJ
    qjjqjjJJJEJJ
    qjjqjjjJJEJJ
    qjjjqjjjJEJj
    qjjjqjjjJEJj
    qqjjjqjjjEjq
    Qqjjjjqjjjjq
    .QqqqqqqqqQ.
''')
TAN = {'neck': (6, -2), 'pelvis': (6, 9), 'shN': (6.5, 2.5), 'shF': (3.5, 3.0)}
# breathing in: the chest swells a column forward
TORSO_IN = grid('''
    .qjjJECCCCC.
    qjjjJJEECJJ.
    qjjjjJJJJEJJ.
    qjjjjjJJJEJJJ
    qjjqjjJJJEJJJ
    qjjqjjjJJEJJ
    qjjjqjjjJEJj
    qjjjqjjjJEJj
    qqjjjqjjjEjq
    Qqjjjjqjjjjq
    .QqqqqqqqqQ.
''')


def install_torsos():
    P.TORSOS['up'] = (TORSO, TAN)
    P.TORSOS['in'] = (TORSO_IN, TAN)
    for name, k in (('back', -2), ('back1', -1), ('lean1', 1), ('lean', 2), ('lean2', 3), ('lean3', 4), ('lean4', 5)):
        P.TORSOS[name] = P.shear(P.TORSOS['up'], k)


# ------------------------------------------------------------------------------------ hands
# Black gloves (P p o), the green cuff band is painted on the sleeve (the 'pat' hook).
HANDS = {
    'grip': (['PPP', 'PPp', '.op'], {'wrist': (0, 1), 'grip': (1.5, 1)}),
    # the thumb up on the bell lever
    'thumb': (['...A', 'PPPp', 'PPp.', '.op.'], {'wrist': (0, 1.5), 'grip': (1.5, 2)}),
    # the thumb pressed down (the bell rings)
    'thumbdn': (['PPPA', 'PPpp', '.op.'], {'wrist': (0, 1), 'grip': (1.5, 1)}),
    'fist': (['PPP', 'PPp', '.op'], {'wrist': (0, 1)}),
    'open': (['PPPPA', 'PPPpp', '.ooo.'], {'wrist': (0, 1)}),
    # peace sign (photo): two fingers up
    'peace': (['.A.A', '.P.P', 'PPPp', 'PPpp', '.op.'], {'wrist': (0, 3)}),
    # the phone in the glove, its lit screen toward his face (FX blues)
    'phone': (grid('''
        .OOO
        IiiO
        iiiO
        iiiO
        PPPO
        PPp.
        .op.
    '''), {'wrist': (0, 5)}),
    # the phone held up to the ear / glanced at (seen from its back: the black case)
    'phoneback': (grid('''
        .ooO
        oOOO
        oOOO
        oOOi
        PPPO
        PPp.
        .op.
    '''), {'wrist': (0, 5)}),
}


def install_hands():
    for k, v in HANDS.items():
        P.HANDS[k] = v
    P.FISTS['fist'] = HANDS['fist']


# ------------------------------------------------------------------------------------ shoes
SHOES = {
    'flat': (grid('''
        xxxx....
        xxxXXx..
        xxxxxXXx
        vvvvvvvv
    '''), {'ankle': (2, 0)}),
    'toe': (grid('''
        xxx....
        xxxX...
        xxxxXx.
        .vxxxXx
        ..vvvvv
    '''), {'ankle': (1, 0)}),
}


def install_shoes():
    for k, v in SHOES.items():
        P.SHOES[k] = v


# ------------------------------------------------------------------------------------ the cube
# The green cube backpack (13 x 13): the lit top face, the side with a plain burger, the straps.
CUBE = grid('''
    ..CCCCCCCCCCC
    .CCCCCCCCCCCE
    EEEEEEEEEEEEU
    EEEEEEEEEEEEU
    EEEUUUUUUEEEU
    EEUZYYYYZUEEU
    EEUCECECCUEEU
    EEUzzzzzzUEEU
    EEUZZYYZZUEEU
    EEEUUUUUUEEEU
    EEEEEEEEEEEEU
    EEEEEEEEEEEUU
    UUUUUUUUUUUV.
''')
# the cube burst open (the lid flipped up, the burger peeking out): the food-cube prop
CUBE_OPEN = grid('''
    .........CCCC
    ........CCCCE
    .......CCCCE.
    ..YYYYYZ.EE..
    .YYYYYYYZ....
    EzzzzzzzzEEEU
    EECECECECEEEU
    EEUUUUUUUEEEU
    EEUZYYYYZUEEU
    EEUCECECCUEEU
    EEUzzzzzzUEEU
    EEUZZYYZZUEEU
    EEEUUUUUUEEEU
    EEEEEEEEEEEUU
    UUUUUUUUUUUV.
''')


# ------------------------------------------------------------------------------------ install
def install():
    K.palette(PAL, dark=DARK, letters='LSszwQJjqAPpoOCEUVGgnNTtYZRHhXxv012')
    install_heads()
    install_torsos()
    install_hands()
    install_shoes()
    pose.RAMP['arm'] = ['J', 'j', 'q', 'Q']
    pose.RAMP['armF'] = ['j', 'q', 'Q', 'Q']
    pose.RAMP['leg'] = ['P', 'p', 'o', 'O']
    pose.RAMP['legF'] = ['p', 'o', 'O', 'O']
    pose.HOOKS['pat'] = cuff


def cuff(part, u, v, k, ch):
    """The green trim: a band round each jacket cuff."""
    if part.startswith('arm') and u > pose.UPPER + pose.FORE - 1.6:
        return ['C', 'E', 'U', 'V'][min(3, k + (1 if part.endswith('F') else 0))]
    return ch
