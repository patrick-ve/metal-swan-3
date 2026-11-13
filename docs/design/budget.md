# The budget (game-wide): the euro ledger, costs, the HUD, high scores

This file is §7 of the spec of the former mission `oat` (`docs/design/oat.md`), moved here verbatim on
2026-11-12 when `oat` was deleted (`docs/design/sewers.md` L3; the full old spec: `git show
eb3316a:docs/design/oat.md`). The numbering §7.1 … §7.10 is kept, so every older pointer
`docs/design/oat.md §7.x` reads as `docs/design/budget.md §7.x`. The budget is game-wide: ams, sewers,
oldenzaal, the rally and the fps floors use it (`src/game/budget/`, `docs/api/budget.md`). Rows and
lines below that name oat's own enemies, pieces, sections or tally (the kassabon, the statiegeld,
De Makelaar, De Huisjesmelker, `BLOWVERBOD`) are history: that content was deleted with `oat`.

## 7. The budget (game-wide)

### 7.1 The ledger
- `PlayerSlot.cents` (signed integer; start +10.000 = € 100,00) sits next to the old `score`,
  which keeps counting for the point missions and the sims (§7.10). Integer maths only:
  `floor(cents × permille / 1000)`; the 1.5 % courtage accrues in milli-cents and moves whole cents.
- `pay(world, slot, cents, x, y, kind)` (`src/game/budget/pay.ts`, beside `awardScore`, which
  refuses ≤ 0): signed; a `pay` event; HUD pop-ups (never entities); fixed category counters
  (≤ 32 per slot per mission, no per-tick allocation) for the kassabon.
- Opt-in: `MissionDef.economy?: 'euro'` (default points) for `ams`, `oat`, `oldenzaal`; the rally
  and the fps floors pay euros in their own score code.
- Extends (`ONE MORE TRY!`) at **€ 5.000 and € 5.500 of gross income** (never reduced by costs).
  The start values € 1.000 / € 3.000 fired in the identity sims (kills pay points ÷ 50: one `ams`
  god run earns € 2.066 gross); BUDGET moved them to € 5.000 / € 15.000, and FIX-A measured a strong
  run (about € 4.140 by the fps floors in wave A, about € 5.600 once oat is full) and set the
  second to € 5.500, so a strong run reaches both by the fps floors (docs/api/budget.md §4).

### 7.2 Euro values

| Payer | Euros |
|---|---|
| Enemies and items without a row below | legacy points ÷ 50, rounded to € 0,50, capped at € 25,00 |
| `handhaver` / `fatbike-youth` (pair) / `delivery-rider` / `seagull` (ams) | € 6,00 / € 6,00 (€ 10,00) / € 4,00 / € 3,00 |
| `stag-partier` / groom / `beer-bike` (ams) | € 6,00 / € 20,00 / € 25,00 |
| `oat-brammobiel` (+ coins) / `oat-bakfiets` / `oat-taxi` / `oat-dealer` / `oat-handhaver-scooter` | € 15,00 (+ 4–6 × € 0,50) / € 12,00 / € 25,00 / € 5,00 / € 8,00 |
| oldenzaal grunt / rifleman / gunner / crawler | € 3,00 / € 4,00 / € 12,00 / € 2,00 |
| Mini-bosses (ams scan car, the statue, De Makelaar) | € 150,00 |
| Bosses (ams mayor, De Huisjesmelker) | € 250,00 |
| Knife kill on a soft enemy (was ×5) | ×2 (`CONTANT`) |
| Breakables (ams; the sewers fatbergs) / `VERKOCHT` sign / `CAUGHT NAPPING` | € 1,00 each |
| Statiegeld: can / small bottle / big bottle | € 0,15 / € 0,15 / € 0,25 |
| Golden record | € 50,00 |
| Tally and final bonuses (hostages, ovation, flawless, boss speed, vehicle, no scratches, per life, all records, one-take) | legacy points ÷ 500 (boss speed ≤ € 36,00; per life € 100,00; one-take € 1.000,00) × the difficulty factor (0.5 / 1 / 1.5) |

### 7.3 Costs

| Cost | Euros | Where |
|---|---|---|
| Death by a `BOETE` ticket | **− € 95,00** `BOETE`; in d **− € 100,00** `BLOWVERBOD` | every euro mission |
| Toeristenbelasting per continue | 12.5 % → 15 → 17.5 → 20 % of a positive budget (min € 5,00); a flat € 12,50 at ≤ € 0 | every euro mission (the continue hook, `runner.ts:1032-1043`) |
| Flat white / matcha / zuurdesem | € 4,45 / € 5,20 / € 9,00, +10 % per buy | a, c |
| Kaasbrioche | € 6,50 | b |
| Lakschade | € 1,00 per shot into the box (≤ 1 per 15 ticks) | a, b, c |
| Dealer pickpocket | 10 % (min € 5,00, max € 50,00) | d |
| Courtage | 1.5 % of every pickup while the Makelaar lives (returned) | a |
| Huurverhoging | € 19,00 / € 24,00 / € 31,00 | d (boss) |
| Taxi escaped | € 12,50 | b, c, d |
| Blauwe envelop (aanslag) | € 25,00 … € 120,00 | b, c, d |
| The taxi ride | about € 87,50 (2P: half each) | e |

### 7.4 Below € 0: rood staan
- The budget may go red. The HUD turns red, the havermelk-bar refuses (`GEWEIGERD`), the dealer
  finds nothing. Nothing else changes (no bailiff: not picked).

### 7.5 The HUD (the bank-app look)
- `hud.ts:251-254`: the tag `1P` at x 4, `BUDGET` (small, grey), the amount (green above € 0, red
  below, `−€ 12,34`); P2 mirrored, right-aligned at x 380. The amount rolls to its new value over
  20 ticks with a small `+€0,15` / `−€95` pop beside it; world pop-ups merge per 30 ticks. The
  widest text (`BUDGET −€ 12.345,67`, 19 glyphs) fits the 170 px per side; the display clamps at
  ± € 99.999,99; HD follows the 1× call (`hudDensity`).
- Notation: `€ 1.234,56` (dot for thousands, comma for cents, a space after `€`, the hyphen as
  minus). `src/engine/font.ts` gets one `€` glyph in SMALL (`:56`) and BIG (`:167`); HD derives
  from them (`:603`).

### 7.6 The kassabon (oat's tally)
- A new scene `src/game/scenes/receipt-tally.ts`, chosen by an additive `MissionDef.tally?:
  'receipt'` in `gameplay.ts:715-721`; the newspaper stays byte-identical for the rest.
- The receipt rolls out of a printer slot (4 lines per second; fire skips after 30 ticks):
  `KASSABON` / `DAGJE UIT - DE BINNENSTAD`; the categories with counts (`STATIEGELD 37X`,
  `VIJANDEN 84X`, `FLAT WHITE 2X`, `LAKSCHADE 3X`, `BOETE 1X`, `ZAKKENROLLER`, `TERUGGAAF`,
  `AANSLAG`, `COURTAGE`, `HUURVERHOGING 3X`, `TOERISTENBELASTING 2X`, `TAXI (NIET GEREDEN)`, `BORG
  TERUG`, …, and last `RIT NAAR DE RING`); the bonus lines (`BONUS: SNELLE BAAS`, …); `TOTAAL`; the
  stamp **`OVERSCHOT`** (green, mission net ≥ € 0) or **`TEKORT`** (red); `SALDO € x`. `payOut`
  books the bonuses.
- 2P: two receipts side by side, each stamped; the higher net also gets `ZUINIGST`.
- The final tally (`final-tally.ts`) stamps `JAARREKENING: OVERSCHOT` / `TEKORT` against € 100,00.

### 7.7 High scores
- A new key `budgets` (`metal-swan-3:budgets`): signed rows `{ name, cents, mission, character,
  continues, difficulty }`, sorted by cents; a run qualifies only by beating the 10th row (the
  defaults are positive, so a red run does not enter). Defaults € 2.500 … € 150 (2.500, 2.000,
  1.600, 1.250, 1.000, 800, 600, 400, 250, 150) with the existing names. The old `highscores` key
  stays for point runs (dormant ring, m0–m5 by URL), with today's screens.
- `euroText` beside `scoreText` (`app.ts:519-521`) for the title and mode-select `HI`, the table,
  name entry, game over, the final tally, the fps HUD and continue screen.

### 7.8 The rally: prize money
- `rally/score.ts` lines become euros: `PLACE` € 500 / 350 / 250 / 150 / 100 / 75 / 50 / 25;
  `TIME` € 0,50 per second under par; `BEST LAP` € 50; `OVERTAKES` € 2 each; `NEAR MISSES` € 1
  each; `FINES` − € 120 each (the real red-light fine; the joke column goes); `TEAM` (2P) € 100 each.
  They reach the page through `TallyRunner.tallyLines` as today.

### 7.9 The first-person floors
- Kills pay € 2–€ 10 by enemy type, treasure € 5–€ 50, the golden record € 50; the fps tally lines
  and HUD show euros (`fps/hud.ts:218`, `fps-tally.ts`); the fps continue charges the
  toeristenbelasting.

### 7.10 Sims and baselines
- The identity sims diff the whole report. Euro missions add a `budget` field (cents per slot);
  `score` (points) is still counted and reported as before; no `world.rng` call is added on a
  shared path (cans and envelopes roll inside oat entities).
- So when the budget lands (wave A), `ams-god-lower`, `ams-god-upper`, `ams-god-2p`,
  `ams-normal-1`, `oz-full-1p`, `oz-full-2p`, `oz-normal-1`, `fps-1-god`, `fps-2-god` and `rally-1`
  gain `budget`; every other field stays SAME (ticks, kills, deaths, continues, `score`); `m0-god`,
  `m2-god` and `ring-god-1` stay fully SAME; a route field (ams's next mission) may change. The
  report names every DIFF.
- The € 5.000 / € 5.500 extends must not fire in these sims (each runs one mission: ams god earns
  € 2.066 gross, oldenzaal € 1.073); if one does, the lead stops the wave (a lives change is
  gameplay). New baselines after wave C:
  `oat-god-1p`, `oat-god-2p`, `oat-normal-1`.
