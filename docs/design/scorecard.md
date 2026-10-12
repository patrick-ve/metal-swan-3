# METAL SWAN 3 — Design proposal scorecard

Lead designer review of the three proposals in `docs/design/proposals/`, checked against
`docs/ORIGINALITY.md`, `docs/ARCHITECTURE.md`, `docs/api/*.md` and the feel targets in
`docs/research/mechanics.md` §22. Scores are 1–10 (10 = best).

| Criterion | `faithful.md` (Plume Legion) | `comedy.md` (Fanfare Legion) | `spectacle.md` (Cold Front) |
|---|---|---|---|
| Originality and IP safety | 7 | 9 | 6 |
| Fun and arcade feel (fidelity to the reference mechanics and pacing) | 8 | 7 | 7 |
| Variety and spectacle | 7 | 8 | 9 |
| Feasibility (procedural art, synth audio, data-driven missions, parallel agents) | 6 | 7 | 5 |
| Coherence and tone | 8 | 9 | 7 |
| **Total (of 50)** | **36** | **40** | **34** |

## faithful.md — "Arcade-Faithful" (36)

- **Originality 7.** Invented names and a strong look (crimson tunics, plumed shakos). Risk: the
  GILDED status (turn into gold, "full statue" death, gold-turning boss mist) is close to two
  protected items in research §23 (the MS3 gold-turning beam and the "turning to gold" death gag).
  The "GO!" sign with an arrow and the `ARMS` label in the HUD are protected HUD signatures.
- **Arcade feel 8.** Best pacing rules (the 4-second rule, breather cadence, weapon generosity,
  escalation) and dense, well-timed waves. Continues on the spot, no boss bar. Movement numbers
  (jump apex 40 px, 38-tick air time) and the 60-second timer do not follow the research targets.
- **Variety 7.** Good set pieces (bandstand plaza, avalanche, gold train with low bridges,
  elevator spire), 4 vehicles, 4 mini-bosses. Infantry and machines are mostly generic types.
- **Feasibility 6.** 22 sections, 16 custom background generators, a 4096×432 slope section,
  4 mini-bosses, a 3-arena final boss and 13 prop types. Very large for parallel agents.
- **Coherence 8.** Vain ceremonial army, bird motif used with care (geese, feathers, Honker).

## comedy.md — "Personality & Comedy" (40) — chosen as the base

- **Originality 9.** The strongest own identity: an army built from a marching band, critics as
  hostages, Helium Head as the status gimmick, a swan walker that swims. Fixes needed: its HUD
  uses `ARMS` / `BOMB` boxes and a `GO!` arrow (protected signatures).
- **Arcade feel 7.** Clear telegraph and fairness rules, sheet-music boss telegraphs. Too soft
  in places: extends every 100,000 points, hostages lost only since the last checkpoint on Normal,
  a 4-attacker stacking cap, 60-second timer, movement numbers off the research targets.
- **Variety 8.** Seven very different bosses (riverboat, drum tank, bagpipe airship, walking
  piano, flying organ, console, podium), 4 vehicles, 3 vertical sections, anthem salutes, parade
  columns, floating pianos, subway trains.
- **Feasibility 7.** Most ideas reuse existing primitives (rig shako/bobble/bowtie options already
  exist, telegraphs are sounds, which suits synth audio). Costs: speech bubbles, about 8 extra
  infantry animations, a `headScale` rig parameter, vehicle carry-over between sections.
- **Coherence 9.** Every enemy is one instrument and one personality; the bird motif (Cygnets,
  Trumpeter, the Mute, Golden Goose) is present but not overdone.

## spectacle.md — "Spectacle & Variety" (34)

- **Originality 6.** Fresh weather theme, but the final boss stage "THE FALL" (fight while falling
  through a vortex on floor chunks) is close to the protected MS3 free-fall final fight
  (research §23.2). Same HUD `GO!` issue. Hostage "banking" is original.
- **Arcade feel 7.** Run speed matches the research; jump and timer do not. Hostage banking and
  Stormhead (no grenades) soften the classic risk/reward.
- **Variety 9.** Best set-piece list: falling tree bridge, rising flood climb, avalanche chase,
  mirage copies, cuckoo-clock telegraph, bosses that each test a different skill.
- **Feasibility 5.** Needs camera auto-scroll, layer drift, raisable water hazards, darkness
  overlays, a boss fought during auto-scroll, a falling arena and 20 mission-local entity types.
- **Coherence 7.** Weather theme holds; the swan motif is weak and some rides feel random
  (bathtub hovercraft).

## Decision

**Base: `comedy.md`.** Grafted into `docs/GAME_DESIGN.md`:

- From the research (mandatory): all core feel numbers from mechanics.md §22 (run 1.5, jump
  −3.5 / gravity 0.13, grenade arc, knife 30 / 20 ticks, damage unit pistol = 10), the 60-count
  timer with 256 ticks per count, MS-style hostage loss on Normal, 3 lives without score-only
  extends below 500,000, the machine-gun crate on continue, the ram on fire + jump.
- From `faithful.md`: the pacing rules (4-second rule, breather cadence, weapon generosity, one
  weapon crate per arena), arcade-faithful continues on the spot (no checkpoint rewind),
  `pickup-repair`, the 2-player HP scaling, a credits option with FREE PLAY as the default.
- From `spectacle.md`: the falling-tree bridge (m1), the avalanche chase (m3, also in
  `faithful.md`), the rising-meltwater climb (m3 cave route), the boss "skill tested" table, the
  set-piece kill bonus, the ground-hopping mine weapon (`bounce-mine`).
- Fixes: our own HUD (icons and digits, no `ARMS`/`BOMB` boxes, `ONWARD` chevrons instead of a
  `GO!` arrow, `RIDE` marker instead of `IN`), the anthem's wrong note is a plain semitone (the
  tracker has no per-note detune), boss-final-fast is its own song.
