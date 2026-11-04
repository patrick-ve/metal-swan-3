# The bust rig of the portrait kit (docs/design/select40.md, the portrait contract): one hero = one
# Hero (palette ramps, head parameters, the drawing hooks of his hair, face and costume); one frame
# = one pose dict q rendered on a 64 x 120 canvas, resolved twice from the same canvas: the colour
# state (select, select-pick) and the grey state (select-grey: the same pixels through the cold
# low-key grey ramp, lit only by a faint rim and the eye whites). The face, the light and the framing
# are the same in every strip: grey -> colour -> pick reads as one photo coming alive.
from . import core as C
from . import head as HD
from . import parts as P

# The cold steel-grey ramp of the unlit state (dark -> light). The booth's backdrop uses its lower
# steps in both states (one set of colours for both, inside the 64-colour budget).
GREY = ['#07080b', '#0d1015', '#141920', '#1c232c', '#262f3a', '#33404c', '#4d5c69', '#76858f', '#b3bec5']
BG = GREY[1:6]

# Shared colours: the outline (warm near-black), the glint white, the sweat body (cold light blue).
OUTLINE = '#120a0b'
GLINT = '#fdfcf6'
SWEAT = '#a8d4e6'


class Hero:
    """A hero of the select screen.

    ramps: name -> [hex dark -> light] (must hold skin, hair, white, iris, red, teeth, mouth, lip,
    stub and the costume ramps the hooks use); p: the head parameters (head.Head); hooks (all
    optional, each fn(cv, hd, q, hero)): bust (costume, drawn first), collar (over the neck), face (folds, wrinkles: after
    the skin), beard (stubble region etc.), hair (after the face), extra (gags, last);
    eyes / brows / nose / mouth: the parts' parameters; neck: (top, bottom, half width)."""

    def __init__(self, name, ramps, p, eyes, brows, nose, mouth, neck, hooks, rest=None, dith=None):
        self.name = name
        self.p = p
        self.eyes, self.brows, self.nose, self.mouth = eyes, brows, nose, mouth
        self.neck = neck
        self.hooks = hooks
        self.rest = rest or {}
        self.dith = dith or {}
        self.pal = C.Pal(OUTLINE, GLINT)
        self.pal.fixed('S', SWEAT)
        self.pal.ramp('grey', GREY)
        self.pal.ramp('bg', BG)
        for k, v in ramps.items():
            self.pal.ramp(k, v)
        if 'brow' not in ramps:
            self.pal.alias('brow', self.pal['hair'])

    def pose(self, **q):
        """A pose: the hero's rest pose with q's keys over it."""
        out = dict(self.rest)
        out.update(q)
        return out

    def canvas(self, q):
        """Draw one pose. Returns the canvas (material, value, group, fixed letters, rim per pixel)."""
        cv = C.Canvas()
        hd = HD.Head(self.p, q)
        hk = self.hooks
        P.backdrop(cv, **self.rest.get('backdrop', {}))
        if 'bust' in hk:
            hk['bust'](cv, hd, q, self)
        top, bottom, hw = self.neck
        HD.neck(cv, hd, top + hd.dy, bottom, hw)
        if 'collar' in hk:
            hk['collar'](cv, hd, q, self)
        HD.ears(cv, hd, **self.rest.get('ears', {}))
        HD.skin(cv, hd, sheen=self.rest.get('sheen', 0.45))
        if 'face' in hk:
            hk['face'](cv, hd, q, self)
        if 'beard' in hk:
            hk['beard'](cv, hd, q, self)
        mats = {'white': 'white', 'iris': 'iris', 'red': 'red'}
        for s in (-1, 1):
            P.eye(cv, hd, s, self.eyes, q, mats)
        P.nose(cv, hd, self.nose)
        P.mouth(cv, hd, self.mouth, q, {'teeth': 'teeth', 'mouth': 'mouth', 'lip': 'lip'})
        if 'whiskers' in hk:
            hk['whiskers'](cv, hd, q, self)
        for s in (-1, 1):
            P.brow(cv, hd, s, self.brows, q)
        if 'hair' in hk:
            hk['hair'](cv, hd, q, self)
        for sw in q.get('sweat', ()):
            kind = sw[0]
            if kind == 'bead':
                P.bead(cv, hd, sw[1], sw[2], sw[3] if len(sw) > 3 else 1)
            elif kind == 'run':
                P.run(cv, hd, sw[1], sw[2], sw[3])
        HD.jaw_shadow(cv, hd, depth=0.3)
        figure = ('skin', 'ear', 'neck', 'hair', 'brow', 'body', 'shirt', 'cloth', 'cape', 'cap', 'eyew', 'eyei', 'teeth', 'lip')
        C.outline(cv, figure, back=('bg',))
        if 'extra' in hk:
            hk['extra'](cv, hd, q, self)
        for d in q.get('drops', ()):
            P.drop(cv, d[0], d[1])
        C.frame_border(cv)           # the photo's print edge: the window's 1 px inner shadow line
        return cv

    def colour(self, cv):
        return cv.resolve(self.pal, self.dith)

    def grey(self, cv, rows, curve=1.0, gain=1.14, rim=0.6, whites=0.82):
        """The unlit state from the same canvas: each pixel's colour brightness through a low-key
        curve onto the grey ramp (with the same dither seam), the rim and the eye whites kept: the
        glints stay white, the eye whites reach the top steps, and the figure's darkest masses (hair,
        cap, beard) stay one step above the booth's darkest tone so the silhouette reads."""
        gr = self.pal['grey']
        out = []
        for y, r in enumerate(rows):
            line = []
            for x, ch in enumerate(r):
                i = y * cv.w + x
                if ch in ('.', 'K'):
                    line.append(ch)
                    continue
                g = cv.g[i]
                if g == 'bg':
                    line.append(gr[max(0, gr.index(ch) - 1)] if ch in gr else ch)
                    continue
                if ch == 'W':
                    line.append(gr[-1] if g in ('eyeg', 'fx', 'sweat') else gr[-2])
                    continue
                L = C.luma(self.pal.hex[ch])
                v = gain * L ** curve
                if cv.r[i] > 0.45:
                    v += rim * (cv.r[i] - 0.45)
                if g == 'eyew':
                    v = max(v, whites * (0.6 + 0.4 * cv.v[i]))
                v = max(v, 0.16)
                out_ch = C.quant(gr, C.clamp(v), x, y, 0.16)
                line.append(out_ch)
            out.append(''.join(line))
        return out

    def frame(self, q, state='colour'):
        cv = self.canvas(q)
        rows = self.colour(cv)
        if state == 'grey':
            rows = self.grey(cv, rows)
        return rows

    def colours(self):
        return self.pal.colours()


# ------------------------------------------------------------------------------------------ timing

# The portrait contract (fixed by the lead): select-grey 1 frame (or a 2-frame slow breath, loop);
# select 6-12 frames, about 2-4 s a cycle (120-240 ticks); select-pick 8-14 frames, 24-40 ticks,
# played once, held on its last pose.
LOOP_FRAMES = (6, 12)
LOOP_TICKS = (120, 240)
PICK_FRAMES = (8, 14)
PICK_TICKS = (24, 40)


def timeline(keys):
    """[(pose, ticks), ...] -> (poses, durations)."""
    return [k[0] for k in keys], [int(k[1]) for k in keys]


def check_loop(durs):
    n, t = len(durs), sum(durs)
    if not (LOOP_FRAMES[0] <= n <= LOOP_FRAMES[1]) or not (LOOP_TICKS[0] <= t <= LOOP_TICKS[1]):
        raise ValueError(f'select loop: {n} frames, {t} ticks (contract: 6-12 frames, 120-240 ticks)')


def check_pick(durs):
    n, t = len(durs), sum(durs)
    if not (PICK_FRAMES[0] <= n <= PICK_FRAMES[1]) or not (PICK_TICKS[0] <= t <= PICK_TICKS[1]):
        raise ValueError(f'select pick: {n} frames, {t} ticks (contract: 8-14 frames, 24-40 ticks)')


def loop_poses(p, sweat, run_u, run_v, dart=-1.6, twitch=None, base=None):
    """The usual select loop (9 frames, about 2.6 s): the key pose, a breath, a blink, an eye dart
    while a sweat drop runs from (run_u, run_v), a nervous twitch, the drop gone, the breath out.
    sweat: the beads of the key pose (the first one is the one that runs); twitch: the pose keys of
    the twitch frame; base: keys of every frame."""
    b = dict(base or {})
    rest = list(sweat[1:])
    tw = dict(twitch or {'smile_add': 0.25, 'asym': 0.35})

    def q(**k):
        d = dict(b)
        d.update(k)
        return p(**d)
    return [
        (q(sweat=sweat), 44),
        (q(sweat=sweat, dy=-1), 16),
        (q(sweat=sweat, dy=-1, blink=0.5), 3),
        (q(sweat=sweat, dy=-1, blink=1.0), 4),
        (q(sweat=sweat, blink=0.4), 3),
        (q(sweat=rest + [('run', run_u, run_v, run_v + 4)], look=(dart, 0.2)), 26),
        (q(sweat=rest + [('run', run_u - 0.2, run_v, run_v + 8)], look=(dart, 0.2), **tw), 10),
        (q(sweat=rest + [('run', run_u - 0.4, run_v, run_v + 11)]), 22),
        (q(sweat=rest + [('bead', run_u, run_v + 0.5, 1)]), 20),
    ]


def make(s, hero, grey, loop, pick):
    """Add the three strips of the contract to the set s: grey = [pose] (1 or 2 frames), loop and
    pick = [(pose, ticks)]. Frames are full 64 x 120 windows with a top-left anchor (root 0, 0)."""
    gp = [g[0] if isinstance(g, tuple) else g for g in grey]
    gd = [g[1] if isinstance(g, tuple) else 60 for g in grey]
    if len(gp) not in (1, 2):
        raise ValueError('select-grey: 1 frame or a 2-frame breath')
    lp, ld = timeline(loop)
    pp, pd = timeline(pick)
    check_loop(ld)
    check_pick(pd)
    fr = lambda rows: (rows, (0, 0))  # noqa: E731
    s.strip('select-grey', [fr(hero.frame(q, 'grey')) for q in gp], gd, loop=True, cls='ui',
            why='the unlit portrait: a still (or a slow 2-frame breath) the panel shows behind the shutter')
    s.strip('select', [fr(hero.frame(q)) for q in lp], ld, loop=True, cls='idle-fidget')
    s.strip('select-pick', [fr(hero.frame(q)) for q in pp], pd, loop=False, cls='reaction')
    s.event('SELECT_PICK_TICKS', sum(pd))
