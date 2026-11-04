# THOM's attacks at 40 px (plan docs/design/ams40.md wave 2, user review of the pilot: every attack
# clearly better than today's: more in-betweens, anticipation, smears, impact and recoil inside the
# same logic time). Applied after hero.load('thom'), before the shared hero module builds the strips:
#
# - the pistol shots: a real recoil in the 6-tick window (the near pistol snaps up and back, the
#   shoulder and the head take the kick, a brass shell flies), then the settle tail (the far pistol
#   answers with a small twitch, the smoke rises, the gun dips and comes back);
# - the pistol whip (knife): a high cock over the shoulder, the swing smear, a blunt impact burst,
#   the bounce off the target, follow-through low and the settle;
# - the butt jab (knife-b): the coil, the lunge smear with speed lines, the impact, the recoil, the
#   pull-out;
# - the grenade: after the release the arm follows through across the body, then the far hand pulls
#   the tucked pistol out of the belt and spins it back into the akimbo stance.
#
# Logic time stays (docs/design/ams40/contract.md "hero THOM"): knife strips 14 ticks, the throw 14
# ticks from its release frame, the shots keep their 3-frame window of 6 ticks.
import importlib

import anims as A
import ext_heavy as EH
import parts as P
from anims import gun, hand, up
from heroes import thom_anims as TA
from heroes import thom_ext as TE

DY = TA.DY
NB, FB = TA.NB, TA.FB
fgun = TA.fgun
SH = ('torso', 'shN')

# ------------------------------------------------------------------------------- effects
# blunt hits are warm (the shared FX ramp: white, cream, gold); the swing arcs are the cool slash ramp
FX = {
    # the impact burst at the butt of the pistol (frame of contact) and its fading ring
    'tw_hit0': ([
        "...f...",
        ".f.F.f.",
        "..FWF..",
        "fFWWWFf",
        "..FWF..",
        ".f.F.f.",
        "...f...",
    ], (3, 3)),
    'tw_hit1': ([
        "f...f",
        ".F.F.",
        "..y..",
        ".F.F.",
        "f...f",
    ], (2, 2)),
    'tw_hit2': ([
        "c...c",
        ".....",
        ".....",
        ".....",
        "c...c",
    ], (2, 2)),
    # speed lines behind the jab
    'tw_jab': ([
        "iiii....",
        "..mmmiii",
        "iiii....",
    ], (8, 1)),
    # the spent brass of a pistol shot (flies up and back, tumbles)
    'tw_sh0': (["fc"], (0, 0)),
    'tw_sh1': (["f", "c"], (0, 0)),
}
# the pistol-whip swoosh: the butt's path round the shoulder (radius about one arm + grip)
FX['tw_sw1'] = P.arc(0, 0, 9, 11, -80, 20, 3.0)           # the swing smear
FX['tw_sw2'] = P.arc(0, 0, 9, 10, -10, 50, 2.0)            # the follow-through tail (thinning)
FX['tw_sw3'] = P.arc(0, 0, 9, 9, 30, 65, 1.2)


# ------------------------------------------------------------------------------- pose helpers
def _arm(p, key, **kw):
    a = dict(p[key])
    a.update(kw)
    q = dict(p)
    q[key] = a
    return q


def _move(p, key, dx, dy):
    a = p.get(key)
    if not a:
        return p
    h = a['hand']
    return _arm(p, key, hand=(h[0] + dx, h[1] + dy))


def _fx(p, *fx):
    q = dict(p)
    q.pop('fx', None)
    fx = [f for f in fx if f]
    if fx:
        q['fx'] = list(fx)
    return q


def _head(p, name):
    """The expression `name` on the pose's head (the balloon twin keeps its balloon)."""
    return dict(p, head=('he_' + name) if p.get('head', '').startswith('he_') else name)


def _end(p, key):
    return ((p.get(key) or {}).get('end') or ('', ''))[1]


def aim_dir(part):
    """The unit vector a held gun part points along (its wrist to its muzzle)."""
    import math
    an = P.GUNS[part][1]
    w, m = an['wrist'], an['muzzle']
    dx, dy = m[0] - w[0], m[1] - w[1]
    d = math.hypot(dx, dy) or 1.0
    return dx / d, dy / d


def _recoil(p, key, back, lift, keys=None):
    """The arm `key` (and the arms in `keys`, the hands on the same gun) pushed `back` px against the
    aim of `key`'s gun and lifted `lift` px across it (towards the sky; back over the head when the
    gun points straight up)."""
    aim = _end(p, key)
    if aim not in P.GUNS:
        return p
    dx, dy = aim_dir(aim)
    px, py = (dy, -dx) if dx > 0.2 else (-1.0, 0.0) if dy < 0 else (1.0, 0.0)
    ox, oy = -dx * back + px * lift, -dy * back + py * lift
    for k in (keys or (key,)):
        p = _move(p, k, ox, oy)
    return p


def _torso_kick(p, dx, hd):
    to = p.get('tor', (0, 0))
    h0 = p.get('hd', (0, 0))
    return dict(p, tor=(to[0] + dx, to[1]), hd=(h0[0] + hd[0], h0[1] + hd[1]))


# ------------------------------------------------------------------------------- the pistol shot
def shoot(seq, base, action, heavy):
    """A shot from the held aim pose `base` (the spike's 10-frame alternating loop is not used: the
    game fires the near pistol and draws its own flash). Window (6 ticks, frames 0-2): the fire
    frame (the spike's own: the arm punches forward with the shout; player.ts muzzleWorld reads its
    'muzzle', so it stays exactly where it was), the kick (the hand jolts back and up, the shoulder
    gives, the head rocks back), the return. Tail (only while the aim holds): the far pistol
    twitches in sympathy, the smoke curls off the near muzzle, the gun dips under the line and
    settles."""
    if heavy:
        return heavy_shoot(seq, base, action)
    sm = 'fusm' if action == 'shoot-up' else 'fsm'
    mz = lambda dx, dy: (sm, ('armN', 'muzzle', dx, dy))
    shell = lambda k, dx, dy: ('tw_sh%d' % k, ('armN', 'wrist', dx, dy))
    b = _fx(base)
    if action == 'crouch-shoot' or 'lean2' == b.get('torso'):
        kick = lambda q, dx, hd: _torso_kick(q, dx, hd)
    else:
        kick = lambda q, dx, hd: _torso_kick(dict(q, torso='back' if dx < -0.5 and q.get('torso', 'up') == 'up' else q.get('torso', 'up')), 0, hd)
    shout = _head(b, 'shout')
    f0 = _fx(_H.frames.no_flash(seq[0][0]), shell(0, 3, -3))       # the fire frame: the game's muzzle point
    f1 = _fx(kick(_recoil(shout, 'armN', 1.5, 1), -1, (-1, -1)), shell(1, 1, -6))
    f2 = _fx(kick(_recoil(shout, 'armN', 1, 0.5), 0, (0, 0)), shell(0, -1, -7))
    f3 = _fx(_recoil(_recoil(b, 'armF', 1, 0.5), 'armN', -0.5, -1), mz(0, -1), shell(1, -3, -4))
    f4 = _fx(_move(b, 'armN', 0, 1), mz(-1, -3))
    f5 = _fx(b, mz(-2, -5))
    f6 = _fx(_move(b, 'armF', 0, 0.5), mz(-2, -7) if action != 'shoot-down' else None)
    return [(f0, 2), (f1, 2), (f2, 2), (f3, 2), (f4, 2), (f5, 3), (f6, 3), (b, 3)]


def heavy_shoot(seq, base, action):
    """The heavy gun (both hands on it): the whole gun and both arms shove back along the barrel,
    the shoulders give, the head rocks; a fat casing flies; then the heavy smoke curls off and the
    gun sinks a pixel and comes back to the aim."""
    b = _fx(base)
    both = ('armN', 'armF')
    mz = lambda dx, dy: ('hsm', ('armN', 'muzzle', dx, dy))
    shell = lambda k, dx, dy: ('tw_sh%d' % k, ('armN', 'wrist', dx, dy))
    tk = lambda q, dx, hd: _torso_kick(q, dx, hd)
    shout = _head(b, 'shout')
    f0 = _fx(_H.frames.no_flash(seq[0][0]), shell(0, 4, -3))       # the fire frame: the game's muzzle point
    f1 = _fx(tk(_recoil(shout, 'armN', 2.5, 1, both), -1, (-1, -1)), shell(1, 2, -6))
    f2 = _fx(tk(_recoil(shout, 'armN', 1, 0.5, both), 0, (0, 0)), shell(0, 0, -7))
    f3 = _fx(_recoil(b, 'armN', -0.5, -0.5, both), mz(0, -1), shell(1, -2, -4))
    f4 = _fx(_move(_move(b, 'armN', 0, 1), 'armF', 0, 1), mz(-1, -3))
    f5 = _fx(b, mz(-2, -5))
    f6 = _fx(_move(_move(b, 'armN', 0, 0.5), 'armF', 0, 0.5), mz(-3, -7) if 'down' not in action else None)
    return [(f0, 2), (f1, 2), (f2, 2), (f3, 2), (f4, 2), (f5, 3), (f6, 3), (b, 3)]


# ------------------------------------------------------------------------------- the pistol whip
SWING = ('torso', 'shN', 3, 1)          # the swoosh centre: in front of the shoulder (clear of the face)


def slash_set():
    """The pistol whip (knife, 14 ticks): 7 keys. The cock (the gun goes up behind the cap, barrel
    back, the body winds back), the top (held a beat, a streak above the cap), the swing smear
    over the front, the impact (the pistol's flat comes down on the target, burst), the bounce,
    the follow-through low, the guard."""
    fl = fgun((6, 7), 'low')
    flb = fgun((5, 8), 'low')
    S = []
    S.append((up(torso='back', head='shout', hd=(-1, 0), near=gun((6.5, -7.5), 'up', bend=1, sh=(0.5, -0.5)), far=flb), 2))
    S.append((up(torso='back', head='shout', tor=(-1, 0), hd=(-1, 0), near=gun((1, -11), 'raise', bend=1, sh=(-0.5, -1)), far=flb), 2))
    S.append((up(torso='lean', head='shout', near=gun((7, -6.5), 'dup', bend=1), far=fl, fx=[('tw_sw1', SWING)]), 1))
    S.append((up(torso='lean2', head='shout', tor=(1, 0), near=gun((10, 1.5), 'ddown', bend=-1), far=fl,
                 fx=[('tw_sw2', SWING), ('tw_hit0', ('armN', 'muzzle', -2, -2))]), 2))
    S.append((up(torso='lean2', head='shout', tor=(1, 0), near=gun((9.5, -0.5), 'fwd', bend=-1), far=fl,
                 fx=[('tw_sw3', SWING), ('tw_hit1', ('armN', 'muzzle', -1, 2))]), 2))
    S.append((up(torso='lean', head='smug', near=gun((7, 6.5), 'low', bend=-1), far=fl, fx=[('tw_hit2', ('torso', 'shN', 15, 6))]), 2))
    S.append((TA.akimbo((8, 5), (9.5, 0)), 3))
    return S


def knife(seq):
    """Strip steps of the whip (14 ticks): no 'ib' frame may be dropped silently, the timing below
    is the wanted one; fit() only moves ticks."""
    s = [p for p, _ in seq]
    mix = _H.frames.mix
    return [(s[0], 2), (s[1], 2), (s[2], 1), (s[3], 2), (s[4], 2), (s[5], 2), (mix(s[5], s[6], 0.5, keep='b'), 1, 'ib'), (s[6], 2)]


# ------------------------------------------------------------------------------- the butt jab
def stab_set():
    """The butt jab (knife-b): the coil (the gun drawn back to the ribs, the shoulder turns away),
    the lunge smear (speed lines), the hit with the burst, the recoil, the pull-out, the guard."""
    fl = fgun((6, 7), 'low')
    S = []
    S.append((up(torso='back', head='fwd', near=gun((3, 4), 'butt'), far=fl), 2))
    S.append((up(torso='back', head='shout', tor=(-1, 0), hd=(-1, 0), near=gun((1, 3.5), 'butt'), far=fgun((5, 8), 'low')), 2))
    S.append((up(torso='lean2', head='shout', near=gun((10, 1), 'butt'), far=fl, fx=[('tw_jab', ('armN', 'wrist', -3, -3))]), 1))
    S.append((up(torso='lean2', head='shout', tor=(1, 0), near=gun((11, 0.5), 'butt'), far=fl,
                 fx=[('tw_hit0', ('armN', 'tip', 1, -1))]), 2))
    S.append((up(torso='lean2', head='shout', near=gun((9.5, 1), 'butt'), far=fl, fx=[('tw_hit1', ('armN', 'tip', 2, -1))]), 2))
    S.append((up(torso='lean', head='smug', near=gun((7, 3), 'butt'), far=fl, fx=[('tw_hit2', ('armN', 'tip', 3, -1))]), 2))
    S.append((TA.akimbo((8, 5), (9.5, 0)), 3))
    return S


def stab(seq):
    s = [p for p, _ in seq]
    return [(s[0], 2), (s[1], 2), (s[2], 1), (s[3], 2), (s[4], 2), (s[5], 2), (s[6], 3)]


# ------------------------------------------------------------------------------- the grenade
def grenade_set():
    """The overhand throw with the far hand (the far pistol tucked in the belt): the spike's wind-up
    (never seen in play), the release, then the follow-through across the body, the far hand pulls
    the pistol from the belt and spins it up into the akimbo stance."""
    low = gun((6, 6), 'low')
    tuck = [('tuck', (0, -15 + DY), 4.5)]
    g = list(TA.grenade_set())
    S = [g[0], g[1], g[2]]
    S.append(g[3])          # the release: the spike's own (player.ts handWorld throws from its 'hand')
    S.append((up(torso='lean2', head='shout', tor=(1, 0), near=low, far=hand((10.5, 1.5), 'open', 'hand', z=6.5), items=tuck), 2))
    S.append((up(torso='lean', head='fwd', near=gun((6, 6.5), 'low'), far=hand((7, 6), 'open', 'hand', z=6.5), items=tuck), 3))
    S.append((up(torso='up', head='smug', near=low, far=hand((1, 7), 'fist', 'fist', z=3), items=tuck), 3))
    S.append((up(torso='up', head='smug', near=gun((7, 5.5), 'low'), far=fgun((9.5, -2), 'dup', bend=1)), 2))
    S.append((TA.akimbo((8, 5), (9.5, 0)), 4))
    return S


def throw(seq):
    """Wind-up (frames 0-4, before the release: not shown in play), the release (5), then the six
    frames after it (14 ticks)."""
    g = [p for p, _ in seq]
    mix = _H.frames.mix
    return [(g[0], 3), (g[1], 3), (mix(g[1], g[2], 0.5), 2), (g[2], 3), (mix(g[2], g[3], 0.5, keep='a'), 1),
            (g[3], 2), (g[4], 2), (g[5], 3), (g[6], 3), (g[7], 2), (g[8], 4)]


# ------------------------------------------------------------------------------- the heavy gun's melee
def _add_fx(p, *fx):
    q = dict(p)
    q['fx'] = [f for f in q.get('fx', []) if f[0] not in ('stab',)] + list(fx)
    return q


def heavy_melee():
    """THOM's heavy butt stroke and stock jab (thom_ext.heavy_melee, 6 keys each) with the impact
    the user asked for: the stroke's top lands with a burst at the stock and leaves a fading ring;
    the jab gets speed lines on the lunge, the burst on the hit, the ring on the hold."""
    S, J, _ = TE.heavy_melee()
    S = [(p, t) for p, t in S]
    S[3] = (_add_fx(S[3][0], ('tw_hit0', ('armN', 'tip', 1, 0))), S[3][1])
    S[4] = (_add_fx(S[4][0], ('tw_hit1', ('armN', 'tip', 2, 0))), S[4][1])
    J = [(p, t) for p, t in J]
    J[1] = (_add_fx(J[1][0], ('tw_jab', ('armN', 'tip', -6, 0))), J[1][1])
    J[2] = (_add_fx(J[2][0], ('tw_hit0', ('armN', 'tip', 1, 0))), J[2][1])
    J[3] = (_add_fx(J[3][0], ('tw_hit1', ('armN', 'tip', 2, 0))), J[3][1])
    J[4] = (_add_fx(J[4][0], ('tw_hit2', ('armN', 'tip', 3, 0))), J[4][1])
    hc = A.UPPER['h_crouchidle'][0][0]
    C = [((dict(hc) if k == len(S) - 1 else EH.crouched(p)), t) for k, (p, t) in enumerate(S)]
    return S, J, C


# ------------------------------------------------------------------------------- apply
_H = None


def apply(H):
    """Install the attacks: the parts, the pose sets (and their crouch, heavy and Helium Head
    derivations), the strip builders of the shared module (this process only)."""
    global _H
    _H = H
    S = importlib.import_module(H.__name__ + '.strips')
    importlib.import_module(H.__name__ + '.frames')
    P.FX.update(FX)
    U = A.UPPER
    U['slash'] = slash_set()
    U['stab'] = stab_set()
    U['grenade'] = grenade_set()
    ci = U['crouchidle'][0][0]
    U['crouchslash'] = EH.crouch_set(U['slash'], ci)
    U['crouchgrenade'] = [(TE._pitems(p), t) for p, t in EH.crouch_set(U['grenade'], ci)]
    hc = U['h_crouchidle'][0][0]
    U['h_slash'], U['h_stab'], U['h_crouchslash'] = heavy_melee()
    # the heavy gun has no far pistol in the belt: the far hand comes back up to the fore-grip
    hg = list(U['grenade'])
    hg[7] = (dict(hg[7][0], armF=hand((5, 4), 'fist', 'fist', z=3)), hg[7][1])
    hg[8] = (dict(hg[8][0], armF=hand((7, 1), 'fist', 'fist')), hg[8][1])
    U['h_grenade'] = EH.heavy_swap(hg)
    U['h_crouchgrenade'] = EH.heavy_swap(hg, crouch=True, ready=hc)
    # the balloon-head twins: from these poses (a stale he_ copy of the old sets would win)
    for k in ('slash', 'stab', 'grenade', 'crouchslash', 'crouchgrenade', 'h_grenade', 'h_crouchgrenade',
              'shoot', 'shootup', 'shootdown', 'shootdiagup', 'crouchshoot', 'h_slash', 'h_stab', 'h_crouchslash'):
        U.pop('he_' + k, None)
    old_knife, old_stab = S.knife, S.stab
    S.shoot = shoot
    # the heavy gun's butt stroke and stock jab (6 keys, thom_ext.heavy_melee) keep the shared
    # timing; the pistol sets (7 keys) use THOM's
    S.knife = lambda seq: knife(seq) if len(seq) == 7 else old_knife(seq)
    S.stab = lambda seq: stab(seq) if len(seq) == 7 else old_stab(seq)
    S.throw = throw
    S.THROW_AT = 5
