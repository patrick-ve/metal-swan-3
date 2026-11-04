# FABEL FRIET crew look 2 (npc/ams/ams-staff/2): a dark bob, round tortoiseshell glasses, the red
# crew shirt. All the drawing is the shared crew code (chars/ams-staff/, look 2).
import art40 as X

base = X.char('ams-staff')

SET = X.Set(prefix='npc/ams/ams-staff/2', budget=28, face=1, outline='K', hl='w', fx=base.strips.FX_LETTERS)


def build(s):
    base.make(s, 2)
