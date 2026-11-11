# FATBIKE YOUTH, look 0 (mission ams, plan docs/design/ams40.md wave 4): the hang youth on the gold
# fat-tyre e-bike (black cap, red hoodie, grey trackpants, white sneakers; the speaker on the rack).
# The look is the cast spike's approved sample (docs/design/cast40/chars/fatbike-youth.py).
#
# Sets: enemy/fatbike-youth (skin a; it also holds the tumbling cap) with the palette variants
# enemy/fatbike-youth-0b and enemy/fatbike-youth-0c (skins b, c: the same pixels).
# THE FATBIKE KIT (shared with stage 2: the looks 1-3 and the pairs, which import this package
# with art40.char('fatbike-youth')): ridekit (drawing helpers, the seated rider), bike (the fat
# bike: tilt, crank, roll, yaw, the wreck), ride (one frame on the bike, the PASSENGER hook), parts
# (palette and parts of look 0: install()), strips (every strip: build(s, with_cap=True)).
# Strips and their logic time: docs/design/ams40/contract.md "fatbike youth". Events the game
# reads: KICK_HIT (the kick's extended frame, from tick 3).
import art40 as X

from . import parts
from . import strips

SET = X.Set(prefix='enemy/fatbike-youth', budget=28, face=1, outline='K', hl='w', fx=parts.FX_LETTERS)


def build(s):
    parts.install()
    strips.build(s, with_cap=True)
    s.variant('enemy/fatbike-youth-0b', parts.SKIN_B)
    s.variant('enemy/fatbike-youth-0c', parts.SKIN_C)
