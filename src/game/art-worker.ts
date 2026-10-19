/**
 * Art pool worker (src/engine/art-pool.ts): a browser module worker (Vite bundles it as its own
 * chunk) or a node worker_threads worker (tools, tests; run through tsx). It loads the content
 * registry once (the lazy fps content only when an id needs it), builds the sprite ids each
 * request names at the request's density and posts back a raw pack whose pixel ArrayBuffers are
 * transferred, not copied.
 */
import { createArtWorkerHandler, type ArtBuildReply, type ArtBuildRequest, type NodeWorkerThreads } from '../engine/art-pool';
import { isLazyContent, loadContent } from './content/index';

const handle = createArtWorkerHandler(
  async (lazy) => {
    const report = await loadContent(lazy ? isLazyContent : (id) => !isLazyContent(id));
    if (report.failed.length) console.warn(`[art-worker] content failed: ${report.failed.map((f) => f.id).join(', ')}`);
  },
  (id) => id.startsWith('fps/'),
);

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
