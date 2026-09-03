import { IconFileTypePdf, IconFileTypeSvg } from "@tabler/icons-react";
import { RibbonButton, RibbonSection } from "@tredespace/ui/widgets";
import type { JSX } from "react";
import { viewerState } from "../../state/viewer/viewer.state.ts";
import { exportPdf, exportSvg } from "../exportService.ts";
import { reportExportError } from "./exportError.ts";

/** The drawing as authored: file colors, no overlays. */
export function ExportSection(): JSX.Element {
  const { file } = viewerState.use();
  const hasDocument = file !== null;

  const handleExportPdf = (): void => {
    void exportPdf().then(reportExportError);
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
        onClick={() => reportExportError(exportSvg())}
      />
    </RibbonSection>
  );
}
