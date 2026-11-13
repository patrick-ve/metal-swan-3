# RUNNER RAT: the dog-sized sewer rat of mission sewers at 40 px (wave P5 RATS; spec
# docs/design/sewers.md §3; the game's ids enemy/sewers-rat-runner/*, src/game/content/sewers/rats/).
# A warm brown rat with a cream belly, pink ears, paws and scaly tail and glowing red eyes. Drawn by
# the shared rat rig (ratrig.py, looks.py, strips.py: the leaper, spitter and brute sets import
# this package, art40.char('sewers-rat-runner')). Facing right like the stand-in.
import art40 as X

from . import looks
from . import ratrig  # noqa: F401  (the other rat sets reach it through this package)
from . import strips

SET = X.Set(prefix='enemy/sewers-rat-runner', budget=28, face=1, outline='K', hl=looks.HL, fx=looks.FX,
            colours=looks.colours('runner'))


def build(s):
    looks.install('runner')
    strips.build_rat(s, looks.runner(), 'runner')
