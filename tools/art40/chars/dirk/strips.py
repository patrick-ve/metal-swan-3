# DIRK's strip timing (wave 2, stage 2): the shared hero module (tools/art40/chars/_hero, read
# only) builds every strip; this file swaps in DIRK's own builders for the strips whose drawings
# he has his own of (the plunger melee: 8 drawings in the 14 knife ticks, drawn smears) and his own
# hero moves (the salute, the seated mount). install() patches the shared module in this process
# only (one hero per process, like the kit's hero modules).
from . import poses as PO

KNIFE_TICKS = 14


def _steps(seq, key):
    tags = PO.TAGS[key]
    if len(tags) != len(seq):
        raise ValueError(f'dirk {key}: {len(seq)} poses, {len(tags)} tags')
    out = []
    for (p, t), g in zip(seq, tags):
        out.append((p, t, g) if g else (p, t))
    if sum(t for _, t, *_ in out) != KNIFE_TICKS:
        raise ValueError(f'dirk {key}: the melee must keep {KNIFE_TICKS} ticks')
    return out


def knife(seq):
    """The overhead smack: the poses carry their own ticks and smear tags (poses.slash_set)."""
    return _steps(seq, 'slash')


def stab(seq):
    """The thrust that sticks and pops off (poses.stab_set)."""
    return _steps(seq, 'stab')


def mount():
    """Seated (drawSeated alternates the frames every 16 ticks). Frame 0: the near hand up on the
    roll bar, the arm up past the back of his head (the ending hangs the hero by this hand; the dark sleeve no longer
    crosses the face); frame 1: both fists forward under the chin (the ride fallback, hip (0, -17))."""
    import ext_moves as EM
    from anims import hand
    import moves_ref
    s = moves_ref.SEAT
    up_ = EM.fp(s['pel'], s['far'], s['near'], 'hang', 'hang', torso='up', head='fwd',
                armN=hand((-3, -12), 'fist', 'fist', bend=1), armF=hand((9, 1), 'fist', 'fist'), cape=('hang', 0))
    fwd = EM.fp(s['pel'], s['far'], s['near'], 'hang', 'hang', torso='lean', head='fwd',
                armN=hand((10, 2), 'fist', 'fist'), armF=hand((10, 1), 'fist', 'fist'), cape=('hang', 0))
    return [(up_, 16), (fwd, 16)]


def install(H):
    """Patch the shared module's builders (H = art40.char('_hero'))."""
    import importlib
    import sys
    S = importlib.import_module(H.__name__ + '.strips')
    M = importlib.import_module(H.__name__ + '.moves')
    sys.modules['moves_ref'] = M
    S.knife = knife
    S.stab = stab
    M.salute = PO.salute
    M.mount = mount
