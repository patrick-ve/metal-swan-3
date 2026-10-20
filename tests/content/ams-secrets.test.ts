/**
 * The ams secrets (docs/design/ams-extras.md §5): `ams-secret` (secrets.ts) and its art
 * (secrets.art.ts): reveals by hits, the knife and blasts (+100, a sparkle, the prop's reveal
 * frames), what comes out (pickups that stay, the hidden 1UP, a tourist tied to a chair that is
 * freed and counted as usual), not an enemy; the mission table (≥ 6, one per section, exactly one
 * 1UP, the hidden tourists); the art at 1×, 2× and 4× with the 1× geometry; the section scripts
 * place them.
 */
import { describe, expect, it } from 'vitest';
import { inHdPalette } from '../../src/engine/palette-hd';
import { getFrames, hasSprite } from '../../src/engine/sprites';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/items/index';
import '../../src/game/content/items/art';
import {
  AMS_SECRETS,
  AmsSecret,
  HIDDEN_TOURISTS,
  SECRET,
  SECRET_ART,
  SECRET_GLINT,
  SECRET_LOOKS,
  SECRET_PROPS,
  secretArt,
  secretSprite,
} from '../../src/game/content/missions/ams/secrets';
import { Hostage } from '../../src/game/hostage';
import { Pickup } from '../../src/game/pickup';
import type { Player } from '../../src/game/player/player';
import { loadContent } from '../../src/game/content/index';
import { createHeadlessGame } from '../../src/sim/index';
import { FLOOR, TestWorld } from './helpers';

const bullet = (owner = 0) => ({ amount: 10, kind: 'bullet' as const, dirX: 1, owner });

function secretAt(tw: TestWorld, x: number, params: Record<string, unknown>, y = FLOOR): AmsSecret {
  return tw.spawn('ams-secret', x, params, y) as AmsSecret;
}

describe('ams-secret', () => {
  it('is a shootable prop, never an enemy; two hits reveal it: +100, a medal that pops out and stays', () => {
    const tw = new TestWorld({ playerX: 60 });
    const s = secretAt(tw, 300, { look: 'chest', hides: 'medal' });
    expect(s).toBeInstanceOf(AmsSecret);
    expect(s.hasTag('enemy')).toBe(false);
    expect(s.hasTag('shootable')).toBe(true);
    expect(s.hasTag('soft')).toBe(true);
    expect(s.hitsLeft).toBe(SECRET.hits);
    const before = tw.session.slots[0].score;
    tw.world.damage(s, bullet(), 0);
    expect(s.revealed).toBe(false);
    tw.world.damage(s, bullet(), 0);
    expect(s.revealed).toBe(true);
    expect(s.hasTag('shootable')).toBe(false);
    tw.run(2);
    expect(tw.session.slots[0].score - before).toBe(SECRET.score);
    const medal = s.spawned[0] as Pickup;
    expect(medal.type).toBe('pickup-gem');
    // Not loot on a timer: it stays until picked up.
    tw.run(1200);
    expect(medal.removed).toBe(false);
    expect(medal.y).toBe(FLOOR);
    // A further hit does nothing.
    expect(tw.world.damage(s, bullet(), 0)).toBe(false);
    expect(tw.world.errors).toEqual([]);
  });

  it('a player shot reaches it; the knife and a blast reveal at once; hits are clamped to 1–3', () => {
    const tw = new TestWorld({ playerX: 200 });
    const s = secretAt(tw, 260, { look: 'museum-crate', hides: 'cheese', hits: 1 });
    tw.hold('fire').run(2).hold().run(20);
    expect(s.revealed).toBe(true);
    const k = secretAt(tw, 600, { look: 'hatch', hits: 3 });
    tw.world.damage(k, { amount: 1, kind: 'knife', dirX: 1, owner: 0 }, 0);
    expect(k.revealed).toBe(true);
    const b = secretAt(tw, 700, { look: 'chest', hits: 9 });
    expect(b.hitsLeft).toBe(3);
    tw.world.damage(b, { amount: 50, kind: 'explosion', dirX: 1, owner: 0 }, 0);
    expect(b.revealed).toBe(true);
    expect(secretAt(tw, 800, { hits: 0 }).hitsLeft).toBe(1);
  });

  it('a list hides every item (three golden notes); the 1UP comes out of a spot', () => {
    const tw = new TestWorld({ playerX: 60 });
    const s = secretAt(tw, 300, { look: 'hoist', hides: ['golden-note', 'golden-note', 'golden-note'], hits: 1 }, 60);
    tw.world.damage(s, bullet(), 0);
    expect(s.spawned.map((e) => e.type)).toEqual(['pickup-gem', 'pickup-gem', 'pickup-gem']);
    const up = secretAt(tw, 500, { look: 'spot', hides: '1up', w: 14, h: 10, hits: 1 }, 120);
    expect(up.hitRect().w).toBe(14);
    tw.world.damage(up, bullet(), 0);
    expect(up.spawned.map((e) => e.type)).toEqual(['pickup-1up']);
    tw.run(120);
    expect(up.spawned[0].removed).toBe(false);
  });

  it('a hidden tourist drops out tied to a chair; a touch frees it and it counts like any hostage', () => {
    const tw = new TestWorld({ playerX: 60 });
    const s = secretAt(tw, 300, { look: 'museum-crate', hides: 'hostage', hits: 1 });
    tw.world.damage(s, bullet(), 0);
    const h = s.spawned[0] as Hostage;
    expect(h).toBeInstanceOf(Hostage);
    expect(h.state).toBe('tied');
    expect(h.kind?.id).toBe('tourist');
    tw.until(() => h.y === FLOOR, 120);
    (tw.player as Player).x = h.x;
    tw.run(2);
    expect(h.state).not.toBe('tied');
    expect(tw.session.slots[0].rescued).toBe(1);
    expect(tw.world.errors).toEqual([]);
  });

  it('shows the reveal frame, then the revealed frame; the glint shows now and then before the reveal', () => {
    const tw = new TestWorld({ playerX: 60 });
    const s = secretAt(tw, 300, { look: 'chest', hits: 1 });
    const drawn: string[] = [];
    const r = { sprite: (id: string, f: number) => drawn.push(`${id}#${f}`) } as unknown as Parameters<AmsSecret['draw']>[0];
    let glints = 0;
    for (let i = 0; i < SECRET.glintEvery; i++) {
      drawn.length = 0;
      s.draw(r);
      if (drawn.some((d) => d.startsWith(SECRET_GLINT))) glints++;
      tw.run(1);
    }
    expect(glints).toBe(SECRET.glintTicks);
    tw.world.damage(s, bullet(), 0);
    drawn.length = 0;
    tw.run(1);
    s.draw(r);
    expect(drawn).toEqual([`${secretSprite('chest')}#1`]);
    tw.run(SECRET.revealTicks);
    drawn.length = 0;
    s.draw(r);
    expect(drawn).toEqual([`${secretSprite('chest')}#2`]);
  });
});

describe('the ams secrets table', () => {
  const all = Object.values(AMS_SECRETS).flat();

  it('at least 6, at least one in every section, exactly one hidden 1UP, the hidden tourists counted', () => {
    expect(all.length).toBeGreaterThanOrEqual(6);
    for (const id of ['a', 'b', 'c', 'c1', 'c2', 'd']) expect(AMS_SECRETS[id]?.length ?? 0, id).toBeGreaterThan(0);
    expect(all.filter((s) => s.hides === '1up').length).toBe(1);
    // The two c routes hide no tourist: both keep the same hostage total.
    expect(HIDDEN_TOURISTS).toEqual({ a: 1, b: 1, c: 0, c1: 0, c2: 0, d: 0 });
    for (const s of all) expect(SECRET_LOOKS[s.look ?? 'spot'], s.note).toBeDefined();
  });

  it('a section lists the art its secrets draw (tier-4 working set)', () => {
    expect(secretArt('a').sort()).toEqual([SECRET_GLINT, secretSprite('hatch'), secretSprite('hoist'), secretSprite('tree-bike')].sort());
    expect(secretArt('b').sort()).toEqual([SECRET_GLINT, secretSprite('museum-crate')].sort());
    expect(secretArt('c1').sort()).toEqual([SECRET_GLINT, secretSprite('hoist')].sort());
    expect(secretArt('c2').sort()).toEqual([SECRET_GLINT, secretSprite('hatch')].sort());
    expect(secretArt('zz')).toEqual([]);
  });
});

describe('secret art (1×, 2×, 4×)', () => {
  it('every id has 1× art and 2× / 4× art from one drawer with the 1× geometry, in PAL_HD', () => {
    expect(SECRET_ART.length).toBe(SECRET_PROPS.length + 1);
    for (const id of SECRET_ART) {
      expect(hasSprite(id), id).toBe(true);
      const f1 = getFrames(id, 1);
      expect(f1.length, id).toBe(id === SECRET_GLINT ? 4 : 3);
      for (const d of [2, 4] as const) {
        const fd = getFrames(id, d);
        expect(fd.length, `${id}@${d}`).toBe(f1.length);
        fd.forEach((f, i) => {
          expect(f.density, `${id}@${d}#${i}`).toBe(d);
          expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id}@${d}#${i}`).toEqual([f1[i].buf.w * d, f1[i].buf.h * d, f1[i].ox, f1[i].oy]);
          let bad = 0;
          let ink = 0;
          for (const c of f.buf.data) {
            if ((c & 255) === 0) continue;
            if (!inHdPalette(c)) bad++;
            ink++;
          }
          expect(bad, `${id}@${d}#${i} off-palette px`).toBe(0);
          expect(ink, `${id}@${d}#${i} empty`).toBeGreaterThan(0);
        });
      }
    }
  });

  it('the props have an ink outline A (the frames can be hit): the outer edge px are ink at 4×', () => {
    for (const look of SECRET_PROPS) {
      const f = getFrames(secretSprite(look), 4)[0];
      const { w, h, data } = f.buf;
      let edge = 0;
      let inkEdge = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const c = data[y * w + x];
          if ((c & 255) === 0) continue;
          const out = x === 0 || y === 0 || x === w - 1 || y === h - 1 || (data[y * w + x - 1] & 255) === 0 || (data[y * w + x + 1] & 255) === 0 || (data[(y - 1) * w + x] & 255) === 0 || (data[(y + 1) * w + x] & 255) === 0;
          if (!out) continue;
          edge++;
          const r = (c >>> 24) & 255;
          const g = (c >>> 16) & 255;
          const b = (c >>> 8) & 255;
          if (r + g + b < 120) inkEdge++;
        }
      }
      // The bikes keep their spoked wheels open (spokes and rims next to empty px inside).
      expect(inkEdge / edge, look).toBeGreaterThan(look.endsWith('bike') ? 0.6 : 0.9);
    }
  });
});

describe('the section scripts place them', () => {
  it('a, b and d place their row of AMS_SECRETS at the start (d: with the flea-market repair crate)', async () => {
    await loadContent();
    for (const sec of ['a', 'b', 'd']) {
      const game = await createHeadlessGame({ missionId: 'ams', sectionId: sec, seed: 1, players: 1, god: true });
      game.step(3);
      const w = game.runner!.world;
      const xs = w.entities.filter((e) => e instanceof AmsSecret).map((e) => Math.round(e.x));
      expect(xs.sort((p, q) => p - q), sec).toEqual(AMS_SECRETS[sec].map((s) => Math.round(s.x)).sort((p, q) => p - q));
      if (sec === 'd') expect(w.entities.some((e) => e.type === 'crate' && (e as unknown as { contains?: unknown }).contains === 'repair')).toBe(true);
      expect(game.report().errors).toEqual([]);
      game.dispose();
    }
  }, 120_000);
});
