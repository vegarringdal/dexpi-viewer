import { createStore } from "../../lib/createStore.ts";

export type Theme = "dark" | "light";

export type ThemeState = Readonly<{
  theme: Theme;
}>;

export const themeState = createStore<ThemeState>({ theme: "dark" });
