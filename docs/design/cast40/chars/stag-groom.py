# STAG GROOM: the lime party T-shirt with an L-plate on the chest, a pink tutu over navy shorts, a
# white veil with a small gold tiara, white sneakers, parted brown hair and a blush. Fires a cork:
# the bottle kicks up in both hands, a foam jet, the cork tumbling ahead.
import importlib
import castkit as K

SK = importlib.import_module('chars.stag-partier_kit')
HK = SK.HK

INFO = dict(
    name='STAG GROOM', mission=['ams'], role='enemy', kind='HUMANOID', face=-1,
    pose='fires a cork: the bottle kicks up in both hands, a foam jet, the cork flying ahead',
    note='The pink tutu, the white veil with the gold tiara and the L-plate make the groom read in '
         'the group; the lime tee stays; the veil flies back with the recoil.',
    old='enemy/stag-groom/fire#1', air=0,
)

PAL = {
    'A': '#b07a44', 'H': '#7a4e2c', 'h': '#4c301c',                    # parted brown hair, belt
    'L': '#ffe0cc', 'S': '#f6b294', 's': '#da8268', 'z': '#984a3c',     # fair skin
    'w': '#fffaf0',
    'P': '#4a5c94', 'p': '#34426e', 'o': '#232c4c', 'O': '#24140e',     # navy shorts
    'a': '#ffb2d6', 'Z': '#f06aa8', 'k': '#b03a78',                    # pink tutu (Z also the blush)
    'U': '#24140e',                                                    # bottle deep shade = darkest
    **SK.SNEAKER_PAL, 'v': '#c9ccc0',
}

HEAD = K.grid("""
    ......R.Z.R...
    ......rRRRr...
    ....hhHHHHHh..
    ..hhHAAHhHAAH.
    .hHHAAHHhHAAAH
    hhHHHHHHhHHSSL
    hhhHHHHHSSSSLL
    QhhHHHSSQQQSSL
    QhhHHsSSSwQSSL
    QhhHszsSSSSSSSL
    .QhHszsSSZZSSs.
    .QhSSSSSSQwwwQ.
    ..QsSSSSSQzzQ..
    ...zsSSSSSQQs..
    ....zzsssss....
""")

# the veil: white tulle from the back of the head, blown back and down by the recoil
VEIL = K.grid("""
    ........TT
    ......TTTt
    ....TTTTtt
    ...TTTtTtt
    ..TTTtTTt.
    .TTTtTTtt.
    TTTtTTtt..
    TTtTTtTt..
    TTTtTtt...
    .TtTtTt...
    .TTtTt....
    ..Tt.t....
""")


# the L-plate (white with a red L) on the chest, where the others wear the star
LPLATE = ["TTTTT", "TTTeT", "TTTeT", "TeeeT", "TTTTT"]   # drawn mirrored: the sprite faces left


def _back(cv, X, p, meta, z):
    """The veil behind the head and back (the BACK layer), hung from the head's 'veil' point."""
    vx, vy = meta['head']['veil']
    cv.grid(int(round(vx)) - 8, int(round(vy)) - 1, VEIL, z, 'veil')


def frame():
    SK.palette(PAL, {'a': 'k', 'k': 'O'}, extra='ak')
    HK.install_limbs(1.0, 1.0)
    SK.sleeves(3.0, 7.4)
    SK.torso('normal')
    rows, an = K.P.TORSOS['up']
    rows = HK.edit(rows, [(y + 2, 1, LPLATE[y]) for y in range(5)])
    # the tutu: a frilled pink skirt round the waist, wider than the hips, over the shorts
    tutu = K.grid("""
        ..kZaZaZaZaZaZ..
        .kZaZaaZaaZaaZa.
        kZZaZZaZZaZZaZZa
        kkZkZZkZZkZZkZZZ
        .k.kk.kk.kk.kZk.
    """)
    w = len(tutu[0])
    pad = (w - len(rows[0])) // 2
    body = ['.' * pad + r + '.' * (w - len(r) - pad) for r in rows] + tutu
    an = {k: (v[0] + pad, v[1]) for k, v in an.items()}
    K.P.TORSOS['up'] = (body, an)
    K.P.TORSOS['back'] = K.P.shear(K.P.TORSOS['up'], -2)
    SK.sneakers()
    K.P.HEADS['shout'] = (HEAD, {'neck': (5, 14), 'veil': (1, 3)})
    K.pose.HOOKS['back'] = _back
    # the bottle kicking up, open (the cork is out), gripped at the base, the far hand under it
    brows, ban = SK.bottle(34, 1.1, state='open')
    fist = K.grid("""
        .SSS.
        SSSSS
        sSSs.
        .ss..
    """)
    K.P.HANDS['bottle'] = SK.in_hand(brows, ban, fist, 'grip', (2, 1))
    K.P.HANDS['cup'] = (K.grid("""
        SSS.
        sSSs
        .ss.
    """), {'wrist': (0, 1)})
    K.P.ITEMS['cork'] = (K.grid("""
        .Dd
        DDd
        Dd.
    """), {'c': (1, 1)})
    K.P.FX['jet'] = (K.grid("""
        ......T.T...
        ...T.TTiT.T.
        .TTTiTTTiTT.
        TTiiTTiTT...
        .Ti.T.i.....
        ..i.........
    """), (0, 3))
    upper = K.A.up(torso='back', head='shout',
                   near=K.A.hand((8, 1), 'bottle', 'hand', bend=-1),
                   far=K.A.hand((9, 3), 'cup', 'hand', bend=-1),
                   fx=[('jet', ('armN', 'tip', 0, 0))])
    # the cork tumbling ahead of the mouth along the bottle's line
    meta = K.pose.compose(dict(upper, pelvis=(0, -17)), 'upper')[1]
    tx, ty = meta['armN']['tip']
    ang = 34 * 3.14159 / 180
    upper['items'] = [('cork', (tx - K.RX + 9 * 0.83, ty - K.RY - 9 * 0.56), 12)]
    lower = K.A.legs((0, -17), (-6, -4), (6, -4))
    return K.humanoid(upper, lower)
