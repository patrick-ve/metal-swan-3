# The FABEL FRIET crew: shared code of the three looks (no build here: a helper package). The sets
# are chars/ams-staff-0/, -1, -2 (slugs of npc/ams/ams-staff/0, /1, /2); each one calls
# make(s, look). Looks are part swaps on one animation (plan rule 6): heads, hair, skin and shirt.
from . import parts
from . import strips


def make(s, look):
    strips.build(s, look)
