import { createStore } from "../../lib/createStore.ts";

export type LoadedFile = Readonly<{
  name: string;
  sizeBytes: number;
  text: string;
}>;

export type CursorPosition = Readonly<{
  xMm: number;
  yMm: number;
}>;

/** One-shot canvas commands; `viewCmdSeq` bumps to trigger execution. */
export type ViewCommand =
  | Readonly<{ kind: "fit" }>
  | Readonly<{ kind: "zoom"; factor: number }>
  | Readonly<{ kind: "zoom100" }>
  | Readonly<{ kind: "centerAt"; xMm: number; yMm: number }>;

/** Visible drawing area, mm (y-down) — the minimap's viewport rectangle. */
export type ViewportRect = Readonly<{
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}>;

export type ViewerState = Readonly<{
  file: LoadedFile | null;
  /** Bumped whenever a new document loads; the canvas re-fits on change. */
  docRevision: number;
  objectCount: number;
  /** Loaded DISC profile file name (DEXPI 2.1), or null. */
  profileName: string | null;
  zoomPercent: number;
  cursor: CursorPosition | null;
  viewCmd: ViewCommand | null;
  viewCmdSeq: number;
  viewportRect: ViewportRect | null;
  errorMsg: string | null;
}>;

export const viewerState = createStore<ViewerState>({
  file: null,
  docRevision: 0,
  objectCount: 0,
  profileName: null,
  zoomPercent: 100,
  cursor: null,
  viewCmd: null,
  viewCmdSeq: 0,
  viewportRect: null,
  errorMsg: null,
});
