# STAG PARTIER, look 2: stocky (wider, not taller), tan skin, a big mop of black curls and a full
# beard, the lime party T-shirt with the white star, sky-blue shorts, black sneakers. The cast
# spike's approved sample docs/design/cast40/chars/stag-partier-2.py. A part swap on the same
# animation as look 0 (rule 6): all the drawing is chars/stag-partier/ (strips.py with this Look).
# No selfie flash here (the gloat spawns enemy/stag-partier/flash from look 0's set).
import art40 as X
import castkit as K

base = X.char('stag-partier')
kit = base.kit

SET = X.Set(prefix='enemy/stag-partier-2', budget=28, face=1, outline='K', hl='w', fx=kit.FX_LETTERS)

PAL = {
    'A': '#5a463a', 'H': '#33261e', 'h': '#1e1612', 'Q': '#120c0a', 'U': '#120c0a', 'O': '#120c0a',  # curls, beard
    'L': '#eebc94', 'S': '#cc8e62', 's': '#a46a44', 'z': '#6c3e28',                              # tan skin
    'P': '#8cc8f0', 'p': '#5c98cc', 'o': '#3a6698',                                              # sky-blue shorts
    'v': '#120c0a',                                                                              # black soles
}

HEAD = K.grid("""
    ...hhHhhHAhh....
    ..hHAHHHAHHAHh..
    .hHHHAHHHHAHHAh.
    hHAHHHHAHHHAHHh.
    hHHHAHHHHHSLLLh.
    hHHAHHHHSSLLLLS.
    QhHHHHHsSSQQQSL.
    QhHHHszSSSSwQSL.
    QhHHHszsSSSSSSSL
    .QhHHhsShhSSSSs.
    .QhhhhhhhhhhhhH.
    ..QhhhhhQwwwwwh.
    ...QhhhhhQQQQh..
    ....QQhhhhhhh...
""")

EXPR = kit.expressions(eye=7, ex=11, mth=11, mx=8)
# the beard hides the mouth's lower row: the open mouths are a dark gap in the beard
EXPR['shout'] = [(6, 10, 'QQQ'), (7, 11, 'wQ'), (11, 8, 'QQQQQQ'), (12, 9, 'QbbQ')]
EXPR['happy'] = [(6, 10, 'SQQ'), (7, 10, 'QSS'), (11, 8, 'QwwwwwQ'), (12, 9, 'QbbQ')]
EXPR['hurt'] = [(6, 10, 'QQS'), (7, 11, 'QQ'), (11, 8, 'QwQwQw')]
EXPR['dazed'] = [(7, 11, 'Qw'), (11, 8, 'hQQQh')]
EXPR['panic'] = [(5, 10, 'QQQ'), (6, 10, 'SSS'), (7, 10, 'wwQ'), (11, 9, 'QQQ'), (12, 9, 'QbQ')]
EXPR['swig'] = [(7, 11, 'zz'), (11, 8, 'hhQQh')]
EXPR['aah'] = [(7, 11, 'zz'), (11, 8, 'hQQQh'), (12, 9, 'QbQ')]
EXPR['soot'] = [(7, 10, 'wwQ'), (11, 8, 'hQQQh')]
EXPR['sootblink'] = [(7, 10, 'zzz'), (11, 8, 'hQQQh')]
# looking up at the phone: the face tilts back (the brow and the eye a row up, the chin out)
EXPR['up'] = [(5, 8, 'SSQQQS'), (6, 7, 'sSSSwQSL'), (7, 6, 'zSSSSSSSL')]

LOOK = kit.Look('look2', 'stocky', PAL, HEAD, (6, 13), expr=EXPR, limbs=(1.15, 1.1), legs=(6.5, 6.0),
                sleeves=(3.0, 6.9), pdy=1, soot=('Q', 'x', 'X'), sneaker='black')


def build(s):
    base.strips.build(s, LOOK)
