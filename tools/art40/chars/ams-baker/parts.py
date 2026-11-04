# The FABEL FRIET owner's own drawn parts and palette (the look of the cast spike's approved sample,
# docs/design/cast40/chars/ams-baker.py): the black shop cap with the gold badge and the gold-piped
# peak, brown hair, stubble; the white shirt; the long black waist apron with gold piping and a gold
# F; the black belt with the gold buckle; charcoal trousers, black work shoes; the steel fry scoop.
#
# The shop uniform (UNIFORM_PAL, UNIFORM_TORSO, apron_hook) is the crew's uniform too: the crew
# sets (chars/ams-staff-*) may import this module (`X.char('ams-baker')`) and call uniform().
#
# install() patches the shared kit tables (one set per process, bake.py).
import castkit as K
import limbs as HK

P = K.P
pose = K.pose

# ------------------------------------------------------------------------------------ palette
# 28 colours (plan D1: at most 28): the outline K, the white shirt (J j q), shop black (C E U),
# gold (Y V Z), charcoal trousers (P p o), hair (A H h Q), skin (L S s z), stubble (b B),
# steel (G g n N), the mouth red R. Letters that share a colour are merged by the bake:
# T = J (cuff), t = q, X = C, x = E, v = U, O = U, w = J (eye white = the shirt white).
UNIFORM_PAL = {
    'K': '#140c0e',                                   # the one warm near-black outline (rig)
    'J': '#fbf7ee', 'j': '#d8d3cc', 'q': '#9e98a0', 'T': '#fbf7ee', 't': '#9e98a0',
    'C': '#4a4652', 'E': '#2c2a33', 'U': '#1b1a20',
    'X': '#4a4652', 'x': '#2c2a33', 'v': '#1b1a20',
    'Y': '#ffe27a', 'V': '#e0a630', 'Z': '#9c6420',
    'P': '#6c6a78', 'p': '#4e4c5a', 'o': '#383642', 'O': '#1b1a20',
}
UNIFORM_DARK = {'J': 'q', 'j': 'q', 'q': 'q', 'T': 't', 't': 't', 'C': 'U', 'E': 'U', 'U': 'U',
                'Y': 'Z', 'V': 'Z', 'Z': 'Z', 'X': 'v', 'x': 'v'}

BAKER_PAL = {
    'A': '#8a5a36', 'H': '#5c3a22', 'h': '#3a2416', 'Q': '#22150f',     # brown hair, the deep line
    'L': '#ffe2c8', 'S': '#f2b48e', 's': '#d18a68', 'z': '#8e5038',     # warm skin
    'b': '#c99478', 'B': '#7a5442', 'w': '#fbf7ee',                     # stubble, the eye white
    'G': '#e6eaf2', 'g': '#a4aabb', 'n': '#5e6478', 'N': '#34374a',     # the steel scoop
    'R': '#b8403a',                                                     # the mouth inside, tongue
    # FX letters: colours of the shared FX ramp (rules.json fxRamp), outside the budget
    'W': '#ffffff', 'I': '#fffbd8', 'y': '#ffe070', 'D': '#7a6e70',
}
FX_LETTERS = 'WIyD'
BAKER_DARK = {'G': 'n', 'g': 'n', 'n': 'N', 'N': 'N', 'R': 'z', 'A': 'h', 'H': 'h', 'h': 'Q',
              'b': 'B', 'B': 'Q', 'L': 's', 'S': 's', 's': 'z', 'z': 'z'}

grid = K.grid


def edit(rows, changes):
    return HK.edit(rows, changes)


# ------------------------------------------------------------------------------------ heads
# 18 x 14, neck (5, 13): the black cap (gold badge, the gold-piped peak forward), brown hair at the
# back, stubble on the jaw; the face in profile facing right. Base: a friendly closed smile.
HEAD = grid("""
    .....UEEEEEU......
    ...UECCCCCCCEU....
    ..UECCCCCCCYYCE...
    .UEECCCCCCCYVCCE..
    hUEEEECCCCCCCCCE..
    hhUUUUUUUUUEEEVVVV
    hhhHhHHHsSQQSL....
    QhhHHHsSSSwQSS....
    QhhHszsSSSSSSL....
    .QhHszsSSSSsSs....
    .QhbsSSbbsSSQs....
    ..QbbSbbbQQQz.....
    ...bbbbbbbbzb.....
    ....zbbbbbb.......
""")
NECK = {'neck': (5, 13)}

# expression edits (row, x, letters) on HEAD
EXPR = {
    'fwd': [],
    'blink': [(7, 10, 'zz')],
    # talking (the sample): the mouth open, the teeth showing
    'talk': [(10, 9, 'sQQQ'), (11, 8, 'Qwwwz'), (12, 9, 'QQz')],
    # half open (a syllable between)
    'talk2': [(10, 10, 'SSQ'), (11, 8, 'bQRRQ'), (12, 9, 'bbz')],
    # a word with the brows up (the point of the sentence)
    'talk3': [(6, 9, 'QQQS'), (7, 9, 'SwQ'), (10, 9, 'sQQQ'), (11, 8, 'QwRRQ'), (12, 9, 'QQz')],
    # happy: the eyes squeezed into arcs, a wide open grin
    'happy': [(6, 9, 'SQQS'), (7, 9, 'QSSQ'), (10, 9, 'QQQQ'), (11, 8, 'QwwwQ'), (12, 9, 'QRRz')],
    # the cheer: brows up, the mouth wide open (a shout)
    'shout': [(6, 9, 'QQQ'), (7, 10, 'wQ'), (9, 10, 'QQQ'), (10, 9, 'QwwwQ'), (11, 8, 'QRRRQ'),
              (12, 9, 'QRRQ'), (13, 9, 'bQQ')],
    # effort (the wind-up): the eye squeezed, the teeth clenched, the brow down
    'effort': [(6, 9, 'SSQQQ'), (7, 9, 'SQQS'), (10, 9, 'sQQQ'), (11, 8, 'Qwwwz'), (12, 9, 'QQQ')],
    # pleased (the settle after the toss): a closed grin, the eye a soft arc
    'pleased': [(7, 10, 'QS'), (10, 11, 'SQ'), (11, 8, 'bQQQz')],
}


def head(expr='fwd'):
    return edit(HEAD, list(EXPR[expr]))


def install_heads():
    for e in EXPR:
        P.HEADS[e] = (head(e), dict(NECK))


# ------------------------------------------------------------------------------------ torsos
# the white shirt: one straight back line, square shoulders, a button placket, a black belt with a
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
TAN = {'neck': (6, -2), 'pelvis': (6, 9), 'shN': (6.5, 2.5), 'shF': (3.5, 3.0)}
# breathing in: the chest swells a pixel forward, the placket stays
TORSO_IN = grid("""
    .qjjJJJJJJ..
    qjjjJJJJqJJ.
    qjjjJJJJJqJJJ
    qjjjjJJJJqJJ
    qjjqjJJJJqJJ
    qjjqjjJJJJqJ
    qjjjqjjJJqJj
    qjjjqjjjJJqj
    qqjjjqjjjqjq
    UEEEEEEEEVYU
    .UUUUUUUUUU.
""")


def install_torsos():
    P.TORSOS['up'] = (TORSO, dict(TAN))
    P.TORSOS['in'] = (TORSO_IN, dict(TAN))
    for name, k in (('back2', -3), ('back', -2), ('back1', -1), ('lean1', 1), ('lean', 2), ('lean2', 3)):
        P.TORSOS[name] = P.shear(P.TORSOS['up'], k)


# ------------------------------------------------------------------------------------ hands
# white shirt cuffs (J) on the stock hand shapes
SCOOP = grid("""
    ......Y.Y.Y.
    .....YVYYVY.
    .....VYZVYV.
    ....GGGGGGgN
    .....gGgggN.
    .....ngggnN.
    ......nnnN..
    ....nN......
    ..SnN.......
    .SSSN.......
    .SSs........
    ..J.........
""")
SCOOP_EMPTY = grid("""
    ............
    ............
    ............
    ....GnnnnngN
    .....gGgggN.
    .....ngggnN.
    ......nnnN..
    ....nN......
    ..SnN.......
    .SSSN.......
    .SSs........
    ..J.........
""")
# the settle after the toss: the scoop dipped back into the fries, half full again (no pop to the
# full idle scoop)
SCOOP_HALF = grid("""
    ............
    ............
    .......Y..Y.
    ....GVYZYVgN
    .....gGgggN.
    .....ngggnN.
    ......nnnN..
    ....nN......
    ..SnN.......
    .SSSN.......
    .SSs........
    ..J.........
""")
# the scoop held level, the bowl forward (talking: the scoop points like a pointer)
SCOOP_POINT = grid("""
    .........Y.Y.
    ........YVYVY.
    ........VYZYV.
    .......GGGGGGN
    .SS.nnngGgggN.
    JSSSNNNnggnN..
    JSSs....nnN...
    .ss...........
""")
# the scoop drawn back low behind the hip (the wind-up): the bowl behind and up, the fries heaped
SCOOP_BACK = K.mirror(SCOOP)
# the flick (release): the bowl tipped forward, its mouth to the front; the fries leave as items
SCOOP_FLICK = grid("""
    ......nGG..
    .....ngGgN.
    .....ngggGN
    .....nggGgN
    ......nngN.
    ....nN.....
    ..SnN......
    .SSSN......
    .SSs.......
    ..J........
""")
# the follow-through: the empty scoop past the top, the bowl upside down to the front
SCOOP_OVER = grid("""
    ..........
    .....NgGGn
    ....NgggGn
    .....NnnnN
    ....nN....
    ...nN.....
    .SnN......
    .SSS......
    .SSs......
    ..J.......
""")

HANDS = {
    'fist': (["JSS", "JSs", ".ss"], {'wrist': (0, 1)}),
    'open': (["JSSSS", "JSSSs", ".sss."], {'wrist': (0, 1)}),
    # the palm out, the fingers up (explaining; the wave)
    'up': ([".SS", "SSs", "SSs", "Ss.", "JJ."], {'wrist': (0.5, 4)}),
    # the fingers spread up (the wave's open hand)
    'spread': (["S.S.", "SSSs", "SSs.", "Ss..", "JJ.."], {'wrist': (0.5, 4)}),
    # the clap: the flat hand edge-on (palm to the other hand)
    'flat': (["JSSSs", "JSSs."], {'wrist': (0, 0.5)}),
    # a raised fist (the cheer): the knuckles up
    'fistup': ([".SS.", "SSSs", "SSs.", "JJ.."], {'wrist': (0.5, 3)}),
    'scoop': (SCOOP, {'wrist': (2, 11)}),
    'scoopempty': (SCOOP_EMPTY, {'wrist': (2, 11)}),
    'scoophalf': (SCOOP_HALF, {'wrist': (2, 11)}),
    'scooppoint': (SCOOP_POINT, {'wrist': (0, 5.5)}),
    'scoopback': (SCOOP_BACK, {'wrist': (9, 11)}),
    'scoopflick': (SCOOP_FLICK, {'wrist': (2, 9)}),
    'scoopover': (SCOOP_OVER, {'wrist': (2, 9)}),
}
# the scoop's bowl centre from the wrist (the 'hand' point of the toss's release frame is the bowl:
# the item leaves the scoop there)
BOWL = {'scoop': (5.5, -8), 'scoopflick': (6, -6), 'scoopback': (-5.5, -8)}


def install_hands():
    for k, v in HANDS.items():
        P.HANDS[k] = v
    P.FISTS['fist'] = HANDS['fist']


# ------------------------------------------------------------------------------------ items
def install_fx():
    # the clap: short impact lines out of the meeting hands (anchor: the contact point)
    P.FX['clap'] = (grid("""
        ..W...
        W...W.
        ......
        W...W.
        ..W...
    """), (2, 2))
    P.FX['clap2'] = (grid("""
        .I.I.
        I...I
        .I.I.
    """), (2, 1))
    # the swing smear: the arc the full scoop sweeps from behind the hip to the front, under the
    # hand (anchor: where the scoop is on the smear frame, the arc trails behind and below)
    P.FX['swoosh'] = (grid("""
        y.............
        Iy............
        .IIy..........
        ..IIIyy.......
        ....IIIIIyy...
        .......IIIIyyy
    """), (13, 2))
    # a motion arc over the top of the flick (the follow-through)
    P.FX['arc'] = (grid("""
        ...IIy
        .II...
        I.....
    """), (5, 0))


def install_items():
    # single fries in flight (the release spray), the curl of a fry, a fry tumbling
    P.ITEMS['fry'] = (["Y", "V"], {'c': (0, 0.5)})
    P.ITEMS['fry2'] = (["YV"], {'c': (0.5, 0)})
    P.ITEMS['fry3'] = ([".Y", "V."], {'c': (0.5, 0.5)})


# ------------------------------------------------------------------------------------ the apron
# The long waist apron hung from the belt to below the knee (the sample's 11 x 11 panel): the dark
# back edge (U), the shop black (E), the lit front (C), the gold piping on the front edge (V) and
# the hem (V, Z in the shade), the gold F on the front. It is cloth: the hem follows the knees
# (the forward knee pushes it out), a pose may add a sway (follow-through) and a lift (a hop).
APRON_TOP = (-4, -1)       # top-left from the pelvis
APRON_W, APRON_H = 11, 11
F_ROWS = ["YY", ".Y", "YY", ".Y"]       # the gold F as drawn on the sample (mirror-read as F)
STATE = {'pocket': False}  # the scoop handle sticks out of the apron pocket (walk, clap, cheer)


def apron_shape(meta, p):
    """(left, right) column of every apron row in canvas coordinates."""
    px, py = meta['pel']
    a = p.get('apron', {})
    sway = a.get('sway', 0.0)
    kn = [meta[k]['knee'][0] - px for k in ('legN', 'legF') if k in meta]
    front = max(kn) if kn else 4
    back = min(kn) if kn else -3
    push = min(2.0, max(0.0, front - 4.0) * 0.5)    # the forward knee pushes the hem out
    pull = max(-1.0, min(0.0, back + 3.0) * 0.3)    # the back knee drags the back edge a little
    out = []
    for r in range(APRON_H):
        t = r / (APRON_H - 1)
        e = t * t * (3 - 2 * t)
        left = px + APRON_TOP[0] + round((pull + sway) * e)
        right = px + APRON_TOP[0] + APRON_W - 1 + round((push + sway) * e)
        out.append((int(left), int(right)))
    return out


def apron_hook(cv, X, p, layer, meta):
    if layer not in ('lower', 'full') or meta.get('pel') is None:
        return
    if 'legN' not in meta:
        return
    px, py = meta['pel']
    a = p.get('apron', {})
    lift = a.get('lift', 0)               # the hem rides up (a hop, a squat)
    rows = apron_shape(meta, p)
    y0 = int(round(py + APRON_TOP[1]))
    h = APRON_H - lift
    z = 3.6
    for r in range(h):
        left, right = rows[r]
        w = right - left + 1
        y = y0 + r
        for i in range(w):
            x = left + i
            u = i / max(1, w - 1)
            if r == h - 1:
                ch = 'Z' if u < 0.25 else 'V'
                if i == 0:
                    ch = 'U'
            elif i == w - 1:
                ch = 'V'
            elif i == 0:
                ch = 'U'
            elif u < 0.42 or (r >= h - 3 and u < 0.55):
                ch = 'E'
            else:
                ch = 'C'
            cv.px(x, y, ch, z, 'apron')
        # a fold line in the cloth (the shade of the knee's push)
    # the gold F on the front (rows 2-5), 3 columns in from the front edge
    for j, line in enumerate(F_ROWS):
        r = 2 + j
        if r >= h - 1:
            break
        left, right = rows[r]
        for i, ch in enumerate(line):
            if ch != '.':
                cv.px(right - 4 + i, y0 + r, ch, z + 0.1, 'apron')
    if STATE['pocket'] or a.get('pocket'):
        # the scoop's handle and rim out of the apron pocket at the front of the hip
        left, right = rows[1]
        hx = right - 2
        for k, ch in enumerate('Ggn'):
            cv.px(hx, y0 + 1 - k, ch, z + 0.2, 'apron')
        cv.px(hx - 1, y0 - 1, 'n', z + 0.2, 'apron')
        cv.px(hx + 1, y0, 'N', z + 0.2, 'apron')


# ------------------------------------------------------------------------------------ install
SHIRT_RAMP = {'arm': ['J', 'J', 'j', 'q'], 'armF': ['j', 'j', 'q', 'q']}


def uniform(pal, dark=None):
    """Install the shop uniform plus a person's own colours (skin, hair, props)."""
    K.palette({**UNIFORM_PAL, **pal}, dark={**UNIFORM_DARK, **(dark or {})})
    pose.RAMP['arm'] = list(SHIRT_RAMP['arm'])
    pose.RAMP['armF'] = list(SHIRT_RAMP['armF'])
    pose.CUT['arm'] = (0.62, 0.30, 0.04)
    pose.RAMP['leg'] = ['P', 'p', 'o', 'O']
    pose.RAMP['legF'] = ['p', 'o', 'O', 'O']
    install_torsos()
    pose.HOOKS['post'] = apron_hook


def install():
    uniform(BAKER_PAL, BAKER_DARK)
    install_heads()
    install_hands()
    install_items()
    install_fx()
