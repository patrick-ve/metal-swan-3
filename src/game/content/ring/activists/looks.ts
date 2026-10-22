/**
 * The looks of the blockade's people (wave B; docs/design/ring.md §R.6, §R.9): fictional, varied,
 * likeable comic characters — knitted hats, rain jackets, jumpers, glasses, beards, every skin tone —
 * never a likeness of a real person. Pure data (the kinds pick a look, the art draws it).
 *
 * Two looks per kind; an activist's look comes from its spawn param `look` ('a' | 'b'), else from its
 * spawn x (deterministic, no rng). The police wear our own plain navy uniform with a hi-vis band and
 * `POLITIE` in our own lettering on the back at 4× (no real force's emblem).
 *
 * Art prefixes (never under the prefixes `ams` preloads): `npc/ring/act-<kind>/<look>/…`,
 * `npc/ring/agent/<look>/…`, `npc/ring/prop/…` (barrel, crate, signs), `fx/ring/act/…`.
 */
import type { HumanStyle } from '../../../art/humanoid';
import type { ActivistKind } from './api';

export type Look = 'a' | 'b';
export const LOOKS: readonly Look[] = ['a', 'b'];

/** The look of a spawn: the `look` param, else alternating by the spawn x (16 px columns). */
export function lookOf(x: number, param: unknown): Look {
  if (param === 'a' || param === 'b') return param;
  return Math.floor(x / 16) % 2 === 0 ? 'a' : 'b';
}

/** The activists' looks (by kind, then look). */
export const ACT_STYLE: Readonly<Record<ActivistKind, Readonly<Record<Look, HumanStyle>>>> = {
  lijmer: {
    // A yellow rain jacket and a green knitted bobble hat, long brown hair.
    a: { skin: 'skinB', hair: 'hairB', hairStyle: 'long', headgear: 'bobble', gear: 'green', top: 'gold', topType: 'coat', shirt: 'snow', pants: 'navy', boots: 'brown', build: 'slim', face: ['freckles'] },
    // A hand-knitted purple jumper, curly hair, round glasses.
    b: { skin: 'skinC', hair: 'hairA', hairStyle: 'curly', headgear: 'none', top: 'purple', topType: 'sweater', pants: 'olive', boots: 'black', build: 'normal', face: ['glasses', 'eyeshine'], accessories: ['scarf'], accent: 'orange' },
  },
  ketting: {
    // A teal anorak, a ginger bob, a satchel.
    a: { skin: 'skinA', hair: 'hairC', hairStyle: 'bob', headgear: 'none', top: 'teal', topType: 'coat', shirt: 'sand', pants: 'navy', boots: 'brown', build: 'normal', face: ['freckles'], accessories: ['satchel'], belt: 'brown' },
    // A sky-blue jacket, a beard and a striped knitted hat.
    b: { skin: 'skinB', hair: 'hairA', hairStyle: 'short', headgear: 'bobble', gear: 'orange', top: 'sky', topType: 'jacket', shirt: 'snow', pants: 'stone', boots: 'black', build: 'stocky', face: ['beard'] },
  },
  megafoon: {
    // A bright orange rain jacket with the hood down, a ponytail.
    a: { skin: 'skinA', hair: 'hairB', hairStyle: 'ponytail', headgear: 'none', top: 'orange', topType: 'coat', shirt: 'snow', pants: 'navy', boots: 'olive', build: 'slim', accessories: ['backpack'] },
    // A woolly green jumper, a scarf, a big beard, bald on top.
    b: { skin: 'skinC', hair: 'hairA', hairStyle: 'tufts', headgear: 'none', top: 'green', topType: 'sweater', pants: 'stone', boots: 'black', build: 'heavy', face: ['beard', 'glasses', 'eyeshine'], accessories: ['scarf'], accent: 'purple' },
  },
  loper: {
    // A rain hat and a sky-blue anorak.
    a: { skin: 'skinC', hair: 'hairA', hairStyle: 'puffs', headgear: 'rainhat', gear: 'gold', top: 'sky', topType: 'coat', shirt: 'snow', pants: 'navy', boots: 'snow', build: 'slim', face: ['eyeshine'] },
    // A navy knitted hat, a mustard jumper, a backpack.
    b: { skin: 'skinA', hair: 'hairC', hairStyle: 'short', headgear: 'bobble', gear: 'navy', top: 'gold', topType: 'sweater', pants: 'olive', boots: 'brown', build: 'lanky', face: ['stubble'], accessories: ['backpack'] },
  },
};

/** The police officers' looks: our own plain navy uniform, a cap, a hi-vis band; no emblem. */
export const AGENT_STYLE: Readonly<Record<Look, HumanStyle>> = {
  a: { skin: 'skinA', hair: 'hairB', hairStyle: 'short-crop', headgear: 'cap', gear: 'navy', top: 'navy', topType: 'jacket', shirt: 'sky', pants: 'navy', boots: 'black', build: 'normal', belt: 'black', gloves: null, accessories: ['hivis', 'radio'] },
  b: { skin: 'skinC', hair: 'hairA', hairStyle: 'buzz', headgear: 'cap', gear: 'navy', top: 'navy', topType: 'jacket', shirt: 'sky', pants: 'navy', boots: 'black', build: 'stocky', belt: 'black', gloves: null, accessories: ['hivis', 'radio'] },
};

/** Art prefixes. */
export const ACT_ART = {
  /** `npc/ring/act-<kind>/<look>` */
  kind: (kind: ActivistKind, look: Look): string => `npc/ring/act-${kind}/${look}`,
  agent: (look: Look): string => `npc/ring/agent/${look}`,
  /** Props on the road (the chain's barrel, the megaphone's crate) and the hand-painted signs. */
  barrel: 'npc/ring/prop/barrel',
  crate: 'npc/ring/prop/crate',
  /** `npc/ring/prop/sign-<i>` (BANNERS[i]), `npc/ring/prop/sign-gezegd` (the continue sign). */
  sign: (i: number): string => `npc/ring/prop/sign-${i}`,
  signGezegd: 'npc/ring/prop/sign-gezegd',
  /** A dropped banner lying on the road (the loper's, hit before the glue set). */
  signDropped: 'npc/ring/prop/sign-dropped',
  /** The effects: thrown things, splats, puddles, the shout rings, the squeal, notes, glue strands. */
  balloon: 'fx/ring/act/balloon',
  splat: 'fx/ring/act/splat',
  pot: 'fx/ring/act/pot',
  can: 'fx/ring/act/can',
  soup: 'fx/ring/act/soup',
  glue: 'fx/ring/act/glue',
  shout: 'fx/ring/act/shout',
  squeal: 'fx/ring/act/squeal',
  note: 'fx/ring/act/note',
  strands: 'fx/ring/act/strands',
  links: 'fx/ring/act/links',
} as const;

/** The paint balloons' colours (bright; never red: no blood look). */
export const PAINT_COLOURS = ['pink', 'gold', 'sky', 'green'] as const;
export type PaintColour = (typeof PAINT_COLOURS)[number];
