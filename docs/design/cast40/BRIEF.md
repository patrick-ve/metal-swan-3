# The cast at 40 px: one sample frame per enemy and character

The user approved a new sprite fidelity for the five player heroes (the "squad at 40 px"). Now every
enemy and character of the game gets ONE sample frame at the same fidelity, so the user can see how
each would look. Do NOT draw animation sets: one strong, characteristic frame per character.

    CAST  = this folder (cast40/)          your work
    RIG   = ../squad40 (../spike40 in the session scratchpad the work ran in)   the approved squad rig; read it, never edit it
    REPO  = the game repository (this folder is docs/design/cast40 in it)   read-only for you

## The bar (look before you draw)

- The approved heroes: `RIG/out/g_*.png` (VINCENT) and `RIG/out/<thom|dirk|bob|patrick>/g_*.png`. View
  them with the Read tool. Also `RIG/out/` holds the Swan (`ext_ride_swan.py`, stage sprites
  `swan_b` / `swan_f`). Record of the decisions: `REPO/docs/design/squad40.md`.
- 1x pixels on the game's 384x216 grid. A standing adult man is about 40 px (VINCENT: 29x42 idle with
  the pistol). Size everyone against him: a child or a short person smaller, a big man taller and
  wider, animals and machines at their real size against a 1.8 m man (a car is about 100 px long, a
  gull about 13 px tall, a pigeon about 8 px). Bosses may be big.
- The style: hand-drawn rigid parts (heads, torsos, shoes, hands, props) as character grids; limbs as
  two-bone IK tubes shaded like cloth cylinders with creases at bent joints (`pose.leg`, `pose.arm`,
  `rig.Canvas.tube`); one selout pass (a far part's edge next to a nearer part takes its dark tone:
  `rig.DARK`); one 1 px exterior outline 'K'; light from the upper front; 3-4 tone ramps per material,
  no pillow shading, no banding, no lone pixels. Straight backs, the head centred over the torso (the
  user disliked a hunched look a lot). Faces must read at 1x: clear eyes, a mouth line, brows.
- Creatures and machines use the same tools: draw the body as grids and/or tubes on a `rig.Canvas`,
  then `cv.finish()` (selout + outline). Same light, same outline, same ramp discipline.
- Colours: at most 30 distinct colours per sample, outline included (VINCENT idle uses 28); a boss
  may use 40. Fewer is better for enemies that come in crowds. A colour may be see-through only where
  the character really is (a ghost): write it as '#rrggbbaa'; everything else is opaque '#rrggbb'.
- The game's current sprite ids (to pick `INFO['old']`, add '#k' for frame k, e.g.
  'enemy/handhaver/throw#2') are listed in `old/ids.txt` (id, frame count, 1x size).

## How a sample plugs in

`chars/<id>.py` (extra helpers `chars/<id>_*.py` are fine). `castkit.py` explains the API at the top;
`chars/vincent.py` is the smallest example. Your module defines:

```python
import castkit as K
INFO = dict(
  name='DISPLAY NAME', mission=['ams'],          # missions it appears in: ams, oat, oldenzaal
  role='enemy',                                   # enemy | boss | npc | ally | animal | hero
  kind='HUMANOID',                                # HUMANOID | CREATURE | MACHINE
  face=-1,                                        # -1 = faces left as it does in the game (enemies)
  pose='aims the rifle, standing',                # what the frame shows
  note='one line: what makes it read, what changed from the current look',
  old='enemy/rifleman/idle',                      # the game's sprite id closest to this frame, if known
  air=0,                                          # px above the ground line (fliers, a waver in a window)
)
def frame():
    ...                                           # patch the rig tables, draw
    return rows, root                             # K.humanoid(upper, lower) / K.full(p) / K.finish(cv, root)
```

- A human: patch the tables like a hero module does (see `RIG/heroes/BRIEF.md` "How a hero plugs in"
  and the four hero modules `RIG/heroes/<name>.py` as worked examples): `K.palette({...}, dark={...})`,
  new `K.P.HEADS['fwd']`, `K.P.TORSOS['up']` (rebuild 'lean' with `K.P.shear` if you use it),
  `K.P.SHOES`, `K.P.GUNS` / `K.P.HANDS` / `K.P.FISTS` / `K.P.ITEMS`, limb ramps `K.pose.RAMP`, limb
  lengths `K.pose.THIGH/SHIN/UPPER/FORE`, `K.pose.PEL_DY`, the hooks `K.pose.HOOKS` ('pat', 'back',
  'post'). Build the pose with `K.A.up / gun / hand / legs` or the existing sets in `K.A.UPPER` and
  `K.A.LOWER`. Limb thickness is fixed inside `pose.leg` / `pose.arm`; monkeypatch them in your module
  for a fat or thin body. For a taller figure set `K.pose.W/H/RX/RY` (canvas) in your module.
- Ramp roles for selout: keep every letter's dark tone in `rig.DARK` (pass `dark=` to `K.palette`).
  Never recolour 'K' or the effect letters `F f c e W I i m D d M u y` if you use effects.
- Everything is per process: `python3 cast.py <id>` imports only your module, so patch freely.

## Loop

```sh
cd CAST
python3 cast.py <id>            # out/<id>.json, out/<id>.png (8x), out/<id>_vs.png (next to VINCENT)
python3 lineup.py <id> <id> ... # out/lineup_pick.png: your batch on one ground line, 3x
```

View the PNGs with the Read tool. Iterate until each sample reads at 1x and at zoom: a clear
silhouette, the right size next to VINCENT, the character's identity obvious in one glance, clean
pixels. Compare with the heroes' sheets often.

## Rules (binding)

- Write only `chars/<your ids>*.py` and `out/<your ids>*` (`out/lineup_pick.png` too). Never edit
  `castkit.py`, `cast.py`, `lineup.py`, `BRIEF.md`, anything in the RIG, or other agents' files. Other
  agents work in this folder at the same time.
- Keep each character's design from the game: read its current art code and the design docs named in
  your assignment, keep its identity (clothes, colours, props, build, gag), and lift it to the new
  fidelity. Small improvements that help it read are welcome; say what you changed.
- Originality: never name any commercial game, studio, artist, celebrity, brand or comedy character
  in files, code, comments or your report. No brand logos or real trademarks (a logo is a plain
  shape). Never draw a likeness of a real public person: a mayor, a cop, a tourist are fictional
  types.
- No git commands. Never open, print or copy `.env.local` or any API key. No network.
- Builds must be deterministic: never take a tie-break from a set's order (`max(sorted(set(x)),
  key=x.count)`).

## Report (your final message, short, plain English)

Per sample: the id, size (w x h), colours, the pose, and one line on the design. Then anything you
could not resolve, and the weak spots you know about.
