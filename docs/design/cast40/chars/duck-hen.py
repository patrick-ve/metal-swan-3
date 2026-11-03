# A mallard hen afloat: mottled brown with dark scallops, a pale face with a dark eye stripe, an
# orange bill with a dark saddle, a blue wing patch with white edges. Same water line as the drake.
import importlib
import castkit as K

drake = importlib.import_module('chars.duck-drake')

INFO = dict(
    name='MALLARD HEN', mission=['ams'], role='animal', kind='CREATURE', face=1,
    pose='swimming, afloat on a 2 px water line with a ripple',
    note='mottled brown body with dark scallops, a buff face with a dark eye stripe, an orange bill '
         'with a dark saddle, the blue wing patch; the water line cuts the body so it reads as afloat',
    old='npc/ams/ams-ducks#0', air=0)

PAL = {
    'A': '#e2bf92', 'B': '#b48658', 'C': '#7c5434', 'Q': '#3e2a20',   # buff to dark brown
    'Y': '#f09a3c', 'q': '#5a4030',                                   # bill, saddle
    'V': '#4f62d8', 'w': '#f8f6ec',                                   # speculum, its white edge
    'L': '#4f9ccc', 'l': '#b4e2f6',                                   # water, ripple
}
DARK = {'A': 'C', 'B': 'C', 'C': 'Q', 'Q': 'Q', 'Y': 'q', 'q': 'q', 'V': 'Q', 'w': 'B'}

BODY = """
    ..........CC...
    .........CBBA..
    .........QQQAYY
    ..C......BAAqY.
    .BC.ABACABAB...
    CBBACBwVVwAAA..
    .CBABCBBABBCB..
    .CCBCBBCBBBCC..
"""


def frame():
    K.palette(PAL, dark=DARK)
    return drake.duck(BODY)
