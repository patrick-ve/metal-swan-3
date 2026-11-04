# MECHA HASLEMA: the chain of office (game id boss/ams-mayor/chain-<stage>, 44 x 30 at (21, 110)) and
# the medallion (boss/ams-mayor/medallion-<stage>, 31 x 31 at (17, 91); frames 0 closed / armoured,
# 1 open core, 2 firing glow). Separate lit gold links, enamel shields, a relief medallion: a beaded
# gold rim, the crimson field with the black pale and three saltires in relief, a crown on top.
import math

from .cv import Layer, polymask, ellmask, sphere_l, pick, line, LX, LY
from .pal import GOLD, CRIM, step  # noqa: F401

# the game's runs (src/game/content/bosses/ams/layout.ts CHAIN_RUNS / CHAIN_SHIELDS / CHAIN_CUT)
RUNS = [
    lambda t: (-18 + 4 * t - 2 * math.sin(math.pi * t), -107 + 23 * t),
    lambda t: (19 - 9 * t + 1.5 * math.sin(math.pi * t), -105 + 21 * t),
]
SHIELDS = [0.4, 0.75]
CUT = (0.3, 0.68)
MED = (-2, -76)            # the medallion's centre at rest
MR = 14.5
ZC, ZM = 9.0, 10.0


def run_points(run, spacing=2.0):
    """Points along a run every `spacing` px of arc length, with the run's direction."""
    pts, acc, last = [], 0.0, run(0.0)
    pts.append((last, 0.0))
    n = 400
    for i in range(1, n + 1):
        p = run(i / n)
        acc += math.hypot(p[0] - last[0], p[1] - last[1])
        last = p
        if acc >= spacing:
            pts.append((p, i / n))
            acc = 0.0
    return pts


RING = [(0, 0, 'g'), (1, 0, 'h'), (2, 0, 'i'), (0, 1, 'h'), (2, 1, 'j'), (0, 2, 'i'), (1, 2, 'j'), (2, 2, 'k'), (1, 1, 'k')]


def chain(stage=0, gone=False):
    L = Layer('chain')
    for ri, run in enumerate(RUNS):
        pts = run_points(run, 2.0)
        for i, ((x, y), t) in enumerate(pts):
            if gone and CUT[ri] - 0.08 < t < 1.01:
                continue
            # damage reads at real size: stage 1 snaps a link of the near run (a 4 px gap with the
            # two torn links bent open), stage 2 also the far run; the links tarnish
            if stage >= 1 and ri == 0 and 0.50 < t < 0.60:
                continue
            if stage >= 2 and ri == 1 and 0.52 < t < 0.62:
                continue
            x0, y0 = math.floor(x) - 1, math.floor(y) - 1
            torn = (stage >= 1 and ri == 0 and (0.44 < t <= 0.50 or 0.60 <= t < 0.66)) or \
                   (stage >= 2 and ri == 1 and (0.46 < t <= 0.52 or 0.62 <= t < 0.68))
            if torn:
                for (dx, dy, ch) in ((0, 0, 'i'), (1, 1, 'j'), (2, 2, 'k'), (0, 1, 'j')):   # a link bent open
                    L.put(x0 + dx, y0 + dy, ch, ZC + 0.1, 'chain')
                continue
            if i % 2 == 0:
                for (dx, dy, ch) in RING:                      # a link face-on: a lit ring
                    if stage >= 1 and ch == 'g' and (i // 2) % (3 if stage == 1 else 1) == 0:
                        ch = 'h'                                # a dulled link (stage 2: all tarnished)
                    if stage >= 2 and ch == 'h' and (i // 2) % 2 == 0:
                        ch = 'i'
                    L.put(x0 + dx, y0 + dy, ch, ZC + 0.1, 'chain')
            else:
                for (dx, dy, ch) in ((1, 0, 'i'), (1, 1, 'j'), (1, 2, 'k')):   # a link edge-on
                    L.put(x0 + dx, y0 + dy, ch, ZC, 'chain')
        for (k, tt) in enumerate(SHIELDS):
            if gone and tt > CUT[ri] - 0.08:
                continue
            p = run(tt)
            col = [[('p', 'q', 'r'), ('S', 'T', 'U')], [('s', 't', 't'), ('p', 'q', 'r')]][ri][k]
            shield(L, math.floor(p[0]), math.floor(p[1]), col, chipped=stage >= 1 and k == 1,
                   lost=(stage >= 1 and ri == 0 and k == 1) or (stage >= 2 and k == 0 and ri == 1))
    return L


SHIELD = [
    'hhhhi',
    'h12.j',
    'h223j',
    'i233j',
    '.j3j.',
    '..k..',
]


def shield(L, x0, y0, col, chipped=False, lost=False):
    """A 5 x 6 enamel shield in a gold frame: 1 = the lit enamel, 2 = its base, 3 = its shade.
    lost: the enamel gem has popped out, the empty dark socket shows."""
    for j, r in enumerate(SHIELD):
        for i, ch in enumerate(r):
            if ch == '.':
                ch = '0' if (i, j) == (3, 1) and not lost else None
                if ch is None:
                    if lost and (i, j) == (3, 1):
                        L.put(x0 - 2 + i, y0 - 2 + j, '6', ZC + 0.3, 'shield')
                    continue
            c = {'1': col[0], '2': col[1], '3': col[2]}.get(ch, ch)
            if lost and ch in '123':
                c = '5' if ch == '1' else '7'
            elif chipped and (i, j) in ((2, 2), (3, 3)):
                c = '6'
            L.put(x0 - 2 + i, y0 - 2 + j, c, ZC + 0.3, 'shield')


# --------------------------------------------------------------------------------------- medallion
ESC = [(-7, -8), (7, -8), (7, 2), (5, 6), (0, 9), (-5, 6), (-7, 2)]     # the escutcheon, from the centre
SALTIRE = [(-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)]


# The medallion strip's frames (one strip per damage stage). 0..2 are the game's roles today
# (mayor.ts medFrame); 3..6 are the new in-betweens of the sequences (exported constants):
#   opening (phase 3 starts): 0 closed -> 3 crack -> 4 part -> 1 open
#   charge (the shield fan's telegraph): 1 open -> 5 charge -> 2 glow ... -> 6 flash (the volley) -> 1
MED_FRAMES = [
    # name, shutter split (px each side; None = shut), core level (0 dark .. 4 flash)
    ('closed', None, 0),     # 0 MED_CLOSED (armoured)
    ('open', 12, 1),         # 1 MED_OPEN   (the core bare, a cool glow)
    ('glow', 12, 3),         # 2 MED_GLOW   (firing glow: the code tints it too)
    ('crack', 1, 1),         # 3 MED_CRACK  (the shutter splits: a light line down the pale)
    ('part', 3, 1),          # 4 MED_PART   (the halves slide under the rim)
    ('charge', 12, 2),       # 5 MED_CHARGE (the core winds up)
    ('flash', 12, 4),        # 6 MED_FLASH  (the volley leaves: white core, rays)
]
MED_EVENTS = {'MED_CLOSED': 0, 'MED_OPEN': 1, 'MED_GLOW': 2, 'MED_CRACK': 3, 'MED_PART': 4,
              'MED_CHARGE': 5, 'MED_FLASH': 6}
CORE_R = 5.6          # the lens
IRIS_R = 7.4          # the steel iris ring round it


def medallion(stage=0, frame=0):
    L = Layer('medallion')
    mx, my = MED
    cx, cy = mx + 0.5, my + 0.5
    _, split, level = MED_FRAMES[frame]
    disc = ellmask(cx, cy, MR, MR)
    inner_r = MR - 3.4
    light_ang = math.atan2(LY, LX)
    for (x, y) in sorted(disc):
        dx, dy = x + 0.5 - cx, y + 0.5 - cy
        rr = math.hypot(dx, dy)
        if rr <= inner_r:
            continue
        lit = math.cos(math.atan2(dy, dx) - light_ang)
        if rr > MR - 1.15:                                  # the outer bevel faces the light
            ch = 'h' if lit > 0.55 else 'i' if lit > -0.2 else 'j' if lit > -0.7 else 'k'
        elif rr > MR - 2.3:                                 # the bead ring on the crown of the rim
            a = math.atan2(dy, dx)
            bead = (math.floor((a + math.pi) / (2 * math.pi) * 22)) % 2 == 0
            ch = ('g' if lit > 0.2 else 'h') if bead else ('i' if lit > -0.3 else 'j')
        else:                                               # the inner bevel faces away
            ch = 'k' if lit > 0.45 else 'j' if lit > -0.45 else 'i'
            if level >= 3:
                ch = 'H' if lit < -0.2 else 'I'             # the core light catches the inner bevel
        L.put(x, y, ch, ZM, 'rim')
    # the field: a crimson dome
    field = ellmask(cx, cy, inner_r, inner_r)
    for (x, y) in sorted(field):
        ch = pick(sphere_l(x, y, cx, cy, inner_r, inner_r), (0.86, 0.66, 0.38, 0.1), CRIM)
        if level >= 3 and math.hypot(x + 0.5 - cx, y + 0.5 - cy) < IRIS_R + 1.6:
            ch = step(ch, -1)                               # the glow warms the enamel round the core
        L.put(x, y, ch, ZM, 'field')
    if split is None:
        relief(L, mx, my)
    else:
        if split >= 2:
            core(L, mx, my, level)
        else:
            gap_light(L, mx, my)
        relief(L, mx, my, split=split, clip=field)
    # the crown on the rim where the chain runs end
    crown = ['.g.h.i.', 'ghhihij', 'hiijjjk', '.jjjkk.']
    for j, r in enumerate(crown):
        for i, ch in enumerate(r):
            if ch != '.':
                L.put(mx - 3 + i, my - 17 + j, ch, ZM + 0.3, 'crown')
    L.put(mx + 7, my - 12, '0', ZM + 0.2, 'rim')            # the glint on the rim
    L.put(mx + 8, my - 11, 'g', ZM + 0.2, 'rim')
    if stage >= 1:
        damage_1(L, mx, my)
    if stage >= 2:
        damage_2(L, mx, my)
    if level == 4:
        rays(L, mx, my)
    return L


def core(L, mx, my, level):
    """The bare core: a domed lens in a riveted steel iris ring. level 1 cool (open), 2 winding up,
    3 the firing glow, 4 the flash (white-hot)."""
    cx, cy = mx + 0.5, my + 0.5
    for (x, y) in sorted(ellmask(cx, cy, IRIS_R, IRIS_R)):
        rr = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
        if rr <= CORE_R:
            l = sphere_l(x, y, cx, cy, CORE_R, CORE_R)
            hot = 1 - rr / CORE_R
            if level == 1:
                ch = 'G' if l > 0.93 else 'H' if l > 0.62 else 'I'
            elif level == 2:
                ch = 'G' if hot > 0.62 or l > 0.93 else 'H' if hot > 0.2 else 'I'
            elif level == 3:
                ch = '0' if hot > 0.72 else 'G' if hot > 0.36 or l > 0.9 else 'H'
            else:
                ch = '0' if hot > 0.45 else 'G'
            L.put(x, y, ch, ZM + 0.05, 'core')
        else:
            # the iris ring: lit on its upper-left lip, the lower-right in shade
            a = math.atan2(y + 0.5 - cy, x + 0.5 - cx)
            lit = math.cos(a - math.atan2(LY, LX))
            outer = rr > IRIS_R - 0.9
            ch = ('3' if lit > 0.3 else '5') if outer else ('2' if lit > 0.4 else '4' if lit > -0.4 else '6')
            L.put(x, y, ch, ZM + 0.05, 'iris')
    for a in (0.6, 2.2, 3.8, 5.4):                          # four rivets on the iris ring
        x = int(math.floor(cx + math.cos(a) * (IRIS_R - 0.9)))
        y = int(math.floor(cy + math.sin(a) * (IRIS_R - 0.9)))
        L.over(x, y, '1')
    L.put(int(mx) - 2, int(my) - 3, '0' if level < 4 else 'G', ZM + 0.06, 'core')   # the lens glint


def gap_light(L, mx, my):
    """The crack frame: the core's cool light down the split of the pale."""
    for y in range(my - 9, my + 10):
        if L.sub(mx, y) == 'field':
            L.put(mx, y, 'H', ZM + 0.05, 'core')
    L.put(mx, my - 1, 'G', ZM + 0.06, 'core')
    L.put(mx, my, 'G', ZM + 0.06, 'core')


def rays(L, mx, my):
    """The flash: short rays of light past the rim (the FX ramp: white, pale gold, pale blue)."""
    cx, cy = mx + 0.5, my + 0.5
    for k in range(8):
        a = k * math.pi / 4 + math.pi / 8
        long_ = k % 2 == 0
        for i, r in enumerate((MR + 1.0, MR + 2.5, MR + 4.0, MR + 5.5)):
            if not long_ and i >= 2:
                break
            x = int(math.floor(cx + math.cos(a) * r))
            y = int(math.floor(cy + math.sin(a) * r))
            L.put(x, y, ('+', '=', '=', '-')[i], 30.0, 'fx')


def relief(L, mx, my, split=None, clip=None):
    """The escutcheon raised out of the field: lit upper-left bevel, shaded lower-right bevel, the black
    pale with three white saltires, each saltire with a shade pixel at its lower right. split: the
    shutter opens down the middle of the pale, each half slides `split` px out (under the rim: the
    halves are clipped to the field `clip`); each half keeps its own bevel, its cut face is steel."""
    esc = polymask([(mx + 0.5 + ex, my + 0.5 + ey) for ex, ey in ESC])
    if not split:
        halves = [(esc, 0)]
    else:
        halves = [({q for q in esc if q[0] < mx}, -split), ({q for q in esc if q[0] >= mx}, split)]
    for part, dx in halves:
        moved = {(x + dx, y) for (x, y) in part}
        for (x, y) in sorted(moved):
            if clip is not None and (x, y) not in clip:
                continue
            up_left = (x - 1, y) not in moved or (x, y - 1) not in moved
            low_right = (x + 1, y) not in moved or (x, y + 1) not in moved
            sx = x - dx
            ch = 'S' if sx - mx > 0 else 'T'
            if up_left:
                ch = 'R'
            elif low_right:
                ch = 'V'
            if abs(sx - mx) <= 2 and not up_left and not low_right:
                ch = '6' if sx - mx == -2 else '7'          # the black pale (its lit left edge)
            if split and ((dx < 0 and sx == mx - 1) or (dx > 0 and sx == mx)):
                ch = '5' if dx < 0 else '3'                 # the cut face of the pale (steel)
            L.put(x, y, ch, ZM + 0.1, 'relief')
        for dy in (-6, -1, 4):
            for (i, j) in SALTIRE:
                if split and (i < 0) != (dx < 0) and i != 0:
                    continue
                if split and i == 0 and dx < 0:
                    continue
                q = (mx + i + dx, my + dy + j)
                if (clip is None or q in clip) and L.sub(*q) == 'relief':
                    L.put(q[0], q[1], 'A', ZM + 0.2, 'relief')
            q = (mx + 1 + dx, my + dy + 1)
            if (not split or dx > 0) and (clip is None or q in clip) and L.sub(*q) == 'relief':
                L.put(q[0], q[1], 'C', ZM + 0.2, 'relief')    # the arm away from the light, shaded


def damage_1(L, mx, my):
    # a crack across the field, two scratches, a chip out of the rim
    for (x, y) in line(Layer('t'), [(mx - 8, my - 5), (mx - 4, my - 1), (mx - 1, my - 2), (mx + 3, my + 3), (mx + 8, my + 5)], 'x', 0, ''):
        if L.get(x, y) is not None and L.sub(x, y) in ('field', 'relief'):
            L.over(x, y, 'V')
            if L.get(x, y - 1) is not None and L.sub(x, y - 1) in ('field', 'relief'):
                L.over(x, y - 1, 'R')
    for pts in ([(mx - 7, my + 4), (mx - 4, my + 7)], [(mx + 4, my - 8), (mx + 7, my - 5)]):
        for (x, y) in line(Layer('t'), pts, 'x', 0, ''):
            if L.sub(x, y) in ('field', 'relief'):
                L.over(x, y, 'C')
    for (x, y) in ((mx - 11, my + 8), (mx - 10, my + 9), (mx - 12, my + 7), (mx - 10, my + 10)):
        if L.get(x, y) is not None:
            L.over(x, y, '6' if (x + y) % 2 else '5', 'chip')


def damage_2(L, mx, my):
    # the enamel shattered off the lower right: the steel armour under it, the core light in the seams
    hole = polymask([(mx - 1, my), (mx + 5, my - 4), (mx + 10, my), (mx + 9, my + 7), (mx + 3, my + 10), (mx - 3, my + 6)])
    for (x, y) in sorted(hole):
        if L.sub(x, y) not in ('field', 'relief'):
            continue
        rim = any((x + dx, y + dy) not in hole for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        l = sphere_l(x, y, mx + 0.5, my + 0.5, MR, MR)
        ch = '6' if rim and (x + y) % 2 == 0 else pick(l, (0.75, 0.5, 0.2), ['3', '4', '5', '6'])
        L.over(x, y, ch, 'armour')
    for (x, y) in line(Layer('t'), [(mx + 1, my + 2), (mx + 4, my + 3), (mx + 7, my + 2)], 'x', 0, '') + \
            line(Layer('t'), [(mx + 4, my + 3), (mx + 4, my + 7)], 'x', 0, ''):
        L.over(x, y, 'H')
    L.over(mx + 4, my + 3, 'G')
    for (x, y) in line(Layer('t'), [(mx - 6, my - 9), (mx - 3, my - 5), (mx - 1, my)], 'x', 0, ''):
        if L.sub(x, y) in ('field', 'relief'):
            L.over(x, y, 'V')
    # a dent in the rim: the bevel caves in (and a gap breaks the silhouette)
    for (x, y) in ((mx + 12, my + 6), (mx + 13, my + 5), (mx + 13, my + 6)):
        L.erase(x, y)
    for (x, y) in ((mx + 11, my + 6), (mx + 12, my + 5), (mx + 12, my + 7), (mx + 11, my + 7)):
        if L.get(x, y) is not None:
            L.over(x, y, 'k')
    # soot on the rim and the field
    for (x, y) in sorted(ellmask(mx + 9.5, my + 9.0, 2.6, 2.0)):
        ch = L.get(x, y)
        if ch is not None and L.sub(x, y) in ('rim', 'field'):
            L.over(x, y, '9' if ch in ('U', 'V', 'k', 'j') else 'k' if ch in ('h', 'i', 'g') else 'V')
    # sparks out of the shattered corner
    for (x, y, ch) in ((mx + 11, my + 10, '+'), (mx + 12, my + 11, '*'), (mx + 10, my + 12, '^'),
                       (mx + 13, my + 9, '^')):
        L.put(x, y, ch, 30.0, 'fx')
