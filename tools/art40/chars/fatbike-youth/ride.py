# One frame of the youth ON the bike (the fatbike kit): the bike, the rider seated on the bench with
# his feet on the pedals and his hands on the riser bar, an optional passenger on the rack (stage 2:
# PASSENGER hook), and the joints of both for the smoothness gate.
import art40 as X

from . import bike as BK
from . import ridekit as RK

W, H = 104, 84
R = (52, 79)                # the ground point under the bottom bracket; the outline row is R[1]

# Stage 2 (the pairs): PASSENGER['draw'](cv, b, k, strip, z) draws the second youth on the rack
# (b = the bike points of fat_bike, k = the frame index, strip = the strip name) and returns his
# joints (prefix 'p.'). None: solo.
PASSENGER = {'draw': None}


def seat_pel(b, dx=0.0, dy=0.0):
    """The pelvis on the bench (canvas px)."""
    return (b['seat'][0] + 0.5 + dx, b['seat'][1] - 2.0 + dy)


def pedal_legs(b, near='pedal', far='pedal', lift=None):
    """The legs on the pedals (ankles from the pedal points). lift = {'legN': (ankle, shoe, bend)}
    replaces a leg (the kick)."""
    lg = {'legN': (RK.foot_on(b['pn']), near, 1), 'legF': (RK.foot_on(b['pf']), far, 1)}
    if lift:
        lg.update(lift)
    return lg


def grip_arms(b, near=None, far=None):
    arms = {'armF': (b['gripF'], ('hand', 'grip'), -1), 'armN': (b['grip'], ('hand', 'grip'), -1)}
    if near:
        arms['armN'] = near
    if far:
        arms['armF'] = far
    return arms


def frame(bike=None, torso='lean1', head='fwd', hd=(0, 0), tor=(0, 0), pel=(0, 0), legs=None, arms=None,
          k=0, strip='', fx=None, stamps=None, dy=0, rider=True):
    """The bike (fat_bike kwargs), the rider (torso and head parts, offsets), legs / arms: callables
    of the bike points (default: on the pedals and the grips). fx = [(x, y, letter)] canvas px;
    stamps = [(fx part, (x, y) canvas)]. dy lifts the whole frame (the cower's hop). Returns X.Frame."""
    cv = RK.canvas(W, H)
    b = BK.fat_bike(cv, (R[0], R[1] - dy), **(bike or {}))
    j = {'bike.front': b['front'], 'bike.rear': b['rear'], 'bike.pn': b['pn'], 'bike.grip': b['grip']}
    if rider:
        p = seat_pel(b, *pel)
        lg = legs(b) if legs else pedal_legs(b)
        ar = arms(b) if arms else grip_arms(b)
        j.update(RK.rider(cv, p, torso, head, lg, ar, hd=hd, tor=tor))
    if PASSENGER['draw']:
        j.update(PASSENGER['draw'](cv, b, k, strip, 0.0) or {})
    rows = RK.finish(cv, fx or ())
    for part, at in stamps or ():
        rows = RK.stamp(rows, part, at)
    return X.Frame(rows, (R[0], R[1] + 1), pts={}, joints=j), b
