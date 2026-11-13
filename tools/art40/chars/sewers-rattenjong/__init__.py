# DE RATTENJONG (boss/sewers-rattenjong): the giant rat king of the sewers-e hall at 40 px scale
# (docs/design/sewers.md §4.2, wave P5 BOSSES): 16 pose strips and 15 eyes-only strips (the eyes
# as emitters in the dark: king.ts drawEyes; the tumble has none). An animal: no clothes, no words;
# a crown of a bent bicycle wheel and a bottle cap, Gerrit's gold chain, mange, big yellow teeth,
# red eyes, a pink tail with trash knots. Bloodless.
#
# king.ts plays a pose strip by time at 6 ticks a frame and wraps it (`(tick - poseT) / 6`), so a
# strip may hold more frames than the stand-in; every duration is 6 (the GIFs show the real time).
# The tells flash the eyes white (4 x 3, bigger than the 3 x 2 eye) on frame 0 of the tell strip.
import art40 as X
import castkit as K

from . import pal as PL
from . import strips as ST

SET = X.Set(prefix='boss/sewers-rattenjong', budget=40, face=1, outline='K', hl=PL.HL, fx=PL.FX, colours=PL.PAL)


def build(s):
    K.palette(PL.PAL, dark=PL.DARK, letters=''.join(k for k in PL.PAL if k != 'K'))
    ST.build(s)
