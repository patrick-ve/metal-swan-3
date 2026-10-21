/**
 * Mission oldenzaal — the looks of the townspeople (docs/design/oldenzaal.md §3.1): Oldenzaal
 * people in their daily clothes. Every host (shambler, gunner, brute) is one of them, and a freed
 * host is the same person again (an `oz-townsperson` with the same `look`). Owner: POSSESSED.
 *
 * Pure data (the styles are plain records; `HumanStyle` is a type-only import), so the logic
 * (./index.ts) and the art (./art.ts) both read it.
 *
 * | look | who | kinds |
 * |---|---|---|
 * | `shopper` | a woman with a shopping bag, a long red coat | shambler, gunner |
 * | `jogger` | a lanky jogger in a tee | shambler, gunner |
 * | `student` | a student: a sweater, a backpack, glasses | shambler, gunner |
 * | `vendor` | a market vendor: a beanie, a bodywarmer over a check shirt, a money bag | shambler, gunner |
 * | `pensioner` | a pensioner: a flat cap, a tweed coat, a walking stick | shambler, gunner |
 * | `butcher` | the butcher: a white shirt, a striped apron | brute |
 * | `bouncer` | a bouncer: a black jacket, a buzz cut | brute |
 * | `churchgoer` | a man in his Sunday coat and tie (the nave, wave B) | shambler, gunner |
 * | `churchgoer-b` | a woman in a Sunday coat, a beret and a scarf (the nave, wave B) | shambler, gunner |
 */
import type { HumanStyle } from '../../../art/humanoid';

export const OZ_LOOKS = ['shopper', 'jogger', 'student', 'vendor', 'pensioner', 'butcher', 'bouncer', 'churchgoer', 'churchgoer-b'] as const;
export type OzLook = (typeof OZ_LOOKS)[number];

/** Looks of the slim hosts (shambler, gunner). */
export const OZ_HOST_LOOKS: readonly OzLook[] = ['shopper', 'jogger', 'student', 'vendor', 'pensioner', 'churchgoer', 'churchgoer-b'];
/** The street's pool (a host or townsperson without a `look` param picks one of these). */
export const OZ_STREET_LOOKS: readonly OzLook[] = ['shopper', 'jogger', 'student', 'vendor', 'pensioner'];
/** Looks of the big hosts (brute). */
export const OZ_BRUTE_LOOKS: readonly OzLook[] = ['butcher', 'bouncer'];
/** The churchgoers (the nave, wave B; their strips are deferred). */
export const OZ_CHURCH_LOOKS: readonly OzLook[] = ['churchgoer', 'churchgoer-b'];

/** Is `s` a look id? */
export function isOzLook(s: unknown): s is OzLook {
  return typeof s === 'string' && (OZ_LOOKS as readonly string[]).includes(s);
}

/** Extra pieces a look carries that the rig does not draw (art.ts draws them). */
export interface LookExtras {
  /** The butcher's striped apron (between the legs and the torso). */
  apron?: boolean;
  /** The pensioner's walking stick (in the far hand while he walks or stands). */
  stick?: boolean;
}

export const OZ_LOOK_EXTRAS: Readonly<Partial<Record<OzLook, LookExtras>>> = {
  butcher: { apron: true },
  pensioner: { stick: true },
};

/** The people's styles (the human rig; cold, muted daily colours with one warm accent each). */
export const OZ_LOOK_STYLES: Readonly<Record<OzLook, HumanStyle>> = {
  shopper: {
    skin: 'skinA', hair: 'hairC', hairStyle: 'bob', headgear: 'none',
    top: 'red', topType: 'coat', shirt: 'stone', pants: 'slate', boots: 'brown', belt: 'brown',
    gloves: null, build: 'slim', accessories: ['satchel'], accent: 'gold',
  },
  jogger: {
    skin: 'skinB', hair: 'hairA', hairStyle: 'short', headgear: 'none',
    top: 'teal', topType: 'tee', pants: 'black', boots: 'snow', belt: 'black',
    gloves: null, build: 'lanky', face: ['stubble'],
  },
  student: {
    skin: 'skinC', hair: 'hairA', hairStyle: 'curly', headgear: 'none',
    top: 'olive', topType: 'sweater', pants: 'navy', boots: 'black', belt: 'black',
    gloves: null, build: 'slim', accessories: ['backpack'], face: ['glasses'],
  },
  vendor: {
    skin: 'skinB', hair: 'hairC', hairStyle: 'short', headgear: 'bobble', gear: 'navy', accent: 'gold',
    top: 'navy', topType: 'vest', shirt: 'red', pants: 'olive', boots: 'brown', belt: 'brown',
    gloves: null, build: 'normal', accessories: ['satchel'], face: ['moustache'],
  },
  pensioner: {
    skin: 'skinA', hair: 'snow', hairStyle: 'tufts', headgear: 'cap', gear: 'slate', accent: 'brown',
    top: 'brown', topType: 'coat', shirt: 'cloth', pants: 'slate', boots: 'black', belt: 'brown',
    gloves: null, build: 'slim', accessories: ['tweed', 'scarf'], face: ['glasses'],
  },
  butcher: {
    skin: 'skinA', hair: 'hairB', hairStyle: 'buzz', headgear: 'none',
    top: 'cloth', topType: 'shirt', pants: 'slate', boots: 'black', belt: 'black',
    gloves: null, build: 'brute', face: ['moustache'],
  },
  bouncer: {
    skin: 'skinC', hair: 'hairA', hairStyle: 'buzz', headgear: 'none',
    top: 'slate', topType: 'jacket', shirt: 'black', pants: 'black', boots: 'black', belt: 'black',
    gloves: null, build: 'brute', face: ['beard'],
  },
  churchgoer: {
    skin: 'skinB', hair: 'hairB', hairStyle: 'parted', headgear: 'none', accent: 'red',
    top: 'navy', topType: 'coat', shirt: 'cloth', pants: 'slate', boots: 'black', belt: 'black',
    gloves: null, build: 'normal', accessories: ['tie'],
  },
  'churchgoer-b': {
    skin: 'skinA', hair: 'hairB', hairStyle: 'bob', headgear: 'beret', gear: 'purple', accent: 'gold',
    top: 'purple', topType: 'coat', shirt: 'stone', pants: 'black', boots: 'black', belt: 'black',
    gloves: null, build: 'slim', accessories: ['scarf'],
  },
};

/** The kinds' art prefixes per look (`enemy/oz-shambler/<look>`, `enemy/oz-brute/<look>`, `npc/oz-town/<look>`). */
export const hostArt = (look: OzLook): string => (OZ_BRUTE_LOOKS.includes(look) ? `enemy/oz-brute/${look}` : `enemy/oz-shambler/${look}`);
export const townArt = (look: OzLook): string => `npc/oz-town/${look}`;
