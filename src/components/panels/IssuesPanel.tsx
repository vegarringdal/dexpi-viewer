import { IconChevronsDown, IconChevronsUp } from "@tabler/icons-react";
import { PanelBody, usePanelTitle } from "@tredespace/ui/dockable";
import { Button, Collapsible } from "@tredespace/ui/widgets";
import { type JSX, useState } from "react";
import { type IssueSeverity, RULE_TITLES, type ValidationIssue } from "../../lib/dexpi/validation.ts";
import { getLoadedDocument, setViewerError } from "../../state/viewer/viewer.actions.ts";
import { viewerState } from "../../state/viewer/viewer.state.ts";
import { exportIssuesCsv } from "../exportService.ts";
import { IssueRow, SeverityDot } from "./IssuesParts.tsx";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type SeverityFilter = "all" | IssueSeverity;

const SEVERITY_BUTTON_LABELS: Readonly<Record<IssueSeverity, string>> = {
  error: "Errors",
  warning: "Warnings",
  info: "Info",
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function IssuesPanel(): JSX.Element {
  const { file, docRevision } = viewerState.use();
  void docRevision;
  const [filter, setFilter] = useState<SeverityFilter>("all");
  // Collapsible is uncontrolled; bumping `seq` remounts the groups with a
  // fresh defaultOpen, which is how expand/collapse-all works.
  const [groupsOpen, setGroupsOpen] = useState({ open: true, seq: 0 });
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

  const handleExpandAll = (): void => setGroupsOpen((p) => ({ open: true, seq: p.seq + 1 }));
  const handleCollapseAll = (): void => setGroupsOpen((p) => ({ open: false, seq: p.seq + 1 }));

  const filterButton = (value: SeverityFilter, count: number): JSX.Element => (
    <Button active={filter === value} onClick={() => setFilter(value)}>
      {value !== "all" && <SeverityDot severity={value} />}
      {value === "all" ? "All" : SEVERITY_BUTTON_LABELS[value]} ({count})
    </Button>
  );

  return (
    <PanelBody className="flex h-full flex-col gap-2 p-2">
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        {filterButton("all", issues.length)}
        {filterButton("error", errors)}
        {filterButton("warning", warnings)}
        {filterButton("info", infos)}
        <div className="ml-auto flex items-center gap-1">
          <Button
            iconOnly
            icon={<IconChevronsDown />}
            tooltip="Expand all groups"
            onClick={handleExpandAll}
          />
          <Button
            iconOnly
            icon={<IconChevronsUp />}
            tooltip="Collapse all groups"
            onClick={handleCollapseAll}
          />
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
            key={`${ruleId}-${groupsOpen.seq}`}
            title={`${ruleId} — ${RULE_TITLES[ruleId] ?? "Findings"}`}
            aside={String(list.length)}
            defaultOpen={groupsOpen.open}
          >
            {list.map((issue, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the list is static per document, and identical owner+message pairs exist in real files — the index disambiguates.
              <IssueRow key={`${issue.objectId ?? "doc"}-${index}`} issue={issue} />
            ))}
          </Collapsible>
        ))}
      </div>
    </PanelBody>
  );
}
