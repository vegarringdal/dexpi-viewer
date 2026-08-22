import { META_MODEL_2_0 } from "../generated/metaModel-2.0.ts";

// -----------------------------------------------------------------------------
// Versioned DEXPI information models
//
// A document declares which model version it was written against in its
// <Import source="https://data.dexpi.org/models/2.0.0/Core.xml"> URIs.
// Validation resolves the matching generated model here; a version we have
// no tables for falls back to the closest available one and says so, so a
// future 2.1 file is never silently judged by 2.0 rules. Adding a version =
// run scripts/generateMetaModel.mjs on its XMI and register it below.
// -----------------------------------------------------------------------------

export type MetaPropertyKind =
  | "string"
  | "integer"
  | "double"
  | "boolean"
  | "datetime"
  | "anyuri"
  | "quantity"
  | "multilanguage"
  | "enum"
  | "reference"
  | "composition"
  | "unknown";

export type MetaProperty = Readonly<{
  name: string;
  kind: MetaPropertyKind;
  /** Qualified enum name (kind "enum") or target class (reference/composition). */
  target?: string;
  lower: number;
  /** null = unbounded. */
  upper: number | null;
}>;

export type MetaClass = Readonly<{
  isAbstract: boolean;
  superTypes: readonly string[];
  properties: readonly MetaProperty[];
}>;

export type MetaModel = Readonly<{
  /** "major.minor", e.g. "2.0". */
  version: string;
  /** Top-level model names — an Object type outside these is not base-model. */
  topModels: readonly string[];
  /** Qualified DataType names — XML value objects use them as Object types. */
  datatypes: readonly string[];
  enums: Readonly<Record<string, readonly string[]>>;
  classes: Readonly<Record<string, MetaClass>>;
}>;

/** Registered models, newest first. */
const META_MODELS: readonly MetaModel[] = [META_MODEL_2_0];

export type ResolvedMetaModel = Readonly<{
  model: MetaModel;
  /** "major.minor" the document declares via its Import URIs, if any. */
  declaredVersion: string | null;
  /** False when the declared version has no registered tables (fallback). */
  isExactMatch: boolean;
}>;

const MODEL_URI_VERSION = /data\.dexpi\.org\/models\/(\d+)\.(\d+)(?:\.\d+)?\//;

/** The "major.minor" model version a document's Import URIs declare. */
export function detectDeclaredVersion(root: Element): string | null {
  for (const imp of root.querySelectorAll("Import")) {
    const match = MODEL_URI_VERSION.exec(imp.getAttribute("source") ?? "");
    if (match) {
      return `${match[1]}.${match[2]}`;
    }
  }
  return null;
}

/**
 * The model to validate `root` against: the declared version's tables when
 * registered, else the newest available (isExactMatch false — the caller
 * reports the mismatch instead of silently judging by the wrong rules).
 * A document declaring nothing gets the newest model as an exact match, the
 * de-facto stance for the current corpus (real files omit Imports entirely).
 */
export function resolveMetaModel(root: Element): ResolvedMetaModel {
  const declaredVersion = detectDeclaredVersion(root);
  const fallback = META_MODELS[0];
  if (!fallback) {
    throw new Error("no meta models registered");
  }

  if (declaredVersion === null) {
    return { model: fallback, declaredVersion, isExactMatch: true };
  }

  const exact = META_MODELS.find((m) => m.version === declaredVersion);
  return {
    model: exact ?? fallback,
    declaredVersion,
    isExactMatch: exact !== undefined,
  };
}
