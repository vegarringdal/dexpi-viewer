import { type Theme, themeState } from "./theme.state.ts";

const THEME_STORAGE_KEY = "dexpi.theme";

/**
 * The @tredespace/ui stylesheet is dark by default and remaps to light when
 * `data-theme="light"` is set on <html>; the canvas palette follows the store.
 */
function applyTheme(theme: Theme): void {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  themeState.set({ theme });
}

/** Call once at startup, before first render. Light is the first-run default. */
export function applyStoredTheme(): void {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  applyTheme(stored === "dark" ? "dark" : "light");
}

export function toggleTheme(): void {
  applyTheme(themeState.get().theme === "dark" ? "light" : "dark");
}
