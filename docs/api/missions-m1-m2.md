# Missions m1 and m2 — play-test record (integration wave)

Play-tester / integrator record for **m1 BRASS ON THE RIVERBANK** (boss `encore`) and **m2 DUNE BUGLE**
(mini-boss `golden-goose`, boss `ba-dum-behemoth`), for the QA wave. Code: `src/game/content/missions/m1|m2/**`,
`src/game/content/bosses/m1|m2/**`; tests: `tests/content/mission-m1.test.ts`, `mission-m2.test.ts`,
`boss-m1.test.ts`, `boss-m2.test.ts`.

How the numbers were taken: `npm run sim` and a small headless probe (per-section ticks and deaths) with the
bot, NORMAL, 1 player, seeds 1–3, max 72,000 ticks, `autoContinue` on (so "deaths" include continues). Ticks
are 60 per second. Contact sheets and 1x frames with `npm run shot` (bot, god and no god, `--boss`), browser
smoke on port 5310. "Bot limit" = the bot cannot do it, a human can (see `docs/api/slice.md` §6).

## Summary

| run | m1 lower (a→b2→c) | m1 upper (a→b1→c) | m2 lower (a→b→c1→d) | m2 upper (a→b→c2→d) |
|---|---|---|---|---|
| god, seeds 1–3 | reaches c 3/3; complete 1/3 (21,647 t) | reaches c 3/3; complete 0/3 | complete 3/3 (~37,000 t) | complete 3/3 (~35,600 t) |
| no god, seeds 1–3 | reaches c 3/3, boss not won | reaches c 2/3 (seed 1 stuck in b1), boss not won | complete 3/3, 101–105 deaths | complete 3/3, 105–112 deaths |

Nearly all bot deaths happen in the two boss fights (bot limits, below). Outside them: m1 a 1–2, b1 1–2, b2 2–4;
m2 a 6–7, b 8–10, c1 0–1, c2 4–6 deaths per run. No errors, no warnings, no missing sounds or songs.
Mission flow: m1 complete → tally → m2 intro → m2-a (checked). m2 complete → tally → the ending, because m3
is not registered yet (another group's work); `runner.nextMission()` gives `m3` once it is.

## m1 — BRASS ON THE RIVERBANK

- **a Puddlewick Quay** (bot ~2,100–2,800 t, 1–2 deaths). All rows play; the anthem tutorial, the band-truck,
  the crane cage and the Quay Gate lock read well. After the lock the hatch opens and both exits work.
  *Fixed:* the drain exit. The bot used to jump the 32 px drain hole every time (lower route never taken). The
  exit rect now spans y 196–248 (GDD: 176–216) over an invisible floor box at y 242 under the hole (below the
  view, above killY 248). A player who drops in takes the exit at y 196 as before; the bot now sees a safe
  drop when it wants down and still a gap when it only crosses the hole.
- **b1 Chimney Chase** (bot ~1,900–2,200 t, 1–2 deaths). Springs, chimneys, the laundry lines and the end lock
  work. *Bot limit:* seed 1 (no god) ends with the end-lock `baton-major` alone at x 2305, lower on the roof
  slope; the bot holds x 2141 and its shots pass over his hurtbox, and he stays out of his own boomerang range,
  so nobody hits anybody (4 time-outs). A human walks closer or crouches.
- **b2 Storm Drain** (bot ~2,500–3,400 t, 2–4 deaths). *Fixed:* the `[N]` overflow-chamber `metronome-turret`
  moved from x 2200 to 2152 (over the chamber's left half). At 2200 the bot never shot it and the lock never
  ended.
- **c River Run** (river ~1,500 t on the Swan). The Swan run, the slipway leap, the glide trail, the boat hop,
  the willow and the minefield all play. **Boss THE ENCORE:** starts, phases 1→2→3, the death sequence and
  MISSION COMPLETE work (boss-m1 tests; one bot win with the Swan alive). *Bot limits:* on foot the bot never
  climbs the floating crates, so it cannot hit the calliope (horn yes, calliope no); it also does not foresee
  the Steam Scale puffs and dies about every 260 ticks (~265 `fire` deaths per run without god). The Swan bot
  never crouches, so the high foghorn wave always hits her; she is lost about 500 ticks into the fight.
  *Human check:* the Steam Scale notes land 5 ticks apart over the player's x −60…+60 after a 40-tick
  telegraph and a 50-tick flight; a ~70 px run clears them (the pontoon left of x 2736 gives 112 px). The high
  crate (2760, 136) is above both foghorn waves.

## m2 — DUNE BUGLE

- **a Rattlebone Flats** (bot ~2,400–2,800 t, 6–7 deaths). Oasis lock, Mrs. Dollop, the van and the shed work.
- **b Rocky Road** (bot ~4,700–6,200 t, 8–10 deaths). Van section, STRIKE, the derrick cage. **Mini-boss
  THE GOLDEN GOOSE** is beaten by the bot every run.
  *Fixed:* (1) the goose's last egg (repair + bombs) fell next to the CANYON exit and pulled the player
  into c1. The goose now takes spawn param `dropMaxX` and staggers left while dying until its egg lands left
  of it (m2-b passes 3340: the flat sand between the cover dunes). (2) the CANYON exit rect now starts at
  y 176 (GDD 150): feet in the dip (y 189–196) are still inside, a player on the ramp is 17+ px clear, and the
  bot can now choose either route. Before, both "routes" of the bot ended in the same section.
  *Bot limit:* in the van the bot ignores the route (drive mode); the ramp start is 8 px above the sand, so
  vans default to CANYON (a human hops onto the ramp).
- **c1 Canyon Floor** (bot ~2,150–2,400 t, 0–1 deaths) and **c2 Mesa Top** (bot ~2,100–3,700 t, 4–6 deaths):
  no problems found. The c1 ledges and the m2-b rock ramp show only as thin lines (known art issue).
- **d The Drum Quarry** (walk ~1,700 t). **Boss THE BA-DUM BEHEMOTH** starts, phases 1→2→3, dies and ends
  the mission. *Fixed (fairness):* a player who held right during the 117-tick entrance stood inside the tread
  when its contact turned on (instant death), and the respawn then dropped him behind the boss, where he died
  again. Now a body wall 12 px in front of the tread holds players back during the entrance and 40 ticks into
  the fight, and a section respawn rule drops a new life 48 px in front of the tread when he died inside or
  behind it. *Bot limits:* the bot seldom aims up at the toms (phase 1 takes ~25,000 ticks; a scripted player
  needs ~5,700) and does not dodge the Hi-Hat Crush (60–65 `impact` deaths per run).

## Known issues for QA (not fixed)

- Both boss fights need a human play-test without god mode (the bot cannot judge their difficulty).
- m1-c: a player standing on the high crate is above both foghorn waves (GDD layout); check it is not too safe.
- m1-c: the boss arena relies on the mission's body wall at x 2844 (removed at the boss's death sequence).
- m2-d: in phase 1 the bass drum only pings (boss design); tom-left is reachable only from a narrow strip.
- m2-b: the cosmetic anthem coin gag (JINGLE during the anthem) is not built. The GOLDEN GOOSE Gramps lines are in `goose.ts`.
