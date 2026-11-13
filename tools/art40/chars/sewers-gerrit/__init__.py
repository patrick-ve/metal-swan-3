# GOUDEN GERRIT (boss/sewers-gerrit): the mini-boss at the end of sewers-a at 40 px (docs/design/
# sewers.md §4.1, wave P5 BOSSES): Gerrit in the sunroof of his white stretch limo, the limo with its
# damage stages and the wreck, the open back door, the flying door, the pellet, the gold chain, the
# hood flames and the gold glint. One palette (pal.py, machines and multi-part budget 40).
#
# Strips (limo.ts and art.ts read them):
#   sunroof   Gerrit's 10 poses by role (G_IDLE .. G_SLUMP), feet anchor, facing right. art.ts
#             registers them again as `boss/sewers-gerrit/gerrit` in a fixed 48 x 48 box with the
#             anchor (24, 47): limo.ts clips the frame by buffer rows (`gerritSrc`) to show only the
#             rows above the roof, which needs the stand-in's box.
#   run       the flee: 6 frames (limo.ts reads fleeT / 4 % 6)
#   limo      0 clean, 1 dented, 2 battered, 3 the wreck (LIMO_CLEAN .. LIMO_WRECK)
#   door      the back door swung open; door-bit the door that flies off
#   pellet    the shotgun pellet (5 x 5); chain the gold chain lob (spins); flame the hood fire;
#   glint     the gold glint at the pump tell and the headlight flash
import art40 as X
import castkit as K

from . import figure as F
from . import limo as L
from . import pal as PL
from . import small as S

SET = X.Set(prefix='boss/sewers-gerrit', budget=40, face=1, outline='K', hl=PL.HL, fx=PL.FX, colours=PL.PAL)

ROLES = ['G_IDLE', 'G_PUMP_A', 'G_PUMP_B', 'G_FIRE', 'G_SHOUT', 'G_SWING', 'G_THROW', 'G_GLOAT', 'G_SHOCK', 'G_SLUMP']
WHY_ROLES = 'frames by role: limo.ts picks the pose (G_*); the engine never plays the strip'


def build(s):
    K.palette(PL.PAL, dark=PL.DARK, letters=''.join(k for k in PL.PAL if k != 'K'))
    F.install()
    s.strip('sunroof', F.sunroof(), 60, cls='roles', why=WHY_ROLES)
    s.strip('run', F.run(), 4, cls='locomotion',
            why='6 frames: limo.ts reads the flee by index (fleeT / 4 % 6); cosmetic, untargetable, fading')
    s.strip('limo', L.limo_frames(), 60, cls='mechanical', why='damage stages by role (partState, LIMO_WRECK)')
    s.strip('door', [L.door_frame()], 60, cls='mechanical', why='one frame: the open door while doorT runs')
    s.strip('door-bit', [L.door_bit()], 60, cls='piece', why='one tumbling piece (fx tumble turns it)')
    s.strip('pellet', [S.pellet()], 60, cls='piece', why='one frame (look angle): the 3 x 3 hitbox, 5 x 5 art')
    s.strip('chain', S.chain(), 4, cls='piece', why='the lobbed chain spins (look anim, 4 ticks a frame)')
    s.strip('flame', S.flame(), 5, cls='mechanical', why='3 flame steps: limo.ts picks f and (f + 1) % 3')
    s.strip('glint', S.glint(), 4, loop=False, cls='overlay', why='a 12-tick glint (FxEntity) and the headlight flash (frame 1)')
    for i, k in enumerate(ROLES):
        s.event(k, i)
    s.event('LIMO_CLEAN', 0)
    s.event('LIMO_WRECK', 3)
