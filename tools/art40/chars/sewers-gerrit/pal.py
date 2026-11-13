# GOUDEN GERRIT: the one palette of the set (Gerrit, the white stretch limo and its parts, his fx),
# machines and multi-part budget 40 (plan D1). Light from the upper front. 28 colours + the shared
# FX ramp (flame, flash, glint, soot: outside the budget).

K = '#140c0e'          # the one warm near-black outline (the cast's K)

PAL = {
    'K': K,
    # gold: suit, chains, shotgun, the limo's trim, rims, bumpers (hi, lit, base, shade, deep)
    'Y': '#fff3b0', 'G': '#f4c64c', 'g': '#c99328', 'q': '#8c5a1c', 'Q': '#4a2c12',
    # white: the limo's paint, the fur collar and cuffs, the loafers (hi, base, turn, shade, deep)
    '1': '#fbfaf6', '2': '#dedbd4', '3': '#b2aca8', '4': '#7a7482', '5': '#4a4656',
    'T': '#fbfaf6',    # the fur cuff of the kit hands (= '1': merged by the bake)
    # black: shirt, trousers, tyres, the cabin's dark (lit, base, deep)
    'X': '#4c4856', 'x': '#2e2b34', 'v': '#1c1a20',
    # skin (a sunbed tan)
    'L': '#ffd7b4', 'S': '#f0a87c', 's': '#c87a56', 'z': '#844630',
    # slicked black hair (the gel shine, base, shade)
    'A': '#77708a', 'H': '#3c3646', 'h': '#231f2a',
    # tinted glass and sunglasses (glint, top, base)
    'm': '#8a9cc0', 'n': '#3c4660', 'N': '#222634',
    # red: the tail lights, the open mouth
    'R': '#ff5a3c', 'r': '#a8201e',
    # wood: the shotgun's stock and pump
    'W': '#a5643a', 'w': '#62341c',
    # FX letters (the shared ramp, rules.json fxRamp): flame, flash, glint, soot; outside the budget
    'O': '#ffffff', 'F': '#fffbd8', 'y': '#ffe070', 'f': '#ffd040', 'c': '#ff8a24', 'e': '#e0401c',
    'D': '#7a6e70', 'd': '#4a4046',
}
FX = 'OFyfceDd'
HL = 'Y1mRO'

DARK = {}
for grp, d in [('YGg', 'q'), ('q', 'Q'), ('Q', 'Q'), ('12T', '3'), ('3', '4'), ('45', '5'),
               ('Xxv', 'v'), ('LSs', 'z'), ('z', 'z'), ('AHh', 'h'), ('mnN', 'N'), ('Rr', 'r'),
               ('Ww', 'w')]:
    for ch in grp:
        DARK[ch] = d
for ch in FX:
    DARK[ch] = ch
