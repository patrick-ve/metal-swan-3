# HERRING GULL: the aggressive gull of mission ams at 40 px (plan docs/design/ams40.md wave 4 "riders
# and birds"). The look is the cast spike's approved sample (docs/design/cast40/chars/seagull.py):
# white head and body, silver-grey wings with black tips and white mirror spots, a yellow beak with
# the red spot, a frowning pale eye, pink feet.
#
# One set, no variants: enemy/seagull (19 strips). Drawn facing right (the game's unflipped gull).
# Strips and their logic time: docs/design/ams40/contract.md "herring gull (seagull)". Events the
# game reads (src/game/content/locals/seagull.ts): GLOAT_PECK (the gloat frame the beak hits the
# fries); the take-off, pull-up and turn timings are the baked strip durations.
import art40 as X

from . import palette
from . import strips

SET = X.Set(prefix='enemy/seagull', budget=28, face=1, outline='K', hl=palette.HL, fx=palette.FX_LETTERS)


def build(s):
    palette.install()
    strips.build(s)
