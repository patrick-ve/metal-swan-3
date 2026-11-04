/**
 * The machine-readable part of the hand-read contract (scope.ts holds the readable rules): per
 * character, strip patterns with the fields the art40-check gate reads (tools/art40/check/
 * contract.ts `ContractEntry`):
 * - readPoints: the point names the code reads on these strips (the LAST matching entry with
 *   readPoints wins, so a later entry replaces or clears the list of a '*' entry; a strip without
 *   any entry keeps every old point: rule 3 then asks for all of them);
 * - logicTicks: the total ticks the code relies on (rule 4);
 * - shownTicks: the code shows the strip only this long from its start (then switches to another
 *   strip): frames that start at or after this tick are never seen;
 * - events: the named constants a bake must export for frames the code picks by index or the
 *   ticks it acts on (rule 4: "code that indexes frames reads named constants exported by the
 *   bake"). `tick` with kind 'frame': the frame constant's start tick; kind 'tick': the tick;
 *   no tick: the constant must exist (the code holds that frame itself);
 * - speed / perFrame: ground speed for the foot-slide gate (px per tick, or px per frame when
 *   the code steps frames by distance, the Swan's odometer); noFoot: why a locomotion strip has
 *   no floor contact.
 * Patterns: an exact strip name or a glob with '*' (any text, also '/').
 */

export interface ContractEventSpec {
  readonly name: string;
  readonly tick?: number;
  readonly kind?: 'frame' | 'tick';
}

export interface MachineData {
  readonly strips: readonly string[];
  readonly readPoints?: readonly string[];
  readonly logicTicks?: number;
  readonly shownTicks?: number;
  readonly events?: readonly ContractEventSpec[];
  readonly speed?: number;
  readonly perFrame?: boolean;
  readonly noFoot?: string;
}

/** Does a strip name match a pattern (exact, or a glob where '*' is any text)? */
export function stripMatches(pattern: string, strip: string): boolean {
  if (!pattern.includes('*')) return pattern === strip;
  const esc = (t: string): string => t.replace(/[.+?^$()|[\]\\{}]/g, (m) => `\\${m}`);
  const re = new RegExp('^' + pattern.split('*').map(esc).join('.*') + '$');
  return re.test(strip);
}

const ev = (name: string, tick?: number, kind?: 'frame' | 'tick'): ContractEventSpec => ({ name, ...(tick !== undefined ? { tick } : {}), ...(kind ? { kind } : {}) });
const roles = (...names: string[]): ContractEventSpec[] => names.map((n) => ev(n));

const HERO: readonly MachineData[] = [
  // Nothing on the torso / full strips is read by code except the ones below.
  { strips: ['*'], readPoints: [] },
  { strips: ['legs-*'], readPoints: ['hip'] },
  { strips: ['torso-*-shoot*', 'helium-torso-*-shoot*', 'helium-wob-torso-*-shoot*', 'torso-*-crouch-shoot'], readPoints: ['muzzle'] },
  { strips: ['torso-*-throw', 'helium-torso-*-throw', 'helium-wob-torso-*-throw', 'torso-*-crouch-throw'], readPoints: ['hand'] },
  { strips: ['torso-*-knife', 'torso-*-knife-b', 'torso-*-crouch-knife', 'helium-torso-*-knife', 'helium-wob-torso-*-knife'], logicTicks: 14 },
  // player.ts shoot(): shootTicks = 2 × TUNING.fire.shootAnimTicks (3) = 6, restarted per shot; at 0
  // updateTorso puts the aim pose back. Only the first 6 ticks of a shoot strip are ever seen.
  { strips: ['torso-*-shoot*', 'helium-torso-*-shoot*', 'helium-wob-torso-*-shoot*', 'torso-*-crouch-shoot'], shownTicks: 6 },
  { strips: ['mount'], readPoints: ['hand', 'hip'] },
  { strips: ['mount-hop'], readPoints: ['hip'] },
  { strips: ['timeout-sleep'], readPoints: ['head'] },
  // The run plays looping(TUNING runTicksPerFrame 3): 12 frames × 3 = 36 ticks = 54 px at 1.5 px/tick.
  { strips: ['legs-run'], speed: 1.5, logicTicks: 36 },
  { strips: ['legs-crouch-walk'], speed: 0.75 },
  { strips: ['torso-*-run'], noFoot: 'upper body: drawn at the legs-run frame index (legs index % count)' },
];

/** Machine data per character key (scope.ts SCOPE[].key). */
export const MACHINE: Readonly<Record<string, readonly MachineData[]>> = {
  handhaver: [
    { strips: ['*'], readPoints: [] },
    { strips: ['walk'], speed: 0.6 },
    { strips: ['throw'], events: [ev('THROW_RELEASE', 0, 'frame')] },
    { strips: ['gloat'], events: roles('GLOAT_WRITE', 'GLOAT_WRITE2', 'GLOAT_TEAR', 'GLOAT_DROP', 'GLOAT_DONE') },
  ],
  ...Object.fromEntries(['vincent', 'thom', 'dirk', 'bob', 'patrick'].map((h) => [`hero-${h}`, HERO])),
  'stag-partier': [
    { strips: ['*'], readPoints: [] },
    { strips: ['walk'], speed: 0.7 },
    { strips: ['fire', 'sit-fire'], logicTicks: 21, events: [ev('FIRE_POP', 3, 'frame')] },
    { strips: ['gag-toast'], events: [ev('TOAST_CLINK')] },
  ],
  'beer-bike': [
    { strips: ['*'], readPoints: [] },
    { strips: ['driver'], noFoot: 'pedalling on the bike' },
    { strips: ['driver-flee'], noFoot: 'thrown as a tumble fx (beer-bike.ts: vx 1.7, gravity 0.15), no stepping contact' },
  ],
  'hostage-tourist': [
    { strips: ['*'], readPoints: [] },
    // hostage.ts: handOver() at stateT === giveTicks / 2 (12), from the shown frame's `hand`.
    { strips: ['give'], readPoints: ['hand'], logicTicks: 24, events: [ev('GIVE_HANDOVER', 12, 'tick')] },
    { strips: ['freed'], logicTicks: 20 },
    { strips: ['bow'], logicTicks: 12 },
    { strips: ['gag'], readPoints: ['flash'], events: roles('GAG_CARD', 'GAG_RAISE', 'GAG_FLASH', 'GAG_AFTER') },
    { strips: ['tied'], events: roles('TIED_REST', 'TIED_BLINK', 'TIED_STRUGGLE') },
    { strips: ['walk'], speed: 0.8 },
    { strips: ['run'], speed: 2 },
  ],
  'delivery-rider': [
    { strips: ['*'], readPoints: [] },
    { strips: ['ride', 'tell', 'kick', 'gag', 'gloat', 'idle'], noFoot: 'on the bike (the wheels carry it)' },
    // rider.ts thinkKick: the box is live while modeT <= DELIVERY.kick (6); the leg is out from tick 3.
    { strips: ['kick'], shownTicks: 6, events: [ev('KICK_HIT', 3, 'frame')] },
    { strips: ['flee'], speed: 2 },
  ],
  'fatbike-youth': [
    { strips: ['*'], readPoints: [] },
    { strips: ['ride', 'tell', 'kick', 'gag', 'gloat', 'idle'], noFoot: 'on the bike (the wheels carry it)' },
    // rider.ts thinkKick: the box is live while modeT <= FATBIKE.kick (8); the leg is out from tick 3.
    { strips: ['kick'], shownTicks: 8, events: [ev('KICK_HIT', 3, 'frame')] },
    { strips: ['gloat'], logicTicks: 36 },
    { strips: ['flee'], speed: 2 },
    { strips: ['passenger-flee'], speed: 2.2 },
  ],
  seagull: [
    { strips: ['*'], readPoints: [] },
    { strips: ['walk', 'idle'], noFoot: 'flight (the flap cycle)' },
    { strips: ['takeoff'], logicTicks: 10 },
    { strips: ['pull-up'], logicTicks: 6 },
    { strips: ['gloat'], events: [ev('GLOAT_PECK')] },
  ],
  pigeons: [
    { strips: ['*'], readPoints: [] },
    { strips: ['ams-pigeons'], events: roles('PIGEON_STAND', 'PIGEON_PECK', 'PIGEON_STEP', 'PIGEON_FLAP_A', 'PIGEON_FLAP_B') },
  ],
  ducks: [
    { strips: ['*'], readPoints: [] },
    { strips: ['paddle'], noFoot: 'paddling at the water line', events: roles('DUCK_DRAKE', 'DUCK_HEN') },
  ],
  baker: [
    { strips: ['*'], readPoints: [] },
    { strips: ['toss'], readPoints: ['hand'], events: [ev('TOSS_RELEASE', 14, 'frame')] },
    { strips: ['walk'], speed: 0.8 },
  ],
  'hotdog-vendor': [{ strips: ['*'], readPoints: [] }],
  staff: [
    { strips: ['*'], readPoints: [] },
    { strips: ['walk'], speed: 0.8 },
  ],
  'window-waver': [
    { strips: ['*'], readPoints: [] },
    { strips: ['person'], events: roles('WAVER_EMPTY', 'WAVER_IDLE', 'WAVER_WAVE_A', 'WAVER_WAVE_B') },
  ],
  'scan-car': [
    { strips: ['*'], readPoints: [] },
    { strips: ['cabin'], events: roles('CAB_CALM', 'CAB_SHOUT', 'CAB_SHOCK', 'CAB_AIRBAG', 'CAB_EMPTY') },
    { strips: ['scanner-*'], events: roles('SCAN_DOWN', 'SCAN_LIFT1', 'SCAN_LIFT2', 'SCAN_ON') },
  ],
  mayor: [
    { strips: ['*'], readPoints: [] },
    { strips: ['legs'], events: roles('LEGS_STAND', 'LEGS_SQUAT', 'LEGS_SIT', 'LEGS_HALF_SQUAT', 'LEGS_PUSH_OFF', 'MAYOR_WALK') },
    { strips: ['head-*'], events: roles('HEAD_SMILE', 'HEAD_HATCH', 'HEAD_SHOUT', 'HEAD_BLINK', 'HEAD_OFF', 'HEAD_BALD') },
    { strips: ['stamp-arm-0', 'stamp-arm-1', 'stamp-arm-2'], events: roles('ARM_FRAMES', 'ARM_LOW', 'ARM_RAISED', 'ARM_SLAM', 'ARM_ANTICIPATION', 'ARM_SMEAR', 'ARM_RECOIL') },
    { strips: ['arm-back'], events: roles('BACK_REST', 'BACK_HIGH', 'BACK_LOW', 'BACK_WHIRL_HIGH', 'BACK_WHIRL_LOW') },
    { strips: ['medallion-*'], events: roles('MED_CLOSED', 'MED_OPEN', 'MED_GLOW') },
  ],
  swan: [
    { strips: ['*'], readPoints: ['seat', 'neck', 'hull', 'smoke', 'head'] },
    { strips: ['*neck*'], readPoints: ['muzzle', 'cannon'] },
    { strips: ['*-front', 'egg', 'beak-flash', 'scuffs'], readPoints: [] },
    { strips: ['run'], speed: 6, perFrame: true, events: [ev('RUN_CONTACT_A'), ev('RUN_CONTACT_B')] },
    { strips: ['waddle'], speed: 3, perFrame: true },
    { strips: ['dive'], speed: 8, perFrame: true },
    { strips: ['swim', 'glide', 'glide-tired', 'migrate', 'migrate-soot', 'slide', 'move'], noFoot: 'swims, glides, flies or slides (no stepping contact)' },
    { strips: ['honk', 'honk-air', 'honk-swim'], logicTicks: 20 },
  ],
};

/** The machine fields of one strip of a character (merged over the matching entries in order). */
export function machineFor(character: string, strip: string): {
  readPoints?: string[];
  logicTicks?: number;
  shownTicks?: number;
  events?: ContractEventSpec[];
  speed?: number;
  perFrame?: boolean;
  noFoot?: string;
} {
  const out: { readPoints?: string[]; logicTicks?: number; shownTicks?: number; events?: ContractEventSpec[]; speed?: number; perFrame?: boolean; noFoot?: string } = {};
  for (const m of MACHINE[character] ?? []) {
    if (!m.strips.some((p) => stripMatches(p, strip))) continue;
    if (m.readPoints) out.readPoints = [...new Set(m.readPoints)].sort();
    if (m.logicTicks !== undefined) out.logicTicks = m.logicTicks;
    if (m.shownTicks !== undefined) out.shownTicks = m.shownTicks;
    if (m.events) out.events = [...(out.events ?? []), ...m.events];
    if (m.speed !== undefined) out.speed = m.speed;
    if (m.perFrame !== undefined) out.perFrame = m.perFrame;
    if (m.noFoot !== undefined) out.noFoot = m.noFoot;
  }
  return out;
}
