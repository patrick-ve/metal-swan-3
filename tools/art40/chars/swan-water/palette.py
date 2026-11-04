# The colours of the Swan's water and air strips: the core palette (tools/art40/chars/swan/
# palette.py, read-only) plus the water line (plan rule 10, the Swan on the canal).
#
# Under the surface line her pixels are repainted in a cool water ramp (the old rig did the same,
# look.md section 5.8): no lit tones under water, the outline turns navy. The canal's own
# see-through front layer tints her once more in the game; the ramp keeps her readable where a
# water rect has no front layer.
import art40 as X

S = X.char('swan')
SP = S.palette

# the water ramp (4 colours; the core has 26: 30 of the 40 of plan D1)
WATER = {
    'A': '#a4cfee',     # a lit part seen through the water (white plumage, steel, the bill)
    'B': '#6a9fd2',     # a mid tone under water
    'C': '#3b65a3',     # a dark part under water (the black legs, leather, shade)
    'E': '#1a2452',     # the outline under the surface: navy
}
# letter -> its tone under water
UNDER = {}
for _c in 'WwSYOR':
    UNDER[_c] = 'A'
for _c in 'vusygoLr':
    UNDER[_c] = 'B'
for _c in 'UNnGhZqlmMx':
    UNDER[_c] = 'C'
UNDER['K'] = 'E'

# The shared FX ramp (tools/art40/rules.json fxRamp; outside the budget): the core's four
# (c white, d pale blue, a / b warm greys: soot) and the second blue for the splash and the foam.
FX_COLOURS = dict(SP.FX_COLOURS)
FX_COLOURS['e'] = '#7fb4e8'
FX = ''.join(sorted(FX_COLOURS))

# the soot of migrate-soot (the 0-cell exit): every tone two steps darker on its own ramp (old:
# scorch(f, 2)); no new colour
SOOT = {
    'W': 'v', 'w': 'u', 'v': 'U', 'u': 'U', 'U': 'n',
    'O': 'q', 'o': 'q', 'q': 'm',
    'N': 'n', 'n': 'K',
    'S': 'g', 's': 'G', 'g': 'h', 'G': 'h', 'h': 'K',
    'Y': 'Z', 'y': 'Z', 'Z': 'M',
    'L': 'm', 'l': 'M', 'm': 'M', 'M': 'K',
    'R': 'x', 'r': 'x', 'x': 'K',
}

# Player 2 (the black swan): the core's swap plus a darker water ramp (black plumage under water)
P2 = dict(SP.P2)
P2.update({'A': '#5b86bb', 'B': '#3a5f96'})


def colours(variant=None):
    """letter -> '#rrggbb': the core palette (P1, or P2 'black'), the water ramp, the FX ramp."""
    pal = SP.colours(variant)
    pal.update(WATER)
    pal.update(FX_COLOURS)
    if variant:
        pal.update(P2)
    return pal
