import { PanelBody, usePanelTitle } from "@tredespace/ui/dockable";
import { Button, Collapsible } from "@tredespace/ui/widgets";
import { type JSX, useState } from "react";
import { type IssueSeverity, RULE_TITLES, type ValidationIssue } from "../../lib/dexpi/validation.ts";
import { getLoadedDocument, setViewerError } from "../../state/viewer/viewer.actions.ts";
import { viewerState } from "../../state/viewer/viewer.state.ts";
import { exportIssuesCsv } from "../exportService.ts";
import { IssueRow, SeverityChip } from "./IssuesParts.tsx";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type SeverityFilter = "all" | IssueSeverity;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function IssuesPanel(): JSX.Element {
  const { file, docRevision } = viewerState.use();
  void docRevision;
  const [filter, setFilter] = useState<SeverityFilter>("all");
  const issues = getLoadedDocument()?.issues ?? [];
  usePanelTitle(file && issues.length > 0 ? `Validation (${issues.length})` : "Validation");

  if (!file) {
    return (
      <PanelBody className="flex h-full items-center justify-center p-4 text-center text-slate-500 text-xs">
        Open a DEXPI file to get started.
      </PanelBody>
    );
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const infos = issues.filter((i) => i.severity === "info").length;
  const visible = issues.filter((i) => filter === "all" || i.severity === filter);

  const groups = new Map<string, ValidationIssue[]>();
  for (const issue of visible) {
    const list = groups.get(issue.ruleId) ?? [];
    list.push(issue);
    groups.set(issue.ruleId, list);
  }

  const handleExportCsv = (): void => {
    const result = exportIssuesCsv();
    if (result.error) {
      setViewerError(result.error.msg);
    }
  };

  const filterChip = (value: SeverityFilter, label: string): JSX.Element => (
    <Button active={filter === value} onClick={() => setFilter(value)}>
      {label}
    </Button>
  );

  return (
    <PanelBody className="flex h-full flex-col gap-2 p-2">
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        <SeverityChip severity="error" count={errors} />
        <SeverityChip severity="warning" count={warnings} />
        <SeverityChip severity="info" count={infos} />
        <span className="mx-1 text-slate-600">·</span>
        {filterChip("all", `All (${issues.length})`)}
        {filterChip("error", "Errors")}
        {filterChip("warning", "Warnings")}
        <div className="ml-auto">
          <Button onClick={handleExportCsv} tooltip="Save the findings as CSV">
            CSV
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {issues.length === 0 && (
          <div className="p-4 text-center text-slate-500 text-xs">No validation issues found.</div>
        )}
        {[...groups.entries()].map(([ruleId, list]) => (
          <Collapsible
            key={ruleId}
            title={`${ruleId} — ${RULE_TITLES[ruleId] ?? "Findings"}`}
            aside={String(list.length)}
            defaultOpen
          >
            {list.map((issue) => (
              <IssueRow key={`${issue.objectId ?? "doc"}-${issue.message}`} issue={issue} />
            ))}
          </Collapsible>
        ))}
      </div>
    </PanelBody>
  );
}
