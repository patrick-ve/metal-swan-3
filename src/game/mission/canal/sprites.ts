/**
 * Canal sprites (docs/api/canal.md §7): a scene's kit paintings of things the game draws as entities
 * (a breakable rack, a stall, a boat). While the scene draws, the mission runner sets the scene's
 * `CanalSprites` as the frame overlay (engine/sprites.ts `setFrameOverlay`): every getFrames of a
 * listed sprite id then returns the id's own frames with the listed frames replaced by the baked
 * ones, at the best loaded tier ≤ the density asked for (4 → 2 → 1); frames the kit does not
 * replace (a wreck) keep the game's art. Nothing is cached in the sprite registry: the baked frames
 * are the store's (freed with the scene), never counted in `DENSE_BUDGET_BYTES`, never in a pack.
 *
 * A replaced frame keeps its game frame's logical geometry (the bake refuses another, and this
 * checks it again against the registry's frames: an id that does not fit keeps its own art, with one
 * warning) and the game frame's points.
 */
import type { Frame } from '../../../engine/render';
import { frameH, frameW, type FrameOverlay } from '../../../engine/sprites';
import type { CanalSceneState, CanalTier } from './store';

const warned = new Set<string>();

interface Merged {
  base: readonly Frame[];
  from: readonly Frame[];
  out: readonly Frame[];
}

export class CanalSprites implements FrameOverlay {
  private readonly state: CanalSceneState;
  /** Per sprite id: the entry index (of the section's `sprites`) of each frame index, -1 where not replaced. */
  private readonly byId = new Map<string, number[]>();
  /** The last merged strip per id and density (rebuilt when the base frames or the loaded tier change). */
  private readonly merged = new Map<string, Merged>();
  /** Ids whose baked frames do not fit the game's frames (they keep their own art). */
  private readonly bad = new Set<string>();

  private constructor(state: CanalSceneState) {
    this.state = state;
    const list = state.sec.sprites ?? [];
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      let m = this.byId.get(e.id);
      if (!m) this.byId.set(e.id, (m = []));
      while (m.length <= e.frame) m.push(-1);
      m[e.frame] = i;
    }
  }

  /** The overlay of a scene (null: its section has no canal sprites). */
  static of(state: CanalSceneState): CanalSprites | null {
    return state.sec.sprites?.length ? new CanalSprites(state) : null;
  }

  /** The sprite ids this scene replaces frames of. */
  ids(): string[] {
    return [...this.byId.keys()];
  }

  /** The loaded tier to draw at density d: the highest ≤ d whose sprites are in (null: none yet). */
  private tierFor(d: number): CanalTier | null {
    for (const t of [4, 2, 1]) {
      if (t > d) continue;
      const st = this.state.tiers.get(t);
      if (st?.sprites) return st;
    }
    return null;
  }

  frames(id: string, d: number, base: readonly Frame[]): readonly Frame[] {
    const map = this.byId.get(id);
    if (!map || this.state.failed || this.bad.has(id)) return base;
    const st = this.tierFor(d);
    if (!st) return base;
    const from = st.sprites as Frame[];
    const key = d >= 4 ? 4 : d >= 2 ? 2 : 1;
    const ck = `${key}|${id}`;
    const hit = this.merged.get(ck);
    if (hit && hit.base === base && hit.from === from) return hit.out;
    const list = this.state.sec.sprites ?? [];
    const out = base.slice();
    for (let i = 0; i < map.length && i < base.length; i++) {
      const k = map[i];
      if (k < 0) continue;
      const b = base[i];
      const e = list[k];
      // The game's geometry: the logical size and anchor of the frame the registry has.
      if (frameW(b) !== e.w || frameH(b) !== e.h || b.ox !== e.ox || b.oy !== e.oy) {
        this.bad.add(id);
        const msg = `[canal] scene ${this.state.id}: sprite ${id} frame ${i} is ${frameW(b)}×${frameH(b)} at (${b.ox}, ${b.oy}) in the game, ${e.w}×${e.h} at (${e.ox}, ${e.oy}) baked: drawing the game's art (re-run the dump and re-bake)`;
        if (!warned.has(msg)) {
          warned.add(msg);
          console.warn(msg);
        }
        return base;
      }
      const f = from[k];
      out[i] = b.pts ? { ...f, pts: b.pts } : f;
    }
    this.merged.set(ck, { base, from, out });
    return out;
  }
}
