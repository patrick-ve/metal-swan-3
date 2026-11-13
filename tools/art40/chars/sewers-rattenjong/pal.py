# DE RATTENJONG: the one palette of the set (the giant rat king, his crown of junk, Gerrit's gold
# chain, the trash knots of his tail). Light from the upper front. Machines / multi-part budget 40.

PAL = {
    'K': '#140c0e',                                       # the one warm near-black outline
    # fur: a greasy grey-brown (hi, lit, base, shade, deep)
    '1': '#b9a690', '2': '#87745f', '3': '#5d4d42', '4': '#3d3230', '5': '#241b1d',
    # the paler belly and throat
    'b': '#d2c0a4', 'c': '#a08a72',
    # naked pink skin: paws, ears, nose, tail (hi, base, shade, deep), the mange
    'P': '#f6b2aa', 'p': '#d88482', 'q': '#a6566a', 'Q': '#6a2c40', 'M': '#c86478',
    # big yellow teeth
    'T': '#fff2a6', 't': '#e0b844', 'u': '#987018',
    # the red eyes (glint, glow, deep)
    'E': '#ffc4a8', 'R': '#ff3a2a', 'r': '#a01020',
    # the bent bicycle wheel (steel) and the bottle cap
    'S': '#e6ebf0', 's': '#9aa2ae', 'z': '#5a606e', 'C': '#e8402e', 'k': '#962020',
    # Gerrit's gold chain
    'G': '#ffe27a', 'g': '#d8a630', 'h': '#8a5a18',
    # trash knots on the tail: a teal bag, a purple bag, an orange can, an olive sack, a white wipe
    'N': '#42b0a4', 'n': '#1f6a6a', 'V': '#9466c4', 'v': '#56327a', 'Y': '#f2902e', 'J': '#a8501a',
    'L': '#8e9c3c', 'l': '#56602a', '6': '#ecebe2', '7': '#a8a69c',
    # the mouth inside
    'm': '#5a1a26',
    # FX (the shared ramp, outside the budget): the white eye flash, dust of the sweep
    'O': '#ffffff', 'F': '#fffbd8', 'D': '#7a6e70', 'd': '#4a4046',
}
FX = 'OFDd'
HL = 'ERrTSGO'

DARK = {}
for grp, d in [('123', '4'), ('45', '5'), ('bc', '3'), ('Ppq', 'Q'), ('QM', 'q'), ('Tt', 'u'), ('u', 'u'),
               ('ERr', 'r'), ('Ss', 'z'), ('z', 'z'), ('Ck', 'k'), ('Ggh', 'h'), ('Nn', 'n'), ('Vv', 'v'),
               ('YJ', 'J'), ('Ll', 'l'), ('67', '7'), ('m', 'm')]:
    for ch in grp:
        DARK[ch] = d
for ch in FX:
    DARK[ch] = ch
