# sewers-dealer-b: the dealer, look b (olive bomber jacket with the orange lining, black beanie; skin b)
# All the drawing is the shared street code (chars/sewers-street/, look 'dealer-b').
import art40 as X

base = X.char('sewers-street')

SET = X.Set(prefix='enemy/sewers-dealer-b', budget=28, face=1, outline='K', hl=base.looks.HL, fx=base.looks.FX_LETTERS)


def build(s):
    base.make(s, 'dealer-b', 'dealer')

