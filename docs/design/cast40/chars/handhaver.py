# HANDHAVER: the city enforcement officer of ams. Navy uniform and peaked cap (gold badge), a yellow
# hi-vis vest with two silver bands, a radio on the chest, a black belt; the ticket book in the far
# hand, the near hand winding up over the shoulder with a fine ticket (a white slip, red header).
import castkit as K
from chars import handhaver_kit as HK

INFO = dict(
    name='HANDHAVER', mission=['ams'], role='enemy', kind='HUMANOID', face=-1,
    pose='winds up to throw a fine ticket, the ticket book held out in the other hand',
    note='Navy cap and uniform, a warm yellow hi-vis vest with silver bands and a radio; the white '
         'ticket over the shoulder and the navy book read at 1x. Vest warmer than the hero plumber\'s.',
    old='enemy/handhaver/throw#2', air=0,
)

PAL = {
    'Q': '#121726',                                   # darkest: brows, lines, navy deep shade
    'h': '#3a2a20', 'H': '#5a4030',                   # short dark hair under the cap
    'L': '#ffe2cc', 'S': '#f2b694', 's': '#d08668', 'z': '#8e4c3c',
    'J': '#4c64a4', 'j': '#33467c', 'q': '#222f56',   # navy uniform (sleeves, cap)
    'P': '#4c64a4', 'p': '#33467c', 'o': '#222f56', 'O': '#121726',   # navy trousers (same ramp)
    'Y': '#ffe040', 'V': '#e0b018', 'U': '#9a700e',   # warm hi-vis yellow
    'G': '#eef2f8', 'g': '#a4abbe', 'n': '#5c6276', 'N': '#262a38',   # silver bands, radio
    'R': '#f6c840', 'r': '#a87818',                   # gold badge
    'X': '#4a4852', 'x': '#24222a', 'v': '#121116',   # black shoes, cap band, visor
    'T': '#fbfbf6', 't': '#c8ccd6',                   # ticket paper
    'E': '#d83a34',                                   # red ticket header
}
DARK = {'Y': 'U', 'V': 'U', 'U': 'Q', 'E': 'r'}


HEAD = K.grid("""
    .....qjjjjq.....
    ...qjjJJJJJjq...
    ..qjjJJJJRRJJq..
    ..qjjjJJJRrJJJq.
    ..QqqqqqqqqqqqqX
    ...xxxxxxxxxxvvv
    ...hhhsssssss...
    ...hhHSSSQQQS...
    ...QhSSSSSwQSL..
    ...QszsSSSSSSSL.
    ....szsSSSSSsSs.
    ....QSSSSSSSSS..
    .....QsSSSzzzzs.
    ......zsSSSSSs..
    .......zzssss...
""")
TORSO = K.grid("""
    ..VYYqJJjYY..
    .VYYYYjJjYYY.
    VUYYYYYjNnYYY
    VUYYYYYYNNYYY
    VUVYYYYYnNYYY
    VUVYYYYYYYYYY
    UgggGGGGGGGGG
    VUVYYYYYYYYYV
    UgggGGGGGGGGG
    VUVYYYYYYYYVV
    QxxxxxxxGgxxQ
""")
TAN = {'neck': (6.5, -2), 'pelvis': (6.5, 9), 'shN': (7.5, 2.5), 'shF': (4, 3.0)}

# the near hand pinching the ticket (paper flutters up and back), the far hand with the shut book
TICKET = K.grid("""
    ...tTT...
    ..tTTTTE.
    .tTTTTEE.
    tTTTTtE..
    .tTTt....
    ..JSS....
    ..JSSs...
    ...ss....
""")
# the ticket book held open: two white pages with ruled lines (the right page half written, a red
# total), the navy cover under them, the hand under the spine
BOOK = K.grid("""
    ...tTTqTTt.
    ..tTttqTEtt
    .tTTTTqTttT
    JStTttqTTTt
    JSqqqqqqqqq
    .ss........
""")


def frame():
    K.palette(PAL, dark=DARK, letters='YVUE')
    K.P.HEADS['fwd'] = (HEAD, {'neck': (6, 14)})
    K.P.TORSOS['up'] = (TORSO, TAN)
    K.P.TORSOS['back'] = K.P.shear(K.P.TORSOS['up'], -2)
    K.P.HANDS['ticket'] = (TICKET, {'wrist': (2.5, 6.5)})
    K.P.HANDS['book'] = (BOOK, {'wrist': (0, 3.5)})
    K.pose.RAMP['arm'] = ['J', 'j', 'q', 'Q']
    K.pose.RAMP['armF'] = ['j', 'q', 'Q', 'Q']
    upper = K.A.up(torso='back', head='fwd',
                   near=K.A.hand((-10, -5), 'ticket', 'hand', bend=-1, sh=(-1, 0)),
                   far=K.A.hand((6, 5), 'book', 'hand', bend=-1, z=1))
    lower = K.A.legs((0, -17), (-7, -4), (6, -4))
    return K.humanoid(upper, lower)
