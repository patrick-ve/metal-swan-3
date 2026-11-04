# MECHA HASLEMA: the high-fidelity palette (plan docs/design/ams40.md "The mayor", decision D1: at
# most 64 colours plus transparent; this palette has 57 body colours, the FX letters at the end are
# the shared FX ramp of tools/art40/rules.json and sit outside the budget).
#
# Every material is a hard ramp, lightest first, hue-shifted: the lights lean warm/cyan, the shadows
# lean toward violet (steel, navy) or toward red-brown (wig, wood, gold). Light from the upper front.
# Letters are this set's own: the module never patches the shared rig tables.

OUTLINE = 'K'

PAL = {
    'K': '#140c0e',                                   # the one warm near-black outline (as every character)
    # steel: the robot skull, the neck, the joints, the forearms, the boot caps (0 = the specular)
    '0': '#ffffff', '1': '#e9eff6', '2': '#c5cedb', '3': '#9ba6b8',
    '4': '#717b93', '5': '#4d556d', '6': '#323849', '7': '#20232f',
    # the wig: dark chocolate wave locks (a = the lit curl)
    'a': '#e5a774', 'b': '#ab6b3f', 'c': '#7e4628', 'd': '#5a311c', 'e': '#3d2013', 'f': '#26130c',
    # gold: the chain of office, the medallion rim and crown, buttons, the jaw bolt
    'g': '#fff4bc', 'h': '#ffd55c', 'i': '#e3a43a', 'j': '#ad7121', 'k': '#6c4114',
    # the cream boucle jacket (also the stamp label paper)
    'A': '#fffcf3', 'B': '#f2e9d5', 'C': '#dfd1b5', 'D': '#c2b092', 'E': '#9a886e', 'F': '#6b5c4b',
    # crimson: the blouse, the medallion field, the stamp rubber and its letters, a red cable
    'R': '#ff7d70', 'S': '#e3404d', 'T': '#b32238', 'U': '#7c1430', 'V': '#4b0c22',
    # navy trousers
    'N': '#8494ca', 'O': '#6070a9', 'P': '#44518b', 'Q': '#2e3667', 'W': '#1c2145',
    # boot leather
    'X': '#6e5452', 'Y': '#463330', 'Z': '#2a1c1c',
    # the wood of the stamp
    'l': '#efb67e', 'm': '#ca8c56', 'n': '#965a30', 'o': '#5e3519',
    # enamel shields on the chain
    'p': '#7dbbff', 'q': '#3b75d2', 'r': '#213f8c', 's': '#74d690', 't': '#2f8b4b',
    # the eye glow (u = white-hot core ... z = the cold socket)
    'u': '#fff7d4', 'v': '#ffc85c', 'w': '#ff7b2b', 'x': '#e2311f', 'y': '#9b1319', 'z': '#530a13',
    # the medallion core (frames 1 / 2 in production; the circuit glow in a broken plate)
    'G': '#d4fcff', 'H': '#62e2f2', 'I': '#1e8db0',
    # FX (the shared ramp of rules.json, outside the budget): sparks, soot
    '+': '#fffbd8', '*': '#ffe070', '^': '#ff8a24', '~': '#e0401c', '8': '#7a6e70', '9': '#4a4046',
    '=': '#bfe4ff', '-': '#7fb4e8',                     # the cool flash of the medallion core (FX)
}

FX = '+*^~89=-'
HL = '0guG'                                            # single-pixel glints allowed

STEEL = ['1', '2', '3', '4', '5', '6']                # 6 tones, '0' on top as the specular, '7' the deepest gap
WIG = ['a', 'b', 'c', 'd', 'e', 'f']
GOLD = ['g', 'h', 'i', 'j', 'k']
JACK = ['A', 'B', 'C', 'D', 'E', 'F']
CRIM = ['R', 'S', 'T', 'U', 'V']
NAVY = ['N', 'O', 'P', 'Q', 'W']
BOOT = ['X', 'Y', 'Z']
WOOD = ['l', 'm', 'n', 'o']
GLOW = ['u', 'v', 'w', 'x', 'y', 'z']
CORE = ['G', 'H', 'I']

RAMPS = [['0'] + STEEL + ['7'], WIG, GOLD, JACK, CRIM, NAVY, BOOT, WOOD, ['p', 'q', 'r'], ['s', 't'],
         GLOW, CORE]


def _dark():
    """Selout: a part's edge behind a nearer part takes a tone two steps down its own ramp."""
    d = {}
    for ramp in RAMPS:
        for i, ch in enumerate(ramp):
            d[ch] = ramp[min(len(ramp) - 1, i + 2)]
    return d


DARK = _dark()


def step(ch, n):
    """The tone n steps down (n > 0) or up (n < 0) the ramp of letter ch (clamped)."""
    for ramp in RAMPS:
        if ch in ramp:
            i = max(0, min(len(ramp) - 1, ramp.index(ch) + n))
            return ramp[i]
    return ch


def body_colours():
    """The distinct body colours (the budget count): every letter but the FX letters."""
    return sorted({v.lower() for k, v in PAL.items() if k not in FX})
