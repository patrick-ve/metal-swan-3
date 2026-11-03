# PATRICK: the squad's nerd. Black slick swept-back hair with short sides, a thin mustache and light
# chin stubble, a black zip jacket over a white t-shirt with a blue lanyard badge, blue-black jeans,
# dark sneakers with white soles. Melee: a computer keyboard. Fidget: a bite of a frikandel.
# Loaded by hero.py when HERO=patrick; changes the shared tables in place for this process only.
import rig
import parts as P
import parts2  # noqa: F401  (VINCENT's 2x set; import it before our 1x edits, it is not used at 1x)
import anims as A
from heroes import patrick_parts as PP
from heroes import patrick_anims as PA

# ------------------------------------------------------------------ palette
# hair and jacket share the jacket ramp (J j q Q, both near-black); 'A' is the blue-black hair sheen.
rig.apply_hero({
  'A': '#6a7896',                                            # hair sheen
  'J': '#646a82', 'j': '#3a3d54', 'q': '#232538', 'Q': '#0e0e16',  # black jacket + hair
  'L': '#fadcbc', 'S': '#e4ac84', 's': '#c08460', 'z': '#84503a',  # light-tan skin
  'b': '#b88e74', 'B': '#4e3a32',                            # chin stubble, mustache / lines
  'w': '#fffaf0',
  'T': '#f6f6f2', 't': '#c3c7d2',                            # white t-shirt, sneaker soles, badge
  'R': '#3c96e0', 'r': '#1d528e',                            # blue lanyard
  'P': '#5a6a8e', 'p': '#3c4866', 'o': '#283048', 'O': '#151a2a',  # blue-black jeans
  'X': '#5c6070', 'x': '#2e3040', 'v': '#1a1a24',            # dark sneakers
  'C': '#9a4e26', 'E': '#562610',                            # frikandel (dark-brown snack sausage)
}, hero='CE', dark={'C': 'E', 'E': 'Q', 'A': 'Q'})

PP.install(P)
PA.install(A)

# ------------------------------------------------------------------ extension wave (heads, poses)
from heroes import patrick_heads as PH
P.HEADS.update(PH.heads())


def after_ext():
    from heroes import patrick_ext
    patrick_ext.after_ext()


def after_derive():
    from heroes import patrick_ext
    patrick_ext.after_derive()
