# Mission m5 — play-test record (integration wave)

Play-tester / integrator record for **m5 SWAN SONG** and the three-stage final boss (`grand-organ`,
`organ-console`, `maestro`, prop `wreck-block`), for the QA wave. Code: `src/game/content/missions/m5/**`,
`src/game/content/bosses/m5/**`; tests: `tests/content/mission-m5.test.ts` (15), `tests/content/boss-m5.test.ts` (20).

How the numbers were taken: `npm run sim` and headless probes (per-section ticks and deaths) with the bot,
1 player, seeds 1–3, NORMAL unless noted, `autoContinue` on (so "deaths" include continues). 60 ticks per
second. Contact sheets with `npm run shot` (bot) and probe renders, browser smoke on port 5330.
"Bot limit" = the bot cannot do it, a human can (`docs/api/slice.md` §6). "Dodging human" = a scripted
player in the real m5-c (no god) that reads the sheet music and changes tiers, jumps pedal waves, shoots
the right bank from the tiers and the music stand from tier 3, fights the Maestro from under him and
crouches behind the left wreck block for BRAVISSIMO! (it never shoots adds or dodges bullets): an upper
bound for deaths. "Lane model" = an exact tick model of THE SCORE (jump arc, drop-through, 30 px body)
that checks whether a player who only knows the notes on screen can always reach a safe lane.

## Summary

| run | a (sky + GRAND ORGAN) | b (Pipe Works) | c (CONSOLE + MAESTRO) |
|---|---|---|---|
| bot, god, seed 1 | 7,521 t, 2 deaths* | 1,201 t, 0 | console not won (bot limit) |
| bot, normal, seeds 1–3 | 7,493–7,572 t, 2 deaths | 1,465–1,694 t, 2–5 deaths | console not won, 25–61 deaths |
| bot, HARD seed 2 / EASY seed 3 | 8,192 t, 5 / 6,861 t, 1 | 1,800 t, 6 / 1,282 t, 0 | not won |
| bot, 2 players, god | 6,484 t, 1* | 1,119 t, 0 | not won |
| dodging human, c only, seeds 1–2 | — | — | console won after ~15,000 t (37–39 deaths), Maestro after ~4,400 t more (9–11 deaths), MISSION COMPLETE |

\* In god mode the Trumpeter's last cell still costs a life (`explosion`): vehicle rule, not a mission bug.

Full runs (`npm run sim -- --mission m5`, 72,000 t): a → b → c every time, 0 errors, 0 warnings, no missing
sounds or songs; the bot beats THE GRAND ORGAN in every run and times out on THE CONSOLE. Boss rush
(`--boss`) starts in c. Flow after the win (probe): Gameplay → MissionComplete (tally) → Ending →
FinalTally → NameEntry → HighScores, 0 errors.

## m5-a — Above the Clouds

- Waves @0–@3600, the radio lines, the dusk fade, `organ-distant`, crates and both balloon hostages play.
  The checkpoints and the Trumpeter respawn from the left edge work. The sky reads well at 1x: drones,
  copters and bombers stand out from the pink and violet clouds.
- **THE GRAND ORGAN** (@4016, lock 4016–4400): flies in to view x 200. The pipe clusters, the bellows, the
  speaker shutters, the Anthem Beam stripe telegraph and the death all work. The organ lurches, opens the
  hatch, and the ships fly in (120 t) to b. The bot wins it in ~3,500 t with 0–2 deaths.
- *Bot limit:* the bot does not shoot the tourist balloon (y 60) at @2100. It frees the critic.

## m5-b — The Pipe Works

- Zig-zag ledges, the bellows platforms, the air jets, all staged waves, the door and the exit to c work.
  The ledges are thin grey lines on the brass pipes: readable at 1x, but busy.
- *Bot limit:* the bot drops straight down. It frees the roadie (cage) and the tea lady. It misses the
  critic (x 80, y 696) and never breaks the secret panel (composer + golden record). Placement is OK.

## m5-c — The Console

- **THE CONSOLE:** the opening lines, WARNING, the sheet-music telegraph, lane blasts, Pedal Notes, the
  four stops, the bank → console order and the hand-over (tiers fall, 3 wreck blocks, 2 crates) work.
  - *Bot limit:* the bot holds view x 120 on the floor. It never climbs to tier 3 or aims at the music stand.
  - *Lane model:* phase 1 (64 t of warning) is always escapable from every lane. Phase 2 "Fugue" (43 t)
    is escapable from tiers 1–3 by changing tiers. **From the floor it is tight:** the first floor note is
    followed by a tier-1 note. The player must climb two tiers at once or hop within ~4 t of the right moment.
  - *Dodging human:* phase 2 costs most deaths: lane blasts plus bullets from the TRUMPET riflemen and
    FLUTE notes that it does not fight. A real player shoots them.
- **THE MAESTRO:** the hat-fire gag, the figure-eight, Baton Lash (preview arc), Tempo!, Speaker Volley and
  BRAVISSIMO! (floor glow, wreck-block cover) work. The cover from the left block works in the probe.
- **Finale (new in this wave, `missions/m5/finale.ts`):** 90 t after the `*squeak*`, the leftover enemies
  die and the enemy shots are erased. Gramps drops in through the roof in a Trumpeter (`m5-gramps-ship`)
  and says his line. The players auto-run right, hop the wreck blocks and jump in (1 and 2 players
  tested). After 300 t the stragglers are seated. When the Maestro has floated away, the ship flies off and
  the mission completes. If Gramps is a player, the `mute` ship comes with no visible pilot and Gusto's
  line comes on the radio (there is no Gusto sprite).

## Fixed in this wave

- GDD §10.5 auto-run + Gramps' Trumpeter at the end of the Maestro's death sequence: was missing, now built
  (tests `m5-c finale ...` ×2).
- Gusto's line used `♪`, which the font draws as `?`. It is now `GUSTO: LA-LAAA! ALL ABOARD, CYGNETS!`.

## Known issues for QA (not fixed)

- THE CONSOLE needs a human play-test without god mode. Watch the fugue from the floor (see the lane
  model). If it is too hard, start the fugue on tier-only notes, or give its first phrase 64 t notes.
- The bot cannot win THE CONSOLE (it does not climb), so `npm run sim` never completes m5.
- The boss bar shows white in `--every N` shot sheets (the HUD flash counts per draw call).
- In the finale, Gramps' bubble and the Maestro's `THIS IS NOT THE END!` bubble can overlap for ~60 t.
- THE GRAND ORGAN is short with the twin gun (~26 s); the GDD HP are kept.
