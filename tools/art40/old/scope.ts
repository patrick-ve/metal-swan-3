/**
 * The ids of mission ams that the 40 px work replaces (plan docs/design/ams40.md "Scope").
 * A family matches its exact id and every id below it ('enemy/handhaver' matches
 * 'enemy/handhaver/walk', never 'enemy/handhaver-x/walk'). The contract
 * (docs/design/ams40/contract.json) is the final word; this list is the record of the plan's table
 * for the old-frame dump and the review page.
 */

export interface ScopeFamily {
  /** The character (one review section, one baked set later). */
  character: string;
  /** Plan wave number. */
  wave: number;
  /** Id families: exact id or the id followed by '/'. */
  ids: readonly string[];
}

const heroes = ['vincent', 'thom', 'dirk', 'bob', 'patrick'];
const fatbike = ['', '-0b', '-0c', '-1a', '-1b', '-1c', '-2a', '-2b', '-2c', '-3a', '-3b', '-3c'];
const pairs = ['0a', '0b', '0c', '1a', '1b', '1c', '2a', '2b', '2c', '3a', '3b', '3c'];

export const AMS40_SCOPE: readonly ScopeFamily[] = [
  { character: 'handhaver', wave: 1, ids: ['enemy/handhaver', 'enemy/handhaver-b', 'enemy/handhaver-c', 'enemy/boete-ticket'] },
  ...heroes.map((h) => ({ character: h, wave: 2, ids: [`char/${h}`] })),
  { character: 'stag-partier', wave: 3, ids: ['enemy/stag-partier', 'enemy/stag-partier-1', 'enemy/stag-partier-2', 'enemy/stag-partier-3'] },
  { character: 'stag-groom', wave: 3, ids: ['enemy/stag-groom'] },
  { character: 'beer-bike', wave: 3, ids: ['vehicle/beer-bike', 'enemy/stag-beer-bike', 'enemy/cork'] },
  { character: 'hostage-tourist', wave: 3, ids: ['item/hostage/tourist', 'item/hostage/flash', 'item/bind'] },
  { character: 'delivery-rider', wave: 4, ids: ['enemy/delivery-rider', 'enemy/delivery-rider-a', 'enemy/delivery-rider-c'] },
  {
    character: 'fatbike-youth',
    wave: 4,
    ids: [...fatbike.map((s) => `enemy/fatbike-youth${s}`), ...pairs.map((s) => `enemy/fatbike-youth-pair-${s}`)],
  },
  { character: 'seagull', wave: 4, ids: ['enemy/seagull'] },
  { character: 'pigeons', wave: 4, ids: ['npc/ams/ams-pigeons'] },
  { character: 'ducks', wave: 4, ids: ['npc/ams/ams-ducks'] },
  { character: 'baker', wave: 5, ids: ['npc/ams/ams-baker'] },
  { character: 'hotdog-vendor', wave: 5, ids: ['npc/ams/ams-hotdog-vendor'] },
  { character: 'staff', wave: 5, ids: ['npc/ams/ams-staff'] },
  { character: 'window-waver', wave: 5, ids: ['npc/ams/ams-window-waver'] },
  { character: 'ams-scan', wave: 6, ids: ['boss/ams-scan'] },
  { character: 'ams-mayor', wave: 6, ids: ['boss/ams-mayor'] },
  { character: 'swan', wave: 7, ids: ['vehicle/swan', 'vehicle/swan-mute'] },
];

function under(id: string, fam: string): boolean {
  return id === fam || id.startsWith(`${fam}/`);
}

/** The scope family of an id, or undefined when the id is out of scope. */
export function scopeOf(id: string): ScopeFamily | undefined {
  for (const f of AMS40_SCOPE) if (f.ids.some((fam) => under(id, fam))) return f;
  return undefined;
}

export function inScope(id: string): boolean {
  return scopeOf(id) !== undefined;
}
