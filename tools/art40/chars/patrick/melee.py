# PATRICK's keyboard melee at 40 px (plan docs/design/ams40.md wave 2, the user's pilot review:
# "every attack in the scope clearly improves"). The hit happens at tick 0 of the action
# (player.ts knife(): the melee gun fires at once), so the wind-up is short and the board lands at
# tick 4; the rest of the 14 ticks (knifeTicks) is the impact hold, the bounce, the keycaps flying
# and the settle back to the guard (the idle torso's two-hand grip: no pop when the strip ends).
#
# The builders take the spike's own pose lists (anims.UPPER 'slash', 'crouchslash', 'h_slash',
# 'h_crouchslash' with 7 poses; 'stab', 'h_stab' with 6; the Helium Head twins 'he_*'), so the near
# arm (pistol low, heavy gun at the hip), the crouch lean and the balloon head stay each variant's
# own. They replace _hero/strips.knife and .stab in this process only (build() patches them).
import importlib

import art40 as X
import parts as P

from . import badge as B

F = importlib.import_module(X.char('_hero').__name__ + '.frames')

KNIFE_TICKS = 14


def _arm(p, key, **kw):
    q = dict(p)
    a = dict(q[key])
    a.update(kw)
    q[key] = a
    return q


def _hand(p):
    return p['armF']['hand']


def _tor(p, dx, dy):
    t = p.get('tor', (0, 0))
    return dict(p, tor=(t[0] + dx, t[1] + dy))


def _hd(p, dx, dy):
    h = p.get('hd', (0, 0))
    return dict(p, hd=(h[0] + dx, h[1] + dy))


def _fx(p, fx):
    q = dict(p)
    q.pop('fx', None)
    if fx:
        q['fx'] = list(fx)
    return q


def _fx_of(p, name):
    return [f for f in p.get('fx', []) if f[0] == name]


def _badge(p, suf):
    return dict(p, torso=B.swing(p.get('torso', 'up'), suf))


def slash(seq):
    """The overhead keyboard smash (14 ticks, 9 drawings): the board cocked behind the head with the
    body sunk 1 px (anticipation), up and over the top behind the head, the smear with the swing
    trail, the IMPACT (squash, bonk star, keycaps off) held 3 ticks, the bounce of the board, the
    follow-through with the caps flying up, the board lowered, the guard."""
    s = [p for p, _ in seq]
    ready, cock, swing, hit, follow, low, guard = s
    head_hit = hit.get('head', 'shout')
    # 0: cocked, sunk (the knees give: the torso drops 1 px, the head 1 more)
    f0 = _tor(cock, 0, 1)
    # 1: up and over the top: the board straight up behind the head (z behind), the body rising
    cx, cy = _hand(cock)
    sx, sy = _hand(swing)
    top = (round(cx + (sx - cx) * 0.35, 1), min(cy, sy) - 1.5)
    f1 = _arm(_fx(dict(cock, head=head_hit), None),
              'armF', hand=top, end=('hand', 'kbup'), bend=1, z=4.5)
    # 2: the swing smear (the spike's swing with its trail)
    f2 = swing
    # 3: IMPACT: the squash (torso 1 px down, head 1 px down and forward), the bonk and the caps
    f3 = _hd(_tor(hit, 0, 1), 1, 0)
    # 4: the bounce: the board kicks back up 1 px off the target, the trail dies, more caps
    hx, hy = _hand(hit)
    f4 = _fx(_arm(_tor(hit, 0, 1), 'armF', hand=(hx, hy - 1.5)),
             _fx_of(follow, 'kslash3') + [('caps1', ('armF', 'tip', -1, -7))])
    # 5: follow-through: the body comes up, the caps fly higher
    f5 = follow
    # 6: the board lowered, the last caps at the top of their arc
    f6 = low
    # 7: the board goes back under the arm (an in-between to the guard, keyboard still in hand)
    f7 = _fx(F.mix(low, guard, 0.5, keep='a'), None)
    # the lanyard badge: flung out at the impact, back in the bounce, hanging low as he rises
    f3, f4, f5 = _badge(f3, 'bf'), _badge(f4, 'bf'), _badge(f5, 'bd')
    return [(f0, 3), (f1, 1, 'smear'), (f2, 1, 'smear'), (f3, 3), (f4, 1), (f5, 2), (f6, 1), (f7, 1), (guard, 1)]


def stab(seq):
    """The second variant (knife-b, 14 ticks, 7 drawings): the board pulled back to the hip with the
    body leaning away (anticipation), the lunge end-first with speed lines, the IMPACT held (the
    arm over-reaches 1 px, bonk, a key pops off), the recoil (the board knocked back), the pull-out,
    an in-between, the guard."""
    s = [p for p, _ in seq]
    back, lunge, hit, hold, out, guard = s
    f0 = _hd(_tor(back, -1, 0), -1, 0)
    f1 = _fx(lunge, [('kjab', ('armF', 'tip', -6, 0))])
    hx, hy = _hand(hit)
    f2 = _fx(_hd(_arm(_tor(hit, 1, 0), 'armF', hand=(hx + 1, hy)), 1, 0),
             [('bonk', ('armF', 'tip', 2, 0)), ('kjab', ('armF', 'tip', -7, 0)), ('caps0', ('armF', 'tip', -2, -6))])
    f3 = _fx(_arm(hold, 'armF', hand=(hx - 1.5, hy + 0.5)), [('caps1', ('armF', 'tip', -3, -9))])
    f4 = _fx(out, [('caps2', ('armF', 'tip', -4, -12))])
    f5 = _fx(F.mix(out, guard, 0.5, keep='a'), None)
    f2, f3 = _badge(f2, 'bf'), _badge(f3, 'bu')
    return [(f0, 2), (f1, 1), (f2, 3), (f3, 2), (f4, 2), (f5, 2, 'ib'), (guard, 2)]


# speed lines behind the board's end on the jab: light streaks, brightest at the board
KJAB = (["mmii..", "...iiI", "mmiiII", "...iiI", "mmii.."], (6, 2))


# the frame index of the impact in each builder: its hold never shrinks (fit lock)
SLASH_HIT = 3
STAB_HIT = 2


def lock(T):
    """The strip table with the impact holds locked (the fit takes ticks from the others)."""
    for name, (kind, steps, opts) in list(T.items()):
        if kind != 'torso' or 'knife' not in name:
            continue
        hit = STAB_HIT if name.endswith('knife-b') else SLASH_HIT
        T[name] = (kind, steps, dict(opts, lock=(hit,)))
    return T


# flying keycaps (replace the spike's 2 x 2 caps, which the orphan pass reduced to grey specks):
# 3 x 2 caps, a light top with a white glint and a dark key face, one blue (the lanyard key); they
# burst off the board at the impact, tumble up and spread, then start to fall.
CAPS = {
    'caps0': ([
        "....WGG......",
        "....nnn...WGG",
        "..........nnn",
        "WGG..........",
        "nnn....IRR...",
        ".......rrr...",
    ], (6, 5)),
    'caps1': ([
        ".......GW.......",
        ".......nG.......",
        ".......nn.....WG",
        "WGG...........nG",
        "nnn...........nn",
        "...........IRR..",
        "...........rrr..",
    ], (8, 6)),
    'caps2': ([
        ".........GG......",
        "GG.......nn....GG",
        "nn.............nn",
        ".................",
        "..............RR.",
        "..............rr.",
    ], (8, 4)),
}


def install(S):
    P.FX['kjab'] = KJAB
    P.FX.update(CAPS)
    S.knife = slash
    S.stab = stab
    table = S.table
    S.table = lambda: lock(table())
