/**
 * Art pool worker (src/engine/art-pool.ts): a browser module worker (Vite bundles it as its own
 * chunk) or a node worker_threads worker (tools, tests; run through tsx). It loads the content
 * registry once (the lazy fps content only when an id needs it; the lazy mission `sewers` only when
 * an id is a sewers sprite, docs/design/sewers.md §1), builds the sprite ids each request names at
 * the request's density and posts back a raw pack whose pixel ArrayBuffers are transferred, not
 * copied.
 */
import { createArtWorkerHandler, type ArtBuildReply, type ArtBuildRequest, type NodeWorkerThreads } from '../engine/art-pool';
import { isAms2Content, isFpsContent, isLazyContent, isSewersContent, loadContent } from './content/index';
import { isAms2SpriteId } from './content/missions/ams2/ids';
import { isSewersSpriteId } from './content/missions/sewers/ids';

const base = createArtWorkerHandler(
  async (lazy) => {
    // The lazy fps content when an fps id needs it (the rally's lazy content has no sprites).
    const report = await loadContent(lazy ? isFpsContent : (id) => !isLazyContent(id));
    if (report.failed.length) console.warn(`[art-worker] content failed: ${report.failed.map((f) => f.id).join(', ')}`);
  },
  (id) => id.startsWith('fps/'),
);

/** The sewers chunk, loaded once when a request first names a sewers sprite (`isSewersSpriteId`). */
let sewers: Promise<void> | null = null;

/** The ams2 chunk, loaded once when a request first names an ams2 sprite (`isAms2SpriteId`). */
let ams2: Promise<void> | null = null;

async function handle(req: ArtBuildRequest): ReturnType<typeof base> {
  if (req.ids.some(isAms2SpriteId)) {
    ams2 ??= loadContent(isAms2Content).then((report) => {
      if (report.failed.length) console.warn(`[art-worker] ams2 content failed: ${report.failed.map((f) => f.id).join(', ')}`);
    });
    await ams2;
  }
  if (req.ids.some(isSewersSpriteId)) {
    sewers ??= loadContent(isSewersContent).then((report) => {
      if (report.failed.length) console.warn(`[art-worker] sewers content failed: ${report.failed.map((f) => f.id).join(', ')}`);
    });
    await sewers;
  }
  return base(req);
}

interface Sink {
  postMessage(m: ArtBuildReply, transfer: ArrayBuffer[]): void;
}

function serve(sink: Sink): (req: ArtBuildRequest) => void {
  // One request at a time, in order (the pool sends one per worker anyway).
  let chain: Promise<void> = Promise.resolve();
  return (req) => {
    chain = chain.then(async () => {
      const { reply, transfer } = await handle(req);
      sink.postMessage(reply, transfer);
    });
  };
}

const proc = (globalThis as { process?: { versions?: { node?: string } } }).process;
const isNode = typeof proc?.versions?.node === 'string';

if (isNode) {
  // Not a static import: the browser chunk must not pull in node modules.
  const mod = 'node:worker_threads';
  const { parentPort } = (await import(/* @vite-ignore */ mod)) as NodeWorkerThreads;
  if (parentPort) {
    const port = parentPort;
    const onRequest = serve({ postMessage: (m, t) => port.postMessage(m, t) });
    port.on('message', (m: ArtBuildRequest) => onRequest(m));
  }
} else {
  const scope = self as unknown as {
    postMessage(m: unknown, transfer: Transferable[]): void;
    onmessage: ((e: MessageEvent<ArtBuildRequest>) => void) | null;
  };
  const onRequest = serve({ postMessage: (m, t) => scope.postMessage(m, t) });
  scope.onmessage = (e) => onRequest(e.data);
}
