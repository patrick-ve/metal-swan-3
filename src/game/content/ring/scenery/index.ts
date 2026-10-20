/**
 * Content area `ring/scenery` (docs/design/ring.md §2, §4, §11; docs/api/ring.md "Scenery").
 * Owner: the SCENERY builder. The scenery table the ring's view (src/game/ring/view.ts) draws
 * from: the look of every skyline district of the plan (GEN's chunk `district`), overrides by
 * set-piece `part`, the set pieces of the ten landmarks with their layer and place, the covered
 * stretch at Bos en Lommer, the off-ramp, the bridge name plates, the median lamp posts, the
 * oncoming cars and the tunnel portals. No entity ids (scenery is drawn by view.ts and light.ts).
 */
import { defineRingScenery, type RingPieceDef } from '../../../ring/view';
import { ONCOMING_IDS } from './pieces';
import './art';

/** A city-layer building: anchored at its foot on the skyline base (y 97). */
const city = (id: string, of: RingPieceDef['of'], at: number, extra: Partial<RingPieceDef> = {}): RingPieceDef => ({ id, layer: 'city', of, at, y: 97, ...extra });

defineRingScenery({
  districts: {
    oost: { far: 'city', city: 'flats', verge: 'trees', farroad: 'road' },
    amstel: { far: 'city', city: 'flats', verge: 'trees', farroad: 'road' },
    zuid: { far: 'towers', city: 'flats', verge: 'plain', farroad: 'rail' },
    zuidas: { far: 'towers', city: 'zuidas', verge: 'plain', farroad: 'rail' },
    lake: { far: 'woods', city: 'lake', verge: 'reeds', farroad: 'road' },
    west: { far: 'city', city: 'slabs', verge: 'screens', farroad: 'road' },
    port: { far: 'port', city: 'port', verge: 'fence', farroad: 'road' },
    tunnel: { far: 'port', city: 'port', verge: 'fence', farroad: 'road' },
    noord: { far: 'polder', city: 'polder', verge: 'screens', farroad: 'road' },
    coenplein: { far: 'port', city: 'port', verge: 'trees', farroad: 'road' },
    zeeburg: { far: 'water', city: 'water', verge: 'plain', farroad: 'road' },
  },
  parts: {
    rozenoordbrug: { city: 'river' },
    schinkelbrug: { city: 'lake' },
    kanaal: { city: 'river' },
    zeeburgerbrug: { city: 'water' },
    ijburg: { city: 'water' },
    zuidas: { city: 'zuidas' },
    'noise-screens': { verge: 'screens' },
  },
  landmarks: {
    oost: {
      look: { far: 'city', city: 'flats', verge: 'trees', farroad: 'road' },
      pieces: [city('decor/ring/oost/rembrandt-tower', 'landmark', 0.72), city('decor/ring/oost/amstel-station', 'stretch', 0.14)],
    },
    amstel: {
      look: { far: 'city', city: 'flats', verge: 'trees', farroad: 'road' },
      pieces: [
        { id: 'decor/ring/amstel/flyover', layer: 'verge', of: 'part:interchange', at: 0.5, y: 100 },
        { id: 'decor/ring/amstel/barge', layer: 'city', of: 'part:rozenoordbrug', at: 0.55, y: 83 },
      ],
    },
    zuid: {
      look: { far: 'towers', city: 'flats', verge: 'plain', farroad: 'rail' },
      pieces: [
        city('decor/ring/zuid/rai-hall', 'part:rai', 0.5),
        city('decor/ring/zuid/tower-a', 'part:zuidas', 0.15),
        city('decor/ring/zuid/tower-b', 'part:zuidas', 0.5),
        city('decor/ring/zuid/tower-c', 'part:zuidas', 0.85),
        city('decor/ring/zuid/tower-a', 'stretch', 0.55),
        city('decor/ring/zuid/tower-c', 'stretch', 0.75),
        { id: 'decor/ring/zuid/train', layer: 'farroad', of: 'stretch', at: 0.2, y: 101, vx: -2.6 },
        { id: 'decor/ring/zuid/train', layer: 'farroad', of: 'stretch', at: 0.62, y: 101, vx: 2.2, flipX: true },
      ],
    },
    'nieuwe-meer': {
      look: { far: 'woods', city: 'lake', verge: 'reeds', farroad: 'road' },
      pieces: [
        { id: 'decor/ring/nieuwe-meer/schinkelbrug', layer: 'verge', of: 'part:schinkelbrug', at: 0.5, y: 100 },
        { id: 'decor/ring/nieuwe-meer/flyover', layer: 'verge', of: 'part:interchange', at: 0.5, y: 100 },
        { id: 'decor/ring/nieuwe-meer/sailboat', layer: 'city', of: 'stretch', at: 0.12, y: 83, frame: 0 },
        { id: 'decor/ring/nieuwe-meer/sailboat', layer: 'city', of: 'stretch', at: 0.4, y: 83, frame: 1 },
        { id: 'decor/ring/nieuwe-meer/sailboat', layer: 'city', of: 'stretch', at: 0.7, y: 83, frame: 2 },
      ],
    },
    west: {
      look: { far: 'city', city: 'slabs', verge: 'screens', farroad: 'road' },
      features: [{ kind: 'covered', of: 'stretch', at: 0.48, len: 224, name: 'BOS EN LOMMER' }],
      pieces: [city('decor/ring/west/office', 'stretch', 0.8), city('decor/ring/west/sloterdijk', 'stretch', 0.88), city('decor/ring/west/office', 'stretch', 0.93)],
    },
    westpoort: {
      look: { far: 'port', city: 'port', verge: 'fence', farroad: 'road' },
      pieces: [
        city('decor/ring/westpoort/crane', 'landmark', 0.2),
        city('decor/ring/westpoort/crane', 'landmark', 0.7),
        city('decor/ring/westpoort/turbine', 'stretch', 0.55, { tpf: 10 }),
      ],
    },
    coentunnel: {
      look: { far: 'port', city: 'port', verge: 'fence', farroad: 'road' },
      tunnelName: 'COENTUNNEL',
      pieces: [{ id: 'decor/ring/coentunnel/flyover', layer: 'verge', of: 'part:coenplein', at: 0.5, y: 100 }],
    },
    noord: {
      look: { far: 'polder', city: 'polder', verge: 'screens', farroad: 'road' },
      pieces: [
        { id: 'decor/ring/noord/turbine', layer: 'city', of: 'stretch', at: 0.15, y: 86, tpf: 10 },
        { id: 'decor/ring/noord/windmill', layer: 'city', of: 'stretch', at: 0.32, y: 86, tpf: 14 },
        { id: 'decor/ring/noord/turbine', layer: 'city', of: 'stretch', at: 0.5, y: 86, tpf: 11, frame: 2 },
        { id: 'decor/ring/noord/turbine', layer: 'city', of: 'stretch', at: 0.78, y: 86, tpf: 9, frame: 1 },
      ],
    },
    zeeburg: {
      look: { far: 'water', city: 'water', verge: 'plain', farroad: 'road' },
      tunnelName: 'ZEEBURGERTUNNEL',
      pieces: [{ id: 'decor/ring/zeeburg/ijburg', layer: 'city', of: 'part:ijburg', at: 0.5, y: 87 }],
    },
    exit: {
      look: { far: 'city', city: 'flats', verge: 'trees', farroad: 'road' },
      features: [{ kind: 'exit', of: 'part:offramp', at: 0, len: -1 }],
      pieces: [{ id: 'decor/ring/exit/exit-sign', layer: 'verge', of: 'part:offramp', at: 0, dx: -240, y: 100 }],
    },
  },
  bridgeNames: { rozenoordbrug: 'ROZENOORDBRUG', schinkelbrug: 'SCHINKELBRUG', kanaal: 'NOORDHOLLANDSCH KANAAL', zeeburgerbrug: 'ZEEBURGERBRUG' },
  lamp: { id: 'decor/ring/road/lamp', every: 192, y: 104 },
  oncoming: ONCOMING_IDS,
  portals: { coentunnel: 'decor/ring/coentunnel/portal', zeeburg: 'decor/ring/zeeburg/portal' },
  overbuild: 'decor/ring/west/overbuild',
});
