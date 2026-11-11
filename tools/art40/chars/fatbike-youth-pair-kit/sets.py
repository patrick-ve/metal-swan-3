# The set builders of the fatbike looks 1-3 (solo) and the pairs 0-3 (wave 4 stage 2): every strip
# is the stage-1 kit's (base.strips.build, with_cap=False: only enemy/fatbike-youth holds the cap);
# a solo look swaps its colours and heads (looks.install_look); a pair also seats the passenger
# (passenger.py) on every bike strip and adds his flee ('passenger-flee'). The rider-only strips of
# a pair (the deaths, the fall off the seat, the get-up, the flee, the wreck) are the solo twin's
# pictures: the same kit calls with the same parts.
import castkit as K

from . import looks
from . import passenger as PS

base = looks.base


def solo_prefix(look, skin):
    return 'enemy/fatbike-youth' if look == 0 and skin == 'a' else f'enemy/fatbike-youth-{look}{skin}'


def pair_prefix(look, skin):
    return f'enemy/fatbike-youth-pair-{look}{skin}'


# the passenger's look and skin (the game's youthSet rule, rider.art.ts before ams40)
def pass_look(look):
    return (look + 2) % 4


PASS_SKIN = {'a': 'c', 'b': 'a', 'c': 'b'}


# 'die' and 'die-knife' never play for a fatbike youth: Enemy.onDeath starts them, and in the same
# tick FatbikeYouth.deathEffects replaces them with 'die-seat' (every shot and knife death can
# flee). The ids stay (contract rule 1) with their total ticks, as ONE frame (the strip's last pose):
# 21 sets of dead frames would cost about 35 KB gzip of the 1200 KB budget.
NEVER_PLAYED = ('die', 'die-knife')
WHY_NEVER = ('never played: FatbikeYouth.deathEffects replaces it with die-seat in the same tick '
             '(shot and knife deaths flee); the id keeps its total ticks as one frame, the last pose')


class Trim:
    """A Set proxy for base.strips.build: the never-played strips become one frame."""

    def __init__(self, s):
        self._s = s

    def strip(self, name, frames, durations, *a, **kw):
        if name in NEVER_PLAYED:
            total = sum(durations) if isinstance(durations, (list, tuple)) else durations * len(frames)
            kw['why'] = WHY_NEVER
            return self._s.strip(name, [frames[-1]], [total], *a, **kw)
        return self._s.strip(name, frames, durations, *a, **kw)

    def __getattr__(self, k):
        return getattr(self._s, k)


def build_solo(s, look):
    looks.install_look(look)
    base.ride.PASSENGER['draw'] = None
    base.strips.build(Trim(s), with_cap=False)
    for sk in 'bc':
        s.variant(solo_prefix(look, sk), looks.skin_pal(look, sk))


def pair_pal(look, skin):
    """The pair palette patch for a skin: the rider's skin and the passenger's (his own skin)."""
    p = dict(looks.skin_pal(look, skin))
    pk, ps = pass_look(look), PASS_SKIN[skin]
    pp = PS.pass_pal(pk, ps)
    p.update({PS.PMAP[k]: pp[PS.PMAP[k]] for k in ('L', 'S', 's', 'z', 'H')})
    return p


def build_pair(s, look):
    pk = pass_look(look)
    looks.install_look(look)
    final = PS.pass_pal(pk, PASS_SKIN['a'])
    K.palette(final, dark=PS.DARK_P, letters=PS.LETTERS_P)
    PS.install_parts(look)                                   # the rider (the standard names)
    PS.install_parts(pk, PS.PT, 'p:', 'p')                   # the passenger (his letters)
    PS.install_hook()
    base.strips.build(Trim(s), with_cap=False)
    base.ride.PASSENGER['draw'] = None
    # his flee: his parts under the standard names, in his letters
    PS.MODE['all'] = True
    PS.install_parts(pk, PS.PT)
    s.strip('passenger-flee', PS.flee(), 2, cls='locomotion')
    PS.MODE['all'] = False
    for sk in 'bc':
        s.variant(pair_prefix(look, sk), pair_pal(look, sk))
