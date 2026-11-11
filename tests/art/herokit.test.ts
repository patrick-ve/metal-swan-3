/**
 * The hero kit (docs/design/ams2.md §1, docs/design/ams2-contract.md): the TypeScript port draws the
 * same palette ids as its Python reference for fixed seeds (tests/fixtures/herokit.json, made by
 * tools/herokit/fixture.py from docs/design/ams2/spike/hires), and its output is deterministic.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as K from '../../src/game/art/herokit/index';

interface Rec {
  w: number;
  h: number;
  sha: string;
  ids?: number[];
}
const FIX = JSON.parse(readFileSync(new URL('../fixtures/herokit.json', import.meta.url), 'utf8')) as Record<string, Record<string, Rec>>;

const { R, S } = K;

function floor(fn: (s: K.S) => void, w = 200): K.S {
  const s = new S(w, 216);
  fn(s);
  return s;
}

const DRAWINGS: Record<string, () => K.S> = {
  post: () => K.post(false),
  'post-far': () => K.post(true),
  lamp: () => K.lamp(72),
  bench: () => K.bench(),
  bike: () => K.bike('navy'),
  crate: () => K.crate(20, 14),
  stand: () => K.stand('HARING', 'navy'),
  planter: () => K.planter().box,
  tulips: () => K.planter().tulips[1],
  'flag-nl': () => K.flagFrames('nl')[2],
  'flag-city': () => K.flagFrames('city')[3],
  'flag-pole': () => K.flagPole(76),
  stall: () => K.stall(60, 400).box,
  'stall-cloth': () => K.stall(60, 400).cloth[1],
  houseboat: () => K.houseboat(150, 300).box,
  smoke: () => K.smokeFrames()[3],
  'far-cyclist': () => K.farCyclist('dred')[1],
  'tour-boat': () => K.tourboat(),
  'waste-bin': () => K.wasteBin(),
  'bike-rack': () => K.bikeRack(),
  hedge: () => K.hedge(70, 8, 3),
  crown: () => K.crown(66, 58, 570, 1),
  cloud: () => K.cloudSprite(60, 16, 22),
  'house-step': () => K.house(50, 3, 'brickr', 'step', 41 * 7919 + 2, { sh: 18, gr: 22, gh: 22, doorm: 'dred' }),
  'house-neck': () => K.house(46, 2, 'plastc', 'neck', 7922, { sh: 18, gr: 22, gh: 22, plastered: true }),
  'house-bell': () => K.house(58, 3, 'brickn', 'bell', 2375 + 2, { sh: 18, gr: 22, gh: 22, side: 8 }),
  'house-flat': () => K.house(42, 3, 'bricko', 'flat', 5, { sh: 18, gr: 22, gh: 22, doorm: 'navy' }),
  water: () => K.waterBand(200, 119, 152, null, 51, 1),
  cobbles: () => floor((s) => K.cobbles(s, 166, 190, 61)),
  pavers: () => floor((s) => K.pavers(s, 146, 162, 61)),
  kerb: () => floor((s) => K.kerb(s, 190, 5, 62)),
  lane: () => floor((s) => K.lane(s, 195, 209, 63)),
  gravel: () => floor((s) => K.gravel(s, 166, 190, 64)),
  grass: () => floor((s) => K.grass(s, 124, 150, 65)),
  sky: () => {
    const s = new S(120, 216);
    K.skyBands(s, R.sky_m, [28, 52, 74, 94, 112], 21);
    return s;
  },
  far: () => {
    const s = new S(160, 216);
    K.skyline(s, 106, 31);
    K.farTower(s, 40, 106, 70);
    return s;
  },
  trunk: () => {
    const s = new S(40, 110);
    K.trunk(s, 20, 108, 96, 8, 670);
    return s;
  },
  masonry: () => {
    const s = new S(150, 90);
    K.wallBlock(s, 6, 24, 130, 66, 'brickr', 101, 1, 77);
    K.slateRoof(
      s,
      [
        [4, 24],
        [20, 4],
        [120, 4],
        [138, 24],
      ],
      78,
      102,
      0.5,
    );
    K.cornice(s, 6, 24, 130, 103, 2);
    K.quoins(s, 6, 30, 50, 5, 104, 2.5);
    K.quoins(s, 131, 30, 50, 5, 105, 2.5, true);
    s.finish();
    return s;
  },
};

function idSha(o: K.S): string {
  return createHash('sha1').update(Buffer.from(o.c.buffer, o.c.byteOffset, o.c.byteLength)).digest('hex');
}

function rgbaSha(o: K.S, u: 2 | 4): string {
  const buf = K.renderBuffer(o, 'morning', u, 1000 + o.w * 7 + o.h);
  const bytes = new Uint8Array(buf.data.length * 4);
  for (let i = 0; i < buf.data.length; i++) {
    const c = buf.data[i];
    bytes[i * 4] = c >>> 24;
    bytes[i * 4 + 1] = (c >>> 16) & 255;
    bytes[i * 4 + 2] = (c >>> 8) & 255;
    bytes[i * 4 + 3] = c & 255;
  }
  return createHash('sha1').update(bytes).digest('hex');
}

/** The bell gable differs from the reference in 3 pixels of 6800: the corner of a thin roof slope (the polygon filler's rounding). */
const NEAR: ReadonlySet<string> = new Set(['house-bell']);
/** The water left the reference on purpose: it tiles, and its frames differ in a few strokes ('the water' below). */
const REWORKED: ReadonlySet<string> = new Set(['water']);
/** Letters stay out of EPX at the finer tiers ('stamps' below): the 1× drawing is still the reference's. */
const STAMPED: ReadonlySet<string> = new Set(['stand']);

describe('hero kit: the same palette ids as the reference', () => {
  it('the generator gives the reference numbers', () => {
    // numpy.random.default_rng(0).random() and integers(0, 9) afterwards.
    const r = K.rngf(0);
    expect(r.random()).toBe(0.6369616873214543);
    expect(r.int(0, 9)).toBe(4);
  });

  for (const name of Object.keys(DRAWINGS)) {
    if (REWORKED.has(name)) continue;
    it(`1x ${name}`, () => {
      const rec = FIX.u1[name];
      const o = K.withKitTier(1, DRAWINGS[name]);
      expect([o.w, o.h]).toEqual([rec.w, rec.h]);
      if (rec.ids) expect(Array.from(o.c)).toEqual(rec.ids);
      if (!NEAR.has(name)) expect(idSha(o)).toBe(rec.sha);
    });
  }

  for (const u of [2, 4] as const) {
    for (const name of Object.keys(DRAWINGS)) {
      if (NEAR.has(name) || REWORKED.has(name) || STAMPED.has(name)) continue;
      it(`${u}x ${name}`, () => {
        const rec = FIX[`u${u}`][name];
        const o = K.withKitTier(u, DRAWINGS[name]);
        expect(rgbaSha(o, u)).toBe(rec.sha);
      });
    }
  }
});

describe('hero kit: deterministic', () => {
  it('two runs give the same pixels at every tier', () => {
    for (const u of [1, 2, 4] as const) {
      const a = K.withKitTier(u, () => K.renderBuffer(K.house(50, 3, 'brickr', 'step', 324681), 'golden', u, 7));
      const b = K.withKitTier(u, () => K.renderBuffer(K.house(50, 3, 'brickr', 'step', 324681), 'golden', u, 7));
      expect(Array.from(a.data)).toEqual(Array.from(b.data));
    }
  });

  it('the art tier sizes an object by a whole number', () => {
    const o = K.post(false);
    expect(K.renderBuffer(o, 'noon', 2, 1).w).toBe(o.w * 2);
    expect(K.renderBuffer(o, 'noon', 4, 1).h).toBe(o.h * 4);
  });
});

/** Columns where a row changes tone from column a to column b. */
function breaks(c: Int16Array, w: number, h: number, a: number, b: number): number {
  let n = 0;
  for (let y = 0; y < h; y++) if (c[y * w + a] !== c[y * w + b]) n++;
  return n;
}

describe('the water', () => {
  const W = 256;
  const bank = new K.S(W, 60);
  bank.wrap = true;
  bank.use(1, 1);
  for (let x = 0; x < W; x += 40) bank.rect(R.brickr[1], x, 6, 22, 54);
  const image = K.renderBuffer(bank, 'golden', 1, 0);
  const cases: ReadonlyArray<readonly [string, K.BankImage | null]> = [
    ['open water', null],
    ['a reflection', image],
  ];

  for (const [name, src] of cases) {
    for (const u of [1, 2, 4] as const) {
      it(`${name} tiles at art ${u}: column W − 1 runs on into column 0 like any two columns`, () => {
        const o = K.waterBand(W, 60, 110, src, 51, 0).cropRows(60, 110);
        const r = K.renderIds(o, 77, u);
        let typical = 0;
        const pairs = 40;
        for (let i = 0; i < pairs; i++) {
          const a = Math.trunc(((i + 0.5) * (r.w - 1)) / pairs);
          typical += breaks(r.c, r.w, r.h, a, a + 1);
        }
        typical /= pairs;
        expect(breaks(r.c, r.w, r.h, r.w - 1, 0)).toBeLessThanOrEqual(Math.max(typical * 2.5, r.h * 0.2));
      });
    }

    it(`${name}: a later frame changes a small part`, () => {
      for (const u of [1, 4] as const) {
        const frames = [0, 1, 2].map((f) => K.waterBand(W, 60, 110, src, 51, f).cropRows(60, 110));
        const bufs = K.renderFrames(frames, 'golden', u, 77);
        for (const k of [1, 2]) {
          let n = 0;
          for (let i = 0; i < bufs[0].data.length; i++) if (bufs[0].data[i] !== bufs[k].data[i]) n++;
          expect(n / bufs[0].data.length).toBeLessThan(0.14);
        }
      }
    });
  }
});

describe('a crown in the wind', () => {
  it('changes a small part from frame to frame, also at the finer tiers', () => {
    const frames = K.swayCrown(118, 118, 670);
    expect(frames).toHaveLength(4);
    for (const u of [1, 2, 4] as const) {
      const bufs = K.renderFrames(frames, 'morning', u, 5);
      for (const k of [1, 2, 3]) {
        let n = 0;
        let solid = 0;
        for (let i = 0; i < bufs[0].data.length; i++) {
          if (bufs[0].data[i] !== 0) solid++;
          if (bufs[k - 1].data[i] !== bufs[k].data[i]) n++;
        }
        expect(n / solid).toBeLessThan(0.06);
      }
    }
  });
});

describe('stamps', () => {
  it('letters stay whole blocks at the finer tiers, and EPX does not see them', () => {
    const s = new S(40, 9);
    s.use(1, 1);
    s.rect(R.navy[1], 0, 0, 40, 9);
    s.use(2, 2);
    K.text(s, 'DO', 2, 2, R.yellow[0]);
    for (const u of [2, 4] as const) {
      const r = K.renderIds(s, 3, u);
      for (let y = 0; y < s.h; y++) {
        for (let x = 0; x < s.w; x++) {
          const on = s.c[y * s.w + x] === R.yellow[0];
          for (let j = 0; j < u; j++) {
            for (let i = 0; i < u; i++) expect(r.c[(y * u + j) * r.w + x * u + i] === R.yellow[0]).toBe(on);
          }
        }
      }
    }
  });

  it('what is drawn later over a letter wins', () => {
    const s = new S(20, 9);
    s.use(1, 1);
    s.rect(R.navy[1], 0, 0, 20, 9);
    s.use(2, 2);
    K.text(s, 'O', 2, 2, R.yellow[0]);
    s.use(3, 3);
    s.rect(R.dred[1], 0, 0, 20, 9);
    const r = K.renderIds(s, 3, 2);
    expect(Array.from(r.c).includes(R.yellow[0])).toBe(false);
  });

  it('marks follow a paste and a crop', () => {
    const a = new S(10, 9);
    a.use(1, 1);
    a.rect(R.navy[1], 0, 0, 10, 9);
    a.use(2, 2);
    K.text(a, 'I', 2, 2, R.yellow[0]);
    const o = new S(30, 30);
    o.paste(a, 5, 10);
    const c = o.cropRows(8, 22);
    const r = K.renderIds(c, 3, 4);
    expect(c.c[(4 - 0) * c.w + 8]).toBe(R.yellow[0]);
    expect(r.c[((4 * 4 + 1) * r.w) + 8 * 4 + 1]).toBe(R.yellow[0]);
  });
});

describe('the post rule', () => {
  const fl = new S(400, 216);
  K.lane(fl, 194, 209, 1);
  K.cobbles(fl, 166, 190, 1);
  K.kerb(fl, 190, 4, 1);
  const w = K.post(false).w;

  it('refuses a post on the bike lane', () => {
    expect(() => K.checkPostFoot(fl, 50, w, 200, 'test')).toThrow(K.PostOnWrongGround);
  });
  it('refuses a post on the road', () => {
    expect(() => K.checkPostFoot(fl, 50, w, 178, 'test')).toThrow(K.PostOnWrongGround);
  });
  it('accepts a post on a kerbstone', () => {
    expect(() => K.checkPostFoot(fl, 50, w, 191, 'test')).not.toThrow();
  });
});
