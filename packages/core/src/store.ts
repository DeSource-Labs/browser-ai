export type StoreListener = () => void;
export type StoreUpdater<State> = Partial<State> | ((state: State) => State);

export interface BrowserAiStore<State> {
  getSnapshot(): State;
  subscribe(listener: StoreListener): () => void;
  update(updater: StoreUpdater<State>): State;
}

export const createBrowserAiStore = <State extends object>(initialState: State): BrowserAiStore<State> => {
  let snapshot = initialState;
  const listeners = new Set<StoreListener>();

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(updater) {
      const next =
        typeof updater === 'function'
          ? (updater as (state: State) => State)(snapshot)
          : ({ ...snapshot, ...updater } as State);

      if (Object.is(next, snapshot)) return snapshot;
      snapshot = next;
      listeners.forEach((listener) => listener());
      return snapshot;
    }
  };
};
