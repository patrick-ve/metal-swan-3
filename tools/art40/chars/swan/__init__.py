# The Swan (vehicle/swan/*, P2 vehicle/swan-mute/*) at 40 px (plan docs/design/ams40.md "The Swan",
# decision D3: a natural mute swan with a machine gun strapped on, ridden like a mount bird).
#
# STAGE 1 (wave 7, this set, slug 'swan'): the core every Swan set shares and the ground strips.
# Stage 2 adds two more sets with the SAME prefix (SET.shares_prefix): 'swan-neck' (the neck and the
# gun: neck*, crouch-neck*, duck-neck*, swim-neck*, beak-flash) and 'swan-water' (swim, flight and
# their -front overlays). They import this module read-only: S = art40.char('swan').
#
#   palette.py  the colours (P1 white swan) and P2 (the black swan: vehicle/swan-mute)
#   canvas.py   the rig canvas with the Swan's selout table
#   body.py     the rig: body, wings, tail, long legs, feet, neck and head (faces), saddle, grips,
#               belts, the drum and the barrel at any angle
#   poses.py    the pose tables of the stage 1 strips (and the wave 1 look poses)
#   frames.py   picture -> art40.Frame: the body sprite, the -front overlay (with the rider's leg
#               window), the points the game reads, the joint track
#   strips.py   the stage 1 strips, their timing and the events the game code reads
#   look.py     the wave 1 review renders (tmp/ams40-looks/swan/); selftest.py its checks
import art40 as X

from . import body as B
from . import palette
from . import poses as PO
from . import frames as F

SET = X.Set(prefix='vehicle/swan', budget=40, face=1, hl='YyZ', fx=palette.FX, colours=palette.colours())
SET.shares_prefix = True            # swan, swan-neck and swan-water: one prefix, disjoint strips

# P2: the black swan (user, 2026-11-03): the same pixels with black plumage, a red bill, red cloth
P2_PREFIX = 'vehicle/swan-mute'


def render(pose, aim=None, kick=0.0, neck=None):
    """One Swan picture: {'rows': {'b','f','n'}, 'pts': {...}, 'joints': {...}} in canvas
    coordinates (B.CW x B.CH, the feet anchor at (B.OX, B.OY)); pts and joints are swan-local
    (relative to the anchor). pose: a poses dict, or the name of a look pose (PO.POSES: drawn with
    its neck and the barrel at aim, default 2). neck: draw pose['neckpose'] (default: when the pose
    has one and is a riderless picture, or a look pose)."""
    if isinstance(pose, str):
        pose = dict(PO.POSES[pose])
        pose.setdefault('neckpose', PO.NECK_REST)
        if aim is None:
            aim = 2
        neck = True
    return F.render(pose, aim=aim, kick=kick, neck=neck)


def build(s):
    from . import strips
    strips.build(s)
