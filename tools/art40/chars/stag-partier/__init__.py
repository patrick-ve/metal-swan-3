# STAG PARTIER, look 0: a member of the stag party of mission ams at 40 px (plan
# docs/design/ams40.md wave 3). The look is the cast spike's approved sample
# (docs/design/cast40/chars/stag-partier.py): sunburnt and heavy (wider, not taller), short brown
# hair, the lime party T-shirt with the white star, navy shorts, white sneakers, the fizzy-wine
# bottle (green glass, gold foil, the cream label).
#
# Set enemy/stag-partier (look 0; it also holds the gloat's selfie flash). Look 2 is chars/
# stag-partier-2/, the groom chars/stag-groom/: the same animation (strips.py) with their own parts
# (kit.Look). Strips and their logic time: docs/design/ams40/contract.md "stag partier". Events the
# game reads: FIRE_POP, FIRE_POP_TICK, TOAST_CLINK, SIT_CRANK_FRAMES.
import art40 as X
import castkit as K

from . import kit
from . import strips

SET = X.Set(prefix='enemy/stag-partier', budget=28, face=1, outline='K', hl='w', fx=kit.FX_LETTERS)

PAL = {
    'A': '#a8743e', 'H': '#70482a', 'h': '#48301c',                  # short brown hair, the belt
    'L': '#ffd8c4', 'S': '#f6a688', 's': '#dc735e', 'z': '#963e36',  # sunburnt skin
    'b': '#ff7a72',                                                  # blush (and the label band)
    'P': '#4a5c94', 'p': '#34426e', 'o': '#232c4c',                  # navy shorts
}

HEAD = K.grid("""
    .....hhHHHh....
    ...hhHAHHAAH...
    ..hhHHHAHHAAH..
    .hhHHHHHAHHSSL.
    .hhhHHHHHSSLLL.
    .hhhHHHSSQQQSL.
    .QhhHsSSSSwQSL.
    .QhhszsSSSSSSSL
    ..QhszsSSbbSSSs
    ..QSSSSSSQwwwQ.
    ...QsSSSSQQQQ..
    ...zsSSSSSSSs..
    ....zzsssssz...
""")

EXPR = kit.expressions(eye=6, ex=10, mth=9, mx=9)
# looking up at the phone: the brow and the eye a row up, the chin out
EXPR['up'] = [(4, 9, 'SSQQQ'), (5, 9, 'SSwQS'), (6, 9, 'SSSSS'), (9, 9, 'SQwwwQ')]

LOOK = kit.Look('look0', 'heavy', PAL, HEAD, (6, 12), expr=EXPR, limbs=(1.25, 1.15), legs=(7.0, 6.5),
                sleeves=(3.0, 7.4), soot=('Q', 'h', 'v'), sneaker='white')


def build(s):
    strips.build(s, LOOK, with_flash=True)
