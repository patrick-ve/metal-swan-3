# BRUTE RAT: the horse-sized, scarred rat of mission sewers at 40 px (wave P5 RATS;
# docs/design/sewers.md §3; the game's ids enemy/sewers-rat-brute/*, src/game/content/sewers/rats/
# brute.ts). Dark brown-black, pink scars with stitch marks, bristles along the back, yellow teeth.
# Drawn by the runner set's rat rig at 2.3x.
#
# Its own strips: walk 12 (sprite timing, 36 ticks at 0.8 px/tick), tell 4 (looping(7): pawing the
# floor), charge 12 (looping(3): the gallop with the jaws open; run and recover reuse it), rear 4
# (looping(8): the stomp tell), stomp 2 (once(0, 8) over the 16-tick stomp). The rest: the shared
# rat strips.
import art40 as X

RUN = X.char('sewers-rat-runner')
looks, strips = RUN.looks, RUN.strips

SET = X.Set(prefix='enemy/sewers-rat-brute', budget=28, face=1, outline='K', hl=looks.HL, fx=looks.FX,
            colours=looks.colours('brute'))


def build(s):
    looks.install('brute')
    L = looks.brute()
    sc = L.sc
    charge = strips.run_frames(L, sc=sc * 0.74, mouth=2, eye='squint', head0=-8, ear0=-20)
    strips.build_rat(s, L, 'brute', skip=('tell',), runs=charge)
    s.strip('walk', strips.walk_frames(L, sc), 3, cls='locomotion')
    s.strip('tell', strips.brute_tell(L, sc), 7, cls='telegraph')
    s.strip('charge', charge, 3, cls='locomotion')
    s.strip('rear', strips.brute_rear(L, sc), 8, cls='telegraph')
    s.strip('stomp', strips.brute_stomp(L, sc), 8, loop=False, cls='melee',
            why='brute.ts plays it once(0, 8) over the 16-tick stomp: 2 frames show')
