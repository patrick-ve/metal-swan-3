# THE SEWER WORKER (mission sewers' hostage kind `sewers-worker`, c and d): orange overalls with the
# reflective bands, the yellow helmet with its dead head-lamp, a big moustache, tangled in wet wipes
# (the coils on the chair and the mast); freed, he taps his dead lamp, points, gives, bows with the
# helmet in his hand. Drawn in chars/sewers-street/hostages.py with the tied tourist's animation.
import art40 as X

base = X.char('sewers-street')

SET = X.Set(prefix='item/hostage/sewers-worker', budget=28, face=1, outline='K', hl='wi', fx='FfWy')


def build(s):
    base.hostages.build_worker(s)
