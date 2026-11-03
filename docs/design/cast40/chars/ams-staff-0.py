# The FABEL FRIET crew (ams): three people in the shop uniform (the owner's: chars/ams-baker.py),
# one body, three heads and three colourings (shirts as in the game: white, teal, red; the apron,
# belt, trousers and shoes are the shared shop uniform). ams-staff-1 and ams-staff-2 call build(look) here.
#   0  ponytail and freckles, fair skin, blond hair   - cheering, both arms up
#   1  curly black hair under the shop cap, dark skin - clapping
#   2  dark bob and round glasses, medium skin        - waving
import importlib

import castkit as K

INFO = dict(
    name='FABEL FRIET CREW 0', mission=['ams'], role='npc', kind='HUMANOID', face=-1,
    pose='cheering, both arms up, mouth wide open',
    note='Blond ponytail that swings out behind, freckles, the white crew shirt and the shop apron shared with the owner '
         '(white shirt, black apron with gold piping and an F); one body for the whole crew.',
    old='npc/ams/ams-staff/0/cheer#1', air=0,
)

BAKER = importlib.import_module('chars.ams-baker')

LOOKS = [
    dict(  # 0: blond, fair, freckles
        pal={'A': '#f2d27a', 'H': '#cf9e48', 'h': '#94642c', 'Q': '#3a2414',
             'L': '#ffe6d2', 'S': '#f7c2a2', 's': '#de9478', 'z': '#a85e48', 'w': '#fffaf0'}),
    dict(  # 1: black curls, dark skin
        pal={'A': '#5a4a44', 'H': '#3a2e2c', 'h': '#241c1c', 'Q': '#140e10',
             'L': '#c88e66', 'S': '#a4693f', 's': '#7c4a2c', 'z': '#4e2c1c', 'w': '#fffaf0',
             # teal shop shirt (J lit, j mid, q shade; T / t = the cuffs)
             'J': '#64ccbc', 'j': '#30988c', 'q': '#1a6462', 'T': '#64ccbc', 't': '#1a6462'}),
    dict(  # 2: dark brown bob, medium skin, glasses
        pal={'A': '#7a4e34', 'H': '#4e2e1e', 'h': '#2e1a12', 'Q': '#1a0f0c',
             'L': '#f6d2b0', 'S': '#dca27a', 's': '#b87a58', 'z': '#7c4a34', 'w': '#fffaf0',
             # red shop shirt
             'J': '#e65a52', 'j': '#b8323a', 'q': '#741c28', 'T': '#e65a52', 't': '#741c28'}),
]

# heads, facing right, neck anchor given per head. Faces follow the approved hero layout (eye and
# brow at the front, ear on the cheek, the nose tip past the face line), with softer jaws.
HEADS = [
    # 0: blond fringe, a ponytail tied high at the back that swings out; freckles; a big open cheer
    (K.grid("""
        ......hHHHHh.....
        ....hHAAAHAAAh...
        ...hHAAAAHAAAAh..
        .hQhHAAHHAAAAAAh.
        hHHQHHHHHHAHSLLh.
        hAHhHHHHHHsSQQSL.
        hHhhHHHHssSSwQSL.
        hHh.QhHHszSSSSSSL
        .hh..QhHzsSzSzSs.
        .h....QhssSSzzzs.
        ......QhsSSzwwwz.
        .......QsSSzQQz..
        ........zsssss...
    """), {'neck': (8, 12)}),
    # 1: tight black curls under the black shop cap (gold badge, piped peak); eyes shut with joy
    (K.grid("""
        .....UEEEEEU....
        ...UECCCCCCCEU..
        ..UECCCCCCCYYCE.
        .UEECCCCCCCYVCCE
        hUEEEECCCCCCCCCE
        hAhUUUUUUUUUEEEVVVV
        AHhAHhhsSSSSQSL..
        hhAHhhsSSSQSQS...
        QAHhszsSSSSSSSL..
        .QhhszsSSSSSsSs..
        .QhhssSSSzzzzs...
        ..QhsSSSzwwwz....
        ...QzsSSSzzs.....
        ....zzssss.......
    """), {'neck': (5, 13)}),
    # 2: a dark bob cut straight at the jaw, a fringe, round tortoiseshell glasses, a wide smile
    (K.grid("""
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
        .hh..QsSSzwwz..
        ......zsssss...
    """), {'neck': (6, 12)}),
]

# hands of the crew: an open palm fingers up (cheer, wave), a flat hand edge-on (clap)
PALM = (K.grid("""
    ..S.
    .SSS
    SSSS
    SSSs
    .ss.
    .TT.
"""), {'wrist': (1.5, 5)})
SPREAD = (K.grid("""
    S.S.S
    SSSSS
    SSSSs
    .SSs.
    .TT..
"""), {'wrist': (1.5, 4.5)})
CLAP_N = (K.grid("""
    .SS
    SSS
    SSs
    TS.
"""), {'wrist': (0, 3)})
CLAP_F = (K.grid("""
    SS.
    SSS
    sSS
    .sT
"""), {'wrist': (2, 3)})

POSES = [
    # cheer: both arms thrown up, the near hand a little higher and forward
    # (both arms rise just behind the head, z 4.5, so the whole face and the ponytail stay clear and
    # the hands and wrists show above the head; the shoulders lift)
    lambda: K.A.up(near=K.A.hand((5.5, -13.2), 'spread', 'hand', bend=1, sh=(0, -1.5), z=4.5),
                   far=K.A.hand((-6, -12.6), 'spread', 'hand', bend=-1, sh=(0, -1.5))),
    # clap: the two hands meet in front of the chest
    lambda: K.A.up(near=K.A.hand((6, 1.5), 'clapN', 'hand', bend=-1),
                   far=K.A.hand((10, 0.5), 'clapF', 'hand', bend=-1, z=5.5)),
    # wave: the near hand up beside the head, the far arm relaxed
    lambda: K.A.up(near=K.A.hand((10, -8.5), 'spread', 'hand', bend=-1, z=4.5),
                   far=K.A.hand((3, 9), 'open', 'hand', bend=-1)),
]


def build(look):
    BAKER.uniform(LOOKS[look]['pal'])
    K.P.HEADS['fwd'] = HEADS[look]
    K.P.HANDS['palm'] = PALM
    K.P.HANDS['spread'] = SPREAD
    K.P.HANDS['clapN'] = CLAP_N
    K.P.HANDS['clapF'] = CLAP_F
    K.pose.PEL_DY = 1                 # the crew stands a pixel shorter than the owner
    K.pose.UPPER, K.pose.FORE = 7.0, 6.5   # arms long enough to reach above the head
    if look == 0:
        K.pose.UPPER, K.pose.FORE = 7.5, 7.0   # straight up: the full reach
    return K.humanoid(POSES[look](), K.A.LOWER['stand'][0][0])


def frame():
    return build(0)
