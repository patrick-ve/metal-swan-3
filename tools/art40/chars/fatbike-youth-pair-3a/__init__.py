# FATBIKE YOUTH PAIR, rider look 3 with a passenger of look 1 (mission ams, plan
# docs/design/ams40.md wave 4 stage 2): the stage-1 fatbike kit with the rider's look and the
# passenger on the speaker box (tools/art40/chars/fatbike-youth-pair-kit/). Set
# enemy/fatbike-youth-pair-3a (rider skin a, passenger skin c) with the palette variants -pair-3b
# (b with a) and -pair-3c (c with b). A multi-part sprite (two youths and the bike): budget 40
# (plan D1). Strips: the solo strips (no cap) + passenger-flee (his run at 2.2 px/tick).
import art40 as X

KIT = X.char('fatbike-youth-pair-kit')
SET = X.Set(prefix='enemy/fatbike-youth-pair-3a', budget=40, face=1, outline='K', hl='w', fx=KIT.looks.BP.FX_LETTERS)


def build(s):
    KIT.sets.build_pair(s, 3)
