# Status looks made by the page from the core frames (no new art): the pick-up flash (white on
# ages 0-1 and 4-5, then a white tint fading out, as the game draws it) and the invulnerable blink
# after a respawn (the hero is hidden every other 2 ticks).
import anims as A


def GROUPS():
    G = []
    idle = [{'u': ['idle', 0], 'l': ['stand', 0], 't': 1}]
    pick = []
    for age in range(10):                     # one pick-up: 10 ticks
        s = dict(idle[0])
        if age < 2 or 4 <= age < 6:
            s['pal'] = 'flash'
        elif age >= 6:
            s['pal'] = 'tint%d' % round(60 * (10 - age) / 6)
        pick.append(s)
    pick.append({'u': ['idle', 1], 'l': ['stand', 0], 't': 40})
    G.append({'cat': 'Status', 'title': 'Pickup flash', 'ref': '–', 'steps': pick})
    nr, nl = len(A.UPPER['run']), len(A.LOWER['run'])
    blink = []
    for k in range(24):                       # the run cycle twice, hidden every other 2 ticks
        i = k % max(nr, nl)
        blink.append({'u': ['run', i % nr], 'l': ['run', i % nl], 't': 2})
        blink.append({'u': ['run', i % nr], 'l': ['run', i % nl], 't': 1, 'hide': 1})
    G.append({'cat': 'Status', 'title': 'Invulnerable blink', 'ref': '–', 'steps': blink})
    return G
