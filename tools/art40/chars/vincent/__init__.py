# VINCENT, THE CONSULTANT at 40 px (plan docs/design/ams40.md wave 2): the approved squad spike
# (docs/design/squad40: the plain build of the rig) through the shared hero module
# (tools/art40/chars/_hero), with VINCENT's own knife in this folder (attacks.py: the slash and the
# stab with anticipation, the smear, the impact, the recoil and the settle). Strips and their logic
# time: docs/design/ams40/contract.md "hero VINCENT"; events: THROW_RELEASE, SHOOT_WINDOW,
# MOUNT_HIP_DROP.
import art40 as X

H = X.char('_hero')

SET = H.hero_set('vincent')


def build(s):
    import hero
    hero.load('vincent')
    from . import attacks
    attacks.apply(H)
    H.make(s, 'vincent')
