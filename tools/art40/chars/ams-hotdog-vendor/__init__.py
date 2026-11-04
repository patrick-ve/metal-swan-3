# HOT-DOG VENDOR: the man in the hot-dog stand on the Museumplein (mission ams, section b) at
# 40 px (plan docs/design/ams40.md wave 5). The look is the cast spike's approved sample
# (docs/design/cast40/chars/ams-hotdog-vendor.py): the tricolour cap, the big moustache, the
# sky-blue shirt over a belly, the white apron with the mustard smear.
#
# One set: npc/ams/ams-hotdog-vendor (no variants). Strips and their logic time:
# docs/design/ams40/contract.md "hot-dog vendor". Exported constant the game reads: STAND_DY
# (how much lower than the old figure his feet stand in the stand's box: rule 10, the hatch).
import art40 as X

from . import parts
from . import strips

SET = X.Set(prefix='npc/ams/ams-hotdog-vendor', budget=28, face=1, outline='K', hl=parts.HL)


def build(s):
    parts.install()
    strips.build(s)
