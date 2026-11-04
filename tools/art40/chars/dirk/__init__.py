# DIRK at 40 px (the plumber with the plunger; plan docs/design/ams40.md wave 2): the approved squad
# spike's hero module (tools/art40/kit/heroes/dirk*.py, the production copy of
# docs/design/squad40/heroes) through the shared hero module (tools/art40/chars/_hero), with DIRK's
# own polish (wave 2, stage 2) in this folder:
#   parts.py   more plunger drawings (cocked, smears, stretched cup), the swing / pop effects, the
#              tool pouch that swings at the back hip
#   poses.py   the plunger melee (smack, thrust; pistol, heavy, crouched, Helium Head), the run with
#              the pouch, the salute
#   strips.py  the melee timing (8 drawings in 14 ticks, drawn smears), the seated mount
#   palette    two near-twin colours shared (below), so the plunger's dark red and the grenade's
#              olive keep their own tones inside the 28 (plan D1)
# Strips and logic time: docs/design/ams40/contract.md "hero DIRK"; events: THROW_RELEASE,
# SHOOT_WINDOW, MOUNT_HIP_DROP (the same values for every hero).
import art40 as X

H = X.char('_hero')

SET = H.hero_set('dirk')
ONLY = None             # dev runs: a list of strip name prefixes (None = every strip)

# near twins merged by hand before the automatic budget cut (palette.reduce): the gun's dark grey
# 'N' takes the trouser navy 'o' (1 RGB step apart); the grenade's olive 'M' / 'u' take the vest's
# dark olive 'q' and the polo's darkest 'U' (else the cut turned the grenade brown and the plunger's
# dark red cup 'E' into hair brown)
TWINS = {'N': 'o', 'M': 'q', 'u': 'U'}


def _reduce_with_twins(reduce):
    class _F:
        def __init__(self, rows):
            self.rows = rows

    def red(frames, budget=H.palette.BUDGET):
        pre = str.maketrans(TWINS)
        m = reduce([_F([r.translate(pre) for r in f.rows]) for f in frames], budget)
        flat = {a: b for a, b in TWINS.items()}
        for k, v in m.items():
            flat[chr(k)] = v if isinstance(v, str) else chr(v)
        for a, b in TWINS.items():
            flat[a] = flat.get(b, b)
        H.palette.LAST['merges'] = dict(sorted(flat.items()))
        return str.maketrans(flat)
    return red


def build(s):
    import hero
    hero.load('dirk')
    from . import poses, strips
    poses.install()
    strips.install(H)
    H.palette.reduce = _reduce_with_twins(H.palette.reduce)
    H.make(s, 'dirk', only=ONLY)
