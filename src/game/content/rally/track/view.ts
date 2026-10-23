/**
 * The track's share of a view's draw list (docs/design/rally.md §3 "Streaming", §7.1 item 4, §7.3;
 * docs/api/rally.md "A.T"): the segments and far chunks within the fog distance and inside the
 * camera's frustum (r3/cull.ts), nearest first. Scenery pops in at the fog edge, as in the era.
 *
 * Use one `TrackView` per view (it keeps its frustum and scratch), and the same `out` array every
 * frame: `fill` overwrites it from index `from` and sets its length, so a steady view allocates
 * nothing per frame. The draw items are the track's own (`track.items`, identity matrices). Segments
 * within `LOD_NEAR` metres use their near level of detail (rows of ≤ 7 m: the affine warp reads),
 * the others the far one (one row per segment: a third of the triangles).
 */
import { Frustum } from '../../../../engine/r3/cull';
import type { Cam3, DrawItem } from '../../../../engine/view3d';
import type { A10Track, TrackCuller } from './types';

/** The track's triangle budget per view (spec §7.3: 6,000 for everything; the track's share). */
export const TRACK_TRI_BUDGET = 4000;
/** Segments whose middle is within this distance of the camera use the near level of detail (m). */
export const LOD_NEAR = 130;

export class TrackView implements TrackCuller {
  readonly track: A10Track;
  private readonly fr = new Frustum();
  /** Draw items per culling unit: near [outer, inner?] and far [outer, inner?] for a segment, [far] for a chunk. */
  private readonly nearItems: (readonly DrawItem[])[] = [];
  private readonly farItems: (readonly DrawItem[])[] = [];
  private readonly nearTris: number[] = [];
  private readonly farTris: number[] = [];
  /** The level-of-detail point of each unit (a chunk: none, always far). */
  private readonly mid: Float64Array;
  /** The last fill: units, draw items, triangles, units at the near level of detail. */
  units = 0;
  draws = 0;
  tris = 0;
  nearUnits = 0;

  /** `items`: a draw item for every mesh of the track (default: build them). */
  constructor(track: A10Track, items: readonly DrawItem[] = track.meshes.map((m) => ({ mesh: m.id, m: null }))) {
    this.track = track;
    const byId = new Map(items.map((it) => [it.mesh, it]));
    const triOf = new Map(track.meshes.map((m) => [m.id, m.idx.length / 3]));
    const item = (id: string): DrawItem => {
      const it = byId.get(id);
      if (!it) throw new Error(`TrackView: no item for ${id}`);
      return it;
    };
    const n = track.segments.length + track.chunks.length;
    this.mid = new Float64Array(n * 3);
    for (const seg of track.segments) {
      this.nearItems.push(seg.inner ? [item(seg.mesh), item(seg.inner)] : [item(seg.mesh)]);
      this.farItems.push(seg.innerFar ? [item(seg.meshFar), item(seg.innerFar)] : [item(seg.meshFar)]);
      this.nearTris.push(seg.tris);
      this.farTris.push(seg.trisFar);
      this.mid[seg.i * 3] = seg.mid[0];
      this.mid[seg.i * 3 + 1] = seg.mid[1];
      this.mid[seg.i * 3 + 2] = seg.mid[2];
    }
    track.chunks.forEach((ch, c) => {
      const its = [item(ch.mesh)];
      this.nearItems.push(its);
      this.farItems.push(its);
      const t = triOf.get(ch.mesh) ?? 0;
      this.nearTris.push(t);
      this.farTris.push(t);
      // Never near.
      this.mid[(track.segments.length + c) * 3 + 1] = 1e9;
    });
  }

  /**
   * Write the visible track items for a camera (aspect = view w / h; `far` = the fog's far end) into
   * `out` from index `from` (default 0) and set `out.length`. Returns the item count written.
   */
  fill(cam: Readonly<Cam3>, aspect: number, far: number, out: DrawItem[], from = 0): number {
    const cull = this.track.cull;
    this.fr.set(cam, aspect, Math.min(cam.far, far));
    const n = cull.cull(this.fr, cam.pos[0], cam.pos[1], cam.pos[2], far);
    const lod2 = LOD_NEAR * LOD_NEAR;
    let k = from;
    let tris = 0;
    let near = 0;
    for (let j = 0; j < n; j++) {
      const u = cull.out[j];
      const dx = this.mid[u * 3] - cam.pos[0], dy = this.mid[u * 3 + 1] - cam.pos[1], dz = this.mid[u * 3 + 2] - cam.pos[2];
      const isNear = dx * dx + dy * dy + dz * dz <= lod2;
      const its = isNear ? this.nearItems[u] : this.farItems[u];
      for (let q = 0; q < its.length; q++) out[k++] = its[q];
      tris += isNear ? this.nearTris[u] : this.farTris[u];
      if (isNear) near++;
    }
    out.length = k;
    this.units = n;
    this.draws = k - from;
    this.tris = tris;
    this.nearUnits = near;
    return k - from;
  }
}
