/**
 * Characters (GDD §3, §4.13, §13.5, §15.1, §15.6): the four heroes and `recruit` register with
 * the GDD stats and texts; every `char/<id>/…` strip of the sprite contract exists with the right
 * frame counts and points (ARCHITECTURE §6.1, look.md §6.4); the knife looks and their sounds;
 * the Helium Head status (jump, float, no crouch, no mount, the one-hit shield, the wobble and the
 * deflate spin).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { NullAudio, type SfxOpts } from '../../src/engine/audio';
import type { Damage } from '../../src/engine/entity';
import { inPalette, PAL } from '../../src/engine/palette';
import type { Frame } from '../../src/engine/render';
import { frameCount, getFrames, hasSprite, listSprites, spriteAnim, spriteErrors } from '../../src/engine/sprites';
import type { World } from '../../src/engine/world';
import { stackFrames } from '../../src/game/art/humanoid';
import { HELIUM, HELIUM_DEFLATE_ID } from '../../src/game/content/characters/helium';
import { SQUEAK } from '../../src/game/content/characters/squeak';
import { KNIFE_SFX, knifeSfxFor, PLAYABLE, type HeroDef } from '../../src/game/content/characters/index';
import { getCharacter, getStatus, hasCharacter, defineEntity, type SpawnParams } from '../../src/game/registry';
import { TUNING } from '../../src/game/tuning';
import { Player } from '../../src/game/player/player';
import { Vehicle } from '../../src/game/vehicle';
import { FLOOR, Rig } from '../game/helpers';

const HEROES = ['grace', 'mittens', 'pip', 'gramps'] as const;
const ALL = ['recruit', ...HEROES] as const;

beforeAll(async () => {
  await import('../../src/game/content/characters/art');
});

/** Opaque bounds of a frame relative to its anchor. */
function bounds(f: Frame): { top: number; bottom: number; left: number; right: number } {
  const b = f.buf.trimBounds();
  if (!b) return { top: 0, bottom: 0, left: 0, right: 0 };
  return { top: b.y - f.oy, bottom: b.y + b.h - f.oy, left: b.x - f.ox, right: b.x + b.w - f.ox };
}

function strip(id: string, min: number, exact = false, pts: readonly string[] = []): readonly Frame[] {
  expect(hasSprite(id), `${id} is registered`).toBe(true);
  const fs = getFrames(id);
  if (exact) expect(fs.length, id).toBe(min);
  else expect(fs.length, id).toBeGreaterThanOrEqual(min);
  fs.forEach((f, i) => {
    expect(f.buf.countOpaque(), `${id}[${i}] has pixels`).toBeGreaterThan(0);
    for (const n of pts) {
      const p = f.pts?.[n];
      expect(p, `${id}[${i}] has point '${n}'`).toBeDefined();
      if (p) expect(Number.isInteger(p[0]) && Number.isInteger(p[1]), `${id}[${i}].${n} integer`).toBe(true);
    }
  });
  return fs;
}

const TORSO: ReadonlyArray<[string, number, readonly string[]]> = [
  ['idle', 2, ['muzzle']],
  ['shoot', 2, ['muzzle']],
  ['up', 1, ['muzzle']],
  ['shoot-up', 2, ['muzzle']],
  ['down', 1, ['muzzle']],
  ['shoot-down', 2, ['muzzle']],
  ['throw', 4, ['hand']],
  ['knife', 4, ['hand']],
];
const HEAVY_DIAG: ReadonlyArray<[string, number]> = [
  ['diag-up', 1],
  ['shoot-diag-up', 2],
  ['diag-down', 1],
  ['shoot-diag-down', 2],
];

// ------------------------------------------------------------------------------------ definitions

describe('character definitions (GDD §3, §13.5, §12.3)', () => {
  const TEXTS: Record<string, Partial<HeroDef>> = {
    grace: {
      name: 'GRACE',
      fullName: 'CAPT. GRACE STILLMERE',
      role: 'SQUAD LEADER',
      callsign: 'GRACE',
      quote: '"PARDON ME. I\'M HERE TO STOP THE MUSIC."',
      endingLine: '"THANK YOU, EVERYONE. YOU MAY NOW RESUME BEING QUIET."',
      voice: 'GRACE!',
      knifeSfx: 'weapon/knife-umbrella',
      knifeProp: 'umbrella',
    },
    mittens: {
      name: 'MITTENS',
      fullName: 'SGT. TORVALD "MITTENS" MAGNUSSON',
      role: 'HEAVY WEAPONS. KNITTING.',
      callsign: 'MITTENS',
      quote: '"..."',
      quoteSub: '(HE NODS. HE HAS KNITTED YOU A SCARF.)',
      endingLine: '(HE GIVES FANFARONI A SCARF. IT SAYS SHHH.)',
      voice: 'MITTENS!',
      knifeSfx: 'weapon/knife-needles',
      knifeProp: 'needles',
    },
    pip: {
      name: 'PIP',
      fullName: 'PVT. PIP OKAFOR',
      role: 'ROOKIE',
      callsign: 'PIP',
      quote: '"IS THIS THE REAL WAR? THE BROCHURE HAD MORE BALLOONS!"',
      endingLine: '"CAN WE DO THAT AGAIN? FROM THE START?"',
      voice: 'PIP!',
      knifeSfx: 'weapon/knife-pan',
      knifeProp: 'pan',
    },
    gramps: {
      name: 'GRAMPS',
      fullName: 'W.O. AMBROSE "GRAMPS" FENWICK',
      role: 'ENGINEER. BUILT THE SWAN.',
      callsign: 'GRAMPS',
      quote: '"BACK IN MY DAY, TANKS DIDN\'T HAVE LEGS. THEN I GAVE THEM LEGS."',
      endingLine: '"RIGHT. WHO WANTS TO SEE THE MK4? IT\'S A SUBMARINE. DON\'T TELL ACCOUNTING."',
      voice: 'GRAMPS!',
      knifeSfx: 'weapon/knife-wrench',
      knifeProp: 'wrench',
    },
  };

  it('registers the four heroes (select order) and recruit (not on the select screen)', () => {
    for (const id of ALL) expect(hasCharacter(id), id).toBe(true);
    expect(PLAYABLE).toEqual(['grace', 'mittens', 'pip', 'gramps']);
    expect(PLAYABLE).not.toContain('recruit');
  });

  it('every text of GDD §3 / §13.5 / §12.3, exactly', () => {
    for (const id of HEROES) {
      const c = getCharacter(id) as HeroDef;
      expect(c.id).toBe(id);
      expect(c.art).toBe(`char/${id}`);
      for (const [k, v] of Object.entries(TEXTS[id])) expect(c[k as keyof HeroDef], `${id}.${k}`).toEqual(v);
      expect(c.title, `${id}.title`).toBe(c.role);
      expect(c.description?.length ?? 0).toBeGreaterThan(10);
      expect(typeof c.color).toBe('number');
      expect(inPalette(c.color ?? 0)).toBe(true);
    }
    // Only Mittens has a stage direction under his quote.
    for (const id of ['grace', 'pip', 'gramps']) expect((getCharacter(id) as HeroDef).quoteSub).toBeUndefined();
    // Distinct accent colours.
    expect(new Set(HEROES.map((id) => getCharacter(id).color)).size).toBe(4);
  });

  it('the same stats for every hero (GDD §3); bombs per life follow the difficulty', () => {
    for (const id of HEROES) {
      const s = getCharacter(id).stats ?? {};
      expect(s, id).toEqual({ speed: 1, jump: 1, weapon: 'pistol', bomb: 'grenade', melee: 'knife', ammo: 1 });
      expect(s.bombs, `${id}: no fixed bombs (10, EASY 15)`).toBeUndefined();
    }
  });

  it('knife sounds per character (GDD §6.2) as data: a field on the def and a map', () => {
    expect(KNIFE_SFX).toEqual({
      grace: 'weapon/knife-umbrella',
      mittens: 'weapon/knife-needles',
      pip: 'weapon/knife-pan',
      gramps: 'weapon/knife-wrench',
    });
    expect(knifeSfxFor('recruit')).toBe('weapon/knife');
    expect(knifeSfxFor('pip')).toBe('weapon/knife-pan');
    expect((getCharacter('recruit') as HeroDef).knifeSfx).toBeUndefined();
  });

  it('a player of each hero starts with the GDD kit and difficulty bombs', () => {
    for (const id of HEROES) {
      const rig = new Rig();
      rig.session.slots[0].character = id;
      expect(getCharacter(rig.session.slots[0].character).id).toBe(id);
      const s = getCharacter(id).stats ?? {};
      expect(s.weapon ?? 'pistol').toBe('pistol');
      expect(s.bombs ?? rig.session.mods.grenades).toBe(10);
    }
  });
});

// ------------------------------------------------------------------------------------ sprites

describe('sprite contract per character (ARCHITECTURE §6.1, GDD §3.6)', () => {
  it.each(ALL)('%s: legs with hip points, feet on the ground line', (c) => {
    const P = `char/${c}/`;
    for (const [a, n, exact] of [
      ['idle', 1, false],
      ['run', 8, true],
      ['jump', 2, false],
      ['fall', 1, false],
      ['land', 1, false],
      ['crouch', 1, false],
      ['crouch-walk', 6, true],
    ] as const) {
      strip(`${P}legs-${a}`, n, exact, ['hip']);
    }
    for (const id of [`${P}legs-run`, `${P}legs-crouch-walk`, `${P}legs-idle`, `${P}legs-crouch`]) {
      for (const f of getFrames(id)) expect(bounds(f).bottom, id).toBe(0);
    }
    expect(new Set(getFrames(`${P}legs-run`).map((f) => f.pts?.hip?.[1])).size, `${c} run hip bobs`).toBeGreaterThanOrEqual(1);
  });

  it.each(ALL)('%s: torsos for pistol and heavy (muzzle on aim / shoot, hand on throw / knife)', (c) => {
    for (const w of ['pistol', 'heavy']) {
      for (const [a, n, pts] of TORSO) strip(`char/${c}/torso-${w}-${a}`, n, false, pts);
    }
    for (const [a, n] of HEAVY_DIAG) strip(`char/${c}/torso-heavy-${a}`, n, false, ['muzzle']);
    // Hip anchor: the torso ends a few px under the hip.
    for (const f of getFrames(`char/${c}/torso-pistol-idle`)) {
      expect(bounds(f).bottom).toBeGreaterThanOrEqual(1);
      expect(bounds(f).bottom).toBeLessThanOrEqual(6);
    }
  });

  it.each(ALL)('%s: full-body strips, salute (2 f) and the 32×32 portrait', (c) => {
    const P = `char/${c}/`;
    strip(P + 'die', 6);
    strip(P + 'die-burn', 4);
    strip(P + 'die-blast', 4);
    strip(P + 'victory', 2);
    strip(P + 'spawn', 3);
    strip(P + 'bored', 4);
    strip(P + 'mount', 2);
    strip(P + 'salute', 2, true);
    expect(spriteAnim(P + 'die').loop).toBe(false);
    expect(spriteAnim(P + 'salute').loop).toBe(false);
    const p = strip(P + 'portrait', 1, true);
    expect([p[0].buf.w, p[0].buf.h]).toEqual([32, 32]);
    expect([p[0].ox, p[0].oy]).toEqual([0, 0]);
    // Lying death frames rest on the ground.
    const die = getFrames(P + 'die');
    expect(bounds(die[die.length - 1]).bottom, `${c} lies on the floor`).toBe(0);
  });

  it.each(ALL)('%s: the nine Swan rider strips (14 frames, head + hand, no muzzle)', (c) => {
    let total = 0;
    for (const [n, k] of [
      ['sit', 2],
      ['lean', 2],
      ['up', 1],
      ['hunch', 1],
      ['hold', 2],
      ['brace', 1],
      ['duck', 1],
      ['ears', 2],
      ['cheer', 2],
    ] as const) {
      const fs = strip(`char/${c}/ride-${n}`, k, true, ['head', 'hand']);
      for (const f of fs) expect(f.pts?.muzzle).toBeUndefined();
      total += fs.length;
    }
    expect(total).toBe(14);
    expect(listSprites(`char/${c}/helium-ride`)).toEqual([]);
  });

  it.each(ALL)('%s: Helium Head variants of every torso strip, bored and victory', (c) => {
    for (const infix of [HELIUM.art, HELIUM.wobArt]) {
      for (const w of ['pistol', 'heavy']) {
        for (const [a, n, pts] of TORSO) {
          const id = `char/${c}/${infix}-torso-${w}-${a}`;
          strip(id, n, false, pts);
          expect(frameCount(id)).toBe(frameCount(`char/${c}/torso-${w}-${a}`));
        }
      }
      for (const [a, n] of HEAVY_DIAG) strip(`char/${c}/${infix}-torso-heavy-${a}`, n, false, ['muzzle']);
      expect(frameCount(`char/${c}/${infix}-bored`)).toBe(frameCount(`char/${c}/bored`));
      expect(frameCount(`char/${c}/${infix}-victory`)).toBe(frameCount(`char/${c}/victory`));
    }
    // The big head: about twice as tall above the shoulders, with a pink rim.
    const normal = getFrames(`char/${c}/torso-pistol-idle`)[0];
    const big = getFrames(`char/${c}/helium-torso-pistol-idle`)[0];
    expect(-bounds(big).top - -bounds(normal).top).toBeGreaterThanOrEqual(8);
    let pink = 0;
    for (const px of big.buf.data) if (px === PAL.pink[1]) pink++;
    expect(pink, `${c} helium rim`).toBeGreaterThan(20);
    // No helium legs: the body never changes (the player falls back to the normal legs).
    expect(listSprites(`char/${c}/helium-legs`)).toEqual([]);
  });

  it('standing heights fit the human contract (34–38 px; hats up to 42) and differ by silhouette', () => {
    const h: Record<string, number> = {};
    for (const c of ALL) {
      const f = stackFrames(getFrames(`char/${c}/legs-idle`)[0], getFrames(`char/${c}/torso-pistol-idle`)[0]);
      const b = bounds(f);
      expect(b.bottom, c).toBe(0);
      h[c] = -b.top;
      expect(h[c], c).toBeGreaterThanOrEqual(34);
      expect(h[c], c).toBeLessThanOrEqual(42);
      const cr = stackFrames(getFrames(`char/${c}/legs-crouch`)[0], getFrames(`char/${c}/torso-pistol-idle`)[0]);
      expect(-bounds(cr).top, `${c} crouched`).toBeLessThanOrEqual(31);
    }
    // Mittens (bobble hat) is the tallest hero, Gramps (bald) the shortest (look.md §3.3).
    expect(h.mittens).toBeGreaterThan(h.grace);
    expect(h.gramps).toBeLessThan(h.grace);
    // Heavy build: Mittens is the widest.
    const w = (c: string): number => getFrames(`char/${c}/legs-idle`)[0].buf.countOpaque() + getFrames(`char/${c}/torso-pistol-idle`)[0].buf.countOpaque();
    for (const c of ['grace', 'pip', 'gramps']) expect(w('mittens')).toBeGreaterThan(w(c));
  });

  it('heroes look different: distinct colours in their standing frames and portraits', () => {
    const sig = (id: string): string => {
      const seen = new Map<number, number>();
      for (const px of getFrames(id)[0].buf.data) if ((px & 255) !== 0) seen.set(px, (seen.get(px) ?? 0) + 1);
      // The 5 most used colours, as a signature.
      return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map((e) => e[0]).join(',');
    };
    const torsos = new Set(HEROES.map((c) => sig(`char/${c}/torso-pistol-idle`)));
    expect(torsos.size).toBe(4);
    const portraits = HEROES.map((c) => Array.from(getFrames(`char/${c}/portrait`)[0].buf.data).join(','));
    expect(new Set(portraits).size).toBe(4);
  });

  it('knife looks: each hero holds its prop (the hand point reaches past a plain knife)', () => {
    const reach = (c: string): number => Math.max(...getFrames(`char/${c}/torso-pistol-knife`).map((f) => f.pts?.hand?.[0] ?? 0));
    for (const c of HEROES) expect(reach(c), c).toBeGreaterThan(10);
    // The umbrella jab reaches furthest forward.
    expect(reach('grace')).toBeGreaterThanOrEqual(reach('recruit'));
  });

  it('all character art: palette colours only, inside 128 px, no generator errors', () => {
    const ids = listSprites('char/');
    // Per character: legs 7, torsos 20 (+ 20 helium, + 20 helium-wob), bored and victory (× 3),
    // die, die-burn, die-blast, spawn, mount, salute, portrait and the 9 rider strips.
    for (const c of ALL) expect(listSprites(`char/${c}/`).length, c).toBe(7 + 60 + 6 + 7 + 9);
    expect(ids.length).toBeGreaterThanOrEqual(ALL.length * 89);
    for (const id of ids) {
      for (const f of getFrames(id)) {
        expect(f.buf.w, id).toBeLessThanOrEqual(128);
        expect(f.buf.h, id).toBeLessThanOrEqual(128);
        let bad = 0;
        for (const px of f.buf.data) if ((px & 255) !== 0 && ((px & 255) !== 255 || !inPalette(px))) bad++;
        expect(bad, `${id}: non-palette pixels`).toBe(0);
      }
    }
    expect(spriteErrors().filter((e) => e.id.startsWith('char/'))).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------ Helium Head

/** A plain vehicle to test that Helium Head blocks mounting. */
class CharTestTank extends Vehicle {
  constructor(world: World, x: number, y: number, p: SpawnParams = {}) {
    super(world, x, y, p, { art: 'vehicle/char-test-tank', w: 36, h: 26, seat: { x: -10, y: -34, w: 20, h: 14 }, seatPoint: [0, -20], mainGun: 'vulcan', cannon: 'cannon', speed: 1.6 });
  }
}
defineEntity('char-test-tank', (w, x, y, p) => new CharTestTank(w, x, y, p), { category: 'vehicle' });

interface SfxLog {
  ids: string[];
  pitch: Map<string, number>;
  voices: string[];
}

function withAudio(rig: Rig): SfxLog {
  const log: SfxLog = { ids: [], pitch: new Map(), voices: [] };
  rig.world.audio = Object.assign(new NullAudio(), {
    sfx(id: string, o?: SfxOpts): void {
      log.ids.push(id);
      log.pitch.set(id, o?.pitch ?? 1);
    },
    voice(line: string): void {
      log.voices.push(line);
    },
  });
  return log;
}

function helium(rig: Rig): void {
  const st = getStatus('helium-head');
  expect(st).toBeDefined();
  rig.p.status.add(st!);
}

const BULLET: Damage = { amount: 10, kind: 'bullet', dirX: -1 };

describe('Helium Head (GDD §4.13)', () => {
  it('is registered with the GDD numbers and art infix', () => {
    const d = getStatus('helium-head')!;
    expect(d.ticks).toBe(600);
    expect(d.speed).toBe(0.9);
    expect(d.fallGravity).toBe(0.05);
    expect(d.maxFall).toBe(1.0);
    expect(d.noCrouch).toBe(true);
    expect(d.noMount).toBe(true);
    expect(d.sfxPitch).toBe(1.6);
    expect(d.art).toBe('helium');
    expect(d.icon).toBe('ui/icon-balloon');
    expect(TUNING.player.jumpVelocity * (d.jump ?? 1)).toBeCloseTo(-4.5, 6);
    expect(getStatus(HELIUM_DEFLATE_ID)?.ticks).toBe(30);
  });

  it('applies with the announcer, the HI! bubble and the on sound; art infix helium', () => {
    const rig = new Rig();
    const log = withAudio(rig);
    helium(rig);
    expect(rig.p.status.has('helium-head')).toBe(true);
    expect(rig.p.status.art).toBe('helium');
    expect(log.voices).toContain('HELIUM HEAD!');
    expect(log.ids).toContain('player/helium-on');
    expect(rig.hud.bubbles.some((b) => b.target === rig.p && b.text === 'HI!')).toBe(true);
    rig.run(1);
    // The player draws the 2× head strips.
    expect(rig.p.torso.id).toBe('char/recruit/helium-torso-pistol-idle');
  });

  it('jumps with vy −4.5 to an apex of about 78 px; floats down at ≤ 1.0 px/tick with jump held; pitch 1.6', () => {
    const rig = new Rig();
    const log = withAudio(rig);
    helium(rig);
    rig.run(2);
    const y0 = rig.p.y;
    rig.hold(['jump']).run(1);
    expect(log.pitch.get('player/jump')).toBe(1.6);
    // vy after the first tick of flight: −4.5 + gravity.
    expect(rig.p.vy).toBeLessThan(-4.2);
    let top = rig.p.y;
    for (let i = 0; i < 60; i++) {
      rig.run(1);
      top = Math.min(top, rig.p.y);
    }
    const apex = y0 - top;
    expect(apex).toBeGreaterThan(70);
    expect(apex).toBeLessThan(84);
    // Falling with jump held: the slow float.
    rig.until(() => rig.p.vy > 0, 60);
    rig.run(30);
    expect(rig.p.vy).toBeLessThanOrEqual(1.0001);
    expect(rig.p.body.gravity).toBeCloseTo(0.05, 6);
    rig.release().run(1);
    expect(rig.p.body.gravity).toBeCloseTo(TUNING.physics.gravity, 6);
  });

  it('runs at 0.9 × speed and never crouches (the head bobs instead)', () => {
    const rig = new Rig();
    helium(rig);
    rig.hold(['right']).run(30);
    expect(Math.abs(rig.p.vx)).toBeCloseTo(TUNING.player.runSpeed * 0.9, 5);
    rig.hold(['down']).run(30);
    expect(rig.p.crouching).toBe(false);
    // The bob swaps the art to the wobbling head every 8 ticks.
    const arts = new Set<string>();
    for (let i = 0; i < 24; i++) {
      rig.run(1);
      arts.add(rig.p.status.art);
    }
    expect(arts).toEqual(new Set(['helium', 'helium-wob']));
  });

  it('blocks mounting: the pilot floats off the seat with a ? bubble', () => {
    const rig = new Rig({ x: 100 });
    const tank = rig.world.spawn('char-test-tank', 200, FLOOR) as CharTestTank;
    rig.world.flush();
    helium(rig);
    rig.p.placeAt(200, 120, 0);
    rig.p.y = 120;
    rig.p.body.onGround = false;
    let bubble = false;
    for (let i = 0; i < 90; i++) {
      rig.run(1);
      if (rig.hud.bubbles.some((b) => b.target === rig.p && b.text === '?')) bubble = true;
    }
    expect(rig.p.state).toBe('play');
    expect(tank.driver).toBeNull();
    expect(bubble).toBe(true);
    // Without the status the same drop mounts.
    const rig2 = new Rig({ x: 100 });
    rig2.world.spawn('char-test-tank', 200, FLOOR);
    rig2.world.flush();
    rig2.p.placeAt(200, 120, 0);
    rig2.p.y = 120;
    rig2.p.body.onGround = false;
    rig2.until(() => rig2.p.state === 'mounted', 90);
  });

  it('one-hit shield: the first lethal hit pops the head (confetti, sound), 60 invulnerable ticks', () => {
    const rig = new Rig();
    const log = withAudio(rig);
    helium(rig);
    rig.run(5);
    const parts = rig.world.particles.count;
    expect(rig.p.onHit(BULLET)).toBe(true);
    expect(rig.p.state).toBe('play');
    expect(rig.p.status.has('helium-head')).toBe(false);
    expect(rig.p.status.has(HELIUM_DEFLATE_ID)).toBe(false);
    expect(rig.p.invulnTicks).toBeGreaterThanOrEqual(60);
    expect(log.ids).toContain('player/helium-pop');
    expect(rig.world.particles.count).toBeGreaterThan(parts);
    expect(rig.p.status.art).toBe('');
    // The next hit after the invulnerability kills as usual.
    rig.run(61);
    rig.p.onHit(BULLET);
    expect(rig.p.state).toBe('dead');
  });

  it('crushers still kill through the shield', () => {
    const rig = new Rig();
    helium(rig);
    rig.run(2);
    rig.p.onHit({ amount: 1e6, kind: 'crush', dirX: 0 });
    expect(rig.p.state).toBe('dead');
    expect(rig.p.status.has('helium-head')).toBe(false);
    expect(rig.p.status.has(HELIUM_DEFLATE_ID)).toBe(false);
  });

  it('wobbles in the last 120 ticks, then PFFFT: a 30-tick spin with no control, invulnerable, two turns', () => {
    const rig = new Rig();
    const log = withAudio(rig);
    helium(rig);
    rig.run(600 - 120 - 2);
    expect(rig.p.status.art).toBe('helium');
    const arts = new Set<string>();
    for (let i = 0; i < 40; i++) {
      rig.run(1);
      arts.add(rig.p.status.art);
    }
    expect(arts).toEqual(new Set(['helium', 'helium-wob']));
    rig.until(() => !rig.p.status.has('helium-head'), 120);
    expect(rig.p.status.has(HELIUM_DEFLATE_ID)).toBe(true);
    expect(log.ids).toContain('player/helium-deflate');
    expect(log.pitch.get('player/helium-deflate')).toBe(1);
    expect(rig.p.status.art).toBe('');
    // No control and two turns in place; hits are absorbed.
    const x0 = rig.p.x;
    let flips = 0;
    let facing = rig.p.facing;
    rig.hold(['right', 'jump']);
    expect(rig.p.onHit(BULLET)).toBe(true);
    expect(rig.p.state).toBe('play');
    for (let i = 0; i < 29; i++) {
      rig.run(1);
      if (rig.p.facing !== facing) {
        flips++;
        facing = rig.p.facing;
      }
    }
    expect(flips).toBe(4);
    expect(Math.abs(rig.p.x - x0)).toBeLessThan(1);
    rig.release().run(2);
    expect(rig.p.status.has(HELIUM_DEFLATE_ID)).toBe(false);
    expect(rig.p.status.list.length).toBe(0);
  });

  it('death ends it without the spin; picking it up again refreshes the timer', () => {
    const rig = new Rig();
    helium(rig);
    rig.run(100);
    helium(rig);
    expect(rig.p.status.ticksLeft('helium-head')).toBe(600);
    rig.p.kill('pit');
    expect(rig.p.status.has('helium-head')).toBe(false);
    expect(rig.p.status.has(HELIUM_DEFLATE_ID)).toBe(false);
  });
});

// ------------------------------------------------------------------------------------ squeaky boot

describe("Gramps' squeaky boot (GDD §3.4)", () => {
  it('is the status Gramps names for the end of his bored fidget; nobody else has one', () => {
    expect((getCharacter('gramps') as HeroDef).boredStatus).toBe(SQUEAK.id);
    for (const id of ['grace', 'mittens', 'pip', 'recruit']) expect((getCharacter(id) as HeroDef).boredStatus, id).toBeUndefined();
    const st = getStatus(SQUEAK.id);
    expect(st?.ticks).toBe(120);
    // Cosmetic only: no icon, no rule changes.
    expect(st?.icon).toBeUndefined();
    expect(st?.speed ?? 1).toBe(1);
    expect(st?.noControl ?? false).toBe(false);
  });

  it('the player adds it when Gramps moves again after his bored fidget played (not before)', () => {
    const rig = new Rig();
    rig.p.remove();
    const g = new Player(rig.world, 100, FLOOR, { pad: rig.pads[0], index: 0, character: 'gramps' });
    rig.world.add(g);
    g.placeAt(100, FLOOR, 0);
    rig.world.flush();
    // Moving before the fidget: nothing.
    rig.run(TUNING.player.boredTicks - 10).hold(['right']).run(4).release();
    expect(g.status.has(SQUEAK.id)).toBe(false);
    // Idle long enough for the fidget, then step off: the boot squeaks.
    rig.run(TUNING.player.boredTicks + 20);
    expect(g.full.id).toBe('char/gramps/bored');
    rig.hold(['right']).run(2);
    expect(g.status.has(SQUEAK.id)).toBe(true);
  });

  it('squeaks on every step for 120 ticks, never while standing still', () => {
    const rig = new Rig();
    const log = withAudio(rig);
    rig.run(2);
    rig.p.status.add(getStatus(SQUEAK.id)!);
    rig.run(30);
    expect(log.ids.filter((id) => id === SQUEAK.sfx)).toEqual([]);
    rig.hold(['right']).run(80);
    const steps = log.ids.filter((id) => id === SQUEAK.sfx).length;
    // About one squeak per 16 ticks of running (the first one at once).
    expect(steps).toBeGreaterThanOrEqual(4);
    expect(steps).toBeLessThanOrEqual(6);
    expect(log.pitch.get(SQUEAK.sfx)).toBeCloseTo(SQUEAK.pitch, 6);
    rig.run(20);
    expect(rig.p.status.has(SQUEAK.id)).toBe(false);
    const after = log.ids.filter((id) => id === SQUEAK.sfx).length;
    rig.run(40);
    expect(log.ids.filter((id) => id === SQUEAK.sfx).length).toBe(after);
  });
});
