# THE BANANA TOURIST (mission sewers' hostage in a, `{ kind: 'tourist', look: 'banana' }`): the
# stag-party guy in a banana costume, his phone instead of the flash camera; a look of the tied
# tourist (the same frame roles: the chair, the mast, the sack, freed and waving, walk, run, the
# SAY CHEESE gag with the flash on tick 24, give, bow). Drawn in chars/sewers-street/hostages.py.
import art40 as X

base = X.char('sewers-street')

SET = X.Set(prefix='item/hostage/sewers-banana', budget=28, face=1, outline='K', hl='wi', fx='FfWy')


def build(s):
    base.hostages.build_banana(s)
