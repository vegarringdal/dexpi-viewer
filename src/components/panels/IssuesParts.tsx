import type { JSX } from "react";
import type { IssueSeverity, ValidationIssue } from "../../lib/dexpi/validation.ts";
import { requestZoomToObject, setSelectedObject } from "../../state/selection/selection.actions.ts";
import { getLoadedDocument } from "../../state/viewer/viewer.actions.ts";

// -----------------------------------------------------------------------------
// Severity chip
// -----------------------------------------------------------------------------

const SEVERITY_STYLES: Readonly<Record<IssueSeverity, string>> = {
  error: "bg-red-950 text-red-300",
  warning: "bg-amber-950 text-amber-300",
  info: "bg-sky-950 text-sky-300",
};

const SEVERITY_LABELS: Readonly<Record<IssueSeverity, string>> = {
  error: "Errors",
  warning: "Warnings",
  info: "Info",
};

export function SeverityChip({
  severity,
  count,
}: Readonly<{ severity: IssueSeverity; count: number }>): JSX.Element {
  return (
    <span className={`rounded px-1.5 py-0.5 font-semibold text-[10px] ${SEVERITY_STYLES[severity]}`}>
      {count} {SEVERITY_LABELS[severity]}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Finding row
// -----------------------------------------------------------------------------

export function IssueRow({ issue }: Readonly<{ issue: ValidationIssue }>): JSX.Element {
  const objectLabel = issue.objectId
    ? (getLoadedDocument()?.plant.byId.get(issue.objectId)?.label ?? issue.objectId)
    : null;

  const handleJump = (): void => {
    if (issue.objectId) {
      setSelectedObject(issue.objectId);
      requestZoomToObject(issue.objectId);
    }
  };

  return (
    <div className="border-slate-800 border-b px-1 py-1.5">
      <div className="flex items-baseline gap-2">
        <span className={`shrink-0 rounded px-1 font-mono text-[10px] ${SEVERITY_STYLES[issue.severity]}`}>
          {issue.severity}
        </span>
        <span className="min-w-0 flex-1 text-slate-300 text-xs">{issue.message}</span>
      </div>
      {issue.suggestion && (
        <div className="mt-0.5 pl-1 text-[11px] text-sky-400">Suggestion: {issue.suggestion}</div>
      )}
      {objectLabel && (
        <button
          type="button"
          onClick={handleJump}
          className="mt-0.5 cursor-pointer pl-1 font-mono text-[11px] text-blue-400 hover:underline"
        >
          ↳ {objectLabel}
        </button>
      )}
    </div>
  );
}
