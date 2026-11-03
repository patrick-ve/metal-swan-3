# Shared helpers for the ams locals and the stag party samples (handhaver, stag-partier,
# stag-partier-2, stag-groom, hostage-tourist): thicker limb tubes for heavy builds, cuff swaps,
# grid edits. Imported by those modules only; every patch stays inside one cast.py process.
import castkit as K
from rig import ik

pose = K.pose
P = K.P

# limb radius multipliers (1.0 = VINCENT); a heavy build sets these before drawing
LEG_R = [1.0]
ARM_R = [1.0]


def _leg(cv, X, hip, ank, bend, ramp, z, part, shoe='flat'):
    knee, end = ik(hip, ank, pose.THIGH, pose.SHIN, bend)
    pose.place(cv, X, X.P.SHOES[shoe], 'ankle', end, z - 0.2, part + ':shoe')
    c = pose.CUT[ramp]
    k = LEG_R[0]
    pose.tube(cv, X, hip, knee, 3.0 * k, 2.6 * k, pose.RAMP[ramp], z, part, c)
    pose.tube(cv, X, knee, end, 2.6 * k, 2.1 * k, pose.RAMP.get(ramp + '2', pose.RAMP[ramp]), z, part, c, u0=pose.THIGH)
    pose.crease(cv, X, hip, knee, end, 2.6 * k, pose.RAMP[ramp], z, part)
    return knee, end


def _arm(cv, X, sh, hand, bend, ramp, z, part, end=None):
    elbow, wr = ik(sh, hand, pose.UPPER, pose.FORE, bend)
    c = pose.CUT[ramp]
    k = ARM_R[0]
    pose.tube(cv, X, sh, elbow, 2.6 * k, 2.2 * k, pose.RAMP[ramp], z, part, c)
    pose.tube(cv, X, elbow, wr, 2.2 * k, 1.8 * k, pose.RAMP.get(ramp + '2', pose.RAMP[ramp]), z, part, c, u0=pose.UPPER)
    pose.crease(cv, X, sh, elbow, wr, 2.2 * k, pose.RAMP[ramp], z, part)
    info = {'elbow': elbow, 'wrist': wr}
    if end:
        kind, name = end
        lib = {'gun': X.P.GUNS, 'fist': X.P.FISTS, 'hand': X.P.HANDS}[kind]
        info.update(pose.place(cv, X, lib[name], 'wrist', wr, z + 0.5, part + ':' + kind))
        info['wrist'] = wr
    return info


def install_limbs(leg_r=1.0, arm_r=1.0):
    LEG_R[0], ARM_R[0] = leg_r, arm_r
    pose.leg = _leg
    pose.arm = _arm


def cuff(rows, to):
    """VINCENT's white shirt cuff 'T' becomes another letter (a sleeve end or bare skin)."""
    return [r.replace('T', to) for r in rows]


def edit(rows, changes):
    out = [list(r) for r in rows]
    for y, x, s in changes:
        for i, ch in enumerate(s):
            if ch != ' ':
                out[y][x + i] = ch
    return [''.join(r) for r in out]


def part(text, **anchors):
    return (K.grid(text), anchors)
