# The FABEL FRIET owner who briefs the squad (ams). The shop uniform lives here too (a white cloth
# shirt, a long black waist apron with gold piping and a gold F, a black belt with a gold buckle,
# charcoal trousers, black work shoes); the three crew members (ams-staff-0/1/2) import it.
# Facing right while drawn; cast.py mirrors him (face=-1: he faces the hero arriving from the left).
import castkit as K

INFO = dict(
    name='FABEL FRIET OWNER', mission=['ams'], role='npc', kind='HUMANOID', face=-1,
    pose='talking, the fry scoop raised like a pointer, the free hand open',
    note='Black cap with a gold badge and piped peak, stubble, white shirt, the long black shop apron '
         'with gold piping and an F; the scoop is now a steel scoop heaped with fries, held up to point.',
    old='npc/ams/ams-baker/talk#1', air=0,
)

# ------------------------------------------------------------------ the shop uniform (shared)
UNIFORM_PAL = {
    # white cloth shirt (J lit, j mid, q shade); T / t = the cuffs of the stock hand parts
    'J': '#fbf7ee', 'j': '#d8d3cc', 'q': '#9e98a0', 'T': '#fbf7ee', 't': '#9e98a0',
    # shop black: cap, apron, belt, shoes (C lit, E mid, U deep)
    'C': '#4a4652', 'E': '#2c2a33', 'U': '#1b1a20',
    'X': '#4a4652', 'x': '#2c2a33', 'v': '#1b1a20',
    # gold: piping, buckle, the F, cap badge (and the fries)
    'Y': '#ffe27a', 'V': '#e0a630', 'Z': '#9c6420',
    # charcoal trousers
    'P': '#6c6a78', 'p': '#4e4c5a', 'o': '#383642', 'O': '#1b1a20',
}
UNIFORM_DARK = {'J': 'q', 'j': 'q', 'q': 'q', 'T': 't', 't': 't', 'C': 'U', 'E': 'U', 'U': 'U',
                'Y': 'Z', 'V': 'Z', 'Z': 'Z', 'X': 'v', 'x': 'v'}

# the white shirt: one straight back line, square shoulders, a button placket, a black belt with a
# gold buckle at the bottom (pelvis on the belt)
UNIFORM_TORSO = K.grid("""
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
UNIFORM_TAN = {'neck': (6, -2), 'pelvis': (6, 9), 'shN': (6.5, 2.5), 'shF': (3.5, 3.0)}

# the long waist apron, hung from the belt to below the knee: black, lit at the front, gold piping
# on the hem and the front edge, a gold F on the front
APRON = K.grid("""
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


def apron_hook(cv, X, p, layer, meta):
    if layer not in ('lower', 'full'):
        return
    px, py = meta['pel']
    cv.grid(int(round(px + APRON_AT[0])), int(round(py + APRON_AT[1])), APRON, 3.6, 'apron')


SHIRT_RAMP = {'arm': ['J', 'J', 'j', 'q'], 'armF': ['j', 'j', 'q', 'q']}


def uniform(pal, dark=None):
    """Install the shop uniform plus a person's own colours (skin, hair, props)."""
    K.palette({**UNIFORM_PAL, **pal}, dark={**UNIFORM_DARK, **(dark or {})})
    K.pose.RAMP['arm'] = list(SHIRT_RAMP['arm'])
    K.pose.RAMP['armF'] = list(SHIRT_RAMP['armF'])
    K.pose.CUT['arm'] = (0.62, 0.30, 0.04)
    K.P.TORSOS['up'] = (UNIFORM_TORSO, UNIFORM_TAN)
    K.pose.HOOKS['post'] = apron_hook


# ------------------------------------------------------------------ the owner
BAKER_PAL = {
    # brown hair
    'A': '#8a5a36', 'H': '#5c3a22', 'h': '#3a2416', 'Q': '#22150f',
    # warm skin
    'L': '#ffe2c8', 'S': '#f2b48e', 's': '#d18a68', 'z': '#8e5038',
    # stubble
    'b': '#c99478', 'B': '#7a5442', 'w': '#fffaf0',
    # steel scoop
    'G': '#e6eaf2', 'g': '#a4aabb', 'n': '#5e6478', 'N': '#34374a',
}

# head 16 x 14, neck at (5, 13): black cap (gold badge, gold-piped peak), brown hair at the back,
# stubble, talking (mouth open), friendly eye and raised brow
HEAD = K.grid("""
    .....UEEEEEU....
    ...UECCCCCCCEU..
    ..UECCCCCCCYYCE.
    .UEECCCCCCCYVCCE
    hUEEEECCCCCCCCCE
    hhUUUUUUUUUEEEVVVV
    hhhHhHHHsSQQSL..
    QhhHHHsSSSwQSS..
    QhhHszsSSSSSSL..
    .QhHszsSSSSsSs..
    .QhbsSSbbsQQQs..
    ..QbbSbbQwwwz...
    ...bbbbbbQQzb...
    ....zbbbbbb.....
""")
NECK = {'neck': (5, 13)}

SCOOP = K.grid("""
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
SCOOP_AN = {'wrist': (2, 11)}


def frame():
    uniform(BAKER_PAL, dark={'G': 'n', 'g': 'n', 'n': 'N'})
    K.P.HEADS['fwd'] = (HEAD, NECK)
    K.P.HANDS['scoop'] = (SCOOP, SCOOP_AN)
    upper = K.A.up(near=K.A.hand((9, 1), 'scoop', 'hand', bend=-1),
                   far=K.A.hand((8, 4), 'open', 'hand', bend=-1))
    lower = K.A.LOWER['stand'][0][0]
    return K.humanoid(upper, lower)
