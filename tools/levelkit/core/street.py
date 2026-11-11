# The straight street (first made for level 1, mission ams; the user, 2026-11-11: "bent bike path, light poles that intersect the street ...").
#
# The game's floor layout (the dump, work/<mission>/layout.json) bends the kerbs around everything that stands on the walk line ("bulbs")
# and crosses the street with slanted bands. This module rewrites the layout the kit paints from:
#   - both kerbs are straight lines for the whole level: the far kerb at depth FAR, the near kerb at depth NEAR;
#   - a kerb changes its depth only at a hard break (a bridge, water, a building corner), as a square corner;
#   - a square (`squares`: [u0, u1]) is paved over the whole band: no kerbs, no pavements;
#   - the street surface changes along straight lines across the street (no slanted crossing);
#   - street furniture stands on a pavement: lamps on the far kerb side (LAMP_D), nothing in the lane;
#   - the Amsterdammertjes stand on the kerbstones of both kerbs, in even rows.
# Play does not change: hitbox objects (crates, stalls, carts, racks, hostages, secrets, perched gulls) keep their
# x and stay on the walk line. `bays` ([u0, u1]) paint a white parking bay on the lane under such an object.
# The game's layout files get the same numbers when the art is ported.
INF = 10 ** 9
FAR, NEAR = 5.0, -16.3            # the street between the kerbs: screen y 171 .. 192.3; the hero walks at depth 0
BACK_ROW, FRONT_ROW = 6.2, -18.4  # the post rows: on the granite of the far kerb and of the near kerb
LAMP_D = 7.5                      # kerbside lamps (a perched gull follows its lamp by a render-only shift)
RACK_D = -22.0                    # decor bike racks: on the near pavement
LAMP_H, LAMP_GREY_H = 72, 84      # as tall as the game's lamps: a gull perches at 70 px (the lantern's cap)

# The mission's tables (missions/<id>/mission.py, read when apply() / checks() run):
#   STREET      {section id: dict(street=[(u0, kind), ...], squares, bays, trees, norows, far, near, keep_rows) | None}
#               (a section that is not listed, or None, keeps the game's floor layout and gets no street gates)
#   STREET_IDS  the game's sprite ids the rules move: lamp (the kerbside lamp; one with depth None stands at 0 first),
#               lamp_tall, lamp_prefix (every lamp id: the post rows keep clear of them), tree (a tree the `trees` of a
#               section moves), rack (a front bike rack goes to RACK_D), post_prop (the floor rows' prop id of a post)
#   FURNITURE   the sprite ids the gate "no furniture between the kerbs" checks
# A section's own corrections: street_<section id>.py in the mission folder, fix(L, fl), called after the rules.


def _mission():
    import mission
    return mission

def _in(x, spans):
    return any(a <= x <= b for (a, b) in spans)


def apply(LAY):
    M = _mission()
    STREET = getattr(M, 'STREET', {})
    ids = getattr(M, 'STREET_IDS', {})
    for sid, S in STREET.items():
        if S is None:
            continue
        L = LAY[sid]
        fl = L['floor']['painter']['params']['layout']
        W = L['width']
        fl['far'] = S.get('far', FAR)
        fl['near'] = S.get('near', NEAR)
        fl['bulbs'] = []
        fl['crossings'] = []
        fl['street'] = [dict(u0=u, kind=k) for (u, k) in S['street']]
        fl['squares'] = [list(s) for s in S.get('squares', [])]
        fl['bays'] = [list(b) for b in S.get('bays', [])]
        for b in fl.get('bridges') or []:
            b['far'], b['near'] = FAR, NEAR
        sq = S.get('squares', [])
        # ---- the furniture
        for d in L['decor']:
            sid_, dep, x = d['sprite'], d['floorDepth'], d['x']
            if sid_ in (ids['lamp'], ids['lamp_tall']):
                if dep is None and sid_ == ids['lamp']:
                    dep = 0
                if dep is not None and not _in(x, sq):
                    d['floorDepth'] = LAMP_D
            elif sid_ == ids['tree'] and x in S.get('trees', {}):
                d['floorDepth'] = S['trees'][x]
            elif sid_ == ids['rack'] and d.get('front'):
                d['floorDepth'] = RACK_D
        if S.get('keep_rows'):
            continue
        # ---- the post rows: even rows on both kerbs, outside bridges, water, squares, lamps and bays
        lamps = [d['x'] for d in L['decor'] if d['sprite'].startswith(ids['lamp_prefix']) and d['floorDepth'] == LAMP_D]
        stop = [(a - 6, b + 6) for (a, b) in sq] + [(a - 4, b + 4) for (a, b) in S.get('norows', [])]
        for b in fl.get('bridges') or []:
            stop.append((b['x0'] - 10, b['x0'] + b['len'] + 10))
        for (c0, c1) in fl.get('canals') or []:
            stop.append((c0 - 30, c1 + 30))
        rows = [r for r in (L['floor']['rows'] or []) if r.get('prop') != ids['post_prop']]
        back = [x for x in range(26, W - 8, 36) if not _in(x, stop) and not any(abs(x - lx) < 9 for lx in lamps)]
        front = [x for x in range(44, W - 8, 72) if not _in(x, stop) and not _in(x, [(a - 6, b + 6) for (a, b) in S.get('bays', [])])]
        rows.append(dict(name='back poles', prop=ids['post_prop'], depth=BACK_ROW, scale=1.1, at=back))
        rows.append(dict(name='front poles', prop=ids['post_prop'], depth=FRONT_ROW, scale=1.1, at=front))
        L['floor']['rows'] = rows
    # ---- the section's own corrections (street_<id>.py in the mission folder, owned by the section's painter): fix(L, fl)
    import importlib
    for sid, S in STREET.items():
        try:
            m = importlib.import_module('street_' + sid)
        except ModuleNotFoundError:
            continue
        m.fix(LAY[sid], LAY[sid]['floor']['painter']['params']['layout'])
    return LAY


def line_ok(pts):
    """A kerb line is straight: one number, or flat pieces joined by square steps (at most 1 px of u per step)."""
    if isinstance(pts, (int, float)):
        return True
    for (u0, d0), (u1, d1) in zip(pts, pts[1:]):
        if d0 != d1 and (u1 - u0) > 1.0:
            return False
    return True


def checks(sec):
    """The street gates (check_level.py adds them to every section that has a street)."""
    fl = sec.fl
    M = _mission()
    if getattr(M, 'STREET', {}).get(sec.id) is None:
        return []
    FURNITURE = getattr(M, 'FURNITURE', ())
    post = M.STREET_IDS['post_prop']
    out = []
    out.append(('street: both kerb lines are straight (square steps only)', line_ok(fl.get('far')) and line_ok(fl.get('near')), 'far %s near %s' % (
        fl.get('far') if isinstance(fl.get('far'), (int, float)) else 'steps', fl.get('near') if isinstance(fl.get('near'), (int, float)) else 'steps')))
    out.append(('street: no bulbs, no slanted crossings', not fl.get('bulbs') and not fl.get('crossings'), '%d / %d' % (len(fl.get('bulbs') or []), len(fl.get('crossings') or []))))
    import numpy as np
    from level import pl
    sq = fl.get('squares') or []
    bad = []
    for d in sec.L['decor']:
        dep = d['floorDepth']
        if dep is None or d['sprite'] not in FURNITURE or _in(d['x'], sq):
            continue
        f = float(pl(fl['far'], np.array([d['x']]))[0]); n = float(pl(fl['near'], np.array([d['x']]))[0])
        if n < dep < f:
            bad.append('%s@%d d%g' % (d['sprite'].split('/')[-1], d['x'], dep))
    out.append(('street: no furniture between the kerbs (outside a square)', not bad, ', '.join(bad) or 'ok'))
    bad = []
    for r in sec.L['floor']['rows'] or []:
        if r.get('prop') == post:
            for x in (r.get('at') or []):
                f = float(pl(fl['far'], np.array([x]))[0]); n = float(pl(fl['near'], np.array([x]))[0])
                if not (0 <= r['depth'] - f <= 1.8 or 0 <= n - r['depth'] <= 2.3):
                    bad.append('%d d%g' % (x, r['depth']))
    out.append(('street: every Amsterdammertje stands on a kerbstone', not bad, ', '.join(bad[:8]) or 'ok'))
    return out
