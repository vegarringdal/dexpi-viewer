import { type DiscProfile, parseDiscProfile } from "../../lib/dexpi/discProfile.ts";
import { parseDexpiDocument } from "../../lib/dexpi/parseDocument.ts";
import type { DexpiDocument } from "../../lib/dexpi/types.ts";
import { fail, ok, type Result } from "../../lib/result.ts";
import { clearSelection } from "../selection/selection.actions.ts";
import {
  type CursorPosition,
  type LoadedFile,
  type ViewCommand,
  type ViewportRect,
  viewerState,
} from "./viewer.state.ts";

const EXAMPLE_URL = "examples/DISC_EXAMPLE-14-13.xml";
const EXAMPLE_NAME = "DISC_EXAMPLE-14-13.xml";
const BUNDLED_PROFILE_URL = "profiles/DiscProfile-0.6.3.xml";
export const BUNDLED_PROFILE_NAME = "DiscProfile 0.6.3";

// -----------------------------------------------------------------------------
// Document & profile handles
//
// The parsed document holds Maps and a large scene graph — a non-serializable
// handle, so it lives here in the actions module (see CLAUDE.md); the store
// carries only docRevision/objectCount, which subscribers key off. The DISC
// profile survives across document loads.
// -----------------------------------------------------------------------------

let loadedDocument: DexpiDocument | null = null;
let loadedProfile: DiscProfile | null = null;

export function getLoadedDocument(): DexpiDocument | null {
  return loadedDocument;
}

export function getLoadedProfile(): DiscProfile | null {
  return loadedProfile;
}

// -----------------------------------------------------------------------------
// Simple setters
// -----------------------------------------------------------------------------

export function setZoomPercent(zoomPercent: number): void {
  viewerState.set({ zoomPercent });
}

export function setCursorPosition(cursor: CursorPosition | null): void {
  viewerState.set({ cursor });
}

export function setViewerError(errorMsg: string | null): void {
  viewerState.set({ errorMsg });
}

export function setViewportRect(viewportRect: ViewportRect): void {
  viewerState.set({ viewportRect });
}

/** Queues a one-shot canvas view command (fit, zoom step, 100%, center). */
export function requestViewCommand(viewCmd: ViewCommand): void {
  viewerState.set({ viewCmd, viewCmdSeq: viewerState.get().viewCmdSeq + 1 });
}

// -----------------------------------------------------------------------------
// Document loading
// -----------------------------------------------------------------------------

async function readDocumentFile(file: File): Promise<Result<LoadedFile>> {
  try {
    const text = await file.text();
    return ok({ name: file.name, sizeBytes: file.size, text });
  } catch (err) {
    return fail(`Could not read "${file.name}".`, err);
  }
}

async function fetchExampleDocument(): Promise<Result<LoadedFile>> {
  try {
    const response = await fetch(EXAMPLE_URL);
    if (!response.ok) {
      return fail(`Example fetch failed (HTTP ${response.status}).`);
    }

    const text = await response.text();
    return ok({ name: EXAMPLE_NAME, sizeBytes: new Blob([text]).size, text });
  } catch (err) {
    return fail("Could not load the bundled example.", err);
  }
}

function applyLoadResult(result: Result<LoadedFile>): void {
  if (result.error) {
    viewerState.set({ errorMsg: result.error.msg });
    return;
  }

  if (!result.data) {
    return;
  }

  const parsed = parseDexpiDocument(result.data.text, loadedProfile);
  if (parsed.error || !parsed.data) {
    viewerState.set({ errorMsg: parsed.error?.msg ?? "Unknown parse failure." });
    return;
  }

  loadedDocument = parsed.data;
  clearSelection();
  viewerState.set({
    file: result.data,
    docRevision: viewerState.get().docRevision + 1,
    objectCount: parsed.data.objectTypes.size,
    errorMsg: null,
  });
}

/**
 * Loads and parses a picked/dropped DEXPI 2.0 XML file. Failures surface
 * through the store's errorMsg — callers just invoke and forget.
 */
export async function openDocumentFile(file: File): Promise<void> {
  applyLoadResult(await readDocumentFile(file));
}

/** Loads the bundled DEXPI 2.0 example P&ID. */
export async function openExampleDocument(): Promise<void> {
  applyLoadResult(await fetchExampleDocument());
}

/** Re-parses the currently loaded file (settings that bake into parse output). */
export function reparseCurrentDocument(): void {
  const currentFile = viewerState.get().file;
  if (currentFile) {
    applyLoadResult(ok(currentFile));
  }
}

function applyProfile(xmlText: string, profileName: string): void {
  const parsed = parseDiscProfile(xmlText);
  if (parsed.error || !parsed.data) {
    viewerState.set({ errorMsg: parsed.error?.msg ?? "Could not parse the profile." });
    return;
  }

  loadedProfile = parsed.data;
  viewerState.set({ profileName, errorMsg: null });

  const currentFile = viewerState.get().file;
  if (currentFile) {
    applyLoadResult(ok(currentFile));
  }
}

/**
 * Loads a custom DISC profile (DiscProfile.xml) and re-parses the current
 * document against it so Profile/SymbolUsage references resolve. The profile
 * stays active for every document opened afterwards.
 */
export async function openProfileFile(file: File): Promise<void> {
  const read = await readDocumentFile(file);
  if (read.error || !read.data) {
    viewerState.set({ errorMsg: read.error?.msg ?? "Could not read the profile." });
    return;
  }

  applyProfile(read.data.text, file.name);
}

/** Loads the bundled official DISC Profile 0.6.3 catalogue. */
export async function openBundledProfile(): Promise<void> {
  try {
    const response = await fetch(BUNDLED_PROFILE_URL);
    if (!response.ok) {
      viewerState.set({ errorMsg: `Profile fetch failed (HTTP ${response.status}).` });
      return;
    }

    applyProfile(await response.text(), BUNDLED_PROFILE_NAME);
  } catch {
    viewerState.set({ errorMsg: "Could not load the bundled DISC profile." });
  }
}
