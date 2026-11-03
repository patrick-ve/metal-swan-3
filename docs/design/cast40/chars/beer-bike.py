# The beer bike (ams): the rented party bike, a long oak bar counter on a steel chassis with four
# wheels, red stools, a brass beer tap, a barrel at the back and a red-and-cream striped canopy.
# The sober guide in a red polo and red cap pedals and steers at the front; one partier in the
# lime party T-shirt with the white star sits on a stool, raising his beer.
import importlib
import math
import castkit as K

kit = importlib.import_module('chars.delivery-rider_kit')
P, pose = K.P, K.pose

INFO = dict(
    name='BEER BIKE', mission=['ams'], role='enemy', kind='MACHINE', face=-1,
    pose='rolls along: the guide pedals and steers at the front, a partier on a stool raises his beer',
    note='Reads by the striped scalloped canopy, the oak counter with glasses and a brass tap, red stools and the barrel; the guide in red cap and polo pedals and steers. Changed: the roof keg became a barrel on the rear deck (a clean box silhouette); one partier added.',
    old='vehicle/beer-bike/body#0',
)

PAL = {
    '1': '#e0a86a', '2': '#b07d55', '3': '#85583c', '4': '#5b3828',      # oak (and the partier's hair)
    'J': '#f06045', 'j': '#c62f30', 'q': '#861a2e', 'r': '#4a0f1f',      # red: canopy, stools, polo, cap
    '5': '#fff4dc', '6': '#e6d2b0', '7': '#b8a283',                      # cream: canopy, foam, star, shorts
    'A': '#7a8090', 'P': '#4f5360', 'o': '#2f323c', 'O': '#1b1c23',      # steel, tyres, trousers
    't': '#b9c0cc',                                                      # rims
    'G': '#fff184', 'g': '#f6c537', 'n': '#c98c22',                      # brass and beer
    'L': '#ffe4cc', 'S': '#f6c39e', 's': '#dc9670', 'z': '#a8522e',      # skin
    'Q': '#26150f',                                                      # lines, the guide's hair
    'C': '#c8f25a', 'E': '#8fcc2e', 'U': '#4f8a1e',                      # lime party T-shirt
}
DARK = {'1': '3', '2': '4', '3': '4', '4': '4', 'J': 'q', 'j': 'r', 'q': 'r', 'r': 'r',
        '5': '7', '6': '7', '7': '4', 'A': 'o', 'P': 'o', 'o': 'O', 'O': 'O', 't': 'o',
        'G': 'n', 'g': 'n', 'n': '4', 'C': 'U', 'E': 'U', 'U': 'U'}

# ---------------------------------------------------------------- the guide (red cap, red polo)
DRV_HEAD = K.grid('''
    .................
    ....qjjjjJq......
    ..qjjJJJJJJjq....
    .qjjjJJJJJJJJj...
    qqjjjjjjjjjjjJJJJ
    QQqqqqqqqqqqqjjjr
    QQQQzsSSSQQSSL...
    QQQszsSS5QSSSL...
    .QQQzssSSSSSSSs..
    .QQQsSSSSSSSSs...
    ..QQsSSSSSzzzs...
    ...QzsSSSSSSs....
    ....zzsSSSsz.....
    .....zsz.........
''')
DRV_TORSO = K.grid('''
    .qjjJJqqJJ..
    qjjjJJJq5J..
    qjjjJJJJqJJ.
    qjjjjJJJ5JJJ
    qjjqjjJJJJJJ
    qjjqjjjJJJJJ
    qjjjqjjjJJJj
    qqjjjqjjjJjj
    Qqjjjjqjjjjq
    .AAAAAAAAAA.
''')
# ---------------------------------------------------------------- the partier (lime party T-shirt)
PTY_HEAD = K.grid('''
    .....22122.......
    ...2211112212....
    ..221111222121...
    .22211122222212..
    .2221121SSSSSL...
    .22222sSSSQQSSL..
    .Q222szsSS5QSSL..
    ..Q22zssSSSSSSSs.
    ..QQ2sSJjSSSSSs..
    ...Q2sSSSz5555s..
    ....QzsSSSzzzz...
    .....zzsSSSsz....
    ......zsz........
''')
PTY_TORSO = K.grid('''
    ..UEECCCC...
    .UEEECCCCC..
    UEEECCCCCCC.
    UEEECCCCCCC.
    UEEE5UCCCCC.
    UE55555CCCC.
    UEE555CCCCC.
    UUE5E5ECCCE.
    UUEEEEUEEEEU
    .7666666667.
''')
TAN = {'neck': (6, -2), 'pelvis': (6, 8), 'shN': (6.5, 2.5), 'shF': (3.5, 3.0)}

FIST = (K.grid('''
    SSS
    SSs
    .ss
'''), {'wrist': (0, 1), 'grip': (1.5, 1)})
# a fist round a full beer glass, held up
CHEERS = (K.grid('''
    5556
    5665
    gGgn
    gggn
    SSSs
    SSsn
    .ss.
'''), {'wrist': (0, 5), 'grip': (1.5, 5)})
SHOE_BLK = (K.grid('''
    oooo....
    oooAAo..
    oooooAAo
    OOOOOOOO
'''), {'ankle': (2, 0)})
SHOE_WHT = (K.grid('''
    6555....
    655555..
    65555555
    77777777
'''), {'ankle': (2, 0)})


def setup():
    K.palette(PAL, dark=DARK, letters=''.join(PAL))
    P.HEADS['drv'] = (DRV_HEAD, {'neck': (5, 12)})
    P.HEADS['pty'] = (PTY_HEAD, {'neck': (7, 12)})
    P.TORSOS['drv'] = P.shear((DRV_TORSO, TAN), 3)
    P.TORSOS['pty'] = (PTY_TORSO, TAN)
    P.HANDS['grip'] = FIST
    P.HANDS['cheers'] = CHEERS
    P.SHOES['blk'] = SHOE_BLK
    P.SHOES['wht'] = SHOE_WHT


def look(who):
    """Limb ramps per rider: the guide in red sleeves and black trousers, the partier in lime
    sleeves and cream shorts with bare shins."""
    R = pose.RAMP
    for k in ('arm2', 'armF2', 'leg2', 'legF2'):
        R.pop(k, None)
    R['arm2'], R['armF2'] = ['S', 'S', 's', 'z'], ['s', 's', 'z', 'z']
    if who == 'drv':
        R['arm'], R['armF'] = ['J', 'j', 'q', 'r'], ['j', 'q', 'r', 'r']
        R['leg'], R['legF'] = ['A', 'P', 'o', 'O'], ['P', 'o', 'O', 'O']
    else:
        R['arm'], R['armF'] = ['C', 'E', 'U', 'U'], ['E', 'U', 'U', 'U']
        R['leg'], R['legF'] = ['5', '6', '7', '7'], ['6', '7', '7', '4']
        R['leg2'], R['legF2'] = ['S', 'S', 's', 'z'], ['s', 's', 'z', 'z']


def wheel(cv, c, z, far=False):
    ty = ['o', 'O', 'O', 'O'] if far else ['A', 'P', 'o', 'O']
    kit.hole(cv, c, 5.0, z - 0.4, 'wheel')
    kit.disc(cv, c, 7.4, ty, z, 'wheel', r_in=5.0)
    kit.disc(cv, c, 5.0, ['t', 'A', 'P', 'o'] if not far else ['P', 'o', 'O', 'O'], z, 'wheel', r_in=4.0)
    if not far:
        for a in (0.3, 1.35, 2.4):
            dx, dy = 3.9 * math.cos(a), 3.9 * math.sin(a)
            kit.line(cv, (c[0] - dx, c[1] - dy), (c[0] + dx, c[1] + dy), 'P', z - 0.1, 'wheel')
    kit.disc(cv, c, 1.3, ['t', 'A', 'P', 'o'], z + 0.05, 'wheel')


def frame():
    setup()
    cv = kit.canvas(130, 100)
    cx, gy = 64, 94
    X = lambda x: cx + x
    Y = lambda y: gy + y
    pt = lambda x, y: (cx + x, gy + y)

    # ---- far side: wheels and posts behind everything
    for x in (-29, 41):
        wheel(cv, pt(x, -8.5), 0.3, far=True)
    for x in (-47, 37):
        kit.rod(cv, pt(x, -14), pt(x, -55), 0.7, ['P', 'o', 'O', 'O'], 0.2, 'postF')

    # ---- the canopy: a striped band with a scalloped valance, lit along the top
    x0, x1, top = -55, 45, -61
    for x in range(x0, x1 + 1):
        stripe = ((x - x0) // 6) % 2
        lit_, base, shade = (('J', 'j', 'q') if stripe == 0 else ('5', '6', '7'))
        for y in range(top, top + 6):
            ch = lit_ if y == top else base if y < top + 4 else shade
            cv.px(X(x), Y(y), ch, 0.5, 'roof')
        # scallop: a half disc under each stripe
        k = (x - x0) % 6
        drop = [1, 2, 3, 3, 2, 1][k]
        for y in range(top + 6, top + 6 + drop):
            cv.px(X(x), Y(y), shade if y > top + 6 else base, 0.5, 'roof')
    # roof edge highlight: a thin rail along the top
    kit.rod(cv, pt(x0, top - 1), pt(x1, top - 1), 0.5, ['A', 'P', 'o', 'O'], 0.45, 'roof:rail')

    # ---- chassis deck
    kit.rod(cv, pt(-54, -13), pt(44, -13), 1.4, ['A', 'P', 'o', 'O'], 1.5, 'deck')
    kit.rod(cv, pt(-34, -8.5), pt(36, -8.5), 0.6, ['P', 'o', 'O', 'O'], 1.4, 'deck:axle')

    # ---- the barrel at the back (standing, oak staves, two steel hoops)
    barrel = K.grid('''
        .4322213.
        433221113
        433222113
        oPPPPPPAo
        433222113
        433222113
        433222213
        433222213
        oPPPPPPAo
        433222113
        .4332223.
    ''')
    kit.grid(cv, X(-50), Y(-26), barrel, 1.0, 'barrel')
    kit.grid(cv, X(-47), Y(-28), ['.on.', 'oPAo'], 1.0, 'barrel:tap')

    # ---- the bar counter: plank front panel, overhanging top
    for x in range(-40, 13):
        k = (x + 40) % 5
        for y in range(-27, -14):
            ch = '4' if k == 0 else ('3' if k == 1 else '2')
            if y == -27:
                ch = '3'
            if k == 4 and y > -26:
                ch = '1' if y < -22 else '2'
            cv.px(X(x), Y(y), ch, 1.0, 'counter')
    for x in range(-41, 14):
        cv.px(X(x), Y(-30), '1', 1.1, 'counter:top')
        cv.px(X(x), Y(-29), '2', 1.1, 'counter:top')
        cv.px(X(x), Y(-28), '4', 1.1, 'counter:top')
    # glasses on the counter
    glass = ['555', 'g6g', 'Ggn', 'ggn']
    for x in (-37, -14):
        kit.grid(cv, X(x), Y(-34), glass, 1.2, 'glass')
    # the brass tap tower
    kit.rod(cv, pt(6, -31), pt(6, -38), 0.9, ['G', 'g', 'n', '4'], 1.2, 'tap')
    kit.rod(cv, pt(6, -38), pt(9, -38), 0.7, ['G', 'g', 'n', '4'], 1.25, 'tap')
    kit.grid(cv, X(9), Y(-38), ['n', 'n'], 1.25, 'tap')
    kit.rod(cv, pt(5, -39), pt(5, -43), 0.6, ['A', 'P', 'O', 'O'], 1.22, 'tap:handle')

    # ---- near wheels (in front of the deck, behind the people's legs)
    for x in (-34, 36):
        wheel(cv, pt(x, -7.5), 1.6)

    # ---- stools with red cushions on the near side; pedal cranks under each
    stools = (-32, -20, -8, 4)
    for x in stools:
        kit.rod(cv, pt(x, -14), pt(x, -18), 0.6, ['A', 'P', 'o', 'O'], 1.8, 'stool')
        kit.grid(cv, X(x - 3), Y(-20), ['.JJJJJ.', 'jjjjjjq', '.qqqqq.'], 1.9, 'stool:seat')
        if x != -20:
            kit.rod(cv, pt(x + 3, -8.5), pt(x + 3 + 2.5, -5.5), 0.6, ['A', 'P', 'o', 'O'], 1.7, 'crank')
            kit.grid(cv, X(x + 4.5), Y(-5.5), ['OOO'], 1.7, 'pedal')

    # ---- the partier on the second stool: hips on the cushion, feet on his pedals, beer up
    look('pty')
    bb = pt(-17, -8.5)
    a = math.radians(60)
    pn = (bb[0] + 3.5 * math.cos(a), bb[1] + 3.5 * math.sin(a))
    pf = (bb[0] - 3.5 * math.cos(a), bb[1] - 3.5 * math.sin(a))
    kit.rod(cv, bb, pn, 0.6, ['t', 'A', 'P', 'o'], 2.6, 'crankN')
    kit.rod(cv, bb, pf, 0.6, ['P', 'o', 'O', 'O'], 1.7, 'crankF')
    pel = pt(-20, -21)
    an = P.TORSOS['pty'][1]
    sh = (pel[0] + an['shN'][0] - an['pelvis'][0], pel[1] + an['shN'][1] - an['pelvis'][1])
    kit.rider(cv, pel, 'pty', 'pty', {
        'legN': (kit.foot_on(pn), 'wht', 1), 'legF': (kit.foot_on(pf), 'wht', 1),
    }, {
        'armN': ((sh[0] + 9, sh[1] - 6), ('hand', 'cheers'), 1),
        'armF': (pt(-10, -30), ('hand', 'grip'), -1),
    }, z=0.5, tor=(-2, 0))

    # ---- the guide at the front: saddle, steering column, bar with a bell
    look('drv')
    kit.rod(cv, pt(19, -13), pt(19, -19), 0.7, ['A', 'P', 'o', 'O'], 1.8, 'saddle')
    kit.grid(cv, X(15), Y(-21), ['.ooooA.', 'oooopPA', '..oo...'], 1.9, 'saddle')
    kit.rod(cv, pt(33, -12), pt(31, -27), 0.8, ['A', 'P', 'o', 'O'], 1.8, 'column')
    bar = pt(28, -28)
    kit.rod(cv, pt(31, -27), bar, 0.7, ['t', 'A', 'P', 'o'], 1.85, 'bar')
    kit.grid(cv, X(30), Y(-30), ['.gg.', 'Ggnn'], 2.0, 'bell')
    bb = pt(24, -8.5)
    a = math.radians(100)
    pn = (bb[0] + 3.5 * math.cos(a), bb[1] + 3.5 * math.sin(a))
    pf = (bb[0] - 3.5 * math.cos(a), bb[1] - 3.5 * math.sin(a))
    kit.disc(cv, bb, 2.0, ['t', 'A', 'P', 'o'], 2.0, 'ring')
    kit.rod(cv, bb, pn, 0.6, ['t', 'A', 'P', 'o'], 3.6, 'crankN')
    kit.rod(cv, bb, pf, 0.6, ['P', 'o', 'O', 'O'], 1.7, 'crankF')
    kit.rider(cv, pt(20, -22), 'drv', 'drv', {
        'legN': (kit.foot_on(pn), 'blk', 1), 'legF': (kit.foot_on(pf), 'blk', 1),
    }, {
        'armN': (bar, ('hand', 'grip'), -1),
        'armF': ((bar[0] + 1, bar[1]), ('hand', 'grip'), -1),
    }, z=0.5, tor=(-2, 0), hd=(1, 0))

    # ---- near posts over everything
    for x in (-51, 41):
        kit.rod(cv, pt(x, -14), pt(x, -55), 0.75, ['A', 'P', 'o', 'O'], 9.0, 'postN')
    # front lamp on the front post
    kit.disc(cv, pt(43, -20), 2.0, ['o', 'o', 'O', 'O'], 9.1, 'lamp')
    kit.disc(cv, pt(43.5, -20), 1.1, ['5', '5', '6', '6'], 9.2, 'lamp')
    return kit.finish(cv, pt(0, 0))
