/**
 * The sounds and voices wired for mission ams (2026-10-14, with the sampled audio): bubble lines
 * carry their speaker to `HudState.onBubble` (the runner voices them with `AudioOut.say`; never
 * ROBO-HALSEMA, whose bubbles are `voice: false`), the locals' deaths, the ducks,
 * pigeons and tour boat, the Swan's engine loop, the RELOAD! clack and the section ambience with
 * the carillon. Everything is tick-based: no rng is drawn for a sound.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AudioOut, NullAudio } from '../../src/engine/audio';
import type { Damage, Entity } from '../../src/engine/entity';
import { VirtualPad } from '../../src/engine/input';
import { loadContent } from '../../src/game/content/index';
import { AmsBaker, AmsStaff } from '../../src/game/content/missions/ams/entities';
import { CARILLON } from '../../src/game/content/missions/ams/helpers';
import { AMS } from '../../src/game/content/missions/ams/index';
import { gagBubble } from '../../src/game/content/locals/rider';
import { BRIEFING_SPEAKER, MISSION_CARDS } from '../../src/game/content/ui/cards';
import type { Swan } from '../../src/game/content/vehicles/swan/swan';
import { MissionRunner } from '../../src/game/mission/index';
import { GameSession } from '../../src/game/session';
import { FLOOR, TestWorld } from './helpers';

await loadContent();

/** Bubble lines offered for voicing in this world (the runner's hook), as `speaker:text`. */
function listen(tw: TestWorld): string[] {
  const said: string[] = [];
  tw.hud.onBubble = (text, _kind, speaker) => said.push(`${speaker ?? ''}:${text}`);
  return said;
}

/** An AudioOut that records sfx and loops in `log` and bubble voices (`say`) in `said`. */
function recorder(log: string[], said: string[]): AudioOut {
  return {
    sfx: (id) => log.push(`sfx:${id}`),
    music: () => {},
    voice: () => {},
    setVolume: () => {},
    stopAll: () => {},
    sfxLoop: (key, id) => log.push(`loop:${key}:${id}`),
    stopSfx: (key) => log.push(`stopLoop:${key}`),
    say: (text, speaker) => said.push(`${speaker ?? ''}:${text}`),
  };
}

const logOf = (tw: TestWorld): string[] => (tw.world.audio as NullAudio).log;
const count = (log: readonly string[], entry: string): number => log.filter((e) => e === entry).length;
const kill: Damage = { amount: 999, kind: 'bullet', dirX: 1, owner: 0 };

describe('ams audio: voiced speech bubbles', () => {
  it('the baker, the staff and the vendor speak their bubbles with their speaker', () => {
    const tw = new TestWorld({ playerX: 40 });
    const said = listen(tw);
    const baker = tw.spawn('ams-baker', 200) as AmsBaker;
    const staff = tw.spawn('ams-staff', 240, { look: 2 }) as AmsStaff;
    baker.say('FABEL FRIET\nBLIJFT OPEN!', 170);
    staff.say('LEKKER!', 70);
    expect(said).toEqual(['baker:FABEL FRIET\nBLIJFT OPEN!', 'staff2:LEKKER!']);
    tw.spawn('ams-hotdog-vendor', 60);
    tw.run(2);
    expect(said).toContain('vendor:HALLO DAAR!');
  });

  it('a rider line is voiced only when its gag bubble shows (a crowded spot skips both)', () => {
    const tw = new TestWorld({ playerX: 40 });
    const said = listen(tw);
    const a = { x: 200, y: FLOOR };
    const b = { x: 210, y: FLOOR };
    expect(gagBubble(tw.world, a, 'OI!', 30, 'youth')).toBe(true);
    expect(gagBubble(tw.world, b, 'TRING TRING!', 30, 'rider')).toBe(false);
    expect(said).toEqual(['youth:OI!']);
  });

  it('the handhaver says BOETE! on his tell', () => {
    const tw = new TestWorld({ playerX: 120, god: true });
    const said = listen(tw);
    tw.spawn('handhaver', 230, { facing: -1 });
    tw.until(() => said.includes('handhaver:BOETE!'), 600);
  });

  it('a tied tourist says MMF! now and then', () => {
    const tw = new TestWorld({ playerX: 40 });
    const said = listen(tw);
    tw.spawn('hostage', 220, { kind: 'tourist', bind: 'chair' });
    tw.until(() => said.includes('tourist:MMF!'), 400);
  });

  it('the intro card names Gusto as the speaker of every briefing line', () => {
    expect(BRIEFING_SPEAKER).toBe('gusto');
    expect(MISSION_CARDS.find((c) => c.id === 'ams')?.briefing.length).toBe(2);
  });

  it('ROBO-HALSEMA speaks only through playVoice (hand-placed clips); her bubbles are voice: false', () => {
    const dir = new URL('../../src/game/content/bosses/ams/', import.meta.url);
    for (const f of readdirSync(dir)) {
      const src = readFileSync(new URL(f, dir), 'utf8');
      // One say call in the whole boss folder: playVoice in mayor.ts, as the speaker 'mayor'.
      const calls = src.split('audio.say?.(').length - 1;
      expect(calls, f).toBe(f === 'mayor.ts' ? 1 : 0);
    }
    const mayor = readFileSync(new URL('mayor.ts', dir), 'utf8');
    expect(mayor).toContain('voice: false');
    expect(mayor).toContain('audio.say?.(text, MAYOR_SPEAKER, { important: true })');
    expect(readFileSync(new URL('../../src/game/boss.ts', import.meta.url), 'utf8').includes('audio.say')).toBe(false);
  });

  it('Gramps on the radio and the Swan-3 sign: the radio is voiced, the sign is not', async () => {
    const said: string[] = [];
    const log: string[] = [];
    const audio = recorder(log, said);
    const pads: [VirtualPad, VirtualPad] = [new VirtualPad(), new VirtualPad()];
    const runner = new MissionRunner({ session: new GameSession({ seed: 5 }), mission: 'ams', section: 'b', pads, audio, seed: 5 });
    runner.start();
    runner.hud.bubble({ x: 0, y: 0 }, 'HOLD JUMP IN THE AIR.', { kind: 'radio', speaker: 'gramps' });
    runner.hud.bubble({ x: 0, y: 0 }, 'SWAN-3. SHORE LEAVE TOO.', { kind: 'hint', voice: false });
    expect(said).toEqual(['gramps:HOLD JUMP IN THE AIR.']);
  });
});

describe('ams audio: sounds of the locals and the life', () => {
  it('a rider crashes and a handhaver goes down with their own sound', () => {
    const tw = new TestWorld({ playerX: 40, god: true });
    const rider = tw.spawn('delivery-rider', 260) as Entity;
    const officer = tw.spawn('handhaver', 300) as Entity;
    rider.die(kill);
    officer.die(kill);
    expect(logOf(tw)).toContain('sfx:ams/rider-crash');
    expect(logOf(tw)).toContain('sfx:ams/handhaver-down');
  });

  it('ducks quack when a player comes near; pigeons take off with their flutter', () => {
    const tw = new TestWorld({ playerX: 40 });
    tw.spawn('ams-ducks', 70, { count: 2, range: 24 });
    tw.spawn('ams-pigeons', 300, { count: 3 });
    tw.run(2);
    expect(count(logOf(tw), 'sfx:ams/duck')).toBe(1);
    tw.hold('right').until(() => logOf(tw).includes('sfx:ams/pigeon'), 300);
    expect(count(logOf(tw), 'sfx:ams/duck')).toBe(1);
  });

  it('a tour boat runs its diesel loop in view (once) and stops it for good on stopLoops', () => {
    const tw = new TestWorld({ playerX: 40 });
    const boat = tw.spawn('ams-tour-boat', 200, { range: 100 }) as Entity;
    const key = `tour-boat-${boat.id}`;
    tw.run(30);
    expect(count(logOf(tw), `loop:${key}:ams/tour-boat`)).toBe(1);
    tw.world.events.emit('stopLoops', { fadeTicks: 10 });
    tw.run(30);
    expect(count(logOf(tw), `stopLoop:${key}`)).toBe(1);
    expect(count(logOf(tw), `loop:${key}:ams/tour-boat`)).toBe(1);
  });

  it('the Swan purrs while ridden: the engine loop starts on a mount and stops on the eject', () => {
    const tw = new TestWorld({ playerX: 100 });
    const swan = tw.spawn('swan', 100) as Swan;
    const p = tw.player!;
    swan.mount(p);
    expect(count(logOf(tw), 'loop:swan-engine-0:swan/engine')).toBe(1);
    tw.run(20);
    expect(count(logOf(tw), 'loop:swan-engine-0:swan/engine')).toBe(1);
    swan.eject('exit');
    expect(count(logOf(tw), 'stopLoop:swan-engine-0')).toBe(1);
    swan.mount(p);
    tw.world.events.emit('stopLoops', { fadeTicks: 10 });
    expect(count(logOf(tw), 'stopLoop:swan-engine-0')).toBe(2);
  });

  it('bombs picked up while riding clack a reload under the RELOAD! line', () => {
    const tw = new TestWorld({ playerX: 100 });
    const swan = tw.spawn('swan', 100) as Swan;
    swan.mount(tw.player!);
    tw.spawn('pickup-bombs', 104, {}, FLOOR - 8);
    tw.until(() => logOf(tw).includes('voice:RELOAD!'), 120);
    expect(logOf(tw)).toContain('sfx:weapon/reload');
  });
});

describe('ams audio: ambience, carillon and footsteps', () => {
  it('every section has its ambience loop and the mission has audible footsteps', () => {
    // a, b, c, then the route (c1 the bridge or c2 the cruise: both on the water), d.
    expect(Object.values(AMS.sections).map((s) => s.ambience)).toEqual(['env/ams-canal', 'env/ams-street', 'env/ams-canal', 'env/ams-canal', 'env/ams-canal', 'env/ams-street']);
    expect(AMS.footsteps).toBe(true);
  });

  it('section b: the street ambience starts once and the carillon rings at 15 s (ticks, no rng)', () => {
    const pads: [VirtualPad, VirtualPad] = [new VirtualPad(), new VirtualPad()];
    const log: string[] = [];
    const audio = recorder(log, []);
    const runner = new MissionRunner({ session: new GameSession({ seed: 5 }), mission: 'ams', section: 'b', pads, audio, seed: 5 });
    runner.start();
    runner.world.god = true;
    for (let t = 0; t < CARILLON.first + 5; t++) runner.update();
    expect(count(log, 'loop:ambience:env/ams-street')).toBe(1);
    expect(count(log, `sfx:${CARILLON.id}`)).toBe(1);
    runner.completeMission();
    expect(count(log, 'stopLoop:ambience')).toBe(1);
  });
});
