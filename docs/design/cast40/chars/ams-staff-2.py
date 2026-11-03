# FABEL FRIET crew member 2 (ams): a dark bob and round glasses, waving. The body, the uniform and
# the heads live in chars/ams-staff-0.py (build(look)).
import importlib

INFO = dict(
    name='FABEL FRIET CREW 2', mission=['ams'], role='npc', kind='HUMANOID', face=-1,
    pose='waving, the near hand up beside the head',
    note='A dark bob cut at the jaw with a fringe, round dark glasses, a wide smile; same shared crew '
         'body, apron and trousers, the red crew shirt.',
    old='npc/ams/ams-staff/2/wave#1', air=0,
)


def frame():
    return importlib.import_module('chars.ams-staff-0').build(2)
