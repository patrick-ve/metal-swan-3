# HOSTAGE TOURIST: the rescued hostage of ams. Orange shirt with a green palm print, a khaki sun hat,
# black shades, a flash camera on the chest, a brown camera bag on a strap, khaki trousers, brown
# shoes. Tied to a wooden folding chair: rope coils round the chest and the backrest, the hands
# behind the back, a worried look over the shades.
import castkit as K
from chars import handhaver_kit as HK

INFO = dict(
    name='TOURIST (HOSTAGE)', mission=['ams'], role='npc', kind='HUMANOID', face=1,
    pose='tied to a folding chair, the hands behind the back, looking up hopefully',
    note='Orange palm-print shirt, khaki sun hat and shades read as the tourist; the rope coils and '
         'the chair make the rescue obvious. Faces right like the game\'s tied strip.',
    old='item/hostage/tourist/tied#0', air=0,
)

PAL = {
    'Q': '#1e140e',                                                    # darkest: lines, shades
    'h': '#6a4a30',                                                    # sideburn under the hat
    'L': '#ffe2cc', 'S': '#f2b48e', 's': '#d68266', 'z': '#944a3a',     # fair skin
    'w': '#fffaf0',
    'J': '#ffa43c', 'j': '#e8741e', 'q': '#a84a14',                    # orange shirt
    'V': '#58b048', 'Y': '#2e7432',                                    # green palm leaves
    'P': '#e2cc8e', 'p': '#bca068', 'o': '#8a7046', 'O': '#55432a',     # khaki trousers and hat
    'X': '#a8703c', 'x': '#744a26', 'v': '#40281a',                    # brown shoes, bag, chair
    'G': '#c8ccd8', 'g': '#7c8294', 'N': '#2a2c36',                    # camera body, chrome
    'D': '#ecdcae', 'd': '#b49c68',                                    # rope
}
DARK = {'V': 'Y', 'Y': 'Q', 'D': 'd', 'd': 'O'}

HEAD = K.grid("""
    ....oPPPPPPp....
    ...oPPPPPPPPp...
    ...oPPPPPPPPPp..
    ...OooooooooooO.
    .ooPPPPPPPPPPPPpp
    ..OoopppppppppoO.
    ...hhsSSSSSSSs..
    ...hhSSSSzQSSL..
    ...QhSSSQQQQQQ..
    ...QszsSQQQiQQL.
    ...QszsSSSSSSSSL
    ....QsSSSSSSSs..
    ....QsSSSSQQsS..
    .....zsSSSSSs...
    ......zzssss....
""")

# orange shirt, palm leaves (V lit, Y shade), the camera strap and the flash camera on the chest
# (chrome top, black body, the lens), the bag strap across to the far hip
TORSO = K.grid("""
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
TAN = {'neck': (6, -2), 'pelvis': (6, 9), 'shN': (6.5, 2.5), 'shF': (3.5, 3.0)}

# the wooden folding chair from the side: backrest post (cols 0-2), seat, two legs, a cross bar
CHAIR = K.grid("""
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


CHAIR_AT = (-8, -10)


def _pat(part, u, v, k, ch):
    """Palm print on the sleeves (a leaf every few px along the arm), khaki trousers stay plain."""
    if part in ('armN', 'armF') and int(u * 1.3 + v * 0.7) % 4 == 0 and abs(v) < 1.2:
        return 'V' if k < 2 else 'Y'
    return ch


def _chair(cv, X, p, layer, meta):
    """The chair behind the sitting figure (drawn before the outline pass, behind every part)."""
    K.pose.place(cv, X, K.P.ITEMS['chair'], 'c', (K.RX + CHAIR_AT[0], K.RY + CHAIR_AT[1]), 1, 'chair')


def _rope(rows, ys):
    """Two rope coils laid over the finished sprite (no selout band round them): each coil runs
    across the chest, arms and backrest and sticks out 1 px past the outline, twisted (D d)."""
    out = [list(r) for r in rows]
    for y in ys:
        xs = [x for x, ch in enumerate(rows[y]) if ch not in '.K']
        x0, x1 = min(xs) - 1, max(xs) + 1
        for x in range(x0, x1 + 1):
            out[y][x] = 'D' if x % 2 else 'd'
        for x in (x0 - 1, x1 + 1):
            out[y][x] = 'K'
        for x in range(x0, x1 + 1):
            for yy in (y - 1, y + 1):
                if out[yy][x] == '.':
                    out[yy][x] = 'K'
    return [''.join(r) for r in out]


def _draw_lower(cv, X, p, pel, R):
    """Seated: the near thigh lies over the seat in front of the shirt's hem (z above the torso)."""
    for key, z, ramp in (('legF', 2, 'legF'), ('legN', 14.5, 'leg')):
        L = p[key]
        hp = L.get('hip', (-2, 0) if key == 'legF' else (2, 0))
        hip = (pel[0] + hp[0], pel[1] + hp[1])
        ank = (R[0] + L['ank'][0], R[1] + L['ank'][1])
        K.pose.leg(cv, X, hip, ank, L.get('bend', 1), ramp, z, key, L.get('shoe', 'flat'))


def frame():
    K.pose.draw_lower = _draw_lower
    K.palette(PAL, dark=DARK, letters='VYDd')
    K.P.HEADS['fwd'] = (HEAD, {'neck': (5, 14)})
    K.P.TORSOS['up'] = (TORSO, TAN)
    K.pose.RAMP['arm'] = ['J', 'j', 'q', 'Q']
    K.pose.RAMP['armF'] = ['j', 'q', 'Q', 'Q']
    K.pose.HOOKS['pat'] = _pat
    K.pose.HOOKS['post'] = _chair
    K.P.ITEMS['chair'] = (CHAIR, {'c': (1, 14)})
    K.P.FISTS['fist'] = (HK.cuff(K.P.FISTS['fist'][0], 'j'), K.P.FISTS['fist'][1])
    p = dict(
        pelvis=(-1, -12), torso='up', head='fwd', hd=(0, 0),
        legF=dict(ank=(5, -4), shoe='flat', bend=1), legN=dict(ank=(7, -4), shoe='flat', bend=1),
        armN=dict(hand=(-6, 6), end=('fist', 'fist'), bend=1),
        armF=dict(hand=(-5, 6), end=('fist', 'fist'), bend=1),
    )
    rows, root = K.full(p)
    ny = K.pose.compose(p, 'full')[1]['torso']['neck'][1]
    return _rope(rows, [int(round(ny + 5)), int(round(ny + 9.5))]), root
