/**
 * The ring's scenery worker (a browser module worker; scenery-job.ts): it loads the ring's
 * background generators and builds the dense layer buffers the view asks for, then posts the
 * pixels back as a transferred ArrayBuffer (no copy). One request at a time, in order.
 */
import '../content/ring/scenery/layers-far';
import '../content/ring/scenery/layers-near';
import { buildRingScenery, type RingSceneryReply, type RingSceneryRequest } from './scenery-job';

const scope = self as unknown as {
  postMessage(m: RingSceneryReply, transfer: Transferable[]): void;
  onmessage: ((e: MessageEvent<RingSceneryRequest>) => void) | null;
};

scope.onmessage = (e) => {
  const { reply, transfer } = buildRingScenery(e.data);
  scope.postMessage(reply, transfer);
};
