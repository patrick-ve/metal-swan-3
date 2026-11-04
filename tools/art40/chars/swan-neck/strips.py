# The neck strips of the Swan (slug 'swan-neck', prefix vehicle/swan, P2 vehicle/swan-mute).
#
# Every neck strip is indexed by the AIM first (the barrel at theta = +45 - 22.5 * i, the game's
# neckIndex 0..8): frame = aim * PHASES + phase. A face with one phase (neck, the blink) has 9
# frames; a timed face has its phases per aim, and the durations of one aim's phases add up to the
# face's time in the game (plan rule 4: the logic time stays):
#   neck        1 phase, the rest (30 ticks a frame: the old hold)
#   blink       1 phase (6 ticks: SWAN.blinkT)
#   fire        3 phases [1, 1, 3]: the shot (flash, the barrel and the plate slam back, the case in
#               the port, the neck flinches), the recoil (the flash breaks up into smoke, the case
#               flies), the return (smoke drifts, the case tumbles). The game picks the phase by
#               the ticks since the last round (swan.ts fireAge): in a burst (a round every 4
#               ticks) the return shows 2 ticks and the next round starts again at the shot; after
#               the last round the smoke hangs 3 ticks, then the rest frame
#   shell       3 phases [1, 2, 3] (6 ticks: SWAN.shellFaceTicks): the big ring flash with the
#               drum turning a notch, the heavy recoil in smoke with the fat case, the settle
#   hurt        3 phases [2, 4, 6] (12 ticks: SWAN.hurtTicks): the snap back with a squawk and
#               a loose feather, the wince, the recovery while the feather drifts down
#   relax       2 phases [6, 180] (the blink with a sleepy nod, the relaxed S-neck: the game picks
#               NECK_RELAX_BLINK or NECK_RELAX_OPEN)
#   honk        6 phases [4, 3, 3, 2, 2, 6] (20 ticks: the honk; the ring at tick 10 =
#               phase NECK_HONK_BLAST): draw back, inhale, the strain, the snap forward with the
#               bill wide, the full stretch, the hold
# The swim necks are the land necks on the swimming body (the same socket geometry, 14 px lower);
# her aims 0 and 1 shoot level in the water (shotAngle), so their barrel is drawn at 0 deg while
# her head still looks down. The crouch and duck necks aim 0 deg only (one aim).
import math

from . import draw as D

AIMS = 9
FIRE_D = [1, 1, 3]
SHELL_D = [1, 2, 3]
HURT_D = [2, 4, 6]
RELAX_D = [6, 180]                   # the blink, the open eye (the wrap of the loop lands on a hold)
HONK_D = [4, 3, 3, 2, 2, 6]
HONK_BLAST = 3                       # sum(HONK_D[:3]) = 10: the ring leaves at tick 10 (HK.windup)

# ------------------------------------------------------------------ neck poses (relative to the socket)
# c1, c2: the Bezier controls; head: where the neck enters the head; ang: + = the bill up
LAND = dict(c1=(16, -3), c2=(-8, -15), head=(3, -25), ang=0)          # the core's NECK_REST
RELAX = dict(c1=(15, -1), c2=(-9, -11), head=(1, -20), ang=-8)        # the relaxed, lower S
CROUCH = dict(c1=(10, 1), c2=(13, -1), head=(19, -2), ang=-2, r0=4.0)   # stretched low and forward, under the rider's chin
DUCK = dict(c1=(8, -4), c2=(11, -7), head=(17, -4), ang=-6, r0=4.0)     # the head just over the water

# she looks where the gun points (the neck is free): the head's offset and angle per aim
AIM_HEAD = [(2, 2, -14), (1, 1, -7), (0, 0, 0), (0, -1, 6), (-1, -2, 12), (-1, -2, 17), (-2, -3, 21),
            (-2, -3, 21), (-1, -3, 18)]


def neck(base, aim=2, d=(0, 0), ang=0.0, face='n', c2=None, r0=None, scale=1.0):
    """A neck pose: base + the aim's head offset + d (the phase's head offset); c2 follows the head
    by 0.6 (or by c2); scale shrinks the aim offsets (the low necks barely turn)."""
    ax, ay, aa = AIM_HEAD[aim]
    ax, ay, aa = ax * scale, ay * scale, aa * scale
    hx, hy = base['head'][0] + ax + d[0], base['head'][1] + ay + d[1]
    cd = c2 if c2 is not None else (0.6 * (ax + d[0]), 0.6 * (ay + d[1]))
    nk = dict(base)
    nk.update(head=(hx, hy), c2=(base['c2'][0] + cd[0], base['c2'][1] + cd[1]), ang=base['ang'] + aa + ang, face=face)
    if r0 is not None:
        nk['r0'] = r0
    return nk


# ------------------------------------------------------------------ effect helpers
def _up(u):
    """The barrel's normal that points up and back on screen (the ejection side)."""
    a, b = (u[1], -u[0]), (-u[1], u[0])
    score = lambda n: -n[1] - 0.3 * n[0]
    return a if score(a) >= score(b) else b


def _at(p, u, n, along, side):
    return (p[0] + u[0] * along + n[0] * side, p[1] + u[1] * along + n[1] * side)


def port(ctx):
    """The ejection port on the receiver (canvas), a little in front of the hub, on its top."""
    u = ctx['u']
    return _at(ctx['hub'], u, _up(u), 1.5, 2.2)


def fire_fx(phase):
    def fx(g, c):
        u, n, tip = c['u'], _up(c['u']), c['tip']
        if c.get('surf') is not None and tip[1] >= c['surf']:
            D.spout(g, tip[0] + 2 + phase, c['surf'], phase)
            return
        p = port(c)
        if phase == 0:
            D.flash(g, tip, c['deg'], 13.0, 3.6, prongs=True)
            D.burst(g, _at(tip, u, n, 2.0, 0.0), 2.3)
            D.case(g, p, 0)
        elif phase == 1:
            D.puff(g, _at(tip, u, n, 3.5, 0.5), 1.7, light=False)
            D.flash(g, tip, c['deg'], 5.0, 1.6, prongs=False)
            D.case(g, _at(p, u, n, -1.0, 3.0), 1)
        else:
            D.puff(g, _at(tip, u, n, 4.0, 1.5), 2.2)
            D.puff(g, _at(tip, u, n, 1.0, 0.5), 1.0, light=False)
            D.case(g, _at(p, u, n, -3.5, 2.5), 2)
    return fx


def shell_fx(phase):
    def fx(g, c):
        u, n, tip = c['u'], _up(c['u']), c['tip']
        if c.get('surf') is not None and tip[1] >= c['surf']:
            D.spout(g, tip[0] + 3 + 2 * phase, c['surf'], phase, big=True)
            return
        p = port(c)
        if phase == 0:
            D.flash(g, tip, c['deg'], 14.0, 4.6, prongs=True, ring=True)
            D.burst(g, _at(tip, u, n, 2.0, 0.0), 2.6)
            D.case(g, p, 0, big=True)
        elif phase == 1:
            D.puff(g, _at(tip, u, n, 3.5, 0.0), 3.2)
            D.puff(g, _at(tip, u, n, 7.5, 1.5), 1.9, light=False)
            D.flash(g, _at(tip, u, n, 0.5, 0.0), c['deg'], 4.0, 1.6, prongs=False)
            D.case(g, _at(p, u, n, -1.5, 3.5), 1, big=True)
        else:
            D.puff(g, (tip[0] + u[0] * 5, tip[1] + u[1] * 5 - 3.0), 2.8)
            D.puff(g, (tip[0] + u[0] * 9.5, tip[1] + u[1] * 9.5 - 4.5), 1.6, light=False)
            D.puff(g, (tip[0] + u[0] * 1.5, tip[1] + u[1] * 1.5 - 1.0), 1.1, light=False)
            D.case(g, _at(p, u, n, -4.5, 2.0), 2, big=True)
    return fx


def hurt_fx(phase):
    def fx(g, c):
        m = c['neckmid']
        at = [(-6, -3), (-10, -8), (-14, -4)][phase]
        D.feather(g, (m[0] + at[0], m[1] + at[1]), 0 if phase == 0 else 1)
    return fx


def honk_fx(phase):
    def fx(g, c):
        if phase not in (3, 4):
            return
        h = c['head']
        n = 3 if phase == 3 else 2
        for k, dy in enumerate((-5, -1, 3)[:n]):
            ln = 6 if phase == 3 else 4
            x0 = h[0] - 5 - k
            D.streak(g, (x0 - ln, h[1] + dy), (x0, h[1] + dy), 'c' if phase == 3 and k == 1 else 'd')
    return fx


# ------------------------------------------------------------------ the faces
FIRE_GUN = [dict(kick=2.5, plate=1.0, feed=1), dict(kick=1.5, plate=1.0, feed=1), dict(kick=0.5, feed=1)]
FIRE_NECK = [dict(d=(-1, 0)), dict(d=(-1, 0), ang=2), dict(d=(0, 0), ang=1)]
SHELL_GUN = [dict(kick=3.5, plate=1.5, turn=22.5, feed=1), dict(kick=2.5, plate=1.0, turn=22.5, feed=1),
             dict(kick=1.0, plate=0.5, turn=45.0, feed=1)]
SHELL_NECK = [dict(d=(-2, -1), ang=5, face='squint'), dict(d=(-2, -1), ang=3, face='squint'), dict(d=(-1, 0), ang=1)]
HURT_GUN = [dict(kick=1.0), dict(kick=0.5), dict()]
HURT_NECK = [dict(d=(-4, -2), ang=16, face='open', c2=(-2.5, -1.5)), dict(d=(-3, -1), ang=8, face='squint', c2=(-2, -1)),
             dict(d=(-1, 0), ang=2)]
HONK_NECK = [dict(d=(-2, 1), ang=-4, r0=4.4), dict(d=(-4, -1), ang=8, r0=4.7), dict(d=(-5, -3), ang=18, r0=4.9, face='squint'),
             dict(d=(3, -3), ang=-2, r0=4.4, face='open'), dict(d=(7, -2), ang=-6, r0=4.2, face='open'),
             dict(d=(3, 0), ang=-3, face='open')]


def frames_of(posture, base, aims, phases, level=(), water=None, scale=1.0):
    """[frame] for aims x phases: phases = [(neck kw, gun kw, fx)]."""
    out = []
    for i in aims:
        for nkw, gkw, fx in phases:
            nk = neck(base, i, scale=scale, **nkw)
            out.append(D.picture(posture, i, nk, gun=gkw, level=i in level, fx=fx, water=water))
    return out


def faces(base):
    return {
        '': [(dict(), None, None)],
        '-blink': [(dict(face='blink'), None, None)],
        '-fire': [(FIRE_NECK[k], FIRE_GUN[k], fire_fx(k)) for k in range(3)],
        '-shell': [(SHELL_NECK[k], SHELL_GUN[k], shell_fx(k)) for k in range(3)],
        '-hurt': [(HURT_NECK[k], HURT_GUN[k], hurt_fx(k)) for k in range(3)],
    }


TIMING = {'': [30], '-blink': [6], '-fire': FIRE_D, '-shell': SHELL_D, '-hurt': HURT_D}


# ------------------------------------------------------------------ beak-flash (the FX the gun spawns)
BEAK_FLASH = [
    (["...i...",
      "..jfj..",
      ".jfefj.",
      "ifecefi",
      ".jfefj.",
      "..jfj..",
      "...i..."], (3, 3)),
    ([".......",
      ".......",
      "..j.j..",
      "...f...",
      "..j.j..",
      ".......",
      "......."], (3, 3)),
]


def build(s):
    all_aims = list(range(AIMS))
    for posture, name, base, aims, level, water, scale in (
            ('land', 'neck', LAND, all_aims, (), None, 1.0),
            ('swim', 'swim-neck', LAND, all_aims, (0, 1), None, 1.0),
            ('crouch', 'crouch-neck', CROUCH, [2], (), None, 0.0),
            ('duck', 'duck-neck', DUCK, [2], (), D.DUCK_SURFACE, 0.0)):
        for face, phases in faces(base).items():
            frames = frames_of(posture, base, aims, phases, level=level, water=water, scale=scale)
            s.strip(name + face, frames, TIMING[face] * len(aims), loop=False, cls='aim')
        if posture in ('land', 'swim'):
            # the blink nods the relaxed head 1 px (a sleepy blink)
            relax = frames_of(posture, RELAX, aims, [(dict(face='blink', d=(0, 1)), None, None), (dict(), None, None)], level=level)
            s.strip(name + '-relax', relax, RELAX_D * len(aims), loop=True, cls='aim')
    honk = frames_of('land', LAND, all_aims, [(HONK_NECK[k], None, honk_fx(k)) for k in range(len(HONK_D))])
    s.strip('neck-honk', honk, HONK_D * AIMS, loop=False, cls='aim')
    # the honk on the water: the same neck on the swim posture (the drum strapped high afloat, the
    # water aims 0-1 level), so the barrel stays on the swim body's drum over the water line
    honk_s = frames_of('swim', LAND, all_aims, [(HONK_NECK[k], None, honk_fx(k)) for k in range(len(HONK_D))], level=(0, 1))
    s.strip('swim-neck-honk', honk_s, HONK_D * AIMS, loop=False, cls='aim')
    s.strip('beak-flash', [(rows, an) for rows, an in BEAK_FLASH], 2, loop=False, cls='prop')

    s.event('NECK_AIMS', AIMS)
    s.event('NECK_FIRE_PHASES', len(FIRE_D))
    s.event('NECK_SHELL_PHASES', len(SHELL_D))
    s.event('NECK_HURT_PHASES', len(HURT_D))
    s.event('NECK_RELAX_PHASES', len(RELAX_D))
    s.event('NECK_RELAX_BLINK', 0)
    s.event('NECK_RELAX_OPEN', 1)
    s.event('NECK_HONK_PHASES', len(HONK_D))
    s.event('NECK_HONK_BLAST', HONK_BLAST)
    p2 = dict(D.SP.P2)
    p2.update(D.WATER_P2)
    s.variant('vehicle/swan-mute', p2)
    assert sum(HONK_D[:HONK_BLAST]) == 10 and sum(HONK_D) == 20
    assert sum(SHELL_D) == 6 and sum(HURT_D) == 12 and sum(FIRE_D) == 5
