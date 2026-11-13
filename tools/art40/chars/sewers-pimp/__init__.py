# The pimp's shared small sprites (enemy/sewers-pimp/*, both looks): the gold pistol's bullet, the wide
# hats that fly off in the swoon (pimp.ts deathEffects: `hat` purple for look a, `hat-b` white for
# look b), tumbling. Drawn in chars/sewers-street/props.py.
import art40 as X

base = X.char('sewers-street')
props = base.props

SET = X.Set(prefix='enemy/sewers-pimp', budget=28, face=1, outline='K', colours=props.COLOURS)


def build(s):
    s.strip('bullet', props.bullet_frames(), [6], cls='prop')
    s.strip('hat', props.hat_frames(), [4] * 5, cls='prop')
    s.strip('hat-b', props.hat_frames(white=True), [4] * 5, cls='prop')
