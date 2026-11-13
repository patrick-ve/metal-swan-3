/**
 * The lit pair and the entity-only light mode (docs/api/canal.md "A lit section"; docs/design/sewers.md
 * §5.1 "Art (L5)"; wave P6a):
 * - the lit composite: sewers-d's view with a known flashlight cone draws the LIT stack's pixels where
 *   the lit mask is opaque and the AMBIENT stack's everywhere else, exactly;
 * - the entity-only mode: the pass darkens the entities' own pixels only (the scenery under and around
 *   them is untouched), an entity outside every light is darkened, an emitter is drawn again in its
 *   own colour, and a renderer layer with nothing drawn into it changes nothing.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { blendOver } from '../../src/engine/color';
import { Entity } from '../../src/engine/entity';
import type { Renderer } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { setArtTier, setDeferHiArt, setFrameOverlay, setHiArt, withArtDensity, type FrameOverlay } from '../../src/engine/sprites';
import { Terrain } from '../../src/engine/terrain';
import { World } from '../../src/engine/world';
import { isFpsContent, isRallyContent, loadContent } from '../../src/game/content/index';
import { canalLitOf, resetCanalStore, setCanal, setCanalSource } from '../../src/game/mission/canal/index';
import type { LightControl } from '../../src/game/mission/light/api';
import { LightMap, MissionLight } from '../../src/game/mission/light/index';
import { LitMask } from '../../src/game/mission/light/litmask';
import type { SectionDef } from '../../src/game/mission/types';
import { SectionView } from '../../src/game/mission/view';
import { getMission } from '../../src/game/registry';
import { nodeCanalSource } from '../../tools/lib/canal-source';

const TIER = 2;
const CAM = 1008;

/** The scenery frame of a section def at camera CAM (back and front passes, no entities). */
function frame(def: SectionDef, light: LightControl | null): { px: Uint32Array; view: SectionView } {
  resetCanalStore();
  const view = new SectionView(def, new Terrain(def.terrain), 7, 4);
  if (view.canal) view.canal.light = light;
  const r = new SoftRenderer(384, 216, undefined, { res: TIER });
  r.setCamera(CAM, 0);
  view.prepare(CAM, 0);
  r.begin();
  view.drawBack(r, 0);
  view.drawFront(r, 0);
  r.end();
  return { px: r.target.data.slice(), view };
}

describe('canal: the lit pair (sewers-d)', () => {
  beforeAll(async () => {
    await loadContent((id) => !isFpsContent(id) && !isRallyContent(id));
    setHiArt(true);
    setDeferHiArt(false);
    setCanal(true);
    setCanalSource(nodeCanalSource());
    setArtTier(TIER);
  });
  afterAll(() => {
    setCanalSource(null);
    resetCanalStore();
    setArtTier(2);
  });

  it('pairs sewers-d with its lit stack and draws the lit stack only inside the mask', () => {
    expect(canalLitOf('sewers/sewers-d')).toBe('sewers/sewers-d-lit');
    const def = getMission('sewers')?.sections['sewers-d'] as SectionDef;
    expect(def.canal?.scene).toBe('sewers/sewers-d');
    // A known cone: from screen (120, 150) to the right, 200 px, 20°, with its dithered rim and faded end.
    const map = new LightMap(385, 217);
    map.begin(CAM, 0);
    map.addCone(CAM + 120, 150, 0.1, 200, (20 * Math.PI) / 180, 1, 0xffffffff, 0, (3 * Math.PI) / 180, 0.35);
    const mask = new LitMask(385, 217, TIER);
    expect(mask.build(map, 0, 0, 385, 217, CAM, 0)).toBe(true);
    const ctl: LightControl = { flash() {}, setDarkness() {}, litMask: () => mask };
    const amb = frame(def, null);
    expect(amb.view.canal?.litDrawn).toBe(0);
    const lit = frame({ ...def, canal: { scene: 'sewers/sewers-d-lit' } }, null);
    const both = frame(def, ctl);
    expect(both.view.canal?.litDrawn).toBe(2);
    const W = 384 * TIER;
    const H = 216 * TIER;
    let inside = 0;
    let outside = 0;
    let bad = 0;
    let first = '';
    let litDiffers = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const m = (mask.buf.data[y * mask.buf.w + x] & 255) !== 0;
        const want = m ? lit.px[i] : amb.px[i];
        if (m) inside++;
        else outside++;
        if (m && lit.px[i] !== amb.px[i]) litDiffers++;
        if (both.px[i] !== want) {
          bad++;
          if (!first) first = `(${x}, ${y}) ${m ? 'inside' : 'outside'}: ${both.px[i].toString(16)} want ${want.toString(16)}`;
        }
      }
    }
    expect(inside).toBeGreaterThan(20000);
    expect(outside).toBeGreaterThan(inside);
    // The lit stack really is another picture inside the cone.
    expect(litDiffers).toBeGreaterThan(inside / 2);
    expect(`${bad} px differ ${first}`).toBe('0 px differ ');
  });

  it('draws a canal sprite like the scenery: its ambient frame outside the mask, its lit frame inside, no entity darkness', () => {
    const def = getMission('sewers')?.sections['sewers-d'] as SectionDef;
    resetCanalStore();
    const view = new SectionView(def, new Terrain(def.terrain), 7, 4);
    const canal = view.canal;
    expect(canal).not.toBeNull();
    if (!canal) return;
    const world = new World({ seed: 1 });
    const light = new MissionLight({ darkness: 0.6, tint: 0x020206ff, scope: 'entities' }, world, 1);
    // A cone over part of the secret fatberg's frame (world x CAM + 150, feet y 160).
    const map = new LightMap(385, 217);
    map.begin(CAM, 0);
    map.addCone(CAM + 60, 140, 0, 200, (12 * Math.PI) / 180, 1, 0xffffffff, 0, (3 * Math.PI) / 180, 0.35);
    const mask = new LitMask(385, 217, TIER);
    mask.build(map, 0, 0, 385, 217, CAM, 0);
    light.litMask = () => mask;
    canal.light = light;
    const berg = world.add(new Sprite(world, CAM + 150, 160, 'prop/sewers-fatberg/small'));
    const rat = world.add(new Box(world, CAM + 20, 60, BODY));
    world.flush();
    canal.world = world;
    const r = new SoftRenderer(384, 216, undefined, { res: TIER });
    const draw = (rr: SoftRenderer, overlay: FrameOverlay | null, scene: boolean): void => {
      rr.setCamera(CAM, 0);
      const was = setFrameOverlay(overlay);
      withArtDensity(TIER, () => {
        if (scene) {
          view.prepare(CAM, 0);
          rr.begin();
          view.drawBack(rr, 0);
          view.drawShadows(rr, world);
          world.draw(rr);
          view.drawFront(rr, 0);
          light.draw(rr, 0, TIER);
        } else {
          rr.begin(0x00000000);
          berg.draw(rr);
        }
        rr.end();
      });
      setFrameOverlay(was);
    };
    draw(r, canal.sprites, true);
    expect(canal.scenicDrawn).toBe(1);
    expect(canal.litDrawn).toBe(2);
    const lit = (canal as unknown as { litSprites: FrameOverlay }).litSprites;
    const ra = new SoftRenderer(384, 216, undefined, { res: TIER });
    draw(ra, canal.sprites, false);
    const rl = new SoftRenderer(384, 216, undefined, { res: TIER });
    draw(rl, lit, false);
    let inside = 0;
    let outside = 0;
    let bad = 0;
    let first = '';
    const W = 384 * TIER;
    for (let i = 0; i < ra.target.data.length; i++) {
      const a = ra.target.data[i];
      if ((a & 255) === 0) continue;
      const x = i % W;
      const y = (i - x) / W;
      const m = (mask.buf.data[y * mask.buf.w + x] & 255) !== 0;
      const want = m ? rl.target.data[i] : a;
      if (m) inside++;
      else outside++;
      if (r.target.data[i] !== want) {
        bad++;
        if (!first) first = `(${x}, ${y}) ${m ? 'inside' : 'outside'}: ${r.target.data[i].toString(16)} want ${want.toString(16)}`;
      }
    }
    expect(inside).toBeGreaterThan(200);
    expect(outside).toBeGreaterThan(200);
    expect(`${bad} px differ ${first}`).toBe('0 px differ ');
    // A plain entity in the dark is darkened (the entity-only darkness still works around the scenic one).
    const p = r.target.data[(64 * TIER + 4) * W + (20 + 4) * TIER];
    expect(p.toString(16)).toBe(blendOver(BODY, (0x020206ff & 0xffffff00) | Math.round(0.6 * 255)).toString(16));
    expect(rat.removed).toBe(false);
    view.dispose();
  });
});

/** An entity that draws frame 0 of a sprite id. */
class Sprite extends Entity {
  private readonly sid: string;
  constructor(world: World, x: number, y: number, sid: string) {
    super(world, x, y);
    this.sid = sid;
  }
  override draw(r: Renderer): void {
    r.sprite(this.sid, 0, this.x, this.y);
  }
}

const SCENERY = 0x5a6e82ff;
const BODY = 0xd0a060ff;
const GLOW = 0xfff080ff;

/** A plain entity: an 8 × 8 square of `color` (an `emitter` carries a sprite id the pass knows). */
class Box extends Entity {
  sprite = '';
  private readonly color: number;
  constructor(world: World, x: number, y: number, color: number) {
    super(world, x, y);
    this.color = color;
  }
  override draw(r: Renderer): void {
    r.rect(this.x, this.y, 8, 8, this.color);
  }
}

describe('light: the entity-only mode', () => {
  it('darkens the entities only, skips the emitters, leaves the scenery untouched', () => {
    const world = new World({ seed: 1 });
    // A steady lamp (light ≥ 1 at its centre) lights the box at (300, 100); the box at (60, 100) is in the dark.
    const cfg = { darkness: 0.6, tint: 0x020206ff, scope: 'entities' as const, emitSprites: ['fx/muzzle'], lamps: [{ x: 304, y: 104, r: 40, color: 0xffffffff, intensity: 2, glow: 0 }] };
    const light = new MissionLight(cfg, world, 1);
    const dark = world.add(new Box(world, 60, 100, BODY));
    const lit = world.add(new Box(world, 300, 100, BODY));
    const emitter = world.add(new Box(world, 160, 100, GLOW));
    emitter.sprite = 'fx/muzzle-test';
    world.flush();
    expect([dark.removed, lit.removed, emitter.removed]).toEqual([false, false, false]);
    const r = new SoftRenderer();
    r.setCamera(0, 0);
    r.begin(SCENERY);
    // The order of a canal section's frame: the scene's back pass opens the entity layer, the entities
    // draw, the front pass closes it (darkness on the layer, the layer over the scenery), then the pass.
    expect(light.entitiesBegin(r)).toBe(true);
    world.draw(r);
    light.entitiesEnd(r, 10, 1);
    light.draw(r, 10, 1);
    r.end();
    const at = (x: number, y: number): number => r.target.data[y * 384 + x];
    // The scenery: untouched everywhere, also right beside the dark box.
    for (const [x, y] of [
      [10, 10],
      [58, 104],
      [70, 104],
      [200, 200],
      [296, 104],
    ])
      expect(at(x, y).toString(16), `scenery at ${x},${y}`).toBe(SCENERY.toString(16));
    // The dark box: the darkness on its own pixels (tint at 0.6).
    expect(at(64, 104).toString(16)).toBe(blendOver(BODY, (0x020206ff & 0xffffff00) | Math.round(0.6 * 255)).toString(16));
    // The lit box: its own colour.
    expect(at(304, 104).toString(16)).toBe(BODY.toString(16));
    // The emitter: drawn again in full colour after the darkness.
    expect(at(164, 104).toString(16)).toBe(GLOW.toString(16));
    expect(light.entityFrames).toBe(1);
  });

  it('falls back to the darkness over everything without a layer (no canal scene this frame)', () => {
    const world = new World({ seed: 1 });
    const light = new MissionLight({ darkness: 0.6, tint: 0x020206ff, scope: 'entities' }, world, 1);
    const r = new SoftRenderer();
    r.setCamera(0, 0);
    r.begin(SCENERY);
    light.draw(r, 10, 1);
    r.end();
    expect(r.target.data[50 * 384 + 50]).not.toBe(SCENERY);
    expect(light.entityFrames).toBe(0);
  });
});

describe('light: a lamp on a parallax plane', () => {
  it('sits where its plane shows it: camX + 192 + (x − 192 − camX) · speed', () => {
    const world = new World({ seed: 1 });
    const lamp = { x: 400, y: 100, r: 20, color: 0xffffffff, intensity: 1, glow: 0, speed: 0.75 };
    const light = new MissionLight({ darkness: 0.5, tint: 0x000000ff, lamps: [lamp] }, world, 1);
    const r = new SoftRenderer();
    for (const cam of [0, 100, 200]) {
      r.setCamera(cam, 0);
      r.begin();
      light.draw(r, 0, 1);
      r.end();
      const want = cam + 192 + (400 - 192 - cam) * 0.75;
      expect(light.map.lightAt(want, 100)).toBeGreaterThan(0.95);
      expect(light.map.lightAt(want + 12, 100)).toBeLessThan(light.map.lightAt(want, 100));
      expect(light.map.lightAt(want - 12, 100)).toBeLessThan(light.map.lightAt(want, 100));
    }
  });
});
