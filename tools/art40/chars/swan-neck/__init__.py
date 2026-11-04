# The Swan's neck and gun (vehicle/swan/neck*, crouch-neck*, duck-neck*, swim-neck*, beak-flash;
# P2 vehicle/swan-mute) at 40 px: stage 2 of the Swan (plan docs/design/ams40.md "The Swan", D3).
#
# The neck is free (honk, blink, hurt, relax); the 9 aim angles turn the barrel on the drum's hub
# (theta = +45 - 22.5 * i, the game's neckIndex). `muzzle` = `cannon` = the resting barrel's tip.
# Every timed face is a strip of 9 aims x its phases: frame = aim * PHASES + phase (the game reads
# the NECK_*_PHASES events and the strip's own durations; swan.ts pickNeck / neckPhase).
#
#   draw.py    one picture: the neck with its face, the belt, the plate, the barrel, the effects
#   strips.py  the neck poses per aim and phase, the strips, their timing, the events
#
# Imports the core (tools/art40/chars/swan/) read-only: S = art40.char('swan').
import art40 as X

from . import draw as D

SET = X.Set(prefix='vehicle/swan', budget=40, face=1, hl='YyZ', fx=D.FX, colours=D.colours())
SET.shares_prefix = True            # swan, swan-neck and swan-water: one prefix, disjoint strips

P2_PREFIX = 'vehicle/swan-mute'


def build(s):
    from . import strips
    strips.build(s)
