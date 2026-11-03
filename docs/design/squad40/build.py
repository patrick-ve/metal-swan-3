# Export every sprite (cropped, with anchors) at 1x (384x216 grid) and 2x (768x432 grid), plus the
# stage sprites per grid, the viewer sequences and the numbers for the page.
import json, math, os, sys
import hero
import ext
from rig import Canvas, PAL, HERO, RX, RY, scale2x
from pose import compose
import parts as P1
import anims as A


def bbox(rows):
    ys = [y for y, r in enumerate(rows) if r.strip('.')]
    xs = [x for r in rows for x, ch in enumerate(r) if ch != '.']
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1


def cut(rows, ax, ay):
    x0, y0, x1, y1 = bbox(rows)
    return [r[x0:x1] for r in rows[y0:y1]], ax - x0, ay - y0


def outlined(rows):
    w = max(len(r) for r in rows) + 4
    cv = Canvas(w, len(rows) + 4)
    cv.grid(2, 2, rows, 1, 'x')
    r = cv.finish()
    x0, y0, x1, y1 = bbox(r)
    return [s[x0:x1] for s in r[y0:y1]]


def up2(rows):
    w = max(len(r) for r in rows)
    return [''.join(r) for r in scale2x([list(r.ljust(w, '.')) for r in rows])]


def hsh(x, y, k):
    v = math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453
    return v - math.floor(v)


def booms(S):
    out = []
    for k, (R, core, smoke) in enumerate([(3, 1.0, 0), (6, 0.8, 0), (9, 0.6, 0), (11, 0.35, 0.3), (12, 0.15, 0.6),
                                          (12, 0, 0.85), (12, 0, 1.0), (11, 0, 1.0)]):
        R *= S
        n = 27 * S
        g = [['.'] * n for _ in range(n)]
        c = n // 2
        for y in range(n):
            for x in range(n):
                dx, dy = x - c, (y - c) * 1.1
                d = math.hypot(dx, dy) + (hsh(x // S if S > 1 and k < 3 else x, y // S if S > 1 and k < 3 else y, 1) - 0.5) * 2.4 * S
                if d > R:
                    continue
                t = d / max(R, 1)
                if k >= 5 and hsh(x, y, k) < 0.18 + 0.12 * (k - 5):
                    continue
                if smoke > 0 and (t > 1 - smoke or k >= 5):
                    ch = 'D' if (dy < -S and hsh(x, y, 3) > 0.35) else 'd'
                elif t < core * 0.6:
                    ch = 'W'
                elif t < core:
                    ch = 'F'
                elif t < 0.75:
                    ch = 'f'
                elif t < 0.9:
                    ch = 'c'
                else:
                    ch = 'e'
                g[y][x] = ch
        out.append([''.join(r) for r in g])
    return out


TARGET = [
  "..TTTTT..",
  ".TRRRRRT.",
  "TRRTTTRRT",
  "TRTRRRTRT",
  "TRTRTRTRT",
  "TRTRRRTRT",
  "TRRTTTRRT",
  ".TRRRRRT.",
  "..TTTTT..",
  "....q....",
  "....j....",
  "....j....",
  "....j....",
  "....q....",
  "....j....",
  "....j....",
  "...qjq...",
  "..qjjjq..",
  ".qqqqqqq.",
]
DUST = [["..D..", ".DdD.", "Dd.dD"], [".D...D.", "Dd.D.dD", ".d...d."], ["D.....D", ".......", "d.....d"]]


# the 12 core groups; the extension sets (ext.py) are exported at 1x only
CORE = {'upper': set('idle fidget run jump shoot aimup shootup aimdown shootdown crouchidle crouchshoot grenade slash stab'.split()),
        'lower': set('stand run jump jumprun crouchdown crouch crawl'.split()), 'full': {'death'}}


def keep(kind, name, S):
    return S == 1 or name in CORE[kind]


def is_melee(name):
    return name.endswith('slash') or name.endswith('stab')


def stage_frames(S):
    """The shared stage sprites of the extension sets (parts.STAGE), 1x only, with all anchors."""
    out = {}
    for name, frames in getattr(P1, 'STAGE', {}).items():
        L = []
        for rows, an in frames:
            r, ax, ay = cut(rows, an['c'][0], an['c'][1])
            x0, y0, _, _ = bbox(rows)
            f = {'r': r, 'ax': ax, 'ay': ay}
            pts = {k: [v[0] - x0, v[1] - y0] for k, v in an.items() if k != 'c'}
            if pts:
                f['pt'] = pts
            L.append(f)
        out[name] = L
    return out


def export(S):
    out = {'upper': {}, 'lower': {}, 'full': {}, 'stage': {}}
    used = set()
    for name, seq in A.LOWER.items():
        if not keep('lower', name, S):
            continue
        L = []
        for p, t in seq:
            rows, meta = compose(p, 'lower', S)
            r, ax, ay = cut(rows, RX * S, RY * S)
            used |= set(''.join(r))
            pel = [round((meta['pel'][0] - RX) * S), round((meta['pel'][1] - RY) * S)]
            L.append({'r': r, 'ax': ax, 'ay': ay, 't': t, 'pel': pel})
        out['lower'][name] = L
    for name, seq in A.UPPER.items():
        if not keep('upper', name, S):
            continue
        U = []
        for p, t in seq:
            p = dict(p); p['pelvis'] = (0, -17)
            rows, meta = compose(p, 'upper', S)
            px, py = meta['pel']
            r, ax, ay = cut(rows, px * S, py * S)
            used |= set(''.join(r))
            f = {'r': r, 'ax': ax, 'ay': ay, 't': t}
            mz = meta.get('armN', {}).get('muzzle')
            if mz:
                f['mz'] = [round((mz[0] - px) * S), round((mz[1] - py) * S)]
            wr = meta.get('armF', {}).get('wrist')
            if wr:
                f['rel'] = [round((wr[0] - px) * S), round((wr[1] - py) * S)]
            shots = []
            for name_, at in p.get('fx', []):
                if name_ in A.SHOT_FX and isinstance(at[0], str) and meta.get(at[0], {}).get('muzzle'):
                    m = meta[at[0]]['muzzle']
                    sh = [round((m[0] - px) * S), round((m[1] - py) * S)]
                    if name_ in getattr(A, 'SHOT_DIR', {}):
                        sh.append(A.SHOT_DIR[name_])
                    shots.append(sh)
            if shots:
                f['shots'] = shots
            if is_melee(name) and p.get('fx') and not any(x.get('hit') for x in U):
                f['hit'] = 1                 # the first melee frame with an effect: the page counts the hit here
            br, _ = compose(p, 'back', S)
            if br:
                b, bx, by = cut(br, px * S, py * S)
                f['bk'] = {'r': b, 'ax': bx, 'ay': by}
            U.append(f)
        out['upper'][name] = U
    for name, seq in A.FULL.items():
        if not keep('full', name, S):
            continue
        F = []
        for p, t in seq:
            rows, meta = compose(p, 'full', S)
            r, ax, ay = cut(rows, RX * S, RY * S)
            used |= set(''.join(r))
            F.append({'r': r, 'ax': ax, 'ay': ay, 't': t})
        out['full'][name] = F
    st = out['stage']
    sc = (lambda r: r) if S == 1 else up2
    st['gren'] = [outlined(sc(P1.ITEMS[k][0])) for k in ('gren0', 'gren1', 'gren2', 'gren3')]
    st['boom'] = booms(S)
    st['dust'] = [sc(d) for d in DUST]
    t0 = outlined(sc(TARGET))
    st['target'] = [t0, [''.join('T' if ch == 'R' else ('W' if ch == 'T' else ch) for ch in r) for r in t0]]
    if S == 1 and hero.NAME == 'vincent':
        out['stage2'] = stage_frames(S)
    # numbers
    size = lambda f: [len(f['r'][0]), len(f['r'])]
    lo = out['lower']['stand'][0]; up = out['upper']['idle'][0]
    ucol = set(); lcol = set(); xcol = set()
    for k, v in out['upper'].items():
        for f in v:
            (ucol if k in CORE['upper'] else xcol).update(set(''.join(f['r'])) & HERO)
    for k, v in out['lower'].items():
        for f in v:
            (lcol if k in CORE['lower'] else xcol).update(set(''.join(f['r'])) & HERO)
    for k, v in out['full'].items():
        for f in v:
            xcol.update(set(''.join(f['r'])) & HERO)
    stats = {'idle_upper': size(up), 'stand_lower': size(lo), 'height': -lo['pel'][1] + up['ay'] + 1,
             'upper_colours': len(ucol), 'lower_colours': len(lcol), 'all_colours': len(ucol | lcol | xcol),
             'frames': {k: len(v) for k, v in {**out['upper'], **out['lower'], **out['full']}.items()}}
    return out, stats


def groups():
    U, L = A.UPPER, A.LOWER
    def st_(u, ui, l, li, t=None):
        tt = t if t is not None else (U[u][ui][1] if u else L[l][li][1])
        return {'u': [u, ui] if u else None, 'l': [l, li] if l else None, 't': tt}
    n = lambda k: len(U[k])
    nl = lambda k: len(L[k])
    G = []
    G.append(('Idle', 4, [st_('idle', k, 'stand', 0) for k in range(n('idle'))]))
    G.append(('Idle fidget', '8–18', [st_('fidget', k, 'stand', 0) for k in range(n('fidget'))]))
    G.append(('Run', '12 + 12', [st_('run', k % n('run'), 'run', k % nl('run')) for k in range(max(n('run'), nl('run')))]))
    G.append(('Jump', '6–7', [st_('jump', k % n('jump'), 'jump', k, L['jump'][k][1]) for k in range(nl('jump'))] + [st_(None, 0, 'stand', 0, 12)] +
              [st_('jump', k % n('jump'), 'jumprun', k, L['jumprun'][k][1]) for k in range(nl('jumprun'))] + [st_(None, 0, 'stand', 0, 12)]))
    nc, nw = n('crouchidle'), nl('crawl')
    G.append(('Crouch', '– / 4 / 7', [st_('crouchidle', 0, 'crouchdown', k, 3) for k in range(nl('crouchdown'))] +
              [st_('crouchidle', k, 'crouch', 0, U['crouchidle'][k][1]) for k in range(nc)] +
              [st_('crouchidle', k % nc, 'crawl', k % nw, L['crawl'][k % nw][1]) for k in range(2 * nw)]))
    G.append(('Shoot forward', 10, [st_('shoot', k, 'stand', 0) for k in range(n('shoot'))]))
    G.append(('Shoot up', '≈ 10', [st_('aimup', k, 'stand', 0) for k in range(n('aimup'))] + [st_('shootup', k, 'stand', 0) for k in range(n('shootup'))]))
    G.append(('Shoot down in jump', '–', [st_('aimdown', k, 'jump', 3) for k in range(n('aimdown'))] + [st_('shootdown', k, 'jump', 3) for k in range(n('shootdown'))]))
    G.append(('Crouch shoot', 10, [st_('crouchshoot', k, 'crouch', 0) for k in range(n('crouchshoot'))]))
    G.append(('Grenade throw', 6, [st_('grenade', k, 'stand', 0) for k in range(n('grenade'))]))
    G.append((A.MELEE_TITLE, '6 + 6', [st_('slash', k, 'stand', 0) for k in range(n('slash'))] + [st_('stab', k, 'stand', 0) for k in range(n('stab'))]))
    G.append(('Death', '–', [{'u': None, 'l': None, 'f': ['death', k], 't': A.FULL['death'][k][1]} for k in range(len(A.FULL['death']))]))
    return [{'cat': 'Core', 'title': t, 'ref': r, 'steps': s} for t, r, s in G] + list(ext.GROUPS)


def check_groups(G):
    """Every step must point at frames that exist (a typo in a group shows here, not on the page)."""
    bad = []
    for g in G:
        for s in g['steps']:
            for k, tab in (('u', A.UPPER), ('l', A.LOWER), ('f', A.FULL)):
                if s.get(k) and (s[k][0] not in tab or s[k][1] >= len(tab[s[k][0]])):
                    bad.append((g['title'], k, s[k]))
            for st in s.get('st', []):
                if st[0] not in getattr(P1, 'STAGE', {}) or st[1] >= len(P1.STAGE[st[0]]):
                    bad.append((g['title'], 'st', st[:2]))
    return bad


if __name__ == '__main__':
    dry = '--dry' in sys.argv          # compose everything and check, write nothing
    G = groups()
    bad = check_groups(G)
    if bad:
        print('BAD STEPS', bad[:20]); sys.exit(1)
    data = {'hero': hero.NAME, 'pal': PAL, 'groups': G}
    stats = {}
    for S in ([1] if dry else hero.scales()):
        data[f's{S}'], stats[f's{S}'] = export(S)
    if dry:
        print(json.dumps({k: {a: b for a, b in v.items() if a != 'frames'} for k, v in stats.items()}))
        print('groups', len(G), 'json KB (1x, est.)', len(json.dumps(data, separators=(',', ':'))) // 1024)
        sys.exit(0)
    od = hero.outdir()
    json.dump(data, open(f'{od}/sprites.json', 'w'), separators=(',', ':'))
    json.dump(stats, open(f'{od}/stats.json', 'w'))
    print(json.dumps({k: {a: b for a, b in v.items() if a != 'frames'} for k, v in stats.items()}))
    print('json KB', os.path.getsize(f'{od}/sprites.json') // 1024)
