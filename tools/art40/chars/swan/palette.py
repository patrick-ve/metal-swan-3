# The Swan's palette (plan D1: at most 40 colours for the Swan sprite; the rider is a separate
# sprite with his own palette). One warm near-black outline (the heroes' K), hard ramps of 3-5
# hue-shifted tones per material, light from the upper front.
#
# Letters are the Swan's own: the Swan layers are finished on their own canvases (selout and
# outline with DARK below), so they never mix with a hero's letters.

PAL = {
    'K': '#140c0e',                                   # the one warm near-black outline (= the heroes')
    # plumage: warm white light, cool blue-grey shade (5)
    'W': '#fffdf4', 'w': '#efece2', 'v': '#cfd2dc', 'u': '#a2a9bf', 'U': '#6c7490',
    # bill: orange (3)
    'O': '#ffb35c', 'o': '#ec7a26', 'q': '#ab4719',
    # black skin: the knob, the lores, the nail, legs and webbed feet (2)
    'N': '#4b4754', 'n': '#2a2731',
    # steel: the drum, the barrel, the cooling jacket, the grip posts (5)
    'S': '#f0f4f8', 's': '#b2bbca', 'g': '#76829a', 'G': '#485264', 'h': '#282d3a',
    # brass: buckles, the hub, rivets (3)
    'Y': '#ffe68a', 'y': '#d3a33a', 'Z': '#875c1c',
    # leather: the saddle, the belts, the grips (4)
    'L': '#c06a3c', 'l': '#8a3c22', 'm': '#5c2416', 'M': '#36120c',   # M: also the gullet of the open bill
    # the saddle cloth: blue (3)
    'R': '#3f86c8', 'r': '#285a9a', 'x': '#173062',
}

# selout: a part's edge pixel next to a clearly nearer part takes this tone
DARK = {
    'W': 'u', 'w': 'u', 'v': 'u', 'u': 'U', 'U': 'U',
    'O': 'q', 'o': 'q', 'q': 'q',
    'N': 'n', 'n': 'n',
    'S': 'G', 's': 'G', 'g': 'G', 'G': 'h', 'h': 'h',
    'Y': 'Z', 'y': 'Z', 'Z': 'Z',
    'L': 'm', 'l': 'm', 'm': 'M', 'M': 'M',
    'R': 'x', 'r': 'x', 'x': 'x',
}

RAMP = {
    'white': ['W', 'w', 'v', 'u'],
    'far': ['w', 'v', 'u', 'U'],          # the far wing and the far leg's feathers: one step darker
    'neck': ['W', 'w', 'v', 'u'],
    'leg': ['N', 'N', 'n', 'n'],          # the near leg: lit on its front half (the far leg stays in shade: depth)
    'legF': ['n', 'n', 'n', 'n'],
    'steel': ['S', 's', 'g', 'G'],
    'jacket': ['s', 'g', 'G', 'h'],
    'dark': ['g', 'G', 'h', 'h'],
    'leather': ['L', 'l', 'm', 'M'],
    'cloth': ['R', 'R', 'r', 'x'],
    'brass': ['Y', 'y', 'Z', 'Z'],
}

# The shared FX ramp (tools/art40/rules.json fxRamp; outside the budget): speed lines of the fast
# frames (bash, tumble, the righting) and the soot of the scuffs decal.
FX_COLOURS = {'c': '#ffffff', 'd': '#bfe4ff', 'a': '#7a6e70', 'b': '#4a4046'}
FX = ''.join(sorted(FX_COLOURS))

# Player 2 (rule 6: the same pixels, other colours): the black swan (user's pick, 2026-11-03):
# coal plumage with cool highlights, a red bill, red saddle cloth (the steel, brass and leather stay)
P2 = {
    'W': '#6f6a7e', 'w': '#46424f', 'v': '#33303c', 'u': '#24212b', 'U': '#1a1720',
    'O': '#ff8a8a', 'o': '#d8323c', 'q': '#8c1628',
    'R': '#de4652', 'r': '#a1263a', 'x': '#5f1628',
}


def colours(variant=None):
    """letter -> '#rrggbb' for P1 (variant None) or P2 ('black'); with the FX letters."""
    pal = dict(PAL)
    pal.update(FX_COLOURS)
    if variant:
        pal.update(P2)
    return pal
