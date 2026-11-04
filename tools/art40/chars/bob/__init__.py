# BOB at 40 px (Captain Climate with the flag cape; plan docs/design/ams40.md wave 2): the approved squad spike's hero
# module (tools/art40/kit/heroes/bob*.py, the production copy of docs/design/squad40/heroes) through
# the shared hero module (tools/art40/chars/_hero). Strips and logic time:
# docs/design/ams40/contract.md "hero BOB"; events: THROW_RELEASE, SHOOT_WINDOW, MOUNT_HIP_DROP.
# Stage 2 (this folder): make.py (the shared make with BOB's steps), attacks.py (the haymaker and
# the jab redrawn), cape.py (the cape's follow-through over every strip).
import art40 as X

H = X.char('_hero')

SET = H.hero_set('bob')


def build(s):
    from . import make
    make.make(s, 'bob')
