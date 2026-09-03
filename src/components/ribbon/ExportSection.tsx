import { IconFileTypeCsv, IconFileTypePdf, IconFileTypeSvg, IconFileTypeXls } from "@tabler/icons-react";
import { RibbonButton, RibbonSection } from "@tredespace/ui/widgets";
import type { JSX } from "react";
import type { Result } from "../../lib/result.ts";
import { setViewerError } from "../../state/viewer/viewer.actions.ts";
import { viewerState } from "../../state/viewer/viewer.state.ts";
import { exportIssuesCsv, exportIssuesXlsx, exportPdf, exportSvg } from "../exportService.ts";

function reportError(result: Result<void>): void {
  if (result.error) {
    setViewerError(result.error.msg);
  }
}

/** PDF / SVG / validation-report (CSV, Excel) export buttons. */
export function ExportSection(): JSX.Element {
  const { file } = viewerState.use();
  const hasDocument = file !== null;

  const handleExportPdf = (): void => {
    void exportPdf().then(reportError);
  };

  return (
    <RibbonSection title="Export">
      <RibbonButton
        icon={<IconFileTypePdf />}
        label="PDF"
        size="mini"
        disabled={!hasDocument}
        tooltip="Save the drawing as a vector PDF"
        shortcut="export.pdf"
        onClick={handleExportPdf}
      />
      <RibbonButton
        icon={<IconFileTypeSvg />}
        label="SVG"
        size="mini"
        disabled={!hasDocument}
        tooltip="Save the drawing as an SVG vector file"
        shortcut="export.svg"
        onClick={() => reportError(exportSvg())}
      />
      <RibbonButton
        icon={<IconFileTypeCsv />}
        label="CSV"
        size="mini"
        disabled={!hasDocument}
        tooltip="Save the validation findings as CSV"
        shortcut="export.report"
        onClick={() => reportError(exportIssuesCsv())}
      />
      <RibbonButton
        icon={<IconFileTypeXls />}
        label="Excel"
        size="mini"
        disabled={!hasDocument}
        tooltip="Save the validation findings as an Excel workbook (.xlsx)"
        shortcut="export.reportXlsx"
        onClick={() => reportError(exportIssuesXlsx())}
      />
    </RibbonSection>
  );
}
