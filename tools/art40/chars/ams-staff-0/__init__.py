# FABEL FRIET crew look 0 (npc/ams/ams-staff/0): the blond ponytail, freckles, the white crew
# shirt. All the drawing is the shared crew code (chars/ams-staff/, look 0).
import art40 as X

base = X.char('ams-staff')

SET = X.Set(prefix='npc/ams/ams-staff/0', budget=28, face=1, outline='K', hl='w', fx=base.strips.FX_LETTERS)


def build(s):
    base.make(s, 0)
