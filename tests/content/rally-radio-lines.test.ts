/**
 * Rally wave C (PREP): FILE FM's lines table (content/rally/radio/lines.ts), the songs and jingles
 * (placeholder synth songs in content/music/rally.ts), the sample group 'mission:rally' (engine, audio
 * tool, content/samples/rally.ts) and its load / release in the scenes (docs/api/rally.md "C. Wave C
 * contracts").
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getSong, hasSong, songError } from '../../src/engine/music';
import { getSampleGroup, SAMPLE_GROUPS, voiceKey, type SampleGroup } from '../../src/engine/samples';
import '../../src/game/content/music/index';
import { RALLY_PLACEHOLDER_SONGS } from '../../src/game/content/music/rally';
import {
  DJ_SPEAKER,
  LEADER_CARS,
  RADIO_CATEGORIES,
  RADIO_GROUP,
  RADIO_JINGLES,
  RADIO_LINES,
  RADIO_ONCE,
  RADIO_SONGS,
  RALLY_ANNOUNCE,
  RALLY_CARD_LINES,
  lapSong,
  leaderLine,
  radioKey,
  radioLine,
  radioLines,
  tickerText,
  type RadioCategory,
} from '../../src/game/content/rally/radio/lines';
import { TEAMS } from '../../src/game/content/rally/teams/index';
import '../../src/game/content/samples/index';
import { RALLY_SAMPLE_GROUP, rallySampleGroup, STREAM_MIN_SECONDS } from '../../src/game/content/samples/rally';
import { MISSION_CARDS } from '../../src/game/content/ui/cards';
import { ESTATE_GREEN, ESTATE_WHITE } from '../../src/game/rally/runner';
import { GROUP_DIRS, LAZY_GROUPS } from '../../tools/audio/lib';

const SRC = new URL('../../src/', import.meta.url).pathname;

/** The lead's table of wave C (category → texts), verbatim. */
const TABLE: Readonly<Record<RadioCategory, readonly string[]>> = {
  station: ['FILE FM. Wij staan er altijd!', 'Je luistert naar FILE FM, met Freek Flits!', 'FILE FM. De zender die nooit doorrijdt.'],
  intro: [
    'Goedemiddag Amsterdam! Vandaag op de A10: de Ringrally!',
    "Acht auto's, drie rondjes, en één parkeervergunning binnen de ring!",
    'De wachtlijst is twaalf jaar. Of je wint vandaag.',
  ],
  start: ['Drie... twee... één... GAAN!'],
  lap: ['Ronde twee! De zon zakt boven de Ring.', 'Laatste ronde! En het is spits, mensen!', 'Nog één rondje voor die vergunning!'],
  time: ['Het is kwart over vier. Droog, en de zon staat laag.', 'Vijf uur. Lichten aan, mensen!', 'Kwart voor zes, en het is al donker op de Ring.'],
  flash: ['Flits! Dat wordt een envelop op de mat.', 'Weer een flitser. De schatkist bedankt u!', 'Voet van het gas bij de flitspaal, mensen!'],
  zone: ['Trajectcontrole op Ring West. Gemiddeld te hard is ook te hard!'],
  redx: ['Onder het rode kruis door? Dat kost je!', 'Rood kruis is rood kruis!'],
  roadworks: ['Werk in uitvoering op de Ring. Ritsen, mensen, ritsen!', 'Rijstroken dicht. Geduld open!'],
  spitsstrook: ['De spitsstrook is open! Pak die extra baan!'],
  jam: ['File op de Ring. Wat een verrassing!', 'Het staat vast. Gelukkig heb je de radio.'],
  police: ['De politie is op de Ring. Gedraag je!', 'Blauwe lampen in de spiegel? Die zijn voor jou!'],
  pulledOver: ['Daar wordt er eentje aan de kant gezet!', 'Rijbewijs en kentekenbewijs, alstublieft!'],
  released: ['En hij mag weer verder. Met een boete, natuurlijk.'],
  tunnel: ['De Coentunnel in. Even geen ontva...', 'Zeeburgertunnel! Ksst... even geen bereik...'],
  leader: [
    'De lijkwagen gaat aan kop! Die heeft haast.',
    'Huisje op Wielen voorop! Dat had niemand verwacht.',
    'De Frietbak aan kop! Met mayo!',
    'Vrijgezellen voorop! Feest op de Ring!',
    'De IJscoman rijdt voorop! Wie wil er een ijsje?',
    'Achteruit aan kop... en hij rijdt nog vooruit ook!',
    'Oma Truus aan kop! Niemand houdt Oma Truus tegen!',
    'De Rozzers nemen de leiding!',
    'Major Cocktails pakt de kop!',
  ],
  finish: ['Finish! Wat een race op de Ring!', 'We hebben een winnaar! Die vergunning is binnen!', 'Geen vergunning vandaag. Terug op de wachtlijst!'],
  filler: [
    'Dit was het verkeer. Het staat overal stil. Behalve hier!',
    'Muziek! Want stilstaan doe je maar in de file.',
    'Een parkeervergunning binnen de ring. Wie droomt daar niet van?',
  ],
};

describe('FILE FM: the lines table', () => {
  it('holds the lead table verbatim, per category and in order', () => {
    for (const [cat, texts] of Object.entries(TABLE)) expect(radioLines(cat as RadioCategory).map((l) => l.text), cat).toEqual(texts);
    expect(RADIO_LINES.length).toBe(Object.values(TABLE).reduce((n, t) => n + t.length, 0));
    expect(RADIO_LINES.length).toBe(46);
  });

  it('every line has a unique id, a unique voice key, the DJ, a priority and a cooldown', () => {
    expect(new Set(RADIO_LINES.map((l) => l.id)).size).toBe(RADIO_LINES.length);
    const keys = RADIO_LINES.map(radioKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const l of RADIO_LINES) {
      expect(radioKey(l), l.id).toBe(voiceKey(l.text));
      expect(radioKey(l).length, l.id).toBeGreaterThan(5);
      expect(l.speaker, l.id).toBe(DJ_SPEAKER);
      expect(l.priority, l.id).toBeGreaterThanOrEqual(0);
      expect(l.priority, l.id).toBeLessThanOrEqual(10);
      expect(l.cooldown === RADIO_ONCE || l.cooldown > 0, l.id).toBe(true);
      expect(l.on.length, l.id).toBeGreaterThan(0);
      expect(radioLine(l.id)).toBe(l);
      const c = RADIO_CATEGORIES[l.category];
      expect(c.maxWait, l.category).toBeGreaterThan(0);
      expect(c.gap, l.category).toBeGreaterThanOrEqual(0);
    }
  });

  it('the selectors: laps 2 and 3, the three clock times, the tunnels, the finish results', () => {
    expect(radioLines('lap').map((l) => l.lap)).toEqual([2, 3, 3]);
    expect(radioLines('time').map((l) => l.clock)).toEqual([975, 1020, 1065]);
    expect(radioLines('tunnel').map((l) => l.tunnel)).toEqual(['COENTUNNEL', 'ZEEBURGERTUNNEL']);
    expect(radioLines('finish').map((l) => l.result)).toEqual(['any', 'win', 'lose']);
    // The track table names the two tunnels the same way (the event's `name`).
    const table = readFileSync(`${SRC}game/content/rally/track/table.ts`, 'utf8');
    for (const t of ['COENTUNNEL', 'ZEEBURGERTUNNEL']) expect(table).toContain(`name: '${t}'`);
  });

  it('one leader line per car: the estates by livery, every rally team by its spec `dj` id', () => {
    const cars = [...TEAMS.map((t) => t.spec.id), ESTATE_WHITE.id, ESTATE_GREEN.id];
    expect([...LEADER_CARS].sort()).toEqual([...cars].sort());
    for (const t of TEAMS) expect(leaderLine(t.spec.id)?.id, t.spec.id).toBe(t.spec.dj);
    expect(leaderLine('white')?.text).toBe('De Rozzers nemen de leiding!');
    expect(leaderLine('green')?.text).toBe('Major Cocktails pakt de kop!');
  });

  it('the ticker folds the accents the small font lacks; the text stays exact', () => {
    expect(tickerText('Drie... twee... één... GAAN!')).toBe('Drie... twee... een... GAAN!');
    expect(tickerText('Rood kruis is rood kruis!')).toBe('Rood kruis is rood kruis!');
    for (const l of RADIO_LINES) expect(/[^\x20-\x7e]/.test(tickerText(l.text)), l.id).toBe(false);
  });

  it("Gusto's card lines are the rally card's briefing; the announcer line is the MISSION 2 one", () => {
    const card = MISSION_CARDS.find((c) => c.id === 'rally');
    expect(card?.briefing).toEqual(RALLY_CARD_LINES);
    expect(RALLY_ANNOUNCE).toBe('MISSION TWO. VOL GAS!');
  });
});

describe('FILE FM: songs and jingles', () => {
  it('three lap songs and three jingles, every id a registered, parseable song', () => {
    expect(RADIO_SONGS.map((s) => [s.id, s.title, s.lap, s.bpm])).toEqual([
      ['rally-lap1', 'RONDJE RING', 1, 140],
      ['rally-lap2', 'ZON OP DE ZUIDAS', 2, 138],
      ['rally-lap3', 'NACHTSPITS', 3, 128],
    ]);
    expect(RADIO_JINGLES.map((j) => j.id)).toEqual(['rally-jingle-1', 'rally-jingle-2', 'rally-jingle-3']);
    for (const id of [...RADIO_SONGS, ...RADIO_JINGLES].map((x) => x.id)) {
      expect(hasSong(id), id).toBe(true);
      expect(songError(id), id).toBeNull();
      expect(getSong(id), id).not.toBeNull();
      expect(RALLY_PLACEHOLDER_SONGS[id], id).toBeDefined();
    }
    // The songs loop, the jingles play once.
    for (const s of RADIO_SONGS) expect(getSong(s.id)?.loopRow, s.id).toBe(0);
    for (const j of RADIO_JINGLES) expect(getSong(j.id)?.loopRow, j.id).toBeNull();
    expect(lapSong(1).id).toBe('rally-lap1');
    expect(lapSong(3).id).toBe('rally-lap3');
    expect(lapSong(9).id).toBe('rally-lap3');
    expect(lapSong(0).id).toBe('rally-lap1');
  });
});

describe("the sample group 'mission:rally'", () => {
  it('is a group of the engine and of the audio tool (public/audio/rally, lazy)', () => {
    expect(RADIO_GROUP).toBe(RALLY_SAMPLE_GROUP);
    expect(SAMPLE_GROUPS as readonly string[]).toContain(RALLY_SAMPLE_GROUP);
    expect(GROUP_DIRS[RALLY_SAMPLE_GROUP]).toBe('rally');
    expect(LAZY_GROUPS.has(RALLY_SAMPLE_GROUP)).toBe(true);
    expect(new Set(Object.values(GROUP_DIRS)).size).toBe(SAMPLE_GROUPS.length);
  });

  it('streams the long songs and decodes the jingles and the lines', () => {
    expect(rallySampleGroup({})).toBeNull();
    const song = { file: 'rally/music/rally-lap1-1.mp3', loopStart: 2.1, loopEnd: 150, duration: 151 };
    const jingle = { file: 'rally/music/rally-jingle-1-1.mp3', loopStart: null, duration: 4.2 };
    const voice = { files: ['rally/voice/x-1.mp3'], duration: 2 };
    const manifest: Record<string, SampleGroup> = { [RALLY_SAMPLE_GROUP]: { music: { 'rally-lap1': song, 'rally-jingle-1': jingle }, voice: { x: voice } } };
    const g = rallySampleGroup(manifest);
    expect(g?.music?.['rally-lap1']).toEqual({ ...song, stream: true });
    expect(g?.music?.['rally-jingle-1']).toBe(jingle);
    expect(g?.voice?.x).toBe(voice);
    expect(song.duration).toBeGreaterThanOrEqual(STREAM_MIN_SECONDS);
    // The manifest's own object is untouched.
    expect('stream' in song).toBe(false);
  });

  it('is registered with the streamed songs when the manifest has it', () => {
    const g = getSampleGroup(RALLY_SAMPLE_GROUP);
    if (!g) return; // nothing shipped yet: the synth plays everything
    for (const [id, s] of Object.entries(g.music ?? {})) expect(s.stream === true, id).toBe(s.duration >= STREAM_MIN_SECONDS);
  });

  it("the card's preload and RallyScene load it, the race's end releases it", () => {
    const route = readFileSync(`${SRC}game/scenes/rally-route.ts`, 'utf8');
    const preload = route.slice(route.indexOf('export function preloadRally'));
    expect(preload.slice(0, preload.indexOf('\n}'))).toContain('loadSamples?.(RALLY_SAMPLE_GROUP)');
    const scene = readFileSync(`${SRC}game/scenes/rally.ts`, 'utf8');
    const enter = scene.slice(scene.indexOf('  enter(): void {'));
    expect(enter.slice(0, enter.indexOf('\n  }\n'))).toContain('loadSamples?.(RALLY_SAMPLE_GROUP)');
    const exit = scene.slice(scene.indexOf('  exit(): void {'));
    expect(exit.slice(0, exit.indexOf('\n  }\n'))).toContain('releaseSamples?.(RALLY_SAMPLE_GROUP)');
    // Fixer (wave C review): with no WebGL2 the card does not load it, and the no-GL card releases it.
    expect(preload.slice(0, preload.indexOf('\n}'))).toContain('if (rallyGl(app).ok) void app.audio.loadSamples?.(RALLY_SAMPLE_GROUP)');
    const glitch = readFileSync(`${SRC}game/scenes/rally-glitch.ts`, 'utf8');
    const noGl = glitch.slice(glitch.indexOf('export class RallyNoGlScene'));
    const noGlEnter = noGl.slice(noGl.indexOf('  enter(): void {'));
    expect(noGlEnter.slice(0, noGlEnter.indexOf('\n  }\n'))).toContain('releaseSamples?.(RALLY_SAMPLE_GROUP)');
  });
});
