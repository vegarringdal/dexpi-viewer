import { sceneToSvg } from "../lib/dexpi/exportSvg.ts";
import type { DexpiDocument } from "../lib/dexpi/types.ts";
import { downloadBlob } from "../lib/download.ts";
import { fail, ok, type Result } from "../lib/result.ts";
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

/** Writes the validation findings as a CSV report. */
export function exportIssuesCsv(): Result<void> {
  const docResult = requireDocument();
  if (!docResult.data) {
    return fail(docResult.error?.msg ?? "No document loaded.");
  }

  const escapeCell = (value: string): string => `"${value.replaceAll('"', '""')}"`;
  const rows = [
    "rule,severity,objectId,message",
    ...docResult.data.issues.map((issue) =>
      [issue.ruleId, issue.severity, issue.objectId ?? "", escapeCell(issue.message)].join(","),
    ),
  ];
  downloadBlob(rows.join("\n"), `${baseName()}-validation.csv`, "text/csv");
  return ok(undefined);
}
