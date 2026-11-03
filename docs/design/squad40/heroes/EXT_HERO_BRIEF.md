# Extension wave, part 2: make the new animations YOUR hero's own

VINCENT now has every animation family the game needs (47 page groups in 8 categories: Core, Pistol
extras, Heavy weapon, Moves, Deaths, Full body, Swan ride, Status). The families are generic modules
(`ext_heavy.py`, `ext_moves.py`, `ext_ride.py`, `ext_status.py`) that run for every hero after the
hero module, so your hero already HAS every animation, built from his own parts. Your job: make each
new group read as YOUR hero at the approved quality, and fix what the generic route gets wrong.

    SPIKE = docs/design/squad40 (the spike ran in a session scratchpad)

Read first: `heroes/BRIEF.md` (the hero rules: they all still bind), `EXT_BRIEF.md`, `ext.py`, then
skim `ext_heavy.py`, `ext_moves.py`, `ext_ride.py` (and `ext_ride_helium.py`) to see how the poses are
built. Look at VINCENT's new sheets `out/g_*.png` (the bar) and at your hero's current sheets.

## How you change things (your files only: `heroes/<name>*.py`, `out/<name>/`)

- New heads: add them to `P.HEADS` when your module is imported (like your other heads), so the Helium
  Head step derives balloon heads from them. Needed names: `happy panic yawn sleep bored soot sootblink`
  (look at VINCENT's in `ext_moves.py` / `ext_ride.py` for the intent; draw your own face). Check
  `ext.HEAD_FALLBACK` for any other name the modules use.
- Poses: define `after_ext()` in `heroes/<name>.py`. It runs after the families are built and before
  Helium Head copies the sets, so you can replace or edit any new key (`A.UPPER['h_slash'] = ...`,
  `A.FULL['bored'] = ...`). Define `after_derive()` to touch derived things at the very end (a hand-made
  balloon head: `P.HEADS['he_fwd'] = ...`, then rebuild the affected `he_*` sets if needed).
- Do NOT edit `ext_*.py` or any shared file. If a family has a generic bug, work around it in your
  module for your hero only and report it.
- Never use a set's order for a tie-break (`max(set(x), key=x.count)` gives other pixels per process):
  use `sorted(set(x))`. The build must give the same pixels on every run.
- Colour budget as before: 26 hero colours is the hard cap.
- Likeness: build the new expressions on your hero's approved heads. You do not need the photos.

## Loop

    cd $SPIKE
    HERO=<name> python3 sheet.py "" 5 --cat Deaths          # one category (Core, Pistol, Heavy, Moves,
    HERO=<name> python3 sheet.py "victory" 8                # Deaths, Full body, Swan ride, Status)
    HERO=<name> python3 build.py --dry                      # composes all, checks the steps
    HERO=<name> python3 build.py                            # at the end: writes out/<name>/sprites.json

Sheets go to `out/<name>/g_<group>.png`; view them with the Read tool next to VINCENT's `out/g_*.png`.
Go through ALL 47 groups at zoom at least once. Other hero agents work in this folder at the same
time; only run your own hero.

## Report (final message, short, plain English)

What you drew or changed per category, the new heads, your bored and second fidget ideas, the colour
count, any workaround for a generic bug, and the weak spots you know about.
