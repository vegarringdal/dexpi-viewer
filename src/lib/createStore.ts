import { useSyncExternalStore } from "react";

export type Store<T extends object> = Readonly<{
  get: () => T;
  /** Shallow merge; no-ops when every patched key is reference-equal. */
  set: (patch: Partial<T> | ((prev: T) => Partial<T>)) => void;
  /** Subscribe inside a component — re-renders on every change. */
  use: () => T;
  subscribe: (listener: () => void) => () => void;
}>;

/**
 * A tiny global store (useSyncExternalStore under the hood), mirroring the
 * @treDeSpaceUI createStore API — that module is not exported by the npm
 * package, so the app carries its own copy. Keep stored state
 * JSON-serializable; live handles belong in *.actions.ts modules.
 */
export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();

  function get(): T {
    return state;
  }

  function set(patch: Partial<T> | ((prev: T) => Partial<T>)): void {
    const resolved = typeof patch === "function" ? patch(state) : patch;
    let changed = false;
    for (const key of Object.keys(resolved)) {
      if (state[key as keyof T] !== resolved[key as keyof T]) {
        changed = true;
        break;
      }
    }
    if (!changed) {
      return;
    }

    state = { ...state, ...resolved };
    for (const listener of listeners) {
      listener();
    }
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function useStoreState(): T {
    return useSyncExternalStore(subscribe, get);
  }

  return { get, set, use: useStoreState, subscribe };
}
