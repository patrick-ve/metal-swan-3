# Mission `oat` — the API of the waves

Level 2, `MISSION 2` "OAT OF CONTROL" (spec: `docs/design/oat.md`, sections 0–15). This file is the
contract between the builders of wave A (CORE first; then BUDGET, STRIPS, LIGHT-WATER, GRAMMAR,
STREET-A, AUDIO in parallel; then INTEGRATE-A, REVIEW, FIX) and the waves B and C (spec §12).
CORE wrote it (2026-10-31); every builder adds its own section below as it lands.

`oat` is a normal `defineMission` 2D mission on the **unchanged** `MissionRunner`, loaded **lazily**
(spec decision 49). Every engine change is an **additive opt-in** (off by default): the 13 identity
sims (`tmp/oat-lead/id.sh`) stay SAME and the existing frames (`tmp/oat-lead/frames.sh`) keep every
pixel until the budget lands (spec §7.10 names the DIFFs BUDGET may cause).

## 1. Contracts for the parallel agents (quick reference)

| Contract | Where | Owner after CORE | Use |
|---|---|---|---|
| Budget types, `euroText`, `pay` | `src/game/budget/` (`types.ts`, `format.ts`, `pay.ts`) | BUDGET | §3 |
| `MissionDef.economy` / `.tally` | `src/game/mission/types.ts` | BUDGET reads them | §3 |
| Strips: `SectionDef.strips`, `StripSource`, `StripPlan`, the store | `src/game/mission/strips/` | STRIPS (store, view.ts), GRAMMAR (a source) | §4 |
| Light: the neutral API, the oat flags, the section sun | `src/game/mission/light/api.ts` | LIGHT-WATER | §5 |
| `SunDef`, `sunFrom`, `HdCanvas.render({ sun })` | `src/game/art/hd/light.ts`, `canvas.ts` | everyone (read only) | §5 |
| `BgCanvas` colour set (`bgPalette`) | `missions/ams/art-hd-bg-kit.ts` | everyone (read only) | §6 |
| `PAL_HD_OAT`, `HD_OAT_FULL_PALETTE`, `inOatPalette` | `src/engine/palette-hd.ts` | everyone (read only) | §6 |
| The `€` glyph | `src/engine/font.ts` (both 1× fonts; HD follows) | — | §3 |
| The kit folders | `missions/oat/{facade,floor,light,art}/index.ts` | GRAMMAR, STREET-A, LIGHT-WATER, STREET-A | §7 |
| Ids | `missions/oat/ids.ts` | CORE (add, never rename) | §8 |
| Section layout numbers | `missions/oat/terrain.ts` (`OAT_A` … `OAT_E`) | the section's builder | §9 |
| Lazy loading | `content/index.ts` `isOatContent`, `scenes/oat-route.ts` | CORE | §2 |

## 2. Flow, numbers and lazy loading (CORE, wave A)

- **Route** (spec §1): `FPS_ROUTE = ['ams', 'oat', 'rally', 'fps-1', 'fps-2', 'oldenzaal']`;
  `missionNumber`: ams 1, oat 2, rally 3, the fps floors 4, oldenzaal 5; columns `M1`, `M2`,
  `M3`, `F1` / `F2`, `M5`. `ams.next = 'oat'`, `oat.next = 'rally'`. The dormant ring keeps its
  `MISSION 2` card. The rally card is `MISSION 3` (first line `TAXI PAID. NOW THE SQUAD RACES DE
  RINGRALLY: THREE LAPS OF THE A10.`, announce `MISSION THREE. VOL GAS!`), oldenzaal `MISSION 5`
  (`MISSIE VIJF. BLIJF BIJ ELKAAR, ZWAANTJES!`). The new texts' takes come in wave C
  (`tools/audio/spec.ts` `PENDING_RETAKES`: the old takes stay shipped until then).
- **The route guard** (`scenes/flow.ts` `routeAllows`, the m5 trap): a mission on FPS_ROUTE is
  opened by `missionDone` only from its route predecessor (`flow-data.ts` `routePredecessor`) or by
  an explicit `next`. With oat loaded, `listMissions()` is `ams, m0…m5, oat, oldenzaal`, so m5's
  sorted next is `oat`: the guard sends m5 to the campaign ending.
- `goldenRecordRoute` switches to FPS_ROUTE once the campaign played `oat` (or the rally, the ring,
  `fps-1`). ALL GOLDEN RECORDS needs oat's record (oat-a, at the hijsbalk, x 2,240).
- **Lazy:** the manifest entry `'missions/oat'` is lazy (`isLazyContent`); `isOatContent(id)` accepts
  `missions/oat`, `missions/oat/…`, `oat`, `oat/…`, `bosses/oat-…`, `music/oat`, `sfx/oat…`,
  `samples/oat`. **Builders: name new manifest entries so `isOatContent` accepts them** (the
  manifest is orchestrator-owned: list the entry in your report). Who loads it:
  - the MISSION 2 card (`MissionIntroScene`, `oat-route.ts` `loadOatContent`): it holds past its
    time-out until `oatLoadState().registered`; a failed chunk goes on to the rally's card;
  - a direct `?mission=oat` boot (`boot.ts`: the chunk with the boot's content, then its 1× `art`
    and its sample group);
  - the art workers (`art-worker.ts`): when a request names an oat sprite (`isOatSpriteId`);
  - the node tools and tests: `createHeadlessGame({ missionId: 'oat' })` (sim, shot, arena, floor-
    clip) and `loadContent(isOatContent)`; `npm run sprites` loads every art module anyway.
- **The card** (`missions/oat/card.ts` `OAT_CARD`) is NOT lazy: `content/ui/cards.ts` lists it, so
  `missionCard('oat')` works before the chunk loads. `MissionCard.look?: 'folder'` is set; wave C
  draws the folder (until then the default card with a plain map of the canal belt).
- URL: `?mission=oat`, `&section=oat-a … oat-e`, `&boss=1` (De Huisjesmelker's arena; with
  `section=oat-a`: De Makelaar's), `players`, `char`, `god`, `debug`, `art`, `res`, `difficulty`.
- Smoke (`tools/smoke.ts`): the CI route (`mission=ams&boss=1&debug=1`) runs ams → its tally →
  `followOat` (the oat card → oat, F4 skips it → its tally: `MissionCompleteScene` or BUDGET's
  `ReceiptTallyScene`) → `followRally` (the MISSION 3 card → the glitch → the race) → … as before.

```ts
import { isOat, loadOatContent, oatLoadState } from '../scenes/oat-route';
await loadOatContent();                 // tests: register the lazy mission
oatLoadState().registered;              // true once `oat` is a registered mission
```

## 3. The budget contract (BUDGET implements it; spec §7)

- `Cents` = signed integer euro cents; `START_CENTS` 10.000 (€ 100,00); `DISPLAY_MAX_CENTS`
  9.999.999 (± € 99.999,99); `EXTEND_CENTS` [100.000, 300.000] (gross income).
- `BUDGET_CATEGORY` (≤ 32 ids → the kassabon's labels; tune the labels, never the ids):
  `enemy`, `boss`, `item`, `record`, `prop`, `deposit`, `sponsor`, `flatWhite`, `matcha`, `zuurdesem`,
  `brioche`, `lakschade`, `boete`, `blowverbod`, `pickpocket`, `wallet`, `refund`, `assessment`,
  `courtage`, `courtageBack`, `rent`, `tax`, `taxiEscaped`, `deposit250` (BORG TERUG), `fare`,
  `bonus`, `prize`, `treasure`, `other`.
- `BudgetLedger` (the slot's ledger: `cents`, `gross`, `book(cents, category)` → extends earned,
  `tally(category)`, `missionNet`, `startMission()`), `PayEvent` (the `pay` event), `EuroTextOpts`.
- `pay(world, slot, cents, x, y, category)`: the one pay path (signed; a stub in wave A).
- `euroText(cents, { plus?, compact?, clamp? })`: `€ 1.234,56`, `-€ 12,34`, `+€0,15`, `-€95`.
- `MissionDef.economy?: 'euro'` (set on ams, oat, oldenzaal; nothing reads it before BUDGET) and
  `MissionDef.tally?: 'receipt'` (oat: the kassabon, `scenes/receipt-tally.ts`).
- The `€` glyph: `getFont('small' | 'big').glyph(0x20ac)` (appended last, so the atlases' older cells
  keep their place and pixels); `measure('BUDGET -€ 12.345,67')` = 101 px ≤ 170.

```ts
import { euroText, pay } from '../../budget/index';
pay(world, owner, 15, x, y, 'deposit');                    // a can: +€ 0,15
hud.message(0, euroText(-9500, { compact: true }));       // '-€95'
```

## 4. The strips contract (STRIPS: the store and the view; GRAMMAR: the source; spec §8.6)

- `SectionDef.strips?: SectionStripsDef` = `{ source, depth, height, rows: StripRowDef[], prefetch?,
  keepBehind?, dark?, darkFrom? }`; a row = `{ u0, u1, sheet, seed?, params? }`.
  `depth` = floor depth px behind the walk line (oat-a 16: the façade base at y 160).
- A source registers once: `defineStripSource(id, { plan(def, section) → StripPlan })`. The plan is
  pure and deterministic: `height`, `covers(cx)`, `bands(cx, d)`, `paint(cx, d, set, band, out)`
  (out = (256·d) × (height·d), cleared by the store; paint only that band's rows), optional `lots()`.
- The store (`createStripStore(def, section)` → `StripStoreApi`: `plan`, `prepare(viewX, speed)`,
  `chunk(cx, d, set?)`, `darkMix`, `bytes`, `dispose()`): the wave-A stub plans but builds nothing.
  STRIPS owns jobs (≤ `STRIP_JOB_MS` 16 ms each, ≤ `STRIP_FRAME_MS` 8 ms per frame), prefetch
  (`STRIP_PREFETCH` 1, 2 under auto-scroll), eviction (`STRIP_KEEP_BEHIND` 2), the two light sets
  and the accounting, and draws the chunks from `view.ts` at the façade depth.
- Unknown or failing sources fail soft (no plan, warned once).

```ts
import { defineStripSource, STRIP_CHUNK } from '../../../mission/strips/index';
defineStripSource(OAT_STRIP_SOURCE, { plan: (def, s) => grammarPlan(def, s) });
// SectionDef: strips: { source: OAT_STRIP_SOURCE, depth: 16, height: 168, rows: [{ u0: 544, u1: 1568, sheet: '9-straatjes' }] }
```

## 5. The light contract (LIGHT-WATER implements the oat flags; spec §8.3, §8.4, §8.8, §8.9)

- **The neutral home:** `src/game/mission/light/api.ts` (moved from `content/oldenzaal/kit/
  light-api.ts`, which re-exports it: the same functions and the same registry; oldenzaal draws as
  before). `LIGHT_TAG` stays `'oz-light'` for every mission.
- **New optional flags** (default = today): `SectionLight.glow?: 'block' | 'smooth'`, `streaks?:
  boolean | StreakConfig`, `groups?: LampGroupDef[]` (`{ name, state?, flicker? }`), `bakes?:
  BakeConfig` (`{ x0, x1, start?, fadeTicks? }`); `StaticLight.group?`, `StaticLight.streak?`;
  `LightSpot.streak?` (the pass resets it before each `lightOf`). Script calls: `lampGroup(world,
  name, 'on' | 'off' | 'flicker')`, `crossFadeLight(world, 'lit' | 'dark', ticks?)` (optional
  `LightControl.group` / `.lightSet`; no-ops until the pass has them).
- **The sun per section:** `defineSectionSun(id, { elevation, yaw, color, key, elevationEnd? })`,
  `sectionSun(id)`; `sunFloorShadow(sun, h, out)` (Δu = h·cot e·cos yaw, Δv = −h·cot e·sin yaw) and
  `sunWallShadow(sun, d, out)` (Δx = d·cot yaw, Δy = d·tan e / sin yaw). The start table
  (`missions/oat/light/index.ts` `OAT_SUN`): oat-a 32°/40° #ffd9b6, oat-b 40°/30° #ffedde, oat-c
  18°/45° #ffc18d, oat-c1 15°→11°/45° #ffb16e; oat-d and oat-e have none.
- **`SunDef`** (`art/hd/light.ts`): `{ key, bounce, half }`; `DEFAULT_SUN` holds the very `KEY`,
  `BOUNCE`, `HALF`; `sunFrom(e, yaw, bounce?)`; `diffuse(…, sun?)`, `specular(…, sun?)`,
  `HdCanvas.render({ sun })` (key, bounce, specular and cast-shadow direction). No sun = byte for
  byte as before (tested).

```ts
const sun = sectionSun('oat-a');                                   // LIGHT-WATER's table
canvas.render({ outline: 'none', shadow: 0.3, sun: sun?.key });    // a sprite lit by the section's sun
defineSectionLight('oat-d', { darkness: 0.35, tint, glow: 'smooth', streaks: true, groups: [{ name: 'neon-1' }], lamps });
```

## 6. Palette and index painting (spec §8.5)

- `PAL_HD_OAT` (11 ramps, 43 colours, all new; `HD_OAT_NEW`): `canal` 6, `nightWater` 4, `brick` 7,
  `mortar` 4, `green` 4, `oxblood` 3, `lantern` 4, `redLight` 3, `neonPink` 2, `neonCyan` 2,
  `nightSky` 4. Strictly rising luma; hand-built in even Oklab steps between the research's guide
  values (no measured value ships as measured). Apart from PAL_HD and the oldenzaal sets
  (`HD_PALETTE`, `HD_FULL_PALETTE`, `HD_R2_FULL_PALETTE` unchanged).
- `HD_OAT_FULL_PALETTE` = PAL_HD (209) + the 43 = 252 colours. **Hard cap 255** (a BgCanvas index
  is a byte; 0 = clear): at most 3 more oat colours. `inOatPalette(c)`: the oat palette test.
- `BgCanvas(w, h, d, palette = HD_BG_PALETTE)`; `bgPalette(colours)` (cached) gives the set's
  `ix`, `colourOf`, `nearest`, `tableOf` and the `lut`. The module functions stay the PAL_HD set's.

```ts
const OAT_BG = bgPalette(HD_OAT_FULL_PALETTE);
const c = new BgCanvas(256, 168, 4, OAT_BG);
c.rect(0, 100, 256, 68, OAT_BG.ix(PAL_HD_OAT.brick[3]));
const px = c.finish();
```

## 7. The scenery kit folders (one owner each; spec §11)

| Folder | Owner (wave A) | One-line contract (its `index.ts`) |
|---|---|---|
| `missions/oat/facade/` | GRAMMAR | registers the strip source `OAT_STRIP_SOURCE` and exposes the planned lots (`facadeLots(section, opposite?)`: `FacadeLot` heights, gables, protrusions) for the shadows and the tests |
| `missions/oat/floor/` | STREET-A (a; the d proof strip) | registers the `oat-…` floor painters and each section's `FloorDef`; the wetness field (`defineWetness(id, fn)`, `wetnessOf(id)`) |
| `missions/oat/light/` | LIGHT-WATER | the sun table (`OAT_SUN`), the shadow function, the oat-d / oat-e lights, the water tiles and baked reflection strips |
| `missions/oat/art/` | STREET-A (a; the d proof strip) | the decor sprites under `decor/oat/<section>/…`; no outline on static props, outline A on hittables; every pixel `inOatPalette` |
| `missions/oat/backgrounds.ts` | STREET-A | the `oat-…` background generators |
| `src/game/budget/` + the hooks | BUDGET | §3 |
| `src/game/mission/strips/`, `mission/view.ts` | STRIPS | §4 |
| `mission/light/*`, `mission/floor/reflect.ts` | LIGHT-WATER | §5 |
| the sample group, `tools/audio/spec.ts`, `content/music/oat.ts`, `content/sfx/oat*.ts` | AUDIO | spec §9 |
| `missions/oat/{index,ids,card,lines,terrain,helpers,placeholder,section-*}.ts`, `scenes/oat-route.ts` | CORE → INTEGRATE-A | §2, §8, §9 |

Later waves: `content/oat/traffic/` CAST-DAY, `content/bosses/oat-makelaar/` MAKELAAR,
`content/oat/budget/` + `set-pieces/` PIECES, `section-b.ts` + `set-pieces/queue.ts` QUEUE-B,
`section-c*.ts` + `set-pieces/kade*.ts` KADE, `section-d.ts` scenery NIGHT, `content/oat/wallen/`
CAST-NIGHT, `content/bosses/oat-huisjesmelker/` HUISJESMELKER, `section-e.ts` + `taxi-ride/` TAXIRIT.

## 8. Ids (`missions/oat/ids.ts`)

- Mission `OAT_ID` 'oat'; sections `OAT_SECTION` `oat-a`, `oat-b`, `oat-c`, `oat-c1`, `oat-d`, `oat-e`
  (`OAT_SECTIONS`, `OAT_WIDTH` 4,608 / 2,816 / 2,048 / 4,096 / 4,352 / 6,144).
- Enemies `OAT_ENEMY`: `oat-brammobiel`, `oat-bakfiets`, `oat-taxi`, `oat-dealer`,
  `oat-handhaver-scooter`; reused `OAT_LOCALS`: `handhaver`, `fatbike-youth`, `delivery-rider`,
  `boete-ticket`. Bosses `OAT_BOSS`: `oat-makelaar`, `oat-huisjesmelker`, the crowd `oat-viewers`.
- Pieces `OAT_PIECE`: `oat-bin`, `oat-can`, `oat-bottle-s`, `oat-bottle-l`, `oat-haverbar`,
  `oat-envelope`, `oat-hoist`, `oat-street-organ`, `oat-conceptstore`, `oat-queue`, `oat-tour-group`,
  `oat-kade-collapse`, `oat-sinkhole`, `oat-neon-out`, `oat-taxi-ride`, `oat-seat`. Statuses
  `OAT_STATUS`: `oat-flat-white`, `oat-matcha`, `oat-zuurdesem`, `oat-brioche-power`.
- Sprite prefixes `OAT_SPRITE_PREFIXES`: `item/oat/`, `ui/oat/`, `npc/oat/`, `decor/oat/`, `fx/oat/`,
  `enemy/oat-`, `boss/oat-` (never under an ams prefix: ams sits at 251.6 of 256 MB); generator,
  painter, tile and strip ids start with `oat-` (`OAT_GEN_PREFIX`; the strip source `oat-facade`).
- Songs `OAT_SONG`: `oat-a`, `oat-b`, `oat-c`, `oat-d`, `oat-boss`; sfx prefix `oat/`; ambience
  `OAT_AMBIENCE` (`oat/env/morning` … `oat/env/taxi`); speakers `OAT_SPEAKER`; group `mission:oat`.

## 9. Sections and the stubs (CORE, wave A)

The six sections are playable PLACEHOLDERS (plain sky and city, the stock concrete street:
`placeholder.ts`; plain terrain at the spec's widths with the bridges' +12 humps in oat-a): the
checkpoints of spec §2, the locks with stand-in waves of the ams locals (`helpers.ts`
`standInWave`, `lockedFight`), the place-and-clock banners (`lines.ts` `SECTION_BANNERS`), the exits
in play order, oat-e's `missionComplete()`.

| Section | Stub behaviour | Numbers (`terrain.ts`) |
|---|---|---|
| oat-a | three locks (lock 1 2,048–2,432, lock 2 3,200–3,584, the arena 4,224–4,608, timer paused); the golden record at 2,240 on the street; `bossStart` 4,250 | `OAT_A` (bridges, streets, shops, hoist, organ, bins) |
| oat-b | DE RIJ 1,344–1,728 (timer paused); exit from 2,780 | `OAT_B` |
| oat-c | the lock 768–1,152; `DE KADE ZAKT!` at the jetty | `OAT_C` |
| oat-c1 | `startVehicle: 'swan'`, the canal as one water hazard (96–3,904), auto-scroll 1.0 → 1.2 from 2,048, no timer; the exit from the water before the end jetty | `OAT_C1` (pontoons, the closed bridge, the sinkhole, `stopX` 3,600) |
| oat-d | the bridge lock 1,280–1,664, the `03:00` callout, the arena 3,968–4,352 (timer paused); `bossStart` 3,990 | `OAT_D` |
| oat-e | an auto-scroll stand-in on foot (1.5 px/tick), no timer, `missionComplete()` at the end | `OAT_E` |

`bossSection` 'oat-d', `bossSections` ['oat-a', 'oat-d'], `hostages: {}`, `artDensity` 4,
`denseReserve` 84 MB, `economy` 'euro', `tally` 'receipt', `audioGroup` 'mission:oat'.

## 10. Run and test

```
npm run sim -- --mission oat --god --expect-complete [--players 2] [--section oat-c1] [--boss]
npm run shot -- --mission oat --section oat-a --x 600 --res 4 --art 4
npx vitest run tests/content/mission-oat.test.ts tests/game/oat-flow.test.ts tests/art/oat-contracts.test.ts
```

Gates (spec §13): typecheck, the full vitest, `tmp/oat-lead/id.sh` (SAME, or SAME+BUDGET for the
euro missions), `tmp/oat-lead/frames.sh` (SAME), the oat sims, `npx vite build` + `npm run smoke` on
your own port (the CI route and `mission=oat&god=1`).
