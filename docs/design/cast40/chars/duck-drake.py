# A mallard drake afloat on a canal: bottle-green head, white collar, chestnut breast, pale grey
# flanks, a black rump with the curled tail feathers, a yellow bill. Drawn by hand at 1x; the
# water line (with a ripple) is drawn without an outline so the body sits IN the water.
import castkit as K

INFO = dict(
    name='MALLARD DRAKE', mission=['ams'], role='animal', kind='CREATURE', face=1,
    pose='swimming, afloat on a 2 px water line with a ripple',
    note='green head with a sheen, the white collar, chestnut breast, grey flanks, black rump with the '
         'curl, yellow bill; the water line cuts the body so it reads as afloat',
    old='npc/ams/ams-ducks#0', air=0)

PAL = {
    'G': '#3c9c5c', 'H': '#8ee0a0', 'g': '#1d5a3a',            # head green, sheen, shade
    'w': '#f8f6ec',                                            # collar, tail
    'Y': '#f6cc3c', 'O': '#b88a22',                            # bill
    'R': '#a8583a', 'r': '#6c3424',                            # chestnut breast
    'S': '#e4e2da', 'T': '#b4b2ac', 'U': '#827f7c',            # grey flanks
    'E': '#9c8c74', 'e': '#6c5e4c',                            # brown-grey back, wing
    'Q': '#2a2a34',                                            # black rump, curl
    'L': '#4f9ccc', 'l': '#b4e2f6',                            # water, ripple
}
DARK = {'G': 'g', 'H': 'g', 'g': 'g', 'w': 'T', 'Y': 'O', 'O': 'r', 'R': 'r', 'r': 'r',
        'S': 'U', 'T': 'U', 'U': 'Q', 'E': 'e', 'e': 'Q', 'Q': 'Q'}

BODY = """
    ..........GG...
    .........GHGG..
    .........GGgGYY
    ..Q......gGGOY.
    .QQ.EEEEEwwg...
    wQQEEeEEeERR...
    wQSSSSSSSSRRR..
    .QTTTTTTTTRrr..
"""

WATER = """
    llLLLLLLLLLLLLLLll
    ..LLLlLLLLLLLlLL..
"""


def duck(body, water=WATER, ox=3, oy=3):
    cv = K.Canvas(24, 16)
    cv.grid(ox, oy, K.grid(body), 2.0, 'body')
    rows_b = K.grid(body)
    cv.grid(ox - 2, oy + len(rows_b), K.grid(water), 5.0, 'fx')
    return K.finish(cv, (ox + 6, oy + len(rows_b) + 1))


def frame():
    K.palette(PAL, dark=DARK)
    return duck(BODY)
