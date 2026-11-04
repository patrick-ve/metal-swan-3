/**
 * The art40 rules both sides read: the action classes (classes.ts), the colour budgets of plan D1
 * with the sets allowed the larger ones, and the one shared FX ramp. This TypeScript is the
 * source; tools/art40/rules.json is its copy for the Python bake (tools/art40/art40.py), written by
 * `npm run art40-check -- --write-rules` and pinned by tests/tools/art40-check.test.ts (the two
 * can never drift).
 */
import { ACTION_CLASSES, CLASS_ALIASES } from './classes';

export const RULES_PATH = 'tools/art40/rules.json';

/** The colour budgets of plan D1: figures 28, machines and multi-part sprites 40, the mayor 64. */
export const BUDGETS: readonly number[] = [28, 40, 64];

/**
 * The set slugs allowed a budget above 28 (plan D1). 40: the machines and multi-part sprites (the
 * beer bike, the scan car with tow truck and clamp, the Swan; add a slug here when its set lands
 * as its own file). 64: the mayor only.
 */
export const BUDGET_SLUGS: Readonly<Record<number, readonly string[]>> = {
  40: ['beer-bike', 'ams-scan', 'ams-tow-truck', 'ams-wheel-clamp', 'swan', 'swan-neck', 'swan-water'],
  64: ['ams-mayor', 'select-vincent', 'select-thom', 'select-dirk', 'select-bob', 'select-patrick'],
};

/** Is `budget` allowed for the set `slug` ('_' fixture sets may use 28 and 40)? */
export function budgetAllowed(slug: string, budget: number): boolean {
  if (!BUDGETS.includes(budget)) return false;
  if (budget === 28) return true;
  if (budget === 40 && slug.startsWith('_')) return true;
  return (BUDGET_SLUGS[budget] ?? []).includes(slug);
}

/**
 * The one shared FX ramp (plan "Rules: colour design": "the character's palette plus a small shared
 * FX ramp"): flash and flame (white to deep orange), water and splash (two blues), soot (two warm
 * greys). A set's `fx` indices must hold colours of this ramp only; they are outside its budget.
 * The flash and water tones are the approved squad spike's effect colours.
 */
export const FX_RAMP: readonly string[] = [
  '#ffffff',
  '#fffbd8',
  '#ffe070',
  '#ffd040',
  '#ff8a24',
  '#e0401c',
  '#bfe4ff',
  '#7fb4e8',
  '#7a6e70',
  '#4a4046',
];

/** The JSON text of tools/art40/rules.json (stable key order). */
export function rulesJson(): string {
  const classes = ACTION_CLASSES.map((c) => ({ name: c.name, min: c.min, ...(c.max !== undefined ? { max: c.max } : {}), ...(c.foot ? { foot: true } : {}), ...(c.why ? { why: true } : {}) }));
  const j = {
    about: 'GENERATED from tools/art40/check/rules.ts and classes.ts by `npm run art40-check -- --write-rules`; do not edit.',
    budgets: BUDGETS,
    budgetSlugs: BUDGET_SLUGS,
    fxRamp: FX_RAMP,
    classes,
    aliases: CLASS_ALIASES,
  };
  return `${JSON.stringify(j, null, 1)}\n`;
}
