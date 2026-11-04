# The hot-dog vendor's own drawn parts and palette: the look of the cast spike's approved sample
# (docs/design/cast40/chars/ams-hotdog-vendor.py): a heavy, friendly man in a red-white-blue
# striped cap, a sky-blue shirt, a white waist apron with a mustard smear, slate trousers, black
# boots and a big moustache. Heavy = wider, not taller: a broad torso with a belly, thick limb
# tubes (a quarter thicker than the rig's), wider hips.
#
# install() patches the shared kit tables (one set per process, bake.py). Drawn facing RIGHT.
import castkit as K
import limbs as HK

P = K.P
pose = K.pose

# ------------------------------------------------------------------------------------ palette
# 28 colours (plan D1: at most 28; the cast sample had 29: its tooth white 'w' #fffaf0 is merged
# into the apron white 'a', a twin at 1x). The outline K is the rig's one warm near-black.
PAL = {
    'K': '#140c0e',                                   # the one warm near-black outline (rig)
    # dark brown hair, brows and the big moustache; the belt shares the browns
    'A': '#8a5c3c', 'H': '#5a3622', 'h': '#38200f', 'Q': '#1e120c',
    # ruddy skin (also the bun of the hot dog)
    'L': '#ffe0c6', 'S': '#f2ae8a', 's': '#d68468', 'z': '#94483a',
    # sky-blue shirt (J lit, j mid, q shade)
    'J': '#a8d8f4', 'j': '#6ea8da', 'q': '#3e70a6',
    # cap: red crown (C E U: also the sausage and the tongue), white band (a k), blue band and peak (R r)
    'C': '#ee5450', 'E': '#c02c36', 'U': '#721a26',
    'R': '#4058a0', 'r': '#242f62',
    # white apron (a lit, k mid, l shade: the eye whites and the teeth are a) and the mustard (Y V)
    'a': '#fbf8f0', 'k': '#d8d4ce', 'l': '#a8a4ac',
    'Y': '#f2c430', 'V': '#b8861c',
    # slate trousers (o O deep shade: O = the cap's navy r), black boots
    'P': '#7c8494', 'p': '#5a6274', 'o': '#3e4456', 'O': '#242f62',
    'X': '#4a4652', 'x': '#2c2a33', 'v': '#1b1a20',
}
# the letters the stock kit parts use, mapped onto this palette (no new colours)
ALIAS = {'T': '#a8d8f4', 't': '#3e70a6', 'w': '#fbf8f0'}
DARK = {'J': 'q', 'j': 'q', 'q': 'q', 'T': 't', 't': 't', 'C': 'U', 'E': 'U', 'U': 'U', 'R': 'r',
        'r': 'r', 'a': 'l', 'k': 'l', 'l': 'l', 'Y': 'V', 'V': 'V', 'w': 'l'}
HL = 'a'           # single pixels allowed: the eye whites, the teeth and glints


def grid(t):
    return K.grid(t)


def edit(rows, changes):
    return HK.edit(rows, changes)


# ------------------------------------------------------------------------------------ heads
# The sample's head (18 x 13, neck at (6, 12)): the striped cap with its peak out front, a bushy
# brow, a big nose, the big moustache with curled tips, a broad smile with teeth, a heavy jaw.
HEAD = grid("""
    .......UEEEEU.......
    .....UECCCCCCEU.....
    ....UECCCCCCCCCE....
    ...lkkaaaaaaaaaaak..
    ..hrrrRRRRRRRRRRRRRR
    ..hhHHHsSSSShhhhSS..
    .QhHHHsSSSSSaQQSSL..
    .QhHHszsSSSSSSSSSLL.
    ..QhHzsSSSSHHHAAHHs.
    ..QhssSSSSHHHHHHHHH.
    ...QzsSSSSHhSzzzhSH.
    ...QzsSSSSSSzaaazs..
    ....zzzssssszzzs....
""")
NECK = {'neck': (6, 12)}

# Expressions: edits of the face (row, col, text). The brow is row 5, the eye row 6, the moustache
# rows 8-9, the mouth rows 10-11.
EXPR = {
    'fwd': [],
    # eyes shut (the lid a dark line), the smile stays
    'blink': [(6, 12, 'SQQ'), (7, 12, 'sSS')],
    # a happy squint (the cheek pushes the lid up) and the mouth wide open: a hearty laugh
    'laugh': [(5, 12, 'hhhh'), (6, 12, 'zQQs'), (10, 12, 'zQQQz'), (11, 12, 'zEEEz'), (12, 10, 'zzzzzz')],
    # the laugh going over: the squint, the mouth half shut, the moustache lifted a row
    'chuckle': [(6, 12, 'zQQs'), (10, 12, 'zQaQz'), (11, 12, 'szzzs')],
    # talking: the mouth open (the moustache over the upper lip), half open, an 'O', shut
    'talkA': [(10, 12, 'hQQQh'), (11, 12, 'zEEEz')],
    'talkB': [(10, 12, 'hzQzh'), (11, 12, 'szzzs')],
    'talkO': [(10, 13, 'zQz'), (11, 13, 'zQz'), (12, 13, 'zz')],
    'talkC': [(10, 12, 'Shzzh'), (11, 12, 'Ssszs')],
    # the brows up (talking with a raised brow: 'lekker!')
    'talkU': [(5, 12, 'Shhh'), (10, 12, 'hQQQh'), (11, 12, 'zEEEz')],
    # proud: the chin up, the eye forward and steady (the salute)
    'proud': [(6, 12, 'aQQ')],
}


def head_rows(expr='fwd'):
    return edit(HEAD, EXPR[expr]) if EXPR[expr] else list(HEAD)


# The turn: a 3/4 head (the face toward the viewer, the peak turned out front-right) and the
# front head (symmetric: the peak a wide visor, both eyes, the moustache with two curled tips).
HEAD_34 = grid("""
    ......UEEEEEU....
    ....UECCCCCCCEU..
    ...UECCCCCCCCCCE.
    ..lkkaaaaaaaaaaak
    .hrrRRRRRRRRRRRRR
    .hhrrrrrrrrrrrr..
    QhHSSaQSSSSaQSSL.
    QhHsSSSSSSSSSSLL.
    .QhsSHAAHHHAAHHs.
    .QzsHHHHHHHHHHHH.
    ..QzsSSHzzzzhSs..
    ..QzsSSSzaaazs...
    ...zzzssssszz....
""")
NECK_34 = {'neck': (7, 12)}

HEAD_FRONT = grid("""
    .....UEEEEEU.....
    ...UECCCCCCCEU...
    ..UECCCCCCCCCEU..
    .lkkaaaaaaaaaakl.
    rRRRRRRRRRRRRRRRr
    .hrrrrrrrrrrrrrh.
    .HhSSaQSSSaQSShH.
    .HhsSSSSLSSSSshH.
    ..hsHAAHHHAAHsh..
    ..zHHHHHHHHHHHz..
    ..zsShzzzzzhSsz..
    ...zsSzaaazSsz...
    ....zzssssszz....
""")
NECK_FRONT = {'neck': (8, 12)}
EMPTY = (['.'], {'neck': (0, 0)})


def install_heads():
    for e in EXPR:
        P.HEADS[e] = (head_rows(e), NECK)
    P.HEADS['q34'] = (HEAD_34, NECK_34)
    P.HEADS['front'] = (HEAD_FRONT, NECK_FRONT)
    P.HEADS['none'] = EMPTY


# ------------------------------------------------------------------------------------ torsos
# The sample's broad torso with a belly: the sky shirt with a placket, a brown belt, brass buckle.
TORSO = grid("""
    ..qjjJJJJJJJ....
    .qjjjJJJJJJJJ...
    qjjjjJJJJJJJJJ..
    qjjjjJJJJJJJqJJ.
    qjjqjjJJJJJJJqJ.
    qjjqjjJJJJJJJqJJ
    qjjjqjjJJJJJJJqJ
    qjjjqjjjJJJJJJqJ
    qqjjjqjjjJJJJqJj
    qqjjjjqjjjjJJqjj
    hHHHHHHHHHHHYVHh
    .hhhhhhhhhhhhhh.
""")
TAN = {'neck': (7, -2), 'pelvis': (7, 10), 'shN': (8, 2.5), 'shF': (4.5, 3.0)}
# breathing in: the chest and the belly lift and round out a column (the belt stays)
TORSO_IN = grid("""
    ..qjjJJJJJJJ....
    .qjjjJJJJJJJJ...
    qjjjjJJJJJJJJJ..
    qjjjjJJJJJJJJJJ.
    qjjjjJJJJJJJqJJ.
    qjjqjjJJJJJJJqJJ
    qjjqjjJJJJJJJqJJ
    qjjjqjjJJJJJJJqJ
    qqjjjqjjJJJJJJqJ
    qqjjjjqjjjjJJqjj
    hHHHHHHHHHHHYVHh
    .hhhhhhhhhhhhhh.
""")
# The chest puffed out (the salute snap): the shirt drawn tight over a raised chest
TORSO_PUFF = grid("""
    ..qjjJJJJJJJJ...
    .qjjjJJJJJJJJJ..
    qjjjjJJJJJJJJJJ.
    qjjjjJJJJJJJJqJ.
    qjjqjjJJJJJJJqJ.
    qjjqjjJJJJJJJqJ.
    qjjjqjjJJJJJJqJ.
    qjjjqjjjJJJJJqJ.
    qqjjjqjjjJJJJqJ.
    qqjjjjqjjjjJJqj.
    hHHHHHHHHHHHYVH.
    .hhhhhhhhhhhhh..
""")
# Front view (the turn): the broad chest, the placket down the middle, the belt with the buckle
TORSO_FRONT = grid("""
    ...qjJJJJJJJJjq...
    ..qjJJJJjqJJJJjq..
    .qjJJJJJjqJJJJJjq.
    .qjJJJJJjqJJJJJjq.
    qjjJJJJJjqJJJJJjjq
    qjjJJJJJjqJJJJJjjq
    qjjJJJJJjqJJJJJjjq
    qjjjJJJJjqJJJJjjjq
    qqjjJJJJjqJJJJjjqq
    qqjjjJJJjqJJJjjjqq
    hHHHHHHHYVHHHHHHHh
    .hhhhhhhhhhhhhhhh.
""")
TAN_FRONT = {'neck': (9, -2), 'pelvis': (9, 10), 'shN': (15.5, 2.5), 'shF': (2.5, 2.5)}


def install_torsos():
    P.TORSOS['up'] = (TORSO, TAN)
    P.TORSOS['in'] = (TORSO_IN, TAN)
    P.TORSOS['puff'] = (TORSO_PUFF, TAN)
    P.TORSOS['front'] = (TORSO_FRONT, TAN_FRONT)
    P.TORSOS['back'] = P.shear(P.TORSOS['up'], -2)
    P.TORSOS['back1'] = P.shear(P.TORSOS['up'], -1)
    P.TORSOS['puffback'] = P.shear(P.TORSOS['puff'], -1)
    P.TORSOS['lean1'] = P.shear(P.TORSOS['up'], 1)
    P.TORSOS['lean'] = P.shear(P.TORSOS['up'], 2)
    P.TORSOS['inlean1'] = P.shear(P.TORSOS['in'], 1)


# ------------------------------------------------------------------------------------ apron
# The white waist apron to mid thigh, lit at the front, the mustard smear, a shaded hem.
APRON = grid("""
    lkkkaaaaaaaaa
    lkkkaaaaaaaaa
    lkkkkaaaaaaaa
    lkkkkaaaYVaaa
    lkkkkaaaaYaaa
    llkkkkaaaaaaa
    llkkkkkaaaaak
    .lllllllllkkk
""")
APRON_AT = (-6, 0)
# front view: the apron across both thighs, the smear on his right
APRON_FRONT = grid("""
    lkkaaaaaaaaaakl
    lkkaaaaaaaaaakl
    lkkaaaaaaaaaakl
    lkkaaaaaaYVaakl
    lkkaaaaaaaYaakl
    lkkkaaaaaaaakkl
    llkkkaaaaaakkll
    .lllllllllllll.
""")
APRON_FRONT_AT = (-7, 0)


def _apron(cv, X, p, layer, meta):
    if layer not in ('lower', 'full'):
        return
    px, py = meta['pel']
    front = p.get('view') == 'front'
    grid_, at = (APRON_FRONT, APRON_FRONT_AT) if front else (APRON, APRON_AT)
    cv.grid(int(round(px + at[0])), int(round(py + at[1])), grid_, 3.6, 'apron')


# ------------------------------------------------------------------------------------ hands
# Skin hands with a sky shirt cuff (J). Drawn facing right; 'wrist' is where the forearm ends.
HANDS = {
    'fist': (["JSS", "JSs", ".ss"], {'wrist': (0, 1)}),
    'open': (["JSSSS", "JSSSs", ".sss."], {'wrist': (0, 1)}),
    # the hand slipped inside / behind (only the cuff shows)
    'inside': (["J", "J"], {'wrist': (0, 0.5)}),
    # resting on the belly: the fingers curled over the shirt, the cuff behind
    'rest': (["JSSS", "JSSs", ".ss."], {'wrist': (0, 1)}),
    # the sample's salute: flat, the fingers back over the peak, the wrist low at the front
    'salute': (grid("""
        SS....
        LSS...
        .sSS..
        ..sSS.
        ...sSS
    """), {'wrist': (4.5, 4.5)}),
    # the salute snapping in: the hand still a little open, fingers spread up
    'saluteup': (grid("""
        .S.S..
        LSSS..
        .sSSS.
        ..sSSJ
        ...sJJ
    """), {'wrist': (4.5, 4.5)}),
    # waving: the open palm to the viewer, the fingers up and spread, the thumb out
    'wave': (grid("""
        .S.S.
        SSSSS
        SLSSs
        SSSSs.
        .sSs..
        .JJ...
    """), {'wrist': (1.5, 5)}),
    # the wave thrown over: the fingers tipped back (follow-through)
    'waveback': (grid("""
        S.S..
        SSSS.
        SSLSS
        .SSSs
        ..sSs
        ..JJ.
    """), {'wrist': (2.5, 5)}),
    # the wave tipped forward
    'wavefwd': (grid("""
        ..S.S
        .SSSS
        SSLSs
        SSSs.
        sSs..
        JJ...
    """), {'wrist': (0.5, 5)}),
    # presenting: the palm up, the fingers out (talking with the hands)
    'palm': (["...LS.", "JSSSSS", "JSSSs.", ".ss..."], {'wrist': (0, 2)}),
    # pointing up: the index finger raised ('one moment!')
    'pointup': (grid("""
        .S.
        .S.
        SSs
        SSs
        JJ.
    """), {'wrist': (0.5, 4)}),
    # the hot dog held up: a bun (skin ramp), the sausage (red), the mustard zigzag
    'hotdog': (grid("""
        .ESSSSSSE.
        UCEYCYCYEU
        .ssssssss.
        ..JSSs....
        ..JSSs....
        ...ss.....
    """), {'wrist': (2, 4)}),
}


def install_hands():
    for k, v in HANDS.items():
        P.HANDS[k] = v
    P.FISTS['fist'] = HANDS['fist']


# ------------------------------------------------------------------------------------ shoes
# Front view boots (the turn): toes to the viewer
SHOES_FRONT = (["xxxx", "xxxx", "xXXx", "vvvv"], {'ankle': (1.5, 0)})


def install_shoes():
    P.SHOES['front'] = SHOES_FRONT


# ------------------------------------------------------------------------------------ build
SALUTE_K = 0.8           # the saluting arm is narrowed to keep the face clear (the sample)
FAT_K = 1.25             # every other limb tube a quarter thicker (heavy build)
_tube = pose.tube


def fat(cv, X, a, b, ra, rb, ramp, z, part, cut, u0=0.0):
    k = FAT_K
    thin = getattr(fat, 'thin', None)
    if thin and part == thin:
        k = SALUTE_K
    return _tube(cv, X, a, b, ra * k, rb * k, ramp, z, part, cut, u0)


def install():
    K.palette(dict(PAL, **ALIAS), dark=DARK, letters=''.join(dict(PAL, **ALIAS)))
    install_heads()
    install_torsos()
    install_hands()
    install_shoes()
    pose.RAMP['arm'] = ['J', 'J', 'j', 'q']
    pose.RAMP['armF'] = ['j', 'j', 'q', 'q']
    pose.RAMP['leg'] = ['P', 'p', 'o', 'O']
    pose.RAMP['legF'] = ['p', 'o', 'O', 'O']
    pose.CUT['arm'] = (0.62, 0.30, 0.04)
    pose.HOOKS['post'] = _apron
    pose.tube = fat
    pose.UPPER, pose.FORE = 7.0, 6.5     # the NPC arm length (the sample)
