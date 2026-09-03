import { IconFileTypePdf, IconFileTypeSvg } from "@tabler/icons-react";
import { RibbonButton, RibbonSection } from "@tredespace/ui/widgets";
import type { JSX } from "react";
import { viewerState } from "../../state/viewer/viewer.state.ts";
import { exportPdfAsViewed, exportSvgAsViewed } from "../asViewedExport.ts";
import { reportExportError } from "./exportError.ts";

const TOOLTIP = [
  "Save the drawing exactly as shown:",
  "black & white, highlight colors and the underlay.",
  "Selection is not included.",
  "Always exported light (on white paper) —",
  "the dark theme changes nothing.",
].join("\n");

/** The drawing as currently shown: B/W, highlight tints, trace and underlay. */
export function AsViewedExportSection(): JSX.Element {
  const { file } = viewerState.use();
  const hasDocument = file !== null;

  const handleExportPdf = (): void => {
    void exportPdfAsViewed().then(reportExportError);
  };

  const handleExportSvg = (): void => {
    void exportSvgAsViewed().then(reportExportError);
  };

  return (
    <RibbonSection title="As viewed">
      <RibbonButton
        icon={<IconFileTypePdf />}
        label="PDF"
        size="mini"
        disabled={!hasDocument}
        tooltip={`${TOOLTIP}\n(PDF)`}
        shortcut="export.pdfAsViewed"
        onClick={handleExportPdf}
      />
      <RibbonButton
        icon={<IconFileTypeSvg />}
        label="SVG"
        size="mini"
        disabled={!hasDocument}
        tooltip={`${TOOLTIP}\n(SVG)`}
        shortcut="export.svgAsViewed"
        onClick={handleExportSvg}
      />
    </RibbonSection>
  );
}
