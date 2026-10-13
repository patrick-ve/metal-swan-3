/**
 * Mission m4 — OPENING NIGHT (GDD §11.4). Route: `a` Avenue of Statues (mini-boss THE BIG HEAD)
 * → `b` Bandwagon Boulevard (the Bandwagon section) → SUBWAY ↓ `c1` The Underground or
 * ROOFTOPS ↑ `c2` Billboard Rooftops → `d` The Opera House (boss THE GRAND GRAND).
 * Registers at import time.
 */
import type { MissionDef } from '../../../mission/index';
import { defineMission } from '../../../registry';
import './art';
import './bg';
import './entities';
import { sectionA } from './section-a';
import { sectionB } from './section-b';
import { sectionC1 } from './section-c1';
import { sectionC2 } from './section-c2';
import { sectionD } from './section-d';

export const M4: MissionDef = {
  id: 'm4',
  name: 'OPENING NIGHT',
  subtitle: 'MISSION 5',
  music: 'm4',
  bossMusic: 'boss',
  start: 'a',
  bossSection: 'd',
  next: 'm5',
  startBanner: { text: 'MISSION 5', sub: 'START!' },
  announce: 'MISSION FIVE. BREAK A LEG, CYGNETS!',
  sections: { a: sectionA, b: sectionB, c1: sectionC1, c2: sectionC2, d: sectionD },
  // GDD §11.4: 10 per route (a 3, b 2, c1 / c2 2, d 3 incl. the composer).
  hostages: { a: 3, b: 2, c1: 2, c2: 2, d: 3 },
};

defineMission(M4);
