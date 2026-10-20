# Items API (crates, pickups, hostages, drops)

Code: `src/game/content/items/` (logic `index.ts crate.ts pickups.ts drops.ts hostages.ts binds.ts`,
art `*.art.ts`), base classes `src/game/pickup.ts` (`Pickup`) and `src/game/hostage.ts`
(`Hostage`). Spec: GDD §7, §14.3, §15.3. Every roll uses `world.rng` (reproducible runs).

## Entity ids

| id | params | effect · points |
|---|---|---|
| `crate` | `contains` (aliases `contents`, `drop`): any drop value (default `auto` = table `crate`); `variant` `supply` (default, Task Force crate) · `legion` (crimson); `chute: true` (floats down under a small parachute); `hp` (30) | 3 pistol shots, any knife or explosion; 100 on break; never an enemy kill, never holds a wave; tag `cover` |
| `pickup-weapon` | `weapon`: weapon id or crate letter | the weapon · 500. Riding a vehicle with `weaponPickup()` (the Trumpeter) → that method instead (+10 dive bombs) |
| `pickup-bombs` | `count` (10) | +10 grenades (cap 99) · riding: +10 shells · 500 |
| `pickup-food` | `kind` `bread` `cheese` `teacake` `jelly` `birthday-cake` | 100 / 300 / 500 / 1,000 / 5,000 |
| `pickup-gem` | `kind` `golden-note` `gem` `medal` `golden-record`; `float: true` = no gravity, hangs at its placed y (Swan glide trails) | 100 / 1,000 / 2,000 / 10,000 |
| `pickup-1up` | — | waddles to the nearest player at 0.5 px/tick; +1 life (max 9 in reserve), else 10,000 |
| `pickup-repair` | — | riding: +1 cell; on foot or full: 1,000 |
| `loot` | `contains` / `table`: any drop value | becomes the rolled item (enemy drops: `drop: { id: 'loot', params: { contains: 'officer' } }`); `none` → nothing |
| `hostage` | `kind`, `bind`, `drop` (aliases `gives`, `item`), `facing`; Mrs. Dollop: `shedX`, `vanTo`, `van` | see below |

Placed items never vanish. Dropped items (spawn param `dropped: true`, which `spawnDrops` sets)
pop at vy −2.0, land, bob, blink in their last 120 ticks and vanish after 720.

## Drop values

A crate letter `M S R F L H T B` (always that weapon), a weapon id, `bombs`, `repair`, `1up`, a
food or gem kind, `auto` (the owner's table), a table name (`table-a` … `table-d`, `crate`,
`officer`, `truck`), `none`, any entity id, `{ id, params }`, or a list (one is picked).

```ts
import { contentsSpecs, dropItems, DROP_TABLES } from '../items';
dropItems(world, 'officer', x, y);           // a medal pops out
dropItems(world, 'truck', x, y);             // bombs 50 % · nothing 50 %
contentsSpecs('R', world);                   // [{ id: 'pickup-weapon', params: { weapon: 'rocket-launcher' } }]
```

### Vehicle-state drops (mission ams; docs/design/ams-extras.md §6)

While a player rides a vehicle with fewer cells than its max, `REPAIR_SHARE` (30 %) of the rolls
of the `crate` table, and of the ams breakables' fixed food / gem drops, give a `pickup-repair`
instead. Only in `REPAIR_DROP_MISSIONS` (`'ams'`, keyed by `GameSession.missionId`): m0–m5 keep
their rolls (their runs stay byte-identical). Without a damaged ridden vehicle the rule rolls
nothing, so the `world.rng` sequence is untouched.

```ts
import { repairWanted, rollRepair, withVehicleDrops } from '../items';
repairWanted(world);                         // a rider of this mission has a damaged vehicle (no rng)
rollRepair(world);                           // true in 30 % of the calls while repairWanted
withVehicleDrops(world, specs);              // a food / gem drop → [pickup-repair] in 30 % (else specs, no roll)
```

Fixed repair sources in ams: the flea-market crate of section d (`D_REPAIR_X`, `contains:
'repair'`), the scan car's drop and the crate after it in section c (docs/design/ams-extras.md
§3, §6). `pickup-repair` (a green enamel pump oiler with a wrench) and `pickup-1up` (the tin
cygnet) have 2× / 4× art (pickups-hi.art.ts).

## Secrets (mission ams; `src/game/content/missions/ams/secrets.ts`)

`ams-secret` is a small shootable spot on a piece of decor (docs/design/ams-extras.md §5). It is
not an enemy (team 'enemy' only so shots reach it; tags `shootable` `soft` `prop` `secret`, never
`enemy`: no wave, no kill, `waitClear` ignores it). `hits` hits (1–3, default 2), any knife or any
blast reveal it: a sparkle, `ui/star`, +100, the prop's reveal frames (it stays as decor), and
what it hides comes out. A glint (`decor/ams/secret-glint`) hints at it every 210 ticks.

| param | default | |
|---|---|---|
| `look` | `spot` | `hoist` (y = the hook of a gable hoist beam; top anchor), `tree-bike`, `museum-crate`, `canal-bike`, `hatch` (y = the cabin roof), `chest` (feet anchors); `spot` = no art, a hit area centred on (x, y) |
| `hides` | `gem` | any drop value (`medal`, `golden-note`, `cheese`, `1up`, `{ id, params }`); a list gives EVERY item; `hostage` (or `{ id: 'hostage', params }`) = a tourist tied to a chair drops out |
| `hits` | 2 | clamped to 1–3 |
| `w`, `h` | 14, 12 | the `spot` area |

What comes out is placed, not dropped loot: it stays until picked up. A hidden tourist is a normal
`hostage` (freed by touch, shot, blast or knife; +500, the tally) and counts in
`MissionDef.hostages` (`HIDDEN_TOURISTS`: a 1, b 1).

```ts
import { placeSecrets, secret, secretArt, AMS_SECRETS } from './secrets';
placeSecrets(ctx, 'a');                      // the section's row of AMS_SECRETS (at the script start)
secret(ctx, 1146, ROOF_Y, { look: 'hatch', hides: 'hostage' });
art: [...decorIds, ...secretArt('a')],       // SectionDef.art: the glint and the props it draws
```

`AMS_SECRETS` (one table; exactly one hidden 1UP): a — a red bike caught on a branch under the elm
(646, 128: a medal), the roof hatch of the first houseboat (1146, 146: a tourist), a crate on a
gable's hoist-beam hook (2500, 76: three golden notes); b — a museum crate `NIET OPENEN` in the
Rijksmuseum passage (470: a tourist), the hot-dog stand's red roof flag (spot 1025, 119: the 1UP);
c — a rusty bike fished out of the canal, leaning on the quay's lamp post (534: a medal); c1 — a
crate hanging from the first white-bridge portal's balance beam (hoist 300, 82: cheese and two
golden notes); c2 — the roof hatch of the moored houseboat, right of its tourist (1178, 116: a
medal); d — a flea-market chest (446: a gem and two golden notes). The c, c1 and c2 rows are placed
by those sections' scripts (`placeSecrets(ctx, 'c1')`, `...secretArt('c1')` in `art`); the c
routes hide no tourist, so both keep the same hostage total. Sprites: `decor/ams/secret-<look>`
(3 frames: hidden, the reveal, revealed) and `decor/ams/secret-glint` (4), 1× / 2× / 4×
(secrets.art.ts).

## Hostages

`kind`: `critic` (default, table-a) · `roadie` (table-b, always a weapon) · `tea-lady` (table-c) ·
`tourist` (table-d + SAY CHEESE: non-boss enemies on screen get `react('photo', 45)`) ·
`composer` (the hidden 1UP, gives `pickup-1up`) · `dollop` (gives the `sundae-driver` at `shedX`,
default 40 px behind her; `repair` while that vehicle id is not registered).

`bind`: `chair` (default; touch, shot, blast or knife) · `cage` (shoot the rope, 10 HP; spawn y =
the cage floor in the air; `ropeTop` or `rope` set the rope; `rope: 0` = a standing cage with a
lock) · `sack` (touch; hops 0.3 px/tick in a 48 px band, `band`) · `float` (shoot both ropes, 10 HP
each) · `balloon` (shoot the rope, 10 HP; drifts left 0.5 px/tick, `drift`; parachutes down and
throws the gift to the nearest player).

A touch is a player on foot, or a mounted player whose vehicle body (its hit box) overlaps a tied
hostage (`Hostage.touchingRider`; the Swan's body counts, user decision 2026-10-12): it frees the
`chair` and the `sack`.

Flow: tied (wriggle + `MMF!` every 120 ticks) → freed (+500, +1 tally at once) → walk to the
rescuer (0.8 px/tick, ≤ 180 ticks, stops at walls and gaps; rescuer gone → nearest living player)
→ the kind's gag → give (24 ticks, the gift pops from the `hand` point) → bow (12 ticks, curtain
call) → run left at 2 px/tick and despawn off-screen (blocked at the view edge: fades out there).

Mission scripts: `isHostage(e, 'dollop')`; events `hostageFreed`, `hostageRescued`,
`hostageGift { hostage, slot, item }`.

## Sprites

`item/crate`, `-hit`, `-break`, `-chute`, `-chute-fold`, `item/crate-legion…`,
`item/hostage/<kind>/<anim>` (`tied caged sack mast dangle chute freed walk give gag bow run`, roadie
`carry`), `item/bind/…`, `item/pickup-weapon/<weapon>`, `item/pickup-bombs`,
`item/pickup-food/<kind>`, `item/pickup-gem/<kind>`, `item/pickup-1up`, `item/pickup-repair`.
