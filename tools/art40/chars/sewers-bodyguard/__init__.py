# The bodyguard's shared small sprite (enemy/sewers-bodyguard/shades, both looks): the sunglasses that
# fly off in the swoon (bodyguard.ts deathEffects), tumbling. Drawn in chars/sewers-street/props.py.
import art40 as X

base = X.char('sewers-street')
props = base.props

SET = X.Set(prefix='enemy/sewers-bodyguard', budget=28, face=1, outline='K', hl='i', colours=props.COLOURS)


def build(s):
    s.strip('shades', props.shades_frames(), [4] * 4, cls='prop')
