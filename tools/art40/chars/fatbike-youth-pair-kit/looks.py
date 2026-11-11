# The fatbike youths' LOOKS 0-3 as part swaps on the stage-1 fatbike kit (tools/art40/chars/
# fatbike-youth/, read-only here): every look keeps the kit's animation, bike and rig; a look is
#  - its colours (a palette patch: the hoodie ramp J j q r, the trackpants a b B, the hair H h and
#    the bike frame G g n N), and
#  - its HEAD parts (the headgear over every expression, and the bare head of the deaths and the
#    flee, when the headgear is gone).
# The looks follow the game's four youth styles (rider.art.ts YOUTH_LOOKS before ams40):
#   0 black cap, red hoodie, grey trackpants, gold bike (stage 1, the approved cast sample)
#   1 purple hoodie with the hood up, stone (khaki) trackpants, sky-blue bike
#   2 white cap, teal hoodie, navy trackpants, a buzz cut, stone-grey bike
#   3 orange hoodie with the hood up, black trackpants, blond hair, green bike
# Skins a / b / c are palette patches of the skin letters (L S s z) only; look 0 also darkens its
# hair for skins b and c (stage 1).
import art40 as X

base = X.char('fatbike-youth')
BP = base.parts
P = BP.P
grid = BP.grid

# ------------------------------------------------------------------------------------ heads
# All heads are 13 rows (5 headgear + 8 face) with the neck at (5, 12), like look 0's, so every
# expression edit (BP.EXPR: row, x, letters) lands on the same face pixels.

# The hood up (looks 1, 3), in the hoodie's own letters: a round dome over the skull, the lit rim
# of the opening over the brow, the hood falling down the back of the head to the neck.
HOOD = grid("""
    ....qjjjjjq.......
    ..qjjJJJJJjjq.....
    .qjjJJJJJJJJjq....
    qjjjJJJJJJJJJq....
    qjjjjjjjjjjJJjq...
""")


def hood_face(face):
    """The face rows with the hood down the back of the head: the cols behind the cheek become hood
    (q j, the dark inside r next to the cheek), down to the bunched hood at the neck."""
    f = list(face)
    f[0] = 'qjjr' + f[0][4:]
    f[1] = 'qjjr' + f[1][4:]
    f[2] = 'qjjr' + f[2][4:]
    f[3] = 'qjjr' + f[3][4:]
    f[4] = '.qjr' + f[4][4:]
    f[5] = '.qjj' + f[5][4:]
    f[6] = '..qj' + f[6][4:]
    f[7] = '...qj' + f[7][5:]
    return f


# The white cap of look 2: the cast cap's shape in the sneaker whites (X lit, x, v the band).
WHITE_CAP = [r.translate(str.maketrans({'A': 'X', 'P': 'X', 'p': 'x', 'o': 'v'})) for r in BP.CAP]

# Bare heads (the deaths and the flee: the headgear is gone).
TOP_HOOD1 = BP.TOP                         # look 1: short dark hair under the hood
TOP_BLOND = grid("""
    ..................
    ....hHHHHh........
    ..hHHHHHHHHh......
    .hHHHHHHHHHHHh....
    hhHHHHhHHHHHh.....
""")
TOP_BUZZ = grid("""
    ..................
    ..................
    ....hhhhhh........
    ..hhHhHhHhh.......
    hhhhhhhhhhh.......
""")


def head_table(look):
    """{expression name: rows} for a look: '<e>' with the headgear, 'nc_<e>' bare."""
    out = {}
    for e, ed in BP.EXPR.items():
        if look in (1, 3):
            top = HOOD
            face = hood_face(BP.FACE)
            # the hood rim covers row 4: the raised brows of 'panic' stay on row 5
            ed_on = [(y, x, s) for y, x, s in ed if y >= 5]
        elif look == 2:
            top, face, ed_on = WHITE_CAP, BP.FACE, ed
        else:
            top, face, ed_on = BP.CAP, BP.FACE, ed
        bare = {0: BP.TOP, 1: TOP_HOOD1, 2: TOP_BUZZ, 3: TOP_BLOND}[look]
        out[e] = BP.edit(top + face, ed_on)
        out['nc_' + e] = BP.edit(bare + BP.FACE, ed)
    return out


# ------------------------------------------------------------------------------------ colours
# Look palettes (patches over look 0's PAL). The bike's blacks, the sneaker whites, the rims, the
# outline and the brows are the same in every look.
LOOK_PAL = {
    0: {},
    1: {'J': '#ad84de', 'j': '#7c52b4', 'q': '#533284', 'r': '#2c1a4a',          # purple hoodie
        'a': '#cbb68e', 'b': '#9c8866', 'B': '#6c5c46',                          # stone trackpants
        'H': '#3a2c2a',
        'G': '#c4ecff', 'g': '#6cbdee', 'n': '#3a84c2', 'N': '#22507e'},         # sky-blue bike
    2: {'J': '#62d8c6', 'j': '#28a49a', 'q': '#17716f', 'r': '#0d4048',          # teal hoodie
        'a': '#5c6e9e', 'b': '#3e4c7a', 'B': '#28325a',                          # navy trackpants
        'H': '#2e2622',
        'G': '#e8e4d8', 'g': '#b4ad9c', 'n': '#857e70', 'N': '#57524a'},         # stone-grey bike
    3: {'J': '#ffb456', 'j': '#f0822c', 'q': '#c0501c', 'r': '#6c2a14',          # orange hoodie
        'a': '#4f5360', 'b': '#3a3d48', 'B': '#282a33',                          # black trackpants (the bike's blacks)
        'H': '#ecc463', 'h': '#a8742c',                                          # blond
        'G': '#c8f08c', 'g': '#7cc650', 'n': '#3f8f3a', 'N': '#245a2a'},         # green bike
}

SKIN_A = {k: BP.PAL[k] for k in 'LSsz'}
SKINS = {'a': SKIN_A, 'b': {k: BP.SKIN_B[k] for k in 'LSsz'}, 'c': {k: BP.SKIN_C[k] for k in 'LSsz'}}


def skin_pal(look, skin):
    """The palette patch of a skin: the skin letters; look 0 also darkens its hair (stage 1)."""
    p = dict(SKINS[skin])
    if look == 0:
        p['H'] = {'a': BP.PAL, 'b': BP.SKIN_B, 'c': BP.SKIN_C}[skin]['H']
    return p


def look_colours(look, skin='a'):
    """Every body letter's colour for a look and a skin (look 0's PAL patched)."""
    pal = {k: v for k, v in BP.PAL.items() if k not in BP.FX_LETTERS}
    pal.update(LOOK_PAL[look])
    pal.update(skin_pal(look, skin))
    return pal


def install_look(look):
    """Patch the kit tables for a look as THE rider (the standard part names): look 0's install()
    with the look's colours, then the look's heads."""
    BP.install(dict(LOOK_PAL[look]))
    nk = {'neck': (5, 12)}
    for name, rows in head_table(look).items():
        P.HEADS[name] = (rows, nk)
