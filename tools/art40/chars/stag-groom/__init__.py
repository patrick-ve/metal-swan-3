# STAG GROOM: the groom of the stag party of mission ams at 40 px (plan docs/design/ams40.md wave
# 3). The look is the cast spike's approved sample (docs/design/cast40/chars/stag-groom.py): the
# lime party tee with the L-plate on the chest, a pink tutu over navy shorts, a white veil with a
# small gold tiara, white sneakers, parted brown hair and a blush. A part swap on the same
# animation as looks 0 and 2 (rule 6): every strip is chars/stag-partier/strips.py with this Look;
# his parts are in parts.py, the secondary motion of the veil and the tutu in motion.py.
#
# Set enemy/stag-groom: the 22 partier strips and `veil` (the veil flying off his head on his
# death: 4 frames x 6 ticks, deferred; the game tumbles it). No selfie flash here (the gloat spawns
# enemy/stag-partier/flash from look 0's set).
import art40 as X
import pose

from . import motion
from . import parts

base = X.char('stag-partier')
kit = base.kit
P = kit.P

SET = X.Set(prefix='enemy/stag-groom', budget=28, face=1, outline='K', hl='w', fx=kit.FX_LETTERS)

PAL = {
    'A': '#b07a44', 'H': '#7a4e2c', 'h': '#4c301c',                  # parted brown hair, the belt
    'L': '#ffe0cc', 'S': '#f6b294', 's': '#da8268', 'z': '#984a3c',  # fair skin
    'P': '#4a5c94', 'p': '#34426e', 'o': '#232c4c',                  # navy shorts
    'Y': '#ffb2d6',                                                  # the tutu's lit pink (Z k: mid, fold)
    'M': '#d8303c',                                                  # the L-plate's red L
}
DARK = {'Y': 'Z', 'M': 'k'}

kit.TORSOS['groom'] = (parts.TORSO, parts.TAN)


def install_extra():
    # the bare torso of the cower comes from the plain tee (no plate on the skin)
    P.TORSOS['bare'] = (kit.bare(kit.TORSO_NORMAL), dict(parts.TAN))
    P.TORSOS['bare_lean'] = P.shear(P.TORSOS['bare'], 2)
    P.TORSOS['bare_lean2'] = P.shear(P.TORSOS['bare'], 3)
    # the tutu on every torso: the rest state under the plain name, the others as <name>~<state>
    for name in list(P.TORSOS):
        if '~' in name:
            continue
        src = P.TORSOS[name]
        for st in parts.TUTUS:
            P.TORSOS[name if st == 0 else f'{name}~{st}'] = parts.with_tutu(src, st)
    # the veil's comb: only on the '<expr>@v' heads the dress hook picks when the veil is drawn (a
    # death has no veil, so its joint track has no comb point)
    for e in LOOK.expr:
        rows, an = P.HEADS[e]
        P.HEADS[e + '@v'] = (rows, dict(an, veil=parts.VEIL_AT))
    for k, v in parts.FX.items():
        P.FX[k] = v
    pose.HOOKS['back'] = parts.veil_back


LOOK = kit.Look('groom', 'groom', PAL, parts.HEAD, parts.NECK, expr=parts.expressions(kit), dark=DARK,
                limbs=(1.0, 1.0), legs=(7.0, 6.5), sleeves=(3.0, 7.4), soot=('Q', 'h', 'v'), sneaker='white',
                install_extra=install_extra, dress=motion.dress, bundle=parts.bundles(kit))


def veil():
    return [X.Frame(*parts.flying_veil(k)) for k in range(4)]


def build(s):
    base.strips.build(s, LOOK)
    s.strip('veil', veil(), 6, defer=True, cls='prop')
