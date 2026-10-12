/**
 * HUD weapon icons (GDD §13.7: 16×8 at (4, 12), ammo digits at x 22): `ui/icon-<weapon id>`
 * (ARCHITECTURE §7.1) with the GDD aliases `ui/icon-weapon-<id>` and the old art aliases
 * (`rocket`, `flame`, `bouncer`). Side views facing right, top-left anchored, 1 px ink outline,
 * every icon at most 16×8 with its outline. One silhouette per weapon so they read at 1×.
 */
import { ascii, type AsciiKey } from '../../../engine/ascii';
import { INK, PAL } from '../../../engine/palette';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';

const KEY: AsciiKey = {
  // steel (0 dark … 4 light)
  '0': PAL.steel[0],
  '1': PAL.steel[1],
  '2': PAL.steel[2],
  '3': PAL.steel[3],
  '4': PAL.steel[4],
  // wood
  w: PAL.brown[1],
  W: PAL.brown[2],
  // olive
  o: PAL.olive[1],
  O: PAL.olive[2],
  P: PAL.olive[3],
  // crimson
  r: PAL.red[1],
  R: PAL.red[2],
  q: PAL.red[3],
  // teal / cyan
  t: PAL.teal[2],
  T: PAL.teal[3],
  // gold / brass
  g: PAL.gold[0],
  G: PAL.gold[1],
  y: PAL.gold[2],
  Y: PAL.gold[3],
  // ivory, sky
  v: PAL.snow[1],
  V: PAL.snow[3],
  s: PAL.sky[1],
  // flame
  f: PAL.orange[1],
  F: PAL.fire[5],
};

/** Icon drawings (≤ 14×6 inside the outline). */
export const ICON_ROWS: Readonly<Record<string, readonly string[]>> = {
  // A compact service pistol.
  pistol: [
    '.33333334', //
    '.22222223',
    '.1101....',
    '.00......',
    '.00......',
  ],
  // Carry handle, receiver, ventilated shroud, drum magazine, grips.
  'machine-gun': [
    '...111........', //
    '23333333444443',
    '2222222121212.',
    '11111111111111',
    '..00.GyG.00...',
    '.....GGG......',
  ],
  // Wooden stock, long barrel, pump grip.
  shotgun: [
    '...........34.', //
    'WWWW2222222223',
    'wwWW1111111111',
    'ww....wWWw....',
  ],
  // An olive tube with a crimson warhead peeking out, a grip and a sight.
  'rocket-launcher': [
    '....1.........', //
    'POOOOOOOOOOqq.',
    'OoOoooooooOqRR',
    'oooooooooooRr.',
    '.....00.......',
  ],
  // Fuel tank (crimson) under a long nozzle with a pilot flame.
  flamethrower: [
    '.............F', //
    '3333333333332f',
    '2222222222221.',
    '.qRRq..00.....',
    '.RRRr.........',
  ],
  // A sleek emitter with cyan coils and a glowing lens.
  laser: [
    '....tTTt......', //
    '33334TT433333T',
    '2222tttt22222t',
    '..00.....00...',
  ],
  // Two ivory missiles with crimson tips.
  homing: [
    '.vVVVVVVVVq.', //
    '1vvvvvvvvvRq',
    '............',
    '.vVVVVVVVVq.',
    '1vvvvvvvvvRq',
  ],
  // A brass tuba held like a gun: three valve caps on the tubing, the bell flaring forward
  // (side view: a cone that opens to a rim, the dark mouth inside).
  tuba: [
    '...........yY.', //
    '..V.V.V...yyY.',
    '.GyyyyyyyyyggY',
    '.GGGGGGGGGyggY',
    '..oo......yyY.',
    '...........yY.',
  ],
  // The disc mine hopping forward (motion lines behind it).
  'bounce-mine': [
    '........q.....', //
    '......34443...',
    '..yy.GyGyGyG..',
    'yy....22222...',
  ],
  // The hand grenade (the bomb button; GDD: 6×6).
  grenade: [
    '.33.', //
    'PPOo',
    'yYyG',
    'OOoo',
    '.oo.',
  ],
  // The knife (melee).
  knife: [
    '...4444.', //
    'ww333333',
    '...222..',
  ],
};

function icon(rows: readonly string[]): Frame[] {
  return [{ buf: ascii(rows, KEY).padded(1).outline(INK), ox: 0, oy: 0 }];
}

/** HUD icon ids per weapon id: the weapon ids, the GDD names and the old art aliases. */
export const ICON_IDS: Readonly<Record<string, readonly string[]>> = {
  pistol: ['pistol'],
  'machine-gun': ['machine-gun'],
  shotgun: ['shotgun'],
  'rocket-launcher': ['rocket-launcher', 'rocket'],
  flamethrower: ['flamethrower', 'flame'],
  laser: ['laser'],
  homing: ['homing'],
  tuba: ['tuba'],
  'bounce-mine': ['bounce-mine', 'bouncer'],
  grenade: ['grenade'],
  knife: ['knife'],
};

export function defineWeaponIcons(): void {
  const opts = { anchor: 'top-left' } as const;
  for (const [weapon, names] of Object.entries(ICON_IDS)) {
    const gen = (): Frame[] => icon(ICON_ROWS[weapon]);
    for (const n of names) defineSprite(`ui/icon-${n}`, gen, opts);
    defineSprite(`ui/icon-weapon-${weapon}`, gen, opts);
  }
}
