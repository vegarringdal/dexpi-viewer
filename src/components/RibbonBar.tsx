import { Ribbon } from "@tredespace/ui/widgets";
import type { JSX } from "react";
import { AsViewedExportSection } from "./ribbon/AsViewedExportSection.tsx";
import { ExportSection } from "./ribbon/ExportSection.tsx";
import { FileSection } from "./ribbon/FileSection.tsx";
import { HelpSection } from "./ribbon/HelpSection.tsx";
import { PanelsSection } from "./ribbon/PanelsSection.tsx";
import { ValidationExportSection } from "./ribbon/ValidationExportSection.tsx";
import { ViewSection } from "./ribbon/ViewSection.tsx";

/** The workbench toolbar; lives in the locked, tab-less top dock node. */
export function RibbonBar(): JSX.Element {
  return (
    <Ribbon>
      <FileSection />
      <ViewSection />
      <ExportSection />
      <AsViewedExportSection />
      <ValidationExportSection />
      <PanelsSection />
      <HelpSection />
    </Ribbon>
  );
}
