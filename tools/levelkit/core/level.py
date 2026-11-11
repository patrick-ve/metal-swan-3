# A level in the canal look (first made for level 1, mission ams): long sections seen through the game's own floor
# camera.
#
# The layout comes from the game (work/<mission>/layout.json, dumped by tools/levelkit/dump.ts): the section width, the ground line,
# the platforms, the water, every decor item with its x, its sprite box and its depth on the perspective floor,
# and the floor layout (kerb lines, street kinds, canals, bridges, areas).
#
# The camera (docs/design/floor.md §1.1): horizon yh = 60, focal length f = 210, walk line 176, back edge of the
# floor 146. A floor row at screen y has the scale s(y) = (y - 60) / 116, so it scrolls at the speed s(y).
# A thing at depth d (screen px behind the walk line on flat ground; negative = in front) stands on the row
# y = 176 - d and scrolls at s(176 - d). It is drawn at its own size, as in the game.
# A thing at world x on a plane of speed s sits at the layer position p = 192 + (x - 192) * s.
import json
import math
import os
import random
import numpy as np
from build import *
from sets import *

HERE = os.path.dirname(os.path.abspath(__file__))
try:
    import mission as _M        # the mission's tables (missions/<id>/mission.py): lk.py puts that folder on the path
except ModuleNotFoundError:
    raise SystemExit('level.py: no mission on the import path. Run the kit through tools/levelkit/lk.py <mission> ...')
MISSION = _M.ID
# The layout: LK_LAYOUT (env) > the mission's LAYOUT (a stub, e.g. missions/sample/layout.json) > the dump's file
LAYOUT_PATH = os.environ.get('LK_LAYOUT') or getattr(_M, 'LAYOUT', None) or \
    os.path.normpath(os.path.join(HERE, '..', 'work', MISSION, 'layout.json'))
if not os.path.exists(LAYOUT_PATH):
    raise SystemExit('level.py: no layout at %s. Dump it first: npx tsx tools/levelkit/dump.ts %s' % (LAYOUT_PATH, MISSION))
LAY = json.load(open(LAYOUT_PATH))
import street as _street
if not os.environ.get('L1_OLD_STREET'):
    _street.apply(LAY)          # the straight street (street.py + the mission's STREET); L1_OLD_STREET=1: the game's bent layout

YHF, FF, BACKY, GY = 60.0, 210.0, 146, 176

# The bake for the game sets L1_GAME=1: a section then leaves out what the game draws itself as an entity (a
# breakable rack, a stall, a cart, a boat that moves or carries the player) and offers those paintings as sprites
# instead (the section module's `sprites()`; see bake_game.py). The page and the previews paint them at their spawn x.
GAME = bool(os.environ.get('L1_GAME'))


def s_y(y):
    return (np.asarray(y, float) - YHF) / (GY - YHF)


def s_d(d):
    return float(s_y(GY - d))


def v_y(y):
    return FF * (1 - 1 / s_y(y))


def pl(pts, u):
    """A depth line of the floor layout ([[u, d], ...] or one number) at the positions u."""
    u = np.asarray(u, float)
    if isinstance(pts, (int, float)):
        return np.full(u.shape, float(pts))
    return np.interp(u, [p[0] for p in pts], [p[1] for p in pts])


# ---------------------------------------------------------------- the hours of the mission (key and air, §3.2 of the guide)
# Each mission keeps its own table HOURS = {name: dict(KEY, AIR, sky, cloud, water, shadow, cast, shade, fg, curve, sun)}
# in its mission.py (missions/ams/mission.py has the four hours of level 1); Sec(id, name, hour) reads HOURS[hour].
HOURS = _M.HOURS


# ---------------------------------------------------------------- a section
class Sec:
    """One section of the level. Layers are kept in draw order; `over` layers are drawn over the hero."""

    def __init__(s, sid, name, hour):
        s.id, s.name, s.hour = sid, name, hour
        s.L = LAY[sid]
        s.W = s.L['width']
        s.cam = s.W - VIEW_W
        s.H = HOURS[hour]
        s.KEY, s.AIR = s.H['KEY'], s.H['AIR']
        s.fl = s.L['floor']['painter']['params']['layout']
        s.layers = []
        s.notes = {}
        s.planes = {}              # depth -> Layer (things standing on the floor at that depth)
        s.shades = []              # contact and cast shade on the floor: (u, depth, half width, height)
        s.hero_deck = None         # (x0, x1, y): a walk surface the hero stands on that is not terrain (a boat)

    # --- geometry
    def lw(s, sp):
        return int(math.ceil(VIEW_W + s.cam * sp)) + 1

    def at(s, x, sp):
        return 192 + (x - 192) * sp

    # --- layers
    def add(s, id_, img, speed, y=0, kind='img', over=False, **kw):
        d = dict(id=id_, img=img, speed=speed, y=y, kind=kind, over=over)
        d.update(kw)
        for im in ([img] if img is not None else []) + list(d.get('frames') or []):
            im.a[..., :3] = snap5(im.a[..., :3])           # the rule of the look: every colour on the 5-bit grid
        s.layers.append(d)
        return d

    def plane(s, depth, front=False):
        """The layer of things that stand on the floor at this depth (quantized to half a pixel). front=True: a second
           layer at the same depth that is drawn over the hero (the game's `front` decor: a counter, a railing)."""
        k = round(depth * 2) / 2 + 0.0
        key = (k, bool(front))
        if key not in s.planes:
            s.planes[key] = Layer(s.lw(s_d(k)), VIEW_H)
        return s.planes[key], k

    def put(s, part, x, depth, ax=None, base=None, shade=True, flip=False, front=False):
        """Stand a part on the floor: its anchor (ax from the left, default the middle; the bottom row) at world x and
           depth. base: the world y of the anchor at the walk line (default 176: the floor); a raised thing (a deck) is
           lifted by (176 - base) * s. front=True: drawn over the hero. Returns the plane depth used."""
        if flip:
            part = part.flip()
        Lp, k = s.plane(depth, front)
        sp = s_d(k)
        ax = part.w / 2 if ax is None else ax
        yb = GY - k if base is None else (GY - k) - (GY - base) * sp
        Lp.blit(part, s.at(x, sp) - ax, yb - part.h)
        if shade and base is None:
            s.shades.append((x - ax + part.w / 2, k, part.w / 2, part.h))
        return k

    def flush(s, grade=True):
        """Add the planes as layers, far to near; planes in front of the walk line (and front planes) go over the hero."""
        for key in sorted(s.planes, key=lambda kf: (-kf[0], kf[1])):
            k, front = key
            Lp = s.planes[key]
            if grade:
                Lp.recolor(grader(key=s.KEY)); Lp.recolor(curve(*s.H['curve']))
            s.add('d%g%s' % (k, 'f' if front else ''), Lp, s_d(k), over=(k < 0 or front), depth=k, front=front)
        s.planes = {}

    # --- the hero's surface (for the previews)
    def surface(s, x):
        t = s.L['terrain']
        for g in t['ground']:
            xs = [p['x'] if isinstance(p, dict) else p[0] for p in g]
            ys = [p['y'] if isinstance(p, dict) else p[1] for p in g]
            if xs[0] <= x <= xs[-1]:
                return float(np.interp(x, xs, ys))
        best = None
        for g in t['platforms']:
            xs = [p['x'] if isinstance(p, dict) else p[0] for p in g]
            ys = [p['y'] if isinstance(p, dict) else p[1] for p in g]
            if xs[0] <= x <= xs[-1]:
                y = float(np.interp(x, xs, ys))
                best = y if best is None else max(best, y)
        if best is None and s.hero_deck and s.hero_deck[0] <= x <= s.hero_deck[1]:
            return s.hero_deck[2]
        return best


# ---------------------------------------------------------------- sky, clouds, skyline (shared)
def sky_layers(sec, cloud_boxes=None, skyline=None, seed=3):
    H = sec.H
    S, spal = sky(VIEW_W, 156, H['sky'], n=16, seed=seed)
    sec.add('sky', S, 0)
    sec.notes['spal'] = spal
    cp = [hx(c) for c in H['cloud']]
    CL = Layer(720, 124)
    for (x, y, w, h, sd) in (cloud_boxes or [(10, 14, 170, 62, 11), (250, 34, 128, 46, 12), (470, 8, 190, 66, 16), (160, 84, 96, 26, 13),
                                              (360, 92, 120, 24, 14), (600, 88, 104, 26, 15), (-40, 96, 100, 22, 17)]):
        CL.blit(cumulus(w, h, cp, sd), x, y)
    low = Layer(720, 124); low.a = CL.a.copy(); low.clear(0, 0, 720, 80)
    low.recolor(grader(air=(sec.AIR[0], sec.AIR[1], 0.45, 0.2)))
    CL.clear(0, 80, 720, 44); CL.blit(low, 0, 0)
    sec.add('clouds', CL, 0.03, y=0, kind='tile', drift=1.2)
    return S, CL


def skyline_layer(sec, speed=0.10, yb=112, extra=None, seed=5, air=0.72):
    W1 = sec.lw(speed)
    SK = Layer(W1, VIEW_H)
    far_roofs(SK, 0, W1, yb, random.Random(seed), 12, 28)
    if extra:
        extra(SK)
    SK.recolor(grader(key=sec.KEY, air=(sec.AIR[0], sec.AIR[1], air, 0.5)))
    sec.add('skyline', SK, speed)
    return SK


# ---------------------------------------------------------------- the floor (a rows layer: one speed per screen row)
FLOOR_KINDS = ('lane', 'cobbles', 'fan', 'klinkers', 'tiles', 'gravel', 'deck', 'planks', 'grass', 'water')


def street_kind(sec, u):
    """The street material along u (the floor layout's `street` list)."""
    st = sorted(sec.fl.get('street', []), key=lambda e: e['u0'])
    out = np.full(u.shape, 'lane', dtype=object)
    for e in st:
        out[u >= e['u0']] = e['kind']
    return out


def _ramp(name):
    return np.array(R[name], np.uint8)


def _tone(base, *adds):
    t = base.astype(int)
    for a in adds:
        t = t + a
    return np.clip(t, 0, 6)


def floor_paint(sec, u, d, v, water_fn=None, extra=None):
    """The colour of every floor pixel. u: world x, d: screen depth (176 - y), v: world depth (f (1 - 1/s)).
       Daylight colours, ramps only; the grade comes after."""
    fl = sec.fl
    shp = u.shape
    rgb = np.zeros(shp + (3,), np.uint8)
    dF = pl(fl['far'], u) if fl.get('far') is not None else np.full(shp, 99.0)
    dN = pl(fl['near'], u) if fl.get('near') is not None else np.full(shp, -99.0)
    kind = street_kind(sec, u)
    PG, PR, S, BR = _ramp('pave_grey'), _ramp('pave_red'), _ramp('stone'), _ramp('brick_brown')
    h1 = lambda a, b, sd: hash01(a, b, sd)
    # ---- pavements (behind the far kerb and in front of the near kerb): grey tiles, 10 x 10 world px
    tu, tv = u / 10.0, v / 10.0
    ti, tj = np.floor(tu), np.floor(tv)
    fu, fv = tu - ti, tv - tj
    t = 4 + (h1(ti, tj, 11) > 0.74) - (h1(ti, tj, 12) > 0.80)
    st = fbm(u / 23.0, v / 9.0, 13, 3)
    t = t - ((st < 0.34) & (h1(u * 2, v * 2, 14) > 0.4))
    jt = (fu < 0.09 * (1 + 0 * fv)) | (fv < 0.10)
    t = np.where(jt, 2, t)
    t = np.where((fv >= 0.10) & (fv < 0.18) & ~jt, np.minimum(t + 1, 6), t)        # the lit edge of each tile
    pave = PG[np.clip(t, 0, 6)]
    rgb[:] = pave
    sq = np.zeros(shp, bool)                                   # a square: paved over the whole band, no kerbs
    for (q0, q1) in fl.get('squares', []) or []:
        sq |= (u >= q0) & (u < q1)
    street = ((d < dF) & (d > dN)) | sq
    # ---- the street materials
    def put(m, col):
        rgb[m] = col[m] if col.ndim == rgb.ndim else col
    # lane: red asphalt, tyre tracks, white edge lines
    m = street & (kind == 'lane')
    if m.any():
        g = h1(u * 3, v * 3, 21); n = fbm(u / 30.0, v / 6.0, 22, 2)
        t = 3 + (g > 0.86) - (g < 0.12) + (n > 0.64)
        mid = (dF + dN) / 2
        trk = (np.abs(d - (mid + (dF - mid) * 0.5)) < 1.2) | (np.abs(d - (mid + (dN - mid) * 0.5)) < 1.2)
        t = np.where(trk & (g > 0.3), np.minimum(t + 1, 5), t)
        col = PR[np.clip(t, 0, 6)]
        W_ = _ramp('white')
        edge = (np.abs(d - (dF - 1.6)) < 0.45) | (np.abs(d - (dN + 1.6)) < 0.45)
        col[edge] = W_[5]
        # a parking bay: a white dashed box on the lane under a thing that stands there (a rack, a cart)
        for (b0, b1) in fl.get('bays', []) or []:
            inb = (u >= b0) & (u <= b1) & (d <= 3.6) & (d >= -8.6)
            ln = inb & ((np.abs(u - b0) < 0.6) | (np.abs(u - b1) < 0.6) | (np.abs(d - 3.2) < 0.4) | (np.abs(d + 8.2) < 0.4))
            col[ln & (((u + d * 0.0) % 6) < 4)] = W_[5]
        # the dashed centre line
        dash = (np.abs(d - mid) < 0.35) & ((u % 24) < 12)
        col[dash] = W_[4]
        # bike symbols: every 220 px, near half rightward, far half leftward
        bk = fl.get('bikes') or {'every': 220, 'phase': 60}
        for half, ph, sgn in (('near', bk['phase'], 1), ('far', bk['phase'] + bk['every'] / 2, -1)):
            du = ((u - ph) % bk['every']) - 7.5
            dd = d - (mid + (dN - mid) * 0.5 if half == 'near' else mid + (dF - mid) * 0.5)
            vv = dd * 1.8
            r1 = np.hypot(du - 4.5 * sgn, vv - 0) - 3.2
            r2 = np.hypot(du + 4.5 * sgn, vv - 0) - 3.2
            ring = (np.abs(r1) < 0.55) | (np.abs(r2) < 0.55)
            bar = (np.abs(vv - 0) < 0.5) & (np.abs(du) < 4.5)
            col[m & (ring | bar) & (np.abs(du) < 8.5) & (np.abs(vv) < 4)] = W_[4]
        put(m, col)
    # cobbles (kinderkopjes): domed grey-brown stones in offset rows
    for kname, cu, cv, rampn in (('cobbles', 5.0, 4.0, 'stone'), ('klinkers', 6.0, 3.0, 'brick_brown'), ('deck', 6.0, 3.0, 'brick_red')):
        m = street & (kind == kname)
        if not m.any():
            continue
        Rr = _ramp(rampn)
        j = np.floor(v / cv)
        uu = u / cu + 0.5 * (j % 2)
        i = np.floor(uu)
        fu, fv = uu - i, v / cv - j
        base = 3 + (h1(i, j, 31) > 0.66) - (h1(i, j, 32) > 0.78)
        if kname == 'cobbles':
            dome = (fu - 0.42) ** 2 + (fv - 0.45) ** 2
            t = np.where(dome < 0.05, base + 1, base)
            t = np.where((fu > 0.62) & (fv > 0.55), base - 1, t)
            t = np.where((fu < 0.10) | (fv < 0.12), 1, t)
        else:
            t = np.where((fv < 0.18) & (fu > 0.05), base + 1, base)
            t = np.where((fu < 0.06) | (fv > 0.86), 1, t)
        put(m, Rr[np.clip(t, 0, 6)])
    # fan (the Pleintje): bricks laid in arcs
    m = street & (kind == 'fan')
    if m.any():
        Rr = _ramp('brick_brown')
        cu = np.floor(u / 30.0) * 30 + 15
        rr = np.hypot(u - cu, (v - 60) * 1.0)
        ri = np.floor(rr / 3.2)
        ang = np.arctan2(v - 60, u - cu) * rr / 5.0
        ai = np.floor(ang + 0.5 * (ri % 2))
        fr, fa = rr / 3.2 - ri, ang + 0.5 * (ri % 2) - ai
        base = 3 + (h1(ri, ai, 41) > 0.68) - (h1(ri, ai, 42) > 0.8)
        t = np.where(fr < 0.2, base + 1, base)
        t = np.where((fa < 0.08) | (fr > 0.84), 1, t)
        put(m, Rr[np.clip(t, 0, 6)])
    # big pale stone tiles
    m = street & (kind == 'tiles')
    if m.any():
        Rr = _ramp('stone')
        i, j = np.floor(u / 16.0), np.floor(v / 10.0)
        fu, fv = u / 16.0 - i, v / 10.0 - j
        t = (5 - (h1(i, j, 51) > 0.7)).astype(int)
        t = np.where((fu < 0.05) | (fv < 0.08), 3, t)
        put(m, Rr[np.clip(t, 0, 6)])
    m = street & (kind == 'gravel')
    if m.any():
        Rr = _ramp('gravel')
        g = h1(u * 2, v * 2, 61); n = fbm(u / 20.0, v / 5.0, 62, 2)
        put(m, Rr[np.clip(4 + (g > 0.8) - (g < 0.18) - (n < 0.38), 0, 6)])
    # ---- areas (grass, planks) with their own depth lines
    for a in fl.get('areas', []) or []:
        am = (u >= a['u0']) & (u < a['u1']) & (d <= pl(a['far'], u)) & (d >= pl(a['near'], u))
        if not am.any():
            continue
        if a['kind'] == 'grass':
            Rr = _ramp('grass'); g = h1(u * 2, v * 2, 71); n = fbm(u / 9.0, v / 3.0, 72, 2)
            t = 4 + (n > 0.6) - (n < 0.4) + (g > 0.9) - (g < 0.08)
            put(am, Rr[np.clip(t, 1, 6)])
        elif a['kind'] == 'planks':
            Rr = _ramp('white'); i = np.floor(u / 4.0); fu = u / 4.0 - i
            t = 4 + (h1(i, i, 73) > 0.7) - (h1(i, i, 74) > 0.8)
            t = np.where(fu < 0.12, 2, t)
            put(am, Rr[np.clip(t, 0, 6)])
    # ---- kerbs: the far kerb shows its lit face; the near kerb its lit top edge
    if fl.get('far') is not None:
        top = (d >= dF) & (d < dF + 1.6) & ~sq
        face = (d < dF) & (d >= dF - 1.0) & ~sq
        jn = (u % 12) < 0.5
        rgb[top] = S[6]; rgb[top & jn] = S[3]
        rgb[face] = S[2]; rgb[face & ((u % 12) < 0.5)] = S[1]
    if fl.get('near') is not None:
        top = (d <= dN) & (d > dN - 1.3) & ~sq
        rgb[top] = S[6]; rgb[top & ((u % 12) < 0.5)] = S[3]
        rgb[(d > dN) & (d <= dN + 0.5) & ~sq] = S[1]
    # ---- the quay coping at the back edge (open quays): water lies behind it
    qm = np.zeros(shp, bool)
    for (q0, q1) in fl.get('quays', []) or []:
        qm |= (u >= q0) & (u < q1)
    cop = qm & (d >= 27.0)
    rgb[cop] = S[5]
    rgb[qm & (d >= 29.2)] = S[6]
    rgb[qm & (d >= 27.0) & (d < 27.6)] = S[2]
    rgb[cop & ((u % 22) < 0.6)] = S[3]
    # ---- water: canals (cuts over the full depth) and the water under the bridges (before and behind the deck)
    wm = np.zeros(shp, bool)
    for (c0, c1) in fl.get('canals', []) or []:
        wm |= (u >= c0) & (u < c1)
    for b in fl.get('bridges', []) or []:
        w0, w1 = b['water']
        inb = (u >= w0) & (u < w1)
        wm |= inb & ((d > b['far']) | (d < b['near']))
        wm &= ~((u >= b['x0']) & (u < b['x0'] + b['len']) & (d <= b['far']) & (d >= b['near']))
    if wm.any():
        wc = water_fn(u, d, v) if water_fn else floor_water(sec, u, d, v)
        rgb[wm] = wc[wm]
        # the quay walls at the ends of a cut: two lines of brick and a lit coping
        for (c0, c1) in fl.get('canals', []) or []:
            for e, sg in ((c0, 1), (c1, -1)):
                band = (np.abs(u - e) < 2.4)
                rgb[band & wm] = BR[2]
                rgb[band & wm & ((np.floor(v / 2) % 2) == 0)] = BR[3]
                rgb[(np.abs(u - e) < 0.7) & wm] = S[5]
    if extra is not None:
        extra(u, d, v, rgb)
    return rgb


def floor_water(sec, u, d, v, frame=0):
    """Canal water seen from above: the body colour, the sky taken in toward the back, ripple bands in world space."""
    far_c, near_c = sec.H['water']
    spal = sec.notes.get('spal')
    t = np.clip((d + 40) / 72.0, 0, 1)                       # 1 at the back edge, 0 at the front
    rip = fbm((u + frame * 3) / 18.0, v / 2.6, 81, 3)
    band = np.sin(v * 1.3 + fbm(u / 40.0, v / 8.0, 82, 2) * 6 + frame * 2.1)
    val = 0.25 + 0.55 * t + (rip - 0.5) * 0.5 + band * 0.10
    pal = gradient_pal([(0, '#%02x%02x%02x' % near_c), (0.6, '#%02x%02x%02x' % far_c),
                        (1, '#%02x%02x%02x' % (spal[11] if spal else (180, 210, 225)))], 7)
    idx = tones(val, 7, u * 0.5, v * 0.5, 0.3)
    out = np.array(pal, np.uint8)[idx]
    gl = (band > 0.82) & (rip > 0.62) & (hash01(u * 2, v, 83) > 0.5)
    out[gl] = spal[13] if spal else (230, 240, 240)
    return out


def floor_layer(sec, extra=None, water_fn=None, chunk=2048):
    """Paint the floor from the back edge (146) to the bottom (216): one strip row per real screen row."""
    r0, r1 = P(BACKY), P(VIEW_H)
    ys = (np.arange(r0, r1) + 0.5) / U
    sv = s_y(ys)
    s0, s1 = float(sv[0]), float(sv[-1])
    Wl = sec.lw(s1)
    C = P(Wl)
    out = Layer(Wl, VIEW_H - BACKY)
    dcol = GY - ys
    vcol = v_y(ys)
    for c0 in range(0, C, chunk):
        c1 = min(C, c0 + chunk)
        ps = (np.arange(c0, c1) + 0.5) / U
        u = 192 + (ps[None, :] - 192) / sv[:, None]
        d = np.broadcast_to(dcol[:, None], u.shape)
        v = np.broadcast_to(vcol[:, None], u.shape)
        rgb = floor_paint(sec, u, d, v, water_fn, extra)
        # shade under the things that stand on the floor (soft contact shade; a cast shade by the sun of the hour)
        sh = np.zeros(u.shape, bool)
        kx, ky = sec.H['cast']
        for (x, k, hw, h) in sec.shades:
            if np.max(u) < x - hw - h * kx - 4 or np.min(u) > x + hw + h * kx + 4:
                continue
            e = ((u - x - min(h, 40) * kx * 0.35) / (hw + 2)) ** 2 + ((d - k + min(h, 40) * ky * 0.12) / 2.2) ** 2 <= 1
            sh |= e & chk(u * 1.0, d)
            sh |= ((u - x) / (hw * 0.8 + 1)) ** 2 + ((d - k) / 1.1) ** 2 <= 1
        if sh.any():
            px = rgb[sh].astype(float) * np.array(sec.H['shade'])
            rgb[sh] = snap5(px)
        out.a[:, c0:c1, :3] = rgb
        out.a[:, c0:c1, 3] = 255
    out.recolor(grader(key=sec.KEY)); out.recolor(curve(*sec.H['curve']))
    sec.add('floor', None, s0, y=BACKY, kind='rows', frames=[out], s0=s0, s1=s1)
    return out


# ---------------------------------------------------------------- the far canal bank and its water
def canal_far(sec, rng, YH=110, YQ=115, YW=120, speed=0.5, house=None, boats=(), trees=None, gap=None, air=0.25, seed=100, **kw):
    """The far side of the canal behind the quay (a house row on its street, the quay wall, boats) and the water
       rows from its foot to the back edge of the floor (146). Returns (far layer, far_bank info)."""
    WF = sec.lw(speed)
    F = Layer(WF, VIEW_H)
    fb = far_bank(F, rng, YH, YQ, YW, gap=gap, house=dict(house or dict(hmin=62, hmax=86)), trees=trees or dict(leaf='leaf'),
                  AIR=sec.AIR, boats=list(boats), seed=seed, **kw)
    F.recolor(grader(key=sec.KEY, air=(sec.AIR[0], sec.AIR[1], air, 0.30)))
    F.clear(0, YW + 1, F.w, F.h)
    sec.add('far', F, speed)
    return F, fb


def canal_water(sec, srcs, WF, YW=120, speed=0.5, rows=None, k=2.3, ncol=26, seed=5):
    """Rows from the far bank's foot down to the back edge of the floor, each with its own speed (far -> 0.741)."""
    rows = rows or (BACKY - YW)
    src = flatten(srcs, WF, YW + 1)
    s1 = s_d(GY - BACKY + 0.0)
    wat = water(src, YW, rows, WF, sec.lw(s1), sec.H['water'][0], sec.H['water'][1], sec.notes['spal'][12], seed=seed, k=k, ncol=ncol)
    sec.add('water', None, speed, y=YW, kind='rows', frames=wat, s0=speed, s1=s1)
    return wat


# ---------------------------------------------------------------- the compose of a preview frame (the same maths as the page)
def compose_level(sec, cx, frame=0, hero=None, overlay=False):
    out = Layer(VIEW_W, VIEW_H)
    VW = out.pw
    drawn_hero = False

    def draw_hero():
        if hero is None:
            return
        hx_ = 176
        y = sec.surface(cx + hx_)
        if y is None:
            return
        y = int(round(y))
        xx, yy = grid(hx_ - 13, y - 4, 27, 6)
        m = (((xx - hx_) / 12.5) ** 2 + ((yy - (y - 1)) / 2.6) ** 2 <= 1) & chk(xx, yy)
        out.put(hx_ - 13, y - 4, np.broadcast_to(np.array(sec.H['shadow'], np.uint8), xx.shape + (3,)), m)
        out.blit(hero, hx_ - 18, y - 46)

    for ly in [l for l in sec.layers if not l.get('over')] + [l for l in sec.layers if l.get('over')]:
        if ly.get('over') and not drawn_hero:
            draw_hero(); drawn_hero = True
        k = ly['kind']
        if k in ('img', 'frames'):
            im = ly['img'] if k == 'img' else ly['frames'][frame % len(ly['frames'])]
            ox = int(cx * ly['speed'] * U)
            seg = im.a[:, ox:ox + VW]
            out.put(0, ly['y'], seg[..., :3], seg[..., 3] > 0)
        elif k == 'tile':
            im = ly['img']
            ox = int((cx * ly['speed']) * U) % im.pw
            a = np.concatenate([im.a[:, ox:], im.a[:, :ox]], 1)[:, :VW]
            out.put(0, ly['y'], a[..., :3], a[..., 3] > 0)
        elif k == 'rows':
            im = ly['frames'][frame % len(ly['frames'])]
            n = im.ph
            y0 = P(ly['y'])
            for j in range(n):
                sp = ly['s0'] + (ly['s1'] - ly['s0']) * j / max(n - 1, 1)
                ox = int(cx * sp * U)
                seg = im.a[j, ox:ox + VW]
                if seg.shape[0] < VW:
                    continue
                m = seg[:, 3] > 0
                out.a[y0 + j, :, :3][m] = seg[:, :3][m]
                out.a[y0 + j, :, 3] = 255
    if not drawn_hero:
        draw_hero()
    if overlay:
        draw_overlay(out, sec, cx)
    return out


def draw_overlay(out, sec, cx):
    """The game's layout over the art: ground (yellow), platforms (cyan), water (blue frame)."""
    t = sec.L['terrain']
    for g, col in [(g, (255, 220, 0)) for g in t['ground']] + [(g, (0, 240, 255)) for g in t['platforms']]:
        pts = [(p['x'], p['y']) if isinstance(p, dict) else tuple(p) for p in g]
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            out.line(x0 - cx, y0, x1 - cx, y1, col, t=1)
    for hz in t['hazards']:
        x0 = hz['x'] - cx
        out.hl(x0, hz['y'], hz['w'], (40, 120, 255)); out.vl(x0, hz['y'], hz['h'], (40, 120, 255)); out.vl(x0 + hz['w'] - 1, hz['y'], hz['h'], (40, 120, 255))
    for so in t['solids']:
        x0 = so['x'] - cx
        out.hl(x0, so['y'], so['w'], (255, 80, 80)); out.hl(x0, so['y'] + so['h'] - 1, so['w'], (255, 80, 80))


def decor(sec, pred=None):
    """The decor items of the section (from the game), optionally filtered by sprite id prefix or a function."""
    items = sec.L['decor']
    if pred is None:
        return items
    if isinstance(pred, str):
        return [d for d in items if d['sprite'].startswith(pred)]
    return [d for d in items if pred(d)]


def rows_of(sec, name_part):
    return [r for r in (sec.L['floor']['rows'] or []) if name_part in (r.get('name') or '')]


def preview(sec, cams=None, tag=None):
    """Write three frames (left, middle, right camera, or the given ones) with the hero, and one with the layout."""
    run, idle = hero_frames()
    cams = cams or (0, sec.cam // 2, sec.cam)
    os.makedirs('out', exist_ok=True)
    tag = tag or sec.id
    for i, cx in enumerate(cams):
        save(compose_level(sec, cx, 0, run[(i * 3) % len(run)]), f'out/l1{tag}-{i}-u{U}.png', 1)
    save(compose_level(sec, cams[len(cams) // 2], 0, run[0], overlay=True), f'out/l1{tag}-layout-u{U}.png', 1)
