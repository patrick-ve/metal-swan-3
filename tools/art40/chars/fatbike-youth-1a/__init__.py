# FATBIKE YOUTH, look 1 solo (mission ams, plan docs/design/ams40.md wave 4 stage 2): the stage-1
# fatbike kit (tools/art40/chars/fatbike-youth/) with the look's colours and heads
# (tools/art40/chars/fatbike-youth-pair-kit/looks.py). Set enemy/fatbike-youth-1a (skin a) with the
# palette variants enemy/fatbike-youth-1b and -1c. Strips, frame counts and logic times: the
# stage-1 set's (KICK_HIT = 2), without the cap (only enemy/fatbike-youth holds it).
import art40 as X

KIT = X.char('fatbike-youth-pair-kit')
SET = X.Set(prefix='enemy/fatbike-youth-1a', budget=28, face=1, outline='K', hl='w', fx=KIT.looks.BP.FX_LETTERS)


def build(s):
    KIT.sets.build_solo(s, 1)
