# PATRICK's extra head expressions for the extension families (built on his approved 'fwd' head),
# and the hand-made eyes of his balloon heads (Helium Head).
#
# 1x head map (14 x 14, neck at (5, 13)):
#   rows 0-5 hair (sheen 'A'), row 6 brows (cols 9-11), row 7 eye (white col 9, pupil col 10),
#   row 8 nose tip (col 13), row 10 thin mustache (cols 12-13), row 11 mouth, rows 12-13 chin stubble
from heroes.patrick_parts import _edit, _check, _HEAD, HN

F = _HEAD


def heads():
    H = {}
    # panic: brows jump up a row, both eye rows open (white, pupil), the mouth a small open 'O'
    H['panic'] = (_edit(F, [(5, 9, 'QQQ'), (6, 9, 'wwS'), (7, 9, 'wQS'),
                            (11, 11, 'zQz'), (12, 11, 'BQB')]), HN)
    # yawn: eyes squeezed shut, the jaw drops (one row longer), a tall open mouth with a tongue
    H['yawn'] = (_edit(F + ["....zzbbbbb..."], [
        (6, 9, 'sQQ'), (7, 9, 'QQS'),
        (11, 10, 'zwwS'), (12, 9, 'bBQQB'), (13, 4, 'zbbbbBQsB'), (14, 4, '.zzbbbbBB.')]), {'neck': (5, 14)})
    # sleep: relaxed brows, the lids shut (a low dark line), the mouth hangs a little open
    H['sleep'] = (_edit(F, [(6, 9, 'SSS'), (7, 9, 'QQS'), (11, 10, 'zSQB'), (12, 9, 'bbBb')]), HN)
    # bored: a heavy half-shut lid over the pupil, a flat mouth (the calm smile gone)
    H['bored'] = (_edit(F, [(6, 9, 'QQQ'), (7, 9, 'zQ'), (11, 10, 'zBBS')]), HN)
    # soot: the slick top blown up into spikes, wide white eyes, the mouth agape with teeth
    top = ["....q.j..q....",
           "..q.qjj.jq.j.."]
    soot = top + _edit(F, [(5, 9, 'sww'), (6, 9, 'www'), (7, 9, 'wQS'), (10, 10, 'zBBB'),
                           (11, 10, 'BwwB'), (12, 9, 'bBQQB')])
    H['soot'] = (soot, {'neck': (5, 15)})
    H['sootblink'] = (_edit(soot, [(7, 9, 'SSS'), (8, 9, 'QQS'), (9, 9, 'SSS')]), {'neck': (5, 15)})
    # the eating fidget's happy face is kept; victory uses 'grin': eyes squeezed, a wide open grin
    H['grin'] = (_edit(F, [(7, 9, 'zzS'), (9, 10, 'L'),
                           (10, 9, 'zBBBB'), (11, 9, 'Bwwww'), (12, 9, 'bBQQB')]), HN)
    # the second fidget and bored: looking down at a phone / game, reading, a nod, a grin
    D = H_down()
    H['look'] = (D, HN)                                    # eyes down on the screen
    H['lookblink'] = (_edit(D, [(8, 9, 'zz')]), HN)
    H['lookgrin'] = (_edit(D, [(8, 9, 'zz'), (12, 8, 'Bwws')]), HN)
    H['wow'] = (_edit(D, [(6, 9, 'QQQ'), (7, 9, 'SSS'), (8, 9, 'wQ'), (12, 9, 'zQB')]), HN)
    H['smirk'] = (_edit(F, [(6, 9, 'QQs'), (5, 11, 'Q'), (11, 10, 'zSBz')]), HN)
    # VINCENT's fidget heads stay in the shared table under these names; give them PATRICK's face
    H['read'] = H['look']
    H['read2'] = H['lookblink']
    H['smug'] = H['smirk']
    for k, (r, _) in H.items():
        _check('head ' + k, r)
    return H


def H_down():
    import parts as P
    return P.HEADS['down'][0]
