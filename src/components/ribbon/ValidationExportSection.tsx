import { IconFileTypeCsv, IconFileTypeXls } from "@tabler/icons-react";
import { RibbonButton, RibbonSection } from "@tredespace/ui/widgets";
import type { JSX } from "react";
import { viewerState } from "../../state/viewer/viewer.state.ts";
import { exportIssuesCsv, exportIssuesXlsx } from "../exportService.ts";
import { reportExportError } from "./exportError.ts";

/** The validation findings as a report file. */
export function ValidationExportSection(): JSX.Element {
  const { file } = viewerState.use();
  const hasDocument = file !== null;

  return (
    <RibbonSection title="Validation">
      <RibbonButton
        icon={<IconFileTypeXls />}
        label="Excel"
        size="mini"
        disabled={!hasDocument}
        tooltip="Save the validation findings as an Excel workbook (.xlsx)"
        shortcut="export.reportXlsx"
        onClick={() => reportExportError(exportIssuesXlsx())}
      />
      <RibbonButton
        icon={<IconFileTypeCsv />}
        label="CSV"
        size="mini"
        disabled={!hasDocument}
        tooltip="Save the validation findings as CSV"
        shortcut="export.report"
        onClick={() => reportExportError(exportIssuesCsv())}
      />
    </RibbonSection>
  );
}
