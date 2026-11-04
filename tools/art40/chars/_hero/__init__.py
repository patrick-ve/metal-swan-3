# The shared hero module of the 40 px heroes (plan docs/design/ams40.md wave 2): one set per hero,
# char/<hero>/, 118 strips (the 121 contract ids without the UI portrait / select / select-grey),
# made from the approved squad spike through the production kit (tools/art40/kit: hero.load).
#
#   import art40 as X
#   H = X.char('_hero')
#   SET = H.hero_set('vincent')
#   def build(s): H.make(s, 'vincent')
#
# Files: frames.py (legs / torso / full frame makers with the game's points), strips.py (the map of
# the spike's 47 groups to the game's strips, the shoot tails, knife, throw, helium twins), moves.py
# (the restrided run and crouch walk, the jump split, the seated mount, the salute), palette.py (the
# 28-colour palette of each hero: FX letters, merges).
#
# The events the game reads are exported by every hero set with the same values (player.ts reads
# them from src/game/player/hero-art.ts): THROW_RELEASE, SHOOT_WINDOW, MOUNT_HIP_DROP.
import art40 as X

from . import frames as F
from . import palette as PA

FX = PA.FX_LETTERS


def hero_set(name):
    return X.Set(prefix=f'char/{name}', budget=28, face=1, outline='K', hl=PA.HL, fx=FX)


def make(s, name, only=None):
    import hero
    hero.load(name)
    from . import strips as S
    T = S.table()
    built = {}
    for strip_name, (kind, steps, opts) in T.items():
        if only and not any(strip_name.startswith(o) for o in only):
            continue
        if kind == 'wob':
            continue
        frames, durs = S.make_frames(kind, steps, dict(opts, name=strip_name))
        built[strip_name] = (frames, durs, opts)
    for strip_name, (kind, src, _) in T.items():
        if kind == 'wob' and src in built:
            frames, durs, opts = built[src]
            built[strip_name] = ([wob(f) for f in frames], list(durs), opts)
    merge = PA.reduce([f for fr, _, _ in built.values() for f in fr])
    for strip_name, (frames, durs, opts) in built.items():
        for f in frames:
            f.rows = F.clean([r.translate(merge) for r in f.rows], FX + PA.HL)
        s.strip(strip_name, frames, durs, loop=opts.get('loop', True), cls=opts['cls'], why=opts.get('why'),
                defer=opts.get('defer', False))
    s.colours = PA.colours()
    if 'torso-pistol-throw' in built:
        fr = built['torso-pistol-throw'][0]
        rel = max(range(len(fr)), key=lambda i: (fr[i].pts['hand'][0] - fr[i].root[0]) - (fr[i].pts['hand'][1] - fr[i].root[1]))
        s.event('THROW_RELEASE', rel)
    s.event('SHOOT_WINDOW', 3)
    s.event('MOUNT_HIP_DROP', 17)
    return s


GAME_PTS = ('muzzle', 'hand')      # the bullet and bomb origins (player.ts muzzleWorld / handWorld)


def wob(f):
    """A Helium Head wobble frame: the same pixels drawn 1 px forward and 1 px down (the anchor
    moves the other way). The head point moves with the pixels; the muzzle and the throwing hand
    stay where the helium frame has them (the wobble is cosmetic, helium.ts: the bullet and bomb
    origins must not bob with it)."""
    pts = {k: ((v[0] - 1, v[1] - 1) if k in GAME_PTS else v) for k, v in f.pts.items()}
    return X.Frame(list(f.rows), (f.root[0] - 1, f.root[1] - 1), pts=pts, smear=f.smear, joints=dict(f.joints))
