# Audio pipeline — ElevenLabs samples for the start screens and mission ams

Source files: `tools/elevenlabs.ts`, `tools/audio/{spec-types,spec,lib,client,gen,loudness,process,review,ship}.ts`.
Tests: `tests/tools/audio-pipeline.test.ts`. Runtime side: `src/engine/samples.ts` and
`src/game/content/samples/` (see `docs/api/media.md`).

This is the dated exception of 2026-10-14 to the "no audio files" rule (docs/ARCHITECTURE.md,
docs/ORIGINALITY.md): only the start screens and mission ams ship sampled audio. The code synth
stays the fallback for every id. The tools generate nothing for the mayor ROBO-HALSEMA: they
refuse a VoiceSpec or LineSpec for her. Her clips are placed by hand (see "The mayor's clips").

## Flow

```
tools/audio/spec.ts            what to generate (SFX, MUSIC, VOICES, LINES; types in spec-types.ts)
  │ npm run audio:gen -- …     ElevenLabs API  → tmp/audio/raw/<kind>/<id>/take-<n>.mp3 (+ .json)
  │ npm run audio:process      ffmpeg + TS DSP → tmp/audio/cand/<kind>/<id>/take-<n>.mp3 (+ .json)
  │ npm run audio:review       listening page  → tmp/audio/picks.json, tmp/audio/review-notes.json
  │ npm run audio:ship         copies picks    → public/audio/<boot|ams>/<sfx|music|voice>/<name>-<n>.mp3
  ▼                                            + src/game/content/samples/manifest.ts (AUTO-GENERATED)
```

`<id>` is the sfx or song id as a slug (`ams/bell` → `ams-bell`), the `voiceKey(text)` of a line,
or the speaker of a voice design. Everything under `tmp/` is git-ignored.

## The API key

The key lives only in `.env.local` as `ELEVENLABS_API_KEY`. The tool reads it with a small
manual parser, sends it as the `xi-api-key` header, and never prints it, logs it or writes it to
any file (error bodies are scrubbed). Never put it in `src/` or in a `VITE_` variable.

## Commands — `npm run audio:gen -- <command>`

| Command | What it does |
|---|---|
| `plan` (default) `[--kind sfx\|music\|voice\|line] [--only id,…]` | Dry run: every request and a credit estimate. Sends nothing. |
| `credits` | `GET /v1/user/subscription`: credits used and the limit (needs the `user_read` permission). |
| `gen [--kind …] [--only …] [--takes n] [--force] [--regen] [--budget n]` | Generates sfx, music and lines (no `--kind`), or the kinds named. |
| `sfx`, `music`, `lines` | `gen` for one kind. |
| `design [--only SPEAKER,…] [--designs n]` | Voice Design (`eleven_ttv_v3`): three previews per call → `tmp/audio/raw/voice/<speaker>/preview-<n>.mp3` (+ `generated_voice_id`). |
| `design-save <SPEAKER> [<n>]` | Keeps preview `n` (default: the one picked on the review page) as an account voice and records its `voice_id` in `tools/audio/voices.json`. |

- `--only` takes ids (`ui/confirm`), slugs (`ui-confirm`), line keys or pick keys (`sfx:ui/confirm`).
- Idempotent: a take that already exists in `tmp/audio/raw` is skipped. `--takes n` changes the
  takes per item; `--force` makes them again; `--regen` adds fresh takes (after the existing
  numbers) to the items flagged "regenerate" on the review page, then clears the flags.
- `--budget` (default 30000) stops a run whose estimate is higher. Narrow the run, or raise it.
- Two requests at a time. 429 and 5xx answers retry with backoff (2 s, 4 s, 8 s, …).
- The credits are read before and after each batch. Every batch and request goes to
  `tmp/audio/raw/ledger.jsonl`.
- Lines need a saved voice for their speaker: run `design`, pick a preview, then `design-save`.
  The plan lists lines that wait for a voice, with their credits.
- Endpoints and models: sfx `POST /v1/sound-generation` (`eleven_text_to_sound_v2`,
  `duration_seconds`, `prompt_influence`, `loop`); music `POST /v1/music` (`music_v2_5`, or the API
  default when the plan refuses it; `music_length_ms`, `force_instrumental`); lines
  `POST /v1/text-to-speech/{voice_id}` (`eleven_v3`, `language_code` en/nl, the `say` text with
  audio tags). Output `mp3_44100_128`. Research notes: `tmp/audio/overview/musdlg.md`.
- Credit estimate: sfx 40 per requested second, music 900 per minute, lines and designs 1 per
  character.

## Processing — `npm run audio:process [-- --kind … --only … --force]`

| Kind | Steps | Loudness target |
|---|---|---|
| sfx | mono; trim silence (−50 dB below the peak); 3 ms / 20 ms fades; cut to `trimTo` | the synth version of the same id (K-weighted momentary maximum, as `tests/content/sfx.test.ts` measures it); −20 LUFS for an id with no synth (loops −22) |
| sfx loop | mono; no trim; when `trimTo` is shorter, an equal-power seam crossfade; `loopStart`/`loopEnd` | as above, measured over two cycles |
| line | mono; radio band-pass for `radio` speakers; trim (−40 dB); 10 ms / 40 ms fades; warns past `maxSeconds` | −15 LUFS momentary maximum |
| music | stereo; leading silence trimmed; loops cut to `introBars` + whole bars (a 4-bar phrase), seam crossfaded (≤ 0.2 s); one-shots get a 50 ms fade-out | −16 LUFS integrated |

Peaks stay at or below 0.9 (sfx, lines) and 0.95 (music); a take held back by its peak gets a
warning. The synth levels are cached in `tmp/audio/cand/synth-levels.json`. A candidate is made
again only when its raw take is newer, or with `--force` (use it after a spec change such as
`trimTo`). Output is MP3 128 kbps; loop points are in seconds and never on the raw file end
(MP3 padding).

## Review — `npm run audio:review` → http://localhost:4300

- One card per spec item: the prompt or line text, the details, the candidates (play, duration,
  loudness, target, peak, warnings), and "not generated" when there are none.
- **synth version** plays the current synth sound (rendered on demand). For songs it plays
  `tmp/audio/music/<id>.wav` when it exists (`npm run audio -- --songs --wav --seconds 60`).
- **loop test** starts 3 s before the loop end and keeps looping, so you hear the seam.
- Tick the takes to keep (at most `keep`; one for music and lines; one preview per voice). The
  picks save at once to `tmp/audio/picks.json` (`{ "sfx:ui/confirm": [2] }`). Notes and the
  **regenerate** flag save to `tmp/audio/review-notes.json`.
- Filters: kind tabs, group, "unpicked only", text. `--port n` changes the port. It listens on
  127.0.0.1 only, and it saves state only from its own page (the Host must be 127.0.0.1 or
  localhost, and a browser Origin must be that same host; other pages get 403). Stop it with
  Ctrl+C.

## Ship — `npm run audio:ship [-- --dry-run]`

- Copies each picked candidate to `public/audio/<boot|ams>/<sfx|music|voice>/<name>-<n>.mp3`
  (`n` = 1… in take order) and removes MP3s there that are no longer picked.
- Rewrites `src/game/content/samples/manifest.ts` (sorted keys, no timestamps): sfx `files` (plus
  loop points for loops), music `file`, `loopStart` (null for a one-shot), `loopEnd`, `duration`,
  voice `files` and `duration`, by group `'boot'` and `'mission:ams'`.
- Refuses to ship when picks exceed `keep`, a candidate is missing, or looped takes of one id have
  different loop points.
- Warns about (and skips) picks that match no spec item, e.g. a line whose game text changed
  (its voice key changed with it): generate and pick the new line.

## The mayor's clips (by hand, not by the tool)

- `src/game/content/bosses/ams/voice.ts` lists her 10 bubble lines (`MAYOR_LINES`). Each line has
  its own file, named after its bubble text: `public/audio/mayor/<voiceKey>.mp3`.

  | Line | File |
  |---|---|
  | DE BUREN HEBBEN GEKLAAGD. | `mayor/de-buren-hebben-geklaagd.mp3` |
  | FABEL FRIET IS VANAF NU GESLOTEN! | `mayor/fabel-friet-is-vanaf-nu-gesloten.mp3` |
  | FABEL FRIET WILLEN WE NIET! | `mayor/fabel-friet-willen-we-niet.mp3` |
  | REGELS ZIJN REGELS! | `mayor/regels-zijn-regels.mp3` |
  | IK WORD HELEMAAL GEK VAN DIE HOTDOGKRAAM... | `mayor/ik-word-helemaal-gek-van-die-hotdogkraam.mp3` |
  | ...OP MIJN MUSEUMPLEIN! | `mayor/op-mijn-museumplein.mp3` |
  | DIT KOST JE EEN FLINKE BOETE! | `mayor/dit-kost-je-een-flinke-boete.mp3` |
  | MIJN STEMPEL! | `mayor/mijn-stempel.mp3` |
  | MIJN HAAR, MIJN PRACHTIGE HAAR! | `mayor/mijn-haar-mijn-prachtige-haar.mp3` |
  | TOT ZIENS... | `mayor/tot-ziens.mp3` |

- Until the final recordings exist, each file is a placeholder: a wordless robot warble about as
  long as the line (tagged `comment=placeholder`). `npm run audio:mayor-placeholders` writes the
  missing ones and never overwrites a file (`--force` rewrites only tagged placeholders).
- To add a recording: replace the placeholder with the real MP3 under the same name. No code
  change is needed; playback uses the decoded file's length. Then run
  `npx vitest run tests/content/boss-ams-voice.test.ts` (every file exists, every line fits).
- If a bubble text changes, its file name changes with it (`voiceKey`): rename the recording.
- `content/samples/index.ts` adds these clips to the `'mission:ams'` group. `audio:ship` only
  manages `public/audio/boot` and `public/audio/ams`, so it never removes them.
- In the fight, `AmsMayor.playVoice` (`bosses/ams/mayor.ts`) speaks a line with `say(text,
  'mayor', { important: true })` when `hasVoice(text)` is true; otherwise the robot chatter
  `ams/mayor-babble` plays for as long as the line takes to read.
- Recordings must be original or made with the speaker's consent; never a cloned or imitated
  voice of the real person (docs/ORIGINALITY.md).

## A full round

1. `npm run audio:gen` — read the plan and the estimate.
2. `npm run audio:gen -- design`, listen on the review page (voices tab), pick one preview per
   speaker, then `npm run audio:gen -- design-save <SPEAKER>` for each.
3. `npm run audio:gen -- sfx`, `-- music`, `-- lines` (or `gen --budget …`).
4. `npm run audio:process`.
5. `npm run audio:review`: pick takes, write notes, flag items to regenerate.
6. `npm run audio:gen -- gen --regen` and `npm run audio:process` for the flagged items; review again.
7. `npm run audio:ship`, then `npm test` and play the start screens and ams.
