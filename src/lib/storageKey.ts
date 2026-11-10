// Prefix for localStorage keys, so builds that share an origin don't share
// settings: prod (/dexpi-viewer/) and preview (/dexpi-viewer/preview/) both
// live on vegarringdal.github.io. CI sets VITE_STORAGE_PREFIX to "PROD_" or
// "PREVIEW_"; local dev leaves it empty (localhost is its own origin anyway).

const PREFIX: string = import.meta.env.VITE_STORAGE_PREFIX ?? "LOCAL_";

/**
 * The localStorage key to use for `key` in this build. The first time a
 * prefixed key is asked for and doesn't exist yet, the value under the old
 * unprefixed key (from before prefixes) is copied over, so existing users keep
 * their settings. The old key is left in place so prod and preview can both
 * pick it up.
 */
export function storageKey(key: string): string {
  if (!PREFIX) return key;
  const prefixed = PREFIX + key;
  try {
    if (localStorage.getItem(prefixed) === null) {
      const legacy = localStorage.getItem(key);
      if (legacy !== null) localStorage.setItem(prefixed, legacy);
    }
  } catch {
    // Storage unavailable (privacy mode, quota) — callers handle that themselves.
  }
  return prefixed;
}
