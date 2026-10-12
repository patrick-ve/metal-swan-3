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
