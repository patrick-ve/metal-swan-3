# BIERFIETS (vehicle/beer-bike): the one palette of the set (a machine: budget 40, plan D1). The look
# is the cast spike's approved sample (docs/design/cast40/chars/beer-bike.py): oak counter and barrel,
# the red-and-cream striped canopy, red stools, steel chassis and posts, brass tap and bell, amber
# beer under a cream head. Light from the upper front. The cork's letters (chars/cork/) are part of it:
# the cannon fires the same cork.

K = '#140c0e'            # the one warm near-black outline (the cast's K)

PAL = {
    'K': K,
    # oak (hi, base, shade, deep)
    '1': '#e0a86a', '2': '#b07d55', '3': '#85583c', '4': '#5b3828',
    # canopy / stool red (hi, base, shade, deep)
    'J': '#f06045', 'j': '#c62f30', 'q': '#861a2e', 'r': '#4a0f1f',
    # cream (canopy, foam, beer head)
    '5': '#fff4dc', '6': '#e6d2b0', '7': '#b8a283',
    # steel (glint, hi, base, shade, deep / tyre)
    't': '#c9d0da', 'A': '#7a8090', 'P': '#4f5360', 'o': '#2f323c', 'O': '#1b1c23',
    # brass and beer (glint, hi, base, deep)
    'G': '#fff184', 'g': '#f6c537', 'n': '#c98c22', 'N': '#7c4e14',
    # soot and char (the damaged body, the wreck)
    'D': '#5e5250', 'd': '#3a3030',
    # the cork (tan ramp; its wire cap is steel + brass): chars/cork/
    'C': '#f2d29a', 'c': '#d0a468', 'k': '#9c7044',
    # the lamp's warm glass
    'L': '#fff7c0',
    # FX letters (the shared ramp, rules.json fxRamp): embers, the lamp glint, foam glints; outside
    # the budget
    'W': '#ffffff', 'F': '#fffbd8', 'y': '#ffe070', 'f': '#ffd040', 'x': '#ff8a24', 'e': '#e0401c',
}
FX = 'WFyfxe'
HL = 'tGLW'

DARK = {}
for grp, d in [('1234', '4'), ('Jjqr', 'r'), ('567', '7'), ('tAPoO', 'O'), ('GgnN', 'N'),
               ('Dd', 'd'), ('Cck', 'k'), ('L', 'n')]:
    for ch in grp:
        DARK[ch] = d
for ch in FX:
    DARK[ch] = ch

# Material ramps (hi, base, shade, deep) for the tube / disc helpers.
OAK = ['1', '2', '3', '4']
RED = ['J', 'j', 'q', 'r']
CREAM = ['5', '6', '7', '7']
STEEL = ['t', 'A', 'P', 'o']
STEEL_DK = ['A', 'P', 'o', 'O']
STEEL_FAR = ['P', 'o', 'O', 'O']
TYRE = ['P', 'o', 'O', 'O']
BRASS = ['G', 'g', 'n', 'N']
CHAR = ['D', 'd', 'O', 'O']
CORK = ['C', 'c', 'k', '4']
