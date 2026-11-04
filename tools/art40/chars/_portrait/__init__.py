# The portrait kit of the select screen (docs/design/select40.md): shared helper code of the five
# select-<hero> sets (no build function: not a set). Import it from a set:
#
#   import art40 as X
#   PK = X.char('_portrait')
#   hero = PK.Hero('vincent', ramps, p, eyes, brows, nose, mouth, neck, hooks, rest)
#   def build(s): PK.make(s, hero, grey=[...], loop=[(pose, ticks), ...], pick=[(pose, ticks), ...])
#
# Files: core.py (the canvas, the palette of ramps, the quantizer, the light, outlines, creases,
# the grey map), head.py (the parametric skull, its height field and light), parts.py (backdrop,
# eyes, brows, nose, mouth, stubble, sweat, veins, hair masses, cloth), rig.py (Hero: one pose ->
# the colour and the grey rows; the contract's timing helpers and make), look.py (zooms and sheets
# next to the before portraits, for review under tmp/).
from . import core, head, parts, rig  # noqa: F401
from .rig import Hero, make, GREY  # noqa: F401
