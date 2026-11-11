# The spec of a level — template

Phase 3 of `docs/LEVEL_GUIDE.md`. Copy the skeleton below to `docs/design/<id>.md` and fill it from the approved
level card and the approved look sample. The spec is the one file a builder reads: a builder with this file, the
guide and the code can build their part without the chat. `docs/design/oat.md` is a complete spec of this
project: read its §0–§2 and one section block before you write yours, for the level of detail.

Rules of a spec:
- **Numbers, not adjectives.** Widths in px, positions in world x, hours, HP, counts, ticks, colours as tables.
  A number that play or a frame may change is marked "start value"; the builder's report says what moved and why.
- **Every user decision is a row** of §0 with "user". Your own choices are rows with "lead". Nothing the user
  decided is restated in softer words further down.
- **Point, do not copy.** The laws, the look method, the kit and the engine API live in their own files; the spec
  names the file and section. It holds only what is true for this level alone.
- **Each section block can be handed to one agent**: it names the files that agent owns.

```
# Mission <id> — level <n>, <NAME>: <subtitle> (spec, <date>)

<Five lines: the user's request in their words, the pitch, where the level sits in the campaign.>
This file is THE SPEC for the <id> waves. Inputs: docs/design/<id>/brainstorm.md (the approved level card),
the look sample (<page link>, kit files), docs/LEVEL_GUIDE.md.

## Status
| Phase | State | Date | Note |
|---|---|---|---|
| 1 Brainstorm | approved | | |
| 2 Look sample | approved | | page <link>, version <n> |
| 3 Spec | in review | | |
| 4 Play | — | | |
| 5 Paint | — | | |
| 6 Port | — | | |
| 7 Ship | — | | |
Next step: <one line>. Open questions for the user: <list or none>.

## 0. Decisions
| # | Decision | By |
(every row of the level card, then every decision taken since)

## 1. Flow
The route (section ids, links, splits), the mission card, how the level starts and ends, the length in minutes
and ticks, checkpoints, the timer.

## 2. The sections
A table: id, name, hour, width in px, scroll, set piece, water, new mechanics, boss.
Then one block per section:
### 2.n `<id>-<k>` <NAME> — <hour>, <width> px
- Play layout: ground line, platforms and ledges with x and y, water and hazards, the floor (street kinds along
  x, squares, bays, kerb depths), decor that carries play (awnings, decks, boats).
- Script: waves with enemy ids, x triggers and counts; locks and arenas; hostages; secrets; pickups; dialogue.
- Scene (from the look sheet): planes far to near with speeds, the set piece, local things, what moves, the
  rules of the place (each one a gate).
- Entities that stand on scenery: the pairing list (perch → lamp, waver → window, vendor → hatch …).
- Owner files: the kit modules and the game files of this section.

## 3. Cast
Returning enemies (ids). New enemies, one block each: what it does, HP, attacks with timings, score or euros,
the art job (frames, families). Locals, hostages, gags.

## 4. Boss (and mini-boss)
The arena, the phases, tells and windows, how it ends.

## 5. Mechanics and set pieces
One block per new mechanic: rule, numbers, engine work, tests.

## 6. The look
The look sheet of this level (docs/design/level-guide/look.md "Look sheet"): hours with key and air tables, plane
speeds, the scale rule's numbers on each plane, the ground grammar of this place, the building grammar,
materials and ramps, water, emitters and night, motion. Deviations from docs/design/canal-look.md, each with its
reason. The gates of the look, with target values.

## 7. Sound
Songs, sfx, voices, announcer lines; generated or synth; ids.

## 8. Originality and sensitivity
What is parody and of what, what is generic, names that were checked; the dated paragraph for
docs/ORIGINALITY.md.

## 9. Architecture and files
New files and folders, shared files that change and who may change them, budgets (memory, bytes, draw time),
tests to add, fixtures to regenerate.

## 10. The build
The waves (Phase 4–7 of the guide) cut for this level: per wave the agents, what each one owns, the gates, the
stop for the user. Baseline numbers taken before the first wave.
```

## Done when

1. Every heading is filled or says "none" with a reason. Every number a builder needs is in the file.
2. You gave the spec to one fresh helper agent (Agent tool, `model: "opus"`, `effort: "high"`) with only this question: "List every
   point where you would have to guess to build section <k> from this spec and the guide." Its list is empty, or
   each item is fixed.
3. The user read the summary (the flow, the sections table, the cast, the build waves, the open points) and
   approved it in their own words. The Status table says so.
