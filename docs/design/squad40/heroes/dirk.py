# DIRK: a plumber with combat skills. Hi-vis vest over a dark work polo, navy work trousers with
# knee pads, brown work boots, a tool belt; melee = a plunger. Built on VINCENT's rig and poses.
import rig, pose
import parts as P

rig.apply_hero({
  # hair: medium brown with lighter spiky tips (also the plunger's wooden handle and the belt)
  'A': '#a8763f', 'H': '#6c4527', 'h': '#432918', 'Q': '#24140e',
  # skin: a round, rosy face
  'L': '#ffe0cf', 'S': '#f5b199', 's': '#dc8776', 'z': '#9a4c40',
  # stubble (light over the jaw) and the darker chin patch
  'b': '#cf9a84', 'B': '#8a604f',
  # fluorescent yellow hi-vis vest
  'J': '#e4f43c', 'j': '#b2c41e', 'q': '#69761a',
  # dark charcoal-brown work polo (collar, sleeves = arm tubes)
  'R': '#6a5d52', 'r': '#4a4039', 'U': '#322a26',
  # plunger cup (dark red rubber)
  'C': '#b8323c', 'E': '#6e1520',
  # navy work trousers
  'P': '#61708f', 'p': '#434f6c', 'o': '#2e3650', 'O': '#1b2033',
  # brown leather work boots
  'X': '#8a6038', 'x': '#573a22', 'v': '#2a1a10',
}, 'RrUCE', {'J': 'q', 'j': 'q', 'q': 'Q', 'R': 'Q', 'r': 'Q', 'U': 'Q', 'C': 'E', 'E': 'Q'})

pose.RAMP['arm'] = ['R', 'r', 'U', 'Q']
pose.RAMP['armF'] = ['r', 'U', 'Q', 'Q']

from heroes import dirk_parts as DP

P.HEADS.update(DP.HEADS)
P.TORSOS.update(DP.TORSOS)
P.SHOES.update(DP.SHOES)
P.GUNS.update(DP.GUNS)
P.FISTS.update(DP.FISTS)
P.HANDS.update(DP.HANDS)
P.FX.update(DP.FX)


def _pat(part, u, v, k, ch):
    """Knee pads: a dark grey pad over the front of each knee (u = distance from the hip)."""
    if part in ('legN', 'legF') and pose.THIGH - 1.3 <= u <= pose.THIGH + 1.7 and v < 2.2:
        far = part == 'legF'
        return ['N', 'N', 'v', 'v'][k] if far else ['n', 'N', 'N', 'v'][k]
    return ch

pose.HOOKS['pat'] = _pat

from heroes import dirk_anims  # noqa: E402,F401

# monkeypatch (this process only): a far arm brought in front of the body (z >= 4: plunger,
# fidget) is lit like the near arm, so the dark polo sleeve does not read as a black blot
_arm = pose.arm
def _arm_lit(cv, X, sh, hand, bend, ramp, z, part, end=None):
    if ramp == 'armF' and z >= 4:
        ramp = 'arm'
    return _arm(cv, X, sh, hand, bend, ramp, z, part, end)
pose.arm = _arm_lit

# the extension sets: new heads and parts, the relative far-arm light, after_ext / after_derive
from heroes import dirk_ext  # noqa: E402
dirk_ext.install_light()
after_ext = dirk_ext.after_ext
after_derive = dirk_ext.after_derive
