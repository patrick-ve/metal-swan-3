// ElevenLabs generation spec for the start screens, mission `ams`, the first-person mode and
// mission `oldenzaal` (audio plan step 2; oldenzaal: docs/design/oldenzaal.md §11, wave A plan).
// Tools only: src/ never imports this file. The inventory behind it is
// tmp/audio/overview/critic.md (B1 sfx, B2 music, B3 dialogue) and sfx.md (PART 2).
//
// Rules for every request:
// - Original sounds only: no prompt names or imitates a real product sound, a film, a game,
//   a song, a composer, an artist or a real person.
// - SFX remake the synth recipes of src/game/content/sfx (the synth stays as the fallback).
//   Aliases are generated once, under their target recipe id (e.g. hit/armor -> hit/metal).
// - The mayor ROBO-HALSEMA never gets a voice: her lines stay text-only bubbles.
// - Text in LINES is the exact game text (incl. "\n" and a "GRAMPS: " prefix), so the runtime
//   voiceKey(text) finds the clip; `say` is what the voice actor reads.
import type { LineSpec, MusicSpec, SfxSpec, VoiceSpec } from './spec-types';

type Group = SfxSpec['group'];
const BOOT: Group = 'boot';
const AMS: Group = 'mission:ams';
const FPS: Group = 'mode:fps';
const OZ: Group = 'mission:oldenzaal';

// ---------------------------------------------------------------------------------------------
// SFX
// ---------------------------------------------------------------------------------------------

/** Shared prompt tails. */
const ONE = 'single one-shot, no background music, no voice';
const STING = 'single one-shot sting, no backing track, no voice';
const LOOP = 'seamless loop, steady level, no music, no voice';

interface OneOpts {
  /** Requested length (default: synth length + 0.3 s, at least 0.5 s). */
  seconds?: number;
  /** Final max length (default: 1.5x the synth length for short clips, 1.2x for long ones). */
  trimTo?: number;
  timing?: string;
  influence?: number;
  isNew?: boolean;
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * A one-shot. `len` is the current synth length in seconds: the timing the game expects. The API
 * cannot make clips under 0.5 s, so short sounds are generated at 0.5 s or more and trimmed.
 */
function one(id: string, group: Group, keep: number, len: number, prompt: string, o: OneOpts = {}): SfxSpec {
  const seconds = o.seconds ?? Math.max(0.5, Math.round((len + 0.3) * 10) / 10);
  const trimTo = o.trimTo ?? (len < 0.5 ? r2(Math.max(len * 1.5, len + 0.06)) : r2(len * 1.2));
  const spec: SfxSpec = { id, group, prompt, seconds, takes: Math.max(3, keep + 1), keep };
  if (trimTo < seconds) spec.trimTo = trimTo;
  if (o.timing) spec.timing = o.timing;
  if (o.influence !== undefined) spec.influence = o.influence;
  if (o.isNew) spec.isNew = true;
  return spec;
}

/** A seamless loop (8-20 s; the game loops it with loopStart/loopEnd). */
function loop(id: string, group: Group, seconds: number, prompt: string, isNew = false): SfxSpec {
  const spec: SfxSpec = { id, group, prompt: `${prompt}, ${LOOP}`, seconds, loop: true, takes: 3, keep: 1 };
  if (isNew) spec.isNew = true;
  return spec;
}

/** Telegraph sounds warn of an attack: the player must read them at once. */
const TELL = 'attack telegraph: a clear, sharp onset in the first 0.1 s';

export const SFX: SfxSpec[] = [
  // --- Start screens, menus and the mission flow (group 'boot') ------------------------------
  one('ui/move', BOOT, 2, 0.11, `Soft retro menu cursor tick, a tiny bright plastic click with a short square-wave blip, close and dry, ${ONE}`),
  one('ui/confirm', BOOT, 1, 0.58, `Bright rising accept chime for an arcade menu, three quick ascending bell-synth notes with a light sparkle, close, dry, cheerful, ${STING}`),
  one('ui/cancel', BOOT, 1, 0.15, `Short falling two-note back blip for an arcade menu, soft square-wave, close and dry, ${ONE}`),
  one('ui/select-confirm', BOOT, 1, 0.55, `Quick snare-drum roll that ends in one short brassy honk from a toy mechanical swan, comic arcade character-select confirm, close, dry, ${ONE}`, { timing: 'roll, then the honk, all within 0.55 s' }),
  loop('env/radio-static', BOOT, 10, 'Old military field-radio channel noise: soft hiss, crackle and low mains hum through a small speaker, close mic, no speech, no tones'),
  one('ui/pause', BOOT, 1, 0.38, `Muted falling two-note chime for a game pause, soft felt-mallet bell, close and dry, ${ONE}`),
  one('ui/countdown', BOOT, 1, 0.05, `One dry mechanical clock tick, small desk clock, very close, no reverb, ${ONE}`),
  one('ui/coin', BOOT, 1, 0.37, `Arcade coin-in: a metal coin drops into a slot, then a bright two-note ding, close, dry, ${ONE}`),
  one('ui/name-letter', BOOT, 1, 0.1, `Tiny high letter-entry blip, soft square-wave, close and dry, ${ONE}`),
  one('ui/announce', BOOT, 1, 0.39, `Short cheerful attention chime before an arena announcement, two bright notes, slight hall reverb, ${STING}`),
  one('mission/checkpoint', BOOT, 1, 0.43, `Rising two-note progress chime, bright glockenspiel and a soft synth, cheerful arcade checkpoint, close, short tail, ${STING}`),
  one('ui/timer-warn', BOOT, 1, 0.11, `Sharp urgent clock tick with a high click, countdown warning, close and dry, ${ONE}`),
  one('mission/time-up', BOOT, 1, 0.65, `Deflating comic buzzer: a low sour two-note horn that sags down in pitch, arcade time-up, close, dry, ${ONE}`),
  one('ui/warning', BOOT, 1, 1.42, `Two-tone boss alarm klaxon, a loud brassy siren alternating high and low for three cycles, cartoon arcade danger warning, slight room, ${ONE}`, { timing: 'three high-low cycles in about 1.4 s, then a clean stop' }),
  // REPORT FOR DUTY (docs/design/squad.md §4, 2026-10-16): the select-screen shutters. Synth fallbacks exist.
  one('ui/mil-shutter', BOOT, 1, 0.5, `Corrugated steel roller shutter rolled up fast by hand: a quick rattle of metal slats that slows as it rises, a low rumble under it, close, dry, ${ONE}`, { timing: 'the rattle starts at once and is done by 0.5 s' }),
  one('ui/mil-clank', BOOT, 1, 0.45, `A heavy steel shutter slams down onto a concrete floor: one hard metal clank with a short ringing tail, close, dry, ${ONE}`, { timing: 'the clank at 0.0 s, the ring gone by 0.45 s' }),
  one('ui/stamp', BOOT, 1, 0.12, `Rubber stamp thumped onto a newspaper on a wooden desk, one dry thud with a paper crinkle, very close, ${ONE}`),
  one('ui/tally', BOOT, 2, 0.1, `Fast score-counter blip, a tiny bright square-wave tick for rapid repeats, close and dry, ${ONE}`),
  one('ui/tally-end', BOOT, 1, 0.66, `Bright major-chord hit for a final score, short brass-and-bell stab, cheerful arcade, ${STING}`),
  one('ui/star', BOOT, 1, 0.32, `Sparkly single ding for a review star, a high glass bell with a tiny shimmer, close, ${ONE}`),
  one('item/1up', BOOT, 1, 0.71, `Fast triumphant extra-life jingle, a quick rising bright synth-and-bell arpeggio that ends on a high note, cartoon arcade, ${STING}`),
  // The existing recipe 'ui/go', now also wired to the GO arrow after a camera unlock (runner.ts showGo).
  one('ui/go', BOOT, 1, 0.32, `Short bright "go this way" cue, a quick upward whoosh with a two-note chirp, arcade, close and dry, ${ONE}`),

  // --- Player, weapons and bombs --------------------------------------------------------------
  one('player/jump', AMS, 3, 0.06, `Light quick jump whoosh for a small cartoon soldier, a short air swish with a tiny rising blip, close, dry, ${ONE}`),
  one('player/land', AMS, 3, 0.04, `Soft boot landing thump on cobblestones, small and light, close, dry, ${ONE}`),
  one('player/die', AMS, 2, 0.82, `Comic cartoon defeat: a falling slide whistle that ends in a springy boing, close, dry, ${ONE}`),
  one('player/spawn', AMS, 1, 0.25, `Soft feather fwump followed by a quick rising three-note sparkle, cartoon respawn, close, ${ONE}`),
  one('weapon/pistol', AMS, 4, 0.06, `Short punchy pistol shot, a bright pew with a tight snap, cartoon arcade, close, dry, no echo, ${ONE}`),
  one('weapon/mg', AMS, 4, 0.04, `One tight dry machine-gun round, a single short crack, arcade, close, no tail, ${ONE}`, { timing: 'one round only; the game fires it rapidly' }),
  one('weapon/shotgun', AMS, 3, 0.38, `Wide shotgun blast followed by a pump-action click-clack, cartoon arcade, close, short outdoor tail, ${ONE}`, { timing: 'blast at 0.00 s, pump click-clack at about 0.30 s' }),
  one('weapon/flame', AMS, 2, 0.4, `Flamethrower burst: a short whooshing roar of fire with crackle, close, dry, ${ONE}`),
  one('weapon/empty', AMS, 1, 0.15, `Dry trigger click on an empty gun, then a tiny comic deflating squeak, close, ${ONE}`),
  one('weapon/knife-umbrella', AMS, 2, 0.09, `Quick swing of a closed umbrella, a soft cloth fwip through the air, close, dry, ${ONE}`),
  one('weapon/knife-needles', AMS, 2, 0.08, `Two tiny metal knitting-needle ticks, a quick jab, close, dry, ${ONE}`),
  one('weapon/knife-pan', AMS, 2, 0.15, `Comic frying-pan BONK on a helmet, a bright ringing cast-iron hit with a short ring, close, ${ONE}`),
  one('weapon/knife-wrench', AMS, 2, 0.25, `Heavy steel wrench CLANG on metal with a short ringing tail, close, ${ONE}`),
  one('weapon/knife', AMS, 2, 0.08, `Quick knife swish through the air, a short blade whoosh, close, dry, ${ONE}`),
  one('weapon/grenade-throw', AMS, 2, 0.15, `Short whoosh of a hand grenade tossed through the air, close, dry, ${ONE}`),
  one('weapon/grenade-bounce', AMS, 3, 0.04, `Small metal grenade tonk, one bounce on cobblestones, close, dry, ${ONE}`),
  one('weapon/rocket', AMS, 2, 0.3, `Rocket launcher shot: an ignition pop and a fast rising launch whoosh, close, short tail, ${ONE}`),
  one('weapon/homing', AMS, 2, 0.17, `Small missile launch puff with a high electronic seeker chirp, close, dry, ${ONE}`),
  one('weapon/tuba', AMS, 2, 0.22, `Comic tuba BWAMP, one short loud low brass note fired like a cannon, close, dry, ${ONE}`),
  one('weapon/bounce-mine', AMS, 1, 0.06, `Small mine tossed onto the ground, a short plastic-and-metal clack, close, dry, ${ONE}`),
  one('weapon/mine-bounce', AMS, 2, 0.03, `Springy rubber bounce, one short boing tick, close, dry, ${ONE}`),
  loop('weapon/laser', AMS, 8, 'Humming sci-fi laser beam, a steady bright electric hum with a soft pulsing buzz, close'),

  // --- Explosions and hits -------------------------------------------------------------------
  one('explosion/s', AMS, 2, 0.2, `Small sharp pop explosion, a firecracker-like burst with a puff of smoke, cartoon arcade, close, short tail, ${ONE}`),
  one('explosion/m', AMS, 4, 0.5, `Punchy grenade explosion, a mid-size cartoon blast with debris crackle and a short tail, outdoors, ${ONE}`),
  one('explosion/l', AMS, 2, 0.95, `Large explosion, a big blast with a rolling low rumble tail, cartoon arcade, outdoors, ${ONE}`),
  one('explosion/xl', AMS, 1, 1.45, `Huge double explosion: two big blasts in quick succession and a long low growl tail, cartoon arcade boss defeat, outdoors, ${ONE}`, { timing: 'both bursts within the first 0.4 s' }),
  // Also plays as the alias hit/armor (bullets on the boss armour).
  one('hit/metal', AMS, 4, 0.06, `Bright metallic bullet tink, a short ricochet on steel armour, close, dry, ${ONE}`),
  one('hit/ground', AMS, 3, 0.05, `Dull heavy thud on stone paving, short, close, dry, ${ONE}`),
  one('hit/shield', AMS, 2, 0.1, `Hollow metallic tonk, a bullet hitting a round metal shield, short, close, ${ONE}`),
  one('hit/enemy', AMS, 3, 0.05, `Short muffled tick of a bullet hitting a soft padded target, cartoon, close, dry, ${ONE}`),

  // --- Pickups, crates and hostages ----------------------------------------------------------
  one('item/weapon', AMS, 1, 0.48, `Weapon pickup: a quick three-note rising arpeggio on a bright synth, ending with a gun-cocking chk, close, ${ONE}`),
  one('item/bombs', AMS, 1, 0.21, `Two low hollow wooden thunks, a bomb-crate pickup, close, dry, ${ONE}`),
  one('item/food', AMS, 3, 0.16, `Comic nom-nom bite, two quick crunchy chomps, cartoon, close, dry, ${ONE}`),
  one('item/gem', AMS, 3, 0.31, `Two sparkly high bell notes for a treasure pickup with a bright shimmer, close, ${ONE}`, { timing: 'the game pitch-shifts it per item kind: keep one clear pitch' }),
  one('item/pickup', AMS, 1, 0.13, `Bright two-note pickup blip, soft square-wave, close, dry, ${ONE}`),
  one('item/crate-break', AMS, 3, 0.16, `Small wooden crate splintering, dry planks snapping, close, ${ONE}`),
  one('hostage/free', AMS, 2, 0.28, `A rope snapping, then a happy two-note bird-like chirp, cartoon, close, ${ONE}`),
  one('hostage/give', AMS, 1, 0.37, `Two-note rising ta-da on bright bells, a cheerful reward handover, close, ${ONE}`),
  one('hostage/camera', AMS, 2, 0.31, `Tourist camera shutter click, then a rising electronic flash whine, close, dry, ${ONE}`),
  one('hostage/faint', AMS, 1, 0.42, `Sad three-note slide down, a soft cartoon wilt, close, dry, ${ONE}`),

  // --- ams enemies --------------------------------------------------------------------------
  one('ams/bell', AMS, 3, 0.43, `Dutch city bicycle bell, two quick metallic thumb-bell rings, bright, close, slight outdoor air, ${ONE}`, {
    seconds: 0.6,
    trimTo: 0.45,
    timing: `two rings; the ring is over by 0.36 s; ${TELL}`,
    influence: 0.6,
  }),
  one('ams/bass-thump', AMS, 3, 0.5, 'Phone speaker on a passing fat-tyre bike: two deep sub-bass booms with a muffled kick pattern, small boomy speaker, outdoors, single one-shot, no melody, no voice', {
    seconds: 0.6,
    trimTo: 0.5,
    timing: `two booms within 0.42 s; ${TELL}`,
    influence: 0.6,
  }),
  one('ams/kick', AMS, 2, 0.2, `Swinging leg whoosh, then a soft body thud, a cartoon kick, close, dry, ${ONE}`),
  one('ams/gull', AMS, 5, 0.36, `Herring gull call, one loud nasal KAW scream rising then falling, harbour, close, outdoors, ${ONE}`, {
    seconds: 0.5,
    trimTo: 0.4,
    timing: `one call, over by 0.36 s; ${TELL}; the game also plays it at 1.4x pitch for the death`,
  }),
  one('ams/ticket', AMS, 3, 0.26, `A paper parking-fine ticket fluttering through the air, a quick flap of one sheet, close, dry, ${ONE}`),
  one('enemy/alert', AMS, 1, 0.11, `Exclamation alert, two quick high square-wave beeps, a cartoon "notice", close, dry, ${ONE}`),
  one('enemy/double-take', AMS, 2, 0.24, `Comic slide whistle up and down, a quick cartoon double-take, close, dry, ${ONE}`),

  // --- Boss ROBO-HALSEMA (sound effects only; the boss has no voice) ------------------------
  one('ams/stamp', AMS, 1, 0.88, `A giant wooden stamp arm creaking up, then a heavy rubber-stamp SLAM on stone with a low boom, cartoon robot boss attack, close, ${ONE}`, {
    seconds: 1.0,
    trimTo: 0.95,
    timing: `creak 0.00-0.50 s, SLAM exactly at 0.50 s, the boom decays by about 0.88 s; ${TELL}; the game pitch-shifts it so the slam meets the telegraph`,
    influence: 0.7,
  }),
  one('ams/chain', AMS, 2, 0.53, `A heavy metal chain of office swung overhead, links rattling faster and faster over a whoosh, close, dry, ${ONE}`, {
    seconds: 0.7,
    trimTo: 0.55,
    timing: `rattle and whoosh within 0.45 s; ${TELL}; the game plays it at 0.7x-1.3x pitch (tell, lash, break)`,
    influence: 0.6,
  }),
  one('machine/pipe-charge', AMS, 1, 0.5, `Rising organ-pipe energy swell, an airy pipe tone charging up with an electric shimmer, robot boss shield charging, close, ${ONE}`, { timing: `the swell builds for the full 0.5 s and stops at its peak; ${TELL}` }),
  one('machine/brake', AMS, 1, 0.48, `Hydraulic leg hiss with a short servo whine, a heavy robot crouching to hop, close, dry, ${ONE}`, { timing: TELL }),
  one('boss/part-break', AMS, 2, 0.4, `Heavy metal crunch and tear, an armour plate ripping off a robot, a short debris clatter, close, ${ONE}`),
  one('boss/voice-crack', AMS, 1, 0.08, `Tiny cracked electronic squeak, a broken little robot speaker chirp, close, dry, single one-shot, no music, no speech`),
  one('machine/sad-notes', AMS, 1, 1.17, `Three slow sagging power-down notes, a machine winding down, comic and sad, close, ${STING}`),

  // --- The Swan (sections b, c and d) --------------------------------------------------------
  one('vehicle/enter', AMS, 1, 0.55, `Metal hatch clunk, then a rising mechanical servo whine, a small walking mech powering up, close, ${ONE}`),
  one('vehicle/exit', AMS, 1, 0.34, `Springy boing with a metal hatch pop, a comic eject, close, dry, ${ONE}`),
  one('swan/step', AMS, 4, 0.05, `A webbed metal foot slapping on cobblestones with a small hydraulic tick, mech footstep, close, dry, ${ONE}`),
  one('swan/fire', AMS, 4, 0.04, `One bright high machine-gun round from a small turret, a single crack, close, dry, no tail, ${ONE}`, { timing: 'one round only; the game fires it rapidly' }),
  one('vehicle/cannon', AMS, 2, 0.62, `Deep cannon boom with a short punchy low tail, a mech shoulder cannon, outdoors, ${ONE}`),
  one('swan/honk', AMS, 2, 0.4, `A nasal, brassy mechanical swan honk with an upward pitch scoop, comic and proud, close, dry, ${ONE}`, { influence: 0.5 }),
  one('swan/squeak', AMS, 1, 0.23, `Thin sad squeak that tries to rise and gives up, a small rusty squeeze horn, close, ${ONE}`),
  one('swan/jump', AMS, 2, 0.22, `Hydraulic ka-chunk with a short steam hiss, a mech jump, close, dry, ${ONE}`),
  one('swan/land', AMS, 2, 0.21, `Heavy mech landing thump with a metal clank, close, dry, ${ONE}`),
  one('swan/flap', AMS, 2, 0.15, `Deep mechanical wing whump with a latch clack and a servo whirr, close, ${ONE}`),
  one('swan/paddle', AMS, 3, 0.19, `Fast watery paddle flutter with droplets, webbed feet swimming in a canal, close, ${ONE}`),
  one('swan/splash', AMS, 2, 0.23, `Heavy water slap with droplets, a mech landing in a canal, close, ${ONE}`),
  one('swan/skid', AMS, 1, 0.17, `Webbed metal feet screeching over stone with a hydraulic hiss, a short skid, close, ${ONE}`),
  one('swan/fold', AMS, 1, 0.03, `Short double clack of metal wings folding shut, close, dry, ${ONE}`),
  one('swan/tired', AMS, 1, 0.2, `Falling mechanical wheeze, a tired small engine sighing out, close, ${ONE}`),
  one('swan/stomp', AMS, 1, 0.3, `Springy boing with a metal crunch, a comic mech stomp, close, ${ONE}`),
  one('swan/hiss', AMS, 1, 0.1, `Short angry swan hiss, breathy and sharp, close, dry, ${ONE}`),
  one('swan/dazed', AMS, 1, 0.67, `Three wobbly falling dizzy notes on a soft bell synth, cartoon daze, close, ${ONE}`),
  loop('swan/glide', AMS, 8, 'Soft wind rushing past large metal wings in flight, a steady airy whoosh, close'),
  one('vehicle/ram', AMS, 1, 0.78, `Rising wobbling comic siren, a mech charging forward, close, ${ONE}`),
  one('vehicle/hit', AMS, 3, 0.24, `Metal clang with a crunch, a mech hull struck, close, dry, ${ONE}`),
  one('vehicle/warning', AMS, 1, 0.28, `Two-tone low-energy warning beep in a mech cockpit, close, dry, ${ONE}`),
  one('vehicle/alarm', AMS, 1, 1.0, `Fast alternating two-tone alarm, an urgent mech cockpit alarm, close, ${ONE}`),
  one('swan/migrate', AMS, 1, 1.0, `A mechanical swan honk sliding down a fourth and fading into the distance, a comic farewell, ${ONE}`),

  // --- Finale -------------------------------------------------------------------------------
  one('env/applause', AMS, 2, 2.18, `A small square crowd clapping and cheering in the open air, joyful, medium distance, no words, ${ONE}`, { seconds: 2.6, trimTo: 2.4 }),

  // --- New gap sounds (isNew): added in this step with a quiet synth fallback and new wiring --
  loop('env/ams-canal', AMS, 20, 'Old-city canal water lapping softly against stone quay walls and moored boats, a light breeze, far-off gulls, outdoors', true),
  loop('env/ams-street', AMS, 20, 'Busy old-city street bed: bicycles rolling over cobblestones, distant bicycle bells, indistinct crowd murmur with no clear words, a far tram rumble, daytime, outdoors', true),
  one('ams/rider-crash', AMS, 3, 0.8, `A bicycle crashing onto cobblestones: metal frame clatter, a short tyre skid and a stray bell ding, cartoon, close, ${ONE}`, { seconds: 1.0, trimTo: 0.9, isNew: true }),
  one('ams/handhaver-down', AMS, 2, 0.6, `Comic knock-down: a soft body thump on paving with a burst of paper tickets fluttering, close, ${ONE}`, { seconds: 0.8, trimTo: 0.7, isNew: true }),
  one('env/ams-carillon', AMS, 1, 2.5, 'A church-tower carillon playing a short bright original phrase of six bells over about 2.5 s with a ringing tail, heard from a few streets away, outdoor reverb, single one-shot, no other instruments, no voice', { seconds: 4, trimTo: 4, isNew: true }),
  loop('ams/tour-boat', AMS, 12, 'A low diesel boat engine puttering past on a canal with a soft water wash, outdoors', true),
  // ROBO-HALSEMA has no voice (docs/ORIGINALITY.md): wordless robot chatter plays under her bubbles.
  loop('ams/mayor-babble', AMS, 8, 'Cartoon robot gibberish chatter: quick electronic beeps and bloops that rise and fall like syllables of talking, a warbling synth tone, small servo whirs, playful, no words, no human voice, no speech, close, dry', true),
  one('ams/duck', AMS, 3, 0.4, `A mallard duck, two short quacks, close, outdoors, ${ONE}`, { seconds: 0.6, trimTo: 0.5, isNew: true }),
  one('ams/pigeon', AMS, 3, 0.6, `A city pigeon taking off: a soft coo and a quick wing flutter, close, outdoors, ${ONE}`, { seconds: 0.8, trimTo: 0.7, isNew: true }),
  one('ams/mayor-intro', AMS, 1, 2.8, `Heavy double doors swinging open, then a servo whirr and a rising robotic power-up hum that ends in a clunk, cartoon robot boss entrance, ${ONE}`, { seconds: 3, trimTo: 3, timing: 'about 3 s; it plays with the WARNING banner', isNew: true }),
  one('player/step', AMS, 4, 0.08, `One light sneaker footstep on cobblestones, a small character running, close, dry, ${ONE}`, { seconds: 0.5, trimTo: 0.12, isNew: true }),
  one('weapon/reload', AMS, 2, 0.6, `Gun reload: magazine out, magazine in, slide rack, quick and clean, close, dry, ${ONE}`, { seconds: 0.8, trimTo: 0.7, isNew: true }),
  loop('swan/engine', AMS, 8, 'Low mechanical idle hum of a small walking mech, a steady motor with soft hydraulic ticks, close', true),
  one('player/splash', AMS, 2, 0.6, `A small character splashing into canal water, a quick plunge with droplets, close, ${ONE}`, { seconds: 0.8, trimTo: 0.7, isNew: true }),
  one('ui/title-sting', BOOT, 1, 1.8, `Title logo hit: a big bright cymbal-and-brass stab with a mechanical swan honk on top and a short shimmering tail, comic heroic arcade, ${STING}`, { seconds: 2, trimTo: 2, isNew: true }),
  loop('env/title-lake', BOOT, 16, 'A calm lake at dusk: gentle water lapping on reeds, a soft breeze, distant crickets and a far-off duck now and then, wide stereo', true),

  // --- First-person mode (docs/design/fps.md §9.1, group 'mode:fps'). The synth fallbacks live in
  //     src/game/content/fps/sfx.ts (group fps-sound). `len` is the length the game expects
  //     (§4.2 fire cycles, §4.6 doors, §4.7 push walls, §1.3 bridge). Gritty, dry, indoor
  //     concrete-and-steel depot; never a sound of the reference game (docs/ORIGINALITY.md).
  one('fps/knife', FPS, 2, 0.25, `Fast combat-knife slash through the air, a sharp steel whoosh, close, dry, ${ONE}`, { isNew: true }),
  one('fps/knife-hit', FPS, 2, 0.2, `Combat knife stab into a thick wool coat, a short dull thud with a cloth rip, close, dry, ${ONE}`, { isNew: true }),
  one('fps/pistol', FPS, 2, 0.4, `Single old military pistol shot in a concrete corridor, a sharp crack with a short boomy tail, punchy retro arcade shooter, close, ${ONE}`, { timing: 'the crack at 0.00 s; one shot per 0.33 s', isNew: true }),
  one('fps/mg', FPS, 2, 0.2, `One round of a heavy submachine gun indoors, a hard punchy bang, tight, close, ${ONE}`, { timing: 'one round only; the game fires it 6 times per second', isNew: true }),
  one('fps/chaingun', FPS, 2, 0.12, `One round of a fast rotary machine gun, a short heavy bang with a metallic rattle, close, dry, ${ONE}`, { timing: 'one round only; the game fires it 12 times per second', isNew: true }),
  one('fps/weapon-up', FPS, 1, 0.3, `Gun raised and readied: a quick metal slide rack and a cloth rustle, close, dry, ${ONE}`, { isNew: true }),
  one('fps/enemy/aim', FPS, 1, 0.2, `A soldier readies his gun: one crisp metal bolt click-clack, close, dry, ${ONE}`, { timing: TELL, isNew: true }),
  one('fps/enemy/pistol', FPS, 2, 0.4, `Single pistol shot from a few metres away down a concrete corridor, a crack with a short echo, ${ONE}`, { isNew: true }),
  one('fps/enemy/mg', FPS, 2, 0.2, `One round of a submachine gun fired down a concrete hallway, a sharp bang with a brief echo, ${ONE}`, { timing: 'one round only; bursts of 3, 0.1 s apart', isNew: true }),
  one('fps/enemy/hurt', FPS, 2, 0.35, `Short pained male grunt, a soldier hit in the chest, one wordless oof, clean undistorted recording at a moderate level, close, dry, single one-shot, no music, no words`, { isNew: true }),
  one('fps/enemy/fall', FPS, 1, 0.7, `A soldier's body collapsing onto a concrete floor: a heavy thud with a rifle clattering beside it, close, ${ONE}`, { isNew: true }),
  one('fps/blood', FPS, 2, 0.3, `Short wet splat, a small liquid squelch, close, dry, ${ONE}`, { isNew: true }),
  one('fps/dog/bark', FPS, 2, 0.45, `One loud aggressive bark of a big guard dog, clean undistorted recording at a moderate level, close, dry, ${ONE}`, { isNew: true }),
  one('fps/dog/growl', FPS, 1, 0.4, `A big guard dog's short snarl before it lunges, a low growl rising into a snap, close, dry, ${ONE}`, { timing: TELL, isNew: true }),
  one('fps/dog/bite', FPS, 1, 0.3, `Guard dog bite: a fast snap of jaws with a cloth tear, close, dry, ${ONE}`, { isNew: true }),
  one('fps/dog/die', FPS, 1, 0.6, `A big dog's short yelp that fades into a whimper, close, ${ONE}`, { isNew: true }),
  one('fps/boss/step', FPS, 2, 0.5, `Giant walking-mech footstep: a heavy steel foot slams onto concrete with a hydraulic hiss and a deep boom, close, ${ONE}`, { isNew: true }),
  one('fps/boss/spin-up', FPS, 1, 0.5, `Four rotary gun barrels spinning up fast, a rising electric motor whine with a metal whirr, close, ${ONE}`, { timing: `rises for the full 0.5 s and stops at its peak; ${TELL}`, isNew: true }),
  one('fps/boss/chaingun', FPS, 2, 0.12, `One round of a huge rotary cannon, a deep heavy bang with a metal clank, close, dry, ${ONE}`, { timing: 'one round only; the game fires it 15 times per second', isNew: true }),
  one('fps/boss/break', FPS, 1, 2.0, `A giant mech suit breaking down: crackling sparks, metal groaning and tearing, a hydraulic burst, a power-down whine falling in pitch, ending in a heavy clunk, ${ONE}`, { timing: 'about 2 s, it ends on the clunk', isNew: true }),
  one('fps/boss/fall', FPS, 1, 1.0, `A heavy armoured body crashing onto a steel floor: a deep thud, chains and metal gear clattering away, close, ${ONE}`, { isNew: true }),
  one('fps/boss/horn', FPS, 1, 1.5, `A distorted brass loudspeaker horn blaring an angry electronic squawk that rises and falls like a tantrum, wordless, no speech, close, ${ONE}`, { isNew: true }),
  one('fps/door-open', FPS, 1, 0.9, `A heavy steel sliding door rolls open on a rail: a latch clunk, then a smooth metal rumble that stops with a soft thud, close, ${ONE}`, { timing: 'the latch at once, the slide stops at about 0.9 s', isNew: true }),
  one('fps/door-close', FPS, 1, 0.9, `A heavy steel sliding door rolls shut on a rail: a metal rumble that ends in a hard clang, close, ${ONE}`, { timing: 'the clang at about 0.85 s', isNew: true }),
  one('fps/door-locked', FPS, 1, 0.3, `A locked heavy steel door handle rattled: two dull metal clunks, close, dry, ${ONE}`, { isNew: true }),
  one('fps/pushwall', FPS, 1, 1.9, `A massive stone block grinding slowly across a stone floor, a deep scraping rumble, close, ${ONE}`, { timing: 'one tile: about 1.8 s of steady grinding', isNew: true }),
  one('fps/elevator', FPS, 1, 1.0, `A big industrial lift lever thrown: a heavy switch clunk, then a rising electric motor hum, close, ${ONE}`, { isNew: true }),
  one('fps/use-wall', FPS, 1, 0.2, `A dull thud of a hand pushing a solid stone wall, nothing moves, close, dry, ${ONE}`, { isNew: true }),
  one('fps/pickup-health', FPS, 1, 0.4, `Medical pouch picked up: a quick canvas rustle and a bright two-note chime, arcade, close, ${ONE}`, { isNew: true }),
  one('fps/pickup-food', FPS, 1, 0.4, `Food picked up: a quick crunchy bite and a happy little chime, arcade, close, ${ONE}`, { isNew: true }),
  one('fps/pickup-ammo', FPS, 1, 0.3, `Ammo picked up: a cardboard box of cartridges rattling, a quick metallic jingle, close, dry, ${ONE}`, { isNew: true }),
  one('fps/pickup-weapon', FPS, 1, 0.55, `New gun picked up: a heavy metal clack and a slide rack, then a short rising brassy note, arcade, close, ${ONE}`, { isNew: true }),
  one('fps/pickup-key', FPS, 1, 0.4, `A big old iron key picked up: a bright metallic jingle with a soft chime, close, ${ONE}`, { isNew: true }),
  one('fps/pickup-treasure', FPS, 1, 0.45, `Treasure picked up: a sparkling jingle of gold coins with a bright glassy ding, arcade, close, ${ONE}`, { isNew: true }),
  one('fps/pickup-record', FPS, 1, 0.9, `Rare golden prize picked up: a shimmering harp glissando into a bright triumphant chime, arcade, close, ${STING}`, { isNew: true }),
  one('fps/player-hurt', FPS, 2, 0.3, `Short sharp male grunt of pain, a soldier hit, one wordless ugh, clean undistorted recording at a moderate level, close, dry, single one-shot, no music, no words`, { isNew: true }),
  one('fps/player-die', FPS, 1, 1.2, `A soldier's long falling groan, then a heavy body thud on a concrete floor, clean undistorted recording at a moderate level, close, single one-shot, no music, no words`, { isNew: true }),
  one('fps/glitch', FPS, 3, 0.3, `Short digital video glitch: a burst of crunchy bit-crushed static with a stuttering electronic chirp, ${ONE}`, { timing: 'short; it repeats every 0.1-0.4 s', isNew: true }),
  one('fps/type', FPS, 2, 0.05, `One old manual typewriter key strike, a crisp mechanical clack, very close, dry, ${ONE}`, { timing: 'one key only; the game types fast', isNew: true }),
  one('fps/fold', FPS, 1, 0.5, `An old tube television switching off: a quick electric zap and a high whine collapsing down to a soft click, close, ${ONE}`, { isNew: true }),
  one('fps/tally-100', FPS, 1, 0.4, `Bright perfect-score bonus: a bell ding with a short brassy fanfare stab, arcade, ${STING}`, { isNew: true }),
  one('fps/shout-guard', FPS, 1, 0.6, `A nervous young soldier's short startled wordless yelp of alarm, close, dry, single one-shot, no music, no words, no speech`, { isNew: true }),
  one('fps/shout-officer', FPS, 1, 0.6, `A pompous older man's short indignant wordless bellow of outrage, a nasal harrumph, close, dry, single one-shot, no music, no words, no speech`, { isNew: true }),
  one('fps/shout-ss', FPS, 1, 0.5, `A cold soldier's short sharp wordless bark of command, one clipped grunt, close, dry, single one-shot, no music, no words, no speech`, { isNew: true }),
  // --- Mission oldenzaal (docs/design/oldenzaal.md §11, revision 2; group 'mission:oldenzaal';
  //     ids: docs/api/oldenzaal.md). An abandoned old Dutch town at night, overrun by the risen dead
  //     soldiers of the old war: eerie, cold, grim and BLOODLESS (rot, dust and bones; no screams,
  //     no gore). The synth fallbacks live with each owner (content/sfx/oldenzaal.ts for 'oz/env/',
  //     oldenzaal-zombies.ts, oldenzaal-church.ts, oldenzaal-tower.ts, content/oldenzaal/{npcs,items,
  //     ruin}/ and bosses/oldenzaal/sfx.ts), so every id is marked new. No prompt names a game, a
  //     film, a person, a real army unit or a symbol; the dead are described by their sound only.
  //     Revision 2 dropped the possessed townspeople and the free souls (wave A's 'oz/possessed/').
  // The dead soldiers (ZOMBIES: content/sfx/oldenzaal-zombies.ts; soldier.ts `ZSFX`).
  one('oz/zombie/groan', OZ, 3, 1.3, `A rotting dead soldier's low, wet, wordless moan from a ruined throat, slow and hollow, eerie, clean recording at a moderate level, close, ${ONE}`, { isNew: true }),
  one('oz/zombie/growl', OZ, 2, 0.75, `A legless dead man dragging himself along: a rasping, gurgling wordless snarl, close, ${ONE}`, { isNew: true }),
  one('oz/zombie/drag', OZ, 2, 0.38, `A body dragged over brick pavers: a cloth scrape and a dull knock of bone, close, dry, ${ONE}`, { isNew: true }),
  one('oz/zombie/swing-tell', OZ, 1, 0.4, `A heavy trench shovel wound back over a shoulder: a rasping breath and an old leather strap creaking, close, ${ONE}`, { timing: TELL, isNew: true }),
  one('oz/zombie/swing', OZ, 2, 0.25, `A heavy shovel swung hard: a deep whoosh ending in a dull thud, close, dry, ${ONE}`, { isNew: true }),
  one('oz/zombie/rifle-tell', OZ, 1, 0.43, `An old rusty bolt-action rifle raised to the shoulder: a metallic click and a scrape of rust, close, ${ONE}`, { timing: TELL, isNew: true }),
  one('oz/zombie/rifle', OZ, 2, 0.98, `A single old bolt-action rifle shot outdoors: a dry crack with a long dull tail echoing between houses, ${ONE}`, { timing: 'the crack at 0.00 s', isNew: true }),
  one('oz/zombie/bolt', OZ, 1, 0.28, `Working a rusty rifle bolt: two stiff metallic clacks, close, dry, ${ONE}`, { isNew: true }),
  one('oz/zombie/mg-plant', OZ, 1, 0.29, `A heavy old machine gun's bipod set down on stone: a solid metal clank, close, dry, ${ONE}`, { isNew: true }),
  one('oz/zombie/mg-tell', OZ, 1, 0.23, `An old machine gun's cocking handle racked: a hard metallic clack-clack, close, dry, ${ONE}`, { timing: TELL, isNew: true }),
  one('oz/zombie/mg', OZ, 3, 0.12, `One round of a fast old machine gun: a short hard rip, outdoors, dry, ${ONE}`, { timing: 'one round only; the game repeats it for the burst', isNew: true }),
  one('oz/zombie/grab-tell', OZ, 1, 0.45, `A dead man rearing up from the ground to grab: a gurgling hiss, close, ${ONE}`, { timing: TELL, isNew: true }),
  one('oz/zombie/grab', OZ, 1, 0.18, `A bony hand lunging and gripping a leather boot: a quick slap and a creak of leather, close, dry, ${ONE}`, { isNew: true }),
  one('oz/zombie/bite', OZ, 1, 0.12, `A hard clack of teeth snapping shut, close, dry, no gore, ${ONE}`, { isNew: true }),
  one('oz/zombie/let-go', OZ, 1, 0.4, `A grip torn loose: a cloth rip and an angry wordless hiss, close, ${ONE}`, { isNew: true }),
  one('oz/zombie/hit', OZ, 3, 0.08, `A bullet hitting old rotten wool and dry flesh: a dull dusty puff, no splatter, close, dry, ${ONE}`, { isNew: true }),
  one('oz/zombie/helmet', OZ, 2, 0.35, `An old steel helmet knocked off a head and hitting brick pavers: a hollow metallic clang and a short roll, close, ${ONE}`, { isNew: true }),
  one('oz/zombie/barrel', OZ, 1, 0.3, `A machine gun's metal barrel jacket shot off: a sharp metal snap and a small rattle, close, dry, ${ONE}`, { isNew: true }),
  one('oz/zombie/collapse', OZ, 2, 1.05, `A dead soldier collapsing into a pile of dry bones and dust: a brittle clatter of bones and a soft sigh of falling dust, no voice, close, ${ONE}`, { isNew: true }),
  one('oz/zombie/ground', OZ, 2, 0.4, `The ground breaking open from below: a crunch of brick pavers and earth, close, ${ONE}`, { timing: TELL, isNew: true }),
  one('oz/zombie/burst', OZ, 2, 0.42, `Boarded-up planks bursting from behind: wood cracking and splintering, close, ${ONE}`, { timing: TELL, isNew: true }),
  one('oz/zombie/manhole', OZ, 1, 0.8, `A heavy cast-iron drain cover rattled from below and dragged across stone, close, ${ONE}`, { timing: TELL, isNew: true }),
  one('oz/zombie/flinch', OZ, 1, 0.22, `A dead man flinching back: a sharp rasping wordless hiss, close, ${ONE}`, { isNew: true }),
  // The abandoned town's openings (RUIN: content/oldenzaal/ruin/index.ts).
  one('oz/ruin/boards-rattle', OZ, 1, 0.5, `Planks nailed over a shop window banging and shaking from behind, nails creaking, close, ${ONE}`, { seconds: 0.7, timing: TELL, isNew: true }),
  one('oz/ruin/boards-burst', OZ, 2, 0.7, `A boarded-up shop window bursting outward: planks splintering and broken glass falling on pavers, close, ${ONE}`, { seconds: 1.1, isNew: true }),
  one('oz/ruin/cover-rattle', OZ, 1, 0.5, `A cast-iron manhole cover rattling in its frame, pushed from below, close, ${ONE}`, { seconds: 0.6, timing: TELL, isNew: true }),
  one('oz/ruin/cover-slide', OZ, 1, 0.9, `A heavy cast-iron manhole cover lifted and slid across brick pavers with a scrape and a clank, close, ${ONE}`, { isNew: true }),
  // Meneer Wu, the meal and Mevrouw Winkel (WUGHOST: content/sfx/oldenzaal-wu.ts).
  one('oz/wu/fryer', OZ, 1, 1.18, `A deep-fat fryer in a small snack bar kitchen: a hot oil sizzle with a few pops, close, ${ONE}`, { isNew: true }),
  one('oz/wu/paper', OZ, 1, 0.17, `A paper food tray: a crisp rustle and a quick fold, close, dry, ${ONE}`, { isNew: true }),
  one('oz/wu/toss', OZ, 1, 0.23, `A paper food tray tossed through the air: a soft airy whoosh, close, dry, ${ONE}`, { isNew: true }),
  one('oz/meal/catch', OZ, 1, 0.34, `A food tray caught: a paper rustle and a warm two-note chime, arcade, cheerful, close, ${ONE}`, { isNew: true }),
  one('oz/meal/eat', OZ, 1, 0.74, `Power-up eaten: three quick crunchy munches of fries and a bright rising sparkle, arcade, cheerful, close, ${STING}`, { isNew: true }),
  one('oz/meal/throw', OZ, 1, 0.22, `A soft sausage thrown hard in a high arc: a quick wobbly whoosh, comic, close, dry, ${ONE}`, { isNew: true }),
  one('oz/meal/splat', OZ, 2, 0.18, `A thick creamy splat that soaks up a hit: a wet slap and a squelch, comic, close, dry, ${ONE}`, { isNew: true }),
  one('oz/meal/blast', OZ, 1, 1.07, `A big warm explosion with a thick creamy splat at its start: a deep punchy boom that blooms into a bright airy chord with a sparkle on top, arcade, a little comic, no gore, ${ONE}`, { isNew: true }),
  one('oz/ghost/whisper', OZ, 2, 1.3, `A ghostly woman's soft breathy whisper with a slow flutter, no words, eerie, close, clean recording at a moderate level, single one-shot, no music`, { isNew: true }),
  one('oz/ghost/shriek', OZ, 2, 1.54, `A ghostly woman's single high wavering wordless shriek with a cold edge that fades into wind, one voice only, eerie, clean recording at a moderate level, single one-shot, no music, no words`, { isNew: true }),
  one('oz/ghost/laugh', OZ, 2, 1.66, `A middle-aged woman's soft, eerie ghostly laugh: four falling breathy "ha"s with a hollow echo, slow and cold, not cartoonish, clean recording at a moderate level, single one-shot, no music, no words`, { isNew: true }),
  one('oz/ghost/appear', OZ, 1, 0.85, `A ghost fades in: a cold rising swell like a reversed breath with faint glassy tones, eerie, quiet, ${ONE}`, { isNew: true }),
  one('oz/ghost/vanish', OZ, 1, 0.62, `A ghost fades out: a falling airy sigh that thins to a hush, eerie, ${ONE}`, { isNew: true }),
  // The town (AUDIO: content/sfx/oldenzaal.ts).
  one('oz/env/thunder', OZ, 2, 2.7, `A close lightning strike over a town: a sharp dry crack, then a long rolling thunder rumble, ${ONE}`, { timing: 'the crack at 0.00 s', isNew: true }),
  one('oz/env/thunder-far', OZ, 2, 2.25, `Distant rolling thunder far over a town at night, a soft low rumble without a crack, ${ONE}`, { isNew: true }),
  loop('oz/env/rain', OZ, 8, 'Steady rain on brick pavers and roof tiles in a quiet town at night, a few close drops', true),
  loop('oz/env/wind', OZ, 8, 'A cold night wind through narrow old streets: slow gusts and a faint whistle', true),
  loop('oz/env/street', OZ, 12, 'A deserted old Dutch shopping street at dusk: a low wind, the hum of a street lamp, the far creak of a hanging sign, a far shutter rattling now and then, no people, no traffic, eerie and still', true),
  loop('oz/env/nave', OZ, 12, 'Inside a large empty stone church at night: a dark, still room tone, a deep low hum under the vaults, small candle flames crackling, a far drip echoing, calm and eerie, no organ, no voices', true),
  loop('oz/env/storm', OZ, 10, 'A heavy storm around a stone church tower: driving rain, wind howling through narrow openings, a low distant rumble', true),
  one('oz/env/bell', OZ, 2, 3.3, `One deep toll of a large old church bell: a strong strike and a long humming ring that fades, outdoors, ${ONE}`, { isNew: true }),
  one('oz/env/bell-creak', OZ, 1, 0.84, `A swinging church bell's heavy wooden beam and rope creaking under the weight, close, ${ONE}`, { isNew: true }),
  one('oz/env/door-slam', OZ, 1, 1.45, `Heavy old wooden church doors slamming shut with an iron latch, echoing in a large stone hall, ${ONE}`, { timing: 'the slam at 0.00 s', isNew: true }),
  one('oz/env/door-creak', OZ, 1, 1.6, `A heavy old wooden door slowly creaking open on iron hinges, long and eerie, ${ONE}`, { isNew: true }),
  one('oz/env/candle-flare', OZ, 1, 0.55, `A row of candles flaring up at once: a soft fiery whoosh and small crackles, close, ${ONE}`, { isNew: true }),
  one('oz/env/candles-out', OZ, 1, 0.85, `A cold gust blowing out candles: a falling airy whoosh and small flame puffs, ${ONE}`, { isNew: true }),
  one('oz/env/lamp-flicker', OZ, 1, 0.43, `An old street lamp flickering: a short electric buzz and relay clicks, close, ${ONE}`, { isNew: true }),
  one('oz/env/crow', OZ, 1, 0.6, `A crow cawing twice from a rooftop at dusk, hoarse and harsh, outdoors, ${ONE}`, { isNew: true }),
  // St. Plechelmus, the statue mini-boss (STATUE: bosses/oldenzaal/sfx.ts). The statue is a victim
  // of the curse and is freed at the end: its sounds are stone and weight, nothing is mocked.
  one('oz/statue/crack', OZ, 2, 0.67, `Sharp cracks running through a large weathered stone statue, a dry splitting crunch with a grinding tail and a low thump, ${ONE}`, { isNew: true }),
  one('oz/statue/tell', OZ, 1, 0.7, `A cursed stone statue gathering for an attack: a cold rising shimmer over a stony rumble, eerie, ${ONE}`, { timing: TELL, isNew: true }),
  one('oz/statue/sweep', OZ, 1, 0.67, `A long heavy stone staff swept low across a square: a deep heavy whoosh with a stone scrape on brick pavers, ${ONE}`, { isNew: true }),
  one('oz/statue/wrench', OZ, 1, 0.4, `A stone block torn off a plinth: a grinding crunch and a sharp crack, ${ONE}`, { isNew: true }),
  one('oz/statue/throw', OZ, 1, 0.26, `A heavy stone block hurled through the air: a heavy airy whoosh, ${ONE}`, { isNew: true }),
  one('oz/statue/shatter', OZ, 2, 0.25, `A thrown stone block shattering on brick pavers: a stone crash with rattling pieces, ${ONE}`, { isNew: true }),
  one('oz/statue/bit', OZ, 3, 0.05, `A small stone bouncing on brick pavers: one short dry clack, close, ${ONE}`, { isNew: true }),
  one('oz/statue/step', OZ, 2, 0.16, `One huge stone foot landing on brick pavers: a low short thud with grit, ${ONE}`, { isNew: true }),
  one('oz/statue/slam', OZ, 1, 0.8, `A huge stone staff slams the ground: a deep boom and a cracking rumble running across brick pavers, ${ONE}`, { isNew: true }),
  one('oz/statue/hook', OZ, 1, 0.34, `A curled stone staff shooting out: a stony whip-crack and a rising whirr, ${ONE}`, { isNew: true }),
  one('oz/statue/caught', OZ, 1, 0.58, `Someone caught by a stone hook: a hollow knock and a grinding pull, ${ONE}`, { isNew: true }),
  one('oz/statue/free', OZ, 1, 0.19, `Breaking free of a stone hook: a quick snap and a short scrape, close, ${ONE}`, { isNew: true }),
  one('oz/statue/break', OZ, 1, 0.32, `A stone staff head breaking off: a sharp crack and pieces falling on pavers, ${ONE}`, { isNew: true }),
  one('oz/statue/chip', OZ, 3, 0.05, `A bullet chipping weathered stone: a tiny dry tick of grit, close, dry, ${ONE}`, { isNew: true }),
  one('oz/statue/tear', OZ, 1, 1.25, `A ghost torn out of a stone statue: a deep stone wrench under a rushing cold airy whoosh, eerie, no voice, ${ONE}`, { isNew: true }),
  one('oz/statue/heal', OZ, 1, 1.3, `Cracks in a stone statue closing: a soft, warm rising chime over a faint stone grind, calm and peaceful, never triumphant, ${ONE}`, { isNew: true }),
  one('oz/statue/sit', OZ, 1, 0.75, `A great stone statue settling back onto its plinth: a heavy settling grind and a soft thud, ${ONE}`, { isNew: true }),
  one('oz/statue/doors', OZ, 1, 1.6, `Tall old red wooden church doors creaking slowly open on iron hinges, then a low knock as they stop, ${ONE}`, { isNew: true }),
  // The church interior (CHURCH: content/sfx/oldenzaal-church.ts). Plain and calm, respectful: the
  // organ only moans (never a tune of a real hymn); only the old grave slabs break.
  one('oz/church/doors-slam', OZ, 1, 1.8, `Heavy old wooden church doors slamming shut with an iron latch, the large stone nave answering in long echoes, ${ONE}`, { timing: 'the slam at 0.00 s', isNew: true }),
  one('oz/church/organ-moan', OZ, 1, 2.7, `A church pipe organ moaning by itself in an empty dark church: one low wavering minor cluster on reedy pipes that swells and sighs away, wind in the pipes, no melody, eerie, ${ONE}`, { isNew: true }),
  one('oz/church/candles', OZ, 1, 0.75, `A row of small candle flames fluttering in a cold draught in a stone church, soft, close, ${ONE}`, { isNew: true }),
  one('oz/church/slab-crack', OZ, 1, 0.32, `A stone grave slab in a church floor cracking from below: stone ticks and a dull knock, close, ${ONE}`, { seconds: 0.6, timing: TELL, isNew: true }),
  one('oz/church/slab-break', OZ, 2, 0.58, `A stone floor slab breaking up from below: a stony crunch and chips skittering on a stone floor, echoing, ${ONE}`, { seconds: 0.8, isNew: true }),
  one('oz/church/lid-grind', OZ, 1, 0.65, `A heavy stone tomb lid grinding a little: stone dragging on stone in a low vaulted crypt, ${ONE}`, { timing: TELL, isNew: true }),
  one('oz/church/lid-fall', OZ, 1, 1.03, `A heavy stone tomb lid sliding off and dropping: a long stone grind and a heavy stone thud, echoing in a crypt, ${ONE}`, { isNew: true }),
  one('oz/church/grille-rattle', OZ, 1, 0.51, `An old iron chapel grille rattling in its lock, shaken from behind, echoing in a stone church, ${ONE}`, { timing: TELL, isNew: true }),
  one('oz/church/gate-creak', OZ, 1, 1.05, `An old iron gate swinging open on rusty hinges in a low stone crypt, a long creak, ${ONE}`, { isNew: true }),
  one('oz/church/drip', OZ, 2, 0.55, `A single drop of water falling into a puddle in a low stone crypt, with a soft echo, ${ONE}`, { isNew: true }),
  // The tower climb (TOWER: content/sfx/oldenzaal-tower.ts). The small bells reuse 'oz/env/bell'.
  loop('oz/tower/tide', OZ, 8, 'A mass of rotting dead soldiers climbing up inside a wooden church tower below: a low massed wordless groan that swells and sinks, boots and nails scraping on wood and stone, old helmets knocking, no screams', true),
  one('oz/tower/tide-surge', OZ, 1, 2.0, `A mass of dead men surging upward: a rising wordless groan of many throats and a deep rumble of boots on wooden stairs, no screams, ${ONE}`, { isNew: true }),
  one('oz/tower/tide-recoil', OZ, 1, 1.62, `A mass of dead men driven back down: a falling wordless groan and a hiss of grit and dust, ${ONE}`, { isNew: true }),
  one('oz/tower/toll-last', OZ, 1, 2.86, `One very deep toll of a great church bell high in a stone spire in a storm: a heavy strike, a long humming ring with a bright shimmer on top, ${ONE}`, { isNew: true }),
  one('oz/tower/creak', OZ, 3, 0.53, `An old wooden landing creaking under a heavy step: a short wood stick-slip groan, close, ${ONE}`, { isNew: true }),
  // The jet Swan of the finale (TOWER: content/sfx/oldenzaal-tower.ts).
  one('oz/swan/ignite', OZ, 1, 1.5, `Two small rocket engines lighting up: a soft thump and a rising turbine whine into a roaring hiss, ${ONE}`, { isNew: true }),
  loop('oz/swan/jet', OZ, 8, 'Two small rocket engines hovering in a storm: a steady roaring hiss, a low throb and a steady whine', true),
  one('oz/swan/flyby', OZ, 1, 2.35, `A rocket-powered flying machine turning and flying away fast: a jet roar that swells, passes and falls away into the distance with a doppler drop, ${ONE}`, { isNew: true }),
];

// ---------------------------------------------------------------------------------------------
// MUSIC
// ---------------------------------------------------------------------------------------------

/** Every track: the same arcade style and the same originality rule. */
const MUSIC_STYLE = 'Instrumental only, no vocals, original composition. Bright cartoon arcade run-and-gun game score, punchy clean stereo mix.';
/** A looping track: no ending, plus extra length so the tool can cut the loop on the bar grid. */
const LOOP_TAIL = 'Steady tempo throughout, no fade-out, no ending: the last bar leads straight back into the first bar of the loop, and the first bar of the loop plays once more at the very end so the loop can be cut.';
/** The first-person mode's songs (docs/design/fps.md §9.2): darker than the cartoon score. */
const FPS_STYLE = 'Instrumental only, no vocals, original composition. Gritty retro arcade action game score, cinematic and punchy, clean stereo mix.';

/** Mission oldenzaal's songs (docs/design/oldenzaal.md §11): spooky, dark and grim. */
const OZ_STYLE = 'Instrumental only, no vocals, no lyrics, original composition. Dark, grim and spooky arcade action game score for a haunted old town at night, cinematic, clean stereo mix.';
/** The v1 prompts (takes 1-2 of `title` and `select`, shipped 2026-10-14), kept as a record. */
export const TITLE_V1_PROMPT = `${MUSIC_STYLE} Heroic-comic title theme, 112 BPM, D major, 4/4. Bars 1-8: a gentle intro of bell arpeggios over a warm pad. Then a 32-bar loop: a calm, graceful legato lead (soft square-wave synth doubled by flute) that leaps up a sixth and walks down in a dotted rhythm, over a frantic running 16th-note filtered-saw bass like legs paddling under water; full drums with kick, snare and hats; a light counter-melody in the middle 8 bars. Dignified on top, furious underneath, a little funny. ${LOOP_TAIL}`;
export const SELECT_V1_PROMPT = `${MUSIC_STYLE} Bouncy, eager menu music, 128 BPM, A major, 4/4, one 16-bar loop with no intro. A staccato 8th-note synth lead hopping up, a walking bass with chromatic steps, off-beat pulse chords, hi-hats only (no kick). In bars 9-12 a graceful 4-bar hook while the bass breaks into fast 16ths. Excited rookie energy. ${LOOP_TAIL}`;

export const MUSIC: MusicSpec[] = [
  {
    id: 'title',
    group: BOOT,
    // intro 8 bars (17.1 s) + loop 32 bars (68.6 s) + 2 s
    seconds: 88,
    bpm: 112,
    beatsPerBar: 4,
    introBars: 8,
    loop: true,
    // v2 (2026-10-16, docs/design/squad.md §4): the military title. Takes 1-2 were made from the v1
    // prompt (TITLE_V1_PROMPT) and keep working; the v2 prompt makes takes 3-4.
    takes: 4,
    prompt: `${MUSIC_STYLE} Military march title theme, 112 BPM, D minor turning to D major, 4/4. Bars 1-8: a lone field snare plays a crisp marching cadence with rim clicks, distant low brass holds a pedal note. Then a 32-bar loop: a bold, heroic brass melody (trumpets and horns in unison, then in harmony) over a tight marching snare with rolls, a booming bass drum on every beat and a driving low-brass ostinato; in the middle 8 bars a cheeky piccolo answer over the snare; a big brass swell into the repeat. Proud, gritty, a little comic, never solemn. ${LOOP_TAIL}`,
  },
  {
    id: 'select',
    group: BOOT,
    // one 16-bar loop (30 s) + 2 s
    seconds: 32,
    bpm: 128,
    beatsPerBar: 4,
    loop: true,
    // v2 (2026-10-16): the REPORT FOR DUTY screen. Takes 1-2: the v1 prompt (SELECT_V1_PROMPT); v2 makes takes 3-4.
    takes: 4,
    prompt: `${MUSIC_STYLE} Tense military briefing-room march for a soldier select screen, 128 BPM, A minor, 4/4, one 16-bar loop with no intro. A tight marching snare pattern with rolls on every fourth bar, a low brass ostinato in eighths, short stabbed horn chords on the off-beats, a ticking hi-hat like a countdown clock. In bars 9-12 a short heroic trumpet call answered by low trombones while the snare doubles up. Urgent, proud, ready to deploy. ${LOOP_TAIL}`,
  },
  {
    id: 'briefing',
    group: BOOT,
    // one 8-bar loop (20 s) + 2 s; the player often hears only the first 6 s
    seconds: 22,
    bpm: 96,
    beatsPerBar: 4,
    loop: true,
    takes: 2,
    prompt: `${MUSIC_STYLE} Light military radio-chatter cue, 96 BPM, G mixolydian, 4/4, one 8-bar loop. A thin band-passed square-wave lead like a small radio speaker plays short repeated call-sign figures (two short notes and a long one) and a relaxed answer; soft round bass, brushed snare. Low and sparse so a spoken radio briefing sits on top. It must sound complete from bar 1. ${LOOP_TAIL}`,
  },
  {
    id: 'ams',
    group: AMS,
    // intro 4 bars (4.8 s) + loop 48 bars (57.6 s) + 2 s; one continuous song for sections a-d
    seconds: 65,
    bpm: 150,
    beatsPerBar: 3,
    introBars: 4,
    loop: true,
    takes: 2,
    prompt: `${MUSIC_STYLE} Cheerful Dutch street-organ (draaiorgel) waltz in 3/4, 150 BPM, F major. A 4-bar intro, then a 48-bar loop: A (16 bars, F major), B (16 bars, B-flat major), A' (16 bars, grander, glockenspiel in thirds). The organ melody is doubled by a bright piping rank an octave up with fast tremolo, a glockenspiel answers in the gaps, an "oom" bass on beat 1 and "pah-pah" reedy chords on beats 2 and 3, light kick and rim keep the carousel turning. Sunny, bouncy, a bit cheeky, Saturday-morning cartoon in an old canal city. All melodies are new. ${LOOP_TAIL}`,
  },
  {
    id: 'ams-boss',
    group: AMS,
    // intro 4 bars (6 s) + loop 40 bars (60 s) + 2 s; it runs through the boss death and the finale
    seconds: 68,
    bpm: 160,
    beatsPerBar: 4,
    introBars: 4,
    loop: true,
    takes: 2,
    prompt: `${MUSIC_STYLE} Driving, pompous comic-villain boss fight, 160 BPM, D minor, 4/4. A 4-bar intro of sustained street-organ chords and a snare roll, then a 40-bar loop: A (16 bars) a pumping 16th-note saw bass ostinato, punchy organ stabs in a 3+3+2 syncopation and a bold brass lead; B (16 bars) a stern, bureaucratic call-and-answer of clipped repeated brass notes; C (8 bars) an organ break with held chords and a rising snare build back to the top. Snare rolls into every phrase, crash on downbeats. Bossy comic menace, never dark horror. ${LOOP_TAIL}`,
  },
  {
    id: 'mission-complete',
    group: BOOT,
    // 6 s once + 2 s of natural decay
    seconds: 8,
    bpm: 140,
    beatsPerBar: 4,
    loop: false,
    takes: 2,
    prompt: `${MUSIC_STYLE} Short triumphant victory fanfare, 140 BPM, D major, about 6 seconds. A graceful square-wave and brass lead plays a rising heroic phrase over bells, a pad, a busy bass and accented drums. It ends on a bright held D major chord that decays naturally to silence, with room for a sound effect right after the chord. No fade-in.`,
  },
  {
    id: 'continue',
    group: BOOT,
    // one 6-bar loop (12 s) + 2 s
    seconds: 14,
    bpm: 120,
    beatsPerBar: 4,
    loop: true,
    takes: 2,
    prompt: `${MUSIC_STYLE} Nervous countdown cue, 120 BPM, 4/4, one 6-bar loop. A hi-hat tick and a rim tock like a clock, a short diminished square-wave figure in E that repeats three times, each time higher, over a bass pulse. Tense but comic. ${LOOP_TAIL}`,
  },
  {
    id: 'game-over',
    group: BOOT,
    // 5.06 s once + 2 s of decay
    seconds: 7.5,
    bpm: 80,
    beatsPerBar: 4,
    loop: false,
    takes: 2,
    prompt: `${MUSIC_STYLE} Deflated game-over sting, 80 BPM, D minor, about 5 seconds. A slow descending square-wave line falls toward D and lands one semitone flat, on C-sharp, against a D minor pad: a deliberate sour wrong note. A soft muffled drum. Sad-comic, not tragic. It ends on that held sour note and decays to silence.`,
  },
  {
    id: 'high-score',
    group: BOOT,
    // one 8-bar loop (14.55 s) + 2 s
    seconds: 17,
    bpm: 132,
    beatsPerBar: 4,
    loop: true,
    takes: 2,
    prompt: `${MUSIC_STYLE} Perky name-entry music, 132 BPM, A major, 4/4, one 8-bar loop. A short bright pulse-wave tune over a bouncing octave bass pattern, light hi-hat and rim. Happy, a little smug. ${LOOP_TAIL}`,
  },

  // --- First-person mode (docs/design/fps.md §9.2, group 'mode:fps'): original tunes, never a
  //     quote of an existing one.
  {
    id: 'fps-floor',
    group: FPS,
    // one 32-bar loop (76.8 s) + 2 s
    seconds: 79,
    bpm: 100,
    beatsPerBar: 4,
    loop: true,
    takes: 3,
    prompt: `${FPS_STYLE} Brooding martial ostinato, 100 BPM, C minor, 4/4, one 32-bar loop with no intro. A low repeating eighth-note ostinato of staccato strings and a dark synth, a low brass pad holding long minor chords, military snare rolls and a deep bass drum on beats 1 and 3. In bars 17-24 a sparse muted trumpet motif answers the ostinato, then it builds back. Tense, steady, sneaking through a fortified supply depot. All melodies are new. ${LOOP_TAIL}`,
  },
  {
    id: 'fps-boss',
    group: FPS,
    // intro 2 bars (3.4 s) + loop 32 bars (54.9 s) + 2 s
    seconds: 61,
    bpm: 140,
    beatsPerBar: 4,
    introBars: 2,
    loop: true,
    takes: 3,
    prompt: `${FPS_STYLE} Driving final boss battle, 140 BPM, D minor, 4/4. A 2-bar intro of a rolling timpani crescendo, then a 32-bar loop: pounding timpani and a hard rock drum kit, a galloping low synth bass, stabbing organ-like chords on the off-beats, a heroic distorted guitar and brass melody; in bars 17-32 the harmony climbs a step every 4 bars for rising tension. Huge, fast, a little over the top, cartoon villain showdown. All melodies are new. ${LOOP_TAIL}`,
  },
  {
    id: 'fps-tally',
    group: FPS,
    // a 6-8 s jingle + 1.5 s of decay
    seconds: 9,
    bpm: 120,
    beatsPerBar: 4,
    loop: false,
    takes: 2,
    prompt: `${FPS_STYLE} Short victory jingle, 120 BPM, C major, about 7 seconds. A bold brass fanfare over a snare roll and timpani hits, a quick rising phrase that lands on a big held C major chord, which decays naturally to silence. Proud and a bit cheeky. No fade-in.`,
  },
  {
    id: 'fps-bridge',
    group: FPS,
    // 1 intro bar (the 4 s sting) + loop 4 bars (16 s drone) + 2 s
    seconds: 22,
    bpm: 60,
    beatsPerBar: 4,
    introBars: 1,
    loop: true,
    takes: 2,
    prompt: `${FPS_STYLE} Glitchy transition cue, 60 BPM, 4/4. The first 4 seconds: a cheerful street-organ waltz phrase starts, then stutters, skips like a broken tape, slows down and pitch-drops into a deep low drone. Then a dark, steady low drone loop: a low string and synth pad on one note, a slow pulse, faint digital crackle and a distant metallic hum, no melody. Uneasy, mysterious. The drone stays steady with no ending. ${LOOP_TAIL}`,
  },
  // --- Mission oldenzaal (docs/design/oldenzaal.md §11, group 'mission:oldenzaal'). Spooky,
  //     dark and grim, in contrast to the bright Amsterdam score. Tempo, key and form match the
  //     synth fallbacks in src/game/content/music/oldenzaal.ts. Original tunes only: never a quote
  //     of an existing organ piece, hymn, horror theme or game tune.
  {
    id: 'oldenzaal',
    group: OZ,
    // intro 4 bars (12.6 s) + loop 24 bars (75.8 s) + 2 s
    seconds: 91,
    bpm: 76,
    beatsPerBar: 4,
    introBars: 4,
    loop: true,
    takes: 3,
    prompt: `${OZ_STYLE} Slow haunted town theme, 76 BPM, F minor, 4/4. A 4-bar intro: a low organ pedal note, two distant church bell tolls and a soft low heartbeat drum (two thumps every two beats). Then a 24-bar loop. Bars 1-8: a hollow chapel organ holds slow minor chords; a thin, wavering, whistle-like lead plays a sparse sighing tune over the heartbeat. Bars 9-16: a wordless synth choir pad swells in, the bass climbs one semitone per bar and the heartbeat doubles: rising tension. Bars 17-24: the full organ with a bright upper register, the tune an octave higher, timpani on the beats; the last bar falls back down. Grim, cold and mysterious, never cheerful. All melodies are new. ${LOOP_TAIL}`,
  },
  {
    id: 'oldenzaal-boss',
    group: OZ,
    // intro 2 bars (4.8 s) + loop 24 bars (57.6 s) + 2 s
    seconds: 65,
    bpm: 100,
    beatsPerBar: 4,
    introBars: 2,
    loop: true,
    takes: 3,
    prompt: `${OZ_STYLE} Heavy boss battle against a living stone statue, 100 BPM, C minor, 4/4, half-time feel. A 2-bar intro: dry stone-on-stone knocks and a rolling timpani crescendo under a tense wordless choir cluster. Then a 24-bar loop. Bars 1-8: a growling low synth riff in a 3+3+2 rhythm, a heavy kick on beat 1 and a stone knock on beat 3, organ stabs on the off-beats, a slow menacing organ melody. Bars 9-16: a wordless synth choir holds dark chords while stone percussion runs in eighth notes and the organ melody climbs high and long. Bars 17-24: a breakdown of riff and stone knocks, then a rising arpeggio and a timpani roll back into the top. Massive, ancient, menacing. All melodies are new. ${LOOP_TAIL}`,
  },
  {
    id: 'oldenzaal-tower',
    group: OZ,
    // intro 2 bars (2.9 s) + loop 32 bars (45.7 s) + 2 s
    seconds: 51,
    bpm: 168,
    beatsPerBar: 4,
    introBars: 2,
    loop: true,
    takes: 3,
    prompt: `${OZ_STYLE} Fast chase up a church tower in a storm, 168 BPM, E minor, 4/4. A 2-bar intro: a deep bell toll and a drum pickup. Then a 32-bar loop. Small bright bells ring a constant 3+3+2 pattern of sixteenth notes that drives the rhythm all the way through. Bars 1-8: an urgent pulse-wave lead over a running eighth-note bass, fast drums and organ stabs. Bars 9-16: the same 8 bars a minor third higher, climbing. Bars 17-24: a new chase line over a wordless synth choir pad. Bars 25-32: half-time drums with the bells alone and a deep toll, then a fast run back up into the top of the loop. Breathless, frantic, spooky. All melodies are new. ${LOOP_TAIL}`,
  },
  {
    id: 'oldenzaal-tbc',
    group: OZ,
    // the 5 s sting + 3 s of decay
    seconds: 8,
    bpm: 96,
    beatsPerBar: 4,
    loop: false,
    takes: 2,
    prompt: `${OZ_STYLE} Short 'to be continued' sting, 96 BPM, about 5 seconds. A deep church bell toll and a timpani hit; a wordless synth choir swells on an F minor chord over a low organ pedal while a thin wavering whistle-like lead sighs up a semitone and back; then everything moves to a held C major chord with the lead hanging on a B above it: unresolved and ominous, the story is not over. It decays naturally to silence. No fade-in.`,
  },
];

// ---------------------------------------------------------------------------------------------
// VOICES (Voice Design: original voices only; never a real person, never a clone)
// ---------------------------------------------------------------------------------------------
// No voice for the mayor ROBO-HALSEMA: her lines stay text-only bubbles.

export const VOICES: VoiceSpec[] = [
  {
    speaker: 'announcer',
    name: 'MS3 Announcer',
    description:
      'Adult male arcade-game announcer with a deep, booming, theatrical voice, part circus ringmaster and part arena MC. Punchy, clipped, shouted delivery with a warm grin and dry wit. Clear neutral English accent. Studio quality, close microphone, no reverb.',
    previewText:
      'Ladies and gentlemen, cygnets and crocodiles! Mission one is about to begin. Grab your umbrellas, mind the canals, and give me a big round of applause. Bravo! Encore! Game over? Never!',
  },
  {
    // The REPORT FOR DUTY name callouts (docs/design/squad.md §4, 2026-10-16): a designed voice only,
    // never an imitation of the five friends or of any real announcer.
    speaker: 'drill',
    name: 'MS3 Drill Sergeant',
    description:
      'Gruff, gravelly male drill sergeant in his fifties, used as an arcade-game announcer: loud, barked, clipped one- and two-word calls with a rough edge and a hint of a grin. Neutral English accent. Studio quality, close microphone, no reverb.',
    previewText:
      'Listen up, recruits! Fall in, chin up, eyes front! You there, name and number! Move, move, move! Nobody sleeps until the swan is fueled and the frikandellen are hot. Report for duty! Dismissed!',
  },
  {
    speaker: 'gusto',
    name: 'MS3 Brigadier Gusto',
    description:
      'Older British army brigadier in his sixties, brisk, upbeat and a little pompous, crisp upper-class English accent, quick commanding delivery with cheerful enthusiasm. Recorded clean and close; a radio filter is added later.',
    previewText:
      'Gusto here, do you read me? Splendid. The weather is fine, the troops are hungry, and I have rehearsed my karaoke number twice this morning. Now listen carefully, this is important. Go!',
    radio: true,
  },
  {
    speaker: 'baker',
    name: 'MS3 Baker',
    description:
      'Warm, friendly Amsterdam man in his forties who runs a fry shop. Native Dutch speaker with a natural Amsterdam city accent, slightly husky, very expressive: worried one moment, jubilant the next. Close microphone, clean studio sound.',
    previewText:
      'Hoi! Kom binnen, kom binnen. De frituur staat al de hele ochtend aan en de saus is vers. Maar ik moet je iets vertellen, en het is geen goed nieuws. Hier, neem eerst maar een frietje.',
  },
  {
    speaker: 'staff1',
    name: 'MS3 Fry Staff 1',
    description:
      'Young Dutch man in his twenties who works in a fry shop, bright, cheerful and energetic, native Dutch with a casual city accent, quick happy delivery. Close microphone, clean studio sound.',
    previewText:
      'Dankjewel, dankjewel! Wat een dag, zeg. Iedereen is er, de hele straat staat te juichen en de friet is nog warm ook. Kom, we gaan het vieren met een extra grote zak!',
  },
  {
    speaker: 'staff2',
    name: 'MS3 Fry Staff 2',
    description:
      'Young Dutch woman in her twenties who works in a fry shop, bubbly and loud, native Dutch with a casual city accent, bright and quick. Close microphone, clean studio sound.',
    previewText:
      'Lekker! Echt waar, dit is de beste friet van de stad. Met mayonaise, met ui, met alles erop en eraan. Wie wil er nog een? Niet duwen, er is genoeg voor iedereen!',
  },
  {
    speaker: 'vendor',
    name: 'MS3 Hot-Dog Vendor',
    description:
      'Middle-aged American man who runs a hot-dog cart, big hearty friendly voice with a relaxed Southern American accent. He speaks Dutch as a learned second language: clear Dutch words, but with a strong, warm American accent. Jolly and loud. Close microphone.',
    previewText:
      'Hallo daar! Welkom, welkom. Ik heb hotdogs, ik heb mosterd, en ik heb de mooiste kar van de hele gracht. Mijn Nederlands is niet perfect, maar mijn worstjes wel!',
  },
  {
    speaker: 'gramps',
    name: 'MS3 Gramps',
    description:
      'Gravelly old British man in his seventies, a retired army engineer, grumpy but fond, dry humour, slow and measured working-class English accent, talks about his machine like a pet. Recorded clean and close; a radio filter is added later.',
    previewText:
      "Now then, listen here. I built her with my own two hands, every bolt and every feather. She is a bit nervous around strangers, so be gentle with the pedals. And for heaven's sake, mind the tulips.",
    radio: true,
  },
  {
    speaker: 'rider',
    name: 'MS3 Delivery Rider',
    description:
      'Young Dutch man in his twenties, a food-delivery cyclist, breathless and hurried, a bit apologetic, native Dutch speaker who also speaks quick casual English with a light Dutch accent. Close microphone, outdoors energy.',
    previewText:
      'Sorry, sorry, coming through! I have three orders and the app says I am already late. Tring tring! Opzij, opzij alsjeblieft! Oh no, the fries are getting cold again.',
  },
  {
    speaker: 'youth',
    name: 'MS3 Fatbike Youth',
    description:
      'Cocky Amsterdam teenage boy of about sixteen, loud, brash and playful, quickly panicked when things go wrong. Native Dutch speaker with a neutral Amsterdam city accent. Close microphone.',
    previewText:
      'Oi! Kijk dan, kijk dan, mijn fiets is de snelste van de hele buurt. Niemand haalt mij in. Wacht, wat? Nee, nee, nee! Mama! Mama, kom me halen!',
  },
  {
    speaker: 'handhaver',
    name: 'MS3 Handhaver',
    description:
      'Officious Dutch city enforcement officer, a man in his forties, flat, bored, bureaucratic tone with clipped authoritative delivery. Native Dutch speaker with a neutral accent. Close microphone.',
    previewText:
      'Goedemiddag. U staat hier verkeerd geparkeerd. Dat is niet toegestaan. Nee, het maakt niet uit hoe lang. Regels zijn regels. Dat wordt een boete. Prettige dag nog.',
  },
  {
    speaker: 'tourist',
    name: 'MS3 Tourist',
    description:
      'Cheerful middle-aged tourist woman visiting from abroad, friendly and excitable, speaks English with a light Southern European accent, bright and bubbly. Close microphone.',
    previewText:
      'Oh, how beautiful! The canals, the little bridges, the bicycles everywhere! Everybody, come closer, closer, a little more. Say cheese! One more, one more, I closed my eyes!',
  },
  {
    // Phase 1 of the first-person boss (docs/design/fps.md §7, user lines 2026-10-16): the mech suit
    // with the user's face art speaks Dutch. A designed voice only; the robot filter is added later.
    speaker: 'mecha',
    name: 'MS3 Mecha Suit',
    description:
      'Stern Dutch man in his fifties, a strict old-school teacher type, deep commanding baritone with a booming, theatrical delivery that turns furious. Native Dutch speaker from the Netherlands with a neutral accent. Slow, heavy, clipped syllables, like a giant machine speaking. Studio quality, close microphone, no reverb; a robot filter is added later.',
    previewText:
      'Stilte! Iedereen gaat zitten en pakt het boek erbij. Wij beginnen bij hoofdstuk drie, en ik wil geen enkel woord meer horen. Wie zijn huiswerk niet heeft gemaakt, blijft vanmiddag na. Is dat duidelijk?',
    robot: true,
  },
  // --- First-person mode (docs/design/fps.md §9.3): designed voices only, never a clone, never a
  //     real person. German speakers; the lines are original (not the reference game's shouts).
  {
    speaker: 'guard',
    name: 'MS3 Depot Guard',
    description:
      'Young, nervous, slightly hoarse male soldier in his early twenties, a native German speaker from Germany. Jumpy and breathless, his voice goes a little too high when he shouts; comic and clumsy rather than menacing. An original cartoon character voice. Studio quality, close microphone, no reverb.',
    previewText:
      'Halt! Wer ist da? Hallo? Ach, nur der Wind. Ich hasse die Nachtschicht. Meine Brille ist beschlagen, der Kaffee ist kalt, und der Hauptmann schreit schon wieder. Wenn jemand fragt: hier ist alles ruhig!',
  },
  {
    speaker: 'officer',
    name: 'MS3 Depot Officer',
    description:
      'Older, pompous, self-important male officer in his fifties, a native German speaker from Germany. A nasal, haughty voice that puffs itself up and turns shrill when he is offended; comic and vain rather than menacing. An original cartoon character voice. Studio quality, close microphone, no reverb.',
    previewText:
      'Was ist das hier für eine Unordnung? Die Stiefel nicht geputzt, die Kisten nicht gezählt, und mein Hut ist schon wieder staubig! Ich verlange Ordnung, meine Herren, sofort! Und jemand bringt mir endlich einen frischen Kaffee.',
  },
  {
    speaker: 'ss',
    name: 'MS3 Elite Guard',
    description:
      'Flat, clipped, cold male voice in his thirties, a native German speaker from Germany. Emotionless and precise, short hard syllables, he speaks like a machine reading orders, with a dry deadpan that makes him a little funny. An original cartoon character voice. Studio quality, close microphone, no reverb.',
    previewText:
      'Bericht. Sektor vier ist gesichert. Tor zwei ist geschlossen. Die Lieferung kommt um sechs Uhr. Keine Fragen. Keine Pausen. Keine Ausnahmen. Wer seine Papiere verliert, füllt das Formular dreimal aus. Ende des Berichts.',
  },
  {
    // The final boss on foot (taunts 4-6, §7.4). A comic cartoon villain: never the cadence or
    // sound of any real person or recording. No filter: the suit's lines are the 'mecha' voice.
    speaker: 'mechahitler',
    name: 'MS3 Final Boss',
    description:
      'Whiny, sulky, theatrical male cartoon villain, a tenor voice that cracks into a squeaky falsetto when he gets upset, like a spoiled little emperor throwing a tantrum. Speaks German with an exaggerated, operatic, pouting delivery; comic rather than menacing. An original cartoon character voice. Studio quality, close microphone, no reverb.',
    previewText:
      'Nein, nein, nein! Das ist MEIN Spielzeug, und ich hatte es zuerst! Wer hat meine Kekse gegessen? Ich bin hier der Chef, ich, ich, ICH! Ich will einen neuen Anzug, einen größeren, mit mehr Knöpfen! Sofort, oder ich fange an zu weinen!',
  },
  // --- Mission oldenzaal (docs/design/oldenzaal.md §4.2, §6, §11): designed voices only, never a
  //     clone, never a real person. Meneer Wu's voice carries no accent other than a plain Dutch
  //     one and no stereotype (docs/ORIGINALITY.md, the oldenzaal exception); his joke is his
  //     work ethic. Mevrouw Winkel is fictional. The saint is kind and grateful.
  {
    speaker: 'wu',
    name: 'MS3 Snack Bar Owner',
    description:
      'Warm, brisk, slightly gruff middle-aged man, the hard-working owner of a busy corner snack bar. He talks while he works: quick, practical and plain-spoken, a little tired, kind underneath, with a dry sense of humour. A native speaker from the Netherlands who speaks plain, standard Dutch. An original character voice: never an imitation of a real person and never a caricature of any accent. Studio quality, close microphone, no reverb.',
    previewText:
      'Goedenavond! Kom binnen, kom binnen, en pas op de natte vloer. Twee patat, een met mayo, komt eraan. Nee, ik ga niet eerder dicht. De frituur is heet, de toonbank is schoon, en op de deur staat tien uur. Hier, eerst eten. Dan praten we.',
  },
  {
    speaker: 'winkel',
    name: 'MS3 Town Ghost',
    description:
      'An eerie, whispering middle-aged woman, a ghost from long ago: a soft, breathy, cold voice that lingers on the vowels, slow and calm, quietly menacing, with a hollow, distant quality. A native speaker from the Netherlands who speaks Dutch with a neutral accent. An original character voice, never an imitation of a real person. Studio quality, close microphone, no reverb.',
    previewText:
      'Zo. Jullie komen voor mijn stadje. Horen jullie de klokken? Ze luiden voor mij. De lampen gaan uit, een voor een, en de oude doden worden wakker. Blijf nog even, kleine vogeltjes. Niemand verlaat deze stad voordat ik het zeg.',
  },
  {
    speaker: 'plechelmus',
    name: 'MS3 Stone Saint',
    description:
      "A very deep, slow, stony rumble of an old man's voice, as if a stone statue speaks after a thousand years of silence: low, gravelly, calm and gentle, warm and grateful, with long pauses. A native speaker from the Netherlands who speaks Dutch. An original character voice, never an imitation of a real person. Studio quality, close microphone, no reverb.",
    previewText:
      'Dank u, kinderen. Lange tijd zat ik in de kou en het donker, en de vloek hield mij vast als ijzer. Nu is de steen weer warm. Ga in vrede, en zorg goed voor deze stad. Ik waak over het plein, voor jullie.',
  },
];

// ---------------------------------------------------------------------------------------------
// LINES
// ---------------------------------------------------------------------------------------------
// `text` is the game text, verbatim. `maxSeconds` comes from the bubble life in ticks / 60
// (tmp/audio/overview/sfx.md PART 2 C); announcer lines have no bubble, so theirs is a pacing
// target. Barks (short repeated reactions) get 3 takes, the rest 2. `lang` is the language whose
// pronunciation matters most: lines with Dutch words are 'nl' (Dutch speakers say "game over"
// and "mission one" the English way too).

/** A regular line (2 takes). */
function line(speaker: string, text: string, say: string, lang: LineSpec['lang'], group: Group, maxSeconds: number): LineSpec {
  return { speaker, text, say, lang, group, maxSeconds, takes: 2 };
}

/** A bark: a short reaction the game repeats (3 takes). */
function bark(speaker: string, text: string, say: string, lang: LineSpec['lang'], group: Group, maxSeconds: number): LineSpec {
  return { speaker, text, say, lang, group, maxSeconds, takes: 3 };
}

const A = 'announcer';

export const LINES: LineSpec[] = [
  // --- Announcer: start screens and the flow screens (boot) ----------------------------------
  line(A, 'GRACE!', '[proud, booming] Grace!', 'en', BOOT, 1.0),
  line(A, 'MITTENS!', '[proud, booming] Mittens!', 'en', BOOT, 1.0),
  line(A, 'PIP!', '[proud, booming] Pip!', 'en', BOOT, 1.0),
  line(A, 'GRAMPS!', '[proud, booming] Gramps!', 'en', BOOT, 1.0),
  // The squad's name callouts on REPORT FOR DUTY (the drill sergeant; the HeroDef `voice` texts).
  line('drill', 'VINCENT!', '[barked, gruff] Vincent!', 'en', BOOT, 1.0),
  line('drill', 'THOM!', '[barked, gruff] Thom!', 'en', BOOT, 1.0),
  line('drill', 'DIRK!', '[barked, gruff] Dirk!', 'en', BOOT, 1.0),
  line('drill', 'BOB!', '[barked, gruff] Bob!', 'en', BOOT, 1.0),
  line('drill', 'PATRICK!', '[barked, gruff] Patrick!', 'en', BOOT, 1.0),
  line(A, 'MISSION COMPLETE! BRAVO!', '[triumphant] Mission complete! [shouts] Bravo!', 'en', BOOT, 2.5),
  line(A, 'STANDING OVATION!', '[delighted, theatrical] Standing ovation!', 'en', BOOT, 1.8),
  line(A, 'ONE MORE TRY!', '[excited] One more try!', 'en', BOOT, 1.5),
  line(A, 'CONTINUE?', '[urgent, curious] Continue?', 'en', BOOT, 1.2),
  line(A, 'GAME OVER... UITGEZWAAND!', '[deflated] Game over... [dramatic sigh] uitgezwaand!', 'nl', BOOT, 3.0),
  line(A, "NEW HIGH SCORE! YOU'RE GREAT!", "[thrilled] New high score! [warmly] You're great!", 'en', BOOT, 2.5),

  // --- Announcer: mission ams ----------------------------------------------------------------
  line(A, 'MISSION ONE. VLIEG OP, ZWAAN!', '[booming, theatrical] Mission one. [shouts] Vlieg op, zwaan!', 'nl', AMS, 2.6),
  line(A, 'TIME UP!', '[stern] Time up!', 'en', AMS, 1.2),
  // Refills and weapon pickups (items/pickups.ts, weapons/stats.ts VOICE; user decision
  // 2026-10-14: plain English weapon names): the name, and the MORE line for the same weapon again.
  line(A, 'EXTRA BOMBS!', '[excited] Extra bombs!', 'en', AMS, 1.3),
  line(A, 'RELOAD!', '[crisp] Reload!', 'en', AMS, 1.0),
  line(A, 'HEAVY MACHINE GUN!', '[punchy] Heavy machine gun!', 'en', AMS, 1.8),
  line(A, 'MORE HEAVY MACHINE GUN!', '[punchy, grinning] More heavy machine gun!', 'en', AMS, 2.0),
  line(A, 'SHOTGUN!', '[punchy] Shotgun!', 'en', AMS, 1.3),
  line(A, 'MORE SHOTGUN!', '[punchy, grinning] More shotgun!', 'en', AMS, 1.6),
  line(A, 'ROCKET LAUNCHER!', '[punchy] Rocket launcher!', 'en', AMS, 1.5),
  line(A, 'MORE ROCKETS!', '[punchy, grinning] More rockets!', 'en', AMS, 1.5),
  line(A, 'FLAMETHROWER!', '[punchy] Flamethrower!', 'en', AMS, 1.5),
  line(A, 'MORE FLAMETHROWER!', '[punchy, grinning] More flamethrower!', 'en', AMS, 1.8),
  line(A, 'LASER GUN!', '[punchy] Laser gun!', 'en', AMS, 1.4),
  line(A, 'MORE LASER GUN!', '[punchy, grinning] More laser gun!', 'en', AMS, 1.7),
  line(A, 'ENEMY CHASER!', '[punchy] Enemy chaser!', 'en', AMS, 1.5),
  line(A, 'MORE ENEMY CHASER!', '[punchy, grinning] More enemy chaser!', 'en', AMS, 1.8),
  line(A, 'TUBA!', '[punchy] Tuba!', 'en', AMS, 1.0),
  line(A, 'MORE TUBA!', '[punchy, grinning] More tuba!', 'en', AMS, 1.3),
  line(A, 'BOUNCE MINES!', '[punchy] Bounce mines!', 'en', AMS, 1.5),
  line(A, 'MORE BOUNCE MINES!', '[punchy, grinning] More bounce mines!', 'en', AMS, 1.8),

  // --- Brigadier Gusto on the mission intro card (ui/cards.ts; the card plays before the
  //     mission loads its group, so 'boot'). Both lines together must fit about 5.5 s.
  line('gusto', 'SHORE LEAVE IN AMSTERDAM. THE CYGNETS WANT FRIES.', '[brisk, upbeat] Shore leave in Amsterdam. The cygnets want fries.', 'en', BOOT, 3.0),
  line('gusto', 'THE BEST FRY SHOP IN TOWN NEEDS HELP. GO!', '[brisk, commanding] The best fry shop in town needs help. [shouts] Go!', 'en', BOOT, 2.5),

  // --- The baker's briefing at FABEL FRIET (section-a.ts BRIEFING; hint bubbles, 150 ticks).
  //     Bubbles 3+4 and 6+7 are one thought split over two bubbles: each bubble is its own clip,
  //     and `say` makes the pair flow (the first trails off, the second picks it up).
  line('baker', 'HOI! WELKOM BIJ\nFABEL FRIET!', '[warm, cheerful] Hoi! Welkom bij Fabel Friet!', 'nl', AMS, 2.5),
  line('baker', 'SLECHT NIEUWS, WIJ\nMOETEN MOGELIJK SLUITEN.', '[worried sigh] Slecht nieuws... wij moeten mogelijk sluiten.', 'nl', AMS, 2.5),
  line('baker', 'BURGEMEESTER HALSEMA\nWIL ONS VOOR ALTIJD...', '[upset, building up] Burgemeester Halsema wil ons voor altijd...', 'nl', AMS, 2.5),
  line('baker', '...WEG HEBBEN!', '[indignant, finishing the sentence] ...weg hebben!', 'nl', AMS, 2.5),
  line('baker', 'MAAR DE BUREN ZIJN\nBLIJ MET ONS...', '[softer, touched] Maar de buren zijn blij met ons...', 'nl', AMS, 2.5),
  line('baker', 'ZE IS BIJ DE STOPERA\nTE VINDEN.', '[urgent, leaning in] Ze is bij de Stopera te vinden.', 'nl', AMS, 2.5),
  line('baker', 'ALSJEBLIEFT,\nSTOP HAAR!', '[pleading] Alsjeblieft... stop haar!', 'nl', AMS, 2.5),
  line('baker', 'HIER, NEEM EEN\nLEKKER FRIETJE.', '[warm, generous] Hier, neem een lekker frietje.', 'nl', AMS, 2.5),
  // Finale (section-d.ts), with the applause.
  line('baker', 'FABEL FRIET\nBLIJFT OPEN!', '[jubilant, shouts] Fabel Friet blijft open!', 'nl', AMS, 2.8),
  bark('staff2', 'LEKKER!', '[cheering] Lekker!', 'nl', AMS, 1.1),
  bark('staff1', 'DANKJEWEL!', '[cheering, grateful] Dankjewel!', 'nl', AMS, 1.8),

  // --- Hot-dog vendor (entities.ts; gag bubbles, 100 ticks): on foot / on a Swan.
  line('vendor', 'HALLO DAAR!', '[hearty, friendly] Hallo daar!', 'nl', AMS, 1.6),
  line('vendor', 'HEB JIJ NOG NEPNAGELS\nVOOR MIJ?', '[hearty, curious] Heb jij nog nepnagels voor mij?', 'nl', AMS, 1.6),

  // --- Gramps on the radio (swan.ts; HOLD JUMP IN THE AIR. is m1-c's glide lesson: ams-b has no
  //     Swan lines since the user's requests of 2026-10-22). The "GRAMPS: " prefix is the
  //     bubble's speaker tag: voiceKey strips it, and the actor does not read it.
  line('gramps', 'HOLD JUMP IN THE AIR.', '[instructing, patient] Hold jump in the air.', 'en', AMS, 1.8),
  line('gramps', "SHE DOES THAT WHEN\nSHE'S NERVOUS.", "[embarrassed, fond] She does that when she's nervous.", 'en', AMS, 2.5),
  line('gramps', "GRAMPS: SHE'LL BE BACK\nIN SPRING.", "[wistful, gentle] She'll be back in spring.", 'en', AMS, 2.5),

  // --- Locals (gag bubbles). Attack tells must be over before the attack lands.
  bark('rider', 'TRING TRING!', '[hurried, sing-song] Tring tring!', 'nl', AMS, 0.5),
  bark('rider', 'SORRY, LATE ORDER!', '[breathless, apologetic] Sorry, late order!', 'en', AMS, 1.2),
  bark('youth', 'OI!', '[cocky shout] Oi!', 'nl', AMS, 0.55),
  bark('youth', 'MAMA!', '[panicked yell] Mama!', 'nl', AMS, 0.7),
  bark('handhaver', 'BOETE!', '[flat, officious] Boete!', 'nl', AMS, 0.5),

  // --- Tourist hostage (gagged, then freed).
  // 'MMF?!' (items/binds.ts, a blast near a sacked hostage) has the same voiceKey ('mmf'), so it
  // plays these takes too: 4 takes, budget of the shorter bubble (30 ticks).
  { ...bark('tourist', 'MMF!', '[muffled through a gag, alarmed] Mmf!', 'en', AMS, 0.5), takes: 4 },
  bark('tourist', 'SAY CHEESE!', '[bubbly, excited] Say cheese!', 'en', AMS, 0.6),

  // --- First-person boss, phase 1: the mech suit (docs/design/fps.md §7.4, the user's lines).
  { ...line('mecha', 'IK BEN MECHA HOFMANS!', '[angry, booming] Ik ben... MECHA HOFMANS!', 'nl', FPS, 3), takes: 3 },
  { ...line('mecha', 'HET MUSJE, HET PRACHTIGE MUSJE...\nRED MIJ!', '[angry, anguished] Het musje... het prachtige musje... [shouting] RED MIJ!', 'nl', FPS, 4.5), takes: 3 },
  { ...line('mecha', 'PYRAMUS EN THISBE...\nLET OP DE ACCUSATIVUS!', '[angry, stern] Pyramus en Thisbe... [shouting] let op de ACCUSATIVUS!', 'nl', FPS, 4.5), takes: 3 },

  // --- First-person mode (docs/design/fps.md §9.3): original German shouts. `text` is the string
  //     src/game/content/fps/lines.ts passes to audio.say (voiceKey folds the umlauts). No bubble
  //     limits these: `maxSeconds` is a pacing target (alerts short, death lines longer; the taunt
  //     subtitle stays for the clip length + 30 ticks, §7.4).
  bark('guard', 'DA DRÜBEN!', '[alarmed, shouting] Da drüben!', 'de', FPS, 1.2),
  bark('guard', 'EINDRINGLING!', '[panicked shout] Eindringling!', 'de', FPS, 1.3),
  bark('guard', 'MEINE BRILLE...!', '[pained, dismayed] Meine Brille...!', 'de', FPS, 1.8),
  bark('guard', 'NICHT SCHON WIEDER...', '[groaning, defeated] Nicht schon wieder...', 'de', FPS, 2.5),
  bark('officer', 'ALLE MANN AUF POSTEN!', '[pompous, bellowing] Alle Mann auf Posten!', 'de', FPS, 2.5),
  bark('officer', 'MEIN SCHÖNER HUT...!', '[wailing, offended] Mein schöner Hut...!', 'de', FPS, 2.5),
  bark('ss', 'FEUER FREI!', '[cold, clipped] Feuer frei!', 'de', FPS, 1.0),
  bark('ss', 'DAS STEHT NICHT IM HANDBUCH...!', '[flat, baffled] Das steht nicht im Handbuch...!', 'de', FPS, 2.5),
  // MechaHitler on foot (§7.4 taunts 4-6): spoken German, English subtitle; `text` is the German line.
  { ...line('mechahitler', 'MEIN SCHÖNER ANZUG! DAS ZAHLT IHR MIR!', '[wailing] Mein schöner Anzug! [voice cracking into falsetto, tantrum] Das zahlt ihr mir!', 'de', FPS, 5), takes: 3 },
  { ...line('mechahitler', 'DAS IST NICHT FAIR! ICH HATTE VORTRITT!', '[sulky, whining] Das ist nicht fair! [squeaky, stamping his foot] Ich hatte Vortritt!', 'de', FPS, 5), takes: 3 },
  { ...line('mechahitler', 'DAS... STAND NICHT... IM PLAN...', '[weak, gasping, overly dramatic] Das... stand nicht... im Plan...', 'de', FPS, 5), takes: 3 },
  // --- Mission oldenzaal (missions/oldenzaal/lines.ts `voicedLines()`, index.ts `announce`;
  //     group 'mission:oldenzaal'). Bubbles are ≤ 24 characters × 2 lines; `maxSeconds` follows
  //     the ams briefing's bubble life (150 ticks) for Wu's scene. Revision 3 (the user,
  //     2026-10-21): every line of this mission is Dutch ('nl'). Meneer Wu speaks plain, correct
  //     Dutch (no accent play, no broken language).
  line(A, 'MISSIE VIER. BLIJF BIJ ELKAAR, ZWAANTJES!', '[booming, theatrical] Missie vier. [ominous, lower] Blijf bij elkaar, zwaantjes!', 'nl', OZ, 3.5),
  // The pickup callout of the meal (lines.ts SNACK_POWER_CALLOUT): the announcer says it like a weapon
  // name when the meal is caught (`audio.voice(SNACK_POWER_CALLOUT)`, requested from WUGHOST / INTEGRATE).
  line(A, 'SNACKKRACHT!', '[excited, punchy, in Dutch, with a guttural Dutch g sound] Snack-kracht!', 'nl', OZ, 2.3),
  line('wu', 'HE! HIER BINNEN!', '[calling out, urgent] Hé! Hier binnen!', 'nl', OZ, 1.5),
  line('wu', 'GOEDENAVOND! GAUW\nBINNEN. PAS OP DE VLOER.', '[brisk, warm] Goedenavond! Gauw binnen. [busy] Pas op de vloer.', 'nl', OZ, 2.5),
  line('wu', 'MEVROUW WINKEL IS TERUG.\nHAAR GEEST, BEDOEL IK.', '[lowering his voice] Mevrouw Winkel is terug. [dry] Haar geest, bedoel ik.', 'nl', OZ, 2.5),
  line('wu', 'SINDSDIEN STAAN DE\nDODE SOLDATEN OP.', '[serious, quiet] Sindsdien staan de dode soldaten op.', 'nl', OZ, 2.5),
  line('wu', 'DE STAD IS LEEG. IK\nBLIJF: HET VET IS HEET.', '[gruff, proud] De stad is leeg. Ik blijf: [dry, busy] het vet is heet.', 'nl', OZ, 2.5),
  line('wu', 'DICHT? NEE. IK SLUIT\nPAS OM TIEN UUR.', '[indignant, proud] Dicht? Nee. Ik sluit pas om tien uur.', 'nl', OZ, 2.5),
  line('wu', 'HIER. EERST ETEN.\nDAN MIJN STAD REDDEN.', '[warm, firm] Hier. Eerst eten. [brisk] Dan mijn stad redden.', 'nl', OZ, 2.5),
  // Mevrouw Winkel's one scene (oz-c, the wake; lines.ts WINKEL_LINES) and her flight at the end.
  line('winkel', 'ZO. JULLIE KOMEN VOOR\nMIJN STADJE.', '[eerie whisper, slow, amused] Zo. Jullie komen voor mijn stadje.', 'nl', OZ, 2.5),
  line('winkel', 'MIJN DODEN ZIJN MOE.\nLAAT DE STEEN LOPEN.', '[cold whisper, turning away] Mijn doden zijn moe. [slow, commanding] Laat de steen lopen.', 'nl', OZ, 2.5),
  line('winkel', 'STA OP, OUDE STEEN.', '[cold, commanding whisper] Sta op, oude steen.', 'nl', OZ, 2.0),
  line('winkel', 'DIT IS NOG NIET\nVOORBIJ...', '[hissing, retreating] Dit is nog niet voorbij...', 'nl', OZ, 2.2),
  // St. Plechelmus (lines.ts PLECHELMUS_LINES): a victim of the curse; he groans, then thanks them.
  { ...line('plechelmus', 'ZO... ZWAAR...', '[deep stony rumble, strained, slow] Zo... zwaar...', 'nl', OZ, 2.5), takes: 3 },
  { ...line('plechelmus', 'VERGEEF MIJ...', '[deep stony rumble, sorrowful, slow] Vergeef mij...', 'nl', OZ, 2.5), takes: 3 },
  { ...line('plechelmus', 'DANK U, KINDEREN.', '[deep, slow, gentle] Dank u... kinderen.', 'nl', OZ, 3.0), takes: 3 },
];
