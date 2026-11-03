# STAG PARTIER (look 2): stocky, tan skin, a big mop of black curls and a full beard, the lime party
# T-shirt with the white star, sky-blue shorts, black sneakers. The selfie gag: the pink phone held
# up at arm's length, grinning up at it, the bottle dangling by the neck in the other hand.
import importlib
import castkit as K

SK = importlib.import_module('chars.stag-partier_kit')
HK = SK.HK

INFO = dict(
    name='STAG PARTIER (BEARD)', mission=['ams'], role='enemy', kind='HUMANOID', face=-1,
    pose='the selfie gag: the phone up at arm\'s length, grinning at it, the bottle dangling',
    note='Stocky (wider, not taller), black curls and a full beard, the lime tee with the star; the '
         'pink phone held high and the flash spark make the gag read at 1x.',
    old='enemy/stag-partier-2/gag-selfie#0', air=0,
)

PAL = {
    'A': '#5a463a', 'H': '#33261e', 'h': '#1e1612', 'Q': '#120c0a',     # black curls, beard
    'L': '#eebc94', 'S': '#cc8e62', 's': '#a46a44', 'z': '#6c3e28',     # tan skin
    'w': '#fffaf0',
    'P': '#8cc8f0', 'p': '#5c98cc', 'o': '#3a6698', 'O': '#120c0a',     # sky-blue shorts
    'X': '#4c4a56', 'x': '#2a2830', 'v': '#120c0a',                     # black sneakers
    'Z': '#f0609a', 'k': '#a82e62',                                    # pink phone (and the star)
    'U': '#120c0a',                                                    # bottle deepest = Q
}

HEAD = K.grid("""
    ...hhHhhHAhh....
    ..hHAHHHAHHAHh..
    .hHHHAHHHHAHHAh.
    hHAHHHHAHHHAHHh.
    hHHHAHHHHHSLLLh.
    hHHAHHHHSSLLLLS.
    QhHHHHHsSSQQQSL.
    QhHHHszSSSSwQSL.
    QhHHHszsSSSSSSSL
    .QhHHhsShhSSSSs.
    .QhhhhhhhhhhhhH.
    ..QhhhhhQwwwwwh.
    ...QhhhhhQQQQh..
    ....QQhhhhhhh...
""")


def frame():
    SK.palette(PAL, {'k': 'Q', 'Z': 'k'}, extra='k')
    HK.install_limbs(1.15, 1.1)
    SK.sleeves(3.0, 6.9)
    K.pose.THIGH, K.pose.SHIN = 6.5, 6.0          # a little shorter in the leg (stocky)
    SK.torso('stocky')
    K.P.HEADS['fwd'] = (HEAD, {'neck': (6, 13)})
    # looking up at the phone: the face tilts back (the brow and the eye one row up, the chin out)
    K.P.HEADS['up'] = (HK.edit(HEAD, [(5, 8, 'SSQQQS'), (6, 7, 'sSSSwQSL'), (7, 6, 'zSSSSSSSL')]),
                       {'neck': (6, 13)})
    phone = K.grid("""
        .kZZ
        .kZZ
        .kZw
        .kZZ
        SSSS
        SSSs
        .ss.
    """)
    K.P.HANDS['phone'] = (phone, {'wrist': (0, 4.5), 'cam': (3, 0)})
    rows, an = SK.bottle(100, 1.0)
    fist = K.grid("""
        SSS
        SSs
        .s.
    """)
    K.P.HANDS['bottle'] = SK.in_hand(rows, an, fist, 'neck', (1, 1))
    K.P.FX['flash'] = (K.grid("""
        ...I...
        ...I...
        .I.i.I.
        IIiWiII
        .I.i.I.
        ...I...
        ...I...
    """), (3, 3))
    upper = K.A.up(torso='up', head='up',
                   near=K.A.hand((9, -5), 'phone', 'hand', bend=-1),
                   far=K.A.hand((-3, 7), 'bottle', 'hand', bend=-1),
                   fx=[('flash', ('armN', 'cam', 2, -2))])
    lower = K.A.legs((0, -16), (-5, -4), (5, -4))
    return K.humanoid(upper, lower)
