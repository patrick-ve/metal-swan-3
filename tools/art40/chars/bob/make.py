# BOB's set maker (wave 2 stage 2): the shared hero module's make() (tools/art40/chars/_hero) with
# BOB's own steps on top. Same strips, ids, points, events and logic times as every hero; BOB's
# differences, all in this folder:
#
#   1. attacks.py   the haymaker and the jab redrawn (more in-betweens, a held wind-up, smears, the
#                   impact, the recoil), installed before the kit derives the crouched and heavy ones
#   2. cape.py      the cape follows the body as a damped spring over the real ticks of every strip
#                   (no snap when a strip changes the cape's mode; follow-through and settle)
#   3. this file    the melee strips get their smear tags; everything else as the shared make()
import importlib

import art40 as X

from . import attacks as AT
from . import cape as CP

H = X.char('_hero')
F = H.F
PA = H.PA
FX = H.FX

MELEE = {
    'torso-pistol-knife': 'slash', 'torso-pistol-knife-b': 'stab', 'torso-pistol-crouch-knife': 'crouchslash',
    'torso-heavy-knife': 'h_slash', 'torso-heavy-knife-b': 'h_stab', 'torso-heavy-crouch-knife': 'h_crouchslash',
}


def make(s, name='bob', only=None):
    import heroes.bob  # noqa: F401  (the hero module first: its tables, then our attacks over them)
    AT.install()
    import hero
    hero.load(name)
    S = importlib.import_module(H.__name__ + '.strips')
    T = S.table()
    for strip_name, key in MELEE.items():
        for pre in ('', 'helium-'):
            nm = pre + strip_name
            if nm in T and T[nm][0] == 'torso':
                kind, _, opts = T[nm]
                src = AT.steps(key)
                if pre:
                    src = [((S.upper_src(key, 'helium')[i][0],) + tuple(st[1:])) for i, st in enumerate(src)]
                T[nm] = (kind, src, dict(opts, total=S.KNIFE_TICKS))
    built = {}
    cape_steps = {}
    for strip_name, (kind, steps, opts) in T.items():
        if only and not any(strip_name.startswith(o) for o in only):
            continue
        if kind == 'wob':
            continue
        if kind in ('torso', 'full', 'fidget'):
            steps = CP.follow(steps, opts.get('loop', True), 'last' if opts['cls'] in ('shoot', 'melee', 'throw') else None)
        frames, durs = S.make_frames(kind, steps, dict(opts, name=strip_name))
        cape_steps[strip_name] = steps
        built[strip_name] = (frames, durs, opts)
    for name in RUN_TORSOS:
        if name in built and 'legs-run' in built:
            behind_legs(built[name][0], cape_steps[name], built['legs-run'][0])
    for strip_name, (kind, src, _) in T.items():
        if kind == 'wob' and src in built:
            frames, durs, opts = built[src]
            built[strip_name] = ([H.wob(f) for f in frames], list(durs), opts)
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


# The run torso is drawn on the legs frame of the same index (player.ts: legs.index % torso count),
# so its cape can go BEHIND the legs: the cape pixels that the legs frame covers are cut out of the
# torso frame (the game draws the legs first, they show through). Other torso strips play over
# many legs strips and keep their cape whole.
RUN_TORSOS = ('torso-pistol-run', 'torso-heavy-run')


def behind_legs(frames, steps, legs):
    import pose
    for i, (f, st) in enumerate(zip(frames, steps)):
        lg = legs[i % len(legs)]
        up = dict(st[0])
        up['pelvis'] = (0, -17)
        back = pose.compose(up, 'back')[0]
        body = pose.compose(up, 'upper')[0]
        if not back:
            continue
        hx, hy = lg.pts['hip']
        dx, dy = hx - f.root[0], hy - f.root[1]
        g = [list(r) for r in f.rows]
        for y, r in enumerate(g):
            for x, ch in enumerate(r):
                if ch == '.' or back[y][x] == '.' or body[y][x] != '.':
                    continue
                ly, lx = int(round(y + dy)), int(round(x + dx))
                if 0 <= ly < len(lg.rows) and 0 <= lx < len(lg.rows[ly]) and lg.rows[ly][lx] != '.':
                    g[y][x] = '.'
        f.rows = [''.join(r) for r in g]
