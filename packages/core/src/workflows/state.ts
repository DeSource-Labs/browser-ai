import type { BrowserAiStore } from '../store.js';
/** Cache the public snapshot until an internal state transition occurs. */
export const projectWorkflow = <State, Snapshot extends object, Methods extends object>(
  source: Pick<BrowserAiStore<State>, 'getSnapshot' | 'subscribe'>,
  read: () => Snapshot,
  methods: Methods
): Methods & {
  state: Pick<BrowserAiStore<Snapshot>, 'getSnapshot' | 'subscribe'>;
} => {
  let previous = source.getSnapshot();
  let snapshot = read();
  return {
    ...methods,
    state: {
      getSnapshot() {
        const next = source.getSnapshot();
        if (next !== previous) {
          previous = next;
          snapshot = read();
        }
        return snapshot;
      },
      subscribe: source.subscribe
    }
  };
};
