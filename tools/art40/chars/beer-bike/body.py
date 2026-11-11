# BIERFIETS: the body strips (vehicle/beer-bike/body, posts, turret, wreck), drawn in body space
# facing right: (0, 0) is the floor point under the bike's middle (the strips' anchor). The numbers the
# game reads stay (src/game/content/vehicles/beer-bike/geometry.ts BEER_BIKE, D7): the stools at x -34,
# -21, -8, 5 with the hip 18 px over the floor (the cushions' top row at -17), the driver's saddle at
# x 22 and his grips at (31, -23), the counter top (the 2P perch) at -27, the roof -64 .. -58, the
# cork cannon's pivot (46, -24), the wheels' centres (the wheel strips are drawn by the code there).
#
# The look is the cast sample's: the striped canopy with a scalloped valance, the oak bar counter
# with beer glasses and a brass tap tower, red stools, the steel chassis, the barrel standing on the
# rear deck (it feeds the cork cannon through a hose along the chassis), the front crate with the
# lamp, the guide's saddle, the steering column with the bar and the bell.
import math

from . import kit as T
from . import pal as C

W, H, OX, OY = 124, 80, 60, 74
STOOLS = (-34, -21, -8, 5)
SEAT_TOP = -17            # the cushions' top row: the riders' hip (y -18) sits on it
HUB_DX, HUB_Y = 6, -7     # the pedal hub under each stool (the old crank: hip + (6, 11))
DRIVER_HUB = (4, -7)      # the guide's pedal hub from his saddle point (ahead of it, clear of the wheel)
NEAR_WHEELS = ((-44, -7), (37, -7))   # geometry.ts nearWheels / farWheels (the code draws them)
FAR_WHEELS = ((-39, -8), (42, -8))
DRIVER_X = 22
BAR = (35, -25)           # the grips (art only: the guide's hands; geometry.ts bar)
PIVOT = (46, -24)
SPOUT = 7
COUNTER = (-44, 14, -27)
ROOF = (-50, 42, -64, -58)
NEAR_POSTS = (-46, 39)
FAR_POSTS = (-41, 42)
BARREL = (-55, -47, -29, -14)     # x0, x1, top, bottom (standing on the rear deck)


def _h(x, y, s):
    """A fixed hash in [0, 1) (no random: the bake is deterministic)."""
    v = math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453
    return v - math.floor(v)


def roof(b, state):
    x0, x1, top, bot = ROOF
    burnt = state == 'wreck'
    for x in range(x0, x1 + 1):
        k = (x - x0) % 6
        red = ((x - x0) // 6) % 2 == 0
        if burnt:
            hi, base, sh = ('D', 'd', 'O') if red else ('7', 'D', 'd')
        else:
            hi, base, sh = ('J', 'j', 'q') if red else ('5', '6', '7')
        # the wreck: the canopy sags in the middle and has burnt holes
        sag = int(round(3.2 * math.sin(math.pi * (x - x0) / (x1 - x0)) ** 2)) if burnt else 0
        for y in range(top, bot + 1):
            if burnt and (_h(x, y, 3) > 0.8 or (x > -24 and x < -6 and y > top + 1)):
                continue
            if state == 'damaged' and -15 <= x <= -10 and y >= bot - [1, 3, 4, 4, 2, 0][x + 15]:
                continue        # a torn stripe: a ragged bite out of the lower edge
            ch = hi if y == top else (base if y < top + 4 else sh)
            # a soft fold every stripe: the stripe edge a shade darker
            if not burnt and k == 5 and y > top:
                ch = sh
            b.px(x, y + sag, ch, 4.0, 'roof')
        # the valance: a scallop under each stripe
        drop = [1, 2, 3, 3, 2, 1][k]
        if burnt and _h(x, 0, 5) > 0.5:
            continue
        if state == 'damaged' and -15 <= x <= -10:
            drop = 0 if x < -11 else 1
        for j in range(drop):
            y = bot + 1 + j
            b.px(x, y + sag, sh if j == drop - 1 else base, 4.0, 'roof:val')
    # the rail along the roof top (a brass trim)
    T.rod(b, (x0, top - 1), (x1, top - 1), 0.5, C.CHAR if burnt else C.BRASS, 4.5, 'roof:rail')


def barrel(b, state):
    x0, x1, top, bot = BARREL
    burnt = state == 'wreck'
    w = x1 - x0
    for y in range(top, bot):
        bulge = 1 if top + 2 <= y <= bot - 3 else 0
        for x in range(x0 - bulge, x1 + bulge):
            u = (x - x0 + 0.5) / w             # 0 .. 1 across the barrel
            k = 0 if u > 0.66 else 1 if u > 0.4 else 2 if u > 0.15 else 3
            if burnt:
                if _h(x, y, 9) > 0.75 and y < top + 5:
                    continue
                ch = C.CHAR[min(3, k)]
            else:
                ch = C.OAK[k]
                if (x - x0) in (2, 5) and k > 0:
                    ch = C.OAK[min(3, k + 1)]  # the stave joints
            if y in (top + 2, bot - 3):
                ch = 't' if u > 0.66 and not burnt else ('A' if u > 0.4 else 'P')   # the steel hoops
                if state == 'damaged' and y == top + 2 and u < 0.4:
                    ch = C.OAK[k]   # a sprung hoop
            b.px(x, y, ch, 1.2, 'barrel')
    # the tap at its front, the hose to the front crate (along the chassis)
    if not burnt:
        T.grid(b, x1, top + 7, ['gn', 'nN'], 1.3, 'barrel:tap')
    hose = C.CHAR if burnt else ['P', 'o', 'O', 'O']
    T.rod(b, (x1 + 1, top + 9), (x1 + 2, -11), 0.5, hose, 0.9, 'hose')
    T.rod(b, (x1 + 2, -11), (36, -11), 0.5, hose, 0.9, 'hose')


def counter(b, state):
    x0, x1, top = COUNTER
    burnt = state == 'wreck'
    oak = C.CHAR if burnt else C.OAK
    # the planked front panel: horizontal planks 3 rows high, a lit top row on each
    for y in range(top + 3, -13):
        for x in range(x0 + 1, x1):
            row = (y - (top + 3)) % 3
            ch = oak[1] if row == 0 else oak[2]
            if row == 2:
                ch = oak[3]
            if (x * 7 + (y - top) // 3 * 11) % 23 == 0 and row == 1:
                ch = oak[3]                            # a plank end
            if state == 'damaged' and abs((y + 19) - (x + 30) * 0.4) < 0.6 and -36 < x < -22:
                ch = 'd'                               # a crack
            if burnt and _h(x, y, 7) > 0.83:
                continue                               # burnt through
            b.px(x, y, ch, 1.0, 'counter')
    # vertical posts between the stools
    for px in (-40, -27, -14, -1, 12):
        for y in range(top + 3, -13):
            b.px(px, y, oak[2] if y > top + 3 else oak[1], 1.1, 'counter')
    # the thick top board, overhanging 1 px: lit top row, base, the dark lip
    for x in range(x0, x1 + 1):
        for y, k in ((top, 0), (top + 1, 1), (top + 2, 3)):
            if burnt and k == 0 and _h(x, y, 2) > 0.6:
                continue
            b.px(x, y, oak[k], 1.6, 'counter:top')
    if burnt:
        return
    # the brass tap tower in the middle, two black handles, a drip tray
    T.rod(b, (-16, top - 1), (-16, top - 8), 0.7, C.BRASS, 2.0, 'tap')
    T.grid(b, -16, top - 10, ['.Ggg.', 'Gg..n', 'g...n'], 2.1, 'tap:neck')
    T.rod(b, (-17, top - 9), (-18, top - 13), 0.5, C.STEEL_DK, 2.2, 'tap:handle')
    T.grid(b, -18, top - 1, ['tAAP'], 1.9, 'tap:tray')
    # beer glasses: a cream head, amber beer, a glint on the glass
    glasses = (-38, -3, 9) if state == 'ok' else (-38, 9)
    for gx in glasses:
        T.grid(b, gx, top - 5, ['565', 'Wgn', 'ggn', 'gnN'], 1.8, f'glass{gx}')


def stools(b, state):
    burnt = state == 'wreck'
    for i, sx in enumerate(STOOLS):
        post = C.CHAR if burnt else C.STEEL_DK
        T.rod(b, (sx, SEAT_TOP + 2), (sx, -12), 0.6, post, 1.8, f'stool{i}')
        # the down tube to the pedal hub
        T.disc(b, (sx + HUB_DX + 0.5, HUB_Y + 0.5), 1.3, ['t', 'A', 'P', 'P'], 1.75, f'stool{i}:hub')
        if burnt:
            if i % 2 == 0:
                T.grid(b, sx - 3, SEAT_TOP + 1, ['dDDDd', '.ddd.'], 1.9, f'stool{i}:seat')
            continue
        cushion = ['.JJJJJ.', 'jjJJjjq', '.qqqqq.']
        if state == 'damaged' and i == 2:
            cushion = ['.JJ.JJ.', 'jj55jjq', '.qqqqq.']      # a slashed cushion
        T.grid(b, sx - 3, SEAT_TOP, cushion, 1.9, f'stool{i}:seat')


def driver_seat(b, state):
    burnt = state == 'wreck'
    steel = C.CHAR if burnt else C.STEEL_DK
    x = DRIVER_X
    T.rod(b, (x, SEAT_TOP + 2), (x - 1, -12), 0.7, steel, 1.8, 'saddle:post')
    hx, hy = x + DRIVER_HUB[0], DRIVER_HUB[1]
    T.disc(b, (hx + 0.5, hy + 0.5), 1.3, ['t', 'A', 'P', 'P'], 1.75, 'saddle:hub')
    # the drive shaft under the deck: every pedal hub on it, hung from the deck by two brackets
    T.rod(b, (STOOLS[0] + HUB_DX - 1, HUB_Y), (hx + 1, HUB_Y), 0.5, C.STEEL_FAR if not burnt else C.CHAR, 1.6, 'shaft')
    for bx in (STOOLS[0] + HUB_DX + 6, STOOLS[2] + HUB_DX + 6, hx - 6):
        T.rod(b, (bx, -12), (bx, HUB_Y), 0.4, C.STEEL_FAR if not burnt else C.CHAR, 1.55, f'bracket{bx}')
    T.grid(b, x - 4, SEAT_TOP, ['.PPPPAt', 'oooooPA', '..ooo..'] if not burnt else ['.dDDd..', '..dd...'], 1.9, 'saddle')
    # the steering column from the front fork up to the bar, the bar, the black grip, the bell
    T.rod(b, (38, -11), (BAR[0] + 2, BAR[1] + 1), 0.8, steel, 2.3, 'column')
    T.rod(b, (BAR[0] + 2, BAR[1]), (BAR[0] - 1, BAR[1]), 0.6, C.STEEL if not burnt else C.CHAR, 2.4, 'bar')
    T.grid(b, BAR[0] - 2, BAR[1] - 1, ['oO', 'oO'] if not burnt else ['d'], 2.45, 'bar:grip')
    if not burnt and state == 'ok':
        T.grid(b, BAR[0] + 2, BAR[1] - 3, ['.Gg.', 'gggn'], 2.5, 'bell')


def front(b, state):
    burnt = state == 'wreck'
    oak = C.CHAR if burnt else C.OAK
    # the front crate on the fork: planks, a lit top edge, two dark slats
    for y in range(-21, -12):
        for x in range(38, 46):
            u = (x - 38 + 0.5) / 8
            k = 0 if y == -21 else (1 if u > 0.55 else 2)
            if (y + 21) % 4 == 3:
                k = 3
            if burnt and _h(x, y, 11) > 0.7:
                continue
            b.px(x, y, oak[k], 2.2, 'crate')
    # the lamp on the crate's front face: a brass rim round warm glass
    if not burnt:
        T.disc(b, (47.0, -15.0), 2.2, C.BRASS, 2.6, 'lamp')
        T.disc(b, (47.2, -15.2), 1.2, ['L', 'L', '5', '6'], 2.7, 'lamp:glass')


def chassis(b, state):
    burnt = state == 'wreck'
    steel = C.CHAR if burnt else C.STEEL
    T.rod(b, (-57, -13), (46, -13), 1.4, steel, 1.5, 'deck')
    # the axles and the springs from the deck down to each wheel hub
    far = C.STEEL_FAR if not burnt else C.CHAR
    for (wx, wy) in NEAR_WHEELS:
        T.rod(b, (wx - 4, -12), (wx, wy), 0.5, far, 1.45, f'spring{wx}')
        T.rod(b, (wx + 4, -12), (wx, wy), 0.5, far, 1.45, f'spring{wx}b')
    # the rear deck's lip under the barrel
    T.rod(b, (-58, -15), (-58, -11), 0.6, steel, 1.55, 'deck:lip')


def far_posts(b, state):
    x0, x1, top, bot = ROOF
    ramp = C.CHAR if state == 'wreck' else C.STEEL_FAR
    for i, x in enumerate(FAR_POSTS):
        T.rod(b, (x, bot), (x, -14), 0.6, ramp, 0.2, f'postF{i}')


def body(state):
    """state 'ok' (frame 0), 'damaged' (frame 1) or 'wreck'. Returns (rows, root)."""
    b = T.Body(W, H, OX, OY)
    far_posts(b, state)
    roof(b, state)
    chassis(b, state)
    barrel(b, state)
    counter(b, state)
    stools(b, state)
    driver_seat(b, state)
    front(b, state)
    fx = []
    if state == 'ok':
        fx = [(47, -16, 'W')]                     # the lamp's glint
    if state == 'damaged':
        # soot smudges and a scorch on the counter
        for x, y in ((-30, -20), (-29, -20), (-29, -21), (-6, -18), (-5, -18), (-5, -19)):
            fx.append((x, y, 'd'))
    if state == 'wreck':
        # embers glowing in the burnt planks
        for x, y, ch in ((-31, -22, 'x'), (-30, -22, 'f'), (-9, -19, 'x'), (2, -16, 'e'), (-48, -24, 'x'), (40, -18, 'e')):
            fx.append((x, y, ch))
    return T.finish(b, fx)


def posts():
    """The two near roof posts, drawn over the riders (frame 0)."""
    b = T.Body(W, H, OX, OY)
    x0, x1, top, bot = ROOF
    for i, x in enumerate(NEAR_POSTS):
        T.rod(b, (x, bot), (x, -12), 0.75, C.STEEL, 3.0, f'postN{i}')
        # a brass collar where the post meets the deck
        T.grid(b, x - 1, -15, ['GgN'], 3.1, f'postN{i}:collar')
    return T.finish(b)


def turret(step):
    """The brass beer tap on the front crate (the cork cannon) at aim step 0 (forward) .. 4 (up),
    22.5 degrees apart (geometry.ts turretAngle): a swivel collar, the tube, a flared mouth with
    a dark bore, the black tap handle on top."""
    b = T.Body(W, H, OX, OY)
    a = -step * math.pi / 8
    ux, uy = math.cos(a), math.sin(a)
    px, py = PIVOT
    T.grid(b, px - 3, py + 1, ['.APPo', 'tAPPo'], 1.0, 'collar')
    T.disc(b, (px + 0.5, py + 0.5), 2.0, C.BRASS, 2.0, 'ball')
    tip = (px + ux * (SPOUT - 1.4), py + uy * (SPOUT - 1.4))
    T.rod(b, (px + ux * 0.5, py + uy * 0.5), tip, 1.0, C.BRASS, 2.2, 'tube')
    # the flared mouth: a short wide ring across the tube, a dark bore in its middle
    nx, ny = -uy, ux
    mx, my = px + ux * (SPOUT - 0.6), py + uy * (SPOUT - 0.6)
    for t in (-1.6, -0.8, 0.0, 0.8, 1.6):
        ch = 'g' if t < 0 else ('n' if t > 0.5 else 'G')
        b.px(round(mx + nx * t), round(my + ny * t), ch, 2.4, 'mouth')
    b.px(round(mx + ux * 0.4), round(my + uy * 0.4), 'N', 2.45, 'mouth')
    # the tap handle: a black lever on the ball, it leans back as the tap aims up
    hx, hy = px - 0.5 - math.sin(-a) * 1.5, py - 2
    T.rod(b, (px, py - 1), (hx - 1, hy - 3), 0.5, C.STEEL_DK, 2.3, 'handle')
    return T.finish(b)
