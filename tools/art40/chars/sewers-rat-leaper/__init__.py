# LEAPER RAT: the pouncing rat of mission sewers at 40 px (wave P5 RATS; docs/design/sewers.md §3;
# the game's ids enemy/sewers-rat-leaper/*, src/game/content/sewers/rats/leaper.ts). Lean and leggy,
# blue-grey with a dark back stripe and big pink ears. Drawn by the runner set's rat rig.
#
# Its own strips: lurk 4 (the head in a pipe mouth or a grate, anchor = the mouth centre), lurk-tell
# 4 (the hiss), jump 6 (the arc, held on the last frame). The rest: the shared rat strips.
import art40 as X

RUN = X.char('sewers-rat-runner')
looks, strips = RUN.looks, RUN.strips

SET = X.Set(prefix='enemy/sewers-rat-leaper', budget=28, face=1, outline='K', hl=looks.HL, fx=looks.FX,
            colours=looks.colours('leaper'))


def build(s):
    looks.install('leaper')
    L = looks.leaper()
    strips.build_rat(s, L, 'leaper')
    s.strip('lurk', strips.lurk(L), [16, 12, 16, 12], cls='idle')
    s.strip('lurk-tell', strips.lurk_tell(L), [5, 4, 5, 4], cls='telegraph')
    s.strip('jump', strips.jump(L), [4, 6, 10, 12, 10, 12], loop=False, cls='jump')
