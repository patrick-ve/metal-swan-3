# DIRK's extra head expressions for the extension sets (happy panic yawn sleep bored soot sootblink),
# all drawn on his approved 'fwd' head: the same spiky hair, round rosy face, narrow squint, thick
# drooping mustache (rows 11-12) and stubble. 14 wide, neck at (5, 13) unless the jaw drops.
#
#    01234567890123
#  0 ..........A...
#  5 hhHHHHHHHSLLL.
#  8 QhhHszSSShhhS.     <- brow (cols 9-11)
#  9 QhhHszsSSzQQSL     <- the narrow eye (cols 10-11), nose at col 13
# 11 .QhbsSSShHHHHH     <- mustache, top
# 12 ..QbbSbhhhhhzh     <- mustache, the drooping lower edge
# 13 ..QbbbbbbbBBb.     <- stubble
import parts as P
from heroes import dirk_parts as DP

_edit = P._edit
B = DP._HEAD
NECK = {'neck': (5, 13)}

HEADS = {}

# happy: brows up, the eye squeezed into an arc, a wide toothy grin under the mustache (its back
# end still droops), the cheeks pushed up
HEADS['happy'] = (_edit(B, [(7, 9, 'hhh'), (8, 9, 'SQQS'), (9, 9, 'QLLQ'), (10, 9, 'LSSS'),
                            (12, 9, 'Qwwww'), (13, 9, 'bQQQB')]), NECK)

# panic: brows jump up, the eye wide open (white, small pupil), the mouth an open 'O' under the
# mustache
HEADS['panic'] = (_edit(B, [(7, 9, 'hhh'), (8, 9, 'Swww'), (9, 9, 'zwQS'),
                            (12, 10, 'QQ'), (13, 9, 'bQQQb'), (14, 8, 'BQB')]), NECK)

# yawn: eyes shut tight, the jaw drops (one row taller), a tall open mouth with a tongue; the
# mustache stays on top of it
_Y = B[:12] + [
  "..QbbSbhQQQQh.",
  "..QbbbbbQssQb.",
  "..QbbbbbQQQQ..",
  "...zbbbbBBB...",
]
HEADS['yawn'] = (_edit(_Y, [(8, 9, 'hhh'), (9, 9, 'SQQS')]), {'neck': (5, 14)})

# sleep: eyes shut (a low lid line), the brow relaxed, the mouth hangs a little open
HEADS['sleep'] = (_edit(B, [(8, 9, 'SSS'), (9, 9, 'Szzz'), (13, 10, 'BQB')]), NECK)

# bored: a heavy half-shut lid, a flat mouth line under the mustache
HEADS['bored'] = (_edit(B, [(8, 9, 'zQQQ'), (9, 9, 'zSQS'), (13, 9, 'bBBBb')]), NECK)

# soot: the hair frazzled and standing up, wide white eyes, the mouth agape (the soot pass of the
# deaths blackens everything else)
_TOP = [
  "..h...A...A...",
  "..hh..AH..AA..",
  "...h..HA..A..A",
  "...hh.AA.AAA.A",
  "...hhAHhAHA.AA",
]
_S = _TOP + _edit(B[3:], [(4, 9, 'Sww'), (5, 9, 'Swww'), (6, 9, 'SwQw'),
                          (9, 9, 'QQQQ'), (10, 9, 'BwwwB')])
HEADS['soot'] = (_S, {'neck': (5, 15)})
HEADS['sootblink'] = (_edit(_S, [(9, 9, 'SSSS'), (10, 9, 'SQQQ'), (11, 9, 'SSSS')]), {'neck': (5, 15)})
