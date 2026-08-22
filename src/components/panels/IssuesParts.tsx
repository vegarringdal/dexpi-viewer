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

const SEVERITY_DOT_STYLES: Readonly<Record<IssueSeverity, string>> = {
  error: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
};

/** Small severity color swatch used inside the filter buttons. */
export function SeverityDot({ severity }: Readonly<{ severity: IssueSeverity }>): JSX.Element {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT_STYLES[severity]}`} />;
}

// -----------------------------------------------------------------------------
// Finding row
// -----------------------------------------------------------------------------

export function IssueRow({
  issue,
  showRuleId = false,
  hideObjectLink = false,
}: Readonly<{
  issue: ValidationIssue;
  /** Prefix the rule id — for contexts without the per-rule group header. */
  showRuleId?: boolean;
  /** Skip the jump link — for contexts already scoped to the object. */
  hideObjectLink?: boolean;
}>): JSX.Element {
  const objectLabel =
    issue.objectId && !hideObjectLink
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
        {showRuleId && <span className="shrink-0 font-mono text-[10px] text-slate-500">{issue.ruleId}</span>}
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
