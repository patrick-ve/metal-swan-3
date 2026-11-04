# FABEL FRIET OWNER (the baker) of mission ams at 40 px (plan docs/design/ams40.md wave 5). The look
# is the cast spike's approved sample (docs/design/cast40/chars/ams-baker.py): the black shop cap
# with the gold badge, stubble, the white shirt, the long black apron with gold piping and the F,
# the steel fry scoop heaped with fries.
#
# Set: npc/ams/ams-baker (one set, no variants). Strips and their logic time:
# docs/design/ams40/contract.md "Fabel Friet baker". Event the game reads: TOSS_RELEASE (the frame
# the tossed prize leaves the scoop, from the 'hand' point; it starts at tick 14 of the 28-tick toss).
import art40 as X

from . import parts
from . import strips

SET = X.Set(prefix='npc/ams/ams-baker', budget=28, face=1, outline='K', hl='wY', fx=parts.FX_LETTERS)


def build(s):
    parts.install()
    strips.build(s)
