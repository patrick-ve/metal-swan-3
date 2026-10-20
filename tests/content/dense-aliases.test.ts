/**
 * The dense aliases of the game content (sprites.ts `defineDenseAlias`; tier-4 memory, the UHD
 * budget's first cut "share identical art"): ids whose 2× / 4× art is the same picture as another
 * id's show that id's frames, so the tier-4 working set holds each picture once.
 * - every alias names a target with its own generator and has the target's 1× geometry (frame
 *   count, logical size, anchor, points), at 2× and at 4× alike;
 * - the known identical strips are aliases: a fatbike pair set's rider-only strips (its solo
 *   twin's), its passenger-flee (the passenger's solo flee), the bike per skin (skin a's), the
 *   delivery bike, the Swans' move / move-front / swim-neck-relax, the gull's idle, the noon
 *   houses (morning), the second names of pickups, shots and flashes;
 * - an alias draws its target's frames without an error.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { denseTarget, getFrames, hasHiSprite, hasSprite, listDenseAliases, spriteErrors, type Frame } from '../../src/engine/sprites';
import { isLazyContent, loadContent } from '../../src/game/content/index';

beforeAll(async () => {
  await loadContent((id) => !isLazyContent(id));
}, 120_000);

/** The 1× geometry of a strip: per frame its logical size, anchor and points. */
const geometry = (fs: readonly Frame[]): unknown[] => fs.map((f) => [f.buf.w / (f.density ?? 1), f.buf.h / (f.density ?? 1), f.ox, f.oy, f.pts ?? null]);

describe('dense aliases of the content', () => {
  it('every alias names a target with its own generator and has its 1× geometry, the same at 2× and 4×', () => {
    const four = listDenseAliases(4);
    expect(four).toEqual(listDenseAliases(2));
    expect(four.length).toBe(174);
    for (const [id, target] of four) {
      expect(hasSprite(id) && hasSprite(target), id).toBe(true);
      expect(denseTarget(target, 4), id).toBe(target);
      expect(hasHiSprite(target, 4) && hasHiSprite(target, 2), id).toBe(true);
      expect(geometry(getFrames(id, 1)), id).toEqual(geometry(getFrames(target, 1)));
    }
  });

  it('the identical strips are aliases', () => {
    const P = 'enemy/fatbike-youth';
    const expected: Array<[string, string]> = [
      [`${P}-pair-0a/die`, `${P}/die`],
      [`${P}-pair-1b/die-knife`, `${P}-1b/die-knife`],
      [`${P}-pair-3c/get-up`, `${P}-3c/get-up`],
      [`${P}-pair-2a/flee`, `${P}-2a/flee`],
      // The passenger of pair (look, skin) is the solo set ((look + 2) % 4, a → c, b → a, c → b).
      [`${P}-pair-2c/passenger-flee`, `${P}-0b/flee`],
      [`${P}-pair-0a/passenger-flee`, `${P}-2c/flee`],
      [`${P}-0c/bike`, `${P}/bike`],
      [`${P}-pair-3b/bike`, `${P}-pair-3a/bike`],
      ['enemy/delivery-rider-a/bike', 'enemy/delivery-rider/bike'],
      ['vehicle/swan/move', 'vehicle/swan/run'],
      ['vehicle/swan-mute/move-front', 'vehicle/swan-mute/run-front'],
      ['vehicle/swan/swim-neck-relax', 'vehicle/swan/neck-relax'],
      ['enemy/seagull/idle', 'enemy/seagull/walk'],
      ['decor/ams/house-noon', 'decor/ams/house-morning'],
      ['decor/ams/fabel-friet-noon', 'decor/ams/fabel-friet-morning'],
      ['item/pickup-r', 'item/pickup-weapon/rocket-launcher'],
      ['item/pickup-food', 'item/pickup-food/bread'],
      ['weapon/bullet-pistol', 'weapon/bullet'],
      ['enemy/bullet', 'weapon/enemy-bullet'],
      ['fx/muzzle-machine-gun-diag', 'fx/muzzle-heavy-diag'],
      ['fx/hit-spark', 'fx/hit'],
    ];
    for (const [id, target] of expected) for (const d of [2, 4]) expect(denseTarget(id, d), `${id} @${d}x`).toBe(target);
    // A pair's strips with the bike and both riders stay its own art.
    for (const own of [`${P}-pair-0a/ride`, `${P}-pair-0a/kick`, `${P}-0a/die`, `${P}/ride`]) expect(denseTarget(own, 4), own).toBe(own);
  });

  it('an alias draws its target frames without an error', () => {
    for (const id of ['enemy/fatbike-youth-pair-1a/die-crush', 'enemy/fatbike-youth-2b/bike', 'vehicle/swan/move', 'item/pickup-gem', 'fx/muzzle-up']) {
      expect(getFrames(id, 2), id).toBe(getFrames(denseTarget(id, 2), 2));
      expect(getFrames(id, 2)[0].density, id).toBe(2);
    }
    expect(spriteErrors().filter((e) => e.id.endsWith('@2x'))).toEqual([]);
  });
});
