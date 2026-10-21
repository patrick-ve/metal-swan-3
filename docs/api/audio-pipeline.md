# Audio pipeline — ElevenLabs samples for the start screens, mission ams, the fps mode and mission oldenzaal

Source files: `tools/elevenlabs.ts`, `tools/audio/{spec-types,spec,lib,client,gen,loudness,process,review,ship}.ts`.
Tests: `tests/tools/audio-pipeline.test.ts`, `tests/content/samples.test.ts`. Runtime side: `src/engine/samples.ts` and
`src/game/content/samples/` (see `docs/api/media.md`).

This is the dated exception of 2026-10-14 to the "no audio files" rule (docs/ARCHITECTURE.md,
docs/ORIGINALITY.md): only the start screens, mission ams and the first-person mode (group
`'mode:fps'`, see below) ship sampled audio. The code synth
stays the fallback for every id. The tools generate nothing for the mayor ROBO-HALSEMA: they
refuse a VoiceSpec or LineSpec for her. Her clips are placed by hand (see "The mayor's clips").

## Flow

```
tools/audio/spec.ts            what to generate (SFX, MUSIC, VOICES, LINES; types in spec-types.ts)
  │ npm run audio:gen -- …     ElevenLabs API  → tmp/audio/raw/<kind>/<id>/take-<n>.mp3 (+ .json)
  │ npm run audio:process      ffmpeg + TS DSP → tmp/audio/cand/<kind>/<id>/take-<n>.mp3 (+ .json)
  │ npm run audio:review       listening page  → tmp/audio/picks.json, tmp/audio/review-notes.json
  │ npm run audio:ship         copies picks    → public/audio/<boot|ams|fps>/<sfx|music|voice>/<name>-<n>.mp3
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
- `--group` takes sample groups (`mission:oldenzaal`, comma list): only their sfx, songs and lines, plus
  the voice designs of those lines' speakers. It combines with `--kind` and `--only`.
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

- Copies each picked candidate to `public/audio/<boot|ams|fps>/<sfx|music|voice>/<name>-<n>.mp3`
  (`n` = 1… in take order) and removes MP3s there that are no longer picked.
- It removes only files it names itself (`<slug>-<n>.mp3`). Any other MP3 in those folders (a
  file placed by hand, e.g. `public/audio/ams/voice/Tot ziens.mp3`) is kept, and the tool prints a
  warning for it.
- Rewrites `src/game/content/samples/manifest.ts` (sorted keys, no timestamps): sfx `files` (plus
  loop points for loops), music `file`, `loopStart` (null for a one-shot), `loopEnd`, `duration`,
  voice `files` and `duration`, by group `'boot'`, `'mission:ams'` and (when it has picks)
  `'mode:fps'`. Every group in the manifest must be in `SAMPLE_GROUPS` (`src/engine/samples.ts`);
  `tests/content/samples.test.ts` checks it.
- Refuses to ship when picks exceed `keep`, a candidate is missing, or looped takes of one id have
  different loop points.
- Warns about (and skips) picks that match no spec item, e.g. a line whose game text changed
  (its voice key changed with it): generate and pick the new line.

## The user's music tracks (by hand, not by the tool)

- On 2026-10-16 the user supplied four tracks. They replace the generated takes of the same song
  ids and live in `public/audio/user/music/` (the ship step never touches that folder):

  | Id | Source file | Plays on |
  |---|---|---|
  | `title` | `menu_screen.mp3` | title screen, how-to-play and mode select (the theme keeps playing) |
  | `select` | `character_select.mp3` | REPORT FOR DUTY |
  | `ams` | `mission_1_ams_soundtrack.mp3` | mission ams, sections a–d up to the boss |
  | `ams-boss` | `boss_music.mp3` | the ROBO-HALSEMA fight |
- Processing (ffmpeg): leading 0.3 s and trailing silence trimmed; two-pass `loudnorm` to
  −16 LUFS integrated (true peak ≤ −1 dBTP, linear); stereo MP3 160 kbps, 44.1 kHz.
- Each track loops as a whole (`loopStart` 0, `loopEnd` = duration − 0.05 s): it plays to its own
  fade-out and starts again.
- `ams` and `ams-boss` play with `vol: 2` (+6 dB) because they were too soft under the gunfire
  (user feedback 2026-10-16); `title` and `select` play at 1.
- Registered as `HAND_MUSIC` in `src/game/content/samples/index.ts`, merged over the manifest's
  music. The `title` / `select` spec entries in `tools/audio/spec.ts` stay for reference; do not
  ship new takes of these four ids unless the user asks.
- To replace a track: process the new file the same way, overwrite the MP3, and update its
  duration in `HAND_MUSIC`.

## The mayor's clips (by hand, not by the tool)

- Her clips are −15 LUFS momentary max (normalised 2026-10-16) and play with `vol` 2.5
  (`MAYOR_VOICE_VOL` in `bosses/ams/voice.ts`, +8 dB): she was too soft under the mission music.

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

## The first-person mode (group `'mode:fps'`, 2026-10-16)

The mode after the ams boss (docs/design/fps.md §9) has its own sample group. Group audio-gen
wrote the spec entries and generated the takes; group audio-ship ships them.

- **Spec entries** (`tools/audio/spec.ts`, `group: 'mode:fps'`):
  - 44 sfx `fps/*`, exactly the ids of fps.md §9.1. They carry `isNew`, because their synth
    recipes are registered by the lazy fps content (`content/fps/sfx.ts`), not at boot.
  - 4 songs: `fps-floor` (100 BPM, 32-bar loop), `fps-boss` (140 BPM, 2-bar intro + 32-bar loop),
    `fps-tally` (one-shot jingle), `fps-bridge` (a 4 s sting as the intro bar + a 16 s drone loop).
  - Voices (Voice Design, original cartoon voices, never a clone or a real person): `guard`,
    `officer`, `ss`, `mechahitler` (all German), plus `mecha` (Dutch, `robot: true`). The saved
    voice ids are in `tools/audio/voices.json`.
  - Lines: 8 German shouts (fps.md §9.3) and the boss's taunts 4–6 (§7.4) with `lang: 'de'`;
    `text` is the German string that `src/game/content/fps/lines.ts` passes to `audio.say` (the
    subtitles of taunts 4–6 are English, but the clip is found by the German text). The 3 suit
    lines (`mecha`, Dutch) get the robot filter; the boss on foot speaks without a filter.
- **Language:** `LineSpec.lang` is `'en' | 'nl' | 'de'`.
- **Content:** `process.ts` (synth levels) and `review.ts` (synth versions) load every content
  module, the lazy fps ones too (`loadContent(() => true)`).
- **Ship:** `'mode:fps'` goes to `public/audio/fps/<sfx|music|voice>/`. The manifest gets a
  `'mode:fps'` group only when something of it is picked. audio-ship adds `'mode:fps'` to
  `SAMPLE_GROUPS` (`src/engine/samples.ts`) in the same change.
- **Selecting the group:** the CLI has no `--group` flag. The `--only` lists of this round are in
  `tmp/fps-audio-gen/only-{sfx,music,line}.txt`, e.g.
  `npm run audio:gen -- plan --only "$(cat tmp/fps-audio-gen/only-sfx.txt)"`.
- **Estimate and spend:** `tmp/audio/fps-estimate.md`; the requests are in
  `tmp/audio/raw/ledger.jsonl`.
- **Picks:** on 2026-10-16 group audio-gen picked the takes (the user was away; re-pick on the
  review page, filter "mode:fps"). Rules: reject silent, clipped (peak-limited by more than 3 LU),
  too long (`maxSeconds`), and takes with a clicking loop seam; prefer the take closest to the
  spec timing. Voice previews were picked by median pitch, pitch range, roughness and pace
  against the description (measured with ffmpeg + numpy).
- **Shipped** (group audio-ship, 2026-10-16): `public/audio/fps/` holds 44 sfx (57 files, some
  ids have 2–3 takes), the 4 songs and the 14 lines (8 shouts, taunts 1–6): 6.0 MB. The same
  ship added the drill sergeant's name callouts (`VINCENT!` … `PATRICK!`, group `'boot'`,
  `public/audio/boot/voice/`, 80 kB). The four user tracks (`HAND_MUSIC`) did not change.
- **Loading:** `loadFpsContent` (`src/game/scenes/fps-intro.ts`, spec §1.5 step 5) calls
  `app.audio.loadSamples?.('mode:fps')` with a 3 s cap, behind the bridge / fps intro progress
  bar. The boot never loads the group: the title flow fetches no `audio/fps/` file, and on the
  route `?mission=ams&boss=1&debug=1` the first `audio/fps/` request comes after F4, in
  `GlitchBridgeScene` (checked in the browser on 2026-10-16, 75 files, all 200).
- **Voices in the game:** the actors call `audio.say(text, speaker)` only when
  `audio.hasVoice?.(text)` is true (else the shout stand-in `fps/shout-<type>` plays); the boss
  taunts go through `FpsGame.speak` → `audio.say(text, speaker, { important: true })`. Both find
  the clip by `voiceKey(text)`, so taunts 1–3 play the `mecha` (Dutch, robot-filtered) clips.
  When a line's text in `content/fps/lines.ts` changes, its key changes too: generate, pick and
  ship the new line, or the actors play the shout stand-in and the boss taunt is silent (its
  subtitle still shows).
- **Verified** (group audio-verify, 2026-10-16, built `dist` in Chromium): every lines.ts string
  has `hasVoice` true; the real `boss.taunt` path plays the matching clip for taunts 1–6; the
  `mode:fps` files arrive during the bridge freeze, so `fps-bridge`, `fps/glitch` and `fps-floor`
  play as samples; boot-ready time is the same with and without the 5 drill clips. Levels
  (ffmpeg EBU R128): songs −16.4 LUFS like the ams and boot songs; lines −18.1 LUFS median (ams
  −17.8); no sample clips (peaks ≤ −0.9 dBFS); loop seams of `fps-floor`, `fps-boss`,
  `fps-bridge` are smooth. Five takes end while still sounding (the raw ElevenLabs takes do too:
  `ik-ben-mecha-hofmans`, `pyramus-…`, `alle-mann-auf-posten`, `das-steht-nicht-im-handbuch`,
  `nicht-schon-wieder`); the last sound is complete in length and the 40 ms fade stops a click,
  but a listen on the review page is worth it.

## Mission oldenzaal (group `'mission:oldenzaal'`, 2026-10-21)

Level 4, the haunted town (docs/design/oldenzaal.md §11; docs/api/oldenzaal.md §10).

- **Group:** `'mission:oldenzaal'` is in `SAMPLE_GROUPS` (`src/engine/samples.ts`); the mission def
  sets `audioGroup: 'mission:oldenzaal'`, so the intro card (or the boot of a direct
  `?mission=oldenzaal`) loads it. Until something of it is picked, `loadSamples` resolves at once
  and the synth fallbacks play everything (`content/music/oldenzaal.ts`, the `oz/…` sfx recipes).
- **Spec entries** (`tools/audio/spec.ts`, `group: 'mission:oldenzaal'`): the four songs
  (`oldenzaal`, `oldenzaal-boss`, `oldenzaal-tower`, `oldenzaal-tbc`), the `oz/…` sfx of every
  owner, the designed voices `wu`, `winkel`, `plechelmus` and their lines (`lines.ts`
  `voicedLines()`, the mission's `announce` line and `SNACK POWER!`).
- **Generate only this group:** `npm run audio:gen -- plan --group mission:oldenzaal` (the dry
  run and the credit estimate), then `gen --group mission:oldenzaal` (with `--kind` / `--only` to
  narrow it further). `--group` takes a comma list of groups; it keeps their sfx, songs and lines
  plus the voice designs of the lines' speakers (`lib.ts` `itemsOfGroups`).
- **Ship:** files go to `public/audio/oldenzaal/<sfx|music|voice>/`; the manifest lists the group
  only once something of it is picked (`LAZY_GROUPS`, like `'mode:fps'`).
- **Rules:** the same as for ams (ORIGINALITY.md, the dated `oldenzaal` exception): prompts in our
  own words, never a named song, artist, game or composer; designed voices only (never a clone or
  an imitation); Meneer Wu's voice has no accent play.

## A full round

1. `npm run audio:gen` — read the plan and the estimate.
2. `npm run audio:gen -- design`, listen on the review page (voices tab), pick one preview per
   speaker, then `npm run audio:gen -- design-save <SPEAKER>` for each.
3. `npm run audio:gen -- sfx`, `-- music`, `-- lines` (or `gen --budget …`).
4. `npm run audio:process`.
5. `npm run audio:review`: pick takes, write notes, flag items to regenerate.
6. `npm run audio:gen -- gen --regen` and `npm run audio:process` for the flagged items; review again.
7. `npm run audio:ship`, then `npm test` and play the start screens and ams.
