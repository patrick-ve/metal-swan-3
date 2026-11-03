# Picks the hero for this process from the HERO environment variable (default: vincent).
#   HERO=thom python3 build.py      HERO=thom python3 sheet.py run
# A hero module (heroes/<name>.py) changes the shared tables in place when it is imported:
# rig.apply_hero(...) for the palette, parts.* for the drawn parts, anims.* for the poses,
# pose.HOOKS / pose.RAMP / pose.THIGH ... for the body. VINCENT is the plain build (no module).
import importlib, os

NAME = os.environ.get('HERO', 'vincent').strip().lower() or 'vincent'
MOD = None
if NAME != 'vincent':
    MOD = importlib.import_module('heroes.' + NAME)

import ext  # noqa: E402  (the extension sets: heavy weapon, moves, ride ...; see ext.py)
ext.load(MOD)


def outdir():
    d = 'out' if NAME == 'vincent' else os.path.join('out', NAME)
    os.makedirs(d, exist_ok=True)
    return d


def scales():
    return getattr(MOD, 'SCALES', [1]) if MOD else [1, 2]
