# MECHA HASLEMA (boss/ams-mayor): the high-fidelity baked set (plan docs/design/ams40.md "The mayor",
# decision D4: at most 64 colours, pal.py). Started by the wave 1 look pilot; wave 6 stage 1 drew
# the pieces below and this build; stage 2 adds the limb strips (limbs.py) and registers the set.
#
# The pieces follow the game's part sprites one to one (one shared anchor: (0, 0) = the floor point
# between her feet; drawn facing right, as the game's unflipped sprites):
#   body.body(stage)                  -> body-<stage>       jacket, blouse, lapels, steel neck + cables
#   head.head_frame(stage, f)         -> head-<stage>       face plate, eyes, grille, the wave locks
#                                                           (10 frames: head.FRAMES / HEAD_* events)
#   wig.flight(k)                     -> wig                8 tumble frames (the death), anchor =
#                                                           the launch point (-6, -128)
#   jewel.chain(stage, gone)          -> chain-<stage>|gone the gold links and the enamel shields
#   jewel.medallion(stage, f)         -> medallion-<stage>  7 frames: jewel.MED_FRAMES / MED_* events
#   bits.spring(h), bits.shadow(w)    -> spring, shadow     the death boing, the floor target
#   props.*                           -> noise-letter, shield-shot, stamp-wave (the projectiles)
#   limbs.legs(f)                     -> legs               } stage 2: limbs.strips(s) adds these
#   limbs.stamp_arm(pose, stage, ...) -> stamp-arm-<stage>  } strips (and stamp-arm-gone, arm-back,
#   limbs.arm_back(f)                 -> arm-back           } lash) with their events
# Every piece is finished on its own (selout + the one warm near-black outline), as the game draws
# them one by one. figure() composes them in the game's draw order (mayor.ts draw()).
import art40 as X

from . import bits, body, cv, head, jewel, limbs, pal, props, wig  # noqa: F401

SET = X.Set(prefix='boss/ams-mayor', budget=64, face=1, outline=pal.OUTLINE, hl=pal.HL, fx=pal.FX,
            colours=pal.PAL)

PIECE_WHY = 'a piece of the composed boss rig: the code picks the frame (a role or a damage stage)'


def frame(L):
    """A finished piece -> a Frame whose root is the boss's shared anchor (0, 0)."""
    rows, root = cv.to_rows(cv.finish(L, fx=pal.FX))
    return X.Frame(rows, root)


def build(s):
    """Every strip of the set (stage 1: the pieces and the props; stage 2: limbs.strips)."""
    # the head at the three damage stages: the frame roles of head.FRAMES (the code picks them)
    for st in (0, 1, 2):
        s.strip(f'head-{st}', [frame(head.head_frame(st, f)) for f in range(len(head.FRAMES))], 6,
                cls='piece', why=PIECE_WHY)
    for name, v in head.EVENTS.items():
        s.event(name, v)
    # the body and the chain: one frame per damage stage (the code adds the idle breath)
    for st in (0, 1, 2):
        s.strip(f'body-{st}', [frame(body.body(st))], 6, cls='piece', why=PIECE_WHY)
    for st in (0, 1, 2):
        s.strip(f'chain-{st}', [frame(jewel.chain(st))], 6, cls='piece', why=PIECE_WHY)
    s.strip('chain-gone', [frame(jewel.chain(2, gone=True))], 6, cls='piece', why=PIECE_WHY)
    # the medallion: closed / open / glow and the in-betweens of the opening and the charge
    for st in (0, 1, 2):
        s.strip(f'medallion-{st}', [frame(jewel.medallion(st, f)) for f in range(len(jewel.MED_FRAMES))], 6,
                cls='piece', why=PIECE_WHY)
    for name, v in jewel.MED_EVENTS.items():
        s.event(name, v)
    # the death: the wig tumbles off (8 turns of 45 degrees, mayor.ts reads (wigSpin / 3) % 8), the
    # head boings on its spring (4 heights)
    s.strip('wig', [frame(wig.flight(k)) for k in range(8)], 6, cls='piece', why=PIECE_WHY)
    s.event('WIG_FRAMES', 8)
    s.strip('spring', [frame(bits.spring(h)) for h in bits.SPRING_H], 6, cls='piece', why=PIECE_WHY)
    s.strip('shadow', [frame(bits.shadow(w)) for w in bits.SHADOW_W], 6, cls='piece', why=PIECE_WHY)
    # the projectiles (shots.ts reads their frames by its own ticks)
    s.strip('noise-letter', [frame(props.noise_letter(k)) for k in range(4)], 6, cls='prop')
    s.strip('shield-shot', [frame(props.shield_shot(k)) for k in range(4)], 4, cls='prop')
    s.strip('stamp-wave', [frame(props.stamp_wave(k)) for k in range(4)], 3, cls='prop')
    # stage 2: the limbs (legs, stamp-arm-<stage>, stamp-arm-gone, arm-back, lash) and their events
    if hasattr(limbs, 'strips'):
        limbs.strips(s)


def pieces(stage=0, arm=0, face='smile', legs_f=0, mirror_text=False, med_frame=0):
    """The finished pieces of one moment, back to front (the order of mayor.ts draw())."""
    fx = pal.FX
    return [
        cv.finish(limbs.arm_back(0), fx=fx),
        cv.finish(limbs.legs(legs_f), fx=fx),
        cv.finish(body.body(stage), fx=fx),
        cv.finish(head.head(stage, face), fx=fx),
        cv.finish(jewel.chain(stage), fx=fx),
        cv.finish(jewel.medallion(stage, med_frame), fx=fx),
        cv.finish(limbs.stamp_arm(arm, stage, mirror_text), fx=fx),
    ]


def figure(stage=0, arm=0, face='smile', legs_f=0, facing=-1, med_frame=0):
    """The whole boss as one picture {(x, y): letter}; facing -1 = left (as in the fight: the frame is
    mirrored, the stamp label is drawn pre-mirrored so it reads)."""
    pic = cv.compose([(p, 0, 0) for p in pieces(stage, arm, face, legs_f, facing < 0, med_frame)])
    return cv.mirror(pic) if facing < 0 else pic
