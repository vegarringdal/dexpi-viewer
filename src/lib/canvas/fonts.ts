import type { CanvasKit, Typeface } from "canvaskit-wasm";
import carlitoUrl from "../assets/fonts/Carlito-Regular.ttf?url";
import dejavuUrl from "../assets/fonts/DejaVuSans.ttf?url";
import liberationUrl from "../assets/fonts/LiberationSans-Regular.ttf?url";

// -----------------------------------------------------------------------------
// Bundled faces
//
// DEXPI files name fonts we can't ship (Calibri, Verdana, embedded PDF
// subsets like "ITLYHH+Verdana"). Metric-compatible substitutes keep text
// widths right, so labels stay inside their boxes and table cells:
//   Calibri → Carlito (metric-compatible), Verdana/Tahoma → DejaVu Sans,
//   everything else → Liberation Sans (Arial-metric).
// -----------------------------------------------------------------------------

export type FaceKey = "liberation" | "carlito" | "dejavu";

const FACE_URLS: Record<FaceKey, string> = {
  liberation: liberationUrl,
  carlito: carlitoUrl,
  dejavu: dejavuUrl,
};

let fontDataPromise: Promise<Record<FaceKey, ArrayBuffer>> | null = null;

async function fetchFont(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Font fetch failed (HTTP ${response.status}) for ${url}`);
  }

  return response.arrayBuffer();
}

export function loadFontData(): Promise<Record<FaceKey, ArrayBuffer>> {
  if (!fontDataPromise) {
    fontDataPromise = (async () => ({
      liberation: await fetchFont(FACE_URLS.liberation),
      carlito: await fetchFont(FACE_URLS.carlito),
      dejavu: await fetchFont(FACE_URLS.dejavu),
    }))();
  }

  return fontDataPromise;
}

// -----------------------------------------------------------------------------
// Resolution
// -----------------------------------------------------------------------------

export type SceneFonts = Readonly<{
  /** Typeface for a DEXPI font name ("Calibri", "ITLYHH+Verdana", …). */
  resolve: (fontName: string) => Typeface | null;
  dispose: () => void;
}>;

/** Which bundled face substitutes a DEXPI font name (shared with exporters). */
export function faceKeyFor(fontName: string): FaceKey {
  const name = (fontName.split("+").pop() ?? fontName).toLowerCase();
  if (name.includes("calibri") || name.includes("carlito")) {
    return "carlito";
  }

  if (name.includes("verdana") || name.includes("tahoma") || name.includes("dejavu")) {
    return "dejavu";
  }

  return "liberation";
}

/** Builds the typeface set from loaded font data. Call dispose() on unmount. */
export function createSceneFonts(ck: CanvasKit, data: Record<FaceKey, ArrayBuffer>): SceneFonts {
  const faces: Record<FaceKey, Typeface | null> = {
    liberation: ck.Typeface.MakeFreeTypeFaceFromData(data.liberation),
    carlito: ck.Typeface.MakeFreeTypeFaceFromData(data.carlito),
    dejavu: ck.Typeface.MakeFreeTypeFaceFromData(data.dejavu),
  };
  return {
    resolve: (fontName) => faces[faceKeyFor(fontName)] ?? faces.liberation,
    dispose: () => {
      for (const face of Object.values(faces)) {
        face?.delete();
      }
    },
  };
}
