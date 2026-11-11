# One frame of the delivery rider ON his bike (the cast sample's composition): the bike by geometry,
# the seated rider on the rig's IK limbs (the feet on the pedals, the hands on the grips or busy),
# the cube backpack behind the torso with its own lag. Returns an art40 Frame with every joint.
import art40 as X

from . import bike as B
from . import kit
from . import parts

W, H = 120, 100
R = (60, 92)                     # the ground point under the bottom bracket (canvas px)
ROOT = (R[0], R[1] + 1)          # the feet anchor: the tyres' bottom outline is drawn ON row R[1]


def cube_back(dy=0, dx=0):
    """The cube rides high on the back, its front edge on the shoulder blades; dy / dx: its lag
    (secondary motion, px)."""
    rows = parts.CUBE

    def draw(cv, out):
        an = out['torso']
        x0 = round(an['shF'][0]) - 13 + dx
        y0 = round(an['neck'][1]) + 1 + dy
        kit.grid(cv, x0, y0, rows, 4.4, 'cube')
        # the near shoulder strap over the jacket
        kit.line(cv, (an['shF'][0] - 1, an['shF'][1] - 1), (an['shF'][0] + 1, an['shF'][1] + 5), 'o', 5.5, 'torso:strap')
        out['cube'] = (x0 + 6.5, y0 + 6.5)
    return draw


def frame(crank=112, spin=0.0, torso='lean', head='fwd', hd=(0, 0), tor=(0, 0), pel=(1, -1),
          armN=None, armF=None, legN=None, legF=None, cube=(0, 0), rot=0.0, lift=0, fx=(),
          bell=True, light=False, extra=None, pts=None, smear=False):
    """One on-bike frame. armN / armF: None = the hand on its grip, else (target, end, bend) with a
    target relative to the grip. legN / legF: None = the foot on its pedal, else (ankle, shoe, bend)
    with an ankle relative to the ground point R. pel: the pelvis relative to the saddle top.
    lift: the whole picture is drawn this many px higher (a hop). extra(cv, g, p, out): more
    drawing. fx: [(x, y, letter)] relative to the bell (glow, no outline)."""
    cv = kit.canvas(W, H)
    g = B.Geo((R[0], R[1] - lift), rot=rot)
    p = B.draw(cv, g, crank=crank, spin=spin, bell=bell, light=light)
    seat = p['seat']
    pp = (seat[0] + pel[0], seat[1] + pel[1])
    gx, gy = R
    legs = {
        'legN': (kit.foot_on(p['pn']), 'flat', 1) if legN is None else ((gx + legN[0][0], gy + legN[0][1]), legN[1], legN[2]),
        'legF': (kit.foot_on(p['pf']), 'toe', 1) if legF is None else ((gx + legF[0][0], gy + legF[0][1]), legF[1], legF[2]),
    }
    grip = p['grip']

    def arm(a, near):
        if a is None:
            t = (grip[0] + 0.5, grip[1] - 0.5) if near else grip
            return (t, ('hand', 'grip'), -1)
        t, end, bend = a
        return ((grip[0] + t[0], grip[1] + t[1]), end, bend)
    arms = {'armF': arm(armF, False), 'armN': arm(armN, True)}
    out = kit.rider(cv, pp, torso, head, legs, arms, hd=hd, back=cube_back(*cube) if cube is not None else None, tor=tor)
    if extra:
        extra(cv, g, p, out)
    bx, by = p['bell']
    rows = kit.finish(cv, [(bx + x, by + y, ch) for x, y, ch in fx])
    j = dict(out['joints'])
    j['pedalN'] = p['pn']
    j['pedalF'] = p['pf']
    if 'cube' in out:
        j['cube'] = out['cube']
    nk = j['head.neck']
    gpts = {'hand': j.get('armN.wrist', pp), 'head': (nk[0] + 1, nk[1] - 7), 'hip': pp}
    if pts:
        gpts.update(pts(j, p))
    return X.Frame(rows, ROOT, pts=gpts, joints=j, smear=smear)
