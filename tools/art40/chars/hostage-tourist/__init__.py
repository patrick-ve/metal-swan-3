# THE TIED TOURIST (the hostage of mission ams) at 40 px (plan docs/design/ams40.md wave 3). The look
# is the cast spike's approved sample (docs/design/cast40/chars/hostage-tourist.py): the orange shirt
# with the green palm print, the khaki sun hat, black shades, the flash camera on the chest, khaki
# trousers, brown shoes; tied to a wooden folding chair, or blind in a burlap sack.
#
# Set: item/hostage/tourist/* (14 strips) and item/hostage/flash (the camera flash, flash.py; contract docs/design/ams40/contract.md "tied tourist").
# Events the game reads: TIED_* (the frame roles hostages.ts tiedFrame picks), GAG_* (SAY CHEESE!:
# the flash frame and its tick), GIVE_* (the gift leaves the hand at tick 12).
import art40 as X

from . import parts
from . import strips
from . import props  # noqa: F401  (shared with tools/art40/chars/bind/)

SET = X.Set(prefix='item/hostage', budget=28, face=1, outline='K', hl=parts.HL, fx=parts.FX_LETTERS)
# One set for the two contract prefixes item/hostage/tourist/ (strips 'tourist/<name>') and
# item/hostage/flash (strip 'flash'). item/hostage also names the out-of-scope hostage kinds' own
# code-drawn strips; the slug is the lead's (wave 3), not the prefix's last segment.
SET.shares_prefix = True


def build(s):
    parts.install()
    strips.build(s)
