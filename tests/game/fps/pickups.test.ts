import { beforeAll, describe, expect, it } from 'vitest';
import { NullAudio } from '../../../src/engine/audio';
import { PAL } from '../../../src/engine/palette';
import { KEY_GOLD, KEY_SILVER } from '../../../src/game/fps/doors';
import { FpsGame } from '../../../src/game/fps/game';
import { applyPickup, ONE_UP_SCORE, TREASURE_SCORE } from '../../../src/game/fps/pickups';
import type { FpsFloorDef, FpsInput } from '../../../src/game/fps/types';
import { WEAPON_CHAINGUN, WEAPON_KNIFE, WEAPON_MG } from '../../../src/game/fps/types';
import { MAX_LIVES, PlayerSlot } from '../../../src/game/session';

beforeAll(async () => {
  await import('../../../src/game/content/fps/index');
});

function makeGame(rows: string[] = ['AAAAAA', 'A>...A', 'AAAAAA']): FpsGame {
  const def: FpsFloorDef = { id: 'fps-test', number: 9, name: 'TEST', par: 60, secrets: 0, rows, ceil: PAL.steel[0], floor: PAL.stone[1], music: 'fps-floor' };
  const g = new FpsGame({ floor: def, difficulty: 'normal', seed: 1, slot: new PlayerSlot(0), carry: null, audio: new NullAudio() });
  g.skipUnfold();
  return g;
}
const idle = (): FpsInput => ({ held: 0, pressed: 0, turn: 0, moveX: 0, moveY: 0 });

describe('pickup effects, caps and refusals (§4.5)', () => {
  it('health items heal up to 100 and are refused at 100', () => {
    const g = makeGame();
    const p = g.player;
    expect(applyPickup(g, 'first-aid')).toBe(false);
    p.hp = 90;
    expect(applyPickup(g, 'first-aid')).toBe(true);
    expect(p.hp).toBe(100);
    p.hp = 50;
    applyPickup(g, 'food');
    expect(p.hp).toBe(60);
    applyPickup(g, 'ration');
    expect(p.hp).toBe(64);
  });

  it('the blood pool only helps at 10 HP or less', () => {
    const g = makeGame();
    g.player.hp = 11;
    expect(applyPickup(g, 'blood-pool')).toBe(false);
    g.player.hp = 10;
    expect(applyPickup(g, 'blood-pool')).toBe(true);
    expect(g.player.hp).toBe(11);
  });

  it('ammo: clip +8, dropped clip +4, cap 99, refused at 99', () => {
    const g = makeGame();
    const p = g.player;
    applyPickup(g, 'clip');
    expect(p.ammo).toBe(16);
    applyPickup(g, 'clip-drop');
    expect(p.ammo).toBe(20);
    p.ammo = 95;
    applyPickup(g, 'clip');
    expect(p.ammo).toBe(99);
    expect(applyPickup(g, 'clip')).toBe(false);
    expect(applyPickup(g, 'clip-drop')).toBe(false);
  });

  it('weapons: owned + 6 ammo + grin; refused when owned and at 99 ammo', () => {
    const g = makeGame();
    const p = g.player;
    expect(applyPickup(g, 'mg')).toBe(true);
    expect((p.weapons >> WEAPON_MG) & 1).toBe(1);
    expect(p.ammo).toBe(14);
    expect(g.hud.grin).toBeGreaterThan(0);
    expect(g.weaponSys.want).toBe(WEAPON_MG);
    p.ammo = 99;
    expect(applyPickup(g, 'mg')).toBe(false);
    expect(applyPickup(g, 'chaingun')).toBe(true);
    expect((p.weapons >> WEAPON_CHAINGUN) & 1).toBe(1);
  });

  it('1UP: a life, HP 100, +25 ammo; full lives → points', () => {
    const g = makeGame();
    const p = g.player;
    const lives = g.slot.lives;
    p.hp = 20;
    applyPickup(g, 'one-up');
    expect([g.slot.lives, p.hp, p.ammo]).toEqual([lives + 1, 100, 33]);
    g.slot.lives = MAX_LIVES;
    const score = g.slot.score;
    applyPickup(g, 'one-up');
    expect(g.slot.lives).toBe(MAX_LIVES);
    expect(g.slot.score).toBe(score + ONE_UP_SCORE);
  });

  it('keys and treasure (score through the slot; an extend still works)', () => {
    const g = makeGame();
    applyPickup(g, 'key-gold');
    applyPickup(g, 'key-silver');
    expect(g.player.keys).toBe(KEY_GOLD | KEY_SILVER);
    for (const [id, pts] of Object.entries(TREASURE_SCORE)) {
      const before = g.slot.score;
      expect(applyPickup(g, id)).toBe(true);
      expect(g.slot.score - before).toBe(pts);
    }
    g.slot.score = 499_500;
    const lives = g.slot.lives;
    applyPickup(g, 'gold-bars');
    expect(g.slot.lives).toBe(lives + 1);
    expect(g.messages.some((m) => m.text === 'ONE MORE TRY!')).toBe(true);
  });

  it('the first ammo after an empty pool raises the best owned gun', () => {
    const g = makeGame();
    const p = g.player;
    p.weapons |= 1 << WEAPON_MG;
    p.ammo = 0;
    p.weapon = WEAPON_KNIFE;
    applyPickup(g, 'clip-drop');
    expect(g.weaponSys.want).toBe(WEAPON_MG);
  });
});

describe('pickups in the world', () => {
  it('walking over an item takes it; a refused item stays', () => {
    const g = makeGame(['AAAAAAA', 'A>+.c.A', 'AAAAAAA']);
    const i = idle();
    i.held = 1; // forward
    for (let t = 0; t < 60; t++) g.step(i);
    // HP 100: the first aid stays; the clip is taken.
    expect(Array.from(g.taken)).toEqual([0, 1]);
    expect(g.player.ammo).toBe(16);
  });

  it('drops land on the corpse cell and are taken like items; treasure % counts the placed treasure', () => {
    const g = makeGame(['AAAAAAA', 'A>.95.A', 'AAAAAAA']);
    g.dropItem('clip-drop', 2, 1);
    expect(g.items.count).toBe(3);
    const i = idle();
    i.held = 1;
    for (let t = 0; t < 60; t++) g.step(i);
    expect(g.player.ammo).toBe(12);
    const t = g.items.treasure();
    expect(t).toEqual({ taken: 2, total: 2, record: true });
  });
});
