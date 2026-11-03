# STAG PARTIER (look 0): sunburnt and heavy, short brown hair, the lime party T-shirt with the white
# star, navy shorts, white sneakers. Shakes the fizzy-wine bottle, thumb on the cork, about to fire.
import importlib
import castkit as K

SK = importlib.import_module('chars.stag-partier_kit')
HK = SK.HK

INFO = dict(
    name='STAG PARTIER', mission=['ams'], role='enemy', kind='HUMANOID', face=-1,
    pose='shakes the bottle at the hip, thumb on the cork, about to fire',
    note='Heavy build (wider, not taller), sunburnt skin with blush, the lime tee and white star pop; '
         'the bottle is green glass with gold foil and a cream label so it reads as fizzy wine.',
    old='enemy/stag-partier/fire#0', air=0,
)

PAL = {
    'A': '#a8743e', 'H': '#70482a', 'h': '#48301c',              # short brown hair, the belt
    'L': '#ffd8c4', 'S': '#f6a688', 's': '#dc735e', 'z': '#963e36',  # sunburnt skin
    'b': '#ff7a72',                                              # blush
    'w': '#fffaf0',
    'P': '#4a5c94', 'p': '#34426e', 'o': '#232c4c', 'O': '#24140e',  # navy shorts (deepest = Q)
    **SK.SNEAKER_PAL,
}

HEAD = K.grid("""
    .....hhHHHh....
    ...hhHAHHAAH...
    ..hhHHHAHHAAH..
    .hhHHHHHAHHSSL.
    .hhhHHHHHSSLLL.
    .hhhHHHSSQQQSL.
    .QhhHsSSSSwQSL.
    .QhhszsSSSSSSSL
    ..QhszsSSbbSSSs
    ..QSSSSSSQwwwQ.
    ...QsSSSSQQQQ..
    ...zsSSSSSSSs..
    ....zzsssssz...
""")


ANG = 22


def frame():
    SK.palette(PAL, {'b': 'z'}, extra='b')
    HK.install_limbs(1.25, 1.15)
    SK.sleeves(3.0, 7.4)
    SK.torso('heavy')
    SK.sneakers()
    K.P.HEADS['fwd'] = (HEAD, {'neck': (6, 12)})
    # the near fist round the bottle's body, the neck up and forward (gun-style), the thumb along
    # the neck towards the cork; the far hand under the base, shaking
    rows, an = SK.bottle(ANG, 1.15)
    fist = K.grid("""
        .SSS.
        SSSSS
        sSSs.
        .ss..
    """)
    K.P.HANDS['bottle'] = SK.in_hand(rows, an, fist, 'grip', (2, 1))
    K.P.HANDS['cup'] = (K.grid("""
        SSS.
        sSSs
        .ss.
    """), {'wrist': (0, 1)})
    K.P.FX['leak'] = (K.grid("""
        ..I.
        .IiI
        IiI.
        .I..
    """), (0, 2))
    K.P.FX['shake'] = (K.grid("""
        ..i....
        .i.....
        .......
        .......
        .......
        .....i.
        ....i..
    """), (3, 3))
    upper = K.A.up(torso='up', head='fwd',
                   near=K.A.hand((8, 3), 'bottle', 'hand', bend=-1),
                   far=K.A.hand((9, 5), 'cup', 'hand', bend=-1),
                   fx=[('leak', ('armN', 'tip', 0, -1)), ('shake', ('armN', 'c', 0, 0))])
    lower = K.A.legs((0, -17), (-6, -4), (6, -4))
    return K.humanoid(upper, lower)
