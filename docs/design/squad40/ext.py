# Extension sets: the animation families on top of the 12 core groups (heavy weapon, the moves and
# the extra deaths, the Swan ride, Helium Head, the parachute ...). One module per family:
# ext_<name>.py in this folder. Each module may define these functions (all optional):
#
#   PARTS()   adds parts to parts.* (HEADS, GUNS, HANDS, ITEMS, FX, STAGE). Use setdefault-style
#             adds (ext.add) so a hero's own part with the same name always wins.
#   BUILD()   adds poses to anims.UPPER / LOWER / FULL (ext.add: a hero may have its own already).
#   DERIVE()  runs after the hero's after_ext(): builds sets made from other sets (Helium Head
#             copies the finished upper sets with the balloon heads).
#   GROUPS()  returns the page groups of this family (list of dicts, see below).
#
# Order per process (hero.py): hero module import -> PARTS() of every module -> BUILD() ->
# hero.after_ext() -> DERIVE() -> hero.after_derive().
#
# A page group: {'cat': 'Heavy weapon', 'title': 'Heavy run', 'ref': '12', 'steps': [step, ...]}
# A step (all coordinates in 1x px, y down, relative to the ground point under the hero):
#   'u': [upper_key, i]  'l': [lower_key, i]  'f': [full_key, i]     (as in the core groups; an
#        upper with no lower is drawn with its pelvis at (0, -17), e.g. the Swan rider)
#   't': hold time in 60 Hz ticks
#   'oy': whole-hero offset in y (negative = up), e.g. hanging under the parachute
#   'ox': whole-hero offset in x
#   'st': [[stage_key, frame, dx, dy, z], ...] shared stage sprites (parts.STAGE) placed with
#        their anchor 'c' at ground point + (dx, dy) (+ the hero offset when the step has one);
#        z < 0 = behind the hero, z > 0 = in front
#   'pal': palette variant for this step ('flash', 'tint' ...; the page makes them)
#   'hide': 1 = the hero is not drawn this step (the invulnerable blink)
#
# Env: EXT_ONLY=heavy,ride loads only those modules (fast, and a broken module of another agent
# cannot stop your run). A module that raises is skipped with a warning on stderr.
import importlib, os, sys, traceback
import anims as A
import parts as P

MODULES = ['heavy', 'moves', 'ride', 'status']
LOADED = []
GROUPS = []

# Head expressions the extension sets may use. Every hero draws his own in the hero wave; until
# then pose.py falls back to the mapped core head, so a hero never crashes on a missing face.
HEAD_FALLBACK = {
  'happy': 'shout',    # victory, ride cheer: a big open grin, eyes squeezed
  'panic': 'hurt',     # blast, drown, ride hold / hunch: wide eyes, open mouth
  'yawn': 'shout',     # time-out yawn: eyes shut, mouth wide
  'sleep': 'blink',    # time-out sleep: eyes shut, mouth slack
  'soot': 'hurt',      # burn death: blackened face, white eyes
  'bored': 'blink',    # bored: half-shut eyes, flat mouth
}
if not hasattr(P, 'STAGE'):
    P.STAGE = {}       # shared stage sprites: name -> [(rows, {'c': (x, y), ...}), ...] (frames)


def add(table, key, value):
    """Add only when the hero (or another module) has not defined this key yet."""
    if key not in table:
        table[key] = value
    return table[key]


def _mods():
    only = [m.strip() for m in os.environ.get('EXT_ONLY', '').split(',') if m.strip()]
    for name in MODULES:
        if only and name not in only:
            continue
        try:
            yield name, importlib.import_module('ext_' + name)
        except ModuleNotFoundError as e:
            if e.name != 'ext_' + name:
                print(f'[ext] {name}: import failed: {e}', file=sys.stderr)
        except Exception:
            print(f'[ext] {name}: import failed, skipped\n' + traceback.format_exc(limit=3), file=sys.stderr)


def _run(stage):
    for name, mod in LOADED:
        fn = getattr(mod, stage, None)
        if not fn:
            continue
        try:
            out = fn()
            if stage == 'GROUPS' and out:
                GROUPS.extend(out)
        except Exception:
            print(f'[ext] {name}.{stage}() failed, skipped\n' + traceback.format_exc(limit=4), file=sys.stderr)


def load(hero_mod=None):
    LOADED[:] = list(_mods())
    _run('PARTS')
    _run('BUILD')
    if hero_mod is not None and hasattr(hero_mod, 'after_ext'):
        hero_mod.after_ext()
    _run('DERIVE')
    if hero_mod is not None and hasattr(hero_mod, 'after_derive'):
        hero_mod.after_derive()
    GROUPS[:] = []
    _run('GROUPS')
