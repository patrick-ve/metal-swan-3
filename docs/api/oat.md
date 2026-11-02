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

## LIGHT-WATER (wave A): the shade function, the light pass flags, water

Owner LIGHT-WATER (spec §8.3, §8.4, §8.8, §8.9). Files: `missions/oat/light/` (`sun.ts` the sun
table `OAT_SUN`, `shadow.ts` the pure shade model, `section-shade.ts` the per-section builder, `day.ts`
the day passes, `night.ts` the oat-d / oat-e lights, `water.ts` the water tiles and reflection strips;
`index.ts` re-exports all and registers them on import), `mission/light/*` (the pass: `pass.ts` the
flags, `glow.ts` the smooth glow, `contact.ts` the sun tails), `mission/floor/reflect.ts` (dynamic
reflections).

### The shade function (spec §8.4) — for GRAMMAR, STREET-A, STRIPS

Space in metres: x = world u to the right (20 px/m on the floor and in the ground band), z = depth
from the row we look at ("our façade", z 0) toward the camera, h = height over the street. The sun
is LEFT and in front: shadows fall right and toward the back. `sectionShade(id)` builds the
section's `StreetShade` once (the sun of `OAT_SUN`, the street widths `OAT_STREETS`, the opposite
row from `facadeLots(id, true)` — or a seeded skyline from the street sheet until GRAMMAR plans one —
and the registered casters). Every query returns **0 = full sun … 1 = full shade**; d 1 = a hard
edge (the 1× snap), d 2 / 4 = a soft penumbra. Night sections (oat-d, oat-e) never shade. Paint
shade at most `SHADE_TONES` (1.5) tones darker.

```ts
import { sectionShade, facadeMetres, wallShadowPx, sunGeom } from '../light/index';
const shade = sectionShade('oat-a');
shade.floor(u, v, d);                                   // a floor texel (world u, v): STREET-A, wetness
shade.facade(u, facadeMetres(hPx, lot.bandTop), d);     // a façade art px (u world px, h px over the base)
shade.facadeLine(u);                                    // the opposite row's line on our façade, metres
const g = sunGeom(32, 40);                              // or shade.geom (null at night)
wallShadowPx(g, 0.5, yPx, lot.bandTop, out);            // a 0.5 m cornice's shadow on its wall: out.dx right, out.dy down (px)
```

- **Mixed scale** (spec §8.2): `facadeMetres(hPx, bandTopPx)` / `facadePx(m, bandTopPx)` (20 px/m up to
  the lot's band top, 8 px/m above); `PX_PER_M` 20, `PX_PER_M_UPPER` 8, `PX_PER_M_LOT` 12.
- **Floor depth**: z = W · (v − vFacade) / (vOpposite − vFacade) (the band from our façade's base to
  the opposite façade's line just below the view is the street's W metres); `shade.zOfV(u, v)`,
  `shade.vOfZ(u, z)`. The camera defaults are spec §2's (a: yh 60, f 210, back 160); a section with
  its own floor sets `defineSectionShade(id, { camera: { yh, f, back } })`.
- **Streets** (`OAT_STREETS`, start values): a Berenstraat 8.3, Wolvenstraat 8.2, Oude Spiegelstraat
  6.6 m; b Huidenstraat 8; c / c1 23 m; bridges, vistas and open quays have no opposite row (full
  sun). Tune with `defineSectionShade(id, { streets: [{ u0, u1, w, open? }] })`.
- **Casters** (one source of truth: the decor list): register a shape per decor sprite prefix,
  then add the section's decor once at load:
  `defineCasterShape('decor/oat/a/lantern', lanternShape(4.3))`,
  `addShadeCasters('oat-a', castersFromDecor('oat-a', A_DECOR))`. Shapes: `postShape(h, r)`,
  `lanternShape(h)`, `elmShape(crownH, crownR, holes)` (dappled), `boxShape(w, d, h)`; raw casters
  `{ kind: 'post' | 'box' | 'crown' | 'plate', … }` (u world px; z, h, r metres). Register before
  the first query (the model is cached; `defineSectionShade` / `addShadeCasters` drop it).
- Numbers the tests pin: the floor shadow per metre of height a 1.60, b 1.19, c 3.08, c1 3.73 → 5.14;
  H_s a ≈ 4.5 m (12.5 m eaves, 8.2 m), b below the base (lit; a 0.5 m sun strip at the foot), c ≈
  2.4 m, c1 4.3 → 6.7 m.
- Import rule: inside `missions/oat/facade/` import `../light/shadow` and `../light/section-shade`
  and call `sectionShade` inside your paint functions (section-shade.ts imports `facadeLots`, so a
  top-level call would be a module cycle).

## STRIPS (wave A): the store, the strip space, the view

Owner STRIPS (spec §8.6, §8.9 hooks, §8.12). Files: `src/game/mission/strips/` (`types.ts` the
contract, `space.ts` the strip space, `store.ts` the store, `live.ts` the live binding,
`placeholder.ts` a test source, `source.ts` the registry) and the strip draw in
`src/game/mission/view.ts`. Tests: `tests/art/oat-strips.test.ts`; `tests/art/oat-strips-demo.ts`
(a `--import` module that puts the placeholder source on oat sections without strips).

- **The strip space** (`types.ts` "THE STRIP SPACE"): a strip is drawn 1:1 (crisp, palette-exact)
  and scrolls with the façade plane's line-scroll speed `s` (the floor's s at `strips.depth`; oat-a
  0.862; 1 without a floor; `StripSectionInfo.scale`). Strip x p = 192 + (u − 192) · s
  (`stripXOfU`, `uOfStripX`). Chunk cx = strip x [cx · 256, cx · 256 + 256) = world x
  `chunkWorldRange(cx, s)` (≈ 297 world px at 0.862). Heights in strip px = world px × s. Row
  bounds, `dark` and `darkFrom` stay in world x. A source paints band b of n into the art rows
  `stripBandRows(b, n, height · d)`; buffer column c is strip x cx · 256 + c / d; the bottom row is
  the façade base. This is exactly where a decor item at the façade depth stands (`shiftX`; tested).
- **The store** (`createStripStore(def, info, opts?)` → `StripStore`; the view makes it):
  `prepare(viewX, speed, d)` once per drawn frame: the chunks on screen, then the ones ahead (at
  least `prefetch`, default 1; more by speed: `ceil(|speed| · s · STRIP_LEAD_TICKS / 256)`, ≤ 4), as
  art jobs (one per band; the shared queue runs ≤ `HI_ART_FRAME_BUDGET_MS` = `STRIP_FRAME_MS` 8 ms
  per frame). A dense chunk on screen with nothing ready gets its 1× at once (no gap). 1× and the
  node tools (no deferral) paint at once. Eviction: two chunks behind the view's trailing chunk
  (one behind stays while the budget has room), and past the prefetch. Budgets (all densities, being
  painted included): lit `STRIP_BUDGET_BYTES` 18 MiB, dark `STRIP_DARK_BUDGET_BYTES` 11 MiB; near a
  cap the store releases behind first, then the far prefetch; on screen is always built.
  `frameOf(cx, d, set)` / `chunk(...)`: the best ready chunk ≤ d. `stats` (built, sync stand-ins,
  jobs, evicted, squeezed, refused, overBudget, peaks, `maxJobMs` with `opts.now`, failed).
- **The light sets** (spec §8.9): with `strips.dark: [x0, x1]` the chunks that touch the range also
  get a 'dark' bake, queued once the view's centre passes `darkFrom` (default x0 − 512). `darkMix`
  0 … 1: the view draws the lit chunk, then the dark one at alpha `darkMix`; at 1 the lit chunks
  wholly inside the range are released. **The hook for the light pass:**
  `setStripDarkMix(sectionId, mix)` (`live.ts`; the view binds its store by section id while it
  lives; `liveStripStore(id)` reads it). LIGHT-WATER's `lightSet` cross-fade calls it each tick.
- **The view** (`view.ts`): with a floor the strips draw after the band and its openings, before the
  back decor and rows; without one after the layers and `backHook`. Each chunk stands on the floor
  at the depth (`liftAt` of the row it overlaps most). `view.prepare` (the section start in the
  browser) paints the 1× on screen and queues the dense chunks for the preload. No `strips` = no
  store, no work, no draw.
- **For a source** (GRAMMAR): keep every band job under `STRIP_JOB_MS` (16 ms) via `bands(cx, d)`.
  Measure with `createStripStore(def, info, { deferred: () => false, now: () => performance.now() })`
  then `store.stats.maxJobMs`.

```ts
import { setStripDarkMix, createStripStore, stripXOfU } from '../../mission/strips/index';
setStripDarkMix('oat-d', mix);                          // the 03:00 cross-fade, each tick
const p = stripXOfU(lot.u0, info.scale ?? 1);           // a lot's left edge in strip x
// npm run shot -- --mission oat --section oat-b --x 600 --res 4 --art 4 --import tests/art/oat-strips-demo.ts
```

## GRAMMAR (wave A): the façade grammar and the `oat-facade` strip source

Owner GRAMMAR (spec §8.2, §8.5, §8.6, §8.10, §8.11). Files: `missions/oat/facade/` — `types.ts`
(ids, `LotPlan`, the scale constants), `sheets.ts` (the street style sheets), `grammar.ts` (the lot
sequencer), `rows.ts` (the start rows `OAT_STRIPS`, the opposite row, the plan cache), `palette.ts`
(material ramps, light tables), `raster.ts`, `parts.ts` (the part drawers), `light.ts` (sun, shade,
night bake, resolve), `source.ts` (the strip source), `index.ts`.

- **The source** `oat-facade` (`OAT_STRIP_SOURCE`) registers when `facade/index.ts` is imported (the
  oat chunk does). `SectionDef.strips = OAT_STRIPS['oat-a']` (or a section's own `{ source, depth: 16,
  height, rows }`). Bands per chunk: 1× 1, 2× 4 (night 5), 4× 12 (night 16).
- **Rows** (`StripRowDef`): `sheet` one of `'9-straatjes' | 'canal-front' | 'grimburgwal' | 'oudezijds' |
  'trompettersteeg' | 'oudekerksplein'` (the last two copy the Oudezijds numbers until NIGHT tunes
  them); `params` (`FacadeRowParams`, all optional): `slots: [{ u0, u1, kind: 'slot' | 'hoist', x?, id? }]`
  (a blank shop front for a decor sprite; the hoist warehouse with its beam at `x`), `night` (the
  night bake), `wet` (0 … 1: the damp foot), `lamps` (world x of the street lanterns the night bake
  lights the row from; default one every 150 px), `streetM`, `name` (lamp-group prefix).
- **One source of truth**: the source calls `defineFacadeRows(id, def.rows)` when it plans, so
  `facadeLots(id)` (the lots LIGHT-WATER and the tests read) are the drawn ones. A section whose rows
  differ from `OAT_STRIPS` should call `defineFacadeRows(id, rows)` at import time, so queries before
  the first paint agree too. `facadeLots(id, true)`: the unseen opposite row (one row over the whole
  width ± 600 px, the section's sheet, another seed); its ridges cast the shade on our row.
- **The lot** (`LotPlan`, a superset of `FacadeLot`): `gable`, `wall`, `window`, `ground`, `bandTop`
  (64–84, the seam), `seam`, `eaves`, `ridge`, `storeys[]` (22–26 px, windows at 1.6–1.9), `door`
  (44–48 px), `stoep` (26–32 px), `groundWindows` (shop glass 8 → 60), `hoist`, `anchorPts`,
  `protrusions` (cornice, beam/string, sills, hoist, awning, sign, flower box: depth in m), `wear`
  (≥ 6 marks), `features` (`hoist`, `slot`, `door`, and at night `lit-window`, `neon`, `red-tube`,
  `bar-window`, `wall-lamp` with `group` names for the 03:00 lamp groups).
- Light: day = `sectionShade(id).facade(u, m, d)` per px (the opposite row and the casters) + the
  protrusions' own `wallShadowPx` shadows; colours through `dayTables(sun.color)`. Night = the
  plan's lights (`nightLights(row)`), levels 0 … 5 × tints; the 'dark' set drops neon, red tubes,
  bar windows and two thirds of the lit windows. No outline ink anywhere (the two inks are never
  resolved to); 1× = the nearest non-ink `PAL` colour.

```ts
import { facadeLots, OAT_STRIPS, defineFacadeRows, planSection } from './facade/index';
strips: OAT_STRIPS['oat-a'],                                     // a section's def
const hoist = (facadeLots('oat-a') as LotPlan[]).find((l) => l.hoist)?.hoist;   // { u, h, roof }
// contact sheets: npx tsx tmp/oat-lead/grammar/sheet.ts oat-a 544 4 2 1   (SET=dark for the 03:00 bake)
```

## STREET-A (wave A): the oat-a scenery and the oat-d night proof strip

Owner STREET-A (spec §2.1, §2.5 0–1,280, §8.2, §8.5, §8.7 a and d, §8.10, §8.11). Files:
`missions/oat/floor/` (`layout.ts` the depths and stretches, `mat.ts` the materials, `painter.ts`
the floor painter `oat-street` and the wetness fields, `tiles.ts` the kerb face, the quay walls and
the bridges' arches, `a.ts` / `d.ts` the `FloorDef`s), `missions/oat/art/` (`kit.ts` the Pen kit over
the oat set, `street.ts`, `bridges.ts`, `vistas.ts`, `shops.ts`, `people.ts`, `night.ts` the sprites,
`layers.ts` the background generators, `place-a.ts` / `place-d.ts` the decor lists and the strip
rows), `missions/oat/backgrounds.ts` (`BG_OAT_A`, `BG_OAT_D`), the scenery fields of `section-a.ts`
and `section-d.ts`; `tests/art/oat-street.test.ts`.

What a section sets (both are wired already; INTEGRATE keeps them):

```ts
import { A_STRIP_ROWS, OAT_A_DECOR } from './art/place-a';
import { BG_OAT_A } from './backgrounds';
import { OAT_A_FLOOR, OAT_A_STYLE } from './floor/a';
// SectionDef
background: BG_OAT_A, terrainStyle: OAT_A_STYLE, floor: OAT_A_FLOOR,
strips: { source: OAT_STRIP_SOURCE, depth: 16, height: 168, rows: A_STRIP_ROWS },
decor: [...OAT_A_DECOR], art: [..., 'decor/oat/a/'],
// oat-d: BG_OAT_D, OAT_D_STYLE, OAT_D_FLOOR, D_STRIP_ROWS (0–1,280), OAT_D_DECOR, 'decor/oat/d/'
```

- **Depths** (floor depth px behind the walk line; camera yh 60, f 210, back 160): the façade plane
  16 (s 0.862: a façade-plane sprite of w art px spans w / 0.862 world px), the far kerb 11.5, the near
  kerb −12.5, the bridges' decks from the back edge to −13.6, the d coping −14 … −16.5 (y 192.5) with
  the canal in front. Decor depths: `A_DEPTH`, `D_DEPTH`.
- **The floor painter** `oat-street` (`params: { light: 'morning' | 'night', section, wear? }`):
  clinkers in herringbone, the pavement's stretcher bond, the grey tiles, granite kerbs, the quay
  coping; lit by `sectionShade(id).floor` (sun / shade ladders, shade ≤ 1.5 tones, a cool sky cast);
  wet / drying from the wetness field; the wear decals (≥ 12 marks per 256 px); at night the lamps of
  `D_LIGHTS` lift the wet brick in their own ramps (the streaks are the light pass's). `wear: false`
  paints the bare materials (the tests count the marks as the difference).
- **Wetness**: `wetnessOf('oat-a')` (wet in the shade after the night's rain, drying in the sun,
  puddles along both gutters and at the grates), `wetnessOf('oat-d')` (all wet, puddles).
- **Shop slots** (GRAMMAR's `slot` lots, `A_SHOP_SLOTS`): `haverbar` 704–768, `boutique-kaars`
  1,180–1,244, `conceptstore` 1,900–1,964, `boutique-zeep` 3,420–3,484; the hijsbalk's warehouse
  (`hoist` slot) 2,196–2,284 with its beam at 2,240. The shop fronts are decor at the façade plane.
- **Sprites** (`decor/oat/a/…`, `decor/oat/d/…`; `OAT_STREET_SPRITES`, `OAT_STREET_HITTABLE`): the bins
  `decor/oat/a/bin-100` (16 × 22) and `bin-200` (18 × 26) carry outline A (PIECES' `oat-bin` can draw
  them); every other street sprite has none. `OAT_A_PLATES`, `OAT_D_NEON` (`bar` pink, `snacks` cyan,
  `koffie` warm; 3 frames), `OAT_D_PLATE`.
- **Casters**: `floor/a.ts` registers the shapes of the lanterns, elms, Amsterdammertjes, bikes,
  staples, columns, chalkboards, plants and figures and adds the section's casters once
  (`addOatACasters`) before any chunk paints.
- **Layers**: `oat-a-sky`, `oat-a-roofs` (two rows), `oat-a-tower` (the Westertoren, once), `oat-d-sky`,
  `oat-d-roofs`, `oat-d-tower` (the Oude Kerk, once); the skies are in the FloorDefs' `skyLayers`.

## BUDGET (wave A): the euro budget is live

Owner BUDGET (spec §7). The full API is `docs/api/budget.md`. In short: `pay(world, slot, cents, x,
y, category)` now books (no longer a stub); the legacy `awardScore` sources pay euros through their
events with no change at the call sites; `MissionDef.economy: 'euro'` switches a mission's HUD,
tallies and tables; `MissionDef.tally: 'receipt'` gives oat the kassabon (`ReceiptTallyScene`);
`slowWorld(world, ticks)` (budget/slow.ts) is the MATCHA-MOMENT. The statiegeld bin, its cans and
DE HAVERBAR are in `src/game/content/oat/budget/` (`oat-bin`, `oat-can`, `oat-bottle-s`,
`oat-bottle-l`, `oat-haverbar`; manifest entry `oat/budget` still to add).

### The light pass flags (spec §8.4, §8.8, §8.9) — `mission/light/`

Every flag is off unless a section's `SectionLight` sets it; oldenzaal sets none, so it draws cell for
cell as before (frames.sh: only the HUD box differs, from BUDGET).

| Flag | What the pass does |
|---|---|
| `glow: 'smooth'` | at res ≥ 2 the lights still cut the 1× darkness map, but their colour is a dense additive glow frame at the art density (`GlowFrames`, cached per colour / radius / density): round glows, pools, flashes and streak dashes, no 4 × 4 blocks. 1× keeps the map's glow. |
| `streaks: true \| { y0, y1, length, strength, level, ripple }` | every `StaticLight.streak` lamp and every entity light whose `lightOf` sets `spot.streak = true` mirrors as a column of short dashes on the rows [y0, y1] (screen; the water or wet floor), centred on its mirror point `level` px under its floor row, swaying smoothly with the tick (no on / off sparkle). |
| `groups: [{ name, state?, flicker? }]` + `StaticLight.group` | `lampGroup(world, name, 'on' \| 'off' \| 'flicker')`: a flicker is a dying tube (uneven 3–6 tick steps between full and a third, 20–40 ticks, then off); with the reduced flashes a smooth fade. `pass.groupOf(name)` reads the state. |
| `bakes: { x0, x1, start?, fadeTicks? }` | `crossFadeLight(world, 'dark' \| 'lit', ticks?)` eases the mix over 60 ticks; the pass pushes it to the strips every tick (`setStripDarkMix`), the floor reads `lightSetMix(world)` (0 lit … 1 dark). |
| `day: true` | a day section: no darkness, no light map; the pass only draws the ground overlays below. |
| `water: ReflectConfig` | (a floor only, in the ground hook) the dynamic reflections of `mission/floor/reflect.ts`. |
| `sunShadows: { along, up, strength?, lit? }` | (a floor only, in the ground hook) the actors' cast shadows (`contact.ts`): a tail from the feet, `h · along` px right and `h · up` px up the screen, soft at 2× / 4×, checkered at 1×; none where `lit(x, y)` is 0. The floor's own contact ovals stay. |

The ground hook (`MissionLight.drawGround`, bound to the view's `floorHook` on a floor) draws the mist,
then the reflections, then the tails: after the floor band, before the contact ovals and the entities
(spec §8.1 steps 6–7).

```ts
lampGroup(world, OAT_D_GROUPS.neonWest, 'flicker');   // 03:00, group by group (spec §6.9)
setDarkness(world, 0.6, 60);
crossFadeLight(world, 'dark');                        // the arena's dark bake over 60 ticks
lightSetMix(world);                                   // the floor's bake: 0 … 1
```

### Dynamic reflections (spec §8.8) — `mission/floor/reflect.ts`

An entity mirrors when it has the tag `REFLECT_TAG` ('reflects') and a `reflectOf(out, tick)` that
fills the reused `ReflectSpot` (`sprite`, `frame`, `x`, `y` = its water line, `flipX`). At most 6 per
frame; the sprite is drawn flipped about the water line in 2 px row slices with a world-anchored
ripple offset (more with depth), alpha 0.5 → 0.35, only on the band's water rows and inside its u
range (through the floor's row scale). Renderer API only: GL and CPU floors draw the same.

```ts
class Swan extends Vehicle implements Reflector {   // + addTag(REFLECT_TAG) once in the world
  reflectOf(out: ReflectSpot): boolean { out.sprite = this.spriteId; out.frame = this.frameIx; out.x = this.x; out.y = this.y; out.flipX = this.facing < 0; return this.onWater; }
}
```

### The oat light configs — `missions/oat/light/`

- Day passes (`day.ts`): oat-a, b, c, c1 `{ day: true, sunShadows: sunTail(id), water? }`; a's water
  bands under the three bridges (y 190–216), c1's canal (96–3,904, y 160–216: KADE tunes it).
  `sunTail(id)` derives `along` / `up` from the sun and the floor camera; `lit` asks the shade model.
- Night (`night.ts`): `OAT_D_LIGHTS` / `OAT_E_LIGHTS` (`OatLamp`: u, depth, h, kind, r, k, group,
  streak) → `setNightLights(id, list)` registers the section light AND the floor light (each lamp at
  its depth, a pool). oat-d: darkness 0.35, smooth, streaks on the canal (y 193–216), groups
  `OAT_D_GROUPS` (lanterns, neon-west, neon-east, red-tubes, bars, neon-plein, tower, boss-house
  (off)), bakes x 3,968–4,480 (the strips' `dark` range), water bands 0–1,664 and 2,432–3,584. oat-e:
  darkness 0.4, smooth, streaks on the wet road, groups quay / signal / tunnel / ring; the tunnel lamps
  128 px apart (≤ 2 bands per second at 3 px/tick: no strobe). The proof strip's lights are STREET-A's
  `D_LIGHTS` (same u, depth, h, kind). NIGHT / TAXIRIT call `setNightLights` with the final lists.

### Water (spec §8.8) — `missions/oat/light/water.ts`

- `waterRipple(u, v, scale = 1, busy = 0)`: THE ripple (−1 … 1), world-anchored, pure; far rows pass
  a smaller `scale` (the same pattern smaller: one ripple language near and far).
- Tiles (`ensureWaterTiles()`; ids `OAT_WATER_TILE`): `oat-water-calm` (morning mirror, 03:00),
  `oat-water-busy` (afternoon wakes), `oat-water-night`, the drifting layers `oat-water-glint-day` /
  `-night`. Ready cut surfaces: `OAT_WATER.calm | busy | night`. Day = `PAL_HD_OAT.canal` only (olive-
  brown, never teal), night = `nightWater` + `nightSky`.
- Reflection strips: `ensureWaterStrip(id, { u0, len, v0, v1, night?, busy?, wall?, hulls?, mirror?,
  mirrorScale?, lights? })` → a floor tile id for the cut's `surface` (no repeat along `len`): the
  body darker at the wall (`wall` v) and under `hulls` / bridges, more sky toward the far edge;
  `mirror(u, h)` (the grammar's colour at h px over the water, 0 = sky) shows through the ripple
  troughs; `lights` (u, h, ramp) bake as broken columns of their ramp at night. `waterStripBytes(def,
  4)`: the d proof strip (1,280 × 34 v) is about 2.9 MB at 4×.

```ts
const id = ensureWaterStrip('oat-water-strip-d0', { u0: 0, len: 1280, v0: vAt(D_COPING_NEAR), v1: vAt(-56), night: true,
  lights: D_LIGHTS.map((l) => ({ u: l.u, h: l.h, ramp: l.kind === 'lamp' ? 'lantern' : l.kind === 'pink' ? 'neonPink' : l.kind === 'cyan' ? 'neonCyan' : 'redLight' })) });
features.push({ kind: 'cut', u0: 0, u1: 1280, level: WATER_LEVEL, surface: { tile: id, over: { tile: OAT_WATER_TILE.glintNight, du: -0.03, alpha: 0.3 } } });
```
