# BIERFIETS (vehicle/beer-bike): the stag party's rented beer bike at 40 px (plan docs/design/ams40.md
# wave 3), a machine set (budget 40). The approved look is the cast spike's sample
# (docs/design/cast40/chars/beer-bike.py): the barrel stands on the rear deck (no roof keg).
#
# The game composes the bike from part strips that share the bike's anchor (the floor point under its
# middle; content/stag/beer-bike.ts and content/vehicles/beer-bike/bike.ts draw(), back to front):
# wheel-far, body (0 intact, 1 damaged), turret (the aim step), the riders on the stools and the
# driver (sets of their own), posts (the near roof posts over the riders), wheel. Centre-anchored
# pieces: wheel / wheel-far (4 mechanical steps, one per 3 px of roll), keg (4 steps, one per 4 px),
# cork (the cannon's cork: the stag cork's frames), foam (the special, one 20-tick pass), debris
# (4 pieces), wreck (the burnt-out body). The body numbers the game reads are in body.py.
import art40 as X
import castkit as K

from . import body as B
from . import pal as P
from . import small as S

SET = X.Set(prefix='vehicle/beer-bike', budget=40, face=1, outline='K', hl=P.HL, fx=P.FX, colours=P.PAL)

WHY_STEPS = 'mechanical frames picked by the code (damage state, aim step, roll step), never played'


def build(s):
    K.palette(P.PAL, dark=P.DARK, letters=''.join(k for k in P.PAL if k != 'K'))
    cork = X.char('cork')
    s.strip('body', [X.Frame(*B.body('ok')), X.Frame(*B.body('damaged'))], 9999, cls='mechanical')
    s.strip('posts', [X.Frame(*B.posts())], 6, cls='mechanical')
    s.strip('turret', [X.Frame(*B.turret(k)) for k in range(5)], 9999, cls='mechanical')
    s.strip('wheel', [X.Frame(*S.wheel(k)) for k in range(4)], 9999, cls='mechanical')
    s.strip('wheel-far', [X.Frame(*S.wheel(k, far=True)) for k in range(4)], 9999, cls='mechanical')
    s.strip('wreck', [X.Frame(*B.body('wreck'))], 6, cls='mechanical', defer=True)
    s.strip('keg', [X.Frame(*S.keg(k)) for k in range(4)], 4, cls='mechanical')
    s.strip('cork', cork.frames(), cork.TPF, cls='mechanical')
    s.strip('foam', [X.Frame(*S.foam(k)) for k in range(6)], S.FOAM_DUR, loop=False, cls='mechanical', defer=True)
    s.strip('debris', [X.Frame(*S.debris(k)) for k in range(4)], 9999, cls='mechanical', defer=True)
    s.event('WHEEL_STEPS', 4)
    s.event('WHEEL_STEP_PX', 3)
    s.event('KEG_STEPS', 4)
    s.event('KEG_STEP_PX', 4)
    s.event('TURRET_FRAMES', 5)
    s.event('BODY_INTACT', 0)
    s.event('BODY_DAMAGED', 1)
