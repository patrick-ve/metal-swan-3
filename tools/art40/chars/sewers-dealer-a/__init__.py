# sewers-dealer-a: the dealer, look a (grey zip hoodie, the hood up; jeans; skin a)
# All the drawing is the shared street code (chars/sewers-street/, look 'dealer-a').
import art40 as X

base = X.char('sewers-street')

SET = X.Set(prefix='enemy/sewers-dealer-a', budget=28, face=1, outline='K', hl=base.looks.HL, fx=base.looks.FX_LETTERS)


def build(s):
    base.make(s, 'dealer-a', 'dealer')

