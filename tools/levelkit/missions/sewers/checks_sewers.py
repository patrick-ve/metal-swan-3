# The rules of the place of mission `sewers` as gate functions (docs/design/sewers.md §2 and §6, the look sheet's
# "Rules of the place"; grammar rule 9 of docs/design/level-guide/look.md: a rule of a place is a gate with a number).
# A section module calls the ones that touch it in checks(sec) and returns their results with its own:
#
#     import checks_sewers as cs
#     def checks(sec):
#         return cs.street_rules(sec) + [... the section's own ...]          # a, b (end: cs.end_rules)
#         return cs.sewer_rules(sec) + [...]                                  # c, d, e (both stacks)
#
# Each function returns a list of (name, ok, value), as check_level.py prints them. What a gate reads:
#   sec.notes['gf_lines']  [(layer id, x0, x1, gf top row)]: the fronts' ground floors (parts_wallen.light_fronts)
#   sec.notes['rooms']     [(layer id, box)]: every lit room behind glass (closed curtains)
#   sec.notes['words']     [(word, where)]: every word painted (neon, plates, signs)
#   sec.notes['fronts']    [(layer id, [(x, w), ...])]: the rows of fronts (or bays, arches) that must tile
#   sec.notes['band']      (near depth, far depth) of the walk band; sec.notes['band_ok'] layer ids allowed on it
#   sec.notes['shafts'], ['info'] (carriers, bays), ['fat_holes']: the sewer's (as sw_d.py of the look sample)
# The checks of the approved look sample (missions/sewers-look/sw_d.py checks 1-4, scene4.py's red rule) are reused
# here in general form.
import os
import numpy as np
from level import *

# Lettering that never appears (the user: no BAR, CAFE or LIVE signs in De Wallen; spec §8: no real names or brands,
# nothing of sex or drugs on a sign). A painted word fails if it CONTAINS one of these.
BANNED = ('BAR', 'CAFE', 'LIVE', 'XXX', 'SEX', 'PEEP', 'SHOW', 'COFFEE', 'KOFFIE', 'SMART', 'WEED', 'HASJ',
          'HEINEKEN', 'AMSTEL', 'GROLSCH', 'BAVARIA', 'BULLDOG', 'ROSSO', 'MOULIN', 'BANANEN', 'CASINO', 'COCA',
          'PEPSI', 'REDLIGHT', 'RED LIGHT', 'EROTIC', 'EROTIEK')


def _layer(sec, lid):
    for l in sec.layers:
        if l['id'] == lid:
            return l
    return None


def _imgs(l):
    return ([l['img']] if l.get('img') is not None else []) + list(l.get('frames') or [])


def is_red(a):
    """Red light (scene4.py's rule): strong red, little green, much more red than blue."""
    a = a.astype(int)
    return (a[..., 3] > 0) & (a[..., 0] > 150) & (a[..., 1] < 130) & (a[..., 0] - a[..., 2] > 40)


# ---------------------------------------------------------------- the street (a, b) and the dawn (end)
def red_above_gf(sec):
    """Red light only on the ground floor: red pixels above each front's ground floor (inside its slot), in the layer
       the front stands in; also any red pixel above the highest ground floor of a front layer. 0 to pass."""
    lines = sec.notes.get('gf_lines', [])
    n = 0
    by_layer = {}
    for (lid, x0, x1, gt) in lines:
        by_layer.setdefault(lid, []).append((x0, x1, gt))
    for lid, ls in by_layer.items():
        l = _layer(sec, lid)
        if l is None:
            continue
        y0 = P(l.get('y', 0))
        for im in _imgs(l):
            red = is_red(im.a)
            for (x0, x1, gt) in ls:
                r = red[:max(0, P(gt) - y0), max(0, P(x0)):P(x1)]
                n += int(r.sum())
    return [('red light only on the ground floor: red px above it (%d fronts)' % len(lines), n == 0 and len(lines) > 0, n)]


def window_figures(sec):
    """No window figures (sex workers are never shown): inside every lit room's glass only the tube and the closed
       curtain's colours (parts_wallen.GLASS_RED). Any other colour there counts as a figure pixel. 0 to pass."""
    from parts_wallen import GLASS_RED
    ok_cols = np.array(sorted(GLASS_RED), np.int64)
    key = lambda a: (a[..., 0].astype(np.int64) << 16) | (a[..., 1].astype(np.int64) << 8) | a[..., 2]
    okk = key(ok_cols[None])[0]
    n, rooms = 0, sec.notes.get('rooms', [])
    for (lid, (x, y, w, h)) in rooms:
        l = _layer(sec, lid)
        if l is None:
            continue
        y0 = P(l.get('y', 0))
        fronts = sec.notes.get('front_imgs', {}).get(lid)                # the fronts before trees and walkers
        for im in ([fronts] if fronts is not None else _imgs(l)):
            v = im.a[max(0, P(y) - y0):P(y + h) - y0, P(x):P(x + w)]
            m = v[..., 3] > 0
            n += int((m & ~np.isin(key(v), okk)).sum())
    return [('no window figures: foreign px inside %d lit rooms (closed curtains only)' % len(rooms), n == 0, n)]


def lettering(sec):
    """No banned lettering: every word the section painted (sec.notes['words']) is free of the BANNED list."""
    words = sec.notes.get('words', [])
    bad = [w for (w, _) in words if any(b in w.upper() for b in BANNED)]
    return [('no banned lettering (BAR, CAFE, LIVE, real names): %d words' % len(words), not bad,
             ', '.join(bad) or ' '.join(sorted(set(w for (w, _) in words))) or 'none')]


def fronts_tile(sec, key='fronts', what='fronts'):
    """Rows tile (grammar rule 4): in each row, front j ends exactly where front j+1 starts, at this tier's real
       pixels (the blit floors each left edge). Overlap 0 px and gap 0 px."""
    rows = sec.notes.get(key, [])
    ov, gap, n = 0.0, 0.0, 0
    for (_, slots) in rows:
        for a, b in zip(slots, slots[1:]):
            d = (P(a[0]) + a[1] * U - P(b[0])) / U
            ov, gap = max(ov, d), max(gap, -d)
            n += 1
    return [('%s tile: no %s hides another (overlap 0 px, gap 0 px), %d joins' % (what, what[:-1], n), ov == 0 and gap == 0 and n > 0,
             'overlap %g, gap %g' % (ov, gap))]


def band_clear(sec):
    """Nothing of the furniture on the walk band (grammar rule 2): no painted plane between the band's borders but
       the layers listed in sec.notes['band_ok'] (play: the entities' carriers, decks)."""
    near, far = sec.notes.get('band', (sec.fl.get('near') if isinstance(sec.fl.get('near'), (int, float)) else -40,
                                       sec.fl.get('far') if isinstance(sec.fl.get('far'), (int, float)) else 6))
    ok = set(sec.notes.get('band_ok', ()))
    bad = [l['id'] for l in sec.layers if l.get('depth') is not None and near < l['depth'] < far and l['id'] not in ok
           and any(im.mask().any() for im in _imgs(l))]
    return [('nothing stands on the walk band (depth %g .. %g) but play' % (near, far), not bad, ', '.join(bad) or 'ok')]


def street_rules(sec):
    """The rules of the place of a and b (spec §2.1, §2.2)."""
    return red_above_gf(sec) + window_figures(sec) + lettering(sec) + fronts_tile(sec) + band_clear(sec)


def end_rules(sec):
    """end: no neon, no red rooms at dawn; lettering; the fronts tile."""
    red = 0
    for l in sec.layers:
        for im in _imgs(l):
            red += int(is_red(im.a).sum())
    return [('dawn: no red light anywhere', red == 0, red)] + lettering(sec) + fronts_tile(sec) + band_clear(sec)


# ---------------------------------------------------------------- the sewer (c, d, e; both stacks)
def cover(sec, cx):
    """Which screen pixels some layer paints at camera cx (sw_d.py's _cover)."""
    cov = np.zeros((P(VIEW_H), P(VIEW_W)), bool)
    VW = P(VIEW_W)
    for ly in sec.layers:
        k = ly['kind']
        if k in ('img', 'frames'):
            im = ly['img'] if k == 'img' else ly['frames'][0]
            ox = int(cx * ly['speed'] * U)
            seg = im.a[:, ox:ox + VW, 3] > 0
            y0 = P(ly['y'])
            cov[y0:y0 + seg.shape[0], :seg.shape[1]] |= seg[:cov.shape[0] - y0]
        elif k == 'rows':
            im = ly['frames'][0]
            y0 = P(ly['y'])
            for j in range(im.ph):
                sp = ly['s0'] + (ly['s1'] - ly['s0']) * j / max(im.ph - 1, 1)
                ox = int(cx * sp * U)
                seg = im.a[j, ox:ox + VW, 3] > 0
                cov[y0 + j, :len(seg)] |= seg
        elif k == 'tile':
            cov[P(ly['y']):P(ly['y']) + ly['img'].ph] |= (ly['img'].a[..., 3] > 0).any()
    return cov


def cams5(sec):
    return [0, sec.cam // 4, sec.cam // 2, 3 * sec.cam // 4, sec.cam]


def no_sky(sec, y_band=160):
    """No sky in the sewer: no layer of the sky family (sky, clouds, skyline) and no unpainted pixel above the walk
       band (y < y_band) at five cameras."""
    skyish = [l['id'] for l in sec.layers if l['id'] in ('sky', 'clouds', 'skyline') or l['id'].startswith('sky')]
    worst = 0
    for cx in cams5(sec):
        worst = max(worst, int((~cover(sec, cx)[:P(y_band)]).sum()))
    return [('no sky in the sewer: sky layers %d, unpainted px above y %d (5 cameras)' % (len(skyish), y_band),
             not skyish and worst == 0, '%d px' % worst)]


def shafts_under_grates(sec):
    """Every light shaft hangs under a painted grate (sw_d.py check 3): grate or shaft light within 3 px above the top
       of each shaft at its centre column, at every camera where it is on screen. sec.notes['shafts'] =
       [(layer id, speed, world x, top y)]."""
    from parts_sewers import grate_cols
    H = sec.H
    S = [tuple(int(v) for v in snap5(c)) for c in H['em']['shaft'] + list(grate_cols(H))]
    bad, n = [], 0
    for cx in cams5(sec):
        fr = compose_level(sec, cx)
        for (lid, sp, u, yt) in sec.notes.get('shafts', []):
            x = 192 + (u - 192 - cx) * sp
            if not (4 <= x < VIEW_W - 4):
                continue
            n += 1
            col = fr.a[max(0, P(yt - 3)):P(yt + 0.5), P(x - 1.5):P(x + 1.5), :3].reshape(-1, 3)
            if not any(tuple(int(v) for v in c) in S for c in col):
                bad.append('%s@%d cam %d' % (lid, u, cx))
    return [('every light shaft falls from a painted grate (5 cameras)', not bad, ', '.join(bad[:4]) or '%d shafts seen' % n)]


def eyes_in_carriers(sec, y_water=None):
    """Every red eye sits in a carrier (sw_d.py check 4): eye-rim pixels of the composed frame (above the water, whose
       rows hold their mirror) lie in a pipe mouth, a side tunnel, a crack or a fatberg rat hole. Carriers:
       sec.notes['info']['carriers'] [(kind, plane x, y, r)] on the far wall (S_W), sec.notes['fat_holes'], and
       sec.notes['carriers_px'] [(screen-space fn(cx) -> bool mask)] for a section's own (cracks, pipe stubs)."""
    from parts_sewers import S_W, YW
    yw = YW if y_water is None else y_water
    H = sec.H
    ecol = np.array(snap5(H['em']['eye'][1]), np.uint8)
    info = sec.notes.get('info', {})
    bad, n = 0, 0
    for cx in cams5(sec):
        fr = compose_level(sec, cx)
        eye = np.all(fr.a[..., :3] == ecol, axis=-1)
        eye[P(yw):] = False
        car = np.zeros(eye.shape, bool)
        yy, xx = np.mgrid[0:eye.shape[0], 0:eye.shape[1]]
        lx, ly_ = (xx + 0.5) / U, (yy + 0.5) / U
        for (hx_, hy_, rx_, ry_, sp_) in sec.notes.get('fat_holes', []):
            car |= (((lx - (hx_ - cx * sp_)) / rx_) ** 2 + ((ly_ - hy_) / ry_) ** 2) <= 1.05
        for (kind, pc, cy, r) in info.get('carriers', []):
            x = pc - cx * S_W
            if kind == 'pipe':
                car |= np.hypot(lx - x, ly_ - cy) <= r + 0.6
            else:
                spring = cy + r
                car |= (np.abs(lx - x) <= r) & ((ly_ >= spring) | (np.hypot(lx - x, ly_ - spring) <= r)) & (ly_ < yw)
        for fn in sec.notes.get('carriers_px', []):
            car |= fn(cx)
        n += int(eye.sum())
        bad += int((eye & ~car).sum())
    return [('every red eye in a carrier (pipe mouth, side tunnel, crack, rat hole), 5 cameras', bad == 0 and n > 0,
             '%d of %d eye px outside' % (bad, n))]


def bays_tile(sec):
    """The far wall's bays tile and cover the plane (sw_d.py check 1)."""
    info = sec.notes.get('info', {})
    bays = info.get('bays', [])
    if not bays:
        return [('far-wall bays tile (overlap 0 px)', False, 'no bays recorded')]
    ov = [a[0] + a[1] - b[0] for a, b in zip(bays, bays[1:])]
    Fw = _layer(sec, 'far')['img'].w
    return [('far-wall bays tile: no bay paints into its neighbour (overlap 0 px)', all(o == 0 for o in ov) and bays[-1][0] + bays[-1][1] >= Fw,
             'max overlap %g, max gap %g, %d bays to %g of %g' % (max(ov + [0]), max([-o for o in ov] + [0]), len(bays), bays[-1][0] + bays[-1][1], Fw))]


def same_as_sample(sec):
    """The sewer's hour tables are the approved look sample's (missions/sewers-look/mission.py): c, d = v2, cl, dl =
       v2l; e and el the same KEY / AIR / lights (e only adds the crack emitters)."""
    import importlib.util
    p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'sewers-look', 'mission.py')
    spec = importlib.util.spec_from_file_location('sewers_look_mission', p)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    want = {'c': 'v2', 'd': 'v2', 'e': 'v2', 'cl': 'v2l', 'dl': 'v2l', 'el': 'v2l'}.get(sec.hour)
    if want is None:
        return []
    a, b = dict(sec.H), dict(m.HOURS[want])
    ea, eb = a.pop('em'), b.pop('em')
    ok = a == b and all(ea[k] == eb[k] for k in eb)
    return [('hour %s = the approved sample\'s %s (V2 BLACK tables)' % (sec.hour, want), ok, 'same' if ok else 'DIFFERS')]


def sewer_rules(sec):
    """The rules of the place of c, d, e (spec §6: closed above the walkway, every shaft under a painted grate, every eye
       in a carrier, bays tile) and the approved hour."""
    return no_sky(sec) + shafts_under_grates(sec) + eyes_in_carriers(sec) + bays_tile(sec) + band_clear(sec) + same_as_sample(sec)
