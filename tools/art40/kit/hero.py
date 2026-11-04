# PRODUCTION COPY of docs/design/squad40/hero.py (the frozen spike), made explicit: no environment
# variable, the hero is picked with load(name) once per process.
#
#   import hero
#   hero.load('thom')          # applies heroes/thom.py to the shared tables, then the extension sets
#
# A hero module (heroes/<name>.py) changes the shared tables in place when it is imported:
# rig.apply_hero(...) for the palette, parts.* for the drawn parts, anims.* for the poses,
# pose.HOOKS / pose.RAMP / pose.THIGH ... for the body. VINCENT is the plain build (no module).
# Because the tables are shared, one process holds one hero: bake.py runs every set in its own process.
import importlib

HEROES = ('vincent', 'thom', 'dirk', 'bob', 'patrick')
NAME = None      # the loaded hero (ext_moves reads it)
MOD = None


def load(name='vincent', only=None):
    """Apply hero `name` and the extension sets (ext.py; `only` limits the extension modules)."""
    global NAME, MOD
    name = (name or 'vincent').strip().lower()
    if NAME is not None:
        if NAME != name:
            raise RuntimeError(f'hero.load: {NAME} is already loaded in this process (one hero per process)')
        return MOD
    if name not in HEROES:
        raise ValueError(f'hero.load: unknown hero {name!r} (one of {", ".join(HEROES)})')
    NAME = name
    MOD = importlib.import_module('heroes.' + name) if name != 'vincent' else None
    import ext
    ext.load(MOD, only)
    return MOD
