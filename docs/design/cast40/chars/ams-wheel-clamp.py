# The wheel clamp the tow truck drops: a yellow clamp that hops at the hero's feet like a jaw. Two
# yellow jaw arms (two segments each, shaded as tubes) open in a V over a steel foot plate, steel
# teeth on their inner edges, the round steel lock disc with its keyhole in the middle.
# Mid-hop, jaws wide open (the game's 'open' frame, lifted off the floor).
import castkit as K

INFO = dict(
    name='WIELKLEM', mission=['ams'], role='enemy', kind='MACHINE', face=-1,
    pose='mid-hop towards the hero, the jaws wide open',
    note='The game design kept (yellow V jaws, steel foot plate, round lock disc with a keyhole); '
         'now hand-drawn arms with tips bent in with steel teeth on the inner edges so it reads as a biting jaw; 13 px wide.',
    old='boss/ams-scan/clamp#1',
    air=6,
)

PAL = {
    'J': '#ffe068', 'j': '#f0b628', 'X': '#b87c14', 'x': '#6c4410',       # clamp yellow
    'S': '#eef1f6', 's': '#a8afbd', 'z': '#6c7384', 'Z': '#3e4352',       # steel
    'o': '#1e1c23',                                                       # the keyhole
}
DARK = {}
for grp, d in [('JjXx', 'x'), ('SszZ', 'Z'), ('o', 'o')]:
    for ch in grp:
        DARK[ch] = d


CLAMP = K.grid('''
    ..XjS...SjJ..
    .Xj.......jJ.
    .XjS.....SjJ.
    .Xj.......jJ.
    .XjS.....SjJ.
    ..xjj...jjJ..
    ...xjsSSsjX..
    ...zssoSSs...
    ...zssoSss...
    ....zzzsz....
    .zsssssssSSs.
    .ZzzzzzzzzzZ.
''')


def frame():
    """Hand-drawn: the jaw arms (light from the upper front, the near arm's outer edge lit), the steel
    teeth on their inner edges (the outline between them makes the saw edge), the lock disc with its
    keyhole, the foot plate."""
    K.palette(PAL, dark=DARK)
    cv = K.Canvas(17, 16)
    cv.grid(2, 2, CLAMP, 0, 'clamp')
    return K.finish(cv, (8, 2 + len(CLAMP)))
