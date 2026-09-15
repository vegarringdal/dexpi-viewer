import { type DiscProfile, parseDiscProfile } from "../../lib/dexpi/discProfile.ts";
import { type BundledProfileVersion, bundledProfileUrl } from "../../lib/dexpi/profileVersion.ts";
import { fail, ok, type Result } from "../../lib/result.ts";
import { DEFAULT_PROFILE_STATE, NO_PROFILE, type ProfileState, profileState } from "./profile.state.ts";

// -----------------------------------------------------------------------------
// DISC profile catalogue
//
// The parsed catalogue holds Maps of symbols and primitives — a
// non-serializable handle, so it lives here rather than in the store (see
// CLAUDE.md); the store carries only what the UI renders. The catalogue
// survives document loads, and everything that re-parses a document against
// it is the viewer's job (viewer.actions.ts) — this module never reaches back
// into the document lifecycle.
// -----------------------------------------------------------------------------

const PROFILE_STORAGE_KEY = "dexpi.profile";

let loadedProfile: DiscProfile | null = null;

export function getLoadedProfile(): DiscProfile | null {
  return loadedProfile;
}

// -----------------------------------------------------------------------------
// Preferences
// -----------------------------------------------------------------------------

function persist(): void {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ autoLoad: profileState.get().autoLoad }));
}

/** Call once at startup; ignores missing/corrupt stored settings. */
export function applyStoredProfileSettings(): void {
  const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return;
    }

    const candidate: Partial<Record<keyof ProfileState, unknown>> = parsed;
    profileState.set({
      autoLoad: typeof candidate.autoLoad === "boolean" ? candidate.autoLoad : DEFAULT_PROFILE_STATE.autoLoad,
    });
  } catch {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
  }
}

/** Stores the autoload preference; re-evaluating the open document is the viewer's job. */
export function storeProfileAutoLoad(autoLoad: boolean): void {
  profileState.set({ autoLoad });
  persist();
}

/** The profile version the open document declares (null = it imports none). */
export function setDeclaredProfileVersion(declaredVersion: string | null): void {
  profileState.set({ declaredVersion });
}

// -----------------------------------------------------------------------------
// Loading
// -----------------------------------------------------------------------------

function applyCatalogue(xmlText: string): Result<DiscProfile> {
  const parsed = parseDiscProfile(xmlText);
  if (parsed.error || !parsed.data) {
    return fail(parsed.error?.msg ?? "Could not parse the profile.");
  }

  loadedProfile = parsed.data;
  return ok(parsed.data);
}

/**
 * Fetches and activates a bundled catalogue. `isPinned` marks a choice the
 * user made by hand, which autoload must not overrule; autoload itself passes
 * false. Re-selecting the active version only moves that flag — re-parsing
 * 6 MB of XML to arrive at the same catalogue would stall the UI for nothing.
 */
export async function loadBundledProfile(
  version: BundledProfileVersion,
  isPinned: boolean,
): Promise<Result<void>> {
  const { active } = profileState.get();
  if (loadedProfile && active.kind === "bundled" && active.version === version) {
    profileState.set({ isPinned });
    return ok(undefined);
  }

  let xmlText: string;
  try {
    const response = await fetch(bundledProfileUrl(version));
    if (!response.ok) {
      return fail(`Profile fetch failed (HTTP ${String(response.status)}).`);
    }

    xmlText = await response.text();
  } catch (err) {
    return fail(`Could not load the bundled DISC Profile ${version}.`, err);
  }

  const applied = applyCatalogue(xmlText);
  if (applied.error) {
    return fail(applied.error.msg, applied.error.err);
  }

  profileState.set({ active: { kind: "bundled", version }, isPinned });
  return ok(undefined);
}

/** Activates a user-supplied DiscProfile.xml; always counts as a pinned choice. */
export function loadCustomProfile(fileName: string, xmlText: string): Result<void> {
  const applied = applyCatalogue(xmlText);
  if (applied.error || !applied.data) {
    return fail(applied.error?.msg ?? "Could not parse the profile.");
  }

  profileState.set({
    active: { kind: "custom", fileName, version: applied.data.version },
    isPinned: true,
  });
  return ok(undefined);
}

/** Drops the active catalogue and unpins, so autoload owns the choice again. */
export function clearProfile(): void {
  loadedProfile = null;
  profileState.set({ active: NO_PROFILE, isPinned: false });
}
