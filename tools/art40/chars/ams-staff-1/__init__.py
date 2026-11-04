# FABEL FRIET crew look 1 (npc/ams/ams-staff/1): black curls under the black shop cap, dark skin,
# the teal crew shirt. All the drawing is the shared crew code (chars/ams-staff/, look 1).
import art40 as X

base = X.char('ams-staff')

SET = X.Set(prefix='npc/ams/ams-staff/1', budget=28, face=1, outline='K', hl='w', fx=base.strips.FX_LETTERS)


def build(s):
    base.make(s, 1)
