# DUCKS: the mallards of mission ams at 40 px, drake and hen (plan docs/design/ams40.md wave 4;
# contract docs/design/ams40/contract.md "mallards (drake and hen)"; approved looks
# docs/design/cast40/chars/duck-drake.py, duck-hen.py). One set, one palette for both birds (the
# drake and the hen are two looks drawn in their own blocks, as the game picks them today). Drawn
# facing right; the root row is the water line (the canal surface the sections place them on).
#
# The set registers npc/ams/ams-ducks/{paddle,drake-hurry,hen-hurry,drake-dabble,hen-dabble}. The
# bare id npc/ams/ams-ducks (the old 4-frame strip) cannot be a strip of a baked set: the game
# composes it from the paddle frames (src/game/content/missions/ams/npc.art.ts) with DUCK_UP /
# DUCK_DOWN. The slug is the prefix's last segment, 'ams-ducks' (the contract key is 'ducks').
import art40 as X

from . import parts
from . import strips

SET = X.Set(prefix='npc/ams/ams-ducks', budget=28, face=1, outline='K', hl=parts.HL, fx=parts.FX)


def build(s):
    strips.build(s)
