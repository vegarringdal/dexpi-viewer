// -----------------------------------------------------------------------------
// DiscProfile versions
//
// DiscProfile 0.6.4 is the first release to stamp itself: the model carries
// `<Data property="MetaData/version">` and a version-qualified `Model/@uri`
// ("http://www.to.define/DiscProfile/0.6.4"), and drawings written against it
// import that same qualified URI. Everything before it used the bare
// "http://www.to.define", so an unstamped file means "pre-0.6.4" rather than
// "unknown" — PRE_STAMP_VERSION names the release we treat that as.
//
// The numbering skips 0.6.5: upstream went straight from 0.6.4 to 0.6.6, so
// no document can legitimately declare it.
// -----------------------------------------------------------------------------

/** The version an unstamped DiscProfile model/import is taken to mean. */
export const PRE_STAMP_VERSION = "0.6.3";

/** Bundled catalogues, newest first — the version picker's option order. */
export const BUNDLED_PROFILE_VERSIONS = ["0.6.6", "0.6.4", "0.6.3"] as const;

export type BundledProfileVersion = (typeof BUNDLED_PROFILE_VERSIONS)[number];

/** The newest bundled catalogue — what the ribbon's profile hotkey loads. */
export const LATEST_BUNDLED_PROFILE: BundledProfileVersion = "0.6.6";

export function isBundledProfileVersion(value: string): value is BundledProfileVersion {
  return BUNDLED_PROFILE_VERSIONS.some((v) => v === value);
}

/** Public URL of a bundled catalogue, relative to the app's base. */
export function bundledProfileUrl(version: BundledProfileVersion): string {
  return `profiles/DiscProfile-${version}.xml`;
}

/** Display name for a profile of `version` ("DiscProfile 0.6.4"). */
export function bundledProfileName(version: BundledProfileVersion): string {
  return `DiscProfile ${version}`;
}

/**
 * A DiscProfile URI's trailing version — "http://www.to.define/DiscProfile/
 * 0.6.4" → "0.6.4". The unversioned spellings the profile and its feature-
 * level files used before 0.6.4 yield null.
 */
const PROFILE_URI_VERSION = /\/DiscProfile(?:_FL\d+)?\/(\d+(?:\.\d+)+)\/?$/;

function versionFromUri(uri: string): string | null {
  return PROFILE_URI_VERSION.exec(uri.trim())?.[1] ?? null;
}

/**
 * The version a DiscProfile.xml declares: its `MetaData/version` stamp, else
 * the version its `Model/@uri` carries, else null for a pre-0.6.4 catalogue.
 */
export function detectProfileFileVersion(modelEl: Element, stampedVersion: string): string | null {
  const stamped = stampedVersion.trim();
  if (stamped) {
    return stamped;
  }

  return versionFromUri(modelEl.getAttribute("uri") ?? "");
}

/** What a document says about the DiscProfile it was authored against. */
export type DeclaredProfile = Readonly<{
  /** True when the document imports DiscProfile at all. */
  isImported: boolean;
  /** The imported version — PRE_STAMP_VERSION for an unversioned import. */
  version: string | null;
}>;

const NO_DECLARED_PROFILE: DeclaredProfile = { isImported: false, version: null };

type ImportDecl = Readonly<{ prefix: string; source: string }>;

/**
 * The DiscProfile import among `imports`. A document importing the
 * unversioned URI is reported as PRE_STAMP_VERSION, so callers get a concrete
 * version to work with for the whole pre-0.6.4 corpus; a document with no
 * DiscProfile import at all needs no profile and says so.
 */
function declaredProfileOf(imports: Iterable<ImportDecl>): DeclaredProfile {
  for (const { prefix, source } of imports) {
    if (prefix !== "DiscProfile" && !source.includes("DiscProfile")) {
      continue;
    }

    return { isImported: true, version: versionFromUri(source) ?? PRE_STAMP_VERSION };
  }
  return NO_DECLARED_PROFILE;
}

/** The DiscProfile version a parsed document declares. */
export function detectDeclaredProfile(root: Element): DeclaredProfile {
  return declaredProfileOf(
    [...root.querySelectorAll("Import")].map((imp) => ({
      prefix: imp.getAttribute("prefix") ?? "",
      source: imp.getAttribute("source") ?? "",
    })),
  );
}

/** How far into an unparsed document to look for Imports when it holds no Object. */
const PROLOGUE_SCAN_LIMIT = 8192;

const IMPORT_TAG = /<Import\b[^>]*>/g;
const PREFIX_ATTRIBUTE = /\bprefix\s*=\s*"([^"]*)"/;
const SOURCE_ATTRIBUTE = /\bsource\s*=\s*"([^"]*)"/;

/**
 * The declared version read from a document's PROLOGUE — the text before its
 * first Object, where DEXPI puts the Imports — rather than from a DOM. The
 * profile has to be chosen BEFORE the document is parsed against it, and
 * parsing a multi-megabyte drawing twice to learn one URI is not worth it.
 */
export function detectDeclaredProfileFromText(xmlText: string): DeclaredProfile {
  const firstObject = xmlText.indexOf("<Object");
  const end = firstObject === -1 ? Math.min(xmlText.length, PROLOGUE_SCAN_LIMIT) : firstObject;
  const imports: ImportDecl[] = [];
  for (const [tag] of xmlText.slice(0, end).matchAll(IMPORT_TAG)) {
    imports.push({
      prefix: PREFIX_ATTRIBUTE.exec(tag)?.[1] ?? "",
      source: SOURCE_ATTRIBUTE.exec(tag)?.[1] ?? "",
    });
  }
  return declaredProfileOf(imports);
}
