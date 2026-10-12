export const meta = {
  name: 'content-finish',
  description: 'Finish the interrupted content wave for one group (args.group): one finisher per area continues the on-disk work (inventory, finish, self-review), then a group reviewer-integrator (adversarial review, gates, docs/api for the mission wave)',
  phases: [
    { title: 'Finish', detail: 'one finisher per area continues the interrupted builder work' },
    { title: 'Integrate', detail: 'adversarial group review, fixes, gates, docs/api reference for the mission wave' },
  ],
}

const ROOT = '/Users/everdingen/Projects/private/metal-swan-3'
const GROUP = args && args.group ? String(args.group) : ''

const PRE = `You are one agent in a team of about 16 agents (4 groups working at the same time) building METAL SWAN 3 - an ORIGINAL browser arcade run-and-gun shooter (TypeScript + Vite, zero runtime dependencies) that plays like the late-1990s arcade classics of the genre. Project root: ${ROOT} - run every command from there.

STATE: the engine, the game layer, the tools and a playable test mission m0 exist and pass every gate (typecheck, about 600 tests, build, bot sim, browser smoke). This wave builds the CONTENT of the full game in parallel. A later wave builds missions m1-m5 and the bosses from your content, using the docs/api references your group writes.

READ FIRST:
- docs/ARCHITECTURE.md - the engineering contract. Section 7 lists the content folders (who owns what); section 7.1 is the reconciled id table, which WINS over the GDD where they differ; section 6.1 is the human sprite contract; section 8 the conventions (z-order, teams, tags, damage kinds and tags, fairness).
- docs/ORIGINALITY.md - IP rules, mandatory: every name, sprite, text and melody is original. Never draw look-alikes of existing game characters, vehicles, enemies, bosses, logos or HUDs; describe and design from function, not from any existing game.
- docs/GAME_DESIGN.md (the GDD) - the sections named in your task, plus 4.11 (fairness and comedy rules) and 15 (content id index). GDD numbers are the spec: use them exactly; when the GDD is silent, choose sensible values and say so in your report.
- docs/api/game.md (game layer API; section 13 has recipes for an Enemy subclass, defineWeapon, a Vehicle subclass, a Boss, a mission section, a Pickup, defineCharacter, StatusEffectDef), docs/api/sim.md, docs/api/media.md, docs/api/slice.md (tools: sprites, shot, sim, smoke, arena), docs/ART_GUIDE.md (for any art).
- Reference implementation for style and quality: src/game/content/infantry/index.ts + art.ts (rifleman), src/game/content/items, src/game/content/weapons, src/game/content/missions/m0.

TEAM RULES
- Other agents work IN PARALLEL in this directory. Edit ONLY the files you own (your task lists them; the OWNERSHIP MAP below lists everyone). Never delete, move or rewrite other agents' files. You may add new files inside your own folders.
- Frozen for everyone in this wave (put needed changes under Requests in your report): src/engine/** (except an engine file your task names), src/game/content/index.ts (the manifest; your sub-area already has entries), src/game/mission/**, src/game/boss.ts, src/game/registry.ts, src/game/session.ts, src/game/events.ts, src/game/params.ts, src/game/art/bg.ts, src/game/art/terrain-art.ts, src/game/art/paint.ts, src/game/art/art-registry.ts, src/game/content/missions/**, src/game/content/bosses/**, src/sim/**, tools/**, tests/review/**, docs/GAME_DESIGN.md, docs/design/**, docs/ARCHITECTURE.md, docs/ORIGINALITY.md, package.json.
- Shared game-layer files have exactly ONE owner (OWNERSHIP MAP). If you need a change in a file you do not own, first solve it in your own code (subclass, override, wrapper, local helper). If a change there is truly needed, describe it exactly under Requests (file, member, behaviour).
- Ids: use the exact ids of GDD 15 and ARCHITECTURE 7.1. Sound effects and songs are being written right now by the sound agents: reference sfx ids exactly as GDD 15.7 lists them and song ids as GDD 15.8 lists them. A missing sound is silent and logged by the sim as missingSfx - fine during this wave.
- Typecheck covers the whole project and files other agents are still writing may show errors: ignore those, but YOUR files must have zero errors. Filter the output, e.g. npm run typecheck 2>&1 | grep -E '<your folder>|<your test file>'.
- Tests: while iterating run only your own test files: npx vitest run <files> --maxWorkers=2. At the end run the full suite ONCE: npx vitest run --maxWorkers=3. Failures in other agents' areas are not yours (list them), but nothing you own may fail, and tests/content/modules.test.ts (every registered entity spawns and runs 300 ticks without errors) must pass for every id you register. Tests you do not own: never edit them; if one fails because of an intended change of yours, report it.
- Visual feedback is mandatory: send every tool output to YOUR folder tmp/<your label>/ (for example npm run sprites -- enemy/drummer --out tmp/<label>/ , npm run arena -- ... --out tmp/<label>/x.png , npm run shot -- ... --out tmp/<label>/y.png). Open every PNG you make with the Read tool and LOOK at it. Iterate until the art reads well at 1x inside a gameplay frame, next to the 36 px player.
- Sandbox: npm run arena (see docs/api/slice.md 'Arena sandbox') puts a player and any entities you name on flat ground, with optional water, gaps, platforms, slopes, a mounted vehicle, scripted input, and per-tick traces of x/y/state - use it to SEE and MEASURE your content. Missions m1-m5 do not exist yet.
- Browser smoke: npm run smoke -- --port <your port> (only YOUR port; it starts and stops its own server). Builds: never write to dist/ - use npx vite build --outDir tmp/<label>/dist --emptyOutDir.
- Be a good neighbour on a shared machine: kill every server and browser you start; run the full suite at most twice.
- No git commands. No new npm dependencies.
- Toolchain: Node 26, Vite 8.3, Vitest 5, TypeScript 6.0 (strict; erasableSyntaxOnly = no enums, namespaces or parameter properties; verbatimModuleSyntax = use 'import type'), tsx 4, Playwright 1.64 with Chromium.
- Quality bar: production-quality, readable TypeScript with short helpful comments (match the reference files); deterministic simulation (world.rng for gameplay, world.fxRng for cosmetics; no Math.random, Date, performance or DOM outside *.browser.ts); no per-tick allocations in hot paths; pooled projectiles; looping sounds stopped in onRemove. Enemies are fair, readable and funny (GDD 4.11: every attack telegraphs at least 18 ticks, nothing attacks from outside the view, attack tokens, gags are free time).
- Art: palette ramps only (src/engine/palette.ts), 1 px INK outline, light from the upper left, readable silhouettes at 1x (384x216 view). Legion colours: crimson, gold, white, black (GDD 9.0).

OWNERSHIP MAP (this wave; ports in brackets)
Group HEROES:
- characters [5201]: src/game/content/characters/**, src/game/art/{humanoid,humanoid-head,humanoid-gear,human-sprites,human-fx,poses}.ts (additive only), tests/art/**, tests/content/characters.test.ts
- swan-logic [5202]: src/game/content/vehicles/swan/ (all files except art.ts and *.art.ts), src/game/vehicle.ts, src/game/player/**, src/game/water.ts, src/game/tuning.ts, the Vehicle and Player paragraphs of docs/api/game.md, tests/game/vehicle.test.ts, tests/game/player.test.ts, tests/content/swan.test.ts
- swan-art [5203]: src/game/content/vehicles/swan/art.ts and vehicles/swan/*.art.ts, tests/content/swan-art.test.ts
- fleet [5204]: src/game/content/vehicles/fleet/**, tests/content/fleet.test.ts
Group ARSENAL:
- weapons [5211]: src/game/content/weapons/**, src/game/content/fx/**, src/game/weapons.ts, src/game/projectile.ts, src/game/grenade.ts, src/game/fx.ts, tests/game/weapons.test.ts, tests/content/weapons.test.ts, tests/content/fx.test.ts
- items [5212]: src/game/content/items/**, src/game/hostage.ts, src/game/pickup.ts, tests/game/hostage.test.ts, tests/content/items.test.ts
- props [5213]: src/game/content/props/**, tests/content/props.test.ts
- creatures [5214]: src/game/content/creatures/**, tests/content/creatures.test.ts
Group LEGION:
- infantry-rhythm [5221]: src/game/content/infantry/index.ts + art.ts (rifleman + shared soldier helpers), src/game/content/infantry/rhythm/**, tests/content/infantry.test.ts, tests/content/rhythm.test.ts
- infantry-winds [5222]: src/game/content/infantry/winds/**, tests/content/winds.test.ts
- machines-armor [5223]: src/game/content/machines/armor/**, tests/content/armor.test.ts
- machines-transport [5224]: src/game/content/machines/transport/**, tests/content/transport.test.ts
- (legion integrator, at the end: src/game/enemy.ts, src/game/art/machines.ts, src/game/content/machines/{index,art}.ts)
Group SOUND-UI:
- ui [5231]: src/game/content/ui/**, src/game/hud.ts, src/game/context.ts, src/game/settings.ts, src/game/app.ts, src/game/scenes/**, src/main.ts, tests/game/scenes.test.ts, tests/content/ui.test.ts
- sfx [5232]: src/game/content/sfx/**, src/engine/synth.ts (additive only), tests/content/sfx.test.ts
- music-missions [5233]: src/game/content/music/index.ts, src/game/content/music/missions.ts, src/engine/music.ts (additive only), tests/content/audio.test.ts, tests/content/music-missions.test.ts
- music-finale [5234]: src/game/content/music/finale.ts, tests/content/music-finale.test.ts
Nobody owns src/game/enemy.ts during the build (Enemy base: subclass and override; requests go to the legion integrator).`

const REPORT_RULE = `FINAL ANSWER: a concise report (max 450 words): what you built (ids), files, test status (numbers), known issues, what you did NOT finish (be honest - the next agent picks it up), and Requests for other owners (exact file + change).`

// ------------------------------------------------------------------------------------------------
// Areas. Each: key, label, port, owns, task. Reviews group one or more areas.
// ------------------------------------------------------------------------------------------------

const A = {}

A.characters = {
  port: 5201,
  owns: 'src/game/content/characters/** (add files freely), src/game/art/{humanoid,humanoid-head,humanoid-gear,human-sprites,human-fx,poses}.ts (ADDITIVE ONLY: right now other agents render riflemen, hostages and new soldiers with this rig - existing styles and poses must render pixel-identically unless you fix a real bug; re-run tests/art after every rig change), tests/art/** (extend), tests/content/characters.test.ts (new)',
  task: `ROLE: CHARACTERS - the four playable heroes, the rider strips for the Swan, Helium Head, and the shared human rig.
READ: GDD 3 (all, 3.1-3.6), 4.13 (Helium Head), 6.2 (knife), 13.5 (character select texts), 2.6 (ending lines), 12.3 (announcer lines), 15.1, 15.6 (char/... ids); ARCHITECTURE 6.1 (including the new rider strips); docs/design/swan-mount/look.md section 6 (the rider: 6.1-6.6, pose tables and arm targets in 6.4); docs/ART_GUIDE.md; docs/api/game.md (defineCharacter, CharacterDef fields incl. fullName, role, quote, quoteSub, callsign, endingLine; defineStatus and StatusEffectDef in src/game/player/status.ts; the art infix rule).
BUILD, in this order:
1. FIRST - the swan agents are waiting for these: the nine Swan rider strips char/<id>/ride-sit, ride-lean, ride-up, ride-hunch, ride-hold, ride-brace, ride-duck, ride-ears, ride-cheer (14 frames) for recruit and all four heroes, exactly per look.md 6.4 (RIDE_* pose tables in poses.ts, registered by definePlayerSprites; rig part 'upper', hip anchor, weapon 'none', points head + hand; both hands on the grips except ride-ears and ride-cheer; there is no mount-duck frame). Add frame-count and point checks to the art tests. Render a sheet AND a composite on a stand-in seat (a simple block at the hip with two handle grips) to check that every hand lands on its grip.
2. grace, mittens, pip, gramps: styles from GDD 3.1-3.4 (a slim officer with a beret and a long white scarf; a giant in a knitted sweater and a bobble hat; a small rookie in a reflective vest and helmet; a bald old engineer in a boiler suit), stats exactly as the GDD gives them, every CharacterDef text (name, fullName, title/role, callsign, quote, quoteSub, voice, endingLine, color), a portrait each (about 32x32, distinct, readable), the full ARCHITECTURE 6.1 contract plus salute (2 f) and bored. If a silhouette needs a build the rig lacks (a short or a big build), add it as an ADDITIVE rig option; keep the logic hurtbox unchanged unless the GDD says otherwise.
3. The per-character knife look (GDD 3.x 'Knife look', 6.2): a held prop per hero (umbrella, knitting needles, frying pan, wrench ...) drawn at the hand point (withPieces, ART_GUIDE, or a small additive held-prop helper in the rig), used by the torso-<w>-knife strips; when the prop art is missing, the standard knife. The knife variant sfx (weapon/knife-umbrella, -needles, -pan, -wrench): expose the mapping as data on the character (an optional CharacterDef-compatible field or an exported map in content/characters) and tell the weapons agent in your report how to read it (the weapons agent owns weapons.ts).
4. Helium Head: defineStatus('helium-head', ...) exactly per GDD 4.13 (duration, jump and gravity overrides, no mount, sfx pitch, art infix 'helium', the pop/deflate behaviour) in src/game/content/characters/helium.ts, and the helium-<anim> torso variants for every character via headScale (GDD 3.6). The helium-tank prop (props agent) applies the status by id.
5. tests/content/characters.test.ts: every character registers with the GDD stats and texts; every contract strip exists with the right frame counts and points (legs: hip; torso aim/shoot: muzzle; throw: hand; ride: head + hand, no muzzle); helium-head applies, changes the jump as the GDD says, blocks mounting, and expires.
LOOK at everything at 1x in gameplay frames next to a rifleman (npm run arena -- --spawn ... ; the player character is chosen by the arena/headless options if supported, else composite frames yourself in a small script under tmp/characters/): the four heroes must be instantly distinguishable by silhouette and colour, and their faces must not look alike.`,
}

A['swan-logic'] = {
  port: 5202,
  owns: 'src/game/content/vehicles/swan/index.ts and every NON-art file you add in src/game/content/vehicles/swan/ (art.ts and *.art.ts there belong to the swan-art agent), src/game/vehicle.ts (base class - ADDITIVE changes; the fleet agent subclasses it right now, keep cockpit vehicles and tests working), src/game/player/** (RidePose, Player.drawRide, a cheering flag, swan hooks), src/game/water.ts, src/game/tuning.ts (the one shared change: TUNING.vehicle.comboWindow 4 -> 1 per GDD 4.1 / 8.1; nobody else edits tuning.ts in this wave), the Vehicle and Player paragraphs of docs/api/game.md (keep them true for every contract you change), tests/game/vehicle.test.ts and tests/game/player.test.ts (extend), tests/content/swan.test.ts (new)',
  task: `ROLE: SWAN - LOGIC. You build the ridden SWAN-3 "Metal Swan" (vehicle id 'swan'). This is the user's headline request: a FAST robot-swan mount that the hero rides on her back, in the role of the classic big-bird mount of the genre, with VERY HIGH jumps and a beak gun that aims through an arc; swan-only extras: she swims on deep water, flaps and glides, and HONKs (a shockwave).
READ (all of it - it is the spec): GDD 8.1, 8.2, 8.6, 4.1 (controls), 4.2 (no drop-through over water), 4.12 (camera), 6.3, 15.2, 15.6, 15.7 (swan ids), 15.9 items 2, 7 and 8 (item 7 is the authoritative split between what shared code already has, what the Swan module builds with existing hooks, and the one shared change), 16.1; docs/design/swan-mount/feel.md (ALL numbers: speeds, the jump, flap and glide, swim and the float line, HONK, the beak-gun arc and rates, shells, SWAN DIVE, stomp, perch, damage cells, eject, the empty gags, co-op), look.md 6.3 (which rider pose when), 6.5, 6.6, 7 (layers), 8 (named points), 9 (sprite list), 10-11 (frame tables and timings per state), 13 (art against the logic boxes); levels.md (how m1-c and m3-a will use her - rebuild those beats as arena/test beds to validate the numbers); decisions.md. docs/api/game.md (Vehicle API, recipe 13). src/game/vehicle.ts, src/game/player/player.ts, src/game/water.ts.
BUILD:
1. Her numbers live in the Swan module (a frozen SWAN constants object; no TUNING.swan block). Her own Body settings from feel.md (gravity 0.18, maxFall 5.0, stepUp 12, snapDown 8 ...; the glide changes body.gravity and body.maxFall at runtime) and the full state machine with the exact feel.md numbers (run 2.6 px/tick, the fixed-height jump vy -5.9 with apex about 94 px in the engine, glide, skid, crouch box, waddle, ice): run, squat, jump, fall, stomp, land, flap, glide, glide-tired, fold, skid, crouch, waddle, slide, settle, swim, water-duck, paddle-up, honk / honk-air / honk-swim, rise / sit-down, the empty states and gags, SWAN DIVE (the ram) then dazed / migrate, wreck.
2. Water: the float line (a one-way floor 16 px under the surface of every water rect that only she uses: after moveBody, inside a water rect with y >= the float line and vy >= 0, snap y to it and set vy = 0), swimming, take-off from water.
3. Her weapons and projectiles inside your folder: swan-beak-gun (aims through the neck angles), swan-beak-shell (the shells), swan-honk (the shockwave: erases 'erasable' enemy shots, sends the 'ears' reaction with reactInArea, damage, shell cost, cooldown), beak-bullet, beak-shell, honk-ring. Fire from the body frame's 'neck' point plus the neck frame's 'muzzle' / 'cannon' point (look.md 8); use the look.md 13.7 fallbacks while the art is missing.
4. The rider: RidePose and Player.drawRide (invulnerability blink; fallback chain ride-<pose> -> ride-sit -> mount frame 1 drawn 17 px lower; look.md 6.5); the pose per state (look.md 6.3); seat = the rider's hip (6.6), but override the protected syncDriver() so the mounted player's x, y sit on HER FEET anchor (enemy AI reads a player's y as the feet; ARCHITECTURE 6.1); mount, eject (the 60-tick window; the Swan ejects only when jump comes within 4 ticks after down, a jump from a held crouch or water duck is a normal jump), ram = the SWAN DIVE (fire + jump on the same tick or 1 tick apart - change TUNING.vehicle.comboWindow to 1 and the vehicle.ts header; a jump pressed first stays a jump; the dive starts only on ground or a platform, never while swimming, in the air or at 0 cells; body walls end the charge; a charge into water ends in a BEAK BASH and a floating daze), special = fire + bomb (HONK); at 0 cells her wings fold at once and any jump press ejects (also in the air), and she never catches the pilot; the water catch (she calls her own mount(p) for 90 ticks starting at tick 30 after an eject over water); she cheers on bossDefeated (victory() returns early while mounted - expose a cheering flag or listen to the event).
5. The PERCH for co-op (a 14x4 one-way SolidBox moved with world.moveSolid, off from the squat to the landing, but kept on through jumps whose take-off x is inside a water rect), the STOMP, the camera rule from the Swan module (lead 64 and maxSpeed 4 while any followed player rides a swan; restore 38 and 3 after the last ride), every driven vehicle clamped to the view like a player (8.1), and in player code: no drop-through when a water rect lies under the feet (down + jump there is a normal jump, GDD 4.2).
6. Drawing: body strips with their -front overlays, the neck strip at 9 angles, layer order per look.md 7, colour-variant prefixes vehicle/swan, vehicle/swan-mute (P2), vehicle/swan-socks, vehicle/swan-mute-socks (param socks; the rider's player index picks mute).
7. tests/content/swan.test.ts: run speed 2.6 px/tick with the feel.md acceleration ramp, jump apex about 94 px (about 2x the 47 px on-foot apex; exact feel.md values), glide distance, the float line, swim speed, HONK numbers and erasing, beak-gun angles and rates, shells, ram, eject window, empty gag, perch carry in co-op, stomp, water take-off, no NaN, 2 players.
The swan-art agent draws her strips from look.md at the same time: code against the sprite ids and points of look.md 8-11 exactly; until a strip exists the registry shows a magenta placeholder - fine. MEASURE the feel in the sandbox (npm run arena -- --vehicle swan --water ... --press ... --trace swan,player) and compare with the feel.md tables; put the measured numbers in your report.`,
}

A['swan-art'] = {
  port: 5203,
  owns: 'src/game/content/vehicles/swan/art.ts and any src/game/content/vehicles/swan/*.art.ts you add, tests/content/swan-art.test.ts (new)',
  task: `ROLE: SWAN - ART. You draw the SWAN-3 "Metal Swan": a riveted ROBOT swan in ivory (snow), steel, navy trim, gold rivets, an orange beak and orange webbed feet, ridden on her back. She must never read as an armoured ostrich or any existing game's mount: no real feathers (her 'feathers' are stamped ivory metal plates), no helmet, no saddle frame, no stirrups, no gun on her flank - her gun is her beak (look.md 15).
READ: docs/design/swan-mount/look.md (ALL of it - the full art spec: silhouette, proportions and rulers, palette, every part and how to draw it, the rider, layers, named points, the sprite list, the frame tables, the neck strips, variants and damage, the art-against-logic numbers, the IP check), GDD 8.2 and 15.6 (the vehicle/swan strip list), docs/ART_GUIDE.md, docs/api/media.md (pixel toolkit), src/game/art/machines.ts and paint.ts (helpers).
BUILD every strip of look.md 9 with the frame counts, timings and named points of 8, 10 and 11: the body strips with their -front overlays (they hide the rider's hips), the riderless strips, scuffs, egg, wreck, the 9-angle neck strips (with -fire, -shell, -blink, -hurt, the relax and honk frames), in the four body prefixes (vehicle/swan, vehicle/swan-mute, vehicle/swan-socks, vehicle/swan-mute-socks; overlays and necks only swan and swan-mute), the damage looks (12.3), and fx/tin-feather (4 turning frames of a stiff stamped ivory tin plate with a steel glint and a gold rivet dot; it tumbles rigidly) and fx/muzzle-swan-beak-gun. No control stick, lever or panel on her head or neck (GDD 8.2 Never list). Also export a reusable head-drawing function (ivory dome, lens eye, navy face patch, orange beak) so the UI's ui/icon-life and ui/cursor-swan can match her - name it in your report.
ORDER: the core riding set first (idle, run, squat, jump, fall, land, the neck at 9 angles plus -fire, the -front overlays, wreck), then water (settle, swim, water-duck, paddle-up, swim-neck), then wings (flap, glide, glide-tired, fold), then everything else.
CHECK: sheets of every strip; composites with a stand-in rider on the 'seat' point (use the real char/recruit/ride-* strips once the characters agent has drawn them - else the mount frame) and the neck on the 'neck' point; gameplay frames at 1x next to a 36 px human and a rifleman (npm run arena -- --vehicle swan ...; if the swan-logic agent's entity does not draw your strips yet, composite them yourself in a small script under tmp/swan-art/). Silhouette test: a one-colour silhouette of the run and jump frames must read as a SWAN (long S-neck, egg body, webbed feet) - not an ostrich. tests/content/swan-art.test.ts: every id of look.md 9 exists with its frame count and its named points (8).`,
}

A.fleet = {
  port: 5204,
  owns: 'src/game/content/vehicles/fleet/** (index.ts, art.ts, more files as you like), tests/content/fleet.test.ts (new)',
  task: `ROLE: FLEET - the three other player vehicles: sundae-driver (an armed ice-cream van), bandwagon (a captured Legion parade truck) and trumpeter (the SWAN-3 flight mode for the m5-a shoot-em-up).
DO NOT EDIT src/game/vehicle.ts (the swan-logic agent owns it right now): subclass Vehicle and override; if a base change is truly needed, describe it under Requests.
READ: GDD 8.1, 8.3, 8.4, 8.5, 8.6, 6.3 (vehicle heavy shells), 4.1, 15.2 (vehicle weapons and projectiles), 15.6 (vehicle/<id>/... strips), 15.7, and every mission paragraph that uses them (grep docs/GAME_DESIGN.md for sundae-driver, bandwagon, trumpeter, JINGLE, startVehicle); docs/design/swan-mount/look.md 14 (TRUMPETER continuity: the same robot-swan design language, palette and head) and 1-5 (her look); docs/api/game.md (Vehicle API, recipe 13, SectionDef.startVehicle / vehicles / respawn in section 10); src/game/vehicle.ts; ART_GUIDE.md; src/game/art/machines.ts.
BUILD each vehicle with every GDD number: weapons sundae-sprinkle-gun, sundae-mortar, sundae-jingle; bandwagon-brass-cannon, bandwagon-drum-boom, bandwagon-cymbal-wall; trumpeter-twin-gun, trumpeter-dive-bomb, trumpeter-honk; projectiles sprinkle, sundae-shell, brass-ring, drum-wave, twin-bullet, dive-bomb; HP cells, ram, special, eject, wreck, the empty gag. The JINGLE queue uses the enemy reaction protocol (reactInArea, kind as the GDD names it). The trumpeter flies 8-way inside the auto-scrolling view, players start mounted (SectionDef.startVehicle) and respawn mounted per the section rules; it overrides the protected syncDriver() so the driver anchor sits 15 px below its hull centre (ARCHITECTURE 6.1, GDD 8.5). Combos (ram = fire + jump, special = fire + bomb) count when both presses come on the same tick or 1 tick apart (GDD 4.1; the swan-logic agent changes TUNING.vehicle.comboWindow to 1 for every vehicle).
ART: vehicle/<id>/... per GDD 15.6 plus the base-class names idle/move/wreck (ARCHITECTURE 7.1); original designs, readable at 1x next to a 36 px human. Check with sheets and gameplay frames (npm run arena -- --vehicle sundae-driver ...).
TESTS: spawn, mount, move, every weapon with its GDD numbers, cells, ram, special, eject, wreck; the trumpeter flies 8-way and stays in the view.`,
}

A.weapons = {
  port: 5211,
  owns: 'src/game/content/weapons/**, src/game/content/fx/**, src/game/weapons.ts, src/game/projectile.ts, src/game/grenade.ts, src/game/fx.ts, tests/game/weapons.test.ts (extend), tests/content/weapons.test.ts (new), tests/content/fx.test.ts (new). Keep existing ids and APIs working (m0, the rifleman and the slice tests use them).',
  task: `ROLE: WEAPONS & FX - every player weapon, bombs and melee, player projectiles, muzzle flashes, HUD weapon icons, and the shared fx set.
READ: GDD 4.3, 4.4, 5 (every weapon: numbers, ammo, call-outs and tag lines), 6 (grenade, knife; 6.3 the vehicle heavy shell base), 7.1 (weapon pickups, crate letters), 14.1-14.2 (kill and style scoring tied to weapons), 15.2, 15.6 (the fx/<id> list), 15.7 (weapon sfx ids); ARCHITECTURE 7.1 (reconciled ids: weapon/<id> projectile strips, ui/icon-<weapon id>, fx/muzzle names - these WIN over the GDD names) and 8 (damage kinds and tags); docs/api/game.md section 6 (weapons; the Damage kind/tags table).
BUILD:
1. shotgun, rocket-launcher, flamethrower, laser, homing, tuba (kind impact, tag sonic; its rings erase 'erasable' enemy shots), bounce-mine; re-check pistol, machine-gun (the sweep turns 22.5 degrees every 2 ticks), grenade and knife against the GDD. Each: defineWeapon with the GDD numbers (damage, rate, speed, ammo, spread, pierce, tags), pooled projectile entities, muzzle flash, HUD icon ui/icon-<weapon id>, the call-out text/voice line the GDD gives, sfx ids from 15.7.
2. Knife variants: the characters agent gives each hero a knife look and a knife-sfx mapping (data in src/game/content/characters - read it when it lands); make the knife play the character's variant sfx, falling back to weapon/knife.
3. fx: reconcile the GDD 15.6 fx list with the existing ids; add the missing ones (poof, confetti, music-note, steam-puff, helium-cloud, shadow, aim-line, stars-dizzy, flying-shako, stick-on-moustache, snow-puff, ice-cubes ...) and keep aliases for old names; everything pooled and cheap.
4. tests/content/weapons.test.ts and fx.test.ts: every weapon's numbers (damage, rate, ammo), projectile behaviour (rocket splash, flame range and stream, laser pierce, homing turn rate, tuba erase, mine bounce), every icon and fx id exists with its frames.
LOOK: a contact sheet of every weapon firing in every aim (forward, up, down in the air, the diagonal sweep) at 1x (npm run arena -- --weapon <id> --hold right,fire --spawn ...), and an fx sheet.`,
}

A.items = {
  port: 5212,
  owns: "src/game/content/items/**, src/game/hostage.ts, src/game/pickup.ts, tests/game/hostage.test.ts (extend), tests/content/items.test.ts (extend). Keep m0's crates, hostages and pickups working.",
  task: `ROLE: ITEMS & HOSTAGES.
READ: GDD 2.3, 7 (all), 4.6 (extends, 1up), 14.3, 15.3, 15.6 (item/... ids), 13.11 (the tally counts rescues); ARCHITECTURE 6.1 (hostage sprites), 7.1 (crate letters, weapon pickup ids); docs/api/game.md (Pickup, Hostage, drop tables); src/game/hostage.ts, src/game/pickup.ts, src/game/content/items/*.
BUILD: hostage kinds critic, roadie, tea-lady, tourist, composer (the hidden 1UP) and dollop (Mrs. Dollop), each an original, fully dressed design (humanoid rig styles); binds chair, cage, sack, float and balloon, each with its own free animation; the curtain-call bow (never a salute); the give animation and the drop; drop tables table-a ... table-d, crate, officer, truck, and 'auto'; pickups: weapon medallions (round ivory band-button medallions with a navy letter, GDD 7.1), bombs, food kinds (bread, cheese, teacake, jelly, birthday-cake), gem kinds (golden-note, gem, medal, golden-record) with params.float (no gravity: floating note trails for the Swan's glide lines, GDD 7.1/15.3), 1up, repair (vehicles); crate variants and the 'contains' param; scores per 14.3.
TESTS and sheets at 1x, plus gameplay frames (npm run arena -- --spawn "hostage@200{kind:'tea-lady',bind:'cage'};crate@260{contains:'S'}" ...).`,
}

A.props = {
  port: 5213,
  owns: 'src/game/content/props/** (index.ts, art.ts, more files), tests/content/props.test.ts (new)',
  task: `ROLE: SHARED MISSION PROPS - the interactive set pieces the missions place.
READ: GDD 9.5, 15.4 (the shared props list with params), and every mission paragraph that uses a prop (grep docs/GAME_DESIGN.md for each id: helium-tank, statue-head, breakable-wall, rolling-drum, spring-awning, duck-float, lily-pad, card-table, air-jet, cable-car, bellows-platform, icicle, willow-tree, avalanche, rising-water); 4.13 (the helium-tank applies status 'helium-head' - the characters agent defines it right now: apply it by id); 15.9 item 3 (the avalanche pursuit rule with params speed, maxSpeed, holdX, gap, stopX and a respawn at least 160 px right of its front; the willow that crushes only team 'enemy' and pushes players and Swans out); docs/api/game.md section 10 (SectionContext: what a mission script can do); docs/api/sim.md (SolidBox, world.moveSolid: carry, push, crush; terrain hazards).
BUILD all 15 props with their params, behaviour, scores, sprites prop/<id>/... and sfx ids from 15.7. Moving platforms (cable-car, bellows-platform, duck-float, lily-pad) use SolidBox carry. rising-water moves a water surface (read src/game/water.ts and the terrain hazard API; water.ts belongs to the swan-logic agent - if you need a hook there, request it and build a local fallback in your prop). The avalanche is a pursuit wall with its params. breakable-wall has params w, h, solid. spring-awning has variant net.
TESTS: each prop spawns with its params and its key behaviour works in a TestWorld (carry, crush, break, rise, apply the status ...), numbers per the GDD. LOOK at each in the sandbox at 1x.`,
}

A.creatures = {
  port: 5214,
  owns: 'src/game/content/creatures/** (index.ts, art.ts, more files), tests/content/creatures.test.ts (new)',
  task: `ROLE: CREATURES - bullfrog, windup-bot (param variant: walk | ski | fly), rattler, echo-bat, ram-goat, usher-bot, kazoo-drone (params formation: v | sine | loop | dive; shooter).
READ: GDD 9.0 (shared enemy rules, Legion colours), 9.3, 4.11, 14.1 (scores), 15.4 (params), 15.6 (creature/<id>/... strips), 15.7, and every mission paragraph that places each creature (grep the GDD); ARCHITECTURE 8; docs/api/game.md (Enemy base: reactions, attack tokens, telegraphTicks, gag awareness; recipe 13).
BUILD each creature with the GDD behaviour and numbers, its projectiles (for example croak-ring; the owner's folder draws them, ARCHITECTURE 7.1), the reactions it accepts, death variants, sprites creature/<id>/idle, walk, tell, attack, die, die-blast, die-burn (+ type extras, and the optional die-crush for the Swan's STOMP - it falls back to die). Original designs, readable at 1x; Legion robots (windup-bot, usher-bot, kazoo-drone) are tin and brass with crimson paint; enlisted animals wear a small crimson cap or scarf.
TESTS: spawn with each param value, a telegraph of at least 18 ticks before every attack, no attack from off-screen, scores, deaths. LOOK at each in the sandbox (groups of 3, facing both ways, attacking).`,
}

A['infantry-rhythm'] = {
  port: 5221,
  owns: 'src/game/content/infantry/index.ts + art.ts (the rifleman and the shared soldier helpers - ADDITIVE changes; m0, tests/content/infantry.test.ts and tests/review/r1-*.test.ts must keep passing), src/game/content/infantry/rhythm/**, tests/content/infantry.test.ts (extend), tests/content/rhythm.test.ts (new)',
  task: `ROLE: INFANTRY - RHYTHM SECTION: drummer, cymbalist, triangle, baton-major; and the rifleman's upgrades. The winds agent builds oompah-trooper, piccolo and bassoonist at the same time and imports shared helpers from infantry/index.ts.
FIRST (within your first steps): export the reusable soldier pieces you will need anyway (a base class and/or helpers for the shared soldier rules: entries, gags, alert / double-take, reactions, deaths by damage kind, outfit variants, attack-token use), ADDITIVELY - never rename or change existing exports - and document them in a comment block at the top of infantry/index.ts so the winds agent can use them.
READ: GDD 9.0 (the shared soldier rules: rig, outfits, movement, entries, gags, extra animations, panic look, death variants, enemy projectile look), 9.1 (each type), 4.11, 14.1, 15.4 (params outfit, entry, gag, alarm, column, facing), 15.6 (enemy/<id>/... strips and outfit variants enemy/<id>-<outfit>/<anim>), 15.7, every mission paragraph that places these types (grep); ARCHITECTURE 6.1 (enemy contract + optional reaction poses), 8; docs/api/game.md (Enemy base, react / reactInArea, attack tokens, telegraphTicks); docs/ART_GUIDE.md (withPieces for held instruments); src/game/art/human-sprites.ts (defineSoldierSprites, poseFrames). src/game/art/** belongs to the characters agent (additive only): build extra poses and strips in YOUR art files with the rig's public functions.
BUILD each type with its GDD behaviour, numbers, projectiles (for example cymbal-disc, baton), held-instrument art, the entries the GDD gives it, its gags, the reactions (anthem salute, HONK ears, JINGLE queue, SAY CHEESE photo-pose, ...), all death variants, and outfit variants (parade, deck, desert, snow, night) for your types AND the rifleman. Rifleman upgrades: the extra strips of 9.0/15.6 (double-take, salute, confused, queue, photo-pose, ears, die-crush, die-shatter, gag-<name>) and the outfits.
TESTS (rhythm.test.ts, infantry.test.ts) and sheets at 1x; gameplay frames in the sandbox (each type walking in, alert, attacking, a reaction, every death).`,
}

A['infantry-winds'] = {
  port: 5222,
  owns: 'src/game/content/infantry/winds/** (index.ts, art.ts, more files), tests/content/winds.test.ts (new)',
  task: `ROLE: INFANTRY - WINDS: oompah-trooper, piccolo, bassoonist. Import shared soldier helpers from ../index.ts (the rifleman module; the infantry-rhythm agent owns it and is adding more exports right now - read its header comment, and re-check its exports before you finish). Never edit infantry/index.ts or art.ts; build anything else you need in your folder.
READ: GDD 9.0 (the shared soldier rules: rig, outfits, movement, entries, gags, extra animations, panic look, death variants, enemy projectile look), 9.1 (your three types), 4.11, 14.1, 15.4 (params), 15.6 (enemy/<id>/... strips, outfit variants), 15.7, every mission paragraph that places your types (grep); ARCHITECTURE 6.1, 8; docs/api/game.md (Enemy base, reactions, attack tokens, telegraphTicks); docs/ART_GUIDE.md (withPieces for held instruments); src/game/art/human-sprites.ts (defineSoldierSprites, poseFrames) - src/game/art/** belongs to the characters agent: build extra poses and strips in YOUR art files.
BUILD each type with its GDD behaviour, numbers, projectiles (for example sonic-ring, low-ring, piccolo-bullet, bassoon-rocket - check 9.1 and 15.4), held-instrument art (tuba/sousaphone-like horn for the oompah-trooper drawn as an original design, piccolo, bassoon), the entries, gags (polish, practice, scales, reed ...), reactions, all death variants, and outfit variants (parade, deck, desert, snow, night).
TESTS (winds.test.ts) and sheets at 1x; gameplay frames in the sandbox (each type walking in, alert, attacking, a reaction, every death).`,
}

A['machines-armor'] = {
  port: 5223,
  owns: 'src/game/content/machines/armor/** (index.ts, art.ts, more files), tests/content/armor.test.ts (new)',
  task: `ROLE: MACHINES - ARMOR: oompah-tank (params stopX and maxX; a dying tank spawns a tank-crewman), tank-crewman, metronome-turret (param floor), gramophone-mortar, pipe-battery, anthem-speaker (param interval; it triggers the anthem salute reaction on 'legion' soldiers with reactInArea), drum-barricade.
READ: GDD 9.0, 9.2, 9.5 (drum-barricade, tank-crewman), 4.11, 14.1, 15.4 (params), 15.6 (machine/<id>/... strips: body, turret, wheel, rotor, tell, fire, wreck), 15.7, every mission paragraph that places them (grep); ARCHITECTURE 8; docs/api/game.md (Enemy base, multi-part hurtboxes, reactions); src/game/art/machines.ts (the machine kit: wheels, treads, plates, rivets, barrels; frozen for you - write local helpers in your folder).
BUILD each machine with the GDD behaviour, numbers, projectiles (bell-shell, metronome-bullet, record ... check 9.2), damage states (smoke, sparks, a wreck that stays), death explosions, scores. Crimson with gold trim, bunting and brass bells (GDD 9.0); original designs.
TESTS (armor.test.ts): spawn with params, telegraphs >= 18 ticks, no off-screen fire, HP, wreck, the crewman, the anthem reaction. LOOK at each in the sandbox at 1x next to the player.`,
}

A['machines-transport'] = {
  port: 5224,
  owns: 'src/game/content/machines/transport/** (index.ts, art.ts, more files), tests/content/transport.test.ts (new)',
  task: `ROLE: MACHINES - TRANSPORT: band-truck (params stopX, cargo, from: it drives in and unloads soldiers), piano-bomber (params mode ground | air, dir), baton-copter (param mode), rowboat (two soldiers stand and shoot from it), tank-barge, subway-train, parade-float (soldiers ride it).
READ: GDD 9.0, 9.2, 9.5 (support entities), 4.11, 14.1, 15.4 (params), 15.6 (machine/<id>/... strips), 15.7, every mission paragraph that places them (grep); ARCHITECTURE 8; docs/api/game.md (Enemy base, reactions, spawning by id, SolidBox carry for rideable decks); src/game/art/machines.ts (frozen for you - local helpers in your folder).
BUILD each with the GDD behaviour and numbers, projectiles (piano, note-bullet, note-rocket ... check 9.2), cargo/riders spawned by id (rifleman and the other infantry ids - placeholders are fine while the infantry agents work), damage states, wrecks, scores. Crimson with gold trim, bunting and brass bells; original designs.
TESTS (transport.test.ts): spawn with params, the truck unloads its cargo at stopX, bombers telegraph, the train and barge carry/crush per the GDD, no off-screen attacks. LOOK at each in the sandbox at 1x.`,
}

A.ui = {
  port: 5231,
  owns: 'src/game/content/ui/** (index.ts, art.ts, more files), src/game/hud.ts, src/game/context.ts (HudState: you may add request types; keep existing ones), src/game/settings.ts, src/game/app.ts, src/game/scenes/**, src/main.ts, tests/game/scenes.test.ts (extend), tests/content/ui.test.ts (new). Keep the smoke flow working: tools/smoke.ts drives boot -> title -> menu -> gameplay -> pause -> continue -> game over with keys; tools/ is frozen, so keep the key path that reaches gameplay working (or put the needed smoke change under Requests).',
  task: `ROLE: UI & FLOW - every screen and the HUD.
READ: GDD 13 (all), 14 (scoring, style callouts, mission tally, extends, final tally), 2.4 (mission briefings for the intro card), 2.6 (ending), 12.3 (announcer lines), 4.6 (continues), 4.9 (2P join), 4.10 (difficulty), 15.6 (ui/<id> list), 15.9 item 5; ARCHITECTURE 7.1 (HUD icon ids), 7.2; docs/design/swan-mount/levels.md 1.4 (the swan-head marker) and look.md 5.7 (her head, for ui/icon-life and ui/cursor-swan - the swan-art agent may export a head-drawing helper later; match its look now); docs/api/game.md (HudState bubbles, callouts, flashes; Settings; MissionStats).
BUILD: title and attract demo, mode select, character select (the heroes from the registry with portraits, fullName, role, quote, quoteSub; 2P), the mission intro card (Gusto's radio box, typed briefing, max 2 lines, 360 ticks, start skips after 60), the HUD per 13.7 (no infinity sign and no ammo digits for the pistol, swan-head lives, bombs and shells, the RIDE? bubble, ONWARD chevrons, the boss bar, the timer, the style callouts of 14.2, the STOMP! hint, DRUM ROLL! +1000, and the REQUIRED swan marker: a 6x6 swan head outlined in the rider's colour at the top edge while a rider's head is above the view, no arrow), the title scene with the ridden Swan swimming on the lake (GDD 13.3; compose vehicle/swan body, the rider's char/<id>/ride-* strip, the -front overlay and the neck in the look.md 7 draw order; placeholders until the swan and character art land) and the HOW TO PLAY line (15.9 item 5), pause, continue, game over, mission complete 'THE REVIEWS ARE IN' newspaper tally (13.11), ending and credits (13.12; credits use team/role names, never real people), options (13.13: bindings, volumes, difficulty ...), high scores and name entry (13.14). Every screen reads well at 1x (384x216) and works with keyboard and gamepad. The flow intro card -> mission -> tally -> next mission -> ... -> ending must work as soon as the mission wave registers m1-m5 (test with m0).
CHECK: a smoke run on your port, and screenshots of every screen (a small script under tmp/ui/ - Playwright against your own dev server on your port, or the software renderer) - LOOK at each one.`,
}

A.sfx = {
  port: 5232,
  owns: 'src/game/content/sfx/**, src/engine/synth.ts (ADDITIVE only: every existing recipe must sound the same), tests/content/sfx.test.ts (new)',
  task: `ROLE: SOUND EFFECTS - every sfx id of GDD 15.7 (about 190) with the recipe described in GDD 12.1.
READ: GDD 12.1 (each sound's description), 15.7 (the id list), docs/design/swan-mount/feel.md (the swan's sound cues and timings), ARCHITECTURE 7.1 ('Sounds the game layer plays' and SFX_ALIASES - never delete an alias), docs/api/media.md (synth recipes, the audio report tool: npm run audio -- <prefix> [--wav] writes WAVs to tmp/ - send them to tmp/sfx/).
BUILD every id (keep the existing ids and aliases), replace the placeholder swan/honk, balance levels by category (peak and loudness) with npm run audio, keep sounds short and punchy for arcade feel, and make loopable recipes for engines, rotors and drones (played with sfxLoop) where the GDD wants a loop.
TESTS (sfx.test.ts): every 15.7 id exists, renders without NaN, peak <= the agreed ceiling, length within bounds; aliases resolve.`,
}

A['music-missions'] = {
  port: 5233,
  owns: 'src/game/content/music/index.ts (the existing songs title, m0, boss, continue, game-over, mission-complete: polish allowed, keep ids and exports), src/game/content/music/missions.ts, src/engine/music.ts (ADDITIVE only), tests/content/audio.test.ts (music part; keep its imports bars, CUES, JINGLES, SONGS working), tests/content/music-missions.test.ts (new)',
  task: `ROLE: MUSIC - MISSIONS AND MENUS: new songs select, briefing, m1, m2, m3, m4, anthem, high-score (in music/missions.ts); you also own the existing songs in music/index.ts.
READ: GDD 12.2 (each track: mood, tempo, key, instruments, form, length, loop), 1.2 (tone), 15.8; docs/api/media.md (song DSL, instruments, scheduler, npm run audio -- --songs [--wav]).
RULE: every melody is NEW - never quote or paraphrase an existing tune (no national anthems, marches, game themes, folk songs or nursery rhymes). The 'anthem' is the Legion's own invented anthem.
BUILD each song with its intro, sections and a seamless loop where the GDD says loop; keep levels balanced against the existing songs (npm run audio -- --songs); check loop points (no click or gap), length and tempo. Export reusable instruments or helpers from music/index.ts if the music-finale agent can use them (additively; name them in your report).
TESTS (music-missions.test.ts): every id registers, renders without NaN, loops at the right bar, peak ceiling.`,
}

A['music-finale'] = {
  port: 5234,
  owns: 'src/game/content/music/finale.ts, tests/content/music-finale.test.ts (new). Do not edit music/index.ts or src/engine/music.ts (the music-missions agent owns them; you may import their exports; request changes).',
  task: `ROLE: MUSIC - FINALE: m5-sky, m5-organ, mini-boss, boss-final, boss-final-fast (its own song, not a sped-up boss-final), ending, credits (in music/finale.ts).
READ: GDD 12.2 (each track), 1.2 (tone), 15.8, the m5 mission and final boss sections (11.5, 10.5) for the mood; docs/api/media.md (song DSL, instruments, npm run audio -- --songs [--wav]).
RULE: every melody is NEW - never quote or paraphrase an existing tune (no classical organ pieces, marches, game themes or folk songs).
BUILD each song with its intro, sections and loop as the GDD says; the organ tracks get a convincing synthesized organ; the ending and credits are a satisfying finale that reprises the game's own title motif from music/index.ts (read it). Balance levels against the existing songs.
TESTS (music-finale.test.ts): every id registers, renders without NaN, loops at the right bar, peak ceiling.`,
}

const GROUPS = {
  heroes: {
    doc: 'docs/api/heroes.md',
    shared: 'every file of the heroes areas (characters, swan-logic, swan-art, fleet), plus src/game/content/vehicles/{index,art}.ts (shared vehicle helpers)',
    port: 5208,
    areas: ['characters', 'swan-logic', 'swan-art', 'fleet'],
    reviews: [
      { key: 'characters', areas: ['characters'], port: 5205, focus: 'the four heroes and recruit: contract completeness (every strip, frame counts, points), silhouettes and faces distinct at 1x, stats and texts exactly per GDD 3, the ride strips against look.md 6.4 (hands on grips in a composite), Helium Head per 4.13, the knife looks; rig changes did not change the rifleman or hostage art (compare sheets).' },
      { key: 'swan', areas: ['swan-logic', 'swan-art'], port: 5206, focus: "the ridden Swan end to end: does she FEEL like the user's request (fast: run 2.6 px/tick; a fixed-height jump of about 94 px, about 2x the on-foot apex; the beak gun aiming through its 180-degree arc; swim on the float line; flap and glide; HONK; the SWAN DIVE and its rules; the eject, water-catch and 0-cell rules of GDD 8.1/8.2)? Measure every feel.md number in the sandbox. Do the art and the logic agree (every sprite id the logic plays exists; named points neck/muzzle/cannon/seat line up; the rider sits on the seat with hands on the grips; -front overlays hide the hips; layers per look.md 7; P2 'mute' and socks variants)? Is she clearly a robot SWAN and never an armoured ostrich (look.md 15)? Co-op perch, eject, wreck, water take-off, camera rule." },
      { key: 'fleet', areas: ['fleet'], port: 5207, focus: 'sundae-driver, bandwagon, trumpeter: every GDD 8.3-8.6 number and weapon, the JINGLE queue reaction, the trumpeter flight in an auto-scrolling view and mounted respawn, art continuity with the Swan (look.md 14), base-class behaviour (cells, ram, eject, wreck).' },
    ],
  },
  arsenal: {
    doc: 'docs/api/arsenal.md',
    shared: 'every file of the arsenal areas (weapons, items, props, creatures)',
    port: 5219,
    areas: ['weapons', 'items', 'props', 'creatures'],
    reviews: [
      { key: 'weapons', areas: ['weapons'], port: 5215, focus: 'every weapon against GDD 5/6 numbers (measure damage per second, ammo, rates, ranges in the sandbox), aim directions and the MG sweep, projectile pooling, tuba erase, homing fairness, icons and pickups ids (ARCHITECTURE 7.1), fx list completeness, muzzle flashes at the muzzle point in every pose.' },
      { key: 'items', areas: ['items'], port: 5216, focus: 'every hostage kind and bind (free, walk, give, bow - never a salute), drop tables and auto drops with world.rng, pickups and their scores, medallion look (GDD 7.1), crates and contents, the composer 1UP, m0 still works.' },
      { key: 'props', areas: ['props'], port: 5217, focus: 'all 15 props: params, carry/crush/push physics with players, swans and enemies, the avalanche pursuit rule and its params, the willow rule, rising water, the helium tank applying helium-head, breakable walls, scores; robustness when the player dies or respawns on/near a prop.' },
      { key: 'creatures', areas: ['creatures'], port: 5218, focus: 'all 7 creatures: GDD 9.3 behaviour and numbers, telegraphs >= 18 ticks, no off-screen attacks, formations of kazoo-drones, windup-bot variants, reactions, deaths, scores, readable original art.' },
    ],
  },
  legion: {
    doc: 'docs/api/legion.md',
    shared: 'every file of the legion areas (infantry rifleman + rhythm + winds, machines armor + transport), plus src/game/enemy.ts (Enemy base: additive changes; creatures and props of another group subclass it too - keep every existing member and behaviour), src/game/art/machines.ts (additive), src/game/content/machines/{index,art}.ts (shared machine helpers)',
    port: 5229,
    areas: ['infantry-rhythm', 'infantry-winds', 'machines-armor', 'machines-transport'],
    reviews: [
      { key: 'rhythm', areas: ['infantry-rhythm'], port: 5225, focus: 'drummer, cymbalist, triangle, baton-major and the rifleman upgrades: GDD 9.0/9.1 behaviour and numbers, entries, gags, reactions, deaths by damage kind, outfits; the shared helpers are clean and documented; m0 and the r1 review tests still pass.' },
      { key: 'winds', areas: ['infantry-winds'], port: 5226, focus: 'oompah-trooper, piccolo, bassoonist: GDD 9.0/9.1 behaviour and numbers, projectiles, entries, gags, reactions, deaths, outfits; reuse of the shared soldier helpers instead of copies.' },
      { key: 'armor', areas: ['machines-armor'], port: 5227, focus: 'oompah-tank + crewman, metronome-turret, gramophone-mortar, pipe-battery, anthem-speaker, drum-barricade: GDD numbers, telegraphs, multi-part hurtboxes, damage states and wrecks, the anthem reaction, scores, readable original art.' },
      { key: 'transport', areas: ['machines-transport'], port: 5228, focus: 'band-truck cargo unloading, piano-bomber modes, baton-copter, rowboat crews, tank-barge, subway-train, parade-float riders: GDD numbers, carry/crush physics, telegraphs, no off-screen attacks, readable original art.' },
    ],
  },
  'sound-ui': {
    doc: 'docs/api/sound-ui.md',
    shared: 'every file of the sound-ui areas (ui, sfx, music-missions, music-finale)',
    port: 5238,
    areas: ['ui', 'sfx', 'music-missions', 'music-finale'],
    reviews: [
      { key: 'ui', areas: ['ui'], port: 5235, focus: 'every GDD 13 screen and the HUD against the spec (screenshots of each at 1x), keyboard and gamepad paths, 2P join, continue and game-over flow, high-score entry, options persist, no ammo digits for the pistol and no infinity sign, the RIDE? bubble, the newspaper tally, smoke flow intact.' },
      { key: 'sfx', areas: ['sfx'], port: 5236, focus: 'every GDD 15.7 id exists and matches its 12.1 description in character, levels balanced by category, no clicks (attack/release), loops seamless, aliases intact, swan sounds per feel.md.' },
      { key: 'music', areas: ['music-missions', 'music-finale'], port: 5237, focus: 'all 20 songs of GDD 15.8 exist, match 12.2 (tempo, key, mood, form), loop seamlessly, balanced levels, and are ORIGINAL (no quoted or paraphrased existing melodies - check every lead line against well-known tunes you know: anthems, marches, classical organ pieces, game themes).' },
    ],
  },
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
          title: { type: 'string' },
          status: { type: 'string', enum: ['fixed', 'partly', 'not-fixed'] },
          note: { type: 'string' },
        },
        required: ['severity', 'title', 'status'],
      },
    },
    unfinished: { type: 'array', items: { type: 'string' } },
    requests: {
      type: 'array',
      items: {
        type: 'object',
        properties: { owner: { type: 'string' }, file: { type: 'string' }, change: { type: 'string' } },
        required: ['owner', 'change'],
      },
    },
    tests: { type: 'string' },
  },
  required: ['summary', 'findings', 'unfinished', 'requests', 'tests'],
}

const INTEG_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    gates: {
      type: 'object',
      properties: {
        typecheck: { type: 'string' },
        tests: { type: 'string' },
        build: { type: 'string' },
        sim: { type: 'string' },
        smoke: { type: 'string' },
      },
      required: ['typecheck', 'tests', 'build', 'sim', 'smoke'],
    },
    unfinished: { type: 'array', items: { type: 'string' } },
    requests: {
      type: 'array',
      items: {
        type: 'object',
        properties: { owner: { type: 'string' }, file: { type: 'string' }, change: { type: 'string' } },
        required: ['owner', 'change'],
      },
    },
    docs: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'gates', 'unfinished', 'requests', 'docs'],
}


const KNOWN = {
  'infantry-rhythm': 'Typecheck errors now: rhythm/index.ts DRUM_BODY unused; rhythm/kit.art.ts HandShape unused. Failing tests to check (may be yours, since you own the rifleman): tests/review/r1-flow2.test.ts "R1-23: every m0 rifleman spawns above a floor" and tests/sim/sim.test.ts "completes the upper route in god mode".',
  'infantry-winds': "Typecheck errors now: winds/piccolo.art.ts 'P' unused; piccolo.art.ts line 89 passes 'light' which ShadeOpts does not have.",
  weapons: "Requests from the heroes group (done there): remove the 'swan-beak-gun' flash entry in content/weapons/shots.art.ts (about line 371; it re-registers fx/muzzle-swan-beak-gun, which the Swan art owns - the Swan now draws vehicle/swan/beak-flash), and remove defineSprite('fx/tin-feather', ...) in content/fx/gags.art.ts (about line 373; vehicles/swan/art.ts owns that id).",
  items: "Request from the heroes group: in content/items/pickups.ts, when the collector rides a Trumpeter (player.vehicle has weaponPickup()), call vehicle.weaponPickup() (+10 dive bombs) instead of giving the weapon; the Trumpeter's 'pickup' event undo is only a fallback.",
  props: "Typecheck errors now: props/breakables.art.ts unused imports Composer, layerOf, shadeLayer.",
  ui: "Typecheck error now: content/ui/ending.art.ts line 561 assigns a read-only 'buf'. src/game/scenes/ending.ts is a TEMPORARY STUB the orchestrator wrote so the flow compiles - replace it with the real ending, credits and final tally. Failing tests: tests/game/scenes.test.ts (title -> menu -> gameplay -> tally -> title; pause -> RESTART MISSION music; game over -> continue -> title): the flow changed, so fix the code or, where the GDD flow intentionally changed, update the test (you own it).",
  'swan-art': "Typecheck error now: vehicles/swan/head.art.ts 'oval' unused.",
  'machines-armor': 'Failing tests in tests/content/armor.test.ts: oompah-tank deck carry, tank-crewman, gramophone-mortar (aim/lob and wreck), drum-barricade.',
  'music-missions': 'Failing tests: tests/content/audio.test.ts (title loop length 45-60 s, m0 20-60 s, boss 20-60 s) and tests/content/music-missions.test.ts (all Web Audio render/loop checks in headless Chromium - find out whether the songs or the test harness are at fault).',
}

const FINISH_STATE = `STATE OF YOUR AREA: a builder agent worked on this area for several hours and was cut off by an account usage limit before it could finish, review or report. Its work is on disk in your files. There is no report.
START with an inventory (keep it short): read your files and tests; list every id, strip and feature the spec requires; mark each done / partial / missing; run your tests and the filtered typecheck. Then FINISH everything partial or missing, fix every failure in your files, and do NOT rewrite working code for style - extend it.
Before you report, review your own area adversarially (no separate reviewer follows): GDD numbers match; every attack telegraphs at least 18 ticks and nothing fires from off-screen; facing left, slopes, the view edge, 2 players, dying or being killed mid-attack, HARD; 30 copies under 0.5 ms per tick with no per-tick allocations; every sprite sheet and a gameplay frame at 1x LOOKED at (silhouette, outline, palette ramps, light from the upper left); originality (docs/ORIGINALITY.md); exact ids.
Be economical with tokens: read only the GDD and spec sections you need, use grep, and avoid re-reading large files.`

function finisherPrompt(key) {
  const a = A[key]
  return `${PRE}

YOUR LABEL: ${key} (tool output goes to tmp/${key}/). YOUR PORT: ${a.port}.
YOU OWN: ${a.owns}

${a.task}

${FINISH_STATE}
${KNOWN[key] ? 'KNOWN PROBLEMS IN YOUR FILES RIGHT NOW: ' + KNOWN[key] : ''}

DONE WHEN: every id of your task is registered and works with the GDD numbers; your tests pass; typecheck is clean for your files; you LOOKED at sheets and gameplay frames at 1x; tests/content/modules.test.ts passes for your ids; no console errors from your content in a smoke run on your port.

${REPORT_RULE}`
}

function integratorPrompt(gname, g, reports) {
  const parts = g.areas.map((k, i) => `=== ${k} ===\nFILES: ${A[k].owns}\n[finisher report]\n${reports[i] || '(no report - the finisher failed: check this area yourself and list what is missing)'}`).join('\n\n')
  const focus = g.reviews.map((rv) => `- ${rv.key}: ${rv.focus}`).join('\n')
  return `${PRE}

YOUR LABEL: integrate-${gname} (tool output goes to tmp/integrate-${gname}/). YOUR PORT: ${g.port}.
ROLE: GROUP REVIEWER-INTEGRATOR for the ${gname.toUpperCase()} group. The finishers of your group are done (their reports below). There was no separate reviewer, so you are the adversarial check. Other groups may still be working on their own files - never edit those.
YOU OWN: ${g.shared}.

REPORTS:
${parts}

REVIEW FOCUS PER AREA:
${focus}

TASKS:
1. Adversarial review, sampled but real: for every area, check the inventory against the spec (missing ids are findings), run each entity in the sandbox (npm run arena ...) and LOOK at the frames at 1x, measure a few key GDD numbers, check fairness (telegraphs >= 18 ticks, no off-screen attacks) and originality. Fix what you find, most severe first, with regression tests for logic fixes.
2. Gates: npm run typecheck (whole project; fix every error in files you own; list errors in other files), npx vitest run --maxWorkers=3 (fix failures in your files), npm run typecheck && npx vite build --outDir tmp/integrate-${gname}/dist --emptyOutDir, npm run sim -- --mission m0 --god (must complete with 0 errors), npm run smoke -- --port ${g.port}.
3. Requests between the areas of your group that touch files you own: do them now (base-class changes, shared helpers, cross-area wiring, de-duplication).
4. Write ${g.doc}: the reference the MISSION and BOSS agents of the next wave will use. For each id: what it is, size, params with defaults and allowed values, how to place or spawn it (code snippets), behaviours and timings a level designer must know, reactions and events it sends or accepts, sounds, known limits. Short and exact. Add one line linking it to a 'Content references' list at the top of docs/api/game.md (create the list if missing; re-read the file right before this small edit - other integrators add lines too).
Be economical with tokens: grep and targeted reads.

FINAL ANSWER: the structured result - summary (max 250 words), the gate results with numbers, what remains unfinished (by area), every request for owners OUTSIDE your group (exact file + change), and the docs you wrote.`
}

// ------------------------------------------------------------------------------------------------

const g = GROUPS[GROUP]
if (!g) throw new Error(`unknown group '${GROUP}' (expected one of ${Object.keys(GROUPS).join(', ')})`)
log(`Finish group ${GROUP}: finishers ${g.areas.join(', ')}; then the reviewer-integrator`)

phase('Finish')
const reports = await parallel(g.areas.map((k) => () => agent(finisherPrompt(k), { label: `finish:${k}`, phase: 'Finish' })))

phase('Integrate')
const integ = await agent(integratorPrompt(GROUP, g, reports), { label: `integrate:${GROUP}`, phase: 'Integrate', schema: INTEG_SCHEMA }).catch(() => null)

return {
  group: GROUP,
  finishers: Object.fromEntries(g.areas.map((k, i) => [k, reports[i]])),
  integ,
}
