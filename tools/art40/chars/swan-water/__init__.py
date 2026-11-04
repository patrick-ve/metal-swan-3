# The Swan on the water and in the air (vehicle/swan/*, P2 vehicle/swan-mute/*) at 40 px: STAGE 2 of
# wave 7 (plan docs/design/ams40.md "The Swan"), slug 'swan-water'. It shares the prefix with the
# core set 'swan' (stage 1: the ground strips) and 'swan-neck' (the neck and the gun): one prefix,
# disjoint strips (SET.shares_prefix). It imports the core read-only: S = art40.char('swan').
#
#   palette.py  the core palette + the water ramp (under the surface) + the FX ramp (splash, foam)
#   wings.py    the spread wings (flight, take-off, splash-down) and the wing beat
#   render.py   pose -> the layers (b, f, w, n), the water line, foam, splashes, the -front overlay
#   poses.py    the pose tables of every strip
#   strips.py   the strips, their timing and the events the game code reads
import art40 as X

from . import palette as WP

SET = X.Set(prefix='vehicle/swan', budget=40, face=1, hl='YyZ', fx=WP.FX, colours=WP.colours())
SET.shares_prefix = True            # swan, swan-neck and swan-water: one prefix, disjoint strips


def build(s):
    from . import strips
    strips.build(s)
