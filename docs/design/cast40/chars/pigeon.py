# A city pigeon pecking at the pavement: blue-grey, the iridescent green-purple neck, two dark
# wing bars, a dark tail band, an orange eye, coral-pink feet. Drawn by hand at 1x.
import castkit as K

INFO = dict(
    name='PIGEON', mission=['ams'], role='animal', kind='CREATURE', face=1,
    pose='pecking: head down to the pavement, tail up',
    note='blue-grey body with two dark wing bars and a dark tail band, a green-purple neck sheen, '
         'an orange eye; the head dips to the ground so the peck reads at 1x',
    old='npc/ams/ams-pigeons#0', air=0)

PAL = {
    'A': '#c4cbdb', 'B': '#939db4', 'C': '#646d88',            # blue-grey ramp
    'N': '#3a3f55',                                            # wing bars, tail band, beak
    'G': '#4fae86', 'V': '#9a5fb6',                            # neck sheen
    'O': '#ff9a3a',                                            # eye
    'P': '#e8737a', 'p': '#a8464f',                            # feet
}
DARK = {'A': 'C', 'B': 'C', 'C': 'N', 'N': 'N', 'G': 'N', 'V': 'N', 'O': 'N', 'P': 'p', 'p': 'p'}

BODY = """
    ...AAAA.....
    .BAAAAAAB...
    NNBNBNBBBG..
    .NCBBBBBBVG.
    ...CCBBBCVCC
    ....pP..CCOA
    ....P.P...CN
"""


def frame():
    K.palette(PAL, dark=DARK)
    cv = K.Canvas(20, 14)
    cv.grid(3, 3, K.grid(BODY), 2.0, 'body')
    return K.finish(cv, (9, 10))
