# HANDHAVER, skin c: the same animation as chars/handhaver/ with curly hair (a part change, the
# contract: skinC + curly hair, so not a palette variant) in the skin c palette. All the drawing is
# the handhaver set's code (look 'c').
import art40 as X

base = X.char('handhaver')

SET = X.Set(prefix='enemy/handhaver-c', budget=28, face=1, outline='K', hl='w', fx=base.parts.FX_LETTERS)


def build(s):
    base.parts.install('c')
    base.parts.K.palette(base.parts.SKIN_C)
    base.strips.build(s)
