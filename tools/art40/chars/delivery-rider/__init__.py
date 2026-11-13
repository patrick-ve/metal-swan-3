# DELIVERY RIDER: the meal-delivery courier on his city bike, mission ams (and sewers) at 40 px (plan
# docs/design/ams40.md wave 4). The look is the cast spike's approved sample
# (docs/design/cast40/chars/delivery-rider.py): the black bike helmet, the slate jacket with the
# green collar and cuffs, black gloves and trousers, the big green cube backpack with a plain
# burger, the stone-grey city bike with a chrome bell.
#
# Sets: enemy/delivery-rider (skin b, the base id) with the palette variants enemy/delivery-rider-a
# and enemy/delivery-rider-c (skins a, c). The base id alone also has the food-cube prop
# (src/game/content/locals/rider.art.ts registers it for the base prefix only). Strips and their
# logic time: docs/design/ams40/contract.md "delivery rider". Events the game and its tests read:
# KICK_HIT (the kick's extended frame, at tick 3), TELL_RING (the bell's ring frames), BIKE_LIE.
import art40 as X

from . import parts
from . import strips

SET = X.Set(prefix='enemy/delivery-rider', budget=28, face=1, outline='K', hl='w', fx=parts.FX_LETTERS)


def build(s):
    parts.install()
    strips.build(s)
    s.variant('enemy/delivery-rider-a', parts.SKIN_A)
    s.variant('enemy/delivery-rider-c', parts.SKIN_C)
