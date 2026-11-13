# The dealer's drop, the gag pickup NEP! (mints.ts): a small tin of mints, the silver rim, the
# mint-green lid with its white label (no drug, no brand). Drawn in chars/sewers-street/props.py.
# Baked as item/sewers-mints/tin; the game's pickup id item/sewers-mints (no strip segment of its
# own) draws these frames (content/sewers/street/art.ts).
import art40 as X

base = X.char('sewers-street')
props = base.props

SET = X.Set(prefix='item/sewers-mints', budget=28, face=1, outline='K', hl='w', colours=props.COLOURS)


def build(s):
    s.strip('tin', props.tin_frames(), [6], cls='prop')
