# Audio generation spec (ElevenLabs) — start screens + mission `ams`

`spec.ts` lists every generation request; the types are in `spec-types.ts`.
`tests/tools/audio-spec.test.ts` keeps it in step with the game: every sfx id is a registered
recipe or a new gap sound (`isNew`), every music id is a registered song, every line is the game
text verbatim, and no line or voice belongs to the mayor ROBO-HALSEMA (text-only, never voiced).

## Counts

| kind | requests | boot | mission:ams | takes generated | kept in game |
|---|---|---|---|---|---|
| SFX: existing recipes (98 from critic.md B1 + `ui/go`, now wired to the GO arrow) | 99 | 20 | 79 | 326 | 179 clips |
| SFX: new gap sounds (`isNew`) | 15 | 2 | 13 | 50 | 27 clips |
| SFX loops (inside the rows above) | 8 | 2 | 6 | | |
| Music tracks | 9 | 7 | 2 | 18 (2 each) | 9 |
| Voices (Voice Design, original) | 11 | | | 1-2 design calls each | 11 |
| Lines | 59 | 12 | 47 | 128 (2 each, barks 3, MMF 4) | user picks |

- Aliases are generated once under their target id (e.g. `hit/armor` → `hit/metal`, `boss/warning` → `ui/warning`).
- `MMF?!` has the same voiceKey as `MMF!` (`mmf`), so one line covers both bubbles.
- Lines by speaker: announcer 30, baker 9, gramps 7, gusto 2, vendor 2, rider 2, youth 2,
  tourist 2, staff1 1, staff2 1, handhaver 1. 19 lines are Dutch (`lang: 'nl'`).
- Not in the spec: the 7 mayor lines, the 3 optional character-select quotes, and non-verbal
  bubbles (KAW!, HONK!, "!", RIDE?, the SWAN-3 sign).

## Credit estimate (list rates)

| item | basis | credits |
|---|---|---|
| SFX, 99 recipes | 326 takes, 292 s requested × 40/s | ~11.7k |
| SFX, 15 new | 50 takes, 274 s (mostly the 8-20 s loops) × 40/s | ~11.0k |
| Music, 9 tracks | 2 takes, 643 s ≈ 10.7 min × ~900/min | ~9.6k |
| Dialogue (TTS) | 128 takes, 4,540 chars of `say` × 1/char | ~4.5k |
| Voice Design | 11 voices × 1-2 calls × ~100-284 per call | ~1.1k-6.2k |
| **Total** | | **~38k-43k** |

The probe on 2026-10-14 showed that SFX, TTS and music cost almost nothing on this plan, and
that one Voice Design call (3 previews) cost 284 credits. So the real spend is likely dominated by
Voice Design: about 3k-6k credits.
