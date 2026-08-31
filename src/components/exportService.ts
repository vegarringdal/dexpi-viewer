import { sceneToSvg } from "../lib/dexpi/exportSvg.ts";
import { elementXPath } from "../lib/dexpi/plantModel.ts";
import type { DexpiDocument } from "../lib/dexpi/types.ts";
import { categoryOfRule, type ValidationIssue } from "../lib/dexpi/validation.ts";
import { downloadBlob } from "../lib/download.ts";
import { fail, ok, type Result } from "../lib/result.ts";
import { getEffectiveIssues } from "../state/validation/validation.actions.ts";
import { getLoadedDocument } from "../state/viewer/viewer.actions.ts";
import { viewerState } from "../state/viewer/viewer.state.ts";
import { sceneToPdf } from "./exportPdf.ts";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function requireDocument(): Result<DexpiDocument> {
  const doc = getLoadedDocument();
  return doc ? ok(doc) : fail("No document loaded.");
}

function baseName(): string {
  const name = viewerState.get().file?.name ?? "dexpi-drawing";
  return name.replace(/\.xml$/i, "");
}

/**
 * Source-line number for every `<Object id="…">` in the raw XML text, keyed
 * by id. A DOMParser'd `Element` carries no position info, so this is a
 * separate scan over the ORIGINAL file text (not a re-serialization of the
 * parsed DOM, which could reformat and drop the correspondence) — a simple
 * one-time regex scan is plenty for a CSV export click. `id`/`type` order
 * and any attribute-spanning-multiple-lines formatting are both tolerated;
 * the line reported is where the `<Object` tag itself starts.
 */
function buildLineNumberIndex(xmlText: string): ReadonlyMap<string, number> {
  const index = new Map<string, number>();
  const objectTagRe = /<Object\b[^>]*\bid="([^"]+)"[^>]*>/g;
  for (const match of xmlText.matchAll(objectTagRe)) {
    const id = match[1];
    if (id && !index.has(id)) {
      index.set(id, xmlText.slice(0, match.index).split("\n").length);
    }
  }
  return index;
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

/**
 * The full CSV report body (header + one row per issue), including the
 * source line number and an XPath locator for the offending object —
 * pure and exported for direct testing, separate from the DOM-download
 * side effect in `exportIssuesCsv`.
 */
export function buildIssuesCsv(issues: readonly ValidationIssue[], root: Element, xmlText: string): string {
  const lineByObjectId = buildLineNumberIndex(xmlText);
  const elementsById = new Map<string, Element>();
  for (const el of root.querySelectorAll("Object[id]")) {
    const id = el.getAttribute("id");
    if (id) {
      elementsById.set(id, el);
    }
  }

  const rows = [
    "rule,category,severity,objectId,line,xpath,message",
    ...issues.map((issue) => {
      const el = issue.objectId ? elementsById.get(issue.objectId) : undefined;
      const line = issue.objectId ? (lineByObjectId.get(issue.objectId) ?? "") : "";
      const xpath = el ? elementXPath(el) : "";
      return [
        issue.ruleId,
        categoryOfRule(issue.ruleId),
        issue.severity,
        issue.objectId ?? "",
        line,
        csvCell(xpath),
        csvCell(issue.message),
      ].join(",");
    }),
  ];
  return rows.join("\n");
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

/** Renders the drawing as a vector PDF (embedded metric-compatible fonts). */
export async function exportPdf(): Promise<Result<void>> {
  const docResult = requireDocument();
  if (!docResult.data) {
    return fail(docResult.error?.msg ?? "No document loaded.");
  }

  try {
    const bytes = await sceneToPdf(docResult.data.scene);
    downloadBlob(bytes.slice(), `${baseName()}.pdf`, "application/pdf");
    return ok(undefined);
  } catch (err) {
    return fail("PDF export failed.", err);
  }
}

/** Writes the scene graph as a standalone SVG file. */
export function exportSvg(): Result<void> {
  const docResult = requireDocument();
  if (!docResult.data) {
    return fail(docResult.error?.msg ?? "No document loaded.");
  }

  downloadBlob(sceneToSvg(docResult.data.scene), `${baseName()}.svg`, "image/svg+xml");
  return ok(undefined);
}

/** Writes the validation findings (severity overrides applied) as a CSV report. */
export function exportIssuesCsv(): Result<void> {
  const docResult = requireDocument();
  if (!docResult.data) {
    return fail(docResult.error?.msg ?? "No document loaded.");
  }

  const xmlText = viewerState.get().file?.text ?? "";
  const csv = buildIssuesCsv(getEffectiveIssues(), docResult.data.root, xmlText);
  downloadBlob(csv, `${baseName()}-validation.csv`, "text/csv");
  return ok(undefined);
}
