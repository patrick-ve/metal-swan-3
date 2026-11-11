/**
 * The dense aliases of the game content (sprites.ts `defineDenseAlias`; tier-4 memory, the UHD
 * budget's first cut "share identical art"): ids whose 2× / 4× art is the same picture as another
 * id's show that id's frames, so the tier-4 working set holds each picture once.
 * - every alias names a target with its own generator and has the target's 1× geometry (frame
 *   count, logical size, anchor, points), at 2× and at 4× alike;
 * - the known identical strips are aliases: the noon
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
    // 174 + 14 HUD weapon icon names (weapons/icons.art.ts: the GDD `ui/icon-weapon-<id>` names
    // and the old art names rocket / flame / bouncer show the weapon's own icon), minus the Swan's
    // 6 (move, move-front, swim-neck-relax in P1 and P2: 1× baked art, docs/design/ams40.md wave 7),
    // minus the delivery rider's 2 (the bike of skins a and c: 1× baked art, wave 4), minus the
    // fatbike youth look 0's 29 (1× baked art, wave 4: the bike of skins b and c, the 8 rider-only
    // strips of the pairs 0a-0c, the passenger-flee of the pairs 2a-2c, whose passenger is look 0),
    // minus the gull's idle (1× baked art, wave 4: its own hover flap, tests/art40/seagull.test.ts),
    // minus the fatbike looks 1-3 and pairs' 95 (1× baked art, wave 4 stage 2: the bikes of skins b
    // and c, the pairs' rider-only strips and passenger-flee; tests/art40/fatbike-youth-looks.test.ts).
    expect(four.length).toBe(55);
    for (const [id, target] of four) {
      expect(hasSprite(id) && hasSprite(target), id).toBe(true);
      expect(denseTarget(target, 4), id).toBe(target);
      expect(hasHiSprite(target, 4) && hasHiSprite(target, 2), id).toBe(true);
      expect(geometry(getFrames(id, 1)), id).toEqual(geometry(getFrames(target, 1)));
    }
  });

  it('the identical strips are aliases', () => {
    const expected: Array<[string, string]> = [
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
    // The fatbike youths are baked 1× art (wave 4): no fatbike id is an alias any more.
    for (const [id] of listDenseAliases(4)) expect(id.startsWith('enemy/fatbike-youth'), id).toBe(false);
  });

  it('an alias draws its target frames without an error', () => {
    for (const id of ['item/pickup-gem', 'fx/muzzle-up']) {
      expect(getFrames(id, 2), id).toBe(getFrames(denseTarget(id, 2), 2));
      expect(getFrames(id, 2)[0].density, id).toBe(2);
    }
    expect(spriteErrors().filter((e) => e.id.endsWith('@2x'))).toEqual([]);
  });
});
