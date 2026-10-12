# Missions m3 and m4 — play-test record (integration wave)

Play-tester / integrator record for **m3 THE HIGH NOTE** (boss `windbag`) and **m4 OPENING NIGHT**
(mini-boss `big-head`, boss `grand-grand`), for the QA wave. Code: `src/game/content/missions/m3|m4/**`,
`src/game/content/bosses/m3|m4/**`; tests: `tests/content/mission-m3.test.ts`, `mission-m4.test.ts`,
`boss-m3.test.ts`, `boss-m4.test.ts`.

How the numbers were taken: `npm run sim` and small headless probes (per-section ticks and deaths) with the
bot, NORMAL, 1 player, seeds 1–3, max 72,000 ticks, `autoContinue` on (so "deaths" include continues). Ticks
are 60 per second. Contact sheets and 1x frames with `npm run shot` (bot, god), browser smoke on port 5320.
"Bot limit" = the bot cannot do it, a human can (see `docs/api/slice.md` §6). "Naive human" = a scripted
player in the real boss section without god mode that never dodges (it only walks to a firing spot and
fires): an upper bound for deaths. "Escape sweep" = for every boss attack, from every start spot in the
arena (floor every 12–24 px, balconies, crate step, hut roof), a set of simple moves (stand, crouch, run,
jumps at 6-tick steps, climbing) was tried with a mortal player; a spot with no surviving move is a "trap".

## Summary

| run | m3 lower (a→b2→c) | m3 upper (a→b1→c) | m4 lower (a→b→c1→d) | m4 upper (a→b→c2→d) |
|---|---|---|---|---|
| god, seed 1 | reaches c, boss not won | reaches c, boss not won | reaches d, boss not won | reaches d, boss not won |
| no god, seeds 1–3 | reaches c 3/3, boss not won | reaches c 3/3, boss not won | reaches d 3/3, boss not won | reaches d 3/3, boss not won |
| naive human, boss only | WINDBAG won: 5,216 t of fight, 9 deaths | (same arena) | GRAND GRAND won: 7,371 t, 18 deaths | (same arena) |

The bot cannot win either main boss (bot limits below); both are won by the naive human and by the
boss tests. The bot does win THE BIG HEAD (m4-a) in every run. 2 players (god), HARD (seed 2) and EASY
(seed 3, upper) runs reach the boss sections of both missions with 0 errors. No run had errors, warnings,
missing sounds or missing songs. Every attack of all three bosses passed the escape sweep, after one fix
(GRAND GRAND, below).

Mission flow (checked): m3 complete → tally → m4 intro → m4-a. m4 complete → tally → the ending, because
m5 is not registered yet (another group's work); `runner.nextMission()` gives `m5` once it is.

## m3 — THE HIGH NOTE

- **a Yodel Valley** (bot 1,600–2,150 t, 0–1 deaths). The Swan drop, roofs, pond, avalanche chase, goats,
  copter, glide trail, ski jump, base-camp lock and both exits play. *Bot limits:* on the Swan the bot misses
  2 of 4 hostages. The critic @1100 sits against chalet 2: a Swan rider must turn and shoot back at it.
  The tourist sack @1600 is freed only by a touch on foot (GDD 7.2): a rider must get off on the ice.
  The bot holds still in the base-camp lock and loses the Swan there. SHE TOOK THE LIFT is then empty in
  bot runs, so it is covered by `mission-m3.test.ts` only.
- **b1 North Face** (bot 3,150–3,600 t, 5–6 deaths). The cable car, wind gusts and summit fight work.
  Up to 3 copters on screen during the ride.
- **b2 Echo Caves** (bot 3,350–5,200 t, 4–11 deaths). Meltwater, the Icicle Organ and the final fight work.
  The ledges are thin grey lines on the violet cave wall. They are readable but faint.
- **c Summit Station** (bot ~950 t to the lock). **Boss THE WINDBAG:** starts, phases 1→2→3, the death sequence and
  MISSION COMPLETE work.
  - *Bot limit:* the bot holds view x 120. It breaks the chanter, then never hits a drone: the drones sit
    up and back, over view x 244+. It dies about every 850 t to homing notes (77–84 deaths per run).
  - *Naive human:* stands under the lowest live drone, then under the bag, and fires up. Result: 3 deaths
    to notes in phase 1 and 6 impacts (gondola, leak dash) in phases 2–3.
  - *Escape sweep:* no traps.
  - *Fixed:* the section spawned the boss with `{ facing: -1 }`, which the boss now ignores. It now spawns
    with `{ left: ARENA_X }`, so the airship flies in the arena's view in boss rush and while the lock
    eases in.

## m4 — OPENING NIGHT

- **a Avenue of Statues** (bot 8,600–9,000 t, 10–11 deaths, ~6,500 t of it the mini-boss). All rows play.
  **THE BIG HEAD** is won by the bot in every run. *Escape sweep:* no traps. *Fixed:* the spawn now passes
  `arenaLeft: A_ARENA.x0`.
- **b Bandwagon Boulevard** (bot 4,050–4,350 t, 3–5 deaths). The Bandwagon, floats, STRIKE bots, the
  ramming truck, the barricade and the hatch work. Both exits are taken by the bot.
- **c1 The Underground** (bot 2,700–2,900 t, 4–5 deaths) and **c2 Billboard Rooftops** (bot 3,300–3,500 t,
  4–5 deaths): no problems found. The trains and safety nets work. The bot rescues all hostages.
- **d The Opera House** (bot ~1,500 t to the lock). **Boss THE GRAND GRAND:** the curtain, phases 1→2→3, the death
  sequence and MISSION COMPLETE work.
  - *Bot limit:* the bot holds view x 120 under the keyboard and never climbs the crate step or a balcony.
    It cannot reach the lid (3 time-outs per run).
  - *Naive human* (left balcony in phases 1–2, crate step in phase 3): felt hammers (Glissando) reach the
    left balcony, and chandeliers and shards do the rest.
  - *Fixed (fairness):* in the finale the only safe spots from the Castor Charge are the balconies. They are
    two jumps away via the crate step, about 120–150 t from the far left of the floor. The first charge
    came straight after the fold with a 40-tick telegraph, which a player on the floor could not escape.
    That charge now telegraphs 60 t longer (`FIRST_CHARGE_LEAD`). At tick 20 of it the Countess says
    `CLEAR THE STAGE!`. Later charges keep the GDD's 40 t. Regression test: `boss-m4.test.ts` "finale's
    first Castor Charge has a lead-in".
  - The spawn now passes `arenaLeft: D_ARENA.x0`.

## Known issues for QA (not fixed)

- Both main bosses need a human play-test without god mode (the bot cannot judge them).
- m4-d: later Castor Charges (40 t) still cannot be escaped from the floor left of x 1490. Phase 3 is
  meant to be fought from the crate step, from which every charge can be escaped. The Countess hint
  `THE GOOD SEATS ARE UPSTAIRS, DARLING!` shows after 30 shots that hit only the case.
- m4-d: the right balcony (1540–1612) is hidden behind the piano body in phases 1–2 (GDD layout).
  The chandeliers at view x 60 and 180 hang under the HUD score line and timer box.
- m4-d: Glissando hammers reach the left balcony, so the phase-1 firing spot is not fully safe.
- m3-a / m1-c: `sack` hostages on Swan routes need the rider to get off (touch on foot only).
- A speech bubble can carry over into the next section when the exit is taken within ~160 t (HUD).
