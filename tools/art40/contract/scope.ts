/**
 * The in-scope characters of mission ams (docs/design/ams40.md "Scope") and, per character, the
 * contract a script cannot read from the sprite registry: which code reads which frames, points
 * and times, the speeds, the hitboxes, the variants, the scenery fit points and what a
 * replacement must keep. Read from the code on 2026-11-03 (wave 0); every code reference is a
 * file plus a text to find in it, so extract.ts resolves the line number on each run and flags a
 * reference that no longer matches ("stale").
 */
import type { Kind } from './classes';

/** A code reference: `find` is a literal text of one line in `file` (the first match wins). */
export interface Ref {
  readonly file: string;
  readonly find: string;
}

/** Which ids a character owns: a prefix (every id starting with it) or one exact id. */
export type Matcher = { readonly prefix: string } | { readonly exact: string };

export type RuleKind =
  | 'frame' // code reads a frame index / role / count
  | 'point' // code reads a named point
  | 'time' // logic time in ticks (lengths, events, holds)
  | 'speed' // entity speed for the foot-slide gate (px per tick)
  | 'variant' // how skins / looks / P2 are made
  | 'hitbox' // gameplay boxes (D7: they stay)
  | 'fit' // scenery fit point (rule 10)
  | 'shared'; // the id is read by another character or mission

export interface Rule {
  readonly kind: RuleKind;
  /** The strip name(s) the rule is about ('*' = every strip of the character). */
  readonly strips: readonly string[];
  readonly text: string;
  readonly at?: Ref;
}

export interface CharacterScope {
  /** Stable key (contract.json `characters[].key`). */
  readonly key: string;
  readonly name: string;
  /** Wave of the plan (1–7). */
  readonly wave: number;
  readonly kind: Kind;
  /** In-scope ids. */
  readonly ids: readonly Matcher[];
  /** Ids registered next to the in-scope ones but out of scope (with the reason). */
  readonly related?: readonly { readonly match: Matcher; readonly why: string }[];
  /** Strip names that are out of scope although they sit under an in-scope prefix. */
  readonly skipStrips?: readonly { readonly strip: string; readonly why: string }[];
  /** Variant sets: the set prefix and how it differs (skin palette, look parts, P2). */
  readonly sets: readonly { readonly prefix: string; readonly variant: string }[];
  /** Behaviour files (readers) for the automatic mention scan. */
  readonly readers: readonly string[];
  /** Words the test scan looks for (besides the set prefixes). */
  readonly testWords: readonly string[];
  readonly rules: readonly Rule[];
  /** What the replacement must keep (short list, contract.md). */
  readonly keep: readonly string[];
}

const HH = 'src/game/content/locals/handhaver.ts';
const HHA = 'src/game/content/locals/handhaver.art.ts';
const EN = 'src/game/enemy.ts';
const CC = 'src/game/content/creatures/common.ts';
const PL = 'src/game/player/player.ts';
const ST = 'src/game/content/stag/partier.ts';
const STA = 'src/game/content/stag/art.ts';
const BB = 'src/game/content/stag/beer-bike.ts';
const BBV = 'src/game/content/vehicles/beer-bike/bike.ts';
const BBG = 'src/game/content/vehicles/beer-bike/geometry.ts';
const HO = 'src/game/hostage.ts';
const HOK = 'src/game/content/items/hostages.ts';
const HOA = 'src/game/content/items/hostage.art.ts';
const BI = 'src/game/content/items/binds.ts';
const RI = 'src/game/content/locals/rider.ts';
const RIA = 'src/game/content/locals/rider.art.ts';
const DR = 'src/game/content/locals/delivery-rider.ts';
const FB = 'src/game/content/locals/fatbike-youth.ts';
const SG = 'src/game/content/locals/seagull.ts';
const SGA = 'src/game/content/locals/seagull.art.ts';
const AMB = 'src/game/content/missions/ams/ambient.ts';
const ENT = 'src/game/content/missions/ams/entities.ts';
const NPA = 'src/game/content/missions/ams/npc.art.ts';
const SCC = 'src/game/content/bosses/ams-scan/car.ts';
const SCD = 'src/game/content/bosses/ams-scan/adds.ts';
const SCG = 'src/game/content/bosses/ams-scan/geometry.ts';
const MY = 'src/game/content/bosses/ams/mayor.ts';
const MYL = 'src/game/content/bosses/ams/layout.ts';
const MYG = 'src/game/content/bosses/ams/geometry.ts';
const SW = 'src/game/content/vehicles/swan/swan.ts';
const SWC = 'src/game/content/vehicles/swan/constants.ts';
const SWD = 'src/game/content/vehicles/swan/draw.ts';
const AMSI = 'src/game/content/missions/ams/index.ts';
const AMSH = 'src/game/content/missions/ams/helpers.ts';
const TU = 'src/game/tuning.ts';

/** Rules every Enemy-based character shares (enemy.ts): strip names by reaction and death kind. */
const ENEMY_BASE: readonly Rule[] = [
  {
    kind: 'frame',
    strips: ['die', 'die-knife', 'die-blast', 'die-burn', 'die-crush'],
    text: 'Death strip by damage kind (knife, explosion, fire, crush, else die; missing → die). Played once; the corpse timer starts when the strip is done, so its total ticks set how long the body lies (cosmetic, but sims see removal ticks).',
    at: { file: EN, find: 'deathAnim(kind: DamageKind): string | null {' },
  },
  {
    kind: 'frame',
    strips: ['photo-pose', 'gloat', 'cower'],
    text: 'Reaction strips by name (photo → photo-pose, gloat, cower → cower, else panic, else idle). Every enemy answers photo, gloat and cower.',
    at: { file: EN, find: "photo: 'photo-pose'," },
  },
  {
    kind: 'time',
    strips: ['die-blast'],
    text: 'A blast death launches the body (vx ±1.5, vy −3.0) while the strip plays: the strip must read as airborne for its first frames.',
    at: { file: EN, find: '// GDD §9.0: launched in an arc (vx ±1.5, vy −3.0).' },
  },
];

const TURNER: Rule = {
  kind: 'frame',
  strips: ['turn'],
  text: 'The Turner draws `turn` frames 0,1 narrowing, flips, then 1,0 widening (2 widths × 2 ticks = 8 ticks): the strip must keep exactly 2 frames (Turner widths = 2) or the Turner call changes with it.',
  at: { file: CC, find: 'export class Turner {' },
};

export const SCOPE: readonly CharacterScope[] = [
  // ------------------------------------------------------------------------------------ wave 1
  {
    key: 'handhaver',
    name: 'handhaver (city enforcement officer) and the BOETE ticket',
    wave: 1,
    kind: 'person',
    ids: [{ prefix: 'enemy/handhaver/' }, { prefix: 'enemy/handhaver-b/' }, { prefix: 'enemy/handhaver-c/' }, { prefix: 'enemy/boete-ticket/' }],
    sets: [
      { prefix: 'enemy/handhaver/', variant: 'skin a (base)' },
      { prefix: 'enemy/handhaver-b/', variant: 'skin b: a second HumanStyle (skinB, hairA) rendered separately, not a runtime recolour' },
      { prefix: 'enemy/handhaver-c/', variant: 'skin c: a third HumanStyle (skinC, hairA, hairStyle curly: a PART change, not only palette)' },
      { prefix: 'enemy/boete-ticket/', variant: 'the thrown ticket (prop, centre anchor)' },
    ],
    readers: [HH, HHA, SCC, SCG, MY, 'src/game/content/missions/ams/section-d.ts', 'src/game/content/ring/crew/art-people.ts', 'src/game/budget/pay.ts'],
    testWords: ['handhaver', 'boete-ticket'],
    rules: [
      ...ENEMY_BASE,
      TURNER,
      { kind: 'variant', strips: ['*'], text: 'Skin picked at spawn: param skin a|b|c, else rng 0..2; a → enemy/handhaver, b/c → enemy/handhaver-<skin>.', at: { file: HH, find: "art: skin === 'a' ? 'enemy/handhaver'" } },
      { kind: 'hitbox', strips: ['*'], text: 'Body 14 × 30 (Enemy opts w 14, h 30); hp 20, score 300.', at: { file: HH, find: "art: skin === 'a' ? 'enemy/handhaver'" } },
      { kind: 'speed', strips: ['walk'], text: 'Walks at 0.6 px/tick; the walk strip plays 8 frames × 6 ticks (HANDHAVER_WALK_TPF) = 48 ticks per cycle at the nominal speed → 28.8 px per cycle (two steps of 14.4 px). The Animator rate is strideRate(vx, 0.6) (clamped 0.5–1.6).', at: { file: HH, find: 'this.anim.tick += strideRate(this.vx, HANDHAVER.walk) - 1;' } },
      { kind: 'time', strips: ['tell'], text: 'Tell: durations [8, 8, 9999] (the last frame held); the telegraph lasts tele 24 ticks (difficulty-scaled) before the ticket leaves.', at: { file: HHA, find: "defHi(pre + 'tell'" } },
      { kind: 'frame', strips: ['throw'], text: 'Throw: the ticket spawns on the tick the throw strip starts (frame 0 = the flick in the code); throw mode lasts throwTicks 8, then recover 40 ticks, where the throw strip finishes (HANDHAVER_THROW_TIMING [3,5,4,4,4] = 20 ticks) and idle plays.', at: { file: HH, find: "this.play('throw', { restart: true });" } },
      { kind: 'point', strips: ['throw', 'tell'], text: 'The ticket leaves from x + facing × 10, y − chestY 25 (code numbers, no frame point); handInView tests x + facing × 8. The hand in the art should meet that place on the release frame.', at: { file: HH, find: 'private handInView(): boolean {' } },
      { kind: 'frame', strips: ['gloat'], text: 'GLOAT_FRAME = { write 0, write2 1, tear 2, drop 3, done 4 }: the game sets anim.index per phase (write 48 ticks alternating 0/1 every 8, tear 12, drop 14, then done). The strip needs ≥ 5 frames with these roles or the constant moves with it (rule 4: exported names).', at: { file: HH, find: 'export const GLOAT_FRAME = { write: 0, write2: 1, tear: 2, drop: 3, done: 4 } as const;' } },
      { kind: 'point', strips: ['gloat'], text: 'The torn page drops from x + facing × 9, y − 32 (code numbers): the raised hand of the drop frame should be there.', at: { file: HH, find: 'this.world.add(new GloatPage(this.world, this.x + this.facing * 9, this.y - 32, tx));' } },
      { kind: 'frame', strips: ['cower'], text: 'Cower loops at HANDHAVER_COWER_TPF 3 (deferred strip).', at: { file: HHA, find: 'export const HANDHAVER_COWER_TPF = 3;' } },
      { kind: 'shared', strips: ['walk'], text: 'The scan car boss draws its fleeing driver with enemy/handhaver/walk: frame = floor(tick / 3) % frameCount (driverFrames read once from getFrames(ID.driverRun).length). A new count works; a slower look needs the 3-tick step changed.', at: { file: SCG, find: "driverRun: 'enemy/handhaver/walk'," } },
      { kind: 'shared', strips: ['*'], text: 'Spawned by the mayor boss (adds every 420 ticks); the ring crew (dormant) reuses HANDHAVER_STYLE: shared ids change everywhere (intended, plan "Scope").', at: { file: MY, find: "w.spawn('handhaver', x, this.floorY, { enter, tags: [ADD_TAG, OFFICER_TAG] });" } },
      { kind: 'shared', strips: ['fly'], text: 'enemy/boete-ticket/fly: the thrown ticket (8 × 5 box, ticksPerFrame 4, look anim) and the death tumble (3 tickets); also the budget fines (src/game/budget/pay.ts).', at: { file: HH, find: "o.sprite = 'enemy/boete-ticket/fly';" } },
      { kind: 'fit', strips: ['*'], text: 'ams-d: prewarmed with the mayor arena (section-d.ts prewarm).', at: { file: 'src/game/content/missions/ams/section-d.ts', find: "prewarm('boss/ams-mayor/', 'enemy/handhaver/', 'enemy/boete-ticket/');" } },
    ],
    keep: [
      'ids enemy/handhaver[-b|-c]/<strip> and enemy/boete-ticket/fly',
      'turn = 2 frames (Turner widths 2, 2 ticks each)',
      'gloat ≥ 5 frames with the GLOAT_FRAME roles (or export the new indices)',
      'throw: release on frame 0 (ticket spawns at strip start); throw+recover logic 8 + 40 ticks',
      'walk: 28.8 px per cycle at 0.6 px/tick (or a new tpf that keeps the stride on the floor)',
      'points hand, head, hip on every frame; the release hand near (10, −25)',
      'skin c keeps curly hair (a part, not only palette)',
    ],
  },
  // ------------------------------------------------------------------------------------ wave 2
  ...(['vincent', 'thom', 'dirk', 'bob', 'patrick'] as const).map((hero): CharacterScope => ({
    key: `hero-${hero}`,
    name: `hero ${hero.toUpperCase()}`,
    wave: 2,
    kind: 'hero',
    ids: [{ prefix: `char/${hero}/` }],
    related: hero === 'vincent' ? [{ match: { prefix: 'char/vincent-' }, why: 'the stored style trials (char/vincent-<style>): out of scope (plan "Out of scope")' }] : undefined,
    skipStrips: [
      { strip: 'portrait', why: 'UI (select panel portrait): out of scope' },
      { strip: 'select', why: 'UI (select panel): out of scope' },
      { strip: 'select-grey', why: 'UI (select panel): out of scope' },
    ],
    sets: [
      { prefix: `char/${hero}/`, variant: 'one set per hero; P1/P2 use the same art; the helium-* and helium-wob-* strips are the Helium Head status twins (status art "helium"), made from the same rig' },
    ],
    readers: [PL, 'src/game/player/status.ts', 'src/game/player/intro-drop.ts', SW],
    testWords: [`char/${hero}`],
    rules: [
      { kind: 'frame', strips: ['torso-pistol-run', 'torso-heavy-run', 'legs-run'], text: 'The run torso is drawn at legs.index % torso frame count: the torso run count must equal (or divide) the legs run count (12 today).', at: { file: PL, find: "const tIdx = this.torso.id === this.torsoId('run')" } },
      { kind: 'time', strips: ['legs-run'], text: 'Legs run plays looping(TUNING.player.runTicksPerFrame 3) at rate strideRate(vx, runSpeed 1.5): 12 frames × 3 ticks = 36 ticks per cycle → 54 px per cycle at 1.5 px/tick. NOTE: Animator durations win over ticksPerFrame, so the run strip must have no `durations` or the 3-tick override is ignored.', at: { file: PL, find: "else if (legs === 'run') this.legs.play(id, looping(TUNING.player.runTicksPerFrame));" } },
      { kind: 'speed', strips: ['legs-run'], text: 'Run 1.5 px/tick (TUNING.player.runSpeed); crouch walk 0.75 px/tick (crawlSpeed) with legs-crouch-walk at strideRate(vx, 0.75).', at: { file: TU, find: 'runSpeed: 1.5,' } },
      { kind: 'time', strips: ['torso-pistol-knife', 'torso-heavy-knife', 'torso-pistol-knife-b', 'torso-heavy-knife-b', 'torso-pistol-crouch-knife', 'torso-heavy-crouch-knife'], text: 'Knife: the action lasts knifeTicks 14; the code passes ticksPerFrame = floor(14 / frameCount), but the strip’s own `durations` win in the Animator: today [2, 2, 2, 3, 3, 2] = 14 ticks. Keep the total at 14 (alternates knife / knife-b).', at: { file: PL, find: 'this.torso.play(id, once(true, Math.max(1, Math.floor(TUNING.fire.knifeTicks / Math.max(1, frameCount(id))))));' } },
      { kind: 'frame', strips: ['torso-pistol-throw', 'torso-heavy-throw', 'torso-pistol-crouch-throw', 'torso-heavy-crouch-throw'], text: 'Throw: the RELEASE frame is found by data: the frame whose `hand` point has the largest x − y (releaseFrame; frame 2 today, hand (9, −15) from the hip). The torso starts AT the release frame (the bomb leaves at once; the wind-up frames before it are never shown in play). The code passes tpf = floor(throwTicks 12 / (n − release)) but the strip durations win: today [5, 4, 3, 3, 3, 5], 14 ticks from the release, the action 12.', at: { file: PL, find: 'function releaseFrame(id: string): ReleaseFrame {' } },
      { kind: 'point', strips: ['torso-pistol-throw', 'torso-heavy-throw'], text: 'PHYSICS: the grenade leaves from hip + the release frame `hand` of the STANDING throw strip (handWorld): moving that hand moves every bomb (sims change).', at: { file: PL, find: "const r = releaseFrame(this.torsoId('throw'));" } },
      { kind: 'point', strips: ['torso-pistol-shoot', 'torso-pistol-shoot-up', 'torso-pistol-shoot-down', 'torso-pistol-shoot-diag-up', 'torso-heavy-shoot', 'torso-heavy-shoot-up', 'torso-heavy-shoot-down', 'torso-heavy-shoot-diag-up', 'torso-heavy-shoot-diag-down'], text: 'PHYSICS: bullets leave from hip + frame 0 `muzzle` of the aim strip (shoot, shoot-up, shoot-down, shoot-diag-*); fallback muzzles in TUNING when missing. Frame 0 of every shoot strip must carry the muzzle at the barrel tip.', at: { file: PL, find: 'const f = getFrame(this.torsoId(this.aimAction(true)), 0);' } },
      { kind: 'point', strips: ['legs-idle', 'legs-run', 'legs-jump', 'legs-fall', 'legs-land', 'legs-crouch', 'legs-crouch-walk', 'legs-dangle', 'legs-crouch-in', 'legs-crouch-out'], text: 'PHYSICS: the torso joins at the legs frame `hip` (also the muzzle / hand base). Every legs frame needs `hip`.', at: { file: PL, find: "const p = this.legs.id ? framePoint(getFrame(this.legs.id, this.legs.index), 'hip', flip, false, out) : undefined;" } },
      { kind: 'frame', strips: ['legs-crouch-in', 'legs-crouch-out'], text: 'Crouch transitions are draw-only: onceFrame(tr, stripTicks(tr) − crouchT) and the torso sits on that frame’s hip.', at: { file: PL, find: 'legsIdx = onceFrame(tr, stripTicks(tr) - this.crouchT);' } },
      { kind: 'frame', strips: ['ride-sit', 'ride-lean', 'ride-up', 'ride-hunch', 'ride-hold', 'ride-brace', 'ride-duck', 'ride-ears', 'ride-cheer'], text: 'Swan rider poses: drawn with their hip on the Swan `seat` point; frame = the Swan’s pick (run 0/1, glide/squat/flap f & 1, paddle-up) or stripFrame on world.tick. Missing → ride-sit → mount frame 1 at +17 px. 2-frame poses are read as 0/1 by the Swan (pickRiderFrame).', at: { file: SW, find: 'private pickRiderFrame(): number {' } },
      { kind: 'point', strips: ['mount-hop'], text: 'Mount hop: the LAST frame’s `hip` lands on the Swan seat; total time = stripTicks (draw only).', at: { file: PL, find: "const hip = framePoint(getFrame(id, n - 1), 'hip', flipX, false, pt);" } },
      { kind: 'frame', strips: ['mount'], text: 'Seated in vehicles: mount frame floor(tick / 16) (drawSeated); mount frame 1 is the ride fallback with its hip at (0, −17) (MOUNT_HIP_DROP).', at: { file: PL, find: 'r.sprite(this.alt(this.fullIds.mount), Math.floor(this.world.tick / 16), Math.round(x), Math.round(y), drawOpts);' } },
      { kind: 'point', strips: ['mount', 'legs-idle', 'legs-run'], text: 'Other scenes read hero points: the ending hangs heroes by mount frame 0 `hand` and marches them on legs-run `hip`; the character select joins the torso on legs-idle frame 0 `hip`.', at: { file: 'src/game/scenes/ending.ts', find: 'const hand = f.pts?.hand ?? [0, -28];' } },
      { kind: 'point', strips: ['timeout-sleep'], text: 'The snore fx sits at the full frame’s `head` point.', at: { file: PL, find: "const head = framePoint(getFrame(this.full.id, this.full.index), 'head', drawOpts.flipX, false, headPt);" } },
      { kind: 'variant', strips: ['helium-*', 'helium-wob-*'], text: 'Status art: `<art>/helium-<strip>` replaces the strip while Helium Head is on (when registered). Today the helium shoot strips have 2 frames, knife 6, throw 6, idle 4 (same roles as the base strips).', at: { file: 'src/game/player/status.ts', find: '`char/grace/helium-legs-run`) wherever such a strip is registered, else the normal one.' } },
      { kind: 'hitbox', strips: ['*'], text: 'Hitbox 14 × 30 standing, 16 × 20 crouching (TUNING.player bodyW/H, crouchBodyW/H): unchanged (D7).', at: { file: PL, find: 'this.hitbox = { x: -TUNING.player.bodyW / 2, y: -TUNING.player.bodyH, w: TUNING.player.bodyW, h: TUNING.player.bodyH };' } },
      { kind: 'shared', strips: ['*'], text: 'The heroes play in every mission (oldenzaal, sewers, ring, rally select): shared ids change everywhere.', at: { file: PL, find: 'const FULL = [' } },
    ],
    keep: [
      'all 121 ids per hero (portrait / select / select-grey stay as they are: UI)',
      'legs-run and torso-*-run: same count (torso index = legs index % torso count)',
      'run: the code plays it at TUNING runTicksPerFrame (3); a baked strip always carries durations, which win, so keep the cycle at 36 ticks (logicTicks) at 1.5 px/tick → 54 px per cycle, and the planted foot within 1 px (the foot gate)',
      'knife strips: 14 ticks in all (knifeTicks)',
      'throw: a clear release frame (max hand x − y; frames before it are not shown in play) and about 12–14 ticks from it',
      'shoot strips: frame 0 carries `muzzle`; every legs frame carries `hip`',
      'mount-hop last frame hip; ride-* 2-frame poses (0/1 picked by the Swan)',
      'helium-* twins for every base strip that has one today',
    ],
  })),
  // ------------------------------------------------------------------------------------ wave 3
  {
    key: 'stag-partier',
    name: 'stag partier (looks 0 and 2) and the groom',
    wave: 3,
    kind: 'person',
    ids: [{ prefix: 'enemy/stag-partier/' }, { prefix: 'enemy/stag-partier-2/' }, { prefix: 'enemy/stag-groom/' }],
    related: [
      { match: { prefix: 'enemy/stag-partier-1/' }, why: 'look 1: registered, never spawned by ams (STAG_LOOKS = [0, 2]); out of scope, keep the id while code may spawn it (look param 0–3, rng when absent)' },
      { match: { prefix: 'enemy/stag-partier-3/' }, why: 'look 3: registered, never spawned by ams (STAG_LOOKS = [0, 2]); out of scope, keep the id while code may spawn it' },
    ],
    sets: [
      { prefix: 'enemy/stag-partier/', variant: 'look 0 (sunburnt, heavy build); also holds the selfie flash' },
      { prefix: 'enemy/stag-partier-2/', variant: 'look 2 (curly hair, beard, stocky): a separate rendered style (parts + palette)' },
      { prefix: 'enemy/stag-groom/', variant: 'the groom: look with L-plate, veil, shirt bundle (parts); also holds the veil' },
    ],
    readers: [ST, STA, BB, AMSH, 'src/game/content/missions/ams/section-a.ts', 'src/game/content/missions/ams/section-b.ts', 'src/game/content/missions/ams/section-c2.ts'],
    testWords: ['stag-partier', 'stag-groom'],
    rules: [
      ...ENEMY_BASE,
      TURNER,
      { kind: 'variant', strips: ['*'], text: 'Set = partySet(look, groom): look 0 → stag-partier, look n → stag-partier-<n>, groom → stag-groom. ams spawns looks 0 and 2 only (sections pass `look`; beer bike riders pass `looks`).', at: { file: AMSH, find: 'export const STAG_LOOKS: readonly number[] = [0, 2];' } },
      { kind: 'hitbox', strips: ['*'], text: 'On foot 14 × 30; seated seatBox (−7, −40, 14, 27) above the stool; hp 20 (groom 40), score 300 (groom 1000).', at: { file: ST, find: 'seatBox: { x: -7, y: -40, w: 14, h: 27 },' } },
      { kind: 'speed', strips: ['walk'], text: 'Walks at 0.7 px/tick; walk strip 8 frames × 7 ticks = 56 ticks per cycle → 39.2 px per cycle (no strideRate: fixed speed).', at: { file: ST, find: 'walk: 0.7,' } },
      { kind: 'time', strips: ['fire', 'sit-fire'], text: 'Fire: durations [3, 8, 10] = 21 ticks = STAG.fireTicks; the cork leaves at modeT === popAt 3 (the pop frame, frame 1 today). Then recover 50 ticks (the strip ends, idle / sit plays).', at: { file: ST, find: 'if (this.modeT === STAG.popAt) {' } },
      { kind: 'point', strips: ['fire', 'sit-fire'], text: 'The cork leaves from x + facing × 12, y − chestY 25 (code numbers): the bottle neck on the pop frame should be there. The groom fires 3 corks (vy 0, −0.22, −0.44).', at: { file: ST, find: 'const x = this.x + this.facing * 12;' } },
      { kind: 'time', strips: ['tell', 'sit-tell'], text: 'Tell: ticksPerFrame 4 (3 frames, loops) for the telegraph tele 24 ticks.', at: { file: STA, find: "defHi(pre + 'tell', st(TELL), { ...o, ticksPerFrame: 4 });" } },
      { kind: 'frame', strips: ['gag-toast'], text: 'Toast gag: the clink sound plays when anim.index becomes 1 (the bottles meet on frame 1).', at: { file: ST, find: 'if (f === 1 && this.lastToastFrame !== 1 && this.onScreen(0))' } },
      { kind: 'point', strips: ['gloat', 'sit-gloat'], text: 'The selfie flash (enemy/stag-partier/flash) spawns at the phone: STAG.phone (9, −39) standing, seatedPhone (9, −42) seated (code numbers), every 50 ticks.', at: { file: ST, find: 'phone: [9, -39] as readonly [number, number],' } },
      { kind: 'frame', strips: ['sit', 'sit-tell', 'sit-fire', 'sit-gloat', 'sit-cower', 'die-stool'], text: 'Seated riders are drawn by the beer bike (drawSeated) between its counter and its posts; a hit while seated plays die-stool (bullet, laser, impact, knife).', at: { file: ST, find: "if (this.seat && (kind === 'bullet' || kind === 'laser' || kind === 'impact' || kind === 'knife')) return 'die-stool';" } },
      { kind: 'fit', strips: ['sit', 'sit-tell', 'sit-fire', 'sit-gloat', 'sit-cower'], text: 'Stools at x −34, −21, −8, 5 (body space of the beer bike); the hip sits seatHip 18 px above the stool anchor.', at: { file: BBG, find: 'stools: [-34, -21, -8, 5] as readonly number[],' } },
      { kind: 'shared', strips: ['flash'], text: 'enemy/stag-partier/flash: FX spawned by the gloat (durations [2, 3, 4], deferred); enemy/stag-groom/veil (deferred).', at: { file: STA, find: "defineSprite('enemy/stag-partier/flash'" } },
      { kind: 'shared', strips: ['*'], text: 'The ring crew (dormant mission) also reads stag-partier art.', at: { file: 'src/game/content/ring/crew/geometry.ts', find: 'stag-partier' } },
    ],
    keep: [
      'ids of looks 0 and 2 and the groom (looks 1 and 3 stay registered: the code can spawn them)',
      'turn = 2 frames; fire = 21 ticks with the pop at tick 3; tell loops',
      'gag-toast: the clink frame stays index 1 (or export it)',
      'seated strips fit the stools (hip 18 px above the stool)',
      'walk: 39.2 px per cycle at 0.7 px/tick',
      'looks are part swaps on the same animation (rule 6)',
    ],
  },
  {
    key: 'beer-bike',
    name: 'beer bike, its driver and the cork',
    wave: 3,
    kind: 'machine',
    ids: [{ prefix: 'vehicle/beer-bike/' }, { prefix: 'enemy/stag-beer-bike/' }, { prefix: 'enemy/cork/' }],
    sets: [
      { prefix: 'vehicle/beer-bike/', variant: 'the bike (enemy and the rideable player vehicle share it)' },
      { prefix: 'enemy/stag-beer-bike/', variant: 'the driver (pedalling, fleeing)' },
      { prefix: 'enemy/cork/', variant: 'the cork projectile (prop)' },
    ],
    readers: [BB, BBV, BBG, 'src/game/content/vehicles/beer-bike/art.ts', 'src/sim/bot.ts'],
    testWords: ['beer-bike', 'enemy/cork'],
    rules: [
      { kind: 'frame', strips: ['wheel', 'wheel-far'], text: 'Wheels: 4 steps, phase = floor(roll × facing / 3) mod 4 (one step per 3 px rolled): 12 px per wheel turn; keep 4 steps (mechanical).', at: { file: BB, find: 'const phase = ((Math.floor((this.roll * f) / 3) % 4) + 4) % 4;' } },
      { kind: 'frame', strips: ['body'], text: 'Body frame 0 intact, 1 damaged (hp ≤ maxHp / 3 on the enemy; the vehicle has its own damaged pick).', at: { file: BB, find: 'r.sprite(ID.body, this.hp <= this.maxHp / 3 ? 1 : 0, x, y, opts);' } },
      { kind: 'frame', strips: ['turret'], text: 'Turret: frame = the aim step (TURRET_STEPS 5, π/8 apart) on the player vehicle; frame 0 on the enemy.', at: { file: BBG, find: 'export const TURRET_STEPS = 5;' } },
      { kind: 'frame', strips: ['keg'], text: 'The rolled keg: frame floor(rolled / 4) % 4.', at: { file: BBV, find: 'r.sprite(ID.keg, Math.floor(this.rolled / 4) % 4, this.x, this.y - 6, plain);' } },
      { kind: 'frame', strips: ['driver'], text: 'Driver: frame (tick >> 3) & 1 while the bike moves (2 frames, 8 ticks), else 0; drawn at G.driver (22, −1) from the bike anchor.', at: { file: BB, find: 'if (this.driverOn) r.sprite(ID.driver, Math.abs(this.vx) > 0.1 ? (t >> 3) & 1 : 0, x + G.driver[0] * f, y, plain);' } },
      { kind: 'fit', strips: ['driver'], text: 'Driver anchor = his mount frame anchor at (22, −1); hip 17 px above it; the handlebar grips in geometry.ts.', at: { file: BBG, find: 'driver: [22, -1] as readonly [number, number],' } },
      { kind: 'hitbox', strips: ['*'], text: 'Enemy bike armoured box (−48, −14, 96, 14); the player vehicle seat zone (10, −34, 24, 26), cannon shot 6 × 4. Unchanged (D7).', at: { file: BB, find: 'box: { x: -48, y: -14, w: 96, h: 14 },' } },
      { kind: 'speed', strips: ['wheel'], text: 'Enemy roll 0.6 px/tick; player vehicle 1.4 px/tick (ram 3.0).', at: { file: BBV, find: 'speed: 1.4,' } },
      { kind: 'shared', strips: ['fly'], text: 'enemy/cork/fly: the cork projectile (6 × 4 box, ticksPerFrame 3).', at: { file: ST, find: "o.sprite = 'enemy/cork/fly';" } },
    ],
    keep: [
      'all vehicle/beer-bike/* ids (body 2, turret 5 aim steps, wheels 4 steps, keg 4, wreck, debris, foam, posts)',
      'wheel step = 3 px of roll (4 steps)',
      'the stools and the driver point (geometry.ts) fit the new riders',
      'machines: ≤ 40 colours (D1)',
    ],
  },
  {
    key: 'hostage-tourist',
    name: 'tied tourist (hostage), the camera flash and the binds',
    wave: 3,
    kind: 'person',
    ids: [{ prefix: 'item/hostage/tourist/' }, { exact: 'item/hostage/flash' }, { prefix: 'item/bind/' }],
    related: [
      { match: { prefix: 'item/hostage/' }, why: 'the kind-less strips (the critic’s) and the other kinds (composer, critic, dollop, roadie, tea-lady), star, steam, note, case-open: the campaign ending cast, not freed in ams (ams frees tourists only)' },
    ],
    sets: [
      { prefix: 'item/hostage/tourist/', variant: 'the tourist kind (its own rendered style; orange palm print laid on)' },
      { prefix: 'item/bind/', variant: 'bind props (rope, chair-break, sack-off, cage-break, mast, balloon, rope-band, rope-bit)' },
    ],
    readers: [HO, HOK, HOA, BI, AMSI],
    testWords: ['item/hostage', 'item/bind', 'tourist'],
    rules: [
      { kind: 'frame', strips: ['tied'], text: 'Tied (chair) with a struggle bind and ≥ 3 frames: frame 0 rest, 1 blink (7 of every 150 ticks), 2 struggle (while shaking). The code picks the index.', at: { file: HO, find: 'if (this.state === \'tied\' && this.bind.struggle && frameCount(this.anim.id) >= 3) {' } },
      { kind: 'frame', strips: ['gag'], text: 'Tourist gag (SAY CHEESE!): gagFrame t < 12 → 0, < 24 → 1, < 30 → 2, else 3 (40 ticks); the flash fires at t 24 from the `flash` point.', at: { file: HOK, find: 'return t < 12 ? 0 : t < 24 ? 1 : t < 30 ? 2 : 3;' } },
      { kind: 'point', strips: ['gag'], text: 'The camera flash (item/hostage/flash) spawns at the gag frame’s `flash` point.', at: { file: HOK, find: "if (h.pointOf('flash', pt)) fx(world, 'item/hostage/flash', pt.x, pt.y, { z: 62 });" } },
      { kind: 'point', strips: ['give'], text: 'PHYSICS: the gift pops from the `hand` point (else facing × 10, −12) at giveTicks / 2 = 12.', at: { file: HO, find: "const h = f ? framePoint(f, 'hand', this.facing < 0, false, hand) : undefined;" } },
      { kind: 'time', strips: ['freed', 'give', 'bow'], text: 'State times (TUNING.hostage): freed 20 ticks, give 24, bow 12 (one-shots); the tourist’s bow 5 and freed 7 frames fit inside them (TOURIST_BOW_TIMING, TOURIST_FREED_TIMING).', at: { file: TU, find: 'freedTicks: 20,' } },
      { kind: 'speed', strips: ['walk', 'run'], text: 'Walk 0.8 px/tick to the rescuer, run 2 px/tick off the screen (TUNING.hostage).', at: { file: TU, find: 'walkSpeed: 0.8,' } },
      { kind: 'frame', strips: ['turn', 'sack-turn'], text: 'Turn strips: 2 frames, HOSTAGE_TURN_TICKS 2 each, drawn 0,1 (old facing) then 1,0 (new facing); sack-turn while tied in the sack.', at: { file: HOK, find: 'r.sprite(this.turnStrip, i < 2 ? i : 3 - i, this.x + this.offX, this.y + this.offY, turnDraw);' } },
      { kind: 'hitbox', strips: ['*'], text: 'Body 14 × 26, hitbox (−8, −26, 16, 26); unchanged (D7).', at: { file: HO, find: 'this.hitbox = { x: -8, y: -26, w: 16, h: 26 };' } },
      { kind: 'fit', strips: ['tied'], text: 'THE CHAIR: the tied strip draws the hostage sitting on the folding chair (chairPiece, one sprite): the chair is part of the strip; item/bind/chair-break plays at release. ams binds: chair (6 hostages) and sack (5).', at: { file: HOA, find: '/** Sitting on the chair: thighs forward, shins down, hands tied behind the back. */' } },
      { kind: 'fit', strips: ['sack'], text: 'THE SACK: the sack strip is the whole figure inside the sack; it hops blindly at 0.3 px/tick inside a 48 px band (drawing offset only, the hitbox stays); item/bind/sack-off at release.', at: { file: BI, find: 'const SACK_SPEED = 0.3;' } },
      { kind: 'frame', strips: ['rope'], text: 'item/bind/rope: frame = segment − 1 (a rope of n segments, cage / balloon binds; not used in ams).', at: { file: BI, find: "r.sprite('item/bind/rope', seg - 1, x, top + y, fxOpts);" } },
      { kind: 'shared', strips: ['*'], text: 'Preloaded first in ams (item/hostage/tourist/, item/hostage/flash, item/bind).', at: { file: AMSI, find: "'item/hostage/tourist/'," } },
    ],
    keep: [
      'tourist strips: tied (≥ 3: rest, blink, struggle), gag (4: the flash point on frame 2), give (hand), bow, freed, walk, run, turn, sack, sack-turn, caged, mast, dangle, chute',
      'state times 20 / 24 / 12 ticks',
      'the chair and the sack are drawn inside the strip: the figure fits them (rule 10)',
      'item/hostage/flash and the 8 bind props',
    ],
  },
  // ------------------------------------------------------------------------------------ wave 4
  {
    key: 'delivery-rider',
    name: 'delivery rider (skins a, b, c)',
    wave: 4,
    kind: 'person',
    ids: [{ prefix: 'enemy/delivery-rider/' }, { prefix: 'enemy/delivery-rider-a/' }, { prefix: 'enemy/delivery-rider-c/' }],
    sets: [
      { prefix: 'enemy/delivery-rider/', variant: 'skin b (the base id), holds food-cube' },
      { prefix: 'enemy/delivery-rider-a/', variant: 'skin a: a separate rendered style (palette)' },
      { prefix: 'enemy/delivery-rider-c/', variant: 'skin c: a separate rendered style (palette)' },
    ],
    readers: [RI, RIA, DR, 'src/game/content/bosses/ams/mayor.ts'],
    testWords: ['delivery-rider'],
    rules: [
      ...ENEMY_BASE,
      { kind: 'variant', strips: ['*'], text: "Skin: param skin, else rng; b → enemy/delivery-rider, a / c → enemy/delivery-rider-<skin>.", at: { file: DR, find: "art: skin === 'b' ? 'enemy/delivery-rider'" } },
      { kind: 'frame', strips: ['turn'], text: 'Rider turn: RIDER_TURN 3 frames × 2 ticks, played forward then backward (12 ticks, draw only).', at: { file: RI, find: 'export const RIDER_TURN = { frames: 3, ticksPerFrame: 2 } as const;' } },
      { kind: 'time', strips: ['kick'], text: 'Kick: the box KICK_BOX (4, −22, 20, 16) is live while modeT ≤ kick 6 ticks; the strip KICK_DURATIONS [2, 1, 3, 30] (hit frame by tick 3).', at: { file: RIA, find: 'export const KICK_DURATIONS: readonly number[] = [2, 1, 3, 30];' } },
      { kind: 'speed', strips: ['ride'], text: 'Rides at 2.2 px/tick (gloat lap 1.1); the ride strip has 8 crank positions (RIDE_DURATIONS, a 20-tick crank turn) — pedalling, no foot contact on the floor (the wheels).', at: { file: DR, find: 'speed: 2.2,' } },
      { kind: 'hitbox', strips: ['*'], text: 'RIDER_BOX 24 × 34 (bike + rider); hp 10, score 200.', at: { file: RI, find: 'export const RIDER_BOX = { w: 24, h: 34 } as const;' } },
      { kind: 'frame', strips: ['bike'], text: 'The riderless bike: a 6-frame FX (skids, fades) spawned at death (wreckBike).', at: { file: RI, find: 'sprite: `${this.art}/bike`,' } },
      { kind: 'fit', strips: ['ride', 'idle', 'tell', 'kick', 'gag', 'gloat'], text: 'RIDERS ON THE ROAD: the bike wheels sit on the feet anchor (BIKE_OX / BIKE_OY in rider.art.ts); the tell / gloat wheelies rotate around the rear wheel.', at: { file: RIA, find: 'export function defineRiderSet(set: string, o: RiderSetOpts): void {' } },
      { kind: 'shared', strips: ['*'], text: 'Also spawned in mission sewers (sections a, b and the stand-ins) and by the mayor boss (riders tag).', at: { file: MY, find: 'const RIDER_TAG = ' } },
    ],
    keep: [
      'turn = 3 frames (RIDER_TURN), kick hit within 6 ticks',
      'ride: 8 crank positions or a count whose total stays 20 ticks per crank turn',
      'bike wreck FX (6), food-cube prop',
      'skins by palette swap (rule 6)',
    ],
  },
  {
    key: 'fatbike-youth',
    name: 'fatbike youth (looks 0–3, skins a–c, solo and pair)',
    wave: 4,
    kind: 'person',
    ids: [{ prefix: 'enemy/fatbike-youth/' }, { prefix: 'enemy/fatbike-youth-' }],
    sets: [
      { prefix: 'enemy/fatbike-youth/', variant: 'look 0 skin a, solo (base id); holds the cap' },
      { prefix: 'enemy/fatbike-youth-<look><skin>/', variant: 'solo sets 0b, 0c, 1a–3c: youthStyle(look, skin) rendered separately (looks = parts, skins = palette)' },
      { prefix: 'enemy/fatbike-youth-pair-<look><skin>/', variant: 'pair sets 0a–3c: + a passenger; rider-only strips are DENSE ALIASES of the solo twin (1× own)' },
    ],
    readers: [RI, RIA, FB, 'src/game/scenes/gameplay.ts', 'src/engine/art-pool.ts'],
    testWords: ['fatbike-youth'],
    rules: [
      ...ENEMY_BASE,
      { kind: 'variant', strips: ['*'], text: 'Set = youthSet(look, skin, pair): look 0 + skin a + solo → fatbike-youth, else fatbike-youth[-pair]-<look><skin>. ams spawns all (look, skin random).', at: { file: RIA, find: 'export function youthSet(look: number, skin: SkinKey, pair: boolean): string {' } },
      { kind: 'frame', strips: ['turn'], text: 'Rider turn: 3 frames × 2 ticks forward then backward (RIDER_TURN).', at: { file: RI, find: 'export const RIDER_TURN = { frames: 3, ticksPerFrame: 2 } as const;' } },
      { kind: 'time', strips: ['kick'], text: 'Kick at knee height: live for kick 8 ticks (KICK_DURATIONS [2, 1, 3, 30]).', at: { file: FB, find: 'kick: 8,' } },
      { kind: 'time', strips: ['die-seat', 'get-up', 'flee'], text: 'Death chain (not fire / crush): die-seat once → get-up once (when registered) → flee loops at 2 px/tick; the code waits for anim.done between them.', at: { file: FB, find: "this.play('get-up', { restart: true, loop: false });" } },
      { kind: 'speed', strips: ['flee', 'passenger-flee'], text: 'Flee on foot at FATBIKE.flee 2 px/tick (passenger 2.2): flee strip 4 frames × 4 ticks = 16 ticks → 32 px per cycle (foot-slide gate).', at: { file: FB, find: 'flee: 2,' } },
      { kind: 'speed', strips: ['ride'], text: 'Rides fast 1.8 / slow 0.8 px/tick (pedalling; RIDE_DURATIONS).', at: { file: FB, find: 'fast: 1.8,' } },
      { kind: 'time', strips: ['gloat'], text: 'Gloat: a slow wheelie (GLOAT_TPF.wheelie 9) with a bass thump every 36 ticks (one beat per rock of the strip: 4 frames × 9 = 36).', at: { file: FB, find: 'if (t % FATBIKE.thump === 0 && this.onScreen(0)) {' } },
      { kind: 'point', strips: ['gloat'], text: 'Music notes spawn at x − facing × 16, y − 20 (the speaker; code numbers).', at: { file: FB, find: 'musicNotes(this.world, this.x - this.facing * 16, this.y - 20);' } },
      { kind: 'hitbox', strips: ['*'], text: 'RIDER_BOX 24 × 34; hp 20 (pair 30), score 300 (pair 500).', at: { file: RI, find: 'export const RIDER_BOX = { w: 24, h: 34 } as const;' } },
      { kind: 'shared', strips: ['*'], text: 'Dense aliases: pair rider-only strips → the solo twin, passenger-flee → the passenger’s solo flee, bike → the skin-a bike (rule 7 drops them).', at: { file: RIA, find: 'const defAs = (id: string' } },
      { kind: 'shared', strips: ['*'], text: 'The art pool and the gameplay scene name fatbike ids (tier-4 working set).', at: { file: 'src/engine/art-pool.ts', find: 'fatbike-youth' } },
    ],
    keep: [
      '24 sets × 19–20 strips (1 + 11 solo, 12 pair)',
      'turn 3 frames; kick live 8 ticks; gloat 36 ticks per rock',
      'die-seat → get-up → flee chain (one-shots, loop)',
      'flee: 32 px per cycle at 2 px/tick',
      'looks = part swaps, skins = palette swaps (rule 6); pair = + passenger on the same animation',
    ],
  },
  {
    key: 'seagull',
    name: 'herring gull',
    wave: 4,
    kind: 'animal',
    ids: [{ prefix: 'enemy/seagull/' }],
    sets: [{ prefix: 'enemy/seagull/', variant: 'one set (idle is a dense alias of walk)' }],
    readers: [SG, SGA, 'src/game/content/missions/ams/section-a.ts'],
    testWords: ['seagull'],
    rules: [
      ...ENEMY_BASE,
      { kind: 'frame', strips: ['takeoff', 'pull-up'], text: 'Draw-only strips: frame = stripFrame(TAKEOFF_TIMING, TAKEOFF_TICKS, t) / (PULLUP_TIMING, PULLUP_TICKS): the frame counts are the lengths of these exported timing arrays.', at: { file: SG, find: 'i = stripFrame(TAKEOFF_TIMING, TAKEOFF_TICKS, this.takeoffT);' } },
      { kind: 'frame', strips: ['turn'], text: 'Turn via the Turner (2 frames).', at: { file: SG, find: "name = 'turn';" } },
      { kind: 'frame', strips: ['gloat'], text: 'Gloat: the peck sound when anim.index becomes 1.', at: { file: SG, find: "if (this.anim.changed && this.anim.index === 1 && this.onScreen(0)) this.world.audio.sfx('ams/gloat-peck', { vol: 0.6 });" } },
      { kind: 'speed', strips: ['walk'], text: '`walk` is the flight flap (FLAP_WALK durations): flies at 1.4 px/tick with a 9 px wobble; dives at 3, climbs 1.5. No floor contact.', at: { file: SG, find: 'fly: 1.4,' } },
      { kind: 'hitbox', strips: ['*'], text: 'Flying box (−10, −7, 20, 13) round the body centre; perched (−9, −19, 18, 18) above the feet.', at: { file: SG, find: 'box: { x: -10, y: -7, w: 20, h: 13 },' } },
      { kind: 'shared', strips: ['idle'], text: 'idle is a dense alias of walk (same picture at 2× / 4×).', at: { file: SGA, find: "if (name === 'idle') defineDenseAlias(A + name, A + 'walk');" } },
    ],
    keep: [
      'TAKEOFF_TIMING / PULLUP_TIMING lengths = the takeoff / pull-up frame counts (exported)',
      'turn 2 frames; gloat peck on frame 1',
      'two anchors: centre-ish for flight strips, feet for perched strips (as today)',
    ],
  },
  {
    key: 'pigeons',
    name: 'pigeon flock',
    wave: 4,
    kind: 'animal',
    ids: [{ exact: 'npc/ams/ams-pigeons' }, { prefix: 'npc/ams/ams-pigeons/' }],
    sets: [{ prefix: 'npc/ams/ams-pigeons', variant: 'one bird strip, drawn per bird with a flip' }],
    readers: [AMB, NPA, 'src/game/content/missions/ams/npc-hi.art.ts'],
    testWords: ['ams-pigeons'],
    rules: [
      { kind: 'frame', strips: ['ams-pigeons'], text: 'Frames picked by code: 0 stand, 1 peck, 2 step (8-tick alternation), 3 / 4 the flap after take-off (4-tick alternation). The strip needs these 5 roles (or exported indices).', at: { file: AMB, find: '} else f = ((this.t + i * 3) >> 2) & 1 ? 3 : 4;' } },
      { kind: 'frame', strips: ['takeoff'], text: 'Take-off: frame 0 for 3 ticks (crouch), 1 for 3 ticks (push off), staggered per bird.', at: { file: AMB, find: "id = 'npc/ams/ams-pigeons/takeoff';" } },
      { kind: 'speed', strips: ['ams-pigeons'], text: 'Steps 0.5 px every 4 ticks (0.125 px/tick) while stepping.', at: { file: AMB, find: 'if (this.act[i] === 2 && (this.t & 3) === 0) this.px[i] += this.dir[i] * 0.5;' } },
    ],
    keep: ['frame roles 0 stand, 1 peck, 2 step, 3–4 flap; takeoff 2 frames', 'pure decor (no hitbox use beyond the notice box)'],
  },
  {
    key: 'ducks',
    name: 'mallards (drake and hen)',
    wave: 4,
    kind: 'animal',
    ids: [{ exact: 'npc/ams/ams-ducks' }, { prefix: 'npc/ams/ams-ducks/' }],
    sets: [{ prefix: 'npc/ams/ams-ducks', variant: 'paddle: drake frames 0–3, hen frames 4–7 in one strip' }],
    readers: [AMB, NPA, 'src/game/content/missions/ams/floor/c/index.ts', 'src/game/content/missions/ams/floor/c2/index.ts'],
    testWords: ['ams-ducks'],
    rules: [
      { kind: 'frame', strips: ['paddle'], text: 'paddle: f = (i odd ? 4 : 0) + ((t >> 3) + 2i) & 3: drakes frames 0–3, hens 4–7, 8 ticks a step (32-tick cycle). Exactly 8 frames in two blocks of 4.', at: { file: AMB, find: 'const f = (i % 2 ? 4 : 0) + (((this.t >> 3) + i * 2) & 3);' } },
      { kind: 'speed', strips: ['paddle'], text: 'Paddles at 0.12 px/tick (× 3 when shy).', at: { file: AMB, find: "export const DUCKS = { max: 4, speed: 0.12, shy: 40, quack: 420, sfx: 'ams/duck' } as const;" } },
      { kind: 'fit', strips: ['paddle'], text: 'THE WATER LINE: y = the water surface (the canal floors c and c2 place them).', at: { file: AMB, find: '`ams-ducks`: 1–4 mallards paddling on the canal at the waterline (x, y = the water surface),' } },
      { kind: 'frame', strips: ['ams-ducks'], text: 'npc/ams/ams-ducks (4 frames): the plain strip; the entity draws only …/paddle.', at: { file: AMB, find: "r.sprite('npc/ams/ams-ducks/paddle', f, this.px[i], this.y, drawOpts);" } },
    ],
    keep: ['paddle: 8 frames, drake 0–3, hen 4–7 (or exported blocks)', 'the water line at y'],
  },
  // ------------------------------------------------------------------------------------ wave 5
  {
    key: 'baker',
    name: 'Fabel Friet baker',
    wave: 5,
    kind: 'person',
    ids: [{ prefix: 'npc/ams/ams-baker/' }],
    sets: [{ prefix: 'npc/ams/ams-baker/', variant: 'one set' }],
    readers: [ENT, NPA, 'src/game/content/missions/ams/section-a.ts', 'src/game/content/missions/ams/section-d.ts'],
    testWords: ['ams-baker'],
    rules: [
      { kind: 'frame', strips: ['toss'], text: 'Toss: the item leaves when anim.index ≥ TOSS_RELEASE 3 (baked, re-exported by npc.art.ts): frame 3 starts at tick 14 of 28 [6,5,3,3,6,5], from the `hand` point (the scoop bowl); a one-shot; TOSS_TICKS deleted.', at: { file: ENT, find: 'if (!this.released && this.anim.index >= TOSS_RELEASE) {' } },
      { kind: 'point', strips: ['toss'], text: 'PHYSICS: the tossed item spawns at the `hand` point of the current frame (else facing × 6, −30).', at: { file: ENT, find: "const pt = this.anim.point('hand', this.facing < 0, handPt) ?? null;" } },
      { kind: 'frame', strips: ['in-talk', 'in-clap', 'in-cheer', 'in-wave'], text: 'Transitions in-<mode>: 2 frames × PERSON_TR_TICKS 3 into (0, 1) and out of (1, 0) talk, clap, cheer, wave.', at: { file: ENT, find: 'const k = Math.min(1, Math.floor((2 * PERSON_TR_TICKS - this.trT) / PERSON_TR_TICKS));' } },
      { kind: 'frame', strips: ['turn'], text: 'Turn: 2 frames × PERSON_TURN_TICKS 2 (0,1 old facing, 1,0 new).', at: { file: ENT, find: 'r.sprite(this.turnId, i < 2 ? i : 3 - i, x, y, drawOpts);' } },
      { kind: 'speed', strips: ['walk'], text: 'Walk drawn for PERSON_WALK_SPEED 0.8 px/tick: 12 frames × 3 ticks = 36 t, 28.8 px a cycle (the stride of the handhaver and the crew); the Animator rate is strideRate(speed, 0.8) (the finale walks at 1.1).', at: { file: NPA, find: 'export const PERSON_WALK_SPEED = 0.8;' } },
      { kind: 'hitbox', strips: ['*'], text: 'NPC box (−7, −36, 14, 36) (no damage).', at: { file: ENT, find: 'this.hitbox = { x: -7, y: -36, w: 14, h: 36 };' } },
      { kind: 'fit', strips: ['*'], text: 'THE COUNTER: ams-a spawns him at x 3330, y G 176 behind decor/ams/fabel-counter (front decor, x 3330); with param counter the entity draws npc/ams/counter at x + facing × 5.', at: { file: 'src/game/content/missions/ams/section-a.ts', find: "{ sprite: 'decor/ams/fabel-counter', x: 3330, y: G, front: true }," } },
    ],
    keep: ['TOSS_RELEASE frame with the hand point (exported constant)', 'in-* 2 frames, turn 2 frames', 'walk stride for 0.8 px/tick', 'fits behind the Fabel Friet counter'],
  },
  {
    key: 'hotdog-vendor',
    name: 'hot-dog vendor',
    wave: 5,
    kind: 'person',
    ids: [{ prefix: 'npc/ams/ams-hotdog-vendor/' }],
    sets: [{ prefix: 'npc/ams/ams-hotdog-vendor/', variant: 'one set' }],
    readers: [ENT, NPA, 'src/game/content/missions/ams/section-b.ts'],
    testWords: ['ams-hotdog-vendor'],
    rules: [
      { kind: 'time', strips: ['salute'], text: 'Salutes each passing player once (70-tick mode, range 40 px): the baked salute is one 70-tick performance (raise, snap, hold, chuckle, lower), so the loop never shows a seam inside the mode.', at: { file: ENT, find: "class AmsHotdogVendor" } },
      { kind: 'frame', strips: ['in-talk', 'in-wave', 'turn'], text: 'Transitions and turn as the other people (2 frames each).', at: { file: ENT, find: 'const k = Math.min(1, Math.floor((2 * PERSON_TR_TICKS - this.trT) / PERSON_TR_TICKS));' } },
      { kind: 'fit', strips: ['*'], text: 'THE STAND: B_VENDOR = (B_HOTDOG_X 960 + 32, G − 8 + STAND_DY (baked, 5) = 173): his head and chest in the hatch, the cap under the hatch top; decor/ams/hotdog-front (x 960, y 176, front) hides the rest; on a perspective floor the vendor draws the stand front himself (render only).', at: { file: 'src/game/content/missions/ams/section-b.ts', find: 'export const B_VENDOR = { x: B_HOTDOG_X + 32, y: G - 8 + STAND_DY } as const;' } },
    ],
    keep: ['head and chest fit the hatch of the stand (only the top shows)', 'salute, talk, wave, in-*, turn'],
  },
  {
    key: 'staff',
    name: 'Fabel Friet crew 0–2',
    wave: 5,
    kind: 'person',
    ids: [{ prefix: 'npc/ams/ams-staff/' }],
    related: [{ match: { exact: 'npc/ams/counter' }, why: 'the small counter prop an NPC draws with param counter: scenery (fit reference, not a character strip)' }],
    sets: [{ prefix: 'npc/ams/ams-staff/<look>/', variant: 'baked sets ams-staff-0/-1/-2, part swaps (staff.art.ts STAFF_SETS)' }],
    readers: [ENT, NPA, 'src/game/content/missions/ams/section-d.ts'],
    testWords: ['ams-staff'],
    rules: [
      { kind: 'variant', strips: ['*'], text: 'look = param look (0–2) → npc/ams/ams-staff/<look>.', at: { file: ENT, find: 'super(world, x, y, p, `npc/ams/ams-staff/${look}`);' } },
      { kind: 'frame', strips: ['in-clap', 'in-cheer', 'in-wave', 'turn'], text: 'Transitions 2 frames × 3 ticks; turn 2 frames × 2 ticks.', at: { file: NPA, find: 'export const PERSON_TR_TICKS = 3;' } },
      { kind: 'speed', strips: ['walk'], text: 'Walk drawn for 0.8 px/tick: 12 frames × 3 ticks = 36 t, 28.8 px a cycle; the finale walks at 1.1 (strideRate).', at: { file: 'src/game/content/missions/ams/section-d.ts', find: "const e = ctx.spawn(ids[i], left - i * 22, G, { facing: 1, look: i - 1, speed: 1.1 });" } },
      { kind: 'fit', strips: ['*'], text: 'THE CREW: in the ams-d finale they walk in from the left on the floor G 176 and clap / cheer in a row (CHEER_X); no counter in front of them today.', at: { file: 'src/game/content/missions/ams/section-d.ts', find: "const ids = ['ams-baker', 'ams-staff', 'ams-staff', 'ams-staff'];" } },
    ],
    keep: ['3 looks as part swaps on one animation (rule 6)', 'in-* 2 frames, turn 2 frames, walk stride 0.8 px/tick'],
  },
  {
    key: 'window-waver',
    name: 'window waver and the cat',
    wave: 5,
    kind: 'person',
    ids: [{ prefix: 'npc/ams/ams-window-waver/' }],
    sets: [{ prefix: 'npc/ams/ams-window-waver/', variant: 'person or cat (param look)' }],
    readers: [AMB, NPA, 'src/game/content/missions/ams/npc-hi.art.ts'],
    testWords: ['ams-window-waver'],
    rules: [
      { kind: 'frame', strips: ['person'], text: 'person frames by phase (WAVER_PHASE 100 / 130 / 250 / 280, period 360, ≥ 240): the baked roles WAVER_EMPTY, WAVER_IDLE, WAVER_BLINK, WAVER_RAISE (2), the WAVER_WAVE_A..B cycle (6 frames, 16 t), back to idle, then empty; waverPick picks them.', at: { file: AMB, find: 'export function waverPick(' } },
      { kind: 'frame', strips: ['lean'], text: 'lean: 4 frames [2,3,2,2] = WAVER_LEAN_TICKS 9 rising in (0..3) and played backwards to sink out (3..0).', at: { file: AMB, find: 'export const WAVER_LEAN_TICKS' } },
      { kind: 'frame', strips: ['cat-swish'], text: 'cat-swish: 8 frames, a 48-tick loop (CAT_SWISH_TICKS) by frameInRun.', at: { file: AMB, find: "if (cat) return ['cat-swish'" } },
      { kind: 'frame', strips: ['cat'], text: 'cat (8 frames, 48 t): registered, not drawn by the entity (the cat draws cat-swish; WAVER_IDS has no cat). Check before removing.', at: { file: AMB, find: 'const WAVER_IDS =' } },
      { kind: 'fit', strips: ['*'], text: 'THE WINDOW: y = the window sill = the feet anchor of the 20 × 26 window (hitbox (−10, −26, 20, 26)); the figure must stay inside 20 × 26 above the sill. Spawns: ams-a x 2016 y 104, 2380 y 92 (cat), 3110 y 106; ams-b 2330 y 104, 2700 y 96 (cat); ams-c 1560 y 100, 1830 y 92 (cat), 2090 y 96.', at: { file: AMB, find: 'this.hitbox = { x: -10, y: -26, w: 20, h: 26 };' } },
    ],
    keep: ['person 11 frames with the phase roles (WAVER_* constants)', 'lean 4, cat-swish 8, cat 8', 'everything inside the 20 × 26 window above the sill'],
  },
  // ------------------------------------------------------------------------------------ wave 6
  {
    key: 'scan-car',
    name: 'scan car (SCANAUTO) with tow truck and wheel clamp',
    wave: 6,
    kind: 'machine',
    ids: [{ prefix: 'boss/ams-scan/' }],
    sets: [{ prefix: 'boss/ams-scan/', variant: 'one set; damage states as separate ids (body-0|1|2, scanner-0|1|2, scanner-gone)' }],
    readers: [SCC, SCD, SCG, 'src/game/content/bosses/ams-scan/art.ts', 'src/game/content/missions/ams/section-c.ts'],
    testWords: ['ams-scan'],
    rules: [
      { kind: 'frame', strips: ['body-0', 'body-1', 'body-2'], text: 'Body by Boss.partState (0 intact, 1 damaged, 2 broken); 3 poses each (BODY_LEVEL / BODY_SQUAT / BODY_DIVE: the rev and launch squat, the brake dive, a settle); overlays follow the pose (bodyShift).', at: { file: SCC, find: 'r.sprite(ID.body[this.partState(body)], pose, x, yb, drawOpts);' } },
      { kind: 'frame', strips: ['scanner-0', 'scanner-1', 'scanner-2'], text: 'Scanner by part state; 11 frames by SCAN_* role (down, the rise in 2 steps, a SCAN_SWEEP_N-step red sweep, the lock pair, the print kick and recoil); same attack ticks (i < 16 / 32 / 44 / 54).', at: { file: SCC, find: 'this.scanFrame = i < 16 ? SCAN_DOWN : i < 32 ? SCAN_LIFT1 : i < 44 ? SCAN_LIFT2 : i < 54 ? SCAN_ON + (Math.floor((i - 44) / SWEEP_TPF) % SCAN_SWEEP_N) : SCAN_LIFT2;' } },
      { kind: 'frame', strips: ['cabin'], text: 'The glass and the driver by role (9 frames, the CAB_* constants of ams-scan.gen.ts: calm, shout + a fist shake, shock, the look back for the reverse, the airbag pop and airbag, gotcha, empty).', at: { file: SCC, find: 'r.sprite(ID.cabin, cab, x, yb + bodyShift(CAB_REF_X, pose), drawOpts);' } },
      { kind: 'frame', strips: ['wreck'], text: 'Wreck: WRECK_FACING (7) frames facing right, the same facing left (never flipped): WRECK_ROLLS rolls, WRECK_IMPACT, WRECK_REST on its roof.', at: { file: SCC, find: 'r.sprite(ID.wreck, this.wreckFrame + (flip ? WRECK_FACING : 0), Math.round(this.x), Math.round(this.y - this.lift), drawOpts);' } },
      { kind: 'frame', strips: ['text'], text: 'Lettering marks, never mirrored: 0 the roof sign, 1 the city crosses (right), 2 the scanner number, 3 the crosses (left); textFlip [0, 3, 2].', at: { file: SCG, find: 'textFlip: [0, 3, 2] as const,' } },
      { kind: 'frame', strips: ['wheel'], text: 'Wheels: 4 steps, one step per 1.9 px of wheelDist (car and tow truck).', at: { file: SCC, find: 'const f = ((Math.floor(this.wheelDist / 1.9) % 4) + 4) % 4;' } },
      { kind: 'frame', strips: ['tow', 'hook'], text: 'Tow truck (6 frames): truckFrame() = TOW_DAMAGED when broken or hp ≤ maxHp / 2, + TOW_LOAD_STEP per clamp tossed (TOW_LOADS on the bed); drawn TRUCK_ART_DX forward so the art tip sits on the logic tip [-52, -50] (D7); hook 5 frames: hookFrame() one per HOOK_TILT_DEG of swing (HOOK_TILTS), mirrored. Plan D5: 1.2× longer.', at: { file: SCD, find: 'r.sprite(ID.truck, this.truckFrame(), x + (flip ? -TRUCK_ART_DX : TRUCK_ART_DX), y, drawOpts);' } },
      { kind: 'frame', strips: ['clamp', 'clamp-foot'], text: 'Clamp 10 frames (AmsWheelClamp.frame(), CLAMP_*: roles 0-3 keep the old attach states; + the squat tremble, land squash, launch stretch, wide hop, snap, dip); clamp-foot 5 (CLAMP_FOOT_*: still, rattle in the last ticks, bite, snap, pop).', at: { file: SCD, find: 'else if (held < 3) f = CLAMP_FOOT_BITE;' } },
      { kind: 'frame', strips: ['ticket', 'reticle'], text: 'ticket: floor(t / tpf) % TICKET_FRAMES (3); reticle 7 frames: RETICLE_TRACK + RETICLE_TRACK_N breathing steps, RETICLE_SNAP, RETICLE_LOCK / RETICLE_PULSE.', at: { file: SCD, find: 'r.sprite(ID.reticle, f, Math.round(this.x), Math.round(this.y), drawOpts);' } },
      { kind: 'shared', strips: ['*'], text: 'The fleeing driver is enemy/handhaver/walk (see the handhaver contract); driverFrame(dist) picks the frame by the distance at his own walk stride (no foot slide).', at: { file: SCC, find: 'export function driverFrame(dist: number): number {' } },
      { kind: 'hitbox', strips: ['*'], text: 'Part boxes in geometry.ts (SCAN, TRUCK.box, CLAMP.box): unchanged (D7) except the D5 truck length.', at: { file: SCG, find: "export const SCAN_ART = 'boss/ams-scan';" } },
    ],
    keep: ['every frame role above by the gen constants (body 3 poses, cabin 9, scanner 11 × 3 states, wreck 14, text 4, wheel 4, blink 3, reticle 7, ticket 3, tow 6, hook 5, clamp 10, clamp-foot 5)', 'wheel step 1.9 px', 'machines ≤ 40 colours; tow truck 1.2× longer (D5)', 'the logic tip [-52, -50], TRUCK.box, dropAt (D7)'],
  },
  {
    key: 'mayor',
    name: 'robot mayor (MECHA HASLEMA)',
    wave: 6,
    kind: 'boss-robot',
    ids: [{ prefix: 'boss/ams-mayor/' }],
    sets: [{ prefix: 'boss/ams-mayor/', variant: 'one set; damage states as separate ids (body-/head-/chain-/medallion-/stamp-arm-0|1|2, *-gone)' }],
    readers: [MY, MYL, MYG, 'src/game/content/bosses/ams/art.ts', 'src/game/content/bosses/ams/shots.ts', 'src/game/content/bosses/ams/art-shots.ts'],
    testWords: ['ams-mayor', 'MECHA HASLEMA', 'MAYOR_NAME'],
    rules: [
      { kind: 'frame', strips: ['legs'], text: 'legs (23): LEGS_* roles 0-10 (stand, air, land, squat, sit, reach, give, reel, brace, half squat, push-off), then MAYOR_WALK (11) + LEGS_WALK_FRAMES (12) walk frames over LEGS_WALK_TICKS (32, no slide); point hip on every frame (the upper body follows it, at most 2 px in the fight: the part boxes do not move, D7); one shared anchor.', at: { file: MY, find: 'this.legsFrame = MAYOR_WALK + Math.floor(' } },
      { kind: 'frame', strips: ['head-0', 'head-1', 'head-2'], text: 'head (10 per state, HEAD_*): 0 smile, 1 hatch open, 2 shout, 3 blink, 4 off (death), 5 bald, 6 hatch ajar, 7 blink half, 8 shout in-breath, 9 bald B; headShown() (layout.ts HEAD_SHOW): blink 7-3-7 every 150 ticks.', at: { file: MY, find: 'const headFrame = this.headShown(idle);' } },
      { kind: 'frame', strips: ['stamp-arm-0', 'stamp-arm-1', 'stamp-arm-2'], text: 'stamp-arm (40 = 2 × ARM_FRAMES 20, PRE-MIRRORED: frames 20–39 face left, drawn unflipped): ARM_* roles 0-5 keep the old meanings (low, raised, slammed, anticipation, smear, recoil); + coil, the rise in 5 in-betweens, overshoot, tremble, smear low, impact, settle, lift, lower, sag (armShown, layout.ts STAMP_SHOW, inside the same telegraph and hit windows).', at: { file: MY, find: 'const fr = this.armShown() + (this.facing < 0 ? ARM_FRAMES : 0);' } },
      { kind: 'frame', strips: ['arm-back'], text: 'arm-back (24, BACK_*): rest, high, low, the whirl high / low in BACK_WHIRL_STEPS steps (link smears; the high lasso stays inside the 176 px view), the wind-up, release, pull and catch per lane (backArmShown, layout.ts WHIP_SHOW).', at: { file: MY, find: 'private backArmShown(): number {' } },
      { kind: 'frame', strips: ['medallion-0', 'medallion-1', 'medallion-2'], text: 'medallion (7, MED_*): 0 closed (armoured), 1 open, 2 glow, 3 crack, 4 part, 5 charge, 6 flash (medShown, layout.ts MED_SHOW; + a tint glow while it telegraphs).', at: { file: MY, find: 'const mf = this.medShown();' } },
      { kind: 'frame', strips: ['wig', 'spring', 'shadow', 'lash'], text: 'wig WIG_FRAMES 8 (spin: (wigSpin / 3) % 8; the frames keep the floor origin, drawn so that layout.ts WIG_ANCHOR lands on the flight point); spring 4 (min(3, springH / 8)); shadow 0 / 1 (telegraph); lash 6 (LASH_*: out A/B, snap A/B, back A/B), the frame\'s last (lashLen + 4) px shown so the tip weight leads.', at: { file: MY, find: 'srcRect.x = f.buf.w - vis;' } },
      { kind: 'time', strips: ['*'], text: 'One shared anchor for every piece (0, 0) = the floor point between her feet; pieces are composed per tick (body, head on the spring at dy − 112, chain, medallion, arms): every piece must keep that anchor. The upper body follows the legs hip (hipDy); idle breath: 1 px every 32 ticks (code). The code picks the roles: no strip time is logic time.', at: { file: MY, find: 'const dy = this.sitDrop > 0 ? this.sitDrop - this.lift : this.hipDy(legsF)' } },
      { kind: 'hitbox', strips: ['*'], text: 'Part boxes (stamp-arm, chain, medallion core, head bonus, legs / torso armour) in geometry.ts: unchanged (D7).', at: { file: MY, find: "this.armorParts.push(this.addPart('legs', { box: B.legs }), this.addPart('torso', { box: B.torso }));" } },
      { kind: 'shared', strips: ['*'], text: 'Rename to MECHA HASLEMA (plan D4): MAYOR_NAME / MAYOR_SUBTITLE, intro card, docs, tests; the id ams-mayor stays.', at: { file: MYG, find: "export const MAYOR_NAME = 'MECHA HASLEMA';" } },
      { kind: 'shared', strips: ['noise-letter', 'shield-shot', 'stamp-wave'], text: 'Projectiles of the fight (shots.ts / art-shots.ts): props.', at: { file: 'src/game/content/bosses/ams/shots.ts', find: 'ams-mayor' } },
    ],
    keep: ['every frame index role above (or exported named constants: rule 4)', 'stamp-arm pre-mirrored 2 x ARM_FRAMES (20)', 'one shared anchor for all pieces', '≤ 64 colours, high fidelity (D1, D4)'],
  },
  // ------------------------------------------------------------------------------------ wave 7
  {
    key: 'swan',
    name: 'the Swan (P1) and the Mute Swan (P2)',
    wave: 7,
    kind: 'mount',
    ids: [{ prefix: 'vehicle/swan/' }, { prefix: 'vehicle/swan-mute/' }],
    related: [
      { match: { prefix: 'vehicle/swan-socks/' }, why: 'the Swan in socks (m3 only): out of scope' },
      { match: { prefix: 'vehicle/swan-mute-socks/' }, why: 'the Mute Swan in socks (m3 only): out of scope' },
    ],
    sets: [
      { prefix: 'vehicle/swan/', variant: 'P1 (ivory); also holds egg, beak-flash, scuffs' },
      { prefix: 'vehicle/swan-mute/', variant: 'P2 (the black swan): a palette swap of the baked sets swan, swan-neck, swan-water (rule 6)' },
    ],
    readers: [SW, SWC, SWD, 'src/game/content/vehicles/swan/weapons.ts', 'src/game/content/vehicles/swan/egg.ts', 'src/game/scenes/lake.ts', 'src/game/scenes/gameplay.ts', 'src/game/content/ui/screens.art.ts', 'src/game/content/oldenzaal/tower/swan-jet.ts'],
    testWords: ['vehicle/swan', 'swan-mute'],
    rules: [
      { kind: 'frame', strips: ['*'], text: 'EVERY body frame is chosen by code (show(name, frame) with a held Animator): the odometers run = floor(odo / RUN_PX) mod n, waddle floor(odo / WADDLE_PX) mod n, dive floor(odo / DIVE_PX) mod n; the swim clock (one cycle per SWIM_CYCLE ticks moving, SWIM_CYCLE_STILL still); every other strip by its OWN baked durations (loopAt / frameAt over stripDurations: the logic times of the strip, plan rule 4). The baked events are the named constants (swan.gen, swan-water.gen).', at: { file: SW, find: 'const f = mod(Math.floor(this.odo / RUN_PX), n);' } },
      { kind: 'speed', strips: ['run'], text: 'Run: the odometer drives the frames (RUN_PX px per frame) at any speed up to 2.6 px/tick: no foot slide by construction (feet contacts on RUN_CONTACT_A / RUN_CONTACT_B → swan/step).', at: { file: SW, find: 'if (f !== this.lastRunFrame && (f === RUN_CONTACT_A || f === b)) {' } },
      { kind: 'frame', strips: ['neck', 'neck-blink', 'neck-fire', 'neck-hurt', 'neck-shell', 'swim-neck', 'swim-neck-blink', 'swim-neck-fire', 'swim-neck-hurt', 'swim-neck-shell'], text: 'Neck strips (plan D3: the barrel on the drum takes the 9 aim angles, the neck is free): frame = aim × phases + phase (neck.ts neckFrame over NECK_AIMS and NECK_*_PHASES of swan-neck.gen); crouch / duck necks aim 0° only; the phase follows the strip durations (the old face times per aim).', at: { file: SW, find: "this.neckFrame = neckFrame(this.neckName, single ? 0 : this.neckIndex, elapsed);" } },
      { kind: 'point', strips: ['neck', 'swim-neck', 'crouch-neck', 'duck-neck', 'neck-fire', 'neck-shell'], text: 'PHYSICS: bullets / shells leave from the body frame `neck` point + the neck frame `muzzle` / `cannon` point (MUZZLE_REL fallback). D3 moves `muzzle` to the barrel tip.', at: { file: SW, find: "beakTip(name: 'muzzle' | 'cannon', out: [number, number]): [number, number] {" } },
      { kind: 'point', strips: ['*'], text: 'Body frame points: `seat` (the rider’s hip; crouch strips + 4 px), `neck` (the socket), `hull` (scuffs), `smoke`, `head` (dizzy feathers); fallbacks REST + HULL_DY per strip frame (HULL_DY arrays are per-frame tables: their lengths follow the strip counts).', at: { file: SW, find: "private bodyPoint(name: 'seat' | 'neck' | 'hull' | 'smoke', out: [number, number]): [number, number] {" } },
      { kind: 'frame', strips: ['*-front'], text: 'The `-front` overlays are drawn with the BODY frame index (same count as their body strip; FRONT map).', at: { file: SW, find: 'if (hasSprite(id)) r.sprite(id, this.anim.index, ox, oy, o);' } },
      { kind: 'frame', strips: ['honk', 'honk-air', 'honk-swim'], text: 'Honk: frameAt(the strip durations, honkT) over the 20 ticks; the ring leaves at tick 10 (HONK_BLAST).', at: { file: SW, find: "this.timed(this.medium === 'air' ? 'honk-air'" } },
      { kind: 'frame', strips: ['run', 'glide', 'glide-tired', 'squat', 'flap', 'paddle-up'], text: 'Rider frame follows the body frame: run RUN_DIP_FROM..RUN_DIP_TO of each half → 1 else 0; glide / glide-tired f ≥ GLIDE_DIP_FROM → 1; squat / flap f & 1; paddle-up 1 → 1.', at: { file: SW, find: 'return h >= RUN_DIP_FROM && h <= RUN_DIP_TO ? 1 : 0;' } },
      { kind: 'hitbox', strips: ['*'], text: 'Hurtboxes per pose (HURT stand / crouch / swim / duck), SEAT_ZONE, PERCH: unchanged (D7).', at: { file: SWC, find: 'export const HURT = deepFreeze({' } },
      { kind: 'fit', strips: ['swim', 'water-duck', 'swim-neck', 'paddle-up', 'honk-swim'], text: 'THE WATER LINE: her feet ride the float line = surface + swimDepth 16 (the hull on the surface); bob 1 px every 48 ticks; duck sinks 8.', at: { file: SWC, find: 'swimDepth: 16,' } },
      { kind: 'variant', strips: ['*'], text: 'P2 = vehicle/swan-mute (variant mute); bodyId falls back to vehicle/swan/<name> when the mute strip is missing (egg, beak-flash, scuffs exist only for P1).', at: { file: SW, find: 'const cands = [`${this.bodyPrefix}/${name}`' } },
      { kind: 'shared', strips: ['*'], text: 'Also used by oldenzaal (the tower swan jet), the lake scene and the screens art.', at: { file: 'src/game/content/oldenzaal/tower/swan-jet.ts', find: 'vehicle/swan' } },
    ],
    keep: [
      'all 89 + 86 ids (rule 1)',
      'the code-chosen frame counts (run 8, waddle 6, dive 8, swim 4 …) or new named constants in swan.ts',
      'neck strips 9 aim frames (or the aim moves to the barrel: D3) with muzzle / cannon points',
      'seat, neck, hull, smoke, head points on every body frame',
      '-front overlays share the body frame count',
      'P2 = palette swap of the same pixels (rule 6); ≤ 40 colours (D1)',
    ],
  },
];

/** Places the contract must not be confused by (documentation only). */
export const NOTES: readonly string[] = [
  'The heroes, the Swan, the handhaver and the delivery rider also appear in oldenzaal and sewers (the heroes, the rider): shared ids change everywhere (plan "Scope"; intended).',
  'Animator rule: a strip’s `durations` override any ticksPerFrame the code passes (Animator.play). The hero run strip has none today (the code plays it at 3 ticks per frame); a baked strip always has durations (src/engine/baked.ts), so the baked run keeps 36 ticks per cycle (logicTicks) and the TUNING knob no longer changes it. The hero knife / throw strips have durations, which win over the computed speed.',
  'Turn strips are drawn by code (Turner, RIDER_TURN, PERSON_TURN_TICKS, HOSTAGE_TURN_TICKS): their counts are code numbers.',
];

/**
 * Characters whose ids are already replaced by baked 40 px art (wave by wave; the verifier of a
 * wave adds its keys). contract.json stays the wave-0 snapshot of the OLD strips (the numbers a
 * replacement must keep), so tests/tools/art40-contract.test.ts only checks that their ids still
 * exist (rule 1) instead of comparing the old frame counts with the new art.
 */
export const BAKED: readonly string[] = [
  'handhaver', 'boete-ticket',
  'hero-vincent', 'hero-thom', 'hero-dirk', 'hero-bob', 'hero-patrick',
  'scan-car', 'mayor',
  'swan',
  'baker', 'hotdog-vendor', 'staff', 'window-waver',
  // waves 3 and 4 (street, riders), taken in as they stand by the owner (2026-11-11): their reviewers and
  // verifier did not run
  'stag-partier', 'beer-bike', 'hostage-tourist', 'delivery-rider', 'fatbike-youth', 'seagull', 'pigeons', 'ducks',
];
