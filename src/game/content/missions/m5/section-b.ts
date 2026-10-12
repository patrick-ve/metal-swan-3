/**
 * m5-b — The Pipe Works (GDD §11.5): 384×1800, scroll down, checkpoints y 700, 1400. Inside the
 * Grand Organ: the players climb out of the landing hatch and drop down a shaft of metal ledges
 * between two pipe walls (even ledges left, odd ledges right — drop-through is the main move),
 * past two breathing bellows platforms, two air-jet columns, a cracked organ panel hiding the
 * composer and the golden record, and a last fight on the bottom floor that opens the brass door
 * to the console room (`c`).
 */
import type { ScriptGen } from '../../../../engine/script';
import { terrain, type DecorDef, type SectionContext, type SectionDef } from '../../../mission/index';
import { BG_PIPE_WORKS } from './backgrounds';
import type { ExitDoor } from './entities';
import { at, crate, hostage, stageY } from './helpers';

export const B_W = 384;
export const B_H = 1800;
/** The bottom floor. */
export const FLOOR_Y = 1784;
/** The hatch floor at the top (platform 144–240, y 72) and the player start on it. */
export const HATCH = { x: 144, y: 72, w: 96 } as const;
/** Ledge k (0…33): y = 120 + 48k; even k at x 24–240, odd k at x 144–360. */
export const LEDGES = 34;
export const ledgeY = (k: number): number => 120 + 48 * k;
export const ledgeX = (k: number): number => (k % 2 === 0 ? 24 : 144);
export const LEDGE_W = 216;
/** Ledges k = 10 and 17 are bellows platforms at x 160–224 instead. */
export const BELLOWS_K: readonly number[] = [10, 17];
export const BELLOWS_X = 192;
/** Air-jet columns (x0, top, bottom). */
export const JETS: readonly { x: number; top: number; bottom: number }[] = [
  { x: 40, top: 1000, bottom: 1300 },
  { x: 320, top: 1400, bottom: 1700 },
];
/** The cracked organ panel (secret, behind the actors) on the k = 15 ledge. */
export const PANEL = { x: 300, y: 840 } as const;
/** The exit door and its rect (GDD: 150–234, 1760–1784). */
export const DOOR_X = 192;
export const EXIT_RECT = { x: 150, y: 1760, w: 84, h: 24 } as const;

// ---------------------------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------------------------

const t = terrain(B_W, B_H);
t.solid(0, 0, 24, B_H, 'metal').solid(360, 0, 24, B_H, 'metal');
t.platform(HATCH.x, HATCH.y, HATCH.w);
for (let k = 0; k < LEDGES; k++) {
  if (BELLOWS_K.includes(k)) continue;
  t.platform(ledgeX(k), ledgeY(k), LEDGE_W);
}
t.ground().at(0, FLOOR_Y).flat(B_W);

const decor: DecorDef[] = [
  // The landing hatch in the ceiling with the two parked Trumpeters (GDD: they stay as decor).
  { sprite: 'decor/m5/hatch', x: 136, y: 0 },
  // Hull centre 13 px over the hatch floor (the drawn box ends 13 px under the anchor).
  { sprite: 'vehicle/trumpeter-mute/idle', frame: 1, x: 226, y: HATCH.y - 13 },
  { sprite: 'vehicle/trumpeter/idle', frame: 1, x: 166, y: HATCH.y - 13 },
];

// ---------------------------------------------------------------------------------------------
// Script pieces
// ---------------------------------------------------------------------------------------------

/** The fixed props: bellows, air jets, the cracked panel and the door. */
function props(ctx: SectionContext): ExitDoor | null {
  for (const k of BELLOWS_K) ctx.spawn('bellows-platform', BELLOWS_X, ledgeY(k));
  for (const j of JETS) ctx.spawn('air-jet', j.x + 12, j.bottom, { w: 24, h: j.bottom - j.top });
  stageY(ctx, PANEL.y - 48, () =>
    ctx.spawn('breakable-wall', PANEL.x, PANEL.y, {
      solid: false,
      look: 'panel',
      reveal: [
        { id: 'hostage', x: PANEL.x, y: PANEL.y, params: { kind: 'composer', bind: 'chair', drop: '1up' } },
        { id: 'pickup-gem', x: 330, y: PANEL.y, params: { kind: 'golden-record' } },
      ],
    }),
  );
  const door = ctx.spawn('m5-door', DOOR_X, FLOOR_Y);
  return (door as ExitDoor).open ? (door as ExitDoor) : null;
}

/** Wait until every member of `tag` is dead. */
function* waitDead(ctx: SectionContext, tag: string): ScriptGen {
  for (;;) {
    let alive = 0;
    for (const e of ctx.world.byTag(tag)) if (e.alive) alive++;
    if (alive === 0) return;
    yield 1;
  }
}

// ---------------------------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------------------------

export const sectionB: SectionDef = {
  id: 'b',
  name: 'The Pipe Works',
  width: B_W,
  height: B_H,
  scroll: 'down',
  background: BG_PIPE_WORKS,
  terrain: t.build(),
  terrainStyle: { ground: 'metal', edge: 'rust', platform: 'metal', solid: 'metal' },
  decor,
  playerStart: { x: 192, y: HATCH.y },
  checkpoints: [700, 1400],
  timeLimit: 60,
  music: 'm5-organ',
  exits: [{ id: 'door', rect: { ...EXIT_RECT }, to: 'c', disabled: true }],
  *script(ctx) {
    ctx.showGo('down');
    const door = props(ctx);

    // Start: two usher-bots on the first ledge.
    at(ctx, 'usher-bot', 60, ledgeY(0), { facing: 1 });
    at(ctx, 'usher-bot', 200, ledgeY(0), { facing: -1 });

    // Standing placements, staged as the view comes down to them.
    stageY(ctx, 216, () => {
      // @150: four bandbots march along the ledge at y 216 and drop to the lower ones.
      for (let i = 0; i < 4; i++) at(ctx, 'windup-bot', 60 + i * 22, ledgeY(2), { facing: 1 });
    });
    stageY(ctx, 316, () => {
      // @300: a metronome turret under the ledge at y 312; the crate below it.
      ctx.spawn('metronome-turret', 192, 316);
      crate(ctx, 200, ledgeY(5), 'M');
    });
    stageY(ctx, 504, () => {
      // @450: the anthem speaker (every 600 ticks) and four riflemen.
      ctx.spawn('anthem-speaker', 320, ledgeY(9), { interval: 600 });
      at(ctx, 'rifleman', 60, ledgeY(8), { facing: 1 });
      at(ctx, 'rifleman', 120, ledgeY(8), { facing: 1 });
      at(ctx, 'rifleman', 200, ledgeY(9), { facing: -1 });
      at(ctx, 'rifleman', 260, ledgeY(9), { facing: -1 });
    });
    stageY(ctx, 648, () => {
      // @600: the critic and four echo bats hanging under the ledges.
      hostage(ctx, 'critic', 'chair', 80, ledgeY(12), 'S');
      at(ctx, 'echo-bat', 300, ledgeY(11) + 6);
      at(ctx, 'echo-bat', 210, ledgeY(11) + 6);
      at(ctx, 'echo-bat', 110, ledgeY(12) + 6);
      at(ctx, 'echo-bat', 260, ledgeY(13) + 6);
    });
    stageY(ctx, 920, () => {
      // @850: the pipe battery on the right wall; a drummer and two riflemen on the bellows.
      ctx.spawn('pipe-battery', 344, 920);
      at(ctx, 'drummer', BELLOWS_X, ledgeY(17) - 24, { facing: -1 });
      at(ctx, 'rifleman', BELLOWS_X - 22, ledgeY(17) - 24, { facing: 1 });
      at(ctx, 'rifleman', BELLOWS_X + 22, ledgeY(17) - 24, { facing: -1 });
    });
    stageY(ctx, 1036, () => {
      // @1000: the roadie's cage hangs under the ledge at y 1032 and falls onto the one at y 1080.
      hostage(ctx, 'roadie', 'cage', 192, 1068, 'T', { ropeTop: 1036 });
    });
    stageY(ctx, 1176, () => {
      // @1150: two usher-bots and a bassoonist.
      at(ctx, 'usher-bot', 70, ledgeY(22), { facing: 1 });
      at(ctx, 'usher-bot', 190, ledgeY(22), { facing: -1 });
      at(ctx, 'bassoonist', 300, ledgeY(23), { facing: -1 });
    });
    stageY(ctx, 1320, () => {
      // @1300: the tea lady, a drum major and three riflemen.
      hostage(ctx, 'tea-lady', 'chair', 300, ledgeY(25), 'auto');
      at(ctx, 'baton-major', 120, ledgeY(26), { facing: 1 });
      at(ctx, 'rifleman', 60, ledgeY(26), { facing: 1 });
      at(ctx, 'rifleman', 220, ledgeY(27), { facing: -1 });
      at(ctx, 'rifleman', 320, ledgeY(27), { facing: -1 });
    });
    stageY(ctx, 1512, () => crate(ctx, 200, ledgeY(29), 'bombs'));

    // @1150: a sine formation of drones across the shaft.
    yield ctx.waitCameraY(1150);
    ctx.spawn('kazoo-drone', B_W - 30, ctx.camera.top + 70, { formation: 'sine', facing: -1 });

    // @1450: the last group on the bottom floor; WAIT dead; the door opens.
    yield ctx.waitCameraY(1450);
    const tag = 'm5b-last';
    at(ctx, 'oompah-trooper', 80, FLOOR_Y, { facing: 1 }, tag);
    at(ctx, 'oompah-trooper', 300, FLOOR_Y, { facing: -1 }, tag);
    at(ctx, 'cymbalist', 120, FLOOR_Y, { facing: 1 }, tag);
    at(ctx, 'cymbalist', 260, FLOOR_Y, { facing: -1 }, tag);
    yield 2;
    yield* waitDead(ctx, tag);
    door?.open();
    ctx.enableExit('door');
    ctx.callout('TO THE CONSOLE ↓', { ticks: 90 });
  },
};

/** Every id this section spawns. */
export const B_IDS: readonly string[] = [
  'bellows-platform', 'air-jet', 'breakable-wall', 'm5-door', 'usher-bot', 'windup-bot', 'metronome-turret', 'crate', 'anthem-speaker', 'rifleman',
  'hostage', 'echo-bat', 'pipe-battery', 'drummer', 'bassoonist', 'baton-major', 'kazoo-drone', 'oompah-trooper', 'cymbalist', 'pickup-gem',
];
