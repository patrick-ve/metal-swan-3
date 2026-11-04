# HANDHAVER: the city enforcement officer of mission ams at 40 px (plan docs/design/ams40.md wave 1,
# the pilot). The look is the cast spike's approved sample (tools/art40/kit/samples/handhaver.py):
# navy cap and uniform, the warm hi-vis vest with silver bands and a radio, the ticket book.
#
# Sets: enemy/handhaver (skin a) with the palette variant enemy/handhaver-b (skin b); skin c is a
# look of its own (curly hair: a part change, contract) in chars/handhaver-c/, drawn by this code.
# Strips and their logic time: docs/design/ams40/contract.md "handhaver". Events the game reads:
# THROW_RELEASE, GLOAT_* (the gloat frame roles), TELL_WINDUP.
import art40 as X
import castkit as K

from . import parts
from . import strips

SET = X.Set(prefix='enemy/handhaver', budget=28, face=1, outline='K', hl='w', fx=parts.FX_LETTERS)


def build(s, look='a'):
    parts.install(look)
    strips.build(s)
    if look == 'a':
        s.variant('enemy/handhaver-b', parts.SKIN_B)
