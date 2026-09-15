import { parseDexpiDocument } from "../../lib/dexpi/parseDocument.ts";
import {
  type BundledProfileVersion,
  detectDeclaredProfileFromText,
  isBundledProfileVersion,
} from "../../lib/dexpi/profileVersion.ts";
import type { DexpiDocument } from "../../lib/dexpi/types.ts";
import { fail, ok, type Result } from "../../lib/result.ts";
import {
  clearProfile,
  getLoadedProfile,
  loadBundledProfile,
  loadCustomProfile,
  setDeclaredProfileVersion,
  storeProfileAutoLoad,
} from "../profile/profile.actions.ts";
import { profileState } from "../profile/profile.state.ts";
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

// -----------------------------------------------------------------------------
// Document handle
//
// The parsed document holds Maps and a large scene graph — a non-serializable
// handle, so it lives here in the actions module (see CLAUDE.md); the store
// carries only docRevision/objectCount, which subscribers key off. The DISC
// profile the document parses against is owned by profile.actions.ts and
// survives across document loads.
// -----------------------------------------------------------------------------

let loadedDocument: DexpiDocument | null = null;

export function getLoadedDocument(): DexpiDocument | null {
  return loadedDocument;
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
      return fail(`Example fetch failed (HTTP ${String(response.status)}).`);
    }

    const text = await response.text();
    return ok({ name: EXAMPLE_NAME, sizeBytes: new Blob([text]).size, text });
  } catch (err) {
    return fail("Could not load the bundled example.", err);
  }
}

/** Parses `file` against the active profile and publishes it to the store. */
function parseLoadedFile(file: LoadedFile): void {
  const parsed = parseDexpiDocument(file.text, getLoadedProfile());
  if (parsed.error || !parsed.data) {
    viewerState.set({ errorMsg: parsed.error?.msg ?? "Unknown parse failure." });
    return;
  }

  loadedDocument = parsed.data;
  clearSelection();
  viewerState.set({
    file,
    docRevision: viewerState.get().docRevision + 1,
    objectCount: parsed.data.objectTypes.size,
    errorMsg: null,
  });
}

/**
 * Brings the active catalogue in line with what `xmlText` imports, before it
 * is parsed. Autoload is opt-in and never overrules a catalogue the user
 * picked by hand; a declared version we do not bundle is left alone too —
 * validation reports that gap (META-003) rather than loading the wrong one.
 */
async function autoLoadDeclaredProfile(xmlText: string): Promise<void> {
  const declared = detectDeclaredProfileFromText(xmlText);
  setDeclaredProfileVersion(declared.version);

  const { autoLoad, isPinned } = profileState.get();
  if (!autoLoad || isPinned || declared.version === null || !isBundledProfileVersion(declared.version)) {
    return;
  }

  const result = await loadBundledProfile(declared.version, false);
  if (result.error) {
    viewerState.set({ errorMsg: result.error.msg });
  }
}

async function applyLoadResult(result: Result<LoadedFile>): Promise<void> {
  if (result.error) {
    viewerState.set({ errorMsg: result.error.msg });
    return;
  }

  if (!result.data) {
    return;
  }

  await autoLoadDeclaredProfile(result.data.text);
  parseLoadedFile(result.data);
}

/**
 * Loads and parses a picked/dropped DEXPI 2.0 XML file. Failures surface
 * through the store's errorMsg — callers just invoke and forget.
 */
export async function openDocumentFile(file: File): Promise<void> {
  await applyLoadResult(await readDocumentFile(file));
}

/** Loads the bundled DEXPI 2.0 example P&ID. */
export async function openExampleDocument(): Promise<void> {
  await applyLoadResult(await fetchExampleDocument());
}

/** Re-parses the currently loaded file (settings that bake into parse output). */
export function reparseCurrentDocument(): void {
  const currentFile = viewerState.get().file;
  if (currentFile) {
    parseLoadedFile(currentFile);
  }
}

// -----------------------------------------------------------------------------
// Profile selection
//
// Choosing a catalogue re-parses the open document against it, so these
// compose profile.actions with the document lifecycle above — profile.actions
// itself stays free of any document knowledge.
// -----------------------------------------------------------------------------

/** Activates a bundled catalogue as the user's pinned choice. */
export async function selectBundledProfile(version: BundledProfileVersion): Promise<void> {
  const result = await loadBundledProfile(version, true);
  if (result.error) {
    viewerState.set({ errorMsg: result.error.msg });
    return;
  }

  viewerState.set({ errorMsg: null });
  reparseCurrentDocument();
}

/**
 * Releases the user's pinned choice so the open document's declared version
 * decides again. With autoload off there is nothing to decide, so the
 * catalogue is simply dropped.
 */
export async function followDeclaredProfile(): Promise<void> {
  clearProfile();
  const currentFile = viewerState.get().file;
  if (!currentFile) {
    return;
  }

  await applyLoadResult(ok(currentFile));
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

  const applied = loadCustomProfile(read.data.name, read.data.text);
  if (applied.error) {
    viewerState.set({ errorMsg: applied.error.msg });
    return;
  }

  viewerState.set({ errorMsg: null });
  reparseCurrentDocument();
}

/** Turns autoload on/off, and lets it act on the open document right away. */
export async function setProfileAutoLoad(autoLoad: boolean): Promise<void> {
  storeProfileAutoLoad(autoLoad);
  const currentFile = viewerState.get().file;
  if (autoLoad && currentFile) {
    await applyLoadResult(ok(currentFile));
  }
}
