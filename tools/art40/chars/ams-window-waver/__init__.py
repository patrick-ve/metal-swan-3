# WINDOW WAVER AND THE CAT: the canal-house window of mission ams at 40 px (plan docs/design/ams40.md
# wave 5; contract docs/design/ams40/contract.md "window waver and the cat"). One set, one palette:
# the window with the waver (person, lean) or the ginger cat (cat-swish, cat), every frame inside the
# entity's 20 x 26 window box above the sill (plan rule 10). Drawn facing right, mirrored (face -1):
# she waves at the hero who arrives from the left.
#
# Events the game reads (src/game/content/missions/ams/ambient.ts): WAVER_EMPTY, WAVER_IDLE,
# WAVER_BLINK, WAVER_RAISE (+ WAVER_RAISE_N), WAVER_WAVE_A (the cycle's first frame), WAVER_WAVE_B
# (its other end), WAVER_WAVE_N. The frame times are the strip durations.
import art40 as X

from . import parts
from . import strips

SET = X.Set(prefix='npc/ams/ams-window-waver', budget=28, face=-1, outline='K', hl='wQXS', colours=None)


def build(s):
    strips.build(s)
