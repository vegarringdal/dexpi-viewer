import { IconAdjustments, IconChevronsDown, IconChevronsUp } from "@tabler/icons-react";
import { Button, Select, type SelectOption } from "@tredespace/ui/widgets";
import type { JSX } from "react";
import { CATEGORY_LABELS, type IssueSeverity, type ValidationCategory } from "../../lib/dexpi/validation.ts";
import { SeverityDot } from "./IssuesParts.tsx";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type SeverityFilter = "all" | IssueSeverity;

export type CategoryFilter = "all" | ValidationCategory;

type IssuesToolbarProps = Readonly<{
  severityFilter: SeverityFilter;
  onSeverityFilter: (filter: SeverityFilter) => void;
  severityCounts: Readonly<Record<SeverityFilter, number>>;
  categoryFilter: CategoryFilter;
  onCategoryFilter: (filter: CategoryFilter) => void;
  isConfigOpen: boolean;
  onToggleConfig: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onExportCsv: () => void;
  onExportXlsx: () => void;
}>;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const SEVERITY_BUTTON_LABELS: Readonly<Record<IssueSeverity, string>> = {
  error: "Errors",
  warning: "Warnings",
  info: "Info",
};

const CATEGORY_OPTIONS: readonly SelectOption[] = [
  { value: "all", label: "All categories" },
  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
];

// -----------------------------------------------------------------------------
// Helper functions
// -----------------------------------------------------------------------------

function isCategoryFilter(value: string | null): value is CategoryFilter {
  return value === "all" || (value !== null && value in CATEGORY_LABELS);
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/** Filter row of the Validation panel: severity buttons, category select, actions. */
export function IssuesToolbar(props: IssuesToolbarProps): JSX.Element {
  const {
    severityFilter,
    onSeverityFilter,
    severityCounts,
    categoryFilter,
    onCategoryFilter,
    isConfigOpen,
    onToggleConfig,
    onExpandAll,
    onCollapseAll,
    onExportCsv,
    onExportXlsx,
  } = props;

  const filterButton = (value: SeverityFilter): JSX.Element => (
    <Button active={severityFilter === value} onClick={() => onSeverityFilter(value)}>
      {value !== "all" && <SeverityDot severity={value} />}
      {value === "all" ? "All" : SEVERITY_BUTTON_LABELS[value]} ({severityCounts[value]})
    </Button>
  );

  return (
    <div className="flex shrink-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1">
        {filterButton("all")}
        {filterButton("error")}
        {filterButton("warning")}
        {filterButton("info")}
        <div className="ml-auto flex items-center gap-1">
          <Button iconOnly icon={<IconChevronsDown />} tooltip="Expand all groups" onClick={onExpandAll} />
          <Button iconOnly icon={<IconChevronsUp />} tooltip="Collapse all groups" onClick={onCollapseAll} />
          <Button onClick={onExportCsv} tooltip="Save the findings as CSV">
            CSV
          </Button>
          <Button onClick={onExportXlsx} tooltip="Save the findings as an Excel workbook (.xlsx)">
            Excel
          </Button>
          <Button
            iconOnly
            active={isConfigOpen}
            icon={<IconAdjustments />}
            tooltip="Configure rule severities"
            onClick={onToggleConfig}
          />
        </div>
      </div>
      <Select
        value={categoryFilter}
        options={[...CATEGORY_OPTIONS]}
        onChange={(value) => onCategoryFilter(isCategoryFilter(value) ? value : "all")}
      />
    </div>
  );
}
