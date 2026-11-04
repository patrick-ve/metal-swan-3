# The FABEL FRIET crew's drawn parts and palettes (the approved cast samples
# docs/design/cast40/chars/ams-staff-0.py, -1, -2 and the shop uniform of ams-baker.py, copied here:
# production code never imports from docs/). One body, three looks (part swaps, plan rule 6):
#   0  blond ponytail and freckles, fair skin, the white crew shirt
#   1  black curls under the black shop cap, dark skin, the teal crew shirt
#   2  dark bob and round tortoiseshell glasses, medium skin, the red crew shirt
# The uniform (apron, belt, trousers, shoes) is shared; heads, hair, skin and shirt are the look's.
#
# install(look) patches the shared kit tables (one set per process, bake.py).
import castkit as K
import limbs as HK

P = K.P
pose = K.pose

grid = K.grid


def edit(rows, changes):
    return HK.edit(rows, changes)


# ------------------------------------------------------------------------------------ palette
# The shop uniform (white shirt J j q, the cuffs T t; shop black C E U, also the shoes X x v; gold
# Y V Z: piping, buckle, the F, the cap badge; charcoal trousers P p o, O = the deep shop black).
UNIFORM_PAL = {
    'K': '#140c0e',
    'J': '#fbf7ee', 'j': '#d8d3cc', 'q': '#9e98a0', 'T': '#fbf7ee', 't': '#9e98a0',
    'C': '#4a4652', 'E': '#2c2a33', 'U': '#1b1a20',
    'X': '#4a4652', 'x': '#2c2a33', 'v': '#1b1a20',
    'Y': '#ffe27a', 'V': '#e0a630', 'Z': '#9c6420',
    'P': '#6c6a78', 'p': '#4e4c5a', 'o': '#383642', 'O': '#1b1a20',
}
UNIFORM_DARK = {'J': 'q', 'j': 'q', 'q': 'q', 'T': 't', 't': 't', 'C': 'U', 'E': 'U', 'U': 'U',
                'Y': 'Z', 'V': 'Z', 'Z': 'Z', 'X': 'v', 'x': 'v'}

# Per look: hair (A lit, H base, h shade, Q deepest), skin (L lit, S base, s shade, z line), the
# eye white w, the shirt (J j q, cuffs T t). The eye white of look 0 is the white shirt (merged).
LOOKS = [
    {'A': '#f2d27a', 'H': '#cf9e48', 'h': '#94642c', 'Q': '#3a2414',
     'L': '#ffe6d2', 'S': '#f7c2a2', 's': '#de9478', 'z': '#a85e48', 'w': '#fbf7ee'},
    {'A': '#5a4a44', 'H': '#3a2e2c', 'h': '#241c1c', 'Q': '#140e10',
     'L': '#c88e66', 'S': '#a4693f', 's': '#7c4a2c', 'z': '#4e2c1c', 'w': '#fffaf0',
     'J': '#64ccbc', 'j': '#30988c', 'q': '#1a6462', 'T': '#64ccbc', 't': '#1a6462'},
    {'A': '#7a4e34', 'H': '#4e2e1e', 'h': '#2e1a12', 'Q': '#1a0f0c',
     'L': '#f6d2b0', 'S': '#dca27a', 's': '#b87a58', 'z': '#7c4a34', 'w': '#fffaf0',
     'J': '#e65a52', 'j': '#b8323a', 'q': '#741c28', 'T': '#e65a52', 't': '#741c28'},
]
# Look 1's near twin of the outline (Q #140e10 next to K #140c0e) reads as a second outline at 1x:
# its deepest hair tone is the outline itself (merged by the bake).
LOOKS[1]['Q'] = '#140c0e'
DARK = {'A': 'h', 'H': 'h', 'h': 'Q', 'L': 'S', 'S': 's', 's': 'z'}

# ------------------------------------------------------------------------------------ the uniform
# the shirt: one straight back line, square shoulders, a button placket, the black belt with the
# gold buckle at the bottom (pelvis on the belt)
TORSO = grid("""
    .qjjJJJJJJ..
    qjjjJJJJqJJ.
    qjjjJJJJJqJJ
    qjjjjJJJJqJJ
    qjjqjJJJJqJJ
    qjjqjjJJJJqJ
    qjjjqjjJJqJj
    qjjjqjjjJJqj
    qqjjjqjjjqjq
    UEEEEEEEEVYU
    .UUUUUUUUUU.
""")
# breathing in: the chest lifts a row, the belt stays
TORSO_IN = grid("""
    .qjjJJJJJJ..
    qjjjJJJJqJJ.
    qjjjJJJJJqJJ
    qjjjjJJJJqJJ
    qjjjjJJJJqJJ
    qjjqjJJJJqJJ
    qjjqjjJJJJqJ
    qjjjqjjJJqJj
    qqjjqjjjJJqj
    UEEEEEEEEVYU
    .UUUUUUUUUU.
""")
TAN = {'neck': (6, -2), 'pelvis': (6, 9), 'shN': (6.5, 2.5), 'shF': (3.5, 3.0)}
TAN_IN = {'neck': (6, -3), 'pelvis': (6, 10), 'shN': (6.5, 1.5), 'shF': (3.5, 2.0)}

# the long waist apron, hung from the belt to below the knee: black, lit at the front, gold piping
# on the hem and the front edge, a gold F on the front
APRON = grid("""
    UEEEECCCCCV
    UEEECCCCCCV
    UEEECCYYCCV
    UEEECCCYCCV
    UEEECCYYCCV
    UEEECCCYCCV
    UEEEECCCCCV
    UEEEEECCCCV
    UUEEEECCCCV
    UUEEEEECCCV
    .UZZVVVVVVV
""")
APRON_AT = (-4, -1)          # top-left of the apron from the pelvis


def apron_rows(sway=0.0, lift=0.0):
    """The apron with its cloth motion: sway (px at the hem, + = forward) shears the rows below the
    belt (the hem trails a stride and swings back: secondary motion); lift (0..1) folds the hem up
    (the cloth lags when the body drops, flies up on a hop)."""
    rows = list(APRON)
    n = len(rows)
    if lift:
        k = int(round(lift * 2))
        if k > 0:                         # the hem rides up: drop k body rows above the hem
            rows = rows[:n - 1 - k] + rows[n - 1:]
    out = []
    m = len(rows)
    w = len(rows[0]) + 4
    for j, r in enumerate(rows):
        d = int(round(sway * j / max(1, m - 1)))
        line = ('..' + r + '..')
        if d > 0:
            line = '.' * d + line[:w - d]
        elif d < 0:
            line = line[-d:] + '.' * (-d)
        out.append(line)
    return out


def apron_hook(cv, X, p, layer, meta):
    if layer not in ('lower', 'full') or p.get('noapron'):
        return
    px, py = meta['pel']
    rows = apron_rows(p.get('apron', 0.0), p.get('apronlift', 0.0))
    cv.grid(int(round(px + APRON_AT[0] - 2)), int(round(py + APRON_AT[1])), rows, 3.6, 'apron')


# ------------------------------------------------------------------------------------ heads
# Facing right, the neck anchor per head. Faces follow the approved hero layout (eye and brow at the
# front, the ear on the cheek, the nose tip past the face line), with softer jaws.
# Look 0: a blond fringe, the ponytail tied high at the back (columns 0-3 are the tail: drawn per
# swing below), freckles. The base face smiles with the mouth shut; expressions edit it.
HEAD0 = grid("""
    ......hHHHHh.....
    ....hHAAAHAAAh...
    ...hHAAAAHAAAAh..
    ...hHAAHHAAAAAAh.
    ....HHHHHHAHSLLh.
    ....hHHHHHsSQQSL.
    ....HHHHssSSwQSL.
    ....QhHHszSSSSSSL
    .....QhHzsSzSzSs.
    ......QhssSSSSzs.
    ......QhsSSzzzzS.
    .......QsSSSSSs..
    ........zsssss...
""")
# the ponytail (columns 0-4, rows 1-10), by swing: 0 hangs (the sample), 1 swings out behind,
# 2 flies up (a hop, a fast turn of the head), -1 tucks in against the neck (a fast move back)
TAIL0 = {
    0: ['', '', '', '.hQh', 'hHHQ', 'hAHh', 'hHhh', 'hHh.', '.hh..', '.h...', ''],
    1: ['', '', '', 'hhQh', 'hAHQ', 'hHhh', 'hHh.', '.hh..', '', '', ''],
    2: ['', '.hh.', 'hAHh', 'hHQh', '.hHQ', '..hh', '', '', '', '', ''],
    -1: ['', '', '', '..Qh', '.hHQ', '.AHh', '.Hhh', '.hh.', '..h..', '', ''],
}
NECK0 = {'neck': (8, 12)}

# Look 1: black curls under the black shop cap (gold badge, piped peak). Its own mouth edits.
HEAD1 = grid("""
    .....UEEEEEU....
    ...UECCCCCCCEU..
    ..UECCCCCCCYYCE.
    .UEECCCCCCCYVCCE
    hUEEEECCCCCCCCCE
    hAhUUUUUUUUUEEEVVVV
    AHhAHhhsSSSSQSL..
    hhAHhhsSSSwQSS...
    QAHhszsSSSSSSSL..
    .QhhszsSSSSSsSs..
    .QhhssSSSzzzzs...
    ..QhsSSSSSSSz....
    ...QzsSSSzzs.....
    ....zzssss.......
""")
NECK1 = {'neck': (5, 13)}
# the curls bounce (rows 6-11, columns 0-2): 0 rest, 1 a row lower (the head dips), -1 up
CURL1 = {
    0: ['AHh', 'hhA', 'QAH', '.Qh', '.Qh', '..Q'],
    1: ['hHh', 'AHh', 'hhA', 'QAH', '.Qh', '..Q'],
    -1: ['hAH', 'QAH', '.Qh', '.Qh', '..Q', '...'],
}

# Look 2: a dark bob cut straight at the jaw, a fringe, round tortoiseshell glasses (Z), a smile.
HEAD2 = grid("""
    ....hhHHHHh....
    ..hhHAAHHAAAH..
    .hHAAAHHAAAAAH.
    hHHAAHHHAAAAAAh
    hHHHHHHHHAAAHHh
    hHHHHHHHsShhSSh
    hHHHHHsSSZZZSSL
    hHHHHzZZZwQZSSL
    hHHHHzsSSZZZSSs
    hHhhHssSSSSSSs.
    hhhhQsSSSzzzzs.
    .hh..QsSSSSSz..
    ......zsssss...
""")
NECK2 = {'neck': (6, 12)}
# the bob's hem swings (rows 9-11, columns 0-4): 0 rest, 1 out behind, -1 in (and a row shorter)
BOB2 = {
    0: ['hHhhH', 'hhhhQ', '.hh..'],
    1: ['hHhhH', 'hhhhQ', 'hhh..'],
    -1: ['.Hhh', '.hhhQ', '..h..'],
}

# Expressions: (row, x, letters) edits on each look's head. 'fwd' is the friendly rest (mouth shut),
# 'smile' a wide toothy grin, 'cheer' the mouth wide open (the cast sample), 'joy' eyes shut with
# joy and the grin, 'blink' the eye shut, 'oo' an 'o' of effort (the clap impact, the hop).
EXPR = [
    {   # look 0 (eye w at (12, 6), pupil (13, 6), brow (12-13, 5), mouth rows 9-11, x 11-15)
        'fwd': [],
        'smile': [(9, 12, 'zzz'), (10, 11, 'zwwwz'), (11, 11, 'SzzS')],
        'cheer': [(9, 12, 'zzz'), (10, 11, 'zwwwz'), (11, 11, 'zQQz'), (12, 9, 'sssss')],
        'joy': [(5, 12, 'SS'), (6, 12, 'QQ'), (9, 12, 'zzz'), (10, 11, 'zwwwz'), (11, 11, 'zQQz')],
        'blink': [(6, 12, 'zz')],
        'oo': [(5, 12, 'QQ'), (9, 12, 'SzS'), (10, 12, 'zQz'), (11, 12, 'Sz')],
    },
    {   # look 1 (eye w at (10, 7), pupil (11, 7), brow (12, 6), mouth rows 10-12)
        'fwd': [],
        'smile': [(10, 9, 'zzzz'), (11, 8, 'Szwwwz'), (12, 8, 'zzzs')],
        'cheer': [(10, 9, 'zzzz'), (11, 8, 'zwwwz'), (12, 8, 'zQQz')],
        'joy': [(7, 10, 'QQ'), (10, 9, 'zzzz'), (11, 8, 'zwwwz'), (12, 8, 'zQz')],
        'blink': [(7, 10, 'zz')],
        'oo': [(10, 9, 'SzS'), (11, 9, 'zQz'), (12, 9, 'zs')],
    },
    {   # look 2 (eye w at (9, 7) behind the glasses, mouth rows 10-11)
        'fwd': [],
        'smile': [(10, 9, 'zzzz'), (11, 8, 'zwwwz')],
        'cheer': [(10, 9, 'zzzz'), (11, 8, 'zwwQz'), (12, 8, 'zQz')],
        'joy': [(7, 9, 'zQ'), (10, 9, 'zzzz'), (11, 8, 'zwwwz')],
        'blink': [(7, 9, 'zz')],
        'oo': [(10, 10, 'zz'), (11, 10, 'Qz')],
    },
]


def head_rows(look, expr='fwd', hair=0):
    if look == 0:
        rows = [list(r) for r in HEAD0]
        for j, seg in enumerate(TAIL0[hair]):
            if not seg:
                continue
            for i, ch in enumerate(seg):
                if rows[j][i] == '.' or i < 4:
                    rows[j][i] = ch
        rows = [''.join(r) for r in rows]
    elif look == 1:
        rows = [list(r) for r in HEAD1]
        for j, seg in enumerate(CURL1[hair]):
            for i, ch in enumerate(seg):
                rows[6 + j][i] = ch
        rows = [''.join(r) for r in rows]
    else:
        rows = [list(r) for r in HEAD2]
        for j, seg in enumerate(BOB2[hair]):
            for i in range(5):
                rows[9 + j][i] = seg[i] if i < len(seg) else '.'
        rows = [''.join(r) for r in rows]
    return edit(rows, EXPR[look][expr])


NECKS = [NECK0, NECK1, NECK2]
HAIRS = [sorted(TAIL0), sorted(CURL1), sorted(BOB2)]


def install_heads(look):
    """Every head as P.HEADS['<expr>'] (hair at rest) and P.HEADS['<expr>:<hair>']."""
    for e in EXPR[look]:
        for hr in HAIRS[look]:
            P.HEADS[f'{e}:{hr}'] = (head_rows(look, e, hr), NECKS[look])
        P.HEADS[e] = P.HEADS[f'{e}:0']


# ------------------------------------------------------------------------------------ hands
# The cuff T is the look's shirt colour. An open palm fingers up (cheer, wave), spread fingers, the
# flat hands of the clap edge-on, a fist (the cheer pump), the loose open hand at rest.
HANDS = {
    'palm': (grid("""
        ..S.
        .SSS
        SSSS
        SSSs
        .ss.
        .TT.
    """), {'wrist': (1.5, 5)}),
    'spread': (grid("""
        S.S.S
        SSSSS
        SSSSs
        .SSs.
        .TT..
    """), {'wrist': (1.5, 4.5)}),
    # the wave: the palm bent back at the wrist (the trailing hand of the swing) and forward
    'waveback': (grid("""
        SS...
        SSS.S
        .SSSs
        ..SSs
        ..TT.
    """), {'wrist': (2.5, 4.5)}),
    'wavefwd': (grid("""
        ...SS
        S.SSS
        SSSS.
        sSS..
        .TT..
    """), {'wrist': (1.5, 4.5)}),
    'clapN': (grid("""
        .SS
        SSS
        SSs
        TS.
    """), {'wrist': (0, 3)}),
    'clapF': (grid("""
        SS.
        SSS
        sSS
        .sT
    """), {'wrist': (2, 3)}),
    # both palms pressed together (the clap's impact, seen from the side)
    'clapM': (grid("""
        .SS.
        SSSS
        SSSs
        TSs.
    """), {'wrist': (0, 3)}),
    'fistup': (grid("""
        SS.
        SSs
        Ss.
        TT.
    """), {'wrist': (0.5, 3.5)}),
    'open': (grid("""
        TSSSS
        TSSSs
        .sss.
    """), {'wrist': (0, 1)}),
    'fist': (grid("""
        TSS
        TSs
        .ss
    """), {'wrist': (0, 1)}),
}


def install_hands():
    for k, v in HANDS.items():
        P.HANDS[k] = v
    P.FISTS['fist'] = HANDS['fist']


# ------------------------------------------------------------------------------------ install
def install_torsos():
    P.TORSOS['up'] = (TORSO, TAN)
    P.TORSOS['in'] = (TORSO_IN, TAN_IN)
    P.TORSOS['back1'] = P.shear(P.TORSOS['up'], -1)
    P.TORSOS['back'] = P.shear(P.TORSOS['up'], -2)
    P.TORSOS['lean1'] = P.shear(P.TORSOS['up'], 1)
    P.TORSOS['lean'] = P.shear(P.TORSOS['up'], 2)


def install(look):
    pal = {**UNIFORM_PAL, **LOOKS[look]}
    K.palette(pal, dark={**UNIFORM_DARK, **DARK}, letters=''.join(sorted(pal)))
    install_heads(look)
    install_torsos()
    install_hands()
    pose.RAMP['arm'] = ['J', 'J', 'j', 'q']
    pose.RAMP['armF'] = ['j', 'j', 'q', 'q']
    pose.CUT['arm'] = (0.62, 0.30, 0.04)
    pose.RAMP['leg'] = ['P', 'p', 'o', 'O']
    pose.RAMP['legF'] = ['p', 'o', 'O', 'O']
    pose.HOOKS['post'] = apron_hook
    pose.PEL_DY = 1                          # the crew stands a pixel shorter than the owner
    pose.UPPER, pose.FORE = 7.0, 6.5         # arms long enough to reach above the head
