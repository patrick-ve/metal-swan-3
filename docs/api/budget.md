# The euro budget — API (`src/game/budget/`)

The game-wide budget of the route (spec `docs/design/oat.md` §7; decisions 18–28, 45–48). BUDGET
built it in oat wave A (2026-11-02). The score of the route missions is a **budget in euros**:
every player starts with € 100,00; enemies, items and bonuses pay euros; fines, the
toeristenbelasting, the shop and the city cost euros. The old points keep counting next to it
(the point missions, the sims' `score`).

| Economy | Missions | What the player sees |
|---|---|---|
| `'euro'` | `ams`, `oat`, `oldenzaal` (`MissionDef.economy: 'euro'`), the rally (its prize lines), the fps floors (`FpsScene` sets it) | the bank-app HUD line, euro pop-ups, euro tallies, the `budgets` table |
| `'points'` (default) | the dormant `ring`, `m0`–`m5` by URL | everything as before (7-digit score, point pop-ups, the `highscores` table) |

Rules: integer cents only (`Cents`, signed); no float reaches a ledger; no allocation per tick
(fixed records, one WeakMap entry per world); pop-ups are HUD records, never entities; no
`world.rng` call. Every hook keeps the point missions byte-identical.

## 1. Files

| File | What |
|---|---|
| `types.ts` | the contract (CORE): `Cents`, `START_CENTS` 10.000, `DISPLAY_MAX_CENTS`, `EXTEND_CENTS`, `BUDGET_CATEGORY` (30 ids → kassabon labels), `BudgetLedger`, `PayEvent`, `EuroTextOpts` |
| `ledger.ts` | `Ledger`: the slot's balance, gross income, extends, per-mission category tallies, the courtage skim (milli-cents), `rewindIncome` (fps restart) |
| `format.ts` | `euroText(cents, { plus?, compact?, clamp? })`: `€ 1.234,56`, `-€ 12,34`, `+€0,15`, `-€95` |
| `euro-table.ts` | spec §7.2: `pointsToCents` (legacy ÷ 50, € 0,50 steps, ≤ € 25), `EURO_BY_ID` rows, `killCents` (knife ×2), `bonusCents` (÷ 500), `withDifficulty`, `fpsCents`, `RECORD_CENTS`, `MINI_BOSS_CENTS`, `BOSS_CENTS` |
| `tax.ts` | spec §7.3 / §6.2 / §3: `fineFor(section)`, `touristTax(cents, n)`, `inflated(base, buys)`, `refused(budget, price)`, `pickpocketCents`, `splitFare` |
| `pay.ts` | the pay path: `pay`, `bookSlot`, the legacy claims (`noteAward`, `flushAwards`, `wireBudget`), `chargeFine`, `chargeTouristTax`, the courtage (`startCourtage` / `endCourtage` / `courtagePile`) |
| `display.ts` | `budgetLine(slot, tick)`: the HUD's rolling amount (20 ticks) and merged pop |
| `slow.ts` | `slowWorld(world, ticks)` / `slowWorldLeft(world)`: the MATCHA-MOMENT (the runner's `slowWorld`) |
| `scores.ts` | `BudgetTable` (the `budgets` key), `DEFAULT_BUDGETS`, `BUDGET_KEY` |

## 2. Paying

```ts
import { pay, euroText } from '../../budget/index';
pay(world, owner, 15, x, y, 'deposit');             // a can: +€ 0,15 (pop-up merges within 30 ticks)
pay(world, slot, -445, x, y, 'flatWhite');          // a flat white: -€ 4,45
pay(world, slot, -9500, p.x, p.y - 40, 'boete');    // a cost: the pop-up rises in red
slot.cents;                                         // the balance (PlayerSlot getter; may be < 0)
slot.ledger.tally('deposit').count;                 // this mission's cans (a reused record)
```

- `pay(world, slot, cents, x?, y?, category, count = 1)` acts only in a euro play (else nothing).
  It books the slot's ledger, gives the extends, emits `pay` (`PayEvent`, a reused record), and
  raises the world pop-up (`+€0,15`; one player's pop-ups of the same sign within 30 ticks and
  64 px grow: `+€0,45`). `x`/`y` undefined: no world pop-up (the HUD line still rolls).
- **The legacy sources need no change.** In a euro play `awardScore` still counts the points and
  notes them as a pending award; the event that follows in the same call claims it with the
  payer's euro row: `enemyKilled` (the kill: its row or ÷ 50; a knife kill of a soft enemy ×2 →
  `CONTANT`; ≥ € 150 → `BAAS`), the world's `killed` (bosses, breakables, `VERKOCHT` signs,
  crates), `pickup` (`BUIT`; the golden record € 50 → `GOUDEN PLAAT`), a callout that names its
  points (`CAUGHT NAPPING +100` → `CAUGHT NAPPING +€1`). The runner flushes what nobody claimed
  at the end of the tick by the legacy rule (`OVERIG`). New content of a euro mission calls `pay`
  directly.
- `bookSlot(slot, cents, category, count?)`: the ledger plus the extends' lives, without a world
  (the tallies, the fps floors).

## 3. Costs

```ts
chargeFine(world, slot, x, y);                       // the BOETE death (wireBudget does it)
chargeTouristTax(session, slot, world?);             // a continue (the runner and the fps scene do it)
startCourtage(world); endCourtage(world, true, x, y); // De Makelaar (wave B): 1,5 % skim, returned at his fall
```

- A player killed by a `boete-ticket` pays − € 95,00 `BOETE` (in `oat-d` − € 100,00 `BLOWVERBOD`),
  in every euro mission (user Q3).
- The toeristenbelasting per continue: 12,5 / 15 / 17,5 / 20 % of a positive budget (at least
  € 5,00), a flat € 12,50 at ≤ € 0 (`MissionRunner.continuePlayer`; the fps continue after the
  floor's restart).
- Rood staan (§7.4): the balance may go below € 0: the HUD amount turns red, `refused()` makes the
  Haverbar say GEWEIGERD, `pickpocketCents()` finds nothing. Nothing else changes.

## 4. Extends

`ONE MORE TRY!` at a **gross** income of the whole run (costs never reduce it): **€ 5.000 and
€ 15.000** (`EXTEND_CENTS`). The spec's start values were € 1.000 / € 3.000, but they fired in the
identity sims (one `ams` god run earns € 2.158 gross: the kills pay points ÷ 50, not ÷ 500), and in
`ams-normal-1` the extra life changed the play (DIFF). Measured end budgets of the sims
(cents, without the tallies; gross ≈ budget − 10.000 + costs): ams god 215.900 / 225.800, ams 2P
100.200 / 132.700, ams normal 121.692, oz full 117.300 (2P 72.600 / 55.200), oz normal 49.800,
fps-1 24.200, fps-2 43.100, rally −121.600 (2nd place, 14 fines × € 120). The old points extends (500,000 / 1,500,000) are off in a euro
play (`PlayerSlot.euro`).

## 5. The HUD and the screens

- **HUD** (`hud.ts` `drawBudget`, spec §7.5): after the tag `1P`, `BUDGET` (small, grey), the amount
  (green ≥ € 0, red below; rolls over 20 ticks), a blinking `+€0,15` pop beside it; P2 mirrored
  from x 380. World pop-ups of costs are red. HD follows the 1× call.
- **The newspaper** (`mission-complete.ts`, ams and oldenzaal): the same page with euro values
  (`HOSTAGES 4 X €20 … € 80,00`), the difficulty factor at the TOTAL, booked as `BONUS`. A tally
  line may carry its own `cents` (`TallyLine.cents`: the rally's prize money → `PRIJZENGELD`).
- **The kassabon** (`scenes/receipt-tally.ts` `ReceiptTallyScene`, `MissionDef.tally: 'receipt'`:
  oat): `buildReceipt(runner, slot, mul)` → rows; prints 4 lines a second; books each bonus as it
  prints; stamps `OVERSCHOT` / `TEKORT` (and `ZUINIGST` for the thriftier player in 2P).
- **The rally** (`rally/score.ts`): every line has `cents` (`PRIZE`, `placeCents`, `linesCents`):
  PLACE € 500 … € 25, TIME € 0,50 / s under par, BEST LAP € 50, OVERTAKES € 2, NEAR MISSES € 1,
  FINES − € 120 each (label `FINES n`), TEAM € 100.
- **The fps floors** (`fps/game.ts` `addScore(points, kind, id)`): kills by the legacy rule,
  treasure € 5–€ 50, the golden record € 50, the boss's fall € 250; a restart takes the floor's
  income back (`Ledger.rewindIncome`); the status bar shows `BUDGET € …` (`HudInfo.cents`); the
  floor tally shows and books euros.
- **The final tally**: LIVES LEFT € 100 each, ALL GOLDEN RECORDS € 200, ONE-TAKE WONDER € 1.000,
  × the difficulty factor; FINAL BUDGET; the stamp `JAARREKENING: OVERSCHOT` (≥ € 100,00) or
  `TEKORT`.
- **High scores**: `app.budgets` (`BudgetTable`, key `budgets`); `name-entry.ts` `finishRun(app,
  finished)` sends a euro run (`session.euroRun`) to the budgets (name entry only when the budget
  beats the 10th row) and a point run to `finishGame` as before. `HighScoresScene` `opts.table`
  (`'budgets'` default; after a point game `'points'`). Title and mode select: `HI € 2.500,00`.

## 6. The runner hooks (`mission/runner.ts`)

- `start()`: `session.setEconomy(m.economy === 'euro' ? 'euro' : 'points')` (a euro play marks the
  game `euroRun`); the score listener shows no point pop-ups in a euro play; `wireBudget(world)`
  per section world; the callout wrapper (`claimCallout`).
- `stepWorld()`: `world.update()` then `flushAwards(world)`.
- `slowWorld(ticks)` / `slowTicks` (spec §6.2, the MATCHA-MOMENT): for `ticks` every non-player
  entity and enemy shot is held on odd ticks (its `update` is a no-op for that tick); the
  pattern is fixed, so it stays deterministic. Content calls `slowWorld(world, 360)`.
- `continuePlayer`: the toeristenbelasting.

## 7. Sims (`--mission …`; spec §7.10)

`SimReport.budget` (cents per joined slot) in a euro play only (absent for m0, m2, the ring), the
fps report's `budget` ([the fps slot]), the rally report's `budget` (the slot's budget + the
prize lines × the difficulty factor). Every other field stays as before (`tmp/oat-lead/id.sh`:
SAME+BUDGET for the ten euro sims, SAME for m0, m2, ring).

## 8. Tests

`tests/game/budget/core.test.ts` (notation, ledger, extends, euro table, costs, the table),
`pay.test.ts` (the pay path in a world, pop-ups, fines, tax, extends, courtage, the HUD line, the
runner's economy, callouts, the slow world), `screens.test.ts` (the kassabon, the newspaper's euro
lines, the rally prize money, name entry and the tables, the final tally, the HUD).

## 9. The oat pieces (`src/game/content/oat/budget/`; spec §6.1, §6.2; wave B polishes the art)

```ts
world.spawn('oat-bin', x, floorY, { size: 200 });          // HP 30; 4–8 cans/bottles spill (its own rng)
world.spawn('oat-haverbar', x, floorY, { greet: false });  // the c kiosk: no morning greeting
haverbarPrice(slot, 'flatWhite');                         // 445, 490, 540 … (INFLATIE per player per mission)
buyGood(world, player, 'matcha', x, y);                   // 'bought' | 'refused' | 'have' | 'closed'
```

- `oat-bin` (`size` 100 | 200): bursts / tips; `oat-can` +€ 0,15, `oat-bottle-s` +€ 0,15,
  `oat-bottle-l` +€ 0,25 (`pay(…, 'deposit')`, no points); blink at 120, gone at 720 ticks; at most
  24 alive (the oldest goes). The spill rng is `binRng(world, x, y, salt)` (it reads the world
  seed; never calls `world.rng`).
- `oat-haverbar`: stand 20 ticks on a good (`PINNEN...`): FLAT WHITE € 4,45 (`oat-flat-white`: speed
  ×1.2, fire rate ×1.3, 20 s), MATCHA € 5,20 (`slowWorld(world, 360)`, `MATCHA-MOMENT`), ZUURDESEM
  € 9,00 (`oat-zuurdesem`: one hit absorbed, `KRUIM!`, never stacked). GEWEIGERD when `refused()`.
  Closed (`GESLOTEN`) in a point play.
- Sprites: `decor/oat/piece/bin-100`, `bin-200`, `haverbar`, `haverbar-barista`; `item/oat/can`,
  `bottle-s`, `bottle-l`, `flat-white`, `matcha`, `zuurdesem`.
