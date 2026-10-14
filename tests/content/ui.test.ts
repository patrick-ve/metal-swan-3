/**
 * UI content (GDD §13, §14; docs/ARCHITECTURE.md §7.1): the ui/ sprite ids, the mission cards,
 * the HUD rules that are easy to break (no ammo digits for the pistol, the Swan marker at the top
 * edge, hints that SPEECH BUBBLES OFF never hides), and the tally / final tally numbers.
 */
import { describe, expect, it } from 'vitest';
import { NullAudio } from '../../src/engine/audio';
import { InputManager } from '../../src/engine/input';
import { PAL } from '../../src/engine/palette';
import type { DrawOpts, TextOpts } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { getFrame, hasSprite } from '../../src/engine/sprites';
import { MemoryStore } from '../../src/engine/storage';
import { createApp, newCampaign } from '../../src/game/app';
import { loadContent } from '../../src/game/content/index';
import { MISSION_CARDS } from '../../src/game/content/ui/cards';
import { drawHud } from '../../src/game/hud';
import { creditsRoll, wrapPx } from '../../src/game/scenes/ending';
import { finalTallyLines } from '../../src/game/scenes/final-tally';
import { CREDITS, ENDING_CAPTIONS, HOW_TO_PLAY, missionCard } from '../../src/game/scenes/flow-data';
import { joinCharacter, startNewGame, type GameplayScene } from '../../src/game/scenes/gameplay';
import { bossSpeedBonus, hatsCollected } from '../../src/game/scenes/mission-complete';
import { briefingLines } from '../../src/game/scenes/mission-intro';
import { DEFAULT_SETTINGS } from '../../src/game/settings';
import { PlayerSlot } from '../../src/game/session';
import { Vehicle } from '../../src/game/vehicle';

await loadContent();

/** A software renderer that remembers the text and sprites drawn. */
class Recorder extends SoftRenderer {
  texts: { s: string; x: number; y: number }[] = [];
  sprites: { id: string; frame: number; x: number; y: number }[] = [];
  override text(s: string, x: number, y: number, o?: TextOpts): void {
    this.texts.push({ s, x, y });
    super.text(s, x, y, o);
  }
  override sprite(id: string, frame: number, x: number, y: number, o?: DrawOpts): void {
    this.sprites.push({ id, frame, x, y });
    super.sprite(id, frame, x, y, o);
  }
  reset(): void {
    this.texts = [];
    this.sprites = [];
  }
}

function game(characters: readonly string[] = ['grace']): { scene: GameplayScene; step: (n: number) => void } {
  const input = new InputManager();
  const app = createApp({ input, audio: new NullAudio(), store: new MemoryStore() });
  startNewGame(app, { mission: 'm0', players: characters.length as 1 | 2, characters });
  const step = (n: number): void => {
    for (let i = 0; i < n; i++) {
      input.update();
      app.scenes.update();
    }
  };
  step(40);
  return { scene: app.scenes.top as GameplayScene, step };
}

function hud(scene: GameplayScene, r: Recorder, settings = DEFAULT_SETTINGS): void {
  r.reset();
  r.begin();
  drawHud(r, { session: scene.session, hud: scene.runner.hud, runner: scene.runner, inputPlayers: 1, ticks: 1, settings });
  r.end();
}

describe('ui sprites (GDD §15.6, ARCHITECTURE §7.1)', () => {
  const ids = [
    'ui/logo',
    'ui/cursor-swan',
    'ui/icon-life',
    'ui/icon-hostage',
    'ui/icon-bomb',
    'ui/icon-shell',
    'ui/icon-cell',
    'ui/icon-balloon',
    'ui/icon-pistol',
    'ui/onward',
    'ui/ride',
    'ui/bubble',
    'ui/newspaper',
    'ui/stamp',
    'ui/star',
    'ui/portrait-gusto',
    'ui/swan-marker',
    'ui/title-swan',
    'ui/parade',
    'ui/chair',
    'ui/loudspeaker',
    'ui/rope',
    'ui/ending-organ',
    'ui/ending-pipe',
    'ui/fanfaroni',
    'ui/ending-mk1',
    'ui/ending-flyer',
    'ui/placard',
    'ui/pigeon',
    'ui/horse',
    'ui/leader-blare',
    'ui/leader-rimshot',
    'ui/leader-puffington',
    'ui/leader-pizzicata',
  ];
  it.each(ids)('%s is registered', (id) => {
    expect(hasSprite(id)).toBe(true);
    expect(getFrame(id, 0).buf.w).toBeGreaterThan(0);
  });

  it('the life icon is a 6×6 head with an ink outline; the marker outlines it in the rider colour', () => {
    const life = getFrame('ui/icon-life', 0).buf;
    expect([life.w, life.h]).toEqual([8, 8]);
    const has = (frame: number, c: number): boolean => {
      const b = getFrame('ui/swan-marker', frame).buf;
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (b.get(x, y) === c) return true;
      return false;
    };
    expect(has(0, PAL.sky[3])).toBe(true);
    expect(has(1, PAL.gold[3])).toBe(true);
  });

  it('the newspaper page fits the view with a 12 / 6 px border', () => {
    const f = getFrame('ui/newspaper', 0).buf;
    expect(f.w).toBeLessThanOrEqual(384 - 12 * 2 + 3);
    expect(f.h).toBeLessThanOrEqual(216 - 6 * 2 + 3);
  });
});

describe('mission cards (GDD §2.4, §12.3, §13.6, §13.11)', () => {
  // This wave: the Amsterdam prologue `ams` is MISSION 1; m1–m4 became MISSION 2–5.
  const gdd: Record<string, { label: string; name: string; place: string; briefing: [string, string]; headline: string; announce: string }> = {
    ams: {
      label: 'MISSION 1',
      name: 'THE FRYING DUTCHMAN',
      place: 'AMSTERDAM - 1100 HOURS',
      briefing: ['SHORE LEAVE IN AMSTERDAM. THE CYGNETS WANT FRIES.', 'THE BEST FRY SHOP IN TOWN NEEDS HELP. GO!'],
      headline: 'ROBO-MAYOR SCRAPPED! THE FRYER STAYS ON!',
      announce: 'MISSION ONE. VLIEG OP, ZWAAN!',
    },
    m1: {
      label: 'MISSION 2',
      name: 'BRASS ON THE RIVERBANK',
      place: 'PUDDLEWICK, LOWMERE - 0900 HOURS',
      briefing: ['THE LEGION HIJACKED THE PUDDLEWICK DUCK REGATTA.', 'FREE THE CRITICS, SINK THEIR FLAGSHIP, MIND THE DUCKS.'],
      headline: 'RIVERBOAT SUNK! REGATTA RESUMES!',
      announce: 'MISSION TWO. LOOK SHARP, CYGNETS!',
    },
    m2: {
      label: 'MISSION 3',
      name: 'DUNE BUGLE',
      place: 'RATTLEBONE FLATS, CRESCENDIA - 1200 HOURS',
      briefing: ['THEIR DRUM CORPS IS TESTING A DRUM THE SIZE OF A HOUSE.', "STOP IT. AND DO NOT LAUGH AT THE COLONEL'S JOKES."],
      headline: "DRUM TANK SILENCED! COLONEL'S JOKES STILL BAD!",
      announce: 'MISSION THREE. STAY HYDRATED, CYGNETS!',
    },
    m3: {
      label: 'MISSION 4',
      name: 'THE HIGH NOTE',
      place: 'MOUNT MURMUR, CRESCENDIA - 1700 HOURS',
      briefing: ['THE WOODWINDS HAVE TAKEN MOUNT MURMUR AND ITS SKI LIFT.', 'SOMETHING HUGE AND TARTAN FLOATS AT THE TOP. DEFLATE IT.'],
      headline: 'WINDBAG DEFLATED ON MOUNT MURMUR!',
      announce: 'MISSION FOUR. WRAP UP WARM, CYGNETS!',
    },
    m4: {
      label: 'MISSION 5',
      name: 'OPENING NIGHT',
      place: 'FANFARONI CITY - 2100 HOURS',
      briefing: ['TONIGHT FANFARONI REHEARSES THE ANTHEM AT THE OPERA.', 'CRASH THE DRESS REHEARSAL. FORMAL WEAR OPTIONAL.'],
      headline: 'PREMIERE CANCELLED! PIANO "UNPLAYABLE"!',
      announce: 'MISSION FIVE. BREAK A LEG, CYGNETS!',
    },
    m5: {
      label: 'FINAL MISSION',
      name: 'SWAN SONG',
      place: 'ABOVE THE CLOUDS - 2330 HOURS',
      briefing: ['THE GRAND ORGAN FLIES. THE ANTHEM STARTS AT MIDNIGHT.', 'GRAMPS SAYS THE SWAN CAN FLY NOW. ...SINCE WHEN, GRAMPS?'],
      headline: 'ANTHEM STOPPED! WORLD STAYS FREE TO SLOUCH!',
      announce: 'FINAL MISSION. FLY GRACEFULLY, CYGNETS!',
    },
  };
  it.each(Object.keys(gdd))('%s matches the GDD and its briefing fits the radio box', (id) => {
    const c = missionCard(id);
    const want = gdd[id];
    expect({ label: c.label, name: c.name, place: c.place, briefing: c.briefing, headline: c.headline, announce: c.announce }).toEqual(want);
    const lines = briefingLines(c);
    expect(lines.length).toBeLessThanOrEqual(4);
    expect(lines.join(' ')).toBe(want.briefing.join(' '));
  });

  it('every card has a line map with its dot inside the area above the radio box', () => {
    for (const c of MISSION_CARDS) {
      expect(c.map, c.id).toBeDefined();
      const [x, y] = c.map!.dot;
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(384);
      expect(y).toBeGreaterThan(54);
      expect(y).toBeLessThan(120);
    }
  });
});

describe('HUD (GDD §13.7)', () => {
  it('the pistol shows its icon and no ammo digits; a machine gun shows its ammo', () => {
    const { scene } = game();
    const r = new Recorder();
    hud(scene, r);
    expect(r.sprites.some((s) => s.id === 'ui/icon-pistol')).toBe(true);
    expect(r.texts.filter((t) => t.y === 12 && /^\d+$/.test(t.s))).toEqual([]);
    scene.runner.players[0].giveWeapon('machine-gun', 150, false);
    hud(scene, r);
    expect(r.texts.some((t) => t.y === 12 && t.s === '150')).toBe(true);
  });

  it('lives in reserve as swan heads (max 5, then xN)', () => {
    const { scene } = game();
    const r = new Recorder();
    scene.session.slots[0].lives = 3;
    hud(scene, r);
    expect(r.sprites.filter((s) => s.id === 'ui/icon-life').length).toBe(2);
    scene.session.slots[0].lives = 8;
    hud(scene, r);
    expect(r.sprites.filter((s) => s.id === 'ui/icon-life').length).toBe(1);
    expect(r.texts.some((t) => t.s === 'x7')).toBe(true);
  });

  it('the Swan marker shows at the top edge while her rider is above the view, in the rider colour, and goes away in view', () => {
    const { scene, step } = game();
    const runner = scene.runner;
    const p = runner.players[0];
    const v = runner.world.spawn('swan', p.x + 4, p.y) as Vehicle;
    step(2);
    v.mount(p);
    step(10);
    const r = new Recorder();
    hud(scene, r);
    expect(r.sprites.some((s) => s.id === 'ui/swan-marker')).toBe(false);
    v.y -= 150;
    hud(scene, r);
    const m = r.sprites.find((s) => s.id === 'ui/swan-marker');
    expect(m).toBeDefined();
    expect(m!.frame).toBe(0);
    const f = getFrame('ui/swan-marker', 0);
    expect(m!.y - f.oy).toBe(1);
    // Kept 4 px inside the side edges.
    v.x = runner.world.camera.renderX - 100;
    hud(scene, r);
    const edge = r.sprites.find((s) => s.id === 'ui/swan-marker');
    expect(edge!.x - f.ox).toBe(4);
  });

  it('hints (RIDE?, STOMP!) show with SPEECH BUBBLES OFF; gag bubbles do not', () => {
    const { scene } = game();
    const h = scene.runner.hud;
    const p = scene.runner.players[0];
    h.bubble({ x: p.x + 40, y: p.y }, 'RIDE?', { kind: 'hint' });
    h.bubble({ x: p.x + 80, y: p.y }, 'MMF!', { kind: 'gag' });
    h.pointer({ x: p.x + 120, y: p.y }, 'STOMP!');
    const r = new Recorder();
    hud(scene, r, { ...DEFAULT_SETTINGS, speechBubbles: false });
    expect(r.texts.some((t) => t.s === 'RIDE?')).toBe(true);
    expect(r.texts.some((t) => t.s === 'STOMP!')).toBe(true);
    expect(r.texts.some((t) => t.s === 'MMF!')).toBe(false);
  });

  it('style callouts sit centred at y 60 (DRUM ROLL! +1000)', () => {
    const { scene } = game();
    scene.runner.hud.callout('DRUM ROLL! +1000');
    const r = new Recorder();
    hud(scene, r);
    const c = r.texts.find((t) => t.s === 'DRUM ROLL! +1000');
    expect(c).toBeDefined();
    expect([c!.x, c!.y]).toEqual([192, 60]);
  });

  it('a 2-player HUD draws 200 frames in well under a frame budget', () => {
    const { scene } = game(['grace', 'pip']);
    const r = new Recorder();
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) hud(scene, r);
    expect((performance.now() - t0) / 200).toBeLessThan(2);
  });
});

describe('tally numbers (GDD §14.4, §14.6)', () => {
  it('BOSS SPEED BONUS: max(0, 90 − s) × 200 (max 18,000); m5: max(0, 240 − s) × 200', () => {
    expect(bossSpeedBonus('m1', 0, 42 * 60)).toBe(9600);
    expect(bossSpeedBonus('m1', 0, 0)).toBe(18000);
    expect(bossSpeedBonus('m1', 0, 100 * 60)).toBe(0);
    expect(bossSpeedBonus('m1', -1, 600)).toBe(0);
    expect(bossSpeedBonus('m5', 600, 600 + 200 * 60)).toBe(8000);
  });

  it('HATS COLLECTED counts infantry (outfit variants too), not machines', () => {
    expect(hatsCollected({ rifleman: 30, 'rifleman-desert': 12, drummer: 5, 'oompah-tank': 1, bullfrog: 3 })).toBe(47);
  });

  it('final tally: LIVES LEFT × 50,000, ALL GOLDEN RECORDS, ONE-TAKE WONDER, CONTINUES USED', () => {
    const slot = new PlayerSlot(0);
    slot.lives = 4;
    const camp = newCampaign();
    for (const m of ['ams', 'm1', 'm2', 'm3', 'm4', 'm5']) camp.goldenRecords[0].add(m);
    const a = finalTallyLines(slot, camp);
    expect(a.lines.map((l) => l.points)).toEqual([150000, 100000, 500000, null]);
    expect(a.total).toBe(750000);
    // All 6 campaign missions count, Amsterdam (mission 1) included.
    camp.goldenRecords[0].delete('ams');
    expect(finalTallyLines(slot, camp).lines[1].points).toBeNull();
    camp.goldenRecords[0].add('ams');
    slot.continues = 2;
    camp.goldenRecords[0].delete('m3');
    const b = finalTallyLines(slot, camp);
    expect(b.total).toBe(150000);
    expect(b.lines[3].note).toBe('2');
  });
});

describe('flow texts (GDD §13.3, §2.6, §13.12)', () => {
  it('HOW TO PLAY has the 10 lines with the diagonal aim and the Swan glide', () => {
    expect(HOW_TO_PLAY.length).toBe(10);
    expect(HOW_TO_PLAY).toContainEqual(['UP + LEFT / RIGHT', 'AIM DIAGONALLY']);
    expect(HOW_TO_PLAY).toContainEqual(['HOLD JUMP', 'GLIDE (SWAN)']);
  });

  it('the ending captions and credits are the GDD lines, and the credits roll fits the view', () => {
    expect(ENDING_CAPTIONS).toEqual([
      'THE ANTHEM WAS NEVER BROADCAST.',
      'THE CRITICS WERE RELEASED, AND WROTE VERY KIND REVIEWS.',
      'GRAND MARSHAL FANFARONI NOW PLAYS THE TRIANGLE.',
      'HE IS STILL NOT VERY GOOD.',
      'TASK FORCE CYGNET RETURNED TO THE NEST.',
      'THE END ... OF THE NOISE.',
    ]);
    expect(CREDITS.length).toBe(23);
    expect(CREDITS[0].text).toBe('METAL SWAN 3');
    expect(CREDITS[CREDITS.length - 1].text).toBe('THE END ... OF THE NOISE.');
    const roll = creditsRoll();
    for (const l of roll.lines) expect(wrapPx(l.text, l.font, 360)).toEqual([l.text]);
    for (const c of ENDING_CAPTIONS) expect(wrapPx(c, 'big', 360).length).toBeLessThanOrEqual(2);
  });
  it('a player who joins mid-game gets a free Cygnet, never the other player\'s', () => {
    expect(joinCharacter('grace')).toBe('mittens');
    expect(joinCharacter('mittens')).toBe('grace');
    expect(joinCharacter('')).toBe('grace');
  });
});
