/** Shared helpers for the engine tests. */
import type { Color } from '../../src/engine/color';
import type { PixelBuffer } from '../../src/engine/pixel';
import type { DrawOpts, Frame, ParallaxOpts, Renderer, TextOpts } from '../../src/engine/render';
import { Body, type BodyOptions, type Mover } from '../../src/engine/physics';

export interface TestMover extends Mover {
  body: Body;
  crushed: number;
}

/** A bare mover (position + velocity + body), like an entity without the rest. */
export function mover(x: number, y: number, o: Partial<BodyOptions> = {}): TestMover {
  const m: TestMover = {
    x,
    y,
    vx: 0,
    vy: 0,
    body: new Body({
      w: 14,
      h: 30,
      gravity: 0.22,
      maxFall: 5.5,
      stepUp: 4,
      snapDown: 4,
      maxSlope: 1,
      dropThroughTicks: 12,
      ...o,
    }),
    crushed: 0,
    onCrushed() {
      m.crushed++;
    },
  };
  return m;
}

export interface DrawCall {
  op: string;
  args: unknown[];
}

/** Renderer that records calls (no pixels). */
export class RecordingRenderer implements Renderer {
  readonly w = 384;
  readonly h = 216;
  camX = 0;
  camY = 0;
  readonly calls: DrawCall[] = [];

  private rec(op: string, args: unknown[]): void {
    this.calls.push({ op, args });
  }

  count(op: string): number {
    return this.calls.filter((c) => c.op === op).length;
  }

  begin(clear?: Color | null): void {
    this.rec('begin', [clear]);
  }
  end(): void {
    this.rec('end', []);
  }
  setCamera(x: number, y: number): void {
    this.camX = Math.round(x);
    this.camY = Math.round(y);
  }
  sprite(id: string, frameIndex: number, x: number, y: number, o?: DrawOpts): void {
    this.rec('sprite', [id, frameIndex, x, y, o ? { ...o } : undefined]);
  }
  frame(f: Frame, x: number, y: number, o?: DrawOpts): void {
    this.rec('frame', [f, x, y, o ? { ...o } : undefined]);
  }
  image(buf: PixelBuffer, x: number, y: number, o?: DrawOpts): void {
    this.rec('image', [buf, x, y, o ? { ...o } : undefined]);
  }
  rect(x: number, y: number, w: number, h: number, c: Color, o?: DrawOpts): void {
    this.rec('rect', [x, y, w, h, c, o ? { ...o } : undefined]);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: Color, o?: DrawOpts): void {
    this.rec('line', [x0, y0, x1, y1, c, o ? { ...o } : undefined]);
  }
  text(s: string, x: number, y: number, o?: TextOpts): void {
    this.rec('text', [s, x, y, o ? { ...o } : undefined]);
  }
  parallax(buf: PixelBuffer, fx: number, fy: number, ox: number, oy: number, o?: ParallaxOpts): void {
    this.rec('parallax', [buf, fx, fy, ox, oy, o]);
  }
  fade(c: Color, alpha: number): void {
    this.rec('fade', [c, alpha]);
  }
}
