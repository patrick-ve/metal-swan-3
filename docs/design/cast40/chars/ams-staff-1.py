# FABEL FRIET crew member 1 (ams): curly black hair under the shop cap, clapping. The body, the
# uniform and the heads live in chars/ams-staff-0.py (build(look)).
import importlib

INFO = dict(
    name='FABEL FRIET CREW 1', mission=['ams'], role='npc', kind='HUMANOID', face=-1,
    pose='clapping, the hands meet in front of the chest, eyes shut with joy',
    note='Black curls spill out under the black shop cap (gold badge, piped peak like the owner), '
         'dark skin, a closed-eye grin, the teal crew shirt; shared crew body, apron and trousers.',
    old='npc/ams/ams-staff/1/clap#0', air=0,
)


def frame():
    return importlib.import_module('chars.ams-staff-0').build(1)
