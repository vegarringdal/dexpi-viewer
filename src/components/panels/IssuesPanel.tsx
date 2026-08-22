import { PanelBody, usePanelTitle } from "@tredespace/ui/dockable";
import { Collapsible } from "@tredespace/ui/widgets";
import { type JSX, useState } from "react";
import {
  applySeverityOverrides,
  categoryOfRule,
  RULE_TITLES,
  type ValidationIssue,
} from "../../lib/dexpi/validation.ts";
import { validationConfigState } from "../../state/validation/validation.state.ts";
import { getLoadedDocument, setViewerError } from "../../state/viewer/viewer.actions.ts";
import { viewerState } from "../../state/viewer/viewer.state.ts";
import { exportIssuesCsv } from "../exportService.ts";
import { IssueRow } from "./IssuesParts.tsx";
import { type CategoryFilter, IssuesToolbar, type SeverityFilter } from "./IssuesToolbar.tsx";
import { RuleSeverityConfig } from "./RuleSeverityConfig.tsx";

export function IssuesPanel(): JSX.Element {
  const { file, docRevision } = viewerState.use();
  void docRevision;
  const { overrides } = validationConfigState.use();
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [isConfigOpen, setConfigOpen] = useState(false);
  // Collapsible is uncontrolled; bumping `seq` remounts the groups with a
  // fresh defaultOpen, which is how expand/collapse-all works.
  const [groupsOpen, setGroupsOpen] = useState({ open: true, seq: 0 });
  const issues = applySeverityOverrides(getLoadedDocument()?.issues ?? [], overrides);
  usePanelTitle(file && issues.length > 0 ? `Validation (${issues.length})` : "Validation");

  if (!file) {
    return (
      <PanelBody className="flex h-full items-center justify-center p-4 text-center text-slate-500 text-xs">
        Open a DEXPI file to get started.
      </PanelBody>
    );
  }

  const inCategory = issues.filter(
    (i) => categoryFilter === "all" || categoryOfRule(i.ruleId) === categoryFilter,
  );
  const visible = inCategory.filter((i) => severityFilter === "all" || i.severity === severityFilter);
  const severityCounts = {
    all: inCategory.length,
    error: inCategory.filter((i) => i.severity === "error").length,
    warning: inCategory.filter((i) => i.severity === "warning").length,
    info: inCategory.filter((i) => i.severity === "info").length,
  };

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

  return (
    <PanelBody className="flex h-full flex-col gap-2 p-2">
      <IssuesToolbar
        severityFilter={severityFilter}
        onSeverityFilter={setSeverityFilter}
        severityCounts={severityCounts}
        categoryFilter={categoryFilter}
        onCategoryFilter={setCategoryFilter}
        isConfigOpen={isConfigOpen}
        onToggleConfig={() => setConfigOpen((open) => !open)}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
        onExportCsv={handleExportCsv}
      />
      <div className="min-h-0 flex-1 overflow-auto">
        {isConfigOpen && <RuleSeverityConfig />}
        {!isConfigOpen && issues.length === 0 && (
          <div className="p-4 text-center text-slate-500 text-xs">No validation issues found.</div>
        )}
        {!isConfigOpen &&
          [...groups.entries()].map(([ruleId, list]) => (
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
