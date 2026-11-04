# PRODUCTION COPY of the group table of docs/design/squad40/build.py (the frozen spike): the 12 core
# groups of a hero plus the extension groups (ext.GROUPS). A group is a list of steps (see ext.py for
# the step format); comp.step_rows(step) composes one step the way the squad page draws it.
#
#   import hero, groups
#   hero.load('vincent')
#   for g in groups.groups(): ...
import anims as A
import parts as P1
import ext


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
