/**
 * The canal scenes (docs/api/canal.md): a section's scenery as the kit's baked layer stack
 * (tmp/l1/kit/bake_game.py writes the image files and the generated manifest). Types only.
 */
import type { Entity } from '../../../engine/entity';
import type { World } from '../../../engine/world';

/** A layer kind of the kit's stack (tmp/l1/port/PORT-BRIEF.md §2). */
export type CanalLayerKind = 'img' | 'tile' | 'frames' | 'rows';

/** The tier-independent facts of one layer of a section's stack (draw order = list order). */
export interface CanalLayerMeta {
  readonly id: string;
  readonly kind: CanalLayerKind;
  /** Drawn after the entities (the front pass). */
  readonly over: boolean;
  /** Frames (`frames`, `rows`: one step each 10 ticks); 1 otherwise. */
  readonly n: number;
  /** A `tile` layer's drift (logical px per second, wraps). */
  readonly drift?: number;
  /** The floor depth of a plane layer (`d<depth>`), when it is one. */
  readonly depth?: number;
  /** A front plane (things that stand at that depth but are drawn over the heroes). */
  readonly front?: boolean;
}

/** One layer at one art tier. */
export interface CanalTierLayer {
  /** Rows of the layer image (real px of this tier): a `rows` layer's speed is per row of these. */
  readonly rows: number;
  /** The layer image's top on screen (real px of this tier) and its width (the wrap of a `tile` layer). */
  readonly y0: number;
  readonly pw: number;
  /** The layer's speed; a `rows` layer's first and last row speeds (from its rows' centres: per tier). */
  readonly speed: number;
  readonly s0?: number;
  readonly s1?: number;
  /**
   * The tiles, 8 ints each: frame, x, y, w, h (real px of this tier, relative to the layer image's
   * top-left), file (index into `files`), sx, sy (real px in that file). One tile per frame and
   * column of `col` logical px at most; a column without a tile is empty.
   */
  readonly tiles: readonly number[];
}

/** One section at one art tier. */
export interface CanalTierManifest {
  /** The image files (PNG, under the manifest's `base`), one camera-window pack (or part of one) each. */
  readonly files: readonly string[];
  /** The camera x (logical) where each file's window starts. */
  readonly fileCam: readonly number[];
  readonly layers: readonly CanalTierLayer[];
  /**
   * The canal sprites at this tier (docs/api/canal.md §7): one sheet (`file`, under `base`) and per
   * entry of the section's `sprites` its top-left in the sheet (`xy`: sx, sy, real px; its size is
   * the entry's w, h times the tier).
   */
  readonly sprites?: { readonly file: string; readonly xy: readonly number[] };
}

/**
 * One frame of a game sprite that the scene's kit painting replaces while the scene draws (a canal
 * sprite, docs/api/canal.md §7): the sprite id, the frame index and the game's 1× geometry of that
 * frame (logical px), which the painting keeps.
 */
export interface CanalSpriteMeta {
  readonly id: string;
  readonly frame: number;
  readonly w: number;
  readonly h: number;
  readonly ox: number;
  readonly oy: number;
}

/** One section's stack. */
export interface CanalSectionManifest {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  /** The camera's last x (width − 384). */
  readonly cam: number;
  readonly layers: readonly CanalLayerMeta[];
  /** The canal sprites (kit paintings of entity frames), sorted by id and frame; none when missing. */
  readonly sprites?: readonly CanalSpriteMeta[];
  /**
   * A LIT STACK (docs/api/canal.md "A lit section"): the id of the ambient section this stack pairs
   * with (the same layers and geometry; what the flashlight shows). The bake checks the pair.
   */
  readonly litOf?: string;
  /** By art tier ('1', '2', '4'); a tier not baked yet is missing (the store uses a lower one). */
  readonly tiers: Readonly<Partial<Record<string, CanalTierManifest>>>;
}

/** A mission's baked canal scenes (the generated `manifest.gen.ts`). */
export interface CanalManifest {
  /** The files' folder, relative to the site root (e.g. 'art/ams/'). */
  readonly base: string;
  /** Logical px of layer x per tile column. */
  readonly col: number;
  /** The loading policy the bake planned the packs for (camera px): window size, look-ahead, eviction margin. */
  readonly window: number;
  readonly ahead: number;
  readonly behind: number;
  readonly sections: Readonly<Record<string, CanalSectionManifest>>;
}

/**
 * OPT-IN (`SectionDef.canal`, docs/api/canal.md): the section draws a baked canal scene in place of
 * its background layers, its floor's surface / faces / tops / overhangs / rows, its decor and its
 * terrain art. Its entities and the floor's entity passes draw as before. Art only.
 */
export interface CanalDef {
  /** The scene: `<manifest id>/<section id>`, e.g. 'ams/a' (`defineCanalManifest`). */
  readonly scene: string;
  /** Layer ids of the stack this section does not draw (an entity draws that thing instead). */
  readonly skip?: readonly string[];
  /**
   * Render-only depth rules by entity kind while the scene draws (docs/api/canal.md §9), over the
   * floor's own (`FloorDef.entityDepth`): e.g. a gull on a kit lamp, `gullOnLamp`. The simulation
   * never reads them; with the scene off the floor's own rules (or depth 0) apply.
   */
  readonly depth?: Readonly<Record<string, (e: Entity) => number>>;
  /**
   * Entity kinds whose floor faces (`FloorDef.entityFaces`) are left out while the scene draws: the
   * kit paints that thing in depth itself (a low bridge's deck, the cruise boat's deck and roof), so
   * its faces would draw it twice. A list of kinds: always; by kind, `true` (always) or a rule: for
   * the entities it holds for (the Magere Brug's bascule while it is closed). Render only; with the
   * scene off the faces draw as before.
   */
  readonly hideFaces?: readonly string[] | Readonly<Record<string, true | ((e: Entity) => boolean)>>;
  /**
   * Layers drawn only while a rule holds for the world (key: a layer id prefix): a kit painting of
   * a state an entity leaves (the Magere Brug's closed deck in depth: gone when the bascule opens).
   * The rule sees the world of the last frame drawn (`SectionView.drawShadows`); without one (a
   * headless scenery frame, the fidelity test) every layer draws. Render only.
   */
  readonly show?: Readonly<Record<string, (world: World) => boolean>>;
  /**
   * The sprite id prefixes the section draws while the canal scene is on (the tier-4 working set,
   * gameplay.ts). Default: the section's `art` without its decor's sprites (the scene paints them).
   */
  readonly art?: readonly string[];
}
