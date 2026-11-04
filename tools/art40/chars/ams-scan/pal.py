# SCANAUTO: the palette (one for every strip of the set, machines budget 40, plan D1). The look is
# the cast spike's approved sample (docs/design/cast40/chars/ams-scan-car.py): 4-tone white paint,
# tinted glass, black plastic, the city's red, silver alloy, the officer at the wheel, amber
# hazards, yellow plates, the red scan light. Light from the upper front.

K = '#140c0e'          # the one warm near-black outline (the cast's K)

PAL = {
    'K': K,
    # white paint (hi, base, turn, dark)
    '1': '#fdfdff', '2': '#e1e6ef', '3': '#b3bccc', '4': '#77809a',
    # tinted glass (glint, top, base, foot)
    'G': '#8d9cb8', 'g': '#4e5a74', 'n': '#2f3649', 'N': '#1e2232',
    # black plastic / tyre (lit, base, dark)
    'P': '#55545f', 'p': '#33323b', 'o': '#1f1d24',
    # the city's red
    'R': '#ee4a50', 'r': '#c8202f', 'Q': '#86121f',
    # alloy / chrome
    'S': '#f4f6fa', 's': '#b8bfcc', 'z': '#7c8394', 'Z': '#4b5060',
    # the officer: skin, cap, vest
    'L': '#eeb08a', 'l': '#a86c52', 'V': '#3c4c80', 'v': '#232b4e', 'Y': '#dfe63a', 'X': '#97a01c',
    # amber hazard, yellow plate
    'A': '#ffb12c', 'a': '#c96a10', 'J': '#f2c230', 'j': '#a87c14',
    # the scan: red light, the hot lens core, the deep red
    'O': '#ff4436', 'w': '#ffe0cc', 'E': '#b81c22',
    # the grey band on the box, the headlight's cool tip
    'q': '#9aa3b5', 'i': '#bfe4ff',
    # FX letters (the shared ramp, rules.json fxRamp): flashes, sparks, smoke; outside the budget
    'W': '#ffffff', 'F': '#fffbd8', 'y': '#ffe070', 'f': '#ffd040', 'c': '#ff8a24', 'e': '#e0401c',
    'D': '#7a6e70', 'd': '#4a4046',
}
FX = 'WFyfcedD'
HL = 'wSWi'

DARK = {}
for grp, d in [('1234', '4'), ('GgnN', 'N'), ('Ppo', 'o'), ('RrQ', 'Q'), ('SszZ', 'Z'), ('Ll', 'l'),
               ('Vv', 'v'), ('YX', 'X'), ('Aa', 'a'), ('Jj', 'j'), ('OwE', 'E'), ('q', '4'), ('i', 'g')]:
    for ch in grp:
        DARK[ch] = d
for ch in FX:
    DARK[ch] = ch
