# The street crooks of mission sewers (docs/design/sewers.md §3) at 40 px: shared code of the sets
# sewers-dealer-a, -b, -c, sewers-pimp-a (+ the palette variant enemy/sewers-pimp-b) and
# sewers-bodyguard-a (+ the palette variant enemy/sewers-bodyguard-b). No build here: a helper package.
# Looks are part swaps on one animation (plan rule 6): heads, headgear, torsos, the palette.
from . import looks
from . import strips
from . import props
from . import hostages


def make(s, look, kind):
    looks.install(look)
    strips.build(s, kind)
