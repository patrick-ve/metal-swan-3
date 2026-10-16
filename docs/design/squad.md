# Squad, soldier select and military menus — design spec

Status: approved by the user 2026-10-16. This spec wins over the GDD (§3 heroes, §13 menus) for the items it covers. Mission `ams` and m0–m5 stay unchanged.

## 0. User decisions (2026-10-16)

- The title/start screen and the menus get a **militaristic** tone and look, in the spirit of the late-1990s arcade run-and-guns. **Mission ams does not change** (its briefing, enemies, boss, art and story stay).
- A character select screen in the style of the arcade "soldier select" screens: a riveted metal frame, one tall panel per soldier behind a shutter, large caricature portraits, greyscale until highlighted, a small in-game sprite preview after the pick, hazard stripes, nameplates, P1/P2 badges, a countdown. We rebuild that **structure** with our own art, text and emblem (docs/ORIGINALITY.md): never the reference game's title text, logo, lettering, frame art, portraits or "PLEASE WAIT" line.
- The 4 playable heroes are replaced by **5 friends of the user**, **cosmetic only** (identical stats). First names and bios are shown publicly as the user wrote them. The art is a kind caricature drawn by code from shapes and the palette, studied from the user's reference photos but never traced, sampled or pixel-copied. The photos never enter the repo.
- The old heroes (grace, mittens, pip, gramps) stay **registered but not playable**, so m1–m5 code, Gramps' NPC radio role in ams, and their tests keep working.

## 1. The squad

Ids are lower-case first names. Order = roster order = panel order (P1 cursor starts on 0, P2 on 1).

| # | id | name | callsign (I) | bio (user's words, shown on select) | look (studied from the photo) | cosmetic touches |
|---|---|---|---|---|---|---|
| 1 | `vincent` | VINCENT | THE CONSULTANT | "An overpriced consultant who looks like a famous British comedian. Always has a battle plan ready." (in-game: never name the comedian or his character) | short dark-brown hair, heavy dark stubble, dark brows, ONE RAISED EYEBROW, lopsided smirk, squinting eyes, forehead lines, slim build | brown tweed jacket over fatigues + thin dark-red tie; knife prop: a rolled-up battle plan (bonk); bored: unrolls the battle plan and nods |
| 2 | `thom` | THOM | LITTLE NAPOLEON | "Little Napoleon. 1900 headshots with his akimbo pistols." (generic "twin pistols"; no gun brand) | navy baseball cap worn BACKWARDS, very short light-blond hair, HUGE toothy grin, squinting happy eyes, fair skin, olive-green t-shirt, short and sturdy | a second pistol drawn in the off hand on pistol torso strips (draw only; firing is unchanged); knife prop: pistol-whip; bored: hand-in-jacket Napoleon pose |
| 3 | `dirk` | DIRK | THE PLUMBER | "A plumber with a mustache, wielding exceptional combat abilities." | messy spiky brown hair, THICK BROWN MUSTACHE + light stubble, round rosy face, normal-heavy build, hi-vis yellow work vest over dark fatigues | knife prop: a plunger (NOT a red cap, overalls or anything that evokes a famous game plumber); bored: wipes his mustache, checks a pipe wrench |
| 4 | `bob` | BOB | CAPTAIN CLIMATE | "A Jewish superhero who tries to save the climate by flying to Istanbul every month." | tousled brown hair swept up, BLUE eyes, pale skin, faint stubble, slim face, tall and slim, navy t-shirt | a short superhero cape (green with a small leaf emblem); knife prop: a tiny model airliner; bored: checks his boarding pass, cape flutters. No ethnic stereotype in any art. |
| 5 | `patrick` | PATRICK | THE SUPERNERD | "A supernerd with a keen appetite for AI and master of eating frikandellen." | BLACK hair, short sides, slick swept-back top, dark brows, brown eyes, light-tan skin, thin trimmed mustache/stubble, strong jaw, black polo shirt | knife prop: a frikandel; bored: eats a frikandel, glances at a glowing pocket device |

Other fields per `HeroDef`: `fullName` = name (no surnames), `title`/`role` = callsign, `quote` (I, one short line in-character, ≤ 38 chars), `endingLine` (I), `voice` = `'<NAME>!'`, a distinct `color` per friend (5 distinct PAL colours), `stats = HERO_STATS`, `knifeProp`, `knifeSfx` (re-use existing knife sfx ids or add new synth ones).

## 2. Art

### 2.1 In-game sprites (per friend, 1× and 2×)

The full `definePlayerSprites` set (95 ids, all with 2× generators) via `content/characters/<id>.art.ts` + `defineHero` in `characters/art.ts`. Likeness at sprite size comes from the few traits in bold above (raised brow, backwards cap + grin, mustache + hi-vis, cape + blue eyes, slick black hair). Add the hair styles / headgear / face extras the rig lacks (backwards cap, slick-back, spiky-messy, swept-up, raised-brow smirk, big grin, thick mustache, stubble shading) to `humanoid-head.ts` with `*_HI` twins in `humanoid-head-hi.ts`, and a cape accessory to the rig. Palette only. The default title rider becomes `vincent`.

### 2.2 Select portraits (new)

- `char/<id>/select`: a large caricature bust, **64×120 at 1×, 128×240 at 2×** (`defineSprite` + `defineHiSprite`, anchor top-left), drawn with the shape-built face technique of `content/bosses/ams/art-hi.ts` (`DCanvas`, face pieces). Bold arcade caricature: big head, exaggerated signature trait, dramatic side light, dark background fading to black at the bottom, shoulders and collar at the bottom.
- `char/<id>/select-grey`: the same portrait mapped to a steel/stone grey ramp (`PixelBuffer.recolor` at generation time).
- `char/<id>/portrait` (32×32 / 64×64) stays and is redrawn from the new face for the high-score heads and mission-complete photo.
- The menus draw portraits with `withArtDensity(2, …)` so the 2× art shows at res ≥ 2.

### 2.3 Military UI art (`content/ui/military.art.ts`, ids `ui/mil/*`)

- `ui/mil/frame`: the select-screen frame, riveted rust-brown steel plates with bolts, weld seams, scratches; 384×216 with transparent panel windows.
- `ui/mil/shutter` (frames 0..7: closed → fully raised), 68×128: corrugated steel door with the **squad emblem** (our own: a stencilled swan head inside a chevron with a small "3"), hazard stripe at the bottom.
- `ui/mil/hazard` (strip), `ui/mil/badge-off`, `ui/mil/badge-p1`, `ui/mil/badge-p2` (red/blue glowing stencil "P1"/"P2" in a dark slot), `ui/mil/plate` (nameplate, riveted, 64×14; names drawn on top in the small font, stencil-dark), `ui/mil/preview` (the sprite preview window: grey-blue glass with a bevel, 44×52).
- `ui/mil/stencil-*`: generated stencil lettering (the `plateLetters` mask technique of `content/ui/logo.art.ts`, with stencil bridges cut into each glyph) for screen titles: `REPORT FOR DUTY`, `MISSION SELECT` is not needed; titles used: `REPORT FOR DUTY`, `OPTIONS`, `HALL OF FAME`.
- `ui/logo` restyled: METAL SWAN 3 as riveted army-green/gunmetal plates with stencil gaps, scratches and a gold "3"-swan; keep the size (~196×64) and id.
- Menu backdrop (replaces `drawLake` on title, mode select, options, how-to-play, high scores, name entry): `drawBase(r, t)` in `src/game/scenes/base.ts` — a night military base: dark sky with sweeping searchlights, distant hangar and radio mast silhouettes, a parked SWAN-3 mech under camo netting, sandbag wall and barbed wire in front, drifting smoke, blinking red mast lights. Animated, cheap. `veil()` still works on top. `lake.ts` stays for the ending and anything else that uses it.

## 3. Screens

### 3.1 Boot
`TUNING INSTRUMENTS... nn%` → `LOADING AMMUNITION... nn%`; the swan icons become small bullets filling a belt. `CLICK OR PRESS ANY KEY` stays.

### 3.2 Title
Base backdrop; restyled logo; searchlights cross behind it; the SWAN-3 with `vincent` patrols along the sandbag wall instead of gliding on the lake; taglines militarised (I): "THE SWAN HAS LANDED. THE ENEMY HAS NOT.", "ONE SWAN. FIVE IDIOTS. ZERO RETREAT.", "LOCK. LOAD. HONK.", "OPERATION FRIKANDEL IS A GO." `PRESS START` blinks in stencil gold. Attract demo cycles the 5 friends.

### 3.3 Mode select
Base backdrop + veil; header `METAL SWAN 3` → stencil `SELECT OPERATION`; rows `1 SOLDIER`, `2 SOLDIERS`, `DIFFICULTY < … >`, `OPTIONS`, `HALL OF FAME`. Difficulty nicknames (I, military): `RECRUIT` / `VETERAN` / `COMMANDO` with hints "MORE LIVES. SLOWER BULLETS." / "THE REAL WAR." / "NO MERCY. NO MEDALS." (internal ids easy/normal/hard unchanged).

### 3.4 REPORT FOR DUTY (character select) — `src/game/scenes/character-select.ts` rebuilt

Layout (logical px):
- Title stencil `REPORT FOR DUTY` centred, y 4–26.
- Badge row y 30–42: one dark slot above each panel; lights `P1` (red) / `P2` (blue) above the panel the player highlights.
- 5 panels, each 64×120 window, x = 14 + i·74 (14, 88, 162, 236, 310), y 46–166, inside the riveted frame.
- Nameplates y 172–186 under each panel with the first name.
- Bottom row y 196: left `STAND BY` / `READY!` for P1, centre the countdown (big, 2 digits, red ≤ 5, `ui/timer-warn` tick each second ≤ 5), right the same for P2 (or `PRESS START` when P2 can join).
- Bio: shown **inside the highlighted panel** as a dark overlay at the panel bottom: the callsign (gold) and the bio wrapped to the panel width in the small font, typed in, scrolling slowly when longer than 3 lines. The bottom row stays clean.

Sequence:
1. Enter: all shutters closed; 20 ticks later they rise one after another (8 ticks apart, `ui/mil-shutter` sfx), revealing the grey portraits.
2. Highlight: the highlighted portrait shows in colour (`char/<id>/select`), others grey; the badge above lights; `ui/move` on change.
3. Confirm: `ui/select-confirm` + the name callout voice; the portrait flashes white 2 frames; the shutter drops (8 frames) and a preview window on the shutter shows the soldier's in-game idle (legs-idle + torso-pistol-idle) at 1× with a hazard stripe below — the third reference screenshot's state. A taken soldier cannot be picked by the other player (`ui/cancel`).
4. When all players have chosen, hold 40 ticks, then `startCampaign` (unchanged).
- Timer `SELECT_SECONDS = 20` (unchanged); at 0 force-pick as today.
- Back (bomb) before any pick → mode select, as today.

### 3.5 Options, how-to-play, high scores, name entry, pause, continue, game over
Base backdrop; titles in stencil where a title exists. Text tone (I): `TOP PERFORMERS` → `HALL OF FAME`; pause `PAUSE` stays; `CONTINUE?` stays (generic); `GAME OVER` stays. Default high-score rows become the five friends (VIN, THO, DRK, BOB, PAT with their characters) + the existing Legion rows. Keep layouts.

### 3.6 Credits
`STARRING` lists the five friends (name + callsign). Keep `CREDITS.length` in sync with the test (update the test to the new count).

## 4. Audio

- Synth fallback first: `ui/mil-shutter` (metal door rattle), `ui/mil-clank` (shutter landing). Name callouts fall back to the existing `ui/announce` jingle.
- ElevenLabs (later, needs the user's OK on credit spend — do NOT generate in the build): announcer name callouts `VINCENT!`, `THOM!`, `DIRK!`, `BOB!`, `PATRICK!` (voice design: gruff drill-sergeant announcer, designed voice only), new military title and select music (marching snare + brass, original), shutter sfx. Add the spec entries in `tools/audio/spec.ts` only; the old takes keep working until replaced.

## 5. Docs

- `docs/ORIGINALITY.md`: dated section "Exception: the squad of friends (2026-10-16)" — real first names and kind caricatures of five private persons at the user's request; drawn from shapes, never traced; the photos never in the repo; no insults beyond the user's own bios; no ethnic stereotypes; voices designed only (no imitation of the friends' real voices unless recorded with consent). Also: the select screen copies the genre convention, not the reference art or text.
- `docs/api/heroes.md`, `docs/api/characters.md`: the new roster, the retired heroes, new rig parts, select portrait ids.
- `docs/GAME_DESIGN.md` §3 and §13: short pointer to this spec + the new texts.
- `docs/design/fps.md`: the fps HUD face uses the chosen friend (ids `fps/face/<id>` for the five friends; keep `recruit`).

## 6. Tests

- Update roster tests (`PLAYABLE`, `ROSTER`, distinct colours = 5, distinct torsos/portraits = 5, texts, knife sfx, flow test: one right press from P1's start picks `thom`), CREDITS count, default high scores, ui tests; keep the old-hero tests working by testing them as registered non-playable characters (do not delete the coverage of m1–m5 behaviour).
- New: every friend has all 95 sprite ids at 1× and 2× + `select`, `select-grey`, `portrait`; palette-only; the select scene: shutters open, highlight/badge, confirm → preview, taken refused, timer force-pick, 2P join; boot/title/mode texts; no banned names in any new text (ORIGINALITY list).
- Visual: contact sheets of every friend (`npm run sprites -- char/<id>`), the select screen in each state, the title, mode select, options, high scores (`npm run shot` / a menu shot path or smoke screenshots), LOOKED at 1× and zoomed.
- Gates: typecheck, full suite, build, `npm run sim -- --mission ams --god --expect-complete` (ams untouched), smoke from the title through the select screen into ams.
