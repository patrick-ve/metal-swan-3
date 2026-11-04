# The 118 game strips of a hero (the 121 contract ids without the UI portrait / select /
# select-grey, which stay as they are) from the approved squad spike's pose tables (kit: anims.UPPER,
# LOWER, FULL after hero.load). Every logic time the game reads stays (docs/design/ams40/contract.md
# "hero VINCENT"); the frame counts follow the plan's action classes. Drawn facing right (the
# game's unflipped hero faces right).
#
# A strip is (name, kind, [(pose, ticks)], opts): kind 'legs' / 'torso' / 'full' / 'ride'. The helium
# twins run the SAME builders on the balloon-head poses (ext_ride_helium), so they keep the roles and
# the timing of the base strips (status.ts swaps the ids while Helium Head is on).
import math

import art40 as X
import anims as A
import parts as P
import ext_ride_helium as HE

from . import frames as F
from . import moves as M
from . import ride as R

mix = F.mix

# The torso actions of the game (src/game/player/player.ts TORSO_ACTIONS) -> the spike's UPPER keys
# (a tuple: one frame of that set, the held aim pose).
TORSO = {
    'pistol': {
        'idle': 'idle', 'run': 'run', 'crouch': 'crouchidle',
        'shoot': 'shoot', 'shoot-up': 'shootup', 'shoot-down': 'shootdown',
        'shoot-diag-up': 'shootdiagup', 'shoot-diag-down': 'shootdiagdown', 'crouch-shoot': 'crouchshoot',
        'up': ('aimup', -1), 'down': ('aimdown', -1), 'diag-up': ('diagup', -1), 'diag-down': ('diagdown', -1),
        'throw': 'grenade', 'crouch-throw': 'crouchgrenade',
        'knife': 'slash', 'knife-b': 'stab', 'crouch-knife': 'crouchslash',
    },
    'heavy': {
        'idle': 'h_idle', 'run': 'h_run', 'crouch': 'h_crouchidle',
        'shoot': 'h_shoot', 'shoot-up': 'h_shootup', 'shoot-down': 'h_shootdown',
        'shoot-diag-up': 'h_shootdiagup', 'shoot-diag-down': 'h_shootdiagdown', 'crouch-shoot': 'h_crouchshoot',
        'up': ('h_aimup', -1), 'down': ('h_aimdown', -1), 'diag-up': ('h_diagup', -1), 'diag-down': ('h_diagdown', -1),
        'throw': 'h_grenade', 'crouch-throw': 'h_crouchgrenade',
        'knife': 'h_slash', 'knife-b': 'h_stab', 'crouch-knife': 'h_crouchslash',
    },
}
# the held aim pose each shoot strip settles back to (its tail ends on it: no pop to the aim strip)
SHOOT_BASE = {
    'shoot': 'idle', 'shoot-up': 'up', 'shoot-down': 'down', 'shoot-diag-up': 'diag-up',
    'shoot-diag-down': 'diag-down', 'crouch-shoot': 'crouch',
}
SMOKE = {'shoot-up': 'fusm'}            # the smoke wisp after a pistol shot ('fsm' by default)

HELIUM_SHOOT_WHY = ('a Helium Head twin keeps the 6-tick shot window only (3 frames, like the 2 of today): '
                    'the status is short and the twins are half of the set\'s bytes')
SHOOT_WHY = ('frames 0-2 (recoil, kick, return) fill the 6-tick shot window (shootAnimTicks x 2); '
             'the settle tail plays only while the hero does not fire again (lead decision, wave 2)')


def upper_src(key, helium=None):
    """The pose list of an UPPER key; helium: 'helium' (balloon head) or 'helium-wob' (the balloon
    one px down and forward, status.ts wobble)."""
    seq = A.UPPER[key]
    if helium:
        he = A.UPPER.get('he_' + key)
        seq = he if he and len(he) == len(seq) else [(HE._swap(p), t) for p, t in seq]
        if helium == 'helium-wob':
            seq = [(wob(p), t) for p, t in seq]
    return seq


def full_src(key, helium=None):
    seq = A.FULL[key]
    if helium:
        he = A.FULL.get('he_' + key)
        seq = he if he and len(he) == len(seq) else [(HE._swap(p, back=False), t) for p, t in seq]
        if helium == 'helium-wob':
            seq = [(wob(p), t) for p, t in seq]
    return seq


def wob(p):
    hd = p.get('hd', (0, 0))
    return dict(p, hd=(hd[0] + 1, hd[1] + 1))


def retime(durs, total):
    """Keep a strip's logic time: the last (held) frame takes the difference."""
    d = list(durs)
    d[-1] += total - sum(d)
    if d[-1] < 1:
        raise ValueError(f'retime: {durs} cannot fit {total}')
    return d


# ------------------------------------------------------------------------------- torso builders
def _fx_move(p, name, dx, dy):
    """The pose with one smoke wisp at the muzzle + (dx, dy) (and no other effect)."""
    q = F.no_flash(dict(p))
    q.pop('fx', None)
    if name:
        q['fx'] = [(name, ('armN', 'muzzle', dx, dy))]
    return q


def _dip(p, dy=1):
    q = dict(p)
    for arm in ('armN', 'armF'):
        if arm in q and 'hand' in q[arm]:
            a = dict(q[arm])
            a['hand'] = (a['hand'][0], a['hand'][1] + dy)
            q[arm] = a
    return q


# the spent brass of a shot (flies up and back and tumbles; FX letters of the shared ramp)
BRASS = {'brass0': (["fc"], (0, 0)), 'brass1': (["f", "c"], (0, 0))}
P.FX.update(BRASS)


def aim_dir(part):
    """The unit vector a held gun part points along (its wrist to its muzzle)."""
    an = P.GUNS[part][1]
    w, m = an['wrist'], an['muzzle']
    dx, dy = m[0] - w[0], m[1] - w[1]
    d = math.hypot(dx, dy) or 1.0
    return dx / d, dy / d


def _move(p, key, dx, dy):
    a = p.get(key)
    if not a or 'hand' not in a:
        return p
    q = dict(p)
    a = dict(a)
    a['hand'] = (a['hand'][0] + dx, a['hand'][1] + dy)
    q[key] = a
    return q


def _fx(p, *fx):
    q = dict(p)
    q.pop('fx', None)
    fx = [f for f in fx if f]
    if fx:
        q['fx'] = list(fx)
    return q


def _head(p, name):
    """The expression `name` on the pose's head (a balloon twin keeps its balloon)."""
    return dict(p, head=('he_' + name) if p.get('head', '').startswith('he_') else name)


def _recoil(p, key, back, lift, keys=None):
    """The arm `key` (and the arms in `keys`: the hands on the same gun) pushed `back` px against the
    aim of its gun and lifted `lift` px across it (toward the sky; back over the head when the gun
    points straight up)."""
    end = ((p.get(key) or {}).get('end') or ('', ''))[1]
    if end not in P.GUNS:
        return p
    dx, dy = aim_dir(end)
    px, py = (dy, -dx) if dx > 0.2 else (-1.0, 0.0) if dy < 0 else (1.0, 0.0)
    ox, oy = -dx * back + px * lift, -dy * back + py * lift
    for k in (keys or (key,)):
        p = _move(p, k, ox, oy)
    return p


def _torso_kick(p, dx, hd):
    to = p.get('tor', (0, 0))
    h0 = p.get('hd', (0, 0))
    return dict(p, tor=(to[0] + dx, to[1]), hd=(h0[0] + hd[0], h0[1] + hd[1]))


def shoot(seq, base, action, heavy):
    """A shot from the held aim pose `base`. The window (6 ticks, frames 0-2, the game draws the
    flash): the fire frame (the spike's own: player.ts muzzleWorld reads its 'muzzle', so it stays),
    the kick (the gun hand jolts back along the barrel and up, the shoulder gives, the head rocks
    back, a shell flies), the return. The tail (presentation only: player.ts keeps it while the aim
    holds): the far hand answers, the smoke curls off the muzzle, the gun dips under the line and
    settles on the aim pose."""
    b = _fx(base)
    shell = lambda k, dx, dy: ('brass%d' % k, ('armN', 'wrist', dx, dy))
    shout = _head(b, 'shout')
    tk = _torso_kick
    if heavy:
        both = ('armN', 'armF')
        mz = lambda dx, dy: ('hsm', ('armN', 'muzzle', dx, dy))
        f0 = _fx(F.no_flash(seq[0][0]), shell(0, 4, -3))
        kb = 2 if action == 'shoot-down' else 2.5      # straight down the elbow has the longest way
        f1 = _fx(tk(_recoil(shout, 'armN', kb, 1, both), -1, (-1, -1)), shell(1, 2, -6))
        f2 = _fx(tk(_recoil(shout, 'armN', 1, 0.5, both), 0, (0, 0)), shell(0, 0, -7))
        f3 = _fx(_recoil(b, 'armN', -0.5, -0.5, both), mz(0, -1), shell(1, -2, -4))
        f4 = _fx(_move(_move(b, 'armN', 0, 1), 'armF', 0, 1), mz(-1, -3))
        f5 = _fx(b, mz(-2, -5))
        f6 = _fx(_move(_move(b, 'armN', 0, 0.5), 'armF', 0, 0.5), mz(-3, -7) if 'down' not in action else None)
        return [(f0, 2), (f1, 2), (f2, 2), (f3, 2), (f4, 2), (f5, 3), (f6, 3), (b, 3)]
    sm = SMOKE.get(action, 'fsm')
    mz = lambda dx, dy: (sm, ('armN', 'muzzle', dx, dy))
    if action == 'crouch-shoot' or b.get('torso') == 'lean2':
        kick = lambda q, dx, hd: tk(q, dx, hd)
    else:
        kick = lambda q, dx, hd: tk(dict(q, torso='back' if dx < -0.5 and q.get('torso', 'up') == 'up' else q.get('torso', 'up')), 0, hd)
    f0 = _fx(F.no_flash(seq[0][0]), shell(0, 3, -3))
    f1 = _fx(kick(_recoil(shout, 'armN', 1.5, 1), -1, (-1, -1)), shell(1, 1, -6))
    f2 = _fx(kick(_recoil(shout, 'armN', 1, 0.5), 0, (0, 0)), shell(0, -1, -7))
    f3 = _fx(_recoil(_move(b, 'armF', -0.5, -0.5), 'armN', -0.5, -1), mz(0, -1), shell(1, -3, -4))
    f4 = _fx(_move(b, 'armN', 0, 1), mz(-1, -3))
    f5 = _fx(b, mz(-2, -5))
    f6 = _fx(_move(b, 'armF', 0, 0.5), mz(-2, -7) if action != 'shoot-down' else None)
    return [(f0, 2), (f1, 2), (f2, 2), (f3, 2), (f4, 2), (f5, 3), (f6, 3), (b, 3)]


def knife(seq):
    """The slash (14 ticks, knifeTicks): anticipation, the cocked pose, the smear, the impact smear,
    follow-through, the recoil in-between and the guard."""
    s = [p for p, _ in seq]
    return [(s[0], 2), (s[1], 3), (mix(s[1], s[2], 0.5, keep='b'), 1, 'ib'), (s[2], 1), (s[3], 2), (s[4], 2), (mix(s[4], s[5], 0.5), 1, 'ib'), (s[5], 2)]


def stab(seq):
    """The second variant (knife-b, 14 ticks): the pull-back, the lunge smear, the hit, the hold,
    the pull-out and the guard."""
    s = [p for p, _ in seq]
    return [(s[0], 3), (s[1], 1), (s[2], 2), (s[3], 2), (s[4], 2), (mix(s[4], s[5], 0.5), 2, 'ib'), (s[5], 2)]


def _trail(r, a0, a1, width):
    """A swing crescent whose LEADING end is the anchor (placed on the wrist): the arc round a centre
    r px behind it, from angle a0 (faint) to a1 (bright, at the hand)."""
    rows, (cx, cy) = P.arc(0, 0, r - 1, r, a0, a1, width)
    return rows, (round(cx + r * math.cos(math.radians(a1))), round(cy + r * math.sin(math.radians(a1))))


# the throwing arm's whip over the shoulder into the release (the frame the player sees first)
P.FX['throw_sw'] = _trail(10, -165, -35, 2.2)


def _whip(p):
    q = dict(p)
    q['fx'] = [f for f in q.get('fx', [])] + [('throw_sw', ('armF', 'wrist', 0, 0))]
    return q


def throw(seq):
    """The overhand throw: the wind-up and the cocked arm (never shown in play: the strip starts AT
    the release, player.ts releaseFrame), a smear into the release, then the visible part: the
    release with the whip trail of the arm, the follow-through across the body, the recovery in two
    steps and the ready pose: 6 frames in the 12 ticks of the throw action (TUNING.fire.throwTicks:
    the torso goes back to its aim strip after them, so a longer tail would be cut)."""
    g = [p for p, _ in seq]
    sm = mix(g[2], g[3], 0.5, keep='a')
    return [(g[0], 3), (g[1], 3), (mix(g[1], g[2], 0.5), 2), (g[2], 3), (sm, 1),
            (_whip(g[3]), 2), (mix(g[3], g[4], 0.5), 2), (g[4], 2), (mix(g[4], g[5], 1 / 3), 2),
            (mix(g[4], g[5], 2 / 3), 2), (g[5], 2)]


KNIFE_TICKS = 14          # TUNING.fire.knifeTicks: the knife strips keep it
THROW_AT = 5              # the release frame of throw(): the strip starts here in play
THROW_TICKS = 12          # from the release to the end: the throw action (TUNING.fire.throwTicks)


def crouch_idle(seq):
    """Crouched breathing on the spike's crouch pose: the chest sinks a frame before the head (the
    spike's own loop held two equal frames)."""
    p0 = seq[0][0]
    by = [0, 0, 1, 1]
    hy = [0, 1, 1, 0]
    hx = p0.get('hd', (0, 0))[0]
    return [(dict(p0, tor=(0, by[k]), hd=(hx, hy[k] - by[k])), seq[k][1]) for k in range(4)]


def torso_strip(pose_, action, helium=None):
    """(steps, opts) of torso-<pose>-<action>."""
    key = TORSO[pose_][action]
    heavy = pose_ == 'heavy'
    if isinstance(key, tuple):
        p = upper_src(key[0], helium)[key[1]][0]
        return [(p, 30)], dict(cls='aim', loop=True, muzzle=True)
    seq = upper_src(key, helium)
    if action == 'crouch':
        return crouch_idle(seq), dict(cls='idle-breathing', muzzle=True)
    if action == 'idle':
        return [(p, t) for p, t in seq], dict(cls='idle-breathing', muzzle=True)
    if action == 'run':
        return [(p, 3) for p, _ in seq], dict(cls='locomotion', muzzle=True, vary=True)
    if action in SHOOT_BASE:
        b = TORSO[pose_][SHOOT_BASE[action]]
        base = upper_src(b[0], helium)[b[1]][0] if isinstance(b, tuple) else upper_src(b, helium)[0][0]
        steps = shoot(seq, base, action, heavy)
        return steps, dict(cls='shoot', loop=False, why=SHOOT_WHY, hand='armN', lock=(0, 1, 2), muzzle=True)
    if action in ('knife', 'crouch-knife'):
        return knife(seq), dict(cls='melee', loop=False, total=KNIFE_TICKS)
    if action == 'knife-b':
        return stab(seq), dict(cls='melee', loop=False, total=KNIFE_TICKS)
    if action in ('throw', 'crouch-throw'):
        return throw(seq), dict(cls='throw', loop=False, hand='armF', segments=[(0, THROW_AT, None), (THROW_AT, None, THROW_TICKS)])
    raise KeyError(action)


# ------------------------------------------------------------------------------- the strip table
def table():
    """Every baked strip: name -> (kind, steps, opts)."""
    T = {}
    L = A.LOWER
    # legs (the torso joins at each frame's hip)
    T['legs-idle'] = ('legs', [(L['stand'][0][0], 60)], dict(cls='idle-breathing', why='the legs stand still: the breathing is in torso-*-idle (the game plays the two pieces on separate animators)'))
    T['legs-run'] = ('legs', M.run_legs(), dict(cls='locomotion', plant=True, nofit=True))
    T['legs-jump'] = ('legs', M.jump_legs(), dict(cls='jump', loop=False))
    T['legs-fall'] = ('legs', [(p, t) for p, t in L['fall']], dict(cls='fall'))
    T['legs-land'] = ('legs', [(p, t) for p, t in L['land']], dict(cls='land', loop=False))
    T['legs-crouch'] = ('legs', [(L['crouch'][0][0], 60)], dict(cls='held', why='the crouched legs hold still: the breathing is in torso-*-crouch'))
    T['legs-crouch-walk'] = ('legs', M.crawl_legs(), dict(cls='crouch-walk', plant=True, nofit=True))
    T['legs-dangle'] = ('legs', [(p, t) for p, t in L['dangle']], dict(cls='idle-fidget', why='the parachute dangle: a 36-tick swing loop of 6 drawings under the chute'))
    cd = L['crouchdown']
    T['legs-crouch-in'] = ('legs', [(cd[0][0], 2), (cd[1][0], 2), (mix(cd[1][0], L['crouch'][0][0], 0.5), 2)],
                           dict(cls='turn', loop=False))
    T['legs-crouch-out'] = ('legs', [(p, 2) for p, _ in L['crouchup']], dict(cls='turn', loop=False))
    # torsos (anchored at the pelvis) and their helium twins
    for helium in (None, 'helium', 'helium-wob'):
        pre = (helium + '-') if helium else ''
        for pose_ in ('pistol', 'heavy'):
            for action in TORSO[pose_]:
                name = f'{pre}torso-{pose_}-{action}'
                if helium and name[len(pre):] not in HELIUM_TORSO:
                    continue
                if name[len(pre):] in NOT_IN_GAME:
                    continue
                if helium == 'helium-wob':
                    # the wobble: the helium drawing itself, 1 px forward and down (the same pixels:
                    # the bake writes them once)
                    T[name] = ('wob', 'helium-' + name[len(pre):], {})
                    continue
                steps, opts = torso_strip(pose_, action, helium)
                if helium and action in SHOOT_BASE:
                    steps, opts = steps[:3], dict(opts, why=HELIUM_SHOOT_WHY, lock=())
                T[name] = ('torso', steps, opts)
    # full body
    D = A.FULL
    T['die'] = ('full', _retimed(D['death'], 74), dict(cls='death-shot', loop=False, total=74))
    T['die-blast'] = ('full', _retimed(D['death_blast'], 50), dict(cls='death-blast', loop=False, total=50))
    T['die-burn'] = ('full', _retimed(D['death_burn'], 86), dict(cls='death-burn', loop=False, total=86))
    T['die-drown'] = ('full', _retimed(D['death_drown'], 60), dict(cls='death-shot', loop=False, defer=True, total=60,
                      why='the drown: 8 drawings of the sink (the water hides the rest), 60 ticks as before'))
    T['die-flat'] = ('full', _retimed(D['death_flat'], 47), dict(cls='death-crush', loop=False, defer=True, total=47))
    T['spawn'] = ('full', _retimed(D['spawn'], 24), dict(cls='respawn', loop=False, total=24))
    T['victory'] = ('full', list(D['victory']), dict(cls='victory'))
    T['bored'] = ('full', list(D['bored']), dict(cls='idle-fidget'))
    T['fidget-a'] = ('fidget', list(A.UPPER['fidget']), dict(cls='idle-fidget', loop=False, defer=True))
    T['fidget-b'] = ('full', list(D['fidgetb']), dict(cls='idle-fidget', loop=False, defer=True))
    T['timeout-yawn'] = ('full', _retimed(D['yawn'], 64), dict(cls='idle-fidget', loop=False, defer=True, total=64))
    T['timeout-sleep'] = ('full', _retimed(D['sleep'], 48), dict(cls='idle-fidget', defer=True, total=48,
                          why='the sleep loop: 4 breaths (the snore letters rise from the head point)'))
    T['flip'] = ('full', M.flip(D['flip']), dict(cls='jump', loop=False, total=28,
                 why='a full somersault: 8 drawings at 45 degrees each (one more than the jump class)'))
    T['mount'] = ('mount', R.mount(), dict(cls='mount', loop=False, nofit=True,
                  why='seated in a vehicle: drawSeated cycles the frames every 16 ticks; frame 1 is the ride fallback (hip 0, -17), frame 0 the ending hang (hand)'))
    T['mount-hop'] = ('full', R.mount_hop(_retimed(D['mounthop'], 16)), dict(cls='mount-hop', loop=False, defer=True, total=16))
    T['salute'] = ('full', M.salute(), dict(cls='victory', loop=False, total=68))
    T['helium-bored'] = ('full', list(full_src('bored', 'helium')), dict(cls='idle-fidget'))
    T['helium-wob-bored'] = ('full', list(full_src('bored', 'helium-wob')), dict(cls='idle-fidget'))
    T['helium-victory'] = ('full', list(full_src('victory', 'helium')), dict(cls='victory'))
    T['helium-wob-victory'] = ('full', list(full_src('victory', 'helium-wob')), dict(cls='victory'))
    # the Swan rider (hip anchor), fitted to the natural Swan (ride.py: the near leg in her overlay's
    # leg window, the fists on her grips, out of the barrel's way)
    RP = R.poses()
    for k in R.ORDER:
        seq = RP[k]
        T['ride-' + k] = ('ride', list(seq), dict(cls='held', why=None if len(seq) > 1 else 'a held rider pose (the Swan picks it)'))
    return T


# the pistol has no drawn shoot-diag-down today (aimAction falls back to shoot-down): the id set stays
NOT_IN_GAME = {'torso-pistol-shoot-diag-down'}
HELIUM_TORSO = {
    'torso-pistol-idle', 'torso-pistol-knife', 'torso-pistol-shoot', 'torso-pistol-shoot-up',
    'torso-pistol-shoot-down', 'torso-pistol-shoot-diag-up', 'torso-pistol-throw', 'torso-pistol-up',
    'torso-pistol-down', 'torso-pistol-diag-up',
    'torso-heavy-idle', 'torso-heavy-knife', 'torso-heavy-shoot', 'torso-heavy-shoot-up',
    'torso-heavy-shoot-down', 'torso-heavy-shoot-diag-up', 'torso-heavy-shoot-diag-down', 'torso-heavy-throw',
    'torso-heavy-up', 'torso-heavy-down', 'torso-heavy-diag-up', 'torso-heavy-diag-down',
}


def _retimed(seq, total):
    d = retime([t for _, t in seq], total)
    return [(p, t) for (p, _), t in zip(seq, d)]


# ------------------------------------------------------------------------------- frames
def make_frames(kind, steps, opts):
    out, durs = [], []
    for st in steps:
        p, t = st[0], st[1]
        smear = len(st) > 2 and st[2] == 'smear'
        if kind == 'legs':
            f = F.legs(p)
        elif kind == 'torso':
            f = F.torso(p, hand=opts.get('hand', 'armN'), smear=smear, muzzle=opts.get('muzzle', False))
        elif kind == 'ride':
            f = R.frame(p, st[2], st[3])
        elif kind == 'fidget':
            rows, root, j = X.humanoid(p, A.LOWER['stand'][0][0])
            j = {k: v for k, v in j.items() if not k.endswith(F.ITEM_PTS)}
            f = X.Frame(rows, root, pts={'head': F.head_pt(j), 'hip': j['pel'], 'hand': j.get('armN.wrist', j['pel'])}, joints=j)
        elif kind == 'mount':
            f = M.mount_frame(p)
        else:
            f = F.full(p, smear=smear)
        out.append(f)
        durs.append(t)
    if opts.get('vary'):
        _vary(out, steps, kind, opts)
    if opts.get('plant'):
        X.plant(out)
    if not opts.get('nofit'):
        return _fit(out, durs, opts, [i for i, st in enumerate(steps) if len(st) > 2 and st[2] == 'ib'])
    return out, durs


def _fit(out, durs, opts, ibs):
    """F.fit, and when the logic time is too short for every drawing, the strip without the
    in-between that helps most (only in-betweens tagged 'ib' may go)."""
    try:
        return out, _fit1(out, durs, opts)
    except F.FitError:
        if not ibs:
            raise
    for i in ibs:
        o2 = [f for k, f in enumerate(out) if k != i]
        d2 = [d for k, d in enumerate(durs) if k != i]
        d2[max(0, i - 1)] += durs[i]
        for f in o2:
            f.smear = False
        try:
            return o2, _fit1(o2, d2, opts)
        except F.FitError:
            continue
    raise F.FitError(f"{opts.get('name')}: no in-between can go")


def _fit1(out, durs, opts):
    n = len(out)
    segs = opts.get('segments')
    if segs:
        segs = [(a, n if b is None else b, t) for a, b, t in segs]
    elif opts.get('total'):
        segs = [(0, n, opts['total'])]
    return F.fit(out, durs, loop=opts.get('loop', True), segments=segs, lock=opts.get('lock', ()), name=opts.get('name', '?'))


def _hd(p, dy):
    hd = p.get('hd', (0, 0))
    return dict(p, hd=(hd[0], hd[1] + dy))


VARY = (lambda p: _dip(p, 1), lambda p: _hd(p, 1), lambda p: _dip(p, -1), lambda p: _hd(_dip(p, 1), 1))


def _vary(out, steps, kind, opts):
    """A loop whose spike poses repeat (the heavy run held its gun still for two frames): the second
    of two equal drawings bobs the gun or the head 1 px, so every frame differs from its neighbours."""
    n = len(out)
    for i in range(n):
        a, b = out[i - 1], out[(i + 1) % n]
        if out[i].rows != a.rows:
            continue
        for fn in VARY:
            f = F.torso(fn(steps[i][0]), hand=opts.get('hand', 'armN'), muzzle=opts.get('muzzle', False))
            if f.rows != a.rows and f.rows != b.rows:
                out[i] = f
                break
