# PATRICK's own pose edits on the shared hero strips (stage 2). His black sleeve reads as a dark
# beard where it crosses his face (heroes/patrick_ext.py), so the salute keeps the forearm in front
# of the jaw, below the eye, and only the flat hand reaches the brow.
import importlib

import anims as A
import art40 as X
import ext_moves as EM

from . import badge as B

F = importlib.import_module(X.char('_hero').__name__ + '.frames')

hand = A.hand


def salute():
    """The salute (68 ticks, once, the last frame holds): at ease, the elbow swings out and up, the
    hand snaps to the brow with the chest out, a small overshoot, settles, the proud hold."""
    st = ((0, -17), (-5, -4), (5, -4))
    far = hand((0, 9), 'fist', 'fist')

    def f(near, head='fwd', tor=(0, 0), hd=(0, 0)):
        return EM.fp(*st, 'flat', 'flat', torso='up', head=head, tor=tor, hd=hd, armN=near, armF=far)
    up = lambda h, sh=(2, 0): hand(h, 'open', 'hand', bend=-1, sh=sh)
    return [
        (f(hand((2, 9), 'fist', 'fist')), 4),
        (f(up((10, -2))), 3),
        (f(up((10, -10.5), (3, -1)), tor=(0, -1)), 2),
        (f(up((9, -13), (2.5, -1)), tor=(0, -1), hd=(0, -1)), 3),
        (f(up((9, -12.5), (2.5, -1))), 4),
        (f(up((9, -12.5), (2.5, -1)), head='smug'), 52),
    ]


def _swing_steps(steps, states):
    out = []
    for st, suf in zip(steps, states):
        p = st[0]
        q = dict(p, torso=B.swing(p.get('torso', 'up'), suf))
        out.append((q,) + tuple(st[1:]))
    return out


def gear(T):
    """The lanyard badge's lag on the run (both guns) and the victory hops."""
    hips = []
    for p, _ in T['legs-run'][1]:
        f = F.legs(p)
        hips.append(f.pts['hip'][1] - f.root[1])
    states = B.lag(hips)
    for name in ('torso-pistol-run', 'torso-heavy-run'):
        kind, steps, opts = T[name]
        T[name] = (kind, _swing_steps(steps, states), opts)
    for name in ('victory', 'helium-victory', 'helium-wob-victory'):
        kind, steps, opts = T[name]
        ys = [p['pelvis'][1] + p.get('tor', (0, 0))[1] for p, _ in steps]
        T[name] = (kind, _swing_steps(steps, B.lag(ys)), opts)
    return T


def install(S, M):
    M.salute = salute
    B.install()
    table = S.table
    S.table = lambda: gear(table())
