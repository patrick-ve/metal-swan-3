/**
 * Small typed event bus (docs/ARCHITECTURE.md §5.1).
 *
 * `M` maps event names to payload types, e.g. `EventBus<{ score: { player: number; points: number } }>`.
 * Listener lists are copy-on-write, so `emit` never allocates and listeners may subscribe or
 * unsubscribe while an event is being delivered (changes apply to the next emit).
 * A throwing listener is logged once per event name and does not stop the other listeners.
 */

export type Listener<P> = (payload: P) => void;

export class EventBus<M extends object> {
  private readonly lists = new Map<keyof M, ReadonlyArray<Listener<never>>>();
  private readonly warned = new Set<keyof M>();

  /** Subscribe. Returns a function that unsubscribes. */
  on<K extends keyof M>(type: K, fn: Listener<M[K]>): () => void {
    const list = this.lists.get(type) ?? [];
    this.lists.set(type, [...list, fn as Listener<never>]);
    return () => this.off(type, fn);
  }

  /** Subscribe for one delivery only. */
  once<K extends keyof M>(type: K, fn: Listener<M[K]>): () => void {
    const off = this.on(type, (p: M[K]) => {
      off();
      fn(p);
    });
    return off;
  }

  off<K extends keyof M>(type: K, fn: Listener<M[K]>): void {
    const list = this.lists.get(type);
    if (!list) return;
    const i = list.indexOf(fn as Listener<never>);
    if (i < 0) return;
    const next = list.slice();
    next.splice(i, 1);
    if (next.length) this.lists.set(type, next);
    else this.lists.delete(type);
  }

  emit<K extends keyof M>(type: K, payload: M[K]): void {
    const list = this.lists.get(type) as ReadonlyArray<Listener<M[K]>> | undefined;
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      try {
        list[i](payload);
      } catch (err) {
        if (!this.warned.has(type)) {
          this.warned.add(type);
          console.error(`[events] listener for "${String(type)}" threw:`, err);
        }
      }
    }
  }

  /** Number of listeners for one event (or for all events). */
  count(type?: keyof M): number {
    if (type !== undefined) return this.lists.get(type)?.length ?? 0;
    let n = 0;
    for (const list of this.lists.values()) n += list.length;
    return n;
  }

  /** Remove all listeners of one event, or of every event. */
  clear(type?: keyof M): void {
    if (type === undefined) this.lists.clear();
    else this.lists.delete(type);
  }
}
