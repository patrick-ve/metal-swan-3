# SCANAUTO (boss/ams-scan): the parking scan car of mission ams, section c, at 40 px (plan
# docs/design/ams40.md wave 6). The approved look is the cast spike's sample
# (docs/design/cast40/chars/ams-scan-car.py): no readable lettering (letter-like marks), no light bar.
# This set holds the car and its driver; the tow truck and the wheel clamp are sets of their own
# (chars/ams-tow-truck/, chars/ams-wheel-clamp/) under the same prefix.
#
# The game composes the car from part strips that share the car anchor (car.ts draw(), back to
# front): scanner, body, cabin, lettering, wheels, lamp glows. Every strip is indexed by frame role;
# the roles are the named constants below (car.ts and adds.ts import them from ams-scan.gen.ts).
#
#   body-<0|1|2>   damage stage; frames BODY_LEVEL, BODY_SQUAT (nose up: the rev, the launch),
#                  BODY_DIVE (nose down: the brake) - a column shear of BODY_TILT_MILLI / 1000 px per
#                  px; car.ts moves every overlay by the same rule (bodyShift)
#   cabin          the officer behind the glass by role (CAB_*), the airbag
#   scanner-<s>    the box by role (SCAN_*): rise, the sweep, the lock, the print kick
#   scanner-gone   the rack after the box was shot off
#   text           print marks (0 front door, 1 rear door, 2 the box number, 3 rear door facing left)
#   wheel          4 turn steps (one per 1.9 px)
#   blink          BLINK_HAZARD amber, BLINK_REVERSE white, BLINK_BRAKE red
#   wreck          the tumble onto the roof per facing (WRECK_*)
#   reticle        SCAN LOCK: tracking, the snap, locked (RETICLE_*)
#   ticket         the printed fine strip fluttering (TICKET_FRAMES)
import art40 as X
import castkit as K

from . import body as B
from . import cabin as C
from . import geo as G
from . import pal as P
from . import scanner as S
from . import small as T
from . import wheel as Wh
from . import wreck as Wr

SET = X.Set(prefix='boss/ams-scan', budget=40, face=1, outline='K', hl=P.HL, fx=P.FX, colours=P.PAL)

TILT_MILLI = 36
BODY = dict(BODY_LEVEL=0, BODY_SQUAT=1, BODY_DIVE=2)
WHY_ROLES = 'frames by role: the code picks the frame (part state, attack phase), the engine never plays it'


def build(s):
    K.palette(P.PAL, dark=P.DARK, letters=''.join(k for k in P.PAL if k != 'K'))
    tilt = TILT_MILLI / 1000.0
    for st in (0, 1, 2):
        lvl = B.paint(st)
        fr = [G.frame(lvl), G.frame(G.shear(lvl, tilt)), G.frame(G.shear(lvl, -tilt))]
        s.strip(f'body-{st}', fr, 6, cls='mechanical')
    s.strip('cabin', C.frames(), 6, cls='mechanical')
    for st in (0, 1, 2):
        fr = []
        for rise, mode, k in S.MODES:
            r = S.box(st, rise, mode, k)
            fr.append(G.frame(r, extra=S.glow(mode, k, rise)))
        s.strip(f'scanner-{st}', fr, [6, 6, 6, 3, 3, 3, 3, 4, 4, 3, 6], cls='mechanical')
    s.strip('scanner-gone', [G.frame(S.gone())], 6, cls='mechanical')
    s.strip('text', T.text_frames(), 6, cls='mechanical')
    s.strip('wheel', [G.frame(Wh.wheel(k)) for k in range(Wh.STEPS)], 6, cls='mechanical')
    s.strip('blink', T.blink_frames(), 6, cls='mechanical')
    wr = [X.Frame(rows, Wr._root()) for rows in Wr.frames(False) + Wr.frames(True)]
    s.strip('wreck', wr, 6, cls='mechanical', defer=True)
    s.strip('reticle', T.reticle_frames(), 3, cls='mechanical')
    s.strip('ticket', T.ticket_frames(), 3, cls='mechanical')
    for d in (BODY, C.ROLES, S.ROLES, Wr.ROLES, T.RETICLE):
        for k, v in d.items():
            s.event(k, v)
    s.event('BODY_TILT_MILLI', TILT_MILLI)
    s.event('BLINK_HAZARD', 0)
    s.event('BLINK_REVERSE', 1)
    s.event('BLINK_BRAKE', 2)
    s.event('TICKET_FRAMES', 3)
