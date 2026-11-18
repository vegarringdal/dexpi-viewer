import type { DiscProfile } from "./discProfile.ts";
import { detectProfileImportPrefix } from "./profileVersion.ts";
import { elementXPath } from "./xml.ts";

// -----------------------------------------------------------------------------
// MDL-010 — profile classes against the SELECTED catalogue
//
// Base-model validation (modelValidation.ts) leaves namespaced extension
// classes out of scope. The DiscProfile classes a document instantiates are
// checked here instead, against whichever catalogue is loaded: a class is
// valid exactly when that release defines it. DiscProfile 0.6.7 removed
// TieInPoint, so a TieInPoint passes against 0.6.6 and is flagged against
// 0.6.7 — the selected profile, not the document, decides.
// -----------------------------------------------------------------------------

/** One finding per class: how often it occurs, plus its first occurrence. */
type Occurrences = { count: number; first: Element };

export type ProfileClassIssue = Readonly<{
  ruleId: "MDL-010";
  severity: "warning";
  message: string;
  objectId: string | null;
  suggestion: string;
  xpath: string;
}>;

/**
 * Profile classes are keyed by the catalogue's own model name
 * ("DiscProfile/InformationModel.TieInPoint"); a document addresses them by
 * its import prefix, which need not match. Comparing the part after the
 * namespace makes the two line up.
 */
function localClassNames(profile: DiscProfile): ReadonlySet<string> {
  return new Set([...profile.classSupers.keys()].map((key) => key.slice(key.indexOf("/") + 1)));
}

/**
 * MDL-010 — every object typed in the document's DiscProfile namespace must
 * be a class the loaded catalogue defines. Silent when no catalogue is loaded
 * (GFX-001 says so) or the document imports no DiscProfile.
 */
export function checkProfileClasses(root: Element, profile: DiscProfile | null): ProfileClassIssue[] {
  const prefix = detectProfileImportPrefix(root);
  if (!profile || !prefix) {
    return [];
  }

  const known = localClassNames(profile);
  const namespace = `${prefix}/`;
  const unknown = new Map<string, Occurrences>();
  for (const el of root.querySelectorAll("Object[type]")) {
    const type = el.getAttribute("type") ?? "";
    if (!type.startsWith(namespace) || known.has(type.slice(namespace.length))) {
      continue;
    }

    const seen = unknown.get(type);
    if (seen) {
      seen.count += 1;
      continue;
    }

    unknown.set(type, { count: 1, first: el });
  }

  const release = profile.version ? `DiscProfile ${profile.version}` : "loaded DISC profile";
  return [...unknown].map(([type, { count, first }]) => ({
    ruleId: "MDL-010",
    severity: "warning",
    message: `Class "${type}" (${String(count)}×) is not defined by the ${release}.`,
    objectId: first.getAttribute("id"),
    suggestion:
      "Load the DiscProfile release the document was authored against, or remodel the object with a class the selected release defines.",
    xpath: elementXPath(first),
  }));
}
