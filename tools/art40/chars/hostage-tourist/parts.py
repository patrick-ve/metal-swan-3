# The tied tourist's own drawn parts and palette (the look of the cast spike's approved sample,
# docs/design/cast40/chars/hostage-tourist.py): the khaki sun hat and the black shades in every
# expression, the bare head (the bow: the hat in his hand), the orange palm-print shirt with the flash
# camera on the chest (and without it: the camera lifted to the eye), the hands with orange cuffs, the
# camera, the gift box, the hat in the hand; the props the strips stand in: the wooden folding chair,
# the rope coils, the burlap sack, the hanging cage, the parachute canopy.
#
# install() patches the shared kit tables (one set per process, bake.py).
import math

import castkit as K
import limbs as HK
import rig

P = K.P
pose = K.pose

# ------------------------------------------------------------------------------------ palette
# 28 colours (plan D1): the outline K, darkest brown Q (lines, the shades), the sideburn h, skin
# (L S s z), the eye white / teeth w, the orange shirt (J j q), the green palm leaves (V Y), khaki
# trousers and hat (P p o O; the burlap sack shares the ramp), brown shoes, chair and bag (X x v),
# the camera and the cage steel (G g N), the rope (D d; the gift ribbon), the shade glint i, the red
# gift box, the sack stamp and the canopy stripes (R r). FX letters (the camera's click burst, motion
# lines) are colours of the shared FX ramp, outside the budget.
PAL = {
    'K': '#140c0e',                                                    # the one warm near-black outline
    'Q': '#1e140e',                                                    # darkest: lines, shades
    'h': '#6a4a30',                                                    # sideburn and hair
    'L': '#ffe2cc', 'S': '#f2b48e', 's': '#d68266', 'z': '#944a3a',     # fair skin
    'w': '#fffaf0',                                                    # eye white, teeth, canopy white
    'J': '#ffa43c', 'j': '#e8741e', 'q': '#a84a14',                    # orange shirt
    'V': '#58b048', 'Y': '#2e7432',                                    # green palm leaves
    'P': '#e2cc8e', 'p': '#bca068', 'o': '#8a7046', 'O': '#55432a',     # khaki trousers, hat, burlap
    'X': '#a8703c', 'x': '#744a26', 'v': '#40281a',                    # brown shoes, chair wood
    'G': '#c8ccd8', 'g': '#7c8294', 'N': '#2a2c36',                    # camera body, chrome, cage
    'D': '#ecdcae', 'd': '#b49c68',                                    # rope, ribbon
    'i': '#bfe4ff',                                                    # the glint on the shades
    'R': '#d83a34', 'r': '#8c1e22',                                    # gift box, stamp, canopy
    # FX letters (rules.json fxRamp; outside the budget)
    'F': '#fffbd8', 'f': '#ffd040', 'W': '#ffffff', 'y': '#ffe070',
}
FX_LETTERS = 'FfWy'
HL = 'wi'
DARK = {'V': 'Y', 'Y': 'Q', 'D': 'd', 'd': 'O', 'h': 'Q', 'R': 'r', 'r': 'Q', 'P': 'p', 'p': 'o',
        'o': 'O', 'O': 'Q', 'X': 'x', 'x': 'v', 'v': 'Q', 'G': 'g', 'g': 'N', 'N': 'Q', 'i': 'g',
        'J': 'j', 'j': 'q', 'q': 'Q', 'w': 'D'}


def grid(t):
    return K.grid(t)


def edit(rows, changes):
    return HK.edit(rows, changes)


# ------------------------------------------------------------------------------------ heads
# 17 x 15, neck (5, 14). Rows 0-5 the khaki sun hat (crown, band, brim), rows 6-14 the face in
# profile facing right: the sideburn, the black shades with the glint, the nose, the mouth.
HAT = grid("""
    ....oPPPPPPp.....
    ...oPPPPPPPPp....
    ...oPPPPPPPPPp...
    ...OooooooooooO..
    .ooPPPPPPPPPPPPpp
    ..OoopppppppppoO.
""")
FACE = grid("""
    ...hhsSSSSSSSs...
    ...hhSSSSzQSSL...
    ...QhSSSQQQQQQ...
    ...QszsSQQQiQQL..
    ...QszsSSSSSSSSL.
    ....QsSSSSSSSs...
    ....QsSSSSQQsS...
    .....zsSSSSSs....
    ......zzssss.....
""")
# the bare head (the hat in his hand): thin sandy hair combed over, the sunburnt scalp line
TOP = grid("""
    .................
    .................
    .....hhhhhh......
    ...hhSSSSSShh....
    ..hhSLLLSSSSSh...
    ..hhSSSSSSSSSs...
""")

# expression edits on the 15-row head (row, x, letters); light from the upper front
EXPR = {
    # worried: the brow up over the shades, the mouth a short flat line (the sample)
    'fwd': [],
    # the blink behind the shades: the brow drops, the glint goes out
    'blink': [(7, 9, 'SS'), (8, 9, 'QQQQQQ'), (9, 11, 'Q')],
    # breathing in: the brow lifts, the mouth a little open
    'in': [(7, 9, 'zQ'), (6, 9, 'S'), (12, 10, 'Qz')],
    # peeks over the shades: they slide down the nose, a hopeful eye looks up at the rescuer
    'peek': [(7, 9, 'SQQ'), (8, 8, 'SSwQSS'), (9, 8, 'QQQQQQ'), (10, 8, 'QQQiQQL'), (12, 10, 'zz')],
    # MMF!: the brows down hard, the cheeks puffed, the lips pressed together
    'mmf': [(7, 8, 'QQQ'), (11, 11, 'sSS'), (12, 9, 'zQQQs'), (13, 12, 'S')],
    # straining: the teeth gritted, the brow knotted
    'strain': [(7, 8, 'QQQQ'), (12, 9, 'QwQwQ'), (13, 10, 'zzz')],
    # the slump: a sigh, the mouth open small and down
    'sigh': [(7, 9, 'SS'), (8, 9, 'QQQQQQ'), (9, 11, 'Q'), (12, 10, 'zQ'), (13, 10, 'zQs')],
    # surprised (the chair bursts): the brows high, the mouth an O
    'oh': [(6, 8, 'QQ'), (7, 9, 'SSS'), (11, 11, 'zQz'), (12, 11, 'QRQ'), (13, 11, 'zQz')],
    # happy: a wide grin under the shades
    'happy': [(11, 10, 'zzz'), (12, 9, 'QwwwQ'), (13, 10, 'zzs')],
    # the cheese grin: teeth from cheek to cheek
    'cheese': [(11, 9, 'zzzz'), (12, 8, 'QwwwwQ'), (13, 9, 'zQQQs')],
    # whoopee (freed): the mouth wide open, the tongue
    'yay': [(6, 8, 'QQ'), (11, 10, 'zQQz'), (12, 10, 'QRRQ'), (13, 10, 'zQQs')],
    # aiming the camera: the near eye squeezed (the camera covers the face; the mouth bites the lip)
    'aim': [(12, 10, 'zQ'), (13, 10, 'zz')],
    # the run: puffing, the mouth open
    'puff': [(12, 10, 'QQ'), (13, 10, 'zQ')],
}


def head_rows(expr='fwd', hat=True):
    rows = (HAT if hat else TOP) + FACE
    return edit(rows, [(y, x, s) for y, x, s in EXPR[expr]])


def install_heads():
    nk = {'neck': (5, 14)}
    for e in EXPR:
        P.HEADS[e] = (head_rows(e, True), nk)
        P.HEADS['bare_' + e] = (head_rows(e, False), nk)


# ------------------------------------------------------------------------------------ torsos
# The sample's shirt: orange with the green palm print, the camera strap (x) across from the near
# shoulder to the far hip, the flash camera on the chest (chrome top G, black body N, the lens i).
TORSO = grid("""
    .qjjJJJSSJ..
    qjjVJJJJxJJ.
    qjYVJJJxJJJJ
    qjjjJJxGGgNJ
    qjjjJVxNNNNg
    qjVYjJxNNiNJ
    qjjjjxJJJJJJ
    qjjjxjJJVJJj
    qqjxjjjJVYJj
    QqxjjjqjjjJq
    .QqqqqqqqqQ.
""")
# breathing in: the chest lifts a row at the front (the camera rides up with it)
TORSO_IN = grid("""
    .qjjJJJSSJ..
    qjjVJJJJxJJ.
    qjYVJJJxJJJJJ
    qjjjJJxGGgNJ.
    qjjjJVxNNNNg.
    qjVYjJxNNiNJ.
    qjjjjxJJJJJJ
    qjjjxjJJVJJj
    qqjxjjjJVYJj
    QqxjjjqjjjJq
    .QqqqqqqqqQ.
""")
# the camera lifted off the chest (gag, give): the strap runs up from the far hip to the hands
TORSO_NOCAM = grid("""
    .qjjJJJSSJ..
    qjjVJJJJJJJ.
    qjYVJJJJJJJJ
    qjjjJJJJVJJJ
    qjjjJVJVYJJJ
    qjVYjJJJJJJJ
    qjjjjJJJJVJJ
    qjjjxjJJVYJj
    qqjxjjjJJJJj
    QqxjjjqjjjJq
    .QqqqqqqqqQ.
""")
TAN = {'neck': (6, -2), 'pelvis': (6, 9), 'shN': (6.5, 2.5), 'shF': (3.5, 3.0)}


def install_torsos():
    for name, rows in (('up', TORSO), ('in', TORSO_IN), ('nocam', TORSO_NOCAM)):
        P.TORSOS[name] = (rows, TAN)
        for k, sh in (('back', -2), ('back1', -1), ('lean1', 1), ('lean', 2), ('lean2', 3)):
            key = k if name == 'up' else f'{name}_{k}'
            P.TORSOS[key] = P.shear(P.TORSOS[name], sh)


# ------------------------------------------------------------------------------------ hands
# Orange cuffs (j) on the bare hands.
HANDS = {
    'fist': (["jSS", "jSs", ".ss"], {'wrist': (0, 1)}),
    'open': (["jSSSS", "jSSSs", ".sss."], {'wrist': (0, 1)}),
    'up': ([".SS", "SSs", "SSs", "Ss.", "jj."], {'wrist': (0.5, 4)}),
    'wave': (["S.S.", "SSSs", "SSSs", "SSs.", "jj.."], {'wrist': (0.5, 4)}),
    'thumb': ([".S..", ".SL.", "jSSS", "jSSs", ".ss."], {'wrist': (0, 3)}),
    'point': (["jSS...", "jSSSSs", ".ss..."], {'wrist': (0, 1)}),
    # the flash camera held up to the eye (lens forward, the flash cube on top, the chrome rim)
    'cam': (grid("""
        ...DGg...
        .gGGGGGgN
        NGNNNNNNiN
        NNNNNNNNNg
        jSNNNNNNN.
        jSSs.....
        .ss......
    """), {'wrist': (0.5, 5)}),
    # the camera in both hands at the chest, lens forward (raise, lower)
    'camlow': (grid("""
        .gGGGgN.
        NGNNNNNg
        NNNNNiNg
        jSNNNNNN
        jSSs....
        .ss.....
    """), {'wrist': (0.5, 4)}),
    # the gift box (red, the cream ribbon and bow) held by its base
    'gift': (grid("""
        ..dD.Dd.
        ...dDd..
        .rRRDRRR
        .rRRDRRR
        .rDDDDDD
        jrRRDRRR
        jSSrrrrr
        .ss.....
    """), {'wrist': (0, 6)}),
    # the gift lifted on the open palm, offered (the hand under it)
    'giftup': (grid("""
        ...dD.Dd.
        ....dDd..
        ..rRRDRRR
        ..rRRDRRR
        ..rDDDDDD
        ..rRRDRRR
        ..rrrrrrr
        .jSSSSSs.
        .jSSs....
    """), {'wrist': (1.5, 7.5)}),
    # the hat held by its brim (the bow), crown up
    'hat': (grid("""
        ...oPPPPp..
        ..oPPPPPPp.
        ..OooooooO.
        ooPPPPPPPpp
        jSSoppppoO.
        jSs........
    """), {'wrist': (0, 4.5)}),
    # the hat swept low in front (the deep bow): crown forward, the brim to the floor
    'hatlow': (grid("""
        ..ooO..
        .oPPo..
        oPPPo..
        oPPPoO.
        oPPPoo.
        jSSoOp.
        jSs....
    """), {'wrist': (0, 5)}),
}


def install_hands():
    for k, v in HANDS.items():
        P.HANDS[k] = v
    P.FISTS['fist'] = HANDS['fist']
    P.FISTS['fistup'] = HANDS['up']


# ------------------------------------------------------------------------------------ props
# The wooden folding chair from the side (the sample): the backrest post (cols 0-2), the seat, two
# legs, a cross brace. 'c' = the seat's back corner on the floor line.
CHAIR = grid("""
    xXx.........
    xXx.........
    vXx.........
    vXx.........
    vXx.........
    vXx.........
    vXx.........
    vXx.........
    vXx.........
    vXx.........
    vXx.........
    vXx.........
    vXx.........
    vXx.........
    xXXXXXXXXXXx
    vxxxxxxxxxxv
    .vx......vx.
    .vxv.....vx.
    .vx.vv...vx.
    .vx...vv.vx.
    .vx.....vvx.
    .vx......vx.
    .vx......vx.
    .vx......vx.
""")
CHAIR_C = (1, 14)          # the anchor 'c' in the chair grid
CHAIR_AT = (-8, -10)       # where 'c' sits from the figure's root (the floor line under the pelvis)


def install_items():
    P.ITEMS['chair'] = (CHAIR, {'c': CHAIR_C})
    P.ITEMS['gift'] = (grid("""
        .dD.Dd.
        ..dDd..
        rRRDRRR
        rRRDRRR
        rDDDDDD
        rRRDRRR
        rrrrrrr
    """), {'c': (3, 3)})
    P.ITEMS['rope'] = (grid("""
        .dDdD..
        dD..dD.
        .dDdDdD
    """), {'c': (3, 2)})


def pat(part, u, v, k, ch):
    """The palm print on the sleeves: a leaf every few px along the arm (the trousers stay plain)."""
    if part in ('armN', 'armF') and int(u * 1.3 + v * 0.7) % 4 == 0 and abs(v) < 1.2:
        return 'V' if k < 2 else 'Y'
    return ch


def rope(rows, ys, x_lo=None):
    """Rope coils laid over the finished sprite (the sample): each coil runs across the chest, the
    arms and the backrest, sticks out 1 px past the outline, twisted (D d), outlined above and below.
    x_lo: the coil starts no further left than this column (it wraps the backrest post)."""
    out = [list(r) for r in rows]
    for y in ys:
        xs = [x for x, ch in enumerate(rows[y]) if ch not in '.K']
        if not xs:
            continue
        x0, x1 = min(xs) - 1, max(xs) + 1
        if x_lo is not None:
            x0 = max(x0, x_lo)
        for x in range(x0, x1 + 1):
            out[y][x] = 'D' if x % 2 else 'd'
        for x in (x0 - 1, x1 + 1):
            if 0 <= x < len(out[y]):
                out[y][x] = 'K'
        for x in range(x0, x1 + 1):
            for yy in (y - 1, y + 1):
                if out[yy][x] == '.':
                    out[yy][x] = 'K'
    return [''.join(r) for r in out]


# ------------------------------------------------------------------------------------ install
def install():
    K.palette(PAL, dark=DARK, letters='QhLSszwJjqVYPpoOXxvGgNDdiRr')
    install_heads()
    install_torsos()
    install_hands()
    install_items()
    pose.RAMP['arm'] = ['J', 'j', 'q', 'Q']
    pose.RAMP['armF'] = ['j', 'q', 'Q', 'Q']
    pose.RAMP['leg'] = ['P', 'p', 'o', 'O']
    pose.RAMP['legF'] = ['p', 'o', 'O', 'O']
    pose.HOOKS['pat'] = pat
