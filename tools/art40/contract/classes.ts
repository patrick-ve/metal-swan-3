/**
 * The plan's action class table (docs/design/ams40.md "The reference (numbers only)") and the
 * rule that maps a strip name to its class and target frame count. The frame counts come from the
 * private reference sheet (numbers only); the names are ours.
 */

export interface ActionClass {
  /** Class id (stable, used in contract.json). */
  readonly id: string;
  /** Readable name (the plan's table). */
  readonly name: string;
  /** Reference frame count as the plan writes it ("10–12", "6 (+ 6 second variant)"). */
  readonly ref: string;
  /** Target frame count for a replacement (the low end of the reference range). */
  readonly target: number | null;
}

export const CLASSES: Readonly<Record<string, ActionClass>> = {
  'idle-breath': { id: 'idle-breath', name: 'Idle breathing', ref: '4', target: 4 },
  'idle-fidget': { id: 'idle-fidget', name: 'Idle fidget', ref: '8–18', target: 8 },
  locomotion: { id: 'locomotion', name: 'Locomotion cycle', ref: '12 (run 12 + 12 torso)', target: 12 },
  'crouch-walk': { id: 'crouch-walk', name: 'Crouch walk', ref: '7', target: 7 },
  shoot: { id: 'shoot', name: 'Shoot', ref: '10 (flash, recoil, settle)', target: 10 },
  throw: { id: 'throw', name: 'Throw', ref: '6', target: 6 },
  melee: { id: 'melee', name: 'Melee', ref: '6 (+ 6 second variant)', target: 6 },
  'death-shot': { id: 'death-shot', name: 'Death, shot', ref: '10–12', target: 10 },
  'death-blast': { id: 'death-blast', name: 'Death, blast', ref: '10', target: 10 },
  'death-burn': { id: 'death-burn', name: 'Death, burn', ref: '≈ 7 (+ ash)', target: 7 },
  'death-crush': { id: 'death-crush', name: 'Death, crushed', ref: '≈ 5', target: 5 },
  victory: { id: 'victory', name: 'Victory, cheer', ref: '6–8', target: 6 },
  respawn: { id: 'respawn', name: 'Respawn, get up', ref: '6', target: 6 },
  jump: { id: 'jump', name: 'Jump (take-off)', ref: '6–7', target: 6 },
  fall: { id: 'fall', name: 'Fall', ref: '2', target: 2 },
  land: { id: 'land', name: 'Land', ref: '3', target: 3 },
  mount: { id: 'mount', name: 'Mount', ref: '5–6', target: 5 },
  'mount-hop': { id: 'mount-hop', name: 'Mount, hop', ref: '5', target: 5 },
  // Classes outside the reference table: the count stays what the code needs (or a logged reason).
  telegraph: { id: 'telegraph', name: 'Telegraph (no reference class; length = the tele ticks)', ref: '-', target: null },
  held: { id: 'held', name: 'Held pose (no reference class; the code holds it)', ref: '-', target: null },
  reaction: { id: 'reaction', name: 'Reaction loop (cower, panic; nearest class: idle fidget)', ref: '8–18', target: null },
  turn: { id: 'turn', name: 'Turn / transition (code-driven squash or in-between; count read by code)', ref: '-', target: null },
  mechanical: { id: 'mechanical', name: 'Mechanical / rigid part (keeps its mechanical count)', ref: '-', target: null },
  prop: { id: 'prop', name: 'Prop or effect of the strip (bind, ticket, cork, flash, debris)', ref: '-', target: null },
  aim: { id: 'aim', name: 'Aim pose (frames indexed by the aim step; count = the aim steps)', ref: '-', target: null },
  overlay: { id: 'overlay', name: 'Front overlay (drawn with its body strip’s frame index: same count)', ref: '-', target: null },
  piece: { id: 'piece', name: 'Piece of a composed boss rig (frames indexed by role in the code)', ref: '-', target: null },
  roles: { id: 'roles', name: 'Frame roles picked by code (each frame one pose; count = the roles)', ref: '-', target: null },
  ui: { id: 'ui', name: 'UI picture (out of scope: select panels, portraits)', ref: '-', target: null },
  other: { id: 'other', name: 'Unclassed (decide per strip; log the reason)', ref: '-', target: null },
};

/** Characters whose strips are machines or rigid parts by default (plan: "Wheels, scanners …"). */
export type Kind = 'person' | 'hero' | 'animal' | 'machine' | 'boss-robot' | 'mount' | 'prop';

/**
 * The class of a strip, from its last name segment(s) and the character kind. Heroes use their
 * strip names (`legs-run`, `torso-shoot`, `knife`, …) without the part prefix.
 */
export function classify(strip: string, kind: Kind): ActionClass {
  const s = strip.replace(/^helium-(wob-)?/, '').replace(/^(legs|torso|full)-/, '').replace(/^(pistol|heavy)-/, '');
  const c = (id: string): ActionClass => CLASSES[id];
  if (kind === 'prop') return c('prop');
  if (/^(portrait|select|select-grey)$/.test(s)) return c('ui');
  if (/^(egg|beak-flash|scuffs|cap|food-cube|flash|veil|feather|noise-letter|shield-shot|stamp-wave|bike|fly|star|steam|note|case-open)$/.test(s)) return c('prop');
  if (/-front$/.test(s)) return c('overlay');
  if (/^(ams-pigeons|ams-ducks|person)$/.test(s)) return c('roles');
  if (kind === 'boss-robot') return c('piece');
  if (/(^|\/)(turn|sack-turn)$/.test(s) || /^in-/.test(s) || /^crouch-(in|out)$/.test(s)) return c('turn');
  if (kind === 'machine' && !/^(driver|driver-flee)$/.test(s)) return c('mechanical');
  if (/^(idle|perch|crouch|sit|empty|empty-look|water-duck)$/.test(s)) return c('idle-breath');
  if (/^(gag|gag-.+|talk|bored|fidget-.+|timeout-yawn|timeout-sleep|tied|caged|mast|dangle|chute|sack|cat|cat-swish|person|lean|blink)$/.test(s)) return c('idle-fidget');
  if (/^(tell|sit-tell|alert|hiss)$/.test(s)) return c('telegraph');
  if (/^(crouch-walk|waddle)$/.test(s)) return c('crouch-walk');
  if (/^(walk|run|move|driver|flee|ride|swim|paddle|dive|driver-flee|passenger-flee|slide|glide|glide-tired|migrate|migrate-soot|fly)$/.test(s)) return c('locomotion');
  if (/^(fire|sit-fire|shoot|shoot-.+|crouch-shoot|honk|honk-air|honk-swim|attack)$/.test(s)) return c('shoot');
  if (/^(throw|toss|crouch-throw)$/.test(s)) return c('throw');
  if (/^(kick|knife|knife-b|crouch-knife|bash|stomp)$/.test(s)) return c('melee');
  if (/^(die|die-knife|die-stool|die-seat|die-drown|die-flat|wreck|tumble|dazed)$/.test(s)) return c('death-shot');
  if (s === 'die-blast') return c('death-blast');
  if (s === 'die-burn') return c('death-burn');
  if (s === 'die-crush') return c('death-crush');
  if (/^(cheer|clap|wave|gloat|sit-gloat|victory|salute|bow|give|freed|photo-pose|flip)$/.test(s)) return c('victory');
  if (/^(spawn|get-up|rise|right|shake|sit-down|settle|empty-lay)$/.test(s)) return c('respawn');
  if (/^(jump|takeoff|squat|paddle-up|flap|pull-up)$/.test(s)) return c('jump');
  if (s === 'fall' || s === 'fold') return c('fall');
  if (s === 'land' || s === 'skid') return c('land');
  if (s === 'mount') return c('mount');
  if (s === 'mount-hop') return c('mount-hop');
  if (/^(cower|sit-cower|panic|dangle)$/.test(s)) return c('reaction');
  if (/^(up|down|diag-up|diag-down|neck.*|swim-neck.*|crouch-neck.*|duck-neck.*)$/.test(s)) return c('aim');
  if (/^ride-/.test(s)) return c('held');
  return c('other');
}
