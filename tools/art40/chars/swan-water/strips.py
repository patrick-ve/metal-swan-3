# The water and air strips of the Swan (slug 'swan-water', prefix vehicle/swan, P2 the black swan
# vehicle/swan-mute): swim, water-duck, paddle-up, settle, honk-swim (the water), flap, glide,
# glide-tired, fold, honk-air (the air), with their -front overlays; rise, sit-down (on the land,
# the neck and the gun in the picture); dive, migrate, migrate-soot (riderless).
#
# EVERY body frame is chosen by the game (swan.ts show(name, frame) with a held Animator): the
# strip's own durations for the timed strips (frameAt / loopAt over the baked durations), the
# odometer for the dive (DIVE_PX a frame), the swim clock (one cycle per SWIM_CYCLE ticks moving,
# SWIM_CYCLE_STILL still), named frames for the roles (settle 0 / 1, paddle-up). The logic times
# stay (plan rule 4): paddle-up 8 ticks (waterSquatTicks), settle 4, flap 6 (glideT < 6), fold 2,
# honk-swim / honk-air 20 (the ring at tick 10 = frame HONK_BLAST of the core), rise 12
# (riseTicks), sit-down 20 (sitTicks).
import math

import art40 as X

from . import palette as WP
from . import poses as P
from . import render as R

S = X.char('swan')
F = S.F
B = S.B

SWIM_CYCLE = 24                     # ticks of a swim cycle while she moves (old: 4 frames x 6)
SWIM_CYCLE_STILL = 64               # ... while she floats still (old: 4 frames x 16)

# the joints of the smoothness gate: the rig's points, the WRISTS of spread wings (the tip of a
# primary is a feather, not a joint: it sweeps 37 px round the shoulder in a beat)
WING_TIPS = ('wingN', 'wingF')


def _joints(r):
    j = dict(r['joints'])
    if r['P'].get('wings'):
        for k in WING_TIPS:
            j.pop(k, None)
    return j


def _frame(rows, r, pts, drop=False):
    r = dict(r, joints=_joints(r))
    return R.frame_of(rows, r, pts, drop=drop)


def body(r, k, contained=False, bubble=False, post=None):
    L = r['rows']
    layers = [L['b'], L['f'], L['w']] + ([L['n']] if contained else [])
    rows = R._surface_fx(F.overlay(*layers), r, k)
    if post:
        rows = post(rows, r, k)
    return _frame(rows, r, F.game_points(r, bubble=bubble))


def front(r, k, contained=False):
    fr = R.front_frame(r, k, contained=contained)
    return _frame(fr.rows, r, F.game_points(r), drop=True)


def _strip(s, name, poses, durations, cls, why=None, loop=True, front_strip=False, contained=False, bubble_from=None,
           post=None):
    rs = [R.render(p) for p in poses]
    bub = lambda i: bubble_from is not None and i >= bubble_from
    s.strip(name, [body(r, i, contained, bub(i), post) for i, r in enumerate(rs)], durations, loop=loop, cls=cls, why=why)
    if front_strip:
        s.strip(name + '-front', [front(r, i, contained) for i, r in enumerate(rs)], durations, loop=loop, cls='overlay')
    return rs


# ------------------------------------------------------------------ migrate-soot
def soot(rows, r, k):
    """The 0-cell exit: every tone two steps darker on its own ramp (old: scorch(f, 2), no new
    colour), a few scorched feather tips and two soot puffs trailing from her back (FX a / b)."""
    out = [''.join(WP.SOOT.get(ch, ch) for ch in row) for row in rows]
    g = [list(row) for row in out]
    tail = r['joints'].get('tail')
    if tail:
        tx, ty = B.OX + tail[0], B.OY + tail[1]
        for j, (ox, oy, rad) in enumerate(((-4, -2, 2.2), (-10, -5, 1.6), (-15, -7, 1.1))):
            cx = tx + ox - (k % 4) * 1.5
            cy = ty + oy + ((k + j) % 3) - 1
            for y in range(int(cy - rad - 1), int(cy + rad + 2)):
                for x in range(int(cx - rad - 1), int(cx + rad + 2)):
                    d = math.hypot(x - cx, y - cy)
                    if d <= rad and 0 <= y < len(g) and 0 <= x < len(g[y]) and g[y][x] == '.':
                        g[y][x] = 'b' if d < rad * 0.55 else 'a'
    return [''.join(row) for row in g]


# ------------------------------------------------------------------ build
def build(s):
    # the water (ridden: rider + -front overlay; the neck strip on the socket)
    _strip(s, 'swim', P.SWIM, SWIM_CYCLE // P.SWIM_N, 'locomotion', front_strip=True,
           why=None)
    _strip(s, 'water-duck', P.WATER_DUCK, 12, 'idle-breathing', front_strip=True)
    _strip(s, 'paddle-up', P.PADDLE_UP, [2, 2, 2, 2], 'jump', loop=False, front_strip=True,
           why='the 8-tick water take-off (SWAN.waterSquatTicks; the code picks frame (8 - paddleT) >> 1); the jump strip follows: paddle-up 4 + jump 3 = the class count')
    _strip(s, 'settle', P.SETTLE, [2, 2], 'respawn', loop=False, front_strip=True,
           why='two frame roles the code picks over the 4-tick splash-down (settleIn: 0 then 1; out of the water: 1)')
    _strip(s, 'honk-swim', P.HONK_SWIM, 2, 'shoot', loop=False, front_strip=True)
    # the air
    _strip(s, 'flap', P.FLAP, P.FLAP_D, 'jump', loop=False, front_strip=True,
           why='the glide opens with one 6-tick beat (glideT < 6, the logic time): snap up, the downstroke (smear), the bottom, up into the glide')
    _strip(s, 'glide', P.GLIDE, 4, 'locomotion', front_strip=True,
           why='a held soaring V, not a wing beat: 4 frames of the hands flexing on the air and a 1 px dip (16 ticks, the old loop)')
    _strip(s, 'glide-tired', P.GLIDE_TIRED, 2, 'locomotion', front_strip=True,
           why='the spent wings trembling for the last 12 ticks of the glide: a 4-frame shiver, no beat')
    _strip(s, 'fold', P.FOLD, [2], 'fall', loop=False, front_strip=True,
           why='a 1-frame held pose: the code shows frame 0 for the 2 ticks of foldT, then the fall strip')
    _strip(s, 'honk-air', P.HONK_AIR, 2, 'shoot', loop=False, front_strip=True)
    # on land: the neck and the gun in the picture
    _strip(s, 'rise', P.RISE, P.RISE_D, 'respawn', loop=False, front_strip=True, contained=True)
    _strip(s, 'sit-down', P.SIT_DOWN, P.SIT_D, 'respawn', loop=False, contained=True, bubble_from=P.SIT_BUBBLE_FROM)
    # riderless
    _strip(s, 'dive', P.DIVE, P.DIVE_TPF, 'locomotion', contained=True)
    _strip(s, 'migrate', P.MIGRATE, P.MIGRATE_TPF, 'locomotion', contained=True)
    _strip(s, 'migrate-soot', P.MIGRATE, P.MIGRATE_TPF, 'locomotion', contained=True, post=soot)

    s.event('SWIM_CYCLE', SWIM_CYCLE)
    s.event('SWIM_CYCLE_STILL', SWIM_CYCLE_STILL)
    s.event('SWIM_STROKE_A', P.SWIM_STROKE_A)
    s.event('SWIM_STROKE_B', P.SWIM_STROKE_B)
    s.event('DIVE_PX', P.DIVE_PX)
    s.event('GLIDE_DIP_FROM', P.GLIDE_DIP_FROM)
    s.variant('vehicle/swan-mute', WP.P2)
