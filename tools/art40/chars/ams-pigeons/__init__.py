# PIGEONS: the city pigeon flock of mission ams at 40 px (plan docs/design/ams40.md wave 4; contract
# docs/design/ams40/contract.md "pigeon flock"; approved look docs/design/cast40/chars/pigeon.py).
# One bird, one palette; AmsPigeons (src/game/content/missions/ams/ambient.ts) draws it once per bird
# with a flip. Drawn facing right (the game's unflipped bird faces right).
#
# The set registers npc/ams/ams-pigeons/{idle,peck,walk,takeoff,fly}. The bare id npc/ams/ams-pigeons
# (the old 5-role strip: stand, peck, step, flap A, flap B) cannot be a strip of a baked set: the
# game composes it from these frames (src/game/content/missions/ams/npc.art.ts) with the PIGEON_*
# events. The slug is the prefix's last segment, 'ams-pigeons' (the slug rule; the contract key is 'pigeons').
import art40 as X

from . import parts
from . import strips

SET = X.Set(prefix='npc/ams/ams-pigeons', budget=28, face=1, outline='K', hl=parts.HL)


def build(s):
    strips.build(s)
