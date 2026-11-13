# The strips every rat set shares (the stand-in's strip contract, src/game/content/sewers/rats/
# art.ts + base.ts / runner.ts / leaper.ts / spitter.ts / brute.ts):
#
#   idle 4         looped by the game (sprite timing): breathing, the nose sniffs, the tail sways
#   run 12         looping(3) in runner.ts: two bounds of the scurry gallop (frame count free)
#   recover 12     looping(3): the same scurry (the rat runs on past the hero)
#   tell 6         the runner's bite tell (18 ticks, sprite timing, held on the last frame): it rears
#                  up and squeaks; the white eye flash is the game's `eyes` frame 1 at `eye`
#   bite 2         once(0, 4) over the 8-tick lunge: the jaws wide, then the snap
#   fall 2         falling (the drop entry, off a hole): splayed, the tail whipping
#   rise 6         out of a hole (24 ticks = RAT.rise: 6 x 4): nose, head, paws on the rim, out
#   gloat 6        the in-world continue: it sits up and washes its face (smug, eyes shut)
#   cower 4        flat, ears back, eyes shut, trembling
#   die 10         20 ticks (the stand-in's 4 x 5): a squeak, it rolls onto its back, a bounce, the
#                  legs kick up, a green slime splat and a puff; held as the corpse
#   die-blast 10   20 ticks: thrown spinning, onto its back
#   die-crush 5    16 ticks: flattened
#   eyes 2         the eyes-only pair (centre anchor): frame 0 red, frame 1 the white tell flash
#                  (bigger than the stand-in: a star on each eye, readable at 1x in the dark)
#
# Every frame (not `eyes`) carries the point `eye` (base.ts drawEyes, eyes-emit.ts).
import math

import art40 as X

from . import ratrig as R


def frame(L, smear=False, **kw):
    rows, root, pts, joints = R.draw(L, R.pose(**kw))
    return X.Frame(rows, root, pts=pts, smear=smear, joints=joints)


def wave(base, amp, ph, k=0.18):
    return [b + amp * math.sin(2 * math.pi * (ph + i * k)) for i, b in enumerate(base)]


# ------------------------------------------------------------------------------------- gaits
# A bound of the scurry gallop in 6 phases (offsets at the runner's size; `sc` scales them).
GALLOP = [
    # stretch, arch, lift, hind (dx, dy), fore (dx, dy), head
    (2.5, -0.8, 1.0, (-5.5, -1.2), (5.0, -1.6), -2),     # extended flight
    (1.6, -0.3, 0.4, (-4.0, -1.8), (3.8, 0.0), -5),      # the fore paws land
    (-0.2, 1.4, 0.0, (-0.5, -2.6), (0.2, 0.0), -6),      # fore stance, the hind legs swing in
    (-1.8, 2.4, -0.3, (3.6, 0.0), (-3.6, -0.6), -4),     # gathered: the hind feet land under the chest
    (-0.4, 1.2, 0.2, (0.4, 0.0), (0.8, -2.2), -1),       # hind stance, the fore paws reach
    (1.2, -0.2, 0.7, (-3.8, -0.4), (3.6, -2.0), 0),      # the push-off
]


def gallop(L, i, n_frames=12, sc=1.0, extra=None, mouth=0, eye='open', head0=0.0, ear0=0.0):
    st, ar, li, h, f, hd = GALLOP[i % 6]
    t = i / n_frames
    far_h = GALLOP[(i + 5) % 6][3]
    far_f = GALLOP[(i + 5) % 6][4]
    kw = dict(stretch=st * sc, arch=ar * sc, lift=li * sc,
              hn=(h[0] * sc, h[1] * sc), hf=(far_h[0] * sc, far_h[1] * sc),
              fn=(f[0] * sc, f[1] * sc), ff=(far_f[0] * sc, far_f[1] * sc),
              hnup=-25 if h[1] < -0.5 else 0, fnup=-30 if f[1] < -0.5 else 0,
              head=hd + head0 + 2 * math.sin(2 * math.pi * t * 2),
              tail=wave(L.tail_bend, 7, t), tailroot=6 * math.sin(2 * math.pi * (t * 2 + 0.25)),
              ear=-14 + ear0 + 4 * math.sin(2 * math.pi * t * 2), mouth=mouth, eye=eye)
    if extra:
        kw.update(extra)
    return kw


def run_frames(L, sc=1.0, **o):
    return [frame(L, **gallop(L, i, sc=sc, **o)) for i in range(12)]


# ------------------------------------------------------------------------------------- strips
def idle(L, sc=1.0, extra=None):
    out = []
    for k, (pf, hd, tl, ear) in enumerate([(0.0, 0, 0.0, 0), (0.3, 4, 0.25, -4), (0.5, 7, 0.5, -2), (0.3, 2, 0.75, 2)]):
        kw = dict(puff=pf * sc, head=hd, tail=wave(L.tail_bend, 4, tl), ear=ear, hy=-0.3 * (hd > 3))
        kw.update(extra or {})
        out.append(frame(L, **kw))
    return out


def tell(L, sc=1.0):
    P = []
    P.append(dict(crouch=1.0 * sc, head=-8, ear=-10, eye='squint'))
    P.append(dict(rear=22, crouch=0.5 * sc, head=-6, mouth=1, eye='wide', fn=(-0.5 * sc, -1.5 * sc), ff=(-1.0 * sc, -1.0 * sc), fnup=-30, tailroot=8))
    P.append(dict(rear=44, head=-14, mouth=2, eye='wide', ear=-6, fn=(-1.5 * sc, -2.2 * sc), ff=(-2.0 * sc, -1.6 * sc), fnup=-50, tailroot=14))
    P.append(dict(rear=50, head=-10, mouth=2, eye='wide', ear=-8, fn=(-1.0 * sc, -2.8 * sc), ff=(-2.2 * sc, -2.0 * sc), fnup=-60, tailroot=16, tail=wave(L.tail_bend, 6, 0.2)))
    P.append(dict(rear=48, head=-6, mouth=2, eye='wide', ear=-12, fn=(-1.6 * sc, -2.2 * sc), ff=(-1.6 * sc, -2.6 * sc), fnup=-50, tailroot=12, tail=wave(L.tail_bend, 6, 0.45)))
    P.append(dict(rear=50, head=-10, mouth=1, eye='wide', ear=-8, fn=(-1.0 * sc, -2.8 * sc), ff=(-2.2 * sc, -2.0 * sc), fnup=-60, tailroot=16, tail=wave(L.tail_bend, 6, 0.7)))
    return [frame(L, **p) for p in P]


def bite(L, sc=1.0):
    return [
        frame(L, smear=True, stretch=4.5 * sc, crouch=1.0 * sc, head=-10, mouth=2, eye='squint', ear=-24,
              hn=(-3.0 * sc, 0), hf=(-3.5 * sc, -0.4 * sc), fn=(4.0 * sc, -1.6 * sc), ff=(3.0 * sc, -1.0 * sc), fnup=-30, tailroot=-6),
        frame(L, stretch=5.0 * sc, crouch=1.4 * sc, head=-6, mouth=0, eye='squint', ear=-20,
              hn=(-3.5 * sc, 0), hf=(-4.0 * sc, 0), fn=(5.0 * sc, 0), ff=(4.0 * sc, 0), tailroot=-2),
    ]


def fall(L, sc=1.0):
    out = []
    for k in range(2):
        s = 1 if k == 0 else -1
        out.append(frame(L, lift=1.0 * sc, mouth=1 + k % 2, eye='wide', ear=8 * s, head=10,
                         hn=(-2.5 * sc, -2.8 * sc), hf=(-1.0 * sc, -2.0 * sc), fn=(2.5 * sc, -3.0 * sc), ff=(1.5 * sc, -2.2 * sc),
                         hnup=-40, fnup=40, tailroot=30 + 10 * s, tail=wave(L.tail_bend, 14, 0.25 * k)))
    return out


def rise(L, sc=1.0, height=16):
    out = []
    shifts = [0.66, 0.5, 0.35, 0.2, 0.08, 0.0]
    tilts = [t / sc for t in (34, 28, 20, 12, 5, 0)]
    for k, f in enumerate(shifts):
        sh = round(height * f)
        kw = dict(off=(0.0, sh), rot=tilts[k], hole=(L.RY - 1, L.hole_w), mouth=1 if k in (2, 3) else 0,
                  head=12 - k * 3, eye='open' if k > 0 else 'wide', ear=-6 + 2 * k)
        if k in (0, 1, 2, 3):
            kw.update(fn=(1.0 * sc, -(sh - 1)), ff=(0.0, -(sh - 1)), fnup=-20)
        if k == 4:
            kw.update(hn=(1.0 * sc, -1.5 * sc), hnup=-20, arch=1.0 * sc)
        out.append(frame(L, **kw))
    return out


def gloat(L, sc=1.0):
    base = dict(rear=58, crouch=2.0 * sc, eye='happy', ear=4, tailroot=-4)
    P = [
        dict(head=-40, fn=(-2.5 * sc, -1.0 * sc), ff=(-3 * sc, -0.5 * sc)),
        dict(head=-52, paws=None, fn=(1.0 * sc, -4.5 * sc), ff=(0.5 * sc, -4.0 * sc), fnup=-70, mouth=1),
        dict(head=-58, fn=(1.5 * sc, -3.0 * sc), ff=(1.0 * sc, -2.5 * sc), fnup=-60),
        dict(head=-48, fn=(0.8 * sc, -5.2 * sc), ff=(0.2 * sc, -4.8 * sc), fnup=-80),
        dict(head=-56, fn=(1.6 * sc, -4.0 * sc), ff=(1.0 * sc, -3.5 * sc), fnup=-60, mouth=1, tongue=True),
        dict(head=-34, fn=(-2.0 * sc, -1.6 * sc), ff=(-2.6 * sc, -1.0 * sc), tail=wave(L.tail_bend, 6, 0.3)),
    ]
    out = []
    for p in P:
        kw = dict(base)
        kw.update(p)
        kw.pop('paws', None)
        out.append(frame(L, **kw))
    return out


def cower(L, sc=1.0):
    out = []
    for k in range(4):
        s = -1 if k % 2 else 1
        out.append(frame(L, crouch=2.2 * sc + 0.3 * (k % 2), stretch=-1.0 * sc, head=-14, eye='shut', ear=-70,
                         off=(0.5 * s, 0.0), puff=-0.3 * sc * (k % 2), tailroot=-10,
                         tail=[b - 14 for b in L.tail_bend], hn=(1.0 * sc, 0), fn=(-1.0 * sc, 0)))
    return out


def cloud(cx, cy, r, k=0):
    """A small cartoon puff (FX ramp cells): a cream core, a grey ring, a dark base; k > 0 fades."""
    out = []
    ri = int(round(r))
    for dy in range(-ri, ri + 1):
        for dx in range(-ri - 1, ri + 2):
            d = (dx / (r + 0.6)) ** 2 + (dy / max(0.8, r * 0.8)) ** 2
            if d > 1.0:
                continue
            if k >= 2 and (dx + dy) % 2:
                continue                                  # the last puff breaks up
            ch = 'X' if d < 0.25 and k == 0 else ('I' if dy <= 0 else 'J')
            out.append((cx + dx, cy + dy, ch))
    return out


def puff_cells(sc, k):
    """The death puff over the corpse: three little clouds that grow and fade (frames 0..2)."""
    g = 1 + 0.3 * k
    out = []
    for (x, y, r) in ((-6, -14, 1.8), (4, -16, 2.0), (-1, -20, 1.5)):
        out += cloud(round(x * sc * g), round((y - 2 * k) * min(sc, 1.6)), r * sc ** 0.5 * (1 + 0.2 * k), k)
    return out


def dead(L, sc, k, legs=0.0, slime=0, puffs=()):
    """On its back: roll 180, legs up (offsets wiggle by `legs`), X eyes, the tongue out."""
    legs = legs / sc * min(sc, 1.4)
    return dict(roll=180, off=(0.0, L.back_off), eye='x', mouth=1, tongue=True, ear=10, head=-4, bellyv=0.05,
                hn=(1.5 * sc + legs, 1.2 * sc), hf=(-1.0 * sc - legs, 1.6 * sc), fn=(-2.0 * sc - legs, 1.4 * sc), ff=(1.0 * sc + legs, 1.8 * sc),
                hnup=30, fnup=-30, slime=slime, puffs=puffs, tail=wave(L.tail_bend, 8 / L.sc, 0.1 * k), tailroot=-10)


def die(L, sc=1.0):
    sw = L.slime_w
    sc = min(sc, 1.4)                     # the big rat moves its lifts no further (the smoothness gate)
    P = [
        dict(head=18, mouth=2, eye='shut', stretch=-1.0 * sc, lift=1.0 * sc, ear=-30, tailroot=20),
        dict(head=20, mouth=2, eye='x', lift=4.0 * sc, roll=60, rot=8, hn=(-1.5 * sc, -2 * sc), fn=(2 * sc, -2.5 * sc), tailroot=30),
        dict(head=12, mouth=2, eye='x', lift=6.0 * sc, roll=125, rot=4, hn=(-1.0 * sc, -2 * sc), fn=(1.5 * sc, -2.5 * sc), tailroot=24),
    ]
    out = [frame(L, **p) for p in P]
    out[1].smear = out[2].smear = True
    d = [dead(L, sc, 3, legs=0.6 * sc), dead(L, sc, 4, legs=0.0), dead(L, sc, 5, legs=1.0 * sc), dead(L, sc, 6, legs=-0.5 * sc, slime=sw // 2),
         dead(L, sc, 7, legs=0.8 * sc, slime=sw, puffs=puff_cells(sc, 0)), dead(L, sc, 8, legs=-0.4 * sc, slime=sw, puffs=puff_cells(sc, 1)),
         dead(L, sc, 9, legs=0.2 * sc, slime=sw, puffs=puff_cells(sc, 2))]
    d[0].update(off=(0.0, L.back_off - 4.0 * sc), rot=6 / L.sc)
    d[1].update(off=(0.0, L.back_off - 1.0 * sc), sq=(1 + 0.05 / L.sc, 0.95))
    d[2].update(sq=(1 + 0.12 / L.sc, 0.86))
    d[3].update(off=(0.0, L.back_off - 1.0 * sc))
    out += [frame(L, **p) for p in d]
    return out


def die_blast(L, sc=1.0):
    """Thrown (the game launches it in an arc): two spin smears, then on its back in the air,
    kicking, the landing, a bounce, the slime and the puff."""
    sw = L.slime_w
    sc = min(sc, 1.4)
    out = [frame(L, smear=True, rot=110, roll=30, lift=3.0 * sc, eye='x', mouth=2, ear=20,
                 hn=(-2.0 * sc, -2.5 * sc), hf=(-1.0 * sc, -2.0 * sc), fn=(2.0 * sc, -3.0 * sc), ff=(1.0 * sc, -2.0 * sc),
                 tailroot=25, tail=wave(L.tail_bend, 12, 0.2)),
           frame(L, smear=True, rot=250, roll=160, lift=3.0 * sc, eye='x', mouth=2, ear=20,
                 hn=(-2.0 * sc, -2.5 * sc), hf=(-1.0 * sc, -2.0 * sc), fn=(2.0 * sc, -3.0 * sc), ff=(1.0 * sc, -2.0 * sc),
                 tailroot=25, tail=wave(L.tail_bend, 12, 0.5))]
    d = [dead(L, sc, 0, legs=1.0 * sc), dead(L, sc, 1, legs=-0.5 * sc), dead(L, sc, 2, legs=0.8 * sc),
         dead(L, sc, 3, legs=-0.3 * sc), dead(L, sc, 4, legs=0.5 * sc), dead(L, sc, 5, legs=-0.2 * sc, slime=sw // 2),
         dead(L, sc, 6, legs=0.6 * sc, slime=sw, puffs=puff_cells(sc, 0)), dead(L, sc, 7, legs=0.2 * sc, slime=sw, puffs=puff_cells(sc, 2))]
    d[0].update(off=(0.0, L.back_off - 4.0 * sc), rot=-24 / L.sc)
    d[1].update(off=(0.0, L.back_off - 4.0 * sc), rot=-14 / L.sc)
    d[2].update(off=(0.0, L.back_off - 2.5 * sc), rot=-6 / L.sc)
    d[3].update(off=(0.0, L.back_off), sq=(1 + 0.08 / L.sc, 0.9))
    d[4].update(off=(0.0, L.back_off - 1.0 * sc))
    out += [frame(L, **p) for p in d]
    return out


def die_crush(L, sc=1.0):
    P = [
        dict(sq=(1.12, 0.62), eye='x', mouth=2, ear=-40, tailroot=20),
        dict(sq=(1.22, 0.45), eye='x', mouth=1, ear=-60, tailroot=10, slime=L.slime_w // 2),
        dict(sq=(1.26, 0.4), eye='x', mouth=1, tongue=True, ear=-60, tailroot=24, slime=L.slime_w),
        dict(sq=(1.24, 0.42), eye='x', mouth=1, tongue=True, ear=-60, tailroot=8, slime=L.slime_w, puffs=puff_cells(sc, 1)),
        dict(sq=(1.24, 0.42), eye='x', mouth=1, tongue=True, ear=-60, tailroot=0, slime=L.slime_w, puffs=puff_cells(sc, 2)),
    ]
    return [frame(L, **p) for p in P]


def eyes(L):
    """The eyes-only pair (centre anchor at the middle of the pair)."""
    big = getattr(L, 'big_eyes', False)
    if not big:
        red = ['eRE.ERe',
               '.ee.ee.']
        flash = ['...Z.....Z...',
                 '...X.....X...',
                 '..XWX...XWX..',
                 'ZXWWWXZXWWWXZ',
                 '..XWX...XWX..',
                 '...X.....X...',
                 '...Z.....Z...']
    else:
        red = ['.eRE..ERe.',
               'eRRE..ERRe',
               '.ee....ee.']
        flash = ['....Z.......Z....',
                 '....X.......X....',
                 '...XWX.....XWX...',
                 '..XWWWX...XWWWX..',
                 'ZXWWWWWXZXWWWWWXZ',
                 '..XWWWX...XWWWX..',
                 '...XWX.....XWX...',
                 '....X.......X....',
                 '....Z.......Z....']
    out = []
    for rows in (red, flash):
        w, h = len(rows[0]), len(rows)
        out.append(X.Frame(rows, (w // 2, h // 2)))
    return out


# ------------------------------------------------------------------------------------- leaper
def lurk_frame(L, **kw):
    """The head in a pipe mouth / a grate. Anchor (the root) = the mouth centre (the stand-in's
    lurkFrame: the head centred on it)."""
    q = dict(headonly=True, skull_at=(-1.5, -1.0))
    q.update(kw)
    rows, root, pts, joints = R.draw(L, R.pose(**q), W=40, H=32, RX=20, RY=18)
    return X.Frame(rows, root, pts=pts, joints=joints)


def lurk(L):
    """lurk 4 (looped, sprite timing): it sniffs the air, whiskers twitching."""
    P = [dict(head=0), dict(head=6, skull_at=(-1.3, -1.6)), dict(head=10, skull_at=(-1.1, -1.9), ear=-6), dict(head=4, skull_at=(-1.4, -1.3))]
    return [lurk_frame(L, **p) for p in P]


def lurk_tell(L):
    """lurk-tell 4 (looped at 4-5 ticks over the 24-tick tell): the hiss, ears flat, jaws wide."""
    P = [dict(head=4, mouth=2, eye='squint', ear=-50, skull_at=(-2.4, -1.2)),
         dict(head=8, mouth=2, eye='squint', ear=-56, skull_at=(-2.8, -1.6)),
         dict(head=5, mouth=1, eye='squint', ear=-50, skull_at=(-2.2, -1.2)),
         dict(head=10, mouth=2, eye='squint', ear=-58, skull_at=(-2.6, -1.8))]
    return [lurk_frame(L, **p) for p in P]


def jump(L, sc=1.0):
    """jump 6 (held on the last frame, sprite timing, about the 54-61 tick arc): the launch, the
    stretched flight with the jaws open, the paws forward for the landing."""
    base = dict(mouth=2, eye='squint', ear=-30)
    P = [
        dict(rot=24, stretch=3.0, crouch=0.5, hn=(-5.0, 0.0), hf=(-5.5, 0.0), fn=(3.0, -2.5), ff=(2.0, -2.0), fnup=-40, tailroot=-6),
        dict(rot=16, stretch=4.0, lift=1.0, hn=(-6.0, -1.5), hf=(-6.5, -1.0), fn=(5.0, -2.5), ff=(4.0, -2.0), hnup=-30, fnup=-30, tailroot=4),
        dict(rot=4, stretch=4.0, lift=1.0, hn=(-5.5, -2.0), hf=(-5.0, -1.5), fn=(5.5, -2.0), ff=(4.5, -1.5), hnup=-30, fnup=-20, tailroot=14),
        dict(rot=-8, stretch=3.5, lift=1.0, hn=(-4.5, -2.5), hf=(-4.0, -2.0), fn=(6.0, -0.5), ff=(5.0, 0.0), hnup=-20, fnup=10, tailroot=22),
        dict(rot=-16, stretch=3.0, lift=0.5, hn=(-3.5, -2.5), hf=(-3.0, -2.0), fn=(6.0, 0.5), ff=(5.0, 0.8), hnup=-10, fnup=20, tailroot=28),
        dict(rot=-20, stretch=2.5, lift=0.5, hn=(-3.0, -2.0), hf=(-2.5, -1.5), fn=(5.5, 1.0), ff=(4.5, 1.2), fnup=24, tailroot=30, mouth=1),
    ]
    out = []
    for k, pp in enumerate(P):
        kw = dict(base)
        kw.update(pp)
        for key in ('stretch', 'crouch', 'lift'):
            if key in kw:
                kw[key] *= sc
        kw['tail'] = wave(L.tail_bend, 8, 0.15 * k)
        out.append(frame(L, **kw))
    return out


# ------------------------------------------------------------------------------------- spitter
SIT = dict(rear=20, crouch=1.2)


def spit_idle(L):
    out = []
    for k, (pf, hd, ch) in enumerate([(0.0, -16, 0.3), (0.3, -13, 0.5), (0.5, -11, 0.6), (0.3, -14, 0.4)]):
        out.append(frame(L, puff=pf, head=hd, cheek=ch, tail=wave(L.tail_bend, 4, 0.25 * k), ear=-4 + 3 * (k % 2),
                         drool=1 if k == 2 else 0, **SIT))
    return out


def spit_tell(L):
    """tell 3 (once at tele/3 a frame, spitter.ts): the cheeks puff up, the eyes bulge."""
    P = [dict(cheek=1.4, puff=0.6, rear=26, head=-14, eye='wide', ear=-10),
         dict(cheek=2.4, puff=0.9, rear=32, head=-10, eye='wide', ear=-14, drool=1),
         dict(cheek=3.3, puff=1.1, rear=36, head=-6, eye='wide', ear=-18, drool=2)]
    return [frame(L, crouch=1.0, **p) for p in P]


def spit_spit(L):
    """spit 2 (once(0, 7) over the 14-tick spit): the lunge with the slime ball, the recoil."""
    return [frame(L, smear=True, rear=6, crouch=1.4, stretch=1.5, head=-12, mouth=2, eye='squint', ear=-20, blob=2.2, cheek=0.6),
            frame(L, rear=16, crouch=1.0, head=-4, mouth=1, eye='open', ear=-8, drool=2, cheek=0.3)]


def spit_hop(L):
    """hop 6 (36 ticks = SPITTER.hopTicks; the code moves it along the arc): the crouch, the
    launch, the tuck in the air, the paws out, the landing squash."""
    P = [dict(crouch=2.0, head=-10, sq=(1.06, 0.92)),
         dict(rot=18, stretch=2.0, lift=1.0, hn=(-3.0, 0.0), fn=(3.0, -2.5), fnup=-40, head=-4, eye='wide', tailroot=-6),
         dict(rot=8, arch=1.5, lift=1.5, hn=(1.5, -2.0), hf=(1.0, -1.5), fn=(1.0, -2.5), ff=(0.5, -2.0), hnup=-30, head=0, eye='wide', tailroot=10),
         dict(rot=-4, arch=1.0, lift=1.5, hn=(1.0, -2.0), fn=(2.0, -1.0), head=-6, eye='wide', tailroot=16),
         dict(rot=-14, stretch=1.0, lift=0.8, hn=(-1.0, -1.5), fn=(3.5, 0.5), fnup=20, head=-10, tailroot=20),
         dict(crouch=2.2, sq=(1.1, 0.88), head=-12, eye='shut', tailroot=4)]
    return [frame(L, **p) for p in P]


# ------------------------------------------------------------------------------------- brute
def walk_frames(L, sc, A=9.0, n=12, extra=None):
    """A lateral-sequence walk (each foot 0.65 of the cycle on the floor)."""
    out = []
    ph = {'hn': 0.0, 'fn': 0.25, 'hf': 0.5, 'ff': 0.75}
    for i in range(n):
        t = i / n
        kw = {}
        for k, o in ph.items():
            f = (t + o) % 1.0
            if f < 0.65:
                x, y = A * (1 - 2 * f / 0.65), 0.0
            else:
                u = (f - 0.65) / 0.35
                x, y = -A + 2 * A * u, -2.2 * sc * math.sin(math.pi * u)
            kw[k] = (x, y)
            kw[k + 'up'] = -20 if y < -1 else 0
        kw['lift'] = 0.6 * sc * (0.5 + 0.5 * math.cos(4 * math.pi * t))
        kw['head'] = -4 + 3 * math.sin(4 * math.pi * t + 0.6)
        kw['tail'] = wave(L.tail_bend, 5, t)
        kw['ear'] = -6 + 3 * math.sin(2 * math.pi * t)
        kw['mouth'] = 1 if i in (5, 6, 11, 0) else 0
        kw.update(extra or {})
        out.append(frame(L, **kw))
    return out


def brute_tell(L, sc):
    """tell 4 (looping(7), brute.ts): head low, it paws the floor (the game puffs the steam)."""
    P = [dict(fn=(2.5 * sc, -2.0 * sc), fnup=-30), dict(fn=(0.5 * sc, -1.0 * sc), fnup=-10),
         dict(fn=(-2.5 * sc, 0.0)), dict(fn=(0.0, -0.6 * sc))]
    out = []
    for k, pp in enumerate(P):
        out.append(frame(L, crouch=1.0 * sc, stretch=-0.5 * sc, head=-14 + 2 * (k % 2), mouth=1, eye='squint', ear=-40,
                         hn=(-1.0 * sc, 0.0), tail=wave(L.tail_bend, 4, 0.25 * k), tailroot=6, **pp))
    return out


def brute_rear(L, sc):
    """rear 4 (looping(8): the stomp tell): reared up, the fore paws boxing, the roar."""
    out = []
    for k in range(4):
        a = 0.8 * sc * (1 if k % 2 else -1)
        out.append(frame(L, rear=42 + (k % 2) * 3, head=-28, mouth=2, eye='squint', ear=-30,
                         fn=(-1.0 * sc + a, -4.0 * sc - a), ff=(-2.0 * sc - a, -3.0 * sc + a), fnup=-60,
                         hn=(1.0 * sc, 0.0), tailroot=-4, tail=wave(L.tail_bend, 4, 0.25 * k)))
    return out


def brute_stomp(L, sc):
    """stomp 2 (once(0, 8) over the 16-tick stomp): the slam with the shock dust, the settle."""
    dust = cloud(round(-18 * sc), -4, 3.4) + cloud(round(-24 * sc), -3, 2.4) + cloud(round(23 * sc), -4, 3.4) + cloud(round(29 * sc), -3, 2.4)
    dust2 = cloud(round(-22 * sc), -5, 3.8, 1) + cloud(round(28 * sc), -5, 3.8, 1)
    return [frame(L, smear=True, crouch=2.6 * sc, stretch=1.0 * sc, head=-10, mouth=2, eye='squint', ear=-40, fn=(2.0 * sc, 0.0), ff=(1.0 * sc, 0.0),
                  sq=(1.04, 0.94), tailroot=12, puffs=dust),
            frame(L, crouch=1.6 * sc, stretch=0.6 * sc, head=-6, mouth=1, eye='squint', ear=-24, fn=(1.5 * sc, 0.0), ff=(0.8 * sc, 0.0),
                  tailroot=6, puffs=dust2)]


# ------------------------------------------------------------------------------------- the set
def build_rat(s, L, kind, skip=(), runs=None):
    """The strips every rat has (the stand-in's defineRat). A kind adds or replaces its own."""
    sc = L.sc
    if 'idle' not in skip:
        s.strip('idle', idle(L, sc), [12, 10, 12, 10], cls='idle')
    runs = runs or run_frames(L, sc=sc)
    s.strip('run', runs, 3, cls='locomotion')
    s.strip('recover', runs, 3, cls='locomotion')
    if 'tell' not in skip:
        s.strip('tell', tell(L, sc), [4, 4, 3, 3, 2, 2], loop=False, cls='telegraph')
    if 'bite' not in skip:
        s.strip('bite', bite(L, sc), 4, loop=False, cls='melee',
                why='runner.ts plays it once(0, 4) over the 8-tick lunge: 2 frames show')
    s.strip('fall', fall(L, sc), 6, cls='fall')
    s.strip('rise', rise(L, sc, L.rise_h), 4, loop=False, cls='respawn')
    s.strip('gloat', gloat(L, sc), [12, 8, 8, 8, 8, 12], cls='victory')
    s.strip('cower', cower(L, sc), 5, cls='reaction')
    s.strip('die', die(L, sc), [4, 1, 1, 3, 2, 2, 2, 2, 1, 2], loop=False, cls='die')
    s.strip('die-blast', die_blast(L, sc), [1, 1, 3, 3, 2, 2, 2, 2, 2, 2], loop=False, cls='die-blast')
    s.strip('die-crush', die_crush(L, sc), [4, 3, 3, 3, 3], loop=False, cls='die-crush')
    s.strip('eyes', eyes(L), 1, loop=False, cls='roles',
            why='base.ts drawEyes picks the frame: 0 the red eyes in the dark, 1 the white tell flash')
