# Characters API — heroes, rider strips, Helium Head, rig additions

Owner: characters agent. Source: `src/game/content/characters/**` (manifest entries `characters`
and `characters/art`), the rig in `src/game/art/{humanoid,humanoid-head,humanoid-gear,
human-sprites,human-fx,poses}.ts`. Tests: `tests/content/characters.test.ts`, `tests/art/**`.
Design: GDD §3, §4.13, §6.2, §13.5; ARCHITECTURE §6.1; `docs/design/swan-mount/look.md` §6.

## 1. Character ids and defs (`characters/index.ts`)

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
- `PLAYABLE` = `['grace', 'mittens', 'pip', 'gramps']` (select order, GDD §13.5).
- Extra fields (`HeroDef extends CharacterDef`): `knifeProp` (`'umbrella' | 'needles' | 'pan' |
  'wrench' | 'knife'`) and `knifeSfx`. `getCharacter(id)` returns them; read with a structural
  cast: `(player.character as { knifeSfx?: string }).knifeSfx ?? 'weapon/knife'`. Also exported:
  `KNIFE_SFX` (id → sfx) and `knifeSfxFor(id)`. The weapons module already reads
  `character.knifeSfx` (`content/weapons/index.ts` `knifeSfx()`).
- `boredStatus` (Gramps only: `squeaky-boot`, §4): a status the player logic applies when the
  `bored` fidget ends.

## 2. Sprites (`characters/art.ts`), `char/<id>/…` for all five characters

- The ARCHITECTURE §6.1 contract: `legs-*` (point `hip`), `torso-{pistol,heavy}-*` (aim / shoot:
  `muzzle`; throw / knife: `hand`; diag-up strips for pistol and heavy; diag-down for heavy only), `die` (6–7 f), `die-burn`,
  `die-blast`, `victory`, `spawn`, `bored`, `mount`, `salute` (2 f), `portrait` (32×32, top-left
  anchor).
- The knife strips `torso-<w>-knife` hold the hero's prop (5 frames); `recruit` holds the knife.
- **Rider strips** (open-seat mounts, look.md §6.4): `ride-sit` 2 f (20 ticks), `ride-lean` 2 f (6),
  `ride-up` 1 f, `ride-hunch` 1 f, `ride-hold` 2 f (4), `ride-brace` 1 f, `ride-duck` 1 f,
  `ride-ears` 2 f (6), `ride-cheer` 2 f (8), all looping; hip anchor, points `head` + `hand`, no
  `muzzle`. Near hand on the grip at hip + (9, −5) (duck: folded (12, −3)); `ears` and `cheer`
  raise it. Head tops above the hip: sit 20 (Gramps) / 22 (Grace, Pip) / 24 (Mittens).
- **Helium Head** variants (status art infix `helium`): `helium-torso-<w>-<anim>` (every torso
  strip), `helium-bored`, `helium-victory` — the head and headgear at 2× with a pink rim. The
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
- Small prop pieces for strips (`characters/pieces.ts`): pocket watch, yarn ball, knitting, knitted
  swan, bobble hat, helmet, gum bubbles, screwdriver, dentures, rag, sparkle, dust puff, helium
  puff; placing helpers `at`, `onGround`, `decorateFrames`, `mirrored`.
