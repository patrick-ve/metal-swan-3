# SPITTER RAT: the fat slime-spitting rat of mission sewers at 40 px (wave P5 RATS;
# docs/design/sewers.md §3; the game's ids enemy/sewers-rat-spitter/*, src/game/content/sewers/rats/
# spitter.ts). Fat, sickly olive, with cheek pouches that puff up before it spits. Drawn by the
# runner set's rat rig.
#
# Its own strips: idle 4 (sitting up on the plinth, a drip of slime), tell 3 (spitter.ts plays it
# once at tele/3 ticks a frame: 3 frames fill the tell), spit 2 (once(0, 7) over the 14-tick spit),
# hop 6 (36 ticks = SPITTER.hopTicks). The rest: the shared rat strips.
import art40 as X

RUN = X.char('sewers-rat-runner')
looks, strips = RUN.looks, RUN.strips

SET = X.Set(prefix='enemy/sewers-rat-spitter', budget=28, face=1, outline='K', hl=looks.HL, fx=looks.FX,
            colours=looks.colours('spitter'))


def build(s):
    looks.install('spitter')
    L = looks.spitter()
    s.strip('idle', strips.spit_idle(L), [12, 10, 12, 10], cls='idle')
    strips.build_rat(s, L, 'spitter', skip=('idle', 'tell'))
    s.strip('tell', strips.spit_tell(L), 8, loop=False, cls='telegraph')
    s.strip('spit', strips.spit_spit(L), 7, loop=False, cls='throw',
            why='spitter.ts plays it once(0, 7) over the 14-tick spit mode: 2 frames show')
    s.strip('hop', strips.spit_hop(L), [5, 5, 7, 7, 6, 6], loop=False, cls='jump',
            why='the hop is one 36-tick arc (SPITTER.hopTicks): crouch, launch, tuck, reach, land')
