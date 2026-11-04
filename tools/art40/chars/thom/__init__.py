# THOM at 40 px (two pistols, the backwards cap, Dutch camo; plan docs/design/ams40.md wave 2): the
# approved squad spike's hero module (tools/art40/kit/heroes/thom*.py, the production copy of
# docs/design/squad40/heroes) through the shared hero module (tools/art40/chars/_hero), with THOM's
# own polish in this folder (attacks.py: the shots, the pistol whip, the butt jab, the grenade;
# moves.py: the gear's secondary motion and the salute). Strips and logic time:
# docs/design/ams40/contract.md "hero THOM"; events: THROW_RELEASE, SHOOT_WINDOW, MOUNT_HIP_DROP.
import art40 as X

H = X.char('_hero')

SET = H.hero_set('thom')


def build(s):
    import hero
    hero.load('thom')
    from . import attacks, moves
    attacks.apply(H)
    moves.apply(H)
    H.make(s, 'thom')
