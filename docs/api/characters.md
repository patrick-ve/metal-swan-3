# Characters API — heroes, rider strips, Helium Head, rig additions

Owner: characters agent. Source: `src/game/content/characters/**` (manifest entries `characters`
and `characters/art`), the rig in `src/game/art/{humanoid,humanoid-head,humanoid-gear,
human-sprites,human-fx,poses}.ts`. Tests: `tests/content/characters.test.ts`, `tests/art/**`.
Design: GDD §3, §4.13, §6.2, §13.5; ARCHITECTURE §6.1; `docs/design/swan-mount/look.md` §6.

## 1. Character ids and defs (`characters/index.ts`)

**The playable roster is the squad of five friends** (docs/design/squad.md §1, 2026-10-16). First
names only (`fullName` = `name`); `title` = `role` = `callsign`; `description` = the user's bio,
word for word; `voice` = `'<NAME>!'`; one distinct `color` each; `stats` = `HERO_STATS`.

| id | name | role (= title = callsign) | look (bold = the trait that reads at 1×) | knife look → sfx | bored |
|---|---|---|---|---|---|
| `vincent` | `VINCENT` | `THE CONSULTANT` | `short-crop` dark-brown hair, **`raised-brow` + `smirk`**, `heavy-stubble`, slim, brown `tweed` jacket + dark-red `tie` | `plan` (rolled battle plan) → `weapon/knife-umbrella` | unrolls the plan (`planSheet` piece), nods |
| `thom` | `THOM` | `LITTLE NAPOLEON` | **`cap-back` (navy) + `grin` + `beam`**, light-blond `buzz`, `stocky` (2 px shorter legs), olive `tee`, **a second pistol** (`torso: { offhand: 'pistol' }`) | `pistol-butt` (pistol-whip) → `weapon/knife-wrench` | hand-in-jacket Napoleon pose |
| `dirk` | `DIRK` | `THE PLUMBER` | **`spiky-messy` hair + `thick-mustache`**, `stubble`, `blush`, **hi-vis gold vest and sleeves** (`hivis`), dark olive fatigues; no cap, no overalls, no letter | `plunger` → `weapon/knife-pan` | wipes the mustache, checks a wrench |
| `bob` | `BOB` | `CAPTAIN CLIMATE` | **`swept-up` quiff + `blue-eyes` + green `cape` with a leaf emblem**, `stubble`, `lanky` (1 px longer thighs), navy `tee` | `airliner` (tiny model airliner) → `weapon/knife-needles` | reads his boarding pass (`boardingPass`), the cape flutters |
| `patrick` | `PATRICK` | `THE SUPERNERD` | **`slick-back` glossy black hair + `thin-mustache`**, tan skin, black `polo` | `frikandel` → `weapon/knife` | eats a frikandel, checks a glowing device (`pocketDevice`, `deviceGlow`) |

Victories: Vincent taps the plan and gives a thumbs-up; Thom raises both pistols; Dirk the
plunger; Bob a fist forward-up (flying pose); Patrick the frikandel. Deaths: the rig default.
Portraits: `char/<id>/portrait` is registered by `definePlayerSprites` (rig default) and replaced
by `PORTRAITS[id]` in `portrait.art.ts`; the select art `char/<id>/select`, `select-grey` lives in
`select.art.ts` (docs/design/squad.md §2.2).

**Retired GDD heroes** (`RETIRED` in `characters/index.ts`): registered with all their art and
texts, **not** in `PLAYABLE` / `ROSTER`. m1–m5 code (`hasGramps` …), Gramps' radio role in ams
and their tests use them by id.

| id | name | fullName | role (= title) | knife look → sfx |
|---|---|---|---|---|
| `grace` | `GRACE` | `CAPT. GRACE STILLMERE` | `SQUAD LEADER` | umbrella → `weapon/knife-umbrella` |
| `mittens` | `MITTENS` | `SGT. TORVALD "MITTENS" MAGNUSSON` | `HEAVY WEAPONS. KNITTING.` | needles → `weapon/knife-needles` |
| `pip` | `PIP` | `PVT. PIP OKAFOR` | `ROOKIE` | pan → `weapon/knife-pan` |
| `gramps` | `GRAMPS` | `W.O. AMBROSE "GRAMPS" FENWICK` | `ENGINEER. BUILT THE SWAN.` | wrench → `weapon/knife-wrench` |
| `recruit` | `RECRUIT` | — | `PRIVATE, FIRST DAY` | standard knife, `weapon/knife` (test character, not on the select screen) |

- Every hero def also carries `callsign`, `quote`, `quoteSub` (Mittens only), `endingLine`,
  `voice` (the announcer line `"GRACE!"` …), `color` (select-screen accent) and `description`,
  exactly as GDD §3 / §13.5 / §12.3.
- Stats: identical for the four heroes (GDD §3): `{ speed: 1, jump: 1, weapon: 'pistol', bomb:
  'grenade', melee: 'knife', ammo: 1 }`; no `bombs` field, so the difficulty gives 10 (EASY 15).
- `PLAYABLE` = `['vincent', 'thom', 'dirk', 'bob', 'patrick']` (select order; `ROSTER` in
  `scenes/flow-data.ts` is the same list); `RETIRED` = `['grace', 'mittens', 'pip', 'gramps']`;
  `HERO_STATS` is exported.
- Extra fields (`HeroDef extends CharacterDef`): `knifeProp` (`'umbrella' | 'needles' | 'pan' |
  'wrench' | 'plan' | 'pistol-butt' | 'plunger' | 'airliner' | 'frikandel' | 'knife'`) and
  `knifeSfx`. `getCharacter(id)` returns them; read with a structural
  cast: `(player.character as { knifeSfx?: string }).knifeSfx ?? 'weapon/knife'`. Also exported:
  `KNIFE_SFX` (id → sfx) and `knifeSfxFor(id)`. The weapons module already reads
  `character.knifeSfx` (`content/weapons/index.ts` `knifeSfx()`).
- `boredStatus` (Gramps only: `squeaky-boot`, §4): a status the player logic applies when the
  `bored` fidget ends.

## 2. Sprites (`characters/art.ts`), `char/<id>/…` for all ten characters

- The ARCHITECTURE §6.1 contract: `legs-*` (point `hip`), `torso-{pistol,heavy}-*` (aim / shoot:
  `muzzle`; throw / knife: `hand`; diag-up strips for pistol and heavy; diag-down for heavy only), `die` (12 f), `die-burn`,
  `die-blast` (10 f), `victory` (8 f), `spawn` (6 f), `bored`, `mount`, `salute` (2 f), `portrait` (32×32, top-left
  anchor).
- **Animation wave (2026-10-19)**, registered by `definePlayerSprites` for every hero: `legs-run`
  12 f, `legs-idle` 4, `legs-jump` 4, `legs-fall` 2, `legs-land` 3, `legs-crouch-in` 3,
  `legs-crouch-out` 2, `legs-dangle` 6; `torso-<w>-idle` 4, `-throw` 6, `-knife` 6, `-knife-b` 6,
  `-run` 12, `-crouch` 4, `-crouch-shoot` 2, `-crouch-throw` 6, `-crouch-knife` 6; `flip` 14,
  `mount-hop` 5, `die-drown` 12, `die-flat` 7, `fidget-a` / `fidget-b` (defaults 10 f each, or the
  hero table), `timeout-yawn` 8, `timeout-sleep` 4. Deferred (`defer: true`): the fidgets,
  `timeout-*`, `die-drown`, `die-flat`, `mount-hop`. `PlayerArtOpts` takes `fidgetA`, `fidgetB`
  and their `durations` / `decorate` entries (`'fidget-a'`, `'fidget-b'`, `'knife-b'`).
- The knife strips `torso-<w>-knife` and `-knife-b` hold the hero's prop (6 frames, anticipation
  first); `recruit` holds the knife.
- **Rider strips** (open-seat mounts, look.md §6.4): `ride-sit` 2 f (20 ticks), `ride-lean` 2 f (6),
  `ride-up` 1 f, `ride-hunch` 1 f, `ride-hold` 2 f (4), `ride-brace` 1 f, `ride-duck` 1 f,
  `ride-ears` 2 f (6), `ride-cheer` 2 f (8), all looping; hip anchor, points `head` + `hand`, no
  `muzzle`. Near hand on the grip at hip + (9, −5) (duck: folded (12, −3)); `ears` and `cheer`
  raise it. Head tops above the hip: sit 20 (Gramps) / 22 (Grace, Pip) / 24 (Mittens).
- **Helium Head** variants (status art infix `helium`): `helium-torso-<w>-<anim>` (every torso
  strip), `helium-bored`, `helium-victory` — the head and headgear at 2× with a pink rim (the HD
  rig draws the big head natively: `renderHeadHd` at 2·d, d 8 at 4×). The
  infix `helium-wob` (same strips, head 1 px down and forward) is the wobble / bob frame. Legs and
  the other full-body strips have no variant (the player falls back to the normal strip).

## 3. Helium Head (`characters/helium.ts`, status `helium-head`)

Apply it by id (the `helium-tank` cloud does this; again later = refresh the timer):
```ts
const st = getStatus('helium-head');
if (st && isPlayer(e) && e.state === 'play') e.status.add(st);
```
GDD §4.13 numbers (`HELIUM`): 600 ticks; jump vy −4.5 (apex ≈ 78 px; `jump` = −4.5 /
`TUNING.player.jumpVelocity`); falling with jump held: gravity 0.05, max fall 1.0; speed × 0.9;
`noCrouch` (down bobs the head), `noMount` (an empty seat floats him off with a `?` bubble, at most
every 60 ticks); `sfxPitch` 1.6; `art` `helium`; HUD `icon` `ui/icon-balloon`. Start: sfx
`player/helium-on`, voice `"HELIUM HEAD!"`, bubble `HI!`. One-hit shield: the first hit (any kind
but `crush`) pops the head — sfx `player/helium-pop`, confetti, bubble `BANG!`, status removed, 60
invulnerable ticks. Last 120 ticks: wobble (`helium-wob` art) and pink hiss puffs. At 0: sfx
`player/helium-deflate` and status `helium-deflate` (30 ticks: no control, two turns, hits
absorbed except `crush`). Death or any other removal ends it without the spin.

## 4. Squeaky boot (`characters/squeak.ts`, status `squeaky-boot`)

GDD §3.4: after Gramps' `bored` fidget his boot squeaks on every step for 120 ticks. Cosmetic: no
icon, no rule change; on the ground in `play` and moving faster than 0.3 px/tick it plays
`swan/squeak` at pitch 1.8 (× the status pitch: a Helium Head squeaks higher) once per 16 ticks,
the first step at once. `Player` applies it when the fidget ends (the player moves again after
`bored` played; `player.ts` `applyBoredStatus`, tested in `characters.test.ts`):
```ts
const id = (player.character as { boredStatus?: string }).boredStatus;
const st = id ? getStatus(id) : undefined;
if (st) player.status.add(st);
```

## 5. Rig additions (additive: existing styles and poses render pixel-identically)

- `HumanStyle`: headgear `beret-slouch` (Grace: a flat officer's beret pulled down over the back
  of the head, brass badge in front; the plain `beret` reads as a helmet at 1×); hairStyle
  `tufts` (bald dome with side tufts); face `walrus`, `bushy-brows`,
  `eyeshine`; accessories `hivis` (two reflective bands), `toolbelt`, `needles` (out of a satchel).
- `Pose`: `headScale: 2` (Helium Head), `hat: false` (headgear knocked off), `hatDy` (headgear
  slipped over the eyes), `held: 'umbrella' | 'needles' | 'pan' | 'wrench'` (knife-look props,
  drawn like the knife at `heldAngle`; `PropKind`, `propArt()` in `humanoid-gear.ts`).
- `PlayerArtOpts` (`definePlayerSprites`): `bored`, `victory`, `die`, `salute`, `idle`, `knife`,
  `run`, `torso` (fields under every torso frame), `durations`, `decorate` (add `withPieces`
  props to a strip), `variants` (status art infixes → pose transforms).
- `defineRiderSprites(id, style, base?)` registers the nine rider strips for a custom rider;
  `RIDE`, `RIDE_POSES`, `RIDE_GRIPS` and the `RIDE_*` tables live in `poses.ts`.
- Squad additions (2026-10-16, docs/design/squad.md §2.1; 1× templates in `humanoid-head.ts`,
  2× and 4× in the HD head `hd/head.ts` since the UHD wave; old styles render pixel-identically):
  - `HairStyle`: `short-crop` (high front hairline), `slick-back`, `spiky-messy`, `swept-up`.
  - `Headgear`: `cap-back` (a baseball cap worn backwards: the peak over the back of the head).
  - `FaceExtra` overlays: `thick-mustache`, `thin-mustache`, `heavy-stubble` (drawn under the
    mouth). **Face traits** (`FACE_TRAITS` in `humanoid-head.ts`; drawn natively by `renderHeadHd` at 2× / 4×) replace
    one part of an expression on the calm expressions only (a shout still opens the mouth):
    `raised-brow` (brow), `smirk`, `grin` (mouth), `beam` (squinted happy eyes), `blue-eyes` (eye).
  - `TopType`: `tee`, `polo` (short sleeves over bare forearms). `Build`: `stocky` (legs 2 px
    shorter, broad), `lanky` (thighs 1 px longer, slim). `Accessory`: `tie`, `tweed`, `cape`
    (accent colour, a leaf emblem and a gold clasp; streams back with `flutter`).
  - `Pose.offhand: 'pistol'`: a second pistol in the far hand while the near hand aims a pistol
    (drawing only; `muzzle` stays the aimed gun's; ignored for the heavy gun and a low carry).
  - Props (`PropKind`, `humanoid-gear.ts`): `plan`, `pistol-butt`, `plunger`, `airliner`,
    `frikandel`. Pieces (`pieces.ts`): `planSheet`, `boardingPass`, `pocketDevice`, `deviceGlow`.
- Small prop pieces for strips (`characters/pieces.ts`): pocket watch, yarn ball, knitting, knitted
  swan, bobble hat, helmet, gum bubbles, screwdriver, dentures, rag, sparkle, dust puff, helium
  puff; placing helpers `at`, `onGround`, `decorateFrames`, `mirrored`.
