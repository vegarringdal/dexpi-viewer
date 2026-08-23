import {
  IconContrast,
  IconFocusCentered,
  IconMoon,
  IconSun,
  IconZoomIn,
  IconZoomOut,
  IconZoomReset,
} from "@tabler/icons-react";
import { RibbonButton, RibbonSection } from "@tredespace/ui/widgets";
import type { JSX } from "react";
import { setHighlightMonochrome } from "../../state/highlight/highlight.actions.ts";
import { highlightState } from "../../state/highlight/highlight.state.ts";
import { toggleTheme } from "../../state/theme/theme.actions.ts";
import { themeState } from "../../state/theme/theme.state.ts";
import { requestViewCommand } from "../../state/viewer/viewer.actions.ts";
import { viewerState } from "../../state/viewer/viewer.state.ts";

const ZOOM_STEP_FACTOR = 1.5;

/** Fit / zoom steps / theme toggle. */
export function ViewSection(): JSX.Element {
  const { theme } = themeState.use();
  const { file } = viewerState.use();
  const { monochrome } = highlightState.use();
  const hasDocument = file !== null;

  return (
    <RibbonSection title="View">
      <RibbonButton
        icon={<IconFocusCentered />}
        label="Fit"
        size="big"
        disabled={!hasDocument}
        tooltip="Fit the whole drawing into the viewport"
        shortcut="view.fit"
        onClick={() => requestViewCommand({ kind: "fit" })}
      />
      <RibbonButton
        icon={<IconZoomIn />}
        label="In"
        size="mini"
        tooltip="Zoom in"
        shortcut="view.zoomIn"
        onClick={() => requestViewCommand({ kind: "zoom", factor: ZOOM_STEP_FACTOR })}
      />
      <RibbonButton
        icon={<IconZoomOut />}
        label="Out"
        size="mini"
        tooltip="Zoom out"
        shortcut="view.zoomOut"
        onClick={() => requestViewCommand({ kind: "zoom", factor: 1 / ZOOM_STEP_FACTOR })}
      />
      <RibbonButton
        icon={<IconZoomReset />}
        label="100%"
        size="mini"
        tooltip="Reset zoom to 100%"
        shortcut="view.zoom100"
        onClick={() => requestViewCommand({ kind: "zoom100" })}
      />
      <RibbonButton
        icon={theme === "dark" ? <IconSun /> : <IconMoon />}
        label={theme === "dark" ? "Light" : "Dark"}
        size="big"
        tooltip="Toggle light/dark theme"
        shortcut="view.theme"
        onClick={toggleTheme}
      />
      <RibbonButton
        icon={<IconContrast />}
        label="B / W"
        size="big"
        selected={monochrome}
        disabled={!hasDocument}
        tooltip="Render the drawing in ink only — highlight tints never mix with the file's own colors"
        onClick={() => setHighlightMonochrome(!monochrome)}
      />
    </RibbonSection>
  );
}
