# PATRICK's lanyard badge as secondary motion (stage 2): the badge hangs on the blue lanyard over
# his chest and lags the body by one frame. Three torso variants of the spike's 'up' torso
# (heroes/patrick_parts._TORSO) and their leans:
#   <torso>_bu  the badge 1 px up   (the body drops, the badge has not yet followed)
#   <torso>_bd  the badge 1 px down (the body rises, the badge hangs back on its strap)
#   <torso>_bf  the badge swung out past the jacket's front edge (a hard stop: the keyboard impact)
import parts as P

# rows 5-9 of the 12-px torso; every other row is the spike's own
BU = {5: "qjjqjjjJJTTg", 6: "qjjjqjjjJTRg", 7: "qjjjqjjjjttg", 8: "qqjjjqjjjJgq"}
BD = {6: "qjjjqjjjJJRg", 7: "qjjjqjjjjTTg", 8: "qqjjjqjjjTRq", 9: "Qqjjjjqjjttq"}
BF = {6: "qjjjqjjjJJRTT", 7: "qjjjqjjjjJgTR", 8: "qqjjjqjjjjgtt"}

LEANS = {'lean': 2, 'lean2': 3, 'back': -2}


def _variant(rows, edits):
    w = max(len(r) for r in list(rows) + list(edits.values()))
    return [edits.get(y, r).ljust(w, '.') for y, r in enumerate(rows)]


def install():
    rows, an = P.TORSOS['up']
    for suf, edits in (('bu', BU), ('bd', BD), ('bf', BF)):
        part = (_variant(rows, edits), dict(an))
        P.TORSOS['up_' + suf] = part
        for k, top in LEANS.items():
            P.TORSOS[f'{k}_{suf}'] = P.shear(part, top)


def swing(torso, suf):
    """The torso key with the badge state (None: as drawn)."""
    if not suf or torso not in ('up',) + tuple(LEANS):
        return torso
    return f'{torso}_{suf}'


def lag(ys):
    """Badge states of a loop from the body's height per frame (y down): the badge follows one
    frame late, so a frame whose body moved up shows it down, and the other way round."""
    n = len(ys)
    out = []
    for i in range(n):
        v = ys[i] - ys[i - 1]
        out.append('bd' if v < -0.4 else 'bu' if v > 0.4 else None)
    return out
