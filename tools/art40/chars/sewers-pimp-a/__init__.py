# sewers-pimp-a: the pimp, look a (purple suit and wide hat, gold band, pink shirt; skin a) and the palette variant look b (white suit and hat, red band, black shirt; skin b)
# All the drawing is the shared street code (chars/sewers-street/, look 'pimp-a').
import art40 as X

base = X.char('sewers-street')

SET = X.Set(prefix='enemy/sewers-pimp-a', budget=28, face=1, outline='K', hl=base.looks.HL, fx=base.looks.FX_LETTERS)


def build(s):
    base.make(s, 'pimp-a', 'pimp')
    s.variant('enemy/sewers-pimp-b', base.looks.PIMP_B)
