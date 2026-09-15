import { createStore } from "../../lib/createStore.ts";
import type { BundledProfileVersion } from "../../lib/dexpi/profileVersion.ts";
import { bundledProfileName } from "../../lib/dexpi/profileVersion.ts";

/** Which DISC catalogue is currently resolving Profile/SymbolUsage references. */
export type ActiveProfile =
  | Readonly<{ kind: "none" }>
  | Readonly<{ kind: "bundled"; version: BundledProfileVersion }>
  | Readonly<{ kind: "custom"; fileName: string; version: string | null }>;

export type ProfileState = Readonly<{
  active: ActiveProfile;
  /** Set once the user picks a catalogue by hand — autoload then stays out of the way. */
  isPinned: boolean;
  /** Load the catalogue a document declares when it opens (opt-in, persisted). */
  autoLoad: boolean;
  /** Version the loaded document imports, or null when it imports no DiscProfile. */
  declaredVersion: string | null;
}>;

export const NO_PROFILE: ActiveProfile = { kind: "none" };

export const DEFAULT_PROFILE_STATE: ProfileState = {
  active: NO_PROFILE,
  isPinned: false,
  autoLoad: false,
  declaredVersion: null,
};

export const profileState = createStore<ProfileState>(DEFAULT_PROFILE_STATE);

/** Version the active catalogue declares — null when none is loaded, or when
 *  a custom one carries no stamp (a pre-0.6.4 catalogue). */
export function activeProfileVersion(active: ActiveProfile): string | null {
  return active.kind === "none" ? null : active.version;
}

/** Status-bar / ribbon label for the active catalogue, null when none is loaded. */
export function activeProfileLabel(active: ActiveProfile): string | null {
  if (active.kind === "none") {
    return null;
  }

  if (active.kind === "bundled") {
    return bundledProfileName(active.version);
  }

  return active.version ? `${active.fileName} (${active.version})` : active.fileName;
}
