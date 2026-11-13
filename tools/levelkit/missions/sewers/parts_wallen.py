# The street parts of mission `sewers` (level 2): De Wallen at night in the autumn drizzle (sections a and b) and the
# quiet street at dawn after the rain (end). Shared by the painters of a, b and end; built on the kit core and on level
# 1's canal-house painter (missions/ams/parts_l1a.py: house_a, read only).
#
# The look (docs/design/sewers.md §6, look sheet; canal-look.md §3.2 night, rules 7 and 8 of §6):
#   - red and pink neon on wet blue-black; wet cobbles and the canal mirror the neon; rain falls in the hour's light;
#   - red light ONLY on the ground floor (tubes, glow, tint are clipped to it: gate checks_sewers.red_above_gf);
#   - closed curtains, NO window figures (sex workers are never shown: gate checks_sewers.window_figures);
#   - neon words our own and generic (WORDS); never BAR, CAFE, LIVE, no real names (gate checks_sewers.lettering);
#   - green krul urinals beside the band; the old church is backdrop only (no marks, nothing on it).
#
# Scale (the scale rule, look.md): 13 px per metre x s. A front on the plane of speed s: storey 40 s, ground floor 54 s,
# window 14 s (house_a takes sc = 2 s: level 1's far bank at s 0.5 is sc 1.0). Street furniture at hand height (the krul,
# bins, posts, bikes) keeps the hero's own scale (the game's boxes).
#
# The order of a night plane (canal-look.md §3.6): paint in daylight -> grade (key, air; keep the emitters) -> the light
# pass (light_fronts, lamp lights, floodlight). Every part here paints daylight colours unless its name says `light_`.
# Every function takes a seed (or an rng) and gives the same pixels for the same seed at a tier.
import math
import os
import random
import sys
import numpy as np
from level import *
from parts4 import tint, neon_text, s5

_AMS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'ams')
if _AMS not in sys.path:
    sys.path.append(_AMS)                       # after this folder and the core: level 1's painters, read only
from parts_l1a import house_a, car_far_a, far_roofs_a, scale_px   # noqa: E402
from parts_ams import elm, amst_post                                # noqa: E402

# ---------------------------------------------------------------- emitters (they skip the key and the air)
RED = [s5(c) for c in ((255, 222, 230), (255, 110, 132), (236, 44, 84), (160, 22, 70))]     # core, tube, glow, ember
CURT = [s5(c) for c in ((214, 54, 94), (170, 32, 72), (120, 20, 56), (80, 12, 42))]          # a closed curtain lit red
PINK = [s5(c) for c in ((255, 224, 242), (255, 148, 206), (210, 84, 164), (120, 40, 110))]   # core, tube, glow, ember
AMBER = [s5(c) for c in (EM[0], EM[1], EM[2], (150, 84, 50))]
CYAN = [s5(c) for c in ((224, 250, 255), (132, 232, 255), (64, 156, 206), (36, 70, 120))]
HALO_R = [RED[1], s5((222, 52, 96)), s5((156, 40, 100)), s5((96, 40, 106)), s5((58, 38, 100))]
HALO_S = [s5(c) for c in ((250, 220, 150), (150, 130, 150), (78, 70, 132))]
HALO_W = [s5(c) for c in ((255, 236, 176), (236, 196, 128), (160, 128, 120), (90, 76, 110))]
BOARD = s5((24, 16, 41))
NEON = dict(red=RED, pink=PINK, amber=AMBER, cyan=CYAN)
KEEP = [tuple(int(v) for v in c) for c in RED + CURT + PINK + AMBER + CYAN + HALO_R + HALO_S + HALO_W + [BOARD]
        + [s5(c) for c in EM]]
GLASS_RED = set(tuple(int(v) for v in c) for c in RED + CURT)        # the only colours inside a red room's glass

# Our own neon words: generic Dutch, nothing of a real business, nothing of sex or drugs (spec §8). Checked against
# checks_sewers.BANNED. The colour each word takes (red / pink only at street level: every neon word is on the ground
# floor anyway).
WORDS = ('OPEN', 'HOTEL', 'NACHT', 'SNACK', 'FRIET', 'KIOSK', 'SNOEP', 'DROP', 'PATAT', 'KAAS')
WORD_COL = dict(OPEN='red', HOTEL='cyan', NACHT='pink', SNACK='amber', FRIET='amber', KIOSK='cyan', SNOEP='pink',
                DROP='red', PATAT='amber', KAAS='amber')

R['wet_cobble'] = ramp(7, .16, .66, .014, .022, .030, 262, 250)     # granite setts, wet: cold and dark
R["krul"] = ramp(7, .16, .70, .060, .125, .115, 162, 138)          # the krul's green cast iron
R['shutter'] = ramp(7, .20, .76, .008, .014, .016, 250, 200)       # galvanised roller shutter
R['bin'] = ramp(7, .16, .62, .010, .018, .020, 240, 210)           # a grey street container
R['tarp'] = ramp(7, .18, .66, .040, .092, .074, 262, 236)          # a blue boat tarp
R['church'] = ramp(7, .22, .78, .016, .030, .038, 40, 84)          # the old church: weathered sandstone and brick
R['lead'] = ramp(7, .18, .64, .008, .016, .018, 250, 220)          # lead roofs and the tower's lanterns


def _c(c):
    return tuple(int(v) for v in snap5(np.array(c, float)))


# ---------------------------------------------------------------- the fronts of De Wallen
def wallen_front(rng, w, s, seed, night=True, rooms=0.45, shutter=0.0, lamp=0.0, nst=(3, 3, 4, 4, 5)):
    """One narrow canal house of De Wallen, w px wide on the plane of speed s, in daylight colours.
       night: the ground floor may be a row of red rooms (a black board with 1-3 rooms behind glass, closed curtains)
       with probability `rooms`; else a house ground floor (door and windows) whose windows light_fronts may light.
       shutter: chance that a ground-floor window is a closed roller shutter; lamp: chance of a wall lamp by the door.
       Returns (Layer, info): info['gf_top'] (the ground floor's top row), 'foot', 'rooms', 'gfwin', 'upper', 'door',
       'sign' (a slot over the ground floor's openings for a neon word: x, y, w, h) and the house_a info."""
    sc = 2.0 * s
    storey = 40.0 * s
    n = rng.choice(nst)
    sts = [q_(storey * (1.06 - 0.04 * j) * rng.uniform(0.95, 1.05)) for j in range(n)]
    kind = rng.choice(['neck', 'neck', 'bell', 'bell', 'step', 'spout', 'cornice', 'cornice'])
    brick = rng.choice(BRICKS)
    trim = 'plaster' if rng.random() < 0.8 else 'stone'
    doorc = rng.choice(['green', 'black', 'black', 'red', 'blue'])
    Lh, info = house_a(rng, w, 0, kind, brick, trim, doorc, sc=sc, shop=None, seed=seed, storeys=sts)
    h = Lh.h
    gf = info['gf']
    gtop = h - gf
    st = q_(6 * sc)
    yf = h - st
    info.update(gf_top=gtop, foot=h, rooms=[], shutters=[], lamp_at=None, mode='house', brick=brick)
    info['upper'] = [b for b in info['win'] if b[1] < gtop]
    info['gfwin'] = [b for b in info['win'] if b[1] >= gtop]
    m = max(2, q_(3.4 * sc))
    K = R['black']; T = R[trim]; S = R['stone']; D = R[doorc]
    if night and rng.random() < rooms and w >= 26 * sc * 0.5 + 10:
        # a row of rooms behind glass: a black board over the whole ground floor, a narrow door at one end
        info['mode'] = 'rooms'
        fascia = max(8, q_(7 * sc))                     # the board's top band: room for a neon word
        y0 = gtop + fascia
        bh = yf - y0
        Lh.rect(0, gtop + 1, w, yf - gtop - 1, K[1]); Lh.hl(0, gtop + 1, w, K[3]); Lh.hl(0, yf - 1, w, K[0])
        Lh.vl(0, gtop + 1, yf - gtop - 1, K[2]); Lh.vl(w - 1, gtop + 1, yf - gtop - 1, K[0])
        dw = max(4, q_(5 * sc))
        left = rng.random() < 0.5
        dx = 1 if left else w - dw - 1
        Lh.rect(dx, y0, dw, bh, D[2]); Lh.vl(dx, y0, bh, D[4]); Lh.vl(dx + dw - 1, y0, bh, D[1])
        Lh.rect(dx, y0, dw, max(2, q_(2.5 * sc)), R['glass'][1])
        info['door'] = (dx, y0, dw, bh)
        ax0 = (dx + dw + 2) if left else m
        ax1 = (w - m) if left else (dx - 2)
        nr = max(1, min(3, int((ax1 - ax0 + 2) // max(8, q_(9 * sc)))))
        pw = (ax1 - ax0) / nr
        for k in range(nr):
            rx = int(round(ax0 + k * pw)) + 1
            rw = int(pw) - 2
            if rw < 3:
                continue
            Lh.rect(rx - 1, y0 - 1, rw + 2, bh + 1, T[4]); Lh.hl(rx - 1, y0 - 1, rw + 2, T[6])
            Lh.rect(rx, y0, rw, bh - 1, R['glass'][0])
            info['rooms'].append((rx, y0 + 1, rw, bh - 3))
        Lh.hl(0, yf, w, S[5]); Lh.rect(0, yf + 1, w, st - 1, S[2]); Lh.hl(0, h - 1, w, S[1])
        info['gfwin'] = []
        info['sign'] = (2, gtop + 1, w - 4, fascia - 1)
        return Lh, info
    else:
        sy = gtop + 1
        for b in list(info['gfwin']):
            if rng.random() < shutter:
                x, y, bw, bh_ = b
                Sh = roller_shutter(bw + 2, bh_ + 2, seed=seed + x)
                Lh.blit(Sh, x - 1, y - 1)
                info['shutters'].append(b)
                info['gfwin'].remove(b)
        if info.get('door') and rng.random() < lamp:
            dx, dy, dw, dh = info['door']
            lx = dx + dw + 1 if dx + dw + 8 < w else dx - 8
            WL = wall_lamp(s)
            ly = max(gtop + 1, dy - WL.h + 2)
            Lh.blit(WL, lx, ly)
            info['lamp_at'] = (lx + WL.w - 3, ly + 5)
    # the slot for a neon word: over the ground floor's openings, inside the ground floor
    top_open = min([b[1] for b in info['rooms'] + info['gfwin'] + info['shutters']] +
                   ([info['door'][1]] if info.get('door') else []) + [yf])
    info['sign'] = (2, sy, w - 4, max(0, top_open - 2 - sy))
    return Lh, info


def wallen_row(L, x0, x1, yb, rng, s, seed=100, night=True, wmin=30, wmax=46, **kw):
    """A tiled row of fronts on the plane of speed s from x0 to x1, feet on yb. Widths are plane px (wmin..wmax at
       s 0.5, scaled by 2 s). Returns the infos (absolute positions: 'x', 'y', 'w', and every box moved) and the slots
       [(x, w)]: each front paints inside its own slot (rows tile, 0 px overlap)."""
    k = 2.0 * s
    lo, hi = int(round(wmin * k)), int(round(wmax * k))
    infos, slots = [], []
    x = x0
    i = 0
    while x < x1:
        w = rng.randint(lo, hi)
        if x1 - (x + w) < lo * 0.6:
            w = x1 - x
        Lh, info = wallen_front(rng, w, s, seed + i * 7, night=night, **kw)
        assert Lh.w == w
        y = yb - Lh.h
        L.blit(Lh, x, y)
        mv = lambda b: (x + b[0], y + b[1], b[2], b[3])
        info['x'], info['y'], info['w'] = x, y, w
        info['gf_top'] += y
        info['foot'] += y
        for key in ('win', 'upper', 'gfwin', 'rooms', 'shutters'):
            info[key] = [mv(b) for b in info[key]]
        for key in ('door', 'sign'):
            if info.get(key):
                info[key] = mv(info[key])
        if info.get('lamp_at'):
            info['lamp_at'] = (x + info['lamp_at'][0], y + info['lamp_at'][1])
        infos.append(info)
        slots.append((x, w))
        x += w
        i += 1
    return infos, slots


def red_glass(L, box):
    """A room behind glass, closed: the red tube around the frame (a pale core on top) and the curtain drawn, lit red
       from inside (folds, a seam where the two halves meet). Only RED and CURT colours (the window-figure gate)."""
    x, y, w, h = box
    L.rect(x - 1, y - 1, w + 2, h + 2, RED[1]); L.hl(x - 1, y - 1, w + 2, RED[0])
    L.rect(x, y, w, h, CURT[1])
    xx = x
    k = 0
    while xx < x + w:                                   # folds: one real px light, then the shade, a 2-3 px rhythm
        L.rect(xx, y, D1 if U > 1 else 1, h, CURT[0] if k % 2 == 0 else CURT[2])
        xx += 1.5 if U > 1 else 2
        k += 1
    L.hl(x, y, w, CURT[0]); L.hl(x, y + 1, w, CURT[2], t=TH)          # the curtain rail's valance
    L.rect(x, y + h - max(1, h * 0.16), w, max(1, h * 0.16), CURT[3])   # the hem in its own shade
    if w >= 4:
        L.vl(x + w // 2, y + 1, h - 1, RED[2], t=TH)                   # the seam
        L.vl(x, y, h, CURT[3], t=TH); L.vl(x + w - D1, y, h, CURT[3], t=TH)


def _clip_glow(L, x, y, rad, pal, ymin=None, ymax=None):
    """glow() clipped to the rows ymin..ymax (the ground floor): red light never climbs."""
    T = Layer(2 * rad + 3, 2 * rad + 3)
    glow(T, rad + 1, rad + 1, rad, pal)
    ox, oy = x - rad - 1, y - rad - 1
    if ymin is not None and ymin > oy:
        T.clear(0, 0, T.w, ymin - oy)
    if ymax is not None and ymax < oy + T.h:
        T.clear(0, ymax - oy, T.w, oy + T.h - ymax)
    L.blit(T, ox, oy)


def red_room(L, box, gtop, foot, wl=None, strength=1.0, glass=True):
    """Light a room red: the light on the wall around it (inside the ground floor) and on the pavement, then the
       glass (glass=False: the caller paints it last, after every other light of the row, so no tint touches it).
       wl: the water lights list (x, colour, strength)."""
    x, y, w, h = box
    cx = x + w / 2.0
    tint(L, cx, y + h / 2.0, w / 2.0 + 5, h / 2.0 + 5, RED[2], 0.58 * strength, 0.30 * strength, ymin=gtop, ymax=foot)
    tint(L, cx, foot + 2, w / 2.0 + 5, 5, RED[2], 0.50 * strength, 0.26 * strength, ymin=foot)   # (a street in L)
    if glass:
        red_glass(L, box)
    if wl is not None:
        wl.append((int(cx), RED[2], 0.8))


def neon_word(L, x, y, w, h, word, colour, scale, gtop, foot, notes=None, where=''):
    """A neon word on a black board, centred in the slot (x, y, w, h); its glow on the wall inside the ground floor.
       Returns the light (x, colour) or None if it does not fit."""
    from checks_sewers import BANNED
    assert not any(b in word for b in BANNED), word
    tw = text_w(word) * scale
    th = 5 * scale
    if tw + 4 > w or th + 2 > h:
        return None
    N = NEON[colour]
    sx = int(x + (w - tw) // 2)
    sy = int(y + (h - th) // 2)
    tint(L, sx + tw / 2.0, sy + th / 2.0, tw / 2.0 + 5, th / 2.0 + 5, N[2], 0.48, 0.24, ymin=gtop, ymax=foot)
    L.rect(sx - 2, sy - 1, tw + 4, th + 2, BOARD)
    if scale >= 2:
        neon_text(L, sx, sy, word, N[1], N[0], s=scale)
    else:
        text(L, sx, sy, word, N[1])
    if notes is not None:
        notes.setdefault('words', []).append((word, where))
    return (sx + tw // 2, N[2])


def light_fronts(L, infos, H, rng, notes, where, wl=None, warm=0.14):
    """The light pass of a row of fronts (after its grade): warm rooms upstairs, red rooms and red-lit windows on the
       ground floor only, neon words and blade tubes on the ground floor, the wall lamps. Records for the gates:
       notes['gf_lines'] (layer id, x0, x1, gf top) and notes['rooms'] (layer id, box). Returns the lights
       [(x, y, colour, kind)] for pools and reflections; appends water streaks to wl."""
    lights = []
    gl = notes.setdefault('gf_lines', [])
    rooms = notes.setdefault('rooms', [])
    n_rooms = len(rooms)
    for i in infos:
        gl.append((where, i['x'], i['x'] + i['w'], i['gf_top']))
    if not H.get('night'):
        for i in infos:                                                 # dawn: a few rooms still lit, warm
            light_windows(L, i['upper'] + i['gfwin'], 0.06, rng)
        return lights
    for i in infos:
        gtop, foot = i['gf_top'], i['foot']
        for (x, y) in light_windows(L, i['upper'], warm, rng):
            lights.append((x, y, EM[1], 'window', foot, 0))
            if wl is not None and rng.random() < 0.5:
                wl.append((x, EM[2], 0.3))
        for b in i['rooms']:
            red_room(L, b, gtop, foot, wl, glass=False)
            rooms.append((where, b))
            lights.append((b[0] + b[2] / 2.0, b[1] + b[3] / 2.0, RED[2], 'room', foot, b[2] / 2.0 + 5))
        for b in i['gfwin']:
            k = rng.random()
            if k < 0.55 and b[2] >= 3:
                red_room(L, b, gtop, foot, wl, glass=False)
                rooms.append((where, b))
                lights.append((b[0] + b[2] / 2.0, b[1] + b[3] / 2.0, RED[2], 'room', foot, b[2] / 2.0 + 5))
            elif k < 0.72:
                for (x, y) in light_windows(L, [b], 1.0, rng):
                    lights.append((x, y, EM[1], 'window', foot, 0))
        sx, sy, sw, sh = i['sign']
        scale = 2 if sh >= 12 else 1
        if rng.random() < (0.75 if i['mode'] == 'rooms' else 0.5) and sh >= 7:
            word = rng.choice(WORDS)
            lt = neon_word(L, sx, sy, sw, sh, word, WORD_COL[word], scale, gtop, foot, notes, where)
            if lt:
                lights.append((lt[0], sy + sh / 2.0, lt[1], 'neon', foot, 8))
                if wl is not None:
                    wl.append((lt[0], lt[1], 0.9))
        elif i['w'] >= 20 and rng.random() < 0.5:                       # a blade tube by the door, street level
            col = NEON[rng.choice(['red', 'red', 'pink'])]
            bx = i['x'] + (1 if rng.random() < 0.5 else i['w'] - 3)
            bh = max(6, foot - gtop - 6)
            by = gtop + 2
            tint(L, bx + 1, by + bh / 2.0, 5, bh / 2.0 + 3, col[2], 0.48, 0.24, ymin=gtop, ymax=foot)
            L.rect(bx, by, 2, bh, col[1]); L.hl(bx, by, 2, col[0])
            for k in range(3, bh - 1, 3):
                L.hl(bx, by + k, 2, BOARD, t=TH)
            lights.append((bx + 1, by + bh / 2.0, col[2], 'neon', foot, 5))
            if wl is not None:
                wl.append((bx + 1, col[2], 0.5))
        if i.get('door') and i['mode'] == 'house' and rng.random() < 0.35:   # a red lantern over the door
            dx, dy, dw, dh = i['door']
            lx, ly = dx + dw / 2.0, max(gtop + 3, dy - 2)
            _clip_glow(L, lx, ly, 3, [RED[1], HALO_R[2], HALO_R[3]], ymin=gtop, ymax=foot)
            L.px(lx, ly, RED[0])
            lights.append((lx, ly, RED[2], 'lantern', foot, 4))
        if i.get('lamp_at'):
            lx, ly = i['lamp_at']
            light_wall_lamp(L, lx, ly)
            lights.append((lx, ly, EM[1], 'lamp', foot, 6))
    for (w_, b) in rooms[n_rooms:]:                                     # the glass last: no light touches it
        red_glass(L, b)
    return lights


def limit_colours(L, n, keep=KEEP):
    """Cut a layer to at most n (<= 256) colours besides the emitters (one median-cut palette over its other pixels, on the
       5-bit grid): a light pass mixes many in-between tones, the frame's budget is 560."""
    from PIL import Image
    a = L.a
    m = a[..., 3] > 0
    if not m.any():
        return
    px = a[..., :3][m]
    kk = np.array(sorted(set(keep)), np.int64)
    key = (px[:, 0].astype(np.int64) << 16) | (px[:, 1].astype(np.int64) << 8) | px[:, 2]
    kkey = (kk[:, 0] << 16) | (kk[:, 1] << 8) | kk[:, 2] if len(kk) else np.zeros(0, np.int64)
    free = ~np.isin(key, kkey)
    if len(np.unique(key[free])) <= n:
        return
    q = Image.fromarray(px[free][None, :, :].astype(np.uint8), 'RGB').quantize(n, method=Image.MEDIANCUT, dither=Image.NONE)
    out = snap5(np.asarray(q.convert('RGB'))[0].astype(float)).astype(np.uint8)
    sub_ = px.copy()
    sub_[free] = out
    a[..., :3][m] = sub_


def street_glow(L, lights, a1=0.50, a2=0.26):
    """The light of the ground floors on the pavement in front of them (after the fronts and the street are one
       layer): rooms, neon and lanterns tint the ground from each front's foot down."""
    for (x, y, col, kind, foot, rx) in lights:
        if kind in ('room', 'neon', 'lantern') and rx > 0:
            tint(L, x, foot + 2, rx, 5, col, a1, a2, ymin=foot)


# ---------------------------------------------------------------- street furniture (hero scale unless noted)
def wall_lamp(s=1.0):
    """An iron bracket lamp on a wall (a lantern on a curled arm), about 0.5 m: hero scale on the walk plane, smaller
       on a far plane. The glass is EM (it keeps its colour); light_wall_lamp adds the halo and the light."""
    k = max(0.5, min(1.0, s))
    w, h = max(5, int(round(10 * k))), max(7, int(round(16 * k)))
    I = R['iron']
    L = Layer(w, h)
    L.rect(0, 1, 2, max(3, h // 3), I[2]); L.vl(0, 1, max(3, h // 3), I[4])               # the wall plate
    L.line(1, 2, w - 3, 2, I[2], t=TH * 1.5)                                              # the arm with its curl
    if w >= 8:
        L.ellipse(3, 4, 1.4, 1.4, I[1]); L.ellipse(3, 4, 0.8, 0.8, I[3])
    lx = w - 4
    L.hl(lx - 1, 2, 4, I[3]); L.hl(lx - 1, 3, 4, I[1])                                    # the cap
    gh = max(3, h - 7)
    L.rect(lx - 1, 4, 3, gh, EM[1]); L.vl(lx - 1, 4, gh, I[2], t=TH); L.vl(lx + 2 - D1, 4, gh, I[1], t=TH)
    L.px(lx, 5, EM[0]); L.hl(lx - 1, 4 + gh, 4, I[1]); L.px(lx, 5 + gh, I[2])
    return L


def light_wall_lamp(L, x, y, rad=9):
    glow(L, x, y, rad, HALO_W)
    tint(L, x, y + rad * 0.6, rad * 1.4, rad * 1.2, EM[1], 0.30, 0.16)
    L.px(x, y, EM[0])


def krul(rng=None):
    """The green krul urinal of the canal quays (our own drawing of the type): a curled cast-iron screen seen a little
       from above (the front rim arcs, the dark inside shows over it), a pierced ornament band under the rim, the
       curl's opening at the right (the outer leaf ends, the inner leaf stands back in its shade), a moulded skirt on
       short legs over the drain, the centre column with its finial. 26 x 42 (the game's box, anchor bottom centre)."""
    G = R['krul']; K = R['black']; I = R['iron']
    L = Layer(26, 42)
    cx, rx, ry = 13.0, 12.0, 2.6
    ytop, ybot = 11.0, 35.0
    # the centre column and its finial (behind the front rim)
    L.rect(cx - 1, 3, 2, ytop, G[2]); L.vl(cx - 1, 3, ytop, G[4], t=TH)
    L.ellipse(cx, 2.2, 1.6, 1.6, G[4]); L.px(cx - 0.5, 1, G[6]); L.hl(cx - 2, 4.5, 4, G[3])
    # the inside of the screen over the front rim: the back rim (lit inner face) and the dark well
    L.ellipse(cx, ytop, rx, ry, G[1])
    L.ellipse(cx, ytop + 0.6, rx - 1.2, ry - 0.6, K[1])
    L.rect(cx - 1, ytop - ry, 2, ry + 1, G[2])
    def rim(x):
        nx = max(-1.0, min(1.0, (x + 0.5 * D1 - cx) / rx))
        return ytop + ry * math.sqrt(1 - nx * nx), nx
    # the body: a cylinder lit from the upper left; the curl's opening at the right third
    gap0, gap1 = 18.5, 20.0
    for x in sub(1, 25):
        yr, nx = rim(x)
        lit = math.cos(math.asin(nx) + 0.75)
        tone = int(np.clip(round(1.2 + 4.4 * max(0.0, lit)), 1, 5))
        if gap0 <= x < gap1:
            L.rect(x, yr + 1, D1, ybot - yr - 1, K[0])                     # the opening of the curl
            continue
        inner = x >= gap1
        t2 = max(1, tone - 1) if inner else tone
        y0 = yr + (0.8 if inner else 0.0)
        L.rect(x, y0, D1, ybot - y0, G[t2])
        L.rect(x, y0, D1, D1, G[min(6, t2 + 2)])                          # the rim's lit edge
        # the pierced band: openings on a 3 px rhythm, two rows, following the rim
        bx = (x - 1.5) % 3.0
        if (bx < 1.0 or (U > 1 and bx < 1.25)) and not inner:
            L.rect(x, y0 + 1.6, D1, 1.2, K[0])
            L.rect(x, y0 + 3.6, D1, 0.8 if U > 1 else 1, K[1])
        L.rect(x, y0 + 5.2, D1, D1, G[max(0, t2 - 2)])                    # the band's lower moulding
        L.rect(x, y0 + 5.2 + D1, D1, D1, G[min(6, t2 + 1)])
        # the skirt
        L.rect(x, ybot - 3, D1, 3, G[max(1, t2 - 1)]); L.rect(x, ybot - 3, D1, D1, G[min(6, t2 + 1)])
    L.vl(gap0 - D1, rim(gap0)[0], ybot - rim(gap0)[0], G[6], t=TH)        # the outer leaf's lit edge
    # panels: three slim vertical ribs and the bolt rows; rain runs on the lit side; a wet highlight
    for x in (5.0, 10.5, 15.5):
        yr, _ = rim(x)
        L.vl(x, yr + 7, ybot - yr - 10, G[2], t=TH)
    for y in (22.0, 29.0):
        for x in np.arange(2.5, 18.0, 2.5):
            L.px(x, y, G[5] if x < 12 else G[3])
    r = random.Random(7)
    for i in range(6):
        x = r.uniform(2.0, 11.0)
        y0 = rim(x)[0] + r.uniform(7, 12)
        L.vl(x, y0, r.uniform(4, 10), G[6], t=TH)
    L.vl(4.0, rim(4.0)[0] + 7, 12, G[6], t=TH)
    # the legs, the shade under the screen, the drain grate
    L.rect(2, ybot, 22, 4, K[0])
    for x in (2.5, 8.5, 16.5, 22.0):
        L.rect(x, ybot, 1.5, 5, G[2]); L.vl(x, ybot, 5, G[4], t=TH)
    L.rect(7, 39, 12, 2, I[1])
    for x in np.arange(7.5, 19, 1.5):
        L.vl(x, 39, 2, K[0], t=TH)
    L.hl(0, 41, 26, K[0])
    return L


def quay_tree(rng, h, seed=1):
    """A quay elm in late October at the scale rule (h px: 14-16 m x s): the crown thinned by the autumn (more sky
       through it), yellow-brown leaves, the trunk and the first forks."""
    w = int(h * 0.74)
    L = Layer(w, h)
    ch = int(h * 0.66)
    tr = trunk(rng, h - ch // 2, max(7, round(7 * w / 104)), seed=seed)
    L.blit(tr, w / 2 - tr.w / 2, h - tr.h)
    cn = canopy(w, ch, R["leaf"], seed, nb=12, rag=8, holes=0.14, spread=0.38)   # still mostly green in late October: dark at night
    L.blit(cn, 0, 0)
    return L


def roller_shutter(w, h, seed=1):
    """A closed roller shutter (galvanised slats, the roll box on top, guide rails, a padlocked bottom bar, grime and
       a little rust). No lettering."""
    S = R['shutter']; I = R['iron']; RS = R['rust'] if 'rust' in R else R['wood']
    L = Layer(w, h)
    bx = max(2, h * 0.12)
    L.rect(0, 0, w, bx, S[3]); L.hl(0, 0, w, S[5]); L.hl(0, bx - D1, w, S[1])
    y = bx
    k = 0
    step = 2.0 if U == 1 else 1.5
    while y < h - 2:
        L.rect(1, y, w - 2, step, S[4] if k % 2 == 0 else S[3]); L.hl(1, y + step - D1, w - 2, S[2], t=TH)
        y += step
        k += 1
    L.vl(0, bx, h - bx, S[2]); L.vl(w - 1, bx, h - bx, S[1])
    L.rect(1, h - 2, w - 2, 2, S[2]); L.hl(1, h - 2, w - 2, S[5])
    L.rect(w // 2 - 1, h - 3, 2, 2, I[1]); L.px(w // 2 - 1, h - 3, R['yellow'][4])
    r = random.Random(seed)
    for i in range(max(1, w // 6)):
        gx = r.uniform(1, w - 2)
        gl = r.uniform(h * 0.15, h * 0.5)
        L.vl(gx, h - 2 - gl, gl, S[2], t=TH)
    for i in range(max(1, w // 10)):
        L.px(r.uniform(1, w - 2), r.uniform(bx, h - 3), RS[3])
    return L


def bin_cans(rng):
    """A grey street container with a green lid, a black bin bag beside it and cans on the ground (no people)."""
    B = R['bin']; G = R['green']; K = R['black']
    L = Layer(30, 26)
    L.rect(2, 6, 15, 18, B[3]); L.vl(2, 6, 18, B[5]); L.vl(16, 6, 18, B[1]); L.hl(2, 23, 15, B[1])
    for y in (10, 15, 20):
        L.hl(3, y, 13, B[2], t=TH)
    L.rect(1, 3, 17, 3, G[3]); L.hl(1, 3, 17, G[5]); L.hl(1, 5, 17, G[1]); L.rect(13, 2, 4, 1, G[2])
    L.ellipse(5, 24, 2, 2, K[1]); L.ellipse(14, 24, 2, 2, K[1]); L.px(5, 24, B[3]); L.px(14, 24, B[3])
    L.ellipse(23.5, 20, 6.2, 5.6, K[2]); L.ellipse(21.5, 21, 3.4, 3.6, K[3]); L.ellipse(24, 17.5, 3.5, 2.2, K[3])
    L.ellipse(21, 18, 1.4, 1.0, K[5]); L.ellipse(26, 20, 1.0, 1.6, K[4])
    L.line(23, 14.5, 21.5, 12.5, K[2], t=1); L.line(23.5, 14.5, 25.5, 12.8, K[3], t=1)      # the knot's two ears
    for (x, y, c) in ((18, 24, 'red'), (26, 25, 'white'), (8, 25, 'blue')):
        C = R[c]
        L.rect(x, y, 3, 1.5, C[4]); L.px(x, y, C[6]); L.px(x + 2, y + 0.5, C[2])
    L.hl(0, 25.5, 30, K[0], t=TH)
    return L


def tarp_boat(rng, w=56):
    """A small open boat moored at the quay under a blue tarp for the winter (s ~0.72: a 6 m boat is ~56 px), with
       its fenders and the mooring line. Bottom = the waterline."""
    C = R[rng.choice(['green', 'black', 'wood', 'white'])]; T = R['tarp']; W = R['white']; K = R['black']
    L = Layer(w, 16)
    for x in sub(0, w):
        t = x / max(w - 1, 1)
        top = 6 + rq(2.2 * (4 * (t - 0.5) ** 2))
        e = min(x, w - 1 - x)
        cut = 3.0 * max(0.0, 1 - (e + D1) / 7.0) ** 1.6
        bot = 15 - cut
        L.rect(x, top, D1, bot - top, C[3])
        L.rect(x, top, D1, 1, W[4]); L.rect(x, top + 1, D1, D1, C[5]); L.rect(x, bot - 1, D1, 1, C[1])
    # the tarp: a sagging blue sheet over the hull, ridged by the boom under it, puddles in its hollows
    for x in sub(3, w - 3):
        t = (x - 3) / max(w - 7, 1)
        ridge = 1.0 + 1.6 * abs(math.sin(t * math.pi * 3))
        L.rect(x, ridge, D1, 6.5 - ridge * 0.4, T[4] if (int(x * DET) // 3) % 3 else T[3])
        L.rect(x, ridge, D1, D1, T[6]); L.rect(x, 6 - ridge * 0.2, D1, 1, T[2])
    for x in range(6, w - 6, max(6, w // 7)):
        L.vl(x, 3, 4, T[1], t=TH); L.px(x, 7, K[2])                       # ties
    for x in (int(w * 0.3), int(w * 0.62)):
        L.rect(x, 2, 4, 1, R['glass'][2]); L.px(x + 1, 2, R['glass'][4])  # rain in the hollows
    for x in (8, w - 12):
        L.ellipse(x, 10, 1.3, 2, W[3]); L.px(x, 9, W[5])                   # fenders
    L.line(1, 7, -2, 3, R['canvas'][2], t=TH)
    return L


def umbrella_far(rng, s=0.5):
    """A passer-by under an umbrella on a far pavement: a shape only (the umbrella hides the head; no face). About
       1.9 m x 13 s px."""
    hgt = max(9, int(round(13 * 1.9 * s)))
    w = max(7, int(round(hgt * 0.68)))
    C = R[rng.choice(['black', 'black', 'red', 'blue', 'green', 'yellow'])]; K = R['black']; CO = R[rng.choice(['black', 'blue', 'wood', 'iron'])]
    L = Layer(w, hgt)
    cx = w / 2.0
    for j in sub(0, 3):
        hw = (w / 2.0) * (0.55 + 0.45 * (j + D1) / 3.0)
        L.rect(cx - hw, j, 2 * hw, D1, C[4] if j < 2 else C[3]); L.rect(cx - hw, j, hw * 0.6, D1, C[5])
    L.hl(0, 3, w, C[1], t=TH)
    L.vl(cx, 3, 2, K[2], t=TH)
    bw = max(3, w * 0.42)
    L.rect(cx - bw / 2, 4, bw, hgt - 7, CO[2]); L.vl(cx - bw / 2, 4, hgt - 7, CO[3], t=TH)
    L.rect(cx - bw / 2 + 0.5, hgt - 3, 1, 3, K[1]); L.rect(cx + bw / 2 - 1.5, hgt - 3, 1, 3, K[1])
    return L


def steam_frames(w=22, h=56, seed=3, n=3, pal=None):
    """Steam from a vent in the paving, n frames (a step every 10 ticks): the plume's noise rises by h / n a frame.
       Daylight-free colours: the caller passes the palette of the hour (pale, a little of the neon in it)."""
    pal = pal or [(110, 112, 130), (140, 142, 160), (170, 170, 186), (196, 196, 210)]
    out = []
    for f in range(n):
        L = Layer(w, h)
        xx, yy = grid(0, 0, w, h)
        t = 1 - yy / (h - 1)
        cxl = w / 2.0 + np.sin(yy / 7.0 + f * 2.1) * 1.5 * t + t * 3
        rad = 1.5 + t * (w / 2.0 - 2)
        d = np.abs(xx - cxl) / rad
        nz = fbm(xx / 4.0, (yy + f * h / n) / 5.0, seed, 3)
        v = (1 - d) * 0.9 + (nz - 0.5) * 1.0 - t * 0.55
        idx = np.clip((v * len(pal)).astype(int), 0, len(pal) - 1)
        L.a[..., :3] = np.array(pal, np.uint8)[idx]
        L.a[..., 3] = np.where((v > 0.14) & ~((v < 0.34) & ~chk(xx, yy)), 255, 0)
        out.append(L)
    return out


def drain_vent(w=14):
    """The vent grate the steam rises from (in the paving: a cast-iron grate seen at a slant)."""
    I = R['castiron'] if 'castiron' in R else R['iron']
    L = Layer(w, 3)
    L.rect(0, 0, w, 3, I[1]); L.hl(0, 0, w, I[4])
    for x in range(1, w - 1, 2):
        L.vl(x, 1, 2, I[0])
    return L


def fg_bags(rng):
    """Front things for the lower edge: two bin bags and a crate of empties (the fg plane grades them dark)."""
    K = R['black']; W = R['wood']; G = R['glass']
    L = Layer(64, 30)
    L.ellipse(14, 20, 13, 10, K[2]); L.ellipse(12, 16, 8, 5, K[3]); L.ellipse(10, 13, 2.5, 1.6, K[5])
    L.rect(12, 8, 3, 3, K[1])
    L.ellipse(34, 23, 10, 7, K[2]); L.ellipse(32, 20, 6, 3.5, K[4])
    L.rect(44, 14, 18, 16, W[2]); L.hl(44, 14, 18, W[4]); L.vl(44, 14, 16, W[4]); L.vl(61, 14, 16, W[1])
    for x in range(46, 60, 3):
        L.rect(x, 9, 2, 6, G[2]); L.px(x, 9, G[5]); L.px(x, 10, R['green'][3])
    return L


# ---------------------------------------------------------------- the old church (backdrop only: no marks on it)
def church_wall(w, h, s, seed=7):
    """The long side of an old brick-and-sandstone church at the plane of speed s: buttresses every 9 m with stone
       weatherings and pinnacles, tall pointed windows (three lights under a traceried head, dark leaded glass) in a
       stone surround, a stone plinth, the lead roof above the eaves. w x h px of the wall up to the eaves; the roof
       adds 0.5 h on top. Returns (Layer, info: buttress x list, windows, the eaves row)."""
    B = R['brick_brown']; S = R['church']; G = R['glass']; LD = R['lead']
    rh = int(h * 0.5)
    L = Layer(w, h + rh)
    # the roof: lead in strips with rolls, darker toward the ridge, a cresting along the ridge
    for x in sub(0, w):
        t = (int(x * DET) // 3) % 2
        L.rect(x, 0, D1, rh, LD[3] if t else LD[2])
        L.rect(x, 0, D1, rh * 0.35, LD[2] if t else LD[1])
    for x in np.arange(0, w, 4.5):
        L.vl(x, 0, rh, LD[4], t=TH); L.vl(x + TH, 0, rh, LD[1], t=TH)
    for x in np.arange(1, w, 3):
        L.px(x, 0, LD[5]); L.px(x + 1, -0.5 + 1, LD[3])
    L.hl(0, 1, w, LD[5], t=TH); L.hl(0, rh - 2, w, LD[1]); L.hl(0, rh - 1, w, S[2])
    brickfill(L, 0, rh, w, h, B, seed, lo=2, hi=4, mid=3, streaks=True)
    bay = max(12, int(round(13 * 9.0 * s)))
    bw = max(4, int(round(13 * 1.3 * s)))
    info = dict(buttress=[], windows=[], bay=bay, eaves=rh)
    x = bay // 2
    while x < w + bay:
        # a pointed window centred between this buttress and the next
        ww = int(round((bay - bw) * 0.46))
        wx = x + bw // 2 + int(round((bay - bw - ww) / 2.0))
        if ww >= 5:
            wy0, wy1 = rh + h * 0.16, rh + h * 0.80
            head = ww * 0.62                                              # the pointed head's height
            def arc(i, wd, x0):
                tt = abs((i + 0.5 * D1 - wd / 2.0) / (wd / 2.0))
                return (1 - math.sqrt(max(0.0, 1 - (1 - tt) ** 2 * 0.0 - tt * tt * 0.0))) if False else head * (1 - (1 - tt) ** 0.62)
            for i in sub(0, ww + 2):                                      # the stone surround
                yy = wy0 + arc(i, ww + 2, wx - 1) - 1
                L.rect(wx - 1 + i, yy, D1, wy1 - yy + 1, S[4] if i < (ww + 2) * 0.5 else S[3])
            for i in sub(0, ww):                                          # the glass: lead lines, dark panes
                yy = wy0 + 1 + arc(i, ww, wx)
                L.rect(wx + i, yy, D1, wy1 - yy - 1, G[0] if (int(i * DET) // 2) % 2 else G[1])
                L.rect(wx + i, yy, D1, 1, S[1])                           # the reveal's shade
            for yy in np.arange(wy0 + head + 2, wy1 - 2, max(3, (wy1 - wy0) / 8)):
                L.hl(wx, yy, ww, LD[2], t=TH)
            for k in (1, 2):                                              # two mullions: three lights
                mx = wx + ww * k / 3.0
                L.vl(mx, wy0 + head * 0.6, wy1 - wy0 - head * 0.6 - 1, S[4], t=TH * 1.5)
            L.ellipse(wx + ww / 2.0, wy0 + head * 0.55, ww * 0.18 + 0.4, ww * 0.18 + 0.4, S[4])     # the rose in the head
            L.ellipse(wx + ww / 2.0, wy0 + head * 0.55, ww * 0.10 + 0.2, ww * 0.10 + 0.2, G[1])
            L.hl(wx - 1, wy1 - 1, ww + 2, S[5]); L.hl(wx - 1, wy1, ww + 2, S[1])                   # the sill
            info['windows'].append((wx, wy0, ww, wy1 - wy0))
        # the buttress: front face, lit left side, shade right; weatherings stepping it back; a pinnacle
        bx = x - bw // 2
        L.rect(bx, rh + 2, bw, h - 2, S[3]); L.vl(bx, rh + 2, h - 2, S[5]); L.vl(bx + 1, rh + 2, h - 2, S[4])
        L.vl(bx + bw - 1, rh + 2, h - 2, S[1]); L.vl(bx + bw - 2, rh + 2, h - 2, S[2], t=TH)
        L.rect(bx + bw, rh + 2, max(1, bw * 0.3), h - 2, B[1])                                     # its cast shade
        for yy in (rh + h * 0.34, rh + h * 0.60):
            L.rect(bx - 1, yy, bw + 2, 2.5, S[4]); L.hl(bx - 1, yy, bw + 2, S[6]); L.hl(bx - 1, yy + 2.5, bw + 2, S[0])
            L.px(bx - 1, yy + 1, S[5])
        L.rect(bx + 1, rh - 3, bw - 2, 5, S[4]); L.vl(bx + 1, rh - 3, 5, S[6]); L.vl(bx + bw - 2, rh - 3, 5, S[2])
        L.rect(bx + bw / 2.0 - 0.5, rh - 7, 1, 4, S[4]); L.px(bx + bw / 2.0 - 0.5, rh - 8, S[6])
        for yy in np.arange(rh + 6, rh + h - 4, 5):                                                # its joints
            L.hl(bx + 1, yy, bw - 2, S[2], t=TH)
        info['buttress'].append(x)
        x += bay
    py = rh + h - max(3, h * 0.07)
    L.rect(0, py, w, rh + h - py, S[3]); L.hl(0, py, w, S[5]); L.hl(0, py + 1, w, S[4], t=TH)
    L.hl(0, rh + h - 1, w, S[1])
    return L, info


def church_floodlight(L, info, x0, foot, h, col=(240, 214, 166)):
    """The church at night: a fan of warm light from a ground fixture in front of every buttress (two steps, the
       detail stays), not a wash: the bays between stay in the night."""
    for bx in info['buttress']:
        tint(L, x0 + bx, foot, info['bay'] * 0.34, h * 0.78, col, 0.40, 0.20, ymax=foot)


def church_tower(hgt, s, seed=5):
    """The old church's tower (our own design in the manner of a Dutch Gothic tower): a square brick base with stone
       corners and a clock face, an octagonal stone stage, then lead lanterns and a slender spire with a crown. hgt px
       tall at the plane of speed s. Backdrop only."""
    B = R['brick_brown']; S = R['church']; LD = R['lead']; Y = R['yellow']
    w = max(16, int(round(13 * 11.0 * s)))
    L = Layer(w + 4, hgt)
    cx = (w + 4) / 2.0
    base = int(hgt * 0.42)
    y0 = hgt - base
    brickfill(L, 2, y0, w, base, B, seed, streaks=True)
    L.vl(2, y0, base, S[5]); L.vl(w + 1, y0, base, S[1])
    for y in range(int(y0), hgt, 4):
        L.hl(2, y, 2, S[5]); L.hl(w, y + 2, 2, S[3])
    for (yy, hh) in ((y0 + base * 0.20, base * 0.30), (y0 + base * 0.60, base * 0.24)):    # louvred openings
        L.rect(cx - w * 0.18, yy, w * 0.36, hh, R['black'][1])
        for k in np.arange(yy + 2, yy + hh, 2):
            L.hl(cx - w * 0.18, k, w * 0.36, S[2], t=TH)
    L.hl(1, y0, w + 2, S[6]); L.hl(1, y0 + 1, w + 2, S[3])
    # the octagonal stage, the lanterns, the spire
    y = y0
    for (fw, fh, mat) in ((0.78, 0.13, S), (0.56, 0.10, LD), (0.40, 0.09, LD)):
        ww, hh = w * fw, hgt * fh
        x_ = cx - ww / 2
        L.rect(x_, y - hh, ww, hh, mat[4]); L.vl(x_, y - hh, hh, mat[6]); L.vl(x_ + ww - 1, y - hh, hh, mat[2])
        L.rect(x_ + ww * 0.32, y - hh, ww * 0.12, hh, mat[3])
        for xx in np.arange(x_ + 2, x_ + ww - 2, max(2.5, ww / 5)):
            L.rect(xx, y - hh + 3, max(1, ww / 10), hh - 5, R['black'][1])
        L.hl(x_ - 1, y - hh, ww + 2, mat[6]); L.hl(x_ - 1, y - hh + 1, ww + 2, mat[2])
        y -= hh
    sp = y
    for j in sub(0, sp):
        hw = max(D1, (w * 0.20) * (j / max(sp, 1)) ** 1.3)
        L.rect(cx - hw, j, 2 * hw, D1, LD[4]); L.rect(cx, j, hw, D1, LD[2])
    L.ellipse(cx, sp * 0.45, w * 0.06 + 0.6, w * 0.05 + 0.6, Y[4])           # the crown
    L.vl(cx, 0, 3, Y[5])
    # the clock (no numbers): a pale disc with two hands
    L.ellipse(cx, y0 + base * 0.10, w * 0.17, w * 0.17, R['plaster'][5]); L.ring(cx, y0 + base * 0.10, w * 0.17, Y[4], w * 0.13)
    L.line(cx, y0 + base * 0.10, cx, y0 + base * 0.10 - w * 0.10, R['black'][0], t=TH)
    L.line(cx, y0 + base * 0.10, cx + w * 0.07, y0 + base * 0.10 + w * 0.02, R['black'][0], t=TH)
    return L


def floodlight(L, x0, x1, ytop, ybot, col=(255, 226, 170), a=0.46, keep=()):
    """Light from floodlights at the foot (after the grade): the pixels of L between x0..x1 and ytop..ybot step
       toward the light colour, strongest at the bottom (two tones, the upper on the checker). The detail stays."""
    xx, yy = grid(x0, ytop, x1 - x0, ybot - ytop)
    v = L.view(x0, ytop, x1 - x0, ybot - ytop)
    if v.shape[:2] != xx.shape:
        return
    on = v[..., 3] > 0
    t = np.clip((yy - ytop) / max(ybot - ytop, 1), 0, 1)
    ck = chk(xx, yy)
    inner = (t > 0.58) | ((t > 0.54) & ck)
    outer = ((t > 0.26) | ((t > 0.22) & ck)) & ~inner
    kp = set(tuple(int(c) for c in k) for k in keep)
    for m, k in ((inner & on, a), (outer & on, a * 0.5)):
        if m.any():
            px = v[..., :3][m].astype(float)
            v[..., :3][m] = snap5(px + (np.array(col, float) - px) * k)


# ---------------------------------------------------------------- the sky, the skyline (night and dawn)
def night_sky(sec, seed=8):
    """The rain night's sky (speed 0): banded from the deep top to the city's violet-pink glow at the horizon; and a
       low cloud deck (a drifting tile of streak clouds lit from below). Dawn: the same with the hour's pale tones."""
    H = sec.H
    S, spal = sky(VIEW_W, 156, H['sky'], n=14, seed=seed, streak=0.06)
    sec.add('sky', S, 0)
    sec.notes['spal'] = spal
    cp = [hx(c) for c in H['cloud']]
    CL = Layer(720, 124)
    boxes = [(0, 4, 330, 34, 21), (250, 30, 360, 36, 22), (80, 60, 300, 30, 23), (430, 0, 290, 28, 24), (560, 70, 160, 26, 25),
             (-60, 90, 260, 24, 26), (330, 94, 240, 22, 27)]
    for (x, y, w, h, sd) in boxes:
        CL.blit(wisp(w, h, cp, sd, cover=0.62, sx=48, sy=6), x, y)
    sec.add('clouds', CL, 0.03, y=0, kind='tile', drift=0.9)
    return S, CL


def skyline_night(sec, speed=0.10, yb=112, seed=5, air=0.55, tower=None):
    """The far roofs at the skyline's speed (scale rule fronts), in the air of the hour, a few lit windows; tower =
       (plane x, height px): the old church's tower, floodlit, once."""
    W1 = sec.lw(speed)
    SK = Layer(W1, VIEW_H)
    far_roofs_a(SK, 0, W1, yb, random.Random(seed), s=speed)
    tw = None
    if tower is not None:
        tx, th = tower
        tw = church_tower(th, speed, seed=seed + 1)
        SK.blit(tw, tx - tw.w / 2.0, yb - th + 2)
    SK.recolor(grader(key=sec.KEY, air=(sec.AIR[0], sec.AIR[1], air, 0.5)))
    if tower is not None and sec.H.get('night'):
        floodlight(SK, tx - tw.w / 2.0, tx + tw.w / 2.0, yb - th * 0.75, yb, col=(236, 206, 160), a=0.40)
    r = random.Random(seed + 9)
    if sec.H.get('night'):
        for i in range(W1 // 9):
            x, y = r.uniform(0, W1), r.uniform(yb - 14, yb - 2)
            if SK.get(x, y) is not None:
                SK.px(x, y, EM[2] if r.random() < 0.7 else EM[1])
    sec.add('skyline', SK, speed)
    return SK


# ---------------------------------------------------------------- the far quay across the canal (a, at speed 0.5)
FAR_TREE_N = dict(cw=(62, 74), ch=(56, 64), th=(36, 42), step=(170, 240), tw=4)


def far_quay_night(sec, rng, YH=110, YQ=115, YW=120, speed=0.5, seed=100, boats=(), umbrellas=0.5, trees=True,
                   gaps=()):
    """The far quay of the canal in one layer (speed 0.5, the scale rule): the tiled row of De Wallen fronts, the
       quay street (cobbles), bikes, a few cars, autumn trees, lamps, passers-by under umbrellas (shapes), the quay
       wall, boats under tarps; graded with the key and the hour's far air; then the light pass. gaps: plane-x spans
       where a bridge lands (no tree, no car). Returns (F, info: infos, slots, wl, lights, lamps)."""
    H = sec.H
    WF = sec.lw(speed)
    Fh = Layer(WF, VIEW_H)                       # the fronts alone (their light pass sees no tree, car or walker)
    infos, slots = wallen_row(Fh, 0, WF, YH, rng, speed, seed=seed, night=H.get('night', True))
    F = Layer(WF, VIEW_H)                        # the street, trees, cars, walkers, the quay wall, boats
    far_street(F, 0, WF, YH, YQ, rng, 1)
    for i in infos:
        if rng.random() < 0.55:
            F.blit(bike_far(rng), i['x'] + rng.randint(2, max(3, i['w'] - 14)), YH - 5)
    ingap = lambda x, m=0: any(a - m <= x <= b + m for (a, b) in gaps)
    tl = []
    if trees:
        x = 40
        while x < WF - 20:
            if not ingap(x, 30):
                t = tree_far(rng, rng.randint(*FAR_TREE_N['cw']), rng.randint(*FAR_TREE_N['ch']), rng.randint(*FAR_TREE_N['th']),
                             leaf='leaf_autumn', seed=rng.randint(1, 999), bare=0.55, tw=FAR_TREE_N['tw'])
                tl.append((x - t.w // 2, YQ - t.h, t))
            x += rng.randint(*FAR_TREE_N['step'])
    x = 8
    while x < WF - 20:
        k = rng.random()
        if ingap(x, 30):
            x += 10
        elif k < 0.12:
            c = car_far_a(rng); F.blit(c, x, YQ - c.h + 1); x += c.w + rng.randint(6, 16)
        elif k < 0.40:
            for j in range(rng.randint(1, 4)):
                F.blit(bike_far(rng), x, YQ - 7); x += 9
            x += 4
        else:
            x += rng.randint(6, 18)
    lamps = []
    for lx in range(30, WF, 104):
        if not ingap(lx, 8):
            F.blit(lamp_far(30, lit=True), lx, YQ - 29)
            lamps.append((lx + 2, YQ - 26))
    walkers = []
    x = rng.randint(10, 40)
    while x < WF - 10:
        if rng.random() < umbrellas and not ingap(x, 6):
            u = umbrella_far(rng, speed)
            F.blit(u if rng.random() < 0.5 else u.flip(), x, YQ - u.h - rng.randint(0, 2))
            walkers.append(x)
        x += rng.randint(40, 110)
    for (tx, ty, t) in tl:
        F.blit(t, tx, ty)
    bollards_far(F, 0, WF, YQ + 1, rng)
    quay_wall(F, 0, YQ, WF, YW - YQ, rng, 7)
    for (kind, bx, arg) in boats:
        if kind == 'sloop':
            b = sloop(rng, arg[0], arg[1]); F.blit(b, bx, YW - 7)
        elif kind == 'tarp':
            b = tarp_boat(rng, arg[0]); F.blit(b, bx, YW - b.h + 3)
    F.clear(0, YW + 1, F.w, F.h)
    G = grader(key=sec.KEY, air=(sec.AIR[0], sec.AIR[1], H.get('far_air', 0.12), 0.30))
    F.recolor(G, keep=KEEP)
    Fh.recolor(G, keep=KEEP)
    wl = []
    lights = light_fronts(Fh, infos, H, rng, sec.notes, 'far', wl)
    Fc = Layer(Fh.w, Fh.h); Fc.a = Fh.a.copy()
    sec.notes.setdefault('front_imgs', {})['far'] = Fc                  # the window-figure gate reads the fronts alone
    Fh.blit(F, 0, 0)
    F = Fh
    street_glow(F, lights)
    if H.get('night'):
        for (x, y) in lamps:
            glow(F, x, y, 7, HALO_S)
            F.rect(x - 1, y - 1, 3, 3, EM[0]); F.px(x, y + 1, EM[1])
            wl.append((x, EM[1], 0.8))
    limit_colours(F, 256)
    sec.add('far', F, speed)
    sec.notes.setdefault('fronts', []).append(('far', slots))
    return F, dict(infos=infos, slots=slots, wl=wl, lights=lights, lamps=lamps, trees=tl, walkers=walkers)


# ---------------------------------------------------------------- the canal at night: mirror, light streaks, rain rings
def canal_night(sec, srcs, WF, wl, YW=120, speed=0.5, seed=9, rings=True):
    """The canal as rows from the far quay's foot (YW) to the floor's back edge (146): the mirror of what stands above
       (srcs as for level.canal_water), the long broken streaks of every far light (wl), and rain rings (3 frames, a
       step every 10 ticks, the rings grow). Adds layer 'water'; returns its frames."""
    H = sec.H
    rows = BACKY - YW
    src = flatten(srcs, WF, YW + 1)
    s1 = s_d(GY - BACKY + 0.0)
    spal = sec.notes.get('spal')
    glint = spal[12] if spal else (150, 140, 200)
    wat = water(src, YW, rows, WF, sec.lw(s1), H['water'][0], H['water'][1], glint, seed=seed, k=3.0, ncol=34,
                mix0=0.34, mix1=0.70, lights=wl, streak=0.7)
    if rings and H.get('rain'):
        rain_rings(wat, H['rain'][2], speed, s1, seed + 3, body=H['water'][0])
    sec.add('water', None, speed, y=YW, kind='rows', frames=wat, s0=speed, s1=s1)
    return wat


def rain_rings(frames, col, s0, s1, seed=3, density=1.0, body=(26, 22, 66)):
    """Rain on a water rows layer: per frame a fresh drop (a dot), a ring, a wider faint ring at hashed spots; the
       ring is an ellipse squashed by the row's slant. Three fixed colours (the glint of the rain mixed into the
       water's body by phase: few new colours). In place."""
    col = np.array(col, float)
    body = np.array(body, float)
    phase_col = [snap5(body + (col - body) * a) for a in (0.70, 0.50, 0.30)]
    n = len(frames)
    for f, L in enumerate(frames):
        H_, W_ = L.ph, L.pw
        r = random.Random(seed * 31 + f)
        cnt = int(W_ * H_ / (U * U) / 120 * density)
        for i in range(cnt):
            ph = (i + f) % 3
            cx, cy = r.uniform(0, W_), r.uniform(1.5 * U, H_ - U)
            rad = (0.6, 1.6, 2.6)[ph] * U * (0.6 + 0.6 * cy / H_)
            ry = max(0.5 * U, rad * 0.30)
            amt = (0.55, 0.40, 0.22)[ph]
            x0, x1 = int(max(0, cx - rad - 1)), int(min(W_, cx + rad + 2))
            y0, y1 = int(max(0, cy - ry - 1)), int(min(H_, cy + ry + 2))
            if x1 <= x0 or y1 <= y0:
                continue
            yy, xx = np.mgrid[y0:y1, x0:x1]
            dd = np.hypot((xx + 0.5 - cx) / max(rad, 0.5), (yy + 0.5 - cy) / ry)
            m = (dd < 0.75) if ph == 0 else ((dd > 0.65) & (dd < 1.05))
            if ph == 2:
                m &= ((xx // max(1, U // 2) + yy) % 2 == 0)
            v = L.a[y0:y1, x0:x1]
            v[..., :3][m] = phase_col[ph]


# ---------------------------------------------------------------- rain: streak layers (speed 0, the hour's light)
def rain_layers(sec, seed=11, far_density=1.0, near_density=1.0, n=3, insert_far=None):
    """Two rain layers of n frames (a step every 10 ticks), both screen-fixed (speed 0: rain has no parallax worth its
       memory; 385 px wide frames): 'rain-far' (fine, short, dim streaks behind the walk planes; inserted before the
       layer index insert_far, else appended) and 'rain' (sparse, longer, brighter, over the heroes). The pattern
       wraps vertically and falls by VIEW_H / n per frame, slanting a little with the wind."""
    H = sec.H
    if not H.get('rain'):
        return None
    cf, cn, cg = [_c(c) for c in H['rain']]

    def layer(dens, lmin, lmax, cols, seed_, thin):
        out = []
        r = random.Random(seed_)
        drops = [(r.uniform(0, VIEW_W), r.uniform(0, VIEW_H), r.uniform(lmin, lmax), r.random()) for _ in range(int(dens))]
        for f in range(n):
            L = Layer(VIEW_W + 1, VIEW_H)
            for (x, y, ln, k) in drops:
                yy = (y + f * VIEW_H / n) % VIEW_H
                xx = (x + f * VIEW_H / n * 0.18) % VIEW_W
                c = cols[0] if k < 0.82 else cols[1]
                L.line(xx, yy, xx + ln * 0.18, yy + ln, c, t=thin)
                if yy + ln > VIEW_H:
                    L.line(xx, yy - VIEW_H, xx + ln * 0.18, yy - VIEW_H + ln, c, t=thin)
            out.append(L)
        return out
    far = layer(260 * far_density, 3, 6, (cf, cn), seed, TH)
    near = layer(70 * near_density, 9, 16, (cn, cg), seed + 1, TH if U > 1 else 1)
    d = dict(id='rain-far', img=None, speed=0.0, y=0, kind='frames', over=False, frames=far)
    for im in far:
        im.a[..., :3] = snap5(im.a[..., :3])
    if insert_far is None:
        sec.layers.append(d)
    else:
        sec.layers.insert(insert_far, d)
    sec.add('rain', None, 0.0, kind='frames', frames=near, over=True)
    return far, near


# ---------------------------------------------------------------- the wet floor (a): an extra for floor_layer, a post pass
def puddles(u, v, seed=71):
    """Where the ground holds water (world space): low spots of a soft noise, longer along the street."""
    n = fbm(u / 30.0, v / 6.0, seed, 3)
    return n < 0.26


def quay_extra(sec, coping=27.0):
    """floor_layer's extra for the quay street of a: the quay pavement behind the far kerb in wet smoked klinkers
       (stretcher bond), the granite coping with its joints and mooring rings, the cobbled lane wet (darker joints),
       and the puddles (a pale mirror tone in daylight: the grade makes it the night sky's sheen; wet_floor_post
       adds the neon)."""
    fl = sec.fl
    dF = fl['far'] if isinstance(fl['far'], (int, float)) else 5.0
    dN = fl['near'] if isinstance(fl['near'], (int, float)) else -16.3
    KS, ST, WC = np.array(R['brick_smoke'], np.uint8), np.array(R['stone'], np.uint8), np.array(R['wet_cobble'], np.uint8)

    def extra(u, d, v, rgb):
        h1 = lambda a, b, sd: hash01(a, b, sd)
        # the quay pavement: klinkers 6 x 3 world px, half-brick offset
        pav = (d > dF + 1.6) & (d < coping)
        if pav.any():
            j = np.floor(v / 3.0); uu = u / 6.0 + 0.5 * (j % 2); i = np.floor(uu)
            fu, fv = uu - i, v / 3.0 - j
            t = 3 + (h1(i, j, 91) > 0.70) - (h1(i, j, 92) > 0.80)
            t = np.where((fv < 0.20) & (fu > 0.06), t + 1, t)
            t = np.where((fu < 0.07) | (fv > 0.86), 1, t)
            rgb[pav] = KS[np.clip(t, 0, 6)][pav]
        # the near pavement: the same wet klinkers
        npv = d < dN - 1.4
        if npv.any():
            j = np.floor(v / 3.0); uu = u / 6.0 + 0.5 * (j % 2); i = np.floor(uu)
            fu, fv = uu - i, v / 3.0 - j
            t = 3 + (h1(i, j, 93) > 0.70) - (h1(i, j, 94) > 0.80)
            t = np.where((fv < 0.20) & (fu > 0.06), t + 1, t)
            t = np.where((fu < 0.07) | (fv > 0.86), 1, t)
            rgb[npv] = KS[np.clip(t, 0, 6)][npv]
        # the lane: the setts wet and cold
        lane = (d <= dF) & (d >= dN)
        if lane.any():
            j = np.floor(v / 4.0); uu = u / 5.0 + 0.5 * (j % 2); i = np.floor(uu)
            fu, fv = uu - i, v / 4.0 - j
            base = 3 + (h1(i, j, 31) > 0.66) - (h1(i, j, 32) > 0.78)
            dome = (fu - 0.40) ** 2 + (fv - 0.42) ** 2
            t = np.where(dome < 0.045, base + 2, base)
            t = np.where((fu > 0.62) & (fv > 0.55), base - 1, t)
            t = np.where((fu < 0.10) | (fv < 0.12), 0, t)
            rgb[lane] = WC[np.clip(t, 0, 6)][lane]
        # the coping: granite blocks, a lit nosing, joints, iron rings
        cop = d >= coping
        if cop.any():
            t = np.where(d >= coping + 0.8, 5, 3) + 0 * u
            t = np.where((u % 22) < 0.6, 2, t)
            t = np.where(d >= 29.4, 6, t)
            rgb[cop] = ST[np.clip(t, 0, 6).astype(int)][cop]
            ring = cop & (np.abs(((u + 40) % 96) - 48) < 1.4) & (d < coping + 1.8)
            rgb[ring] = np.array(R['iron'][1], np.uint8)
        # puddles (not on the coping, not on the kerbstones)
        pm = puddles(u, v) & (d < coping - 0.5) & ~((np.abs(d - dF) < 1.8) | (np.abs(d - dN) < 1.4))
        rgb[pm] = np.array((150, 162, 196), np.uint8)
        edge = puddles(u + 1.2, v) & ~pm & (d < coping - 0.5)
        rgb[edge] = (rgb[edge].astype(int) * 3 // 4).astype(np.uint8)
    return extra


def floor_uvd(sec, img):
    """World x (u), depth d and world depth v of every real pixel of the floor rows layer (from y 146)."""
    r0 = P(BACKY)
    ys = (np.arange(r0, r0 + img.ph) + 0.5) / U
    sv = s_y(ys)
    ps = (np.arange(img.pw) + 0.5) / U
    u = 192 + (ps[None, :] - 192) / sv[:, None]
    d = np.broadcast_to((GY - ys)[:, None], u.shape)
    v = np.broadcast_to(v_y(ys)[:, None], u.shape)
    return u, d, v


def wet_floor_post(sec, img, lights, coping=27.0, seed=5):
    """The light pass of the wet floor (after floor_layer's grade): puddles take the neon of the street (a pink-violet
       sheen, broken streaks of red, pink and amber), a vertical reflection under each near light, and a pool of light
       on the ground around it. lights: [(world x, depth, colour, radius)] of things on this floor (lamps)."""
    u, d, v = floor_uvd(sec, img)
    pm = puddles(u, v) & (d < coping - 0.5)
    wet = sec.H.get('wet', 0.8)
    a = img.a
    ck = chk(u, d)
    if pm.any() and sec.H.get('night'):
        band = np.floor(u / 9.0)
        k = hash01(band, np.floor(v / 30.0), seed)
        cols = np.array([s5((84, 70, 150)), s5((84, 70, 150)), s5((120, 80, 170)), RED[2], PINK[2], AMBER[2]], float)
        ci = np.clip((k * 6).astype(int), 0, 5)
        tgt = cols[ci]
        streak = pm & (hash01(np.floor(u / 1.5), np.floor(v / 4.0), seed + 1) > 0.72)
        for m, amt in ((pm, 0.14 * wet), (streak, 0.34 * wet)):
            px = a[..., :3][m].astype(float)
            a[..., :3][m] = snap5(px + (tgt[m] - px) * amt)
    for (lx, ld, col, rad) in lights:
        col = np.array(col, float)
        # the pool on the ground: an ellipse in world space around the foot, two steps, the outer on the checker
        e = ((u - lx) / (rad * 1.6)) ** 2 + ((d - ld + 2) / (rad * 0.35)) ** 2
        inner = (e < 0.30) | ((e < 0.45) & ck)
        outer = ((e < 0.80) | ((e < 1.0) & ck)) & ~inner
        for m, amt in ((inner, 0.36), (outer, 0.18)):
            px = a[..., :3][m].astype(float)
            a[..., :3][m] = snap5(px + (col - px) * amt)
        # the wet sheen: puddles inside the pool catch more of the light (a reflection in a line-scroll floor cannot
        # stay under its lamp at every camera: only the pool, which lies on the ground, is baked)
        m = pm & (e < 1.0)
        px = a[..., :3][m].astype(float)
        a[..., :3][m] = snap5(px + (col - px) * 0.30 * wet)


# ---------------------------------------------------------------- a hump bridge across the canal, in depth
def bridge_depth(sec, x0, x1, d0=27.0, d1=56.0, lift=5.0, rise=2.4, step=0.5, bikes=3, seed=5, lit=True):
    """A hump bridge that crosses the canal from our quay's coping (depth d0) to the far quay (depth d1), seen along
       its axis, drawn as depth slices (one plane every `step` px of depth, each at its own speed: grammar rule 6).
       World x0..x1 is the deck's width between the parapets. The deck leaves our quay at street level, rises by
       `rise` m at the crown and lands on the far quay `lift` px higher (the far quay wall, YW - YQ). Each slice paints
       the deck's cross-section at its depth: the wet setts of the deck (each slice shows only the strip a nearer slice
       does not hide: the deck's surface in perspective), the brick kerbs and the iron railings of both parapets (the
       slices' posts line up into railings that run into depth), bikes chained to the rails, a lantern on each
       parapet at the crown. Slices go into short layers 'br<x0>_<k>' (only the bridge's rows). Returns their ids."""
    rng = random.Random(seed)
    B = R['brick_brown']; S = R['stone']; I = R['iron']; WC = R['wet_cobble']
    ids = []
    ks = np.arange(d1, d0 - 1e-6, -step)                        # far -> near (the near slices cover the far ones)
    mid = (d0 + d1) / 2.0
    half = (d1 - d0) / 2.0
    bike_at = sorted(rng.uniform(d0 + 4, d1 - 4) for _ in range(bikes))
    crown = round(mid * 2) / 2.0
    for k in ks:
        sp = s_d(k)
        t = (k - mid) / half
        hump = rise * PXM_ * sp * (1 - t * t)                   # the deck's rise at this depth, screen px
        yfoot = GY - k                                         # the street level of this depth
        ydeck = yfoot - hump - lift * (k - d0) / (d1 - d0)
        xa, xb = sec.at(x0, sp), sec.at(x1, sp)
        par = 1.0 * PXM_ * sp                                  # the parapet: 1 m
        top = ydeck - par - (14 if (lit and abs(k - crown) < 1e-6) else 2)
        hgt = yfoot + 3 - top
        Lw = Layer(sec.lw(sp), hgt)
        yd = ydeck - top
        # the deck: wet setts, a slice 3 px deep (the strip that shows), the crown of the road a little lighter
        for xx in sub(0, xb - xa):
            u = x0 + xx / sp
            tone = 2 + int(hash01(np.array(math.floor(u / 5.0)), np.array(math.floor(k)), seed) > 0.6)
            if (u % 5.0) < 0.8:
                tone = 1
            if abs(u - (x0 + x1) / 2.0) < (x1 - x0) * 0.18:
                tone += 1
            Lw.rect(xa + xx, yd, D1, 3, WC[min(6, tone)])
        Lw.rect(xa, yd + 3, xb - xa, yfoot - ydeck, WC[1])
        Lw.vl(xa - D1, yd, yfoot - ydeck + 3, B[1]); Lw.vl(xb, yd, yfoot - ydeck + 3, B[0])     # the outer faces
        # the parapets: a brick kerb, the railing's post and its top rail (every slice: the rails run unbroken)
        kb = max(1.5, par * 0.28)
        for (px_, side) in ((xa, 1), (xb - 2, -1)):
            Lw.rect(px_, yd - kb, 2, kb + 2, B[3]); Lw.hl(px_, yd - kb, 2, S[5])
            Lw.vl(px_ + (0 if side > 0 else 1), yd - kb - (par - kb), par - kb, I[2] if side > 0 else I[1], t=TH)
            Lw.hl(px_, yd - par, 2, I[4] if side > 0 else I[3], t=TH)
            if abs((k * 2) % 4) < 1e-6:                                  # a post every 2 px of depth
                Lw.rect(px_ + 0.5, yd - par, 1, par - kb, I[3] if side > 0 else I[1])
        for bd in bike_at:
            if abs(k - bd) < step / 2:
                bk = bike(rng, None, False)
                left = rng.random() < 0.5
                Lw.blit(bk if left else bk.flip(), (xa + 2) if left else (xb - 2 - bk.w), yd - bk.h + 2)
        if lit and abs(k - crown) < 1e-6:
            for px_ in (xa, xb - 2):
                Lw.rect(px_ + 0.5, yd - par - 9, 1, 9, I[2]); Lw.rect(px_ - 0.5, yd - par - 13, 3, 4, EM[1])
                Lw.hl(px_ - 1, yd - par - 13.5, 4, I[3])
        Lw.recolor(grader(key=sec.KEY, air=(sec.AIR[0], sec.AIR[1], min(0.3, 0.004 * k), 0.3)), keep=KEEP)
        if lit and abs(k - crown) < 1e-6:
            for px_ in (xa, xb - 2):
                glow(Lw, px_ + 1, yd - par - 11, 7, HALO_W)
                Lw.rect(px_ - 0.5, yd - par - 13, 3, 4, EM[1]); Lw.px(px_ + 0.5, yd - par - 12, EM[0])
        lid = 'br%d_%g' % (x0, k)
        sec.add(lid, Lw, sp, y=top, depth=k)
        ids.append(lid)
    return ids


PXM_ = 13.0
