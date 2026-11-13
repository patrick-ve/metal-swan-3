# sewers-bodyguard-a: the bodyguard, look a (black suit, white shirt, sunglasses, earpiece; bald; skin b) and the palette variant look b (a black buzz cut; skin c)
# All the drawing is the shared street code (chars/sewers-street/, look 'bodyguard-a').
import art40 as X

base = X.char('sewers-street')

SET = X.Set(prefix='enemy/sewers-bodyguard-a', budget=28, face=1, outline='K', hl=base.looks.HL, fx=base.looks.FX_LETTERS)


def build(s):
    base.make(s, 'bodyguard-a', 'bodyguard')
    s.variant('enemy/sewers-bodyguard-b', base.looks.BODYGUARD_B)
