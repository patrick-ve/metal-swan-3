/**
 * Mission m2 — DUNE BUGLE (GDD §11.2). Route: `a` Rattlebone Flats → `b` Rocky Road (the SUNDAE
 * DRIVER section, mini-boss THE GOLDEN GOOSE) → CANYON ↓ `c1` Canyon Floor or MESA ↑ `c2` Mesa
 * Top → `d` The Drum Quarry (boss THE BA-DUM BEHEMOTH). Registers at import time.
 */
import type { MissionDef } from '../../../mission/index';
import { defineMission } from '../../../registry';
import './art';
import './bg';
import { sectionA } from './section-a';
import { sectionB } from './section-b';
import { sectionC1 } from './section-c1';
import { sectionC2 } from './section-c2';
import { sectionD } from './section-d';

export const M2: MissionDef = {
  id: 'm2',
  name: 'DUNE BUGLE',
  subtitle: 'MISSION 3',
  music: 'm2',
  bossMusic: 'boss',
  start: 'a',
  bossSection: 'd',
  startBanner: { text: 'MISSION 3', sub: 'START!' },
  announce: 'MISSION THREE. STAY HYDRATED, CYGNETS!',
  sections: { a: sectionA, b: sectionB, c1: sectionC1, c2: sectionC2, d: sectionD },
  // GDD §11.2: 8 per route (a 3 incl. Mrs. Dollop, b 1, c1 / c2 2, d 2 incl. the composer).
  hostages: { a: 3, b: 1, c1: 2, c2: 2, d: 2 },
};

defineMission(M2);
