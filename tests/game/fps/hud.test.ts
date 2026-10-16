import { beforeAll, describe, expect, it } from 'vitest';
import { NullAudio } from '../../../src/engine/audio';
import { MAGENTA } from '../../../src/engine/color';
import { PAL } from '../../../src/engine/palette';
import { degToAng } from '../../../src/engine/ray';
import { SoftRenderer } from '../../../src/engine/render-soft';
import { Rng } from '../../../src/engine/rng';
import { FpsGame } from '../../../src/game/fps/game';
import {
  drawBossBand,
  drawFeedback,
  drawMessages,
  drawStatusBar,
  drawWeaponView,
  EDGE_BOTTOM,
  EDGE_LEFT,
  EDGE_RIGHT,
  edgeSide,
  FACE_DEAD,
  FACE_GRIN,
  FACE_OUCH,
  healthBand,
  HudState,
  messageFits,
} from '../../../src/game/fps/hud';
import { PICKUP_MESSAGES } from '../../../src/game/fps/pickups';
import type { FpsFloorDef } from '../../../src/game/fps/types';
import { PlayerSlot } from '../../../src/game/session';

beforeAll(async () => {
  await import('../../../src/game/content/fps/index');
});

function makeGame(): FpsGame {
  const def: FpsFloorDef = { id: 'fps-test', number: 9, name: 'TEST', par: 60, secrets: 0, rows: ['AAAAAA', 'A>...A', 'AAAAAA'], ceil: PAL.steel[0], floor: PAL.stone[1], music: 'fps-floor' };
  const g = new FpsGame({ floor: def, difficulty: 'normal', seed: 1, slot: new PlayerSlot(0), carry: null, audio: new NullAudio() });
  g.skipUnfold();
  return g;
}

describe('messages (§8.6)', () => {
  it('every HUD message fits 128 px in the small font', () => {
    const all = [...Object.values(PICKUP_MESSAGES), 'YOU NEED THE GOLD KEY', 'YOU NEED THE SILVER KEY', 'ONE MORE TRY!'];
    for (const m of all) expect(messageFits(m), m).toBe(true);
  });

  it('at most two lines, newest last, 90 ticks', () => {
    const g = makeGame();
    g.message('A');
    g.message('B');
    g.message('C');
    expect(g.messages.map((m) => m.text)).toEqual(['B', 'C']);
    for (let t = 0; t < 90; t++) g.step({ held: 0, pressed: 0, turn: 0, moveX: 0, moveY: 0 });
    expect(g.messages).toEqual([]);
  });
});

describe('face (§4.10)', () => {
  it('7 health bands', () => {
    expect([100, 86, 85, 72, 71, 58, 57, 43, 42, 29, 28, 15, 14, 1].map(healthBand)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
  });

  it('priority dead > ouch > grin > band glance; glances change by fxRng with weights 1:2:1', () => {
    const h = new HudState();
    expect(h.faceFrame(100)).toBe(1);
    h.grin = 10;
    expect(h.faceFrame(50)).toBe(FACE_GRIN);
    h.hurt(25, Number.NaN);
    expect(h.faceFrame(50)).toBe(FACE_OUCH);
    expect(h.faceFrame(0)).toBe(FACE_DEAD);
    const r = new Rng(9);
    const seen = [0, 0, 0];
    const k = new HudState();
    for (let t = 0; t < 60 * 600; t++) {
      k.step(r);
      seen[k.glance]++;
    }
    expect(seen[1]).toBeGreaterThan(seen[0]);
    expect(seen[1]).toBeGreaterThan(seen[2]);
    expect(Math.min(...seen)).toBeGreaterThan(0);
  });

  it('ouch needs ≥ 20 damage in one tick', () => {
    const h = new HudState();
    h.hurt(10, Number.NaN);
    h.hurt(9, Number.NaN);
    expect(h.ouch).toBe(0);
    h.hurt(1, Number.NaN);
    expect(h.ouch).toBeGreaterThan(0);
  });
});

describe('edge markers (§4.9)', () => {
  it('left, right, behind; none in front', () => {
    expect(edgeSide(-1024)).toBe(EDGE_LEFT);
    expect(edgeSide(1024)).toBe(EDGE_RIGHT);
    expect(edgeSide(2048)).toBe(EDGE_BOTTOM);
    expect(edgeSide(-1800)).toBe(EDGE_BOTTOM);
    expect(edgeSide(200)).toBe(-1);
  });

  it('a hit from the player\'s left marks the left edge', () => {
    const g = makeGame();
    g.setPose(2.5, 1.5, degToAng(0)); // facing east; north is the left
    g.hurt(5, 2.5, 0.5);
    expect(g.hud.edge[EDGE_LEFT]).toBeGreaterThan(0);
    g.hurt(5, 0.5, 1.5);
    expect(g.hud.edge[EDGE_BOTTOM]).toBeGreaterThan(0);
    expect(g.hud.edge[EDGE_RIGHT]).toBe(0);
    expect(g.hud.damageFlash).toBeGreaterThan(0);
  });
});

describe('drawing', () => {
  it('the bar, the weapon view, feedback, boss band and messages draw without magenta', () => {
    const g = makeGame();
    const r = new SoftRenderer();
    g.player.keys = 3;
    g.hurt(30, 2.5, 0.5);
    g.message('AMMO +8');
    g.bossBar.visible = true;
    g.subtitle.text = 'HET MUSJE, HET PRACHTIGE MUSJE...\nRED MIJ!';
    g.subtitle.ticks = 10;
    r.begin();
    drawWeaponView(r, g);
    drawFeedback(r, g, false);
    drawBossBand(r, g, true);
    drawStatusBar(r, g, { floor: 1, score: 12345, lives: 3, slot: 0, character: 'recruit', reduceFlashes: false, bossBarOn: true });
    drawMessages(r, g);
    r.end();
    const data = r.target.data;
    let magenta = 0;
    let lit = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] >>> 0 === MAGENTA) magenta++;
      if ((data[i] & 0xffffff00) !== 0) lit++;
    }
    expect(magenta).toBe(0);
    expect(lit).toBeGreaterThan(5000);
  });
});
