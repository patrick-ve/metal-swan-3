# sewers-dealer-c: the dealer, look c (long camel coat, tweed flat cap, a short beard; skin c)
# All the drawing is the shared street code (chars/sewers-street/, look 'dealer-c').
import art40 as X

base = X.char('sewers-street')

SET = X.Set(prefix='enemy/sewers-dealer-c', budget=28, face=1, outline='K', hl=base.looks.HL, fx=base.looks.FX_LETTERS)


def build(s):
    base.make(s, 'dealer-c', 'dealer')

