# THOM ("Little Napoleon"): a cocky akimbo gunslinger in Dutch camouflage with a backwards navy cap.
# Imported by hero.py when HERO=thom; changes the shared tables in place for this process only.
import math
import parts as P
import pose
import anims as A
from heroes import thom_parts as TP

# ---------------------------------------------------------------- parts
for lib in ('HEADS', 'TORSOS', 'GUNS', 'FISTS', 'HANDS', 'ITEMS'):
    tab = getattr(P, lib)
    tab.clear()
    tab.update(getattr(TP, lib))

# ---------------------------------------------------------------- body: 1 px shorter legs
pose.THIGH, pose.SHIN = 6.5, 6.0
pose.PEL_DY = 1
pose.RAMP['arm'] = ['J', 'j', 'q', 'Q']
pose.RAMP['armF'] = ['j', 'q', 'Q', 'Q']
pose.RAMP['leg'] = ['J', 'j', 'q', 'Q']
pose.RAMP['legF'] = ['j', 'q', 'Q', 'Q']


# ---------------------------------------------------------------- camouflage on the limb tubes
def _h(i, j, s):
    v = math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453
    return v - math.floor(v)


def _noise(x, y, s):
    i, j = math.floor(x), math.floor(y)
    fx, fy = x - i, y - j
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = _h(i, j, s), _h(i + 1, j, s)
    c, d = _h(i, j + 1, s), _h(i + 1, j + 1, s)
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy


SEED = {'armN': 1, 'armF': 2, 'legN': 3, 'legF': 4}
OLIVE = ['V', 'V', 'Y', 'Y']
BROWN = ['x', 'x', 'v', 'v']
BOOT = ['X', 'x', 'x', 'v']


def camo(part, u, v, k, ch):
    far = part.endswith('F')
    kk = min(3, k + (1 if far else 0))
    if part.startswith('leg') and u > pose.THIGH + pose.SHIN - 1.9:      # boot shaft over the shin end
        return BOOT[kk]
    s = SEED.get(part, 5)
    if _noise(u * 0.5, v * 0.62 + 3.3, s) > 0.64:
        return OLIVE[kk]
    if _noise(u * 0.5 + 9.1, v * 0.62, s + 7) > 0.66:
        return BROWN[kk]
    if _noise(u * 0.9 + 4.2, v * 0.9 + 1.7, s + 13) > 0.86:
        return 'Q'
    return ch


pose.HOOKS['pat'] = camo

from heroes import thom_anims  # noqa: E402,F401  (the poses)

from heroes import thom_ext  # noqa: E402  (new heads, the extension poses: after_ext / after_derive)


def after_ext():
    thom_ext.after_ext()


def after_derive():
    thom_ext.after_derive()
