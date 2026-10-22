/**
 * Revision R, wave B (PREP): the contracts of the blockade (docs/api/ring.md "R.B Wave B contracts").
 * The ids and the hooks exist; the Dutch lines fit a bubble and keep wave A's texts; the sound group
 * 'mission:ring' is wired (SAMPLE_GROUPS, the audio tool, the merged group); `rf-b` plays with the
 * stubs (or the real kinds) to the one tally in 1P and 2P: the police carry a beaten `ketting` off,
 * others run off, the boat calls a wave, is beaten, the leader is carried off; `&boss=1` starts at the
 * boat; the hero opt-ins are status effects (off unless a ring entity adds them).
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import { SAMPLE_GROUPS, voiceKey, type SampleGroup } from '../../src/engine/samples';
import { BUBBLE_LINE_CHARS, wrapText } from '../../src/game/context';
import { loadContent } from '../../src/game/content/index';
import {
  ACTIVIST,
  ACTIVIST_HOOKS,
  ACTIVIST_KINDS,
  ACTIVIST_OUT_EVENT,
  HERO_STATUS,
  POLICE,
  glueHero,
  pushHero,
  stunHero,
  type ActivistOutEvent,
} from '../../src/game/content/ring/activists/index';
import { BOAT_EVENT, BOAT_ID, BOAT_LEADER, BOAT_NAME, BOAT_PART, BOAT_SUBTITLE, type BoatEvent } from '../../src/game/content/ring/boot/index';
import {
  ACTIVIST_LINES,
  BANNERS,
  CONTINUE_SIGN,
  LEIDER_LINES,
  RF_B_ARENA_L,
  RING_FOOT,
  SPANDOEK,
  WAVE_A_LINES,
  ringVoicedLines,
  sectionRfB,
} from '../../src/game/content/ring/foot/index';
import { ringSampleGroup } from '../../src/game/content/samples/ring';
import { CAB_LINES } from '../../src/game/content/ring/zwaan/cab';
import { VEE_LINES } from '../../src/game/content/ring/zwaan/vee';
import { isPlayer } from '../../src/game/player/player';
import { hasEntity, getEntityMeta } from '../../src/game/registry';
import { createHeadlessRing, type HeadlessRing } from '../../src/sim/headless-ring';
import { GROUP_DIRS, LAZY_GROUPS } from '../../tools/audio/lib';

await loadContent();

describe('wave B contracts: ids, hooks, lines', () => {
  it('registers the activists, the police, the boat and the leader; the hooks are set', () => {
    for (const k of ACTIVIST_KINDS) {
      expect(hasEntity(ACTIVIST[k]), k).toBe(true);
      expect(getEntityMeta(ACTIVIST[k])?.category).toBe('enemy');
    }
    expect(getEntityMeta(POLICE)?.category).toBe('npc');
    expect(getEntityMeta(BOAT_ID)?.category).toBe('boss');
    expect(getEntityMeta(BOAT_LEADER)?.category).toBe('npc');
    expect(ACTIVIST_HOOKS.impl).not.toBeNull();
    expect(BOAT_NAME).toBe('DE LAATSTE DRUPPEL');
    expect(BOAT_SUBTITLE).toBe('MINI-BOSS');
    expect(Object.values(BOAT_PART)).toEqual(['speaker-l', 'speaker-r', 'hull']);
    expect(SPANDOEK.title).toBe('EXHAUSTING REBELLION');
  });

  it('every bubble fits 24 characters × 2 lines; wave A texts stay as in the train', () => {
    const bubbles = [...Object.values(ACTIVIST_LINES), ...Object.values(LEIDER_LINES), ...ringVoicedLines().map((l) => l.text), CONTINUE_SIGN];
    for (const t of bubbles) {
      const wrapped = wrapText(t, BUBBLE_LINE_CHARS);
      expect(wrapped.length, t).toBeLessThanOrEqual(2);
      for (const line of wrapped) expect(line.length, t).toBeLessThanOrEqual(BUBBLE_LINE_CHARS);
    }
    for (const b of BANNERS) expect(b.length).toBeLessThanOrEqual(24);
    expect(WAVE_A_LINES.cab).toEqual({ ...CAB_LINES });
    expect(WAVE_A_LINES.boer.lob).toEqual([...VEE_LINES.lob]);
    expect(WAVE_A_LINES.boer.dazed).toBe(VEE_LINES.dazed);
    // One take per text: no two voiced lines share a voice key.
    const keys = ringVoicedLines().map((l) => voiceKey(l.text));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("the sound group 'mission:ring'", () => {
  it('is a known group of the engine and the audio tool (lazy, public/audio/ring/), the foot def uses it', () => {
    expect(SAMPLE_GROUPS as readonly string[]).toContain('mission:ring');
    expect(GROUP_DIRS['mission:ring']).toBe('ring');
    expect(LAZY_GROUPS.has('mission:ring')).toBe(true);
    expect(RING_FOOT.audioGroup).toBe('mission:ring');
  });

  it('merges the ams sfx and voices (not its songs) with the ring takes; the ring wins on a shared id', () => {
    const a = { files: ['ams/sfx/a-1.mp3'] };
    const shared = { files: ['ams/sfx/s-1.mp3'] };
    const ringShared = { files: ['ring/sfx/s-1.mp3'] };
    const v = { files: ['ring/voice/los-1.mp3'], duration: 0.5 };
    const manifest: Record<string, SampleGroup> = {
      'mission:ams': { sfx: { a, s: shared }, music: { ams: { file: 'x.mp3', loopStart: 0, duration: 1 } }, voice: {} },
      'mission:ring': { sfx: { s: ringShared }, voice: { los: v }, music: { 'ring-boot': { file: 'ring/music/b.mp3', loopStart: 0, duration: 9 } } },
    };
    const g = ringSampleGroup(manifest)!;
    expect(g.sfx?.a).toBe(a);
    expect(g.sfx?.s).toBe(ringShared);
    expect(g.voice?.los).toBe(v);
    expect(Object.keys(g.music ?? {})).toEqual(['ring-boot']);
    expect(ringSampleGroup({})).toBeNull();
    expect(ringSampleGroup({ 'mission:ams': { sfx: { a } } })?.music).toBeUndefined();
  });
});

/** Run rf-b (god, the bots) to the tally, collecting the blockade's events. */
async function runRfB(players: 1 | 2, boss = false): Promise<{ h: HeadlessRing; ticks: number; outs: ActivistOutEvent[]; boat: BoatEvent[]; startX: number }> {
  const h = await createHeadlessRing({ seed: 1, god: true, bot: true, section: 'rf-b', boss, players, loadContent: false } as never);
  const outs: ActivistOutEvent[] = [];
  const boat: BoatEvent[] = [];
  let wired = false;
  let startX = -1;
  let t = 0;
  for (; t < 12_000 && !h.complete; t++) {
    h.step(1);
    const w = h.world;
    if (w && !wired && h.footRunner) {
      wired = true;
      w.events.on(ACTIVIST_OUT_EVENT, (e) => outs.push(e));
      w.events.on(BOAT_EVENT, (e) => boat.push(e));
      const p = w.byTag('player').find((e: Entity) => isPlayer(e));
      if (p) startX = p.x;
    }
  }
  return { h, ticks: t, outs, boat, startX };
}

describe('rf-b plays to the one tally (god, the bots)', () => {
  it('1P: the police carry a ketting off, others run off, the boat calls a wave, is beaten, the leader is carried off', async () => {
    const r = await runRfB(1);
    expect(r.h.complete).toBe(true);
    expect(r.h.footRunner?.section?.id).toBe(sectionRfB.id);
    expect(r.outs.some((e) => e.kind === 'ketting' && e.how === 'carried')).toBe(true);
    expect(r.outs.some((e) => e.how === 'runoff')).toBe(true);
    expect(r.outs.some((e) => e.kind === 'leider' && e.how === 'carried')).toBe(true);
    const whats = r.boat.map((e) => e.what);
    expect(whats).toContain('wave');
    expect(whats).toContain('beaten');
    expect(whats[whats.length - 1]).toBe('end');
    expect(r.h.report().foot?.bossDefeated).toBe(true);
  }, 60_000);

  it('2P completes too', async () => {
    const r = await runRfB(2);
    expect(r.h.complete).toBe(true);
  }, 60_000);

  it('&boss=1 starts at the boat', async () => {
    const r = await runRfB(1, true);
    expect(r.startX).toBeGreaterThanOrEqual(RF_B_ARENA_L);
    expect(r.h.complete).toBe(true);
    expect(r.boat.map((e) => e.what)).toContain('end');
  }, 60_000);
});

describe('the hero opt-ins (status effects; off unless a ring entity adds them)', () => {
  it('glue, stun and push add their statuses to a hero', async () => {
    const h = await createHeadlessRing({ seed: 1, god: true, bot: false, section: 'rf-b', players: 1, loadContent: false } as never);
    h.step(2);
    const p = h.world!.byTag('player').find((e: Entity) => isPlayer(e));
    expect(p && isPlayer(p)).toBe(true);
    if (!p || !isPlayer(p)) return;
    expect(p.status.has(HERO_STATUS.glue)).toBe(false);
    glueHero(p);
    expect(p.status.has(HERO_STATUS.glue)).toBe(true);
    stunHero(p);
    expect(p.status.has(HERO_STATUS.stun)).toBe(true);
    pushHero(p, -1);
    expect(p.status.has(HERO_STATUS.push)).toBe(true);
    expect(p.vx).toBeLessThan(0);
  });
});
