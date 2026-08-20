import type { DockManager } from "@tredespace/ui/dockable";

// -----------------------------------------------------------------------------
// Dock manager handle
//
// The DockManager is a live, non-serializable object, so it lives here in the
// actions module (not in a store); App registers it on mount so hotkeys and
// the ribbon can open panels. Layout persistence lives here too.
// -----------------------------------------------------------------------------

const LAYOUT_STORAGE_KEY = "dexpi.dockLayout";
const LAYOUT_SAVE_DEBOUNCE_MS = 400;

let dockManager: DockManager | null = null;

export function setDockManager(manager: DockManager | null): void {
  dockManager = manager;
}

/** Opens (or focuses) the Settings panel in the dock. */
export function openSettings(): void {
  dockManager?.openPanel("settings");
}

/**
 * Restores the persisted dock layout (if any) and starts saving every layout
 * change, debounced. Returns the disposer; call once per manager lifetime.
 * `loadLayout` normalizes/heals a stale tree, so a layout saved by an older
 * app version degrades gracefully.
 */
export function initLayoutPersistence(manager: DockManager): () => void {
  const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
  if (saved) {
    try {
      manager.loadLayout(JSON.parse(saved));
    } catch {
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
    }
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsubscribe = manager.subscribe(() => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(manager.saveLayout()));
    }, LAYOUT_SAVE_DEBOUNCE_MS);
  });
  return () => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    unsubscribe();
  };
}

/** Back to the built-in layout; also clears the persisted one. */
export function resetDockLayout(): void {
  localStorage.removeItem(LAYOUT_STORAGE_KEY);
  dockManager?.resetLayout();
}
