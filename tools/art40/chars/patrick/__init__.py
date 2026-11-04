# PATRICK at 40 px (the nerd with the keyboard; plan docs/design/ams40.md wave 2): the approved squad spike's hero
# module (tools/art40/kit/heroes/patrick*.py, the production copy of docs/design/squad40/heroes) through
# the shared hero module (tools/art40/chars/_hero). Strips and logic time:
# docs/design/ams40/contract.md "hero PATRICK"; events: THROW_RELEASE, SHOOT_WINDOW, MOUNT_HIP_DROP.
#
# Stage 2 (this folder): PATRICK's own attacks and gear motion on top of the shared builders, in
# this process only (the shared module stays as it is):
#   melee.py  the keyboard smash (knife, crouch-knife) and jab (knife-b) with anticipation, a smear,
#             the impact hold, the bounce, the flying keycaps and the settle to the guard
#   poses.py  the salute (the hand to the brow, the black sleeve kept off the face) and other
#             PATRICK pose edits
import importlib

import art40 as X

H = X.char('_hero')

SET = H.hero_set('patrick')


def build(s):
    import hero
    hero.load('patrick')
    S = importlib.import_module(H.__name__ + '.strips')
    M = importlib.import_module(H.__name__ + '.moves')
    from . import melee, poses
    melee.install(S)
    poses.install(S, M)
    H.make(s, 'patrick')
