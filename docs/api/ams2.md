# Mission `ams2` API: level 1 again, in the hero method

Code: `src/game/content/missions/ams2/**`, the kit `src/game/art/herokit/**`. Spec: `docs/design/ams2.md`. How to build or change a
section: `docs/design/ams2-contract.md`. Tests: `tests/content/ams2.test.ts`, `tests/content/ams2-dense-budget.test.ts`,
`tests/art/herokit.test.ts`.

`AMS2` is `ams` with new scenery. Each section is `stageSection(sectionX from ams, { background, decor, overrides })`: the `script`,
`terrain`, `exits`, `playerStart`, `checkpoints`, `respawn` and timers are the **same objects** as in `ams`, so a change of play in `ams`
goes to `ams2` by itself. Changing an `ams` section's world numbers (`ams/terrain.ts`) also moves what `ams2` paints from them.

## Access

- `?mission=ams2`, with `&section=a|b|c|c1|c2|d`, `&boss=1`, `&art=1|2|4` as for every mission.
- Lazy chunk (`content/index.ts` `isAms2Content`). Only a direct boot, the art workers (when a request names a `decor/ams2/` id) and the
  node tools load it. Without `?mission=ams2` the chunk does not run: the service worker only keeps a copy with all other assets.
- Stand-alone: never on `FPS_ROUTE`, and `ams.next` does not point at it. After the tally the game goes to the title.
- `npm run sim -- --mission ams2`, `npm run shot -- --mission ams2`, `npx tsx tools/herokit/frame.ts --section a --cam 60 --art 4 --gate`.

## The additive engine hooks

All of them are off by default. No other mission sets them, so no other mission changes.

| Hook | Where | What |
|---|---|---|
| `SectionDef.paintedFloor` (`true`, `'all'`) | `mission/types.ts`, `mission/view.ts` | The section's decor draws the ground. `true`: no ground cells and no pit shafts. `'all'`: the terrain painter draws nothing. The collision terrain does not change |
| `SectionDef.spriteOverrides` | `mission/types.ts`, `mission/runner.ts`, `engine/sprites.ts` `setSpriteOverrides` | While the runner draws this section, a shared sprite id shows its twin's frames. Logic, the HUD and other missions see the shared id. A twin keeps the frame order and the anchor rule |
| `DecorDef.animStep` | `mission/view.ts` | Frames per animation step. A band tile keeps its tile while it animates |
| `DecorDef.animPhase` | `mission/view.ts` | `animate` counts from tick + this. `stageSection` (`settleMotion`) sets it, so no two items step in the same tick |
| `DecorDef.moveX`, `moveSpan`, `moveFrom` | `mission/view.ts` | A far mover: a decor that travels by itself and wraps |
| `MissionDef.standalone` | `mission/runner.ts`, `scenes/flow.ts` | No next mission. `missionDone` goes to the title |
| `MissionDef.seedAs` | `mission/runner.ts` | The sections seed as the named mission, so a bot plays both the same |

## Motion, letters and slopes in the kit

- **Frames of one drawing** (`renderFrames`, used by `defineArt` and `defineBand`): a later frame shows the first frame's fine pixels except where its own 1× drawing differs, plus one pixel around that. A small change in the 1× drawing stays a small change at every tier.
- **Crowns** (`swayCrown`): one crown, with a few leaf tufts on its edge and a few clusters inside that change per frame. `stageSection` gives every crown its own slow step (45 to 75 ticks) and phase.
- **Water** (`waterBand`): tiles (a stroke past W runs on from x 0; EPX, the ramp step and the water grain wrap too). A later frame moves one crest dash in five and wobbles the reflection in one pair of rows in seven. `WATER_TPF` sets a slow step per plane.
- **Letters and arrows** (`S.stamp`, `S.stampGrid`, `text`): they stay out of EPX and come back as whole blocks at the end of `renderIds`. Something drawn later over a letter wins.
- **Slopes** (`defineBand` `layers`): a layer with `shear` is drawn level, and each fine column moves down after the finer-pixel step, so a slope has one regular step pattern at each tier. Piers and walls stay in a straight layer.

## The rules a test holds

| Rule | Test |
|---|---|
| The same play objects and the same sim as `ams`: each section, and both routes from `a` to `d`. The bot completes all of them | `ams2.test.ts` |
| No `SectionDef.floor`; `paintedFloor: 'all'` in every section | `ams2.test.ts` |
| An Amsterdammertje stands on kerbstones only. `kerbPosts` throws `PostOnWrongGround` on the bike lane, the road, a water cut or a band without a kerb. The test checks every post sprite in every decor list against the painted kerb under its feet | `ams2.test.ts` "the post rule" |
| The 4× working set fits `DENSE_BUDGET_BYTES`, for one and two players | `ams2-dense-budget.test.ts` |
| The kit gives the same pixels as the reference code, except the water (it tiles and moves less) and the letters at 2× and 4× (stamps) | `herokit.test.ts`, `tests/fixtures/herokit.json` |
| Water tiles at every tier; a later water frame and a later crown frame change a small part; letters stay whole | `herokit.test.ts` |

Figures (heroes, enemies, the boss, hostages, pickups, fx) stay the shared sprites. A new sprite that stands in for shared scenery goes in
`overrides`. A scripted entity keeps its code.
