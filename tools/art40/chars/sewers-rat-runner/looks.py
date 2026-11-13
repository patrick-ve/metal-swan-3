# The four rats' builds and palettes (mission sewers, wave P5 RATS). One palette per set (plan D1:
# at most 28 colours): the outline, fur (4 tones + the selout dark), belly (3), pink skin (ears,
# nose, paws, the scaly tail: 4), the red eyes (3), the eye glint, teeth (2), the mouth, the
# whiskers and the green slime (3). The white eye flash and the death puff are the shared FX ramp.
import rig

from . import ratrig as R

# Letters shared by every rat (the colours differ per look).
#   K outline   A B C D fur (hi -> shade)   Q fur selout   a b c belly   P p m n pink skin
#   E R e eyes (hot, red, dark)   w glint   Y y teeth   M mouth   V whiskers   G g h slime
#   W X Z flash (FX ramp: white, cream, yellow)   I J puff (FX ramp: warm greys)
FX = 'WXZIJ'
HL = 'EReVwYG'

COMMON = {
    'K': '#140c0e',
    'E': '#ffb08a', 'R': '#f0302a', 'e': '#8c141c',
    'w': '#fff4dc',
    'M': '#4a0e1a',
    'G': '#b8f05a', 'g': '#5cae2e', 'h': '#2a6420',
    'W': '#ffffff', 'X': '#fffbd8', 'Z': '#ffe070', 'I': '#7a6e70', 'J': '#4a4046',
}

PALS = {
    # the runner: a warm brown sewer rat with an ochre highlight and a cream belly
    'runner': {
        'A': '#d8a868', 'B': '#a8743e', 'C': '#74482a', 'D': '#46281c', 'Q': '#2c1814',
        'a': '#ecd2a4', 'b': '#c4a07a', 'c': '#8c6a52',
        'P': '#ffc6b4', 'p': '#e88c84', 'm': '#b05c62', 'n': '#6e3242',
        'Y': '#fff0b4', 'y': '#c8a050', 'V': '#a89c90',
    },
    # the leaper: a lean blue-grey rat with a dark back stripe, pale belly, big pink ears
    'leaper': {
        'A': '#b8b0c4', 'B': '#857d98', 'C': '#59526c', 'D': '#36304a', 'Q': '#241e2c',
        'a': '#f0e8e0', 'b': '#c8bcbc', 'c': '#8e8290',
        'P': '#ffc8c0', 'p': '#ec9494', 'm': '#b4606c', 'n': '#6e3448',
        'Y': '#fff0b4', 'y': '#c8a050', 'V': '#e4e0ea',
    },
    # the spitter: a fat sickly olive rat, yellow-green belly and cheeks
    'spitter': {
        'A': '#bcb270', 'B': '#8a8046', 'C': '#5c542e', 'D': '#36301c', 'Q': '#241e12',
        'a': '#f0e6a0', 'b': '#cabe6e', 'c': '#8e8448',
        'P': '#ffc4ac', 'p': '#e4887c', 'm': '#a85a5a', 'n': '#66323a',
        'Y': '#fff0b4', 'y': '#c8a050', 'V': '#dcdcc4',
    },
    # the brute: a huge dark brown-black rat, scarred, yellow teeth, ragged ears
    'brute': {
        'A': '#a0806a', 'B': '#6c5244', 'C': '#463430', 'D': '#2a1e1e', 'Q': '#1e1414',
        'a': '#b49a84', 'b': '#86705e', 'c': '#5a4a40',
        'P': '#f0aca0', 'p': '#c87872', 'm': '#8e4a50', 'n': '#562a36',
        'Y': '#f8e08a', 'y': '#b88a34', 'V': '#c8c0b4',
    },
}

DARK = {'A': 'Q', 'B': 'Q', 'C': 'Q', 'D': 'Q', 'a': 'c', 'b': 'c', 'c': 'D',
        'P': 'm', 'p': 'm', 'm': 'n', 'n': 'n', 'Y': 'y', 'y': 'y', 'G': 'g', 'g': 'h', 'h': 'h'}


def colours(kind):
    c = dict(COMMON)
    c.update(PALS[kind])
    return c


def install(kind):
    """The rig's selout tones for our letters (this process only)."""
    rig.DARK.update(DARK)
    rig.PAL.update(colours(kind))


FUR = ['A', 'B', 'C', 'D']
BELLY = ['a', 'a', 'b', 'c']
PINK = ['P', 'p', 'm', 'n']
SLIME = ['G', 'g', 'h']

EYES_S = {
    'open': [(0, -1, 'D'), (1, -1, 'D'), (0, 0, 'R'), (1, 0, 'E'), (0, 1, 'e'), (1, 1, 'R')],
    'wide': [(0, -1, 'w'), (1, -1, 'w'), (-1, 0, 'w'), (0, 0, 'R'), (1, 0, 'E'), (0, 1, 'e'), (1, 1, 'R')],
    'shut': [(0, 0, 'K'), (1, 0, 'K')],
    'happy': [(-1, 0, 'K'), (0, -1, 'K'), (1, 0, 'K')],
    'x': [(-1, -1, 'K'), (1, -1, 'K'), (0, 0, 'K'), (-1, 1, 'K'), (1, 1, 'K')],
    'squint': [(-1, -1, 'K'), (0, -1, 'K'), (1, 0, 'K'), (0, 0, 'R'), (0, 1, 'e'), (1, 1, 'E')],
}


def runner():
    return R.Look(
        W=72, H=48, RX=40, RY=40, pivot=(0.0, -7.0), sc=1.0, rise_h=17, hole_w=9, slime_w=14, back_off=-1.0,
        rump=(-5.0, -7.5), rump_r=(7.0, 5.5), chest=(3.5, -7.2), chest_r=(5.6, 4.6),
        hip=(-1.0, 2.5), shoulder=(1.0, 2.2), neck=(6.0, -2.0), belly_v=0.42,
        skull_r=(3.7, 3.1), snout_at=(1.8, 0.5), snout_len=4.4, snout_drop=1.3, snout_r=(2.3, 1.0),
        eye_at=(1.0, -1.0), eye_c=(0.5, 0.5), ear_at=(-2.1, -2.4), ear_r=(1.6, 2.0), cheek_at=(1.5, 1.6),
        hfoot=(-3.5, -2.0), hfoot_len=3.2, thigh_r=2.2, shin_r=1.2, paw_r=0.9,
        ffoot=(6.2, -2.0), arm=(2.4, 2.4), arm_r=(1.6, 1.1), fpaw_len=1.3, farx=1.5,
        tail_ang=-4.0, tail_bend=[-10, -2, 6, 8, 6, 3], tail_len=19.0, tail_r=(1.25, 0.45),
        whisk=[(26, 2.0), (-14, 2.5)],
        fur=FUR, belly=BELLY, pink=PINK, earramp=PINK, cheekramp=BELLY, slime=SLIME, slime_ramp=['G', 'G', 'g', 'h'],
        mouth='M', whisker='V',
        teeth_dn=[(0, 0, 'Y'), (0, 1, 'Y')], teeth_up=[(0, 0, 'Y')], teeth_shut=[(0, 0, 'Y')],
        nose=[(0, 0, 'p'), (0, -1, 'P')],
        eyes=EYES_S, hl=HL, fx=FX, fur_pat=None, extra_body=None, extra_head=None,
    )


def _stripe(u, v, k, ch):
    """The leaper's dark back stripe."""
    return 'C' if v < -0.66 and ch in 'AB' else ch


def leaper():
    """Lean and leggy: long hind feet for the pounce, big ears, a long tail, the dark back stripe."""
    L = runner()
    L.__dict__.update(
        rise_h=18, hole_w=9, slime_w=14,
        rump=(-5.0, -8.6), rump_r=(6.4, 5.0), chest=(3.6, -8.4), chest_r=(5.0, 4.2),
        hip=(-0.8, 2.8), shoulder=(1.0, 2.4), neck=(5.8, -2.2), belly_v=0.40,
        skull_r=(3.5, 3.0), snout_len=4.8, snout_r=(2.2, 0.9),
        ear_at=(-2.0, -2.6), ear_r=(2.0, 2.7),
        hfoot=(-2.8, -2.0), hfoot_len=4.4, thigh_r=2.4, shin_r=1.1,
        ffoot=(6.4, -2.0), arm=(3.0, 3.0), arm_r=(1.4, 1.0), fpaw_len=1.4,
        tail_bend=[-8, -4, 4, 8, 8, 6, 3], tail_len=24.0, tail_r=(1.15, 0.4),
        fur_pat=_stripe,
    )
    return L


def spitter():
    """Fat and squat: a round body, short legs, a big head with the cheek pouches (the gulp)."""
    L = runner()
    L.__dict__.update(
        rise_h=18, hole_w=10, slime_w=14, back_off=-2.0,
        rump=(-4.4, -8.2), rump_r=(7.2, 6.4), chest=(3.0, -8.2), chest_r=(5.6, 5.4),
        hip=(-0.8, 3.0), shoulder=(1.0, 2.8), neck=(5.0, -2.6), belly_v=0.30,
        skull_r=(4.1, 3.6), snout_at=(2.0, 0.8), snout_len=3.6, snout_drop=1.0, snout_r=(2.5, 1.2),
        eye_at=(1.2, -1.2), ear_at=(-2.4, -2.8), ear_r=(1.7, 2.0),
        hfoot=(-3.0, -2.0), hfoot_len=3.0, thigh_r=2.6, shin_r=1.3,
        ffoot=(5.6, -2.0), arm=(2.2, 2.2), arm_r=(1.7, 1.2),
        tail_bend=[-12, -2, 6, 8, 6], tail_len=15.0, tail_r=(1.4, 0.5),
        cheekramp=['G', 'G', 'g', 'h'], cheek_at=(0.6, 2.3),
    )
    return L


EYES_B = {
    'open': [(-1, -1, 'D'), (0, -1, 'D'), (1, -1, 'D'), (2, -2, 'D'), (0, 0, 'R'), (1, 0, 'E'), (0, 1, 'e'), (1, 1, 'R')],
    'wide': [(-1, -1, 'w'), (0, -1, 'w'), (1, -1, 'w'), (-1, 0, 'w'), (-1, 1, 'w'), (0, 0, 'R'), (1, 0, 'E'), (0, 1, 'e'), (1, 1, 'R')],
    'shut': [(-1, 0, 'K'), (0, 0, 'K'), (1, 0, 'K'), (2, -1, 'K')],
    'happy': [(-1, 1, 'K'), (0, 0, 'K'), (1, 0, 'K'), (2, 1, 'K')],
    'x': [(-1, -1, 'K'), (2, -1, 'K'), (0, 0, 'K'), (1, 0, 'K'), (0, 1, 'K'), (1, 1, 'K'), (-1, 2, 'K'), (2, 2, 'K')],
    'squint': [(-1, -2, 'K'), (0, -1, 'K'), (1, -1, 'K'), (2, 0, 'K'), (0, 0, 'R'), (1, 0, 'R'), (0, 1, 'e'), (1, 1, 'E')],
}


def _brute_body(cv, xf, p, at):
    """The brute's scars (pink seams over the flank) and the bristles along its back."""
    rump, chest = at['rump'], at['chest']
    for (x0, y0), (x1, y1) in (((-7, -5), (1, 1)), ((-2, -8), (4, -3)), ((9, -6), (14, -1))):
        a = (rump[0] + x0, rump[1] + y0) if x0 < 5 else (chest[0] + x0 - 9, chest[1] + y0)
        b = (rump[0] + x1, rump[1] + y1) if x0 < 5 else (chest[0] + x1 - 9, chest[1] + y1)
        n = 12
        for k in range(n + 1):
            q = xf.p(R.lerp(a, b, k / n))
            cv.px(int(round(q[0])), int(round(q[1])), 'p', 5.6, 'body')
        # the stitch marks
        for t in (0.3, 0.7):
            m = R.lerp(a, b, t)
            q = xf.p((m[0] + 0.7, m[1] - 0.9))
            cv.px(int(round(q[0])), int(round(q[1])), 'm', 5.6, 'body')
    # bristles: short dark spikes out of the back line (rump and chest tops; not on its back)
    if abs(p['roll']) > 90 or p['flip']:
        return
    for c, (rx, ry), xs in ((rump, (15.0, 12.5), (-10, -6, -2, 2, 6, 10)), (chest, (12.5, 10.5), (-6, -2, 2))):
        for dx in xs:
            t = max(-0.95, min(0.95, dx / rx))
            top = (c[0] + dx, c[1] - ry * (1 - t * t) ** 0.5 - 0.6)
            for k in range(3):
                q = xf.p((top[0] - k * 0.8, top[1] - k * 0.9))
                cv.px(int(round(q[0])), int(round(q[1])), 'D' if k < 2 else 'C', 5.4, 'body')


def brute():
    """Horse-sized, scarred, slow: the runner's build at 2.3x with heavier legs and a big head."""
    L = runner()
    L.__dict__.update(
        W=150, H=76, RX=80, RY=68, pivot=(0.0, -16.0), sc=2.3, rise_h=36, hole_w=26, slime_w=30, back_off=-1.0,
        rump=(-11.0, -17.0), rump_r=(15.0, 12.5), chest=(8.0, -16.5), chest_r=(12.5, 10.5),
        hip=(-2.0, 6.0), shoulder=(2.0, 5.5), neck=(13.0, -3.5), belly_v=0.45,
        skull_r=(8.0, 6.8), snout_at=(4.0, 1.2), snout_len=9.0, snout_drop=2.6, snout_r=(5.0, 2.3),
        eye_at=(2.4, -2.6), eye_c=(0.5, 0.5), ear_at=(-4.4, -5.0), ear_r=(3.4, 4.2), cheek_at=(3.0, 3.5),
        hfoot=(-7.0, -2.0), hfoot_len=7.0, thigh_r=5.0, shin_r=2.8, paw_r=1.8,
        ffoot=(14.0, -2.0), arm=(5.6, 5.6), arm_r=(3.4, 2.5), fpaw_len=3.0, farx=3.0,
        tail_ang=-4.0, tail_bend=[-10, -2, 6, 8, 6, 3, 2], tail_len=40.0, tail_r=(2.8, 0.8),
        whisk=[(26, 4.0), (6, 4.5), (-14, 4.5)],
        teeth_dn=[(0, 0, 'Y'), (1, 0, 'Y'), (0, 1, 'Y'), (1, 1, 'Y'), (0, 2, 'y'), (1, 2, 'Y')],
        teeth_up=[(0, 0, 'Y'), (1, 0, 'Y'), (0, -1, 'y'), (1, -1, 'Y')],
        teeth_shut=[(0, 0, 'Y'), (1, 0, 'Y'), (0, 1, 'y'), (1, 1, 'Y')],
        nose=[(0, 0, 'p'), (1, 0, 'p'), (0, -1, 'P'), (1, 1, 'm'), (0, 1, 'm')],
        eyes=EYES_B, big_eyes=True, extra_body=_brute_body,
    )
    return L
