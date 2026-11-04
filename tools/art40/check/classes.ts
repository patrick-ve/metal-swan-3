/**
 * The action classes of the plan (docs/design/ams40.md "The reference (numbers only)"): the frame
 * count a strip of the class needs. A strip below `min` needs a logged `why`; above `max` is a
 * warning. `foot`: the foot-slide gate applies (ground locomotion). Names are the plan's class
 * names in kebab case; the contract's class ids (docs/design/ams40/contract.json `classes`) and the
 * short names are accepted as aliases. ONE table for the check, the contract and the bake: the
 * bake reads it from tools/art40/rules.json (rules.ts writes it).
 */

export interface ActionClass {
  name: string;
  min: number;
  max?: number;
  foot?: true;
  /** A strip of this class always needs a logged reason (`why`). */
  why?: true;
  /** What the plan uses the class for (documentation, review page). */
  use: string;
}

export const ACTION_CLASSES: readonly ActionClass[] = [
  { name: 'idle-breathing', min: 4, use: 'every idle' },
  { name: 'idle-fidget', min: 8, max: 18, use: 'gag-*, talk, bored, fidget-*' },
  { name: 'locomotion', min: 12, foot: true, use: 'walk, run, flee, Swan run / move' },
  { name: 'ride', min: 12, use: 'ride (pedalling), a bird flap cycle: the locomotion count without a ground foot' },
  { name: 'crouch-walk', min: 7, foot: true, use: 'crouched moves' },
  { name: 'shoot', min: 10, use: 'fire, sit-fire, hero shoot strips' },
  { name: 'throw', min: 6, use: 'throw, toss, hero grenade' },
  { name: 'melee', min: 6, use: 'kick, hero knife' },
  { name: 'death-shot', min: 10, max: 12, use: 'die' },
  { name: 'death-blast', min: 10, use: 'die-blast' },
  { name: 'death-burn', min: 7, use: 'die-burn' },
  { name: 'death-crush', min: 5, use: 'die-crush' },
  { name: 'victory', min: 6, max: 8, use: 'cheer, clap, wave, gloat, victory' },
  { name: 'respawn', min: 6, use: 'spawn, get-up' },
  { name: 'jump', min: 6, max: 7, use: 'jumps, takeoff' },
  { name: 'fall', min: 2, use: 'falls' },
  { name: 'land', min: 3, use: 'land' },
  { name: 'mount', min: 5, max: 6, use: 'mount' },
  { name: 'hop', min: 5, use: 'mount-hop' },
  // No reference count (the contract's classes without a target; the count is a code number).
  { name: 'mechanical', min: 1, use: 'rigid machine parts with their own counts (4-step wheels, scanners)' },
  { name: 'held', min: 1, use: 'a held pose the code holds' },
  { name: 'prop', min: 1, use: 'a prop or effect of the strip (bind, ticket, cork, flash, debris)' },
  { name: 'telegraph', min: 1, use: 'a telegraph (length = the tele ticks)' },
  { name: 'reaction', min: 1, max: 18, use: 'a reaction loop (cower, panic; nearest class idle fidget)' },
  { name: 'turn', min: 1, use: 'a turn or in-between whose count the code reads' },
  { name: 'aim', min: 1, use: 'an aim pose (frames indexed by the aim step)' },
  { name: 'overlay', min: 1, use: 'a front overlay drawn with its body strip frame index' },
  { name: 'piece', min: 1, use: 'a piece of a composed boss rig' },
  { name: 'roles', min: 1, use: 'frame roles picked by code' },
  { name: 'ui', min: 1, use: 'a UI picture (out of scope)' },
  { name: 'other', min: 1, why: true, use: 'unclassed: needs a logged reason (why)' },
];

/** Other names of the classes (the bake's short names, the contract's ids, plain words). */
export const CLASS_ALIASES: Readonly<Record<string, string>> = {
  idle: 'idle-breathing',
  'idle-breath': 'idle-breathing',
  breathing: 'idle-breathing',
  fidget: 'idle-fidget',
  loco: 'locomotion',
  walk: 'locomotion',
  run: 'locomotion',
  crouch: 'crouch-walk',
  fire: 'shoot',
  die: 'death-shot',
  death: 'death-shot',
  'die-blast': 'death-blast',
  'die-burn': 'death-burn',
  'die-crush': 'death-crush',
  cheer: 'victory',
  'victory-cheer': 'victory',
  'respawn-get-up': 'respawn',
  'get-up': 'respawn',
  pedal: 'ride',
  flap: 'ride',
  'mount-hop': 'hop',
  machine: 'mechanical',
  mech: 'mechanical',
  part: 'held',
  hold: 'held',
  pose: 'held',
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** The class for a strip's `cls`, or undefined when unknown. */
export function actionClass(cls: string): ActionClass | undefined {
  const n = norm(cls);
  const name = CLASS_ALIASES[n] ?? n;
  return ACTION_CLASSES.find((c) => c.name === name);
}
